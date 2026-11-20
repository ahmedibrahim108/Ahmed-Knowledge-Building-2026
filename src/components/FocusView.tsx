import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Flame,
  GraduationCap,
  Headphones,
  PauseCircle,
  Plus,
  Repeat,
  Stethoscope,
  Target,
} from 'lucide-react';
import {
  COURSE_STUDY_STAGES_META,
  CourseStudyStage,
  DentalCase,
  PersonalCourse,
  UnifiedTask,
  getCourseStageMeta,
  getHubMeta,
  getTodayDateKey,
  resolveCourseStudyStage,
} from '../data/curriculumData';
import { ActiveTab } from './Header';

interface FocusViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  courses: PersonalCourse[];
  dentalCases: DentalCase[];
  unifiedTasks: UnifiedTask[];
  onSelectCourse: (courseId: number) => void;
  onUpdateCourse: (id: number, updates: Partial<PersonalCourse>) => void;
  onUpdateUnifiedTask: (id: string, updates: Partial<UnifiedTask>) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenDentalCases: () => void;
}

export default function FocusView({
  canEdit,
  onRequireAuth,
  courses,
  dentalCases,
  unifiedTasks,
  onSelectCourse,
  onUpdateCourse,
  onUpdateUnifiedTask,
  onNavigateTab,
  onOpenDentalCases,
}: FocusViewProps) {
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const todayKey = getTodayDateKey();

  const focusCourses = useMemo(
    () =>
      courses.filter((c) => resolveCourseStudyStage(c) === 'focus_now'),
    [courses]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<CourseStudyStage, number> = {
      focus_now: 0,
      in_progress: 0,
      scheduled_later: 0,
      deferred: 0,
      heard_before: 0,
      completed: 0,
    };
    courses.forEach((c) => {
      const st = resolveCourseStudyStage(c);
      counts[st] += 1;
    });
    return counts;
  }, [courses]);

  const pickerCandidates = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return courses.filter((c) => {
      const stage = resolveCourseStudyStage(c);
      if (stage === 'focus_now') return false;
      if (q) {
        const hay = `${c.title} ${c.category} ${c.platform || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, pickerSearch]);

  const activeDentalCases = useMemo(
    () => dentalCases.filter((dc) => dc.status !== 'completed'),
    [dentalCases]
  );

  const openPriorityTasks = useMemo(
    () =>
      unifiedTasks
        .filter((t) => t.status !== 'done')
        .sort((a, b) => {
          const rank = { high: 0, medium: 1, low: 2 };
          return rank[a.priority] - rank[b.priority];
        })
        .slice(0, 6),
    [unifiedTasks]
  );

  const dueCoursesCount = useMemo(
    () =>
      courses.filter(
        (c) => Boolean(c.nextReviewDateKey) && (c.nextReviewDateKey ?? '') <= todayKey
      ).length,
    [courses, todayKey]
  );

  const handleStageChange = (
    course: PersonalCourse,
    nextStage: CourseStudyStage
  ) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const updates: Partial<PersonalCourse> = {
      studyStage: nextStage,
    };
    if (nextStage === 'completed') {
      updates.completed = true;
      updates.progressPct = 100;
    } else if (course.completed) {
      updates.completed = false;
    }
    onUpdateCourse(course.id, updates);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F]">
              <Flame className="w-4 h-4" aria-hidden="true" />
              <span>مساحة التركيز الهادئة · هنا والآن</span>
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              التركيز الحالي ({focusCourses.length} كورس · {activeDentalCases.length} حالات)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              اختر كورسًا واحدًا أو اثنين فقط للتركيز عليهما هذا الشهر بدون تشتّت بين عشرات الكورسات المؤجلة أو المجدولة لوقت لاحق.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  onRequireAuth();
                  return;
                }
                setShowCoursePicker((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>
                {showCoursePicker
                  ? 'إغلاق قائمة الاختيار'
                  : 'تحديد كورسات للتركيز الآن'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('courses')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <span>كل الكورسات ({courses.length})</span>
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Calm Overview Strip — reduces overwhelm */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-100">
          {COURSE_STUDY_STAGES_META.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onNavigateTab('courses')}
              className="text-right p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors cursor-pointer"
            >
              <span className="block text-[11px] text-slate-500 truncate">
                {st.label}
              </span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {stageCounts[st.id]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Quick Course Focus Picker Drawer */}
      {showCoursePicker && (
        <section className="bg-white border border-[#1E3A5F]/30 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                اختر من كورساتك للانتقال إلى «التركيز الحالي»
              </h2>
              <p className="text-xs text-slate-500">
                انقل أي كورس هنا للتركيز عليه الآن، ويمكنك تأجيله أو جدولته لوقت آخر في أي لحظة.
              </p>
            </div>
            <input
              type="search"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="ابحث باسم الكورس..."
              className="w-full sm:w-64 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          {pickerCandidates.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              جميع الكورسات المطابقة محددة بالفعل في التركيز الحالي أو لا توجد نتائج.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {pickerCandidates.map((c) => {
                const hubMeta = getHubMeta(c.hubId);
                const stageMeta = getCourseStageMeta(resolveCourseStudyStage(c));
                return (
                  <div
                    key={c.docId || c.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <span className="block text-[10px] font-semibold text-slate-500">
                        {hubMeta.shortTitle} · {stageMeta.shortLabel}
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {c.title}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStageChange(c, 'focus_now')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md shrink-0 cursor-pointer"
                    >
                      <Target className="w-3 h-3" aria-hidden="true" />
                      <span>ركّز عليه</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Active Focus Courses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap
              className="w-4 h-4 text-[#1E3A5F]"
              aria-hidden="true"
            />
            <h2 className="text-base font-bold text-slate-900">
              الكورسات التي أركّز عليها الآن ({focusCourses.length})
            </h2>
          </div>
          {dueCoursesCount > 0 && (
            <span className="text-xs font-medium text-rose-800 inline-flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{dueCoursesCount} مستحق للمراجعة</span>
            </span>
          )}
        </div>

        {focusCourses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <Target className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-800">
              لا توجد كورسات محددة في «التركيز الحالي» بعد
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              اضغط على «تحديد كورسات للتركيز الآن» بالأعلى واختر كورسًا واحدًا أو اثنين فقط للتركيز عليهما هذا الشهر بدون ضغط.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  onRequireAuth();
                  return;
                }
                setShowCoursePicker(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>اختيار كورس للتركيز</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {focusCourses.map((course) => {
              const hubMeta = getHubMeta(course.hubId);
              const doneTasks = course.tasks.filter((t) => t.done).length;
              const pct =
                course.progressPct ??
                (course.completed
                  ? 100
                  : course.tasks.length > 0
                  ? Math.round((doneTasks / course.tasks.length) * 100)
                  : 0);

              return (
                <article
                  key={course.docId || course.id}
                  className="bg-white border-2 border-[#1E3A5F]/25 rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#1E3A5F]">
                        {hubMeta.shortTitle}
                        {course.category ? ` · ${course.category}` : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E3A5F] text-white text-[10px] font-semibold">
                        <Flame className="w-3 h-3" aria-hidden="true" />
                        <span>تركيز الآن</span>
                      </span>
                    </div>

                    <h3
                      onClick={() => onSelectCourse(course.id)}
                      className="text-lg font-bold text-slate-900 hover:text-[#1E3A5F] cursor-pointer leading-snug"
                    >
                      {course.title}
                    </h3>

                    {course.applicationMilestone && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {course.applicationMilestone}
                      </p>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>
                          {doneTasks}/{course.tasks.length} مهام ·{' '}
                          {course.resources.length} مصادر
                        </span>
                        <span className="font-bold text-slate-800">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1E3A5F] rounded-full transition-all"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectCourse(course.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                    >
                      <span>فتح صفحة الكورس</span>
                      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStageChange(course, 'scheduled_later')}
                          title="جدولة لوقت آخر في السنة"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <CalendarClock className="w-3 h-3" aria-hidden="true" />
                          <span>جدولة لاحقًا</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStageChange(course, 'deferred')}
                          title="تأجيل حاليًا"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md cursor-pointer"
                        >
                          <PauseCircle className="w-3 h-3" aria-hidden="true" />
                          <span>تأجيل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStageChange(course, 'completed')}
                          title="تمييز كمكتمل"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          <span>مكتمل</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Two-Column Bottom Workspace: Active Dental Cases + Active Priority Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Dental Career Active Cases */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Stethoscope
                className="w-4 h-4 text-emerald-700"
                aria-hidden="true"
              />
              <h2 className="text-sm font-bold text-slate-900">
                حالات طب الأسنان النشطة ({activeDentalCases.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenDentalCases}
              className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              فتح كل الحالات ←
            </button>
          </div>

          {activeDentalCases.length === 0 ? (
            <div className="py-5 text-center space-y-2">
              <p className="text-xs text-slate-500">
                لا توجد حالات إكلينيكية قيد المتابعة الآن.
              </p>
              <button
                type="button"
                onClick={onOpenDentalCases}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة أو استعراض الحالات</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeDentalCases.slice(0, 4).map((dc) => (
                <button
                  key={dc.id}
                  type="button"
                  onClick={onOpenDentalCases}
                  className="w-full text-right p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white flex items-center gap-3 transition-colors cursor-pointer"
                >
                  {(dc.coverImageUrl || dc.coverDataUrl) && (
                    <img
                      src={dc.coverImageUrl || dc.coverDataUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {dc.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {dc.specialty}
                      {dc.caseDate ? ` · ${dc.caseDate}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 shrink-0">
                    {dc.status === 'follow_up' ? 'جلسة متابعة' : 'قيد العمل'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Active Priority Tasks */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckSquare
                className="w-4 h-4 text-[#1E3A5F]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-bold text-slate-900">
                أهم المهام المفتوحة الآن ({openPriorityTasks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('tasks')}
              className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              إدارة كل المهام ←
            </button>
          </div>

          {openPriorityTasks.length === 0 ? (
            <p className="text-xs text-slate-500 py-5 text-center">
              لا توجد مهام مفتوحة حاليًا. يومك متوازن وهادئ!
            </p>
          ) : (
            <div className="space-y-2">
              {openPriorityTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {getHubMeta(t.hubId).shortTitle}
                      {t.dueDate ? ` · ${t.dueDate}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canEdit) {
                        onRequireAuth();
                        return;
                      }
                      onUpdateUnifiedTask(t.id, { status: 'done' });
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md shrink-0 cursor-pointer"
                  >
                    إنجاز ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Heard Before / Deferred Reassurance Footer */}
      {(stageCounts.heard_before > 0 || stageCounts.deferred > 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
              <Headphones className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span>تم سماعه سابقًا: {stageCounts.heard_before}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              مؤجّل بدون ضغط: {stageCounts.deferred}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              مجدول لأوقات أخرى من السنة: {stageCounts.scheduled_later}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('courses')}
            className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
          >
            تصفية الكورسات حسب الحالة ←
          </button>
        </div>
      )}
    </div>
  );
}
