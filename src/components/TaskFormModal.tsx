import { useEffect, useState } from 'react';
import { Calendar, Clock, Trash2, X } from 'lucide-react';
import {
  DEFAULT_HUB_CATEGORIES,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  PersonalCourse,
  PracticalProject,
  ReadingLibraryItem,
  TaskPriority,
  UnifiedTask,
  UnifiedTaskStatus,
  computeEndTimeFromMinutes,
} from '../data/curriculumData';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  initialTask?: UnifiedTask | null;
  prefill?: Partial<UnifiedTask>;
  courses: PersonalCourse[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  projects: PracticalProject[];
  hubCategories?: Record<LearningHubId, string[]>;
  onSubmit: (payload: Omit<UnifiedTask, 'id'>, existingId?: string) => void;
  onDelete?: (taskId: string) => void;
}

export default function TaskFormModal({
  open,
  onClose,
  initialTask,
  prefill,
  courses,
  learningPaths,
  readingItems,
  projects,
  hubCategories = DEFAULT_HUB_CATEGORIES,
  onSubmit,
  onDelete,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hubId, setHubId] = useState<LearningHubId>('knowledge');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<UnifiedTaskStatus>('todo');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [deadline, setDeadline] = useState('');
  const [linkedCourseId, setLinkedCourseId] = useState<string>('');
  const [linkedPathId, setLinkedPathId] = useState<string>('');
  const [linkedBookId, setLinkedBookId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const src = initialTask ?? prefill ?? {};
    setTitle(src.title ?? '');
    setDescription(src.description ?? '');
    const nextHub = (src.hubId as LearningHubId) || 'knowledge';
    setHubId(nextHub);
    setCategoryLabel(src.categoryLabel ?? '');
    setPriority((src.priority as TaskPriority) || 'medium');
    setStatus((src.status as UnifiedTaskStatus) || 'todo');
    setScheduledDate(src.scheduledDate ?? src.dueDate ?? '');
    setStartTime(src.startTime || '09:00');
    setDurationMinutes(src.durationMinutes ?? 45);
    setDeadline(src.deadline ?? '');
    setLinkedCourseId(
      src.linkedCourseId ? String(src.linkedCourseId) : ''
    );
    setLinkedPathId(src.linkedPathId ?? '');
    setLinkedBookId(src.linkedBookId ?? '');
    setProjectId(src.projectId ?? '');
  }, [open, initialTask, prefill]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const availableCategories = hubCategories[hubId] ?? [];

  const handleCourseChange = (val: string) => {
    setLinkedCourseId(val);
    if (val) {
      const c = courses.find((item) => item.id === Number(val));
      if (c) {
        setHubId(c.hubId || 'knowledge');
        if (!categoryLabel && c.category) setCategoryLabel(c.category);
      }
    }
  };

  const handlePathChange = (val: string) => {
    setLinkedPathId(val);
    if (val) {
      const p = learningPaths.find((item) => item.id === val);
      if (p) {
        setHubId(p.hubId);
        if (!categoryLabel && p.categoryLabel) setCategoryLabel(p.categoryLabel);
      }
    }
  };

  const handleBookChange = (val: string) => {
    setLinkedBookId(val);
    if (val) {
      const b = readingItems.find((item) => item.id === val);
      if (b) {
        setHubId(b.hubId);
        if (!categoryLabel && b.categoryLabel) setCategoryLabel(b.categoryLabel);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const courseNum = linkedCourseId ? Number(linkedCourseId) : undefined;
    const linkedCourse = courseNum
      ? courses.find((c) => c.id === courseNum)
      : undefined;
    const linkedPath = linkedPathId
      ? learningPaths.find((p) => p.id === linkedPathId)
      : undefined;
    const linkedBook = linkedBookId
      ? readingItems.find((b) => b.id === linkedBookId)
      : undefined;
    const linkedProject = projectId
      ? projects.find((pr) => pr.id === projectId)
      : undefined;

    const linkedLabel =
      linkedCourse?.title ||
      linkedPath?.title ||
      linkedBook?.title ||
      linkedProject?.title ||
      initialTask?.linkedLabel ||
      prefill?.linkedLabel ||
      '';

    const cleanSched = scheduledDate.trim();
    const cleanStart = cleanSched ? startTime.trim() || '09:00' : '';
    const cleanDuration = cleanSched ? Math.max(15, durationMinutes || 45) : undefined;
    const cleanEnd =
      cleanSched && cleanStart && cleanDuration
        ? computeEndTimeFromMinutes(cleanStart, cleanDuration)
        : '';

    onSubmit(
      {
        title: cleanTitle,
        description: description.trim(),
        hubId,
        categoryLabel: categoryLabel.trim() || availableCategories[0] || '',
        priority,
        status,
        dueDate: cleanSched,
        scheduledDate: cleanSched,
        startTime: cleanStart,
        endTime: cleanEnd,
        durationMinutes: cleanDuration,
        deadline: deadline.trim(),
        projectId: projectId.trim(),
        linkedLabel,
        linkedCourseId: courseNum,
        linkedPathId: linkedPathId.trim() || undefined,
        linkedBookId: linkedBookId.trim() || undefined,
      },
      initialTask?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initialTask ? 'تعديل مهمة' : 'إضافة مهمة جديدة'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-base font-bold text-slate-900">
            {initialTask ? 'تعديل وجدولة المهمة' : 'إنشاء مهمة مرتبطة أو مجدولة'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              عنوان المهمة *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مراجعة الفصل الثاني وتلخيص النقاط التطبيقية"
              className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              وصف أو خطوات التنفيذ
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل اختيارية أو مخرجات متوقعة..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
            />
          </div>

          {/* Hub, Category, Priority, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                المحور
              </label>
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value as LearningHubId)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {LEARNING_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                التصنيف الفرعي
              </label>
              <input
                type="text"
                list="task-modal-categories"
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                placeholder="اختياري..."
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <datalist id="task-modal-categories">
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                الأولوية
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                الحالة
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UnifiedTaskStatus)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="todo">للتنفيذ</option>
                <option value="in_progress">قيد العمل</option>
                <option value="postponed">مؤجّلة</option>
                <option value="done">منجزة</option>
              </select>
            </div>
          </div>

          {/* Entity Links */}
          <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-3">
            <p className="text-xs font-bold text-slate-800">
              الربط بسياق التعلّم (اختياري)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  ربط بكورس
                </label>
                <select
                  value={linkedCourseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">بدون ربط بكورس</option>
                  {courses.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  ربط بمسار تعلّم
                </label>
                <select
                  value={linkedPathId}
                  onChange={(e) => handlePathChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">بدون ربط بمسار</option>
                  {learningPaths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  ربط بكتاب / مصدر قراءة
                </label>
                <select
                  value={linkedBookId}
                  onChange={(e) => handleBookChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">بدون ربط بكتاب</option>
                  {readingItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  ربط بمشروع عملي
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">بدون ربط بمشروع</option>
                  {projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Calendar Scheduling */}
          <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>الجدولة في التقويم (أو اتركها غير مجدولة)</span>
              </p>
              {scheduledDate && (
                <button
                  type="button"
                  onClick={() => setScheduledDate('')}
                  className="text-[11px] font-medium text-amber-800 hover:underline cursor-pointer"
                >
                  إلغاء الجدولة الزمنية
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  تاريخ التنفيذ
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  وقت البداية
                </label>
                <div className="relative flex items-center">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
                  <input
                    type="time"
                    value={startTime}
                    disabled={!scheduledDate}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pr-8 pl-2 py-2 text-xs bg-white border border-slate-300 rounded-lg disabled:opacity-50 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  المدة (دقيقة)
                </label>
                <input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  disabled={!scheduledDate}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(15, Number(e.target.value) || 45))
                  }
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg disabled:opacity-50 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  الموعد النهائي (اختياري)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              {initialTask && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialTask.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حذف المهمة</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-45 rounded-lg cursor-pointer"
              >
                {initialTask ? 'حفظ التعديلات' : 'إضافة المهمة'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
