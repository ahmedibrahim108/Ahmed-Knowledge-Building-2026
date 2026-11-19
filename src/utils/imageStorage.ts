import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '../firebase';

export interface StoredImageRecord {
  id: string;
  scopeKey: string;
  name: string;
  mimeType: string;
  sizeKb: number;
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
): Promise<{ blob: Blob; mimeType: string; dataUrl: string }> {
  const baseMime = file.type || mimeHint || 'image/jpeg';

  // Keep tiny files/SVGs directly if under 180KB
  if (
    (baseMime === 'image/svg+xml' && file.size <= 250 * 1024) ||
    file.size <= 140 * 1024
  ) {
    const dataUrl = await blobToDataUrl(file);
    if (dataUrl.length <= 850_000) {
      return { blob: file, mimeType: baseMime, dataUrl };
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const outType: 'image/jpeg' | 'image/png' =
        baseMime === 'image/png' && file.size < 350 * 1024
          ? 'image/png'
          : 'image/jpeg';

      // Progressively compress until DataURL fits comfortably inside Firestore's 1MB doc limit
      const attempts: Array<{ maxDim: number; quality: number; type: 'image/jpeg' | 'image/png' }> = [
        { maxDim: 1360, quality: 0.82, type: outType },
        { maxDim: 1120, quality: 0.74, type: 'image/jpeg' },
        { maxDim: 900, quality: 0.64, type: 'image/jpeg' },
        { maxDim: 680, quality: 0.55, type: 'image/jpeg' },
      ];

      let chosenBlob: Blob = file;
      let chosenMime = baseMime;
      let chosenDataUrl = '';

      for (const step of attempts) {
        const resBlob = await canvasCompressFromElement(
          img,
          step.maxDim,
          step.type,
          step.quality
        );
        if (!resBlob) continue;
        const dUrl = await blobToDataUrl(resBlob);
        chosenBlob = resBlob;
        chosenMime = step.type;
        chosenDataUrl = dUrl;
        if (dUrl.length <= 680_000) {
          break;
        }
      }

      if (!chosenDataUrl) {
        chosenDataUrl = await blobToDataUrl(chosenBlob);
      }

      resolve({
        blob: chosenBlob,
        mimeType: chosenMime,
        dataUrl: chosenDataUrl.slice(0, 899_000),
      });
    };
    img.onerror = async () => {
      URL.revokeObjectURL(url);
      try {
        const dUrl = await blobToDataUrl(file);
        resolve({
          blob: file,
          mimeType: baseMime,
          dataUrl: dUrl.length <= 890_000 ? dUrl : '',
        });
      } catch {
        resolve({ blob: file, mimeType: baseMime, dataUrl: '' });
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

async function uploadImageRecordToCloud(
  uid: string,
  record: StoredImageRecord,
  blob?: Blob
): Promise<StoredImageRecord> {
  const safeId = sanitizeImageId(record.id);
  let storagePath = record.storagePath || '';
  let downloadUrl = record.downloadUrl || '';
  let dataUrl = record.dataUrl || '';

  if (blob && !dataUrl) {
    const compressed = await compressImageFileForCloud(blob, record.mimeType);
    dataUrl = compressed.dataUrl;
    record.mimeType = compressed.mimeType;
    record.sizeKb = Math.max(1, Math.round(compressed.blob.size / 1024));
  }

  // Try Firebase Storage in addition to Firestore DataURL so large originals stay backed up
  if (blob) {
    try {
      const safeScope = record.scopeKey
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 64);
      const path = `users/${uid}/resources/${safeScope}_${safeId}/${record.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'image.jpg'}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob, {
        contentType: record.mimeType || 'image/jpeg',
      });
      const url = await getDownloadURL(storageRef);
      storagePath = path;
      downloadUrl = url;
    } catch {
      // Storage may not be enabled or CORS restricted — Firestore dataUrl guarantees cross-device sync!
    }
  }

  const payload: Record<string, unknown> = {
    id: safeId,
    ownerId: uid,
    scopeKey: record.scopeKey.slice(0, 128),
    name: (record.name || 'image.jpg').slice(0, 200),
    mimeType: (record.mimeType || 'image/jpeg').slice(0, 80),
    sizeKb: Math.max(0, Math.min(20000, Math.round(record.sizeKb || 1))),
    caption: (record.caption || '').slice(0, 500),
    createdAtMs: Math.max(0, Math.round(record.createdAtMs || Date.now())),
    updatedAt: serverTimestamp(),
  };

  if (dataUrl && dataUrl.length <= 899_000) {
    payload.dataUrl = dataUrl;
  }
  if (storagePath) {
    payload.storagePath = storagePath.slice(0, 400);
  }
  if (downloadUrl) {
    payload.downloadUrl = downloadUrl.slice(0, 1200);
  }

  await setDoc(doc(db, 'users', uid, 'images', safeId), payload);

  const syncedRecord: StoredImageRecord = {
    ...record,
    id: safeId,
    dataUrl: (payload.dataUrl as string | undefined) || record.dataUrl,
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
  const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (fileArray.length === 0) return [];

  const uid = uidOverride || auth.currentUser?.uid;
  const saved: StoredImageRecord[] = [];
  const baseNow = Date.now();

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const { blob, mimeType, dataUrl } = await compressImageFileForCloud(file);
    const record: StoredImageRecord = {
      id: `img-${baseNow}-${i}-${Math.floor(Math.random() * 10000)}`,
      scopeKey,
      name: file.name,
      mimeType,
      sizeKb: Math.max(1, Math.round(blob.size / 1024)),
      caption: '',
      createdAtMs: baseNow + i,
      blob,
      dataUrl,
      cloudSynced: false,
    };

    await putLocalImageRecord(record);

    if (uid) {
      try {
        const synced = await uploadImageRecordToCloud(uid, record, blob);
        saved.push(synced);
        continue;
      } catch (err) {
        console.warn('Firestore image sync failed, retained local copy:', err);
      }
    }
    saved.push(record);
  }

  return saved;
}

export async function getImagesForScope(
  scopeKey: string,
  uidOverride?: string
): Promise<StoredImageRecord[]> {
  const uid = uidOverride || auth.currentUser?.uid;
  const localItems = await getLocalImagesForScope(scopeKey);
  if (!uid) return localItems;

  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'images'),
        where('ownerId', '==', uid),
        where('scopeKey', '==', scopeKey)
      )
    );
    const cloudMap = new Map<string, StoredImageRecord>();
    for (const d of snap.docs) {
      const raw = d.data() as Record<string, unknown>;
      const rec: StoredImageRecord = {
        id: String(raw.id ?? d.id),
        scopeKey: String(raw.scopeKey ?? scopeKey),
        name: String(raw.name ?? 'image.jpg'),
        mimeType: String(raw.mimeType ?? 'image/jpeg'),
        sizeKb: Number(raw.sizeKb ?? 0),
        caption: String(raw.caption ?? ''),
        createdAtMs: Number(raw.createdAtMs ?? 0),
        dataUrl: raw.dataUrl ? String(raw.dataUrl) : undefined,
        storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
        downloadUrl: raw.downloadUrl ? String(raw.downloadUrl) : undefined,
        cloudSynced: true,
      };
      cloudMap.set(rec.id, rec);
    }

    // Auto-migrate any older local-only IndexedDB images up to Firestore
    for (const local of localItems) {
      const safeId = sanitizeImageId(local.id);
      if (!cloudMap.has(safeId) && local.blob) {
        try {
          const uploaded = await uploadImageRecordToCloud(uid, local, local.blob);
          cloudMap.set(uploaded.id, uploaded);
        } catch {
          cloudMap.set(safeId, local);
        }
      }
    }

    return Array.from(cloudMap.values()).sort(
      (a, b) => a.createdAtMs - b.createdAtMs
    );
  } catch {
    return localItems;
  }
}

export function subscribeImagesForScope(
  scopeKey: string,
  uid: string | undefined,
  onChange: (items: StoredImageRecord[]) => void
): () => void {
  if (!uid) {
    void getLocalImagesForScope(scopeKey).then(onChange);
    return () => {};
  }

  let migratedOnce = false;
  const q = query(
    collection(db, 'users', uid, 'images'),
    where('ownerId', '==', uid),
    where('scopeKey', '==', scopeKey)
  );

  const unsub = onSnapshot(
    q,
    async (snap) => {
      const cloudMap = new Map<string, StoredImageRecord>();
      for (const d of snap.docs) {
        const raw = d.data() as Record<string, unknown>;
        const rec: StoredImageRecord = {
          id: String(raw.id ?? d.id),
          scopeKey: String(raw.scopeKey ?? scopeKey),
          name: String(raw.name ?? 'image.jpg'),
          mimeType: String(raw.mimeType ?? 'image/jpeg'),
          sizeKb: Number(raw.sizeKb ?? 0),
          caption: String(raw.caption ?? ''),
          createdAtMs: Number(raw.createdAtMs ?? 0),
          dataUrl: raw.dataUrl ? String(raw.dataUrl) : undefined,
          storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
          downloadUrl: raw.downloadUrl ? String(raw.downloadUrl) : undefined,
          cloudSynced: true,
        };
        cloudMap.set(rec.id, rec);
      }

      if (!migratedOnce) {
        migratedOnce = true;
        const localItems = await getLocalImagesForScope(scopeKey);
        for (const local of localItems) {
          const safeId = sanitizeImageId(local.id);
          if (!cloudMap.has(safeId) && local.blob) {
            try {
              const uploaded = await uploadImageRecordToCloud(
                uid,
                local,
                local.blob
              );
              cloudMap.set(uploaded.id, uploaded);
            } catch {
              cloudMap.set(safeId, local);
            }
          }
        }
      }

      onChange(
        Array.from(cloudMap.values()).sort(
          (a, b) => a.createdAtMs - b.createdAtMs
        )
      );
    },
    async () => {
      const localItems = await getLocalImagesForScope(scopeKey);
      onChange(localItems);
    }
  );

  return unsub;
}

export async function deleteStoredImage(
  image: Pick<StoredImageRecord, 'id' | 'storagePath'>,
  uidOverride?: string
): Promise<void> {
  const imageId = image.id;
  const uid = uidOverride || auth.currentUser?.uid;

  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(imageId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal
  }

  if (uid) {
    try {
      await deleteDoc(doc(db, 'users', uid, 'images', sanitizeImageId(imageId)));
    } catch {
      // non-fatal
    }
    if (image.storagePath) {
      try {
        await deleteObject(ref(storage, image.storagePath));
      } catch {
        // non-fatal
      }
    }
  }
}

export async function updateStoredImageCaption(
  imageId: string,
  caption: string,
  uidOverride?: string
): Promise<void> {
  const trimmed = caption.slice(0, 500);
  const uid = uidOverride || auth.currentUser?.uid;

  try {
    const idb = await openImagesDb();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(imageId);
    await new Promise<void>((resolve, reject) => {
      getReq.onsuccess = () => {
        const rec = getReq.result as StoredImageRecord | undefined;
        if (rec) {
          rec.caption = trimmed;
          store.put(rec);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    // non-fatal
  }

  if (uid) {
    try {
      await updateDoc(doc(db, 'users', uid, 'images', sanitizeImageId(imageId)), {
        caption: trimmed,
        updatedAt: serverTimestamp(),
      });
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
  const uid = uidOverride || auth.currentUser?.uid;

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

  if (uid) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'users', uid, 'images'),
          where('ownerId', '==', uid),
          where('scopeKey', '==', fromScope)
        )
      );
      for (const d of snap.docs) {
        await updateDoc(d.ref, {
          scopeKey: toScope.slice(0, 128),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // non-fatal
    }
  }
}
