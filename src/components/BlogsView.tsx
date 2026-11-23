import { useMemo, useRef, useState } from 'react';
import {
  BookOpenText,
  Check,
  Crop,
  Edit3,
  Globe,
  ImagePlus,
  Images,
  Lock,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  BlogPost,
  DEFAULT_BLOG_CATEGORIES,
  DEFAULT_IMAGE_FRAME_SPEC,
  ImageFrameSpec,
  ReadAloudVoiceName,
  VoiceDialectMode,
  estimateReadingTimeMinutes,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import {
  deleteBlogCoverStorage,
  getImagesForScope,
  isImageFile,
  uploadBlogCoverImage,
} from '../utils/imageStorage';
import AutoResizeTextarea from './AutoResizeTextarea';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import { FramedImage, ImageFrameEditorModal } from './FramedImage';
import { MAIN_GALLERY_SCOPE_KEY } from './PhotoGalleryView';
import ReadAloudButton from './ReadAloudButton';
import VoiceRecorderButton from './VoiceRecorderButton';

interface BlogsViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  posts: BlogPost[];
  voiceDialect: VoiceDialectMode;
  readAloudVoice?: ReadAloudVoiceName;
  readAloudSpeed?: 'normal' | 'calm';
  onAddPost: (payload: {
    title: string;
    subtitle?: string;
    excerpt?: string;
    content: string;
    categoryLabel?: string;
    coverImageUrl?: string;
    coverStoragePath?: string;
    coverFrame?: ImageFrameSpec;
    isPublic?: boolean;
    pinned?: boolean;
  }) => string | void;
  onUpdatePost: (id: string, updates: Partial<BlogPost>) => void;
  onDeletePost: (id: string) => void;
}

