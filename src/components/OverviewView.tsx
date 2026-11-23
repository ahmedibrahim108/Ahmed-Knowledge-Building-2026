import { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Compass,
  Eye,
  Feather,
  GraduationCap,
  ListTodo,
  LogIn,
  NotebookPen,
  Pin,
  Plus,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  Square,
} from 'lucide-react';
import {
  BookNote,
  CalendarEvent,
  CustomCategory,
  DEFAULT_HUB_CATEGORIES,
  DentalCase,
  DomainId,
  DomainInfo,
  HERO_IMAGE_PATH,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthPlan,
  PersonalCourse,
  PersonalReflection,
  PracticalProject,
  QuarterInfo,
  ReadingLibraryItem,
  ReflectionMood,
  StudyHistoryEntry,
  UnifiedTask,
  UserPreferences,
  VoiceDialectMode,
  WeeklyMeeting,
  WeeklyRhythmItem,
  getHubMeta,
  getTodayDateKey,
  resolveCourseStudyStage,
} from '../data/curriculumData';
import type { CloudAttachmentItem } from '../services/supabaseSync';
import BidiText from './BidiText';
import { ActiveTab } from './Header';
import type { ActivePdfTarget } from './PDFViewerModal';
import ProgressCharts from './ProgressCharts';
import TaskFormModal from './TaskFormModal';
import WeeklyRhythmSection from './WeeklyRhythmSection';

interface OverviewViewProps {
  user: User | null;
  canEdit: boolean;
  onRequireAuth: () => void;
  voiceDialect: VoiceDialectMode;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  quarters: QuarterInfo[];
  months: MonthPlan[];
  domains: DomainInfo[];
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  projects: PracticalProject[];
  unifiedTasks: UnifiedTask[];
  dentalCases?: DentalCase[];
  customCategories: CustomCategory[];
  history: StudyHistoryEntry[];
  reflections: PersonalReflection[];
  calendarEvents?: CalendarEvent[];
  weeklyMeetings?: WeeklyMeeting[];
  cloudAttachments?: CloudAttachmentItem[];
  onGoogleSignIn: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectHub: (hub: LearningHubId, targetTab: ActiveTab) => void;
  onSelectCourse: (courseId: number) => void;
  onJumpToMonth: (monthId: number) => void;
  onFilterByDomain: (domainId: DomainId) => void;
  onOpenNoteById: (noteId: string) => void;
  onOpenDentalCases?: () => void;
  onOpenPdf?: (target: ActivePdfTarget) => void;
  onAddUnifiedTask?: (task: Omit<UnifiedTask, 'id'>) => string | void;
  onUpdateUnifiedTask?: (id: string, updates: Partial<UnifiedTask>) => void;
  onDeleteUnifiedTask?: (id: string) => void;
  onAddWeeklyMeeting?: (meeting: Omit<WeeklyMeeting, 'id'>) => void;
  onUpdateWeeklyMeeting?: (id: string, updates: Partial<WeeklyMeeting>) => void;
  onDeleteWeeklyMeeting?: (id: string) => void;
  onAddCustomCategory: (
    title: string,
    description: string,
    color: CustomCategory['color']
  ) => void;
  onDeleteCustomCategory: (id: string) => void;
  onDeleteHistoryEntry: (id: string) => void;
  onAddReflection: (payload: {
    title: string;
    content: string;
    moodTag: ReflectionMood;
  }) => string | void;
  onUpdateReflection: (
    id: string,
    updates: Partial<PersonalReflection>
  ) => void;
  onDeleteReflection: (id: string) => void;
  onPreviewPublicSite?: () => void;
}

