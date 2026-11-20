import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  ImagePlus,
  Images,
  RotateCcw,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  StoredImageRecord,
  compressAndSaveImages,
  deleteStoredImage,
  isImageFile,
  resolveImageFallbackUrl,
  subscribeImagesForScope,
  updateStoredImageCaption,
} from '../utils/imageStorage';
import ConfirmDialog from './ConfirmDialog';
import ErrorBoundary from './ErrorBoundary';

interface ImageAttachmentGalleryProps {
  uid?: string;
  scopeKey: string;
  title?: string;
  canEdit: boolean;
  onRequireAuth?: () => void;
  compact?: boolean;
  hideEmptyWhenReadOnly?: boolean;
  refreshToken?: number;
}

interface ImageWithUrl extends StoredImageRecord {
  url: string;
  isObjectUrl: boolean;
}

function ImageAttachmentGalleryInner({
  uid: propUid,
  scopeKey,
  title = 'الصور والمخططات المرفقة',
  canEdit,
  onRequireAuth,
  compact = false,
  hideEmptyWhenReadOnly = false,
  refreshToken = 0,
}: ImageAttachmentGalleryProps) {
  const [authUid, setAuthUid] = useState<string | undefined>(
    () => auth?.currentUser?.uid
  );
  const effectiveUid = propUid || authUid;

  const [images, setImages] = useState<ImageWithUrl[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDeleteImg, setConfirmDeleteImg] = useState<ImageWithUrl | null>(
    null
  );
  const [fallbackAttempted, setFallbackAttempted] = useState<
    Record<string, boolean>
  >({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [manualReloadToken, setManualReloadToken] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeObjectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!auth) return;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthUid(u?.uid);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    setSyncError(null);
    setFallbackAttempted({});
    setFailedImages({});

    const mapRecords = (records: StoredImageRecord[]) => {
      activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      const nextUrls: string[] = [];
      const mapped: ImageWithUrl[] = records
        .map((rec) => {
          if (rec.downloadUrl) {
            return { ...rec, url: rec.downloadUrl, isObjectUrl: false };
          }
          if (rec.dataUrl) {
            return { ...rec, url: rec.dataUrl, isObjectUrl: false };
          }
          if (rec.blob) {
            const objUrl = URL.createObjectURL(rec.blob);
            nextUrls.push(objUrl);
            return { ...rec, url: objUrl, isObjectUrl: true };
          }
          return { ...rec, url: '', isObjectUrl: false };
        })
        .filter((i) => Boolean(i.url) || Boolean(i.storagePath));
      activeObjectUrlsRef.current = nextUrls;
      setImages(mapped);
    };

    const unsub = subscribeImagesForScope(
      scopeKey,
      effectiveUid,
      mapRecords,
      () => {
        setSyncError(
          'تعذّرت مزامنة الصور مع السحابة حاليًا؛ تأكد من اتصال الإنترنت أو صلاحيات الحساب.'
        );
      }
    );
    return () => {
      unsub();
      activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      activeObjectUrlsRef.current = [];
    };
  }, [scopeKey, effectiveUid, refreshToken, manualReloadToken]);

  const handleImageLoadError = async (img: ImageWithUrl) => {
    if (fallbackAttempted[img.id]) {
      setFailedImages((prev) => ({ ...prev, [img.id]: true }));
      return;
    }

    setFallbackAttempted((prev) => ({ ...prev, [img.id]: true }));
    const resolved = await resolveImageFallbackUrl(img);
    if (resolved && resolved.url !== img.url) {
      if (resolved.isObjectUrl) {
        activeObjectUrlsRef.current.push(resolved.url);
      }
      setImages((prev) =>
        prev.map((item) =>
          item.id === img.id
            ? { ...item, url: resolved.url, isObjectUrl: resolved.isObjectUrl }
            : item
        )
      );
      setFailedImages((prev) => {
        const next = { ...prev };
        delete next[img.id];
        return next;
      });
    } else {
      setFailedImages((prev) => ({ ...prev, [img.id]: true }));
    }
  };

  const handleRetrySingleImage = async (img: ImageWithUrl) => {
    setFailedImages((prev) => {
      const next = { ...prev };
      delete next[img.id];
      return next;
    });
    const resolved = await resolveImageFallbackUrl(img);
    if (resolved) {
      if (resolved.isObjectUrl) {
        activeObjectUrlsRef.current.push(resolved.url);
      }
      setImages((prev) =>
        prev.map((item) =>
          item.id === img.id
            ? { ...item, url: resolved.url, isObjectUrl: resolved.isObjectUrl }
            : item
        )
      );
    } else {
      setManualReloadToken((v) => v + 1);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!canEdit) {
      onRequireAuth?.();
      return;
    }
    const validImages = Array.from(files).filter(isImageFile);
    if (validImages.length === 0) {
      setUploadError('يرجى اختيار ملفات صور صالحة (PNG, JPG, WEBP, GIF).');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await compressAndSaveImages(scopeKey, validImages, effectiveUid);
    } catch {
      setUploadError(
        'تعذر رفع الصورة وحفظها في السحابة الآن، يرجى التأكد من الاتصال والمحاولة مرة أخرى.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteImg) return;
    if (!canEdit) {
      onRequireAuth?.();
      setConfirmDeleteImg(null);
      return;
    }
    await deleteStoredImage(confirmDeleteImg, effectiveUid);
    setConfirmDeleteImg(null);
    setLightboxIndex(null);
  };

  const handleDownload = (img: ImageWithUrl) => {
    if (!img.url) return;
    const a = document.createElement('a');
    a.href = img.url;
    a.download = img.name || 'image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCaptionBlur = async (id: string, caption: string) => {
    await updateStoredImageCaption(id, caption, effectiveUid);
    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption } : item))
    );
  };

  if (hideEmptyWhenReadOnly && !canEdit && images.length === 0) {
    return null;
  }

  const activeLightbox =
    lightboxIndex !== null && images[lightboxIndex]
      ? images[lightboxIndex]
      : null;

  return (
    <div
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          void handleFiles(e.dataTransfer.files);
        }
      }}
      className={`rounded-xl border transition-colors ${
        isDragging
          ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
          : 'border-slate-200 bg-slate-50/75'
      } ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Images className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          <span>{title}</span>
          {images.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-md tabular-nums">
              {images.length}
            </span>
          )}
          {effectiveUid && images.some((i) => i.cloudSynced) && (
            <span
              title="الصور محفوظة في Firebase Storage وقاعدة البيانات ومتزامنة بين الهاتف والكمبيوتر"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700"
            >
              <Cloud className="w-3 h-3" aria-hidden="true" />
              <span>متزامنة</span>
            </span>
          )}
        </div>

        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void handleFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {uploading ? 'جاري الرفع والحفظ...' : 'رفع صورة أو أكثر'}
              </span>
            </button>
          </>
        )}
      </div>

      {syncError && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{syncError}</span>
          </span>
          <button
            type="button"
            onClick={() => setManualReloadToken((v) => v + 1)}
            className="inline-flex items-center gap-1 font-semibold underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>تحديث</span>
          </button>
        </div>
      )}

      {uploadError && (
        <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
          {uploadError}
        </p>
      )}

      {images.length === 0 ? (
        !compact && (
          <p className="text-[11px] text-slate-500">
            ارفع صورة أو عدة صور من الهاتف أو الكمبيوتر (لقطات شاشة، سبورة، أو صفحات كتاب) وستُحفظ تلقائيًا في حسابك وتظهر على جميع أجهزتك.
          </p>
        )
      ) : (
        <div
          className={`grid gap-2.5 ${
            compact
              ? 'grid-cols-3 sm:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}
        >
          {images.map((img, index) => {
            const isBroken = Boolean(failedImages[img.id]) || !img.url;

            return (
              <div
                key={img.id}
                className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                {isBroken ? (
                  <div className="w-full aspect-[4/3] bg-slate-100 flex flex-col items-center justify-center p-2 text-center gap-1.5">
                    <AlertTriangle
                      className="w-4 h-4 text-amber-600"
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-medium text-slate-600">
                      تعذّر تحميل الصورة
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRetrySingleImage(img)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>إعادة المحاولة</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="relative block w-full aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer"
                    title="اضغط للتكبير"
                  >
                    <img
                      src={img.url}
                      alt={img.caption || img.name}
                      onError={() => void handleImageLoadError(img)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute bottom-1.5 left-1.5 p-1 rounded-md bg-slate-900/65 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="w-3 h-3" aria-hidden="true" />
                    </span>
                  </button>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteImg(img)}
                    aria-label="حذف الصورة"
                    title="حذف الصورة"
                    className="absolute top-1.5 left-1.5 p-1.5 rounded-md bg-slate-900/70 text-white hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}

                {!compact && (
                  <div className="px-2 py-1.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                    <span className="truncate">{img.caption || img.name}</span>
                    <span className="tabular-nums shrink-0">{img.sizeKb}KB</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[65] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="معاينة الصورة"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[92dvh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {activeLightbox.name}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  صورة {lightboxIndex + 1} من {images.length} ·{' '}
                  {activeLightbox.sizeKb} كيلوبايت
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(activeLightbox)}
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تنزيل</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteImg(activeLightbox)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>حذف</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="إغلاق المعاينة"
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative bg-slate-900 flex-1 flex items-center justify-center min-h-[220px] max-h-[65dvh] overflow-hidden">
              {failedImages[activeLightbox.id] || !activeLightbox.url ? (
                <div className="text-center text-white space-y-2 p-6">
                  <AlertTriangle
                    className="w-7 h-7 text-amber-400 mx-auto"
                    aria-hidden="true"
                  />
                  <p className="text-xs">
                    تعذّر تحميل هذه الصورة عبر الشبكة الحالية.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRetrySingleImage(activeLightbox)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white rounded-lg cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إعادة المحاولة</span>
                  </button>
                </div>
              ) : (
                <img
                  src={activeLightbox.url}
                  alt={activeLightbox.caption || activeLightbox.name}
                  onError={() => void handleImageLoadError(activeLightbox)}
                  className="max-h-[65dvh] max-w-full w-auto object-contain"
                />
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + images.length) % images.length
                      )
                    }
                    aria-label="الصورة السابقة"
                    className="absolute right-3 p-2 rounded-full bg-white/85 text-slate-900 hover:bg-white shadow cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % images.length)
                    }
                    aria-label="الصورة التالية"
                    className="absolute left-3 p-2 rounded-full bg-white/85 text-slate-900 hover:bg-white shadow cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <input
                type="text"
                readOnly={!canEdit}
                defaultValue={activeLightbox.caption}
                key={activeLightbox.id}
                onBlur={(e) => {
                  if (canEdit) {
                    void handleCaptionBlur(activeLightbox.id, e.target.value);
                  }
                }}
                placeholder={
                  canEdit
                    ? 'أضف تعليقًا أو وصفًا لهذه الصورة (يُحفظ تلقائيًا)...'
                    : 'بدون وصف'
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteImg)}
        title="تأكيد حذف الصورة"
        message={`هل تريد حذف الصورة «${confirmDeleteImg?.name ?? ''}» نهائيًا من حسابك؟`}
        confirmLabel="حذف الصورة"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDeleteImg(null)}
      />
    </div>
  );
}

export default function ImageAttachmentGallery(
  props: ImageAttachmentGalleryProps
) {
  return (
    <ErrorBoundary
      inline
      fallbackTitle="تعذّر تحميل معرض الصور"
      fallbackMessage="حدث خطأ غير متوقع أثناء عرض الصور المرفقة. يمكنك إعادة المحاولة دون التأثير على بياناتك."
    >
      <ImageAttachmentGalleryInner {...props} />
    </ErrorBoundary>
  );
}
