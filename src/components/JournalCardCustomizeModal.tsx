import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Crop,
  ImagePlus,
  Images,
  Loader2,
  Maximize2,
  Palette,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_IMAGE_FRAME_SPEC,
  DailyJournalRecord,
  ImageFrameSpec,
  JOURNAL_CARD_THEMES,
  JournalCardColorKey,
  formatShortArabicDate,
  getDayArabicName,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import {
  StoredImageRecord,
  deleteJournalCoverStorage,
  getImagesForScope,
  resolveImageFallbackUrl,
  uploadJournalCoverImage,
  validateImageFileForUpload,
} from '../utils/imageStorage';
import { ImageFrameEditorModal, useResolvedImageSrc } from './FramedImage';
import { MAIN_GALLERY_SCOPE_KEY } from './PhotoGalleryView';

interface JournalCardCustomizeModalProps {
  open: boolean;
  dateKey: string;
  existingRecord?: DailyJournalRecord;
  dayPhotos: StoredImageRecord[];
  previewTitle?: string;
  previewExcerpt?: string;
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  onSaveDailyJournal: (rec: DailyJournalRecord) => void;
  onOpenFullDay: (dateKey: string) => void;
  onClose: () => void;
}

const DEFAULT_JOURNAL_CARD_COVER_FRAME: ImageFrameSpec = {
  ...DEFAULT_IMAGE_FRAME_SPEC,
  aspect: '16:9',
  fitMode: 'cover',
  sizePreset: 'sm',
  customHeightPx: 120,
};

