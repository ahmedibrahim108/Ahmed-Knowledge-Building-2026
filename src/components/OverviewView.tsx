import { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  Feather,
  FolderPlus,
  GraduationCap,
  Headphones,
  History,
  Layers,
  Lock,
  LogIn,
  MessageSquare,
  NotebookPen,
  PenLine,
  Pin,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  BookNote,
  CustomCategory,
  DomainId,
  DomainInfo,
  HERO_IMAGE_PATH,
  MonthPlan,
  PersonalCourse,
  PersonalReflection,
  QuarterInfo,
  ReflectionMood,
  StudyHistoryEntry,
  VoiceDialectMode,
  WEEKLY_RHYTHM,
} from '../data/curriculumData';
import { ActiveTab } from './Header';
import VoiceRecorderButton from './VoiceRecorderButton';

interface OverviewViewProps {
  user: User | null;
  canEdit: boolean;
  onRequireAuth: () => void;
  voiceDialect: VoiceDialectMode;
  quarters: QuarterInfo[];
  months: MonthPlan[];
  domains: DomainInfo[];
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  customCategories: CustomCategory[];
  history: StudyHistoryEntry[];
  reflections: PersonalReflection[];
  onGoogleSignIn: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onJumpToMonth: (monthId: number) => void;
  onFilterByDomain: (domainId: DomainId) => void;
  onOpenNoteById: (noteId: string) => void;
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
  }) => void;
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
  quarters,
  months,
  domains,
  courses,
  bookNotes,
  customCategories,
  history,
  reflections,
  onGoogleSignIn,
  onNavigateTab,
  onJumpToMonth,
  onFilterByDomain,
  onOpenNoteById,
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

  const handleCreateReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const content = refContent.trim();
    if (!content) return;
    onAddReflection({
      title: refTitle.trim(),
      content,
      moodTag: refMood,
    });
    setRefTitle('');
    setRefContent('');
  };

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
                onClick={() => onNavigateTab('plan')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>استعراض خطة الدراسة</span>
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

      {/* 4-Column KPI Strip */}
      <section aria-label="ملخص التقدم" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>الوحدات المنجزة</span>
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
            {activeMonth ? `الحالية: وحدة ${activeMonth.id}` : 'جاهز للبدء'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>المهام الصغيرة المنجزة</span>
            <Clock className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedSmallTasks}{' '}
            <span className="text-sm font-normal text-slate-500">
              / {totalSmallTasks} مهمة
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            ركائز الدراسة: {completedActivities} / {totalActivities}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>الكورسات والمراجع</span>
            <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedCourses}{' '}
            <span className="text-sm font-normal text-slate-500">
              / {courses.length} كورس
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            قابلة للإضافة والتعديل والتوسّع
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>الملاحظات والخواطر</span>
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
            {bookTypeNotesCount} كتاب · {lectureNotesCount} محاضرة ·{' '}
            {generalNotesCount} عام
          </p>
        </div>
      </section>

      {/* Comprehensive Progress Tracker Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              متابعة فورية لتقدّمك في الوحدات، المراحل، الركائز الأربع، والكورسات
            </p>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              تتبّع التقدّم الدراسي الشامل (Progress Tracker)
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
              onClick={() => onNavigateTab('plan')}
              className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              تحديث من الخطة ←
            </button>
          </div>
        </div>

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
                          else onNavigateTab('plan');
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

      {/* Personal Reflections Section (خواطري ومساحتي الخاصة) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Feather className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span>مساحة شخصية هادئة مرتبطة بحسابك فقط</span>
            </div>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              خواطري وتأملاتي الخاصة ({reflections.length})
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
          {/* Reflection Composer */}
          <form
            onSubmit={handleCreateReflection}
            className="lg:col-span-5 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                أضف خاطرة لنفسك
              </h3>
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
                              onClick={() => onDeleteReflection(refItem.id)}
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
                        onClick={() => onDeleteCustomCategory(cat.id)}
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
                        onClick={() => onDeleteHistoryEntry(entry.id)}
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
    </div>
  );
}
