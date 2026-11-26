import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crop,
  Edit3,
  Feather,
  FolderPlus,
  Globe,
  ImagePlus,
  Images,
  Lock,
  Palette,
  Pin,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_REFLECTION_CATEGORIES,
  DEFAULT_REFLECTION_IMAGE_FRAME,
  ImageFrameSpec,
  PersonalReflection,
  REFLECTION_COLOR_PALETTE,
  ReflectionColorKey,
  ReflectionMood,
  VoiceDialectMode,
  getReflectionCardStyle,
  resolveReflectionColorKey,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import {
  SavedAudioClipSummary,
  subscribeUserAudioClips,
} from '../utils/audioCache';
import {
  deleteReflectionImageStorage,
  getImagesForScope,
  isImageFile,
  uploadReflectionImage,
} from '../utils/imageStorage';
import {
  resolveEffectiveStorageProvider,
  type StorageProvider,
} from '../services/storageService';
import AutoResizeTextarea from './AutoResizeTextarea';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import { FramedImage, ImageFrameEditorModal } from './FramedImage';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import { MAIN_GALLERY_SCOPE_KEY } from './PhotoGalleryView';
import ReflectionAudioPlayer from './ReflectionAudioPlayer';
import VoiceRecorderButton from './VoiceRecorderButton';

interface ReflectionsViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  reflections: PersonalReflection[];
  reflectionCategories?: string[];
  publicReflectionCategories?: string[];
  voiceDialect: VoiceDialectMode;
  onAddReflection: (payload: {
    id?: string;
    title: string;
    content: string;
    moodTag: ReflectionMood;
    categoryTag?: string;
    colorKey?: ReflectionColorKey;
    isPublic?: boolean;
    imageUrl?: string;
    imageStoragePath?: string;
    imageFrame?: ImageFrameSpec;
  }) => void;
  onUpdateReflection: (id: string, updates: Partial<PersonalReflection>) => void;
  onDeleteReflection: (id: string) => void;
  onSaveCategories: (next: string[]) => void;
  onTogglePublicCategory?: (category: string, makePublic: boolean) => void;
  externalFocusReflectionId?: string | null;
  onConsumeExternalFocusReflectionId?: () => void;
}

const MOOD_OPTIONS: ReflectionMood[] = ['تأمل', 'فكرة', 'امتنان', 'هدف'];
type ReflectionSortMode = 'pinned_newest' | 'newest' | 'oldest' | 'title';

