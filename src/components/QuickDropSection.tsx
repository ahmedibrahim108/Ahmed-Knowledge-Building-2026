import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File as FileIcon,
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
  archiveQuickDropItem,
  createQuickDropItem,
  deleteQuickDropItemPermanently,
  downloadQuickDropAttachment,
  emptyQuickDropTrash,
  generateQuickDropId,
  getQuickDropAttachmentBlob,
  isPending017Migration,
  moveQuickDropItemToTrash,
  restoreQuickDropItem,
  subscribeQuickDropInbox,
} from '../services/quickDropSync';
import { isViewableDocumentAttachment } from '../utils/documentImportExport';
import {
  QuickDropItem,
  buildQuickDropTitlePreview,
  buildWhatsAppShareUrl,
  extractSafeUrls,
  formatQuickDropDateTime,
  formatQuickDropFileSize,
  getQuickDropCountdown,
  hasQuickDropAttachment,
  isImageQuickDropAttachment,
  isPdfQuickDropAttachment,
  isQuickDropItemExpired,
  splitQuickDropTextSegments,
} from '../utils/quickDropUtils';
import AutoResizeTextarea from './AutoResizeTextarea';
import BidiText from './BidiText';
import type { ActivePdfTarget } from './PDFViewerModal';

interface QuickDropSectionProps {
  uid?: string | null;
  canEdit: boolean;
  onRequireAuth: () => void;
  onOpenPdf?: (target: ActivePdfTarget) => void;
}

const COMPACT_VISIBLE_COUNT = 3;

function QuickDropImageThumbnail({
  item,
  onPreview,
}: {
  item: QuickDropItem;
  onPreview: (url: string, title: string) => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!hasQuickDropAttachment(item)) return;

    setLoading(true);
    void getQuickDropAttachmentBlob(item)
      .then((res) => {
        if (!active || !res?.blob) return;
        objectUrl = URL.createObjectURL(res.blob);
        setThumbUrl(objectUrl);
      })
      .catch(() => {
        // Non-fatal; preview button remains available
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.id, item.attachmentPath, item.attachmentName]);

  if (thumbUrl) {
    return (
      <button
        type="button"
        onClick={() =>
          onPreview(
            thumbUrl,
            buildQuickDropTitlePreview(
              item.title,
              item.content,
              item.attachmentName
            )
          )
        }
        title="معاينة الصورة"
        className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
      >
        <img
          src={thumbUrl}
          alt={item.attachmentName || 'صورة مرفقة'}
          className="w-full h-full object-cover"
        />
      </button>
    );
  }

  return (
    <div className="w-12 h-12 rounded-lg border border-slate-200 bg-[var(--kb-surface)] flex items-center justify-center shrink-0">
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      ) : (
        <ImageIcon className="w-4 h-4 text-slate-400" />
      )}
    </div>
  );
}

