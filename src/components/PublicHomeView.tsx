import { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenText,
  Compass,
  Eye,
  Feather,
  GraduationCap,
  KeyRound,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  Map as MapIcon,
  NotebookPen,
  Search,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  BlogPost,
  BookNote,
  DEFAULT_REFLECTION_IMAGE_FRAME,
  GrantedWorkspaceData,
  HERO_IMAGE_PATH,
  LearningPath,
  PersonalCourse,
  PersonalReflection,
  PublicPageId,
  PublicSiteConfig,
  ReadingLibraryItem,
  ReflectionMood,
  estimateReadingTimeMinutes,
  getHubMeta,
  getReflectionCardStyle,
} from '../data/curriculumData';
import type { UserProfileRecord } from '../services/supabaseSync';
import { ensureRichHtml, renderSafeBidiHtml } from '../utils/richText';
import BidiText from './BidiText';
import { FramedImage } from './FramedImage';
import LearningObjectivesPanel from './LearningObjectivesPanel';
import type { ActivePdfTarget } from './PDFViewerModal';

interface PublicHomeViewProps {
  siteConfig: PublicSiteConfig;
  publicPage?: PublicPageId;
  onChangePublicPage?: (page: PublicPageId) => void;
  publicCourses: PersonalCourse[];
  publicPaths: LearningPath[];
  publicBooks: ReadingLibraryItem[];
  publicReflections?: PersonalReflection[];
  publicBlogs?: BlogPost[];
  grantedWorkspace?: GrantedWorkspaceData | null;
  loadingGranted?: boolean;
  loadingCatalog?: boolean;
  user: User | null;
  isAdmin: boolean;
  userProfile?: UserProfileRecord | null;
  authError?: string | null;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  onReturnToAdmin?: () => void;
  onOpenPdf: (target: ActivePdfTarget) => void;
}

type PublicDetailModalState =
  | { type: 'course'; item: PersonalCourse; linkedNotes?: BookNote[] }
  | { type: 'note'; item: BookNote }
  | { type: 'path'; item: LearningPath }
  | { type: 'book'; item: ReadingLibraryItem }
  | { type: 'reflection'; item: PersonalReflection }
  | { type: 'blog'; item: BlogPost }
  | null;

const MOOD_FILTERS: Array<ReflectionMood | 'all'> = [
  'all',
  'تأمل',
  'فكرة',
  'امتنان',
  'هدف',
];

