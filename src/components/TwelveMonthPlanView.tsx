import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Headphones,
  MessageSquare,
  PenLine,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  DOMAINS,
  DomainId,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  PersonalCourse,
} from '../data/curriculumData';

interface TwelveMonthPlanViewProps {
  months: MonthPlan[];
  courses: PersonalCourse[];
  selectedMonthId: number;
  domainFilter: DomainId | 'all';
  onSelectMonth: (id: number) => void;
  onChangeDomainFilter: (domainId: DomainId | 'all') => void;
  onUpdateMonthStatus: (id: number, status: MonthStatus) => void;
  onToggleActivity: (id: number, key: keyof MonthActivities) => void;
  onUpdateMonthNotes: (id: number, notes: string) => void;
  onUpdateTrackItem: (
    id: number,
    track: 'foundational' | 'exploratory',
    field: 'title' | 'author' | 'pace',
    value: string
  ) => void;
}

const QUARTER_FILTERS: Array<{ id: 0 | 1 | 2 | 3 | 4; label: string }> = [
  { id: 0, label: 'جميع الأشهر (12)' },
  { id: 1, label: 'الربع الأول: التأسيس' },
  { id: 2, label: 'الربع الثاني: النقد والإدراك' },
  { id: 3, label: 'الربع الثالث: العمران والتحيز' },
  { id: 4, label: 'الربع الرابع: التركيب والحصاد' },
];

const STATUS_META: Record<
  MonthStatus,
  { label: string; textColor: string; Icon: typeof CheckCircle2 }
> = {
  not_started: {
    label: 'لم يبدأ',
    textColor: 'text-slate-500',
    Icon: Circle,
  },
  in_progress: {
    label: 'قيد الدراسة',
    textColor: 'text-amber-700',
    Icon: Clock,
  },
  completed: {
    label: 'مكتمل',
    textColor: 'text-emerald-700',
    Icon: CheckCircle2,
  },
};

function getDomainTitle(domainId: DomainId): string {
  return DOMAINS.find((d) => d.id === domainId)?.title ?? '';
}