function GalleryPhotoThumb({
  record,
  selected,
  onSelect,
}: {
  record: StoredImageRecord;
  selected: boolean;
  onSelect: (url: string, storagePath?: string) => void;
}) {
  const [src, setSrc] = useState(record.downloadUrl || record.dataUrl || '');

  useEffect(() => {
    let active = true;
    let objUrl = '';
    if (!record.downloadUrl && !record.dataUrl) {
      void resolveImageFallbackUrl(record).then((res) => {
        if (!active) return;
        if (res?.url) {
          if (res.isObjectUrl) objUrl = res.url;
          setSrc(res.url);
        }
      });
    } else {
      setSrc(record.downloadUrl || record.dataUrl || '');
    }
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [record]);

  if (!src) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(src, record.storagePath)}
      title={record.caption || record.name}
      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
        selected
          ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/25'
          : 'border-slate-200 hover:border-slate-400'
      }`}
    >
      <img
        src={src}
        alt={record.caption || record.name}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
      />
      {selected && (
        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#1E3A5F] text-white inline-flex items-center justify-center shadow">
          <Check className="w-3 h-3" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

export default function JournalCardCustomizeModal({
  open,
  dateKey,
  existingRecord,
  dayPhotos,
  previewTitle,
  previewExcerpt,
  uid,
  canEdit,
  onRequireAuth,
  onSaveDailyJournal,
  onOpenFullDay,
  onClose,
}: JournalCardCustomizeModalProps) {
  const [cardColor, setCardColor] = useState<JournalCardColorKey>(
    existingRecord?.cardColor || 'default'
  );
  const [coverUrl, setCoverUrl] = useState(existingRecord?.coverImageUrl || '');
  const [coverStoragePath, setCoverStoragePath] = useState(
    existingRecord?.coverImageStoragePath || ''
  );
  const [coverFrame, setCoverFrame] = useState<ImageFrameSpec>(() =>
    sanitizeImageFrameSpec(
      existingRecord?.coverFrame,
      DEFAULT_JOURNAL_CARD_COVER_FRAME
    )
  );

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [galleryItems, setGalleryItems] = useState<StoredImageRecord[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [frameEditorOpen, setFrameEditorOpen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setCardColor(existingRecord?.cardColor || 'default');
    setCoverUrl(existingRecord?.coverImageUrl || '');
    setCoverStoragePath(existingRecord?.coverImageStoragePath || '');
    setCoverFrame(
      sanitizeImageFrameSpec(
        existingRecord?.coverFrame,
        DEFAULT_JOURNAL_CARD_COVER_FRAME
      )
    );
    setUploadErr(null);
    setShowGalleryPicker(false);
    setSavedFeedback(false);
  }, [open, dateKey, existingRecord]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !frameEditorOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, frameEditorOpen, onClose]);

  useEffect(() => {
    if (!showGalleryPicker || !open) return;
    let active = true;
    setLoadingGallery(true);
    void getImagesForScope(MAIN_GALLERY_SCOPE_KEY, uid)
      .then((records) => {
        if (active) setGalleryItems(records);
      })
      .finally(() => {
        if (active) setLoadingGallery(false);
      });
    return () => {
      active = false;
    };
  }, [showGalleryPicker, open, uid]);

  const {
    resolvedUrl: resolvedPreviewCover,
    loadFailed: coverLoadFailed,
    handleImgError,
  } = useResolvedImageSrc(coverUrl, coverStoragePath);

  if (!open) return null;

  const activeTheme =
    JOURNAL_CARD_THEMES[cardColor] || JOURNAL_CARD_THEMES.default;
  const hasCover = Boolean(coverStoragePath || coverUrl);

  const persistAppearance = (overrides?: {
    nextColor?: JournalCardColorKey;
    nextCoverUrl?: string;
    nextCoverStoragePath?: string;
    nextCoverFrame?: ImageFrameSpec;
    closeAfter?: boolean;
  }) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const finalColor = overrides?.nextColor ?? cardColor;
    const finalUrl = overrides?.nextCoverUrl ?? coverUrl;
    const finalPath = overrides?.nextCoverStoragePath ?? coverStoragePath;
    const finalFrame = overrides?.nextCoverFrame ?? coverFrame;

    const record: DailyJournalRecord = {
      ...(existingRecord || {}),
      dateKey,
      reflectionText: existingRecord?.reflectionText || '',
      highlightsText: existingRecord?.highlightsText || '',
      cardColor: finalColor,
      coverImageUrl: finalUrl,
      coverImageStoragePath: finalPath,
      coverFrame: finalPath || finalUrl ? finalFrame : undefined,
      updatedAtMs: Date.now(),
    };

    onSaveDailyJournal(record);
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1800);
    if (overrides?.closeAfter) {
      onClose();
    }
  };

  const handleUploadNewCover = async (file: File) => {
    if (!canEdit) return onRequireAuth();
    const check = validateImageFileForUpload(file);
    if (!check.valid) {
      setUploadErr(check.error || 'ملف الصورة غير صالح.');
      return;
    }
    setUploadErr(null);
    setUploadingCover(true);
    try {
      const oldDedicatedPath =
        coverStoragePath && coverStoragePath.includes('/images/journal_cover_')
          ? coverStoragePath
          : '';
      const res = await uploadJournalCoverImage(dateKey, file, uid);
      if (oldDedicatedPath && oldDedicatedPath !== res.imageStoragePath) {
        void deleteJournalCoverStorage(oldDedicatedPath);
      }
      const nextUrl = res.imageUrl || res.localObjectUrl || '';
      const nextPath = res.imageStoragePath || '';
      setCoverUrl(nextUrl);
      setCoverStoragePath(nextPath);
      // Persist immediately after successful upload so storage path and DB row stay synchronized
      persistAppearance({
        nextCoverUrl: nextUrl,
        nextCoverStoragePath: nextPath,
      });
    } catch (err) {
      setUploadErr(
        err instanceof Error ? err.message : 'تعذر رفع صورة الغلاف حاليًا.'
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    if (!canEdit) return onRequireAuth();
    if (coverStoragePath && coverStoragePath.includes('/images/journal_cover_')) {
      void deleteJournalCoverStorage(coverStoragePath);
    }
    setCoverUrl('');
    setCoverStoragePath('');
    setCoverFrame(DEFAULT_JOURNAL_CARD_COVER_FRAME);
  };

  const handleResetDefault = () => {
    if (!canEdit) return onRequireAuth();
    if (coverStoragePath && coverStoragePath.includes('/images/journal_cover_')) {
      void deleteJournalCoverStorage(coverStoragePath);
    }
    setCardColor('default');
    setCoverUrl('');
    setCoverStoragePath('');
    setCoverFrame(DEFAULT_JOURNAL_CARD_COVER_FRAME);
  };

  const shortDate = formatShortArabicDate(dateKey);
  const dayArabic = getDayArabicName(dateKey);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تخصيص بطاقة يومية ${shortDate}`}
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#F0F4F9] text-[#1E3A5F] shrink-0">
              <Palette className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-editorial text-lg font-bold text-slate-900 truncate">
                تخصيص مظهر بطاقة {shortDate}
              </h3>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {dayArabic} · اختر لون الخلفية وصورة الغلاف واحفظهما لبطاقة المعرض
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto thin-scrollbar p-5 space-y-6 bg-[#F7F8FA]">
          {/* Live Card Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                معاينة مباشرة لشكل الكارت في المعرض
              </span>
              <button
                type="button"
                onClick={handleResetDefault}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#1E3A5F] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>استعادة الافتراضي</span>
              </button>
            </div>

            <div className="max-w-[270px] mx-auto">
              <div
                data-custom-card-surface={cardColor !== 'default' ? 'light' : undefined}
                className={`rounded-2xl border overflow-hidden flex flex-col justify-between min-h-[210px] shadow-xs transition-colors ${activeTheme.cardClass}`}
              >
                <div>
                  {hasCover && resolvedPreviewCover && !coverLoadFailed && (
                    <div className="relative h-28 w-full overflow-hidden border-b border-black/5 bg-slate-100">
                      <img
                        src={resolvedPreviewCover}
                        alt={previewTitle || shortDate}
                        referrerPolicy="no-referrer"
                        onError={() => void handleImgError()}
                        style={{
                          objectFit: coverFrame.fitMode,
                          objectPosition: `${coverFrame.offsetX}% ${coverFrame.offsetY}%`,
                          transform:
                            coverFrame.zoom !== 1
                              ? `scale(${coverFrame.zoom})`
                              : undefined,
                          transformOrigin:
                            coverFrame.fitMode === 'contain' &&
                            coverFrame.zoom < 1
                              ? '50% 50%'
                              : `${coverFrame.offsetX}% ${coverFrame.offsetY}%`,
                        }}
                        className="w-full h-full"
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-1.5 text-right">
                    <p className="text-[11px] font-semibold text-slate-600 tabular-nums">
                      <span className="text-slate-900 font-bold">
                        {shortDate}
                      </span>{' '}
                      · {dayArabic}
                    </p>
                    <p className="font-editorial text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                      {previewTitle || `يومية ${shortDate}`}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {previewExcerpt ||
                        'مساحة مهيأة للتدوين، الصور، والملاحظات الشخصية.'}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-2.5 border-t border-black/5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{activeTheme.label}</span>
                  <span className="font-semibold text-[#1E3A5F]">فتح</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Background Color Palette */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                1. لوحة ألوان خلفية البطاقة
              </h4>
              <span className="text-[11px] text-slate-500">
                {activeTheme.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                Object.keys(JOURNAL_CARD_THEMES) as JournalCardColorKey[]
              ).map((colorKey) => {
                const t = JOURNAL_CARD_THEMES[colorKey];
                const isSelected = cardColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => {
                      if (!canEdit) return onRequireAuth();
                      setCardColor(colorKey);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#1E3A5F] bg-[#F3F7FB] ring-2 ring-[#1E3A5F]/15 font-bold text-slate-900'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center ${t.swatchClass}`}
                    >
                      {isSelected && (
                        <Check
                          className="w-3 h-3 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="text-xs truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Cover Image Selection & Cropping */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                2. صورة الغلاف (Cover Image)
              </h4>
              {hasCover && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFrameEditorOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] rounded-lg cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>ضبط الفريم والقص</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إزالة</span>
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadNewCover(file);
                e.target.value = '';
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploadingCover}
                onClick={() => {
                  if (!canEdit) return onRequireAuth();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer disabled:opacity-50"
              >
                {uploadingCover ? (
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {uploadingCover
                    ? 'جاري رفع الغلاف...'
                    : hasCover
                    ? 'رفع صورة غلاف بديلة'
                    : 'رفع صورة غلاف من الجهاز'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowGalleryPicker((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                  showGalleryPicker
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Images className="w-3.5 h-3.5" aria-hidden="true" />
                <span>اختيار من معرض الصور</span>
              </button>
            </div>

            {uploadErr && (
              <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {uploadErr}
              </p>
            )}

            {/* Quick pick from this day's own photos */}
            {dayPhotos.length > 0 && (
              <div className="pt-2 space-y-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>أو اختر من صور هذا اليوم ({dayPhotos.length})</span>
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                  {dayPhotos.map((p) => (
                    <GalleryPhotoThumb
                      key={p.id}
                      record={p}
                      selected={
                        Boolean(p.storagePath) &&
                        p.storagePath === coverStoragePath
                      }
                      onSelect={(url, sp) => {
                        if (!canEdit) return onRequireAuth();
                        setCoverUrl(url);
                        setCoverStoragePath(sp || '');
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Optional Main Gallery Picker */}
            {showGalleryPicker && (
              <div className="pt-2 space-y-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  صور من معرض الصور الرئيسي
                </span>
                {loadingGallery ? (
                  <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
                    <span>جاري تحميل صور المعرض...</span>
                  </div>
                ) : galleryItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    لا توجد صور محفوظة في معرض الصور الرئيسي حاليًا.
                  </p>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-44 overflow-y-auto thin-scrollbar p-0.5">
                    {galleryItems.map((img) => (
                      <GalleryPhotoThumb
                        key={img.id}
                        record={img}
                        selected={
                          Boolean(img.storagePath) &&
                          img.storagePath === coverStoragePath
                        }
                        onSelect={(url, sp) => {
                          if (!canEdit) return onRequireAuth();
                          setCoverUrl(url);
                          setCoverStoragePath(sp || '');
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFullDay(dateKey);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>فتح صفحة اليوم الكاملة</span>
          </button>

          <div className="flex items-center gap-2">
            {savedFeedback && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>تم الحفظ</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => persistAppearance({ closeAfter: true })}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حفظ المظهر في قاعدة البيانات</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Interactive Cover Frame / Crop Editor */}
      {hasCover && (
        <ImageFrameEditorModal
          open={frameEditorOpen}
          srcUrl={coverUrl}
          storagePath={coverStoragePath}
          title="ضبط إطار وقص صورة غلاف البطاقة"
          initialFrame={coverFrame}
          defaultFrame={DEFAULT_JOURNAL_CARD_COVER_FRAME}
          onSave={(nextFrame) => {
            setCoverFrame(nextFrame);
            setFrameEditorOpen(false);
          }}
          onClose={() => setFrameEditorOpen(false)}
        />
      )}
    </div>
  );
}