export default function PublicHomeView({
  siteConfig,
  publicPage = 'home',
  onChangePublicPage,
  publicCourses,
  publicPaths,
  publicBooks,
  publicReflections = [],
  publicBlogs = [],
  grantedWorkspace,
  loadingGranted = false,
  loadingCatalog = false,
  user,
  isAdmin,
  userProfile,
  authError,
  onGoogleSignIn,
  onSignOut,
  onReturnToAdmin,
  onOpenPdf,
}: PublicHomeViewProps) {
  const [detailModal, setDetailModal] = useState<PublicDetailModalState>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Reflections sub-page filters
  const [reflSearch, setReflSearch] = useState('');
  const [reflMoodFilter, setReflMoodFilter] = useState<ReflectionMood | 'all'>('all');
  const [reflCatFilter, setReflCatFilter] = useState<string>('all');

  // Blogs sub-page filters
  const [blogSearch, setBlogSearch] = useState('');
  const [blogCatFilter, setBlogCatFilter] = useState<string>('all');

  const flags = siteConfig.visibilityFlags;
  const visibleSections = siteConfig.sections.filter((s) => s.visible);
  const effectiveOwnerUid = siteConfig.ownerId || user?.uid;

  const grantedCourses = grantedWorkspace?.courses ?? [];
  const grantedNotes = grantedWorkspace?.bookNotes ?? [];
  const grantedPaths = grantedWorkspace?.learningPaths ?? [];
  const grantedBooks = grantedWorkspace?.readingItems ?? [];
  const grantedReflections = grantedWorkspace?.reflections ?? [];
  const totalGrantedCount =
    grantedCourses.length +
    grantedNotes.length +
    grantedPaths.length +
    grantedBooks.length +
    grantedReflections.length;

  const adminNotesForUser = (grantedWorkspace?.grants ?? [])
    .map((g) => g.notesForUser.trim())
    .filter(Boolean)
    .join(' · ');

  const openCourseModal = (course: PersonalCourse) => {
    const matchingNotes = grantedNotes.filter(
      (n) =>
        n.courseId === course.id ||
        (Boolean(n.courseTitle) &&
          n.courseTitle!.trim().toLowerCase() === course.title.trim().toLowerCase())
    );
    setDetailModal({ type: 'course', item: course, linkedNotes: matchingNotes });
  };

  const reflectionCategories = useMemo(
    () =>
      Array.from(
        new Set(
          publicReflections
            .map((r) => (r.categoryTag || '').trim())
            .filter(Boolean)
        )
      ),
    [publicReflections]
  );

  const filteredPublicReflections = useMemo(() => {
    const q = reflSearch.trim().toLowerCase();
    return publicReflections.filter((r) => {
      if (reflMoodFilter !== 'all' && r.moodTag !== reflMoodFilter) return false;
      if (reflCatFilter !== 'all' && (r.categoryTag || '') !== reflCatFilter)
        return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        (r.categoryTag || '').toLowerCase().includes(q)
      );
    });
  }, [publicReflections, reflSearch, reflMoodFilter, reflCatFilter]);

  const blogCategories = useMemo(
    () =>
      Array.from(
        new Set(
          publicBlogs
            .map((b) => (b.categoryLabel || '').trim())
            .filter(Boolean)
        )
      ),
    [publicBlogs]
  );

  const filteredPublicBlogs = useMemo(() => {
    const q = blogSearch.trim().toLowerCase();
    return publicBlogs.filter((b) => {
      if (blogCatFilter !== 'all' && (b.categoryLabel || '') !== blogCatFilter) {
        return false;
      }
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.subtitle || '').toLowerCase().includes(q) ||
        (b.excerpt || '').toLowerCase().includes(q) ||
        b.content.toLowerCase().includes(q)
      );
    });
  }, [publicBlogs, blogSearch, blogCatFilter]);

  const goPage = (page: PublicPageId) => {
    onChangePublicPage?.(page);
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Admin Preview Strip */}
      {isAdmin && onReturnToAdmin && (
        <div className="bg-[#1E3A5F] text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              أنت تشاهد الآن معاينة الموقع العام ({publicPage === 'home' ? 'الرئيسية' : publicPage === 'reflections' ? 'الخواطر' : 'المدونة'}) كما يراها الزوار.
            </span>
          </div>
          <button
            type="button"
            onClick={onReturnToAdmin}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white text-[#1E3A5F] rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <span>العودة إلى لوحة الإدارة</span>
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Quiet Sub-Page Switcher for Visitor Ease */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => goPage('home')}
            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
              publicPage === 'home'
                ? 'bg-[#1E3A5F] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            الرئيسية والسيرة
          </button>
          {flags.showReflections !== false && (
            <button
              type="button"
              onClick={() => goPage('reflections')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                publicPage === 'reflections'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              خواطري وتأملاتي ({publicReflections.length})
            </button>
          )}
          {flags.showBlogs !== false && (
            <button
              type="button"
              onClick={() => goPage('blogs')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                publicPage === 'blogs'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              المدونة والمقالات ({publicBlogs.length})
            </button>
          )}
        </div>
        {publicPage !== 'home' && (
          <button
            type="button"
            onClick={() => goPage('home')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span>الرجوع للرئيسية</span>
          </button>
        )}
      </div>

      {/* Signed-in Non-Admin Info Banner */}
      {user && !isAdmin && publicPage === 'home' && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              className="w-5 h-5 text-[#1E3A5F] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                مرحبًا {user.displayName || userProfile?.display_name || user.email}
              </p>
              <p className="text-xs text-slate-600">
                {totalGrantedCount > 0
                  ? `لديك محتوى مخصّص ومفتوح لحسابك (${totalGrantedCount} عنصر) بالإضافة إلى المواد المنشورة للعامة.`
                  : 'حسابك مسجّل بصلاحية القراءة العامة فقط. يمكنك تصفح السيرة العامة والمقالات والخواطر بكل هدوء.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}

      {authError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs sm:text-sm">
          {authError}
        </div>
      )}

      {/* ================= PAGE 1: PUBLIC HOME ================= */}
      {publicPage === 'home' && (
        <>
          {/* Customizable Hero Section */}
          {flags.showHero && (
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-slate-900 leading-tight">
                      {siteConfig.heroTitle}
                    </h1>
                    {siteConfig.heroSubtitle && (
                      <p className="text-base sm:text-lg font-medium text-[#1E3A5F]">
                        {siteConfig.heroSubtitle}
                      </p>
                    )}
                    {siteConfig.introBio && (
                      <p className="text-sm sm:text-base text-slate-600 leading-loose whitespace-pre-wrap">
                        {siteConfig.introBio}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {flags.showBlogs !== false && (
                      <button
                        type="button"
                        onClick={() => goPage('blogs')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
                      >
                        <BookOpenText className="w-4 h-4" aria-hidden="true" />
                        <span>قراءة المدونة والمقالات</span>
                      </button>
                    )}
                    {flags.showReflections !== false && (
                      <button
                        type="button"
                        onClick={() => goPage('reflections')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-semibold text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        <Feather className="w-4 h-4" aria-hidden="true" />
                        <span>تصفح الخواطر</span>
                      </button>
                    )}
                    {!user && (
                      <button
                        type="button"
                        onClick={onGoogleSignIn}
                        className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" aria-hidden="true" />
                        <span>دخول الحساب</span>
                      </button>
                    )}
                  </div>
                </div>

                {!heroImgFailed && (
                  <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full bg-slate-100 border-t lg:border-t-0 lg:border-r border-slate-200">
                    <img
                      src={HERO_IMAGE_PATH}
                      alt={siteConfig.heroTitle}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full lg:absolute lg:inset-0 object-cover"
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Granular Granted Workspace Content for Signed-In Non-Admin Accounts */}
          {user && !isAdmin && (loadingGranted || totalGrantedCount > 0) && (
            <section className="bg-white border border-[#1E3A5F]/25 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
                    <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                      محتوى مخصّص لحسابك ({totalGrantedCount})
                    </h2>
                  </div>
                  {adminNotesForUser && (
                    <p className="text-xs text-[#1E3A5F]">{adminNotesForUser}</p>
                  )}
                </div>
                {loadingGranted && (
                  <Loader2
                    className="w-4 h-4 animate-spin text-[#1E3A5F]"
                    aria-hidden="true"
                  />
                )}
              </div>

              {grantedCourses.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <GraduationCap
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <span>كورسات مخصّصة لك ({grantedCourses.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {grantedCourses.map((course) => {
                      const hub = getHubMeta(course.hubId);
                      return (
                        <article
                          key={course.docId || course.id}
                          onClick={() => openCourseModal(course)}
                          className="p-4 rounded-xl bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 space-y-2 cursor-pointer transition-colors"
                        >
                          <p className="text-[11px] font-semibold text-[#1E3A5F]">
                            {hub.title} · {course.category}
                          </p>
                          <h4 className="font-editorial text-base font-bold text-slate-900">
                            {course.title}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F]">
                            <span>عرض الكورس وتلخيصاته</span>
                            <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                          </span>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {grantedNotes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <NotebookPen
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <span>تلخيصات وملاحظات مخصّصة لك ({grantedNotes.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {grantedNotes.map((bn) => (
                      <article
                        key={bn.id}
                        onClick={() => setDetailModal({ type: 'note', item: bn })}
                        className="p-4 rounded-xl bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 space-y-1.5 cursor-pointer transition-colors"
                      >
                        <p className="text-[11px] text-slate-500 truncate">
                          {bn.courseTitle || bn.author || 'تلخيص وملاحظة'}
                        </p>
                        <h4 className="font-editorial text-base font-bold text-slate-900 line-clamp-1">
                          <BidiText text={bn.bookTitle} />
                        </h4>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F]">
                          <span>قراءة الملخص والمرفقات</span>
                          <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                        </span>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {(grantedPaths.length > 0 || grantedBooks.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {grantedPaths.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <MapIcon
                          className="w-4 h-4 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>مسارات مخصّصة ({grantedPaths.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {grantedPaths.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setDetailModal({ type: 'path', item: p })}
                            className="w-full text-right p-3.5 rounded-xl bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 space-y-1 cursor-pointer"
                          >
                            <p className="text-sm font-bold text-slate-900">
                              {p.title}
                            </p>
                            {p.description && (
                              <p className="text-xs text-slate-600 line-clamp-2">
                                {p.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {grantedBooks.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <BookOpen
                          className="w-4 h-4 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>كتب ومصادر مخصّصة ({grantedBooks.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {grantedBooks.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setDetailModal({ type: 'book', item: b })}
                            className="w-full text-right p-3.5 rounded-xl bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 space-y-1 cursor-pointer"
                          >
                            <p className="text-sm font-bold text-slate-900">
                              {b.title}
                            </p>
                            {b.author && (
                              <p className="text-xs text-slate-500">{b.author}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {grantedReflections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Feather
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <span>خواطر مخصّصة لحسابك ({grantedReflections.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {grantedReflections.map((r) => {
                      const style = getReflectionCardStyle(r);
                      return (
                        <article
                          key={r.id}
                          onClick={() =>
                            setDetailModal({ type: 'reflection', item: r })
                          }
                          className={`rounded-xl border overflow-hidden cursor-pointer ${style.cardBg} ${style.cardBorder}`}
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
                          <div className="p-4 space-y-1.5">
                            <p className={`text-[11px] font-semibold ${style.accentText}`}>
                              {r.moodTag}
                              {r.categoryTag ? ` · ${r.categoryTag}` : ''}
                            </p>
                            <h4 className="font-editorial text-base font-bold text-slate-900 line-clamp-1">
                              <BidiText text={r.title} />
                            </h4>
                            <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">
                              <BidiText text={r.content} />
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Background & Philosophy */}
          {(flags.showBackground || flags.showPhilosophy) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {flags.showBackground && siteConfig.backgroundText && (
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <UserIcon
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h2 className="font-editorial text-lg font-bold text-slate-900">
                      الخلفية والمسار المهني
                    </h2>
                  </div>
                  <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap">
                    {siteConfig.backgroundText}
                  </p>
                </section>
              )}

              {flags.showPhilosophy && siteConfig.philosophyText && (
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Compass
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h2 className="font-editorial text-lg font-bold text-slate-900">
                      فلسفة التعلّم وبناء المعرفة
                    </h2>
                  </div>
                  <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap">
                    {siteConfig.philosophyText}
                  </p>
                </section>
              )}
            </div>
          )}

          {/* Skills & Interests */}
          {((flags.showSkills && siteConfig.skills.length > 0) ||
            (flags.showInterests && siteConfig.interests.length > 0)) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {flags.showSkills && siteConfig.skills.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h2 className="font-editorial text-lg font-bold text-slate-900">
                      المهارات والخبرات
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {siteConfig.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1.5 text-xs font-medium bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {flags.showInterests && siteConfig.interests.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h2 className="font-editorial text-lg font-bold text-slate-900">
                      الاهتمامات المعرفية
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {siteConfig.interests.map((interest) => (
                      <span
                        key={interest}
                        className="px-3 py-1.5 text-xs font-medium bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Custom Admin Sections */}
          {visibleSections.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {visibleSections.map((sec) => (
                <section
                  key={sec.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5"
                >
                  <h2 className="font-editorial text-lg font-bold text-slate-900">
                    {sec.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap">
                    {sec.body}
                  </p>
                </section>
              ))}
            </div>
          )}

          {/* Published Catalog Loading */}
          {loadingCatalog && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>جاري تحميل المواد المنشورة للعرض العام...</span>
            </div>
          )}

          {/* Teaser for Published Blogs */}
          {flags.showBlogs !== false && publicBlogs.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpenText
                    className="w-5 h-5 text-[#1E3A5F]"
                    aria-hidden="true"
                  />
                  <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                    من المدونة والمقالات ({publicBlogs.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => goPage('blogs')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  <span>تصفح المدونة الكاملة</span>
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicBlogs.slice(0, 3).map((post) => (
                  <article
                    key={post.id}
                    onClick={() => setDetailModal({ type: 'blog', item: post })}
                    className="bg-white border border-slate-200 hover:border-[#1E3A5F]/45 rounded-2xl overflow-hidden cursor-pointer transition-colors flex flex-col justify-between"
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
                      <div className="p-5 space-y-2">
                        <p className="text-[11px] font-semibold text-[#1E3A5F] tabular-nums">
                          {post.categoryLabel || 'مقال'} ·{' '}
                          {post.readingTimeMinutes ||
                            estimateReadingTimeMinutes(post.content)}{' '}
                          د قراءة
                        </p>
                        <h3 className="font-editorial text-lg font-bold text-slate-900 line-clamp-2">
                          <BidiText text={post.title} />
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          <BidiText text={post.excerpt || post.content} />
                        </p>
                      </div>
                    </div>
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>{post.createdAtLabel}</span>
                      <span className="font-semibold text-[#1E3A5F]">اقرأ ←</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Published Courses */}
          {flags.showCourses && publicCourses.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <GraduationCap
                  className="w-5 h-5 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                  الكورسات المختارة ({publicCourses.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicCourses.map((course) => {
                  const hub = getHubMeta(course.hubId);
                  return (
                    <article
                      key={course.docId}
                      onClick={() => openCourseModal(course)}
                      className="bg-white border border-slate-200 hover:border-[#1E3A5F]/50 rounded-2xl p-5 space-y-3 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-[#1E3A5F]">
                          {hub.title} · {course.category}
                        </span>
                        <span className="tabular-nums">
                          {course.progressPct ?? 0}%
                        </span>
                      </div>
                      <h3 className="font-editorial text-lg font-bold text-slate-900">
                        {course.title}
                      </h3>
                      {(course.instructor || course.platform) && (
                        <p className="text-xs text-slate-500">
                          {[course.instructor, course.platform]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-[#1E3A5F]">
                        <span>عرض التفاصيل والأهداف</span>
                        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Published Learning Paths */}
          {flags.showPaths && publicPaths.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <MapIcon
                  className="w-5 h-5 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                  مسارات التعلّم ({publicPaths.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicPaths.map((path) => {
                  const hub = getHubMeta(path.hubId);
                  return (
                    <article
                      key={path.id}
                      onClick={() => setDetailModal({ type: 'path', item: path })}
                      className="bg-white border border-slate-200 hover:border-[#1E3A5F]/50 rounded-2xl p-5 space-y-3 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-[#1E3A5F]">
                          {hub.title}
                          {path.categoryLabel ? ` · ${path.categoryLabel}` : ''}
                        </span>
                        <span className="tabular-nums">{path.progressPct}%</span>
                      </div>
                      <h3 className="font-editorial text-lg font-bold text-slate-900">
                        {path.title}
                      </h3>
                      {path.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {path.description}
                        </p>
                      )}
                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-[#1E3A5F]">
                        <span>عرض المراحل والأهداف</span>
                        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Published Books / Reading Library */}
          {flags.showBooks && publicBooks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen
                  className="w-5 h-5 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                  مكتبة القراءة والكتب المختارة ({publicBooks.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicBooks.map((book) => {
                  const hub = getHubMeta(book.hubId);
                  return (
                    <article
                      key={book.id}
                      onClick={() => setDetailModal({ type: 'book', item: book })}
                      className="bg-white border border-slate-200 hover:border-[#1E3A5F]/50 rounded-2xl p-5 space-y-3 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-[#1E3A5F]">
                          {hub.title} · {book.itemType}
                        </span>
                        {book.totalPages > 0 && (
                          <span className="tabular-nums">
                            {book.currentPage} / {book.totalPages} ص
                          </span>
                        )}
                      </div>
                      <h3 className="font-editorial text-lg font-bold text-slate-900">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-xs text-slate-500">{book.author}</p>
                      )}
                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-[#1E3A5F]">
                        <span>عرض الملخص والملف</span>
                        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Teaser for Published Reflections */}
          {flags.showReflections !== false && publicReflections.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Feather
                    className="w-5 h-5 text-[#1E3A5F]"
                    aria-hidden="true"
                  />
                  <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                    خواطر وتأملات منشورة ({publicReflections.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => goPage('reflections')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  <span>استكشف جميع الخواطر</span>
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {publicReflections.slice(0, 3).map((r) => {
                  const style = getReflectionCardStyle(r);
                  return (
                    <article
                      key={r.id}
                      onClick={() =>
                        setDetailModal({ type: 'reflection', item: r })
                      }
                      className={`rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-sm ${style.cardBg} ${style.cardBorder}`}
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
                      <div className="p-4 space-y-2">
                        <p className={`text-[11px] font-semibold ${style.accentText}`}>
                          {r.moodTag}
                          {r.categoryTag ? ` · ${r.categoryTag}` : ''}
                        </p>
                        <h3 className="font-editorial text-base font-bold text-slate-900 line-clamp-1">
                          <BidiText text={r.title} />
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                          <BidiText text={r.content} />
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ================= PAGE 2: PUBLIC REFLECTIONS SHOWCASE ================= */}
      {publicPage === 'reflections' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="space-y-1.5 max-w-2xl">
              <p className="text-xs font-semibold text-[#1E3A5F]">
                تأملات يومية وأفكار منتقاة
              </p>
              <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-slate-900">
                الخواطر والتأملات
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                مجموعة من الخواطر الفكرية والوقفات التأملية المنتقاة للقراءة المتأنية.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={reflSearch}
                  onChange={(e) => setReflSearch(e.target.value)}
                  placeholder="ابحث في الخواطر..."
                  className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {MOOD_FILTERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReflMoodFilter(m)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      reflMoodFilter === m
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m === 'all' ? 'الكل' : m}
                  </button>
                ))}
              </div>

              {reflectionCategories.length > 0 && (
                <select
                  value={reflCatFilter}
                  onChange={(e) => setReflCatFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl"
                >
                  <option value="all">كل التصنيفات</option>
                  {reflectionCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </section>

          {filteredPublicReflections.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
              <Feather
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-700">
                لا توجد خواطر منشورة مطابقة حاليًا.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPublicReflections.map((r) => {
                const style = getReflectionCardStyle(r);
                return (
                  <article
                    key={r.id}
                    onClick={() =>
                      setDetailModal({ type: 'reflection', item: r })
                    }
                    className={`rounded-2xl border overflow-hidden cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between ${style.cardBg} ${style.cardBorder}`}
                  >
                    <div>
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
                      <div className="p-5 space-y-2">
                        <p className={`text-[11px] font-semibold ${style.accentText}`}>
                          {r.moodTag}
                          {r.categoryTag ? ` · ${r.categoryTag}` : ''}
                        </p>
                        <h3 className="font-editorial text-lg font-bold text-slate-900">
                          <BidiText text={r.title} />
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                          <BidiText text={r.content} />
                        </p>
                      </div>
                    </div>
                    <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{r.createdAtLabel}</span>
                      <span className={`font-semibold ${style.accentText}`}>
                        قراءة كاملة ←
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= PAGE 3: PUBLIC BLOGS / EDITORIAL MAGAZINE ================= */}
      {publicPage === 'blogs' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="space-y-1.5 max-w-2xl">
              <p className="text-xs font-semibold text-[#1E3A5F]">
                مقالات ودراسات منشورة
              </p>
              <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-slate-900">
                المدونة والمقالات
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                مقالات متكاملة في الفكر، التطوير المهني، والتعلّم العميق — صُمّمت لتمنحك تجربة قراءة صافية ومريحة.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={blogSearch}
                  onChange={(e) => setBlogSearch(e.target.value)}
                  placeholder="ابحث في المقالات..."
                  className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                />
              </div>

              {blogCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBlogCatFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      blogCatFilter === 'all'
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    الكل
                  </button>
                  {blogCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBlogCatFilter(c)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                        blogCatFilter === c
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {filteredPublicBlogs.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
              <BookOpenText
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-700">
                لا توجد مقالات منشورة مطابقة حاليًا.
              </p>
            </div>
          ) : (
            <>
              {/* Lead Featured Article */}
              {(() => {
                const lead = filteredPublicBlogs[0];
                const mins =
                  lead.readingTimeMinutes ||
                  estimateReadingTimeMinutes(lead.content);
                return (
                  <article
                    onClick={() => setDetailModal({ type: 'blog', item: lead })}
                    className="bg-white border border-slate-200 hover:border-[#1E3A5F]/45 rounded-2xl overflow-hidden cursor-pointer transition-colors grid grid-cols-1 lg:grid-cols-12 items-stretch"
                  >
                    {(lead.coverImageUrl || lead.coverStoragePath) && (
                      <div className="lg:col-span-5 bg-slate-100 border-b lg:border-b-0 lg:border-l border-slate-100">
                        <FramedImage
                          srcUrl={lead.coverImageUrl}
                          storagePath={lead.coverStoragePath}
                          frame={lead.coverFrame}
                          alt={lead.title}
                          mode="card"
                          className="h-full"
                        />
                      </div>
                    )}
                    <div
                      className={`${
                        lead.coverImageUrl || lead.coverStoragePath
                          ? 'lg:col-span-7'
                          : 'lg:col-span-12'
                      } p-6 sm:p-8 flex flex-col justify-between gap-4`}
                    >
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
                          {lead.categoryLabel || 'مقال مختار'} · {mins} دقائق قراءة · {lead.createdAtLabel}
                        </p>
                        <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                          <BidiText text={lead.title} />
                        </h2>
                        {lead.subtitle && (
                          <p className="text-sm font-medium text-slate-600">
                            <BidiText text={lead.subtitle} />
                          </p>
                        )}
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
                          <BidiText text={lead.excerpt || lead.content} />
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F]">
                        <span>اقرأ المقال كاملاً</span>
                        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                    </div>
                  </article>
                );
              })()}

              {/* Remaining Articles Grid */}
              {filteredPublicBlogs.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPublicBlogs.slice(1).map((post) => {
                    const mins =
                      post.readingTimeMinutes ||
                      estimateReadingTimeMinutes(post.content);
                    return (
                      <article
                        key={post.id}
                        onClick={() =>
                          setDetailModal({ type: 'blog', item: post })
                        }
                        className="bg-white border border-slate-200 hover:border-[#1E3A5F]/45 rounded-2xl overflow-hidden cursor-pointer transition-colors flex flex-col justify-between"
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
                          <div className="p-5 space-y-2">
                            <p className="text-[11px] font-semibold text-[#1E3A5F] tabular-nums">
                              {post.categoryLabel || 'مقال'} · {mins} د قراءة
                            </p>
                            <h3 className="font-editorial text-lg font-bold text-slate-900 line-clamp-2">
                              <BidiText text={post.title} />
                            </h3>
                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                              <BidiText text={post.excerpt || post.content} />
                            </p>
                          </div>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>{post.createdAtLabel}</span>
                          <span className="font-semibold text-[#1E3A5F]">
                            قراءة ←
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Read-Only Public / Granted Detail Modal */}
      {detailModal && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#1E3A5F]">
                {detailModal.type === 'course'
                  ? 'تفاصيل الكورس'
                  : detailModal.type === 'note'
                  ? 'تلخيص وملاحظة'
                  : detailModal.type === 'path'
                  ? 'تفاصيل المسار التعلّمي'
                  : detailModal.type === 'reflection'
                  ? 'خاطرة وتأمل'
                  : detailModal.type === 'blog'
                  ? 'مقال من المدونة'
                  : 'تفاصيل الكتاب'}
              </span>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                aria-label="إغلاق"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
              {detailModal.type === 'course' && (
                <>
                  <div className="space-y-1.5">
                    <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                      {detailModal.item.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {[
                        detailModal.item.instructor,
                        detailModal.item.platform,
                        detailModal.item.durationLabel,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {detailModal.item.complementaryBook && (
                    <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl text-xs text-slate-700">
                      <span className="font-bold text-slate-900">
                        الكتاب المكمل:{' '}
                      </span>
                      {detailModal.item.complementaryBook}
                      {detailModal.item.bookAuthor
                        ? ` — ${detailModal.item.bookAuthor}`
                        : ''}
                    </div>
                  )}
                  <LearningObjectivesPanel
                    objectives={detailModal.item.learningObjectives}
                    readOnly
                  />
                  {detailModal.item.resources.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800">
                        المصادر والملفات المرفقة
                      </h4>
                      <div className="space-y-2">
                        {detailModal.item.resources.map((res) => (
                          <div
                            key={res.id}
                            className="p-3 bg-[#F7F8FA] border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-slate-800">
                              {res.title || res.attachmentName}
                            </span>
                            {(res.storagePath || res.downloadUrl) && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenPdf({
                                    title:
                                      res.title ||
                                      res.attachmentName ||
                                      'ملف مرفق',
                                    fileName:
                                      res.attachmentName || 'document.pdf',
                                    resourceId: res.id,
                                    storagePath: res.storagePath,
                                    downloadUrl: res.downloadUrl,
                                    mimeType: res.mimeType,
                                    contextLabel: detailModal.item.title,
                                    uid: effectiveOwnerUid,
                                  })
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                              >
                                عرض الملف
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailModal.linkedNotes &&
                    detailModal.linkedNotes.length > 0 && (
                      <div className="space-y-2.5 pt-3 border-t border-slate-200">
                        <h4 className="text-xs font-bold text-slate-800">
                          التلخيصات والملاحظات المفتوحة لهذا الكورس (
                          {detailModal.linkedNotes.length})
                        </h4>
                        <div className="space-y-2">
                          {detailModal.linkedNotes.map((bn) => (
                            <button
                              key={bn.id}
                              type="button"
                              onClick={() =>
                                setDetailModal({ type: 'note', item: bn })
                              }
                              className="w-full text-right p-3 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <span className="text-xs font-bold text-slate-900">
                                <BidiText text={bn.bookTitle} />
                              </span>
                              <span className="text-[11px] font-semibold text-[#1E3A5F]">
                                قراءة الملخص ←
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}

              {detailModal.type === 'note' && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">
                      {detailModal.item.courseTitle ||
                        detailModal.item.author ||
                        'تلخيص وملاحظة'}
                    </p>
                    <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                      <BidiText text={detailModal.item.bookTitle} />
                    </h3>
                    {detailModal.item.lectureTitle && (
                      <p className="text-xs text-[#1E3A5F] font-medium">
                        {detailModal.item.lectureTitle}
                      </p>
                    )}
                  </div>

                  {detailModal.item.content && (
                    <div
                      dir="auto"
                      className="rich-note-rendered text-sm text-slate-800 leading-relaxed bg-[#F7F8FA] border border-slate-200 rounded-xl p-4 sm:p-5"
                      dangerouslySetInnerHTML={{
                        __html: renderSafeBidiHtml(
                          ensureRichHtml(detailModal.item.content)
                        ),
                      }}
                    />
                  )}

                  {detailModal.item.quotes && (
                    <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
                      <h4 className="text-xs font-bold text-amber-900">
                        اقتباسات ومقتطفات
                      </h4>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {detailModal.item.quotes}
                      </p>
                    </div>
                  )}

                  {(detailModal.item.resources?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800">
                        الملفات المرفقة
                      </h4>
                      {(detailModal.item.resources || []).map((res) => (
                        <div
                          key={res.id}
                          className="p-3 bg-[#F7F8FA] border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="text-xs font-medium text-slate-800">
                            {res.title || res.attachmentName}
                          </span>
                          {(res.storagePath || res.downloadUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenPdf({
                                  title:
                                    res.title ||
                                    res.attachmentName ||
                                    'ملف مرفق',
                                  fileName:
                                    res.attachmentName || 'document.pdf',
                                  resourceId: res.id,
                                  storagePath: res.storagePath,
                                  downloadUrl: res.downloadUrl,
                                  mimeType: res.mimeType,
                                  contextLabel: detailModal.item.bookTitle,
                                  uid: effectiveOwnerUid,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                            >
                              عرض الملف
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {detailModal.type === 'path' && (
                <>
                  <div className="space-y-2">
                    <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                      {detailModal.item.title}
                    </h3>
                    {detailModal.item.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {detailModal.item.description}
                      </p>
                    )}
                    {detailModal.item.objectives && (
                      <p className="text-xs text-slate-500">
                        {detailModal.item.objectives}
                      </p>
                    )}
                  </div>
                  <LearningObjectivesPanel
                    objectives={detailModal.item.learningObjectives}
                    readOnly
                  />
                  {detailModal.item.stages.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800">
                        مراحل المسار ({detailModal.item.stages.length})
                      </h4>
                      <div className="space-y-2">
                        {detailModal.item.stages.map((st, idx) => (
                          <div
                            key={st.id}
                            className="p-3 bg-[#F7F8FA] border border-slate-200 rounded-lg text-xs"
                          >
                            <span className="font-bold text-slate-900">
                              {idx + 1}. {st.title}
                            </span>
                            {st.notes && (
                              <p className="text-slate-600 mt-1">{st.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {detailModal.type === 'book' && (
                <>
                  <div className="space-y-1.5">
                    <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                      {detailModal.item.title}
                    </h3>
                    {detailModal.item.author && (
                      <p className="text-xs text-slate-500">
                        المؤلف: {detailModal.item.author}
                      </p>
                    )}
                  </div>
                  {detailModal.item.takeaways && (
                    <div className="p-4 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-1">
                      <h4 className="text-xs font-bold text-slate-800">
                        أبرز الفوائد المستخلصة
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {detailModal.item.takeaways}
                      </p>
                    </div>
                  )}
                  <LearningObjectivesPanel
                    objectives={detailModal.item.learningObjectives}
                    readOnly
                  />
                  {(detailModal.item.storagePath ||
                    detailModal.item.downloadUrl) && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPdf({
                          title: detailModal.item.title,
                          fileName:
                            detailModal.item.attachmentName ||
                            `${detailModal.item.title}.pdf`,
                          resourceId: detailModal.item.attachmentResourceId,
                          storagePath: detailModal.item.storagePath,
                          downloadUrl: detailModal.item.downloadUrl,
                          contextLabel: 'المكتبة',
                          uid: effectiveOwnerUid,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" aria-hidden="true" />
                      <span>فتح ملف الكتاب</span>
                    </button>
                  )}
                </>
              )}

              {detailModal.type === 'reflection' && (
                <div className="space-y-4">
                  {(detailModal.item.imageUrl ||
                    detailModal.item.imageStoragePath) && (
                    <FramedImage
                      srcUrl={detailModal.item.imageUrl}
                      storagePath={detailModal.item.imageStoragePath}
                      frame={detailModal.item.imageFrame}
                      defaultFrame={DEFAULT_REFLECTION_IMAGE_FRAME}
                      alt={detailModal.item.title}
                      mode="modal"
                      className="rounded-xl border border-slate-200"
                    />
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#1E3A5F]">
                      {detailModal.item.moodTag}
                      {detailModal.item.categoryTag
                        ? ` · ${detailModal.item.categoryTag}`
                        : ''}
                    </p>
                    <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                      <BidiText text={detailModal.item.title} />
                    </h3>
                  </div>
                  <div className="text-sm text-slate-800 leading-loose whitespace-pre-wrap">
                    <BidiText text={detailModal.item.content} />
                  </div>
                </div>
              )}

              {detailModal.type === 'blog' && (
                <div className="space-y-5">
                  {(detailModal.item.coverImageUrl ||
                    detailModal.item.coverStoragePath) && (
                    <FramedImage
                      srcUrl={detailModal.item.coverImageUrl}
                      storagePath={detailModal.item.coverStoragePath}
                      frame={detailModal.item.coverFrame}
                      alt={detailModal.item.title}
                      mode="modal"
                      className="rounded-xl border border-slate-200"
                    />
                  )}
                  <div className="space-y-2 border-b border-slate-100 pb-4">
                    <p className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
                      {detailModal.item.categoryLabel || 'مقال'} ·{' '}
                      {detailModal.item.readingTimeMinutes ||
                        estimateReadingTimeMinutes(detailModal.item.content)}{' '}
                      دقائق قراءة · {detailModal.item.createdAtLabel}
                    </p>
                    <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                      <BidiText text={detailModal.item.title} />
                    </h3>
                    {detailModal.item.subtitle && (
                      <p className="text-sm sm:text-base font-medium text-slate-600 leading-relaxed">
                        <BidiText text={detailModal.item.subtitle} />
                      </p>
                    )}
                  </div>
                  <div className="text-sm sm:text-base text-slate-800 leading-loose whitespace-pre-wrap">
                    <BidiText text={detailModal.item.content} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
