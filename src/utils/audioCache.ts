import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

const DB_NAME = 'mizan_tts_audio_cache_v2';
const STORE_NAME = 'audio_clips';
const META_STORE_NAME = 'entity_index';
const DB_VERSION = 2;
const CHUNK_CHAR_SIZE = 500_000;

export type AudioEntityType = 'note' | 'month' | 'course' | 'summary' | 'other';

export interface AudioEntityMeta {
  entityType?: AudioEntityType;
  entityId?: string;
  title?: string;
}

export interface CachedAudioEntry {
  cacheId: string;
  mimeType: string;
  blob: Blob;
  source: 'local' | 'cloud';
  durationSeconds?: number;
  lastPositionSeconds?: number;
  playbackRate?: number;
  title?: string;
  entityId?: string;
  entityType?: AudioEntityType;
}

export interface SavedAudioClipSummary {
  id: string;
  title: string;
  previewText: string;
  entityType: AudioEntityType;
  entityId: string;
  voiceName: ReadAloudVoiceName;
  speed: 'normal' | 'calm';
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  lastPositionSeconds: number;
  playbackRate: number;
  updatedAtMs?: number;
}

interface LocalRecord {
  id: string;
  mimeType: string;
  blob: Blob;
  updatedAtMs: number;
  durationSeconds?: number;
  lastPositionSeconds?: number;
  playbackRate?: number;
  entityId?: string;
  entityType?: AudioEntityType;
  title?: string;
  contentHash?: string;
}

