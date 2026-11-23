import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  Globe,
  GraduationCap,
  Headphones,
  Lock,
  PenLine,
  Plus,
  Repeat,
  Search,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import {
  BookNote,
  COURSE_STUDY_STAGES_META,
  CourseStudyStage,
  DentalCase,
  EntitySortMode,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  PersonalCourse,
  PracticalProject,
  ReadingLibraryItem,
  UnifiedTask,
  getCourseStageMeta,
  getHubMeta,
  getTodayDateKey,
  resolveCourseStudyStage,
  sortCoursesList,
} from '../data/curriculumData';
import {
  isPdfAttachment,
  isViewableDocumentAttachment,
} from '../utils/documentImportExport';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import DentalCasesView from './DentalCasesView';
import TaskFormModal from './TaskFormModal';

interface CoursesViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  courses: PersonalCourse[];
  bookNotes?: BookNote[];
  dentalCases?: DentalCase[];
  learningPaths?: LearningPath[];
  readingItems?: ReadingLibraryItem[];
  projects?: PracticalProject[];
  onSelectCourse: (id: number) => void;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  hubCategories: Record<LearningHubId, string[]>;
  activeSection?: 'courses' | 'dental_cases';
  onChangeSection?: (section: 'courses' | 'dental_cases') => void;
  onAddCourse: (course: {
    title: string;
    hubId: LearningHubId;
    category: string;
    studyStage?: CourseStudyStage;
    scheduledPeriod?: string;
    instructor?: string;
    platform?: string;
    durationLabel?: string;
    startDate?: string;
    targetDate?: string;
    notes?: string;
    complementaryBook: string;
    bookAuthor: string;
    applicationMilestone: string;
    linkedMonths: number[];
  }) => void;
  onUpdateCourse?: (id: number, updates: Partial<PersonalCourse>) => void;
  onDeleteCourse: (id: number) => void;
  onOpenCourseNote: (
    course: PersonalCourse,
    lectureTitle?: string,
    initialContent?: string
  ) => void;
  onAddUnifiedTask?: (payload: Omit<UnifiedTask, 'id'>) => void;
  onAddDentalCase?: (
    payload: Omit<DentalCase, 'id'>
  ) => string | undefined;
  onUpdateDentalCase?: (id: string, updates: Partial<DentalCase>) => void;
  onDeleteDentalCase?: (id: string) => void;
}

