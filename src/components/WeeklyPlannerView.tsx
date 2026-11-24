import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  Link2,
  PauseCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  LEARNING_HUBS,
  LearningHubId,
  LearningHubMeta,
  PersonalCourse,
  UnifiedTask,
  UnifiedTaskStatus,
  WeeklyPlanGoal,
  WeeklyPlanRecord,
  formatShortArabicDate,
  getDayArabicName,
  getSatFriWeekRange,
  shiftWeekKey,
} from '../data/curriculumData';
import {
  getCarriedOverIncompleteTasks,
  getDefaultPlanningWeekStartKey,
} from '../utils/journalAnalytics';
import AutoResizeTextarea from './AutoResizeTextarea';

interface WeeklyPlannerViewProps {
  unifiedTasks: UnifiedTask[];
  courses: PersonalCourse[];
  weeklyPlans: WeeklyPlanRecord[];
  hubs?: LearningHubMeta[];
  canEdit: boolean;
  onRequireAuth: () => void;
  onSaveWeeklyPlan: (plan: WeeklyPlanRecord) => void;
  onUpdateUnifiedTask: (id: string, updates: Partial<UnifiedTask>) => void;
  onAddUnifiedTask: (task: Omit<UnifiedTask, 'id'>) => string;
  onOpenTaskModal?: (task: UnifiedTask) => void;
}

