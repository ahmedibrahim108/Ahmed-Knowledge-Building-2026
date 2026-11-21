import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Download,
  Edit3,
  Eye,
  Feather,
  FileText,
  FolderPlus,
  GraduationCap,
  Headphones,
  History,
  Layers,
  ListTodo,
  Lock,
  LogIn,
  MessageSquare,
  NotebookPen,
  Pause,
  PenLine,
  Pin,
  Play,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Users,
  Volume2,
  X,
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
  WEEKLY_RHYTHM,
  WeeklyMeeting,
  addDaysToDateKey,
  expandWeeklyMeetingsInRange,
  getHubMeta,
  getTodayDateKey,
  resolveCourseStudyStage,
} from '../data/curriculumData';
import { OWNER_ADMIN_EMAIL } from '../firebase';
import { CloudAttachmentItem } from '../services/firestoreSync';
import {
  SavedAudioClipSummary,
  listUserAudioClips,
  loadAudioClipById,
} from '../utils/audioCache';
import {
  BUNDLED_APP_DOCUMENTS,
  downloadResourceAttachment,
} from '../utils/documentImportExport';
import { moveImagesScope } from '../utils/imageStorage';
import ConfirmDialog from './ConfirmDialog';
import { ActiveTab } from './Header';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import type { ActivePdfTarget } from './PDFViewerModal';
import ProgressCharts from './ProgressCharts';
import VoiceRecorderButton from './VoiceRecorderButton';
import WeeklyMeetingsPanel from './WeeklyMeetingsPanel';

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
}

const CAT_SWATCHES: Record<CustomCategory['color'], string> = {
  navy: 'bg-[#1E3A5F]',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-600',
  slate: 'bg-slate-500',
};

const REFLECTION_MOODS: ReflectionMood[] = ['تأمل', 'فكرة', 'امتنان', 'هدف'];

