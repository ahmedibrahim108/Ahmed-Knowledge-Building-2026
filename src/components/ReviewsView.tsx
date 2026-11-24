import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Lightbulb,
  PauseCircle,
  Save,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  PeriodReviewRecord,
  PeriodReviewType,
  WeeklyPlanRecord,
  formatShortArabicDate,
  getSatFriWeekRange,
  shiftWeekKey,
  toLocalDateKey,
} from '../data/curriculumData';
import {
  DailyJournalItem,
  JournalNavAction,
  WorkspaceAnalyticsInput,
  buildPeriodReviewAnalytics,
} from '../utils/journalAnalytics';
import AutoResizeTextarea from './AutoResizeTextarea';

interface ReviewsViewProps {
  analyticsInput: WorkspaceAnalyticsInput;
  periodReviews: PeriodReviewRecord[];
  weeklyPlans: WeeklyPlanRecord[];
  canEdit: boolean;
  onRequireAuth: () => void;
  onSavePeriodReview: (rev: PeriodReviewRecord) => void;
  onOpenEntity: (action: JournalNavAction) => void;
}

const PERIOD_TABS: Array<{ id: PeriodReviewType; label: string }> = [
  { id: 'weekly', label: 'أسبوعية (السبت ← الجمعة)' },
  { id: 'monthly', label: 'شهرية' },
  { id: 'quarterly', label: 'ربع سنوية' },
  { id: 'yearly', label: 'سنوية' },
];

function getDefaultPeriodKey(type: PeriodReviewType): string {
  const now = new Date();
  if (type === 'weekly') return getSatFriWeekRange(now).weekKey;
  if (type === 'monthly') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  if (type === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  }
  return String(now.getFullYear());
}