export default function ReflectionsView({
  uid,
  canEdit,
  onRequireAuth,
  reflections,
  reflectionCategories,
  publicReflectionCategories = [],
  voiceDialect,
  onAddReflection,
  onUpdateReflection,
  onDeleteReflection,
  onSaveCategories,
  onTogglePublicCategory,
  externalFocusReflectionId,
  onConsumeExternalFocusReflectionId,
}: ReflectionsViewProps) {
  const categories = useMemo(() => {
    const base =
      reflectionCategories && reflectionCategories.length > 0
        ? reflectionCategories
        : DEFAULT_REFLECTION_CATEGORIES;
    const extras = reflections
      .map((r) => (r.categoryTag || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...base, ...extras]));
  }, [reflectionCategories, reflections]);

  const publicCatSet = useMemo(
    () => new Set(publicReflectionCategories.filter(Boolean)),
    [publicReflectionCategories]
  );

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraftId, setComposerDraftId] = useState(
    () => `refl-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  );
  const [composerVoiceClip, setComposerVoiceClip] = useState<{
    cacheId: string;
    durationSeconds: number;
  } | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodTag, setMoodTag] = useState<ReflectionMood>('تأمل');
  const [categoryTag, setCategoryTag] = useState<string>(categories[0] || '');
  const [composerColorKey, setComposerColorKey] = useState<ReflectionColorKey>('auto');
  const [composerIsPublic, setComposerIsPublic] = useState(false);
  const [composerImageUrl, setComposerImageUrl] = useState('');
  const [composerImageStoragePath, setComposerImageStoragePath] = useState('');
  const [composerImageStorageProvider, setComposerImageStorageProvider] =
    useState<StorageProvider | undefined>(undefined);
  const [composerImageFrame, setComposerImageFrame] = useState<ImageFrameSpec>(
    DEFAULT_REFLECTION_IMAGE_FRAME
  );
  const [uploadingComposerImg, setUploadingComposerImg] = useState(false);
  const [composerImgErr, setComposerImgErr] = useState<string | null>(null);
  const composerFileRef = useRef<HTMLInputElement | null>(null);
  const [reflectionAudioMap, setReflectionAudioMap] = useState<
    Record<string, SavedAudioClipSummary[]>
  >({});

  useEffect(() => {
    const unsubscribe = subscribeUserAudioClips(uid, (clips) => {
      const grouped: Record<string, SavedAudioClipSummary[]> = {};
      for (const clip of clips) {
        if (clip.entityId && clip.entityId.startsWith('reflection:')) {
          const reflId = clip.entityId.slice('reflection:'.length);
          if (!grouped[reflId]) grouped[reflId] = [];
          grouped[reflId].push(clip);
        }
      }
      setReflectionAudioMap(grouped);
    });
    return () => unsubscribe();
  }, [uid]);

  // Gallery Picker helper state
  const [galleryPickerTarget, setGalleryPickerTarget] = useState<
    'composer' | 'modal' | null
  >(null);
  const [galleryPickerItems, setGalleryPickerItems] = useState<
    Array<{ id: string; name: string; url: string; storagePath?: string }>
  >([]);
  const [loadingGalleryPicker, setLoadingGalleryPicker] = useState(false);

  // Interactive Frame/Crop Editor state
  const [frameEditorState, setFrameEditorState] = useState<{
    mode: 'composer' | 'modal_edit' | 'direct_reflection';
    reflectionId?: string;
    srcUrl?: string;
    storagePath?: string;
    frame: ImageFrameSpec;
  } | null>(null);

  // Category manager
  const [newCategoryName, setNewCategoryName] = useState('');
  const [managingCats, setManagingCats] = useState(false);

  // Filters & sort
  const [searchQuery, setSearchQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState<ReflectionMood | 'all'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [publicOnly, setPublicOnly] = useState(false);
  const [sortMode, setSortMode] = useState<ReflectionSortMode>('pinned_newest');

  // Focused reader / editor modal
  const [activeReflectionId, setActiveReflectionId] = useState<string | null>(null);
  const [modalEditing, setModalEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMood, setEditMood] = useState<ReflectionMood>('تأمل');
  const [editCategory, setEditCategory] = useState('');
  const [editColorKey, setEditColorKey] = useState<ReflectionColorKey>('auto');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImageStoragePath, setEditImageStoragePath] = useState('');
  const [editImageStorageProvider, setEditImageStorageProvider] = useState<
    StorageProvider | undefined
  >(undefined);
  const [editImageFrame, setEditImageFrame] = useState<ImageFrameSpec>(
    DEFAULT_REFLECTION_IMAGE_FRAME
  );
  const [uploadingModalImg, setUploadingModalImg] = useState(false);
  const modalFileRef = useRef<HTMLInputElement | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PersonalReflection | null>(null);

  useEffect(() => {
    if (!externalFocusReflectionId) return;
    setActiveReflectionId(externalFocusReflectionId);
    setModalEditing(false);
    onConsumeExternalFocusReflectionId?.();
  }, [externalFocusReflectionId, onConsumeExternalFocusReflectionId]);

  useEffect(() => {
    if (!galleryPickerTarget) return;
    let active = true;
    setLoadingGalleryPicker(true);
    void getImagesForScope(MAIN_GALLERY_SCOPE_KEY, uid)
      .then((records) => {
        if (!active) return;
        const mapped = records
          .map((rec) => ({
            id: rec.id,
            name: rec.caption || rec.name,
            url: rec.downloadUrl || rec.dataUrl || '',
            storagePath: rec.storagePath,
          }))
          .filter((i) => Boolean(i.url) || Boolean(i.storagePath));
        setGalleryPickerItems(mapped);
      })
      .finally(() => {
        if (active) setLoadingGalleryPicker(false);
      });
    return () => {
      active = false;
    };
  }, [galleryPickerTarget, uid]);

  const handleUploadComposerImage = async (file: File) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    if (!isImageFile(file)) {
      setComposerImgErr('يرجى اختيار ملف صورة صالح.');
      return;
    }
    setUploadingComposerImg(true);
    setComposerImgErr(null);
    try {
      const tempId = `new_${Date.now()}`;
      const res = await uploadReflectionImage(tempId, file, uid);
      setComposerImageUrl(res.imageUrl || res.localObjectUrl);
      setComposerImageStoragePath(res.imageStoragePath);
      setComposerImageStorageProvider(res.imageStorageProvider);
      setComposerImageFrame(DEFAULT_REFLECTION_IMAGE_FRAME);
      setFrameEditorState({
        mode: 'composer',
        srcUrl: res.imageUrl || res.localObjectUrl,
        storagePath: res.imageStoragePath,
        frame: DEFAULT_REFLECTION_IMAGE_FRAME,
      });
    } catch {
      setComposerImgErr('تعذّر رفع الصورة، تأكد من الاتصال وحاول مجددًا.');
    } finally {
      setUploadingComposerImg(false);
    }
  };

  const handleUploadModalImage = async (file: File) => {
    if (!activeReflection || !canEdit || !isImageFile(file)) return;
    setUploadingModalImg(true);
    try {
      const oldPath = editImageStoragePath;
      const res = await uploadReflectionImage(activeReflection.id, file, uid);
      if (oldPath && oldPath !== res.imageStoragePath) {
        void deleteReflectionImageStorage(oldPath);
      }
      const nextFrame = sanitizeImageFrameSpec(
        editImageFrame,
        DEFAULT_REFLECTION_IMAGE_FRAME
      );
      setEditImageUrl(res.imageUrl || res.localObjectUrl);
      setEditImageStoragePath(res.imageStoragePath);
      setEditImageStorageProvider(res.imageStorageProvider);
      setEditImageFrame(nextFrame);
      setFrameEditorState({
        mode: 'modal_edit',
        srcUrl: res.imageUrl || res.localObjectUrl,
        storagePath: res.imageStoragePath,
        frame: nextFrame,
      });
    } finally {
      setUploadingModalImg(false);
    }
  };

  const isEffectivelyPublic = (r: PersonalReflection) =>
    Boolean(r.isPublic) || (Boolean(r.categoryTag) && publicCatSet.has(r.categoryTag!));

  const filteredReflections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reflections.filter((r) => {
      if (pinnedOnly && !r.pinned) return false;
      if (publicOnly && !isEffectivelyPublic(r)) return false;
      if (moodFilter !== 'all' && r.moodTag !== moodFilter) return false;
      if (catFilter !== 'all' && (r.categoryTag || '') !== catFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        (r.categoryTag || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'pinned_newest') {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      }
      if (sortMode === 'newest') {
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      }
      if (sortMode === 'oldest') {
        return (a.createdAtMs || 0) - (b.createdAtMs || 0);
      }
      return (a.title || '').localeCompare(b.title || '', 'ar');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflections, pinnedOnly, publicOnly, moodFilter, catFilter, searchQuery, sortMode, publicCatSet]);

  const activeReflection = useMemo(
    () => reflections.find((r) => r.id === activeReflectionId) ?? null,
    [reflections, activeReflectionId]
  );

  const openNewComposerModal = () => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setActiveReflectionId(null);
    setModalEditing(false);
    setComposerDraftId(`refl-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    setComposerVoiceClip(null);
    setComposerOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent && !composerVoiceClip) return;
    const durationLabel = composerVoiceClip
      ? `${Math.floor(composerVoiceClip.durationSeconds / 60)
          .toString()
          .padStart(2, '0')}:${Math.round(composerVoiceClip.durationSeconds % 60)
          .toString()
          .padStart(2, '0')}`
      : '';
    onAddReflection({
      id: composerDraftId,
      title:
        cleanTitle ||
        (composerVoiceClip ? `خاطرة صوتية (${durationLabel})` : 'خاطرة بلا عنوان'),
      content:
        cleanContent ||
        (composerVoiceClip
          ? `تسجيل صوتي (${durationLabel}) — اضغط للاستماع.`
          : ''),
      moodTag,
      categoryTag: categoryTag.trim(),
      colorKey: composerColorKey === 'auto' ? undefined : composerColorKey,
      isPublic: composerIsPublic,
      ...(composerImageUrl || composerImageStoragePath
        ? {
            imageUrl: composerImageUrl,
            imageStoragePath: composerImageStoragePath,
            imageStorageProvider: composerImageStorageProvider,
            imageFrame: composerImageFrame,
          }
        : {}),
    });
    setComposerDraftId(`refl-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    setComposerVoiceClip(null);
    setTitle('');
    setContent('');
    setMoodTag('تأمل');
    setComposerColorKey('auto');
    setComposerIsPublic(false);
    setComposerImageUrl('');
    setComposerImageStoragePath('');
    setComposerImageStorageProvider(undefined);
    setComposerImageFrame(DEFAULT_REFLECTION_IMAGE_FRAME);
    setComposerImgErr(null);
    setComposerOpen(false);
  };

  const openModalReader = (r: PersonalReflection, startInEdit = false) => {
    setActiveReflectionId(r.id);
    setEditTitle(r.title);
    setEditContent(r.content);
    setEditMood(r.moodTag);
    setEditCategory(r.categoryTag || '');
    setEditColorKey(r.colorKey || 'auto');
    setEditIsPublic(Boolean(r.isPublic));
    setEditImageUrl(r.imageUrl || '');
    setEditImageStoragePath(r.imageStoragePath || '');
    setEditImageStorageProvider(r.imageStorageProvider);
    setEditImageFrame(
      sanitizeImageFrameSpec(r.imageFrame, DEFAULT_REFLECTION_IMAGE_FRAME)
    );
    setModalEditing(startInEdit && canEdit);
  };

  const handleSaveModalEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReflection || !canEdit) return;
    if (
      activeReflection.imageStoragePath &&
      activeReflection.imageStoragePath !== editImageStoragePath &&
      !activeReflection.imageStoragePath.includes('gallery')
    ) {
      void deleteReflectionImageStorage(activeReflection.imageStoragePath);
    }
    onUpdateReflection(activeReflection.id, {
      title: editTitle.trim() || 'خاطرة بلا عنوان',
      content: editContent.trim(),
      moodTag: editMood,
      categoryTag: editCategory.trim(),
      colorKey: editColorKey === 'auto' ? undefined : editColorKey,
      isPublic: editIsPublic,
      imageUrl: editImageUrl,
      imageStoragePath: editImageStoragePath,
      imageStorageProvider: editImageStoragePath
        ? editImageStorageProvider
        : undefined,
      imageFrame:
        editImageUrl || editImageStoragePath ? editImageFrame : undefined,
    });
    setModalEditing(false);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = newCategoryName.trim();
    if (!clean || categories.includes(clean)) return;
    onSaveCategories([...categories, clean]);
    setCategoryTag(clean);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (cat: string) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const next = categories.filter((c) => c !== cat);
    onSaveCategories(next.length > 0 ? next : DEFAULT_REFLECTION_CATEGORIES);
    if (catFilter === cat) setCatFilter('all');
  };

  const renderPalettePicker = (
    currentKey: ReflectionColorKey,
    currentMood: ReflectionMood,
    onSelect: (k: ReflectionColorKey) => void
  ) => {
    const autoResolved = resolveReflectionColorKey({
      moodTag: currentMood,
      colorKey: 'auto',
    });
    const pickerOptions: Array<{
      key: ReflectionColorKey;
      label: string;
      swatchHex: string;
    }> = [
      {
        key: 'auto',
        label: 'تلقائي حسب النوع',
        swatchHex: REFLECTION_COLOR_PALETTE[autoResolved].swatchHex,
      },
      ...Object.values(REFLECTION_COLOR_PALETTE).map((entry) => ({
        key: entry.id as ReflectionColorKey,
        label: entry.label,
        swatchHex: entry.swatchHex,
      })),
    ];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 ml-1">
          <Palette className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>لون البطاقة:</span>
        </span>
        {pickerOptions.map((p) => {
          const selected = currentKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(p.key)}
              title={p.label}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border cursor-pointer transition-all ${
                selected
                  ? 'border-[#1E3A5F] bg-white font-bold text-[#1E3A5F] shadow-2xs'
                  : 'border-slate-200 bg-white/75 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                style={{ backgroundColor: p.swatchHex }}
                aria-hidden="true"
              />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const composerStyle = getReflectionCardStyle({
    moodTag,
    colorKey: composerColorKey,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Feather className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              خواطري وتأملاتي
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            بطاقات هادئة بألوان مميزة للامتنان والتأملات والأفكار، مع إمكانية نشر خاطرة أو تصنيف كامل للموقع العام.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setManagingCats((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>إدارة التصنيفات والنشر ({categories.length})</span>
          </button>
          <button
            type="button"
            onClick={openNewComposerModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>تدوين خاطرة جديدة</span>
          </button>
        </div>
      </div>

      {/* Category Manager + Per-Category Public Toggle */}
      {managingCats && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                التصنيفات والتحكم في نشرها للعامة
              </h2>
              <p className="text-[11px] text-slate-500">
                اضغط أيقونة الكرة الأرضية بجانب أي تصنيف لجعله ظاهرًا تلقائيًا في الواجهة العامة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManagingCats(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              إخفاء
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isCatPub = publicCatSet.has(cat);
              return (
                <div
                  key={cat}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg ${
                    isCatPub
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-[#F7F8FA] border-slate-200 text-slate-800'
                  }`}
                >
                  <span>{cat}</span>
                  {canEdit && onTogglePublicCategory && (
                    <button
                      type="button"
                      onClick={() => onTogglePublicCategory(cat, !isCatPub)}
                      title={
                        isCatPub
                          ? 'التصنيف منشور للعامة — اضغط لجعله خاصًا'
                          : 'تصنيف خاص — اضغط لنشره على الموقع العام'
                      }
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                        isCatPub
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:text-[#1E3A5F]'
                      }`}
                    >
                      {isCatPub ? (
                        <Globe className="w-2.5 h-2.5" aria-hidden="true" />
                      ) : (
                        <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                      )}
                      <span>{isCatPub ? 'عام' : 'خاص'}</span>
                    </button>
                  )}
                  {canEdit && categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      aria-label={`حذف تصنيف ${cat}`}
                      className="text-slate-400 hover:text-red-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {canEdit && (
            <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="أضف تصنيفًا جديدًا للخواطر..."
                className="flex-1 min-w-[220px] px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
              />
              <button
                type="submit"
                disabled={!newCategoryName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-45 rounded-lg cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة تصنيف</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Balanced Centered New Reflection Composer Pop-Up */}
      {composerOpen && (
        <div
          className="fixed inset-0 z-[72] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-reflection-popup-title"
          onClick={() => setComposerOpen(false)}
        >
          <div
            data-custom-card-surface="light"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[90dvh] flex flex-col border rounded-2xl shadow-2xl overflow-hidden transition-colors ${composerStyle.cardBg} ${composerStyle.cardBorder}`}
          >
            <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
              {/* Pop-Up Fixed Header */}
              <div className="px-4 sm:px-5 py-3.5 bg-white/80 border-b border-black/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <h2
                  id="new-reflection-popup-title"
                  className="text-base font-bold text-slate-900 inline-flex items-center gap-2"
                >
                  <Feather className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                  <span>خاطرة جديدة</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={composerIsPublic}
                      onChange={(e) => setComposerIsPublic(e.target.checked)}
                    />
                    <Globe className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>نشر للعامة</span>
                  </label>
                  <VoiceRecorderButton
                    dialect={voiceDialect}
                    label="تسجيل / إملاء"
                    onRequireAuth={onRequireAuth}
                    audioMeta={{
                      entityType: 'other',
                      entityId: `reflection:${composerDraftId}`,
                      title: title.trim() || 'خاطرة صوتية',
                    }}
                    onTranscript={(spoken) =>
                      setContent((prev) => (prev ? `${prev}\n${spoken}` : spoken))
                    }
                    onAudioRecorded={(info) => {
                      setComposerVoiceClip({
                        cacheId: info.cacheId,
                        durationSeconds: info.durationSeconds,
                      });
                      setReflectionAudioMap((prev) => {
                        const existing = prev[composerDraftId] || [];
                        if (existing.some((c) => c.id === info.cacheId)) return prev;
                        const clipEntry: SavedAudioClipSummary = {
                          id: info.cacheId,
                          title: title.trim() || 'خاطرة صوتية',
                          previewText: '',
                          entityType: 'other',
                          entityId: `reflection:${composerDraftId}`,
                          voiceName: 'Kore',
                          speed: 'normal',
                          mimeType: 'audio/webm',
                          sizeBytes: 0,
                          durationSeconds: info.durationSeconds,
                          lastPositionSeconds: 0,
                          playbackRate: 1,
                          updatedAtMs: Date.now(),
                        };
                        return {
                          ...prev,
                          [composerDraftId]: [clipEntry, ...existing],
                        };
                      });
                    }}
                    onAudioCleared={() => setComposerVoiceClip(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setComposerOpen(false)}
                    aria-label="إغلاق النافذة"
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pop-Up Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      العنوان
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="عنوان مختصر للفكرة..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      النوع الشعوري
                    </label>
                    <select
                      value={moodTag}
                      onChange={(e) => setMoodTag(e.target.value as ReflectionMood)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {MOOD_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      التصنيف الشخصي
                    </label>
                    <select
                      value={categoryTag}
                      onChange={(e) => setCategoryTag(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">بدون تصنيف محدد</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {renderPalettePicker(composerColorKey, moodTag, setComposerColorKey)}

                <div>
                  <AutoResizeTextarea
                    minRows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="اكتب بحرية... ما الفكرة أو الامتنان الذي استوقفك اليوم؟"
                    className="w-full px-3.5 py-3 text-sm leading-loose bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>

                {/* Framed Image Control in New Reflection Composer */}
                <div className="bg-white/80 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                      <Images className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                      <span>صورة داخل إطار مخصّص للخاطرة (اختياري)</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        ref={composerFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadComposerImage(f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingComposerImg}
                        onClick={() => composerFileRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{uploadingComposerImg ? 'جاري الرفع...' : 'رفع صورة'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGalleryPickerTarget('composer')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                      >
                        <Images className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>من معرض الصور</span>
                      </button>
                    </div>
                  </div>

                  {composerImgErr && (
                    <p className="text-[11px] text-red-700">{composerImgErr}</p>
                  )}

                  {(composerImageUrl || composerImageStoragePath) && (
                    <div className="space-y-2">
                      <FramedImage
                        srcUrl={composerImageUrl}
                        storagePath={composerImageStoragePath}
                        frame={composerImageFrame}
                        defaultFrame={DEFAULT_REFLECTION_IMAGE_FRAME}
                        alt="صورة الخاطرة"
                        mode="card"
                        className="rounded-lg border border-slate-200"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setFrameEditorState({
                              mode: 'composer',
                              srcUrl: composerImageUrl,
                              storagePath: composerImageStoragePath,
                              frame: composerImageFrame,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>تحديد الجزء المعروض وتغيير الحجم</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setComposerImageUrl('');
                            setComposerImageStoragePath('');
                          }}
                          className="inline-flex items-center gap-1 text-red-700 hover:underline cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>إزالة الصورة</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pop-Up Fixed Footer */}
              <div className="px-4 sm:px-5 py-3 bg-white/80 border-t border-black/5 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() && !content.trim() && !composerVoiceClip}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-45 rounded-lg cursor-pointer"
                >
                  حفظ الخاطرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Mood Filter Ribbon */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في الخواطر..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
            />
          </div>

          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="تصفية حسب التصنيف"
            className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as ReflectionSortMode)}
            aria-label="ترتيب الخواطر"
            className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
          >
            <option value="pinned_newest">المثبتة ثم الأحدث</option>
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
            <option value="title">أبجديًا</option>
          </select>

          <button
            type="button"
            onClick={() => setPinnedOnly((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
              pinnedOnly
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Pin className="w-3.5 h-3.5" aria-hidden="true" />
            <span>المثبتة</span>
          </button>

          <button
            type="button"
            onClick={() => setPublicOnly((v) => !v)}
            className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer ${
              publicOnly
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>المنشورة للعامة</span>
          </button>
        </div>

        {/* Mood Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setMoodFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
              moodFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({reflections.length})
          </button>
          {MOOD_OPTIONS.map((m) => {
            const count = reflections.filter((r) => r.moodTag === m).length;
            const style = getReflectionCardStyle({ moodTag: m });
            const active = moodFilter === m;
            return (
              <button
                key={m}
                type="button"
                data-custom-card-surface={!active ? 'light' : undefined}
                onClick={() => setMoodFilter(m)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  active
                    ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                    : `${style.cardBg} ${style.cardBorder} text-slate-800 hover:brightness-95`
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: active ? '#FFFFFF' : style.swatchHex }}
                  aria-hidden="true"
                />
                <span>
                  {m} ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Small-Card Grid */}
      {filteredReflections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            لا توجد خواطر مطابقة للبحث أو التصفية الحالية.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openNewComposerModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ابدأ بتدوين خاطرتك</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredReflections.map((r) => {
            const style = getReflectionCardStyle(r);
            const pubByCard = Boolean(r.isPublic);
            const pubByCat = Boolean(r.categoryTag && publicCatSet.has(r.categoryTag));
            const isPub = pubByCard || pubByCat;

            return (
              <article
                key={r.id}
                data-custom-card-surface="light"
                onClick={() => openModalReader(r, false)}
                className={`rounded-xl border overflow-hidden flex flex-col justify-between cursor-pointer transition-all hover:shadow-sm ${style.cardBg} ${
                  r.pinned ? 'ring-1 ring-[#1E3A5F]/35 ' + style.cardBorder : style.cardBorder
                }`}
              >
                {(r.imageUrl || r.imageStoragePath) && (
                  <FramedImage
                    srcUrl={r.imageUrl}
                    storagePath={r.imageStoragePath}
                    frame={r.imageFrame}
                    defaultFrame={DEFAULT_REFLECTION_IMAGE_FRAME}
                    alt={r.title}
                    mode="card"
                    className="border-b border-black/5"
                  />
                )}

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    {/* Quiet inline metadata (Zero-Pill Rule) */}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className={`font-semibold truncate ${style.accentText}`}>
                        {r.moodTag}
                        {r.categoryTag ? ` · ${r.categoryTag}` : ''}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPub && (
                          <Globe
                            className="w-3.5 h-3.5 text-emerald-700"
                            aria-label="منشورة على الموقع العام"
                          />
                        )}
                        {r.pinned && (
                          <Pin className={`w-3.5 h-3.5 ${style.accentText}`} aria-label="مثبتة" />
                        )}
                      </div>
                    </div>

                    <h3 className="font-editorial text-base font-bold text-slate-900 leading-snug line-clamp-1">
                      <BidiText text={r.title} />
                    </h3>

                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      <BidiText text={r.content} />
                    </p>
                    {(reflectionAudioMap[r.id]?.length ?? 0) > 0 && (
                      <ReflectionAudioPlayer
                        uid={uid}
                        clips={reflectionAudioMap[r.id]}
                        compact
                      />
                    )}
                  </div>

                  {/* Compact Footer Bar */}
                  <div
                    className="pt-2 border-t border-black/5 flex items-center justify-between gap-2 text-[11px] text-slate-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate tabular-nums">{r.createdAtLabel}</span>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        {(r.imageUrl || r.imageStoragePath) && (
                          <button
                            type="button"
                            onClick={() =>
                              setFrameEditorState({
                                mode: 'direct_reflection',
                                reflectionId: r.id,
                                srcUrl: r.imageUrl,
                                storagePath: r.imageStoragePath,
                                frame: sanitizeImageFrameSpec(
                                  r.imageFrame,
                                  DEFAULT_REFLECTION_IMAGE_FRAME
                                ),
                              })
                            }
                            title="تعديل جزء الصورة وحجم الفريم"
                            aria-label="تعديل جزء الصورة وحجم الفريم"
                            className="p-1 rounded text-slate-400 hover:text-[#1E3A5F] hover:bg-white/70 cursor-pointer"
                          >
                            <Crop className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateReflection(r.id, { isPublic: !r.isPublic })
                          }
                          title={
                            pubByCard
                              ? 'منشورة — اضغط لجعلها خاصة'
                              : pubByCat
                              ? 'تظهر تلقائيًا لأن تصنيفها عام'
                              : 'خاصة — اضغط لنشرها على الموقع العام'
                          }
                          className={`p-1 rounded hover:bg-white/70 cursor-pointer ${
                            isPub ? 'text-emerald-700' : 'text-slate-400 hover:text-[#1E3A5F]'
                          }`}
                        >
                          {isPub ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateReflection(r.id, { pinned: !r.pinned })}
                          aria-label={r.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                          className={`p-1 rounded hover:bg-white/70 cursor-pointer ${
                            r.pinned ? style.accentText : 'text-slate-400 hover:text-[#1E3A5F]'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openModalReader(r, true)}
                          aria-label="تعديل الخاطرة"
                          className="p-1 rounded text-slate-400 hover:text-[#1E3A5F] hover:bg-white/70 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          aria-label="حذف الخاطرة"
                          className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-white/70 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Calm Full Reader / Editor Modal */}
      {activeReflection && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setActiveReflectionId(null);
            setModalEditing(false);
          }}
        >
          {(() => {
            const modalStyle = getReflectionCardStyle({
              moodTag: modalEditing ? editMood : activeReflection.moodTag,
              colorKey: modalEditing ? editColorKey : activeReflection.colorKey,
            });
            const isPub = isEffectivelyPublic(activeReflection);
            return (
              <div
                data-custom-card-surface="light"
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-2xl max-h-[90dvh] flex flex-col border rounded-2xl shadow-2xl overflow-hidden ${modalStyle.cardBg} ${modalStyle.cardBorder}`}
              >
                <div className="px-5 py-3.5 bg-white/75 border-b border-black/5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className={`font-bold ${modalStyle.accentText}`}>
                      {activeReflection.moodTag}
                    </span>
                    {activeReflection.categoryTag && (
                      <>
                        <span>·</span>
                        <span>{activeReflection.categoryTag}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="tabular-nums">{activeReflection.createdAtLabel}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canEdit && !modalEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateReflection(activeReflection.id, {
                              isPublic: !activeReflection.isPublic,
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border cursor-pointer ${
                            isPub
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {isPub ? (
                            <Globe className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <Lock className="w-3 h-3" aria-hidden="true" />
                          )}
                          <span>{isPub ? 'منشور للعامة' : 'خاص'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openModalReader(activeReflection, true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" aria-hidden="true" />
                          <span>تعديل</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReflectionId(null);
                        setModalEditing(false);
                      }}
                      aria-label="إغلاق"
                      className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                  {modalEditing ? (
                    <form onSubmit={handleSaveModalEdit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="px-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-lg"
                        />
                        <select
                          value={editMood}
                          onChange={(e) => setEditMood(e.target.value as ReflectionMood)}
                          className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          {MOOD_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="">بدون تصنيف</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {renderPalettePicker(editColorKey, editMood, setEditColorKey)}

                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsPublic}
                          onChange={(e) => setEditIsPublic(e.target.checked)}
                        />
                        <span>نشر هذه الخاطرة على الموقع العام</span>
                      </label>

                      {/* Modal Edit Image & Frame Controls */}
                      <div className="bg-white/85 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                            <Images className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                            <span>صورة الخاطرة وضبط الفريم</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              ref={modalFileRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleUploadModalImage(f);
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              disabled={uploadingModalImg}
                              onClick={() => modalFileRef.current?.click()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                            >
                              <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{uploadingModalImg ? 'جاري الرفع...' : 'رفع صورة جديدة'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setGalleryPickerTarget('modal')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                            >
                              <Images className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>من معرض الصور</span>
                            </button>
                          </div>
                        </div>

                        {(editImageUrl || editImageStoragePath) && (
                          <div className="space-y-2">
                            <FramedImage
                              srcUrl={editImageUrl}
                              storagePath={editImageStoragePath}
                              frame={editImageFrame}
                              defaultFrame={DEFAULT_REFLECTION_IMAGE_FRAME}
                              alt="معاينة الصورة"
                              mode="modal"
                              className="rounded-lg border border-slate-200"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() =>
                                  setFrameEditorState({
                                    mode: 'modal_edit',
                                    srcUrl: editImageUrl,
                                    storagePath: editImageStoragePath,
                                    frame: editImageFrame,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                              >
                                <Crop className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>ضبط الجزء المعروض وحجم الفريم</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditImageUrl('');
                                  setEditImageStoragePath('');
                                }}
                                className="inline-flex items-center gap-1 text-red-700 hover:underline cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                <span>حذف الصورة</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          محتوى الخاطرة
                        </span>
                        <VoiceRecorderButton
                          dialect={voiceDialect}
                          label="إضافة تسجيل / إملاء"
                          onRequireAuth={onRequireAuth}
                          audioMeta={{
                            entityType: 'other',
                            entityId: `reflection:${activeReflection.id}`,
                            title: editTitle.trim() || activeReflection.title,
                          }}
                          onTranscript={(spoken) =>
                            setEditContent((prev) =>
                              prev ? `${prev}\n${spoken}` : spoken
                            )
                          }
                          onAudioRecorded={(info) => {
                            setReflectionAudioMap((prev) => {
                              const existing = prev[activeReflection.id] || [];
                              if (existing.some((c) => c.id === info.cacheId))
                                return prev;
                              const clipEntry: SavedAudioClipSummary = {
                                id: info.cacheId,
                                title:
                                  editTitle.trim() || activeReflection.title,
                                previewText: '',
                                entityType: 'other',
                                entityId: `reflection:${activeReflection.id}`,
                                voiceName: 'Kore',
                                speed: 'normal',
                                mimeType: 'audio/webm',
                                sizeBytes: 0,
                                durationSeconds: info.durationSeconds,
                                lastPositionSeconds: 0,
                                playbackRate: 1,
                                updatedAtMs: Date.now(),
                              };
                              return {
                                ...prev,
                                [activeReflection.id]: [clipEntry, ...existing],
                              };
                            });
                          }}
                        />
                      </div>

                      <AutoResizeTextarea
                        minRows={7}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3.5 py-3 text-sm leading-loose bg-white border border-slate-300 rounded-xl"
                      />

                      <ReflectionAudioPlayer
                        uid={uid}
                        clips={reflectionAudioMap[activeReflection.id] || []}
                        canEdit={canEdit}
                        onClipDeleted={(clipId) =>
                          setReflectionAudioMap((prev) => ({
                            ...prev,
                            [activeReflection.id]: (
                              prev[activeReflection.id] || []
                            ).filter((c) => c.id !== clipId),
                          }))
                        }
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setModalEditing(false)}
                          className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حفظ التعديلات</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {(activeReflection.imageUrl ||
                        activeReflection.imageStoragePath) && (
                        <div className="space-y-2">
                          <FramedImage
                            srcUrl={activeReflection.imageUrl}
                            storagePath={activeReflection.imageStoragePath}
                            frame={activeReflection.imageFrame}
                            defaultFrame={DEFAULT_REFLECTION_IMAGE_FRAME}
                            alt={activeReflection.title}
                            mode="modal"
                            className="rounded-xl border border-black/10"
                          />
                          {canEdit && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setFrameEditorState({
                                    mode: 'direct_reflection',
                                    reflectionId: activeReflection.id,
                                    srcUrl: activeReflection.imageUrl,
                                    storagePath: activeReflection.imageStoragePath,
                                    frame: sanitizeImageFrameSpec(
                                      activeReflection.imageFrame,
                                      DEFAULT_REFLECTION_IMAGE_FRAME
                                    ),
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white/80 border border-slate-200 hover:bg-white rounded-lg cursor-pointer"
                              >
                                <Crop className="w-3 h-3" aria-hidden="true" />
                                <span>تعديل فريم وحجم الصورة</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                        <BidiText text={activeReflection.title} />
                      </h2>
                      <div className="text-sm text-slate-800 leading-loose whitespace-pre-wrap">
                        <BidiText text={activeReflection.content} />
                      </div>
                      <ReflectionAudioPlayer
                        uid={uid}
                        clips={reflectionAudioMap[activeReflection.id] || []}
                        canEdit={canEdit}
                        onClipDeleted={(clipId) =>
                          setReflectionAudioMap((prev) => ({
                            ...prev,
                            [activeReflection.id]: (
                              prev[activeReflection.id] || []
                            ).filter((c) => c.id !== clipId),
                          }))
                        }
                      />
                      <div className="pt-3 border-t border-black/5">
                        <ImageAttachmentGallery
                          uid={uid}
                          scopeKey={`reflection:${activeReflection.id}`}
                          title="صور أو لقطات إضافية"
                          canEdit={canEdit}
                          onRequireAuth={onRequireAuth}
                          compact
                          hideEmptyWhenReadOnly
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Gallery Image Picker Modal for Reflections */}
      {galleryPickerTarget && (
        <div
          className="fixed inset-0 z-[78] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setGalleryPickerTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[82dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                اختر صورة من معرض الصور
              </span>
              <button
                type="button"
                onClick={() => setGalleryPickerTarget(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {loadingGalleryPicker ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  جاري تحميل صور المعرض...
                </p>
              ) : galleryPickerItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  لا توجد صور في معرض الصور بعد. يمكنك رفع صورة مباشرة أو إضافتها في تبويب «معرض الصور».
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryPickerItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (galleryPickerTarget === 'composer') {
                          setComposerImageUrl(item.url);
                          setComposerImageStoragePath(item.storagePath || '');
                          setComposerImageStorageProvider(
                            item.storagePath
                              ? resolveEffectiveStorageProvider(
                                  undefined,
                                  item.storagePath
                                )
                              : undefined
                          );
                          setComposerImageFrame(DEFAULT_REFLECTION_IMAGE_FRAME);
                          setFrameEditorState({
                            mode: 'composer',
                            srcUrl: item.url,
                            storagePath: item.storagePath,
                            frame: DEFAULT_REFLECTION_IMAGE_FRAME,
                          });
                        } else {
                          const nextFrame = sanitizeImageFrameSpec(
                            editImageFrame,
                            DEFAULT_REFLECTION_IMAGE_FRAME
                          );
                          setEditImageUrl(item.url);
                          setEditImageStoragePath(item.storagePath || '');
                          setEditImageStorageProvider(
                            item.storagePath
                              ? resolveEffectiveStorageProvider(
                                  undefined,
                                  item.storagePath
                                )
                              : undefined
                          );
                          setEditImageFrame(nextFrame);
                          setFrameEditorState({
                            mode: 'modal_edit',
                            srcUrl: item.url,
                            storagePath: item.storagePath,
                            frame: nextFrame,
                          });
                        }
                        setGalleryPickerTarget(null);
                      }}
                      className="text-right bg-slate-50 border border-slate-200 hover:border-[#1E3A5F] rounded-xl overflow-hidden cursor-pointer"
                    >
                      <FramedImage
                        srcUrl={item.url}
                        storagePath={item.storagePath}
                        alt={item.name}
                        mode="card"
                        frame={{
                          aspect: '4:3',
                          fitMode: 'cover',
                          zoom: 1,
                          offsetX: 50,
                          offsetY: 50,
                          sizePreset: 'xs',
                        }}
                      />
                      <p className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate">
                        {item.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Crop / Frame / Resize Modal */}
      {frameEditorState && (
        <ImageFrameEditorModal
          open={Boolean(frameEditorState)}
          srcUrl={frameEditorState.srcUrl}
          storagePath={frameEditorState.storagePath}
          title="تحديد جزء الصورة وحجم الفريم"
          initialFrame={frameEditorState.frame}
          defaultFrame={DEFAULT_REFLECTION_IMAGE_FRAME}
          onSave={(nextFrame) => {
            if (frameEditorState.mode === 'composer') {
              setComposerImageFrame(nextFrame);
            } else if (frameEditorState.mode === 'modal_edit') {
              setEditImageFrame(nextFrame);
            } else if (
              frameEditorState.mode === 'direct_reflection' &&
              frameEditorState.reflectionId
            ) {
              onUpdateReflection(frameEditorState.reflectionId, {
                imageFrame: nextFrame,
              });
            }
          }}
          onClose={() => setFrameEditorState(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف الخاطرة"
        message={`هل تريد حذف الخاطرة "${deleteTarget?.title || ''}"؟ لا يمكن التراجع بعد التأكيد.`}
        confirmLabel="حذف الخاطرة"
        onConfirm={() => {
          if (deleteTarget) {
            if (
              deleteTarget.imageStoragePath &&
              !deleteTarget.imageStoragePath.includes('gallery')
            ) {
              void deleteReflectionImageStorage(deleteTarget.imageStoragePath);
            }
            onDeleteReflection(deleteTarget.id);
            if (activeReflectionId === deleteTarget.id) {
              setActiveReflectionId(null);
            }
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
