import { useRef, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  CheckSquare,
  Circle,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FileUp,
  PenLine,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { PersonalCourse, StudyResource } from '../data/curriculumData';
import {
  downloadLocalAttachment,
  parseDocumentFile,
  saveLocalAttachment,
} from '../utils/documentImportExport';

interface CoursesViewProps {
  canEdit: boolean;
  courses: PersonalCourse[];
  onAddCourse: (course: {
    title: string;
    category: string;
    complementaryBook: string;
    bookAuthor: string;
    applicationMilestone: string;
    linkedMonths: number[];
  }) => void;
  onUpdateCourse: (id: number, updates: Partial<PersonalCourse>) => void;
  onDeleteCourse: (id: number) => void;
  onToggleCourseTask: (courseId: number, taskId: string) => void;
  onAddCourseTask: (courseId: number, text: string) => void;
  onDeleteCourseTask: (courseId: number, taskId: string) => void;
  onAddCourseResource: (
    courseId: number,
    title: string,
    type: StudyResource['type'],
    note: string,
    extras?: {
      id?: string;
      externalUrl?: string;
      attachmentName?: string;
      extractedPreview?: string;
    }
  ) => void;
  onDeleteCourseResource: (courseId: number, resourceId: string) => void;
  onJumpToMonth: (monthId: number) => void;
  onOpenCourseNote: (
    course: PersonalCourse,
    lectureTitle?: string,
    initialContent?: string
  ) => void;
}

export default function CoursesView({
  canEdit,
  courses,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onToggleCourseTask,
  onAddCourseTask,
  onDeleteCourseTask,
  onAddCourseResource,
  onDeleteCourseResource,
  onJumpToMonth,
  onOpenCourseNote,
}: CoursesViewProps) {
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState('');
  const [newCourseBook, setNewCourseBook] = useState('');
  const [newCourseAuthor, setNewCourseAuthor] = useState('');
  const [newCourseMilestone, setNewCourseMilestone] = useState('');
  const [newCourseMonths, setNewCourseMonths] = useState('1, 2');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [addingResourceCourseId, setAddingResourceCourseId] = useState<
    number | null
  >(null);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<number, string>>(
    {}
  );
  const [newResTitle, setNewResTitle] = useState('');
  const [newResType, setNewResType] =
    useState<StudyResource['type']>('كتاب');
  const [newResNote, setNewResNote] = useState('');
  const [newResUrl, setNewResUrl] = useState('');
  const [newResAttachmentName, setNewResAttachmentName] = useState('');
  const [newResPreview, setNewResPreview] = useState('');
  const [pendingResId, setPendingResId] = useState('');
  const [expandedResId, setExpandedResId] = useState<string | null>(null);
  const courseResFileRef = useRef<HTMLInputElement | null>(null);

  const completedCount = courses.filter((c) => c.completed).length;

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newCourseTitle.trim();
    if (!title) return;
    const parsedMonths = newCourseMonths
      .split(/[,،\s]+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 100);

    onAddCourse({
      title,
      category: newCourseCategory.trim() || 'تطوير شخصي',
      complementaryBook: newCourseBook.trim() || 'مرجع مكمل مقترح',
      bookAuthor: newCourseAuthor.trim() || 'مرجع عام',
      applicationMilestone:
        newCourseMilestone.trim() || 'تطبيق عملي من مخرجات الكورس.',
      linkedMonths: parsedMonths.length > 0 ? parsedMonths : [1],
    });
    setNewCourseTitle('');
    setNewCourseCategory('');
    setNewCourseBook('');
    setNewCourseAuthor('');
    setNewCourseMilestone('');
    setShowAddCourse(false);
  };

  const handleTaskSubmit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    const text = (newTaskInputs[courseId] ?? '').trim();
    if (!text) return;
    onAddCourseTask(courseId, text);
    setNewTaskInputs((prev) => ({ ...prev, [courseId]: '' }));
  };

  const handlePickCourseResourceFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    courseId: number
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const generatedId = `c${courseId}-res-${Date.now()}`;
    setPendingResId(generatedId);
    await saveLocalAttachment(generatedId, file);
    const parsed = await parseDocumentFile(file);
    if (!newResTitle.trim()) {
      setNewResTitle(parsed.title);
    }
    setNewResType('ملف / مستند');
    setNewResAttachmentName(file.name);
    setNewResPreview(parsed.plainText.slice(0, 7500));
    if (!newResNote.trim()) {
      setNewResNote(`ملف مرفق (${file.name})`);
    }
  };

  const handleResourceSubmit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    const title = newResTitle.trim();
    if (!title) return;
    onAddCourseResource(
      courseId,
      title,
      newResType,
      newResNote.trim() || 'مصدر مضاف يدويًا لاستكمال الكورس.',
      {
        id: pendingResId || undefined,
        externalUrl: newResUrl.trim() || undefined,
        attachmentName: newResAttachmentName || undefined,
        extractedPreview: newResPreview || undefined,
      }
    );
    setNewResTitle('');
    setNewResNote('');
    setNewResUrl('');
    setNewResAttachmentName('');
    setNewResPreview('');
    setPendingResId('');
    setAddingResourceCourseId(null);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            التطوير الشخصي والمهاري · {courses.length} كورسات مفعّلة حاليًا
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            الكورسات الـ {courses.length} ومصادرها وملاحظات المحاضرات
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            يمكنك إضافة أي عدد من الكورسات الجديدة وتخصيص مصادرها ومهامها الصغيرة، كما يُنشأ لكل كورس دفتر تلخيص مستقل داخل مكتبة دفاتر التلخيص.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-slate-600 tabular-nums">
            المنجز: {completedCount} / {courses.length}
          </span>
          <button
            type="button"
            disabled={!canEdit}
            title={
              !canEdit
                ? 'سجّل الدخول بحساب Google لإضافة كورس جديد'
                : `إضافة الكورس ${courses.length + 1}`
            }
            onClick={() => setShowAddCourse((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>
              {showAddCourse ? 'إلغاء' : `إضافة الكورس ${courses.length + 1}`}
            </span>
          </button>
        </div>
      </div>

      {showAddCourse && canEdit && (
        <form
          onSubmit={handleCreateCourse}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900">
            إضافة كورس تطوير شخصي جديد
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-slate-600">
              اسم الكورس
              <input
                type="text"
                required
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="مثلاً: الكورس 7: إدارة المشاريع الشخصية"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              المجال المهاري
              <input
                type="text"
                value={newCourseCategory}
                onChange={(e) => setNewCourseCategory(e.target.value)}
                placeholder="مثلاً: الإنتاجية / القيادة / الكتابة"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              المرجع الكتابي المكمل
              <input
                type="text"
                value={newCourseBook}
                onChange={(e) => setNewCourseBook(e.target.value)}
                placeholder="اسم الكتاب أو المرجع..."
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              الأشهر المرتبطة (أرقام مفصولة بفاصلة)
              <input
                type="text"
                value={newCourseMonths}
                onChange={(e) => setNewCourseMonths(e.target.value)}
                placeholder="مثلاً: 4, 5"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            هدف التطبيق العملي
            <textarea
              rows={2}
              value={newCourseMilestone}
              onChange={(e) => setNewCourseMilestone(e.target.value)}
              placeholder="ما الخطوة العملية التي تريد تحقيقها من هذا الكورس؟"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
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
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
            >
              حفظ الكورس
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses.map((course) => {
          const isEditing = editingId === course.id;
          const isConfirmingDelete = confirmDeleteId === course.id;
          const isAddingRes = addingResourceCourseId === course.id;
          const tasksDone = course.tasks.filter((t) => t.done).length;

          return (
            <section
              key={course.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-5">
                {/* Course Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="tabular-nums">
                        كورس {String(course.id).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{course.category}</span>
                    </div>
                    {!isEditing && (
                      <h2 className="text-lg font-semibold text-slate-900 leading-snug">
                        {course.title}
                      </h2>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(isEditing ? null : course.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isEditing ? 'حفظ' : 'تخصيص'}</span>
                      </button>

                      {!isConfirmingDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(course.id)}
                          aria-label={`حذف ${course.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCourse(course.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 cursor-pointer"
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-[11px] text-slate-600 bg-slate-100 rounded-md cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs text-slate-600">
                      اسم الكورس الفعلي المشترك فيه
                      <input
                        type="text"
                        value={course.title}
                        onChange={(e) =>
                          onUpdateCourse(course.id, { title: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </label>

                    <label className="block text-xs text-slate-600">
                      المجال المهاري
                      <input
                        type="text"
                        value={course.category}
                        onChange={(e) =>
                          onUpdateCourse(course.id, {
                            category: e.target.value,
                          })
                        }
                        className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </label>

                    <label className="block text-xs text-slate-600">
                      المرجع الأساسي المكمل
                      <input
                        type="text"
                        value={course.complementaryBook}
                        onChange={(e) =>
                          onUpdateCourse(course.id, {
                            complementaryBook: e.target.value,
                          })
                        }
                        className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </label>

                    <label className="block text-xs text-slate-600">
                      الأشهر المرتبطة (مفصولة بفاصلة)
                      <input
                        type="text"
                        value={course.linkedMonths.join(', ')}
                        onChange={(e) => {
                          const nums = e.target.value
                            .split(/[,،\s]+/)
                            .map((n) => parseInt(n, 10))
                            .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 100);
                          onUpdateCourse(course.id, { linkedMonths: nums });
                        }}
                        className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </label>

                    <label className="block text-xs text-slate-600">
                      هدف التطبيق العملي
                      <textarea
                        rows={2}
                        value={course.applicationMilestone}
                        onChange={(e) =>
                          onUpdateCourse(course.id, {
                            applicationMilestone: e.target.value,
                          })
                        }
                        className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Complementary Resources List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <BookMarked
                            className="w-3.5 h-3.5 text-[#1E3A5F]"
                            aria-hidden="true"
                          />
                          <span>المصادر المكملة للكورس</span>
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setAddingResourceCourseId(
                                isAddingRes ? null : course.id
                              )
                            }
                            className="text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
                          >
                            {isAddingRes ? 'إلغاء' : '+ إضافة مصدر'}
                          </button>
                        )}
                      </div>

                      {isAddingRes && canEdit && (
                        <form
                          onSubmit={(e) => handleResourceSubmit(e, course.id)}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={newResTitle}
                              onChange={(e) => setNewResTitle(e.target.value)}
                              placeholder="اسم الكتاب أو المحاضرة أو الملف..."
                              className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                            />
                            <select
                              value={newResType}
                              onChange={(e) =>
                                setNewResType(
                                  e.target.value as StudyResource['type']
                                )
                              }
                              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                            >
                              <option value="كتاب">كتاب</option>
                              <option value="سلسلة محاضرات">سلسلة محاضرات</option>
                              <option value="مقال / مدخل">مقال / مدخل</option>
                              <option value="أداة تطبيق">أداة تطبيق</option>
                              <option value="ملف / مستند">ملف / مستند (Word / PDF)</option>
                              <option value="رابط خارجي">رابط خارجي</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="url"
                              value={newResUrl}
                              onChange={(e) => setNewResUrl(e.target.value)}
                              placeholder="رابط خارجي اختياري (https://...)"
                              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                            />
                            <div className="flex items-center">
                              <input
                                ref={courseResFileRef}
                                type="file"
                                accept=".docx,.doc,.txt,.md,.markdown,.pdf"
                                className="hidden"
                                onChange={(e) =>
                                  void handlePickCourseResourceFile(e, course.id)
                                }
                              />
                              <button
                                type="button"
                                onClick={() => courseResFileRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {newResAttachmentName
                                    ? `تم إرفاق: ${newResAttachmentName}`
                                    : 'رفع محاضرة / ملف Word / PDF'}
                                </span>
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={newResNote}
                            onChange={(e) => setNewResNote(e.target.value)}
                            placeholder="لماذا أضفت هذا المصدر؟ (اختياري)"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#162C49] cursor-pointer"
                          >
                            حفظ المصدر
                          </button>
                        </form>
                      )}

                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/50">
                        {course.resources.length === 0 ? (
                          <p className="px-3.5 py-3 text-xs text-slate-500">
                            لا توجد مصادر مضافة بعد — اضغط «+ إضافة مصدر» لإضافة مرجع أو ملف محاضرة.
                          </p>
                        ) : (
                          course.resources.map((res) => {
                            const isPreviewOpen = expandedResId === res.id;
                            return (
                              <div key={res.id}>
                                <div className="px-3.5 py-2.5 flex items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                      <span className="font-medium text-slate-900">
                                        {res.title}
                                      </span>
                                      <span
                                        aria-hidden="true"
                                        className="text-slate-300"
                                      >
                                        ·
                                      </span>
                                      <span className="text-slate-500">
                                        {res.type}
                                      </span>
                                      {res.attachmentName && (
                                        <span className="text-[11px] text-emerald-700 font-medium">
                                          ({res.attachmentName})
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                      {res.note}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    {res.extractedPreview && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedResId(
                                              isPreviewOpen ? null : res.id
                                            )
                                          }
                                          title="معاينة نص الملف"
                                          className="p-1 text-slate-600 hover:text-[#1E3A5F] cursor-pointer"
                                        >
                                          <FileText
                                            className="w-3.5 h-3.5"
                                            aria-hidden="true"
                                          />
                                        </button>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onOpenCourseNote(
                                                course,
                                                res.title,
                                                res.extractedPreview
                                              )
                                            }
                                            title="فتح كمحاضرة في دفتر التلخيص"
                                            className="p-1 text-[#1E3A5F] hover:text-[#162C49] cursor-pointer"
                                          >
                                            <PenLine
                                              className="w-3.5 h-3.5"
                                              aria-hidden="true"
                                            />
                                          </button>
                                        )}
                                      </>
                                    )}

                                    {res.attachmentName && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void downloadLocalAttachment(
                                            res.id,
                                            res.attachmentName || res.title
                                          )
                                        }
                                        title="تحميل الملف المرفق"
                                        className="p-1 text-slate-600 hover:text-[#1E3A5F] cursor-pointer"
                                      >
                                        <Download
                                          className="w-3.5 h-3.5"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    )}

                                    <a
                                      href={
                                        res.externalUrl ||
                                        `https://www.google.com/search?q=${encodeURIComponent(
                                          res.searchQuery
                                        )}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={
                                        res.externalUrl
                                          ? `فتح ${res.title}`
                                          : `بحث عن ${res.title}`
                                      }
                                      className="p-1 text-[#1E3A5F] hover:text-[#162C49]"
                                    >
                                      <ExternalLink
                                        className="w-3.5 h-3.5"
                                        aria-hidden="true"
                                      />
                                    </a>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDeleteCourseResource(course.id, res.id)
                                        }
                                        aria-label="حذف المصدر"
                                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                      >
                                        <Trash2
                                          className="w-3.5 h-3.5"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {isPreviewOpen && res.extractedPreview && (
                                  <div className="px-3.5 pb-3">
                                    <div className="p-2.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                                      {res.extractedPreview}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Small Tasks for this Course */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          مهام التطبيق الصغيرة
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {tasksDone} / {course.tasks.length}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                        {course.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start justify-between gap-2 px-3 py-2 bg-white"
                          >
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                onToggleCourseTask(course.id, task.id)
                              }
                              aria-pressed={task.done}
                              className="flex items-start gap-2.5 text-right flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75"
                            >
                              {task.done ? (
                                <CheckSquare
                                  className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Square
                                  className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span
                                className={`text-xs leading-relaxed ${
                                  task.done
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-700'
                                }`}
                              >
                                {task.text}
                              </span>
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteCourseTask(course.id, task.id)
                                }
                                aria-label="حذف المهمة"
                                className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {canEdit && (
                        <form
                          onSubmit={(e) => handleTaskSubmit(e, course.id)}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={newTaskInputs[course.id] ?? ''}
                            onChange={(e) =>
                              setNewTaskInputs((prev) => ({
                                ...prev,
                                [course.id]: e.target.value,
                              }))
                            }
                            placeholder="أضف مهمة تطبيقية صغيرة للكورس..."
                            aria-label={`إضافة مهمة للكورس ${course.id}`}
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>إضافة</span>
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>الوحدات:</span>
                  {course.linkedMonths.map((monthNum, i) => (
                    <span key={monthNum} className="inline-flex items-center gap-2">
                      {i > 0 && <span aria-hidden="true">·</span>}
                      <button
                        type="button"
                        onClick={() => onJumpToMonth(monthNum)}
                        className="font-semibold text-[#1E3A5F] hover:underline tabular-nums cursor-pointer"
                      >
                        الوحدة {monthNum}
                      </button>
                    </span>
                  ))}
                  {canEdit && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => onOpenCourseNote(course)}
                        className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                      >
                        + فتح دفتر تلخيص الكورس
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    onUpdateCourse(course.id, { completed: !course.completed })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                    course.completed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {course.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  )}
                  <span>{course.completed ? 'مكتمل التطبيق' : 'تحديد كمكتمل'}</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
