import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { ReadAloudVoiceName } from '../data/curriculumData';
import {
  OperationType,
  db,
  handleFirestoreError,
  storage,
} from '../firebase';

const DB_NAME = 'mizan_tts_audio_cache_v1';
const STORE_NAME = 'audio_clips';
const DB_VERSION = 1;

export interface CachedAudioEntry {
  cacheId: string;
  mimeType: string;
  blob: Blob;
  source: 'local' | 'cloud';
}

interface LocalRecord {
  id: string;
  mimeType: string;
  blob: Blob;
  updatedAtMs: number;
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open audio DB'));
  });
}

async function getLocalClip(cacheId: string): Promise<LocalRecord | null> {
  try {
    const database = await openAudioDb();
    return await new Promise((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(cacheId);
      req.onsuccess = () => {
        const res = req.result as LocalRecord | undefined;
        resolve(res && res.blob ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function putLocalClip(record: LocalRecord): Promise<void> {
  try {
    const database = await openAudioDb();
    await new Promise<void>((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-fatal if local IndexedDB quota is full
  }
}

/**
 * Computes a deterministic Firestore/Storage-safe ID for (text, voiceName, speed).
 */
export function computeAudioCacheId(
  text: string,
  voiceName: ReadAloudVoiceName,
  speed: 'normal' | 'calm'
): string {
  const normalized = `${voiceName}|${speed}|${text.trim().slice(0, 3500)}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i + 1) & 255);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(36);
  const part2 = (h2 >>> 0).toString(36);
  const lenPart = normalized.length.toString(36);
  return `tts_${part1}_${part2}_${lenPart}`;
}

export function base64ToAudioBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binStr = atob(base64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/wav';
    return base64ToAudioBlob(base64, mime);
  } catch {
    return null;
  }
}

/**
 * Loads previously synthesized audio for exact (text, voiceName, speed):
 * 1) IndexedDB on this device
 * 2) Firestore users/{uid}/audioCache/{cacheId} + Firebase Storage cross-device
 */
export async function loadCachedAudioClip(
  uid: string | null | undefined,
  text: string,
  voiceName: ReadAloudVoiceName,
  speed: 'normal' | 'calm'
): Promise<CachedAudioEntry | null> {
  const clean = text.trim();
  if (!clean) return null;

  const cacheId = computeAudioCacheId(clean, voiceName, speed);

  // 1. Check local IndexedDB first for zero-latency playback
  const local = await getLocalClip(cacheId);
  if (local) {
    return {
      cacheId,
      mimeType: local.mimeType || 'audio/wav',
      blob: local.blob,
      source: 'local',
    };
  }

  // 2. Check user's cloud audioCache document (cross-device sync)
  if (!uid) return null;

  const docPath = `users/${uid}/audioCache/${cacheId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'audioCache', cacheId));
    if (!snap.exists()) return null;

    const data = snap.data() as {
      mimeType?: string;
      storagePath?: string;
      downloadUrl?: string;
      inlineDataUrl?: string;
    };
    const mimeType = data.mimeType || 'audio/wav';

    let blob: Blob | null = null;

    if (data.storagePath) {
      try {
        blob = await getBlob(ref(storage, data.storagePath));
      } catch {
        // try downloadUrl or inlineDataUrl next
      }
    }

    if (!blob && data.downloadUrl) {
      try {
        const res = await fetch(data.downloadUrl);
        if (res.ok) {
          blob = await res.blob();
        }
      } catch {
        // try inlineDataUrl next
      }
    }

    if (!blob && data.inlineDataUrl) {
      blob = dataUrlToBlob(data.inlineDataUrl);
    }

    if (!blob) return null;

    // Cache locally for subsequent offline/instant replays
    await putLocalClip({
      id: cacheId,
      mimeType,
      blob,
      updatedAtMs: Date.now(),
    });

    return {
      cacheId,
      mimeType,
      blob,
      source: 'cloud',
    };
  } catch (err) {
    console.warn('Could not read cloud audio cache:', err);
    return null;
  }
}

/**
 * Persists synthesized audio locally (IndexedDB) and in Firebase Storage + Firestore
 * so future clicks replay directly without re-calling /api/tts.
 */
export async function saveAudioClipToCache(
  uid: string | null | undefined,
  text: string,
  voiceName: ReadAloudVoiceName,
  speed: 'normal' | 'calm',
  audioBase64: string,
  mimeType = 'audio/wav'
): Promise<CachedAudioEntry> {
  const clean = text.trim();
  const cacheId = computeAudioCacheId(clean, voiceName, speed);
  const blob = base64ToAudioBlob(audioBase64, mimeType);

  await putLocalClip({
    id: cacheId,
    mimeType,
    blob,
    updatedAtMs: Date.now(),
  });

  if (uid) {
    const ext = mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const storagePath = `users/${uid}/resources/${cacheId}/speech.${ext}`;
    let downloadUrl = '';

    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: mimeType });
      downloadUrl = await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.warn('Storage upload for audio cache failed, trying inline fallback:', storageErr);
    }

    const dataUrl = `data:${mimeType};base64,${audioBase64}`;
    const inlineDataUrl = dataUrl.length <= 750000 ? dataUrl : '';

    if (downloadUrl || inlineDataUrl) {
      const docPath = `users/${uid}/audioCache/${cacheId}`;
      try {
        await setDoc(doc(db, 'users', uid, 'audioCache', cacheId), {
          id: cacheId,
          ownerId: uid,
          voiceName,
          speed,
          mimeType,
          sizeBytes: blob.size,
          storagePath: downloadUrl ? storagePath : '',
          downloadUrl,
          inlineDataUrl,
          previewText: clean.slice(0, 120),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        // Log cleanly without breaking active audio playback
        console.warn('Firestore audioCache write failed:', fsErr);
        try {
          handleFirestoreError(fsErr, OperationType.WRITE, docPath);
        } catch {
          // keep audio playing smoothly even if quota/network error occurs
        }
      }
    }
  }

  return {
    cacheId,
    mimeType,
    blob,
    source: uid ? 'cloud' : 'local',
  };
}
