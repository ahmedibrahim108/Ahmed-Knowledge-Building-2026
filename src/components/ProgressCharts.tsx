import { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, PieChart } from 'lucide-react';
import { MonthPlan, PersonalCourse, QuarterInfo } from '../data/curriculumData';

interface ProgressChartsProps {
  months: MonthPlan[];
  quarters: QuarterInfo[];
  courses: PersonalCourse[];
  overallProgressPct: number;
  completedSmallTasks: number;
  totalSmallTasks: number;
  completedActivities: number;
  totalActivities: number;
  completedCourses: number;
  onJumpToMonth: (monthId: number) => void;
}

export default function ProgressCharts({
  months,
  quarters,
  courses,
  overallProgressPct,
  completedSmallTasks,
  totalSmallTasks,
  completedActivities,
  totalActivities,
  completedCourses,
  onJumpToMonth,
}: ProgressChartsProps) {
  const [chartMode, setChartMode] = useState<'units' | 'pillars' | 'quarters'>(
    'units'
  );
  const [hoveredBarKey, setHoveredBarKey] = useState<string | null>(null);

  const taskPct =
    totalSmallTasks > 0
      ? Math.round((completedSmallTasks / totalSmallTasks) * 100)
      : 0;
  const activityPct =
    totalActivities > 0
      ? Math.round((completedActivities / totalActivities) * 100)
      : 0;
  const coursePct =
    courses.length > 0
      ? Math.round((completedCourses / courses.length) * 100)
      : 0;

  // Multi-ring Donut chart geometry (r = 58, 44, 30)
  const rings = [
    {
      id: 'tasks',
      label: 'المهام الصغيرة',
      pct: taskPct,
      detail: `${completedSmallTasks} / ${totalSmallTasks}`,
      radius: 58,
      color: '#1E3A5F',
      track: '#E2E8F0',
    },
    {
      id: 'activities',
      label: 'ركائز الدراسة',
      pct: activityPct,
      detail: `${completedActivities} / ${totalActivities}`,
      radius: 44,
      color: '#059669',
      track: '#D1FAE5',
    },
    {
      id: 'courses',
      label: 'إتمام الكورسات',
      pct: coursePct,
      detail: `${completedCourses} / ${courses.length}`,
      radius: 30,
      color: '#D97706',
      track: '#FEF3C7',
    },
  ];

  // Bar Chart data based on selected mode
  const barSeries = useMemo(() => {
    if (chartMode === 'units') {
      return months.map((m) => {
        const tasksTotal = m.tasks.length;
        const tasksDone = m.tasks.filter((t) => t.done).length;
        const actDone = Object.values(m.activities).filter(Boolean).length;
        const totalUnits = tasksTotal + 4;
        const doneUnits = tasksDone + actDone;
        const pct =
          totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;
        return {
          key: `unit-${m.id}`,
          shortLabel: `و ${m.id}`,
          title: `الوحدة ${m.id}: ${m.theme}`,
          pct,
          subLabel: `${tasksDone}/${tasksTotal} مهام · ${actDone}/4 ركائز`,
          status: m.status,
          monthId: m.id,
        };
      });
    }

    if (chartMode === 'pillars') {
      const total = Math.max(months.length, 1);
      const reading = months.filter((m) => m.activities.reading).length;
      const listening = months.filter((m) => m.activities.listening).length;
      const summarizing = months.filter((m) => m.activities.summarizing).length;
      const discussing = months.filter((m) => m.activities.discussing).length;
      return [
        {
          key: 'p-read',
          shortLabel: 'القراءة',
          title: 'ركيزة القراءة المنهجية',
          pct: Math.round((reading / total) * 100),
          subLabel: `${reading} من ${months.length} وحدة`,
          status: 'completed' as const,
        },
        {
          key: 'p-listen',
          shortLabel: 'الاستماع',
          title: 'ركيزة الاستماع والمدارسة',
          pct: Math.round((listening / total) * 100),
          subLabel: `${listening} من ${months.length} وحدة`,
          status: 'in_progress' as const,
        },
        {
          key: 'p-sum',
          shortLabel: 'التلخيص',
          title: 'ركيزة التلخيص الكتابي',
          pct: Math.round((summarizing / total) * 100),
          subLabel: `${summarizing} من ${months.length} وحدة`,
          status: 'completed' as const,
        },
        {
          key: 'p-disc',
          shortLabel: 'النقاش',
          title: 'ركيزة النقاش والتطبيق',
          pct: Math.round((discussing / total) * 100),
          subLabel: `${discussing} من ${months.length} وحدة`,
          status: 'in_progress' as const,
        },
      ];
    }

    return quarters.map((q) => {
      const qMonths = months.filter((m) => m.quarter === q.number);
      const qTasksTotal = qMonths.reduce((acc, m) => acc + m.tasks.length, 0);
      const qTasksDone = qMonths.reduce(
        (acc, m) => acc + m.tasks.filter((t) => t.done).length,
        0
      );
      const qActTotal = qMonths.length * 4;
      const qActDone = qMonths.reduce(
        (acc, m) => acc + Object.values(m.activities).filter(Boolean).length,
        0
      );
      const total = qTasksTotal + qActTotal;
      const done = qTasksDone + qActDone;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        key: `q-${q.id}`,
        shortLabel: `م ${q.number}`,
        title: q.title,
        pct,
        subLabel: `${qTasksDone}/${qTasksTotal} مهمة · ${qActDone}/${qActTotal} ركيزة`,
        status: pct === 100 ? ('completed' as const) : ('in_progress' as const),
        monthId: qMonths[0]?.id,
      };
    });
  }, [chartMode, months, quarters]);

  const activeHoveredItem =
    barSeries.find((b) => b.key === hoveredBarKey) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Radial Donut Breakdown Card */}
      <div className="lg:col-span-5 p-5 bg-slate-50/75 border border-slate-200 rounded-xl flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              المؤشر الدائري للإنجاز
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
            {completedSmallTasks + completedActivities} عنصر منجز
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 144 144"
              className="w-40 h-40 -rotate-90"
              role="img"
              aria-label={`معدل الإنجاز الكلي ${overallProgressPct}%`}
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
                      strokeWidth="9"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r={ring.radius}
                      fill="none"
                      stroke={ring.color}
                      strokeWidth="9"
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
                {overallProgressPct}%
              </span>
              <span className="text-[10px] font-medium text-slate-500 mt-1">
                الإنجاز العام
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2.5">
            {rings.map((ring) => (
              <div
                key={ring.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200/80"
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
                  <span className="text-slate-500 text-[11px]">
                    {ring.detail}
                  </span>
                  <span className="font-bold text-slate-900 w-9 text-left">
                    {ring.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Column Bar Chart Card */}
      <div className="lg:col-span-7 p-5 bg-slate-50/75 border border-slate-200 rounded-xl flex flex-col justify-between gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              الرسم البياني لمعدل إنجاز المهام
            </h3>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
            {(
              [
                { id: 'units', label: 'بالوحدات' },
                { id: 'pillars', label: 'بالركائز' },
                { id: 'quarters', label: 'بالمراحل' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setChartMode(tab.id);
                  setHoveredBarKey(null);
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  chartMode === tab.id
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Area with horizontal percentage gridlines */}
        <div className="relative bg-white border border-slate-200 rounded-lg px-3 pt-4 pb-2">
          {/* Y-axis reference grid */}
          <div className="relative h-44 flex items-end gap-1.5 sm:gap-2.5">
            {[100, 75, 50, 25].map((tick) => (
              <div
                key={tick}
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200 flex items-center"
                style={{ bottom: `${tick}%` }}
              >
                <span className="text-[9px] text-slate-400 bg-white px-1 -mt-2 tabular-nums">
                  {tick}%
                </span>
              </div>
            ))}

            {barSeries.map((bar) => {
              const isHovered = hoveredBarKey === bar.key;
              const barColor =
                bar.pct >= 100 || bar.status === 'completed'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : bar.pct > 0
                  ? 'bg-[#1E3A5F] hover:bg-[#162C49]'
                  : 'bg-slate-300 hover:bg-slate-400';

              return (
                <button
                  key={bar.key}
                  type="button"
                  onMouseEnter={() => setHoveredBarKey(bar.key)}
                  onMouseLeave={() => setHoveredBarKey(null)}
                  onFocus={() => setHoveredBarKey(bar.key)}
                  onClick={() => {
                    if ('monthId' in bar && bar.monthId) {
                      onJumpToMonth(bar.monthId);
                    }
                  }}
                  title={`${bar.title} — ${bar.pct}% (${bar.subLabel})`}
                  className="relative z-10 flex-1 h-full flex flex-col justify-end items-center group cursor-pointer focus:outline-none min-w-0"
                >
                  <span
                    className={`text-[10px] font-bold tabular-nums mb-1 transition-opacity ${
                      isHovered
                        ? 'text-[#1E3A5F] opacity-100'
                        : 'text-slate-500 opacity-80'
                    }`}
                  >
                    {bar.pct}%
                  </span>
                  <div className="w-full max-w-[34px] h-[calc(100%-22px)] bg-slate-100/80 rounded-t-md flex items-end overflow-hidden border border-slate-200/70">
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${barColor}`}
                      style={{ height: `${Math.max(bar.pct, 4)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* X-axis Labels */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 pt-2 mt-1 border-t border-slate-100">
            {barSeries.map((bar) => (
              <span
                key={`${bar.key}-lbl`}
                className="flex-1 text-center text-[10px] font-medium text-slate-600 truncate tabular-nums"
              >
                {bar.shortLabel}
              </span>
            ))}
          </div>
        </div>

        {/* Live Readout Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 min-h-[20px]">
          {activeHoveredItem ? (
            <div className="flex items-center gap-2 text-slate-900 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{activeHoveredItem.title}</span>
              <span className="text-slate-400">·</span>
              <span className="text-[#1E3A5F] tabular-nums">
                {activeHoveredItem.pct}% ({activeHoveredItem.subLabel})
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-500">
              مرّر على أي عمود لعرض تفاصيل المهام أو اضغط للانتقال مباشرة إلى الوحدة.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
