import { auth } from '../firebase';
import {
  isSupabaseConfigured,
  supabase,
  withFirebaseTokenRetry,
} from '../services/supabaseClient';

export interface StoredImageRecord {
  id: string;
  scopeKey: string;
  name: string;
  mimeType: string;
  sizeKb: number;
  width?: number;
  height?: number;
  caption: string;
  createdAtMs: number;
  blob?: Blob;
  dataUrl?: string;
  storagePath?: string;
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

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(file.name);
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

  // 2) Authenticated Supabase Storage download
  if (
    isSupabaseConfigured &&
    supabase &&
    record.storagePath &&
    !record.storagePath.startsWith('users/')
  ) {
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

  if (blob) {
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

      const { error: rowErr } = await client.from('image_attachments').upsert(
        {
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
        },
        { onConflict: 'owner_id,id' }
      );
      if (rowErr) throw rowErr;
    });
  }

  const syncedRecord: StoredImageRecord = {
    ...record,
    id: safeId,
    storagePath: storagePath || undefined,
    downloadUrl: downloadUrl || undefined,
    cloudSynced: true,
  };
  await putLocalImageRecord(syncedRecord);
  return syncedRecord;
}

export async function compressAndSaveImages(
  scopeKey: string,
  files: FileList | File[],
  uidOverride?: string
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
      createdAtMs: baseNow + i,
      blob,
      dataUrl,
      cloudSynced: false,
    };

    await putLocalImageRecord(record);

    if (uid && isSupabaseConfigured && supabase) {
      const synced = await uploadImageRecordToCloud(uid, record, blob);
      saved.push(synced);
      continue;
    }
    saved.push(record);
  }

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
    return (data || []) as Record<string, unknown>[];
  });

  const storagePaths = rows
    .map((r) => (r.storage_path ? String(r.storage_path) : ''))
    .filter((p) => p && !p.startsWith('users/'));

  const signedUrlMap = new Map<string, string>();
  if (storagePaths.length > 0 && supabase) {
    try {
      const { data: signedList } = await supabase.storage
        .from(USER_IMAGES_BUCKET)
        .createSignedUrls(storagePaths, 3600);
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
    const storagePath = raw.storage_path ? String(raw.storage_path) : undefined;
    const freshSigned = storagePath ? signedUrlMap.get(storagePath) : undefined;
    return {
      id: String(raw.id),
      scopeKey: String(raw.scope_key || scopeKey),
      name: String(raw.file_name || 'image.jpg'),
      mimeType: String(raw.mime_type || 'image/jpeg'),
      sizeKb: Math.max(1, Math.round(Number(raw.size_bytes ?? 0) / 1024)),
      caption: String(raw.caption || ''),
      createdAtMs: Number(raw.created_at_ms ?? 0),
      storagePath,
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

  const channel = supabase
    .channel(`images_${effectiveUid}_${sanitizeImageId(scopeKey)}`)
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
    .subscribe();

  return () => {
    disposed = true;
    if (supabase) {
      void supabase.removeChannel(channel);
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
      await withFirebaseTokenRetry(async (client) => {
        await client
          .from('image_attachments')
          .delete()
          .eq('owner_id', uid)
          .eq('id', sanitizeImageId(image.id));

        if (image.storagePath && !image.storagePath.startsWith('users/')) {
          await client.storage
            .from(USER_IMAGES_BUCKET)
            .remove([image.storagePath]);
        }
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
  coverDataUrl: string;
}> {
  const uid = uidOverride || auth?.currentUser?.uid;
  const compressed = await compressImageFileForCloud(file);
  let coverStoragePath = '';
  let coverImageUrl = '';

  if (uid && isSupabaseConfigured && supabase) {
    const safeId = sanitizeImageId(caseId);
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
    });
  }

  return {
    coverImageUrl,
    coverStoragePath,
    coverDataUrl: '',
  };
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
    await withFirebaseTokenRetry(async (client) =>
      client.storage.from(USER_IMAGES_BUCKET).remove([coverStoragePath])
    );
  } catch {
    // Non-fatal storage cleanup
  }
}

