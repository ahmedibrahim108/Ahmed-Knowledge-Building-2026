import { useEffect, useState } from 'react';
import { Calendar, Clock, Mic, MicOff, Repeat, Trash2, X } from 'lucide-react';
import {
  DEFAULT_HUB_CATEGORIES,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  PersonalCourse,
  PracticalProject,
  ReadingLibraryItem,
  TaskPriority,
  TaskRecurrenceFrequency,
  TaskRecurrenceRule,
  UnifiedTask,
  UnifiedTaskStatus,
  computeEndTimeFromMinutes,
  getTodayDateKey,
} from '../data/curriculumData';
import {
  WEEKDAY_LABELS_AR,
  formatRecurrenceSummaryAr,
  normalizeRecurrenceRule,
} from '../utils/taskRecurrence';
import { useSpeechDictation } from '../hooks/useSpeechDictation';

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

  // Recurrence state
  const [recurrenceFreq, setRecurrenceFreq] =
    useState<TaskRecurrenceFrequency>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string>('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [recurrencePaused, setRecurrencePaused] = useState<boolean>(false);

  const titleMic = useSpeechDictation({
    onTranscriptSegment: (seg) =>
      setTitle((prev) => (prev.trim() ? `${prev.trim()} ${seg}` : seg)),
  });

  const descMic = useSpeechDictation({
    onTranscriptSegment: (seg) =>
      setDescription((prev) => (prev.trim() ? `${prev.trim()} ${seg}` : seg)),
  });

  useEffect(() => {
    if (!open) {
      titleMic.stop();
      descMic.stop();
      return;
    }
    const src = initialTask ?? prefill ?? {};
    setTitle(src.title ?? '');
    setDescription(src.description ?? '');
    const nextHub = (src.hubId as LearningHubId) || 'knowledge';
    setHubId(nextHub);
    setCategoryLabel(src.categoryLabel ?? '');
    setPriority((src.priority as TaskPriority) || 'medium');
    setStatus((src.status as UnifiedTaskStatus) || 'todo');
    const sched = src.scheduledDate ?? src.dueDate ?? '';
    setScheduledDate(sched);
    setStartTime(src.startTime || '09:00');
    setDurationMinutes(src.durationMinutes ?? 45);
    setDeadline(src.deadline ?? '');
    setLinkedCourseId(
      src.linkedCourseId ? String(src.linkedCourseId) : ''
    );
    setLinkedPathId(src.linkedPathId ?? '');
    setLinkedBookId(src.linkedBookId ?? '');
    setProjectId(src.projectId ?? '');

    const rule = normalizeRecurrenceRule(src.recurrence);
    if (rule) {
      setRecurrenceFreq(rule.frequency);
      setRecurrenceInterval(
        rule.intervalDays ?? (rule.frequency === 'custom' ? 2 : 1)
      );
      setRecurrenceWeekdays(rule.weekdays ?? []);
      setRecurrenceStartDate(rule.startDate ?? sched ?? '');
      setRecurrenceEndDate(rule.endDate ?? '');
      setRecurrencePaused(Boolean(rule.paused));
    } else {
      setRecurrenceFreq('none');
      setRecurrenceInterval(1);
      setRecurrenceWeekdays([]);
      setRecurrenceStartDate('');
      setRecurrenceEndDate('');
      setRecurrencePaused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleToggleWeekday = (dayVal: number) => {
    setRecurrenceWeekdays((prev) =>
      prev.includes(dayVal)
        ? prev.filter((d) => d !== dayVal)
        : [...prev, dayVal]
    );
  };

  const draftRecurrenceRule: TaskRecurrenceRule | undefined =
    recurrenceFreq === 'none'
      ? undefined
      : normalizeRecurrenceRule({
          frequency: recurrenceFreq,
          intervalDays: Math.max(1, recurrenceInterval || 1),
          weekdays:
            recurrenceFreq === 'weekly' && recurrenceWeekdays.length > 0
              ? recurrenceWeekdays
              : undefined,
          startDate:
            recurrenceStartDate.trim() ||
            scheduledDate.trim() ||
            getTodayDateKey(),
          endDate: recurrenceEndDate.trim() || undefined,
          paused: recurrencePaused || undefined,
        });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    titleMic.stop();
    descMic.stop();

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

    const cleanSched =
      scheduledDate.trim() ||
      (draftRecurrenceRule?.startDate ? draftRecurrenceRule.startDate : '');
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
        recurrence: draftRecurrenceRule,
        completedOccurrenceDates: initialTask?.completedOccurrenceDates,
      },
      initialTask?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initialTask ? 'تعديل مهمة' : 'إضافة مهمة جديدة'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
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

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                عنوان المهمة *
              </label>
              {titleMic.isSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (descMic.isListening) descMic.stop();
                    titleMic.toggle();
                  }}
                  aria-label={titleMic.isListening ? 'إيقاف الإملاء الصوتي للعنوان' : 'إملاء العنوان بالصوت'}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer ${
                    titleMic.isListening
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-[#1E3A5F]'
                  }`}
                >
                  {titleMic.isListening ? (
                    <>
                      <MicOff className="w-3 h-3" aria-hidden="true" />
                      <span>إيقاف الإملاء</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3" aria-hidden="true" />
                      <span>إملاء صوتي</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مراجعة الفصل الثاني وتلخيص النقاط التطبيقية"
              className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
              autoFocus
            />
            {titleMic.isListening && titleMic.interimText && (
              <p className="text-[11px] text-[#1E3A5F] bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                جاري الاستماع: {titleMic.interimText}
              </p>
            )}
            {titleMic.error && (
              <p className="text-[11px] text-rose-700">{titleMic.error}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                وصف أو خطوات التنفيذ
              </label>
              {descMic.isSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (titleMic.isListening) titleMic.stop();
                    descMic.toggle();
                  }}
                  aria-label={descMic.isListening ? 'إيقاف الإملاء الصوتي للوصف' : 'إملاء الوصف بالصوت'}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer ${
                    descMic.isListening
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-[#1E3A5F]'
                  }`}
                >
                  {descMic.isListening ? (
                    <>
                      <MicOff className="w-3 h-3" aria-hidden="true" />
                      <span>إيقاف الإملاء</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3" aria-hidden="true" />
                      <span>إملاء صوتي</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل اختيارية أو مخرجات متوقعة..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
            />
            {descMic.isListening && descMic.interimText && (
              <p className="text-[11px] text-[#1E3A5F] bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                جاري الاستماع: {descMic.interimText}
              </p>
            )}
            {descMic.error && (
              <p className="text-[11px] text-rose-700">{descMic.error}</p>
            )}
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

          {/* Unified Recurrence Controls */}
          <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Repeat className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>التكرار الذكي للمهمة</span>
              </p>
              {draftRecurrenceRule && (
                <span className="text-[11px] font-semibold text-[#1E3A5F]">
                  {formatRecurrenceSummaryAr(draftRecurrenceRule)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  نمط التكرار
                </label>
                <select
                  value={recurrenceFreq}
                  onChange={(e) => {
                    const nextFreq = e.target.value as TaskRecurrenceFrequency;
                    setRecurrenceFreq(nextFreq);
                    if (nextFreq === 'custom' && recurrenceInterval < 2) {
                      setRecurrenceInterval(2);
                    } else if (nextFreq !== 'custom' && recurrenceInterval < 1) {
                      setRecurrenceInterval(1);
                    }
                    if (
                      nextFreq !== 'none' &&
                      !recurrenceStartDate &&
                      scheduledDate
                    ) {
                      setRecurrenceStartDate(scheduledDate);
                    }
                  }}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="none">بدون تكرار (مرة واحدة)</option>
                  <option value="daily">يوميًا</option>
                  <option value="weekly">أسبوعيًا (أيام محددة)</option>
                  <option value="monthly">شهريًا</option>
                  <option value="custom">مخصص (كل N يوم)</option>
                </select>
              </div>

              {recurrenceFreq !== 'none' && (
                <>
                  {(recurrenceFreq === 'custom' ||
                    recurrenceFreq === 'daily' ||
                    recurrenceFreq === 'weekly') && (
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        {recurrenceFreq === 'weekly'
                          ? 'كل كم أسبوع'
                          : 'كل كم يوم'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={recurrenceInterval}
                        onChange={(e) =>
                          setRecurrenceInterval(
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      تاريخ بداية التكرار
                    </label>
                    <input
                      type="date"
                      value={recurrenceStartDate || scheduledDate}
                      onChange={(e) => setRecurrenceStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      تاريخ الانتهاء (اختياري)
                    </label>
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                </>
              )}
            </div>

            {recurrenceFreq === 'weekly' && (
              <div className="space-y-1.5">
                <span className="block text-[11px] text-slate-600">
                  اختر أيام الأسبوع للتكرار:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS_AR.map((wd) => {
                    const active = recurrenceWeekdays.includes(wd.value);
                    return (
                      <button
                        key={wd.value}
                        type="button"
                        onClick={() => handleToggleWeekday(wd.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {wd.full}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {recurrenceFreq !== 'none' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recurrencePaused}
                    onChange={(e) => setRecurrencePaused(e.target.checked)}
                    className="rounded border-slate-300 accent-[#1E3A5F]"
                  />
                  <span>إيقاف التكرار مؤقتًا دون حذفه</span>
                </label>
                {scheduledDate && (
                  <span className="text-[11px] text-slate-500">
                    سيظهر التكرار تلقائيًا في التقويم واليوميات
                  </span>
                )}
              </div>
            )}
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