export default function OverviewView({
  user,
  canEdit,
  onRequireAuth,
  voiceDialect,
  preferences,
  onUpdatePreferences,
  quarters,
  months,
  domains,
  courses,
  bookNotes,
  learningPaths,
  readingItems,
  projects,
  unifiedTasks,
  dentalCases = [],
  customCategories,
  history,
  reflections,
  calendarEvents = [],
  weeklyMeetings = [],
  cloudAttachments = [],
  onGoogleSignIn,
  onNavigateTab,
  onSelectHub,
  onSelectCourse,
  onJumpToMonth,
  onFilterByDomain,
  onOpenNoteById,
  onOpenDentalCases,
  onOpenPdf,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onAddWeeklyMeeting,
  onUpdateWeeklyMeeting,
  onDeleteWeeklyMeeting,
  onAddCustomCategory,
  onDeleteCustomCategory,
  onDeleteHistoryEntry,
  onAddReflection,
  onUpdateReflection,
  onDeleteReflection,
}: OverviewViewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState<CustomCategory['color']>('navy');

  // Editable Hub Categories UI
  const [editingHubCats, setEditingHubCats] = useState<LearningHubId | null>(null);
  const [newHubCatName, setNewHubCatName] = useState('');

  // Confirm Dialog State for Deletions
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'reflection' | 'category' | 'history' | 'hubCategory';
    id: string;
    label: string;
    hubId?: LearningHubId;
  } | null>(null);

  // History Filter State
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'notes_voice' | 'plan_tasks' | 'courses_domains'
  >('all');

  // Personal Reflections State
  const [refTitle, setRefTitle] = useState('');
  const [refContent, setRefContent] = useState('');
  const [refMood, setRefMood] = useState<ReflectionMood>('تأمل');
  const [refFilter, setRefFilter] = useState<'all' | 'pinned' | ReflectionMood>(
    'all'
  );
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(
    null
  );
  const [editingRefTitle, setEditingRefTitle] = useState('');
  const [editingRefContent, setEditingRefContent] = useState('');
  const [draftImgRefresh, setDraftImgRefresh] = useState(0);

  // Interactive Dashboard Agenda & Quick Access State
  const [agendaOpen, setAgendaOpen] = useState(true);
  const [agendaFilter, setAgendaFilter] = useState<
    'all' | 'today_overdue' | 'tasks' | 'meetings'
  >('all');
  const [agendaSort, setAgendaSort] = useState<'date' | 'priority'>('date');
  const [quickDashTaskTitle, setQuickDashTaskTitle] = useState('');
  const [quickDashTaskSchedule, setQuickDashTaskSchedule] = useState<
    'today' | 'unscheduled'
  >('today');
  const [quickAccessOpen, setQuickAccessOpen] = useState(true);
  const [savedAudioClips, setSavedAudioClips] = useState<SavedAudioClipSummary[]>(
    []
  );
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null);
  const dashAudioRef = useRef<HTMLAudioElement | null>(null);
  const dashAudioUrlRef = useRef<string | null>(null);

  const isOwnerAdmin =
    Boolean(user?.email) &&
    user?.email?.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase();

  const resolvedHubCategories: Record<LearningHubId, string[]> =
    preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES;

  const today = getTodayDateKey();
  const nextWeekKey = useMemo(() => addDaysToDateKey(today, 7), [today]);

  useEffect(() => {
    let active = true;
    if (!user?.uid) {
      setSavedAudioClips([]);
      return;
    }
    void listUserAudioClips(user.uid).then((clips) => {
      if (active) setSavedAudioClips(clips);
    });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      if (dashAudioRef.current) {
        dashAudioRef.current.pause();
        dashAudioRef.current = null;
      }
      if (dashAudioUrlRef.current) {
        URL.revokeObjectURL(dashAudioUrlRef.current);
        dashAudioUrlRef.current = null;
      }
    };
  }, []);

  const upcomingMeetingOccurrences = useMemo(
    () => expandWeeklyMeetingsInRange(weeklyMeetings, today, nextWeekKey),
    [weeklyMeetings, today, nextWeekKey]
  );

  const upcomingAgendaTasks = useMemo(() => {
    const priOrder = { high: 0, medium: 1, low: 2 };
    const filtered = unifiedTasks.filter((t) => {
      const targetDate = t.scheduledDate || t.dueDate || '';
      if (agendaFilter === 'today_overdue') {
        return (
          t.status !== 'done' &&
          ((targetDate && targetDate <= today) ||
            (t.deadline && t.deadline <= today))
        );
      }
      if (agendaFilter === 'meetings') return false;
      return t.status !== 'done';
    });
    return filtered
      .slice()
      .sort((a, b) => {
        if (agendaSort === 'priority') {
          return priOrder[a.priority] - priOrder[b.priority];
        }
        const da = a.scheduledDate || a.dueDate || '9999-99-99';
        const db = b.scheduledDate || b.dueDate || '9999-99-99';
        return da.localeCompare(db);
      })
      .slice(0, 8);
  }, [unifiedTasks, agendaFilter, agendaSort, today]);

  const upcomingEventsList = useMemo(() => {
    if (agendaFilter === 'tasks') return [];
    return calendarEvents
      .filter((ev) => !ev.done && ev.dateKey >= today && ev.dateKey <= nextWeekKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(0, 5);
  }, [calendarEvents, agendaFilter, today, nextWeekKey]);

  const quickPdfItems = useMemo(() => {
    const list: Array<{
      id: string;
      resourceId?: string;
      title: string;
      subtitle: string;
      downloadUrl?: string;
      storagePath?: string;
      attachmentName?: string;
      mimeType?: string;
      fallbackText?: string;
    }> = [];
    const seenResourceIds = new Set<string>();

    for (const item of readingItems) {
      if (
        item.attachmentName ||
        item.downloadUrl ||
        item.storagePath ||
        item.takeaways?.trim()
      ) {
        const resId = item.attachmentResourceId || item.id;
        seenResourceIds.add(resId);
        list.push({
          id: `lib-${item.id}`,
          resourceId: resId,
          title: item.title,
          subtitle: item.author || item.categoryLabel || item.itemType,
          downloadUrl: item.downloadUrl,
          storagePath: item.storagePath,
          attachmentName: item.attachmentName,
          mimeType: item.attachmentName?.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : undefined,
          fallbackText: item.takeaways,
        });
      }
    }
    for (const c of courses) {
      for (const res of c.resources) {
        if (
          res.attachmentName ||
          res.downloadUrl ||
          res.storagePath ||
          res.extractedPreview
        ) {
          seenResourceIds.add(res.id);
          list.push({
            id: `cres-${c.id}-${res.id}`,
            resourceId: res.id,
            title: res.title,
            subtitle: c.title,
            downloadUrl: res.downloadUrl,
            storagePath: res.storagePath,
            attachmentName: res.attachmentName,
            mimeType: res.mimeType,
            fallbackText: res.extractedPreview,
          });
        }
      }
    }
    for (const m of months) {
      for (const res of m.resources) {
        if (
          res.attachmentName ||
          res.downloadUrl ||
          res.storagePath ||
          res.extractedPreview
        ) {
          seenResourceIds.add(res.id);
          list.push({
            id: `mres-${m.id}-${res.id}`,
            resourceId: res.id,
            title: res.title,
            subtitle: `الشهر ${m.id}: ${m.theme}`,
            downloadUrl: res.downloadUrl,
            storagePath: res.storagePath,
            attachmentName: res.attachmentName,
            mimeType: res.mimeType,
            fallbackText: res.extractedPreview,
          });
        }
      }
    }
    for (const att of cloudAttachments) {
      if (seenResourceIds.has(att.id)) continue;
      seenResourceIds.add(att.id);
      list.push({
        id: `att-${att.id}`,
        resourceId: att.id,
        title: att.fileName,
        subtitle: 'مرفق سحابي متزامن',
        attachmentName: att.fileName,
        mimeType: att.mimeType,
      });
    }
    for (const docItem of BUNDLED_APP_DOCUMENTS) {
      list.push({
        id: docItem.id,
        resourceId: docItem.id,
        title: docItem.title,
        subtitle: docItem.subtitle,
        downloadUrl: docItem.downloadUrl,
        attachmentName: docItem.fileName,
        mimeType: docItem.mimeType,
      });
    }
    return list;
  }, [readingItems, courses, months, cloudAttachments]);

  const handleTogglePlaySavedClip = async (clip: SavedAudioClipSummary) => {
    if (playingClipId === clip.id && dashAudioRef.current) {
      dashAudioRef.current.pause();
      setPlayingClipId(null);
      return;
    }
    if (dashAudioRef.current) {
      dashAudioRef.current.pause();
    }
    setLoadingClipId(clip.id);
    try {
      const loaded = await loadAudioClipById(user?.uid, clip.id);
      if (!loaded) {
        setLoadingClipId(null);
        return;
      }
      if (dashAudioUrlRef.current) {
        URL.revokeObjectURL(dashAudioUrlRef.current);
      }
      const url = URL.createObjectURL(loaded.blob);
      dashAudioUrlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setPlayingClipId(null);
      dashAudioRef.current = audio;
      await audio.play();
      setPlayingClipId(clip.id);
    } finally {
      setLoadingClipId(null);
    }
  };

  // Progress Calculations
  const completedMonths = months.filter((m) => m.status === 'completed').length;
  const inProgressMonths = months.filter(
    (m) => m.status === 'in_progress'
  ).length;
  const activeMonth =
    months.find((m) => m.status === 'in_progress') ?? months[0];

  const totalActivities = months.length * 4;
  const completedActivities = months.reduce(
    (acc, m) => acc + Object.values(m.activities).filter(Boolean).length,
    0
  );
  const readingDone = months.filter((m) => m.activities.reading).length;
  const listeningDone = months.filter((m) => m.activities.listening).length;
  const summarizingDone = months.filter((m) => m.activities.summarizing).length;
  const discussingDone = months.filter((m) => m.activities.discussing).length;

  const completedCourses = courses.filter((c) => c.completed).length;

  const bookTypeNotesCount = bookNotes.filter(
    (n) => (n.noteType ?? 'book') === 'book'
  ).length;
  const lectureNotesCount = bookNotes.filter(
    (n) => n.noteType === 'course_lecture'
  ).length;
  const generalNotesCount = bookNotes.filter(
    (n) => n.noteType === 'general'
  ).length;

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
    const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
    return Math.round(avg * 100);
  }, [
    totalActivities,
    completedActivities,
    totalSmallTasks,
    completedSmallTasks,
    courses.length,
    completedCourses,
  ]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    if (historyFilter === 'notes_voice') {
      return history.filter(
        (h) => h.actionType === 'note' || h.actionType === 'voice'
      );
    }
    if (historyFilter === 'plan_tasks') {
      return history.filter(
        (h) => h.actionType === 'task' || h.actionType === 'month'
      );
    }
    return history.filter(
      (h) => h.actionType === 'course' || h.actionType === 'domain'
    );
  }, [history, historyFilter]);

  const filteredReflections = useMemo(() => {
    if (refFilter === 'all') return reflections;
    if (refFilter === 'pinned') return reflections.filter((r) => r.pinned);
    return reflections.filter((r) => r.moodTag === refFilter);
  }, [reflections, refFilter]);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const title = catTitle.trim();
    if (!title) return;
    onAddCustomCategory(
      title,
      catDesc.trim() || 'تصنيف شخصي لتجميع الملاحظات والأفكار المرتبطة.',
      catColor
    );
    setCatTitle('');
    setCatDesc('');
    setShowAddCategory(false);
  };

  const handleCreateReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const content = refContent.trim();
    if (!content) return;
    const createdId = onAddReflection({
      title: refTitle.trim(),
      content,
      moodTag: refMood,
    });
    if (createdId) {
      await moveImagesScope('draft-reflection', `reflection:${createdId}`, user?.uid);
      setDraftImgRefresh((n) => n + 1);
    }
    setRefTitle('');
    setRefContent('');
  };

  const todayArabicDate = useMemo(() => {
    try {
      return new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

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

  const handleAddHubCategory = (e: React.FormEvent, hubId: LearningHubId) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = newHubCatName.trim();
    if (!clean) return;
    const currentList = resolvedHubCategories[hubId] ?? [];
    if (currentList.includes(clean)) {
      setNewHubCatName('');
      return;
    }
    onUpdatePreferences({
      hubCategories: {
        ...resolvedHubCategories,
        [hubId]: [...currentList, clean],
      },
    });
    setNewHubCatName('');
  };

  const DAILY_PROMPTS: Array<{ label: string; mood: ReflectionMood }> = [
    { label: 'أهم فكرة تعلّمتها اليوم', mood: 'فكرة' },
    { label: 'موقف أو معنى يستحق التأمل اليوم', mood: 'تأمل' },
    { label: 'شيء أشعر بالامتنان له اليوم', mood: 'امتنان' },
    { label: 'تركيز وهدف الغد بإذن الله', mood: 'هدف' },
  ];

  return (
    <div className="space-y-8">
      {/* Personalized Greeting & Workspace Hero Split */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {user
                    ? `أهلاً بك، ${user.displayName || 'باحث المعرفة'}`
                    : 'خطة الدراسة العامة المتوازنة'}
                </span>
                <span aria-hidden="true">·</span>
                <span>مساران متوازيان</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {months.length} شهرًا/وحدة · {domains.length} محاور ·{' '}
                  {courses.length} كورسات
                </span>
              </div>

              <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-slate-900 leading-snug">
                لوحة المعرفة الشخصية: بناء عقلٍ متوازن يفهم الأفكار والإنسان والواقع
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                مساحة دراسة مرنة بدون سباقٍ قسري؛ تجمع بين تتبع التقدّم الفعلي، وسجل نشاط حسابك، ومكانٍ هادئ لخواطرك وتأملاتك الشخصية.
              </p>

              {user && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    الحساب النشط: {user.email}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    الإنجاز العام: {overallProgressPct}%
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    سجل النشاط: {history.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    الخواطر: {reflections.length}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('focus')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>
                  التركيز الحالي (
                  {
                    courses.filter(
                      (c) => resolveCourseStudyStage(c) === 'focus_now'
                    ).length
                  }
                  )
                </span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('journal')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <NotebookPen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>مكتبة دفاتر التلخيص</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CalendarDays className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>التقويم</span>
              </button>

              {!user && (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1E3A5F] border border-[#1E3A5F]/25 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>حفظ ومزامنة بحساب Google</span>
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-slate-100 border-t lg:border-t-0 lg:border-r border-slate-200">
            {!imgFailed ? (
              <img
                src={HERO_IMAGE_PATH}
                alt="مكتب دراسي هادئ يضم كتبًا مفتوحة ودفتر تلخيص وفنجان شاي في ضوء النهار"
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
                <p className="text-xs text-slate-500 mt-1">
                  قراءة · استماع · تلخيص · مناقشة وتطبيق
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4-Column Interactive KPI Strip */}
      <section aria-label="ملخص التقدم" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() =>
            activeMonth ? onJumpToMonth(activeMonth.id) : onNavigateTab('plan')
          }
          className="text-right bg-white border border-slate-200 hover:border-[#1E3A5F]/40 hover:shadow-xs rounded-xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="group-hover:text-[#1E3A5F] font-medium">الوحدات المنجزة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedMonths}{' '}
            <span className="text-sm font-normal text-slate-500">
              / {months.length} وحدة
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {inProgressMonths} قيد الدراسة ·{' '}
            {activeMonth ? `الحالية: وحدة ${activeMonth.id} ←` : 'فتح الخطة ←'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('tasks')}
          className="text-right bg-white border border-slate-200 hover:border-[#1E3A5F]/40 hover:shadow-xs rounded-xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="group-hover:text-[#1E3A5F] font-medium">المهام والنشاطات</span>
            <Clock className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedSmallTasks}{' '}
            <span className="text-sm font-normal text-slate-500">
              / {totalSmallTasks} مهمة
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            نشطة بالمهام: {unifiedTasks.filter((t) => t.status !== 'done').length} · فتح المهام ←
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('courses')}
          className="text-right bg-white border border-slate-200 hover:border-[#1E3A5F]/40 hover:shadow-xs rounded-xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="group-hover:text-[#1E3A5F] font-medium">الكورسات والمراجع</span>
            <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedCourses}{' '}
            <span className="text-sm font-normal text-slate-500">
              / {courses.length} كورس
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            عرض وتحديث الكورسات ←
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('journal')}
          className="text-right bg-white border border-slate-200 hover:border-[#1E3A5F]/40 hover:shadow-xs rounded-xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="group-hover:text-[#1E3A5F] font-medium">الملاحظات والخواطر</span>
            <PenLine className="w-4 h-4 text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {bookNotes.length}{' '}
            <span className="text-sm font-normal text-slate-500">ملاحظة</span>
            <span className="text-sm font-normal text-slate-400 mx-1">·</span>
            <span className="text-lg font-semibold text-[#1E3A5F]">
              {reflections.length}
            </span>{' '}
            <span className="text-xs font-normal text-slate-500">خاطرة</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {bookTypeNotesCount} كتاب · {lectureNotesCount} محاضرة · فتح الدفتر ←
          </p>
        </button>
      </section>

      {/* Interactive Today & Upcoming Agenda + Quick Access Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <h2 className="font-editorial text-xl font-bold text-slate-900">
              أجندة اليوم والأيام القادمة (مهام ولقاءات)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('calendar')}
              className="px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              فتح التقويم التفاعلي ←
            </button>
            <button
              type="button"
              onClick={() => setAgendaOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
            >
              {agendaOpen ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> طي
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> فتح
                </>
              )}
            </button>
          </div>
        </div>

        {agendaOpen && (
          <div className="space-y-4">
            {/* Inline Quick Task Creator + Filter/Sort */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {onAddUnifiedTask && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canEdit) return onRequireAuth();
                    const clean = quickDashTaskTitle.trim();
                    if (!clean) return;
                    const sched = quickDashTaskSchedule === 'today' ? today : '';
                    onAddUnifiedTask({
                      title: clean,
                      description: '',
                      hubId: 'knowledge',
                      categoryLabel: 'مهمة سريعة',
                      priority: 'medium',
                      status: 'todo',
                      dueDate: sched,
                      scheduledDate: sched,
                      startTime: '',
                      durationMinutes: 60,
                    });
                    setQuickDashTaskTitle('');
                  }}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1"
                >
                  <input
                    type="text"
                    value={quickDashTaskTitle}
                    onChange={(e) => setQuickDashTaskTitle(e.target.value)}
                    onClick={() => {
                      if (!canEdit) onRequireAuth();
                    }}
                    readOnly={!canEdit}
                    placeholder="أضف مهمة سريعة مباشرة من لوحة المتابعة..."
                    className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                  <select
                    value={quickDashTaskSchedule}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setQuickDashTaskSchedule(
                        e.target.value as 'today' | 'unscheduled'
                      )
                    }
                    className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="today">جدولة لليوم</option>
                    <option value="unscheduled">قائمة الانتظار</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة
                  </button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[11px]">
                  {(
                    [
                      { id: 'all', label: 'الكل' },
                      { id: 'today_overdue', label: 'اليوم والمتأخر' },
                      { id: 'tasks', label: 'المهام' },
                      { id: 'meetings', label: 'اللقاءات' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAgendaFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        agendaFilter === f.id
                          ? 'bg-white text-[#1E3A5F] font-semibold shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="ترتيب الأجندة"
                  value={agendaSort}
                  onChange={(e) =>
                    setAgendaSort(e.target.value as 'date' | 'priority')
                  }
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="date">ترتيب بالموعد</option>
                  <option value="priority">ترتيب بالأولوية</option>
                </select>
              </div>
            </div>

            {/* Tasks & Meetings Split Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agendaFilter !== 'meetings' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold">
                      المهام النشطة ({upcomingAgendaTasks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('tasks')}
                      className="text-[#1E3A5F] font-medium hover:underline cursor-pointer"
                    >
                      عرض الكل ←
                    </button>
                  </div>
                  {upcomingAgendaTasks.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      لا توجد مهام متأخرة أو نشطة في هذا الفلتر.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {upcomingAgendaTasks.map((t) => {
                        const tDate = t.scheduledDate || t.dueDate || '';
                        const isOverdue = Boolean(tDate && tDate < today);
                        return (
                          <div
                            key={t.id}
                            className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!canEdit) return onRequireAuth();
                                onUpdateUnifiedTask?.(t.id, {
                                  status: t.status === 'done' ? 'todo' : 'done',
                                });
                              }}
                              className="flex items-center gap-2 text-right flex-1 min-w-0 cursor-pointer"
                            >
                              {t.status === 'done' ? (
                                <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-900 truncate">
                                  {t.title}
                                </p>
                                <p className="text-[10px] text-slate-500 tabular-nums">
                                  {tDate ? tDate : 'غير مجدولة'}
                                  {t.startTime ? ` · ${t.startTime}` : ''}
                                  {isOverdue ? ' · متأخرة' : ''}
                                </p>
                              </div>
                            </button>
                            {canEdit && onUpdateUnifiedTask && !tDate && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateUnifiedTask(t.id, {
                                    scheduledDate: today,
                                    dueDate: today,
                                  })
                                }
                                className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-300 text-[#1E3A5F] rounded cursor-pointer shrink-0"
                              >
                                جدولة لليوم
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {agendaFilter !== 'tasks' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-700" />
                      اللقاءات والمواعيد القادمة (7 أيام)
                    </span>
                    <a
                      href="#weekly-meetings-section"
                      className="text-[#1E3A5F] font-medium hover:underline"
                    >
                      قسم اللقاءات ←
                    </a>
                  </div>
                  {upcomingMeetingOccurrences.length === 0 &&
                  upcomingEventsList.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      لا توجد لقاءات أسبوعية أو مواعيد خلال الأيام السبعة القادمة.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {upcomingMeetingOccurrences.slice(0, 5).map((occ) => (
                        <div
                          key={`${occ.meeting.id}-${occ.occurrenceKey}`}
                          className="p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-lg flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-indigo-950 truncate">
                              {occ.title}
                            </p>
                            <p className="text-[10px] text-indigo-700 tabular-nums">
                              {occ.dateKey} · {occ.startTime}–{occ.endTime}
                            </p>
                          </div>
                          {canEdit && onUpdateWeeklyMeeting && (
                            <button
                              type="button"
                              onClick={() => {
                                const doneSet = new Set(occ.meeting.completedDates || []);
                                const nextAtt = { ...(occ.meeting.attendanceByDate || {}) };
                                if (occ.completed) {
                                  doneSet.delete(occ.occurrenceKey);
                                  nextAtt[occ.occurrenceKey] = 'pending';
                                } else {
                                  doneSet.add(occ.occurrenceKey);
                                  nextAtt[occ.occurrenceKey] = 'attended';
                                }
                                onUpdateWeeklyMeeting(occ.meeting.id, {
                                  completedDates: Array.from(doneSet),
                                  attendanceByDate: nextAtt,
                                });
                              }}
                              className={`px-2 py-1 text-[10px] font-semibold rounded border cursor-pointer shrink-0 ${
                                occ.completed
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-white text-indigo-900 border-indigo-300'
                              }`}
                            >
                              {occ.completed ? 'تم الحضور ✓' : 'تسجيل حضور'}
                            </button>
                          )}
                        </div>
                      ))}
                      {upcomingEventsList.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {ev.title}
                            </p>
                            <p className="text-[10px] text-slate-500 tabular-nums">
                              {ev.dateKey}
                              {ev.timeSlot ? ` · ${ev.timeSlot}` : ''} · {ev.category}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Access Drawer: PDFs, Saved Audio Clips, Pinned Notes */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <button
                type="button"
                onClick={() => setQuickAccessOpen((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
              >
                <span>
                  وصول سريع (ملفات PDF · تسجيلات صوتية محفوظة · ملاحظات مثبّتة)
                </span>
                {quickAccessOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {quickAccessOpen && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Files & Documents */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        ملفات ومستندات التطبيق ({quickPdfItems.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('library')}
                        className="text-[11px] text-[#1E3A5F] hover:underline cursor-pointer"
                      >
                        كل الملفات
                      </button>
                    </div>
                    {quickPdfItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400">
                        لا توجد ملفات مرفوعة بعد.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {quickPdfItems.slice(0, 6).map((pdf) => (
                          <div
                            key={pdf.id}
                            className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 truncate">
                                {pdf.title}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {pdf.subtitle}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenPdf?.({
                                    title: pdf.title,
                                    fileName: pdf.attachmentName || `${pdf.title}.pdf`,
                                    resourceId: pdf.resourceId,
                                    contextLabel: pdf.subtitle,
                                    downloadUrl: pdf.downloadUrl,
                                    storagePath: pdf.storagePath,
                                    mimeType: pdf.mimeType,
                                    fallbackText: pdf.fallbackText,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded cursor-pointer"
                              >
                                <Eye className="w-3 h-3" aria-hidden="true" />
                                <span>عرض</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadResourceAttachment({
                                    resourceId: pdf.resourceId,
                                    fileName: pdf.attachmentName || pdf.title,
                                    storagePath: pdf.storagePath,
                                    downloadUrl: pdf.downloadUrl,
                                  })
                                }
                                aria-label={`تنزيل ${pdf.title}`}
                                className="p-1 text-slate-600 hover:text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Saved TTS Audio Clips */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        الصوتيات المحفوظة ({savedAudioClips.length})
                      </span>
                    </div>
                    {savedAudioClips.length === 0 ? (
                      <p className="text-[11px] text-slate-400">
                        سيظهر هنا كل ملخص صوتي تقوم بتوليده عبر الأجهزة.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {savedAudioClips.slice(0, 3).map((clip) => (
                          <button
                            key={clip.id}
                            type="button"
                            onClick={() => void handleTogglePlaySavedClip(clip)}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-800 cursor-pointer"
                          >
                            <span className="truncate font-medium">
                              {clip.title}
                            </span>
                            <span className="shrink-0 text-[#1E3A5F]">
                              {loadingClipId === clip.id ? (
                                '...'
                              ) : playingClipId === clip.id ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pinned Reflections & Recent Book Notes */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1">
                        <Pin className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        خواطر مثبّتة وملخصات
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('journal')}
                        className="text-[11px] text-[#1E3A5F] hover:underline cursor-pointer"
                      >
                        الدفتر
                      </button>
                    </div>
                    <div className="space-y-1">
                      {reflections
                        .filter((r) => r.pinned)
                        .slice(0, 2)
                        .map((r) => (
                          <a
                            key={r.id}
                            href="#daily-reflections"
                            className="block px-2 py-1.5 bg-white border border-slate-200 rounded text-[11px] text-slate-800 truncate"
                          >
                            ★ {r.title || r.content}
                          </a>
                        ))}
                      {bookNotes.slice(0, 2).map((bn) => (
                        <button
                          key={bn.id}
                          type="button"
                          onClick={() => onOpenNoteById(bn.id)}
                          className="w-full text-right px-2 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-800 truncate block cursor-pointer"
                        >
                          {bn.bookTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3 Learning Hubs Command Center */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">
              منظومة التعلم والنمو ثلاثية المستويات · تصنيفات قابلة للتخصيص
            </p>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              المستويات والمحاور الرئيسية الثلاثة في رحلتك
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {LEARNING_HUBS.map((hub) => {
            const hCourses = courses.filter(
              (c) => (c.hubId ?? 'knowledge') === hub.id
            );
            const hPaths = learningPaths.filter((p) => p.hubId === hub.id);
            const hLibrary = readingItems.filter((r) => r.hubId === hub.id);
            const hProjects = projects.filter((p) => p.hubId === hub.id);
            const hTasks = unifiedTasks.filter((t) => t.hubId === hub.id);
            const categories = resolvedHubCategories[hub.id] ?? hub.defaultCategories;
            const isManagingCats = editingHubCats === hub.id;

            return (
              <div
                key={hub.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${hub.badgeClass}`}
                    >
                      {hub.shortTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingHubCats(isManagingCats ? null : hub.id)
                      }
                      className="text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] cursor-pointer"
                    >
                      {isManagingCats ? 'إخفاء التصنيفات' : 'تخصيص التخصصات'}
                    </button>
                  </div>

                  <div>
                    <h3 className="font-editorial text-xl font-bold text-slate-900">
                      {hub.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {hub.purpose}
                    </p>
                  </div>

                  {/* Quick Hub Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="block text-sm font-bold text-slate-900 tabular-nums">
                        {hCourses.length}
                      </span>
                      <span className="text-[11px] text-slate-500">كورس</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="block text-sm font-bold text-slate-900 tabular-nums">
                        {hPaths.length}
                      </span>
                      <span className="text-[11px] text-slate-500">مسار</span>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="block text-sm font-bold text-slate-900 tabular-nums">
                        {hLibrary.length + hProjects.length + hTasks.length}
                      </span>
                      <span className="text-[11px] text-slate-500">مصدر ومهمة</span>
                    </div>
                  </div>

                  {/* Editable Categories Drawer */}
                  {isManagingCats && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                      <p className="text-[11px] font-semibold text-slate-700">
                        تخصصات وفئات {hub.shortTitle} ({categories.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-800"
                          >
                            <span>{cat}</span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({
                                    type: 'hubCategory',
                                    id: cat,
                                    label: cat,
                                    hubId: hub.id,
                                  })
                                }
                                aria-label={`حذف ${cat}`}
                                className="text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" aria-hidden="true" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {canEdit && (
                        <form
                          onSubmit={(e) => handleAddHubCategory(e, hub.id)}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={newHubCatName}
                            onChange={(e) => setNewHubCatName(e.target.value)}
                            placeholder="إضافة تخصص جديد..."
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer shrink-0"
                          >
                            إضافة
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Hub Shortcuts */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
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
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المسارات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'library')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المكتبة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectHub(hub.id, 'tasks')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <ListTodo className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المهام والمشاريع</span>
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

      {/* Spaced Repetition & Repeated Listening Tracker */}
      {dueItems.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                متابعة التكرار المتباعد والمواد المسجلة / المسموعة أكثر من مرة ({dueItems.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              اضغط لفتح المادة مباشرة للمراجعة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueItems.slice(0, 9).map((item) => {
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
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-right space-y-1.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded border font-semibold ${hubMeta.badgeClass}`}
                    >
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
                    {item.listenCount >= 2 ? `استماع/تسجيل: ${item.listenCount}× · ` : ''}
                    مراجعات: {item.reviewCount}×
                    {item.nextDate ? ` · القادم: ${item.nextDate}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Owner-Only Admin Controls */}
      {isOwnerAdmin && (
        <section className="bg-slate-900 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold">
                لوحة تحكم المالك ({user?.email})
              </h2>
              <p className="text-xs text-slate-300">
                تحكّم في إظهار أو إخفاء أزرار تصدير Excel في القوائم والتذييل.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdatePreferences({
                showExcelExport: preferences.showExcelExport === false,
              })
            }
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
              preferences.showExcelExport === false
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {preferences.showExcelExport === false
              ? 'زر Excel مخفي حاليًا — اضغط لإظهاره'
              : 'زر Excel ظاهر حاليًا — اضغط لإخفائه'}
          </button>
        </section>
      )}

      {/* Comprehensive Progress Tracker Section */}
      <section
        id="progress-tracker"
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              رسوم بيانية تفاعلية لمعدل إنجاز المهام، الوحدات، الركائز الأربع، والكورسات
            </p>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              تتبع التقدم (Progress Tracker)
            </h2>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-left">
              <span className="block text-[11px] text-slate-500">
                معدل الإنجاز الكلي
              </span>
              <span className="text-2xl font-bold text-[#1E3A5F] tabular-nums">
                {overallProgressPct}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('focus')}
              className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              فتح التركيز الحالي ←
            </button>
          </div>
        </div>

        {/* Interactive Charts: Radial Completion Donut + Task Completion Bar Chart */}
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

        {/* Overall Progress Bar + 4 Pillars Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Quarters & 4 Pillars */}
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  التقدّم التراكمي للخطة
                </span>
                <span className="text-slate-500 tabular-nums">
                  {completedActivities} / {totalActivities} ركيزة ·{' '}
                  {completedSmallTasks} / {totalSmallTasks} مهمة
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F] rounded-full transition-all"
                  style={{ width: `${Math.max(overallProgressPct, 2)}%` }}
                />
              </div>
            </div>

            {/* 4 Pillars Real Progress */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'القراءة', done: readingDone, total: months.length },
                { label: 'الاستماع', done: listeningDone, total: months.length },
                { label: 'التلخيص', done: summarizingDone, total: months.length },
                {
                  label: 'النقاش والتطبيق',
                  done: discussingDone,
                  total: months.length,
                },
              ].map((pillar) => {
                const pct =
                  pillar.total > 0
                    ? Math.round((pillar.done / pillar.total) * 100)
                    : 0;
                return (
                  <div
                    key={pillar.label}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5"
                  >
                    <span className="block text-[11px] font-medium text-slate-600 truncate">
                      {pillar.label}
                    </span>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {pillar.done} / {pillar.total}
                    </p>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quarters / Phases Progress */}
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-semibold text-slate-700">
                تقدّم المراحل / الأرباع ({quarters.length})
              </h3>
              <div className="space-y-2">
                {quarters.map((q) => {
                  const qMonths = months.filter((m) => m.quarter === q.number);
                  const qDone = qMonths.filter(
                    (m) => m.status === 'completed'
                  ).length;
                  const qPct =
                    qMonths.length > 0
                      ? Math.round((qDone / qMonths.length) * 100)
                      : 0;
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const target = qMonths[0];
                          if (target) onJumpToMonth(target.id);
                          else onNavigateTab('focus');
                        }}
                        className="font-medium text-slate-800 hover:text-[#1E3A5F] truncate text-right cursor-pointer"
                      >
                        {q.title}
                      </button>
                      <div className="flex items-center gap-2.5 shrink-0 w-44 sm:w-52">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1E3A5F] rounded-full transition-all"
                            style={{ width: `${qPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums w-12 text-left">
                          {qDone}/{qMonths.length}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Unit-by-Unit Track Grid + Courses Track */}
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  خريطة الوحدات الدراسية ({months.length}) — اضغط للانتقال
                </span>
                <span className="text-[11px] text-slate-500">
                  أخضر: مكتمل · أزرق: قيد الدراسة
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {months.map((m) => {
                  const actDone = Object.values(m.activities).filter(
                    Boolean
                  ).length;
                  const boxStyle =
                    m.status === 'completed'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                      : m.status === 'in_progress'
                      ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white hover:bg-[#162C49]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';

                  return (
                    <button
                      key={m.docId || m.id}
                      type="button"
                      onClick={() => onJumpToMonth(m.id)}
                      title={`${m.theme} (${actDone}/4 ركائز)`}
                      className={`p-2 border rounded-lg text-right transition-colors cursor-pointer ${boxStyle}`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                        <span>و {m.id}</span>
                        <span>{actDone}/4</span>
                      </div>
                      <p className="text-[10px] truncate opacity-85 mt-0.5">
                        {m.theme}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5 pt-1 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  تقدّم الكورسات ({courses.length})
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('courses')}
                  className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  عرض الكورسات ←
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {courses.map((c) => {
                  const doneT = c.tasks.filter((t) => t.done).length;
                  const totalT = c.tasks.length;
                  const pct = c.completed
                    ? 100
                    : totalT > 0
                    ? Math.round((doneT / totalT) * 100)
                    : 0;
                  return (
                    <button
                      key={c.docId || c.id}
                      type="button"
                      onClick={() => onNavigateTab('courses')}
                      className="p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-right space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-900 truncate">
                          {c.title}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                          {c.completed ? 'مكتمل' : `${doneT}/${totalT}`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            c.completed ? 'bg-emerald-600' : 'bg-[#1E3A5F]'
                          }`}
                          style={{ width: `${Math.max(pct, c.completed ? 100 : 4)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Personal Reflections Section (خواطر يومية) */}
      <section
        id="daily-reflections"
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Feather className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span>مساحة يومية هادئة مرتبطة بحسابك فقط</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#1E3A5F]">{todayArabicDate}</span>
            </div>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              خواطر يومية وتأملات خاصة ({reflections.length})
            </h2>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `الكل (${reflections.length})` },
                {
                  id: 'pinned',
                  label: `المثبّتة (${reflections.filter((r) => r.pinned).length})`,
                },
                ...REFLECTION_MOODS.map((m) => ({ id: m, label: m })),
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRefFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  refFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Daily Reflection Composer */}
          <form
            onSubmit={handleCreateReflection}
            className="lg:col-span-5 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  اكتب خاطرة اليوم
                </h3>
                <p className="text-[11px] text-slate-500">
                  دوّن ما في بالك كتابةً أو بالصوت المباشر
                </p>
              </div>
              <VoiceRecorderButton
                label="خاطرة بالصوت"
                dialect={voiceDialect}
                disabled={!canEdit}
                onRequireAuth={onRequireAuth}
                onTranscript={(text) =>
                  setRefContent((prev) =>
                    prev.trim() ? `${prev.trim()}\n${text}` : text
                  )
                }
              />
            </div>

            {canEdit && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-500">
                  بداية سريعة لخاطرة اليوم:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DAILY_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.label}
                      type="button"
                      onClick={() => {
                        setRefTitle(prompt.label);
                        setRefMood(prompt.mood);
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      + {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!canEdit && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>سجّل الدخول بحساب Google لكتابة وحفظ خواطرك الخاصة.</span>
                </span>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer shrink-0"
                >
                  دخول
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {REFLECTION_MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setRefMood(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-55 ${
                    refMood === m
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={refTitle}
              readOnly={!canEdit}
              onClick={() => {
                if (!canEdit) onRequireAuth();
              }}
              onChange={(e) => setRefTitle(e.target.value)}
              placeholder="عنوان مختصر للخاطرة (اختياري)..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />

            <textarea
              rows={4}
              required
              value={refContent}
              readOnly={!canEdit}
              onClick={() => {
                if (!canEdit) onRequireAuth();
              }}
              onChange={(e) => setRefContent(e.target.value)}
              placeholder={
                canEdit
                  ? 'اكتب هنا ما يخطر ببالك، فكرة استوقفتك أثناء القراءة، أو تذكرة لنفسك...'
                  : 'سجّل الدخول لكتابة خواطرك الشخصية...'
              }
              className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] leading-relaxed"
            />

            <ImageAttachmentGallery
              uid={user?.uid}
              scopeKey="draft-reflection"
              title="إرفاق صورة أو أكثر مع الخاطرة"
              canEdit={canEdit}
              onRequireAuth={onRequireAuth}
              compact
              refreshToken={draftImgRefresh}
            />

            <button
              type="submit"
              disabled={!canEdit}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حفظ الخاطرة في حسابي</span>
            </button>
          </form>

          {/* Saved Reflections Feed */}
          <div className="lg:col-span-7 space-y-3">
            {filteredReflections.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                <Feather
                  className="w-7 h-7 text-slate-300 mx-auto"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-slate-800">
                  مساحة خواطرك جاهزة
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {user
                    ? 'اكتب خاطرتك الأولى أو سجّلها بصوتك على اليمين لتبقى محفوظة في حسابك وتعود إليها متى شئت.'
                    : 'سجّل الدخول بحساب Google لتدوين خواطرك الخاصة وحفظها في حسابك الشخصي.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[430px] overflow-y-auto pl-1">
                {filteredReflections.map((refItem) => {
                  const isEditing = editingReflectionId === refItem.id;
                  return (
                    <article
                      key={refItem.id}
                      className={`p-4 border rounded-xl space-y-2.5 ${
                        refItem.pinned
                          ? 'bg-[#FFFDF7] border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-semibold text-[#1E3A5F]">
                            {refItem.moodTag}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{refItem.createdAtLabel}</span>
                          {refItem.pinned && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 font-medium">
                                مثبّتة
                              </span>
                            </>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateReflection(refItem.id, {
                                  pinned: !refItem.pinned,
                                })
                              }
                              title={
                                refItem.pinned ? 'إلغاء التثبيت' : 'تثبيت الخاطرة'
                              }
                              aria-label="تثبيت الخاطرة"
                              className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                                refItem.pinned
                                  ? 'text-amber-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingReflectionId(null);
                                } else {
                                  setEditingReflectionId(refItem.id);
                                  setEditingRefTitle(refItem.title);
                                  setEditingRefContent(refItem.content);
                                }
                              }}
                              aria-label="تعديل الخاطرة"
                              className="p-1 text-slate-400 hover:text-[#1E3A5F] rounded hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDelete({
                                  type: 'reflection',
                                  id: refItem.id,
                                  label: refItem.title || refItem.moodTag,
                                })
                              }
                              aria-label="حذف الخاطرة"
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={editingRefTitle}
                            onChange={(e) => setEditingRefTitle(e.target.value)}
                            placeholder="عنوان الخاطرة..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                          <textarea
                            rows={3}
                            value={editingRefContent}
                            onChange={(e) => setEditingRefContent(e.target.value)}
                            className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingReflectionId(null)}
                              className="px-3 py-1 text-xs text-slate-600 bg-slate-100 rounded-md cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!editingRefContent.trim()) return;
                                onUpdateReflection(refItem.id, {
                                  title: editingRefTitle.trim(),
                                  content: editingRefContent.trim(),
                                });
                                setEditingReflectionId(null);
                              }}
                              className="px-3 py-1 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer"
                            >
                              حفظ التعديل
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {refItem.title && (
                            <h3 className="text-sm font-bold text-slate-900">
                              {refItem.title}
                            </h3>
                          )}
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {refItem.content}
                          </p>
                          <ImageAttachmentGallery
                            uid={user?.uid}
                            scopeKey={`reflection:${refItem.id}`}
                            title="صور الخاطرة"
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
          </div>
        </div>
      </section>

      {/* Personalized Dashboard: Categories + Full Account Study History */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Personalized Categories & Domain Distribution */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-editorial text-2xl font-bold text-slate-900">
                التصنيفات المخصّصة لحسابك
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                نظّم ملاحظاتك واهتماماتك في تصنيفات خاصة تُحفظ تلقائيًا في حسابك.
              </p>
            </div>
            <button
              type="button"
              disabled={!canEdit}
              title={
                !canEdit
                  ? 'سجّل الدخول بحساب Google لإضافة تصنيف جديد'
                  : 'إضافة تصنيف جديد'
              }
              onClick={() => setShowAddCategory((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showAddCategory ? 'إلغاء' : '+ تصنيف جديد'}</span>
            </button>
          </div>

          {showAddCategory && canEdit && (
            <form
              onSubmit={handleCreateCategory}
              className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  placeholder="اسم التصنيف (مثلاً: تلخيصات سريعة)..."
                  className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
                <select
                  aria-label="لون التمييز"
                  value={catColor}
                  onChange={(e) =>
                    setCatColor(e.target.value as CustomCategory['color'])
                  }
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="navy">أزرق داكن</option>
                  <option value="emerald">أخضر زمردي</option>
                  <option value="amber">عنبر دافئ</option>
                  <option value="slate">رمادي هادئ</option>
                </select>
              </div>
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="وصف مختصر لما ستضعه في هذا التصنيف..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حفظ التصنيف</span>
                </button>
              </div>
            </form>
          )}

          {/* Custom Categories List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {customCategories.map((cat) => {
              const linkedNotesCount = bookNotes.filter(
                (bn) => bn.categoryLabel === cat.title
              ).length;
              return (
                <div
                  key={cat.id}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`w-2.5 h-2.5 rounded-xs shrink-0 ${CAT_SWATCHES[cat.color]}`}
                      />
                      <Tag className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {cat.title}
                      </h3>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            type: 'category',
                            id: cat.id,
                            label: cat.title,
                          })
                        }
                        aria-label={`حذف ${cat.title}`}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {cat.description}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span className="tabular-nums">
                      {linkedNotesCount}{' '}
                      {linkedNotesCount === 1 ? 'ملاحظة مرتبطة' : 'ملاحظات مرتبطة'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('journal')}
                      className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      فتح الدفتر
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Domain Distribution Breakdown */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                توزيع المحاور المعرفية ({domains.length} محاور)
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('domains')}
                className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
              >
                إدارة المحاور ←
              </button>
            </div>
            <div className="space-y-2.5">
              {domains.map((dom) => {
                const count = months.filter(
                  (m) =>
                    m.foundational.domainId === dom.id ||
                    m.exploratory.domainId === dom.id
                ).length;
                const pct =
                  months.length > 0
                    ? Math.min(100, Math.round((count / months.length) * 100))
                    : 0;
                return (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => onFilterByDomain(dom.id)}
                    className="w-full text-right group cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 group-hover:text-[#1E3A5F]">
                        {dom.title}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {count} وحدات · {dom.thinkers.length} مفكرين
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A5F] rounded-full transition-all"
                        style={{ width: `${Math.max(pct, count > 0 ? 12 : 4)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Account Study History Timeline */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                سجل نشاط حسابك (History)
              </h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {filteredHistory.length} من أصل {history.length} نشاط
            </span>
          </div>

          {/* History Category Filter */}
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'notes_voice', label: 'نوتس وصوت' },
                { id: 'plan_tasks', label: 'المهام والوحدات' },
                { id: 'courses_domains', label: 'الكورسات والمحاور' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setHistoryFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  historyFilter === f.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
              <p className="text-xs font-medium text-slate-700">
                {user
                  ? 'لا توجد أنشطة مسجّلة في هذا التصنيف بعد'
                  : 'سجّل الدخول لعرض سجل نشاط حسابك'}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                يُحفظ هنا كل كتاب تلخّصه، أو مهمة تنجزها، أو تسجيل صوتي تحفظه، أو خاطرة تدوّنها على حسابك.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-[430px] overflow-y-auto">
              {filteredHistory.map((entry) => {
                const EntryIcon =
                  entry.actionType === 'course'
                    ? GraduationCap
                    : entry.actionType === 'note' || entry.actionType === 'voice'
                    ? NotebookPen
                    : entry.actionType === 'task'
                    ? CheckCircle2
                    : BookOpen;

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 bg-white hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (entry.targetNoteId) {
                          onOpenNoteById(entry.targetNoteId);
                        } else if (entry.targetMonthId) {
                          onJumpToMonth(entry.targetMonthId);
                        } else {
                          onNavigateTab(entry.targetTab);
                        }
                      }}
                      className="flex items-start gap-3 text-right flex-1 cursor-pointer"
                    >
                      <EntryIcon
                        className="w-4 h-4 text-[#1E3A5F] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-slate-900">
                          {entry.title}
                        </p>
                        {entry.detail && (
                          <p className="text-[11px] text-slate-600 line-clamp-2">
                            {entry.detail}
                          </p>
                        )}
                        <span className="block text-[10px] text-slate-400">
                          {entry.timestampLabel}
                        </span>
                      </div>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            type: 'history',
                            id: entry.id,
                            label: entry.title,
                          })
                        }
                        aria-label="حذف السجل"
                        className="p-1 text-slate-300 hover:text-red-600 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Study Unit Spotlight */}
          {activeMonth && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  محطة التركيز الحالية · الوحدة {activeMonth.id}
                </span>
                <button
                  type="button"
                  onClick={() => onJumpToMonth(activeMonth.id)}
                  className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  فتح الوحدة ←
                </button>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <p className="text-sm font-bold text-slate-900">
                  {activeMonth.theme}
                </p>
                <p className="text-xs text-slate-600">
                  التأسيسي: {activeMonth.foundational.title}
                </p>
                <p className="text-xs text-slate-600">
                  الاستكشافي: {activeMonth.exploratory.title}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Interactive Weekly Meetings Section */}
      {onAddWeeklyMeeting && onUpdateWeeklyMeeting && onDeleteWeeklyMeeting && (
        <section id="weekly-meetings-section">
          <WeeklyMeetingsPanel
            canEdit={canEdit}
            onRequireAuth={onRequireAuth}
            meetings={weeklyMeetings}
            onAddMeeting={onAddWeeklyMeeting}
            onUpdateMeeting={onUpdateWeeklyMeeting}
            onDeleteMeeting={onDeleteWeeklyMeeting}
            onCreateTaskFromFollowUp={onAddUnifiedTask}
            onOpenCalendar={() => onNavigateTab('calendar')}
          />
        </section>
      )}

      {/* Weekly Rhythm 4 Pillars */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              الإيقاع الأسبوعي: القراءة والاستماع والتلخيص والمناقشة والتطبيق
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              ساعات أسبوعية مرنة ومريحة (~7 ساعات في الأسبوع) تمنع الإرهاق وتحفظ استمراريتك.
            </p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums shrink-0">
            المتوسط المقترح: 7 ساعات / أسبوع
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
          {WEEKLY_RHYTHM.map((slot, idx) => {
            const Icon =
              idx === 0
                ? BookOpen
                : idx === 1
                ? Headphones
                : idx === 2
                ? PenLine
                : MessageSquare;
            return (
              <div
                key={slot.id}
                className="p-5 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-500 tabular-nums">
                    {slot.suggestedDuration}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {slot.pillar}
                </h3>
                <p className="text-xs font-medium text-slate-700">{slot.focus}</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {slot.guideline}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف «${confirmDelete?.label}»؟`}
        confirmLabel="تأكيد الحذف"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === 'reflection') {
            onDeleteReflection(confirmDelete.id);
          } else if (confirmDelete.type === 'category') {
            onDeleteCustomCategory(confirmDelete.id);
          } else if (confirmDelete.type === 'history') {
            onDeleteHistoryEntry(confirmDelete.id);
          } else if (confirmDelete.type === 'hubCategory' && confirmDelete.hubId) {
            const currentList = resolvedHubCategories[confirmDelete.hubId] ?? [];
            onUpdatePreferences({
              hubCategories: {
                ...resolvedHubCategories,
                [confirmDelete.hubId]: currentList.filter(
                  (c) => c !== confirmDelete.id
                ),
              },
            });
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
