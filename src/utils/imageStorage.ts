import {
  DEFAULT_IMAGE_FRAME_SPEC,
  ImageFrameSpec,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import { auth } from '../firebase';
import {
  R2UnavailableError,
  StorageProvider,
  deleteFileFromStorage,
  downloadR2Blob,
  getBatchR2DownloadUrls,
  getFileUrl,
  inferStorageModuleFromImageScope,
  isR2ObjectKey,
  isR2PrimaryUploadEnabled,
  resolveEffectiveStorageProvider,
  uploadFileToR2,
} from '../services/storageService';
import {
  ensureSupabaseRealtimeAuth,
  isSupabaseConfigured,
  supabase,
  withFirebaseTokenRetry,
} from '../services/supabaseClient';
import {
  isAppOnline,
  isNetworkOrOfflineError,
  notifyOfflineMediaChanged,
  patchQueuedDailyJournalCover,
  reportPendingMediaCounts,
} from './offlineQueue';

export interface StoredImageRecord {
  id: string;
  scopeKey: string;
  name: string;
  mimeType: string;
  sizeKb: number;
  width?: number;
  height?: number;
  caption: string;
  frameConfig?: ImageFrameSpec;
  categoryLabel?: string;
  sortOrder?: number;
  createdAtMs: number;
  blob?: Blob;
  dataUrl?: string;
  storagePath?: string;
  storageProvider?: StorageProvider;
  downloadUrl?: string;
  cloudSynced?: boolean;
}

const DB_NAME = 'mizan_images_db';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const USER_IMAGES_BUCKET = 'user-images';

function openImagesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const dbRef = req.result;
      if (!dbRef.objectStoreNames.contains(STORE_NAME)) {
        const store = dbRef.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('scopeKey', 'scopeKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function sanitizeImageId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function sanitizeStorageImageName(name: string): string {
  const clean = name
    .replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_')
    .slice(0, 80);
  const extMatch = clean.match(/(\.[a-zA-Z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '.jpg';
  const stem = clean
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `${stem || 'image'}${ext}`;
}

export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB client cap before compression

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(file.name);
}

export function validateImageFileForUpload(file: File): {
  valid: boolean;
  error?: string;
} {
  if (!isImageFile(file)) {
    return {
      valid: false,
      error: `الملف «${file.name}» ليس صورة مدعومة. الصيغ المدعومة: JPG, PNG, WebP, GIF, HEIC.`,
    };
  }
  const lowerType = (file.type || '').toLowerCase();
  if (lowerType === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    return {
      valid: false,
      error: 'ملفات SVG غير مسموح برفعها كصور يومية لأسباب أمنية. استخدم PNG أو JPG أو WebP.',
    };
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      valid: false,
      error: `حجم الصورة «${file.name}» يتجاوز الحد الأقصى المسموح (20 ميجابايت).`,
    };
  }
  return { valid: true };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasCompressFromElement(
  img: HTMLImageElement,
  maxDim: number,
  outType: 'image/jpeg' | 'image/png',
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.max(1, Math.round((height * maxDim) / width));
        width = maxDim;
      } else {
        width = Math.max(1, Math.round((width * maxDim) / height));
        height = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((result) => resolve(result), outType, quality);
  });
}

async function compressImageFileForCloud(
  file: Blob,
  mimeHint?: string
): Promise<{
  blob: Blob;
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
}> {
  const baseMime = file.type || mimeHint || 'image/jpeg';

  if (
    (baseMime === 'image/svg+xml' && file.size <= 350 * 1024) ||
    file.size <= 180 * 1024
  ) {
    const dataUrl = await blobToDataUrl(file);
    return { blob: file, mimeType: baseMime, dataUrl, width: 0, height: 0 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const naturalW = img.naturalWidth || img.width || 0;
      const naturalH = img.naturalHeight || img.height || 0;
      const outType: 'image/jpeg' | 'image/png' =
        baseMime === 'image/png' && file.size < 450 * 1024
          ? 'image/png'
          : 'image/jpeg';

      const resBlob =
        (await canvasCompressFromElement(img, 1600, outType, 0.84)) ||
        (await canvasCompressFromElement(img, 1280, 'image/jpeg', 0.78));

      if (resBlob) {
        const dUrl = await blobToDataUrl(resBlob);
        resolve({
          blob: resBlob,
          mimeType: resBlob.type || outType,
          dataUrl: dUrl,
          width: Math.min(1600, naturalW),
          height:
            naturalW > 1600 && naturalW > 0
              ? Math.round((naturalH * 1600) / naturalW)
              : naturalH,
        });
      } else {
        const dUrl = await blobToDataUrl(file);
        resolve({
          blob: file,
          mimeType: baseMime,
          dataUrl: dUrl,
          width: naturalW,
          height: naturalH,
        });
      }
    };
    img.onerror = async () => {
      URL.revokeObjectURL(url);
      try {
        const dUrl = await blobToDataUrl(file);
        resolve({ blob: file, mimeType: baseMime, dataUrl: dUrl, width: 0, height: 0 });
      } catch {
        resolve({ blob: file, mimeType: baseMime, dataUrl: '', width: 0, height: 0 });
      }
    };
    img.src = url;
  });
}

async function putLocalImageRecord(record: StoredImageRecord): Promise<void> {
  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal
  }
}

