export interface StoredImageRecord {
  id: string;
  scopeKey: string;
  name: string;
  mimeType: string;
  sizeKb: number;
  caption: string;
  createdAtMs: number;
  blob: Blob;
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
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('scopeKey', 'scopeKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function compressImageFile(file: File): Promise<{ blob: Blob; mimeType: string }> {
  // Keep small SVGs or small files under 120KB untouched
  if (file.type === 'image/svg+xml' || file.size <= 120 * 1024) {
    return { blob: file, mimeType: file.type || 'image/jpeg' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1440;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (resultBlob) => {
          if (resultBlob && resultBlob.size < file.size) {
            resolve({ blob: resultBlob, mimeType: outType });
          } else {
            resolve({ blob: file, mimeType: file.type || outType });
          }
        },
        outType,
        0.84
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
    };
    img.src = url;
  });
}

export async function compressAndSaveImages(
  scopeKey: string,
  files: FileList | File[]
): Promise<StoredImageRecord[]> {
  const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (fileArray.length === 0) return [];

  const prepared: StoredImageRecord[] = [];
  const baseNow = Date.now();

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const { blob, mimeType } = await compressImageFile(file);
    prepared.push({
      id: `img-${baseNow}-${i}-${Math.floor(Math.random() * 10000)}`,
      scopeKey,
      name: file.name,
      mimeType,
      sizeKb: Math.max(1, Math.round(blob.size / 1024)),
      caption: '',
      createdAtMs: baseNow + i,
      blob,
    });
  }

  const db = await openImagesDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const record of prepared) {
    store.put(record);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return prepared;
}

export async function getImagesForScope(
  scopeKey: string
): Promise<StoredImageRecord[]> {
  try {
    const db = await openImagesDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
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

export async function deleteStoredImage(imageId: string): Promise<void> {
  try {
    const db = await openImagesDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(imageId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal
  }
}

export async function updateStoredImageCaption(
  imageId: string,
  caption: string
): Promise<void> {
  try {
    const db = await openImagesDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(imageId);
    await new Promise<void>((resolve, reject) => {
      getReq.onsuccess = () => {
        const rec = getReq.result as StoredImageRecord | undefined;
        if (rec) {
          rec.caption = caption;
          store.put(rec);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    // non-fatal
  }
}

export async function moveImagesScope(
  fromScope: string,
  toScope: string
): Promise<void> {
  try {
    const existing = await getImagesForScope(fromScope);
    if (existing.length === 0) return;
    const db = await openImagesDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const item of existing) {
      store.put({ ...item, scopeKey: toScope });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal
  }
}
