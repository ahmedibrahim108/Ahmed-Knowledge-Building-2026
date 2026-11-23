import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Compass,
  GraduationCap,
  Layers,
  ListTodo,
  NotebookPen,
  PieChart,
  Repeat,
} from 'lucide-react';
import {
  BookNote,
  LearningPath,
  PersonalCourse,
  UnifiedTask,
  getCourseStageMeta,
  getHubMeta,
  resolveCourseStudyStage,
} from '../data/curriculumData';

interface ProgressChartsProps {
  courses: PersonalCourse[];
  learningPaths: LearningPath[];
  bookNotes: BookNote[];
  unifiedTasks: UnifiedTask[];
  overallProgressPct?: number;
  onSelectCourse?: (courseId: number) => void;
  onOpenPaths?: () => void;
  onOpenJournal?: () => void;
}

const PATH_STATUS_AR: Record<LearningPath['status'], string> = {
  planned: 'مخطط له',
  in_progress: 'قيد الدراسة',
  completed: 'مكتمل',
};

export default function ProgressCharts({
  courses,
  learningPaths,
  bookNotes,
  unifiedTasks,
  onSelectCourse,
  onOpenPaths,
  onOpenJournal,
}: ProgressChartsProps) {
  const [courseFilter, setCourseFilter] = useState<'focus_active' | 'most_studied' | 'all'>(
    'focus_active'
  );

  // 1) Courses & Notes activity analytics
  const courseStats = useMemo(() => {
    return courses.map((course) => {
      const matchedNotes = bookNotes.filter(
        (bn) =>
          bn.courseId === course.id ||
          (Boolean(bn.courseTitle) &&
            bn.courseTitle!.trim().toLowerCase() === course.title.trim().toLowerCase())
      );
      const notesCount = matchedNotes.length;
      const notesReviewCount = matchedNotes.reduce(
        (sum, bn) => sum + (bn.reviewCount ?? 0),
        0
      );
      const notesListenCount = matchedNotes.reduce(
        (sum, bn) => sum + (bn.listenCount ?? 0),
        0
      );
      const totalReviews = (course.reviewCount ?? 0) + notesReviewCount;
      const totalListens = (course.listenCount ?? 0) + notesListenCount;
      const totalTasks = course.tasks.length;
      const doneTasks = course.tasks.filter((t) => t.done).length;
      const computedPct =
        course.completed
          ? 100
          : totalTasks > 0
          ? Math.max(course.progressPct ?? 0, Math.round((doneTasks / totalTasks) * 100))
          : course.progressPct ?? 0;

      const stage = resolveCourseStudyStage(course);
      const activityScore =
        (stage === 'focus_now' ? 200 : stage === 'in_progress' ? 90 : 0) +
        notesCount * 22 +
        totalReviews * 10 +
        totalListens * 8 +
        doneTasks * 6 +
        computedPct;

      return {
        course,
        stage,
        stageMeta: getCourseStageMeta(stage),
        hubMeta: getHubMeta(course.hubId),
        notesCount,
        totalReviews,
        totalListens,
        totalTasks,
        doneTasks,
        progressPct: Math.min(100, Math.max(0, computedPct)),
        activityScore,
      };
    });
  }, [courses, bookNotes]);

  const displayedCourses = useMemo(() => {
    let list = [...courseStats];
    if (courseFilter === 'focus_active') {
      const focusedOrActive = list.filter(
        (c) => c.stage === 'focus_now' || c.stage === 'in_progress'
      );
      if (focusedOrActive.length > 0) list = focusedOrActive;
      list.sort((a, b) => b.activityScore - a.activityScore);
    } else if (courseFilter === 'most_studied') {
      list.sort(
        (a, b) =>
          b.notesCount + b.totalReviews + b.totalListens -
          (a.notesCount + a.totalReviews + a.totalListens)
      );
    } else {
      list.sort((a, b) => b.progressPct - a.progressPct);
    }
    return list.slice(0, 6);
  }, [courseStats, courseFilter]);

  // 2) Learning Paths analytics
  const pathStats = useMemo(() => {
    return learningPaths.map((path) => {
      const totalStages = path.stages.length;
      const doneStages = path.stages.filter((s) => s.done).length;
      const pct =
        path.status === 'completed'
          ? 100
          : totalStages > 0
          ? Math.round((doneStages / totalStages) * 100)
          : Math.min(100, Math.max(0, path.progressPct ?? 0));
      return {
        path,
        hubMeta: getHubMeta(path.hubId),
        totalStages,
        doneStages,
        pct,
      };
    });
  }, [learningPaths]);

  // 3) Overall Metrics for Donut Rings
  const doneUnifiedTasks = unifiedTasks.filter((t) => t.status === 'done').length;
  const totalUnifiedTasks = unifiedTasks.length;
  const tasksPct =
    totalUnifiedTasks > 0
      ? Math.round((doneUnifiedTasks / totalUnifiedTasks) * 100)
      : 0;

  const avgPathsPct =
    pathStats.length > 0
      ? Math.round(pathStats.reduce((sum, p) => sum + p.pct, 0) / pathStats.length)
      : 0;

  const completedCoursesCount = courseStats.filter(
    (c) => c.course.completed || c.progressPct >= 100
  ).length;
  const avgCoursesPct =
    courseStats.length > 0
      ? Math.round(
          courseStats.reduce((sum, c) => sum + c.progressPct, 0) / courseStats.length
        )
      : 0;

  const activeFocusCount = courseStats.filter((c) => c.stage === 'focus_now').length;
  const courseLinkedNotesTotal = courseStats.reduce((s, c) => s + c.notesCount, 0);
  const totalStudySessions = courseStats.reduce(
    (s, c) => s + c.totalReviews + c.totalListens,
    0
  );

  const compositePct = useMemo(() => {
    const metrics: number[] = [];
    if (pathStats.length > 0) metrics.push(avgPathsPct);
    if (courseStats.length > 0) metrics.push(avgCoursesPct);
    if (totalUnifiedTasks > 0) metrics.push(tasksPct);
    if (metrics.length === 0) return 0;
    return Math.round(metrics.reduce((a, b) => a + b, 0) / metrics.length);
  }, [pathStats.length, avgPathsPct, courseStats.length, avgCoursesPct, totalUnifiedTasks, tasksPct]);

  const rings = [
    {
      id: 'paths',
      label: 'تقدم المسارات',
      pct: avgPathsPct,
      detail:
        pathStats.length > 0
          ? `${pathStats.filter((p) => p.pct >= 100).length} / ${pathStats.length} مسار`
          : 'لا مسارات بعد',
      radius: 58,
      color: '#1E3A5F',
      track: '#E2E8F0',
    },
    {
      id: 'courses',
      label: 'تقدم الكورسات',
      pct: avgCoursesPct,
      detail: `${completedCoursesCount} / ${courses.length} كورس`,
      radius: 44,
      color: '#059669',
      track: '#D1FAE5',
    },
    {
      id: 'tasks',
      label: 'إنجاز المهام',
      pct: tasksPct,
      detail: `${doneUnifiedTasks} / ${totalUnifiedTasks} مهمة`,
      radius: 30,
      color: '#B45309',
      track: '#FEF3C7',
    },
  ];

  const maxActivityNotes = Math.max(
    1,
    ...displayedCourses.map((c) => c.notesCount + c.totalReviews + c.totalListens)
  );

  return (
    <div className="space-y-6">
      {/* Top Row: Composite Multi-Ring Overview + Key Study Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 p-5 bg-[#F7F8FA] border border-slate-200 rounded-xl flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                المؤشر العام للمسارات والكورسات والمهام
              </h3>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg
                viewBox="0 0 144 144"
                className="w-36 h-36 -rotate-90"
                role="img"
                aria-label={`معدل التقدّم العام ${compositePct}%`}
              >
                {rings.map((ring) => {
                  const circumference = 2 * Math.PI * ring.radius;
                  const dashOffset =
                    circumference - (circumference * Math.min(100, ring.pct)) / 100;
                  return (
                    <g key={ring.id}>
                      <circle
                        cx="72"
                        cy="72"
                        r={ring.radius}
                        fill="none"
                        stroke={ring.track}
                        strokeWidth="8.5"
                      />
                      <circle
                        cx="72"
                        cy="72"
                        r={ring.radius}
                        fill="none"
                        stroke={ring.color}
                        strokeWidth="8.5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        className="transition-all duration-500"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">
                  {compositePct}%
                </span>
                <span className="text-[10px] font-medium text-slate-500 mt-1">
                  المتوسط العام
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2">
              {rings.map((ring) => (
                <div
                  key={ring.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200/80"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ring.color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {ring.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums">
                    <span className="text-slate-500 text-[11px]">{ring.detail}</span>
                    <span className="font-bold text-slate-900 w-9 text-left">
                      {ring.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Concise Focus & Study KPIs */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-[#F7F8FA] border border-slate-200 rounded-xl flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">مسارات نشطة</span>
              <Compass className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {learningPaths.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                متوسط الإنجاز {avgPathsPct}%
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#F7F8FA] border border-slate-200 rounded-xl flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">في دائرة التركيز</span>
              <GraduationCap className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {activeFocusCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                من أصل {courses.length} كورس
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenJournal?.()}
            className="p-4 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col justify-between gap-2 text-right transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">ملاحظات الكورسات</span>
              <NotebookPen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {courseLinkedNotesTotal}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                إجمالي التلخيصات {bookNotes.length}
              </p>
            </div>
          </button>

          <div className="p-4 bg-[#F7F8FA] border border-slate-200 rounded-xl flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">مراجعات واستماع</span>
              <Repeat className="w-4 h-4 text-[#059669]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {totalStudySessions}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                تكرار وسماع مسجّل
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Learning Paths Visual Progress + Courses & Notes/Focus Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Learning Paths Progress Visualizer */}
        <div className="lg:col-span-5 p-5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                تمثيل مرئي لمسارات التعلّم
              </h3>
            </div>
            {onOpenPaths && (
              <button
                type="button"
                onClick={onOpenPaths}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
              >
                <span>عرض المسارات</span>
                <ArrowLeft className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          {pathStats.length === 0 ? (
            <div className="p-6 bg-white border border-dashed border-slate-200 rounded-xl text-center space-y-2">
              <p className="text-xs text-slate-500">
                لم تُنشأ مسارات تعلّم بعد. يمكنك بناء مساراتك وربطها بالكورسات.
              </p>
              {onOpenPaths && (
                <button
                  type="button"
                  onClick={onOpenPaths}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                >
                  إنشاء أول مسار
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {pathStats.map(({ path, hubMeta, totalStages, doneStages, pct }) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => onOpenPaths?.()}
                  className="w-full text-right p-3.5 bg-white hover:border-[#1E3A5F]/40 border border-slate-200 rounded-xl space-y-2.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {path.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {hubMeta.shortTitle} · {PATH_STATUS_AR[path.status]}
                        {totalStages > 0 ? ` · ${doneStages}/${totalStages} مرحلة` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#1E3A5F] tabular-nums shrink-0">
                      {pct}%
                    </span>
                  </div>

                  {/* Stage progress bar + discrete stage pips */}
                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 100 ? 'bg-emerald-600' : 'bg-[#1E3A5F]'
                        }`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                    {path.stages.length > 0 && path.stages.length <= 12 && (
                      <div className="flex items-center gap-1" aria-hidden="true">
                        {path.stages.map((st) => (
                          <span
                            key={st.id}
                            title={st.title}
                            className={`h-1 flex-1 rounded-full ${
                              st.done ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Courses, Focus & Notes/Review Visualization */}
        <div className="lg:col-span-7 p-5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                الكورسات والتركيز ونشاط المذاكرة والملاحظات
              </h3>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg text-[11px]">
              {(
                [
                  { id: 'focus_active', label: 'قيد التركيز والنشطة' },
                  { id: 'most_studied', label: 'الأكثر مراجعة وتلخيصًا' },
                  { id: 'all', label: 'الأعلى تقدمًا' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCourseFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    courseFilter === tab.id
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {displayedCourses.length === 0 ? (
            <div className="p-6 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
              لا توجد كورسات مسجّلة لعرضها هنا حاليًا.
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedCourses.map((item) => {
                const studyLoad =
                  item.notesCount + item.totalReviews + item.totalListens;
                const activityBarPct = Math.round(
                  (studyLoad / maxActivityNotes) * 100
                );
                return (
                  <button
                    key={item.course.id}
                    type="button"
                    onClick={() => onSelectCourse?.(item.course.id)}
                    className="w-full text-right p-3.5 bg-white hover:border-[#1E3A5F]/40 border border-slate-200 rounded-xl space-y-2 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.course.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums truncate">
                          {item.hubMeta.shortTitle} · {item.stageMeta.label} ·{' '}
                          {item.notesCount} تلخيص/ملاحظة · {item.totalReviews} مراجعة ·{' '}
                          {item.totalListens} استماع
                          {item.totalTasks > 0
                            ? ` · ${item.doneTasks}/${item.totalTasks} مهمة`
                            : ''}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#1E3A5F] tabular-nums shrink-0">
                        {item.progressPct}%
                      </span>
                    </div>

                    {/* Dual compact bars: Top = Course Completion %, Bottom = Notes & Review engagement */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>تقدّم الكورس</span>
                          <span className="tabular-nums">{item.progressPct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.progressPct >= 100
                                ? 'bg-emerald-600'
                                : 'bg-[#1E3A5F]'
                            }`}
                            style={{ width: `${Math.max(item.progressPct, 3)}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ListTodo className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                            <span>كثافة المذاكرة (ملاحظات + مراجعة)</span>
                          </span>
                          <span className="tabular-nums">{studyLoad}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                            style={{ width: `${studyLoad > 0 ? Math.max(activityBarPct, 6) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