export default function CoursesView({
  uid,
  canEdit,
  onRequireAuth,
  courses,
  bookNotes = [],
  dentalCases = [],
  learningPaths = [],
  readingItems = [],
  projects = [],
  onSelectCourse,
  activeHubFilter,
  onChangeHubFilter,
  hubCategories,
  activeSection,
  onChangeSection,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onOpenCourseNote,
  onAddUnifiedTask,
  onAddDentalCase,
  onUpdateDentalCase,
  onDeleteDentalCase,
}: CoursesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<CourseStudyStage | 'all'>(
    'all'
  );
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [onlyDueToday, setOnlyDueToday] = useState(false);
  const [sortMode, setSortMode] = useState<EntitySortMode>('manual');
  const [quickTaskCourse, setQuickTaskCourse] = useState<PersonalCourse | null>(
    null
  );
  const [localSection, setLocalSection] = useState<'courses' | 'dental_cases'>(
    activeSection ?? 'courses'
  );

  const effectiveSection = activeSection ?? localSection;
  const setEffectiveSection = (next: 'courses' | 'dental_cases') => {
    setLocalSection(next);
    onChangeSection?.(next);
  };

  // Add Course State (Only Title Required)
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseHub, setNewCourseHub] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'marketing' : activeHubFilter
  );
  const [newCourseCategory, setNewCourseCategory] = useState('');
  const [newCourseStage, setNewCourseStage] =
    useState<CourseStudyStage>('in_progress');
  const [newCourseScheduledPeriod, setNewCourseScheduledPeriod] = useState('');
  const [newCourseInstructor, setNewCourseInstructor] = useState('');
  const [newCoursePlatform, setNewCoursePlatform] = useState('');
  const [newCourseDuration, setNewCourseDuration] = useState('');
  const [newCourseStartDate, setNewCourseStartDate] = useState('');
  const [newCourseTargetDate, setNewCourseTargetDate] = useState('');
  const [newCourseBook, setNewCourseBook] = useState('');
  const [newCourseAuthor, setNewCourseAuthor] = useState('');
  const [newCourseMilestone, setNewCourseMilestone] = useState('');
  const [newCourseMonths, setNewCourseMonths] = useState('');
  const [newCourseNotes, setNewCourseNotes] = useState('');

  const [confirmDeleteCourse, setConfirmDeleteCourse] =
    useState<PersonalCourse | null>(null);

  useEffect(() => {
    if (activeHubFilter !== 'all') {
      setNewCourseHub(activeHubFilter);
    }
    if (activeHubFilter !== 'dental_career' && effectiveSection === 'dental_cases') {
      setEffectiveSection('courses');
    }
  }, [activeHubFilter]);

  const todayKey = getTodayDateKey();

  const hubMatchedCourses = useMemo(() => {
    return courses.filter((c) => {
      const hub = c.hubId ?? 'knowledge';
      return activeHubFilter === 'all' || hub === activeHubFilter;
    });
  }, [courses, activeHubFilter]);

  const stageCounts = useMemo(() => {
    const map: Record<CourseStudyStage, number> = {
      focus_now: 0,
      in_progress: 0,
      scheduled_later: 0,
      deferred: 0,
      heard_before: 0,
      completed: 0,
    };
    for (const c of hubMatchedCourses) {
      map[resolveCourseStudyStage(c)] += 1;
    }
    return map;
  }, [hubMatchedCourses]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = hubMatchedCourses.filter((c) => {
      const stage = resolveCourseStudyStage(c);
      if (stageFilter !== 'all' && stage !== stageFilter) return false;
      if (onlyRepeated && (c.listenCount ?? 0) < 2 && (c.reviewCount ?? 0) < 2) {
        return false;
      }
      if (
        onlyDueToday &&
        (!c.nextReviewDateKey || c.nextReviewDateKey > todayKey)
      ) {
        return false;
      }
      if (q) {
        const hay = [
          c.title,
          c.category,
          c.instructor,
          c.platform,
          c.complementaryBook,
          c.applicationMilestone,
          c.scheduledPeriod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortCoursesList(list, sortMode);
  }, [
    hubMatchedCourses,
    stageFilter,
    onlyRepeated,
    onlyDueToday,
    searchQuery,
    todayKey,
    sortMode,
  ]);

  const completedCount = courses.filter(
    (c) => resolveCourseStudyStage(c) === 'completed' || c.completed
  ).length;

  const requireEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const title = newCourseTitle.trim();
    if (!title) return;

    const parsedMonths = newCourseMonths
      .split(/[,،\s]+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 100);

    onAddCourse({
      title,
      hubId: newCourseHub,
      category: newCourseCategory.trim(),
      studyStage: newCourseStage,
      scheduledPeriod:
        newCourseStage === 'scheduled_later'
          ? newCourseScheduledPeriod.trim()
          : '',
      instructor: newCourseInstructor.trim(),
      platform: newCoursePlatform.trim(),
      durationLabel: newCourseDuration.trim(),
      startDate: newCourseStartDate,
      targetDate: newCourseTargetDate,
      notes: newCourseNotes.trim(),
      complementaryBook: newCourseBook.trim(),
      bookAuthor: newCourseAuthor.trim(),
      applicationMilestone: newCourseMilestone.trim(),
      linkedMonths: parsedMonths,
    });

    setNewCourseTitle('');
    setNewCourseCategory('');
    setNewCourseStage('in_progress');
    setNewCourseScheduledPeriod('');
    setNewCourseInstructor('');
    setNewCoursePlatform('');
    setNewCourseDuration('');
    setNewCourseStartDate('');
    setNewCourseTargetDate('');
    setNewCourseBook('');
    setNewCourseAuthor('');
    setNewCourseMilestone('');
    setNewCourseMonths('');
    setNewCourseNotes('');
    setShowAddCourse(false);
  };

  const handleQuickStageChange = (
    course: PersonalCourse,
    nextStage: CourseStudyStage
  ) => {
    if (!requireEdit() || !onUpdateCourse) return;
    onUpdateCourse(course.id, {
      studyStage: nextStage,
      completed: nextStage === 'completed',
    });
  };

  const handleMoveCourseOrder = (index: number, direction: 'up' | 'down') => {
    if (!requireEdit() || !onUpdateCourse) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= filteredCourses.length) return;
    const reordered = [...filteredCourses];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    reordered.forEach((item, idx) => {
      const nextOrder = idx + 1;
      if ((item.sortOrder ?? 0) !== nextOrder) {
        onUpdateCourse(item.id, { sortOrder: nextOrder });
      }
    });
  };

  const addHubCats = hubCategories[newCourseHub] ?? [];
  const showDentalSwitcher =
    activeHubFilter === 'dental_career' || effectiveSection === 'dental_cases';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs text-slate-500">
              منظومة الكورسات الشاملة · الماركتينج، الدنتال والكارير، والثقافة والمعرفة
            </p>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              {effectiveSection === 'dental_cases'
                ? `حالات طب الأسنان السريرية (${dentalCases.length})`
                : `الكورسات والتطبيق (${courses.length})`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {effectiveSection === 'dental_cases'
                ? 'وثّق حالات العيادة بالصور الإشعاعية والسريرية والملاحظات العلاجية في مساحة مستقلة متزامنة عبر أجهزتك.'
                : 'رتّب كورساتك بوضوح حسب حالة التركيز (أركّز عليه الآن، مجدول لاحقًا، مؤجّل، مسموع سابقًا) واضغط على أي كورس لفتح صفحته المستقلة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              المنجز: {completedCount} / {courses.length}
            </span>

            {onAddDentalCase && (
              <button
                type="button"
                onClick={() => {
                  if (effectiveSection === 'dental_cases') {
                    setEffectiveSection('courses');
                  } else {
                    onChangeHubFilter('dental_career');
                    setEffectiveSection('dental_cases');
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  effectiveSection === 'dental_cases'
                    ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <Stethoscope className="w-4 h-4" aria-hidden="true" />
                <span>
                  {effectiveSection === 'dental_cases'
                    ? 'العودة إلى الكورسات'
                    : `ملف حالات الأسنان (${dentalCases.length})`}
                </span>
              </button>
            )}

            {effectiveSection === 'courses' && (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) {
                    onRequireAuth();
                    return;
                  }
                  setShowAddCourse((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{showAddCourse ? 'إلغاء' : '+ إضافة كورس جديد'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Learning Hubs Filter */}
        <div className="pt-4 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onChangeHubFilter('all');
                setEffectiveSection('courses');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                activeHubFilter === 'all' && effectiveSection === 'courses'
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              جميع المسارات ({courses.length})
            </button>
            {LEARNING_HUBS.map((hub) => {
              const count = courses.filter(
                (c) => (c.hubId ?? 'knowledge') === hub.id
              ).length;
              const active = activeHubFilter === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => {
                    onChangeHubFilter(hub.id);
                    if (hub.id !== 'dental_career') {
                      setEffectiveSection('courses');
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {hub.shortTitle} ({count})
                </button>
              );
            })}
          </div>

          {showDentalSwitcher && onAddDentalCase && (
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setEffectiveSection('courses')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  effectiveSection === 'courses'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
                <span>كورسات الدنتال</span>
              </button>
              <button
                type="button"
                onClick={() => setEffectiveSection('dental_cases')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  effectiveSection === 'dental_cases'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حالات طب الأسنان ({dentalCases.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Course Stage Triage Filter Pills & Search (only when viewing courses) */}
        {effectiveSection === 'courses' && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors ${
                  stageFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                كل الحالات ({hubMatchedCourses.length})
              </button>
              {COURSE_STUDY_STAGES_META.map((meta) => {
                const count = stageCounts[meta.id] ?? 0;
                const active = stageFilter === meta.id;
                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() => setStageFilter(meta.id)}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {meta.shortLabel} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyRepeated((v) => !v)}
                  aria-pressed={onlyRepeated}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer ${
                    onlyRepeated
                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>مسموع / مسجل أكثر من مرة (+2)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOnlyDueToday((v) => !v)}
                  aria-pressed={onlyDueToday}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer ${
                    onlyDueToday
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>مستحق للمراجعة</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <select
                    aria-label="ترتيب الكورسات"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as EntitySortMode)}
                    className="px-2.5 py-1.5 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="manual">ترتيب يدوي (أسهم)</option>
                    <option value="stage">حسب مرحلة الدراسة</option>
                    <option value="title">ترتيب أبجدي</option>
                    <option value="updated">الأحدث إضافة</option>
                  </select>
                </label>

                <div className="relative flex-1 sm:w-64">
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في الكورسات..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dental Cases Sub-Section */}
      {effectiveSection === 'dental_cases' &&
      onAddDentalCase &&
      onUpdateDentalCase &&
      onDeleteDentalCase ? (
        <DentalCasesView
          uid={uid}
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
          dentalCases={dentalCases}
          courses={courses}
          onAddDentalCase={onAddDentalCase}
          onUpdateDentalCase={onUpdateDentalCase}
          onDeleteDentalCase={onDeleteDentalCase}
          onOpenCourse={onSelectCourse}
        />
      ) : (
        <>
          {/* Flexible Add Course Form (Only Title Required) */}
          {showAddCourse && canEdit && (
            <form
              onSubmit={handleCreateCourse}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  إضافة كورس جديد
                </h2>
                <span className="text-[11px] text-slate-500">
                  اسم الكورس فقط إجباري وباقي الحقول اختيارية
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  اسم الكورس *
                  <input
                    type="text"
                    required
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder="مثلاً: كورس Meta Ads أو Endodontics Masterclass"
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  المسار (Hub)
                  <select
                    value={newCourseHub}
                    onChange={(e) => {
                      setNewCourseHub(e.target.value as LearningHubId);
                      setNewCourseCategory('');
                    }}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {LEARNING_HUBS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  تصنيف الحالة والتركيز
                  <select
                    value={newCourseStage}
                    onChange={(e) =>
                      setNewCourseStage(e.target.value as CourseStudyStage)
                    }
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {COURSE_STUDY_STAGES_META.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </label>

                {newCourseStage === 'scheduled_later' && (
                  <label className="block text-xs font-medium text-slate-700">
                    الفترة المجدولة خلال السنة (اختياري)
                    <input
                      type="text"
                      value={newCourseScheduledPeriod}
                      onChange={(e) =>
                        setNewCourseScheduledPeriod(e.target.value)
                      }
                      placeholder="مثلاً: الربع الثالث 2026 / أغسطس"
                      className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </label>
                )}

                <label className="block text-xs font-medium text-slate-700">
                  الفئة / التخصص (اختياري)
                  <input
                    type="text"
                    list="new-course-cat-list"
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    placeholder="اختر أو اكتب تصنيفًا..."
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <datalist id="new-course-cat-list">
                    {addHubCats.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  المحاضر / المدرب (اختياري)
                  <input
                    type="text"
                    value={newCourseInstructor}
                    onChange={(e) => setNewCourseInstructor(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  المنصة / المصدر (اختياري)
                  <input
                    type="text"
                    value={newCoursePlatform}
                    onChange={(e) => setNewCoursePlatform(e.target.value)}
                    placeholder="YouTube / Coursera / Udemy..."
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  المدة (اختياري)
                  <input
                    type="text"
                    value={newCourseDuration}
                    onChange={(e) => setNewCourseDuration(e.target.value)}
                    placeholder="مثلاً: 10 ساعات"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  تاريخ البدء (اختياري)
                  <input
                    type="date"
                    value={newCourseStartDate}
                    onChange={(e) => setNewCourseStartDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  التاريخ المستهدف (اختياري)
                  <input
                    type="date"
                    value={newCourseTargetDate}
                    onChange={(e) => setNewCourseTargetDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  المرجع الكتابي المكمل (اختياري)
                  <input
                    type="text"
                    value={newCourseBook}
                    onChange={(e) => setNewCourseBook(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  مؤلف المرجع (اختياري)
                  <input
                    type="text"
                    value={newCourseAuthor}
                    onChange={(e) => setNewCourseAuthor(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  الوحدات المرتبطة (اختياري)
                  <input
                    type="text"
                    value={newCourseMonths}
                    onChange={(e) => setNewCourseMonths(e.target.value)}
                    placeholder="أرقام مفصولة بفاصلة"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-slate-700">
                هدف التطبيق العملي (اختياري)
                <textarea
                  rows={2}
                  value={newCourseMilestone}
                  onChange={(e) => setNewCourseMilestone(e.target.value)}
                  placeholder="الهدف التطبيقي..."
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourse(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
                >
                  حفظ الكورس
                </button>
              </div>
            </form>
          )}

          {/* Courses Cards Grid */}
          {filteredCourses.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                لا توجد كورسات مطابقة للتصفية الحالية
              </p>
              <p className="text-xs text-slate-500">
                يمكنك تغيير تصنيف الحالة أو إضافة كورس جديد لأي مسار.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course, idx) => {
                const hubMeta = getHubMeta(course.hubId);
                const resolvedStage = resolveCourseStudyStage(course);
                const stageMeta = getCourseStageMeta(resolvedStage);
                const tasksDone = course.tasks.filter((t) => t.done).length;
                const pct =
                  course.progressPct ??
                  (course.completed
                    ? 100
                    : course.tasks.length > 0
                    ? Math.round((tasksDone / course.tasks.length) * 100)
                    : 0);
                const attachedDocsCount = course.resources.filter(
                  (r) =>
                    isPdfAttachment(r.attachmentName, r.mimeType) ||
                    isViewableDocumentAttachment(r.attachmentName, r.mimeType) ||
                    Boolean(r.attachmentName)
                ).length;
                const notesCount = bookNotes.filter(
                  (bn) =>
                    bn.courseId === course.id ||
                    (bn.noteType === 'course_lecture' &&
                      bn.courseTitle === course.title)
                ).length;

                return (
                  <article
                    key={course.docId || course.id}
                    onClick={() => onSelectCourse(course.id)}
                    className={`bg-white border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer group ${
                      resolvedStage === 'focus_now'
                        ? 'border-[#1E3A5F]/50 ring-1 ring-[#1E3A5F]/15'
                        : 'border-slate-200 hover:border-[#1E3A5F]/50'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 min-w-0">
                          <span className="font-semibold text-[#1E3A5F]">
                            {hubMeta.shortTitle}
                          </span>
                          {course.category && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{course.category}</span>
                            </>
                          )}
                        </div>

                        {canEdit && (
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sortMode === 'manual' && onUpdateCourse && (
                              <>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveCourseOrder(idx, 'up')}
                                  aria-label="تقديم الكورس"
                                  className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === filteredCourses.length - 1}
                                  onClick={() => handleMoveCourseOrder(idx, 'down')}
                                  aria-label="تأخير الكورس"
                                  className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCourse(course)}
                              aria-label={`حذف ${course.title}`}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Stage Badge, Visibility & Scheduled Period */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${stageMeta.badgeClass}`}
                        >
                          {stageMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border ${
                            course.isPublic
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {course.isPublic ? (
                            <Globe className="w-2.5 h-2.5" aria-hidden="true" />
                          ) : (
                            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                          )}
                          <span>{course.isPublic ? 'عام' : 'خاص'}</span>
                        </span>
                        {resolvedStage === 'scheduled_later' &&
                          course.scheduledPeriod && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-sky-50 text-sky-900 border border-sky-200">
                              <CalendarClock
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                              <span>{course.scheduledPeriod}</span>
                            </span>
                          )}
                      </div>

                      <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F] leading-snug">
                        <BidiText text={course.title} />
                      </h2>

                      {(course.instructor || course.platform) && (
                        <p className="text-xs text-slate-500">
                          {[course.instructor, course.platform]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}

                      {course.applicationMilestone && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          <BidiText text={course.applicationMilestone} />
                        </p>
                      )}

                      {((course.listenCount ?? 0) >= 2 ||
                        (course.reviewCount ?? 0) > 0 ||
                        attachedDocsCount > 0) && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          {(course.listenCount ?? 0) >= 2 && (
                            <span className="text-amber-800 font-medium">
                              سماع متكرر ({course.listenCount}×)
                            </span>
                          )}
                          {(course.reviewCount ?? 0) > 0 && (
                            <span className="text-emerald-800 font-medium">
                              مراجعات ({course.reviewCount}×)
                            </span>
                          )}
                          {attachedDocsCount > 0 && (
                            <span className="text-[#1E3A5F] font-medium tabular-nums">
                              {attachedDocsCount} ملف مرفق
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {/* Quick Stage Switcher */}
                      {canEdit && onUpdateCourse && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-between gap-2"
                        >
                          <label className="text-[11px] font-medium text-slate-500 shrink-0">
                            الحالة:
                          </label>
                          <select
                            aria-label={`تغيير حالة ${course.title}`}
                            value={resolvedStage}
                            onChange={(e) =>
                              handleQuickStageChange(
                                course,
                                e.target.value as CourseStudyStage
                              )
                            }
                            className="flex-1 min-w-0 px-2 py-1 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-[#1E3A5F] cursor-pointer"
                          >
                            {COURSE_STUDY_STAGES_META.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                          <span>
                            {tasksDone}/{course.tasks.length} مهام ·{' '}
                            {course.resources.length} مصادر · {notesCount} نوتس
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              course.completed ? 'bg-emerald-600' : 'bg-[#1E3A5F]'
                            }`}
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCourse(course.id);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <span>عرض صفحة الكورس</span>
                        </button>
                        {canEdit && onAddUnifiedTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickTaskCourse(course);
                            }}
                            title="إنشاء مهمة مرتبطة بهذا الكورس"
                            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>مهمة</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCourseNote(course);
                          }}
                          title="فتح دفتر تلخيص الكورس"
                          className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>نوتس</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteCourse)}
        title="تأكيد الحذف"
        message={
          confirmDeleteCourse
            ? `هل أنت متأكد من حذف الكورس «${confirmDeleteCourse.title}» نهائيًا؟`
            : ''
        }
        onConfirm={() => {
          if (confirmDeleteCourse) {
            onDeleteCourse(confirmDeleteCourse.id);
          }
          setConfirmDeleteCourse(null);
        }}
        onCancel={() => setConfirmDeleteCourse(null)}
      />

      {onAddUnifiedTask && (
        <TaskFormModal
          open={Boolean(quickTaskCourse)}
          onClose={() => setQuickTaskCourse(null)}
          prefill={
            quickTaskCourse
              ? {
                  hubId: quickTaskCourse.hubId ?? 'knowledge',
                  categoryLabel: quickTaskCourse.category || '',
                  linkedCourseId: quickTaskCourse.id,
                  linkedLabel: quickTaskCourse.title,
                  projectId: `course:${quickTaskCourse.id}`,
                }
              : undefined
          }
          courses={courses}
          learningPaths={learningPaths}
          readingItems={readingItems}
          projects={projects}
          hubCategories={hubCategories}
          onSubmit={(payload) => onAddUnifiedTask(payload)}
        />
      )}
    </div>
  );
}
