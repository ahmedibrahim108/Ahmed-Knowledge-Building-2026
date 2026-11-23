import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Columns3,
  Compass,
  Edit3,
  LayoutGrid,
  Link2,
  List,
  ListTodo,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthPlan,
  PersonalCourse,
  PracticalProject,
  ProjectStatus,
  ReadingLibraryItem,
  TaskPriority,
  UnifiedTask,
  UnifiedTaskStatus,
  computeEndTimeFromMinutes,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import TaskFormModal from './TaskFormModal';

interface TasksProjectsViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  unifiedTasks: UnifiedTask[];
  projects: PracticalProject[];
  months: MonthPlan[];
  courses: PersonalCourse[];
  learningPaths?: LearningPath[];
  readingItems?: ReadingLibraryItem[];
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
  onTogglePathStage?: (pathId: string, stageId: string) => void;
  onJumpToMonth: (monthId: number) => void;
  onOpenCourse: (courseId: number) => void;
  onOpenPath?: (pathId: string) => void;
  onOpenCalendar?: () => void;
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
  learningPaths = [],
  readingItems = [],
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
  onTogglePathStage,
  onJumpToMonth,
  onOpenCourse,
  onOpenPath,
  onOpenCalendar,
}: TasksProjectsViewProps) {
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const [subTab, setSubTab] = useState<'tasks' | 'projects'>('tasks');
  const [tasksLayout, setTasksLayout] = useState<'board' | 'grid' | 'compact'>('board');
  const [showLinkedChecklist, setShowLinkedChecklist] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    UnifiedTaskStatus | 'all' | 'unscheduled' | 'scheduled' | 'overdue'
  >('all');

  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    initialTask: UnifiedTask | null;
    prefill?: Partial<UnifiedTask>;
  }>({ open: false, initialTask: null });

  const [confirmDeleteTask, setConfirmDeleteTask] = useState<UnifiedTask | null>(null);

  // New Project Form
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

  // Quick Schedule Linked Course / Path / Plan Task modal state
  const [quickSchedTarget, setQuickSchedTarget] = useState<{
    projectId: string;
    title: string;
    hubId: LearningHubId;
    linkedLabel: string;
    categoryLabel: string;
    done: boolean;
  } | null>(null);
  const [quickSchedDate, setQuickSchedDate] = useState(() => getTodayDateKey());
  const [quickSchedTime, setQuickSchedTime] = useState('');
  const [quickSchedDuration, setQuickSchedDuration] = useState(60);

  const isTaskOverdue = (t: UnifiedTask) => {
    if (t.status === 'done') return false;
    const dl = t.deadline || t.dueDate;
    const sched = t.scheduledDate;
    return Boolean((dl && dl < todayKey) || (sched && sched < todayKey));
  };

  const resolveTaskContextBadge = (t: UnifiedTask): string => {
    if (t.linkedLabel) return t.linkedLabel;
    if (t.linkedCourseId) {
      const course = courses.find((c) => c.id === t.linkedCourseId);
      if (course) return `كورس: ${course.title}`;
    }
    if (t.linkedPathId) {
      const lp = learningPaths.find((p) => p.id === t.linkedPathId);
      if (lp) return `مسار: ${lp.title}`;
    }
    if (t.linkedBookId) {
      const book = readingItems.find((r) => r.id === t.linkedBookId);
      if (book) return `كتاب: ${book.title}`;
    }
    const projectId = t.projectId || '';
    if (!projectId) return '';
    const proj = projects.find((p) => p.id === projectId);
    if (proj) return `مشروع: ${proj.title}`;
    if (projectId.startsWith('course:')) {
      const cid = Number(projectId.split(':')[1]);
      const course = courses.find((c) => c.id === cid);
      if (course) return `كورس: ${course.title}`;
    }
    if (projectId.startsWith('path:')) {
      const pid = projectId.split(':')[1];
      const lp = learningPaths.find((p) => p.id === pid);
      if (lp) return `مسار: ${lp.title}`;
    }
    if (projectId.startsWith('book:')) {
      const bid = projectId.split(':')[1];
      const book = readingItems.find((r) => r.id === bid);
      if (book) return `كتاب: ${book.title}`;
    }
    if (projectId.startsWith('month:')) {
      const mid = Number(projectId.split(':')[1]);
      const m = months.find((mo) => mo.id === mid);
      if (m) return `الشهر ${m.id}: ${m.theme}`;
    }
    return '';
  };

  const filteredTasks = useMemo(() => {
    return unifiedTasks.filter((t) => {
      if (activeHubFilter !== 'all' && t.hubId !== activeHubFilter) return false;
      if (statusFilter === 'unscheduled') return !t.scheduledDate && t.status !== 'done';
      if (statusFilter === 'scheduled') return Boolean(t.scheduledDate) && t.status !== 'done';
      if (statusFilter === 'overdue') return isTaskOverdue(t);
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unifiedTasks, activeHubFilter, statusFilter, todayKey]);

  const unscheduledCount = useMemo(
    () => unifiedTasks.filter((t) => !t.scheduledDate && t.status !== 'done').length,
    [unifiedTasks]
  );

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

  const aggregatedPathStages = useMemo(() => {
    const out: Array<{ path: LearningPath; id: string; title: string; done: boolean }> = [];
    for (const p of learningPaths) {
      const pHub = p.hubId ?? 'knowledge';
      if (activeHubFilter !== 'all' && pHub !== activeHubFilter) continue;
      for (const s of p.stages) {
        out.push({ path: p, id: s.id, title: s.title, done: s.done });
      }
    }
    return out;
  }, [learningPaths, activeHubFilter]);

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

  const openQuickSchedule = (item: {
    projectId: string;
    title: string;
    hubId: LearningHubId;
    linkedLabel: string;
    categoryLabel: string;
    done: boolean;
  }) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const existing = unifiedTasks.find((t) => t.projectId === item.projectId);
    setQuickSchedTarget(item);
    setQuickSchedDate(existing?.scheduledDate || todayKey);
    setQuickSchedTime(existing?.startTime || '');
    setQuickSchedDuration(existing?.durationMinutes || 60);
  };

  const handleSaveQuickSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSchedTarget || !canEdit) return;
    const existing = unifiedTasks.find(
      (t) => t.projectId === quickSchedTarget.projectId
    );
    const endTime = quickSchedTime
      ? computeEndTimeFromMinutes(quickSchedTime, quickSchedDuration)
      : '';
    if (existing) {
      onUpdateUnifiedTask(existing.id, {
        scheduledDate: quickSchedDate,
        dueDate: existing.deadline || quickSchedDate,
        startTime: quickSchedTime,
        endTime,
        durationMinutes: quickSchedDuration,
      });
    } else {
      onAddUnifiedTask({
        title: quickSchedTarget.title,
        description: '',
        hubId: quickSchedTarget.hubId,
        categoryLabel: quickSchedTarget.categoryLabel,
        priority: 'medium',
        status: quickSchedTarget.done ? 'done' : 'todo',
        dueDate: quickSchedDate,
        scheduledDate: quickSchedDate,
        startTime: quickSchedTime,
        endTime,
        durationMinutes: quickSchedDuration,
        projectId: quickSchedTarget.projectId,
        linkedLabel: quickSchedTarget.linkedLabel,
      });
    }
    setQuickSchedTarget(null);
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

  const renderTaskCard = (t: UnifiedTask, compact = false) => {
    const hubMeta = getHubMeta(t.hubId);
    const overdue = isTaskOverdue(t);
    const contextBadge = resolveTaskContextBadge(t);
    const priorityBorder =
      t.priority === 'high'
        ? 'border-rose-200/90'
        : t.priority === 'low'
        ? 'border-slate-200'
        : 'border-slate-200';

    return (
      <article
        key={t.id}
        className={`bg-white border ${priorityBorder} hover:border-[#1E3A5F]/40 rounded-xl ${
          compact ? 'p-3' : 'p-3.5'
        } flex flex-col justify-between gap-2.5 transition-colors`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() =>
              onUpdateUnifiedTask(t.id, {
                status: t.status === 'done' ? 'todo' : 'done',
              })
            }
            className="mt-0.5 cursor-pointer disabled:opacity-60 shrink-0"
          >
            {t.status === 'done' ? (
              <CheckSquare className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <p
              className={`text-xs sm:text-sm font-semibold leading-snug line-clamp-2 ${
                t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
              }`}
            >
              <BidiText text={t.title} />
            </p>

            {t.description && !compact && (
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                <BidiText text={t.description} />
              </p>
            )}

            {/* Quiet Unboxed Inline Metadata (Zero-Pill Rule) */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
              <span className="font-medium text-[#1E3A5F]">{hubMeta.shortTitle}</span>
              <span>· أولوية {PRIORITY_AR[t.priority]}</span>
              {t.scheduledDate ? (
                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                  · <Calendar className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  {t.scheduledDate}
                  {t.startTime ? ` ${t.startTime}` : ''}
                </span>
              ) : (
                <span>· غير مجدولة</span>
              )}
              {overdue && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-rose-700">
                  · <AlertTriangle className="w-3 h-3" aria-hidden="true" /> متأخرة
                </span>
              )}
            </div>

            {contextBadge && (
              <p className="inline-flex items-center gap-1 text-[11px] text-slate-600 truncate max-w-full">
                <Link2 className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{contextBadge}</span>
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
            <select
              value={t.status}
              onChange={(e) =>
                onUpdateUnifiedTask(t.id, {
                  status: e.target.value as UnifiedTaskStatus,
                })
              }
              className="px-2 py-1 text-[11px] bg-[#F7F8FA] border border-slate-200 rounded-md cursor-pointer"
            >
              <option value="todo">قيد الانتظار</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="done">مكتملة</option>
            </select>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setTaskModalState({
                    open: true,
                    initialTask: t,
                  })
                }
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-200 rounded-md cursor-pointer"
                aria-label="تعديل وجدولة المهمة"
              >
                <Edit3 className="w-3 h-3" aria-hidden="true" />
                <span>جدولة / تعديل</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteTask(t)}
                aria-label="حذف المهمة"
                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  const effectiveLayout =
    statusFilter === 'all' ? tasksLayout : tasksLayout === 'board' ? 'grid' : tasksLayout;

  const boardColumns: Array<{
    status: UnifiedTaskStatus;
    title: string;
    accent: string;
    items: UnifiedTask[];
  }> = [
    {
      status: 'todo',
      title: 'قيد الانتظار',
      accent: 'text-slate-800',
      items: filteredTasks.filter((t) => t.status === 'todo'),
    },
    {
      status: 'in_progress',
      title: 'قيد التنفيذ',
      accent: 'text-[#1E3A5F]',
      items: filteredTasks.filter((t) => t.status === 'in_progress'),
    },
    {
      status: 'done',
      title: 'مكتملة',
      accent: 'text-emerald-800',
      items: filteredTasks.filter((t) => t.status === 'done'),
    },
  ];

  const linkedCourseDone = aggregatedCourseTasks.filter((t) => t.done).length;
  const linkedPathDone = aggregatedPathStages.filter((s) => s.done).length;
  const linkedPlanDone = aggregatedPlanTasks.filter((t) => t.done).length;

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            المهام الموحدة والمشاريع التطبيقية
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            نظّم مهامك ضمن أعمدة واضحة أو بطاقات مدمجة، واربطها بالتقويم والكورسات والمسارات دون امتداد يملأ الشاشة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>التقويم</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubTab('tasks')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg border cursor-pointer ${
              subTab === 'tasks'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" aria-hidden="true" />
            <span>المهام ({unifiedTasks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('projects')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg border cursor-pointer ${
              subTab === 'projects'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
            <span>المشاريع ({projects.length})</span>
          </button>
        </div>
      </div>

      {/* Hub Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeHubFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
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
        <div className="space-y-5">
          {/* Toolbar: Status Filters + Layout Switcher + New Task */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'unscheduled', label: `غير مجدولة (${unscheduledCount})` },
                  { id: 'scheduled', label: 'مجدولة' },
                  { id: 'overdue', label: 'متأخرة' },
                  { id: 'todo', label: TASK_STATUS_AR.todo },
                  { id: 'in_progress', label: TASK_STATUS_AR.in_progress },
                  { id: 'done', label: TASK_STATUS_AR.done },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-[#F7F8FA] border border-slate-200 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setTasksLayout('board')}
                  title="لوحة أعمدة مدمجة"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer ${
                    tasksLayout === 'board'
                      ? 'bg-white text-[#1E3A5F] font-semibold shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  <Columns3 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>أعمدة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTasksLayout('grid')}
                  title="شبكة بطاقات 3 أعمدة"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer ${
                    tasksLayout === 'grid'
                      ? 'bg-white text-[#1E3A5F] font-semibold shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>بطاقات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTasksLayout('compact')}
                  title="قائمة مختصرة"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer ${
                    tasksLayout === 'compact'
                      ? 'bg-white text-[#1E3A5F] font-semibold shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  <List className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>مختصرة</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!canEdit) {
                    onRequireAuth();
                    return;
                  }
                  setTaskModalState({
                    open: true,
                    initialTask: null,
                    prefill: {
                      hubId: activeHubFilter === 'all' ? 'knowledge' : activeHubFilter,
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>إضافة مهمة</span>
              </button>
            </div>
          </div>

          {/* Tasks Display Area: Compact Kanban Board OR 3-Col Card Grid OR Compact Table Rows */}
          {filteredTasks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              لا توجد مهام مطابقة للتصفية الحالية — اضغط «إضافة مهمة».
            </div>
          ) : effectiveLayout === 'board' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              {boardColumns.map((col) => (
                <section
                  key={col.status}
                  className="bg-[#F7F8FA] border border-slate-200 rounded-xl p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200/80">
                    <h2 className={`text-xs font-bold ${col.accent}`}>
                      {col.title}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                        {col.items.length}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            setTaskModalState({
                              open: true,
                              initialTask: null,
                              prefill: {
                                hubId:
                                  activeHubFilter === 'all' ? 'knowledge' : activeHubFilter,
                                status: col.status,
                              },
                            })
                          }
                          aria-label={`إضافة مهمة في ${col.title}`}
                          className="p-1 text-slate-400 hover:text-[#1E3A5F] rounded cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[540px] overflow-y-auto pr-0.5">
                    {col.items.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-slate-400">
                        لا توجد مهام في هذا العمود
                      </p>
                    ) : (
                      col.items.map((t) => renderTaskCard(t, true))
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : effectiveLayout === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredTasks.map((t) => renderTaskCard(t, false))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredTasks.map((t) => {
                const hubMeta = getHubMeta(t.hubId);
                const overdue = isTaskOverdue(t);
                const contextBadge = resolveTaskContextBadge(t);
                return (
                  <div
                    key={t.id}
                    className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-[#F7F8FA]"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        onUpdateUnifiedTask(t.id, {
                          status: t.status === 'done' ? 'todo' : 'done',
                        })
                      }
                      className="flex items-center gap-2.5 text-right flex-1 min-w-[200px] cursor-pointer"
                    >
                      {t.status === 'done' ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        <BidiText text={t.title} />
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 tabular-nums shrink-0">
                      <span>{hubMeta.shortTitle}</span>
                      {t.scheduledDate && (
                        <span>
                          {t.scheduledDate}
                          {t.startTime ? ` · ${t.startTime}` : ''}
                        </span>
                      )}
                      {contextBadge && (
                        <span className="max-w-[140px] truncate text-slate-600">
                          {contextBadge}
                        </span>
                      )}
                      {overdue && (
                        <span className="font-semibold text-rose-700">متأخرة</span>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setTaskModalState({ open: true, initialTask: t })
                            }
                            className="px-2 py-1 text-[11px] font-medium text-[#1E3A5F] bg-slate-100 rounded cursor-pointer"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTask(t)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible Compact Drawer for Linked Courses, Paths & Plan Checklists */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLinkedChecklist((v) => !v)}
              className="w-full px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-right hover:bg-[#F7F8FA] transition-colors cursor-pointer"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Compass className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  المهام المرتبطة بالكورسات والمسارات والخطة
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  ({linkedCourseDone}/{aggregatedCourseTasks.length} كورس · {linkedPathDone}/
                  {aggregatedPathStages.length} مسار · {linkedPlanDone}/{aggregatedPlanTasks.length} خطة)
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F]">
                <span>{showLinkedChecklist ? 'طيّ القائمة' : 'عرض القوائم المرتبطة'}</span>
                {showLinkedChecklist ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </span>
            </button>

            {showLinkedChecklist && (
              <div className="p-4 sm:p-5 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-3 gap-4 bg-[#F7F8FA]/50">
                {/* Course Tasks */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-900 tabular-nums">
                    مهام الكورسات ({linkedCourseDone} / {aggregatedCourseTasks.length})
                  </h3>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {aggregatedCourseTasks.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3">لا توجد مهام كورسات بعد.</p>
                    ) : (
                      aggregatedCourseTasks.map((ct) => {
                        const canonicalId = `course:${ct.course.id}:${ct.id}`;
                        const schedTask = unifiedTasks.find(
                          (ut) => ut.projectId === canonicalId
                        );
                        return (
                          <div key={`${ct.course.id}-${ct.id}`} className="py-2 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => onToggleCourseTask(ct.course.id, ct.id)}
                                className="flex items-start gap-2 text-right flex-1 cursor-pointer"
                              >
                                {ct.done ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0">
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
                                فتح
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-2 pr-5 text-[10px]">
                              <span className="text-slate-500 tabular-nums">
                                {schedTask?.scheduledDate
                                  ? `مجدولة: ${schedTask.scheduledDate}`
                                  : 'غير مجدولة'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  openQuickSchedule({
                                    projectId: canonicalId,
                                    title: ct.text,
                                    hubId: ct.course.hubId ?? 'knowledge',
                                    linkedLabel: ct.course.title,
                                    categoryLabel: `كورس: ${ct.course.title}`,
                                    done: ct.done,
                                  })
                                }
                                className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                              >
                                {schedTask?.scheduledDate ? 'تعديل الموعد' : 'جدولة'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Learning Paths Stages */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-900 tabular-nums">
                    مراحل المسارات ({linkedPathDone} / {aggregatedPathStages.length})
                  </h3>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {aggregatedPathStages.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3">لا توجد مراحل مسارات بعد.</p>
                    ) : (
                      aggregatedPathStages.map((ps) => {
                        const canonicalId = `path:${ps.path.id}:${ps.id}`;
                        const schedTask = unifiedTasks.find(
                          (ut) => ut.projectId === canonicalId
                        );
                        return (
                          <div key={`${ps.path.id}-${ps.id}`} className="py-2 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                disabled={!canEdit || !onTogglePathStage}
                                onClick={() => onTogglePathStage?.(ps.path.id, ps.id)}
                                className="flex items-start gap-2 text-right flex-1 cursor-pointer disabled:opacity-70"
                              >
                                {ps.done ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p
                                    className={`text-xs ${
                                      ps.done ? 'line-through text-slate-400' : 'text-slate-800'
                                    }`}
                                  >
                                    {ps.title}
                                  </p>
                                  <p className="text-[10px] text-slate-500">{ps.path.title}</p>
                                </div>
                              </button>
                              {onOpenPath && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPath(ps.path.id)}
                                  className="text-[11px] font-medium text-[#1E3A5F] hover:underline shrink-0 cursor-pointer"
                                >
                                  فتح
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 pr-5 text-[10px]">
                              <span className="text-slate-500 tabular-nums">
                                {schedTask?.scheduledDate
                                  ? `مجدولة: ${schedTask.scheduledDate}`
                                  : 'غير مجدولة'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  openQuickSchedule({
                                    projectId: canonicalId,
                                    title: ps.title,
                                    hubId: ps.path.hubId ?? 'knowledge',
                                    linkedLabel: ps.path.title,
                                    categoryLabel: `مسار: ${ps.path.title}`,
                                    done: ps.done,
                                  })
                                }
                                className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                              >
                                {schedTask?.scheduledDate ? 'تعديل الموعد' : 'جدولة'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Plan Tasks */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-900 tabular-nums">
                    مهام وحدات الخطة ({linkedPlanDone} / {aggregatedPlanTasks.length})
                  </h3>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {aggregatedPlanTasks.map((mt) => {
                      const canonicalId = `month:${mt.month.id}:${mt.id}`;
                      const schedTask = unifiedTasks.find(
                        (ut) => ut.projectId === canonicalId
                      );
                      return (
                        <div key={`${mt.month.id}-${mt.id}`} className="py-2 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => onToggleMonthTask(mt.month.id, mt.id)}
                              className="flex items-start gap-2 text-right flex-1 cursor-pointer"
                            >
                              {mt.done ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p
                                  className={`text-xs ${
                                    mt.done ? 'line-through text-slate-400' : 'text-slate-800'
                                  }`}
                                >
                                  {mt.text}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  الوحدة {mt.month.id}: {mt.month.theme}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => onJumpToMonth(mt.month.id)}
                              className="text-[11px] font-medium text-[#1E3A5F] hover:underline shrink-0 cursor-pointer"
                            >
                              فتح
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 pr-5 text-[10px]">
                            <span className="text-slate-500 tabular-nums">
                              {schedTask?.scheduledDate
                                ? `مجدولة: ${schedTask.scheduledDate}`
                                : 'غير مجدولة'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                openQuickSchedule({
                                  projectId: canonicalId,
                                  title: mt.text,
                                  hubId: mt.month.hubId ?? 'knowledge',
                                  linkedLabel: `الوحدة ${mt.month.id}: ${mt.month.theme}`,
                                  categoryLabel: `وحدة ${mt.month.id}`,
                                  done: mt.done,
                                })
                              }
                              className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                            >
                              {schedTask?.scheduledDate ? 'تعديل الموعد' : 'جدولة'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((proj) => {
                const hubMeta = getHubMeta(proj.hubId);
                const linkedCourse = courses.find((c) => c.id === proj.linkedCourseId);
                return (
                  <article
                    key={proj.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold text-[#1E3A5F]">
                            {hubMeta.shortTitle}
                          </span>
                          {' · '}
                          {PROJECT_STATUS_AR[proj.status]}
                        </p>
                        <h3 className="text-base font-bold text-slate-900">
                          <BidiText text={proj.title} />
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
                      <BidiText
                        text={proj.description}
                        as="div"
                        multiline
                        className="text-xs text-slate-600 leading-relaxed line-clamp-3"
                      />
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
                          {linkedCourse.title} ←
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
                            {proj.status === 'completed' ? 'مكتمل' : 'إتمام'}
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

      <TaskFormModal
        open={taskModalState.open}
        onClose={() => setTaskModalState({ open: false, initialTask: null })}
        initialTask={taskModalState.initialTask}
        prefill={taskModalState.prefill}
        courses={courses}
        learningPaths={learningPaths}
        readingItems={readingItems}
        projects={projects}
        hubCategories={hubCategories}
        onSubmit={(payload, existingId) => {
          if (existingId) {
            onUpdateUnifiedTask(existingId, payload);
          } else {
            onAddUnifiedTask(payload);
          }
        }}
        onDelete={onDeleteUnifiedTask}
      />

      {/* Quick Schedule Modal for Course / Path / Plan items */}
      {quickSchedTarget && (
        <div
          className="fixed inset-0 z-[75] bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setQuickSchedTarget(null)}
        >
          <form
            onSubmit={handleSaveQuickSchedule}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                جدولة في التقويم الموحد
              </h3>
              <button
                type="button"
                onClick={() => setQuickSchedTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5">
              <p className="text-xs font-bold text-slate-900">{quickSchedTarget.title}</p>
              <p className="text-[11px] text-slate-500">{quickSchedTarget.linkedLabel}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="block font-medium text-slate-700 sm:col-span-2">
                تاريخ التنفيذ
                <input
                  type="date"
                  required
                  value={quickSchedDate}
                  onChange={(e) => setQuickSchedDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                />
              </label>

              <label className="block font-medium text-slate-700">
                وقت البدء (اختياري)
                <input
                  type="time"
                  value={quickSchedTime}
                  onChange={(e) => setQuickSchedTime(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                />
              </label>

              <label className="block font-medium text-slate-700">
                المدة التقديرية
                <select
                  value={quickSchedDuration}
                  onChange={(e) => setQuickSchedDuration(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value={15}>15 دقيقة</option>
                  <option value={30}>30 دقيقة</option>
                  <option value={45}>45 دقيقة</option>
                  <option value={60}>ساعة (60 د)</option>
                  <option value={90}>ساعة ونصف</option>
                  <option value={120}>ساعتان</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickSchedTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حفظ الموعد</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteTask)}
        title="تأكيد حذف المهمة"
        message={`هل تريد حذف المهمة «${confirmDeleteTask?.title ?? ''}»؟`}
        onConfirm={() => {
          if (confirmDeleteTask) onDeleteUnifiedTask(confirmDeleteTask.id);
          setConfirmDeleteTask(null);
        }}
        onCancel={() => setConfirmDeleteTask(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteProj)}
        title="تأكيد حذف المشروع"
        message={`هل تريد حذف المشروع «${confirmDeleteProj?.title ?? ''}»؟`}
        onConfirm={() => {
          if (confirmDeleteProj) onDeleteProject(confirmDeleteProj.id);
          setConfirmDeleteProj(null);
        }}
        onCancel={() => setConfirmDeleteProj(null)}
      />
    </div>
  );
}
