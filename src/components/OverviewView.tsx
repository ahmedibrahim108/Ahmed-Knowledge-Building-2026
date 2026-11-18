import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FolderPlus,
  GraduationCap,
  Headphones,
  History,
  Layers,
  LogIn,
  MessageSquare,
  NotebookPen,
  PenLine,
  Plus,
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
  StudyHistoryEntry,
  WEEKLY_RHYTHM,
} from '../data/curriculumData';
import { ActiveTab } from './Header';

interface OverviewViewProps {
  user: User | null;
  months: MonthPlan[];
  domains: DomainInfo[];
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  customCategories: CustomCategory[];
  history: StudyHistoryEntry[];
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
}

const CAT_ACCENTS: Record<CustomCategory['color'], string> = {
  navy: 'border-r-4 border-r-[#1E3A5F]',
  emerald: 'border-r-4 border-r-emerald-600',
  amber: 'border-r-4 border-r-amber-600',
  slate: 'border-r-4 border-r-slate-500',
};

export default function OverviewView({
  user,
  months,
  domains,
  courses,
  bookNotes,
  customCategories,
  history,
  onGoogleSignIn,
  onNavigateTab,
  onJumpToMonth,
  onFilterByDomain,
  onOpenNoteById,
  onAddCustomCategory,
  onDeleteCustomCategory,
  onDeleteHistoryEntry,
}: OverviewViewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState<CustomCategory['color']>('navy');

  const completedMonths = months.filter((m) => m.status === 'completed').length;
  const activeMonth =
    months.find((m) => m.status === 'in_progress') ?? months[0];

  const totalActivities = months.length * 4;
  const completedActivities = months.reduce(
    (acc, m) => acc + Object.values(m.activities).filter(Boolean).length,
    0
  );
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

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
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
                  {months.length} وحدة دراسية · {domains.length} محاور ·{' '}
                  {courses.length} كورسات
                </span>
              </div>

              <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-slate-900 leading-snug">
                لوحة المعرفة الشخصية: بناء عقلٍ متوازن يفهم الأفكار والإنسان والواقع
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                مساحة دراسة مرنة بدون سباقٍ قسري؛ تجمع بين التأسيس الفكري والاستكشاف المنفتح، وتُنظّم ملاحظات كتبك ومحاضرات كورساتك وسجلّك الدراسي في مكان واحد.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('plan')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors cursor-pointer"
              >
                <span>استعراض خطة الدراسة</span>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('journal')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <NotebookPen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>تدوين ملاحظة منظّمة</span>
              </button>

              {!user && (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1E3A5F] border border-[#1E3A5F]/25 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
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
          <p className="mt-1 text-xs text-slate-500">
            {activeMonth
              ? `التركيز الحالي: الوحدة ${activeMonth.id}`
              : 'أضف وحدتك الأولى من الخطة'}
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
          <p className="mt-1 text-xs text-slate-500">
            ركائز الدراسة المكتملة: {completedActivities} / {totalActivities}
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
            <span>الملاحظات المنظّمة</span>
            <PenLine className="w-4 h-4 text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {bookNotes.length}{' '}
            <span className="text-sm font-normal text-slate-500">ملاحظة</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {bookTypeNotesCount} كتاب · {lectureNotesCount} محاضرة · {generalNotesCount} عام
          </p>
        </div>
      </section>

      {/* Personalized Dashboard: Categories + Recent Study History */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Personalized Categories & Domain Distribution */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-6">
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
              onClick={() => setShowAddCategory((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showAddCategory ? 'إلغاء' : '+ تصنيف جديد'}</span>
            </button>
          </div>

          {showAddCategory && (
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
                  className={`p-4 bg-slate-50/70 border border-slate-200 rounded-lg flex flex-col justify-between gap-2 ${
                    CAT_ACCENTS[cat.color]
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {cat.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteCustomCategory(cat.id)}
                      aria-label={`حذف ${cat.title}`}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {cat.description}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span className="tabular-nums">
                      {linkedNotesCount} {linkedNotesCount === 1 ? 'ملاحظة مرتبطة' : 'ملاحظات مرتبطة'}
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

        {/* User Study History Timeline */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                سجل نشاطك الدراسي (History)
              </h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              آخر {Math.min(history.length, 10)} أنشطة
            </span>
          </div>

          {history.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
              <p className="text-xs font-medium text-slate-700">
                لم يُسجّل نشاط دراسي بعد
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                سيظهر هنا تلقائيًا كل كتاب تلخّصه، أو محاضرة تضيفها، أو مهمة تنجزها، أو تسجيل صوتي تحفظه.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-[430px] overflow-y-auto">
              {history.slice(0, 12).map((entry) => {
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
                    <button
                      type="button"
                      onClick={() => onDeleteHistoryEntry(entry.id)}
                      aria-label="حذف السجل"
                      className="p-1 text-slate-300 hover:text-red-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    </button>
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
