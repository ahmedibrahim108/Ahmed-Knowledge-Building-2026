import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Crop,
  Download,
  ImagePlus,
  Images,
  Maximize2,
  Minimize2,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_IMAGE_FRAME_SPEC,
  ImageDisplaySize,
  ImageFrameSpec,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import { auth } from '../firebase';
import {
  StoredImageRecord,
  compressAndSaveImages,
  deleteStoredImage,
  isImageFile,
  subscribeImagesForScope,
  updateStoredImageMetadata,
} from '../utils/imageStorage';
import ConfirmDialog from './ConfirmDialog';
import ErrorBoundary from './ErrorBoundary';
import { FramedImage, ImageFrameEditorModal } from './FramedImage';

export const MAIN_GALLERY_SCOPE_KEY = 'gallery:main';

const GALLERY_CATEGORIES = ['عام', 'دراسة', 'ذكريات', 'توثيق'];
const SIZE_ORDER: ImageDisplaySize[] = ['xs', 'sm', 'md', 'lg', 'full'];
const SIZE_COL_SPAN: Record<ImageDisplaySize, string> = {
  xs: 'col-span-6 sm:col-span-3 md:col-span-2',
  sm: 'col-span-6 sm:col-span-4 md:col-span-3',
  md: 'col-span-12 sm:col-span-6 md:col-span-4',
  lg: 'col-span-12 md:col-span-6',
  full: 'col-span-12',
};

interface GalleryImageItem extends StoredImageRecord {
  url: string;
  isObjectUrl: boolean;
}

interface PhotoGalleryViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
}

