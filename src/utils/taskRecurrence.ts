import type {
  TaskRecurrenceFrequency,
  TaskRecurrenceRule,
  UnifiedTask,
} from '../data/curriculumData';

export const WEEKDAY_LABELS_AR: Array<{ value: number; short: string; full: string }> = [
  { value: 6, short: 'س', full: 'السبت' },
  { value: 0, short: 'ح', full: 'الأحد' },
  { value: 1, short: 'ن', full: 'الاثنين' },
  { value: 2, short: 'ث', full: 'الثلاثاء' },
  { value: 3, short: 'ر', full: 'الأربعاء' },
  { value: 4, short: 'خ', full: 'الخميس' },
  { value: 5, short: 'ج', full: 'الجمعة' },
];

export function parseDateKeyToUtcMs(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatUtcMsToDateKey(utcMs: number): string {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekdayFromDateKey(dateKey: string): number {
  const ms = parseDateKeyToUtcMs(dateKey);
  if (ms === null) return 0;
  return new Date(ms).getUTCDay();
}

export function normalizeRecurrenceRule(
  raw: unknown
): TaskRecurrenceRule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<TaskRecurrenceRule>;
  const validFreq: TaskRecurrenceFrequency[] = [
    'none',
    'daily',
    'weekly',
    'monthly',
    'custom',
  ];
  const frequency: TaskRecurrenceFrequency = validFreq.includes(
    r.frequency as TaskRecurrenceFrequency
  )
    ? (r.frequency as TaskRecurrenceFrequency)
    : 'none';
  if (frequency === 'none') return undefined;

  const intervalDays =
    typeof r.intervalDays === 'number' && Number.isFinite(r.intervalDays)
      ? Math.max(1, Math.min(365, Math.round(r.intervalDays)))
      : frequency === 'custom'
      ? 2
      : 1;

  const weekdays = Array.isArray(r.weekdays)
    ? Array.from(
        new Set(
          r.weekdays
            .map((w) => Number(w))
            .filter((w) => Number.isInteger(w) && w >= 0 && w <= 6)
        )
      )
    : undefined;

  const startDate =
    typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)
      ? r.startDate
      : undefined;
  const endDate =
    typeof r.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate)
      ? r.endDate
      : undefined;

  return {
    frequency,
    intervalDays,
    ...(weekdays && weekdays.length > 0 ? { weekdays } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(r.paused ? { paused: true } : {}),
  };
}

export function isRecurringTask(
  task: Pick<UnifiedTask, 'recurrence'>
): boolean {
  return Boolean(
    task.recurrence &&
      task.recurrence.frequency !== 'none' &&
      !task.recurrence.paused
  );
}

export function getTaskRecurrenceStartDate(
  task: Pick<UnifiedTask, 'recurrence' | 'scheduledDate' | 'dueDate'>
): string {
  const rule = task.recurrence;
  if (rule?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(rule.startDate)) {
    return rule.startDate;
  }
  if (task.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate)) {
    return task.scheduledDate;
  }
  if (task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    return task.dueDate;
  }
  return '';
}

export function doesTaskOccurOnDate(
  task: Pick<UnifiedTask, 'recurrence' | 'scheduledDate' | 'dueDate'>,
  dateKey: string
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const baseDate = task.scheduledDate || task.dueDate || '';
  const rule = normalizeRecurrenceRule(task.recurrence);

  if (!rule || rule.frequency === 'none' || rule.paused) {
    return baseDate === dateKey;
  }

  const startKey = getTaskRecurrenceStartDate(task) || dateKey;
  if (dateKey < startKey) return false;
  if (rule.endDate && dateKey > rule.endDate) return false;

  const targetMs = parseDateKeyToUtcMs(dateKey);
  const startMs = parseDateKeyToUtcMs(startKey);
  if (targetMs === null || startMs === null) return false;

  const diffDays = Math.round((targetMs - startMs) / 86400000);
  if (diffDays < 0) return false;

  if (rule.frequency === 'daily') {
    const step = Math.max(1, rule.intervalDays || 1);
    return diffDays % step === 0;
  }

  if (rule.frequency === 'weekly') {
    const weekday = getWeekdayFromDateKey(dateKey);
    const allowedDays =
      rule.weekdays && rule.weekdays.length > 0
        ? rule.weekdays
        : [getWeekdayFromDateKey(startKey)];
    if (!allowedDays.includes(weekday)) return false;
    const weekInterval = Math.max(1, rule.intervalDays || 1);
    if (weekInterval === 1) return true;
    const startWeekday = getWeekdayFromDateKey(startKey);
    const weekStartAnchor = startMs - startWeekday * 86400000;
    const targetWeekAnchor = targetMs - weekday * 86400000;
    const weeksDiff = Math.round((targetWeekAnchor - weekStartAnchor) / (7 * 86400000));
    return weeksDiff >= 0 && weeksDiff % weekInterval === 0;
  }

  if (rule.frequency === 'monthly') {
    const startDay = Number(startKey.slice(8, 10));
    const targetDay = Number(dateKey.slice(8, 10));
    if (startDay === targetDay) return true;
    // Handle end-of-month clamping (e.g. 31st in 30-day month)
    const [ty, tm] = dateKey.split('-').map(Number);
    const lastDayOfTargetMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    return startDay > lastDayOfTargetMonth && targetDay === lastDayOfTargetMonth;
  }

  if (rule.frequency === 'custom') {
    const step = Math.max(1, rule.intervalDays || 2);
    return diffDays % step === 0;
  }

  return baseDate === dateKey;
}

