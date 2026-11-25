import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Compass,
  Edit3,
  Globe,
  ListTodo,
  Lock,
  Plus,
  Repeat,
  Square,
  Trash2,
} from 'lucide-react';
import {
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  LearningPathStage,
  LearningPathStatus,
  PersonalCourse,
  PinCollection,
  PinEntityType,
  PracticalProject,
  ReadingLibraryItem,
  ReadingModeMeta,
  TaskPriority,
  UnifiedTask,
  computeEndTimeFromMinutes,
  getHubMeta,
  getTodayDateKey,
  sortLearningPathsList,
} from '../data/curriculumData';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import LearningObjectivesPanel from './LearningObjectivesPanel';
import {
  PinCollectionsBar,
  PinEntityButton,
  isEntityInCollection,
} from './PinCollectionsBar';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
import TaskFormModal from './TaskFormModal';
import { formatRecurrenceSummaryAr } from '../utils/taskRecurrence';

interface PathsViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  paths: LearningPath[];
  courses: PersonalCourse[];
  readingItems?: ReadingLibraryItem[];
  projects?: PracticalProject[];
  unifiedTasks?: UnifiedTask[];
  hubCategories: Record<LearningHubId, string[]>;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  onAddPath: (
    payload: Omit<LearningPath, 'id'>
  ) => void;
  onUpdatePath: (id: string, updates: Partial<LearningPath>) => void;
  onDeletePath: (id: string) => void;
  onTogglePathStage?: (pathId: string, stageId: string) => void;
  onAddUnifiedTask?: (payload: Omit<UnifiedTask, 'id'>) => void;
  onUpdateUnifiedTask?: (id: string, updates: Partial<UnifiedTask>) => void;
  onDeleteUnifiedTask?: (taskId: string) => void;
  onOpenCourse: (courseId: number) => void;
  onOpenCalendar?: () => void;
  onOpenTasks?: () => void;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
  pinCollections?: PinCollection[];
  activeFocusPinCollectionId?: string | null;
  onSelectFocusPinCollection?: (id: string | null) => void;
  onSavePinCollection?: (col: PinCollection) => void;
  onDeletePinCollection?: (id: string) => void;
  onTogglePinEntity?: (collectionId: string, entityType: PinEntityType, entityId: string) => void;
  onQuickCreatePinCollection?: (title: string, entityType: PinEntityType, entityId: string) => void;
}

const STATUS_LABELS: Record<LearningPathStatus, string> = {
  planned: 'مخطط له',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
};

