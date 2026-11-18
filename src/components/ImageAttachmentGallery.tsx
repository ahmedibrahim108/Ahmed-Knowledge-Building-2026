import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Images,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  StoredImageRecord,
  compressAndSaveImages,
  deleteStoredImage,
  getImagesForScope,
  updateStoredImageCaption,
} from '../utils/imageStorage';

interface ImageAttachmentGalleryProps {
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
}

export default function ImageAttachmentGallery({
  scopeKey,
  title = 'الصور والمخططات المرفقة',
  canEdit,
  onRequireAuth,
  compact = false,
  hideEmptyWhenReadOnly = false,
  refreshToken = 0,
}: ImageAttachmentGalleryProps) {
  const [images, setImages] = useState<ImageWithUrl[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUrlsRef = useRef<string[]>([]);

  const loadImages = async () => {
    const records = await getImagesForScope(scopeKey);
    activeUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const withUrls = records.map((rec) => ({
      ...rec,
      url: URL.createObjectURL(rec.blob),
    }));
    activeUrlsRef.current = withUrls.map((i) => i.url);
    setImages(withUrls);
  };

  useEffect(() => {
    void loadImages();
    return () => {
      activeUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      activeUrlsRef.current = [];
    };
  }, [scopeKey, refreshToken]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!canEdit) {
      onRequireAuth?.();
      return;
    }
    const validImages = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (validImages.length === 0) return;

    setUploading(true);
    try {
      await compressAndSaveImages(scopeKey, validImages);
      await loadImages();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) {
      onRequireAuth?.();
      return;
    }
    await deleteStoredImage(id);
    setLightboxIndex(null);
    await loadImages();
  };

  const handleDownload = (img: ImageWithUrl) => {
    const a = document.createElement('a');
    a.href = img.url;
    a.download = img.name || 'image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCaptionBlur = async (id: string, caption: string) => {
    await updateStoredImageCaption(id, caption);
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {uploading ? 'جاري الرفع...' : 'رفع صورة أو أكثر'}
              </span>
            </button>
          </>
        )}
      </div>

      {images.length === 0 ? (
        !compact && (
          <p className="text-[11px] text-slate-500">
            يمكنك رفع صورة واحدة أو عدة صور معًا (لقطات شاشة، سبورة، أو صفحات كتاب) أو سحبها وإفلاتها هنا.
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
          {images.map((img, index) => (
            <div
              key={img.id}
              className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="relative block w-full aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer"
                title="اضغط للتكبير"
              >
                <img
                  src={img.url}
                  alt={img.caption || img.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <span className="absolute bottom-1.5 left-1.5 p-1 rounded-md bg-slate-900/65 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3 h-3" aria-hidden="true" />
                </span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete(img.id)}
                  aria-label="حذف الصورة"
                  title="حذف الصورة"
                  className="absolute top-1.5 left-1.5 p-1 rounded-md bg-slate-900/70 text-white hover:bg-red-600 transition-colors cursor-pointer"
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
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="معاينة الصورة"
        >
          <div className="w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
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
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تنزيل</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(activeLightbox.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>حذف</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="إغلاق المعاينة"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative bg-slate-900 flex items-center justify-center max-h-[65vh] min-h-[240px]">
              <img
                src={activeLightbox.url}
                alt={activeLightbox.caption || activeLightbox.name}
                className="max-h-[65vh] w-auto object-contain"
              />
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

            <div className="p-4 bg-white border-t border-slate-200">
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
    </div>
  );
}
