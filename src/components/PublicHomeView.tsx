import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
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
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  BookNote,
  GrantedWorkspaceData,
  HERO_IMAGE_PATH,
  LearningPath,
  PersonalCourse,
  PersonalReflection,
  PublicSiteConfig,
  ReadingLibraryItem,
  getHubMeta,
  getReflectionCardStyle,
} from '../data/curriculumData';
import type { UserProfileRecord } from '../services/supabaseSync';
import { ensureRichHtml, renderSafeBidiHtml } from '../utils/richText';
import BidiText from './BidiText';
import LearningObjectivesPanel from './LearningObjectivesPanel';
import type { ActivePdfTarget } from './PDFViewerModal';

interface PublicHomeViewProps {
  siteConfig: PublicSiteConfig;
  publicCourses: PersonalCourse[];
  publicPaths: LearningPath[];
  publicBooks: ReadingLibraryItem[];
  publicReflections?: PersonalReflection[];
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
  | null;

export default function PublicHomeView({
  siteConfig,
  publicCourses,
  publicPaths,
  publicBooks,
  publicReflections = [],
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

  return (
    <div className="space-y-8 pb-12">
      {/* Admin Preview Strip */}
      {isAdmin && onReturnToAdmin && (
        <div className="bg-[#1E3A5F] text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              أنت تشاهد الآن معاينة الواجهة العامة كما يراها الزوار والمستخدمون العاديون.
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

      {/* Signed-in Non-Admin Info Banner */}
      {user && !isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#1E3A5F] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                مرحبًا {user.displayName || userProfile?.display_name || user.email}
              </p>
              <p className="text-xs text-slate-600">
                {totalGrantedCount > 0
                  ? `لديك محتوى مخصّص ومفتوح لحسابك (${totalGrantedCount} عنصر) بالإضافة إلى المواد المنشورة للعامة.`
                  : 'حسابك مسجّل بصلاحية القراءة العامة فقط. يمكنك تصفح السيرة العامة والمواد المنشورة أدناه بكل هدوء.'}
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

              {!user && (
                <div>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>تسجيل الدخول بحساب Google</span>
                  </button>
                </div>
              )}
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
              <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" aria-hidden="true" />
            )}
          </div>

          {grantedCourses.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                <NotebookPen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                    <MapIcon className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                        <p className="text-sm font-bold text-slate-900">{p.title}</p>
                        {p.description && (
                          <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grantedBooks.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                        <p className="text-sm font-bold text-slate-900">{b.title}</p>
                        {b.author && <p className="text-xs text-slate-500">{b.author}</p>}
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
                <Feather className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>خواطر مخصّصة لحسابك ({grantedReflections.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grantedReflections.map((r) => {
                  const style = getReflectionCardStyle(r);
                  return (
                    <article
                      key={r.id}
                      onClick={() => setDetailModal({ type: 'reflection', item: r })}
                      className={`p-4 rounded-xl border space-y-1.5 cursor-pointer ${style.cardBg} ${style.cardBorder}`}
                    >
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
                <UserIcon className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                <Compass className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                <Sparkles className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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

      {/* Published Courses */}
      {flags.showCourses && publicCourses.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
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
                    <span className="tabular-nums">{course.progressPct ?? 0}%</span>
                  </div>
                  <h3 className="font-editorial text-lg font-bold text-slate-900">
                    {course.title}
                  </h3>
                  {(course.instructor || course.platform) && (
                    <p className="text-xs text-slate-500">
                      {[course.instructor, course.platform].filter(Boolean).join(' · ')}
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
            <MapIcon className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
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
            <BookOpen className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
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

      {/* Published Reflections */}
      {flags.showReflections !== false && publicReflections.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Feather className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
            <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
              خواطر وتأملات منشورة ({publicReflections.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {publicReflections.map((r) => {
              const style = getReflectionCardStyle(r);
              return (
                <article
                  key={r.id}
                  onClick={() => setDetailModal({ type: 'reflection', item: r })}
                  className={`rounded-xl border p-4 space-y-2 cursor-pointer transition-all hover:shadow-sm ${style.cardBg} ${style.cardBorder}`}
                >
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
                </article>
              );
            })}
          </div>
        </section>
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

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
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
                      <span className="font-bold text-slate-900">الكتاب المكمل: </span>
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
                                    title: res.title || res.attachmentName || 'ملف مرفق',
                                    fileName: res.attachmentName || 'document.pdf',
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

                  {detailModal.linkedNotes && detailModal.linkedNotes.length > 0 && (
                    <div className="space-y-2.5 pt-3 border-t border-slate-200">
                      <h4 className="text-xs font-bold text-slate-800">
                        التلخيصات والملاحظات المفتوحة لهذا الكورس ({detailModal.linkedNotes.length})
                      </h4>
                      <div className="space-y-2">
                        {detailModal.linkedNotes.map((bn) => (
                          <button
                            key={bn.id}
                            type="button"
                            onClick={() => setDetailModal({ type: 'note', item: bn })}
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
                      {detailModal.item.courseTitle || detailModal.item.author || 'تلخيص وملاحظة'}
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
                      <h4 className="text-xs font-bold text-amber-900">اقتباسات ومقتطفات</h4>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {detailModal.item.quotes}
                      </p>
                    </div>
                  )}

                  {(detailModal.item.resources?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800">الملفات المرفقة</h4>
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
                                  title: res.title || res.attachmentName || 'ملف مرفق',
                                  fileName: res.attachmentName || 'document.pdf',
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