export default function BlogsView({
  uid,
  canEdit,
  onRequireAuth,
  posts,
  voiceDialect,
  readAloudVoice = 'Kore',
  readAloudSpeed = 'normal',
  onAddPost,
  onUpdatePost,
  onDeletePost,
}: BlogsViewProps) {
  const categories = useMemo(() => {
    const extras = posts
      .map((p) => (p.categoryLabel || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_BLOG_CATEGORIES, ...extras]));
  }, [posts]);

  // Composer State
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [categoryLabel, setCategoryLabel] = useState<string>(categories[0] || '');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverStoragePath, setCoverStoragePath] = useState('');
  const [coverFrame, setCoverFrame] = useState<ImageFrameSpec>(
    DEFAULT_IMAGE_FRAME_SPEC
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverErr, setCoverErr] = useState<string | null>(null);
  const composerFileRef = useRef<HTMLInputElement | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'public' | 'draft'>('all');

  // Reader / Modal Editor State
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [modalEditing, setModalEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editCoverPath, setEditCoverPath] = useState('');
  const [editCoverFrame, setEditCoverFrame] = useState<ImageFrameSpec>(
    DEFAULT_IMAGE_FRAME_SPEC
  );
  const [uploadingModalCover, setUploadingModalCover] = useState(false);
  const modalFileRef = useRef<HTMLInputElement | null>(null);

  const [galleryPickerTarget, setGalleryPickerTarget] = useState<
    'composer' | 'modal' | null
  >(null);
  const [galleryItems, setGalleryItems] = useState<
    Array<{ id: string; name: string; url: string; storagePath?: string }>
  >([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const [frameEditor, setFrameEditor] = useState<{
    mode: 'composer' | 'modal';
    srcUrl?: string;
    storagePath?: string;
    frame: ImageFrameSpec;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  const activePost = useMemo(
    () => posts.find((p) => p.id === activePostId) ?? null,
    [posts, activePostId]
  );

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts
      .filter((p) => {
        if (filterCat !== 'all' && (p.categoryLabel || '') !== filterCat) {
          return false;
        }
        if (filterStatus === 'public' && !p.isPublic) return false;
        if (filterStatus === 'draft' && p.isPublic) return false;
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          (p.subtitle || '').toLowerCase().includes(q) ||
          (p.excerpt || '').toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.categoryLabel || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      });
  }, [posts, searchQuery, filterCat, filterStatus]);

  const openGalleryPicker = async (target: 'composer' | 'modal') => {
    setGalleryPickerTarget(target);
    setLoadingGallery(true);
    try {
      const items = await getImagesForScope(MAIN_GALLERY_SCOPE_KEY, uid);
      setGalleryItems(
        items.map((item) => ({
          id: item.id,
          name: item.name,
          url: item.downloadUrl || item.dataUrl || '',
          storagePath: item.storagePath,
        }))
      );
    } finally {
      setLoadingGallery(false);
    }
  };

  const handleUploadComposerCover = async (file: File) => {
    if (!canEdit) return onRequireAuth();
    if (!isImageFile(file)) {
      setCoverErr('يرجى اختيار ملف صورة صالح.');
      return;
    }
    setUploadingCover(true);
    setCoverErr(null);
    try {
      const res = await uploadBlogCoverImage(`draft-${Date.now()}`, file, uid);
      setCoverImageUrl(res.imageUrl || res.localObjectUrl);
      setCoverStoragePath(res.imageStoragePath);
    } catch {
      setCoverErr('تعذر رفع صورة الغلاف.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleUploadModalCover = async (file: File) => {
    if (!canEdit || !activePost) return;
    if (!isImageFile(file)) return;
    setUploadingModalCover(true);
    try {
      const res = await uploadBlogCoverImage(activePost.id, file, uid);
      setEditCoverUrl(res.imageUrl || res.localObjectUrl);
      setEditCoverPath(res.imageStoragePath);
    } finally {
      setUploadingModalCover(false);
    }
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return onRequireAuth();
    if (!title.trim() || !content.trim()) return;
    const chosenCat = customCategoryInput.trim() || categoryLabel;
    onAddPost({
      title: title.trim(),
      subtitle: subtitle.trim(),
      excerpt: excerpt.trim(),
      content: content.trim(),
      categoryLabel: chosenCat,
      coverImageUrl: coverImageUrl || undefined,
      coverStoragePath: coverStoragePath || undefined,
      coverFrame: coverImageUrl || coverStoragePath ? coverFrame : undefined,
      isPublic,
      pinned,
    });
    setTitle('');
    setSubtitle('');
    setExcerpt('');
    setContent('');
    setCustomCategoryInput('');
    setCoverImageUrl('');
    setCoverStoragePath('');
    setCoverFrame(DEFAULT_IMAGE_FRAME_SPEC);
    setPinned(false);
    setIsPublic(true);
    setComposerOpen(false);
  };

  const startEditPost = (post: BlogPost) => {
    setEditTitle(post.title);
    setEditSubtitle(post.subtitle || '');
    setEditExcerpt(post.excerpt || '');
    setEditContent(post.content);
    setEditCat(post.categoryLabel || '');
    setEditIsPublic(Boolean(post.isPublic));
    setEditCoverUrl(post.coverImageUrl || '');
    setEditCoverPath(post.coverStoragePath || '');
    setEditCoverFrame(
      post.coverFrame
        ? sanitizeImageFrameSpec(post.coverFrame, DEFAULT_IMAGE_FRAME_SPEC)
        : DEFAULT_IMAGE_FRAME_SPEC
    );
    setModalEditing(true);
  };

  const handleSaveModalEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !activePost) return;
    onUpdatePost(activePost.id, {
      title: editTitle.trim() || activePost.title,
      subtitle: editSubtitle.trim(),
      excerpt: editExcerpt.trim(),
      content: editContent.trim(),
      categoryLabel: editCat.trim(),
      isPublic: editIsPublic,
      coverImageUrl: editCoverUrl || undefined,
      coverStoragePath: editCoverPath || undefined,
      coverFrame:
        editCoverUrl || editCoverPath ? editCoverFrame : undefined,
      readingTimeMinutes: estimateReadingTimeMinutes(editContent),
    });
    setModalEditing(false);
  };

  const publishedCount = posts.filter((p) => p.isPublic).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs text-slate-500">
            منصة النشر والتحرير · {posts.length} مقال ({publishedCount} منشور في الموقع العام)
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            المدونة والمقالات التحريرية
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            اكتب مقالاتك المطوّلة والأفكار المنظّمة بسلاسة تامة في مساحة مريحة خالية من التشتيت، وانشر ما تشاء منها مباشرةً في صفحة المدونة بالموقع العام.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canEdit) return onRequireAuth();
            setComposerOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{composerOpen ? 'إغلاق المحرر' : 'كتابة مقال جديد'}</span>
        </button>
      </section>

      {/* Editorial Article Composer */}
      {composerOpen && (
        <form
          onSubmit={handleCreatePost}
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h2 className="font-editorial text-xl font-bold text-slate-900">
              مقال جديد
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>نشر مباشر في الموقع العام</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                <span>تثبيت في الأعلى</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                عنوان المقال *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان واضح وجذاب للمقال..."
                className="w-full px-3.5 py-2.5 text-sm font-bold bg-[#F7F8FA] border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                عنوان فرعي (اختياري)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="سطر تمهيدي يوضح فكرة المقال..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تصنيف المقال
              </label>
              <select
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
              >
                <option value="">بدون تصنيف</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                أو أضف تصنيفًا جديدًا
              </label>
              <input
                type="text"
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                placeholder="تصنيف مخصّص اختياري..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              مقتطف تعريفي قصير (يظهر على بطاقة المقال)
            </label>
            <AutoResizeTextarea
              minRows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="خلاصة سريعة في سطر أو سطرين تجذب القارئ..."
              className="w-full px-3.5 py-2.5 text-sm leading-relaxed bg-[#F7F8FA] border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                نص المقال * (يتمدد تلقائيًا دون شريط تمرير داخلي)
              </label>
              <VoiceRecorderButton
                label="إملاء صوتي"
                dialect={voiceDialect}
                disabled={!canEdit}
                onRequireAuth={onRequireAuth}
                onTranscript={(txt) =>
                  setContent((prev) =>
                    prev.trim() ? `${prev.trim()}\n\n${txt}` : txt
                  )
                }
              />
            </div>
            <AutoResizeTextarea
              minRows={8}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب مقالك بأسلوب هادئ ومتصل... يتسع الصندوق تلقائيًا مع كتابتك مهما طال المقال."
              className="w-full px-4 py-3.5 text-sm sm:text-base leading-loose bg-[#F7F8FA] border border-slate-300 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
            />
            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
              زمن القراءة التقديري: {estimateReadingTimeMinutes(content)} دقائق
            </p>
          </div>

          {/* Framed Cover Image Picker */}
          <div className="p-4 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                <Images className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>صورة غلاف المقال (اختياري)</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={composerFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadComposerCover(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => composerFileRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{uploadingCover ? 'جاري الرفع...' : 'رفع صورة'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void openGalleryPicker('composer')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <Images className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>من المعرض</span>
                </button>
              </div>
            </div>

            {coverErr && (
              <p className="text-xs text-red-700">{coverErr}</p>
            )}

            {(coverImageUrl || coverStoragePath) && (
              <div className="space-y-2">
                <FramedImage
                  srcUrl={coverImageUrl}
                  storagePath={coverStoragePath}
                  frame={coverFrame}
                  alt={title || 'غلاف المقال'}
                  mode="card"
                  className="rounded-xl border border-slate-200"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setFrameEditor({
                        mode: 'composer',
                        srcUrl: coverImageUrl,
                        storagePath: coverStoragePath,
                        frame: coverFrame,
                      })
                    }
                    className="inline-flex items-center gap-1 text-[#1E3A5F] font-semibold hover:underline cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>ضبط إطار الغلاف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl('');
                      setCoverStoragePath('');
                    }}
                    className="text-red-700 hover:underline cursor-pointer"
                  >
                    إزالة الغلاف
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer disabled:opacity-45"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>حفظ المقال</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في عنوان أو محتوى المقالات..."
            className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl"
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs">
            {(
              [
                ['all', 'الكل'],
                ['public', 'منشور'],
                ['draft', 'مسودة'],
              ] as const
            ).map(([key, lbl]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1 rounded-lg cursor-pointer ${
                  filterStatus === key
                    ? 'bg-white text-[#1E3A5F] font-semibold'
                    : 'text-slate-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles List / Grid */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3">
          <BookOpenText
            className="w-10 h-10 text-slate-300 mx-auto"
            aria-hidden="true"
          />
          <p className="font-editorial text-lg font-bold text-slate-800">
            لا توجد مقالات مطابقة حاليًا
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ابدأ بكتابة مقالك الأول ومشاركته على صفحتك العامة لتكوين أرشيف معرفي هادئ ومرتب.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map((post) => {
            const mins =
              post.readingTimeMinutes ||
              estimateReadingTimeMinutes(post.content);
            return (
              <article
                key={post.id}
                onClick={() => {
                  setActivePostId(post.id);
                  setModalEditing(false);
                }}
                className="bg-white border border-slate-200 hover:border-[#1E3A5F]/45 rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer transition-colors"
              >
                <div>
                  {(post.coverImageUrl || post.coverStoragePath) && (
                    <FramedImage
                      srcUrl={post.coverImageUrl}
                      storagePath={post.coverStoragePath}
                      frame={post.coverFrame}
                      alt={post.title}
                      mode="card"
                      className="border-b border-slate-100"
                    />
                  )}
                  <div className="p-5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                      <span className="font-semibold text-[#1E3A5F]">
                        {post.categoryLabel || 'مقال عام'} · {mins} د قراءة
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {post.pinned && (
                          <Pin className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                        )}
                        {post.isPublic ? (
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                            <Globe className="w-3 h-3" aria-hidden="true" />
                            <span>منشور</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 inline-flex items-center gap-0.5">
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            <span>مسودة</span>
                          </span>
                        )}
                      </span>
                    </div>

                    <h3 className="font-editorial text-lg font-bold text-slate-900 leading-snug line-clamp-2">
                      <BidiText text={post.title} />
                    </h3>

                    {post.subtitle && (
                      <p className="text-xs font-medium text-slate-600 line-clamp-1">
                        <BidiText text={post.subtitle} />
                      </p>
                    )}

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      <BidiText text={post.excerpt || post.content} />
                    </p>
                  </div>
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="px-5 py-3 bg-[#F7F8FA] border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500"
                >
                  <span>{post.createdAtLabel}</span>
                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePost(post.id, { isPublic: !post.isPublic })
                        }
                        className="px-2 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        {post.isPublic ? 'إخفاء' : 'نشر'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePost(post.id, { pinned: !post.pinned })
                        }
                        aria-label="تثبيت المقال"
                        className={`p-1.5 rounded-md cursor-pointer ${
                          post.pinned
                            ? 'text-[#1E3A5F] bg-white border border-[#1E3A5F]/30'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(post)}
                        aria-label={`حذف ${post.title}`}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Article Reader & Editor Modal (Single Outer Scroll, Auto-Growing Editor) */}
      {activePost && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setActivePostId(null);
            setModalEditing(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl"
          >
            <div className="sticky top-0 z-10 px-5 py-3.5 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#1E3A5F]">
                {activePost.categoryLabel || 'مقال'} ·{' '}
                {activePost.readingTimeMinutes ||
                  estimateReadingTimeMinutes(activePost.content)}{' '}
                دقائق قراءة
              </div>
              <div className="flex items-center gap-1.5">
                {canEdit && !modalEditing && (
                  <button
                    type="button"
                    onClick={() => startEditPost(activePost)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تعديل المقال</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActivePostId(null);
                    setModalEditing(false);
                  }}
                  aria-label="إغلاق"
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-8 space-y-5">
              {modalEditing ? (
                <form onSubmit={handleSaveModalEdit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        العنوان
                      </label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-[#F7F8FA] border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        العنوان الفرعي
                      </label>
                      <input
                        type="text"
                        value={editSubtitle}
                        onChange={(e) => setEditSubtitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        التصنيف
                      </label>
                      <input
                        type="text"
                        value={editCat}
                        onChange={(e) => setEditCat(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsPublic}
                          onChange={(e) => setEditIsPublic(e.target.checked)}
                        />
                        <span>منشور في الموقع العام</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      المقتطف
                    </label>
                    <AutoResizeTextarea
                      minRows={2}
                      value={editExcerpt}
                      onChange={(e) => setEditExcerpt(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      محتوى المقال
                    </label>
                    <AutoResizeTextarea
                      minRows={10}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-4 py-3 text-sm sm:text-base leading-loose bg-[#F7F8FA] border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        صورة غلاف المقال
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={modalFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadModalCover(f);
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          disabled={uploadingModalCover}
                          onClick={() => modalFileRef.current?.click()}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 rounded-lg cursor-pointer"
                        >
                          {uploadingModalCover ? 'جاري الرفع...' : 'تغيير الغلاف'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openGalleryPicker('modal')}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        >
                          من المعرض
                        </button>
                      </div>
                    </div>
                    {(editCoverUrl || editCoverPath) && (
                      <div className="space-y-2">
                        <FramedImage
                          srcUrl={editCoverUrl}
                          storagePath={editCoverPath}
                          frame={editCoverFrame}
                          alt={editTitle}
                          mode="modal"
                          className="rounded-xl border border-slate-200"
                        />
                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setFrameEditor({
                                mode: 'modal',
                                srcUrl: editCoverUrl,
                                storagePath: editCoverPath,
                                frame: editCoverFrame,
                              })
                            }
                            className="text-[#1E3A5F] font-semibold hover:underline cursor-pointer"
                          >
                            ضبط إطار الصورة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCoverUrl('');
                              setEditCoverPath('');
                            }}
                            className="text-red-700 hover:underline cursor-pointer"
                          >
                            إزالة الصورة
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
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
                <div className="max-w-2xl mx-auto space-y-5">
                  {(activePost.coverImageUrl || activePost.coverStoragePath) && (
                    <FramedImage
                      srcUrl={activePost.coverImageUrl}
                      storagePath={activePost.coverStoragePath}
                      frame={activePost.coverFrame}
                      alt={activePost.title}
                      mode="modal"
                      className="rounded-xl border border-slate-200"
                    />
                  )}

                  <div className="space-y-2">
                    <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                      <BidiText text={activePost.title} />
                    </h2>
                    {activePost.subtitle && (
                      <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                        <BidiText text={activePost.subtitle} />
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      نُشر بتاريخ {activePost.createdAtLabel}
                      {activePost.isPublic ? ' · ظاهر في المدونة العامة' : ' · مسودة خاصة'}
                    </p>
                  </div>

                  <div className="pt-1 pb-2 border-y border-slate-100">
                    <ReadAloudButton
                      text={`${activePost.title}\n\n${activePost.subtitle || ''}\n\n${activePost.content}`}
                      voiceName={readAloudVoice}
                      speed={readAloudSpeed}
                      uid={uid}
                      entityType="other"
                      entityId={`blog_${activePost.id}`}
                      title={activePost.title}
                      onRequireAuth={onRequireAuth}
                    />
                  </div>

                  <div className="text-sm sm:text-base text-slate-800 leading-loose whitespace-pre-wrap">
                    <BidiText text={activePost.content} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gallery Picker Modal */}
      {galleryPickerTarget && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setGalleryPickerTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[82dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                اختر غلافًا من معرض الصور
              </h3>
              <button
                type="button"
                onClick={() => setGalleryPickerTarget(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingGallery ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  جاري تحميل الصور...
                </p>
              ) : galleryItems.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  المعرض فارغ حاليًا. يمكنك رفع صور من قسم معرض الصور أو مباشرةً من زر الرفع.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (galleryPickerTarget === 'composer') {
                          setCoverImageUrl(item.url);
                          setCoverStoragePath(item.storagePath || '');
                        } else {
                          setEditCoverUrl(item.url);
                          setEditCoverPath(item.storagePath || '');
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

      {/* Frame Editor Modal */}
      {frameEditor && (
        <ImageFrameEditorModal
          open={Boolean(frameEditor)}
          srcUrl={frameEditor.srcUrl}
          storagePath={frameEditor.storagePath}
          title="تخصيص إطار غلاف المقال"
          initialFrame={frameEditor.frame}
          defaultFrame={DEFAULT_IMAGE_FRAME_SPEC}
          onSave={(nextFrame) => {
            if (frameEditor.mode === 'composer') {
              setCoverFrame(nextFrame);
            } else {
              setEditCoverFrame(nextFrame);
            }
          }}
          onClose={() => setFrameEditor(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف المقال"
        message={`هل تريد حذف المقال "${deleteTarget?.title || ''}"؟ لا يمكن التراجع عن الحذف.`}
        confirmLabel="حذف المقال"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            if (
              deleteTarget.coverStoragePath &&
              !deleteTarget.coverStoragePath.includes('gallery')
            ) {
              void deleteBlogCoverStorage(deleteTarget.coverStoragePath);
            }
            onDeletePost(deleteTarget.id);
            if (activePostId === deleteTarget.id) {
              setActivePostId(null);
            }
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
