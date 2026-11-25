import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FileWarning,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  downloadResourceAttachmentResult,
  findCachedAttachmentBlob,
  getAttachmentKind,
  getFreshStudyFileSignedUrl,
  getPdfBlobWithCacheInfo,
  renderDocumentBlobToHtml,
} from '../utils/documentImportExport';
import { renderSafeBidiHtml } from '../utils/richText';
import ErrorBoundary from './ErrorBoundary';

// Safe runtime shims for mobile WebViews / older Android Chrome & iOS Safari
if (
  typeof Promise !== 'undefined' &&
  typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !==
    'function'
) {
  (
    Promise as unknown as {
      withResolvers: <T>() => {
        promise: Promise<T>;
        resolve: (v: T) => void;
        reject: (r?: unknown) => void;
      };
    }
  ).withResolvers = function <T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (
  typeof URL !== 'undefined' &&
  typeof (URL as unknown as { parse?: unknown }).parse !== 'function'
) {
  (
    URL as unknown as {
      parse: (url: string, base?: string) => URL | null;
    }
  ).parse = function (url: string, base?: string): URL | null {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  };
}

try {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
} catch {
  // Fallback handled cleanly via native iframe / download option
}

export interface ActivePdfTarget {
  title: string;
  fileName: string;
  resourceId?: string;
  storagePath?: string;
  downloadUrl?: string;
  mimeType?: string;
  extractedPreview?: string;
  contextLabel?: string;
  uid?: string;
}

interface PDFViewerModalProps {
  uid?: string;
  target: ActivePdfTarget | null;
  onClose: () => void;
}

export default function PDFViewerModal({
  uid,
  target,
  onClose,
}: PDFViewerModalProps) {
  const [loadingBlob, setLoadingBlob] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [previewOnlyNotice, setPreviewOnlyNotice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [scrollMode, setScrollMode] = useState<'all' | 'single'>('all');
  const [containerWidth, setContainerWidth] = useState<number>(760);
  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [freshExternalUrl, setFreshExternalUrl] = useState<string | null>(null);
  const [cacheBadge, setCacheBadge] = useState<'cache' | 'cloud' | null>(null);
  const [pdfBinaryData, setPdfBinaryData] = useState<{ data: Uint8Array } | null>(
    null
  );
  const [useNativeIframeFallback, setUseNativeIframeFallback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const blobFallbackTriedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const rawBlobRef = useRef<Blob | null>(null);

  const attachmentKind = useMemo(
    () => getAttachmentKind(target?.fileName, target?.mimeType),
    [target?.fileName, target?.mimeType]
  );

  const isPdfMode = attachmentKind === 'pdf';

  useEffect(() => {
    if (!target || typeof document === 'undefined') return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevHtmlOverscroll = htmlEl.style.overscrollBehavior;
    const prevBodyOverscroll = bodyEl.style.overscrollBehavior;
    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    htmlEl.style.overscrollBehavior = 'none';
    bodyEl.style.overscrollBehavior = 'none';
    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      htmlEl.style.overscrollBehavior = prevHtmlOverscroll;
      bodyEl.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [Boolean(target)]);

  useEffect(() => {
    if (!target) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      rawBlobRef.current = null;
      setPdfUrl(null);
      setPdfBinaryData(null);
      setUseNativeIframeFallback(false);
      setFreshExternalUrl(null);
      setCacheBadge(null);
      setDocHtml(null);
      setPreviewOnlyNotice(false);
      setNumPages(0);
      setCurrentPage(1);
      setLoadError(null);
      setDownloadNotice(null);
      setIsExpanded(false);
      blobFallbackTriedRef.current = false;
      return;
    }

    let cancelled = false;
    const resolvedUid = uid || target.uid;
    blobFallbackTriedRef.current = false;
    rawBlobRef.current = null;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const load = async () => {
      setLoadingBlob(true);
      setLoadError(null);
      setDownloadNotice(null);
      setPdfUrl(null);
      setPdfBinaryData(null);
      setUseNativeIframeFallback(false);
      setCacheBadge(null);
      setFreshExternalUrl(target.downloadUrl || null);
      setDocHtml(null);
      setPreviewOnlyNotice(false);
      setNumPages(0);
      setCurrentPage(1);
      setZoom(1);

      try {
        if (isPdfMode) {
          // 1) Instant local IndexedDB cache check (ZERO network usage on repeat opens!)
          const local = await findCachedAttachmentBlob({
            resourceId: target.resourceId,
            storagePath: target.storagePath,
            fileName: target.fileName,
          });
          if (cancelled) return;
          if (local?.blob) {
            const typedBlob =
              local.blob.type === 'application/pdf'
                ? local.blob
                : new Blob([local.blob], { type: 'application/pdf' });
            rawBlobRef.current = typedBlob;
            const objUrl = URL.createObjectURL(typedBlob);
            blobUrlRef.current = objUrl;
            setPdfUrl(objUrl);
            setCacheBadge('cache');
            setLoadingBlob(false);
            // Lazily refresh external open URL in background without blocking viewer
            void getFreshStudyFileSignedUrl({
              uid: resolvedUid,
              resourceId: target.resourceId,
              storagePath: target.storagePath,
              fileName: target.fileName,
            }).then((signed) => {
              if (!cancelled && signed) setFreshExternalUrl(signed);
            });
            return;
          }

          // 2) First fetch on this device: download blob from Supabase Storage & SAVE to IndexedDB cache!
          const fetched = await getPdfBlobWithCacheInfo({
            uid: resolvedUid,
            resourceId: target.resourceId,
            fileName: target.fileName,
            mimeType: target.mimeType,
            storagePath: target.storagePath,
            downloadUrl: target.downloadUrl,
          });
          if (cancelled) return;

          if (fetched?.blob) {
            const typedBlob =
              fetched.blob.type === 'application/pdf'
                ? fetched.blob
                : new Blob([fetched.blob], { type: 'application/pdf' });
            rawBlobRef.current = typedBlob;
            const objUrl = URL.createObjectURL(typedBlob);
            blobUrlRef.current = objUrl;
            setPdfUrl(objUrl);
            setCacheBadge(fetched.source);
            void getFreshStudyFileSignedUrl({
              uid: resolvedUid,
              resourceId: target.resourceId,
              storagePath: fetched.storagePath || target.storagePath,
              fileName: target.fileName,
            }).then((signed) => {
              if (!cancelled && signed) setFreshExternalUrl(signed);
            });
            return;
          }

          // 3) Fallback signed URL streaming (if blob download wasn't reachable)
          const freshSignedUrl = await getFreshStudyFileSignedUrl({
            uid: resolvedUid,
            resourceId: target.resourceId,
            storagePath: target.storagePath,
            fileName: target.fileName,
          });
          if (cancelled) return;
          if (freshSignedUrl) {
            setFreshExternalUrl(freshSignedUrl);
            setPdfUrl(freshSignedUrl);
            setCacheBadge('cloud');
            return;
          }

          setLoadError(
            'لم يُعثر على ملف الـ PDF في التخزين السحابي (Supabase) ولا في كاش هذا الجهاز. إذا رفعته سابقًا من اللابتوب قبل تفعيل المزامنة السحابية، افتح الكورس من اللابتوب نفسه أو أعد رفع الملف ليزامن تلقائيًا لجميع أجهزتك.'
          );
        } else {
          const fetched = await getPdfBlobWithCacheInfo({
            uid: resolvedUid,
            resourceId: target.resourceId,
            fileName: target.fileName,
            mimeType: target.mimeType,
            storagePath: target.storagePath,
            downloadUrl: target.downloadUrl,
          });
          if (cancelled) return;

          if (fetched?.blob) {
            setCacheBadge(fetched.source);
            const rawHtml = await renderDocumentBlobToHtml(
              fetched.blob,
              target.fileName,
              target.mimeType
            );
            if (cancelled) return;
            setDocHtml(renderSafeBidiHtml(rawHtml));
            setPreviewOnlyNotice(false);
          } else if (target.extractedPreview?.trim()) {
            setDocHtml(renderSafeBidiHtml(target.extractedPreview));
            setPreviewOnlyNotice(true);
          } else {
            setLoadError(
              'لم يُعثر على محتوى المستند في السحابة أو على هذا الجهاز. أعد رفع الملف مرة واحدة من الجهاز الأصلي ليتزامن مع باقي أجهزتك.'
            );
          }
        }
      } catch {
        if (!cancelled) {
          if (!isPdfMode && target.extractedPreview?.trim()) {
            setDocHtml(renderSafeBidiHtml(target.extractedPreview));
            setPreviewOnlyNotice(true);
          } else {
            setLoadError('تعذر فتح الملف مباشرة. حاول تنزيله أو إعادة رفعه.');
          }
        }
      } finally {
        if (!cancelled) setLoadingBlob(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [target, uid, isPdfMode, reloadNonce]);

  useEffect(() => {
    if (!target) return;
    const updateWidth = () => {
      const w = bodyContainerRef.current?.clientWidth ?? window.innerWidth;
      const maxRender = isExpanded ? 1160 : 900;
      setContainerWidth(Math.max(280, Math.min(maxRender, w - 32)));
    };
    updateWidth();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && bodyContainerRef.current) {
      observer = new ResizeObserver(() => updateWidth());
      observer.observe(bodyContainerRef.current);
    }
    window.addEventListener('resize', updateWidth);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExpanded) {
          setIsExpanded(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
      window.removeEventListener('keydown', handleKey);
    };
  }, [target, onClose, isExpanded]);

  const renderedPages = useMemo(() => {
    if (numPages <= 0) return [];
    if (scrollMode === 'single') return [currentPage];
    if (numPages <= 35) {
      return Array.from({ length: numPages }, (_, i) => i + 1);
    }
    const start = Math.max(1, currentPage - 8);
    const end = Math.min(numPages, currentPage + 8);
    const arr: number[] = [];
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [numPages, scrollMode, currentPage]);

  if (!target) return null;

  const goToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, pageNum));
    setCurrentPage(clamped);
    if (scrollMode === 'all') {
      window.setTimeout(() => {
        pageRefs.current[clamped]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 30);
    }
  };

  const handleExplicitDownload = async () => {
    setDownloadNotice(null);
    const res = await downloadResourceAttachmentResult({
      uid: uid || target.uid,
      resourceId: target.resourceId,
      fileName: target.fileName,
      mimeType: target.mimeType,
      storagePath: target.storagePath,
      downloadUrl: target.downloadUrl,
    });
    if (!res.ok) {
      setDownloadNotice(
        res.errorMessage || 'تعذر تنزيل الملف من السحابة أو الذاكرة المحلية.'
      );
    }
  };

  const pageRenderWidth = Math.round(containerWidth * zoom);
  const downloadLabel = isPdfMode
    ? 'تنزيل PDF'
    : attachmentKind === 'docx' || attachmentKind === 'doc'
    ? 'تنزيل Word'
    : 'تنزيل الملف';

  return (
    <div
      className={`fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center overscroll-none ${
        isExpanded ? 'p-0' : 'p-1.5 sm:p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`عارض المستندات: ${target.title}`}
      onClick={onClose}
    >
      <div
        className={`flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-150 ${
          isExpanded
            ? 'w-screen h-[100dvh] max-w-none rounded-none border-0'
            : 'w-full max-w-5xl h-[96dvh] sm:h-[94dvh] rounded-2xl border border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            {(target.contextLabel || cacheBadge) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {target.contextLabel && (
                  <p className="font-medium text-[#1E3A5F] truncate">
                    {target.contextLabel}
                  </p>
                )}
                {cacheBadge && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                    {cacheBadge === 'cache'
                      ? 'من كاش الجهاز (بدون نت/باقة)'
                      : 'تم التنزيل والحفظ في كاش الجهاز'}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <FileText
                className="w-4 h-4 text-[#1E3A5F] shrink-0"
                aria-hidden="true"
              />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {target.title || target.fileName}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleExplicitDownload()}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{downloadLabel}</span>
            </button>
            {(freshExternalUrl || target.downloadUrl) && (
              <a
                href={freshExternalUrl || target.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                title="فتح الرابط المباشر في تبويب جديد"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">فتح مباشر</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? 'إنهاء ملء الشاشة' : 'توسيع لملء الشاشة'}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {isExpanded ? 'تصغير العرض' : 'ملء الشاشة'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>

        {/* Navigation & Zoom Toolbar */}
        <div className="px-3 sm:px-5 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {isPdfMode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || numPages === 0}
                onClick={() => goToPage(currentPage - 1)}
                aria-label="الصفحة السابقة"
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <div className="inline-flex items-center gap-1.5 px-2">
                <span className="text-slate-500">صفحة</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, numPages)}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isNaN(val)) goToPage(val);
                  }}
                  aria-label="رقم الصفحة"
                  className="w-14 px-2 py-1 text-center text-xs bg-slate-50 border border-slate-300 rounded-md tabular-nums"
                />
                <span className="text-slate-600 tabular-nums">
                  من {numPages || '—'}
                </span>
              </div>
              <button
                type="button"
                disabled={numPages === 0 || currentPage >= numPages}
                onClick={() => goToPage(currentPage + 1)}
                aria-label="الصفحة التالية"
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="px-2 py-1 bg-slate-100 text-[#1E3A5F] font-semibold rounded-md">
                {attachmentKind === 'docx' || attachmentKind === 'doc'
                  ? 'مستند Word'
                  : 'مستند نصي'}
              </span>
              <span className="truncate max-w-[200px] sm:max-w-xs text-slate-500">
                {target.fileName}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {isPdfMode && (
              <button
                type="button"
                onClick={() =>
                  setScrollMode((m) => (m === 'all' ? 'single' : 'all'))
                }
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                {scrollMode === 'all' ? 'نمط التمرير' : 'صفحة بصفحة'}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))
              }
              aria-label="تصغير"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg tabular-nums cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))
              }
              aria-label="تكبير"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {downloadNotice && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 text-center">
            {downloadNotice}
          </div>
        )}

        {/* Scrollable Document Viewport */}
        <div
          ref={bodyContainerRef}
          className="flex-1 overflow-auto bg-slate-800 p-3 sm:p-5 flex flex-col items-center gap-4"
        >
          {loadingBlob && (
            <div className="my-auto flex flex-col items-center gap-3 text-slate-200 py-16">
              <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
              <p className="text-sm">جاري تجهيز الملف للقراءة...</p>
            </div>
          )}

          {!loadingBlob && loadError && (
            <div className="my-auto max-w-md bg-white rounded-xl p-6 text-center space-y-3">
              <FileWarning
                className="w-8 h-8 text-amber-600 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-900">
                تعذر عرض الملف مباشرة
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {loadError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إعادة المحاولة</span>
                </button>
                {(freshExternalUrl || target.downloadUrl) && (
                  <a
                    href={freshExternalUrl || target.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>فتح أو تنزيل الملف</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* PDF Renderer (Legacy polyfilled PDF.js + Uint8Array transfer + Native Fallback) */}
          {!loadingBlob &&
            !loadError &&
            isPdfMode &&
            (pdfBinaryData || pdfUrl) &&
            useNativeIframeFallback && (
              <div className="w-full h-full flex flex-col gap-3">
                <div className="bg-white rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="text-slate-700 font-medium">
                    يتم عرض الملف بوضع التوافق للمتصفح الحالي.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUseNativeIframeFallback(false);
                        blobFallbackTriedRef.current = false;
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إعادة تجربة العارض التفاعلي</span>
                    </button>
                    {(freshExternalUrl || target.downloadUrl || pdfUrl) && (
                      <a
                        href={freshExternalUrl || target.downloadUrl || pdfUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>فتح مباشر</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleExplicitDownload()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{downloadLabel}</span>
                    </button>
                  </div>
                </div>
                <iframe
                  title={target.title || target.fileName}
                  src={pdfUrl || freshExternalUrl || target.downloadUrl}
                  className="w-full flex-1 min-h-[65dvh] bg-white rounded-xl border border-slate-200"
                />
              </div>
            )}

          {!loadingBlob &&
            !loadError &&
            isPdfMode &&
            (pdfBinaryData || pdfUrl) &&
            !useNativeIframeFallback && (
              <ErrorBoundary
                inline
                fallbackTitle="يتم التحويل إلى وضع العرض المباشر"
                fallbackMessage="متصفح الجهاز الحالي يفضّل العارض المدمج للنظام أو التنزيل المباشر."
                onReset={() => setUseNativeIframeFallback(true)}
              >
                <Document
                  file={pdfBinaryData || pdfUrl}
                  loading={
                    <div className="flex items-center gap-2 text-slate-200 py-12 text-sm">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>جاري تحميل الصفحات...</span>
                    </div>
                  }
                  error={
                    <div className="bg-white rounded-xl p-5 text-xs text-slate-700 space-y-3 text-center max-w-sm">
                      <p className="font-semibold text-slate-900">
                        تعذر تشغيل العارض التفاعلي على هذا المتصفح.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUseNativeIframeFallback(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                        >
                          تشغيل وضع التوافق المباشر
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleExplicitDownload()}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                        >
                          {downloadLabel}
                        </button>
                      </div>
                    </div>
                  }
                  onLoadError={() => {
                    if (!blobFallbackTriedRef.current) {
                      blobFallbackTriedRef.current = true;
                      if (rawBlobRef.current) {
                        void rawBlobRef.current
                          .arrayBuffer()
                          .then((buf) => {
                            setPdfBinaryData({ data: new Uint8Array(buf) });
                          })
                          .catch(() => {
                            setUseNativeIframeFallback(true);
                          });
                        return;
                      }
                      void getPdfBlobWithCacheInfo({
                        uid: uid || target.uid,
                        resourceId: target.resourceId,
                        fileName: target.fileName,
                        mimeType: target.mimeType,
                        storagePath: target.storagePath,
                        downloadUrl: target.downloadUrl,
                      }).then(async (fetched) => {
                        if (!fetched?.blob) {
                          setUseNativeIframeFallback(true);
                          return;
                        }
                        rawBlobRef.current = fetched.blob;
                        if (blobUrlRef.current) {
                          URL.revokeObjectURL(blobUrlRef.current);
                        }
                        const objUrl = URL.createObjectURL(fetched.blob);
                        blobUrlRef.current = objUrl;
                        setPdfUrl(objUrl);
                        setCacheBadge(fetched.source);
                        try {
                          const buf = await fetched.blob.arrayBuffer();
                          setPdfBinaryData({ data: new Uint8Array(buf) });
                        } catch {
                          setUseNativeIframeFallback(true);
                        }
                      });
                      return;
                    }
                    setUseNativeIframeFallback(true);
                  }}
                  onLoadSuccess={({ numPages: total }) => {
                    setNumPages(total);
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex flex-col items-center gap-4">
                    {renderedPages.map((pageNumber) => (
                      <div
                        key={pageNumber}
                        ref={(el) => {
                          pageRefs.current[pageNumber] = el;
                        }}
                        data-custom-card-surface="light"
                        className="bg-white shadow-xl rounded-sm overflow-hidden"
                      >
                        <Page
                          pageNumber={pageNumber}
                          width={pageRenderWidth}
                          renderTextLayer
                          renderAnnotationLayer
                        />
                      </div>
                    ))}
                  </div>
                </Document>
              </ErrorBoundary>
            )}

          {/* Word / Doc / Text Renderer */}
          {!loadingBlob && !loadError && !isPdfMode && docHtml !== null && (
            <div className="w-full max-w-[680px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
              {previewOnlyNotice && (
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
                  يتم عرض المعاينة النصية المحفوظة سحابيًا لأن الملف رُفع قبل
                  تحديث المزامنة الكاملة؛ أعد رفعه من الجهاز الأصلي لتفعيل
                  تنزيله الكامل على كل أجهزتك.
                </div>
              )}
              <div
                style={{ fontSize: `${Math.round(15 * zoom)}px` }}
                className="prose-bidi p-5 sm:p-10 text-slate-800 leading-relaxed space-y-3 overflow-x-auto [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-[var(--kb-primary-ink)] [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[var(--kb-primary-ink)] [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[var(--kb-fg)] [&_h3]:mt-4 [&_strong]:text-[var(--kb-fg)] [&_blockquote]:not-italic [&_blockquote]:border-s-4 [&_blockquote]:bg-[var(--kb-surface)] [&_blockquote]:py-2 [&_mark]:px-1 [&_mark]:rounded [&_mark]:text-[#0F172A]"
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

