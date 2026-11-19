import { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  CheckSquare,
  ListTodo,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import {
  LEARNING_HUBS,
  LearningHubId,
  MonthPlan,
  PersonalCourse,
  PracticalProject,
  ProjectStatus,
  TaskPriority,
  UnifiedTask,
  UnifiedTaskStatus,
  getHubMeta,
} from '../data/curriculumData';
import ConfirmDialog from './ConfirmDialog';

interface TasksProjectsViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  unifiedTasks: UnifiedTask[];
  projects: PracticalProject[];
  months: MonthPlan[];
  courses: PersonalCourse[];
  hubCategories: Record<LearningHubId, string[]>;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  onAddUnifiedTask: (task: Omit<UnifiedTask, 'id'>) => void;
  onUpdateUnifiedTask: (id: string, updates: Partial<UnifiedTask>) => void;
  onDeleteUnifiedTask: (id: string) => void;
  onAddProject: (project: Omit<PracticalProject, 'id'>) => void;
  onUpdateProject: (id: string, updates: Partial<PracticalProject>) => void;
  onDeleteProject: (id: string) => void;
  onToggleMonthTask: (monthId: number, taskId: string) => void;
  onToggleCourseTask: (courseId: number, taskId: string) => void;
  onJumpToMonth: (monthId: number) => void;
  onOpenCourse: (courseId: number) => void;
}

const PRIORITY_AR: Record<TaskPriority, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};

const TASK_STATUS_AR: Record<UnifiedTaskStatus, string> = {
  todo: 'قيد الانتظار',
  in_progress: 'قيد التنفيذ',
  done: 'مكتملة',
};

const PROJECT_STATUS_AR: Record<ProjectStatus, string> = {
  planned: 'مخطط له',
  in_progress: 'جاري التنفيذ',
  completed: 'منجز',
};