interface EntityIndexRecord {
  entityKey: string;
  cacheId: string;
  contentHash: string;
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
      if (!database.objectStoreNames.contains(META_STORE_NAME)) {
        database.createObjectStore(META_STORE_NAME, { keyPath: 'entityKey' });
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

async function getLocalEntityIndex(entityKey: string): Promise<EntityIndexRecord | null> {
  try {
    const database = await openAudioDb();
    return await new Promise((resolve) => {
      const tx = database.transaction(META_STORE_NAME, 'readonly');
      const req = tx.objectStore(META_STORE_NAME).get(entityKey);
      req.onsuccess = () => resolve((req.result as EntityIndexRecord | undefined) ?? null);
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
      const stores = record.entityId ? [STORE_NAME, META_STORE_NAME] : [STORE_NAME];
      const tx = database.transaction(stores, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      if (record.entityId && record.contentHash) {
        tx.objectStore(META_STORE_NAME).put({
          entityKey: `${record.entityType || 'other'}:${record.entityId}`,
          cacheId: record.id,
          contentHash: record.contentHash,
          updatedAtMs: record.updatedAtMs,
        } satisfies EntityIndexRecord);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-fatal if IndexedDB quota is full
  }
}

export function computeTextContentHash(text: string): string {
  const normalized = text.trim().slice(0, 6000);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i + 1) & 255);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}_${normalized.length.toString(36)}`;
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

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binStr = atob(base64);
  const len = binStr.length;
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToAudioBlob(base64: string, mimeType = 'audio/wav'): Blob {
  return new Blob([base64ToUint8Array(base64)], { type: mimeType });
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

function parseWavInfo(bytes: Uint8Array): {
  isPcm16MonoWav: boolean;
  sampleRate: number;
  dataOffset: number;
  dataSize: number;
  durationSeconds: number;
} {
  if (bytes.length < 44) {
    return { isPcm16MonoWav: false, sampleRate: 24000, dataOffset: 44, dataSize: 0, durationSeconds: 0 };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return { isPcm16MonoWav: false, sampleRate: 24000, dataOffset: 44, dataSize: 0, durationSeconds: 0 };
  }
  const audioFormat = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const byteRate = view.getUint32(28, true);
  const bitsPerSample = view.getUint16(34, true);

  let offset = 12;
  let dataOffset = 44;
  let dataSize = bytes.length - 44;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = Math.min(chunkSize, bytes.length - dataOffset);
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  const durationSeconds = byteRate > 0 ? dataSize / byteRate : 0;
  return {
    isPcm16MonoWav: audioFormat === 1 && channels === 1 && bitsPerSample === 16,
    sampleRate,
    dataOffset,
    dataSize,
    durationSeconds,
  };
}

/**
 * Downsamples 24kHz mono 16-bit PCM WAV -> 16kHz mono 16-bit PCM WAV (~33% smaller, crisp speech)
 * and computes exact duration in seconds.
 */
function compactWavIfHelpful(
  audioBase64: string,
  mimeType: string
): { base64: string; mimeType: string; durationSeconds: number } {
  if (!mimeType.toLowerCase().includes('wav')) {
    return { base64: audioBase64, mimeType, durationSeconds: 0 };
  }
  try {
    const bytes = base64ToUint8Array(audioBase64);
    const info = parseWavInfo(bytes);
    if (!info.isPcm16MonoWav || info.sampleRate <= 16000 || info.dataSize < 3200) {
      return {
        base64: audioBase64,
        mimeType: 'audio/wav',
        durationSeconds: Math.round(info.durationSeconds * 10) / 10,
      };
    }

    const srcSamples = Math.floor(info.dataSize / 2);
    const targetRate = 16000;
    const ratio = info.sampleRate / targetRate; // e.g. 24000 / 16000 = 1.5
    const dstSamples = Math.floor(srcSamples / ratio);
    const outBuffer = new ArrayBuffer(44 + dstSamples * 2);
    const srcView = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, srcSamples * 2);
    const dstView = new DataView(outBuffer);

    const writeAscii = (pos: number, str: string) => {
      for (let i = 0; i < str.length; i++) dstView.setUint8(pos + i, str.charCodeAt(i));
    };

    const dstDataSize = dstSamples * 2;
    writeAscii(0, 'RIFF');
    dstView.setUint32(4, 36 + dstDataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    dstView.setUint32(16, 16, true);
    dstView.setUint16(20, 1, true);
    dstView.setUint16(22, 1, true);
    dstView.setUint32(24, targetRate, true);
    dstView.setUint32(28, targetRate * 2, true);
    dstView.setUint16(32, 2, true);
    dstView.setUint16(34, 16, true);
    writeAscii(36, 'data');
    dstView.setUint32(40, dstDataSize, true);

    for (let i = 0; i < dstSamples; i++) {
      const srcPos = i * ratio;
      const i0 = Math.min(srcSamples - 1, Math.floor(srcPos));
      const i1 = Math.min(srcSamples - 1, i0 + 1);
      const frac = srcPos - i0;
      const s0 = srcView.getInt16(i0 * 2, true);
      const s1 = srcView.getInt16(i1 * 2, true);
      const val = Math.round(s0 + (s1 - s0) * frac);
      dstView.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, val)), true);
    }

    const outBytes = new Uint8Array(outBuffer);
    return {
      base64: uint8ArrayToBase64(outBytes),
      mimeType: 'audio/wav',
      durationSeconds: Math.round((dstSamples / targetRate) * 10) / 10,
    };
  } catch {
    return { base64: audioBase64, mimeType, durationSeconds: 0 };
  }
}

async function resolveCloudBlobFromDoc(
  uid: string,
  cacheId: string,
  data: {
    mimeType?: string;
    storagePath?: string;
    downloadUrl?: string;
    inlineDataUrl?: string;
    chunkCount?: number;
  }
): Promise<Blob | null> {
  const mimeType = data.mimeType || 'audio/wav';

  if (data.inlineDataUrl) {
    const b = dataUrlToBlob(data.inlineDataUrl);
    if (b) return b;
  }

  if (data.chunkCount && data.chunkCount > 0) {
    try {
      const chunksSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'audioCache', cacheId, 'chunks'),
          where('ownerId', '==', uid)
        )
      );
      if (!chunksSnap.empty) {
        const sorted = chunksSnap.docs
          .map((d) => d.data() as { chunkIndex: number; data: string })
          .sort((a, b) => a.chunkIndex - b.chunkIndex);
        const fullDataUrl = sorted.map((c) => c.data).join('');
        const b = dataUrlToBlob(fullDataUrl);
        if (b) return b;
      }
    } catch (err) {
      console.warn('Could not read audio chunks:', err);
    }
  }

  if (data.storagePath) {
    try {
      const b = await getBlob(ref(storage, data.storagePath));
      if (b) return b;
    } catch {
      // try downloadUrl
    }
  }

  if (data.downloadUrl) {
    try {
      const res = await fetch(data.downloadUrl);
      if (res.ok) {
        return await res.blob();
      }
    } catch {
      // failed
    }
  }

  return null;
}

/**
 * Loads previously synthesized audio for exact (text, voiceName, speed) OR matching entityId + contentHash:
 * 1) IndexedDB on this device
 * 2) Firestore users/{uid}/audioCache (with inline, chunked, or Storage payload) cross-device
 */
export async function loadCachedAudioClip(
  uid: string | null | undefined,
  text: string,
  voiceName: ReadAloudVoiceName,
  speed: 'normal' | 'calm',
  meta?: AudioEntityMeta
): Promise<CachedAudioEntry | null> {
  const clean = text.trim();
  if (!clean) return null;

  const cacheId = computeAudioCacheId(clean, voiceName, speed);
  const contentHash = computeTextContentHash(clean);

  // 1. Check local IndexedDB by exact cacheId
  const local = await getLocalClip(cacheId);
  if (local) {
    return {
      cacheId,
      mimeType: local.mimeType || 'audio/wav',
      blob: local.blob,
      source: 'local',
      durationSeconds: local.durationSeconds,
      lastPositionSeconds: local.lastPositionSeconds ?? 0,
      playbackRate: local.playbackRate ?? 1,
      title: local.title,
      entityId: local.entityId,
      entityType: local.entityType,
    };
  }

  // 1b. Check local IndexedDB by entityId if contentHash matches
  if (meta?.entityId) {
    const idx = await getLocalEntityIndex(`${meta.entityType || 'other'}:${meta.entityId}`);
    if (idx && idx.contentHash === contentHash) {
      const byEntity = await getLocalClip(idx.cacheId);
      if (byEntity) {
        return {
          cacheId: byEntity.id,
          mimeType: byEntity.mimeType || 'audio/wav',
          blob: byEntity.blob,
          source: 'local',
          durationSeconds: byEntity.durationSeconds,
          lastPositionSeconds: byEntity.lastPositionSeconds ?? 0,
          playbackRate: byEntity.playbackRate ?? 1,
          title: byEntity.title,
          entityId: byEntity.entityId,
          entityType: byEntity.entityType,
        };
      }
    }
  }

  if (!uid) return null;

  try {
    // 2. Check exact Firestore doc
    let targetDocId = cacheId;
    let rawData: Record<string, unknown> | null = null;

    const snap = await getDoc(doc(db, 'users', uid, 'audioCache', cacheId));
    if (snap.exists()) {
      rawData = snap.data() as Record<string, unknown>;
    } else if (meta?.entityId) {
      // 2b. Query by entityId across devices (even if another device used slightly different voice/speed)
      const qSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'audioCache'),
          where('ownerId', '==', uid),
          where('entityId', '==', meta.entityId.slice(0, 128))
        )
      );
      if (!qSnap.empty) {
        const docs = qSnap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
        const exactContentMatch = docs.find((d) => d.data.contentHash === contentHash);
        const chosen = exactContentMatch ?? docs[0];
        if (chosen && exactContentMatch) {
          targetDocId = chosen.id;
          rawData = chosen.data;
        }
      }
    }

    if (!rawData) return null;

    const mimeType = String(rawData.mimeType || 'audio/wav');
    const blob = await resolveCloudBlobFromDoc(uid, targetDocId, {
      mimeType,
      storagePath: rawData.storagePath ? String(rawData.storagePath) : undefined,
      downloadUrl: rawData.downloadUrl ? String(rawData.downloadUrl) : undefined,
      inlineDataUrl: rawData.inlineDataUrl ? String(rawData.inlineDataUrl) : undefined,
      chunkCount: typeof rawData.chunkCount === 'number' ? rawData.chunkCount : undefined,
    });

    if (!blob) return null;

    const durationSeconds = Number(rawData.durationSeconds ?? 0);
    const lastPositionSeconds = Number(rawData.lastPositionSeconds ?? 0);
    const playbackRate = Number(rawData.playbackRate ?? 1);

    await putLocalClip({
      id: targetDocId,
      mimeType,
      blob,
      updatedAtMs: Date.now(),
      durationSeconds,
      lastPositionSeconds,
      playbackRate,
      entityId: meta?.entityId || (rawData.entityId ? String(rawData.entityId) : undefined),
      entityType: meta?.entityType || (rawData.entityType as AudioEntityType | undefined),
      title: meta?.title || (rawData.title ? String(rawData.title) : undefined),
      contentHash,
    });

    return {
      cacheId: targetDocId,
      mimeType,
      blob,
      source: 'cloud',
      durationSeconds,
      lastPositionSeconds,
      playbackRate,
      title: rawData.title ? String(rawData.title) : meta?.title,
      entityId: rawData.entityId ? String(rawData.entityId) : meta?.entityId,
      entityType: (rawData.entityType as AudioEntityType | undefined) || meta?.entityType,
    };
  } catch (err) {
    console.warn('Could not read cloud audio cache:', err);
    return null;
  }
}

/**
 * Loads a cached clip directly by its cacheId (for Dashboard Saved Audio strip).
 */
export async function loadAudioClipById(
  uid: string | null | undefined,
  cacheId: string
): Promise<CachedAudioEntry | null> {
  const local = await getLocalClip(cacheId);
  if (local) {
    return {
      cacheId,
      mimeType: local.mimeType || 'audio/wav',
      blob: local.blob,
      source: 'local',
      durationSeconds: local.durationSeconds,
      lastPositionSeconds: local.lastPositionSeconds ?? 0,
      playbackRate: local.playbackRate ?? 1,
      title: local.title,
      entityId: local.entityId,
      entityType: local.entityType,
    };
  }
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'audioCache', cacheId));
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    const mimeType = String(raw.mimeType || 'audio/wav');
    const blob = await resolveCloudBlobFromDoc(uid, cacheId, {
      mimeType,
      storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
      downloadUrl: raw.downloadUrl ? String(raw.downloadUrl) : undefined,
      inlineDataUrl: raw.inlineDataUrl ? String(raw.inlineDataUrl) : undefined,
      chunkCount: typeof raw.chunkCount === 'number' ? raw.chunkCount : undefined,
    });
    if (!blob) return null;

    const entry: LocalRecord = {
      id: cacheId,
      mimeType,
      blob,
      updatedAtMs: Date.now(),
      durationSeconds: Number(raw.durationSeconds ?? 0),
      lastPositionSeconds: Number(raw.lastPositionSeconds ?? 0),
      playbackRate: Number(raw.playbackRate ?? 1),
      title: raw.title ? String(raw.title) : undefined,
      entityId: raw.entityId ? String(raw.entityId) : undefined,
      entityType: raw.entityType as AudioEntityType | undefined,
      contentHash: raw.contentHash ? String(raw.contentHash) : undefined,
    };
    await putLocalClip(entry);
    return {
      cacheId,
      mimeType,
      blob,
      source: 'cloud',
      durationSeconds: entry.durationSeconds,
      lastPositionSeconds: entry.lastPositionSeconds,
      playbackRate: entry.playbackRate,
      title: entry.title,
      entityId: entry.entityId,
      entityType: entry.entityType,
    };
  } catch (err) {
    console.warn('loadAudioClipById error:', err);
    return null;
  }
}

/**
 * Lists all saved audio clips for the current user across devices.
 */
export async function listUserAudioClips(
  uid: string | null | undefined
): Promise<SavedAudioClipSummary[]> {
  if (!uid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'audioCache'), where('ownerId', '==', uid))
    );
    return snap.docs
      .map((d) => {
        const raw = d.data() as Record<string, unknown>;
        const updatedAt = raw.updatedAt as { toMillis?: () => number } | undefined;
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title || raw.previewText || 'تسجيل صوتي محفوظ'),
          previewText: String(raw.previewText || ''),
          entityType: (raw.entityType as AudioEntityType) || 'other',
          entityId: String(raw.entityId || ''),
          voiceName: (raw.voiceName as ReadAloudVoiceName) || 'Kore',
          speed: raw.speed === 'calm' ? 'calm' : 'normal',
          mimeType: String(raw.mimeType || 'audio/wav'),
          sizeBytes: Number(raw.sizeBytes ?? 0),
          durationSeconds: Number(raw.durationSeconds ?? 0),
          lastPositionSeconds: Number(raw.lastPositionSeconds ?? 0),
          playbackRate: Number(raw.playbackRate ?? 1),
          updatedAtMs: typeof updatedAt?.toMillis === 'function' ? updatedAt.toMillis() : 0,
        } satisfies SavedAudioClipSummary;
      })
      .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
  } catch (err) {
    console.warn('Could not list audio clips:', err);
    return [];
  }
}

/**
 * Persists synthesized audio locally (IndexedDB) and in Firebase Storage + Firestore
 * (inline or chunked) so future plays & mobile/desktop devices never re-call /api/tts.
 */
export async function saveAudioClipToCache(
  uid: string | null | undefined,
  text: string,
  voiceName: ReadAloudVoiceName,
  speed: 'normal' | 'calm',
  audioBase64: string,
  mimeType = 'audio/wav',
  meta?: AudioEntityMeta
): Promise<CachedAudioEntry> {
  const clean = text.trim();
  const cacheId = computeAudioCacheId(clean, voiceName, speed);
  const contentHash = computeTextContentHash(clean);
  const compacted = compactWavIfHelpful(audioBase64, mimeType);
  const blob = base64ToAudioBlob(compacted.base64, compacted.mimeType);

  await putLocalClip({
    id: cacheId,
    mimeType: compacted.mimeType,
    blob,
    updatedAtMs: Date.now(),
    durationSeconds: compacted.durationSeconds,
    lastPositionSeconds: 0,
    playbackRate: 1,
    entityId: meta?.entityId,
    entityType: meta?.entityType,
    title: meta?.title,
    contentHash,
  });

  if (uid) {
    const ext = compacted.mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const storagePath = `users/${uid}/audioCache/${cacheId}.${ext}`;
    let downloadUrl = '';

    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: compacted.mimeType });
      downloadUrl = await getDownloadURL(storageRef);
    } catch (storageErr) {
      console.warn('Storage upload for audio cache failed, using Firestore inline/chunked persistence:', storageErr);
    }

    const dataUrl = `data:${compacted.mimeType};base64,${compacted.base64}`;
    const inlineDataUrl = dataUrl.length <= 750_000 ? dataUrl : '';
    let chunkCount = 0;

    // Ensure Firestore parent doc exists first so chunk subcollection passes Master Gate / rules
    const docPath = `users/${uid}/audioCache/${cacheId}`;
    try {
      if (!inlineDataUrl && dataUrl.length <= 18_000_000) {
        const totalChunks = Math.ceil(dataUrl.length / CHUNK_CHAR_SIZE);
        chunkCount = totalChunks;
      }

      await setDoc(doc(db, 'users', uid, 'audioCache', cacheId), {
        id: cacheId,
        ownerId: uid,
        voiceName,
        speed,
        mimeType: compacted.mimeType.slice(0, 80),
        sizeBytes: blob.size,
        storagePath: downloadUrl ? storagePath : '',
        downloadUrl,
        inlineDataUrl,
        previewText: clean.slice(0, 120),
        entityType: meta?.entityType || 'other',
        entityId: (meta?.entityId || '').slice(0, 128),
        title: (meta?.title || clean.slice(0, 80)).slice(0, 200),
        contentHash,
        durationSeconds: compacted.durationSeconds,
        lastPositionSeconds: 0,
        playbackRate: 1,
        chunkCount,
        updatedAt: serverTimestamp(),
      });

      if (chunkCount > 0) {
        const batch = writeBatch(db);
        for (let i = 0; i < chunkCount; i++) {
          const chunkId = `chunk_${String(i).padStart(4, '0')}`;
          const slice = dataUrl.slice(i * CHUNK_CHAR_SIZE, (i + 1) * CHUNK_CHAR_SIZE);
          batch.set(doc(db, 'users', uid, 'audioCache', cacheId, 'chunks', chunkId), {
            id: chunkId,
            ownerId: uid,
            chunkIndex: i,
            data: slice,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('Firestore audioCache write failed:', fsErr);
      try {
        handleFirestoreError(fsErr, OperationType.WRITE, docPath);
      } catch {
        // Keep playing audio locally even if cloud quota/network error occurs
      }
    }
  }

  return {
    cacheId,
    mimeType: compacted.mimeType,
    blob,
    source: uid ? 'cloud' : 'local',
    durationSeconds: compacted.durationSeconds,
    lastPositionSeconds: 0,
    playbackRate: 1,
    title: meta?.title,
    entityId: meta?.entityId,
    entityType: meta?.entityType,
  };
}

/**
 * Updates resume playback position & speed locally and in Firestore cleanly.
 */
export async function updateAudioPlaybackProgress(
  uid: string | null | undefined,
  cacheId: string,
  lastPositionSeconds: number,
  playbackRate: number,
  durationSeconds?: number
): Promise<void> {
  const safePos = Math.max(0, Math.round(lastPositionSeconds * 10) / 10);
  const safeRate = Math.max(0.5, Math.min(3.0, Number(playbackRate) || 1));

  try {
    const existing = await getLocalClip(cacheId);
    if (existing) {
      await putLocalClip({
        ...existing,
        lastPositionSeconds: safePos,
        playbackRate: safeRate,
        ...(typeof durationSeconds === 'number' && durationSeconds > 0
          ? { durationSeconds: Math.round(durationSeconds * 10) / 10 }
          : {}),
        updatedAtMs: Date.now(),
      });
    }
  } catch {
    // ignore local write errors
  }

  if (!uid || !cacheId) return;
  try {
    await updateDoc(doc(db, 'users', uid, 'audioCache', cacheId), {
      lastPositionSeconds: safePos,
      playbackRate: safeRate,
      ...(typeof durationSeconds === 'number' && durationSeconds > 0
        ? { durationSeconds: Math.round(durationSeconds * 10) / 10 }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if doc doesn't exist in cloud yet or offline
  }
}
