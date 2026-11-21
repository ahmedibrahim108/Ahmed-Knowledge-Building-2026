import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileWarning,
  Loader2,
  Maximize2,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  downloadResourceAttachment,
  loadPdfBytesForViewing,
} from '../utils/documentImportExport';
import ErrorBoundary from './ErrorBoundary';

// Safe runtime shim for older Android Chrome / WebViews when PDF modal is opened
if (
  typeof Promise !== 'undefined' &&
  typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function'
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

try {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
} catch {
  // Fallback handled cleanly by ErrorBoundary / download option
}

export interface ActivePdfTarget {
  title: string;
  fileName: string;
  resourceId?: string;
  storagePath?: string;
  downloadUrl?: string;
  contextLabel?: string;
}

interface PDFViewerModalProps {
  target: ActivePdfTarget | null;
  onClose: () => void;
}

interface LazyPdfPageProps {
  pageNumber: number;
  width: number;
  scrollRoot: HTMLDivElement | null;
  isNearby: boolean;
  onVisible: (pageNumber: number) => void;
  setContainerRef: (pageNumber: number, el: HTMLDivElement | null) => void;
}

function LazyPdfPage({
  pageNumber,
  width,
  scrollRoot,
  isNearby,
  onVisible,
  setContainerRef,
}: LazyPdfPageProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(pageNumber <= 2);

  useEffect(() => {
    const el = localRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          onVisible(pageNumber);
        }
      },
      {
        root: scrollRoot,
        rootMargin: '420px 0px',
        threshold: [0, 0.35, 0.7],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, scrollRoot, onVisible]);

  const shouldRender = inView || isNearby;
  const estimatedHeight = Math.round(width * 1.414);

  return (
    <div
      ref={(el) => {
        localRef.current = el;
        setContainerRef(pageNumber, el);
      }}
      style={{
        minHeight: shouldRender ? undefined : `${estimatedHeight}px`,
        width: `${width}px`,
      }}
      className="bg-white shadow-xl rounded-sm overflow-hidden flex items-center justify-center shrink-0"
    >
      {shouldRender ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          devicePixelRatio={
            typeof window !== 'undefined'
              ? Math.min(window.devicePixelRatio || 1, 2)
              : 1
          }
          renderTextLayer
          renderAnnotationLayer
          loading={
            <div
              style={{ width: `${width}px`, height: `${estimatedHeight}px` }}
              className="flex items-center justify-center bg-white text-slate-400 text-xs gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>صفحة {pageNumber}</span>
            </div>
          }
        />
      ) : (
        <span className="text-xs text-slate-400 tabular-nums">
          صفحة {pageNumber}
        </span>
      )}
    </div>
  );
}