async function getLocalImagesForScope(
  scopeKey: string
): Promise<StoredImageRecord[]> {
  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('scopeKey');
    const req = index.getAll(scopeKey);
    const items = await new Promise<StoredImageRecord[]>((resolve, reject) => {
      req.onsuccess = () =>
        resolve((req.result as StoredImageRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return items.sort((a, b) => a.createdAtMs - b.createdAtMs);
  } catch {
    return [];
  }
}

async function getLocalImageById(
  imageId: string
): Promise<StoredImageRecord | null> {
  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(imageId);
    const rec = await new Promise<StoredImageRecord | undefined>(
      (resolve, reject) => {
        req.onsuccess = () => resolve(req.result as StoredImageRecord | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    return rec ?? null;
  } catch {
    return null;
  }
}

export async function resolveImageFallbackUrl(
  record: StoredImageRecord
): Promise<{ url: string; isObjectUrl: boolean } | null> {
  // 1) Local IndexedDB cache
  const localRec = await getLocalImageById(record.id);
  if (localRec?.blob) {
    return { url: URL.createObjectURL(localRec.blob), isObjectUrl: true };
  }
  if (record.dataUrl && record.dataUrl.startsWith('data:')) {
    return { url: record.dataUrl, isObjectUrl: false };
  }
  if (localRec?.dataUrl && localRec.dataUrl.startsWith('data:')) {
    return { url: localRec.dataUrl, isObjectUrl: false };
  }

  // 2) Cloud storage download (Cloudflare R2 or legacy Supabase Storage)
  if (
    isSupabaseConfigured &&
    supabase &&
    record.storagePath &&
    !record.storagePath.startsWith('users/')
  ) {
    const provider = resolveEffectiveStorageProvider(
      record.storageProvider,
      record.storagePath
    );
    if (provider === 'r2') {
      try {
        const blob = await downloadR2Blob({
          objectKey: record.storagePath,
          recordId: record.id,
          recordType: 'image',
          downloadFileName: record.name,
          mimeType: record.mimeType,
        });
        if (blob) {
          await putLocalImageRecord({ ...record, blob });
          return { url: URL.createObjectURL(blob), isObjectUrl: true };
        }
      } catch (err) {
        console.warn('R2 image fallback download failed:', err);
      }
    } else {
      try {
        const blob = await withFirebaseTokenRetry(async (client) => {
          const { data, error } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .download(record.storagePath!);
          if (error || !data) throw error || new Error('Empty image');
          return data;
        });
        if (blob) {
          await putLocalImageRecord({ ...record, blob });
          return { url: URL.createObjectURL(blob), isObjectUrl: true };
        }
      } catch (err) {
        console.warn('Supabase Storage image fallback download failed:', err);
      }
    }
  }

  if (record.downloadUrl) {
    return { url: record.downloadUrl, isObjectUrl: false };
  }

  return null;
}

export async function resolveDentalCaseCoverUrl(
  storagePath?: string
): Promise<{ url: string; isObjectUrl: boolean } | null> {
  if (
    !storagePath ||
    storagePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return null;
  }
  if (isR2ObjectKey(storagePath)) {
    try {
      const signed = await getFileUrl({
        storageProvider: 'r2',
        objectKey: storagePath,
        recordType: 'image',
      });
      if (signed) {
        return { url: signed, isObjectUrl: false };
      }
    } catch (err) {
      console.warn('R2 dental cover fetch failed:', err);
    }
    return null;
  }
  try {
    const blob = await withFirebaseTokenRetry(async (client) => {
      const { data, error } = await client.storage
        .from(USER_IMAGES_BUCKET)
        .download(storagePath);
      if (error || !data) throw error || new Error('Empty dental cover');
      return data;
    });
    if (blob) {
      return { url: URL.createObjectURL(blob), isObjectUrl: true };
    }
  } catch (err) {
    console.warn('Supabase dental cover fetch failed:', err);
  }
  return null;
}

async function uploadImageRecordToCloud(
  uid: string,
  record: StoredImageRecord,
  blob?: Blob
): Promise<StoredImageRecord> {
  if (!isSupabaseConfigured || !supabase) {
    return record;
  }

  const safeId = sanitizeImageId(record.id);
  let storagePath = record.storagePath || '';
  let downloadUrl = record.downloadUrl || '';
  let storageProvider: StorageProvider = resolveEffectiveStorageProvider(
    record.storageProvider,
    storagePath
  );

  if (blob) {
    let usedR2 = false;
    if (isR2PrimaryUploadEnabled()) {
      try {
        const module = inferStorageModuleFromImageScope(record.scopeKey);
        const r2Res = await uploadFileToR2({
          file: blob,
          fileName: record.name || 'image.jpg',
          mimeType: record.mimeType || 'image/jpeg',
          module,
          recordId: safeId,
          recordType: 'image',
          scopeKey: record.scopeKey.slice(0, 128),
          caption: (record.caption || '').slice(0, 500),
          width: Math.max(0, Math.round(record.width ?? 0)),
          height: Math.max(0, Math.round(record.height ?? 0)),
          categoryLabel: (record.categoryLabel || '').slice(0, 80),
          sortOrder: Math.max(0, Math.round(record.sortOrder ?? 0)),
          frameConfig: record.frameConfig ?? DEFAULT_IMAGE_FRAME_SPEC,
          createdAtMs: Math.max(0, Math.round(record.createdAtMs || Date.now())),
        });
        storagePath = r2Res.objectKey;
        downloadUrl = r2Res.downloadUrl;
        storageProvider = 'r2';
        usedR2 = true;
      } catch (err) {
        if (!(err instanceof R2UnavailableError)) throw err;
      }
    }

    if (!usedR2) {
      storageProvider = 'supabase';
      const safeScope = record.scopeKey
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 64);
      const safeFileName = sanitizeStorageImageName(record.name || 'image.jpg');
      storagePath = `${uid}/images/${safeScope}_${safeId}/${safeFileName}`;

      await withFirebaseTokenRetry(async (client) => {
        const { error: uploadErr } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .upload(storagePath, blob, {
            contentType: record.mimeType || 'image/jpeg',
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        try {
          const { data: signed } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .createSignedUrl(storagePath, 3600);
          if (signed?.signedUrl) {
            downloadUrl = signed.signedUrl;
          }
        } catch {
          // Signed URL optional; download() works everywhere
        }

        const baseRow: Record<string, unknown> = {
          owner_id: uid,
          id: safeId,
          scope_key: record.scopeKey.slice(0, 128),
          file_name: (record.name || 'image.jpg').slice(0, 200),
          mime_type: (record.mimeType || 'image/jpeg').slice(0, 80),
          size_bytes: Math.max(0, Math.round((record.sizeKb || 1) * 1024)),
          width: Math.max(0, Math.round(record.width ?? 0)),
          height: Math.max(0, Math.round(record.height ?? 0)),
          caption: (record.caption || '').slice(0, 500),
          storage_bucket: USER_IMAGES_BUCKET,
          storage_path: storagePath,
          download_url: downloadUrl,
          created_at_ms: Math.max(0, Math.round(record.createdAtMs || Date.now())),
        };
        const extendedRow: Record<string, unknown> = {
          ...baseRow,
          frame_config: record.frameConfig ?? DEFAULT_IMAGE_FRAME_SPEC,
          category_label: (record.categoryLabel || '').slice(0, 80),
          sort_order: Math.max(0, Math.round(record.sortOrder ?? 0)),
        };

        const { error: rowErr } = await client
          .from('image_attachments')
          .upsert(extendedRow, { onConflict: 'owner_id,id' });
        if (rowErr) {
          const msg = `${rowErr.code || ''} ${rowErr.message || ''}`.toLowerCase();
          if (
            rowErr.code === '42703' ||
            rowErr.code === 'PGRST204' ||
            msg.includes('column') ||
            msg.includes('schema cache')
          ) {
            const { error: fallbackErr } = await client
              .from('image_attachments')
              .upsert(baseRow, { onConflict: 'owner_id,id' });
            if (fallbackErr) throw fallbackErr;
          } else {
            throw rowErr;
          }
        }
      });
    }
  }

  const syncedRecord: StoredImageRecord = {
    ...record,
    id: safeId,
    storagePath: storagePath || undefined,
    storageProvider,
    downloadUrl: downloadUrl || undefined,
    cloudSynced: true,
  };
  await putLocalImageRecord(syncedRecord);
  return syncedRecord;
}

export async function compressAndSaveImages(
  scopeKey: string,
  files: FileList | File[],
  uidOverride?: string,
  defaults?: {
    frameConfig?: ImageFrameSpec;
    categoryLabel?: string;
  }
): Promise<StoredImageRecord[]> {
  const fileArray = Array.from(files).filter(isImageFile);
  if (fileArray.length === 0) return [];

  const uid = uidOverride || auth?.currentUser?.uid;
  const saved: StoredImageRecord[] = [];
  const baseNow = Date.now();

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const { blob, mimeType, dataUrl, width, height } =
      await compressImageFileForCloud(file);
    const record: StoredImageRecord = {
      id: `img-${baseNow}-${i}-${Math.floor(Math.random() * 10000)}`,
      scopeKey,
      name: file.name,
      mimeType,
      sizeKb: Math.max(1, Math.round(blob.size / 1024)),
      width,
      height,
      caption: '',
      frameConfig: defaults?.frameConfig
        ? sanitizeImageFrameSpec(defaults.frameConfig)
        : { ...DEFAULT_IMAGE_FRAME_SPEC },
      categoryLabel: defaults?.categoryLabel || '',
      sortOrder: 0,
      createdAtMs: baseNow + i,
      blob,
      dataUrl,
      cloudSynced: false,
    };

    await putLocalImageRecord(record);

    if (uid && isSupabaseConfigured && supabase && isAppOnline()) {
      try {
        const synced = await uploadImageRecordToCloud(uid, record, blob);
        saved.push(synced);
        continue;
      } catch (err) {
        if (!isNetworkOrOfflineError(err)) throw err;
      }
    }
    saved.push(record);
  }

  void refreshPendingImagesCount();
  notifyOfflineMediaChanged();
  return saved;
}

async function fetchCloudImagesForScope(
  uid: string,
  scopeKey: string
): Promise<StoredImageRecord[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const rows = await withFirebaseTokenRetry(async (client) => {
    const { data, error } = await client
      .from('image_attachments')
      .select('*')
      .eq('owner_id', uid)
      .eq('scope_key', scopeKey)
      .order('created_at_ms', { ascending: true });
    if (error) throw error;
    return ((data || []) as Record<string, unknown>[]).filter(
      (r) => r.upload_status !== 'pending' && r.upload_status !== 'failed'
    );
  });

  const allPaths = rows
    .map((r) => (r.object_key || r.storage_path ? String(r.object_key || r.storage_path) : ''))
    .filter((p) => p && !p.startsWith('users/'));

  const r2Paths = allPaths.filter((p) => isR2ObjectKey(p));
  const supabasePaths = allPaths.filter((p) => !isR2ObjectKey(p));

  const signedUrlMap = await getBatchR2DownloadUrls(r2Paths, 'image');
  if (supabasePaths.length > 0 && supabase) {
    try {
      const { data: signedList } = await supabase.storage
        .from(USER_IMAGES_BUCKET)
        .createSignedUrls(supabasePaths, 3600);
      if (Array.isArray(signedList)) {
        for (const item of signedList) {
          if (item.path && item.signedUrl) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        }
      }
    } catch {
      // Fallback resolves via download()
    }
  }

  return rows.map((raw) => {
    const storagePath = raw.object_key
      ? String(raw.object_key)
      : raw.storage_path
      ? String(raw.storage_path)
      : undefined;
    const freshSigned = storagePath ? signedUrlMap.get(storagePath) : undefined;
    return {
      id: String(raw.id),
      scopeKey: String(raw.scope_key || scopeKey),
      name: String(raw.original_name || raw.file_name || 'image.jpg'),
      mimeType: String(raw.mime_type || 'image/jpeg'),
      sizeKb: Math.max(
        1,
        Math.round(Number(raw.file_size ?? raw.size_bytes ?? 0) / 1024)
      ),
      width: typeof raw.width === 'number' ? raw.width : undefined,
      height: typeof raw.height === 'number' ? raw.height : undefined,
      caption: String(raw.caption || ''),
      frameConfig: raw.frame_config
        ? sanitizeImageFrameSpec(raw.frame_config)
        : undefined,
      categoryLabel: raw.category_label ? String(raw.category_label) : '',
      sortOrder: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
      createdAtMs: Number(raw.created_at_ms ?? 0),
      storagePath,
      storageProvider: resolveEffectiveStorageProvider(
        raw.storage_provider ? String(raw.storage_provider) : undefined,
        storagePath
      ),
      downloadUrl:
        freshSigned || (raw.download_url ? String(raw.download_url) : undefined),
      cloudSynced: true,
    };
  });
}

export async function getImagesForScope(
  scopeKey: string,
  uidOverride?: string
): Promise<StoredImageRecord[]> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const localItems = await getLocalImagesForScope(scopeKey);

  if (!uid || !isSupabaseConfigured || !supabase) {
    return localItems;
  }

  try {
    const cloudItems = await fetchCloudImagesForScope(uid, scopeKey);
    const mergedMap = new Map<string, StoredImageRecord>();
    for (const loc of localItems) mergedMap.set(loc.id, loc);
    for (const c of cloudItems) {
      const existing = mergedMap.get(c.id);
      mergedMap.set(c.id, {
        ...c,
        blob: existing?.blob,
      });
    }
    return Array.from(mergedMap.values()).sort(
      (a, b) => a.createdAtMs - b.createdAtMs
    );
  } catch {
    return localItems;
  }
}

export function subscribeImagesForScope(
  scopeKey: string,
  uid: string | undefined,
  onData: (records: StoredImageRecord[]) => void,
  onSyncError?: (err: unknown) => void
): () => void {
  const effectiveUid = uid || auth?.currentUser?.uid;

  void getLocalImagesForScope(scopeKey).then((localItems) => {
    if (!effectiveUid && localItems.length > 0) {
      onData(localItems);
    }
  });

  if (!effectiveUid || !isSupabaseConfigured || !supabase) {
    void getLocalImagesForScope(scopeKey).then((items) => onData(items));
    return () => {};
  }

  let disposed = false;

  const refreshScope = async () => {
    if (disposed) return;
    try {
      const [cloudItems, localItems] = await Promise.all([
        fetchCloudImagesForScope(effectiveUid, scopeKey),
        getLocalImagesForScope(scopeKey),
      ]);
      if (disposed) return;

      const localById = new Map<string, StoredImageRecord>();
      for (const l of localItems) localById.set(l.id, l);

      const merged = new Map<string, StoredImageRecord>();
      for (const c of cloudItems) {
        const loc = localById.get(c.id);
        merged.set(c.id, {
          ...c,
          blob: loc?.blob,
          dataUrl: loc?.dataUrl,
        });
      }
      for (const l of localItems) {
        if (!merged.has(l.id) && !l.cloudSynced) {
          merged.set(l.id, l);
        }
      }
      onData(
        Array.from(merged.values()).sort((a, b) => a.createdAtMs - b.createdAtMs)
      );
    } catch (err) {
      console.warn('Supabase image_attachments sync failed:', err);
      if (!disposed) {
        onSyncError?.(err);
        const localFallback = await getLocalImagesForScope(scopeKey);
        if (!disposed) onData(localFallback);
      }
    }
  };

  void refreshScope();

  let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let reconnectTimer: number | null = null;
  let realtimeSubscribed = false;

  const setupRealtimeChannel = async (forceRefreshToken = false) => {
    if (disposed || !supabase) return;
    await ensureSupabaseRealtimeAuth(forceRefreshToken);
    if (disposed || !supabase) return;

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const ch = supabase
      .channel(`images_${effectiveUid}_${sanitizeImageId(scopeKey)}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'image_attachments',
          filter: `owner_id=eq.${effectiveUid}`,
        },
        () => {
          if (!disposed) void refreshScope();
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          realtimeSubscribed = true;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeSubscribed = false;
          if (!reconnectTimer && typeof window !== 'undefined') {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              void setupRealtimeChannel(true);
            }, 4000);
          }
        }
      });

    activeChannel = ch;
  };

  void setupRealtimeChannel(false);

  const onResumeSync = () => {
    if (disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void refreshScope();
    if (!realtimeSubscribed) {
      void setupRealtimeChannel(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onResumeSync);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onResumeSync);
    window.addEventListener('pageshow', onResumeSync);
    window.addEventListener('online', onResumeSync);
  }

  return () => {
    disposed = true;
    if (reconnectTimer && typeof window !== 'undefined') {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onResumeSync);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onResumeSync);
      window.removeEventListener('pageshow', onResumeSync);
      window.removeEventListener('online', onResumeSync);
    }
    if (supabase && activeChannel) {
      void supabase.removeChannel(activeChannel);
    }
  };
}

export async function deleteStoredImage(
  image: StoredImageRecord,
  uidOverride?: string
): Promise<void> {
  const uid = uidOverride || auth?.currentUser?.uid;

  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(image.id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal
  }

  if (uid && isSupabaseConfigured && supabase) {
    try {
      await deleteFileFromStorage({
        storageProvider: resolveEffectiveStorageProvider(
          image.storageProvider,
          image.storagePath
        ),
        objectKey: image.storagePath,
        storageBucket: USER_IMAGES_BUCKET,
        recordId: sanitizeImageId(image.id),
        recordType: 'image',
      });
    } catch {
      // non-fatal
    }
  }
}

export async function updateStoredImageCaption(
  imageId: string,
  caption: string,
  uidOverride?: string
): Promise<void> {
  const uid = uidOverride || auth?.currentUser?.uid;

  try {
    const idb = await openImagesDb();
    const existing = await getLocalImageById(imageId);
    if (existing) {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ...existing, caption });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // non-fatal
  }

  if (uid && isSupabaseConfigured && supabase) {
    try {
      await withFirebaseTokenRetry(async (client) =>
        client
          .from('image_attachments')
          .update({ caption: caption.slice(0, 500) })
          .eq('owner_id', uid)
          .eq('id', sanitizeImageId(imageId))
      );
    } catch {
      // non-fatal
    }
  }
}

export async function moveImagesScope(
  fromScope: string,
  toScope: string,
  uidOverride?: string
): Promise<void> {
  const uid = uidOverride || auth?.currentUser?.uid;

  try {
    const existing = await getLocalImagesForScope(fromScope);
    if (existing.length > 0) {
      const idb = await openImagesDb();
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of existing) {
        store.put({ ...item, scopeKey: toScope });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // non-fatal
  }

  if (uid && isSupabaseConfigured && supabase) {
    try {
      await withFirebaseTokenRetry(async (client) =>
        client
          .from('image_attachments')
          .update({ scope_key: toScope.slice(0, 128) })
          .eq('owner_id', uid)
          .eq('scope_key', fromScope)
      );
    } catch {
      // non-fatal
    }
  }
}

export async function uploadDentalCaseCover(
  caseId: string,
  file: File,
  uidOverride?: string
): Promise<{
  coverImageUrl: string;
  coverStoragePath: string;
  coverStorageProvider?: StorageProvider;
  coverDataUrl: string;
}> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const compressed = await compressImageFileForCloud(file);
  let coverStoragePath = '';
  let coverImageUrl = '';
  let coverStorageProvider: StorageProvider | undefined;

  if (uid && isSupabaseConfigured && supabase) {
    const safeId = sanitizeImageId(caseId);
    let usedR2 = false;
    if (isR2PrimaryUploadEnabled()) {
      try {
        const r2Res = await uploadFileToR2({
          file: compressed.blob,
          fileName: file.name || 'cover.jpg',
          mimeType: compressed.mimeType || 'image/jpeg',
          module: 'dental_cover',
          recordId: `case_cover_${safeId}`,
          recordType: 'none',
        });
        coverStoragePath = r2Res.objectKey;
        coverImageUrl = r2Res.downloadUrl;
        coverStorageProvider = 'r2';
        usedR2 = true;
      } catch (err) {
        if (!(err instanceof R2UnavailableError)) throw err;
      }
    }

    if (!usedR2) {
      const safeName = sanitizeStorageImageName(file.name || 'cover.jpg');
      const storagePath = `${uid}/images/case_cover_${safeId}/${safeName}`;
      await withFirebaseTokenRetry(async (client) => {
        const { error: uploadErr } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .upload(storagePath, compressed.blob, {
            contentType: compressed.mimeType || 'image/jpeg',
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        const { data: signed } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .createSignedUrl(storagePath, 3600);
        coverStoragePath = storagePath;
        coverImageUrl = signed?.signedUrl || '';
        coverStorageProvider = 'supabase';
      });
    }
  }

  return {
    coverImageUrl,
    coverStoragePath,
    coverStorageProvider,
    coverDataUrl: '',
  };
}

export async function updateStoredImageMetadata(
  imageId: string,
  updates: {
    caption?: string;
    frameConfig?: ImageFrameSpec;
    categoryLabel?: string;
    sortOrder?: number;
  },
  uidOverride?: string
): Promise<void> {
  const uid = uidOverride || auth?.currentUser?.uid;

  try {
    const idb = await openImagesDb();
    const existing = await getLocalImageById(imageId);
    if (existing) {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        ...existing,
        ...(updates.caption !== undefined ? { caption: updates.caption } : {}),
        ...(updates.frameConfig !== undefined
          ? { frameConfig: sanitizeImageFrameSpec(updates.frameConfig) }
          : {}),
        ...(updates.categoryLabel !== undefined
          ? { categoryLabel: updates.categoryLabel }
          : {}),
        ...(updates.sortOrder !== undefined
          ? { sortOrder: updates.sortOrder }
          : {}),
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // non-fatal
  }

  if (uid && isSupabaseConfigured && supabase) {
    try {
      const patch: Record<string, unknown> = {};
      if (updates.caption !== undefined) {
        patch.caption = updates.caption.slice(0, 500);
      }
      if (updates.frameConfig !== undefined) {
        patch.frame_config = sanitizeImageFrameSpec(updates.frameConfig);
      }
      if (updates.categoryLabel !== undefined) {
        patch.category_label = updates.categoryLabel.slice(0, 80);
      }
      if (updates.sortOrder !== undefined) {
        patch.sort_order = Math.max(0, Math.round(updates.sortOrder));
      }
      if (Object.keys(patch).length === 0) return;

      await withFirebaseTokenRetry(async (client) => {
        const { error } = await client
          .from('image_attachments')
          .update(patch)
          .eq('owner_id', uid)
          .eq('id', sanitizeImageId(imageId));
        if (error) {
          const msg = `${error.code || ''} ${error.message || ''}`.toLowerCase();
          if (
            (error.code === '42703' ||
              error.code === 'PGRST204' ||
              msg.includes('column') ||
              msg.includes('schema cache')) &&
            updates.caption !== undefined
          ) {
            await client
              .from('image_attachments')
              .update({ caption: updates.caption.slice(0, 500) })
              .eq('owner_id', uid)
              .eq('id', sanitizeImageId(imageId));
          }
        }
      });
    } catch {
      // non-fatal
    }
  }
}

export async function resolveStorageImageUrl(
  storagePath?: string
): Promise<{ url: string; isObjectUrl: boolean } | null> {
  if (
    !storagePath ||
    storagePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return null;
  }
  if (isR2ObjectKey(storagePath)) {
    const signed = await getFileUrl({
      storageProvider: 'r2',
      objectKey: storagePath,
      recordType: 'image',
    });
    return signed ? { url: signed, isObjectUrl: false } : null;
  }
  try {
    const blob = await withFirebaseTokenRetry(async (client) => {
      const { data, error } = await client.storage
        .from(USER_IMAGES_BUCKET)
        .download(storagePath);
      if (error || !data) throw error || new Error('Empty image download');
      return data;
    });
    if (blob) {
      return { url: URL.createObjectURL(blob), isObjectUrl: true };
    }
  } catch {
    try {
      const { data: signed } = await supabase.storage
        .from(USER_IMAGES_BUCKET)
        .createSignedUrl(storagePath, 3600);
      if (signed?.signedUrl) {
        return { url: signed.signedUrl, isObjectUrl: false };
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

export async function uploadReflectionImage(
  reflectionId: string,
  file: File,
  uidOverride?: string
): Promise<{
  imageUrl: string;
  imageStoragePath: string;
  imageStorageProvider?: StorageProvider;
  localObjectUrl: string;
}> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const compressed = await compressImageFileForCloud(file);
  const localObjectUrl = URL.createObjectURL(compressed.blob);
  let imageStoragePath = '';
  let imageUrl = '';
  let imageStorageProvider: StorageProvider | undefined;

  if (uid && isSupabaseConfigured && supabase) {
    const safeId = sanitizeImageId(reflectionId);
    let usedR2 = false;
    if (isR2PrimaryUploadEnabled()) {
      try {
        const r2Res = await uploadFileToR2({
          file: compressed.blob,
          fileName: file.name || 'reflection.jpg',
          mimeType: compressed.mimeType || 'image/jpeg',
          module: 'reflection_image',
          recordId: `reflection_cover_${safeId}`,
          recordType: 'none',
        });
        imageStoragePath = r2Res.objectKey;
        imageUrl = r2Res.downloadUrl;
        imageStorageProvider = 'r2';
        usedR2 = true;
      } catch (err) {
        if (!(err instanceof R2UnavailableError)) throw err;
      }
    }

    if (!usedR2) {
      const safeName = sanitizeStorageImageName(file.name || 'reflection.jpg');
      const storagePath = `${uid}/images/reflection_cover_${safeId}/${safeName}`;
      await withFirebaseTokenRetry(async (client) => {
        const { error: uploadErr } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .upload(storagePath, compressed.blob, {
            contentType: compressed.mimeType || 'image/jpeg',
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        const { data: signed } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .createSignedUrl(storagePath, 3600);
        imageStoragePath = storagePath;
        imageUrl = signed?.signedUrl || '';
        imageStorageProvider = 'supabase';
      });
    }
  }

  return {
    imageUrl: imageUrl || compressed.dataUrl || localObjectUrl,
    imageStoragePath,
    imageStorageProvider,
    localObjectUrl,
  };
}

export async function deleteReflectionImageStorage(
  storagePath?: string
): Promise<void> {
  if (
    !storagePath ||
    storagePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return;
  }
  try {
    await deleteFileFromStorage({
      storageProvider: resolveEffectiveStorageProvider(undefined, storagePath),
      objectKey: storagePath,
      storageBucket: USER_IMAGES_BUCKET,
      recordType: 'image',
    });
  } catch {
    // Non-fatal storage cleanup
  }
}

export async function uploadBlogCoverImage(
  blogId: string,
  file: File,
  uidOverride?: string
): Promise<{
  imageUrl: string;
  imageStoragePath: string;
  coverStorageProvider?: StorageProvider;
  localObjectUrl: string;
}> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const compressed = await compressImageFileForCloud(file);
  const localObjectUrl = URL.createObjectURL(compressed.blob);
  let imageStoragePath = '';
  let imageUrl = '';
  let coverStorageProvider: StorageProvider | undefined;

  if (uid && isSupabaseConfigured && supabase) {
    const safeId = sanitizeImageId(blogId);
    let usedR2 = false;
    if (isR2PrimaryUploadEnabled()) {
      try {
        const r2Res = await uploadFileToR2({
          file: compressed.blob,
          fileName: file.name || 'blog-cover.jpg',
          mimeType: compressed.mimeType || 'image/jpeg',
          module: 'blog_cover',
          recordId: `blog_cover_${safeId}`,
          recordType: 'none',
        });
        imageStoragePath = r2Res.objectKey;
        imageUrl = r2Res.downloadUrl;
        coverStorageProvider = 'r2';
        usedR2 = true;
      } catch (err) {
        if (!(err instanceof R2UnavailableError)) throw err;
      }
    }

    if (!usedR2) {
      const safeName = sanitizeStorageImageName(file.name || 'blog-cover.jpg');
      const storagePath = `${uid}/images/blog_cover_${safeId}/${safeName}`;
      await withFirebaseTokenRetry(async (client) => {
        const { error: uploadErr } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .upload(storagePath, compressed.blob, {
            contentType: compressed.mimeType || 'image/jpeg',
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        const { data: signed } = await client.storage
          .from(USER_IMAGES_BUCKET)
          .createSignedUrl(storagePath, 3600);
        imageStoragePath = storagePath;
        imageUrl = signed?.signedUrl || '';
        coverStorageProvider = 'supabase';
      });
    }
  }

  return {
    imageUrl: imageUrl || compressed.dataUrl || localObjectUrl,
    imageStoragePath,
    coverStorageProvider,
    localObjectUrl,
  };
}

export async function deleteBlogCoverStorage(
  storagePath?: string
): Promise<void> {
  if (
    !storagePath ||
    storagePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return;
  }
  try {
    await deleteFileFromStorage({
      storageProvider: resolveEffectiveStorageProvider(undefined, storagePath),
      objectKey: storagePath,
      storageBucket: USER_IMAGES_BUCKET,
      recordType: 'image',
    });
  } catch {
    // Non-fatal storage cleanup
  }
}

export async function deleteDentalCaseCoverStorage(
  coverStoragePath?: string
): Promise<void> {
  if (
    !coverStoragePath ||
    coverStoragePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return;
  }
  try {
    await deleteFileFromStorage({
      storageProvider: resolveEffectiveStorageProvider(undefined, coverStoragePath),
      objectKey: coverStoragePath,
      storageBucket: USER_IMAGES_BUCKET,
      recordType: 'image',
    });
  } catch {
    // Non-fatal storage cleanup
  }
}

export async function uploadBookCoverImage(
  itemId: string,
  file: File,
  uidOverride?: string
): Promise<{
  imageUrl: string;
  imageStoragePath: string;
  coverStorageProvider?: StorageProvider;
  localObjectUrl: string;
  uploadedToCloud: boolean;
}> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const compressed = await compressImageFileForCloud(file);
  const localObjectUrl = URL.createObjectURL(compressed.blob);
  let imageStoragePath = '';
  let imageUrl = '';
  let coverStorageProvider: StorageProvider | undefined;
  let uploadedToCloud = false;

  if (uid && isSupabaseConfigured && supabase && isAppOnline()) {
    try {
      const safeId = sanitizeImageId(itemId);
      let usedR2 = false;
      if (isR2PrimaryUploadEnabled()) {
        try {
          const r2Res = await uploadFileToR2({
            file: compressed.blob,
            fileName: file.name || 'book-cover.jpg',
            mimeType: compressed.mimeType || 'image/jpeg',
            module: 'library_cover',
            recordId: `book_cover_${safeId}`,
            recordType: 'none',
          });
          imageStoragePath = r2Res.objectKey;
          imageUrl = r2Res.downloadUrl;
          coverStorageProvider = 'r2';
          uploadedToCloud = true;
          usedR2 = true;
        } catch (err) {
          if (!(err instanceof R2UnavailableError)) throw err;
        }
      }

      if (!usedR2) {
        const safeName = sanitizeStorageImageName(file.name || 'book-cover.jpg');
        const storagePath = `${uid}/images/book_cover_${safeId}/${safeName}`;
        await withFirebaseTokenRetry(async (client) => {
          const { error: uploadErr } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .upload(storagePath, compressed.blob, {
              contentType: compressed.mimeType || 'image/jpeg',
              upsert: true,
            });
          if (uploadErr) throw uploadErr;

          const { data: signed } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .createSignedUrl(storagePath, 3600);
          imageStoragePath = storagePath;
          imageUrl = signed?.signedUrl || '';
          coverStorageProvider = 'supabase';
          uploadedToCloud = true;
        });
      }
    } catch (err) {
      if (!isNetworkOrOfflineError(err)) throw err;
    }
  }

  return {
    imageUrl: imageUrl || compressed.dataUrl || localObjectUrl,
    imageStoragePath,
    coverStorageProvider,
    localObjectUrl,
    uploadedToCloud,
  };
}

export async function removeBookCoverStorage(
  storagePath?: string
): Promise<void> {
  if (
    !storagePath ||
    storagePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return;
  }
  try {
    await deleteFileFromStorage({
      storageProvider: resolveEffectiveStorageProvider(undefined, storagePath),
      objectKey: storagePath,
      storageBucket: USER_IMAGES_BUCKET,
      recordType: 'image',
    });
  } catch {
    // Non-fatal storage cleanup
  }
}

export async function replaceStoredImage(
  existing: StoredImageRecord,
  newFile: File,
  uidOverride?: string
): Promise<StoredImageRecord> {
  const check = validateImageFileForUpload(newFile);
  if (!check.valid) {
    throw new Error(check.error || 'ملف غير صالح.');
  }
  const uid = uidOverride || auth?.currentUser?.uid;
  const oldStoragePath = existing.storagePath;
  const oldStorageProvider = existing.storageProvider;
  const compressed = await compressImageFileForCloud(newFile);
  const updatedRecord: StoredImageRecord = {
    ...existing,
    name: newFile.name,
    mimeType: compressed.mimeType,
    sizeKb: Math.max(1, Math.round(compressed.blob.size / 1024)),
    width: compressed.width,
    height: compressed.height,
    blob: compressed.blob,
    dataUrl: compressed.dataUrl,
    cloudSynced: false,
  };
  await putLocalImageRecord(updatedRecord);

  if (uid && isSupabaseConfigured && supabase && isAppOnline()) {
    try {
      const synced = await uploadImageRecordToCloud(uid, updatedRecord, compressed.blob);
      if (
        oldStoragePath &&
        oldStoragePath !== synced.storagePath &&
        !oldStoragePath.startsWith('users/')
      ) {
        try {
          await deleteFileFromStorage({
            storageProvider: resolveEffectiveStorageProvider(
              oldStorageProvider,
              oldStoragePath
            ),
            objectKey: oldStoragePath,
            storageBucket: USER_IMAGES_BUCKET,
            recordType: 'image',
          });
        } catch {
          // Non-fatal cleanup
        }
      }
      void refreshPendingImagesCount();
      notifyOfflineMediaChanged();
      return synced;
    } catch (err) {
      if (!isNetworkOrOfflineError(err)) throw err;
    }
  }
  void refreshPendingImagesCount();
  notifyOfflineMediaChanged();
  return updatedRecord;
}

const PENDING_JOURNAL_COVERS_KEY = 'mizan_pending_journal_covers_v1';

interface PendingJournalCoverEntry {
  dateKey: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  updatedAtMs: number;
}

function readPendingJournalCovers(): PendingJournalCoverEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_JOURNAL_COVERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingJournalCoverEntry[]) : [];
  } catch {
    return [];
  }
}

function writePendingJournalCovers(list: PendingJournalCoverEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_JOURNAL_COVERS_KEY, JSON.stringify(list));
  } catch {
    // Non-fatal quota guard
  }
}

export async function uploadJournalCoverImage(
  dateKey: string,
  file: File,
  uidOverride?: string
): Promise<{
  imageUrl: string;
  imageStoragePath: string;
  coverStorageProvider?: StorageProvider;
  localObjectUrl: string;
  pendingCloudUpload?: boolean;
}> {
  const check = validateImageFileForUpload(file);
  if (!check.valid) {
    throw new Error(check.error || 'ملف غير صالح.');
  }
  const uid = uidOverride || auth?.currentUser?.uid;
  const compressed = await compressImageFileForCloud(file);
  const localObjectUrl = URL.createObjectURL(compressed.blob);
  let imageStoragePath = '';
  let imageUrl = '';
  let coverStorageProvider: StorageProvider | undefined;
  let pendingCloudUpload = false;

  if (uid && isSupabaseConfigured && supabase && isAppOnline()) {
    try {
      const safeId = sanitizeImageId(dateKey);
      let usedR2 = false;
      if (isR2PrimaryUploadEnabled()) {
        try {
          const r2Res = await uploadFileToR2({
            file: compressed.blob,
            fileName: file.name || 'journal-cover.jpg',
            mimeType: compressed.mimeType || 'image/jpeg',
            module: 'journal_attachment',
            recordId: `journal_cover_${safeId}`,
            recordType: 'none',
          });
          imageStoragePath = r2Res.objectKey;
          imageUrl = r2Res.downloadUrl;
          coverStorageProvider = 'r2';
          usedR2 = true;
        } catch (r2Err) {
          if (!(r2Err instanceof R2UnavailableError)) throw r2Err;
        }
      }

      if (!usedR2) {
        const safeName = sanitizeStorageImageName(file.name || 'journal-cover.jpg');
        const storagePath = `${uid}/images/journal_cover_${safeId}/${safeName}`;
        await withFirebaseTokenRetry(async (client) => {
          const { error: uploadErr } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .upload(storagePath, compressed.blob, {
              contentType: compressed.mimeType || 'image/jpeg',
              upsert: true,
            });
          if (uploadErr) throw uploadErr;

          const { data: signed } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .createSignedUrl(storagePath, 3600);
          imageStoragePath = storagePath;
          imageUrl = signed?.signedUrl || '';
          coverStorageProvider = 'supabase';
        });
      }
    } catch (err) {
      if (!isNetworkOrOfflineError(err)) throw err;
      pendingCloudUpload = true;
    }
  } else {
    pendingCloudUpload = Boolean(uid && isSupabaseConfigured);
  }

  if (pendingCloudUpload && compressed.dataUrl) {
    const list = readPendingJournalCovers().filter((c) => c.dateKey !== dateKey);
    list.push({
      dateKey,
      fileName: file.name || 'journal-cover.jpg',
      mimeType: compressed.mimeType || 'image/jpeg',
      dataUrl: compressed.dataUrl,
      updatedAtMs: Date.now(),
    });
    writePendingJournalCovers(list);
    void refreshPendingImagesCount();
    notifyOfflineMediaChanged();
  }

  return {
    imageUrl: imageUrl || compressed.dataUrl || localObjectUrl,
    imageStoragePath,
    coverStorageProvider,
    localObjectUrl,
    pendingCloudUpload,
  };
}

export async function getPendingLocalImageCount(): Promise<number> {
  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    const all = await new Promise<StoredImageRecord[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as StoredImageRecord[]) ?? []);
      req.onerror = () => resolve([]);
    });
    const unsyncedIdb = all.filter((r) => r.cloudSynced === false).length;
    return unsyncedIdb + readPendingJournalCovers().length;
  } catch {
    return readPendingJournalCovers().length;
  }
}

export async function refreshPendingImagesCount(): Promise<number> {
  const count = await getPendingLocalImageCount();
  reportPendingMediaCounts({ images: count });
  return count;
}

export async function syncPendingImagesToCloud(uid: string): Promise<number> {
  if (!uid || !isSupabaseConfigured || !supabase || !isAppOnline()) return 0;
  let syncedCount = 0;
  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    const all = await new Promise<StoredImageRecord[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as StoredImageRecord[]) ?? []);
      req.onerror = () => resolve([]);
    });
    const pending = all.filter((r) => r.cloudSynced === false);
    for (const rec of pending) {
      let blob = rec.blob;
      if (!blob && rec.dataUrl) {
        try {
          const res = await fetch(rec.dataUrl);
          blob = await res.blob();
        } catch {
          blob = undefined;
        }
      }
      if (!blob) continue;
      try {
        await uploadImageRecordToCloud(uid, rec, blob);
        syncedCount += 1;
      } catch (err) {
        if (isNetworkOrOfflineError(err)) break;
      }
    }
  } catch {
    // non-fatal
  }
  await refreshPendingImagesCount();
  if (syncedCount > 0) notifyOfflineMediaChanged();
  return syncedCount;
}

export async function syncPendingJournalCoversToCloud(uid: string): Promise<number> {
  if (!uid || !isSupabaseConfigured || !supabase || !isAppOnline()) return 0;
  const list = readPendingJournalCovers();
  if (list.length === 0) return 0;

  let synced = 0;
  const remaining: PendingJournalCoverEntry[] = [];
  for (const item of list) {
    try {
      const res = await fetch(item.dataUrl);
      const blob = await res.blob();
      const safeId = sanitizeImageId(item.dateKey);
      let storagePath = '';
      let downloadUrl = '';
      let usedR2 = false;

      if (isR2PrimaryUploadEnabled()) {
        try {
          const r2Res = await uploadFileToR2({
            file: blob,
            fileName: item.fileName || 'journal-cover.jpg',
            mimeType: item.mimeType || 'image/jpeg',
            module: 'journal_attachment',
            recordId: `journal_cover_${safeId}`,
            recordType: 'none',
          });
          storagePath = r2Res.objectKey;
          downloadUrl = r2Res.downloadUrl;
          usedR2 = true;
        } catch (r2Err) {
          if (!(r2Err instanceof R2UnavailableError)) throw r2Err;
        }
      }

      if (!usedR2) {
        const safeName = sanitizeStorageImageName(item.fileName || 'journal-cover.jpg');
        storagePath = `${uid}/images/journal_cover_${safeId}/${safeName}`;
        await withFirebaseTokenRetry(async (client) => {
          const { error: uploadErr } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .upload(storagePath, blob, {
              contentType: item.mimeType || 'image/jpeg',
              upsert: true,
            });
          if (uploadErr) throw uploadErr;
          const { data: signed } = await client.storage
            .from(USER_IMAGES_BUCKET)
            .createSignedUrl(storagePath, 3600);
          downloadUrl = signed?.signedUrl || '';
        });
      }

      patchQueuedDailyJournalCover(uid, item.dateKey, storagePath, downloadUrl);
      // Also update daily_journals row directly if present
      await withFirebaseTokenRetry(async (client) => {
        const patchPayload: Record<string, unknown> = {
          cover_image_storage_path: storagePath,
          cover_image_url: downloadUrl,
          cover_storage_provider: usedR2 ? 'r2' : 'supabase',
        };
        const { error } = await client
          .from('daily_journals')
          .update(patchPayload)
          .eq('owner_id', uid)
          .eq('date_key', item.dateKey);
        if (error) {
          const msg = `${error.code || ''} ${error.message || ''}`.toLowerCase();
          if (error.code === '42703' || error.code === 'PGRST204' || msg.includes('column')) {
            await client
              .from('daily_journals')
              .update({
                cover_image_storage_path: storagePath,
                cover_image_url: downloadUrl,
              })
              .eq('owner_id', uid)
              .eq('date_key', item.dateKey);
          }
        }
      });
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }
  writePendingJournalCovers(remaining);
  await refreshPendingImagesCount();
  if (synced > 0) notifyOfflineMediaChanged();
  return synced;
}

export async function deleteJournalCoverStorage(
  storagePath?: string
): Promise<void> {
  if (
    !storagePath ||
    storagePath.startsWith('users/') ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return;
  }
  try {
    await deleteFileFromStorage({
      storageProvider: resolveEffectiveStorageProvider(undefined, storagePath),
      objectKey: storagePath,
      storageBucket: USER_IMAGES_BUCKET,
      recordType: 'image',
    });
  } catch {
    // Non-fatal cleanup
  }
}

async function getAllLocalJournalImages(): Promise<StoredImageRecord[]> {
  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    const all = await new Promise<StoredImageRecord[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as StoredImageRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return all
      .filter((r) => typeof r.scopeKey === 'string' && r.scopeKey.startsWith('journal:'))
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
  } catch {
    return [];
  }
}

export async function fetchAllJournalImagesSummary(
  uidOverride?: string
): Promise<StoredImageRecord[]> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const localItems = await getAllLocalJournalImages();
  if (!uid || !isSupabaseConfigured || !supabase) {
    return localItems;
  }

  const rows = await withFirebaseTokenRetry(async (client) => {
    const { data, error } = await client
      .from('image_attachments')
      .select('*')
      .eq('owner_id', uid)
      .like('scope_key', 'journal:%')
      .order('created_at_ms', { ascending: true });
    if (error) throw error;
    return ((data || []) as Record<string, unknown>[]).filter(
      (r) => r.upload_status !== 'pending' && r.upload_status !== 'failed'
    );
  });

  const allPaths = rows
    .map((r) => (r.object_key || r.storage_path ? String(r.object_key || r.storage_path) : ''))
    .filter((p) => p && !p.startsWith('users/'));

  const r2Paths = allPaths.filter((p) => isR2ObjectKey(p));
  const supabasePaths = allPaths.filter((p) => !isR2ObjectKey(p));

  const signedUrlMap = await getBatchR2DownloadUrls(r2Paths, 'image');
  if (supabasePaths.length > 0 && supabase) {
    try {
      const { data: signedList } = await supabase.storage
        .from(USER_IMAGES_BUCKET)
        .createSignedUrls(supabasePaths, 3600);
      if (Array.isArray(signedList)) {
        for (const item of signedList) {
          if (item.path && item.signedUrl) {
            signedUrlMap.set(item.path, item.signedUrl);
          }
        }
      }
    } catch {
      // Fallback resolves via download()
    }
  }

  const localById = new Map<string, StoredImageRecord>();
  for (const l of localItems) localById.set(l.id, l);

  const merged = new Map<string, StoredImageRecord>();
  for (const raw of rows) {
    const id = String(raw.id);
    const storagePath = raw.object_key
      ? String(raw.object_key)
      : raw.storage_path
      ? String(raw.storage_path)
      : undefined;
    const freshSigned = storagePath ? signedUrlMap.get(storagePath) : undefined;
    const loc = localById.get(id);
    merged.set(id, {
      id,
      scopeKey: String(raw.scope_key || ''),
      name: String(raw.original_name || raw.file_name || 'image.jpg'),
      mimeType: String(raw.mime_type || 'image/jpeg'),
      sizeKb: Math.max(
        1,
        Math.round(Number(raw.file_size ?? raw.size_bytes ?? 0) / 1024)
      ),
      width: typeof raw.width === 'number' ? raw.width : undefined,
      height: typeof raw.height === 'number' ? raw.height : undefined,
      caption: String(raw.caption || ''),
      frameConfig: raw.frame_config
        ? sanitizeImageFrameSpec(raw.frame_config)
        : undefined,
      categoryLabel: raw.category_label ? String(raw.category_label) : '',
      sortOrder: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
      createdAtMs: Number(raw.created_at_ms ?? 0),
      storagePath,
      storageProvider: resolveEffectiveStorageProvider(
        raw.storage_provider ? String(raw.storage_provider) : undefined,
        storagePath
      ),
      downloadUrl:
        freshSigned || (raw.download_url ? String(raw.download_url) : undefined),
      blob: loc?.blob,
      dataUrl: loc?.dataUrl,
      cloudSynced: true,
    });
  }
  for (const l of localItems) {
    if (!merged.has(l.id) && !l.cloudSynced) {
      merged.set(l.id, l);
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
}

export function subscribeJournalImagesSummary(
  uid: string | undefined,
  onData: (records: StoredImageRecord[]) => void,
  onSyncError?: (err: unknown) => void
): () => void {
  const effectiveUid = uid || auth?.currentUser?.uid;

  if (!effectiveUid || !isSupabaseConfigured || !supabase) {
    void getAllLocalJournalImages().then((items) => onData(items));
    return () => {};
  }

  let disposed = false;

  const refresh = async () => {
    if (disposed) return;
    try {
      const items = await fetchAllJournalImagesSummary(effectiveUid);
      if (!disposed) onData(items);
    } catch (err) {
      if (!disposed) {
        onSyncError?.(err);
        const fallback = await getAllLocalJournalImages();
        if (!disposed) onData(fallback);
      }
    }
  };

  void refresh();

  let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let reconnectTimer: number | null = null;
  let realtimeSubscribed = false;

  const setupRealtimeChannel = async (forceRefreshToken = false) => {
    if (disposed || !supabase) return;
    await ensureSupabaseRealtimeAuth(forceRefreshToken);
    if (disposed || !supabase) return;

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const ch = supabase
      .channel(`journal_images_${effectiveUid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'image_attachments',
          filter: `owner_id=eq.${effectiveUid}`,
        },
        () => {
          if (!disposed) void refresh();
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          realtimeSubscribed = true;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeSubscribed = false;
          if (!reconnectTimer && typeof window !== 'undefined') {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              void setupRealtimeChannel(true);
            }, 4000);
          }
        }
      });

    activeChannel = ch;
  };

  void setupRealtimeChannel(false);

  const onResumeSync = () => {
    if (disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void refresh();
    if (!realtimeSubscribed) {
      void setupRealtimeChannel(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onResumeSync);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onResumeSync);
    window.addEventListener('online', onResumeSync);
  }

  return () => {
    disposed = true;
    if (reconnectTimer && typeof window !== 'undefined') {
      window.clearTimeout(reconnectTimer);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onResumeSync);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onResumeSync);
      window.removeEventListener('online', onResumeSync);
    }
    if (supabase && activeChannel) {
      void supabase.removeChannel(activeChannel);
    }
  };
}

