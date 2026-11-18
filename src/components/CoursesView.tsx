import { CheckCircle2, Circle, Edit3 } from 'lucide-react';
import { useState } from 'react';
import { PersonalCourse } from '../data/curriculumData';

interface CoursesViewProps {
  courses: PersonalCourse[];
  onUpdateCourse: (id: number, updates: Partial<PersonalCourse>) => void;
  onJumpToMonth: (monthId: number) => void;
}

export default function CoursesView({
  courses,
  onUpdateCourse,
  onJumpToMonth,
}: CoursesViewProps) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const completedCount = courses.filter((c) => c.completed).length;

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            التطوير الشخصي · ربط الكورسات الستة بمراجع مكملة
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            الكورسات الستة وخطة الربط والتطبيق
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            يمكنك تعديل أسماء الكورسات الستة التي اشتركت فيها ومراجعها المكملة وأهدافها التطبيقية مباشرة، وسيتم تحديث الربط مع الأشهر وملف Excel تلقائيًا.
          </p>
        </div>

        <div className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
          المنجز: {completedCount} / 6 كورسات
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course) => {
          const isEditing = editingId === course.id;

          return (
            <section
              key={course.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-4">
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
                      المرجع المكمل المقترح
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
                  <div className="space-y-3 text-sm">
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                      <p className="text-xs text-slate-500">المرجع المكمل</p>
                      <p className="font-medium text-slate-900">
                        {course.complementaryBook}
                      </p>
                      <p className="text-xs text-slate-600">
                        {course.bookAuthor}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">
                        مخرج التطبيق العملي
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {course.applicationMilestone}
                      </p>
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