export default function TasksProjectsView({
  canEdit,
  onRequireAuth,
  unifiedTasks,
  projects,
  months,
  courses,
  hubCategories,
  activeHubFilter,
  onChangeHubFilter,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onDeleteUnifiedTask,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onToggleMonthTask,
  onToggleCourseTask,
  onJumpToMonth,
  onOpenCourse,
}: TasksProjectsViewProps) {
  const [subTab, setSubTab] = useState<'tasks' | 'projects'>('tasks');
  const [statusFilter, setStatusFilter] = useState<UnifiedTaskStatus | 'all'>('all');

  // New Task Form (only title required)
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskHub, setTaskHub] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'marketing' : activeHubFilter
  );
  const [taskCat, setTaskCat] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<UnifiedTask | null>(null);

  // New Project Form (only title required)
  const [showAddProject, setShowAddProject] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projHub, setProjHub] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'dental_career' : activeHubFilter
  );
  const [projCat, setProjCat] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projDeliverables, setProjDeliverables] = useState('');
  const [projCourseId, setProjCourseId] = useState<string>('');
  const [confirmDeleteProj, setConfirmDeleteProj] = useState<PracticalProject | null>(null);

  const filteredTasks = useMemo(() => {
    return unifiedTasks.filter((t) => {
      if (activeHubFilter !== 'all' && t.hubId !== activeHubFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [unifiedTasks, activeHubFilter, statusFilter]);

  const filteredProjects = useMemo(() => {
    if (activeHubFilter === 'all') return projects;
    return projects.filter((p) => p.hubId === activeHubFilter);
  }, [projects, activeHubFilter]);

  const aggregatedCourseTasks = useMemo(() => {
    const out: Array<{ course: PersonalCourse; id: string; text: string; done: boolean }> = [];
    for (const c of courses) {
      const cHub = c.hubId ?? 'knowledge';
      if (activeHubFilter !== 'all' && cHub !== activeHubFilter) continue;
      for (const t of c.tasks) {
        out.push({ course: c, id: t.id, text: t.text, done: t.done });
      }
    }
    return out;
  }, [courses, activeHubFilter]);

  const aggregatedPlanTasks = useMemo(() => {
    const out: Array<{ month: MonthPlan; id: string; text: string; done: boolean }> = [];
    for (const m of months) {
      const mHub = m.hubId ?? 'knowledge';
      if (activeHubFilter !== 'all' && mHub !== activeHubFilter) continue;
      for (const t of m.tasks) {
        out.push({ month: m, id: t.id, text: t.text, done: t.done });
      }
    }
    return out;
  }, [months, activeHubFilter]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = taskTitle.trim();
    if (!clean) return;
    onAddUnifiedTask({
      title: clean,
      description: taskDesc.trim(),
      hubId: taskHub,
      categoryLabel: taskCat.trim(),
      priority: taskPriority,
      status: 'todo',
      dueDate: taskDueDate,
    });
    setTaskTitle('');
    setTaskDesc('');
    setTaskCat('');
    setTaskDueDate('');
    setShowAddTask(false);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = projTitle.trim();
    if (!clean) return;
    onAddProject({
      title: clean,
      description: projDesc.trim(),
      hubId: projHub,
      categoryLabel: projCat.trim(),
      objectives: '',
      status: 'planned',
      progressPct: 0,
      deliverables: projDeliverables.trim(),
      startDate: '',
      targetDate: '',
      linkedCourseId: projCourseId ? parseInt(projCourseId, 10) : undefined,
      notes: '',
    });
    setProjTitle('');
    setProjDesc('');
    setProjDeliverables('');
    setProjCat('');
    setProjCourseId('');
    setShowAddProject(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            التنفيذ والتطبيق العملي · مهام الكورسات والخطة والمشاريع المهنية
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            المهام الموحدة والمشاريع التطبيقية
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            اجمع مهامك الشخصية ومهام الكورسات ووحدات الخطة في مكان واحد، وتابع مشاريعك التطبيقية في الماركتينج والدنتال والثقافة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('tasks')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg border cursor-pointer ${
              subTab === 'tasks'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <ListTodo className="w-4 h-4" aria-hidden="true" />
            <span>المهام ({unifiedTasks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('projects')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg border cursor-pointer ${
              subTab === 'projects'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4" aria-hidden="true" />
            <span>المشاريع التطبيقية ({projects.length})</span>
          </button>
        </div>
      </div>

      {/* Hub Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeHubFilter('all')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
            activeHubFilter === 'all'
              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          جميع المجالات
        </button>
        {LEARNING_HUBS.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onChangeHubFilter(h.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
              activeHubFilter === h.id
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            {h.title}
          </button>
        ))}
      </div>

      {subTab === 'tasks' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'todo', 'in_progress', 'done'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {st === 'all' ? 'الكل' : TASK_STATUS_AR[st]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  onRequireAuth();
                  return;
                }
                setShowAddTask((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{showAddTask ? 'إلغاء' : 'إضافة مهمة جديدة'}</span>
            </button>
          </div>

          {showAddTask && canEdit && (
            <form
              onSubmit={handleCreateTask}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-slate-700">
                  عنوان المهمة (مطلوب)
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="مثلاً: إعداد خطة محتوى لأول أسبوعين"
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  المجال (Hub)
                  <select
                    value={taskHub}
                    onChange={(e) => setTaskHub(e.target.value as LearningHubId)}
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
                  الأولوية
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="high">عالية</option>
                    <option value="medium">متوسطة</option>
                    <option value="low">منخفضة</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  موعد الاستحقاق (اختياري)
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  التصنيف الفرعي (اختياري)
                  <input
                    type="text"
                    list="task-cats"
                    value={taskCat}
                    onChange={(e) => setTaskCat(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <datalist id="task-cats">
                    {(hubCategories[taskHub] ?? []).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-700">
                تفاصيل إضافية (اختياري)
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                >
                  حفظ المهمة
                </button>
              </div>
            </form>
          )}

          {/* Standalone Unified Tasks */}
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {filteredTasks.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">
                لا توجد مهام مستقلة هنا بعد — اضغط «إضافة مهمة جديدة».
              </p>
            ) : (
              filteredTasks.map((t) => {
                const hubMeta = getHubMeta(t.hubId);
                return (
                  <div
                    key={t.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          onUpdateUnifiedTask(t.id, {
                            status: t.status === 'done' ? 'todo' : 'done',
                          })
                        }
                        className="mt-0.5 cursor-pointer disabled:opacity-60"
                      >
                        {t.status === 'done' ? (
                          <CheckSquare className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        )}
                      </button>
                      <div className="space-y-1">
                        <p
                          className={`text-sm font-semibold ${
                            t.status === 'done'
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {t.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span
                            className={`px-1.5 py-0.5 border rounded ${hubMeta.badgeClass}`}
                          >
                            {hubMeta.shortTitle}
                          </span>
                          <span>الأولوية: {PRIORITY_AR[t.priority]}</span>
                          {t.dueDate && <span>· الاستحقاق: {t.dueDate}</span>}
                          {t.categoryLabel && <span>· {t.categoryLabel}</span>}
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-600">{t.description}</p>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={t.status}
                          onChange={(e) =>
                            onUpdateUnifiedTask(t.id, {
                              status: e.target.value as UnifiedTaskStatus,
                            })
                          }
                          className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
                        >
                          <option value="todo">قيد الانتظار</option>
                          <option value="in_progress">قيد التنفيذ</option>
                          <option value="done">مكتملة</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTask(t)}
                          aria-label="حذف المهمة"
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Live Course & Plan Tasks Integration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                مهام الكورسات ({aggregatedCourseTasks.filter((t) => t.done).length} /{' '}
                {aggregatedCourseTasks.length})
              </h2>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {aggregatedCourseTasks.map((ct) => (
                  <div
                    key={`${ct.course.id}-${ct.id}`}
                    className="py-2.5 flex items-start justify-between gap-2"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onToggleCourseTask(ct.course.id, ct.id)}
                      className="flex items-start gap-2 text-right flex-1 cursor-pointer"
                    >
                      {ct.done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                      )}
                      <div>
                        <p
                          className={`text-xs ${
                            ct.done ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {ct.text}
                        </p>
                        <p className="text-[10px] text-slate-500">{ct.course.title}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCourse(ct.course.id)}
                      className="text-[11px] font-medium text-[#1E3A5F] hover:underline shrink-0 cursor-pointer"
                    >
                      الكورس ←
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                مهام وحدات الخطة ({aggregatedPlanTasks.filter((t) => t.done).length} /{' '}
                {aggregatedPlanTasks.length})
              </h2>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {aggregatedPlanTasks.map((mt) => (
                  <div
                    key={`${mt.month.id}-${mt.id}`}
                    className="py-2.5 flex items-start justify-between gap-2"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onToggleMonthTask(mt.month.id, mt.id)}
                      className="flex items-start gap-2 text-right flex-1 cursor-pointer"
                    >
                      {mt.done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                      )}
                      <div>
                        <p
                          className={`text-xs ${
                            mt.done ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {mt.text}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          الشهر {mt.month.id}: {mt.month.theme}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onJumpToMonth(mt.month.id)}
                      className="text-[11px] font-medium text-[#1E3A5F] hover:underline shrink-0 cursor-pointer"
                    >
                      الوحدة ←
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  onRequireAuth();
                  return;
                }
                setShowAddProject((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{showAddProject ? 'إلغاء' : 'إضافة مشروع تطبيقي'}</span>
            </button>
          </div>

          {showAddProject && canEdit && (
            <form
              onSubmit={handleCreateProject}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-slate-700">
                  اسم المشروع (مطلوب)
                  <input
                    type="text"
                    required
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    placeholder="مثلاً: إطلاق حملة ميتا لعيادة أو بناء Case Study"
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  المجال (Hub)
                  <select
                    value={projHub}
                    onChange={(e) => setProjHub(e.target.value as LearningHubId)}
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
                  التصنيف (اختياري)
                  <input
                    type="text"
                    list="proj-cats"
                    value={projCat}
                    onChange={(e) => setProjCat(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <datalist id="proj-cats">
                    {(hubCategories[projHub] ?? []).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  ربط بكورس (اختياري)
                  <select
                    value={projCourseId}
                    onChange={(e) => setProjCourseId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">بدون ربط</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-700">
                المخرجات المستهدفة (اختياري)
                <input
                  type="text"
                  value={projDeliverables}
                  onChange={(e) => setProjDeliverables(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                وصف المشروع (اختياري)
                <textarea
                  rows={2}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                >
                  حفظ المشروع
                </button>
              </div>
            </form>
          )}

          {filteredProjects.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">
                لا توجد مشاريع تطبيقية بعد
              </p>
              <p className="text-xs text-slate-500">
                أضف مشاريعك المهنية والتسويقية والعلمية واربطها بالكورسات.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredProjects.map((proj) => {
                const hubMeta = getHubMeta(proj.hubId);
                const linkedCourse = courses.find((c) => c.id === proj.linkedCourseId);
                return (
                  <article
                    key={proj.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`px-2 py-0.5 font-semibold border rounded-md ${hubMeta.badgeClass}`}
                          >
                            {hubMeta.shortTitle}
                          </span>
                          <span className="text-slate-500">
                            {PROJECT_STATUS_AR[proj.status]}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          {proj.title}
                        </h3>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProj(proj)}
                          aria-label={`حذف ${proj.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {proj.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                    {proj.deliverables && (
                      <p className="text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <strong>المخرجات:</strong> {proj.deliverables}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">نسبة الإنجاز</span>
                        <span className="font-bold tabular-nums">{proj.progressPct}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        disabled={!canEdit}
                        value={proj.progressPct}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateProject(proj.id, {
                            progressPct: val,
                            status:
                              val === 100
                                ? 'completed'
                                : val > 0
                                ? 'in_progress'
                                : 'planned',
                          });
                        }}
                        className="w-full accent-[#1E3A5F]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      {linkedCourse ? (
                        <button
                          type="button"
                          onClick={() => onOpenCourse(linkedCourse.id)}
                          className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                        >
                          كورس: {linkedCourse.title} ←
                        </button>
                      ) : (
                        <span className="text-slate-400">مشروع مستقل</span>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateProject(proj.id, {
                              status:
                                proj.status === 'completed'
                                  ? 'in_progress'
                                  : 'completed',
                              progressPct: proj.status === 'completed' ? 50 : 100,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {proj.status === 'completed' ? 'مكتمل' : 'تحديد كمكتمل'}
                          </span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteTask)}
        title="تأكيد حذف المهمة"
        message={`هل تريد حذف المهمة «${confirmDeleteTask?.title ?? ''}»؟`}
        onConfirm={() => {
          if (confirmDeleteTask) {
            onDeleteUnifiedTask(confirmDeleteTask.id);
            setConfirmDeleteTask(null);
          }
        }}
        onCancel={() => setConfirmDeleteTask(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteProj)}
        title="تأكيد حذف المشروع"
        message={`هل تريد حذف المشروع «${confirmDeleteProj?.title ?? ''}»؟`}
        onConfirm={() => {
          if (confirmDeleteProj) {
            onDeleteProject(confirmDeleteProj.id);
            setConfirmDeleteProj(null);
          }
        }}
        onCancel={() => setConfirmDeleteProj(null)}
      />
    </div>
  );
}
