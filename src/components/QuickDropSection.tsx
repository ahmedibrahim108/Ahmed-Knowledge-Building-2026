import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Check,
  ClipboardPaste,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  ExternalLink,
  Inbox,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  QuickDropSyncState,
  archiveMyExpiredQuickDropItems,
  createQuickDropItem,
  deleteQuickDropItemPermanently,
  emptyQuickDropTrash,
  generateQuickDropId,
  moveQuickDropItemToTrash,
  restoreQuickDropItem,
  subscribeQuickDropInbox,
} from '../services/quickDropSync';
import {
  QuickDropItem,
  buildQuickDropTitlePreview,
  buildWhatsAppShareUrl,
  extractSafeUrls,
  formatQuickDropDateTime,
  getQuickDropCountdown,
  isQuickDropItemExpired,
  splitQuickDropTextSegments,
} from '../utils/quickDropUtils';
import AutoResizeTextarea from './AutoResizeTextarea';
import BidiText from './BidiText';

interface QuickDropSectionProps {
  uid?: string | null;
  canEdit: boolean;
  onRequireAuth: () => void;
}

export default function QuickDropSection({
  uid,
  canEdit,
  onRequireAuth,
}: QuickDropSectionProps) {
  const [items, setItems] = useState<QuickDropItem[]>([]);
  const [viewTab, setViewTab] = useState<'active' | 'trash'>('active');
  const [syncState, setSyncState] = useState<QuickDropSyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Composer state
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const submitLockRef = useRef(false);
  const refreshFnRef = useRef<(() => Promise<void>) | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showTransientNotice = (msg: string) => {
    setActionNotice(msg);
    if (noticeTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(noticeTimerRef.current);
    }
    if (typeof window !== 'undefined') {
      noticeTimerRef.current = window.setTimeout(() => {
        setActionNotice(null);
      }, 3200);
    }
  };

  // Live 30s ticker to keep 24-hour remaining indicators accurate & trigger auto-archiving
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  // Subscribe to per-user cloud Quick Drop inbox (Realtime + offline queue + cache)
  useEffect(() => {
    setItems([]);
    setConfirmDeleteId(null);
    setConfirmEmptyTrash(false);
    setSyncError(null);

    if (!uid) {
      setSyncState('idle');
      refreshFnRef.current = null;
      return;
    }

    setSyncState('loading');
    const sub = subscribeQuickDropInbox(uid, {
      onItems: (nextItems) => {
        setItems(nextItems);
      },
      onSyncState: (state, errMsg) => {
        setSyncState(state);
        if (errMsg !== undefined) {
          setSyncError(errMsg);
        }
      },
    });
    refreshFnRef.current = sub.refreshNow;

    return () => {
      sub.unsubscribe();
      refreshFnRef.current = null;
    };
  }, [uid]);

  // If an open item crosses expiresAt while dashboard stays open, archive it cleanly
  useEffect(() => {
    if (!uid || items.length === 0) return;
    const newlyExpired = items.filter((item) =>
      isQuickDropItemExpired(item, nowTick)
    );
    if (newlyExpired.length === 0) return;

    setItems((prev) =>
      prev.map((item) =>
        isQuickDropItemExpired(item, nowTick)
          ? {
              ...item,
              status: 'trashed',
              trashedAt: item.trashedAt || item.expiresAt,
            }
          : item
      )
    );
    void archiveMyExpiredQuickDropItems(uid);
  }, [uid, items, nowTick]);

  const activeItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'active' && !isQuickDropItemExpired(item, nowTick)
      ),
    [items, nowTick]
  );

  const trashedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'trashed' || isQuickDropItemExpired(item, nowTick)
      ),
    [items, nowTick]
  );

  const detectedComposerUrls = useMemo(
    () => extractSafeUrls(contentInput),
    [contentInput]
  );

  const supportsWebShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handlePasteFromClipboard = async () => {
    setPasteError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== 'function'
    ) {
      setPasteError('المتصفح لا يدعم القراءة المباشرة من الحافظة؛ يمكنك اللصق يدويًا (Ctrl+V).');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setPasteError('الحافظة فارغة حاليًا.');
        return;
      }
      setContentInput((prev) => (prev.trim() ? `${prev}\n${text}` : text));
    } catch {
      setPasteError('يرجى السماح بصلاحية الحافظة أو اللصق يدويًا داخل الحقل.');
    }
  };

  const handleCreateItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!uid || !canEdit) {
      onRequireAuth();
      return;
    }
    const cleanContent = contentInput.trim();
    if (!cleanContent || submitLockRef.current) return;

    submitLockRef.current = true;
    setSubmitting(true);
    setSyncError(null);
    setPasteError(null);

    const pendingId = generateQuickDropId();
    const cleanTitle = titleInput.trim();

    try {
      const res = await createQuickDropItem(uid, {
        id: pendingId,
        title: cleanTitle,
        content: cleanContent,
      });

      setItems((prev) => [
        res.item,
        ...prev.filter((existing) => existing.id !== res.item.id),
      ]);
      setTitleInput('');
      setContentInput('');
      setViewTab('active');
      showTransientNotice(
        res.offlineQueued
          ? 'تم الحفظ محليًا وسيتم التزامن فور عودة الاتصال.'
          : 'تم الحفظ والمزامنة بين أجهزتك لمدة 24 ساعة.'
      );
      if (res.synced) {
        setSyncState('synced');
      } else if (res.offlineQueued) {
        setSyncState(
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'offline'
            : 'synced'
        );
      }
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر حفظ العنصر.'
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCopyContent = async (item: QuickDropItem) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(item.content);
      } else {
        const helper = document.createElement('textarea');
        helper.value = item.content;
        helper.setAttribute('readonly', 'true');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
      setCopiedId(item.id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === item.id ? null : curr));
      }, 2000);
    } catch {
      showTransientNotice('تعذر النسخ التلقائي؛ يمكنك التحديد والنسخ يدويًا.');
    }
  };

  const handleNativeShare = async (item: QuickDropItem) => {
    if (!supportsWebShare) return;
    const primaryUrl = extractSafeUrls(item.content)[0];
    try {
      await navigator.share({
        title: buildQuickDropTitlePreview(item.title, item.content),
        text: item.content,
        ...(primaryUrl ? { url: primaryUrl } : {}),
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        showTransientNotice('تعذر فتح نافذة المشاركة على هذا المتصفح.');
      }
    }
  };

  const handleMoveToTrash = async (item: QuickDropItem) => {
    if (!uid || !canEdit) return onRequireAuth();
    const trashedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, status: 'trashed', trashedAt } : x
      )
    );
    try {
      await moveQuickDropItemToTrash(uid, item.id);
      showTransientNotice('تم نقل العنصر إلى سلة المهملات.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر نقل العنصر إلى السلة.'
      );
      void refreshFnRef.current?.();
    }
  };

  const handleRestore = async (item: QuickDropItem) => {
    if (!uid || !canEdit) return onRequireAuth();
    try {
      const res = await restoreQuickDropItem(uid, item.id);
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: 'active',
                trashedAt: null,
                expiresAt: res.expiresAt,
              }
            : x
        )
      );
      setConfirmDeleteId(null);
      showTransientNotice('تمت استعادة العنصر بصلاحية 24 ساعة جديدة.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر استعادة العنصر.'
      );
    }
  };

  const handlePermanentDelete = async (itemId: string) => {
    if (!uid || !canEdit) return onRequireAuth();
    setItems((prev) => prev.filter((x) => x.id !== itemId));
    setConfirmDeleteId(null);
    try {
      await deleteQuickDropItemPermanently(uid, itemId);
      showTransientNotice('تم حذف العنصر نهائيًا.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر حذف العنصر نهائيًا.'
      );
      void refreshFnRef.current?.();
    }
  };

  const handleEmptyTrash = async () => {
    if (!uid || !canEdit) return onRequireAuth();
    setItems((prev) => prev.filter((x) => x.status !== 'trashed'));
    setConfirmEmptyTrash(false);
    try {
      await emptyQuickDropTrash(uid);
      showTransientNotice('تم إفراغ سلة المهملات بالكامل.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر إفراغ السلة.'
      );
      void refreshFnRef.current?.();
    }
  };

  return (
    <section
      id="quick-drop-section"
      aria-labelledby="quick-drop-heading"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Inbox className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
            <h2
              id="quick-drop-heading"
              className="font-editorial text-xl sm:text-2xl font-bold text-slate-900"
            >
              النقل السريع المؤقت · Quick Drop
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            صندوق مؤقت لنقل الروابط والملاحظات بين جوالك وحاسوبك · يُؤرشف تلقائيًا بعد 24 ساعة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Real Sync Feedback Indicator */}
          {uid && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              {syncState === 'syncing' || syncState === 'loading' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A5F]" aria-hidden="true" />
                  <span>جاري المزامنة...</span>
                </>
              ) : syncState === 'offline' ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  <span>وضع غير متصل</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>متزامن سحابيًا</span>
                </>
              )}
            </span>
          )}

          {uid && (
            <button
              type="button"
              onClick={() => void refreshFnRef.current?.()}
              title="تحديث من السحابة"
              aria-label="تحديث النقل السريع من السحابة"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  syncState === 'syncing' ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">تحديث</span>
            </button>
          )}

          {/* Segmented Active / Trash Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => {
                setViewTab('active');
                setConfirmEmptyTrash(false);
                setConfirmDeleteId(null);
              }}
              className={`px-3 py-1.5 min-h-[32px] rounded-lg cursor-pointer transition-colors tabular-nums ${
                viewTab === 'active'
                  ? 'bg-white text-[#1E3A5F] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              النشطة ({activeItems.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTab('trash');
                setConfirmEmptyTrash(false);
                setConfirmDeleteId(null);
              }}
              className={`px-3 py-1.5 min-h-[32px] rounded-lg cursor-pointer transition-colors tabular-nums ${
                viewTab === 'trash'
                  ? 'bg-white text-[#1E3A5F] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سلة المهملات ({trashedItems.length})
            </button>
          </div>
        </div>
      </div>

      {/* Migration 016 Notice */}
      {syncState === 'needs_migration' && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          يرجى تشغيل ملف الترحيل{' '}
          <code className="font-mono font-bold">016_quick_drop_items.sql</code>{' '}
          في محرر SQL بلوحة Supabase لتفعيل المزامنة السحابية والأرشفة التلقائية بعد 24 ساعة. يعمل الحفظ المحلي مؤقتًا حتى إتمام التفعيل.
        </div>
      )}

      {/* Sync Error / Transient Feedback */}
      {syncError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800">
          <span>{syncError}</span>
          <button
            type="button"
            onClick={() => {
              setSyncError(null);
              void refreshFnRef.current?.();
            }}
            className="font-semibold underline cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2"
        >
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Compact Add New Item Form */}
      {viewTab === 'active' && (
        <form
          onSubmit={(e) => void handleCreateItem(e)}
          className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              maxLength={140}
              placeholder="عنوان قصير (اختياري)..."
              className="flex-1 min-w-0 px-3 py-2 min-h-[40px] text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
            <button
              type="button"
              onClick={() => void handlePasteFromClipboard()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer shrink-0 transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
              <span>لصق من الحافظة</span>
            </button>
          </div>

          <AutoResizeTextarea
            minRows={2}
            value={contentInput}
            onChange={(e) => {
              setContentInput(e.target.value);
              if (pasteError) setPasteError(null);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleCreateItem();
              }
            }}
            placeholder="الصق رابط اجتماع أو مقال، أو اكتب نصًا ومعلومة سريعة لنقلها بين أجهزتك..."
            className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl leading-relaxed focus:outline-none focus:border-[#1E3A5F]"
          />

          {pasteError && (
            <p className="text-[11px] text-amber-800">{pasteError}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 min-w-0">
              {detectedComposerUrls.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[#1E3A5F] font-medium truncate max-w-full">
                  <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    تم التعرف على {detectedComposerUrls.length} رابط تلقائيًا
                  </span>
                </span>
              ) : (
                <span>تلميح: اضغط Ctrl+Enter للإضافة الفورية</span>
              )}
            </div>

            <button
              type="submit"
              disabled={!contentInput.trim() || submitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{submitting ? 'جاري الإرسال...' : 'إضافة للنقل السريع'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Active Inbox Items */}
      {viewTab === 'active' && (
        activeItems.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#F7F8FA] border border-dashed border-slate-200 text-center space-y-1.5">
            <p className="text-xs sm:text-sm font-semibold text-slate-700">
              صندوق النقل السريع فارغ حاليًا
            </p>
            <p className="text-xs text-slate-500">
              أضف رابطًا أو نصًا من جوالك أو حاسوبك ليظهر فورًا على بقية أجهزتك لمدة 24 ساعة.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeItems.map((item) => {
              const urls = extractSafeUrls(item.content);
              const primaryUrl = urls[0] || null;
              const previewHeading = buildQuickDropTitlePreview(
                item.title,
                item.content
              );
              const countdown = getQuickDropCountdown(item.expiresAt, nowTick);
              const segments = splitQuickDropTextSegments(item.content);
              const whatsappUrl = buildWhatsAppShareUrl(item);
              const isCopied = copiedId === item.id;

              return (
                <article
                  key={item.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 space-y-3"
                >
                  {/* Card Meta Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        <BidiText text={previewHeading} />
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                        <span>
                          {item.itemType === 'url'
                            ? 'رابط'
                            : item.itemType === 'mixed'
                            ? 'نص ورابط'
                            : 'نص مؤقت'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatQuickDropDateTime(item.createdAt)}</span>
                        {item.pendingSync && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700 font-medium">
                              بانتظار المزامنة
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Subtle 24-Hour Expiration Countdown */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 tabular-nums">
                        <Clock className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                        <span>{countdown.label}</span>
                      </span>
                      <div className="w-24 h-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#1E3A5F] rounded-full transition-all"
                          style={{
                            width: `${Math.round(countdown.progressRatio * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Body with Safe Clickable URLs */}
                  <div className="p-3 rounded-lg bg-[#F7F8FA] text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                    {segments.map((seg, idx) =>
                      seg.type === 'url' && seg.href ? (
                        <a
                          key={idx}
                          href={seg.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="text-[#1E3A5F] underline font-medium hover:opacity-80 break-all inline-block"
                        >
                          {seg.value}
                        </a>
                      ) : (
                        <span key={idx}>{seg.value}</span>
                      )
                    )}
                  </div>

                  {/* Item Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopyContent(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-slate-800 bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                      >
                        {isCopied ? (
                          <Check
                            className="w-3.5 h-3.5 text-emerald-700"
                            aria-hidden="true"
                          />
                        ) : (
                          <Copy
                            className="w-3.5 h-3.5 text-[#1E3A5F]"
                            aria-hidden="true"
                          />
                        )}
                        <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                      </button>

                      {primaryUrl && (
                        <a
                          href={primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>فتح الرابط</span>
                        </a>
                      )}

                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="فتح واتساب لاختيار المستلم وتأكيد الإرسال"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>واتساب</span>
                      </a>

                      {supportsWebShare && (
                        <button
                          type="button"
                          onClick={() => void handleNativeShare(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>مشاركة</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleMoveToTrash(item)}
                      title="نقل إلى سلة المهملات"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>نقل للسلة</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {/* Trash / Archived View */}
      {viewTab === 'trash' && (
        <div className="space-y-3">
          {trashedItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#F7F8FA] border border-slate-200 text-xs">
              <span className="text-slate-600">
                تحتفظ السلة بالعناصر المؤرشفة تلقائيًا بعد 24 ساعة أو المحذوفة يدويًا حتى تقرر استعادتها أو حذفها نهائيًا.
              </span>
              {confirmEmptyTrash ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleEmptyTrash()}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
                  >
                    تأكيد إفراغ السلة
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyTrash(false)}
                    className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إفراغ السلة</span>
                </button>
              )}
            </div>
          )}

          {trashedItems.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#F7F8FA] border border-dashed border-slate-200 text-center space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                سلة المهملات فارغة
              </p>
              <p className="text-xs text-slate-500">
                ستظهر هنا العناصر المنتهية بعد 24 ساعة أو التي تم نقلها يدويًا لتتمكن من استعادتها عند الحاجة.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {trashedItems.map((item) => {
                const previewHeading = buildQuickDropTitlePreview(
                  item.title,
                  item.content
                );
                const autoArchived =
                  Date.parse(item.expiresAt) <=
                  (item.trashedAt ? Date.parse(item.trashedAt) : nowTick);
                const confirmingDelete = confirmDeleteId === item.id;

                return (
                  <article
                    key={item.id}
                    className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          <BidiText text={previewHeading} />
                        </h3>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          أُنشئ {formatQuickDropDateTime(item.createdAt)} ·{' '}
                          {autoArchived
                            ? 'أُرشف تلقائيًا بعد 24 ساعة'
                            : 'نُقل يدويًا للسلة'}
                          {item.trashedAt
                            ? ` · ${formatQuickDropDateTime(item.trashedAt)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                      <BidiText text={item.content} />
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleRestore(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer transition-colors"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>استعادة (24 ساعة)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleCopyContent(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{copiedId === item.id ? 'تم النسخ' : 'نسخ'}</span>
                        </button>
                      </div>

                      {confirmingDelete ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handlePermanentDelete(item.id)}
                            className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
                          >
                            تأكيد الحذف النهائي
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 min-h-[36px] text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حذف نهائي</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
