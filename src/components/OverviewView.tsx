import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Headphones,
  Layers,
  MessageSquare,
  PenLine,
} from 'lucide-react';
import {
  HERO_IMAGE_PATH,
  MonthPlan,
  PersonalCourse,
  WEEKLY_RHYTHM,
} from '../data/curriculumData';
import { ActiveTab } from './Header';

interface OverviewViewProps {
  months: MonthPlan[];
  courses: PersonalCourse[];
  onNavigateTab: (tab: ActiveTab) => void;
  onJumpToMonth: (monthId: number) => void;
  onExportExcel: () => void;
}

export default function OverviewView({
  months,
  courses,
  onNavigateTab,
  onJumpToMonth,
  onExportExcel,
}: OverviewViewProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const completedMonths = months.filter((m) => m.status === 'completed').length;
  const activeMonth =
    months.find((m) => m.status === 'in_progress') ?? months[0];

  const totalActivities = months.length * 4;
  const completedActivities = months.reduce(
    (acc, m) => acc + Object.values(m.activities).filter(Boolean).length,
    0
  );
  const completedCourses = courses.filter((c) => c.completed).length;
  const notesWritten = months.filter((m) => m.notes.trim().length > 0).length;

  return (
    <div className="space-y-10">
      {/* Hero Editorial Split (2-column items-stretch) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>المستوى المتوازن</span>
                <span aria-hidden="true">·</span>
                <span>مساران متوازيان</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">12 شهرًا</span>
              </div>

              <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-slate-900 leading-snug">
                بناء عقلٍ متنوّع المعرفة يفهم الأفكار والإنسان والواقع ويناقشها
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                ليست هذه الخطة سباقًا لإنهاء أكبر عدد من الكتب، بل رحلة هادئة لمدة عام كامل تجمع بين التعمّق في الفكر الإسلامي وبناء المنهج، والانفتاح المنضبط على الفلسفة وعلم النفس والتاريخ والأدب وفهم المجتمع وتطوير الذات.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('plan')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors cursor-pointer"
              >
                <span>استعراض خطة 12 شهرًا</span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onExportExcel}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>تحميل ملف Excel المحدّث (.xlsx)</span>
              </button>
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

      {/* Full-width 4-Column KPI Strip below Hero Split */}
      <section aria-label="ملخص التقدم" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>الأشهر المنجزة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedMonths} <span className="text-sm font-normal text-slate-500">/ 12 شهرًا</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            الشهر الحالي: الشهر {activeMonth.id}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>أنشطة القراءة والتطبيق</span>
            <Clock className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedActivities} <span className="text-sm font-normal text-slate-500">/ {totalActivities} ركيزة</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            4 ركائز لكل شهر (قراءة، سماع، تلخيص، نقاش)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>الكورسات الستة المربوطة</span>
            <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {completedCourses} <span className="text-sm font-normal text-slate-500">/ 6 كورسات</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            مربوطة بمراجع مكملة وتطبيق عملي
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>دفاتر التلخيص المكتوبة</span>
            <PenLine className="w-4 h-4 text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {notesWritten} <span className="text-sm font-normal text-slate-500">/ 12 دفترًا</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            تُحفظ تلقائيًا وتُصدَّر في ملف Excel
          </p>
        </div>
      </section>

      {/* Parallel Tracks + Active Month Focus */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Two Parallel Tracks */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              منهجية المسارين المتوازيين
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              كل شهر في الخطة يجمع بين مسارين يكمل أحدهما الآخر دون تشتيت أو انغلاق.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            <div className="pb-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1E3A5F]">
                <span>01. المسار التأسيسي</span>
                <span aria-hidden="true">·</span>
                <span className="font-normal text-slate-500">بناء العمود الفقري للمعرفة</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                كتب وسلاسل محاضرات مرتّبة تتدرّج بك في أصول الفكر الإسلامي وبناء المنهج ومفاتيح التحليل الفكري (أحمد بن يوسف السيد، إبراهيم السكران، عبدالله العجيري، سلطان العميري) مع أصول العمران والفهم الحضاري.
              </p>
            </div>

            <div className="pt-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <span>02. المسار الاستكشافي</span>
                <span aria-hidden="true">·</span>
                <span className="font-normal text-slate-500">توسيع الأفق ومنع الانحصار</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                قراءات موازية في التفكير الفلسفي (فؤاد زكريا، زكي نجيب محمود، عبد الوهاب المسيري)، وعلم النفس (فيكتور فرانكل، إريك فروم، دانيال كانيمان)، والجغرافيا والتاريخ (جمال حمدان، مالك بن نبي، ابن خلدون)، والأدب والسير (مصطفى صادق الرافعي، غازي القصيبي، وتجارب إنسانية).
              </p>
            </div>
          </div>
        </div>

        {/* Current Month Spotlight */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              محطة التركيز الحالية · الشهر {activeMonth.id}
            </span>
            <button
              type="button"
              onClick={() => onJumpToMonth(activeMonth.id)}
              className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              فتح تفاصيل الشهر
            </button>
          </div>

          <h2 className="font-editorial text-xl font-bold text-slate-900">
            {activeMonth.theme}
          </h2>

          <div className="space-y-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
              <p className="text-xs text-slate-500">
                المسار التأسيسي · {activeMonth.foundational.author}
              </p>
              <p className="font-semibold text-slate-900">
                {activeMonth.foundational.title}
              </p>
              <p className="text-xs text-slate-600">{activeMonth.foundational.pace}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
              <p className="text-xs text-slate-500">
                المسار الاستكشافي · {activeMonth.exploratory.author}
              </p>
              <p className="font-semibold text-slate-900">
                {activeMonth.exploratory.title}
              </p>
              <p className="text-xs text-slate-600">{activeMonth.exploratory.pace}</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-slate-100">
            سؤال المناقشة: {activeMonth.discussionPrompt}
          </p>
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
              ساعات أسبوعية مرنة ومريحة (~7 ساعات في الأسبوع) تمنع الإرهاق وتحفظ استمرارية العام كله.
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
