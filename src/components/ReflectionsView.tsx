import { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Feather,
  FolderPlus,
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
  ReflectionMood,
  VoiceDialectMode,
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
  voiceDialect: VoiceDialectMode;
  onAddReflection: (
    title: string,
    content: string,
    moodTag: ReflectionMood,
    categoryTag?: string
  ) => void;
  onUpdateReflection: (id: string, updates: Partial<PersonalReflection>) => void;
  onDeleteReflection: (id: string) => void;
  onSaveCategories: (next: string[]) => void;
}

const MOOD_OPTIONS: ReflectionMood[] = ['تأمل', 'فكرة', 'امتنان', 'هدف'];
type ReflectionSortMode = 'pinned_newest' | 'newest' | 'oldest' | 'title';

export default function ReflectionsView({
  uid,
  canEdit,
  onRequireAuth,
  reflections,
  reflectionCategories,
  voiceDialect,
  onAddReflection,
  onUpdateReflection,
  onDeleteReflection,
  onSaveCategories,
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

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodTag, setMoodTag] = useState<ReflectionMood>('تأمل');
  const [categoryTag, setCategoryTag] = useState<string>(categories[0] || '');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [managingCats, setManagingCats] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState<ReflectionMood | 'all'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<ReflectionSortMode>('pinned_newest');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMood, setEditMood] = useState<ReflectionMood>('تأمل');
  const [editCategory, setEditCategory] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<PersonalReflection | null>(null);

  const filteredReflections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reflections.filter((r) => {
      if (pinnedOnly && !r.pinned) return false;
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
  }, [reflections, pinnedOnly, moodFilter, catFilter, searchQuery, sortMode]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) return;
    onAddReflection(
      cleanTitle || 'خاطرة بلا عنوان',
      cleanContent,
      moodTag,
      categoryTag.trim()
    );
    setTitle('');
    setContent('');
    setMoodTag('تأمل');
    setComposerOpen(false);
  };

  const handleStartEdit = (r: PersonalReflection) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditContent(r.content);
    setEditMood(r.moodTag);
    setEditCategory(r.categoryTag || '');
  };

  const handleSaveEdit = (id: string) => {
    onUpdateReflection(id, {
      title: editTitle.trim() || 'خاطرة بلا عنوان',
      content: editContent.trim(),
      moodTag: editMood,
      categoryTag: editCategory.trim(),
    });
    setEditingId(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Feather className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              خواطري وتأملاتي
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            دفتر هادئ للخواطر والأفكار والتأملات الشخصية المصنّفة بتصنيفاتك الخاصة، مع البحث والتثبيت والصور والإملاء الصوتي.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setManagingCats((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>إدارة التصنيفات ({categories.length})</span>
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

      {/* Category Manager Drawer */}
      {managingCats && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              تصنيفات الخواطر المخصّصة
            </h2>
            <button
              type="button"
              onClick={() => setManagingCats(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              إخفاء
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800"
              >
                <span>{cat}</span>
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
              </span>
            ))}
          </div>
          {canEdit && (
            <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="أضف تصنيفًا جديدًا للخواطر (مثال: ملاحظات سريرية، روحانيات)..."
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
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">خاطرة جديدة</h2>
            <VoiceRecorderButton
              dialect={voiceDialect}
              label="إملاء صوتي للخاطرة"
              onTranscript={(spoken) =>
                setContent((prev) => (prev ? `${prev}\n${spoken}` : spoken))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                العنوان
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان مختصر للفكرة..."
                className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              نص الخاطرة
            </label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب بحرية... ما الفكرة التي استوقفتك اليوم؟"
              className="w-full px-3.5 py-3 text-sm leading-loose bg-[#F7F8FA] border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
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

      {/* Search, Filter & Sort Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في الخواطر والعناوين..."
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
          value={moodFilter}
          onChange={(e) => setMoodFilter(e.target.value as ReflectionMood | 'all')}
          aria-label="تصفية حسب النوع"
          className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        >
          <option value="all">كل الأنواع</option>
          {MOOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
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
          <span>المثبتة فقط</span>
        </button>
      </div>

      {/* Reflections Stream */}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredReflections.map((r) => {
            const isEditing = editingId === r.id;
            return (
              <article
                key={r.id}
                className={`bg-white rounded-2xl border p-5 sm:p-6 space-y-4 transition-colors ${
                  r.pinned ? 'border-[#1E3A5F]/40' : 'border-slate-200'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="px-3 py-2 text-sm font-semibold bg-[#F7F8FA] border border-slate-300 rounded-lg"
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
                    <textarea
                      rows={5}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm leading-relaxed bg-[#F7F8FA] border border-slate-300 rounded-lg"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(r.id)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>حفظ التعديلات</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-semibold text-[#1E3A5F]">
                            {r.moodTag}
                          </span>
                          {r.categoryTag && (
                            <>
                              <span>·</span>
                              <span className="px-2 py-0.5 bg-[#F7F8FA] border border-slate-200 rounded-md text-slate-700 font-medium">
                                {r.categoryTag}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span>{r.createdAtLabel}</span>
                        </div>
                        <h3 className="font-editorial text-lg font-bold text-slate-900 leading-snug">
                          <BidiText text={r.title} />
                        </h3>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateReflection(r.id, { pinned: !r.pinned })
                            }
                            aria-label={r.pinned ? 'إلغاء التثبيت' : 'تثبيت الخاطرة'}
                            className={`p-1.5 rounded-lg cursor-pointer ${
                              r.pinned
                                ? 'text-[#1E3A5F] bg-slate-100'
                                : 'text-slate-400 hover:text-[#1E3A5F]'
                            }`}
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(r)}
                            aria-label="تعديل الخاطرة"
                            className="p-1.5 text-slate-400 hover:text-[#1E3A5F] rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            aria-label="حذف الخاطرة"
                            className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-slate-700 leading-loose whitespace-pre-wrap">
                      <BidiText text={r.content} />
                    </div>

                    <ImageAttachmentGallery
                      uid={uid}
                      scopeKey={`reflection:${r.id}`}
                      title="صور أو لقطات مرفقة"
                      canEdit={canEdit}
                      onRequireAuth={onRequireAuth}
                      compact
                      hideEmptyWhenReadOnly
                    />
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف الخاطرة"
        message={`هل تريد حذف الخاطرة "${deleteTarget?.title || ''}"؟ لا يمكن التراجع بعد التأكيد.`}
        confirmLabel="حذف الخاطرة"
        onConfirm={() => {
          if (deleteTarget) onDeleteReflection(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
