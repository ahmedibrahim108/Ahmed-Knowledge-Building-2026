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
  Eye,
  FileText,
  Image as ImageIcon,
  Inbox,
  Link2,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import {
  QuickDropSyncState,
  archiveMyExpiredQuickDropItems,
  createQuickDropItem,
  deleteQuickDropItemPermanently,
  emptyQuickDropTrash,
  generateQuickDropId,
  moveQuickDropItemToTrash,
  removeQuickDropAttachmentStorage,
  resolveQuickDropAttachmentUrl,
  restoreQuickDropItem,
  subscribeQuickDropInbox,
  updateQuickDropItem,
  uploadQuickDropAttachmentFile,
} from '../services/quickDropSync';
import {
  QuickDropAttachment,
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
import PDFViewerModal, { ActivePdfTarget } from './PDFViewerModal';

interface QuickDropSectionProps {
  uid?: string | null;
  canEdit: boolean;
  onRequireAuth: () => void;
  onOpenPdf?: (target: ActivePdfTarget) => void;
}

export default function QuickDropSection({
  uid,
  canEdit,
  onRequireAuth,
  onOpenPdf,
}: QuickDropSectionProps) {
  const [items, setItems] = useState<QuickDropItem[]>([]);
  const [viewTab, setViewTab] = useState<'active' | 'trash'>('active');
  const [syncState, setSyncState] = useState<QuickDropSyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Composer state
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [composerAttachments, setComposerAttachments] = useState<QuickDropAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
    isObjectUrl: boolean;
  } | null>(null);
  const [localPdfTarget, setLocalPdfTarget] = useState<ActivePdfTarget | null>(null);
  const [replacingTarget, setReplacingTarget] = useState<{
    itemId: string;
    attId: string;
  } | null>(null);

  const submitLockRef = useRef(false);
  const refreshFnRef = useRef<(() => Promise<void>) | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const composerFileRef = useRef<HTMLInputElement | null>(null);
  const replaceFileRef = useRef<HTMLInputElement | null>(null);

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

  const formatBytesShort = (bytes: number): string => {
    if (!bytes || bytes < 1024) return `${Math.max(1, bytes || 0)} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isQuickDropImageFile = (file: File) =>
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name);

  const handleComposerFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!uid || !canEdit) {
      onRequireAuth();
      return;
    }
    setUploadingFiles(true);
    setPasteError(null);
    try {
      const uploaded: QuickDropAttachment[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        const isImage = isQuickDropImageFile(file);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!isImage && !isPdf) continue;
        const att = await uploadQuickDropAttachmentFile(uid, file);
        uploaded.push(att);
      }
      if (uploaded.length === 0) {
        setPasteError('يرجى اختيار صور أو ملفات PDF فقط.');
      } else {
        setComposerAttachments((prev) => [...prev, ...uploaded].slice(0, 8));
      }
    } catch (err) {
      setPasteError(
        err instanceof Error && err.message
          ? err.message
          : 'تعذر إرفاق الملف مؤقتًا؛ حاول مرة أخرى.'
      );
    } finally {
      setUploadingFiles(false);
      if (composerFileRef.current) composerFileRef.current.value = '';
    }
  };

  const handleCreateItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!uid || !canEdit) {
      onRequireAuth();
      return;
    }
    const cleanContent = contentInput.trim();
    if ((!cleanContent && composerAttachments.length === 0) || submitLockRef.current) return;

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
        attachments: composerAttachments,
      });

      setItems((prev) => [
        res.item,
        ...prev.filter((existing) => existing.id !== res.item.id),
      ]);
      setTitleInput('');
      setContentInput('');
      setComposerAttachments([]);
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

  const handleOpenAttachment = async (att: QuickDropAttachment) => {
    if (att.kind === 'pdf' && att.storagePath) {
      const target: ActivePdfTarget = {
        title: att.name,
        fileName: att.name,
        storagePath: att.storagePath,
        storageProvider: att.storageProvider,
        downloadUrl: att.downloadUrl || att.dataUrl,
        mimeType: att.mimeType || 'application/pdf',
        contextLabel: 'مرفق النقل السريع',
        uid: uid || undefined,
      };
      if (onOpenPdf) {
        onOpenPdf(target);
      } else {
        setLocalPdfTarget(target);
      }
      return;
    }

    const resolved = await resolveQuickDropAttachmentUrl(att);
    if (!resolved) {
      showTransientNotice('تعذر فتح المرفق حاليًا.');
      return;
    }
    if (att.kind === 'image') {
      if (previewImage?.isObjectUrl) {
        URL.revokeObjectURL(previewImage.url);
      }
      setPreviewImage({
        url: resolved.url,
        name: att.name,
        isObjectUrl: resolved.isObjectUrl,
      });
      return;
    }

    const target: ActivePdfTarget = {
      title: att.name,
      fileName: att.name,
      storagePath: att.storagePath,
      storageProvider: att.storageProvider,
      downloadUrl: resolved.url,
      mimeType: att.mimeType || 'application/pdf',
      contextLabel: 'مرفق النقل السريع',
      uid: uid || undefined,
    };
    if (onOpenPdf) {
      onOpenPdf(target);
    } else {
      setLocalPdfTarget(target);
    }
  };

  const handleDeleteAttachment = async (
    item: QuickDropItem,
    att: QuickDropAttachment
  ) => {
    if (!uid || !canEdit) return onRequireAuth();
    const nextAttachments = (item.attachments || []).filter((a) => a.id !== att.id);
    const updatedItem: QuickDropItem = {
      ...item,
      attachments: nextAttachments,
    };
    setItems((prev) => prev.map((x) => (x.id === item.id ? updatedItem : x)));
    try {
      await updateQuickDropItem(uid, updatedItem);
      void removeQuickDropAttachmentStorage(att);
      showTransientNotice('تم حذف المرفق بنجاح.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'تعذر حذف المرفق.');
      void refreshFnRef.current?.();
    }
  };

  const handleReplaceAttachmentPicked = async (files: FileList | null) => {
    const target = replacingTarget;
    if (!target || !files || files.length === 0 || !uid || !canEdit) {
      setReplacingTarget(null);
      return;
    }
    const file = files[0];
    const isImage = isQuickDropImageFile(file);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      setReplacingTarget(null);
      showTransientNotice('يرجى اختيار صورة أو ملف PDF للاستبدال.');
      return;
    }
    const item = items.find((x) => x.id === target.itemId);
    const oldAtt = item?.attachments?.find((a) => a.id === target.attId);
    if (!item || !oldAtt) {
      setReplacingTarget(null);
      return;
    }

    setUploadingFiles(true);
    try {
      const nextAtt = await uploadQuickDropAttachmentFile(uid, file);
      const nextAttachments = (item.attachments || []).map((a) =>
        a.id === oldAtt.id ? nextAtt : a
      );
      const updatedItem: QuickDropItem = { ...item, attachments: nextAttachments };
      setItems((prev) => prev.map((x) => (x.id === item.id ? updatedItem : x)));
      await updateQuickDropItem(uid, updatedItem);
      void removeQuickDropAttachmentStorage(oldAtt);
      showTransientNotice('تم استبدال المرفق بنجاح.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'تعذر استبدال المرفق.');
    } finally {
      setUploadingFiles(false);
      setReplacingTarget(null);
      if (replaceFileRef.current) replaceFileRef.current.value = '';
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
    const targetAttachments =
      items.find((x) => x.id === itemId)?.attachments || [];
    setItems((prev) => prev.filter((x) => x.id !== itemId));
    setConfirmDeleteId(null);
    try {
      await deleteQuickDropItemPermanently(uid, itemId, targetAttachments);
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
    const trashAttachments = items
      .filter((x) => x.status === 'trashed')
      .flatMap((x) => x.attachments || []);
    setItems((prev) => prev.filter((x) => x.status !== 'trashed'));
    setConfirmEmptyTrash(false);
    try {
      await emptyQuickDropTrash(uid, trashAttachments);
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

      {/* Two-Column Layout: Composer (Col 1) + Active Items (Col 2) */}
      {viewTab === 'active' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Column 1: Add / Send New Item */}
          <form
            onSubmit={(e) => void handleCreateItem(e)}
            className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800">
                إرسال عنصر جديد
              </h3>
              <span className="text-[11px] text-slate-500">
                روابط، نصوص، صور أو PDF
              </span>
            </div>

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
              minRows={3}
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

            {/* Staged Attachments Preview */}
            {composerAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {composerAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs max-w-full"
                  >
                    {att.kind === 'image' && att.dataUrl ? (
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="w-7 h-7 rounded object-cover shrink-0 border border-slate-200"
                      />
                    ) : att.kind === 'image' ? (
                      <ImageIcon className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
                    ) : (
                      <FileText className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 truncate max-w-[140px]">
                        {att.name}
                      </p>
                      <p className="text-[10px] text-slate-500 tabular-nums">
                        {formatBytesShort(att.sizeBytes)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setComposerAttachments((prev) =>
                          prev.filter((a) => a.id !== att.id)
                        )
                      }
                      title="إزالة المرفق"
                      aria-label="إزالة المرفق"
                      className="p-1 text-slate-400 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={composerFileRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => void handleComposerFilesSelected(e.target.files)}
            />
            <input
              ref={replaceFileRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => void handleReplaceAttachmentPicked(e.target.files)}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 min-w-0">
                <button
                  type="button"
                  disabled={uploadingFiles}
                  onClick={() => {
                    if (!uid || !canEdit) return onRequireAuth();
                    composerFileRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {uploadingFiles ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{uploadingFiles ? 'جاري الرفع...' : 'إرفاق صورة / PDF'}</span>
                </button>

                {detectedComposerUrls.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[#1E3A5F] font-medium truncate max-w-full">
                    <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      تم التعرف على {detectedComposerUrls.length} رابط تلقائيًا
                    </span>
                  </span>
                ) : (
                  <span className="hidden sm:inline">Ctrl+Enter للإضافة الفورية</span>
                )}
              </div>

              <button
                type="submit"
                disabled={(!contentInput.trim() && composerAttachments.length === 0) || submitting || uploadingFiles}
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

          {/* Column 2: Active Items (capped height + thin scrollbar) */}
          <div className="min-w-0 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="text-xs font-bold text-slate-800">
                المهام والعناصر النشطة
              </h3>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {activeItems.length} عنصر
              </span>
            </div>

            {activeItems.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#F7F8FA] border border-dashed border-slate-200 text-center space-y-1.5">
                <p className="text-xs sm:text-sm font-semibold text-slate-700">
                  صندوق النقل السريع فارغ حاليًا
                </p>
                <p className="text-xs text-slate-500">
                  أضف رابطًا أو نصًا أو صورة أو ملف PDF ليظهر فورًا على بقية أجهزتك لمدة 24 ساعة.
                </p>
              </div>
            ) : (
              <div className="max-h-[430px] overflow-y-auto thin-scrollbar pr-0.5 space-y-3">
            {activeItems.map((item) => {
              const urls = extractSafeUrls(item.content);
              const primaryUrl = urls[0] || null;
              const previewHeading = buildQuickDropTitlePreview(
                item.title,
                item.content,
                item.attachments
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
                  {item.content.trim().length > 0 && (
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
                  )}

                  {/* Image & PDF Attachments Grid */}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.attachments.map((att) => {
                        const thumbUrl = att.dataUrl || att.downloadUrl;
                        return (
                          <div
                            key={att.id}
                            className="p-2.5 rounded-xl bg-[#F7F8FA] border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => void handleOpenAttachment(att)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 text-right cursor-pointer group"
                            >
                              {att.kind === 'image' && thumbUrl ? (
                                <img
                                  src={thumbUrl}
                                  alt={att.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : att.kind === 'image' ? (
                                <div className="w-10 h-10 rounded-lg bg-slate-200/70 flex items-center justify-center shrink-0">
                                  <ImageIcon className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-rose-700" aria-hidden="true" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-800 group-hover:text-[#1E3A5F] truncate">
                                  {att.name}
                                </p>
                                <p className="text-[11px] text-slate-500 tabular-nums">
                                  {att.kind === 'pdf' ? 'ملف PDF' : 'صورة'} ·{' '}
                                  {formatBytesShort(att.sizeBytes)}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleOpenAttachment(att)}
                                title="معاينة"
                                aria-label="معاينة المرفق"
                                className="p-1.5 text-slate-600 hover:text-[#1E3A5F] hover:bg-white rounded-md cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplacingTarget({ itemId: item.id, attId: att.id });
                                      replaceFileRef.current?.click();
                                    }}
                                    title="استبدال المرفق"
                                    aria-label="استبدال المرفق"
                                    className="p-1.5 text-slate-600 hover:text-[#1E3A5F] hover:bg-white rounded-md cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteAttachment(item, att)}
                                    title="حذف المرفق"
                                    aria-label="حذف المرفق"
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

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
            )}
          </div>
        </div>
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
            <div className="max-h-[380px] overflow-y-auto thin-scrollbar pr-0.5 space-y-2.5">
              {trashedItems.map((item) => {
                const previewHeading = buildQuickDropTitlePreview(
                  item.title,
                  item.content,
                  item.attachments
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
      {/* Inline Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (previewImage.isObjectUrl) URL.revokeObjectURL(previewImage.url);
            setPreviewImage(null);
          }}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {previewImage.name}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (previewImage.isObjectUrl) URL.revokeObjectURL(previewImage.url);
                  setPreviewImage(null);
                }}
                aria-label="إغلاق المعاينة"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-[#F7F8FA]">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[75dvh] max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Local PDF Fallback Viewer if parent did not supply onOpenPdf */}
      {localPdfTarget && (
        <PDFViewerModal
          uid={uid || undefined}
          target={localPdfTarget}
          onClose={() => setLocalPdfTarget(null)}
        />
      )}
    </section>
  );
}