export function expandTaskOccurrenceDates(
  task: Pick<UnifiedTask, 'recurrence' | 'scheduledDate' | 'dueDate'>,
  rangeStartKey: string,
  rangeEndKey: string
): string[] {
  const startMs = parseDateKeyToUtcMs(rangeStartKey);
  const endMs = parseDateKeyToUtcMs(rangeEndKey);
  if (startMs === null || endMs === null || endMs < startMs) return [];

  const rule = normalizeRecurrenceRule(task.recurrence);
  if (!rule || rule.frequency === 'none' || rule.paused) {
    const single = task.scheduledDate || task.dueDate || '';
    if (single && single >= rangeStartKey && single <= rangeEndKey) {
      return [single];
    }
    return [];
  }

  const dates: string[] = [];
  const maxDays = 400; // safety guard
  let count = 0;
  for (let ms = startMs; ms <= endMs && count < maxDays; ms += 86400000) {
    count += 1;
    const key = formatUtcMsToDateKey(ms);
    if (doesTaskOccurOnDate(task, key)) {
      dates.push(key);
    }
  }
  return dates;
}

export function isTaskCompletedOnDate(
  task: Pick<UnifiedTask, 'status' | 'recurrence' | 'completedOccurrenceDates'>,
  dateKey?: string
): boolean {
  const rule = normalizeRecurrenceRule(task.recurrence);
  if (!rule || rule.frequency === 'none') {
    return task.status === 'done';
  }
  if (!dateKey) {
    return task.status === 'done';
  }
  return Array.isArray(task.completedOccurrenceDates)
    ? task.completedOccurrenceDates.includes(dateKey)
    : false;
}

export function toggleTaskOccurrenceForDate(
  task: UnifiedTask,
  dateKey: string
): Partial<UnifiedTask> {
  const rule = normalizeRecurrenceRule(task.recurrence);
  if (!rule || rule.frequency === 'none') {
    return {
      status: task.status === 'done' ? 'todo' : 'done',
    };
  }
  const existing = Array.isArray(task.completedOccurrenceDates)
    ? task.completedOccurrenceDates
    : [];
  const isDone = existing.includes(dateKey);
  const nextDates = isDone
    ? existing.filter((d) => d !== dateKey)
    : [...existing, dateKey].slice(-180);
  return {
    completedOccurrenceDates: nextDates,
  };
}

export function formatRecurrenceSummaryAr(
  rawRule?: TaskRecurrenceRule
): string {
  const rule = normalizeRecurrenceRule(rawRule);
  if (!rule || rule.frequency === 'none') return '';
  if (rule.paused) return 'تكرار متوقف مؤقتًا';

  if (rule.frequency === 'daily') {
    const step = rule.intervalDays || 1;
    return step === 1 ? 'يوميًا' : `كل ${step} أيام`;
  }
  if (rule.frequency === 'weekly') {
    if (rule.weekdays && rule.weekdays.length > 0) {
      const names = WEEKDAY_LABELS_AR.filter((d) =>
        rule.weekdays!.includes(d.value)
      ).map((d) => d.full);
      return `أسبوعيًا (${names.join('، ')})`;
    }
    return 'أسبوعيًا';
  }
  if (rule.frequency === 'monthly') {
    return 'شهريًا';
  }
  if (rule.frequency === 'custom') {
    const step = rule.intervalDays || 2;
    return `كل ${step} يوم`;
  }
  return '';
}
