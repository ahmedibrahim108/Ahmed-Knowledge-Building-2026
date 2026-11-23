import { useEffect, useRef, useState } from 'react';
import {
  Crop,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DEFAULT_IMAGE_FRAME_SPEC,
  ImageDisplaySize,
  ImageFrameAspect,
  ImageFrameSpec,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import { resolveStorageImageUrl } from '../utils/imageStorage';

export function useResolvedImageSrc(srcUrl?: string, storagePath?: string) {
  const [resolvedUrl, setResolvedUrl] = useState<string>(srcUrl || '');
  const [loadFailed, setLoadFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const fallbackTriedRef = useRef(false);

  useEffect(() => {
    fallbackTriedRef.current = false;
    setLoadFailed(false);
    setResolvedUrl(srcUrl || '');
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!srcUrl && storagePath) {
      let active = true;
      void resolveStorageImageUrl(storagePath).then((res) => {
        if (!active || !res) return;
        if (res.isObjectUrl) objectUrlRef.current = res.url;
        setResolvedUrl(res.url);
      });
      return () => {
        active = false;
      };
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [srcUrl, storagePath]);

  const handleImgError = async () => {
    if (fallbackTriedRef.current || !storagePath) {
      setLoadFailed(true);
      return;
    }
    fallbackTriedRef.current = true;
    const res = await resolveStorageImageUrl(storagePath);
    if (res && res.url !== resolvedUrl) {
      if (res.isObjectUrl) {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = res.url;
      }
      setResolvedUrl(res.url);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  };

  return { resolvedUrl, loadFailed, handleImgError };
}

const SIZE_HEIGHT_MAP: Record<ImageDisplaySize, number> = {
  xs: 120,
  sm: 165,
  md: 225,
  lg: 300,
  full: 375,
};

interface FramedImageProps {
  srcUrl?: string;
  storagePath?: string;
  frame?: ImageFrameSpec;
  defaultFrame?: ImageFrameSpec;
  alt: string;
  mode?: 'gallery' | 'card' | 'modal';
  fillParent?: boolean;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function FramedImage({
  srcUrl,
  storagePath,
  frame,
  defaultFrame = DEFAULT_IMAGE_FRAME_SPEC,
  alt,
  mode = 'gallery',
  fillParent = false,
  className = '',
  onClick,
  children,
}: FramedImageProps) {
  const safeFrame = sanitizeImageFrameSpec(frame, defaultFrame);
  const { resolvedUrl, loadFailed, handleImgError } = useResolvedImageSrc(
    srcUrl,
    storagePath
  );

  const containerStyle: React.CSSProperties = {};
  if (safeFrame.customHeightPx) {
    containerStyle.height =
      mode === 'card'
        ? `${Math.min(300, safeFrame.customHeightPx)}px`
        : `${safeFrame.customHeightPx}px`;
  } else if (fillParent && safeFrame.aspect === 'auto') {
    // Stretch naturally to parent layout container without forced pixel height
  } else if (safeFrame.aspect !== 'auto' && mode !== 'gallery') {
    containerStyle.aspectRatio = safeFrame.aspect.replace(':', ' / ');
  } else if (mode === 'gallery') {
    if (safeFrame.aspect !== 'auto' && safeFrame.sizePreset === 'md') {
      containerStyle.aspectRatio = safeFrame.aspect.replace(':', ' / ');
    } else {
      containerStyle.height = `${SIZE_HEIGHT_MAP[safeFrame.sizePreset]}px`;
    }
  } else {
    containerStyle.height = `${SIZE_HEIGHT_MAP[safeFrame.sizePreset]}px`;
  }

  const originStr =
    safeFrame.fitMode === 'contain' && safeFrame.zoom < 1
      ? '50% 50%'
      : `${safeFrame.offsetX}% ${safeFrame.offsetY}%`;

  return (
    <div
      onClick={onClick}
      style={containerStyle}
      className={`relative w-full ${
        fillParent && !safeFrame.customHeightPx && safeFrame.aspect === 'auto'
          ? 'h-full min-h-[220px]'
          : ''
      } overflow-hidden bg-slate-100/80 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {!resolvedUrl || loadFailed ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 p-3">
          <ImageIcon className="w-5 h-5" aria-hidden="true" />
          <span className="text-[11px]">تعذّر تحميل الصورة</span>
        </div>
      ) : (
        <img
          src={resolvedUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => void handleImgError()}
          draggable={false}
          style={{
            objectFit: safeFrame.fitMode,
            objectPosition: `${safeFrame.offsetX}% ${safeFrame.offsetY}%`,
            transform:
              safeFrame.zoom !== 1 ? `scale(${safeFrame.zoom})` : undefined,
            transformOrigin: originStr,
          }}
          className="w-full h-full select-none transition-transform duration-150"
        />
      )}
      {children}
    </div>
  );
}

const ASPECT_OPTIONS: Array<{ id: ImageFrameAspect; label: string }> = [
  { id: '21:9', label: 'شريط 21:9' },
  { id: '16:9', label: 'أفقي 16:9' },
  { id: '4:3', label: 'بطاقة 4:3' },
  { id: '1:1', label: 'مربع 1:1' },
  { id: '3:4', label: 'طولي 3:4' },
  { id: 'auto', label: 'تلقائي' },
];

const SIZE_PRESET_OPTIONS: Array<{ id: ImageDisplaySize; label: string }> = [
  { id: 'xs', label: 'صغير جدًا' },
  { id: 'sm', label: 'صغير' },
  { id: 'md', label: 'متوسط' },
  { id: 'lg', label: 'كبير' },
  { id: 'full', label: 'عريض كامل' },
];

interface ImageFrameEditorModalProps {
  open: boolean;
  srcUrl?: string;
  storagePath?: string;
  title?: string;
  initialFrame?: ImageFrameSpec;
  defaultFrame?: ImageFrameSpec;
  onSave: (nextFrame: ImageFrameSpec) => void;
  onClose: () => void;
}

export function ImageFrameEditorModal({
  open,
  srcUrl,
  storagePath,
  title = 'ضبط الفريم وحجم الصورة',
  initialFrame,
  defaultFrame = DEFAULT_IMAGE_FRAME_SPEC,
  onSave,
  onClose,
}: ImageFrameEditorModalProps) {
  const [draft, setDraft] = useState<ImageFrameSpec>(() =>
    sanitizeImageFrameSpec(initialFrame, defaultFrame)
  );
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const frameBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(sanitizeImageFrameSpec(initialFrame, defaultFrame));
    }
  }, [open, initialFrame, defaultFrame]);

  const { resolvedUrl, loadFailed, handleImgError } = useResolvedImageSrc(
    srcUrl,
    storagePath
  );

  if (!open) return null;

  const previewStyle: React.CSSProperties = draft.customHeightPx
    ? { height: `${Math.min(340, draft.customHeightPx)}px` }
    : draft.aspect !== 'auto'
    ? {
        aspectRatio: draft.aspect.replace(':', ' / '),
        maxHeight: '340px',
      }
    : { height: `${Math.min(340, SIZE_HEIGHT_MAP[draft.sizePreset])}px` };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: draft.offsetX,
      offsetY: draft.offsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const rect = frameBoxRef.current?.getBoundingClientRect();
    const width = Math.max(120, rect?.width ?? 320);
    const height = Math.max(100, rect?.height ?? 200);
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    const sensitivity = Math.max(0.85, 1.4 / Math.max(0.7, draft.zoom));
    const nextX = Math.max(
      0,
      Math.min(100, dragStartRef.current.offsetX - (dx / width) * 100 * sensitivity)
    );
    const nextY = Math.max(
      0,
      Math.min(100, dragStartRef.current.offsetY - (dy / height) * 100 * sensitivity)
    );
    setDraft((prev) => ({
      ...prev,
      offsetX: Math.round(nextX * 10) / 10,
      offsetY: Math.round(nextY * 10) / 10,
    }));
  };

  const handlePointerUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const originStr =
    draft.fitMode === 'contain' && draft.zoom < 1
      ? '50% 50%'
      : `${draft.offsetX}% ${draft.offsetY}%`;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Crop className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Interactive Live Frame Preview */}
          <div className="bg-slate-900/5 border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col items-center gap-2">
            <div className="w-full flex items-center justify-between text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-[#1E3A5F]">
                <Move className="w-3.5 h-3.5" aria-hidden="true" />
                <span>اسحب الصورة داخل الإطار لتحديد الجزء المعروض</span>
              </span>
              <span className="tabular-nums">
                {Math.round(draft.zoom * 100)}% · ({Math.round(draft.offsetX)}%,{' '}
                {Math.round(draft.offsetY)}%)
              </span>
            </div>

            <div
              ref={frameBoxRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={previewStyle}
              className={`relative w-full max-w-lg mx-auto overflow-hidden rounded-xl border-2 border-[#1E3A5F]/60 bg-slate-100 select-none touch-none ${
                dragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {!resolvedUrl || loadFailed ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                  تعذّر تحميل معاينة الصورة
                </div>
              ) : (
                <img
                  src={resolvedUrl}
                  alt="معاينة التأطير"
                  referrerPolicy="no-referrer"
                  onError={() => void handleImgError()}
                  draggable={false}
                  style={{
                    objectFit: draft.fitMode,
                    objectPosition: `${draft.offsetX}% ${draft.offsetY}%`,
                    transform:
                      draft.zoom !== 1 ? `scale(${draft.zoom})` : undefined,
                    transformOrigin: originStr,
                  }}
                  className="w-full h-full pointer-events-none select-none"
                />
              )}

              {/* Subtle 3x3 framing guide overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
              >
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="border border-white/25" />
                ))}
              </div>
            </div>
          </div>

          {/* 1. Display Mode: Specific Framed Area vs Scaled Full Photo */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700">طريقة العرض:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((p) => ({
                    ...p,
                    fitMode: 'cover',
                    zoom: Math.max(1, p.zoom),
                  }))
                }
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                  draft.fitMode === 'cover'
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Crop className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تأطير وقص (عرض جزء محدد فقط)</span>
              </button>
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, fitMode: 'contain' }))}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                  draft.fitMode === 'contain'
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>كامل الصورة (تصغير أو تكبير حر)</span>
              </button>
            </div>
          </div>

          {/* 2. Zoom / Scale Control */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700">
                تكبير وتصغير الصورة داخل الإطار
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      zoom: Math.max(
                        p.fitMode === 'contain' ? 0.4 : 1,
                        Math.round((p.zoom - 0.1) * 100) / 100
                      ),
                    }))
                  }
                  className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-slate-700" />
                </button>
                <span className="min-w-[46px] text-center font-bold tabular-nums text-[#1E3A5F]">
                  {Math.round(draft.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      zoom: Math.min(3, Math.round((p.zoom + 0.1) * 100) / 100),
                    }))
                  }
                  className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      zoom: 1,
                      offsetX: 50,
                      offsetY: 50,
                    }))
                  }
                  className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  توسيط 100%
                </button>
              </div>
            </div>
            <input
              type="range"
              min={draft.fitMode === 'contain' ? 40 : 100}
              max={300}
              step={5}
              value={Math.round(draft.zoom * 100)}
              onChange={(e) =>
                setDraft((p) => ({ ...p, zoom: Number(e.target.value) / 100 }))
              }
              className="w-full accent-[#1E3A5F] cursor-pointer"
            />
          </div>

          {/* 3. Frame Aspect Ratio & Card Display Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700">نسبة الإطار (الفريم):</p>
              <div className="flex flex-wrap gap-1.5">
                {ASPECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        aspect: opt.id,
                        customHeightPx: undefined,
                      }))
                    }
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border cursor-pointer ${
                      draft.aspect === opt.id && !draft.customHeightPx
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700">حجم العرض:</p>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        sizePreset: opt.id,
                        customHeightPx: undefined,
                      }))
                    }
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border cursor-pointer ${
                      draft.sizePreset === opt.id && !draft.customHeightPx
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Exact Custom Height Resize Slider */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                <Maximize2 className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>ارتفاع الفريم الدقيق (px)</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold tabular-nums text-[#1E3A5F]">
                  {draft.customHeightPx
                    ? `${draft.customHeightPx}px`
                    : `تلقائي (${SIZE_HEIGHT_MAP[draft.sizePreset]}px)`}
                </span>
                {draft.customHeightPx && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({ ...p, customHeightPx: undefined }))
                    }
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    تلقائي
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={90}
              max={460}
              step={10}
              value={draft.customHeightPx ?? SIZE_HEIGHT_MAP[draft.sizePreset]}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  customHeightPx: Number(e.target.value),
                }))
              }
              className="w-full accent-[#1E3A5F] cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDraft({ ...defaultFrame })}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>الوضع الافتراضي</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(sanitizeImageFrameSpec(draft, defaultFrame));
                onClose();
              }}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              حفظ الإطار والمقاس
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
