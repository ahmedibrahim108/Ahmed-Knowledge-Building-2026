import { useEffect, useState } from 'react';
import { Check, CloudUpload, RefreshCw, WifiOff } from 'lucide-react';
import {
  OfflineSyncState,
  getOfflineSyncState,
  subscribeOfflineSyncState,
} from '../utils/offlineQueue';
import { syncAllPendingOfflineChanges } from '../utils/offlineSync';

interface OfflineIndicatorProps {
  onSynced?: () => void;
}

export default function OfflineIndicator({ onSynced }: OfflineIndicatorProps) {
  const [syncState, setSyncState] = useState<OfflineSyncState>(() =>
    getOfflineSyncState()
  );
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    return subscribeOfflineSyncState(setSyncState);
  }, []);

  const handleManualSync = async () => {
    const res = await syncAllPendingOfflineChanges(syncState.activeUid);
    if (res.syncedCount > 0 || res.remainingCount === 0) {
      setJustSynced(true);
      onSynced?.();
      window.setTimeout(() => setJustSynced(false), 3500);
    }
  };

  if (syncState.isOnline && syncState.totalPendingCount === 0 && !syncState.isSyncing && !justSynced) {
    return null;
  }

  return (
    <div
      role="status"
      className={`fixed bottom-4 left-4 z-50 flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-lg border transition-colors ${
        !syncState.isOnline
          ? 'bg-amber-600 text-white border-amber-500'
          : syncState.totalPendingCount > 0 || syncState.isSyncing
          ? 'bg-[#1E3A5F] text-white border-[#162C49]'
          : 'bg-emerald-700 text-white border-emerald-600'
      }`}
    >
      {!syncState.isOnline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            وضع عدم الاتصال
            {syncState.totalPendingCount > 0
              ? ` · ${syncState.totalPendingCount} تعديلات محفوظة محليًا`
              : ' — يتم العمل على النسخة المحفوظة'}
          </span>
        </>
      ) : syncState.isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden="true" />
          <span>جاري المزامنة مع قاعدة البيانات...</span>
        </>
      ) : justSynced && syncState.totalPendingCount === 0 ? (
        <>
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>تمت مزامنة التعديلات مع قاعدة البيانات</span>
        </>
      ) : (
        <div className="flex flex-col gap-1 max-w-sm sm:max-w-md">
          <div className="flex flex-wrap items-center gap-2">
            <CloudUpload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{syncState.totalPendingCount} تعديلات بانتظار المزامنة</span>
            <button
              type="button"
              onClick={() => void handleManualSync()}
              className="mr-1 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer"
            >
              مزامنة مع قاعدة البيانات الآن
            </button>
          </div>
          {syncState.lastSyncError && (
            <p className="text-[11px] font-normal text-amber-200 leading-relaxed break-words">
              {syncState.lastSyncError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
