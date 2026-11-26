import { flushQuickDropQueue } from '../services/quickDropSync';
import { executeQueuedSupabaseMutation } from '../services/supabaseSync';
import {
  refreshPendingAudioCount,
  syncPendingAudioClipsToCloud,
} from './audioCache';
import {
  refreshPendingImagesCount,
  syncPendingImagesToCloud,
  syncPendingJournalCoversToCloud,
} from './imageStorage';
import {
  getOfflineOutbox,
  getOfflineSyncState,
  isAppOnline,
  isNetworkOrOfflineError,
  removeOfflineMutation,
  updateOfflineSyncState,
} from './offlineQueue';

let activeSyncPromise: Promise<{
  syncedCount: number;
  remainingCount: number;
}> | null = null;

export async function refreshAllOfflinePendingCounts(): Promise<void> {
  await Promise.allSettled([
    refreshPendingImagesCount(),
    refreshPendingAudioCount(),
  ]);
}

export async function flushSupabaseOutbox(
  uid: string,
  onError?: (message: string) => void
): Promise<number> {
  if (!uid || !isAppOnline()) return 0;
  const queue = getOfflineOutbox(uid);
  if (queue.length === 0) return 0;

  let flushed = 0;
  for (const mut of queue) {
    try {
      await executeQueuedSupabaseMutation(mut);
      removeOfflineMutation(uid, mut.id);
      flushed += 1;
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'تعذرت مزامنة بعض التعديلات مع قاعدة البيانات.';
      onError?.(msg);
      if (isNetworkOrOfflineError(err)) {
        break;
      }
      console.warn('Offline mutation flush failed:', mut.table, err);
    }
  }
  return flushed;
}

export async function syncAllPendingOfflineChanges(
  uidOverride?: string | null
): Promise<{ syncedCount: number; remainingCount: number }> {
  const uid = uidOverride || getOfflineSyncState().activeUid;
  if (!uid) {
    return { syncedCount: 0, remainingCount: 0 };
  }
  if (!isAppOnline()) {
    updateOfflineSyncState({
      isOnline: false,
      lastSyncError: 'لا يوجد اتصال بالإنترنت حاليًا. سيتم الاحتفاظ بالتعديلات حتى يعود الاتصال.',
    });
    return {
      syncedCount: 0,
      remainingCount: getOfflineSyncState().totalPendingCount,
    };
  }
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    updateOfflineSyncState({
      isSyncing: true,
      lastSyncError: null,
      lastSyncMessage: 'جاري مزامنة التعديلات والملفات مع قاعدة البيانات...',
    });

    let syncedCount = 0;
    let firstSyncError: string | null = null;
    const recordError = (msg: unknown) => {
      if (firstSyncError) return;
      if (typeof msg === 'string' && msg.trim()) {
        firstSyncError = msg.trim();
      } else if (msg instanceof Error && msg.message) {
        firstSyncError = msg.message;
      }
    };

    try {
      const [outboxSynced, qdSynced, imgSynced, coverSynced, audioSynced] =
        await Promise.all([
          flushSupabaseOutbox(uid, recordError),
          flushQuickDropQueue(uid).catch((err) => {
            recordError(err);
            return 0;
          }),
          syncPendingImagesToCloud(uid, recordError).catch((err) => {
            recordError(err);
            return 0;
          }),
          syncPendingJournalCoversToCloud(uid, recordError).catch((err) => {
            recordError(err);
            return 0;
          }),
          syncPendingAudioClipsToCloud(uid).catch((err) => {
            recordError(err);
            return 0;
          }),
        ]);

      syncedCount =
        outboxSynced + qdSynced + imgSynced + coverSynced + audioSynced;

      await refreshAllOfflinePendingCounts();
      const remaining = getOfflineSyncState().totalPendingCount;

      updateOfflineSyncState({
        isSyncing: false,
        lastSyncedAtMs: Date.now(),
        lastSyncError:
          remaining > 0
            ? firstSyncError ||
              'تعذرت مزامنة العناصر المعلقة حاليًا. تحقق من الاتصال أو إعدادات التخزين السحابي.'
            : null,
        lastSyncMessage:
          remaining === 0
            ? syncedCount > 0
              ? `تمت مزامنة ${syncedCount} عناصر مع قاعدة البيانات بنجاح.`
              : 'كل بياناتك متزامنة مع قاعدة البيانات.'
            : `تمت مزامنة ${syncedCount} عناصر وبقي ${remaining} بانتظار المزامنة.`,
      });

      return { syncedCount, remainingCount: remaining };
    } catch (err) {
      updateOfflineSyncState({
        isSyncing: false,
        lastSyncError:
          err instanceof Error
            ? err.message
            : 'تعذرت المزامنة الكاملة؛ يمكنك المحاولة مرة أخرى.',
      });
      return {
        syncedCount,
        remainingCount: getOfflineSyncState().totalPendingCount,
      };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

let autoListenerBound = false;
export function initOfflineAutoSyncListener(
  onSyncCompleted?: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleOnline = () => {
    const state = getOfflineSyncState();
    if (state.activeUid && state.totalPendingCount > 0) {
      void syncAllPendingOfflineChanges(state.activeUid).then((res) => {
        if (res.syncedCount > 0) {
          onSyncCompleted?.();
        }
      });
    }
  };
  const handleMediaChange = () => {
    void refreshAllOfflinePendingCounts();
  };

  if (!autoListenerBound) {
    autoListenerBound = true;
    void refreshAllOfflinePendingCounts();
  }
  window.addEventListener('online', handleOnline);
  window.addEventListener('mizan-offline-media-changed', handleMediaChange);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('mizan-offline-media-changed', handleMediaChange);
  };
}