function PhotoGalleryViewInner({
  uid: propUid,
  canEdit,
  onRequireAuth,
}: PhotoGalleryViewProps) {
  const [authUid, setAuthUid] = useState<string | undefined>(
    () => auth?.currentUser?.uid
  );
  const effectiveUid = propUid || authUid;

  const [images, setImages] = useState<GalleryImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [uploadCat, setUploadCat] = useState<string>('عام');

  const [editingFrameImg, setEditingFrameImg] = useState<GalleryImageItem | null>(
    null
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDeleteImg, setConfirmDeleteImg] =
    useState<GalleryImageItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeObjectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUid(u?.uid);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const mapRecords = (records: StoredImageRecord[]) => {
      activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      const nextUrls: string[] = [];
      const mapped: GalleryImageItem[] = records
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
        .filter((i) => Boolean(i.url) || Boolean(i.storagePath))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      activeObjectUrlsRef.current = nextUrls;
      setImages(mapped);
    };

    const unsub = subscribeImagesForScope(
      MAIN_GALLERY_SCOPE_KEY,
      effectiveUid,
      mapRecords
    );
    return () => {
      unsub();
      activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      activeObjectUrlsRef.current = [];
    };
  }, [effectiveUid]);

  const categories = useMemo(() => {
    const extras = images
      .map((i) => (i.categoryLabel || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...GALLERY_CATEGORIES, ...extras]));
  }, [images]);

  const filteredImages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return images.filter((img) => {
      if (catFilter !== 'all' && (img.categoryLabel || 'عام') !== catFilter) {
        return false;
      }
      if (!q) return true;
      return `${img.caption} ${img.name} ${img.categoryLabel || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [images, catFilter, searchQuery]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const valid = Array.from(files).filter(isImageFile);
    if (valid.length === 0) {
      setUploadError('يرجى اختيار ملفات صور صالحة (PNG, JPG, WEBP, GIF).');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await compressAndSaveImages(MAIN_GALLERY_SCOPE_KEY, valid, effectiveUid, {
        frameConfig: DEFAULT_IMAGE_FRAME_SPEC,
        categoryLabel: uploadCat,
      });
    } catch {
      setUploadError('تعذّر رفع الصورة حاليًا. تأكد من الاتصال وحاول مجددًا.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateFrame = async (img: GalleryImageItem, nextFrame: ImageFrameSpec) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setImages((prev) =>
      prev.map((item) =>
        item.id === img.id ? { ...item, frameConfig: nextFrame } : item
      )
    );
    await updateStoredImageMetadata(
      img.id,
      { frameConfig: nextFrame },
      effectiveUid
    );
  };

  const handleStepCardSize = (img: GalleryImageItem, delta: -1 | 1) => {
    const current = sanitizeImageFrameSpec(
      img.frameConfig,
      DEFAULT_IMAGE_FRAME_SPEC
    );
    const idx = SIZE_ORDER.indexOf(current.sizePreset);
    const nextIdx = Math.max(0, Math.min(SIZE_ORDER.length - 1, idx + delta));
    const nextSize = SIZE_ORDER[nextIdx];
    const nextHeight = current.customHeightPx
      ? Math.max(100, Math.min(440, current.customHeightPx + delta * 50))
      : undefined;
    void handleUpdateFrame(img, {
      ...current,
      sizePreset: nextSize,
      ...(nextHeight ? { customHeightPx: nextHeight } : {}),
    });
  };

  const handleUpdateCaptionOrCategory = async (
    imgId: string,
    updates: { caption?: string; categoryLabel?: string }
  ) => {
    setImages((prev) =>
      prev.map((i) => (i.id === imgId ? { ...i, ...updates } : i))
    );
    await updateStoredImageMetadata(imgId, updates, effectiveUid);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteImg) return;
    if (!canEdit) {
      onRequireAuth();
      setConfirmDeleteImg(null);
      return;
    }
    await deleteStoredImage(confirmDeleteImg, effectiveUid);
    setImages((prev) => prev.filter((i) => i.id !== confirmDeleteImg.id));
    setConfirmDeleteImg(null);
    setLightboxIndex(null);
  };

  const handleDownload = (img: GalleryImageItem) => {
    if (!img.url) return;
    const a = document.createElement('a');
    a.href = img.url;
    a.download = img.name || 'photo.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeLightbox =
    lightboxIndex !== null && filteredImages[lightboxIndex]
      ? filteredImages[lightboxIndex]
      : null;

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files?.length) {
          void handleFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            معرض الصور ({images.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            أضف صورك بسهولة، وصغّرها أو كبّرها أو اضبط جزء العرض المناسب لكل صورة.
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uploadCat}
              onChange={(e) => setUploadCat(e.target.value)}
              aria-label="تصنيف الرفع"
              className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-50 rounded-xl cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" aria-hidden="true" />
              <span>{uploading ? 'جاري الرفع...' : 'إضافة صور'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Ribbon */}
      <div
        className={`bg-white border rounded-xl p-3 flex flex-wrap items-center gap-2 transition-colors ${
          isDraggingOver
            ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
            : 'border-slate-200'
        }`}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالوصف أو اسم الصورة..."
            className="w-full pr-9 pl-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCatFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
              catFilter === 'all'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            الكل ({images.length})
          </button>
          {categories.map((cat) => {
            const count = images.filter(
              (i) => (i.categoryLabel || 'عام') === cat
            ).length;
            if (count === 0 && cat !== 'عام') return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                  catFilter === cat
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {uploadError}
        </p>
      )}

      {/* Gallery Grid */}
      {filteredImages.length === 0 ? (
        <div
          onClick={() => canEdit && fileInputRef.current?.click()}
          className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center space-y-3 transition-colors ${
            isDraggingOver
              ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
              : 'border-slate-200 hover:border-slate-300'
          } ${canEdit ? 'cursor-pointer' : ''}`}
        >
          <Images className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            {images.length === 0
              ? 'معرض الصور فارغ حاليًا — اسحب الصور هنا أو اضغط لإضافة أول صورة.'
              : 'لا توجد صور مطابقة للبحث أو التصنيف الحالي.'}
          </p>
          {canEdit && (
            <p className="text-xs text-slate-500">
              يمكنك تصغير وتكبير كل صورة أو ضبط جزء محدد منها بحرية، وتُحفظ تلقائيًا في حسابك.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3.5 items-start">
          {filteredImages.map((img, idx) => {
            const safeFrame = sanitizeImageFrameSpec(
              img.frameConfig,
              DEFAULT_IMAGE_FRAME_SPEC
            );
            const spanClass = SIZE_COL_SPAN[safeFrame.sizePreset] || SIZE_COL_SPAN.md;

            return (
              <article
                key={img.id}
                className={`${spanClass} group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all hover:border-slate-300`}
              >
                <FramedImage
                  srcUrl={img.url}
                  storagePath={img.storagePath}
                  frame={safeFrame}
                  alt={img.caption || img.name}
                  mode="gallery"
                  onClick={() => setLightboxIndex(idx)}
                >
                  {img.cloudSynced && (
                    <span
                      title="متزامنة سحابيًا"
                      className="absolute top-2 right-2 p-1 rounded-md bg-white/85 text-emerald-700 border border-slate-200/70"
                    >
                      <Cloud className="w-3 h-3" aria-hidden="true" />
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-900/65 text-white tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.round(safeFrame.zoom * 100)}%
                  </span>
                </FramedImage>

                <div className="px-2.5 py-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="min-w-0 text-right truncate hover:text-slate-900 font-medium cursor-pointer"
                  >
                    {img.caption || img.name}
                  </button>

                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStepCardSize(img, -1)}
                        disabled={safeFrame.sizePreset === 'xs'}
                        title="تصغير حجم الصورة"
                        aria-label="تصغير حجم الصورة"
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-35 cursor-pointer"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepCardSize(img, 1)}
                        disabled={safeFrame.sizePreset === 'full'}
                        title="تكبير حجم الصورة"
                        aria-label="تكبير حجم الصورة"
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-35 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFrameImg(img)}
                        title="ضبط الفريم والحجم والقص"
                        aria-label="ضبط الفريم والحجم والقص"
                        className="p-1 rounded hover:bg-slate-100 text-[#1E3A5F] cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteImg(img)}
                        title="حذف الصورة"
                        aria-label="حذف الصورة"
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[92dvh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {activeLightbox.caption || activeLightbox.name}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  صورة {lightboxIndex + 1} من {filteredImages.length} ·{' '}
                  {activeLightbox.sizeKb}KB
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeLightbox;
                      setLightboxIndex(null);
                      setEditingFrameImg(target);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تعديل الحجم والفريم</span>
                  </button>
                )}
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
                    onClick={() => setConfirmDeleteImg(activeLightbox)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>حذف</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="إغلاق"
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative bg-slate-900 flex-1 flex items-center justify-center min-h-[240px] max-h-[65dvh] overflow-hidden">
              <img
                src={activeLightbox.url}
                alt={activeLightbox.caption || activeLightbox.name}
                className="max-h-[65dvh] max-w-full w-auto object-contain"
              />
              {filteredImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + filteredImages.length) %
                          filteredImages.length
                      )
                    }
                    aria-label="السابقة"
                    className="absolute right-3 p-2 rounded-full bg-white/85 text-slate-900 hover:bg-white shadow cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % filteredImages.length)
                    }
                    aria-label="التالية"
                    className="absolute left-3 p-2 rounded-full bg-white/85 text-slate-900 hover:bg-white shadow cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                readOnly={!canEdit}
                key={activeLightbox.id}
                defaultValue={activeLightbox.caption}
                onBlur={(e) => {
                  if (canEdit) {
                    void handleUpdateCaptionOrCategory(activeLightbox.id, {
                      caption: e.target.value,
                    });
                  }
                }}
                placeholder="أضف وصفًا أو تعليقًا للصورة..."
                className="sm:col-span-2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
              <select
                disabled={!canEdit}
                value={activeLightbox.categoryLabel || 'عام'}
                onChange={(e) =>
                  void handleUpdateCaptionOrCategory(activeLightbox.id, {
                    categoryLabel: e.target.value,
                  })
                }
                aria-label="تصنيف الصورة"
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Resize & Frame Editor Modal */}
      {editingFrameImg && (
        <ImageFrameEditorModal
          open={Boolean(editingFrameImg)}
          srcUrl={editingFrameImg.url}
          storagePath={editingFrameImg.storagePath}
          title={`تعديل حجم وفريم: ${editingFrameImg.caption || editingFrameImg.name}`}
          initialFrame={editingFrameImg.frameConfig}
          defaultFrame={DEFAULT_IMAGE_FRAME_SPEC}
          onSave={(nextFrame) => void handleUpdateFrame(editingFrameImg, nextFrame)}
          onClose={() => setEditingFrameImg(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteImg)}
        title="تأكيد حذف الصورة"
        message={`هل تريد حذف الصورة «${confirmDeleteImg?.name ?? ''}» نهائيًا؟`}
        confirmLabel="حذف"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDeleteImg(null)}
      />
    </div>
  );
}

export default function PhotoGalleryView(props: PhotoGalleryViewProps) {
  return (
    <ErrorBoundary
      inline
      fallbackTitle="تعذّر عرض معرض الصور"
      fallbackMessage="حدث خطأ غير متوقع في معرض الصور. أعد المحاولة دون التأثير على بياناتك."
    >
      <PhotoGalleryViewInner {...props} />
    </ErrorBoundary>
  );
}