function shiftPeriodKey(
  type: PeriodReviewType,
  key: string,
  delta: number
): string {
  if (type === 'weekly') return shiftWeekKey(key, delta);
  if (type === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y || new Date().getFullYear(), (m || 1) - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (type === 'quarterly') {
    const m = /^(\d{4})-Q([1-4])$/.exec(key);
    let y = m ? Number(m[1]) : new Date().getFullYear();
    let q = m ? Number(m[2]) : 1;
    const idx = y * 4 + (q - 1) + delta;
    y = Math.floor(idx / 4);
    q = (idx % 4 + 4) % 4 + 1;
    return `${y}-Q${q}`;
  }
  const yr = Number(key) || new Date().getFullYear();
  return String(yr + delta);
}

export default function ReviewsView({
  analyticsInput,
  periodReviews,
  weeklyPlans,
  canEdit,
  onRequireAuth,
  onSavePeriodReview,
  onOpenEntity,
}: ReviewsViewProps) {
  const [periodType, setPeriodType] = useState<PeriodReviewType>('weekly');
  const [periodKeys, setPeriodKeys] = useState<Record<PeriodReviewType, string>>(() => ({
    weekly: getDefaultPeriodKey('weekly'),
    monthly: getDefaultPeriodKey('monthly'),
    quarterly: getDefaultPeriodKey('quarterly'),
    yearly: getDefaultPeriodKey('yearly'),
  }));

  const currentKey = periodKeys[periodType];
  const reviewId = `${periodType}_${currentKey}`;

  const matchedPlan = useMemo(
    () =>
      periodType === 'weekly'
        ? weeklyPlans.find((p) => p.weekKey === currentKey) || null
        : null,
    [periodType, weeklyPlans, currentKey]
  );

  const analytics = useMemo(
    () =>
      buildPeriodReviewAnalytics(
        periodType,
        currentKey,
        analyticsInput,
        matchedPlan
      ),
    [periodType, currentKey, analyticsInput, matchedPlan]
  );

  const existingSavedReview = useMemo(
    () =>
      periodReviews.find(
        (r) =>
          r.id === reviewId ||
          (r.periodType === periodType && r.periodKey === currentKey)
      ),
    [periodReviews, reviewId, periodType, currentKey]
  );

  const [reflectionDraft, setReflectionDraft] = useState('');
  const [adjustmentsDraft, setAdjustmentsDraft] = useState('');
  const [nextFocusDraft, setNextFocusDraft] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setReflectionDraft(existingSavedReview?.reflectionText || '');
    setAdjustmentsDraft(existingSavedReview?.adjustmentsText || '');
    setNextFocusDraft(existingSavedReview?.nextPeriodFocusText || '');
  }, [reviewId, existingSavedReview?.updatedAtMs]);

  const handleSave = () => {
    if (!canEdit) return onRequireAuth();
    onSavePeriodReview({
      id: reviewId,
      periodType,
      periodKey: currentKey,
      periodStartKey: analytics.startKey,
      periodEndKey: analytics.endKey,
      reflectionText: reflectionDraft,
      adjustmentsText: adjustmentsDraft,
      nextPeriodFocusText: nextFocusDraft,
      updatedAtMs: Date.now(),
    });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2400);
  };

  const renderDeltaBadge = (delta: number, suffix = '') => {
    if (delta === 0) {
      return (
        <span className="text-[11px] font-semibold text-slate-500">
          مساوٍ للفترة السابقة
        </span>
      );
    }
    return (
      <span
        className={`text-[11px] font-semibold tabular-nums ${
          delta > 0 ? 'text-emerald-700' : 'text-amber-700'
        }`}
      >
        {delta > 0 ? `+${delta}` : delta}
        {suffix} عن الفترة السابقة
      </span>
    );
  };

  const renderCompactRow = (item: DailyJournalItem) => (
    <button
      key={item.key}
      type="button"
      onClick={() => onOpenEntity(item.navAction)}
      className="w-full text-right px-3 py-2 rounded-xl bg-[#F7F8FA] hover:bg-white border border-slate-200 hover:border-[#1E3A5F]/40 flex items-center justify-between gap-2 text-xs cursor-pointer group"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 group-hover:text-[#1E3A5F] truncate">
          {item.title}
        </p>
        <p className="text-[11px] text-slate-500 truncate">
          {item.typeLabel} · {item.hubTitle}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] font-semibold text-slate-600">
          {item.statusLabel}
        </span>
        <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1E3A5F]" />
      </div>
    </button>
  );

  const periodHeadline =
    periodType === 'weekly'
      ? `السبت ${formatShortArabicDate(analytics.startKey)} ← الجمعة ${formatShortArabicDate(
          analytics.endKey
        )}`
      : periodType === 'monthly'
      ? `شهر ${currentKey} (${analytics.startKey} ← ${analytics.endKey})`
      : periodType === 'quarterly'
      ? `الربع ${currentKey} (${analytics.startKey} ← ${analytics.endKey})`
      : `مراجعة العام ${currentKey} (${analytics.startKey} ← ${analytics.endKey})`;

  const isTodayFriday = new Date().getDay() === 5;

  return (
    <div className="space-y-6">
      {/* Header & Period Type Tabs */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                المراجعات الدورية والتقارير التحليلية
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              ملخص مبني على بياناتك الفعلية بدون تكرار العناصر المتكررة عبر الأيام، مع فصل واضح بين الحقائق والملاحظات التحليلية.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPeriodType(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  periodType === t.id
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPeriodKeys((prev) => ({
                  ...prev,
                  [periodType]: shiftPeriodKey(periodType, prev[periodType], -1),
                }))
              }
              className="p-2 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              aria-label="الفترة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="px-3.5 py-2 bg-[#F7F8FA] border border-slate-200 rounded-xl text-xs font-bold text-slate-900 flex items-center gap-2 tabular-nums">
              <Calendar className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <span>{periodHeadline}</span>
            </div>

            <button
              type="button"
              onClick={() =>
                setPeriodKeys((prev) => ({
                  ...prev,
                  [periodType]: shiftPeriodKey(periodType, prev[periodType], 1),
                }))
              }
              className="p-2 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              aria-label="الفترة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setPeriodKeys((prev) => ({
                  ...prev,
                  [periodType]: getDefaultPeriodKey(periodType),
                }))
              }
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 cursor-pointer"
            >
              الفترة الحالية
            </button>
          </div>

          {periodType === 'weekly' && isTodayFriday && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] bg-[#F0F4F9] px-3 py-1.5 rounded-xl">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              يوم الجمعة: مناسب لكتابة مراجعتك الأسبوعية
            </span>
          )}
        </div>

        {/* Metrics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            <p className="text-[11px] text-emerald-800">المهام المنجزة</p>
            <p className="text-xl font-bold text-emerald-950 tabular-nums mt-0.5">
              {analytics.metrics.tasksCompleted}
            </p>
            {analytics.previousComparison && (
              <p className="mt-1">
                {renderDeltaBadge(analytics.previousComparison.tasksCompletedDelta)}
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <p className="text-[11px] text-amber-800">المهام المؤجّلة</p>
            <p className="text-xl font-bold text-amber-950 tabular-nums mt-0.5">
              {analytics.metrics.tasksPostponed}
            </p>
            <p className="text-[11px] text-amber-700 mt-1 tabular-nums">
              + {analytics.metrics.tasksPendingInPeriod} قيد الانتظار
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#F0F4F9] border border-[#1E3A5F]/15">
            <p className="text-[11px] text-[#1E3A5F]">الكورسات المتفاعلة</p>
            <p className="text-xl font-bold text-[#1E3A5F] tabular-nums mt-0.5">
              {analytics.metrics.coursesActiveOrCompleted}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80">
            <p className="text-[11px] text-sky-800">التلخيصات والمراجعة</p>
            <p className="text-xl font-bold text-sky-950 tabular-nums mt-0.5">
              {analytics.metrics.summariesCreatedOrReviewed}
            </p>
            {analytics.previousComparison && (
              <p className="mt-1">
                {renderDeltaBadge(analytics.previousComparison.summariesDelta)}
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8FA] border border-slate-200">
            <p className="text-[11px] text-slate-600">الخواطر</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {analytics.metrics.reflectionsCount}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8FA] border border-slate-200">
            <p className="text-[11px] text-slate-600">أيام النشاط الفعلي</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {analytics.activeDaysCount}
            </p>
            {analytics.previousComparison && (
              <p className="mt-1">
                {renderDeltaBadge(analytics.previousComparison.activeDaysDelta, ' أيام')}
              </p>
            )}
          </div>
        </div>

        {/* Plan vs Actual for Weekly Review when a weekly plan exists */}
        {analytics.planVsActual && (
          <div className="p-4 rounded-xl bg-[#F0F4F9] border border-[#1E3A5F]/20 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#1E3A5F]">
                مقارنة خطة الأسبوع بالتنفيذ الفعلي
              </h2>
              <span className="text-xs font-bold text-[#1E3A5F] tabular-nums">
                نسبة تنفيذ مهام الخطة: {analytics.planVsActual.completionPct}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-[#1E3A5F]/15">
              <div
                className="h-full bg-[#1E3A5F] transition-all"
                style={{ width: `${analytics.planVsActual.completionPct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-700 tabular-nums">
              <span>
                المهام المخططة: {analytics.planVsActual.completedPlannedTasks} /{' '}
                {analytics.planVsActual.plannedTasksCount} مكتملة
              </span>
              <span>مؤجّلة من الخطة: {analytics.planVsActual.postponedPlannedTasks}</span>
              {analytics.planVsActual.goalsTotal > 0 && (
                <span>
                  الأهداف الأسبوعية: {analytics.planVsActual.goalsDone} /{' '}
                  {analytics.planVsActual.goalsTotal}
                </span>
              )}
              {analytics.planVsActual.focusCoursesCount > 0 && (
                <span>
                  كورسات التركيز المدروسة: {analytics.planVsActual.focusCoursesStudied} /{' '}
                  {analytics.planVsActual.focusCoursesCount}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Visual Progress Charts (Monthly / Quarterly / Yearly) */}
      {analytics.yearlyCharts && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              الرسوم البيانية ومؤشرات التقدّم
            </h2>
            <span className="text-xs text-slate-500">
              عام {analytics.startKey.slice(0, 4)}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 12-Month Activity Bar Chart */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-900">
                الإنجاز والنشاط التعلّمي خلال أشهر السنة
              </p>
              {(() => {
                const maxVal = Math.max(
                  1,
                  ...analytics.yearlyCharts!.monthlyActivityBars.map(
                    (m) => m.completedCount + m.learningCount
                  )
                );
                return (
                  <div className="grid grid-cols-12 gap-1.5 items-end h-36 pt-2">
                    {analytics.yearlyCharts!.monthlyActivityBars.map((bar) => {
                      const total = bar.completedCount + bar.learningCount;
                      const heightPct = total > 0 ? Math.max(10, Math.round((total / maxVal) * 100)) : 4;
                      return (
                        <div
                          key={bar.monthIndex}
                          className="flex flex-col items-center gap-1 h-full justify-end"
                          title={`${bar.monthLabel}: ${bar.completedCount} مهام مكتملة · ${bar.learningCount} أنشطة تعلم`}
                        >
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            {total > 0 ? total : ''}
                          </span>
                          <div
                            className={`w-full max-w-[20px] rounded-t-md transition-all ${
                              total > 0 ? 'bg-[#1E3A5F]' : 'bg-slate-200'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[9px] text-slate-600 truncate w-full text-center">
                            {bar.monthLabel.slice(0, 5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Learning Objectives + Books Summary */}
            <div className="lg:col-span-5 grid grid-cols-1 gap-3">
              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    أهداف التعلّم المحقّقة
                  </span>
                  <span className="text-xs font-bold text-[#1E3A5F] tabular-nums">
                    {analytics.yearlyCharts.objectivesSummary.achieved} /{' '}
                    {analytics.yearlyCharts.objectivesSummary.total} (
                    {analytics.yearlyCharts.objectivesSummary.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-emerald-600"
                    style={{
                      width: `${analytics.yearlyCharts.objectivesSummary.percentage}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  يشمل أهداف الكورسات والمسارات والكتب المكتملة مقابل غير المكتملة.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>مؤشر المكتبة والقراءة</span>
                  </div>
                  <p className="text-[11px] text-slate-600 tabular-nums">
                    {analytics.yearlyCharts.booksSummary.completed} مكتمل ·{' '}
                    {analytics.yearlyCharts.booksSummary.reading} قيد القراءة ·{' '}
                    {analytics.yearlyCharts.booksSummary.totalPagesRead.toLocaleString()} صفحة
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hub Distribution & Top Studied Courses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
              <p className="text-xs font-bold text-slate-900">
                توزيع النشاط حسب المسارات المعرفية
              </p>
              {analytics.hubBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا يوجد توزيع مسجّل في هذه الفترة.
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.hubBreakdown.map((h) => {
                    const maxCnt = Math.max(
                      1,
                      ...analytics.hubBreakdown.map((x) => x.count)
                    );
                    const pct = Math.round((h.count / maxCnt) * 100);
                    return (
                      <div key={h.hubId} className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-800">{h.hubTitle}</span>
                          <span className="text-slate-600 tabular-nums">
                            {h.count} عنصر ({h.completedCount} مكتمل)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: h.accentHex,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
              <p className="text-xs font-bold text-slate-900">
                أبرز الكورسات وتقدّمها والتلخيصات المرتبطة
              </p>
              {analytics.yearlyCharts.topCourses.length === 0 ? (
                <p className="text-xs text-slate-500">لا توجد كورسات بعد.</p>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto thin-scrollbar">
                  {analytics.yearlyCharts.topCourses.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200"
                    >
                      <span className="font-semibold text-slate-900 truncate">
                        {c.title}
                      </span>
                      <span className="text-[11px] text-slate-600 tabular-nums shrink-0">
                        {c.progressPct}% · {c.notesCount} تلخيص
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 7 Structured Review Sections + Saved Manual Reflection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* 1. Achievements */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">
                  1. الإنجازات وما تم إتمامه ({analytics.achievements.length})
                </h2>
              </div>
            </div>
            {analytics.achievements.length === 0 ? (
              <p className="text-xs text-slate-500">
                لا توجد إنجازات مسجلة في هذه الفترة الزمنية.
              </p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto thin-scrollbar pl-1">
                {analytics.achievements.map(renderCompactRow)}
              </div>
            )}
          </section>

          {/* 2. Incomplete & Postponed */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <PauseCircle className="w-4 h-4 text-amber-700" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                2. ما لم يكتمل أو تم تأجيله ({analytics.incompleteOrPostponed.length})
              </h2>
            </div>
            {analytics.incompleteOrPostponed.length === 0 ? (
              <p className="text-xs text-slate-500">
                لا توجد مهام مؤجّلة أو متبقية في هذه الفترة.
              </p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto thin-scrollbar pl-1">
                {analytics.incompleteOrPostponed.map(renderCompactRow)}
              </div>
            )}
          </section>

          {/* 3. Learning Progress */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                3. التقدّم التعلّمي ({analytics.learningItems.length})
              </h2>
            </div>
            {analytics.learningItems.length === 0 ? (
              <p className="text-xs text-slate-500">
                لم يُسجّل تقدم في كورسات أو مسارات أو كتب خلال هذه الفترة.
              </p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto thin-scrollbar pl-1">
                {analytics.learningItems.map(renderCompactRow)}
              </div>
            )}
          </section>

          {/* 4, 5, 6: Strengths, Improvement Areas (Fact vs Observation), Adjustments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900">
                  4. نقاط القوة المثبتة بالبيانات
                </h2>
              </div>
              {analytics.factStrengths.length === 0 ? (
                <p className="text-xs text-slate-500">
                  ستظهر نقاط القوة تلقائيًا مع تسجيل أنشطة ومهام أكثر في الفترة.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pr-4">
                  {analytics.factStrengths.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900">
                  5. فرص التحسين (حقائق مقابل ملاحظات)
                </h2>
              </div>
              {analytics.improvementAreas.length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا توجد عقبات أو مؤشرات تأخير مرصودة في هذه الفترة.
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.improvementAreas.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg text-xs border ${
                        item.kind === 'fact'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-bold ml-1">
                        {item.kind === 'fact' ? '[حقيقة رقمية]' : '[ملاحظة تحليلية]'}
                      </span>
                      {item.text}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">
                6. تعديلات وتوصيات مقترحة للفترة القادمة
              </h2>
            </div>
            {analytics.suggestedAdjustments.length === 0 ? (
              <p className="text-xs text-slate-500">
                استمر بالوتيرة الحالية، وراجع أهداف الفترة القادمة في التخطيط الأسبوعي.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc pr-4">
                {analytics.suggestedAdjustments.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 7. Manual Saved Reflection & Adjustments */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              7. تأملاتك وتعديلاتك المحفوظة
            </h2>
            {savedToast && (
              <span className="text-xs font-semibold text-emerald-700">تم الحفظ</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              تقييمك الشخصي لهذه الفترة وخلاصتها
            </label>
            <AutoResizeTextarea
              minRows={4}
              value={reflectionDraft}
              onChange={(e) => setReflectionDraft(e.target.value)}
              placeholder="ما أبرز ما تعلّمته عن أسلوب عملك ومذاكرتك؟"
              className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              تعديلات عملية ستطبقها
            </label>
            <AutoResizeTextarea
              minRows={3}
              value={adjustmentsDraft}
              onChange={(e) => setAdjustmentsDraft(e.target.value)}
              placeholder="مثال: تقليل عدد المهام اليومية إلى 3 مهام مركّزة..."
              className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              التركيز الأساسي للفترة القادمة
            </label>
            <AutoResizeTextarea
              minRows={2}
              value={nextFocusDraft}
              onChange={(e) => setNextFocusDraft(e.target.value)}
              placeholder="مثال: إنهاء المسار التأسيسي والبدء بالتطبيق العملي..."
              className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>حفظ المراجعة</span>
          </button>

          <p className="text-[11px] text-slate-400 text-center tabular-nums">
            التاريخ المحلي: {toLocalDateKey()}
          </p>
        </aside>
      </div>
    </div>
  );
}