function statusBadge(st: UnifiedTaskStatus): { label: string; cls: string } {
  switch (st) {
    case 'done':
      return { label: 'مكتملة', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'in_progress':
      return { label: 'قيد التنفيذ', cls: 'bg-sky-50 text-sky-900 border-sky-200' };
    case 'postponed':
      return { label: 'مؤجّلة', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    default:
      return { label: 'قيد الانتظار', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export default function WeeklyPlannerView({
  unifiedTasks,
  courses,
  weeklyPlans,
  hubs = LEARNING_HUBS,
  canEdit,
  onRequireAuth,
  onSaveWeeklyPlan,
  onUpdateUnifiedTask,
  onAddUnifiedTask,
  onOpenTaskModal,
}: WeeklyPlannerViewProps) {
  const today = new Date();
  const isFriday = today.getDay() === 5;
  const currentWeek = getSatFriWeekRange(today);
  const nextWeekStart = shiftWeekKey(currentWeek.startKey, 1);

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() =>
    getDefaultPlanningWeekStartKey(today)
  );
  const weekRange = useMemo(
    () => getSatFriWeekRange(selectedWeekStart),
    [selectedWeekStart]
  );

  const existingPlan = useMemo(
    () => weeklyPlans.find((p) => p.weekKey === weekRange.weekKey),
    [weeklyPlans, weekRange.weekKey]
  );

  const [focusHubIds, setFocusHubIds] = useState<LearningHubId[]>([]);
  const [focusCourseIds, setFocusCourseIds] = useState<number[]>([]);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [goals, setGoals] = useState<WeeklyPlanGoal[]>([]);
  const [notes, setNotes] = useState('');
  const [newGoalText, setNewGoalText] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskHub, setNewTaskHub] = useState<LearningHubId>(hubs[0]?.id ?? 'knowledge');
  const [newTaskDay, setNewTaskDay] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  // Also include tasks already scheduled within [weekRange.startKey, weekRange.endKey]
  const tasksInWeekSet = useMemo(() => {
    const ids = new Set<string>(linkedTaskIds);
    for (const t of unifiedTasks) {
      const d = t.scheduledDate || t.dueDate || '';
      if (d >= weekRange.startKey && d <= weekRange.endKey) {
        ids.add(t.id);
      }
    }
    return ids;
  }, [linkedTaskIds, unifiedTasks, weekRange.startKey, weekRange.endKey]);

  useEffect(() => {
    if (existingPlan) {
      setFocusHubIds(existingPlan.focusHubIds);
      setFocusCourseIds(existingPlan.focusCourseIds);
      setLinkedTaskIds(existingPlan.linkedTaskIds);
      setGoals(existingPlan.goals);
      setNotes(existingPlan.notes);
    } else {
      const autoLinked = unifiedTasks
        .filter((t) => {
          const d = t.scheduledDate || t.dueDate || '';
          return d >= weekRange.startKey && d <= weekRange.endKey;
        })
        .map((t) => t.id);
      setFocusHubIds([]);
      setFocusCourseIds(
        courses.filter((c) => c.studyStage === 'focus_now').map((c) => c.id)
      );
      setLinkedTaskIds(autoLinked);
      setGoals([]);
      setNotes('');
    }
  }, [weekRange.weekKey, existingPlan]);

  const weekTasks = useMemo(
    () => unifiedTasks.filter((t) => tasksInWeekSet.has(t.id)),
    [unifiedTasks, tasksInWeekSet]
  );

  const carriedOverCandidates = useMemo(
    () =>
      getCarriedOverIncompleteTasks(weekRange.startKey, unifiedTasks).filter(
        (t) => !tasksInWeekSet.has(t.id)
      ),
    [weekRange.startKey, unifiedTasks, tasksInWeekSet]
  );

  const unlinkedPool = useMemo(
    () =>
      unifiedTasks.filter(
        (t) => t.status !== 'done' && !tasksInWeekSet.has(t.id)
      ),
    [unifiedTasks, tasksInWeekSet]
  );

  const persistPlan = (overrides?: Partial<WeeklyPlanRecord>, message = 'تم حفظ خطة الأسبوع') => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const now = Date.now();
    const mergedTaskIds = Array.from(
      new Set([...(overrides?.linkedTaskIds ?? Array.from(tasksInWeekSet))])
    );
    const plan: WeeklyPlanRecord = {
      weekKey: weekRange.weekKey,
      weekStartKey: weekRange.startKey,
      weekEndKey: weekRange.endKey,
      focusHubIds: overrides?.focusHubIds ?? focusHubIds,
      focusCourseIds: overrides?.focusCourseIds ?? focusCourseIds,
      linkedTaskIds: mergedTaskIds,
      goals: overrides?.goals ?? goals,
      notes: overrides?.notes ?? notes,
      plannedAtMs: existingPlan?.plannedAtMs || now,
      updatedAtMs: now,
    };
    onSaveWeeklyPlan(plan);
    setSavedNotice(message);
    window.setTimeout(() => setSavedNotice(null), 2400);
  };

  const handleLinkExistingTask = (task: UnifiedTask, targetDayKey = '') => {
    if (!canEdit) return onRequireAuth();
    const nextLinked = Array.from(new Set([...Array.from(tasksInWeekSet), task.id]));
    setLinkedTaskIds(nextLinked);
    if (targetDayKey || task.status === 'postponed') {
      onUpdateUnifiedTask(task.id, {
        ...(targetDayKey ? { scheduledDate: targetDayKey, dueDate: targetDayKey } : {}),
        ...(task.status === 'postponed' ? { status: 'todo' } : {}),
      });
    }
    persistPlan({ linkedTaskIds: nextLinked }, 'تم ربط المهمة بالأسبوع');
  };

  const handleCarryOverAll = () => {
    if (!canEdit) return onRequireAuth();
    if (carriedOverCandidates.length === 0) return;
    const ids = carriedOverCandidates.map((t) => t.id);
    const nextLinked = Array.from(new Set([...Array.from(tasksInWeekSet), ...ids]));
    setLinkedTaskIds(nextLinked);
    for (const t of carriedOverCandidates) {
      // Unschedule old past date into weekly pool (user can assign day cleanly) and reset postponed -> todo
      onUpdateUnifiedTask(t.id, {
        scheduledDate: '',
        dueDate: '',
        ...(t.status === 'postponed' ? { status: 'todo' } : {}),
      });
    }
    persistPlan(
      { linkedTaskIds: nextLinked },
      `تم ترحيل ${carriedOverCandidates.length} مهام غير مكتملة إلى خطة الأسبوع`
    );
  };

  const handleCreateWeeklyTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return onRequireAuth();
    const clean = newTaskTitle.trim();
    if (!clean) return;
    const newId = onAddUnifiedTask({
      title: clean,
      description: '',
      hubId: newTaskHub,
      categoryLabel: 'مخططة أسبوعيًا',
      priority: 'medium',
      status: 'todo',
      dueDate: newTaskDay,
      scheduledDate: newTaskDay,
    });
    if (newId) {
      const nextLinked = Array.from(new Set([...Array.from(tasksInWeekSet), newId]));
      setLinkedTaskIds(nextLinked);
      persistPlan({ linkedTaskIds: nextLinked }, 'أُضيفت المهمة وربطت بالأسبوع');
    }
    setNewTaskTitle('');
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGoalText.trim();
    if (!clean) return;
    const nextGoals: WeeklyPlanGoal[] = [
      ...goals,
      { id: `wgoal_${Date.now()}`, text: clean, done: false },
    ];
    setGoals(nextGoals);
    setNewGoalText('');
    persistPlan({ goals: nextGoals });
  };

  const handleMoveTaskDay = (task: UnifiedTask, targetDayKey: string) => {
    if (!canEdit) return onRequireAuth();
    onUpdateUnifiedTask(task.id, {
      scheduledDate: targetDayKey,
      dueDate: targetDayKey,
    });
  };

  const handleUnlinkTaskFromWeek = (task: UnifiedTask) => {
    if (!canEdit) return onRequireAuth();
    const nextLinked = linkedTaskIds.filter((id) => id !== task.id);
    setLinkedTaskIds(nextLinked);
    const d = task.scheduledDate || task.dueDate || '';
    if (d >= weekRange.startKey && d <= weekRange.endKey) {
      onUpdateUnifiedTask(task.id, { scheduledDate: '', dueDate: '' });
    }
    persistPlan({ linkedTaskIds: nextLinked }, 'أُزيلت المهمة من جدول الأسبوع (بقيت في قائمة المهام)');
  };

  return (
    <div className="space-y-6">
      {/* Friday Prompt + Week Selector */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        {isFriday && (
          <div className="p-3.5 rounded-xl bg-[#F0F4F9] border border-[#1E3A5F]/20 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1E3A5F]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="font-bold">
                اليوم الجمعة — الوقت المقترح لتخطيط الأسبوع القادم (السبت ← الجمعة) ومراجعة ما أُنجز.
              </span>
            </div>
            {weekRange.weekKey !== nextWeekStart && (
              <button
                type="button"
                onClick={() => setSelectedWeekStart(nextWeekStart)}
                className="px-3 py-1 bg-[#1E3A5F] text-white font-semibold rounded-lg cursor-pointer"
              >
                انتقل للأسبوع القادم
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                تخطيط الأسبوع (السبت ← الجمعة)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              اربط المهام الموجودة أو أنشئ مهام جديدة ووزّعها على أيام الأسبوع بدون أي تكرار، ليتم قياس الخطة مقابل التنفيذ الفعلي في المراجعة الأسبوعية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedWeekStart(shiftWeekKey(weekRange.startKey, -1))}
              className="p-2 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              aria-label="الأسبوع السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="px-3 py-2 bg-[#F7F8FA] border border-slate-200 rounded-xl text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <span className="font-bold text-slate-900 tabular-nums">
                {formatShortArabicDate(weekRange.startKey)} ← {formatShortArabicDate(weekRange.endKey)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedWeekStart(shiftWeekKey(weekRange.startKey, 1))}
              className="p-2 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              aria-label="الأسبوع التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedWeekStart(currentWeek.startKey)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                weekRange.weekKey === currentWeek.startKey
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              الأسبوع الحالي
            </button>

            <button
              type="button"
              onClick={() => setSelectedWeekStart(nextWeekStart)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                weekRange.weekKey === nextWeekStart
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              الأسبوع القادم
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {carriedOverCandidates.length > 0 && (
              <button
                type="button"
                onClick={handleCarryOverAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  ترحيل {carriedOverCandidates.length} مهام غير مكتملة / مؤجّلة
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLinkPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F7F8FA] hover:bg-slate-100 text-[#1E3A5F] border border-slate-200 rounded-xl cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ربط مهام موجودة ({unlinkedPool.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="text-xs font-semibold text-emerald-700">
                {savedNotice}
              </span>
            )}
            <button
              type="button"
              onClick={() => persistPlan()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حفظ خطة الأسبوع</span>
            </button>
          </div>
        </div>

        {/* Link existing task drawer */}
        {linkPickerOpen && (
          <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">
                اختر مهام حالية لربطها بخطة هذا الأسبوع (بدون تكرار)
              </h3>
              <button
                type="button"
                onClick={() => setLinkPickerOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            {unlinkedPool.length === 0 ? (
              <p className="text-xs text-slate-500">
                كل مهامك النشطة مرتبطة بالفعل بهذا الأسبوع أو مكتملة.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto thin-scrollbar">
                {unlinkedPool.map((t) => {
                  const badge = statusBadge(t.status);
                  return (
                    <div
                      key={t.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{t.title}</p>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLinkExistingTask(t)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-[#1E3A5F] text-white rounded-lg shrink-0 cursor-pointer"
                      >
                        ربط
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Focus Tracks, Focus Courses & Weekly Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Focus Tracks & Courses */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">المسارات المركّز عليها</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hubs.map((h) => {
                const selected = focusHubIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      const next = selected
                        ? focusHubIds.filter((id) => id !== h.id)
                        : [...focusHubIds, h.id];
                      setFocusHubIds(next);
                      persistPlan({ focusHubIds: next });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      selected
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {h.shortTitle}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">كورسات تركيز الأسبوع</h2>
            </div>
            <div className="max-h-[180px] overflow-y-auto thin-scrollbar space-y-1.5 pl-1">
              {courses
                .filter((c) => c.studyStage !== 'completed')
                .map((c) => {
                  const selected = focusCourseIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? focusCourseIds.filter((id) => id !== c.id)
                          : [...focusCourseIds, c.id];
                        setFocusCourseIds(next);
                        persistPlan({ focusCourseIds: next });
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs border text-right cursor-pointer ${
                        selected
                          ? 'bg-[#F0F4F9] text-[#1E3A5F] border-[#1E3A5F]/40 font-semibold'
                          : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{c.title}</span>
                      <span className="tabular-nums text-[11px] shrink-0">
                        {c.progressPct}%
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </section>

        {/* Weekly Goals & Plan Notes */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              الأهداف والأولويات الأساسية للأسبوع
            </h2>
            <form onSubmit={handleAddGoal} className="flex gap-2">
              <input
                type="text"
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                placeholder="أضف هدفًا محوريًا للأسبوع (مثلاً: إنهاء 3 دروس تسويق)..."
                className="flex-1 px-3 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة هدف</span>
              </button>
            </form>

            {goals.length > 0 && (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto thin-scrollbar pl-1">
                {goals.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F7F8FA] border border-slate-200 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = goals.map((item) =>
                          item.id === g.id ? { ...item, done: !item.done } : item
                        );
                        setGoals(next);
                        persistPlan({ goals: next });
                      }}
                      className="flex items-center gap-2 text-right flex-1 min-w-0 cursor-pointer"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          g.done ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span
                        className={`truncate ${
                          g.done ? 'line-through text-slate-400' : 'text-slate-900 font-medium'
                        }`}
                      >
                        {g.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = goals.filter((item) => item.id !== g.id);
                        setGoals(next);
                        persistPlan({ goals: next });
                      }}
                      className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                      aria-label="حذف الهدف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 block">
              ملاحظات وتوجيهات للأسبوع
            </label>
            <AutoResizeTextarea
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي قيود زمنية أو التزامات خاصة هذا الأسبوع..."
              className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </section>
      </div>

      {/* Quick Add Task into Week + 7-Day Sat-Fri Grid + Unscheduled Pool */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            توزيع مهام الأسبوع ({weekTasks.length})
          </h2>
          <span className="text-[11px] text-slate-500">
            يمكنك نقل أي مهمة بين أيام السبت–الجمعة أو إرجاعها لقائمة الأسبوع غير المحددة بيوم
          </span>
        </div>

        <form
          onSubmit={handleCreateWeeklyTask}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-[#F7F8FA] border border-slate-200"
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="أضف مهمة جديدة مرتبطة بهذا الأسبوع مباشرة..."
            className="sm:col-span-5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
          />
          <select
            value={newTaskHub}
            onChange={(e) => setNewTaskHub(e.target.value)}
            className="sm:col-span-3 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
          >
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.shortTitle}
              </option>
            ))}
          </select>
          <select
            value={newTaskDay}
            onChange={(e) => setNewTaskDay(e.target.value)}
            className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
          >
            <option value="">غير محددة بيوم</option>
            {weekRange.days.map((dk) => (
              <option key={dk} value={dk}>
                {getDayArabicName(dk)} ({dk.slice(5)})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>إضافة</span>
          </button>
        </form>

        {/* Sat -> Fri 7 Days + Weekly Pool */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {weekRange.days.map((dk) => {
            const dayTasks = weekTasks.filter(
              (t) => (t.scheduledDate || t.dueDate || '') === dk
            );
            return (
              <div
                key={dk}
                className="rounded-xl bg-[#F7F8FA] border border-slate-200 p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {getDayArabicName(dk)}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">{dk}</p>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded-md text-slate-700 tabular-nums">
                    {dayTasks.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto thin-scrollbar">
                  {dayTasks.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-3 text-center">
                      لا توجد مهام مجدولة
                    </p>
                  ) : (
                    dayTasks.map((t) => {
                      const badge = statusBadge(t.status);
                      return (
                        <div
                          key={t.id}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenTaskModal?.(t)}
                              className={`text-right font-semibold hover:text-[#1E3A5F] cursor-pointer line-clamp-2 ${
                                t.status === 'done'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {t.title}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateUnifiedTask(t.id, {
                                  status: t.status === 'done' ? 'todo' : 'done',
                                })
                              }
                              aria-label="تبديل الإنجاز"
                              className="p-0.5 cursor-pointer shrink-0"
                            >
                              <CheckCircle2
                                className={`w-4 h-4 ${
                                  t.status === 'done'
                                    ? 'text-emerald-600'
                                    : 'text-slate-300 hover:text-emerald-600'
                                }`}
                              />
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] rounded border ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <select
                                value={dk}
                                onChange={(e) => handleMoveTaskDay(t, e.target.value)}
                                aria-label="نقل المهمة ليوم آخر"
                                className="text-[10px] bg-[#F7F8FA] border border-slate-200 rounded px-1 py-0.5 text-slate-600"
                              >
                                <option value="">غير مجدول</option>
                                {weekRange.days.map((dOpt) => (
                                  <option key={dOpt} value={dOpt}>
                                    {getDayArabicName(dOpt)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleUnlinkTaskFromWeek(t)}
                                title="إزالة من خطة الأسبوع"
                                className="p-0.5 text-slate-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* 8th Box: Unscheduled Pool inside this Weekly Plan */}
          {(() => {
            const unscheduledInWeek = weekTasks.filter((t) => {
              const d = t.scheduledDate || t.dueDate || '';
              return !d || d < weekRange.startKey || d > weekRange.endKey;
            });
            return (
              <div className="rounded-xl bg-[#F0F4F9] border border-[#1E3A5F]/20 p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#1E3A5F]/15">
                  <div>
                    <p className="text-xs font-bold text-[#1E3A5F]">
                      سلة الأسبوع (غير محددة بيوم)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      مهام مرنة خلال الأسبوع
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded-md text-[#1E3A5F] tabular-nums">
                    {unscheduledInWeek.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-[240px] overflow-y-auto thin-scrollbar">
                  {unscheduledInWeek.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-3 text-center">
                      لا توجد مهام مرنة غير محددة بيوم.
                    </p>
                  ) : (
                    unscheduledInWeek.map((t) => {
                      const badge = statusBadge(t.status);
                      return (
                        <div
                          key={t.id}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="font-semibold text-slate-900 line-clamp-2">
                              {t.title}
                            </span>
                            {t.status === 'postponed' && (
                              <PauseCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] rounded border ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                            <select
                              value=""
                              onChange={(e) => handleMoveTaskDay(t, e.target.value)}
                              aria-label="تحديد يوم للمهمة"
                              className="text-[10px] bg-[#F7F8FA] border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                            >
                              <option value="">اختر يومًا...</option>
                              {weekRange.days.map((dOpt) => (
                                <option key={dOpt} value={dOpt}>
                                  {getDayArabicName(dOpt)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </section>
    </div>
  );
}