export default function TwelveMonthPlanView({
  months,
  courses,
  selectedMonthId,
  domainFilter,
  onSelectMonth,
  onChangeDomainFilter,
  onUpdateMonthStatus,
  onToggleActivity,
  onUpdateMonthNotes,
  onUpdateTrackItem,
}: TwelveMonthPlanViewProps) {
  const [quarterFilter, setQuarterFilter] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [statusFilter, setStatusFilter] = useState<MonthStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingTracks, setIsEditingTracks] = useState(false);

  const filteredMonths = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return months.filter((m) => {
      if (quarterFilter !== 0 && m.quarter !== quarterFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (
        domainFilter !== 'all' &&
        m.foundational.domainId !== domainFilter &&
        m.exploratory.domainId !== domainFilter
      ) {
        return false;
      }
      if (q) {
        const haystack = [
          m.theme,
          m.foundational.title,
          m.foundational.author,
          m.exploratory.title,
          m.exploratory.author,
          m.discussionPrompt,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [months, quarterFilter, statusFilter, domainFilter, searchQuery]);

  const activeMonth =
    months.find((m) => m.id === selectedMonthId) ??
    filteredMonths[0] ??
    months[0];

  const linkedCourse = courses.find((c) => c.id === activeMonth.courseId);
  const doneCount = Object.values(activeMonth.activities).filter(Boolean).length;

  const resetFilters = () => {
    setQuarterFilter(0);
    setStatusFilter('all');
    onChangeDomainFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Workspace Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="تصفية حسب الفصول الأربعة"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {QUARTER_FILTERS.map((q) => {
              const active = quarterFilter === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setQuarterFilter(q.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-56">
              <Search
                className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مفكر أو كتاب..."
                aria-label="ابحث في خطة 12 شهرًا"
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <select
              aria-label="تصفية حسب المحور"
              value={domainFilter}
              onChange={(e) =>
                onChangeDomainFilter(e.target.value as DomainId | 'all')
              }
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="all">كل المحاور المعرفية</option>
              {DOMAINS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>

            <select
              aria-label="تصفية حسب الحالة"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as MonthStatus | 'all')
              }
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="all">كل الحالات</option>
              <option value="not_started">لم يبدأ</option>
              <option value="in_progress">قيد الدراسة</option>
              <option value="completed">مكتمل</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Split: 12-Month Index List + Active Month Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Month List (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              الجدول الزمني للرحلة
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {filteredMonths.length} من 12 شهرًا
            </span>
          </div>

          {filteredMonths.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-slate-800">
                لا توجد أشهر مطابقة لخيارات التصفية الحالية
              </p>
              <p className="text-xs text-slate-500">
                جرّب تغيير عبارة البحث أو إعادة ضبط التصفيات لعرض كامل الخطة.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إعادة ضبط التصفية</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredMonths.map((month) => {
                const isSelected = activeMonth.id === month.id;
                const StatusIcon = STATUS_META[month.status].Icon;
                const monthActivitiesDone = Object.values(
                  month.activities
                ).filter(Boolean).length;

                return (
                  <button
                    key={month.id}
                    type="button"
                    onClick={() => {
                      onSelectMonth(month.id);
                      setIsEditingTracks(false);
                    }}
                    className={`w-full text-right px-5 py-4 transition-colors duration-150 cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-slate-100/90'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
                        الشهر {month.id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${STATUS_META[month.status].textColor}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{STATUS_META[month.status].label}</span>
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {month.theme}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{month.foundational.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>{month.exploratory.author}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {monthActivitiesDone}/4 ركائز
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Workspace (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-7">
          {/* Header & Status Selector */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-[#1E3A5F] tabular-nums">
                  الشهر {activeMonth.id}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeMonth.quarterTitle}</span>
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                {activeMonth.theme}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditingTracks((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isEditingTracks ? 'إنهاء التعديل' : 'تعديل المصادر'}</span>
              </button>
            </div>
          </div>

          {/* Status Control Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-600">
              حالة التقدم في هذا الشهر:
            </span>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['not_started', 'in_progress', 'completed'] as MonthStatus[]).map(
                (st) => {
                  const isCurrent = activeMonth.status === st;
                  const MetaIcon = STATUS_META[st].Icon;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onUpdateMonthStatus(activeMonth.id, st)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <MetaIcon
                        className={`w-3.5 h-3.5 ${
                          isCurrent ? STATUS_META[st].textColor : 'text-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{STATUS_META[st].label}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Parallel Tracks Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Foundational */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-[#1E3A5F]">
                  المسار التأسيسي
                </span>
                <span>{activeMonth.foundational.format}</span>
              </div>

              {isEditingTracks ? (
                <div className="space-y-2.5">
                  <label className="block text-xs text-slate-600">
                    الكتاب / السلسلة
                    <input
                      type="text"
                      value={activeMonth.foundational.title}
                      onChange={(e) =>
                        onUpdateTrackItem(
                          activeMonth.id,
                          'foundational',
                          'title',
                          e.target.value
                        )
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    المفكر
                    <input
                      type="text"
                      value={activeMonth.foundational.author}
                      onChange={(e) =>
                        onUpdateTrackItem(
                          activeMonth.id,
                          'foundational',
                          'author',
                          e.target.value
                        )
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    الوتيرة الأسبوعية
                    <input
                      type="text"
                      value={activeMonth.foundational.pace}
                      onChange={(e) =>
                        onUpdateTrackItem(
                          activeMonth.id,
                          'foundational',
                          'pace',
                          e.target.value
                        )
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {activeMonth.foundational.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {activeMonth.foundational.author} ·{' '}
                      {getDomainTitle(activeMonth.foundational.domainId)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeMonth.foundational.focus}
                  </p>
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-200/80">
                    الوتيرة: {activeMonth.foundational.pace}
                  </p>
                </>
              )}
            </div>

            {/* Exploratory */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-800">
                  المسار الاستكشافي
                </span>
                <span>{activeMonth.exploratory.format}</span>
              </div>

              {isEditingTracks ? (
                <div className="space-y-2.5">
                  <label className="block text-xs text-slate-600">
                    الكتاب / السلسلة
                    <input
                      type="text"
                      value={activeMonth.exploratory.title}
                      onChange={(e) =>
                        onUpdateTrackItem(
                          activeMonth.id,
                          'exploratory',
                          'title',
                          e.target.value
                        )
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    المفكر / الأديب
                    <input
                      type="text"
                      value={activeMonth.exploratory.author}
                      onChange={(e) =>
                        onUpdateTrackItem(
                          activeMonth.id,
                          'exploratory',
                          'author',
                          e.target.value
                        )
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    الوتيرة الأسبوعية
                    <input
                      type="text"
                      value={activeMonth.exploratory.pace}
                      onChange={(e) =>
                        onUpdateTrackItem(
                          activeMonth.id,
                          'exploratory',
                          'pace',
                          e.target.value
                        )
                      }
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {activeMonth.exploratory.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {activeMonth.exploratory.author} ·{' '}
                      {getDomainTitle(activeMonth.exploratory.domainId)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeMonth.exploratory.focus}
                  </p>
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-200/80">
                    الوتيرة: {activeMonth.exploratory.pace}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 4 Pillars Checklist (Reading, Listening, Summarizing, Discussing) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                أركان الشهر الأربعة (بدون سباق لإنهاء الكتب)
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {doneCount} / 4 مكتمل
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  { key: 'reading', label: 'القراءة المتأنية', Icon: BookOpen },
                  { key: 'listening', label: 'الاستماع للمحاضرات', Icon: Headphones },
                  { key: 'summarizing', label: 'التلخيص الشخصي', Icon: PenLine },
                  {
                    key: 'discussing',
                    label: 'المناقشة والتطبيق',
                    Icon: MessageSquare,
                  },
                ] as const
              ).map(({ key, label, Icon }) => {
                const checked = activeMonth.activities[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggleActivity(activeMonth.id, key)}
                    aria-pressed={checked}
                    className={`p-3 rounded-lg border text-right transition-colors cursor-pointer flex flex-col gap-2 ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon
                        className={`w-4 h-4 ${
                          checked ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-medium">
                        {checked ? 'تم' : 'معلّق'}
                      </span>
                    </div>
                    <span className="text-xs font-medium leading-snug">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discussion, Application & Linked Course */}
          <div className="divide-y divide-slate-200 border-t border-b border-slate-200 py-2 text-sm">
            <div className="py-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500">
                سؤال المناقشة والفهم المقارن
              </p>
              <p className="text-slate-800 leading-relaxed">
                {activeMonth.discussionPrompt}
              </p>
            </div>
            <div className="py-3 space-y-1">
              <p className="text-xs font-semibold text-slate-500">
                التطبيق العملي المقترح
              </p>
              <p className="text-slate-800 leading-relaxed">
                {activeMonth.applicationTask}
              </p>
            </div>
            {linkedCourse && (
              <div className="py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500">
                  كورس التطوير الشخصي المرتبط ({linkedCourse.category})
                </p>
                <p className="text-slate-900 font-medium">
                  {linkedCourse.title}
                </p>
                <p className="text-xs text-slate-600">
                  {linkedCourse.complementaryBook} · {linkedCourse.bookAuthor}
                </p>
              </div>
            )}
          </div>

          {/* Month Reflection / Summary Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`month-notes-${activeMonth.id}`}
                className="text-sm font-semibold text-slate-900"
              >
                خلاصة الشهر وملاحظاتك الشخصية
              </label>
              <span className="text-xs text-slate-500">
                يُحفظ محليًا ويُصدَّر إلى ملف Excel
              </span>
            </div>
            <textarea
              id={`month-notes-${activeMonth.id}`}
              rows={4}
              value={activeMonth.notes}
              onChange={(e) =>
                onUpdateMonthNotes(activeMonth.id, e.target.value)
              }
              placeholder="اكتب هنا أهم 3 أفكار خرجت بها من قراءات واستماع هذا الشهر، أو إجابتك عن سؤال المناقشة..."
              className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white transition-colors leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