export default function PathsView({
  canEdit,
  onRequireAuth,
  paths,
  courses,
  readingItems = [],
  projects = [],
  unifiedTasks = [],
  hubCategories,
  activeHubFilter,
  onChangeHubFilter,
  onAddPath,
  onUpdatePath,
  onDeletePath,
  onTogglePathStage,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onDeleteUnifiedTask,
  onOpenCourse,
  onOpenCalendar,
  onOpenTasks,
  customReadingModes,
  onUpdateReadingModes,
  pinCollections = [],
  activeFocusPinCollectionId = null,
  onSelectFocusPinCollection,
  onSavePinCollection,
  onDeletePinCollection,
  onTogglePinEntity,
  onQuickCreatePinCollection,
}: PathsViewProps) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [confirmDeletePath, setConfirmDeletePath] = useState<LearningPath | null>(null);
  const [sortMode, setSortMode] = useState<'manual' | 'progress' | 'title'>('manual');
  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    initialTask: UnifiedTask | null;
    prefill?: Partial<UnifiedTask>;
  }>({ open: false, initialTask: null });

  // Stage & path task calendar scheduling
  const [schedStageId, setSchedStageId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState(() => getTodayDateKey());
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedDuration, setSchedDuration] = useState(60);
  const [schedPriority, setSchedPriority] = useState<TaskPriority>('medium');
  const [newPathTaskTitle, setNewPathTaskTitle] = useState('');
  const [newPathTaskDate, setNewPathTaskDate] = useState('');
  const [newPathTaskTime, setNewPathTaskTime] = useState('');

  // Add Form State (only title required)
  const [title, setTitle] = useState('');
  const [hubId, setHubId] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'marketing' : activeHubFilter
  );
  const [categoryLabel, setCategoryLabel] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [newStageInput, setNewStageInput] = useState('');

  const activePinCollection = useMemo(
    () =>
      activeFocusPinCollectionId
        ? pinCollections.find((c) => c.id === activeFocusPinCollectionId) || null
        : null,
    [pinCollections, activeFocusPinCollectionId]
  );

  const filteredPaths = useMemo(() => {
    const base = paths.filter((p) => {
      if (activeHubFilter !== 'all' && p.hubId !== activeHubFilter) return false;
      if (activePinCollection && !isEntityInCollection(activePinCollection, 'path', p.id)) {
        return false;
      }
      return true;
    });
    return sortLearningPathsList(base, sortMode);
  }, [paths, activeHubFilter, activePinCollection, sortMode]);

  const handleMovePathOrder = (pathId: string, dir: -1 | 1) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const idx = filteredPaths.findIndex((p) => p.id === pathId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= filteredPaths.length) return;
    const reordered = [...filteredPaths];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    reordered.forEach((p, pos) => {
      const nextOrder = pos + 1;
      if ((p.sortOrder ?? 0) !== nextOrder) {
        onUpdatePath(p.id, { sortOrder: nextOrder });
      }
    });
  };

  const selectedPath = useMemo(
    () => paths.find((p) => p.id === selectedPathId) ?? null,
    [paths, selectedPathId]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    onAddPath({
      title: cleanTitle,
      description: description.trim(),
      hubId,
      categoryLabel: categoryLabel.trim(),
      objectives: objectives.trim(),
      currentLevel: currentLevel.trim(),
      targetLevel: targetLevel.trim(),
      startDate,
      expectedCompletionDate: expectedDate,
      progressPct: 0,
      status: 'planned',
      stages: [],
      linkedCourseIds: [],
      readingModes: [],
      learningMethods: [],
      reviewCount: 0,
      listenCount: 0,
    });

    setTitle('');
    setCategoryLabel('');
    setDescription('');
    setObjectives('');
    setCurrentLevel('');
    setTargetLevel('');
    setStartDate('');
    setExpectedDate('');
    setShowAddForm(false);
  };

  const handleToggleStage = (path: LearningPath, stageId: string) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    if (onTogglePathStage) {
      onTogglePathStage(path.id, stageId);
      return;
    }
    const nextStages = path.stages.map((s) =>
      s.id === stageId ? { ...s, done: !s.done } : s
    );
    const doneCount = nextStages.filter((s) => s.done).length;
    const progressPct =
      nextStages.length > 0
        ? Math.round((doneCount / nextStages.length) * 100)
        : path.progressPct;
    const nextStatus: LearningPathStatus =
      nextStages.length > 0 && doneCount === nextStages.length
        ? 'completed'
        : doneCount > 0
        ? 'in_progress'
        : path.status;

    onUpdatePath(path.id, { stages: nextStages, progressPct, status: nextStatus });
  };

  const handleScheduleStageToCalendar = (
    path: LearningPath,
    stage: LearningPathStage
  ) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const canonicalKey = `path:${path.id}:${stage.id}`;
    const existing = unifiedTasks.find((ut) => ut.projectId === canonicalKey);
    const endTime = schedTime
      ? computeEndTimeFromMinutes(schedTime, schedDuration)
      : '';
    if (existing && onUpdateUnifiedTask) {
      onUpdateUnifiedTask(existing.id, {
        title: stage.title,
        scheduledDate: schedDate,
        dueDate: schedDate,
        startTime: schedTime,
        endTime,
        durationMinutes: schedDuration,
        priority: schedPriority,
        status: stage.done ? 'done' : existing.status,
      });
    } else if (onAddUnifiedTask) {
      onAddUnifiedTask({
        title: stage.title,
        description: `مرحلة من المسار التعليمي: ${path.title}`,
        hubId: path.hubId ?? 'knowledge',
        categoryLabel: 'مسار تعليمي',
        priority: schedPriority,
        status: stage.done ? 'done' : 'todo',
        dueDate: schedDate,
        scheduledDate: schedDate,
        startTime: schedTime,
        endTime,
        durationMinutes: schedDuration,
        projectId: canonicalKey,
        linkedLabel: path.title,
      });
    }
    setSchedStageId(null);
  };

  const handleAddGeneralPathTask = (e: React.FormEvent, path: LearningPath) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = newPathTaskTitle.trim();
    if (!clean || !onAddUnifiedTask) return;
    const endTime = newPathTaskTime
      ? computeEndTimeFromMinutes(newPathTaskTime, 60)
      : '';
    onAddUnifiedTask({
      title: clean,
      description: `مهمة مرتبطة بالمسار التعليمي: ${path.title}`,
      hubId: path.hubId ?? 'knowledge',
      categoryLabel: 'مسار تعليمي',
      priority: 'medium',
      status: 'todo',
      dueDate: newPathTaskDate,
      scheduledDate: newPathTaskDate,
      startTime: newPathTaskTime,
      endTime,
      durationMinutes: newPathTaskDate || newPathTaskTime ? 60 : 0,
      projectId: `path:${path.id}`,
      linkedLabel: path.title,
    });
    setNewPathTaskTitle('');
    setNewPathTaskDate('');
    setNewPathTaskTime('');
  };

  const handleAddStage = (e: React.FormEvent, path: LearningPath) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const t = newStageInput.trim();
    if (!t) return;
    const nextStage: LearningPathStage = {
      id: `stage-${Date.now()}`,
      title: t,
      done: false,
    };
    const nextStages = [...path.stages, nextStage];
    const doneCount = nextStages.filter((s) => s.done).length;
    const progressPct = Math.round((doneCount / nextStages.length) * 100);
    onUpdatePath(path.id, { stages: nextStages, progressPct });
    setNewStageInput('');
  };

  const handleMoveStage = (
    path: LearningPath,
    index: number,
    dir: -1 | 1
  ) => {
    if (!canEdit) return;
    const target = index + dir;
    if (target < 0 || target >= path.stages.length) return;
    const next = [...path.stages];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onUpdatePath(path.id, { stages: next });
  };

  const handleDeleteStage = (path: LearningPath, stageId: string) => {
    if (!canEdit) return;
    const nextStages = path.stages.filter((s) => s.id !== stageId);
    const doneCount = nextStages.filter((s) => s.done).length;
    const progressPct =
      nextStages.length > 0
        ? Math.round((doneCount / nextStages.length) * 100)
        : 0;
    onUpdatePath(path.id, { stages: nextStages, progressPct });
  };

  const handleToggleLinkedCourse = (path: LearningPath, courseId: number) => {
    if (!canEdit) return;
    const exists = path.linkedCourseIds.includes(courseId);
    const next = exists
      ? path.linkedCourseIds.filter((id) => id !== courseId)
      : [...path.linkedCourseIds, courseId];
    onUpdatePath(path.id, { linkedCourseIds: next });
  };

  // Dedicated Standalone Path Detail Page
  if (selectedPath) {
    const hubMeta = getHubMeta(selectedPath.hubId);
    const linkedCourses = courses.filter((c) =>
      selectedPath.linkedCourseIds.includes(c.id)
    );
    const linkedPathTasks = unifiedTasks.filter(
      (ut) =>
        ut.projectId === `path:${selectedPath.id}` ||
        ut.projectId?.startsWith(`path:${selectedPath.id}:`) ||
        (ut.linkedLabel &&
          ut.linkedLabel.trim().toLowerCase() ===
            selectedPath.title.trim().toLowerCase())
    );
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedPathId(null);
              setEditingPath(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>العودة إلى المسارات التعليمية</span>
          </button>

          {(canEdit || onTogglePinEntity) && (
            <div className="flex flex-wrap items-center gap-2">
              {onTogglePinEntity && (
                <PinEntityButton
                  entityType="path"
                  entityId={selectedPath.id}
                  collections={pinCollections}
                  canEdit={canEdit}
                  onToggleItemInCollection={onTogglePinEntity}
                  onQuickCreateCollection={onQuickCreatePinCollection}
                  size="sm"
                />
              )}
              {canEdit && (
                <>
              <button
                type="button"
                onClick={() =>
                  onUpdatePath(selectedPath.id, {
                    isPublic: !selectedPath.isPublic,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg border cursor-pointer ${
                  selectedPath.isPublic
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {selectedPath.isPublic ? (
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {selectedPath.isPublic ? 'منشور في الموقع العام' : 'مسار خاص'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEditingPath((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{editingPath ? 'إنهاء التعديل' : 'تعديل بيانات المسار'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeletePath(selectedPath)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حذف المسار</span>
              </button>
                </>
              )}
            </div>
          )}
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-2 max-w-3xl min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-2.5 py-0.5 font-semibold border rounded-md ${hubMeta.badgeClass}`}
                >
                  {hubMeta.title}
                </span>
                {selectedPath.categoryLabel && (
                  <span className="text-slate-600 font-medium">
                    · {selectedPath.categoryLabel}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                  {STATUS_LABELS[selectedPath.status]}
                </span>
              </div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                <BidiText text={selectedPath.title} />
              </h1>
              {selectedPath.description && (
                <BidiText
                  text={selectedPath.description}
                  as="div"
                  multiline
                  className="text-sm text-slate-600 leading-relaxed"
                />
              )}
              {selectedPath.objectives && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
                  <strong className="text-slate-900">أهداف التعلم:</strong>{' '}
                  <BidiText text={selectedPath.objectives} as="div" multiline />
                </div>
              )}
            </div>

            <div className="w-full md:w-56 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">التقدم العام</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {selectedPath.progressPct}%
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F] transition-all"
                  style={{ width: `${selectedPath.progressPct}%` }}
                />
              </div>
              {(selectedPath.currentLevel || selectedPath.targetLevel) && (
                <p className="text-[11px] text-slate-600">
                  {selectedPath.currentLevel || '—'} → {selectedPath.targetLevel || '—'}
                </p>
              )}
            </div>
          </div>

          <LearningObjectivesPanel
            objectives={selectedPath.learningObjectives}
            canEdit={canEdit}
            onChange={(next) =>
              onUpdatePath(selectedPath.id, { learningObjectives: next })
            }
          />

          {editingPath && canEdit && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs text-slate-700">
                عنوان المسار
                <input
                  type="text"
                  value={selectedPath.title}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, { title: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-xs text-slate-700">
                المحور الرئيسي (Hub)
                <select
                  value={selectedPath.hubId}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, {
                      hubId: e.target.value as LearningHubId,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  {LEARNING_HUBS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-700">
                التصنيف الفرعي (اختياري)
                <input
                  type="text"
                  list="edit-path-categories"
                  value={selectedPath.categoryLabel}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, {
                      categoryLabel: e.target.value,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
                <datalist id="edit-path-categories">
                  {(hubCategories[selectedPath.hubId] ?? []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block text-xs text-slate-700">
                الحالة
                <select
                  value={selectedPath.status}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, {
                      status: e.target.value as LearningPathStatus,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="planned">مخطط له</option>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="completed">مكتمل</option>
                </select>
              </label>
              <label className="block text-xs text-slate-700">
                المستوى الحالي (اختياري)
                <input
                  type="text"
                  value={selectedPath.currentLevel}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, { currentLevel: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-xs text-slate-700">
                المستوى المستهدف (اختياري)
                <input
                  type="text"
                  value={selectedPath.targetLevel}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, { targetLevel: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-xs text-slate-700 sm:col-span-2">
                أهداف التعلم (اختياري)
                <textarea
                  rows={2}
                  value={selectedPath.objectives}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, { objectives: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-xs text-slate-700 sm:col-span-2">
                وصف المسار (اختياري)
                <textarea
                  rows={2}
                  value={selectedPath.description}
                  onChange={(e) =>
                    onUpdatePath(selectedPath.id, { description: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </label>
            </div>
          )}

          {/* Milestones / Stages */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              مراحل وخطوات المسار ({selectedPath.stages.filter((s) => s.done).length} /{' '}
              {selectedPath.stages.length})
            </h2>
            {selectedPath.stages.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 border border-dashed border-slate-200 rounded-lg">
                لا توجد مراحل مضافة بعد. أضف أول مرحلة لتحويل المسار إلى خطوات واضحة.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-[320px] overflow-y-auto thin-scrollbar">
                {selectedPath.stages.map((stage, idx) => {
                  const canonicalKey = `path:${selectedPath.id}:${stage.id}`;
                  const linkedSched = unifiedTasks.find(
                    (ut) => ut.projectId === canonicalKey
                  );
                  const isSchedOpen = schedStageId === stage.id;
                  return (
                    <div key={stage.id} className="bg-white">
                      <div className="px-3.5 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="w-full flex-1 min-w-0 space-y-1.5">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => handleToggleStage(selectedPath, stage.id)}
                            className="flex items-start gap-2.5 text-right w-full cursor-pointer disabled:opacity-75"
                          >
                            {stage.done ? (
                              <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                            )}
                            <span
                              className={`text-sm leading-relaxed text-right break-words flex-1 min-w-0 ${
                                stage.done
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800'
                              }`}
                            >
                              {idx + 1}. {stage.title}
                            </span>
                          </button>

                          {linkedSched && (
                            <div className="flex flex-wrap items-center gap-1.5 pr-6 text-[10px] text-[#1E3A5F]">
                              {linkedSched.scheduledDate ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-semibold tabular-nums">
                                  <Calendar className="w-3 h-3" aria-hidden="true" />
                                  مجدولة: {linkedSched.scheduledDate}
                                  {linkedSched.startTime ? ` · ${linkedSched.startTime}` : ''}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 text-slate-600">
                                  في قائمة المهام
                                </span>
                              )}
                              {onOpenCalendar && (
                                <button
                                  type="button"
                                  onClick={onOpenCalendar}
                                  className="underline font-semibold cursor-pointer"
                                >
                                  عرض في التقويم
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0 shrink-0">
                            {(onAddUnifiedTask || onUpdateUnifiedTask) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSchedOpen) {
                                    setSchedStageId(null);
                                  } else {
                                    setSchedStageId(stage.id);
                                    setSchedDate(
                                      linkedSched?.scheduledDate || getTodayDateKey()
                                    );
                                    setSchedTime(linkedSched?.startTime || '09:00');
                                    setSchedDuration(linkedSched?.durationMinutes || 60);
                                    setSchedPriority(linkedSched?.priority || 'medium');
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-[11px] font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {isSchedOpen
                                    ? 'إغلاق'
                                    : linkedSched?.scheduledDate
                                    ? 'تعديل الجدول'
                                    : 'جدولة'}
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveStage(selectedPath, idx, -1)}
                              aria-label="تحريك لأعلى"
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === selectedPath.stages.length - 1}
                              onClick={() => handleMoveStage(selectedPath, idx, 1)}
                              aria-label="تحريك لأسفل"
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStage(selectedPath, stage.id)}
                              aria-label="حذف المرحلة"
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isSchedOpen && canEdit && (
                        <div className="px-4 pb-3 pt-2 bg-slate-50 border-t border-slate-100 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <label className="block text-slate-600">
                              التاريخ
                              <input
                                type="date"
                                value={schedDate}
                                onChange={(e) => setSchedDate(e.target.value)}
                                className="mt-0.5 w-full px-2 py-1 bg-white border border-slate-300 rounded"
                              />
                            </label>
                            <label className="block text-slate-600">
                              الوقت
                              <input
                                type="time"
                                value={schedTime}
                                onChange={(e) => setSchedTime(e.target.value)}
                                className="mt-0.5 w-full px-2 py-1 bg-white border border-slate-300 rounded"
                              />
                            </label>
                            <label className="block text-slate-600">
                              المدة (د)
                              <select
                                value={schedDuration}
                                onChange={(e) =>
                                  setSchedDuration(Number(e.target.value))
                                }
                                className="mt-0.5 w-full px-2 py-1 bg-white border border-slate-300 rounded"
                              >
                                {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                                  <option key={m} value={m}>
                                    {m} د
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-slate-600">
                              الأولوية
                              <select
                                value={schedPriority}
                                onChange={(e) =>
                                  setSchedPriority(e.target.value as TaskPriority)
                                }
                                className="mt-0.5 w-full px-2 py-1 bg-white border border-slate-300 rounded"
                              >
                                <option value="high">عالية</option>
                                <option value="medium">متوسطة</option>
                                <option value="low">منخفضة</option>
                              </select>
                            </label>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                handleScheduleStageToCalendar(selectedPath, stage)
                              }
                              className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded cursor-pointer"
                            >
                              حفظ في المهام والتقويم
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && (
              <form
                onSubmit={(e) => handleAddStage(e, selectedPath)}
                className="flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <input
                  type="text"
                  value={newStageInput}
                  onChange={(e) => setNewStageInput(e.target.value)}
                  placeholder="أضف مرحلة أو معلمًا جديدًا في المسار..."
                  className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة مرحلة</span>
                </button>
              </form>
            )}
          </div>

          {/* Unified Tasks & Calendar Schedule Linked to this Path */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>
                  المهام وجدول التقويم المرتبط بالمسار ({linkedPathTasks.length})
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {canEdit && onAddUnifiedTask && (
                  <button
                    type="button"
                    onClick={() =>
                      setTaskModalState({
                        open: true,
                        initialTask: null,
                        prefill: {
                          hubId: selectedPath.hubId,
                          linkedPathId: selectedPath.id,
                          linkedLabel: selectedPath.title,
                          projectId: `path:${selectedPath.id}`,
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>مهمة مفصلة / مجدولة</span>
                  </button>
                )}
                {onOpenTasks && (
                  <button
                    type="button"
                    onClick={onOpenTasks}
                    className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    كل المهام ←
                  </button>
                )}
                {onOpenCalendar && (
                  <button
                    type="button"
                    onClick={onOpenCalendar}
                    className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    تقويم الجدولة ←
                  </button>
                )}
              </div>
            </div>

            {linkedPathTasks.length === 0 ? (
              <p className="text-xs text-slate-500">
                لا توجد مهام مجدولة لهذا المسار بعد — أضف مهمة أدناه أو استخدم زر «جدولة» بجانب أي مرحلة.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-[320px] overflow-y-auto thin-scrollbar">
                {linkedPathTasks.map((ut) => {
                  const isDone = ut.status === 'done';
                  const recSummary = formatRecurrenceSummaryAr(ut.recurrence);
                  return (
                    <div
                      key={ut.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!canEdit || !onUpdateUnifiedTask) {
                          if (!canEdit) onRequireAuth();
                          return;
                        }
                        setTaskModalState({
                          open: true,
                          initialTask: ut,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!canEdit || !onUpdateUnifiedTask) {
                            if (!canEdit) onRequireAuth();
                            return;
                          }
                          setTaskModalState({
                            open: true,
                            initialTask: ut,
                          });
                        }
                      }}
                      className="px-3.5 py-2.5 bg-white hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A5F]"
                    >
                      <div className="flex items-start gap-2.5 text-right flex-1 min-w-0">
                        <button
                          type="button"
                          disabled={!canEdit || !onUpdateUnifiedTask}
                          aria-label={isDone ? 'إعادة المهمة لقيد التنفيذ' : 'تمييز المهمة كمكتملة'}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateUnifiedTask?.(ut.id, {
                              status: isDone ? 'todo' : 'done',
                            });
                          }}
                          className="mt-0.5 shrink-0 cursor-pointer disabled:opacity-60"
                        >
                          {isDone ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <span
                            className={`text-xs leading-relaxed break-words block ${
                              isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                            }`}
                          >
                            {ut.title}
                          </span>
                          {recSummary && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1E3A5F]">
                              <Repeat className="w-3 h-3" aria-hidden="true" />
                              <span>{recSummary}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 pr-6 sm:pr-0 shrink-0"
                      >
                        {(ut.scheduledDate || ut.dueDate) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#1E3A5F] font-medium tabular-nums">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            {ut.scheduledDate || ut.dueDate}
                            {ut.startTime ? ` · ${ut.startTime}` : ''}
                          </span>
                        )}
                        {canEdit && onUpdateUnifiedTask && (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskModalState({
                                open: true,
                                initialTask: ut,
                              })
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            تعديل
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && onAddUnifiedTask && (
              <form
                onSubmit={(e) => handleAddGeneralPathTask(e, selectedPath)}
                className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2"
              >
                <input
                  type="text"
                  value={newPathTaskTitle}
                  onChange={(e) => setNewPathTaskTitle(e.target.value)}
                  placeholder="أضف مهمة مرتبطة بهذا المسار وتظهر في المهام والتقويم..."
                  className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
                <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="date"
                    value={newPathTaskDate}
                    onChange={(e) => setNewPathTaskDate(e.target.value)}
                    title="تاريخ الجدولة (اختياري)"
                    className="w-full sm:w-auto min-w-0 px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="time"
                    value={newPathTaskTime}
                    onChange={(e) => setNewPathTaskTime(e.target.value)}
                    title="الوقت (اختياري)"
                    className="w-full sm:w-auto min-w-0 px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ربط مهمة</span>
                </button>
              </form>
            )}
          </div>

          {/* Linked Courses */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              الكورسات المرتبطة بهذا المسار
            </h2>
            {linkedCourses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {linkedCourses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenCourse(c.id)}
                    className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    فتح كورس: {c.title} ←
                  </button>
                ))}
              </div>
            )}
            {canEdit && courses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {courses.map((c) => {
                  const linked = selectedPath.linkedCourseIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleToggleLinkedCourse(selectedPath, c.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                        linked
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {linked ? '✓ ' : '+ '}
                      {c.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <SpacedRepetitionPanel
            canEdit={canEdit}
            value={selectedPath}
            onChange={(updates) => onUpdatePath(selectedPath.id, updates)}
            title="أساليب التعلم وأنماط القراءة لهذا المسار"
            customReadingModes={customReadingModes}
            onUpdateReadingModes={onUpdateReadingModes}
          />
        </section>

        <ConfirmDialog
          open={Boolean(confirmDeletePath)}
          title="تأكيد حذف المسار التعليمي"
          message={`هل تريد حذف المسار «${confirmDeletePath?.title ?? ''}»؟`}
          onConfirm={() => {
            if (confirmDeletePath) {
              onDeletePath(confirmDeletePath.id);
              setConfirmDeletePath(null);
              setSelectedPathId(null);
            }
          }}
          onCancel={() => setConfirmDeletePath(null)}
        />

        <TaskFormModal
          open={taskModalState.open}
          onClose={() => setTaskModalState({ open: false, initialTask: null })}
          initialTask={taskModalState.initialTask}
          prefill={taskModalState.prefill}
          courses={courses}
          learningPaths={paths}
          readingItems={readingItems}
          projects={projects}
          hubCategories={hubCategories}
          onSubmit={(payload, existingId) => {
            if (existingId && onUpdateUnifiedTask) {
              onUpdateUnifiedTask(existingId, payload);
            } else if (onAddUnifiedTask) {
              onAddUnifiedTask(payload);
            }
          }}
          onDelete={onDeleteUnifiedTask}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            رحلة الإتقان التدريجية · {paths.length} مسارات تعليمية
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            المسارات التعليمية (Learning Paths)
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            نظّم مساراتك في الماركتينج والأعمال، والدنتال والكارير، والثقافة والمعرفة، وربط كل مسار بالكورسات والمراحل العملية.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!canEdit) {
              onRequireAuth();
              return;
            }
            setShowAddForm((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showAddForm ? 'إلغاء' : 'إنشاء مسار تعليمي جديد'}</span>
        </button>
      </div>

      {/* Hub Filter Tabs + Sort Control */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeHubFilter('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
              activeHubFilter === 'all'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            جميع المجالات ({paths.length})
          </button>
          {LEARNING_HUBS.map((h) => {
            const count = paths.filter((p) => p.hubId === h.id).length;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onChangeHubFilter(h.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                  activeHubFilter === h.id
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {h.title} ({count})
              </button>
            );
          })}
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>الترتيب:</span>
          <select
            value={sortMode}
            onChange={(e) =>
              setSortMode(e.target.value as 'manual' | 'progress' | 'title')
            }
            className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
          >
            <option value="manual">يدوي (الترتيب الشخصي)</option>
            <option value="progress">نسبة التقدم</option>
            <option value="title">أبجدي / رقمي</option>
          </select>
        </label>
      </div>

      {onSelectFocusPinCollection && onSavePinCollection && onDeletePinCollection && (
        <PinCollectionsBar
          collections={pinCollections}
          activeCollectionId={activeFocusPinCollectionId}
          onSelectCollection={onSelectFocusPinCollection}
          canEdit={canEdit}
          onSaveCollection={onSavePinCollection}
          onDeleteCollection={onDeletePinCollection}
          filterEntityType="path"
          compact
        />
      )}

      {showAddForm && canEdit && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            مسار تعليمي جديد
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-slate-700">
              عنوان المسار (مطلوب)
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: إتقان إعلانات ميتا وبناء الحملات"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              المحور الكبير (Hub)
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value as LearningHubId)}
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
              التصنيف الفرعي (اختياري)
              <input
                type="text"
                list="new-path-cats"
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                placeholder="اختر أو اكتب تصنيفًا..."
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
              <datalist id="new-path-cats">
                {(hubCategories[hubId] ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-700">
                المستوى الحالي (اختياري)
                <input
                  type="text"
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  placeholder="مبتدئ"
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                المستهدف (اختياري)
                <input
                  type="text"
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  placeholder="متقدم"
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-700">
              تاريخ البدء (اختياري)
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              الإنجاز المتوقع (اختياري)
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-700">
            أهداف التعلم (اختياري)
            <textarea
              rows={2}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="ما النتائج الملموسة التي تريد الوصول إليها؟"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            وصف المسار (اختياري)
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ملاحظات عامة حول المسار..."
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
            >
              حفظ المسار
            </button>
          </div>
        </form>
      )}

      {filteredPaths.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <Compass className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            لا توجد مسارات تعليمية في هذا المجال بعد
          </p>
          <p className="text-xs text-slate-500">
            اضغط «إنشاء مسار تعليمي جديد» لبناء خطة متدرجة بمراحل وكورسات مرتبطة.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-5 ${
            filteredPaths.length === 1
              ? 'grid-cols-1 max-w-2xl'
              : filteredPaths.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {filteredPaths.map((path, pathIdx) => {
            const hubMeta = getHubMeta(path.hubId);
            return (
              <article
                key={path.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPathId(path.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPathId(path.id);
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-[#1E3A5F]/50 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold border rounded-md ${hubMeta.badgeClass}`}
                    >
                      {hubMeta.shortTitle}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      {path.isPublic && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px]">
                          <Globe className="w-2.5 h-2.5" aria-hidden="true" />
                          عام
                        </span>
                      )}
                      <span>{STATUS_LABELS[path.status]}</span>
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F] transition-colors">
                    <BidiText text={path.title} />
                  </h2>

                  {path.categoryLabel && (
                    <p className="text-[11px] text-slate-500">{path.categoryLabel}</p>
                  )}

                  {path.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      <BidiText text={path.description} />
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 tabular-nums">
                      <span>التقدم ({path.stages.length} مرحلة)</span>
                      <span className="font-bold text-slate-900">
                        {path.progressPct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A5F]"
                        style={{ width: `${path.progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#1E3A5F] group-hover:underline">
                      فتح المسار والمراحل ←
                    </span>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1"
                    >
                      {onTogglePinEntity && (
                        <PinEntityButton
                          entityType="path"
                          entityId={path.id}
                          collections={pinCollections}
                          canEdit={canEdit}
                          onToggleItemInCollection={onTogglePinEntity}
                          onQuickCreateCollection={onQuickCreatePinCollection}
                        />
                      )}
                      {canEdit && (
                        <>
                          {sortMode === 'manual' && (
                            <>
                              <button
                                type="button"
                                disabled={pathIdx === 0}
                                onClick={() => handleMovePathOrder(path.id, -1)}
                                aria-label="تقديم المسار"
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                disabled={pathIdx === filteredPaths.length - 1}
                                onClick={() => handleMovePathOrder(path.id, 1)}
                                aria-label="تأخير المسار"
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePath(path)}
                            aria-label={`حذف ${path.title}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeletePath)}
        title="تأكيد حذف المسار التعليمي"
        message={`هل تريد حذف المسار «${confirmDeletePath?.title ?? ''}»؟`}
        onConfirm={() => {
          if (confirmDeletePath) {
            onDeletePath(confirmDeletePath.id);
            setConfirmDeletePath(null);
          }
        }}
        onCancel={() => setConfirmDeletePath(null)}
      />
    </div>
  );
}