export default function PDFViewerModal({ target, onClose }: PDFViewerModalProps) {
  const [loadingBytes, setLoadingBytes] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>(undefined);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [scrollMode, setScrollMode] = useState<'all' | 'single'>('all');
  const [containerWidth, setContainerWidth] = useState<number>(760);
  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!target) {
      setPdfBytes(null);
      setNumPages(0);
      setCurrentPage(1);
      setLoadError(null);
      setFallbackUrl(undefined);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingBytes(true);
      setLoadError(null);
      setFallbackUrl(target.downloadUrl);
      setNumPages(0);
      setCurrentPage(1);
      setZoom(1);
      try {
        const res = await loadPdfBytesForViewing({
          resourceId: target.resourceId,
          storagePath: target.storagePath,
          downloadUrl: target.downloadUrl,
        });
        if (cancelled) return;
        if (!res.ok) {
          setPdfBytes(null);
          setLoadError(res.message);
          setFallbackUrl(res.fallbackUrl ?? target.downloadUrl);
        } else {
          setPdfBytes(res.data);
        }
      } catch {
        if (!cancelled) {
          setPdfBytes(null);
          setLoadError('تعذّر تحميل ملف الـ PDF. حاول إعادة المحاولة أو تنزيله مباشرة.');
        }
      } finally {
        if (!cancelled) setLoadingBytes(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [target, reloadNonce]);

  useEffect(() => {
    if (!target) return;
    const updateWidth = () => {
      const w = bodyContainerRef.current?.clientWidth ?? window.innerWidth;
      const horizontalPad = window.innerWidth < 640 ? 16 : 40;
      setContainerWidth(Math.max(260, Math.min(920, w - horizontalPad)));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('resize', updateWidth);
      window.removeEventListener('keydown', handleKey);
    };
  }, [target, onClose]);

  const setContainerRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    pageRefs.current[pageNum] = el;
  }, []);

  const handlePageVisible = useCallback((pageNum: number) => {
    setCurrentPage((prev) => (prev === pageNum ? prev : pageNum));
  }, []);

  // Provide fresh Uint8Array copy so pdf.js worker transfer never detaches React state buffer
  const documentFile = useMemo(() => {
    if (!pdfBytes) return null;
    return { data: new Uint8Array(pdfBytes) };
  }, [pdfBytes]);

  const documentOptions = useMemo(() => {
    const ver = pdfjs.version || '5.4.149';
    return {
      cMapUrl: `https://unpkg.com/pdfjs-dist@${ver}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${ver}/standard_fonts/`,
    };
  }, []);

  const allPageNumbers = useMemo(() => {
    if (numPages <= 0) return [];
    if (scrollMode === 'single') return [currentPage];
    return Array.from({ length: numPages }, (_, i) => i + 1);
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
    } else if (bodyContainerRef.current) {
      bodyContainerRef.current.scrollTop = 0;
    }
  };

  const handleExplicitDownload = async () => {
    await downloadResourceAttachment({
      resourceId: target.resourceId,
      fileName: target.fileName,
      storagePath: target.storagePath,
      downloadUrl: target.downloadUrl,
    });
  };

  const pageRenderWidth = Math.max(240, Math.round(containerWidth * zoom));

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`عارض PDF: ${target.title}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[100dvh] sm:h-[94dvh] flex flex-col bg-white rounded-none sm:rounded-2xl border-0 sm:border sm:border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            {target.contextLabel && (
              <p className="text-[11px] font-medium text-[#1E3A5F] truncate">
                {target.contextLabel}
              </p>
            )}
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {target.title || target.fileName}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {fallbackUrl && (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                title="فتح النسخة الأصلية في نافذة جديدة"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden md:inline">فتح الأصل</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => void handleExplicitDownload()}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">تنزيل PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>

        {/* Navigation & Zoom Toolbar */}
        <div className="px-3 sm:px-5 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1 || numPages === 0}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="الصفحة السابقة"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="inline-flex items-center gap-1 px-1.5">
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
                className="w-12 px-1.5 py-1.5 min-h-[36px] text-center text-xs bg-slate-50 border border-slate-300 rounded-md tabular-nums"
              />
              <span className="text-slate-600 tabular-nums">
                / {numPages || '—'}
              </span>
            </div>
            <button
              type="button"
              disabled={numPages === 0 || currentPage >= numPages}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="الصفحة التالية"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScrollMode((m) => (m === 'all' ? 'single' : 'all'))}
              className="px-2.5 py-2 min-h-[40px] text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              {scrollMode === 'all' ? 'تمرير مستمر' : 'صفحة بصفحة'}
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
              aria-label="تصغير"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="ملاءمة عرض الشاشة (100%)"
              className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg tabular-nums cursor-pointer"
            >
              <Maximize2 className="w-3 h-3 text-slate-500 hidden sm:inline" aria-hidden="true" />
              <span>{Math.round(zoom * 100)}%</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}
              aria-label="تكبير"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable PDF Viewport */}
        <div
          ref={bodyContainerRef}
          className="flex-1 overflow-auto bg-slate-800 p-2 sm:p-5 flex flex-col items-center gap-4 touch-pan-x touch-pan-y"
        >
          {loadingBytes && (
            <div className="my-auto flex flex-col items-center gap-3 text-slate-200 py-16">
              <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
              <p className="text-sm">جاري تجهيز ملف الـ PDF للقراءة داخل التطبيق...</p>
            </div>
          )}

          {!loadingBytes && loadError && (
            <div className="my-auto max-w-md bg-white rounded-xl p-6 text-center space-y-4">
              <FileWarning className="w-8 h-8 text-amber-600 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">
                تعذّر عرض الملف مباشرة داخل الصفحة
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إعادة المحاولة</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleExplicitDownload()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تنزيل PDF</span>
                </button>
                {fallbackUrl && (
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-[#1E3A5F] border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>فتح في المتصفح</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {!loadingBytes && !loadError && documentFile && (
            <ErrorBoundary
              inline
              fallbackTitle="تعذّر عرض ملف الـ PDF داخل المتصفح الحالي"
              fallbackMessage="يمكنك استخدام زر «تنزيل PDF» أو «فتح الأصل» بالأعلى لفتح المستند."
            >
              <Document
                file={documentFile}
                options={documentOptions}
                loading={
                  <div className="flex items-center gap-2 text-slate-200 py-12 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>جاري معالجة صفحات المستند...</span>
                  </div>
                }
                error={
                  <div className="bg-white rounded-xl p-5 text-xs text-red-700 space-y-3 text-center max-w-sm">
                    <p>تعذّر قراءة هذا المستند بصيغة PDF داخل العارض المدمج.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleExplicitDownload()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>تنزيل PDF</span>
                      </button>
                      {fallbackUrl && (
                        <a
                          href={fallbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1E3A5F] border border-slate-300 rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>فتح الأصل</span>
                        </a>
                      )}
                    </div>
                  </div>
                }
                onLoadSuccess={({ numPages: total }) => {
                  setNumPages(total);
                  setCurrentPage(1);
                }}
                onLoadError={(err) => {
                  setLoadError(
                    err?.message
                      ? `تعذر تفسير ملف الـ PDF (${err.message}).`
                      : 'تعذر تفسير ملف الـ PDF.'
                  );
                }}
              >
                <div className="flex flex-col items-center gap-4">
                  {allPageNumbers.map((pageNumber) => (
                    <LazyPdfPage
                      key={pageNumber}
                      pageNumber={pageNumber}
                      width={pageRenderWidth}
                      scrollRoot={bodyContainerRef.current}
                      isNearby={Math.abs(pageNumber - currentPage) <= 1}
                      onVisible={handlePageVisible}
                      setContainerRef={setContainerRef}
                    />
                  ))}
                </div>
              </Document>
            </ErrorBoundary>
          )}
        </div>

        {/* Mobile Bottom Quick Pager when in single-page or multi-page mode */}
        {numPages > 1 && !loadError && (
          <div className="sm:hidden px-3 py-2 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
              <span>السابقة</span>
            </button>
            <span className="text-xs font-bold text-[#1E3A5F] tabular-nums px-2">
              {currentPage} / {numPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= numPages}
              onClick={() => goToPage(currentPage + 1)}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg disabled:opacity-40 cursor-pointer"
            >
              <span>التالية</span>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
