import { useEffect, useMemo, useState } from 'react';
import {
  Headphones,
  PenLine,
  Plus,
  Repeat,
  Search,
  Trash2,
} from 'lucide-react';
import {
  BookNote,
  LEARNING_HUBS,
  LearningHubId,
  PersonalCourse,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';
import { isPdfAttachment } from '../utils/documentImportExport';
import ConfirmDialog from './ConfirmDialog';

interface CoursesViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  courses: PersonalCourse[];
  bookNotes?: BookNote[];
  onSelectCourse: (id: number) => void;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  hubCategories: Record<LearningHubId, string[]>;
  onAddCourse: (course: {
    title: string;
    hubId: LearningHubId;
    category: string;
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
  onDeleteCourse: (id: number) => void;
  onOpenCourseNote: (
    course: PersonalCourse,
    lectureTitle?: string,
    initialContent?: string
  ) => void;
}

export default function CoursesView({
  canEdit,
  onRequireAuth,
  courses,
  bookNotes = [],
  onSelectCourse,
  activeHubFilter,
  onChangeHubFilter,
  hubCategories,
  onAddCourse,
  onDeleteCourse,
  onOpenCourseNote,
}: CoursesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [onlyDueToday, setOnlyDueToday] = useState(false);

  // Add Course State (Only Title Required)
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseHub, setNewCourseHub] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'marketing' : activeHubFilter
  );
  const [newCourseCategory, setNewCourseCategory] = useState('');
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
  }, [activeHubFilter]);

  const todayKey = getTodayDateKey();

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      const hub = c.hubId ?? 'knowledge';
      if (activeHubFilter !== 'all' && hub !== activeHubFilter) return false;
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
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, activeHubFilter, onlyRepeated, onlyDueToday, searchQuery, todayKey]);

  const completedCount = courses.filter((c) => c.completed).length;

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

  const addHubCats = hubCategories[newCourseHub] ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs text-slate-500">
              منظومة الكورسات الشاملة · الماركتينج، الدنتال والكارير، والثقافة والمعرفة
            </p>
            <h1 className="font-editorial text-3xl font-bold text-slate-900">
              الكورسات والتطبيق ({courses.length})
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              اضغط على أي كورس للانتقال إلى صفحته المستقلة التي تضم معلوماته، المهام المرتبطة، المصادر وملفات الـ PDF، والنوتس الخاصة به.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              المنجز: {completedCount} / {courses.length}
            </span>
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
          </div>
        </div>

        {/* 3 Learning Hubs Filter + Spaced Repetition Quick Filters */}
        <div className="pt-4 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeHubFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                activeHubFilter === 'all'
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
                  onClick={() => onChangeHubFilter(hub.id)}
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

            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الكورسات..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>
        </div>
      </div>

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
            يمكنك إضافة كورس جديد لأي مسار من المسارات الثلاثة بالأعلى.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const hubMeta = getHubMeta(course.hubId);
            const tasksDone = course.tasks.filter((t) => t.done).length;
            const pct =
              course.progressPct ??
              (course.completed
                ? 100
                : course.tasks.length > 0
                ? Math.round((tasksDone / course.tasks.length) * 100)
                : 0);
            const pdfCount = course.resources.filter((r) =>
              isPdfAttachment(r.attachmentName, r.mimeType)
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
                className="bg-white border border-slate-200 hover:border-[#1E3A5F]/50 rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer group"
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteCourse(course);
                        }}
                        aria-label={`حذف ${course.title}`}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F] leading-snug">
                    {course.title}
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
                      {course.applicationMilestone}
                    </p>
                  )}

                  {((course.listenCount ?? 0) >= 2 ||
                    (course.reviewCount ?? 0) > 0 ||
                    pdfCount > 0) && (
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
                      {pdfCount > 0 && (
                        <span className="text-[#1E3A5F] font-medium tabular-nums">
                          {pdfCount} PDF
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>
                        {tasksDone}/{course.tasks.length} مهام ·{' '}
                        {course.resources.length} مصادر · {notesCount} نوتس
                      </span>
                      <span className="font-semibold text-slate-800">{pct}%</span>
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
    </div>
  );
}
