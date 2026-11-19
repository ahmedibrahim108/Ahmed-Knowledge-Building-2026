import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckSquare,
  Compass,
  Edit3,
  Plus,
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
  getHubMeta,
} from '../data/curriculumData';
import ConfirmDialog from './ConfirmDialog';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';

interface PathsViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  paths: LearningPath[];
  courses: PersonalCourse[];
  hubCategories: Record<LearningHubId, string[]>;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  onAddPath: (
    payload: Omit<LearningPath, 'id'>
  ) => void;
  onUpdatePath: (id: string, updates: Partial<LearningPath>) => void;
  onDeletePath: (id: string) => void;
  onOpenCourse: (courseId: number) => void;
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
  hubCategories,
  activeHubFilter,
  onChangeHubFilter,
  onAddPath,
  onUpdatePath,
  onDeletePath,
  onOpenCourse,
}: PathsViewProps) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [confirmDeletePath, setConfirmDeletePath] = useState<LearningPath | null>(null);

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

  const filteredPaths = useMemo(() => {
    if (activeHubFilter === 'all') return paths;
    return paths.filter((p) => p.hubId === activeHubFilter);
  }, [paths, activeHubFilter]);

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

          {canEdit && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-2 max-w-3xl">
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
                {selectedPath.title}
              </h1>
              {selectedPath.description && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {selectedPath.description}
                </p>
              )}
              {selectedPath.objectives && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  <strong className="text-slate-900">أهداف التعلم:</strong>{' '}
                  {selectedPath.objectives}
                </div>
              )}
            </div>

            <div className="min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shrink-0">
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
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {selectedPath.stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 bg-white"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleToggleStage(selectedPath, stage.id)}
                      className="flex items-center gap-2.5 text-right flex-1 cursor-pointer disabled:opacity-75"
                    >
                      {stage.done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      )}
                      <span
                        className={`text-sm ${
                          stage.done
                            ? 'line-through text-slate-400'
                            : 'text-slate-800'
                        }`}
                      >
                        {idx + 1}. {stage.title}
                      </span>
                    </button>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStage(selectedPath, idx, -1)}
                          aria-label="تحريك لأعلى"
                          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedPath.stages.length - 1}
                          onClick={() => handleMoveStage(selectedPath, idx, 1)}
                          aria-label="تحريك لأسفل"
                          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(selectedPath, stage.id)}
                          aria-label="حذف المرحلة"
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <form
                onSubmit={(e) => handleAddStage(e, selectedPath)}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newStageInput}
                  onChange={(e) => setNewStageInput(e.target.value)}
                  placeholder="أضف مرحلة أو معلمًا جديدًا في المسار..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة مرحلة</span>
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

      {/* Hub Filter Tabs */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPaths.map((path) => {
            const hubMeta = getHubMeta(path.hubId);
            return (
              <article
                key={path.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold border rounded-md ${hubMeta.badgeClass}`}
                    >
                      {hubMeta.shortTitle}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {STATUS_LABELS[path.status]}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedPathId(path.id)}
                    className="text-right block w-full cursor-pointer group"
                  >
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F] transition-colors">
                      {path.title}
                    </h2>
                  </button>

                  {path.categoryLabel && (
                    <p className="text-[11px] text-slate-500">{path.categoryLabel}</p>
                  )}

                  {path.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {path.description}
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
                    <button
                      type="button"
                      onClick={() => setSelectedPathId(path.id)}
                      className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      فتح المسار والمراحل ←
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePath(path)}
                        aria-label={`حذف ${path.title}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
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