export default function QuickDropSection({
  uid,
  canEdit,
  onRequireAuth,
  onOpenPdf,
}: QuickDropSectionProps) {
  const [items, setItems] = useState<QuickDropItem[]>([]);
  const [mobilePane, setMobilePane] = useState<'inbox' | 'archive'>('inbox');
  const [trashOpen, setTrashOpen] = useState(false);
  const [showAllInbox, setShowAllInbox] = useState(false);
  const [showAllArchive, setShowAllArchive] = useState(false);
  const [syncState, setSyncState] = useState<QuickDropSyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Composer state
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [lightboxState, setLightboxState] = useState<{
    url: string;
    title: string;
    revokeOnClose?: boolean;
  } | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const submitLockRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

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

  // Move newly expired Inbox items cleanly to Archive (NOT Trash)
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
              status: 'archived',
              archivedAt: item.archivedAt || item.expiresAt,
            }
          : item
      )
    );
    void archiveMyExpiredQuickDropItems(uid);
  }, [uid, items, nowTick]);

  const inboxItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'active' && !isQuickDropItemExpired(item, nowTick)
      ),
    [items, nowTick]
  );

  const archivedItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.status === 'archived' || isQuickDropItemExpired(item, nowTick)
        )
        .sort((a, b) => {
          const aTime = Date.parse(a.archivedAt || a.updatedAt || a.createdAt) || 0;
          const bTime = Date.parse(b.archivedAt || b.updatedAt || b.createdAt) || 0;
          return bTime - aTime;
        }),
    [items, nowTick]
  );

  const trashedItems = useMemo(
    () => items.filter((item) => item.status === 'trashed'),
    [items]
  );

  const visibleInboxItems = showAllInbox
    ? inboxItems
    : inboxItems.slice(0, COMPACT_VISIBLE_COUNT);
  const visibleArchiveItems = showAllArchive
    ? archivedItems
    : archivedItems.slice(0, COMPACT_VISIBLE_COUNT);

  const detectedComposerUrls = useMemo(
    () => extractSafeUrls(contentInput),
    [contentInput]
  );

  const supportsWebShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const closeLightbox = () => {
    if (lightboxState?.revokeOnClose && lightboxState.url) {
      URL.revokeObjectURL(lightboxState.url);
    }
    setLightboxState(null);
  };

  const handlePasteFromClipboard = async () => {
    setPasteError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== 'function'
    ) {
      setPasteError(
        'المتصفح لا يدعم القراءة المباشرة من الحافظة؛ يمكنك اللصق يدويًا (Ctrl+V).'
      );
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setPasteError('الحافظة النصية فارغة حاليًا.');
        return;
      }
      setContentInput((prev) => (prev.trim() ? `${prev}\n${text}` : text));
    } catch {
      setPasteError('يرجى السماح بصلاحية الحافظة أو اللصق يدويًا داخل الحقل.');
    }
  };

  const handleComposerPasteEvent = (e: React.ClipboardEvent) => {
    const pastedFiles = e.clipboardData?.files;
    if (pastedFiles && pastedFiles.length > 0) {
      const file = pastedFiles[0];
      if (file) {
        e.preventDefault();
        setPendingFile(file);
        setPasteError(null);
      }
    }
  };

  const handleCreateItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!uid || !canEdit) {
      onRequireAuth();
      return;
    }
    const cleanContent = contentInput.trim();
    if ((!cleanContent && !pendingFile) || submitLockRef.current) return;

    submitLockRef.current = true;
    setSubmitting(true);
    setSyncError(null);
    setPasteError(null);
    if (pendingFile) setUploadProgress(5);

    const pendingId = generateQuickDropId();
    const cleanTitle = titleInput.trim();

    try {
      const res = await createQuickDropItem(uid, {
        id: pendingId,
        title: cleanTitle,
        content: cleanContent,
        file: pendingFile,
        onUploadProgress: (pct) => setUploadProgress(pct),
      });

      setItems((prev) => [
        res.item,
        ...prev.filter((existing) => existing.id !== res.item.id),
      ]);
      setTitleInput('');
      setContentInput('');
      setPendingFile(null);
      setMobilePane('inbox');
      setTrashOpen(false);
      showTransientNotice(
        res.offlineQueued
          ? 'تم الحفظ محليًا وسيتم التزامن فور عودة الاتصال.'
          : pendingFile
          ? 'تم رفع المرفق وإضافته للوارد لمدة 24 ساعة.'
          : 'تمت الإضافة للوارد ومزامنتها بين أجهزتك لمدة 24 ساعة.'
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
        err instanceof Error ? err.message : 'تعذر حفظ العنصر في النقل السريع.'
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleCopyContent = async (item: QuickDropItem) => {
    const textToCopy = item.content.trim() || item.attachmentName || '';
    if (!textToCopy) return;
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const helper = document.createElement('textarea');
        helper.value = textToCopy;
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
        title: buildQuickDropTitlePreview(
          item.title,
          item.content,
          item.attachmentName
        ),
        text: item.content || item.attachmentName || '',
        ...(primaryUrl ? { url: primaryUrl } : {}),
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        showTransientNotice('تعذر فتح نافذة المشاركة على هذا المتصفح.');
      }
    }
  };

  const handlePreviewAttachment = async (item: QuickDropItem) => {
    if (!hasQuickDropAttachment(item)) return;
    const fileName = item.attachmentName || 'quick-drop-file';
    const isImg = isImageQuickDropAttachment(fileName, item.attachmentMime);
    const isDoc =
      isPdfQuickDropAttachment(fileName, item.attachmentMime) ||
      isViewableDocumentAttachment(fileName, item.attachmentMime);

    setOpeningFileId(item.id);
    setSyncError(null);
    try {
      const resolved = await getQuickDropAttachmentBlob(item);
      if (!resolved?.blob) {
        throw new Error('تعذر العثور على ملف المرفق على هذا الجهاز أو السحابة.');
      }

      if (isImg) {
        const url = URL.createObjectURL(resolved.blob);
        setLightboxState({
          url,
          title: buildQuickDropTitlePreview(
            item.title,
            item.content,
            item.attachmentName
          ),
          revokeOnClose: true,
        });
        return;
      }

      if (isDoc && onOpenPdf) {
        onOpenPdf({
          title: buildQuickDropTitlePreview(
            item.title,
            item.content,
            item.attachmentName
          ),
          fileName: resolved.fileName,
          resourceId: `qd_${item.id}`,
          storagePath: item.attachmentPath,
          mimeType: resolved.mimeType,
          extractedPreview: item.attachmentPreview,
          contextLabel:
            item.status === 'archived'
              ? 'الأرشيف · النقل السريع'
              : 'الوارد · النقل السريع',
          uid: uid ?? undefined,
        });
        return;
      }

      const ok = await downloadQuickDropAttachment(item);
      if (!ok) {
        throw new Error('تعذر فتح الملف أو تنزيله.');
      }
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر معاينة المرفق.'
      );
    } finally {
      setOpeningFileId((curr) => (curr === item.id ? null : curr));
    }
  };

  const handleDownloadAttachment = async (item: QuickDropItem) => {
    setOpeningFileId(item.id);
    setSyncError(null);
    try {
      const ok = await downloadQuickDropAttachment(item);
      if (!ok) {
        showTransientNotice('تعذر تنزيل المرفق حاليًا.');
      }
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر تنزيل الملف المرفق.'
      );
    } finally {
      setOpeningFileId((curr) => (curr === item.id ? null : curr));
    }
  };

  const handleArchiveItem = async (item: QuickDropItem) => {
    if (!uid || !canEdit) return onRequireAuth();
    const archivedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id
          ? { ...x, status: 'archived', archivedAt, trashedAt: null }
          : x
      )
    );
    try {
      await archiveQuickDropItem(uid, item.id);
      showTransientNotice('تم نقل العنصر إلى الأرشيف مع الاحتفاظ بملفاته.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر أرشفة العنصر.'
      );
      void refreshFnRef.current?.();
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
                archivedAt: null,
                trashedAt: null,
                expiresAt: res.expiresAt,
              }
            : x
        )
      );
      setConfirmDeleteId(null);
      showTransientNotice('تمت استعادة العنصر إلى الوارد لمدة 24 ساعة جديدة.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر استعادة العنصر.'
      );
    }
  };

  const handlePermanentDelete = async (item: QuickDropItem) => {
    if (!uid || !canEdit) return onRequireAuth();
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setConfirmDeleteId(null);
    try {
      await deleteQuickDropItemPermanently(uid, item);
      showTransientNotice('تم حذف العنصر ومرفقاته نهائيًا.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر الحذف النهائي للعنصر.'
      );
      void refreshFnRef.current?.();
    }
  };

  const handleEmptyTrash = async () => {
    if (!uid || !canEdit) return onRequireAuth();
    const toDelete = [...trashedItems];
    setItems((prev) => prev.filter((x) => x.status !== 'trashed'));
    setConfirmEmptyTrash(false);
    try {
      await emptyQuickDropTrash(uid, toDelete);
      showTransientNotice('تم إفراغ سلة المهملات وحذف مرفقاتها.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'تعذر إفراغ السلة.'
      );
      void refreshFnRef.current?.();
    }
  };

  const renderTypeBadge = (item: QuickDropItem) => {
    if (item.itemType === 'pdf') return 'ملف PDF';
    if (item.itemType === 'image') return 'صورة';
    if (item.itemType === 'file') return 'ملف مرفق';
    if (item.itemType === 'url') return 'رابط';
    if (item.itemType === 'mixed') return 'نص ورابط';
    return 'ملاحظة';
  };

  const renderAttachmentBlock = (item: QuickDropItem) => {
    if (!hasQuickDropAttachment(item)) return null;
    const fileName = item.attachmentName || 'ملف مرفق';
    const isImg = isImageQuickDropAttachment(fileName, item.attachmentMime);
    const isPdf = isPdfQuickDropAttachment(fileName, item.attachmentMime);
    const isDocViewable =
      isPdf || isViewableDocumentAttachment(fileName, item.attachmentMime);
    const sizeText = formatQuickDropFileSize(item.attachmentSize);
    const isBusy = openingFileId === item.id;

    return (
      <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2.5">
        {isImg ? (
          <QuickDropImageThumbnail
            item={item}
            onPreview={(url, title) =>
              setLightboxState({ url, title, revokeOnClose: false })
            }
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[var(--kb-surface)] border border-slate-200 flex items-center justify-center shrink-0">
            {isPdf ? (
              <FileText className="w-4 h-4 text-rose-700" aria-hidden="true" />
            ) : isDocViewable ? (
              <FileText className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            ) : (
              <FileIcon className="w-4 h-4 text-slate-600" aria-hidden="true" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold text-slate-800 truncate"
            title={fileName}
          >
            <BidiText text={fileName} />
          </p>
          <p className="text-[10px] text-slate-500 tabular-nums">
            {isImg ? 'صورة' : isPdf ? 'PDF' : 'مستند / ملف'}
            {sizeText ? ` · ${sizeText}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(isImg || isDocViewable) && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handlePreviewAttachment(item)}
              title="معاينة"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-[var(--kb-surface)] hover:bg-slate-200 border border-slate-200 rounded-md cursor-pointer disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3" aria-hidden="true" />
              )}
              <span>معاينة</span>
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleDownloadAttachment(item)}
            title="تنزيل الملف"
            aria-label={`تنزيل ${fileName}`}
            className="p-1.5 text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  const renderCard = (item: QuickDropItem, mode: 'inbox' | 'archive') => {
    const urls = extractSafeUrls(item.content);
    const primaryUrl = urls[0] || null;
    const previewHeading = buildQuickDropTitlePreview(
      item.title,
      item.content,
      item.attachmentName
    );
    const countdown = getQuickDropCountdown(item.expiresAt, nowTick);
    const segments = splitQuickDropTextSegments(item.content);
    const whatsappUrl = buildWhatsAppShareUrl(item);
    const isCopied = copiedId === item.id;
    const confirmingDelete = confirmDeleteId === item.id;
    const autoArchived =
      mode === 'archive' &&
      Date.parse(item.expiresAt) <=
        (item.archivedAt ? Date.parse(item.archivedAt) : nowTick);

    return (
      <article
        key={item.id}
        className={`p-3 rounded-xl border space-y-2 transition-colors ${
          mode === 'inbox'
            ? 'bg-white border-slate-200'
            : 'bg-[#F7F8FA] border-slate-200'
        }`}
      >
        {/* Compact Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              <BidiText text={previewHeading} />
            </h4>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-500 tabular-nums">
              <span className="font-medium text-slate-600">
                {renderTypeBadge(item)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatQuickDropDateTime(item.createdAt)}</span>
              {mode === 'archive' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#1E3A5F]">
                    {autoArchived ? 'أُرشف تلقائيًا (24 س)' : 'أرشفة يدوية'}
                  </span>
                </>
              )}
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

          {mode === 'inbox' && (
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 tabular-nums">
                <Clock className="w-2.5 h-2.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>{countdown.label}</span>
              </span>
              <div className="w-16 h-1 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F] rounded-full transition-all"
                  style={{
                    width: `${Math.round(countdown.progressRatio * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Body Text / Clickable URLs (if any) */}
        {item.content.trim() && (
          <div className="px-2.5 py-2 rounded-lg bg-[#F7F8FA] text-xs text-slate-800 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
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

        {/* Attachment Preview / Open / Download (Available in BOTH Inbox & Archive) */}
        {renderAttachmentBlock(item)}

        {/* Compact Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            {mode === 'archive' && (
              <button
                type="button"
                onClick={() => void handleRestore(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer transition-colors"
              >
                <ArchiveRestore className="w-3 h-3" aria-hidden="true" />
                <span>استعادة للوارد</span>
              </button>
            )}

            {(item.content.trim() || item.attachmentName) && (
              <button
                type="button"
                onClick={() => void handleCopyContent(item)}
                title="نسخ النص أو اسم الملف"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors"
              >
                {isCopied ? (
                  <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Copy className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                )}
                <span>{isCopied ? 'نُسخ' : 'نسخ'}</span>
              </button>
            )}

            {primaryUrl && (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md transition-colors"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <span>فتح</span>
              </a>
            )}

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="مشاركة عبر واتساب"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
            >
              <MessageCircle className="w-3 h-3" aria-hidden="true" />
              <span>واتساب</span>
            </a>

            {supportsWebShare && (
              <button
                type="button"
                onClick={() => void handleNativeShare(item)}
                title="مشاركة"
                className="p-1.5 text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors"
              >
                <Share2 className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {mode === 'inbox' && (
              <button
                type="button"
                onClick={() => void handleArchiveItem(item)}
                title="نقل للأرشيف"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
              >
                <Archive className="w-3 h-3" aria-hidden="true" />
                <span>أرشفة</span>
              </button>
            )}

            {mode === 'archive' && confirmingDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handlePermanentDelete(item)}
                  className="px-2 py-1 text-[10px] font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-md cursor-pointer"
                >
                  تأكيد الحذف
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleMoveToTrash(item)}
                  title="نقل إلى سلة المهملات"
                  aria-label="نقل إلى سلة المهملات"
                  className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                {mode === 'archive' && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="px-1.5 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                  >
                    حذف نهائي
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section
      id="quick-drop-section"
      aria-labelledby="quick-drop-heading"
      className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Compact Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Inbox className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
            <h2
              id="quick-drop-heading"
              className="font-editorial text-lg sm:text-xl font-bold text-slate-900"
            >
              النقل السريع · Quick Drop
            </h2>
          </div>
          <p className="text-[11px] text-slate-500">
            نقل الروابط والملاحظات والملفات بين أجهزتك · ينتقل للأرشيف تلقائيًا بعد 24 ساعة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {uid && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 ml-1">
              {syncState === 'syncing' || syncState === 'loading' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-[#1E3A5F]" aria-hidden="true" />
                  <span>مزامنة...</span>
                </>
              ) : syncState === 'offline' ? (
                <>
                  <CloudOff className="w-3 h-3 text-amber-600" aria-hidden="true" />
                  <span>غير متصل</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                  <span>متزامن</span>
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <RefreshCw
                className={`w-3 h-3 ${syncState === 'syncing' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">تحديث</span>
            </button>
          )}

          {/* Preserved Trash Drawer Toggle (Distinct from Archive) */}
          <button
            type="button"
            onClick={() => {
              setTrashOpen((v) => !v);
              setConfirmEmptyTrash(false);
              setConfirmDeleteId(null);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors tabular-nums ${
              trashOpen
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>السلة ({trashedItems.length})</span>
          </button>
        </div>
      </div>

      {/* Migration Notices (Non-blocking) */}
      {(syncState === 'needs_migration' || isPending017Migration()) && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
          {syncState === 'needs_migration' ? (
            <>
              يرجى تشغيل ملف الترحيل{' '}
              <code className="font-mono font-bold">016_quick_drop_items.sql</code>{' '}
              و{' '}
              <code className="font-mono font-bold">
                017_quick_drop_archive_and_attachments.sql
              </code>{' '}
              في Supabase SQL Editor لتفعيل المزامنة السحابية والمرفقات.
            </>
          ) : (
            <>
              لتفعيل مزامنة المرفقات والأرشيف المنفصل سحابيًا، شغّل ملف الترحيل{' '}
              <code className="font-mono font-bold">
                017_quick_drop_archive_and_attachments.sql
              </code>{' '}
              في Supabase SQL Editor.
            </>
          )}
        </div>
      )}

      {syncError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800">
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
          className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900"
        >
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Compact Add New Item Form (Text / URL / PDF / Image / Files) */}
      <form
        onSubmit={(e) => void handleCreateItem(e)}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingFile) setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFile(false);
          const dropped = e.dataTransfer?.files?.[0];
          if (dropped) setPendingFile(dropped);
        }}
        className={`p-3 rounded-xl border transition-colors space-y-2.5 ${
          isDraggingFile
            ? 'bg-[var(--kb-selected-bg)] border-[#1E3A5F]'
            : 'bg-[#F7F8FA] border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            maxLength={140}
            placeholder="عنوان قصير (اختياري)..."
            className="flex-1 min-w-0 px-3 py-1.5 min-h-[36px] text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handlePasteFromClipboard()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
              <span>لصق</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx,.zip,image/*"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                if (picked) setPendingFile(picked);
                e.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إرفاق ملف / صورة</span>
            </button>
          </div>
        </div>

        <AutoResizeTextarea
          minRows={2}
          value={contentInput}
          onPaste={handleComposerPasteEvent}
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
          placeholder="الصق رابط اجتماع، اكتب نصًا سريعًا، أو اسحب وأفلت PDF أو صورة هنا..."
          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg leading-relaxed focus:outline-none focus:border-[#1E3A5F]"
        />

        {pendingFile && (
          <div className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {isImageQuickDropAttachment(pendingFile.name, pendingFile.type) ? (
                <ImageIcon className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
              )}
              <span className="font-semibold text-slate-800 truncate">
                {pendingFile.name}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                ({formatQuickDropFileSize(pendingFile.size)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              aria-label="إزالة الملف المختار"
              className="p-1 text-slate-500 hover:text-rose-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {uploadProgress !== null && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-[#1E3A5F] transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 tabular-nums">
              جاري رفع المرفق ({uploadProgress}%)...
            </p>
          </div>
        )}

        {pasteError && (
          <p className="text-[11px] text-amber-800">{pasteError}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 min-w-0">
            {detectedComposerUrls.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[#1E3A5F] font-medium truncate">
                <Link2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>تم اكتشاف {detectedComposerUrls.length} رابط</span>
              </span>
            ) : (
              <span>يدعم الروابط والنصوص والـ PDF والصور والملفات</span>
            )}
          </div>

          <button
            type="submit"
            disabled={(!contentInput.trim() && !pendingFile) || submitting}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{submitting ? 'جاري الإرسال...' : 'إضافة للوارد'}</span>
          </button>
        </div>
      </form>

      {/* Mobile / Tablet Compact Switcher between Inbox and Archive */}
      <div className="flex lg:hidden items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
        <button
          type="button"
          onClick={() => setMobilePane('inbox')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors tabular-nums ${
            mobilePane === 'inbox'
              ? 'bg-white text-[#1E3A5F] font-bold shadow-xs'
              : 'text-slate-600'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
          <span>الوارد ({inboxItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('archive')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors tabular-nums ${
            mobilePane === 'archive'
              ? 'bg-white text-[#1E3A5F] font-bold shadow-xs'
              : 'text-slate-600'
          }`}
        >
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          <span>الأرشيف ({archivedItems.length})</span>
        </button>
      </div>

      {/* Primary Two-Section Compact Layout: Inbox (الوارد) + Archive (الأرشيف) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {/* Section A: Inbox (الوارد) */}
        <div
          className={`${
            mobilePane === 'inbox' ? 'flex' : 'hidden lg:flex'
          } flex-col rounded-xl border border-slate-200 bg-[#F7F8FA]/70 p-3 space-y-2.5`}
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <Inbox className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                الوارد · Inbox
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-[#1E3A5F] tabular-nums">
                {inboxItems.length}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">نشط لمدة 24 ساعة</span>
          </div>

          {inboxItems.length === 0 ? (
            <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                صندوق الوارد فارغ حاليًا
              </p>
              <p className="text-[11px] text-slate-500">
                أضف رابطًا أو ملاحظة أو PDF أو صورة لتصل فورًا إلى أجهزتك.
              </p>
            </div>
          ) : (
            <div
              className={`space-y-2 ${
                showAllInbox ? 'max-h-[420px] overflow-y-auto thin-scrollbar pl-0.5' : ''
              }`}
            >
              {visibleInboxItems.map((item) => renderCard(item, 'inbox'))}
            </div>
          )}

          {inboxItems.length > COMPACT_VISIBLE_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllInbox((v) => !v)}
              className="w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              {showAllInbox ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>عرض أقل</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>عرض الكل ({inboxItems.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Section B: Archive (الأرشيف) */}
        <div
          className={`${
            mobilePane === 'archive' ? 'flex' : 'hidden lg:flex'
          } flex-col rounded-xl border border-slate-200 bg-[#F7F8FA]/70 p-3 space-y-2.5`}
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                الأرشيف · Archive
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-[#1E3A5F] tabular-nums">
                {archivedItems.length}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              المؤرشف تلقائيًا أو يدويًا
            </span>
          </div>

          {archivedItems.length === 0 ? (
            <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">
                لا توجد عناصر في الأرشيف بعد
              </p>
              <p className="text-[11px] text-slate-500">
                تنتقل العناصر المنتهية بعد 24 ساعة أو المؤرشفة يدويًا إلى هنا مع حفظ ملفاتها.
              </p>
            </div>
          ) : (
            <div
              className={`space-y-2 ${
                showAllArchive ? 'max-h-[420px] overflow-y-auto thin-scrollbar pl-0.5' : ''
              }`}
            >
              {visibleArchiveItems.map((item) => renderCard(item, 'archive'))}
            </div>
          )}

          {archivedItems.length > COMPACT_VISIBLE_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllArchive((v) => !v)}
              className="w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              {showAllArchive ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>عرض أقل</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>عرض الكل ({archivedItems.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Preserved Trash Drawer (Distinct from Archive) */}
      {trashOpen && (
        <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-700" aria-hidden="true" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                سلة المهملات ({trashedItems.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {trashedItems.length > 0 &&
                (confirmEmptyTrash ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleEmptyTrash()}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-md cursor-pointer"
                    >
                      تأكيد إفراغ السلة
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEmptyTrash(false)}
                      className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyTrash(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>إفراغ السلة</span>
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setTrashOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                aria-label="إغلاق السلة"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {trashedItems.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">
              سلة المهملات فارغة حاليًا.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto thin-scrollbar">
              {trashedItems.map((item) => {
                const previewHeading = buildQuickDropTitlePreview(
                  item.title,
                  item.content,
                  item.attachmentName
                );
                const confirmingDelete = confirmDeleteId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        <BidiText text={previewHeading} />
                      </p>
                      <p className="text-[10px] text-slate-500 tabular-nums">
                        {renderTypeBadge(item)} · نُقل للسلة{' '}
                        {item.trashedAt
                          ? formatQuickDropDateTime(item.trashedAt)
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleRestore(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                      >
                        <ArchiveRestore className="w-3 h-3" aria-hidden="true" />
                        <span>استعادة للوارد</span>
                      </button>

                      {confirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handlePermanentDelete(item)}
                            className="px-2 py-1 text-[10px] font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-md cursor-pointer"
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>حذف نهائي</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clean Lightbox Modal for Image Previews */}
      {lightboxState && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="معاينة الصورة المرفقة"
          onClick={closeLightbox}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                <BidiText text={lightboxState.title} />
              </p>
              <button
                type="button"
                onClick={closeLightbox}
                aria-label="إغلاق المعاينة"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-900 flex items-center justify-center max-h-[75dvh] overflow-auto p-3">
              <img
                src={lightboxState.url}
                alt={lightboxState.title}
                className="max-w-full max-h-[70dvh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
