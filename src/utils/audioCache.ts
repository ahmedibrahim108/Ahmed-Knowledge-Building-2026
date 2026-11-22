import { ReadAloudVoiceName } from '../data/curriculumData';
import {
  ensureSupabaseRealtimeAuth,
  isJwtExpiredOrAuthError,
  isSupabaseConfigured,
  supabase,
  withFirebaseTokenRetry,
} from '../services/supabaseClient';

const DB_NAME = 'mizan_tts_audio_cache_v2';
const STORE_NAME = 'audio_clips';
const META_STORE_NAME = 'entity_index';
const DB_VERSION = 2;
const AUDIO_BUCKET = 'audio-cache';

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
  isStaleContent?: boolean;
  cloudSaved?: boolean;
  cloudErrorCode?: 'PERMISSION' | 'NETWORK' | 'NO_AUTH';
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

async function getLocalEntityIndex(
  entityKey: string
): Promise<EntityIndexRecord | null> {
  try {
    const database = await openAudioDb();
    return await new Promise((resolve) => {
      const tx = database.transaction(META_STORE_NAME, 'readonly');
      const req = tx.objectStore(META_STORE_NAME).get(entityKey);
      req.onsuccess = () =>
        resolve((req.result as EntityIndexRecord | undefined) ?? null);
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
      const stores = record.entityId
        ? [STORE_NAME, META_STORE_NAME]
        : [STORE_NAME];
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

function parseWavInfo(bytes: Uint8Array): {
  isPcm16MonoWav: boolean;
  sampleRate: number;
  dataOffset: number;
  dataSize: number;
  durationSeconds: number;
} {
  if (bytes.length < 44) {
    return {
      isPcm16MonoWav: false,
      sampleRate: 24000,
      dataOffset: 44,
      dataSize: 0,
      durationSeconds: 0,
    };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return {
      isPcm16MonoWav: false,
      sampleRate: 24000,
      dataOffset: 44,
      dataSize: 0,
      durationSeconds: 0,
    };
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
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
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

function downsamplePcm16MonoWav(
  bytes: Uint8Array,
  info: { dataOffset: number; dataSize: number; sampleRate: number },
  targetRate: number
): { base64: string; mimeType: string; durationSeconds: number } {
  const srcSamples = Math.floor(info.dataSize / 2);
  const ratio = info.sampleRate / targetRate;
  const dstSamples = Math.floor(srcSamples / ratio);
  const outBuffer = new ArrayBuffer(44 + dstSamples * 2);
  const srcView = new DataView(
    bytes.buffer,
    bytes.byteOffset + info.dataOffset,
    srcSamples * 2
  );
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
}

/**
 * Downsamples 24kHz PCM WAV -> 16kHz for compact fast storage & streaming across mobile/desktop.
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
    return downsamplePcm16MonoWav(bytes, info, 16000);
  } catch {
    return { base64: audioBase64, mimeType, durationSeconds: 0 };
  }
}

async function resolveSupabaseAudioBlob(row: {
  storage_bucket?: string;
  storage_path?: string;
  download_url?: string;
  mime_type?: string;
}): Promise<Blob | null> {
  if (
    isSupabaseConfigured &&
    supabase &&
    row.storage_path &&
    !row.storage_path.startsWith('users/')
  ) {
    try {
      const bucket = row.storage_bucket || AUDIO_BUCKET;
      const blob = await withFirebaseTokenRetry(async (client) => {
        const { data, error } = await client.storage
          .from(bucket)
          .download(row.storage_path!);
        if (error || !data) throw error || new Error('Empty audio blob');
        return data;
      });
      if (blob) return blob;
    } catch (err) {
      console.warn('Supabase Storage audio download failed:', err);
    }
  }

  if (row.download_url) {
    try {
      const res = await fetch(row.download_url);
      if (res.ok) return await res.blob();
    } catch {
      // ignore fallback fetch error
    }
  }

  return null;
}

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
  const currentHash = computeTextContentHash(clean);

  // 1) Fast local IndexedDB lookup by exact hash ID
  const localExact = await getLocalClip(cacheId);
  if (localExact) {
    return {
      cacheId,
      mimeType: localExact.mimeType,
      blob: localExact.blob,
      source: 'local',
      durationSeconds: localExact.durationSeconds,
      lastPositionSeconds: localExact.lastPositionSeconds ?? 0,
      playbackRate: localExact.playbackRate ?? 1,
      title: localExact.title || meta?.title,
      entityId: localExact.entityId || meta?.entityId,
      entityType: localExact.entityType || meta?.entityType,
      isStaleContent: false,
      cloudSaved: true,
    };
  }

  // 2) Fallback local lookup by entityId
  if (meta?.entityId) {
    const entityKey = `${meta.entityType || 'other'}:${meta.entityId}`;
    const idxRec = await getLocalEntityIndex(entityKey);
    if (idxRec) {
      const localByEntity = await getLocalClip(idxRec.cacheId);
      if (localByEntity) {
        return {
          cacheId: localByEntity.id,
          mimeType: localByEntity.mimeType,
          blob: localByEntity.blob,
          source: 'local',
          durationSeconds: localByEntity.durationSeconds,
          lastPositionSeconds: localByEntity.lastPositionSeconds ?? 0,
          playbackRate: localByEntity.playbackRate ?? 1,
          title: localByEntity.title || meta.title,
          entityId: meta.entityId,
          entityType: meta.entityType,
          isStaleContent: idxRec.contentHash !== currentHash,
          cloudSaved: true,
        };
      }
    }
  }

  // 3) Cross-device Supabase PostgreSQL + Supabase Storage lookup
  if (!uid || !isSupabaseConfigured || !supabase) return null;

  try {
    const row = await withFirebaseTokenRetry(async (client) => {
      const { data: exactRow } = await client
        .from('audio_cache')
        .select('*')
        .eq('owner_id', uid)
        .eq('id', cacheId)
        .maybeSingle();

      if (exactRow) return exactRow as Record<string, unknown>;

      if (meta?.entityId) {
        const { data: byEntityRows } = await client
          .from('audio_cache')
          .select('*')
          .eq('owner_id', uid)
          .eq('entity_id', meta.entityId)
          .order('created_at_ms', { ascending: false })
          .limit(1);

        if (byEntityRows && byEntityRows.length > 0) {
          return byEntityRows[0] as Record<string, unknown>;
        }
      }
      return null;
    });

    if (!row) return null;

    const blob = await resolveSupabaseAudioBlob({
      storage_bucket: row.storage_bucket ? String(row.storage_bucket) : undefined,
      storage_path: row.storage_path ? String(row.storage_path) : undefined,
      download_url: row.download_url ? String(row.download_url) : undefined,
      mime_type: row.mime_type ? String(row.mime_type) : undefined,
    });
    if (!blob) return null;

    const resolvedId = String(row.id || cacheId);
    const resolvedMime = String(row.mime_type || blob.type || 'audio/wav');
    const resolvedDuration =
      typeof row.duration_seconds === 'number' ? row.duration_seconds : undefined;
    const resolvedLastPos =
      typeof row.last_position_seconds === 'number'
        ? row.last_position_seconds
        : 0;
    const resolvedRate =
      typeof row.playback_rate === 'number' ? row.playback_rate : 1;

    await putLocalClip({
      id: resolvedId,
      mimeType: resolvedMime,
      blob,
      updatedAtMs: Date.now(),
      durationSeconds: resolvedDuration,
      lastPositionSeconds: resolvedLastPos,
      playbackRate: resolvedRate,
      entityId: row.entity_id ? String(row.entity_id) : meta?.entityId,
      entityType:
        (row.entity_type as AudioEntityType | undefined) || meta?.entityType,
      title: row.title ? String(row.title) : meta?.title,
      contentHash: row.content_hash ? String(row.content_hash) : currentHash,
    });

    return {
      cacheId: resolvedId,
      mimeType: resolvedMime,
      blob,
      source: 'cloud',
      durationSeconds: resolvedDuration,
      lastPositionSeconds: resolvedLastPos,
      playbackRate: resolvedRate,
      title: row.title ? String(row.title) : meta?.title,
      entityId: row.entity_id ? String(row.entity_id) : meta?.entityId,
      entityType:
        (row.entity_type as AudioEntityType | undefined) || meta?.entityType,
      isStaleContent: Boolean(row.content_hash && row.content_hash !== currentHash),
      cloudSaved: true,
    };
  } catch (err) {
    console.warn('Supabase audio cache load failed:', err);
    return null;
  }
}

export async function loadAudioClipById(
  uid: string | null | undefined,
  cacheId: string
): Promise<CachedAudioEntry | null> {
  if (!cacheId) return null;

  const local = await getLocalClip(cacheId);
  if (local) {
    return {
      cacheId,
      mimeType: local.mimeType,
      blob: local.blob,
      source: 'local',
      durationSeconds: local.durationSeconds,
      lastPositionSeconds: local.lastPositionSeconds ?? 0,
      playbackRate: local.playbackRate ?? 1,
      title: local.title,
      entityId: local.entityId,
      entityType: local.entityType,
      cloudSaved: true,
    };
  }

  if (!uid || !isSupabaseConfigured || !supabase) return null;

  try {
    const row = await withFirebaseTokenRetry(async (client) => {
      const { data } = await client
        .from('audio_cache')
        .select('*')
        .eq('owner_id', uid)
        .eq('id', cacheId)
        .maybeSingle();
      return (data as Record<string, unknown> | null) ?? null;
    });
    if (!row) return null;

    const blob = await resolveSupabaseAudioBlob({
      storage_bucket: row.storage_bucket ? String(row.storage_bucket) : undefined,
      storage_path: row.storage_path ? String(row.storage_path) : undefined,
      download_url: row.download_url ? String(row.download_url) : undefined,
      mime_type: row.mime_type ? String(row.mime_type) : undefined,
    });
    if (!blob) return null;

    const mime = String(row.mime_type || blob.type || 'audio/wav');
    await putLocalClip({
      id: cacheId,
      mimeType: mime,
      blob,
      updatedAtMs: Date.now(),
      durationSeconds:
        typeof row.duration_seconds === 'number'
          ? row.duration_seconds
          : undefined,
      lastPositionSeconds:
        typeof row.last_position_seconds === 'number'
          ? row.last_position_seconds
          : 0,
      playbackRate:
        typeof row.playback_rate === 'number' ? row.playback_rate : 1,
      entityId: row.entity_id ? String(row.entity_id) : undefined,
      entityType: row.entity_type as AudioEntityType | undefined,
      title: row.title ? String(row.title) : undefined,
      contentHash: row.content_hash ? String(row.content_hash) : undefined,
    });

    return {
      cacheId,
      mimeType: mime,
      blob,
      source: 'cloud',
      durationSeconds:
        typeof row.duration_seconds === 'number'
          ? row.duration_seconds
          : undefined,
      lastPositionSeconds:
        typeof row.last_position_seconds === 'number'
          ? row.last_position_seconds
          : 0,
      playbackRate:
        typeof row.playback_rate === 'number' ? row.playback_rate : 1,
      title: row.title ? String(row.title) : undefined,
      entityId: row.entity_id ? String(row.entity_id) : undefined,
      entityType: row.entity_type as AudioEntityType | undefined,
      cloudSaved: true,
    };
  } catch {
    return null;
  }
}

export async function listUserAudioClips(
  uid: string | null | undefined
): Promise<SavedAudioClipSummary[]> {
  if (!uid || !isSupabaseConfigured || !supabase) return [];
  try {
    const rows = await withFirebaseTokenRetry(async (client) => {
      const { data, error } = await client
        .from('audio_cache')
        .select('*')
        .eq('owner_id', uid)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Record<string, unknown>[];
    });

    return rows.map((raw) => {
      const updatedStr =
        typeof raw.updated_at === 'string' ? raw.updated_at : '';
      const updatedMs = updatedStr ? Date.parse(updatedStr) : Number(raw.created_at_ms ?? 0);
      return {
        id: String(raw.id),
        title: String(raw.title || 'مقطع صوتي محفوظ'),
        previewText: '',
        entityType: (raw.entity_type as AudioEntityType) || 'other',
        entityId: String(raw.entity_id || ''),
        voiceName: (raw.voice_name as ReadAloudVoiceName) || 'Kore',
        speed: raw.speed === 'calm' ? 'calm' : 'normal',
        mimeType: String(raw.mime_type || 'audio/wav'),
        sizeBytes: Number(raw.size_bytes ?? 0),
        durationSeconds: Number(raw.duration_seconds ?? 0),
        lastPositionSeconds: Number(raw.last_position_seconds ?? 0),
        playbackRate: Number(raw.playback_rate ?? 1),
        updatedAtMs: Number.isFinite(updatedMs) ? updatedMs : 0,
      };
    });
  } catch (err) {
    console.warn('Could not list Supabase audio clips:', err);
    return [];
  }
}

export function subscribeUserAudioClips(
  uid: string | null | undefined,
  onData: (clips: SavedAudioClipSummary[]) => void
): () => void {
  if (!uid || !isSupabaseConfigured || !supabase) {
    onData([]);
    return () => {};
  }

  let disposed = false;
  let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let reconnectTimer: number | null = null;
  let realtimeSubscribed = false;

  const refresh = async () => {
    if (disposed) return;
    const clips = await listUserAudioClips(uid);
    if (!disposed) onData(clips);
  };

  void refresh();

  const setupRealtimeChannel = async (forceRefreshToken = false) => {
    if (disposed || !supabase) return;
    await ensureSupabaseRealtimeAuth(forceRefreshToken);
    if (disposed || !supabase) return;

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const ch = supabase
      .channel(`audio_cache_${uid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audio_cache',
          filter: `owner_id=eq.${uid}`,
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
    window.addEventListener('pageshow', onResumeSync);
    window.addEventListener('online', onResumeSync);
  }

  const safetyInterval =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (
            disposed ||
            (typeof document !== 'undefined' &&
              document.visibilityState !== 'visible') ||
            (typeof navigator !== 'undefined' && navigator.onLine === false)
          ) {
            return;
          }
          void refresh();
        }, 15000)
      : null;

  return () => {
    disposed = true;
    if (reconnectTimer && typeof window !== 'undefined') {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (safetyInterval && typeof window !== 'undefined') {
      window.clearInterval(safetyInterval);
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

/**
 * Persists synthesized audio locally (IndexedDB) and in Supabase Storage + PostgreSQL
 * so future plays & mobile/desktop devices stream seamlessly without regenerating TTS.
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

  let cloudSaved = false;
  let cloudErrorCode: CachedAudioEntry['cloudErrorCode'] = uid
    ? undefined
    : 'NO_AUTH';

  if (uid && isSupabaseConfigured && supabase) {
    const ext = compacted.mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const storagePath = `${uid}/audio/${cacheId}.${ext}`;
    const safeSizeBytes = Math.max(0, Math.round(blob.size));

    try {
      await withFirebaseTokenRetry(async (client) => {
        const { error: uploadErr } = await client.storage
          .from(AUDIO_BUCKET)
          .upload(storagePath, blob, {
            contentType: compacted.mimeType,
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        let signedUrl = '';
        try {
          const { data: signed } = await client.storage
            .from(AUDIO_BUCKET)
            .createSignedUrl(storagePath, 3600);
          if (signed?.signedUrl) signedUrl = signed.signedUrl;
        } catch {
          // Optional
        }

        const { error: rowErr } = await client.from('audio_cache').upsert(
          {
            owner_id: uid,
            id: cacheId,
            entity_type: meta?.entityType || 'other',
            entity_id: (meta?.entityId || '').slice(0, 128),
            title: (meta?.title || clean.slice(0, 80)).slice(0, 200),
            content_hash: contentHash,
            voice_name: voiceName,
            speed,
            mime_type: compacted.mimeType.slice(0, 80),
            size_bytes: safeSizeBytes,
            duration_seconds: compacted.durationSeconds,
            last_position_seconds: 0,
            playback_rate: 1,
            storage_bucket: AUDIO_BUCKET,
            storage_path: storagePath,
            download_url: signedUrl,
            created_at_ms: Date.now(),
          },
          { onConflict: 'owner_id,id' }
        );
        if (rowErr) throw rowErr;
      });
      cloudSaved = true;
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message).toLowerCase()
          : '';
      const isPerm =
        isJwtExpiredOrAuthError(err) ||
        msg.includes('row-level security') ||
        msg.includes('permission denied');
      cloudErrorCode = isPerm ? 'PERMISSION' : 'NETWORK';
      console.warn('Supabase audioCache write failed:', err);
    }
  } else if (uid && !isSupabaseConfigured) {
    cloudErrorCode = 'NETWORK';
  }

  return {
    cacheId,
    mimeType: compacted.mimeType,
    blob,
    source: cloudSaved ? 'cloud' : 'local',
    durationSeconds: compacted.durationSeconds,
    lastPositionSeconds: 0,
    playbackRate: 1,
    title: meta?.title,
    entityId: meta?.entityId,
    entityType: meta?.entityType,
    isStaleContent: false,
    cloudSaved,
    cloudErrorCode,
  };
}

/**
 * Updates resume playback position & speed locally and in Supabase cleanly.
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

  if (!uid || !cacheId || !isSupabaseConfigured || !supabase) return;
  try {
    await withFirebaseTokenRetry(async (client) => {
      const updatePayload: Record<string, unknown> = {
        last_position_seconds: safePos,
        playback_rate: safeRate,
      };
      if (typeof durationSeconds === 'number' && durationSeconds > 0) {
        updatePayload.duration_seconds = Math.round(durationSeconds * 10) / 10;
      }
      await client
        .from('audio_cache')
        .update(updatePayload)
        .eq('owner_id', uid)
        .eq('id', cacheId);
    });
  } catch {
    // Non-fatal if doc doesn't exist in cloud yet or offline
  }
}

function normalizeAudioMimeType(rawMime: string): string {
  const base = (rawMime || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (base === 'audio/m4a' || base === 'audio/x-m4a') return 'audio/mp4';
  if (base === 'audio/mp3') return 'audio/mpeg';
  if (
    base === 'audio/wav' ||
    base === 'audio/x-wav' ||
    base === 'audio/mpeg' ||
    base === 'audio/mp4' ||
    base === 'audio/aac' ||
    base === 'audio/webm' ||
    base === 'audio/ogg' ||
    base === 'audio/3gpp'
  ) {
    return base;
  }
  if (base.includes('mp4') || base.includes('m4a')) return 'audio/mp4';
  if (base.includes('mpeg') || base.includes('mp3')) return 'audio/mpeg';
  if (base.includes('ogg')) return 'audio/ogg';
  if (base.includes('wav')) return 'audio/wav';
  if (base.includes('aac')) return 'audio/aac';
  return 'audio/webm';
}

function getAudioExtensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a')) return 'mp4';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('aac')) return 'aac';
  return 'webm';
}

/**
 * Stores a user-recorded microphone voice note directly in Supabase Storage (`audio-cache`)
 * and saves its metadata & storage path in `public.audio_cache` (no database blobs).
 */
export async function saveVoiceRecordingToCache(
  uid: string | null | undefined,
  blob: Blob,
  mimeType: string,
  durationSeconds: number,
  title: string,
  meta?: AudioEntityMeta
): Promise<{
  cacheId: string;
  storagePath: string;
  cloudSaved: boolean;
  errorMessage?: string;
}> {
  const cleanMime = normalizeAudioMimeType(blob.type || mimeType || 'audio/webm');
  const ext = getAudioExtensionFromMime(cleanMime);
  const cacheId = `rec_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const cleanTitle = (title || 'تسجيل صوتي').trim().slice(0, 200);
  const safeDuration = Math.max(0, Math.round(durationSeconds * 10) / 10);

  await putLocalClip({
    id: cacheId,
    mimeType: cleanMime,
    blob,
    updatedAtMs: Date.now(),
    durationSeconds: safeDuration,
    lastPositionSeconds: 0,
    playbackRate: 1,
    entityId: meta?.entityId,
    entityType: meta?.entityType || 'other',
    title: cleanTitle,
    contentHash: cacheId,
  });

  if (!uid || !isSupabaseConfigured || !supabase) {
    return {
      cacheId,
      storagePath: '',
      cloudSaved: false,
      errorMessage: !uid
        ? 'يجب تسجيل الدخول لحفظ التسجيل في السحابة.'
        : 'إعدادات Supabase غير مكتملة.',
    };
  }

  const storagePath = `${uid}/audio/${cacheId}.${ext}`;
  try {
    await withFirebaseTokenRetry(async (client) => {
      const { error: uploadErr } = await client.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, blob, {
          contentType: cleanMime,
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      let signedUrl = '';
      try {
        const { data: signed } = await client.storage
          .from(AUDIO_BUCKET)
          .createSignedUrl(storagePath, 3600);
        if (signed?.signedUrl) signedUrl = signed.signedUrl;
      } catch {
        // Signed URL optional; authenticated download() works cross-device
      }

      const { error: rowErr } = await client.from('audio_cache').upsert(
        {
          owner_id: uid,
          id: cacheId,
          entity_type: meta?.entityType || 'other',
          entity_id: (meta?.entityId || '').slice(0, 128),
          title: cleanTitle,
          content_hash: cacheId,
          voice_name: 'Kore',
          speed: 'normal',
          mime_type: cleanMime.slice(0, 80),
          size_bytes: Math.max(0, Math.round(blob.size)),
          duration_seconds: safeDuration,
          last_position_seconds: 0,
          playback_rate: 1,
          storage_bucket: AUDIO_BUCKET,
          storage_path: storagePath,
          download_url: signedUrl,
          created_at_ms: Date.now(),
        },
        { onConflict: 'owner_id,id' }
      );
      if (rowErr) throw rowErr;
    });

    return { cacheId, storagePath, cloudSaved: true };
  } catch (err) {
    console.warn('Supabase voice recording upload failed:', err);
    return {
      cacheId,
      storagePath: '',
      cloudSaved: false,
      errorMessage:
        err instanceof Error ? err.message : 'تعذر حفظ التسجيل الصوتي في السحابة.',
    };
  }
}

/**
 * Deletes an audio file from IndexedDB, Supabase `audio_cache` table, and `audio-cache` bucket.
 */
export async function deleteAudioClipFromCache(
  uid: string | null | undefined,
  cacheId: string
): Promise<boolean> {
  if (!cacheId) return false;

  try {
    const database = await openAudioDb();
    await new Promise<void>((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(cacheId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-fatal
  }

  if (!uid || !isSupabaseConfigured || !supabase) {
    return true;
  }

  try {
    await withFirebaseTokenRetry(async (client) => {
      const { data: metaRow } = await client
        .from('audio_cache')
        .select('storage_bucket,storage_path')
        .eq('owner_id', uid)
        .eq('id', cacheId)
        .maybeSingle();

      const row = metaRow as
        | { storage_bucket?: string; storage_path?: string }
        | null;

      const { error: delRowErr } = await client
        .from('audio_cache')
        .delete()
        .eq('owner_id', uid)
        .eq('id', cacheId);
      if (delRowErr) throw delRowErr;

      if (row?.storage_path && !row.storage_path.startsWith('users/')) {
        const bucket = row.storage_bucket || AUDIO_BUCKET;
        await client.storage.from(bucket).remove([row.storage_path]);
      }
    });
    return true;
  } catch (err) {
    console.warn('Supabase audio clip delete failed:', err);
    return false;
  }
}

