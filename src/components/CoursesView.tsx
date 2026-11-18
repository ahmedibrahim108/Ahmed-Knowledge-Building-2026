import { useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  CheckSquare,
  Circle,
  Edit3,
  ExternalLink,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { PersonalCourse, StudyResource } from '../data/curriculumData';

interface CoursesViewProps {
  courses: PersonalCourse[];
  onUpdateCourse: (id: number, updates: Partial<PersonalCourse>) => void;
  onToggleCourseTask: (courseId: number, taskId: string) => void;
  onAddCourseTask: (courseId: number, text: string) => void;
  onDeleteCourseTask: (courseId: number, taskId: string) => void;
  onAddCourseResource: (
    courseId: number,
    title: string,
    type: StudyResource['type'],
    note: string
  ) => void;
  onDeleteCourseResource: (courseId: number, resourceId: string) => void;
  onJumpToMonth: (monthId: number) => void;
}

export default function CoursesView({
  courses,
  onUpdateCourse,
  onToggleCourseTask,
  onAddCourseTask,
  onDeleteCourseTask,
  onAddCourseResource,
  onDeleteCourseResource,
  onJumpToMonth,
}: CoursesViewProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const completedCount = courses.filter((c) => c.completed).length;

  const handleTaskSubmit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    const text = (newTaskInputs[courseId] ?? '').trim();
    if (!text) return;
    onAddCourseTask(courseId, text);
    setNewTaskInputs((prev) => ({ ...prev, [courseId]: '' }));
  };

  const handleResourceSubmit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    const title = newResTitle.trim();
    if (!title) return;
    onAddCourseResource(
      courseId,
      title,
      newResType,
      newResNote.trim() || 'مصدر مضاف يدويًا لاستكمال الكورس.'
    );
    setNewResTitle('');
    setNewResNote('');
    setAddingResourceCourseId(null);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            التطوير الشخصي · مصادر مكملة ومهام تطبيقية صغيرة
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            الكورسات الستة ومصادرها وخطوات التنفيذ
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            أضفنا لكل كورس مجموعة مصادر مكملة (كتب ومحاضرات وأدوات عملية) مع مهام صغيرة قابلة للمتابعة، ويمكنك تعديل أسماء الكورسات أو إضافة مصادرك ومهامك الخاصة.
          </p>
        </div>

        <div className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
          المنجز: {completedCount} / 6 كورسات
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses.map((course) => {
          const isEditing = editingId === course.id;
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
                      <span className="tabular-nums">كورس 0{course.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{course.category}</span>
                    </div>
                    {!isEditing && (
                      <h2 className="text-lg font-semibold text-slate-900 leading-snug">
                        {course.title}
                      </h2>
                    )}
                  </div>

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
                      </div>

                      {isAddingRes && (
                        <form
                          onSubmit={(e) => handleResourceSubmit(e, course.id)}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={newResTitle}
                              onChange={(e) => setNewResTitle(e.target.value)}
                              placeholder="اسم الكتاب أو المحاضرة..."
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
                            </select>
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
                        {course.resources.map((res) => (
                          <div
                            key={res.id}
                            className="px-3.5 py-2.5 flex items-start justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-medium text-slate-900">
                                  {res.title}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="text-slate-500">{res.type}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                {res.note}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(
                                  res.searchQuery
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`بحث عن ${res.title}`}
                                className="p-1 text-[#1E3A5F] hover:text-[#162C49]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                              </a>
                              {res.custom && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onDeleteCourseResource(course.id, res.id)
                                  }
                                  aria-label="حذف المصدر"
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
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
                              onClick={() =>
                                onToggleCourseTask(course.id, task.id)
                              }
                              aria-pressed={task.done}
                              className="flex items-start gap-2.5 text-right flex-1 cursor-pointer"
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

                            {task.custom && (
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
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>الأشهر المرتبطة:</span>
                  {course.linkedMonths.map((monthNum, i) => (
                    <span key={monthNum} className="inline-flex items-center gap-2">
                      {i > 0 && <span aria-hidden="true">·</span>}
                      <button
                        type="button"
                        onClick={() => onJumpToMonth(monthNum)}
                        className="font-semibold text-[#1E3A5F] hover:underline tabular-nums cursor-pointer"
                      >
                        الشهر {monthNum}
                      </button>
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateCourse(course.id, { completed: !course.completed })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
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
