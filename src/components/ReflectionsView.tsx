import { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Feather,
  FolderPlus,
  Globe,
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
  PersonalReflection,
  REFLECTION_COLOR_PALETTE,
  ReflectionColorKey,
  ReflectionMood,
  VoiceDialectMode,
  getReflectionCardStyle,
  resolveReflectionColorKey,
} from '../data/curriculumData';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';
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
    title: string;
    content: string;
    moodTag: ReflectionMood;
    categoryTag?: string;
    colorKey?: ReflectionColorKey;
    isPublic?: boolean;
  }) => void;
  onUpdateReflection: (id: string, updates: Partial<PersonalReflection>) => void;
  onDeleteReflection: (id: string) => void;
  onSaveCategories: (next: string[]) => void;
  onTogglePublicCategory?: (category: string, makePublic: boolean) => void;
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
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodTag, setMoodTag] = useState<ReflectionMood>('تأمل');
  const [categoryTag, setCategoryTag] = useState<string>(categories[0] || '');
  const [composerColorKey, setComposerColorKey] = useState<ReflectionColorKey>('auto');
  const [composerIsPublic, setComposerIsPublic] = useState(false);

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

  const [deleteTarget, setDeleteTarget] = useState<PersonalReflection | null>(null);

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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) return;
    onAddReflection({
      title: cleanTitle || 'خاطرة بلا عنوان',
      content: cleanContent,
      moodTag,
      categoryTag: categoryTag.trim(),
      colorKey: composerColorKey === 'auto' ? undefined : composerColorKey,
      isPublic: composerIsPublic,
    });
    setTitle('');
    setContent('');
    setMoodTag('تأمل');
    setComposerColorKey('auto');
    setComposerIsPublic(false);
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
    setModalEditing(startInEdit && canEdit);
  };

  const handleSaveModalEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReflection || !canEdit) return;
    onUpdateReflection(activeReflection.id, {
      title: editTitle.trim() || 'خاطرة بلا عنوان',
      content: editContent.trim(),
      moodTag: editMood,
      categoryTag: editCategory.trim(),
      colorKey: editColorKey === 'auto' ? undefined : editColorKey,
      isPublic: editIsPublic,
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
            onClick={() => {
              if (!canEdit) {
                onRequireAuth();
                return;
              }
              setComposerOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{composerOpen ? 'إغلاق المحرر' : 'تدوين خاطرة جديدة'}</span>
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

      {/* New Reflection Composer */}
      {composerOpen && (
        <form
          onSubmit={handleCreate}
          className={`border rounded-2xl p-5 sm:p-6 space-y-4 transition-colors ${composerStyle.cardBg} ${composerStyle.cardBorder}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">خاطرة جديدة</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={composerIsPublic}
                  onChange={(e) => setComposerIsPublic(e.target.checked)}
                />
                <Globe className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>نشر على الموقع العام</span>
              </label>
              <VoiceRecorderButton
                dialect={voiceDialect}
                label="إملاء صوتي"
                onTranscript={(spoken) =>
                  setContent((prev) => (prev ? `${prev}\n${spoken}` : spoken))
                }
              />
            </div>
          </div>

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
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب بحرية... ما الفكرة أو الامتنان الذي استوقفك اليوم؟"
              className="w-full px-3.5 py-3 text-sm leading-loose bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!title.trim() && !content.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-45 rounded-lg cursor-pointer"
            >
              حفظ الخاطرة
            </button>
          </div>
        </form>
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
              onClick={() => setComposerOpen(true)}
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
                onClick={() => openModalReader(r, false)}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all hover:shadow-sm ${style.cardBg} ${
                  r.pinned ? 'ring-1 ring-[#1E3A5F]/35 ' + style.cardBorder : style.cardBorder
                }`}
              >
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
                </div>

                {/* Compact Footer Bar */}
                <div
                  className="pt-2 border-t border-black/5 flex items-center justify-between gap-2 text-[11px] text-slate-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate tabular-nums">{r.createdAtLabel}</span>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
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

                      <textarea
                        rows={7}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3.5 py-3 text-sm leading-loose bg-white border border-slate-300 rounded-xl"
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
                      <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                        <BidiText text={activeReflection.title} />
                      </h2>
                      <div className="text-sm text-slate-800 leading-loose whitespace-pre-wrap">
                        <BidiText text={activeReflection.content} />
                      </div>
                      <div className="pt-3 border-t border-black/5">
                        <ImageAttachmentGallery
                          uid={uid}
                          scopeKey={`reflection:${activeReflection.id}`}
                          title="صور أو لقطات مرفقة"
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف الخاطرة"
        message={`هل تريد حذف الخاطرة "${deleteTarget?.title || ''}"؟ لا يمكن التراجع بعد التأكيد.`}
        confirmLabel="حذف الخاطرة"
        onConfirm={() => {
          if (deleteTarget) {
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