export default function OverviewView({
  user,
  canEdit,
  onRequireAuth,
  preferences,
  onUpdatePreferences,
  quarters,
  months,
  courses,
  bookNotes,
  learningPaths,
  readingItems,
  projects,
  unifiedTasks,
  dentalCases = [],
  reflections,
  onGoogleSignIn,
  onNavigateTab,
  onSelectHub,
  onSelectCourse,
  onJumpToMonth,
  onOpenNoteById,
  onOpenDentalCases,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onDeleteUnifiedTask,
  onPreviewPublicSite,
}: OverviewViewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'today_overdue'>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<UnifiedTask | null>(null);

  const today = getTodayDateKey();
  const focusCoursesCount = courses.filter(
    (c) => resolveCourseStudyStage(c) === 'focus_now'
  ).length;

  // Progress Tracker calculations (retained cleanly for ProgressCharts)
  const totalActivities = months.length * 4;
  const completedActivities = months.reduce(
    (acc, m) => acc + Object.values(m.activities).filter(Boolean).length,
    0
  );
  const completedCourses = courses.filter((c) => c.completed).length;
  const totalSmallTasks =
    months.reduce((acc, m) => acc + m.tasks.length, 0) +
    courses.reduce((acc, c) => acc + c.tasks.length, 0);
  const completedSmallTasks =
    months.reduce((acc, m) => acc + m.tasks.filter((t) => t.done).length, 0) +
    courses.reduce((acc, c) => acc + c.tasks.filter((t) => t.done).length, 0);

  const overallProgressPct = useMemo(() => {
    const parts: number[] = [];
    if (totalActivities > 0) parts.push(completedActivities / totalActivities);
    if (totalSmallTasks > 0) parts.push(completedSmallTasks / totalSmallTasks);
    if (courses.length > 0) parts.push(completedCourses / courses.length);
    if (parts.length === 0) return 0;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  }, [
    totalActivities,
    completedActivities,
    totalSmallTasks,
    completedSmallTasks,
    courses.length,
    completedCourses,
  ]);

  const activeTasksList = useMemo(() => {
    const priOrder = { high: 0, medium: 1, low: 2 };
    return unifiedTasks
      .filter((t) => {
        if (t.status === 'done') return false;
        if (agendaFilter === 'today_overdue') {
          const targetDate = t.scheduledDate || t.dueDate || '';
          return (
            (Boolean(targetDate) && targetDate <= today) ||
            (Boolean(t.deadline) && (t.deadline ?? '') <= today)
          );
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const da = a.scheduledDate || a.dueDate || '9999-99-99';
        const db = b.scheduledDate || b.dueDate || '9999-99-99';
        if (da !== db) return da.localeCompare(db);
        return priOrder[a.priority] - priOrder[b.priority];
      })
      .slice(0, 7);
  }, [unifiedTasks, agendaFilter, today]);

  const latestReflections = useMemo(() => {
    return [...reflections]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      })
      .slice(0, 3);
  }, [reflections]);

  const dueItems = useMemo(() => {
    const list: Array<{
      key: string;
      kind: 'course' | 'note' | 'library';
      title: string;
      hubId: LearningHubId;
      nextDate?: string;
      listenCount: number;
      reviewCount: number;
      courseId?: number;
      noteId?: string;
    }> = [];

    for (const c of courses) {
      const isDue = Boolean(c.nextReviewDateKey) && (c.nextReviewDateKey ?? '') <= today;
      const isRepeated = (c.listenCount ?? 0) >= 2 || (c.reviewCount ?? 0) >= 2;
      if (isDue || isRepeated) {
        list.push({
          key: `course-${c.id}`,
          kind: 'course',
          title: c.title,
          hubId: c.hubId ?? 'knowledge',
          nextDate: c.nextReviewDateKey,
          listenCount: c.listenCount ?? 0,
          reviewCount: c.reviewCount ?? 0,
          courseId: c.id,
        });
      }
    }

    for (const n of bookNotes) {
      const isDue = Boolean(n.nextReviewDateKey) && (n.nextReviewDateKey ?? '') <= today;
      const isRepeated = (n.listenCount ?? 0) >= 2 || (n.reviewCount ?? 0) >= 2;
      if (isDue || isRepeated) {
        list.push({
          key: `note-${n.id}`,
          kind: 'note',
          title: n.bookTitle,
          hubId: n.hubId ?? 'knowledge',
          nextDate: n.nextReviewDateKey,
          listenCount: n.listenCount ?? 0,
          reviewCount: n.reviewCount ?? 0,
          noteId: n.id,
        });
      }
    }

    for (const item of readingItems) {
      const isDue = Boolean(item.nextReviewDateKey) && (item.nextReviewDateKey ?? '') <= today;
      const isRepeated = (item.listenCount ?? 0) >= 2 || (item.reviewCount ?? 0) >= 2;
      if (isDue || isRepeated) {
        list.push({
          key: `lib-${item.id}`,
          kind: 'library',
          title: item.title,
          hubId: item.hubId ?? 'knowledge',
          nextDate: item.nextReviewDateKey,
          listenCount: item.listenCount ?? 0,
          reviewCount: item.reviewCount ?? 0,
        });
      }
    }

    return list;
  }, [courses, bookNotes, readingItems, today]);

  const handleSaveRhythm = (next: WeeklyRhythmItem[]) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    onUpdatePreferences({ weeklyRhythm: next });
  };

  return (
    <div className="space-y-8">
      {/* Calm Workspace Hero */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-3.5">
              <p className="text-xs font-medium text-slate-500">
                {user
                  ? `أهلاً بك، ${user.displayName || 'باحث المعرفة'}`
                  : 'لوحة المتابعة الشخصية'}
              </p>

              <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-slate-900 leading-snug">
                لوحة المعرفة الشخصية: تركيزٌ هادئ وبناءٌ متدرج
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                مساحة يومية واضحة لمتابعة المهام النشطة، والتركيز الحالي، وإيقاع التعلّم الأسبوعي دون تشوش أو قوائم مزدحمة.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('focus')}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] rounded-xl hover:bg-[#162C49] transition-colors cursor-pointer"
              >
                <span>التركيز الحالي ({focusCoursesCount})</span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              {onAddUnifiedTask && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) return onRequireAuth();
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-semibold text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>مهمة جديدة</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateTab('journal')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-medium text-slate-700 bg-[#F7F8FA] border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <NotebookPen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>دفتر التلخيص</span>
              </button>

              {onPreviewPublicSite && (
                <button
                  type="button"
                  onClick={onPreviewPublicSite}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                  <span>الموقع العام</span>
                </button>
              )}

              {!user && (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-medium text-[#1E3A5F] border border-[#1E3A5F]/25 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>دخول بحساب Google</span>
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full bg-slate-100 border-t lg:border-t-0 lg:border-r border-slate-200">
            {!imgFailed ? (
              <img
                src={HERO_IMAGE_PATH}
                alt="مكتب دراسي هادئ يضم كتبًا مفتوحة ودفتر تلخيص"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full lg:absolute lg:inset-0 object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-slate-200">
                <BookOpen className="w-10 h-10 text-slate-400 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-700">
                  مساحة القراءة والتأمل المتوازن
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3-Hub Quick Navigation Strip */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
            محاور التعلّم الثلاثة
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab('account')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>مركز الحساب والإدارة والخطة السنوية</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {LEARNING_HUBS.map((hub) => {
            const hCourses = courses.filter(
              (c) => (c.hubId ?? 'knowledge') === hub.id
            );
            const hPaths = learningPaths.filter((p) => p.hubId === hub.id);
            const hLibrary = readingItems.filter((r) => r.hubId === hub.id);

            return (
              <div
                key={hub.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${hub.badgeClass}`}
                  >
                    {hub.shortTitle}
                  </span>
                  <h3 className="font-editorial text-lg font-bold text-slate-900">
                    {hub.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {hCourses.length} كورسات · {hPaths.length} مسارات · {hLibrary.length} مصادر
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'courses')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>الكورسات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'paths')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-[#F7F8FA] hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المسارات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'library')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-[#F7F8FA] hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المكتبة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'tasks')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-[#F7F8FA] hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المهام</span>
                  </button>
                  {hub.id === 'dental_career' && onOpenDentalCases && (
                    <button
                      type="button"
                      onClick={onOpenDentalCases}
                      className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                      <span>ملف حالات طب الأسنان ({dentalCases.length})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Simplified Tasks & Reflections Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tasks Card */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                المهام والجدول القادم
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setAgendaFilter('all')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    agendaFilter === 'all'
                      ? 'bg-white text-[#1E3A5F] font-semibold'
                      : 'text-slate-600'
                  }`}
                >
                  النشطة
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaFilter('today_overdue')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    agendaFilter === 'today_overdue'
                      ? 'bg-white text-[#1E3A5F] font-semibold'
                      : 'text-slate-600'
                  }`}
                >
                  اليوم والمتأخر
                </button>
              </div>

              {onAddUnifiedTask && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canEdit) return onRequireAuth();
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة</span>
                </button>
              )}
            </div>
          </div>

          {activeTasksList.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#F7F8FA] border border-dashed border-slate-200 text-center text-xs text-slate-500">
              لا توجد مهام نشطة في هذا العرض حاليًا.
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasksList.map((t) => {
                const tDate = t.scheduledDate || t.dueDate || '';
                const isOverdue = Boolean(tDate && tDate < today);
                return (
                  <div
                    key={t.id}
                    className="p-3 bg-[#F7F8FA] border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return onRequireAuth();
                        onUpdateUnifiedTask?.(t.id, {
                          status: t.status === 'done' ? 'todo' : 'done',
                        });
                      }}
                      className="flex items-center gap-2.5 text-right flex-1 min-w-0 cursor-pointer"
                    >
                      {t.status === 'done' ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums truncate">
                          {tDate ? tDate : 'غير مجدولة'}
                          {t.startTime ? ` · ${t.startTime}` : ''}
                          {t.linkedLabel ? ` · ${t.linkedLabel}` : ''}
                          {isOverdue ? ' · متأخرة' : ''}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return onRequireAuth();
                        setEditingTask(t);
                        setTaskModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer shrink-0"
                    >
                      تعديل
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-1 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('tasks')}
              className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              إدارة كل المهام والمشاريع ←
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('calendar')}
              className="font-semibold text-slate-600 hover:text-[#1E3A5F] cursor-pointer"
            >
              فتح التقويم ←
            </button>
          </div>
        </section>

        {/* Compact Reflections Preview Card */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Feather className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                خواطري وتأملاتي
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('reflections')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              <span>كل الخواطر ({reflections.length})</span>
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {latestReflections.length === 0 ? (
            <div className="p-5 rounded-xl bg-[#F7F8FA] border border-dashed border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">
                مساحتك الخاصة للأفكار والخواطر الشخصية.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('reflections')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
              >
                اكتب أول خاطرة
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {latestReflections.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onNavigateTab('reflections')}
                  className="w-full text-right p-3.5 rounded-xl bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 space-y-1 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-[#1E3A5F]">
                      {r.moodTag}
                      {r.categoryTag ? ` · ${r.categoryTag}` : ''}
                    </span>
                    {r.pinned && (
                      <Pin className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    <BidiText text={r.title} />
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    <BidiText text={r.content} />
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Interactive Weekly Rhythm Cards + Editor Popup */}
      <WeeklyRhythmSection
        items={preferences.weeklyRhythm}
        canEdit={canEdit}
        onSaveRhythm={handleSaveRhythm}
      />

      {/* Spaced Repetition Tracker (Only when items exist) */}
      {dueItems.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                المستحق للمراجعة والتكرار المتباعد ({dueItems.length})
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueItems.slice(0, 6).map((item) => {
              const hubMeta = getHubMeta(item.hubId);
              const isDue = Boolean(item.nextDate) && (item.nextDate ?? '') <= today;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (item.kind === 'course' && item.courseId) {
                      onSelectCourse(item.courseId);
                    } else if (item.kind === 'note' && item.noteId) {
                      onOpenNoteById(item.noteId);
                    } else {
                      onNavigateTab('library');
                    }
                  }}
                  className="p-3.5 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-right space-y-1.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-[#1E3A5F]">
                      {hubMeta.shortTitle}
                    </span>
                    {isDue && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-semibold">
                        مستحق اليوم
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-600 tabular-nums">
                    مراجعات: {item.reviewCount}×
                    {item.nextDate ? ` · القادم: ${item.nextDate}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Visual Progress Charts */}
      <section
        id="progress-tracker"
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              مؤشرات التقدّم البصرية
            </h2>
            <p className="text-xs text-slate-500">
              نظرة بيانية موجزة على الإنجاز في الوحدات والكورسات والمهام.
            </p>
          </div>
          <div className="text-left shrink-0">
            <span className="block text-[11px] text-slate-500">معدل الإنجاز الكلي</span>
            <span className="text-2xl font-bold text-[#1E3A5F] tabular-nums">
              {overallProgressPct}%
            </span>
          </div>
        </div>

        <ProgressCharts
          months={months}
          quarters={quarters}
          courses={courses}
          overallProgressPct={overallProgressPct}
          completedSmallTasks={completedSmallTasks}
          totalSmallTasks={totalSmallTasks}
          completedActivities={completedActivities}
          totalActivities={totalActivities}
          completedCourses={completedCourses}
          onJumpToMonth={onJumpToMonth}
        />
      </section>

      {onAddUnifiedTask && (
        <TaskFormModal
          open={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setEditingTask(null);
          }}
          initialTask={editingTask}
          courses={courses}
          learningPaths={learningPaths}
          readingItems={readingItems}
          projects={projects}
          hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
          onSubmit={(payload, existingId) => {
            if (existingId) {
              onUpdateUnifiedTask?.(existingId, payload);
            } else {
              onAddUnifiedTask(payload);
            }
          }}
          onDelete={onDeleteUnifiedTask}
        />
      )}
    </div>
  );
}
