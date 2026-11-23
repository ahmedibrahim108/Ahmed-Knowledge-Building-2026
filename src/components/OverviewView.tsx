import { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  CheckSquare,
  Compass,
  Edit3,
  Eye,
  Feather,
  GraduationCap,
  Images,
  ListTodo,
  LogIn,
  NotebookPen,
  Pin,
  Plus,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  BookNote,
  CalendarEvent,
  CustomCategory,
  DEFAULT_HUB_CATEGORIES,
  DEFAULT_REFLECTION_IMAGE_FRAME,
  DentalCase,
  DomainId,
  DomainInfo,
  HERO_IMAGE_PATH,
  HUB_ACCENT_PRESETS,
  LearningHubId,
  LearningHubMeta,
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
  getReflectionCardStyle,
  getTodayDateKey,
  resolveCourseStudyStage,
  resolveLearningHubs,
  setActiveLearningHubs,
} from '../data/curriculumData';
import type { CloudAttachmentItem } from '../services/supabaseSync';
import AutoResizeTextarea from './AutoResizeTextarea';
import BidiText from './BidiText';
import { FramedImage } from './FramedImage';
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

  // Hub Create / Edit Modal State
  const [hubModalMode, setHubModalMode] = useState<'create' | 'edit' | null>(null);
  const [hubDraftId, setHubDraftId] = useState<string>('');
  const [hubDraftTitle, setHubDraftTitle] = useState('');
  const [hubDraftShortTitle, setHubDraftShortTitle] = useState('');
  const [hubDraftPurpose, setHubDraftPurpose] = useState('');
  const [hubDraftPresetId, setHubDraftPresetId] = useState<string>('indigo');
  const [hubDraftCategoriesText, setHubDraftCategoriesText] = useState('');

  const hubs = useMemo(
    () => resolveLearningHubs(preferences.customHubs),
    [preferences.customHubs]
  );

  const today = getTodayDateKey();
  const focusCoursesCount = courses.filter(
    (c) => resolveCourseStudyStage(c) === 'focus_now'
  ).length;

  void quarters;
  void months;
  void onJumpToMonth;

  const overallProgressPct = useMemo(() => {
    const parts: number[] = [];
    if (learningPaths.length > 0) {
      const avgPath =
        learningPaths.reduce((acc, p) => {
          const stTotal = p.stages.length;
          const stDone = p.stages.filter((s) => s.done).length;
          return acc + (stTotal > 0 ? stDone / stTotal : (p.progressPct ?? 0) / 100);
        }, 0) / learningPaths.length;
      parts.push(avgPath);
    }
    if (courses.length > 0) {
      const avgCourse =
        courses.reduce(
          (acc, c) => acc + (c.completed ? 1 : (c.progressPct ?? 0) / 100),
          0
        ) / courses.length;
      parts.push(avgCourse);
    }
    if (unifiedTasks.length > 0) {
      parts.push(
        unifiedTasks.filter((t) => t.status === 'done').length / unifiedTasks.length
      );
    }
    if (parts.length === 0) return 0;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  }, [learningPaths, courses, unifiedTasks]);

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
      const isDue =
        Boolean(c.nextReviewDateKey) && (c.nextReviewDateKey ?? '') <= today;
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
      const isDue =
        Boolean(n.nextReviewDateKey) && (n.nextReviewDateKey ?? '') <= today;
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
      const isDue =
        Boolean(item.nextReviewDateKey) && (item.nextReviewDateKey ?? '') <= today;
      const isRepeated =
        (item.listenCount ?? 0) >= 2 || (item.reviewCount ?? 0) >= 2;
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

  const openCreateHubModal = () => {
    if (!canEdit) return onRequireAuth();
    setHubDraftId(`hub_${Date.now()}`);
    setHubDraftTitle('');
    setHubDraftShortTitle('');
    setHubDraftPurpose('');
    setHubDraftPresetId('indigo');
    setHubDraftCategoriesText('عام\nأساسي\nمتقدم');
    setHubModalMode('create');
  };

  const openEditHubModal = (hub: LearningHubMeta) => {
    if (!canEdit) return onRequireAuth();
    setHubDraftId(hub.id);
    setHubDraftTitle(hub.title);
    setHubDraftShortTitle(hub.shortTitle);
    setHubDraftPurpose(hub.purpose);
    const matchingPreset =
      HUB_ACCENT_PRESETS.find((p) => p.accentHex === hub.accentHex) ??
      HUB_ACCENT_PRESETS[2];
    setHubDraftPresetId(matchingPreset.id);
    const currentCats =
      preferences.hubCategories?.[hub.id] &&
      preferences.hubCategories[hub.id].length > 0
        ? preferences.hubCategories[hub.id]
        : hub.defaultCategories;
    setHubDraftCategoriesText(currentCats.join('\n'));
    setHubModalMode('edit');
  };

  const handleSaveHubModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return onRequireAuth();
    const cleanTitle = hubDraftTitle.trim();
    if (!cleanTitle) return;
    const cleanShort = hubDraftShortTitle.trim() || cleanTitle;
    const preset =
      HUB_ACCENT_PRESETS.find((p) => p.id === hubDraftPresetId) ??
      HUB_ACCENT_PRESETS[2];
    const cats = Array.from(
      new Set(
        hubDraftCategoriesText
          .split(/[\n،,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    const effectiveCats = cats.length > 0 ? cats : ['عام', 'أساسي', 'متقدم'];

    const nextHubObj: LearningHubMeta = {
      id: hubDraftId,
      title: cleanTitle,
      shortTitle: cleanShort,
      englishTitle: cleanShort,
      purpose: hubDraftPurpose.trim(),
      accentHex: preset.accentHex,
      badgeClass: preset.badgeClass,
      defaultCategories: effectiveCats,
    };

    const nextHubs =
      hubModalMode === 'create'
        ? [...hubs, nextHubObj]
        : hubs.map((h) => (h.id === hubDraftId ? { ...h, ...nextHubObj } : h));

    const nextHubCats = {
      ...(preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES),
      [hubDraftId]: effectiveCats,
    };

    setActiveLearningHubs(nextHubs);
    onUpdatePreferences({
      customHubs: nextHubs,
      hubCategories: nextHubCats,
    });
    setHubModalMode(null);
  };

  const handleDeleteHub = (targetId: string) => {
    if (!canEdit || hubs.length <= 1) return;
    const nextHubs = hubs.filter((h) => h.id !== targetId);
    setActiveLearningHubs(nextHubs);
    onUpdatePreferences({ customHubs: nextHubs });
    setHubModalMode(null);
  };

  const gridColsClass =
    hubs.length >= 4
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
      : 'grid-cols-1 md:grid-cols-3';

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
                <NotebookPen
                  className="w-4 h-4 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <span>دفتر التلخيص</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('gallery')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-slate-700 bg-[#F7F8FA] border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Images
                  className="w-4 h-4 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <span>معرض الصور</span>
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
                alt="ساحة دراسة هادئة ذات أقواس بيضاء ونباتات خضراء"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full lg:absolute lg:inset-0 object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-slate-200">
                <BookOpen
                  className="w-10 h-10 text-slate-400 mb-3"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-slate-700">
                  مساحة القراءة والتأمل المتوازن
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Editable & Extensible Hubs Strip */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
            محاور التعلّم والتركيز ({hubs.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            {canEdit && (
              <button
                type="button"
                onClick={openCreateHubModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة مجال / محور {hubs.length + 1}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('account')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>الإدارة والحساب</span>
            </button>
          </div>
        </div>

        <div className={`grid ${gridColsClass} gap-4`}>
          {hubs.map((hub) => {
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
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${hub.badgeClass}`}
                    >
                      {hub.shortTitle}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditHubModal(hub)}
                        title={`تعديل ${hub.title}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-[#1E3A5F] hover:bg-slate-100 rounded-md cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" aria-hidden="true" />
                        <span>تعديل</span>
                      </button>
                    )}
                  </div>
                  <h3 className="font-editorial text-lg font-bold text-slate-900">
                    {hub.title}
                  </h3>
                  {hub.purpose && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {hub.purpose}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 leading-relaxed tabular-nums">
                    {hCourses.length} كورسات · {hPaths.length} مسارات ·{' '}
                    {hLibrary.length} مصادر
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
                    <Compass
                      className="w-3.5 h-3.5 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <span>المسارات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'library')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-[#F7F8FA] hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <BookOpen
                      className="w-3.5 h-3.5 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <span>المكتبة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'tasks')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-[#F7F8FA] hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <ListTodo
                      className="w-3.5 h-3.5 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <span>المهام</span>
                  </button>
                  {hub.id === 'dental_career' && onOpenDentalCases && (
                    <button
                      type="button"
                      onClick={onOpenDentalCases}
                      className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
                    >
                      <Sparkles
                        className="w-3.5 h-3.5 text-emerald-700"
                        aria-hidden="true"
                      />
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
              <CalendarDays
                className="w-4 h-4 text-[#1E3A5F]"
                aria-hidden="true"
              />
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
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-[#F7F8FA]/50 overflow-hidden">
              {activeTasksList.map((t) => {
                const tDate = t.scheduledDate || t.dueDate || '';
                const isOverdue = Boolean(tDate && tDate < today);
                const isToday = Boolean(tDate && tDate === today);
                const priLabel =
                  t.priority === 'high'
                    ? 'عالية'
                    : t.priority === 'low'
                    ? 'منخفضة'
                    : 'متوسطة';
                return (
                  <div
                    key={t.id}
                    className="px-3.5 py-2.5 bg-white hover:bg-[#F7F8FA] flex items-center justify-between gap-2.5 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return onRequireAuth();
                        onUpdateUnifiedTask?.(t.id, {
                          status: t.status === 'done' ? 'todo' : 'done',
                        });
                      }}
                      className="flex items-start gap-2.5 text-right flex-1 min-w-0 cursor-pointer"
                    >
                      {t.status === 'done' ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          <BidiText text={t.title} />
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                          <span
                            className={
                              isOverdue
                                ? 'font-semibold text-rose-700'
                                : isToday
                                ? 'font-semibold text-[#1E3A5F]'
                                : ''
                            }
                          >
                            {isToday ? 'اليوم' : tDate || 'غير مجدولة'}
                          </span>
                          {t.startTime && <span>· {t.startTime}</span>}
                          <span>· أولوية {priLabel}</span>
                          {t.linkedLabel && (
                            <span className="text-slate-600 truncate max-w-[180px]">
                              · {t.linkedLabel}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="font-semibold text-rose-700">
                              · متأخرة
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return onRequireAuth();
                        setEditingTask(t);
                        setTaskModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
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
              <Feather
                className="w-4 h-4 text-[#1E3A5F]"
                aria-hidden="true"
              />
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
              {latestReflections.map((r) => {
                const cardStyle = getReflectionCardStyle(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onNavigateTab('reflections')}
                    className={`w-full text-right rounded-xl border overflow-hidden transition-colors cursor-pointer ${cardStyle.cardBg} ${cardStyle.cardBorder}`}
                  >
                    {(r.imageUrl || r.imageStoragePath) && (
                      <FramedImage
                        srcUrl={r.imageUrl}
                        storagePath={r.imageStoragePath}
                        frame={r.imageFrame}
                        defaultFrame={{
                          ...DEFAULT_REFLECTION_IMAGE_FRAME,
                          customHeightPx: 92,
                        }}
                        alt={r.title}
                        mode="card"
                        className="border-b border-black/5"
                      />
                    )}
                    <div className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className={`font-semibold ${cardStyle.accentText}`}>
                          {r.moodTag}
                          {r.categoryTag ? ` · ${r.categoryTag}` : ''}
                        </span>
                        {r.pinned && (
                          <Pin
                            className={`w-3 h-3 ${cardStyle.accentText}`}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        <BidiText text={r.title} />
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        <BidiText text={r.content} />
                      </p>
                    </div>
                  </button>
                );
              })}
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

      {/* Spaced Repetition Tracker */}
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
              const hubMeta = getHubMeta(item.hubId, hubs);
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
              مؤشرات التقدّم في المسارات والكورسات
            </h2>
            <p className="text-xs text-slate-500">
              تمثيل مرئي لحجم الإنجاز في المسارات التعليمية، الكورسات النشطة، وعدد الملاحظات والمراجعات.
            </p>
          </div>
          <div className="text-left shrink-0">
            <span className="block text-[11px] text-slate-500">
              معدل التقدّم العام
            </span>
            <span className="text-2xl font-bold text-[#1E3A5F] tabular-nums">
              {overallProgressPct}%
            </span>
          </div>
        </div>

        <ProgressCharts
          courses={courses}
          learningPaths={learningPaths}
          bookNotes={bookNotes}
          unifiedTasks={unifiedTasks}
          overallProgressPct={overallProgressPct}
          onSelectCourse={onSelectCourse}
          onOpenPaths={() => onNavigateTab('paths')}
          onOpenJournal={() => onNavigateTab('journal')}
        />
      </section>

      {/* Hub Create / Edit Modal */}
      {hubModalMode && (
        <div
          className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setHubModalMode(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveHubModal}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h3 className="font-editorial text-lg font-bold text-slate-900">
                {hubModalMode === 'create'
                  ? `إضافة مجال / محور جديد (${hubs.length + 1})`
                  : `تعديل المحور: ${hubDraftTitle}`}
              </h3>
              <button
                type="button"
                onClick={() => setHubModalMode(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المحور الكامل *
                </label>
                <input
                  type="text"
                  required
                  value={hubDraftTitle}
                  onChange={(e) => setHubDraftTitle(e.target.value)}
                  placeholder="مثلاً: اللغات والترجمة أو التصميم"
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الاسم المختصر في الأزرار
                </label>
                <input
                  type="text"
                  value={hubDraftShortTitle}
                  onChange={(e) => setHubDraftShortTitle(e.target.value)}
                  placeholder="مثلاً: اللغات"
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                هدف المحور ونطاقه (اختياري)
              </label>
              <AutoResizeTextarea
                minRows={2}
                value={hubDraftPurpose}
                onChange={(e) => setHubDraftPurpose(e.target.value)}
                placeholder="ما المهارات أو الكورسات التي يضمها هذا المجال؟"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                اللون المميّز للمحور
              </span>
              <div className="flex flex-wrap gap-2">
                {HUB_ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setHubDraftPresetId(preset.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer ${
                      hubDraftPresetId === preset.id
                        ? `${preset.badgeClass} font-bold ring-2 ring-[#1E3A5F]/25`
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: preset.accentHex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                التصنيفات الفرعية داخل المحور (سطر لكل تصنيف)
              </label>
              <AutoResizeTextarea
                minRows={3}
                value={hubDraftCategoriesText}
                onChange={(e) => setHubDraftCategoriesText(e.target.value)}
                placeholder={'التصنيف الأول\nالتصنيف الثاني'}
                className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {hubModalMode === 'edit' &&
              hubs.length > 1 &&
              hubDraftId !== 'marketing' &&
              hubDraftId !== 'dental_career' &&
              hubDraftId !== 'knowledge' ? (
                <button
                  type="button"
                  onClick={() => handleDeleteHub(hubDraftId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حذف المجال</span>
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHubModalMode(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حفظ</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

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
