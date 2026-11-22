import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  GripVertical,
  LayoutGrid,
  Link2,
  ListTodo,
  Lock,
  Plus,
  Repeat,
  Save,
  Settings2,
  Square,
  Trash2,
  Unlink,
  Users,
  X,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import {
  CalendarCategory,
  CalendarColor,
  CalendarEvent,
  CalendarPreferences,
  CalendarViewMode,
  DEFAULT_CALENDAR_PREFERENCES,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthPlan,
  PersonalCourse,
  PracticalProject,
  TaskPriority,
  UnifiedTask,
  UnifiedTaskStatus,
  UserPreferences,
  WeekStartDay,
  WeeklyMeeting,
  WeeklyMeetingOccurrence,
  computeEndTimeFromMinutes,
  expandWeeklyMeetingsInRange,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';

interface CalendarViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  events: CalendarEvent[];
  months: MonthPlan[];
  courses: PersonalCourse[];
  learningPaths?: LearningPath[];
  unifiedTasks: UnifiedTask[];
  projects: PracticalProject[];
  weeklyMeetings: WeeklyMeeting[];
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onAddEvent: (payload: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent: (id: string) => void;
  onAddUnifiedTask: (payload: Omit<UnifiedTask, 'id'>) => void;
  onUpdateUnifiedTask: (id: string, updates: Partial<UnifiedTask>) => void;
  onDeleteUnifiedTask: (id: string) => void;
  onUpdateWeeklyMeeting?: (id: string, updates: Partial<WeeklyMeeting>) => void;
  onToggleCourseTask?: (courseId: number, taskId: string) => void;
  onTogglePathStage?: (pathId: string, stageId: string) => void;
  onToggleMonthTask?: (monthId: number, taskId: string) => void;
  onJumpToMonth: (monthId: number) => void;
  onOpenMeetingsSection?: () => void;
}

type UnifiedCalendarItem =
  | {
      kind: 'task';
      uid: string;
      id: string;
      dateKey: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      title: string;
      done: boolean;
      overdue: boolean;
      priority: TaskPriority;
      hubId: LearningHubId;
      categoryLabel: string;
      deadline?: string;
      raw: UnifiedTask;
    }
  | {
      kind: 'event';
      uid: string;
      id: string;
      dateKey: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      title: string;
      done: boolean;
      overdue: boolean;
      color: CalendarColor;
      categoryLabel: string;
      raw: CalendarEvent;
    }
  | {
      kind: 'meeting';
      uid: string;
      id: string;
      occurrenceKey: string;
      dateKey: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      title: string;
      done: boolean;
      overdue: boolean;
      color: CalendarColor;
      hubId: LearningHubId;
      raw: WeeklyMeetingOccurrence;
    };

type DragPayload =
  | { kind: 'task'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'meeting'; meetingId: string; occurrenceKey: string }
  | {
      kind: 'plan_task';
      text: string;
      sourceLabel: string;
      categoryLabel: string;
      canonicalProjectId: string;
      hubId: LearningHubId;
    };

const WEEKDAY_NAMES_BY_JS_DAY = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const FULL_HOURS_START_OPTIONS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const FULL_HOURS_END_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1); // 1..24

const CATEGORIES: CalendarCategory[] = [
  'شخصي',
  'موعد',
  'دراسة',
  'مراجعة',
  'قراءة',
];

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; badge: string; border: string }
> = {
  high: {
    label: 'عالية',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    border: 'border-r-rose-600',
  },
  medium: {
    label: 'متوسطة',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    border: 'border-r-amber-500',
  },
  low: {
    label: 'منخفضة',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    border: 'border-r-slate-400',
  },
};

const COLOR_STYLES: Record<
  CalendarColor,
  { label: string; dot: string; chip: string; border: string }
> = {
  navy: {
    label: 'كحلي',
    dot: 'bg-[#1E3A5F]',
    chip: 'bg-slate-100 text-[#1E3A5F] border-slate-300',
    border: 'border-r-[#1E3A5F]',
  },
  emerald: {
    label: 'أخضر',
    dot: 'bg-emerald-600',
    chip: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    border: 'border-r-emerald-600',
  },
  amber: {
    label: 'ذهبي',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    border: 'border-r-amber-500',
  },
  rose: {
    label: 'قرمزي',
    dot: 'bg-rose-600',
    chip: 'bg-rose-50 text-rose-900 border-rose-200',
    border: 'border-r-rose-600',
  },
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

function addDays(dateKey: string, delta: number): string {
  const dt = parseDateKey(dateKey);
  dt.setDate(dt.getDate() + delta);
  return toDateKey(dt);
}

function parseMinutesFromTime(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function formatHourLabel(hour: number): string {
  if (hour === 24) return '12:00 ص';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'ص' : 'م';
  return `${h12}:00 ${suffix}`;
}

function formatHourOptionLabel(hour: number): string {
  if (hour === 0) return '12:00 ص (00:00)';
  if (hour === 24) return '12:00 ص نهاية اليوم (24:00)';
  return `${formatHourLabel(hour)} (${String(hour).padStart(2, '0')}:00)`;
}

function formatArabicMonthYear(d: Date): string {
  try {
    return d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  } catch {
    return `${d.getMonth() + 1}/${d.getFullYear()}`;
  }
}

function formatArabicMonthOnly(year: number, monthIndex: number): string {
  try {
    return new Date(year, monthIndex, 1).toLocaleDateString('ar-EG', {
      month: 'long',
    });
  } catch {
    return `${monthIndex + 1}`;
  }
}

function formatArabicFullDate(dateKey: string): string {
  try {
    return parseDateKey(dateKey).toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateKey;
  }
}

function formatArabicShortDay(d: Date): string {
  try {
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  } catch {
    return toDateKey(d);
  }
}

function isWeekendDay(jsDay: number, weekStartDay: WeekStartDay): boolean {
  if (weekStartDay === 1) {
    // Monday-start: Sat (6) & Sun (0) are weekends
    return jsDay === 6 || jsDay === 0;
  }
  // Sat-start or Sun-start: Fri (5) & Sat (6) are regional weekend
  return jsDay === 5 || jsDay === 6;
}

export default function CalendarView({
  uid,
  canEdit,
  onRequireAuth,
  events,
  months,
  courses,
  learningPaths = [],
  unifiedTasks,
  projects,
  weeklyMeetings,
  preferences,
  onUpdatePreferences,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onDeleteUnifiedTask,
  onUpdateWeeklyMeeting,
  onToggleCourseTask,
  onTogglePathStage,
  onToggleMonthTask,
  onOpenMeetingsSection,
}: CalendarViewProps) {
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const calViewStorageKey = `mizan_cal_view_${uid || 'guest'}`;
  const calPrefsStorageKey = `mizan_cal_prefs_${uid || 'guest'}`;

  const savedCalPrefs: CalendarPreferences = useMemo(
    () => ({
      ...DEFAULT_CALENDAR_PREFERENCES,
      ...(preferences.calendarPrefs || {}),
    }),
    [preferences.calendarPrefs]
  );

  const readStoredViewMode = (): CalendarViewMode | null => {
    try {
      const v = localStorage.getItem(calViewStorageKey);
      if (v === 'day' || v === 'week' || v === 'month' || v === 'year') {
        return v;
      }
    } catch {
      // Ignore storage access restrictions
    }
    return null;
  };

  const readStoredCalPrefs = (): CalendarPreferences | null => {
    try {
      const raw = localStorage.getItem(calPrefsStorageKey);
      if (!raw) return null;
      return {
        ...DEFAULT_CALENDAR_PREFERENCES,
        ...(JSON.parse(raw) as Partial<CalendarPreferences>),
      };
    } catch {
      return null;
    }
  };

  // Dedicated independent viewMode state so remote snapshot rollbacks (or older Firestore rules)
  // can NEVER snap the calendar back to Day/Today after clicking Week, Month, or Year.
  const [viewMode, setViewMode] = useState<CalendarViewMode>(
    () => readStoredViewMode() ?? savedCalPrefs.defaultView ?? 'month'
  );
  const [localPrefs, setLocalPrefs] = useState<CalendarPreferences>(
    () => readStoredCalPrefs() ?? savedCalPrefs
  );
  const userTouchedViewRef = useRef(false);
  const hydratedPrefsUidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (hydratedPrefsUidRef.current !== uid) {
      hydratedPrefsUidRef.current = uid;
      userTouchedViewRef.current = false;
      const storedV = readStoredViewMode();
      if (storedV) {
        setViewMode(storedV);
      } else if (preferences.calendarPrefs?.defaultView) {
        setViewMode(preferences.calendarPrefs.defaultView);
      }
      const storedP = readStoredCalPrefs();
      setLocalPrefs(storedP ? { ...savedCalPrefs, ...storedP } : savedCalPrefs);
      return;
    }
    if (!userTouchedViewRef.current && preferences.calendarPrefs) {
      const storedP = readStoredCalPrefs();
      if (!storedP) {
        setLocalPrefs(savedCalPrefs);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, preferences.calendarPrefs]);

  const updateCalendarPref = <K extends keyof CalendarPreferences>(
    key: K,
    val: CalendarPreferences[K]
  ) => {
    userTouchedViewRef.current = true;
    const next = { ...localPrefs, [key]: val };
    setLocalPrefs(next);
    try {
      localStorage.setItem(calPrefsStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    if (canEdit) {
      onUpdatePreferences({ calendarPrefs: next });
    }
  };

  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const handleSelectViewMode = (nextView: CalendarViewMode) => {
    userTouchedViewRef.current = true;
    // When leaving day view for week/month/year, anchor cursorDate to selectedDateKey's period
    if (viewMode === 'day' && nextView !== 'day' && selectedDateKey) {
      setCursorDate(parseDateKey(selectedDateKey));
    }
    setViewMode(nextView);
    try {
      localStorage.setItem(calViewStorageKey, nextView);
    } catch {
      // ignore
    }
    updateCalendarPref('defaultView', nextView);
  };

  const density = localPrefs.density;
  const showCompleted = localPrefs.showCompleted;
  const showWeekends = localPrefs.showWeekends;
  const weekStartDay = localPrefs.weekStartDay;
  const filterHub = localPrefs.filterHub;
  const filterPriority = localPrefs.filterPriority;
  const filterStatus = localPrefs.filterStatus;

  const dayStartHour = Math.max(
    0,
    Math.min(23, Number(localPrefs.dayStartHour ?? 0))
  );
  const dayEndHour = Math.max(
    dayStartHour + 1,
    Math.min(24, Number(localPrefs.dayEndHour ?? 24))
  );
  const visibleHours = useMemo(
    () =>
      Array.from(
        { length: dayEndHour - dayStartHour },
        (_, i) => dayStartHour + i
      ),
    [dayStartHour, dayEndHour]
  );
  const gridStartMins = dayStartHour * 60;
  const gridEndMins = dayEndHour * 60;

  const updateDayTimeWindow = (nextStart: number, nextEnd: number) => {
    const safeStart = Math.max(0, Math.min(23, nextStart));
    const safeEnd = Math.max(safeStart + 1, Math.min(24, nextEnd));
    userTouchedViewRef.current = true;
    const next = {
      ...localPrefs,
      dayStartHour: safeStart,
      dayEndHour: safeEnd,
    };
    setLocalPrefs(next);
    try {
      localStorage.setItem(calPrefsStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    if (canEdit) {
      onUpdatePreferences({ calendarPrefs: next });
    }
  };

  const [mobilePane, setMobilePane] = useState<'calendar' | 'tasks'>('calendar');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Task Panel state
  const [taskSearch, setTaskSearch] = useState('');
  const [showPlanTasksDrawer, setShowPlanTasksDrawer] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] =
    useState<TaskPriority>('medium');
  const [quickScheduleTargetId, setQuickScheduleTargetId] = useState<
    string | null
  >(null);
  const [quickSchedDate, setQuickSchedDate] = useState(todayKey);
  const [quickSchedTime, setQuickSchedTime] = useState('09:00');
  const [quickSchedDuration, setQuickSchedDuration] = useState(60);

  // Drag & Drop Visual State
  const [draggingPayload, setDraggingPayload] = useState<DragPayload | null>(
    null
  );
  const [dropHighlightKey, setDropHighlightKey] = useState<string | null>(null);

  // Duration Pointer Resize State
  const [resizingState, setResizingState] = useState<{
    kind: 'task' | 'event';
    id: string;
    startY: number;
    origDuration: number;
    currentDuration: number;
  } | null>(null);
  const resizingRef = useRef(resizingState);
  resizingRef.current = resizingState;

  // Create Modal (Event or Scheduled Task)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'task' | 'event'>('task');
  const [createTitle, setCreateTitle] = useState('');
  const [createDateKey, setCreateDateKey] = useState(todayKey);
  const [createStartTime, setCreateStartTime] = useState('');
  const [createDuration, setCreateDuration] = useState(60);
  const [createDeadline, setCreateDeadline] = useState('');
  const [createHub, setCreateHub] = useState<LearningHubId>('marketing');
  const [createPriority, setCreatePriority] = useState<TaskPriority>('medium');
  const [createCategory, setCreateCategory] = useState<CalendarCategory>('شخصي');
  const [createColor, setCreateColor] = useState<CalendarColor>('navy');
  const [createNotes, setCreateNotes] = useState('');

  // Item Inspection / Edit Modal
  const [activeItem, setActiveItem] = useState<UnifiedCalendarItem | null>(
    null
  );
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editDeadline, setEditDeadline] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editStatus, setEditStatus] = useState<UnifiedTaskStatus>('todo');
  const [editHub, setEditHub] = useState<LearningHubId>('knowledge');
  const [editProjectId, setEditProjectId] = useState('');
  const [editCategory, setEditCategory] = useState<CalendarCategory>('شخصي');
  const [editColor, setEditColor] = useState<CalendarColor>('navy');
  const [editNotes, setEditNotes] = useState('');

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'task' | 'event';
    id: string;
    title: string;
  } | null>(null);

  const HOUR_HEIGHT = density === 'compact' ? 46 : 62;

  // Compute visible date range for meeting expansion
  const rangeBounds = useMemo(() => {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth();
    if (viewMode === 'year') {
      return { startKey: `${y}-01-01`, endKey: `${y}-12-31` };
    }
    if (viewMode === 'month') {
      const start = new Date(y, m, -7);
      const end = new Date(y, m + 1, 14);
      return { startKey: toDateKey(start), endKey: toDateKey(end) };
    }
    if (viewMode === 'day') {
      return { startKey: selectedDateKey, endKey: selectedDateKey };
    }
    // Week
    const startOffset = (cursorDate.getDay() - weekStartDay + 7) % 7;
    const weekStart = new Date(y, m, cursorDate.getDate() - startOffset);
    const weekEnd = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + 6
    );
    return { startKey: toDateKey(weekStart), endKey: toDateKey(weekEnd) };
  }, [cursorDate, viewMode, selectedDateKey, weekStartDay]);

  const expandedMeetings = useMemo(
    () =>
      expandWeeklyMeetingsInRange(
        weeklyMeetings,
        rangeBounds.startKey,
        rangeBounds.endKey
      ),
    [weeklyMeetings, rangeBounds.startKey, rangeBounds.endKey]
  );

  // Pending tasks from plan, courses, and learning paths (excluding ones already scheduled on Calendar)
  const pendingPlanTasks = useMemo(() => {
    const scheduledCanonicalIds = new Set(
      unifiedTasks
        .filter((t) => Boolean(t.scheduledDate) && Boolean(t.projectId))
        .map((t) => t.projectId!)
    );
    const list: Array<{
      id: string;
      sourceLabel: string;
      categoryLabel: string;
      text: string;
      canonicalProjectId: string;
      hubId: LearningHubId;
    }> = [];
    for (const c of courses) {
      for (const t of c.tasks) {
        const key = `course:${c.id}:${t.id}`;
        if (!t.done && !scheduledCanonicalIds.has(key)) {
          list.push({
            id: key,
            sourceLabel: c.title,
            categoryLabel: 'كورس',
            text: t.text,
            canonicalProjectId: key,
            hubId: c.hubId ?? 'knowledge',
          });
        }
      }
    }
    for (const p of learningPaths) {
      for (const s of p.stages) {
        const key = `path:${p.id}:${s.id}`;
        if (!s.done && !scheduledCanonicalIds.has(key)) {
          list.push({
            id: key,
            sourceLabel: p.title,
            categoryLabel: 'مسار تعليمي',
            text: s.title,
            canonicalProjectId: key,
            hubId: p.hubId ?? 'knowledge',
          });
        }
      }
    }
    for (const m of months) {
      for (const t of m.tasks) {
        const key = `month:${m.id}:${t.id}`;
        if (!t.done && !scheduledCanonicalIds.has(key)) {
          list.push({
            id: key,
            sourceLabel: `الوحدة ${m.id}: ${m.theme}`,
            categoryLabel: 'خطة 12 شهرًا',
            text: t.text,
            canonicalProjectId: key,
            hubId: m.hubId ?? 'knowledge',
          });
        }
      }
    }
    return list;
  }, [months, courses, learningPaths, unifiedTasks]);

  // Unscheduled Tasks (Task Panel)
  const unscheduledTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return unifiedTasks
      .filter((t) => {
        if (t.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(t.scheduledDate)) {
          return false;
        }
        if (!showCompleted && t.status === 'done') return false;
        if (filterHub !== 'all' && t.hubId !== filterHub) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority)
          return false;
        if (filterStatus === 'pending' && t.status === 'done') return false;
        if (filterStatus === 'done' && t.status !== 'done') return false;
        if (
          q &&
          !t.title.toLowerCase().includes(q) &&
          !(t.categoryLabel || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        const pOrder = { high: 0, medium: 1, low: 2 };
        return pOrder[a.priority] - pOrder[b.priority];
      });
  }, [
    unifiedTasks,
    taskSearch,
    showCompleted,
    filterHub,
    filterPriority,
    filterStatus,
  ]);

  // Combine Scheduled UnifiedTasks + CalendarEvents + ExpandedWeeklyMeetings into a single normalized array
  const allCalendarItems = useMemo(() => {
    const items: UnifiedCalendarItem[] = [];

    for (const t of unifiedTasks) {
      const dateKey =
        t.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(t.scheduledDate)
          ? t.scheduledDate
          : '';
      if (!dateKey) continue;
      const done = t.status === 'done';
      if (!showCompleted && done) continue;
      if (filterHub !== 'all' && t.hubId !== filterHub) continue;
      if (filterPriority !== 'all' && t.priority !== filterPriority) continue;
      if (filterStatus === 'pending' && done) continue;
      if (filterStatus === 'done' && !done) continue;

      const dur = t.durationMinutes && t.durationMinutes > 0 ? t.durationMinutes : 60;
      const end =
        t.endTime ||
        (t.startTime ? computeEndTimeFromMinutes(t.startTime, dur) : '');
      const overdue =
        !done &&
        ((t.deadline && t.deadline < todayKey) || dateKey < todayKey);

      items.push({
        kind: 'task',
        uid: `task-${t.id}`,
        id: t.id,
        dateKey,
        startTime: t.startTime || '',
        endTime: end,
        durationMinutes: dur,
        title: t.title,
        done,
        overdue,
        priority: t.priority,
        hubId: t.hubId,
        categoryLabel: t.categoryLabel || 'مهمة',
        deadline: t.deadline,
        raw: t,
      });
    }

    for (const ev of events) {
      if (!showCompleted && ev.done) continue;
      if (filterStatus === 'pending' && ev.done) continue;
      if (filterStatus === 'done' && !ev.done) continue;
      if (filterPriority !== 'all') continue; // events don't carry task priority
      if (filterHub !== 'all') continue;

      const dur =
        ev.durationMinutes && ev.durationMinutes > 0 ? ev.durationMinutes : 60;
      const end =
        ev.endTime ||
        (ev.timeSlot ? computeEndTimeFromMinutes(ev.timeSlot, dur) : '');
      items.push({
        kind: 'event',
        uid: `ev-${ev.id}`,
        id: ev.id,
        dateKey: ev.dateKey,
        startTime: ev.timeSlot || '',
        endTime: end,
        durationMinutes: dur,
        title: ev.title,
        done: ev.done,
        overdue: !ev.done && ev.dateKey < todayKey,
        color: ev.color,
        categoryLabel: ev.category,
        raw: ev,
      });
    }

    for (const occ of expandedMeetings) {
      if (!showCompleted && occ.completed) continue;
      if (filterStatus === 'pending' && occ.completed) continue;
      if (filterStatus === 'done' && !occ.completed) continue;
      if (filterHub !== 'all' && occ.meeting.hubId !== filterHub) continue;
      if (filterPriority !== 'all') continue;

      items.push({
        kind: 'meeting',
        uid: `mtg-${occ.meeting.id}-${occ.occurrenceKey}`,
        id: occ.meeting.id,
        occurrenceKey: occ.occurrenceKey,
        dateKey: occ.dateKey,
        startTime: occ.startTime,
        endTime: occ.endTime,
        durationMinutes: occ.durationMinutes,
        title: occ.title,
        done: occ.completed,
        overdue: !occ.completed && occ.dateKey < todayKey,
        color: occ.meeting.color,
        hubId: occ.meeting.hubId,
        raw: occ,
      });
    }

    return items.sort((a, b) =>
      (a.startTime || '99:99').localeCompare(b.startTime || '99:99')
    );
  }, [
    unifiedTasks,
    events,
    expandedMeetings,
    showCompleted,
    filterHub,
    filterPriority,
    filterStatus,
    todayKey,
  ]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, UnifiedCalendarItem[]> = {};
    for (const item of allCalendarItems) {
      if (!map[item.dateKey]) map[item.dateKey] = [];
      map[item.dateKey].push(item);
    }
    return map;
  }, [allCalendarItems]);

  // Deadlines by date (tasks that have deadline set)
  const deadlinesByDate = useMemo(() => {
    const map: Record<string, UnifiedTask[]> = {};
    for (const t of unifiedTasks) {
      if (!t.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(t.deadline)) continue;
      if (!showCompleted && t.status === 'done') continue;
      if (filterHub !== 'all' && t.hubId !== filterHub) continue;
      if (!map[t.deadline]) map[t.deadline] = [];
      map[t.deadline].push(t);
    }
    return map;
  }, [unifiedTasks, showCompleted, filterHub]);

  // Weekday headers respecting weekStartDay & showWeekends
  const orderedWeekDaysMeta = useMemo(() => {
    const list: Array<{ jsDay: number; label: string; isWeekend: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const jsDay = (weekStartDay + i) % 7;
      const weekend = isWeekendDay(jsDay, weekStartDay);
      if (!showWeekends && weekend) continue;
      list.push({
        jsDay,
        label: WEEKDAY_NAMES_BY_JS_DAY[jsDay],
        isWeekend: weekend,
      });
    }
    return list;
  }, [weekStartDay, showWeekends]);

  // Month cells respecting weekStartDay & showWeekends
  const monthCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() - weekStartDay + 7) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);

    const cells: Array<{
      date: Date;
      dateKey: string;
      inCurrentMonth: boolean;
      jsDay: number;
    }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      const jsDay = d.getDay();
      if (!showWeekends && isWeekendDay(jsDay, weekStartDay)) continue;
      cells.push({
        date: d,
        dateKey: toDateKey(d),
        inCurrentMonth: d.getMonth() === month,
        jsDay,
      });
    }
    return cells;
  }, [cursorDate, weekStartDay, showWeekends]);

  // Week days list
  const weekDays = useMemo(() => {
    const startOffset = (cursorDate.getDay() - weekStartDay + 7) % 7;
    const weekStart = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      cursorDate.getDate() - startOffset
    );
    const days: Array<{
      date: Date;
      dateKey: string;
      dayName: string;
      isWeekend: boolean;
    }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + i
      );
      const jsDay = d.getDay();
      const weekend = isWeekendDay(jsDay, weekStartDay);
      if (!showWeekends && weekend) continue;
      days.push({
        date: d,
        dateKey: toDateKey(d),
        dayName: WEEKDAY_NAMES_BY_JS_DAY[jsDay],
        isWeekend: weekend,
      });
    }
    return days;
  }, [cursorDate, weekStartDay, showWeekends]);

  // Pointer Resize Global Listeners (for Day & Week Views)
  useEffect(() => {
    if (!resizingState) return;
    const onMove = (e: PointerEvent) => {
      const cur = resizingRef.current;
      if (!cur) return;
      const dy = e.clientY - cur.startY;
      const deltaMinutes = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15;
      const nextDur = Math.max(15, Math.min(480, cur.origDuration + deltaMinutes));
      setResizingState((prev) =>
        prev ? { ...prev, currentDuration: nextDur } : prev
      );
    };
    const onUp = () => {
      const cur = resizingRef.current;
      if (cur && cur.currentDuration !== cur.origDuration) {
        if (cur.kind === 'task') {
          const target = unifiedTasks.find((t) => t.id === cur.id);
          if (target) {
            const st = target.startTime || '09:00';
            onUpdateUnifiedTask(target.id, {
              durationMinutes: cur.currentDuration,
              endTime: computeEndTimeFromMinutes(st, cur.currentDuration),
            });
          }
        } else if (cur.kind === 'event') {
          const target = events.find((ev) => ev.id === cur.id);
          if (target) {
            const st = target.timeSlot || '09:00';
            onUpdateEvent(target.id, {
              durationMinutes: cur.currentDuration,
              endTime: computeEndTimeFromMinutes(st, cur.currentDuration),
            });
          }
        }
      }
      setResizingState(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [
    resizingState !== null,
    HOUR_HEIGHT,
    unifiedTasks,
    events,
    onUpdateUnifiedTask,
    onUpdateEvent,
  ]);

  // Navigation Handlers
  const handleNavigate = (dir: -1 | 1) => {
    if (viewMode === 'day') {
      const nextKey = addDays(selectedDateKey, dir);
      setSelectedDateKey(nextKey);
      setCursorDate(parseDateKey(nextKey));
    } else if (viewMode === 'week') {
      setCursorDate(
        (p) => new Date(p.getFullYear(), p.getMonth(), p.getDate() + dir * 7)
      );
    } else if (viewMode === 'month') {
      setCursorDate(
        (p) => new Date(p.getFullYear(), p.getMonth() + dir, 1)
      );
    } else {
      setCursorDate((p) => new Date(p.getFullYear() + dir, p.getMonth(), 1));
    }
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDateKey(toDateKey(now));
  };

  // Drag & Drop Helpers
  const startDrag = (e: React.DragEvent, payload: DragPayload) => {
    if (!canEdit) {
      e.preventDefault();
      onRequireAuth();
      return;
    }
    setDraggingPayload(payload);
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // fallback relies on state
    }
  };

  const parseDropPayload = (e: React.DragEvent): DragPayload | null => {
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) return JSON.parse(raw) as DragPayload;
    } catch {
      // ignore
    }
    return draggingPayload;
  };

  const handleDropOnCalendar = (
    e: React.DragEvent,
    targetDateKey: string,
    targetStartTime?: string // undefined = keep existing or leave all-day; '' = clear time; 'HH:00' = set hour
  ) => {
    e.preventDefault();
    setDropHighlightKey(null);
    if (!canEdit) {
      onRequireAuth();
      setDraggingPayload(null);
      return;
    }
    const payload = parseDropPayload(e);
    setDraggingPayload(null);
    if (!payload) return;

    if (payload.kind === 'task') {
      const target = unifiedTasks.find((t) => t.id === payload.id);
      if (!target) return;
      const dur = target.durationMinutes && target.durationMinutes > 0 ? target.durationMinutes : 60;
      const nextTime =
        targetStartTime !== undefined ? targetStartTime : target.startTime || '';
      const nextEnd = nextTime ? computeEndTimeFromMinutes(nextTime, dur) : '';
      onUpdateUnifiedTask(target.id, {
        scheduledDate: targetDateKey,
        dueDate: targetDateKey,
        startTime: nextTime,
        durationMinutes: dur,
        endTime: nextEnd,
      });
    } else if (payload.kind === 'event') {
      const target = events.find((ev) => ev.id === payload.id);
      if (!target) return;
      const dur = target.durationMinutes && target.durationMinutes > 0 ? target.durationMinutes : 60;
      const nextTime =
        targetStartTime !== undefined ? targetStartTime : target.timeSlot || '';
      const nextEnd = nextTime ? computeEndTimeFromMinutes(nextTime, dur) : '';
      onUpdateEvent(target.id, {
        dateKey: targetDateKey,
        timeSlot: nextTime,
        durationMinutes: dur,
        endTime: nextEnd,
      });
    } else if (payload.kind === 'meeting' && onUpdateWeeklyMeeting) {
      const mtg = weeklyMeetings.find((m) => m.id === payload.meetingId);
      if (!mtg) return;
      const nextTime =
        targetStartTime && targetStartTime.length >= 4
          ? targetStartTime
          : mtg.startTime;
      const dur = mtg.durationMinutes || 60;
      const nextEnd = computeEndTimeFromMinutes(nextTime, dur);
      const nextExceptions = {
        ...(mtg.exceptions || {}),
        [payload.occurrenceKey]: {
          ...(mtg.exceptions?.[payload.occurrenceKey] || {}),
          movedDateKey: targetDateKey,
          startTime: nextTime,
          endTime: nextEnd,
        },
      };
      onUpdateWeeklyMeeting(mtg.id, { exceptions: nextExceptions });
    } else if (payload.kind === 'plan_task') {
      const st = targetStartTime || '';
      const existingLinked = unifiedTasks.find(
        (ut) => ut.projectId && ut.projectId === payload.canonicalProjectId
      );
      if (existingLinked) {
        const dur =
          existingLinked.durationMinutes && existingLinked.durationMinutes > 0
            ? existingLinked.durationMinutes
            : 60;
        onUpdateUnifiedTask(existingLinked.id, {
          scheduledDate: targetDateKey,
          dueDate: targetDateKey,
          startTime: st,
          endTime: st ? computeEndTimeFromMinutes(st, dur) : '',
          durationMinutes: dur,
        });
      } else {
        onAddUnifiedTask({
          title: payload.text,
          description: `مرتبط بـ: ${payload.sourceLabel}`,
          hubId: payload.hubId || (filterHub === 'all' ? 'knowledge' : filterHub),
          categoryLabel: payload.categoryLabel || payload.sourceLabel,
          priority: 'medium',
          status: 'todo',
          dueDate: targetDateKey,
          scheduledDate: targetDateKey,
          startTime: st,
          endTime: st ? computeEndTimeFromMinutes(st, 60) : '',
          durationMinutes: 60,
          projectId: payload.canonicalProjectId,
          linkedLabel: payload.sourceLabel,
        });
      }
    }
    setSelectedDateKey(targetDateKey);
  };

  const handleDropOnUnscheduledPanel = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHighlightKey(null);
    if (!canEdit) {
      setDraggingPayload(null);
      return;
    }
    const payload = parseDropPayload(e);
    setDraggingPayload(null);
    if (!payload || payload.kind !== 'task') return;
    onUpdateUnifiedTask(payload.id, {
      scheduledDate: '',
      startTime: '',
      endTime: '',
    });
  };

  // Item Selection -> Open Details Modal
  const openItemDetails = (item: UnifiedCalendarItem) => {
    setActiveItem(item);
    setEditTitle(item.title);
    setEditDate(item.dateKey);
    setEditTime(item.startTime || '');
    setEditDuration(item.durationMinutes || 60);
    if (item.kind === 'task') {
      setEditDeadline(item.raw.deadline || '');
      setEditPriority(item.raw.priority);
      setEditStatus(item.raw.status);
      setEditHub(item.raw.hubId);
      setEditProjectId(item.raw.projectId || '');
      setEditNotes(item.raw.description || '');
    } else if (item.kind === 'event') {
      setEditCategory(item.raw.category);
      setEditColor(item.raw.color);
      setEditNotes(item.raw.notes || '');
    } else {
      setEditHub(item.raw.meeting.hubId);
      setEditNotes(item.raw.notes || item.raw.meeting.description || '');
    }
  };

  const handleSaveActiveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !activeItem) {
      onRequireAuth();
      return;
    }
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;
    const endTime = editTime ? computeEndTimeFromMinutes(editTime, editDuration) : '';

    if (activeItem.kind === 'task') {
      let nextLinkedLabel = activeItem.raw.linkedLabel || '';
      if (editProjectId !== (activeItem.raw.projectId || '')) {
        if (!editProjectId) {
          nextLinkedLabel = '';
        } else if (editProjectId.startsWith('course:')) {
          const cid = parseInt(editProjectId.split(':')[1] || '', 10);
          nextLinkedLabel = courses.find((c) => c.id === cid)?.title || nextLinkedLabel;
        } else if (editProjectId.startsWith('path:')) {
          const pid = editProjectId.split(':')[1] || '';
          nextLinkedLabel = learningPaths.find((p) => p.id === pid)?.title || nextLinkedLabel;
        } else {
          nextLinkedLabel = projects.find((p) => p.id === editProjectId)?.title || nextLinkedLabel;
        }
      }
      onUpdateUnifiedTask(activeItem.id, {
        title: cleanTitle,
        scheduledDate: editDate,
        dueDate: editDate || activeItem.raw.dueDate,
        startTime: editTime,
        durationMinutes: editDuration,
        endTime,
        deadline: editDeadline,
        priority: editPriority,
        status: editStatus,
        hubId: editHub,
        projectId: editProjectId,
        linkedLabel: nextLinkedLabel,
        description: editNotes.trim(),
      });
    } else if (activeItem.kind === 'event') {
      onUpdateEvent(activeItem.id, {
        title: cleanTitle,
        dateKey: editDate || activeItem.dateKey,
        timeSlot: editTime,
        durationMinutes: editDuration,
        endTime,
        category: editCategory,
        color: editColor,
        notes: editNotes.trim(),
      });
    } else if (activeItem.kind === 'meeting' && onUpdateWeeklyMeeting) {
      const mtg = activeItem.raw.meeting;
      const nextExceptions = {
        ...(mtg.exceptions || {}),
        [activeItem.occurrenceKey]: {
          ...(mtg.exceptions?.[activeItem.occurrenceKey] || {}),
          title: cleanTitle,
          movedDateKey: editDate || activeItem.dateKey,
          startTime: editTime || activeItem.startTime,
          durationMinutes: editDuration,
          endTime: editTime
            ? computeEndTimeFromMinutes(editTime, editDuration)
            : activeItem.endTime,
        },
      };
      const nextNotes = { ...(mtg.notesByDate || {}) };
      if (editNotes.trim()) nextNotes[activeItem.occurrenceKey] = editNotes.trim();
      onUpdateWeeklyMeeting(mtg.id, {
        exceptions: nextExceptions,
        notesByDate: nextNotes,
      });
    }
    if (editDate) setSelectedDateKey(editDate);
    setActiveItem(null);
  };

  const handleToggleItemDone = (item: UnifiedCalendarItem) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    if (item.kind === 'task') {
      onUpdateUnifiedTask(item.id, {
        status: item.done ? 'todo' : 'done',
      });
    } else if (item.kind === 'event') {
      onUpdateEvent(item.id, { done: !item.done });
    } else if (item.kind === 'meeting' && onUpdateWeeklyMeeting) {
      const mtg = item.raw.meeting;
      const doneSet = new Set(mtg.completedDates || []);
      const nextAtt = { ...(mtg.attendanceByDate || {}) };
      if (item.done) {
        doneSet.delete(item.occurrenceKey);
        nextAtt[item.occurrenceKey] = 'pending';
      } else {
        doneSet.add(item.occurrenceKey);
        nextAtt[item.occurrenceKey] = 'attended';
      }
      onUpdateWeeklyMeeting(mtg.id, {
        completedDates: Array.from(doneSet),
        attendanceByDate: nextAtt,
      });
    }
  };

  const openCreateAtSlot = (dateKey: string, startTime = '') => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setCreateDateKey(dateKey);
    setCreateStartTime(startTime);
    setCreateTitle('');
    setCreateNotes('');
    setCreateDeadline('');
    setCreateDuration(60);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = createTitle.trim();
    if (!clean) return;
    const endTime = createStartTime
      ? computeEndTimeFromMinutes(createStartTime, createDuration)
      : '';

    if (createType === 'task') {
      onAddUnifiedTask({
        title: clean,
        description: createNotes.trim(),
        hubId: createHub,
        categoryLabel: getHubMeta(createHub).shortTitle,
        priority: createPriority,
        status: 'todo',
        dueDate: createDateKey,
        scheduledDate: createDateKey,
        startTime: createStartTime,
        endTime,
        durationMinutes: createDuration,
        deadline: createDeadline,
      });
    } else {
      onAddEvent({
        dateKey: createDateKey,
        timeSlot: createStartTime,
        endTime,
        durationMinutes: createDuration,
        title: clean,
        notes: createNotes.trim(),
        category: createCategory,
        color: createColor,
        done: false,
      });
    }
    setSelectedDateKey(createDateKey);
    setCreateModalOpen(false);
  };

  const handleQuickAddUnscheduledTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = quickTaskTitle.trim();
    if (!clean) return;
    const hub = filterHub === 'all' ? 'knowledge' : filterHub;
    onAddUnifiedTask({
      title: clean,
      description: '',
      hubId: hub,
      categoryLabel: getHubMeta(hub).shortTitle,
      priority: quickTaskPriority,
      status: 'todo',
      dueDate: '',
      scheduledDate: '',
      startTime: '',
      durationMinutes: 60,
    });
    setQuickTaskTitle('');
  };

  // Current time line offset for Day/Week view
  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const periodHeading = useMemo(() => {
    if (viewMode === 'day') return formatArabicFullDate(selectedDateKey);
    if (viewMode === 'month') return formatArabicMonthYear(cursorDate);
    if (viewMode === 'year') return `نظرة سنوية — ${cursorDate.getFullYear()}`;
    if (weekDays.length === 0) return formatArabicMonthYear(cursorDate);
    return `الأسبوع: ${formatArabicShortDay(weekDays[0].date)} — ${formatArabicShortDay(
      weekDays[weekDays.length - 1].date
    )}`;
  }, [viewMode, selectedDateKey, cursorDate, weekDays]);

  const itemStyleClasses = (item: UnifiedCalendarItem) => {
    if (item.kind === 'task') {
      const pMeta = PRIORITY_META[item.priority];
      if (item.done)
        return 'bg-slate-100/80 border-slate-200 border-r-emerald-600 text-slate-400 line-through';
      if (item.overdue)
        return 'bg-rose-50/90 border-rose-300 border-r-rose-600 text-rose-950';
      return `bg-white border-slate-200 ${pMeta.border} text-slate-900`;
    }
    if (item.kind === 'meeting') {
      if (item.done)
        return 'bg-slate-100/80 border-slate-200 border-r-emerald-600 text-slate-400 line-through';
      return 'bg-indigo-50/90 border-indigo-200 border-r-indigo-600 text-indigo-950';
    }
    const style = COLOR_STYLES[item.color] ?? COLOR_STYLES.navy;
    if (item.done)
      return 'bg-slate-100/80 border-slate-200 border-r-emerald-600 text-slate-400 line-through';
    return `${style.chip} ${style.border}`;
  };

  // Helper to render timed slots for Day & Week columns
  const renderTimeGridColumn = (dateKey: string, isToday: boolean) => {
    const dayItems = itemsByDate[dateKey] ?? [];
    const timedItems = dayItems.filter(
      (it) => parseMinutesFromTime(it.startTime) !== null
    );
    const totalGridHeight = visibleHours.length * HOUR_HEIGHT;

    return (
      <div
        className={`relative border-l last:border-l-0 border-slate-200 ${
          isToday ? 'bg-[#1E3A5F]/[0.02]' : 'bg-white'
        }`}
        style={{ height: `${totalGridHeight}px` }}
      >
        {/* Hour drop rows */}
        {visibleHours.map((hour) => {
          const hourStr = `${String(hour).padStart(2, '0')}:00`;
          const dropId = `${dateKey}@${hourStr}`;
          const isHighlighted = dropHighlightKey === dropId;
          return (
            <div
              key={hour}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                if (dropHighlightKey !== dropId) setDropHighlightKey(dropId);
              }}
              onDragLeave={() => {
                if (dropHighlightKey === dropId) setDropHighlightKey(null);
              }}
              onDrop={(e) => handleDropOnCalendar(e, dateKey, hourStr)}
              onClick={() => openCreateAtSlot(dateKey, hourStr)}
              style={{ height: `${HOUR_HEIGHT}px` }}
              className={`border-b border-slate-100 transition-colors cursor-pointer group ${
                isHighlighted
                  ? 'bg-[#1E3A5F]/15 ring-2 ring-inset ring-[#1E3A5F]'
                  : 'hover:bg-slate-50/70'
              }`}
              title={`إضافة أو إفلات عند ${hourStr}`}
            >
              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 px-1.5 pt-0.5 block">
                + {hourStr}
              </span>
            </div>
          );
        })}

        {/* Current time indicator line */}
        {isToday && nowMinutes >= gridStartMins && nowMinutes <= gridEndMins && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 z-10 pointer-events-none flex items-center"
            style={{
              top: `${((nowMinutes - gridStartMins) / 60) * HOUR_HEIGHT}px`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 -mr-1" />
            <div className="flex-1 h-[1.5px] bg-rose-500" />
          </div>
        )}

        {/* Timed Items */}
        {timedItems.map((item) => {
          const mins = parseMinutesFromTime(item.startTime)!;
          const clampedMins = Math.max(
            gridStartMins,
            Math.min(gridEndMins - 15, mins)
          );
          const activeDur =
            resizingState && resizingState.id === item.id && resizingState.kind === item.kind
              ? resizingState.currentDuration
              : item.durationMinutes;
          const topPx = ((clampedMins - gridStartMins) / 60) * HOUR_HEIGHT;
          const heightPx = Math.max(24, (activeDur / 60) * HOUR_HEIGHT - 2);
          const resizable = canEdit && (item.kind === 'task' || item.kind === 'event');

          return (
            <div
              key={item.uid}
              draggable={canEdit}
              onDragStart={(e) => {
                if (item.kind === 'task') {
                  startDrag(e, { kind: 'task', id: item.id });
                } else if (item.kind === 'event') {
                  startDrag(e, { kind: 'event', id: item.id });
                } else {
                  startDrag(e, {
                    kind: 'meeting',
                    meetingId: item.id,
                    occurrenceKey: item.occurrenceKey,
                  });
                }
              }}
              onDragEnd={() => {
                setDraggingPayload(null);
                setDropHighlightKey(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                openItemDetails(item);
              }}
              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
              className={`absolute inset-x-1 z-10 rounded-md border border-r-4 px-2 py-1 shadow-2xs overflow-hidden flex flex-col justify-between cursor-pointer transition-shadow hover:shadow-md select-none ${itemStyleClasses(
                item
              )}`}
            >
              <div className="flex items-start justify-between gap-1 min-w-0">
                <div className="flex items-start gap-1 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleItemDone(item);
                    }}
                    aria-label={item.done ? 'إلغاء الإتمام' : 'تحديد كمكتمل'}
                    className="shrink-0 mt-0.5 cursor-pointer"
                  >
                    {item.done ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 opacity-60" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold leading-tight truncate">
                      {item.title}
                    </p>
                    {heightPx >= 36 && (
                      <p className="text-[10px] opacity-75 tabular-nums truncate">
                        {item.startTime}
                        {item.endTime ? `–${item.endTime}` : ''} · {activeDur}د
                      </p>
                    )}
                  </div>
                </div>
                {item.kind === 'meeting' && (
                  <Users className="w-3 h-3 text-indigo-700 shrink-0 mt-0.5" />
                )}
                {item.overdue && (
                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                )}
              </div>

              {resizable && (
                <div
                  role="separator"
                  aria-label="سحب لتغيير مدة المهمة"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setResizingState({
                      kind: item.kind as 'task' | 'event',
                      id: item.id,
                      startY: e.clientY,
                      origDuration: item.durationMinutes || 60,
                      currentDuration: item.durationMinutes || 60,
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-2 -mx-2 -mb-1 cursor-ns-resize flex items-center justify-center opacity-50 hover:opacity-100"
                >
                  <span className="w-6 h-0.5 bg-current rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & View Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              تنظيم المهام والمواعيد واللقاءات الأسبوعية · سحب وإفلات مباشر
            </p>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              التقويم وجدولة المهام
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 4 Views Segmented Control */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'day', label: 'يوم' },
                  { id: 'week', label: 'أسبوع' },
                  { id: 'month', label: 'شهر' },
                  { id: 'year', label: 'سنة' },
                ] as Array<{ id: CalendarViewMode; label: string }>
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelectViewMode(v.id)}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    viewMode === v.id
                      ? 'bg-white text-[#1E3A5F] shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsDrawer((v) => !v)}
              aria-expanded={showSettingsDrawer}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg border cursor-pointer ${
                showSettingsDrawer
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تخصيص وفلاتر</span>
            </button>

            {onOpenMeetingsSection && (
              <button
                type="button"
                onClick={onOpenMeetingsSection}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-indigo-900 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>اللقاءات الأسبوعية ({weeklyMeetings.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openCreateAtSlot(selectedDateKey)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إضافة سريعة</span>
            </button>
          </div>
        </div>

        {/* Collapsible Personalization & Filter Bar */}
        {showSettingsDrawer && (
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label className="block text-slate-600">
              <span className="inline-flex items-center gap-1 mb-1 font-medium">
                <Filter className="w-3 h-3" /> تصفية حسب المجال
              </span>
              <select
                value={filterHub}
                onChange={(e) =>
                  updateCalendarPref(
                    'filterHub',
                    e.target.value as LearningHubId | 'all'
                  )
                }
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value="all">كل المجالات والأحداث</option>
                {LEARNING_HUBS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.shortTitle}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-slate-600">
              <span className="block mb-1 font-medium">أولوية المهام</span>
              <select
                value={filterPriority}
                onChange={(e) =>
                  updateCalendarPref(
                    'filterPriority',
                    e.target.value as TaskPriority | 'all'
                  )
                }
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value="all">جميع الأولويات</option>
                <option value="high">عالية فقط</option>
                <option value="medium">متوسطة فقط</option>
                <option value="low">منخفضة فقط</option>
              </select>
            </label>

            <label className="block text-slate-600">
              <span className="block mb-1 font-medium">بداية الأسبوع</span>
              <select
                value={weekStartDay}
                onChange={(e) =>
                  updateCalendarPref(
                    'weekStartDay',
                    Number(e.target.value) as WeekStartDay
                  )
                }
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              >
                <option value={6}>السبت</option>
                <option value={0}>الأحد</option>
                <option value={1}>الإثنين</option>
              </select>
            </label>

            <div className="block text-slate-600">
              <span className="block mb-1 font-medium">كثافة العرض والحالة</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updateCalendarPref(
                      'density',
                      density === 'compact' ? 'expanded' : 'compact'
                    )
                  }
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium text-slate-800 cursor-pointer"
                >
                  {density === 'compact' ? 'عرض مضغوط' : 'عرض موسّع'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCalendarPref('showCompleted', !showCompleted)
                  }
                  className={`px-2.5 py-1.5 rounded-md font-medium cursor-pointer border ${
                    showCompleted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {showCompleted ? 'المكتملة: ظاهرة' : 'المكتملة: مخفية'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCalendarPref('showWeekends', !showWeekends)
                  }
                  className={`px-2.5 py-1.5 rounded-md font-medium cursor-pointer border ${
                    showWeekends
                      ? 'bg-slate-100 border-slate-300 text-slate-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {showWeekends ? 'عطلة نهاية الأسبوع: ظاهرة' : 'أيام العمل فقط'}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />
                <span className="font-semibold">نطاق ساعات اليوم:</span>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500">من</span>
                  <select
                    aria-label="بداية اليوم بالساعة"
                    value={dayStartHour}
                    onChange={(e) => {
                      const nextStart = Number(e.target.value);
                      updateDayTimeWindow(
                        nextStart,
                        Math.max(nextStart + 1, dayEndHour)
                      );
                    }}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    {FULL_HOURS_START_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {formatHourOptionLabel(h)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500">إلى</span>
                  <select
                    aria-label="نهاية اليوم بالساعة"
                    value={dayEndHour}
                    onChange={(e) => {
                      const nextEnd = Number(e.target.value);
                      updateDayTimeWindow(
                        Math.min(dayStartHour, nextEnd - 1),
                        nextEnd
                      );
                    }}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    {FULL_HOURS_END_OPTIONS.filter((h) => h > dayStartHour).map(
                      (h) => (
                        <option key={h} value={h}>
                          {formatHourOptionLabel(h)}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateDayTimeWindow(0, 24)}
                  className={`px-2.5 py-1.5 rounded-md font-medium cursor-pointer border ${
                    dayStartHour === 0 && dayEndHour === 24
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  24 ساعة كاملة
                </button>
                <button
                  type="button"
                  onClick={() => updateDayTimeWindow(8, 24)}
                  className={`px-2.5 py-1.5 rounded-md font-medium cursor-pointer border ${
                    dayStartHour === 8 && dayEndHour === 24
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  8 ص – 12 منتصف الليل
                </button>
                <button
                  type="button"
                  onClick={() => updateDayTimeWindow(6, 23)}
                  className={`px-2.5 py-1.5 rounded-md font-medium cursor-pointer border ${
                    dayStartHour === 6 && dayEndHour === 23
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  6 ص – 11 م
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigate(-1)}
            aria-label="الفترة السابقة"
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleJumpToday}
            className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => handleNavigate(1)}
            aria-label="الفترة التالية"
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <h2 className="font-editorial text-lg sm:text-xl font-bold text-slate-900">
          {periodHeading}
        </h2>

        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
          <span>{allCalendarItems.length} عنصر معروض</span>
          <span aria-hidden="true">·</span>
          <span>{unscheduledTasks.length} غير مجدولة</span>
        </div>
      </div>

      {/* Mobile View Pane Switcher (Calendar vs Unscheduled Tasks) */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
        <button
          type="button"
          onClick={() => setMobilePane('calendar')}
          className={`py-2.5 min-h-[44px] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
            mobilePane === 'calendar'
              ? 'bg-white text-[#1E3A5F] shadow-xs'
              : 'text-slate-700'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>التقويم</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('tasks')}
          className={`py-2.5 min-h-[44px] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
            mobilePane === 'tasks'
              ? 'bg-white text-[#1E3A5F] shadow-xs'
              : 'text-slate-700'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          <span>المهام غير المجدولة ({unscheduledTasks.length})</span>
        </button>
      </div>

      {/* Main Split Workspace: Task Panel (col-span-4) + Calendar Panel (col-span-8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* TASK PANEL: Unscheduled Tasks + Drag-out & Drop-back */}
        <aside
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            if (dropHighlightKey !== 'unscheduled-panel') {
              setDropHighlightKey('unscheduled-panel');
            }
          }}
          onDragLeave={() => {
            if (dropHighlightKey === 'unscheduled-panel') setDropHighlightKey(null);
          }}
          onDrop={handleDropOnUnscheduledPanel}
          className={`lg:col-span-4 bg-white border rounded-xl p-4 sm:p-5 space-y-4 transition-colors ${
            mobilePane === 'tasks' ? 'block' : 'hidden lg:block'
          } ${
            dropHighlightKey === 'unscheduled-panel'
              ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 bg-slate-50'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[#1E3A5F]" />
                <span>المهام غير المجدولة ({unscheduledTasks.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                اسحب أي مهمة وأفلتها على التقويم، أو استخدم زر الجدولة السريعة.
              </p>
            </div>
          </div>

          {/* Inline Quick Add Unscheduled Task */}
          <form onSubmit={handleQuickAddUnscheduledTask} className="flex gap-1.5">
            <input
              type="text"
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              onClick={() => {
                if (!canEdit) onRequireAuth();
              }}
              readOnly={!canEdit}
              placeholder="مهمة جديدة غير مجدولة..."
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
            />
            <select
              aria-label="الأولوية"
              value={quickTaskPriority}
              disabled={!canEdit}
              onChange={(e) =>
                setQuickTaskPriority(e.target.value as TaskPriority)
              }
              className="px-2 py-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="high">عالية</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
            <button
              type="submit"
              aria-label="إضافة مهمة"
              className="px-3 py-2 bg-[#1E3A5F] hover:bg-[#162C49] text-white rounded-lg text-xs font-medium cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {/* Search input */}
          <input
            type="search"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="بحث في المهام غير المجدولة..."
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
          />

          {/* Unscheduled Task Cards */}
          {unscheduledTasks.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
              {draggingPayload?.kind === 'task'
                ? 'أفلت المهمة هنا لإلغاء جدولتها وإرجاعها لقائمة الانتظار'
                : 'لا توجد مهام غير مجدولة حاليًا.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
              {unscheduledTasks.map((task) => {
                const hubMeta = getHubMeta(task.hubId);
                const pMeta = PRIORITY_META[task.priority];
                const isOverdueDeadline =
                  Boolean(task.deadline) &&
                  task.deadline! < todayKey &&
                  task.status !== 'done';
                const isQuickSchedOpen = quickScheduleTargetId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable={canEdit}
                    onDragStart={(e) =>
                      startDrag(e, { kind: 'task', id: task.id })
                    }
                    onDragEnd={() => {
                      setDraggingPayload(null);
                      setDropHighlightKey(null);
                    }}
                    className={`p-3 rounded-lg border border-r-4 bg-white space-y-2 transition-shadow hover:shadow-xs ${
                      pMeta.border
                    } ${
                      task.status === 'done' ? 'opacity-60' : ''
                    } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        {canEdit && (
                          <GripVertical
                            className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5 hidden sm:block"
                            aria-hidden="true"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) return onRequireAuth();
                            onUpdateUnifiedTask(task.id, {
                              status: task.status === 'done' ? 'todo' : 'done',
                            });
                          }}
                          className="shrink-0 mt-0.5 cursor-pointer"
                          aria-label="تبديل الإتمام"
                        >
                          {task.status === 'done' ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-semibold leading-snug ${
                              task.status === 'done'
                                ? 'line-through text-slate-400'
                                : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded border font-medium ${hubMeta.badgeClass}`}
                            >
                              {hubMeta.shortTitle}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded border font-medium ${pMeta.badge}`}
                            >
                              {pMeta.label}
                            </span>
                            {task.linkedLabel && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-slate-50 text-[#1E3A5F] border-slate-200 font-medium truncate max-w-[140px]">
                                <Link2 className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{task.linkedLabel}</span>
                              </span>
                            )}
                            {task.deadline && (
                              <span
                                className={`px-1.5 py-0.5 rounded border font-medium tabular-nums ${
                                  isOverdueDeadline
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                موعد نهائي: {task.deadline}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!canEdit) return onRequireAuth();
                          if (isQuickSchedOpen) {
                            setQuickScheduleTargetId(null);
                          } else {
                            setQuickScheduleTargetId(task.id);
                            setQuickSchedDate(selectedDateKey);
                            setQuickSchedTime('09:00');
                            setQuickSchedDuration(task.durationMinutes || 60);
                          }
                        }}
                        className="px-2 py-1 min-h-[32px] text-[11px] font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md shrink-0 cursor-pointer"
                      >
                        {isQuickSchedOpen ? 'إغلاق' : 'جدولة'}
                      </button>
                    </div>

                    {isQuickSchedOpen && canEdit && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="date"
                            value={quickSchedDate}
                            onChange={(e) => setQuickSchedDate(e.target.value)}
                            className="col-span-2 px-2 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded"
                          />
                          <input
                            type="time"
                            value={quickSchedTime}
                            onChange={(e) => setQuickSchedTime(e.target.value)}
                            className="px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <select
                            value={quickSchedDuration}
                            onChange={(e) =>
                              setQuickSchedDuration(Number(e.target.value))
                            }
                            className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded"
                          >
                            {DURATION_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m} دقيقة
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const end = quickSchedTime
                                ? computeEndTimeFromMinutes(
                                    quickSchedTime,
                                    quickSchedDuration
                                  )
                                : '';
                              onUpdateUnifiedTask(task.id, {
                                scheduledDate: quickSchedDate,
                                dueDate: quickSchedDate,
                                startTime: quickSchedTime,
                                durationMinutes: quickSchedDuration,
                                endTime: end,
                              });
                              setSelectedDateKey(quickSchedDate);
                              setQuickScheduleTargetId(null);
                              setMobilePane('calendar');
                            }}
                            className="px-3 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] rounded cursor-pointer"
                          >
                            تثبيت في التقويم
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional Study Plan, Courses & Learning Paths Tasks Queue */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <button
              type="button"
              onClick={() => setShowPlanTasksDrawer((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
            >
              <span>مهام الكورسات والمسارات والخطة ({pendingPlanTasks.length})</span>
              <span>{showPlanTasksDrawer ? 'إخفاء' : 'عرض للسحب'}</span>
            </button>

            {showPlanTasksDrawer && (
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pt-1">
                {pendingPlanTasks.slice(0, 30).map((pt) => (
                  <div
                    key={pt.id}
                    draggable={canEdit}
                    onDragStart={(e) =>
                      startDrag(e, {
                        kind: 'plan_task',
                        text: pt.text,
                        sourceLabel: pt.sourceLabel,
                        categoryLabel: pt.categoryLabel,
                        canonicalProjectId: pt.canonicalProjectId,
                        hubId: pt.hubId,
                      })
                    }
                    className="p-2 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between gap-2 text-[11px] cursor-grab"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canEdit) return onRequireAuth();
                        const parts = pt.canonicalProjectId.split(':');
                        if (parts[0] === 'course' && parts.length >= 3) {
                          onToggleCourseTask?.(Number(parts[1]), parts.slice(2).join(':'));
                        } else if (parts[0] === 'path' && parts.length >= 3) {
                          onTogglePathStage?.(parts[1], parts.slice(2).join(':'));
                        } else if (parts[0] === 'month' && parts.length >= 3) {
                          onToggleMonthTask?.(Number(parts[1]), parts.slice(2).join(':'));
                        }
                      }}
                      aria-label={`إتمام ${pt.text}`}
                      className="text-slate-400 hover:text-emerald-700 shrink-0 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold text-[#1E3A5F] truncate">
                        {pt.categoryLabel} · {pt.sourceLabel}
                      </span>
                      <p className="text-slate-800 truncate">{pt.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return onRequireAuth();
                        const existingLinked = unifiedTasks.find(
                          (ut) =>
                            ut.projectId && ut.projectId === pt.canonicalProjectId
                        );
                        if (existingLinked) {
                          onUpdateUnifiedTask(existingLinked.id, {
                            scheduledDate: selectedDateKey,
                            dueDate: selectedDateKey,
                            durationMinutes: existingLinked.durationMinutes || 60,
                          });
                        } else {
                          onAddUnifiedTask({
                            title: pt.text,
                            description: `مرتبط بـ: ${pt.sourceLabel}`,
                            hubId: pt.hubId,
                            categoryLabel: pt.categoryLabel,
                            priority: 'medium',
                            status: 'todo',
                            dueDate: selectedDateKey,
                            scheduledDate: selectedDateKey,
                            startTime: '',
                            durationMinutes: 60,
                            projectId: pt.canonicalProjectId,
                            linkedLabel: pt.sourceLabel,
                          });
                        }
                        setMobilePane('calendar');
                      }}
                      className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-300 text-[#1E3A5F] rounded shrink-0 cursor-pointer"
                    >
                      + {selectedDateKey.slice(5)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* CALENDAR PANEL */}
        <section
          className={`lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden ${
            mobilePane === 'calendar' ? 'block' : 'hidden lg:block'
          }`}
        >
          {(viewMode === 'day' || viewMode === 'week') && (
            <div className="px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 font-semibold text-[#1E3A5F]">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ساعات العرض:</span>
                </span>
                <select
                  aria-label="ساعة البداية"
                  value={dayStartHour}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    updateDayTimeWindow(
                      nextStart,
                      Math.max(nextStart + 1, dayEndHour)
                    );
                  }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-800 text-[11px]"
                >
                  {FULL_HOURS_START_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      من {formatHourOptionLabel(h)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="ساعة النهاية"
                  value={dayEndHour}
                  onChange={(e) => {
                    const nextEnd = Number(e.target.value);
                    updateDayTimeWindow(
                      Math.min(dayStartHour, nextEnd - 1),
                      nextEnd
                    );
                  }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-800 text-[11px]"
                >
                  {FULL_HOURS_END_OPTIONS.filter((h) => h > dayStartHour).map(
                    (h) => (
                      <option key={h} value={h}>
                        إلى {formatHourOptionLabel(h)}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 tabular-nums hidden sm:inline">
                  ({visibleHours.length} ساعة)
                </span>
                {(dayStartHour !== 0 || dayEndHour !== 24) && (
                  <button
                    type="button"
                    onClick={() => updateDayTimeWindow(0, 24)}
                    className="px-2 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    عرض 24 ساعة
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIEW 1: DAY VIEW */}
          {viewMode === 'day' && (
            <div className="divide-y divide-slate-200">
              {/* All-day & Deadlines strip */}
              <div
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDropHighlightKey(`allday-${selectedDateKey}`);
                }}
                onDragLeave={() => setDropHighlightKey(null)}
                onDrop={(e) => handleDropOnCalendar(e, selectedDateKey, '')}
                className={`p-3 sm:p-4 bg-slate-50/70 space-y-2 transition-colors ${
                  dropHighlightKey === `allday-${selectedDateKey}`
                    ? 'bg-[#1E3A5F]/10 ring-2 ring-inset ring-[#1E3A5F]'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    مهام اليوم بدون وقت محدد والمواعيد النهائية
                  </span>
                  <button
                    type="button"
                    onClick={() => openCreateAtSlot(selectedDateKey, '')}
                    className="text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    + إضافة لليوم
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(itemsByDate[selectedDateKey] ?? [])
                    .filter((it) => parseMinutesFromTime(it.startTime) === null)
                    .map((item) => (
                      <div
                        key={item.uid}
                        draggable={canEdit}
                        onDragStart={(e) => {
                          if (item.kind === 'task') {
                            startDrag(e, { kind: 'task', id: item.id });
                          } else if (item.kind === 'event') {
                            startDrag(e, { kind: 'event', id: item.id });
                          }
                        }}
                        onClick={() => openItemDetails(item)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-r-4 cursor-pointer ${itemStyleClasses(
                          item
                        )}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleItemDone(item);
                          }}
                          className="cursor-pointer"
                        >
                          {item.done ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Square className="w-3.5 h-3.5 opacity-60" />
                          )}
                        </button>
                        <span>{item.title}</span>
                      </div>
                    ))}

                  {(deadlinesByDate[selectedDateKey] ?? []).map((dt) => (
                    <span
                      key={`dl-${dt.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 rounded-md"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      موعد تسليم: {dt.title}
                    </span>
                  ))}

                  {(itemsByDate[selectedDateKey] ?? []).filter(
                    (it) => parseMinutesFromTime(it.startTime) === null
                  ).length === 0 &&
                    (deadlinesByDate[selectedDateKey] ?? []).length === 0 && (
                      <span className="text-[11px] text-slate-400">
                        اسحب مهمة هنا كـ«طوال اليوم»، أو أفلتها على ساعة محددة بالأسفل.
                      </span>
                    )}
                </div>
              </div>

              {/* Hourly grid */}
              <div className="grid grid-cols-[64px_1fr] max-h-[640px] overflow-y-auto">
                <div className="bg-slate-50 border-l border-slate-200 select-none">
                  {visibleHours.map((hour) => (
                    <div
                      key={hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="px-2 pt-1 text-[10px] font-medium text-slate-500 border-b border-slate-200 tabular-nums"
                    >
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                </div>
                {renderTimeGridColumn(
                  selectedDateKey,
                  selectedDateKey === todayKey
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: WEEK VIEW (Hourly Grid) */}
          {viewMode === 'week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[660px]">
                {/* Day Headers + Untimed Tray */}
                <div
                  className="grid border-b border-slate-200 bg-slate-50"
                  style={{
                    gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="p-2 text-[10px] font-semibold text-slate-500 border-l border-slate-200 flex items-center justify-center">
                    الوقت
                  </div>
                  {weekDays.map((wd) => {
                    const isToday = wd.dateKey === todayKey;
                    const isSel = wd.dateKey === selectedDateKey;
                    const untimed = (itemsByDate[wd.dateKey] ?? []).filter(
                      (it) => parseMinutesFromTime(it.startTime) === null
                    );
                    const dlCount = (deadlinesByDate[wd.dateKey] ?? []).length;

                    return (
                      <div
                        key={wd.dateKey}
                        onDragOver={(e) => {
                          if (!canEdit) return;
                          e.preventDefault();
                          setDropHighlightKey(`wk-allday-${wd.dateKey}`);
                        }}
                        onDragLeave={() => setDropHighlightKey(null)}
                        onDrop={(e) => handleDropOnCalendar(e, wd.dateKey, '')}
                        className={`p-2 border-l last:border-l-0 border-slate-200 space-y-1.5 ${
                          dropHighlightKey === `wk-allday-${wd.dateKey}`
                            ? 'bg-[#1E3A5F]/10'
                            : isSel
                            ? 'bg-slate-100/80'
                            : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDateKey(wd.dateKey);
                            handleSelectViewMode('day');
                          }}
                          className="w-full text-right flex items-center justify-between gap-1 cursor-pointer"
                        >
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${
                              isToday
                                ? 'bg-[#1E3A5F] text-white'
                                : 'text-slate-800 hover:bg-slate-200'
                            }`}
                          >
                            {wd.dayName} {wd.date.getDate()}
                          </span>
                          {dlCount > 0 && (
                            <span
                              title={`${dlCount} موعد نهائي`}
                              className="text-[10px] font-bold px-1.5 rounded bg-amber-100 text-amber-900 tabular-nums"
                            >
                              {dlCount}!
                            </span>
                          )}
                        </button>

                        {untimed.length > 0 && (
                          <div className="space-y-1">
                            {untimed.slice(0, density === 'compact' ? 2 : 4).map((it) => (
                              <div
                                key={it.uid}
                                draggable={canEdit}
                                onDragStart={(e) => {
                                  if (it.kind === 'task') {
                                    startDrag(e, { kind: 'task', id: it.id });
                                  } else if (it.kind === 'event') {
                                    startDrag(e, { kind: 'event', id: it.id });
                                  }
                                }}
                                onClick={() => openItemDetails(it)}
                                className={`px-1.5 py-0.5 text-[10px] rounded border border-r-2 truncate cursor-pointer ${itemStyleClasses(
                                  it
                                )}`}
                              >
                                {it.title}
                              </div>
                            ))}
                            {untimed.length > (density === 'compact' ? 2 : 4) && (
                              <span className="text-[9px] text-[#1E3A5F] font-semibold">
                                +{untimed.length - (density === 'compact' ? 2 : 4)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Shared Hourly Grid */}
                <div
                  className="grid max-h-[600px] overflow-y-auto"
                  style={{
                    gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="bg-slate-50 border-l border-slate-200 select-none">
                    {visibleHours.map((hour) => (
                      <div
                        key={hour}
                        style={{ height: `${HOUR_HEIGHT}px` }}
                        className="px-1.5 pt-1 text-[10px] font-medium text-slate-500 border-b border-slate-200 tabular-nums text-center"
                      >
                        {formatHourLabel(hour)}
                      </div>
                    ))}
                  </div>
                  {weekDays.map((wd) => (
                    <React.Fragment key={wd.dateKey}>
                      {renderTimeGridColumn(wd.dateKey, wd.dateKey === todayKey)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: MONTH VIEW */}
          {viewMode === 'month' && (
            <div>
              <div
                className="grid border-b border-slate-200 bg-slate-50"
                style={{
                  gridTemplateColumns: `repeat(${orderedWeekDaysMeta.length}, minmax(0, 1fr))`,
                }}
              >
                {orderedWeekDaysMeta.map((wd) => (
                  <div
                    key={wd.jsDay}
                    className="py-2.5 text-center text-[11px] font-semibold text-slate-600 border-l last:border-l-0 border-slate-200"
                  >
                    {wd.label}
                  </div>
                ))}
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${orderedWeekDaysMeta.length}, minmax(0, 1fr))`,
                }}
              >
                {monthCells.map((cell) => {
                  const dayItems = itemsByDate[cell.dateKey] ?? [];
                  const dayDeadlines = deadlinesByDate[cell.dateKey] ?? [];
                  const isToday = cell.dateKey === todayKey;
                  const isSelected = cell.dateKey === selectedDateKey;
                  const maxVisible = density === 'compact' ? 2 : 4;
                  const dropId = `month-${cell.dateKey}`;
                  const isDropOver = dropHighlightKey === dropId;
                  const overdueCount = dayItems.filter((it) => it.overdue).length;

                  return (
                    <div
                      key={cell.dateKey}
                      onDragOver={(e) => {
                        if (!canEdit) return;
                        e.preventDefault();
                        if (dropHighlightKey !== dropId) setDropHighlightKey(dropId);
                      }}
                      onDragLeave={() => {
                        if (dropHighlightKey === dropId) setDropHighlightKey(null);
                      }}
                      onDrop={(e) => handleDropOnCalendar(e, cell.dateKey)}
                      onClick={() => {
                        setSelectedDateKey(cell.dateKey);
                        if (!cell.inCurrentMonth) setCursorDate(cell.date);
                      }}
                      onDoubleClick={() => openCreateAtSlot(cell.dateKey)}
                      className={`min-h-[96px] sm:min-h-[118px] p-1.5 border-b border-l border-slate-200 flex flex-col justify-between transition-colors cursor-pointer ${
                        isDropOver
                          ? 'bg-[#1E3A5F]/15 ring-2 ring-inset ring-[#1E3A5F]'
                          : isSelected
                          ? 'bg-slate-100/90 ring-2 ring-inset ring-[#1E3A5F]'
                          : cell.inCurrentMonth
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-slate-50/60 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full tabular-nums ${
                            isToday
                              ? 'bg-[#1E3A5F] text-white'
                              : cell.inCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        <div className="flex items-center gap-1">
                          {dayDeadlines.length > 0 && (
                            <span
                              title={`${dayDeadlines.length} موعد نهائي`}
                              className="px-1 rounded text-[9px] font-bold bg-amber-100 text-amber-900"
                            >
                              تسليم {dayDeadlines.length}
                            </span>
                          )}
                          {overdueCount > 0 && (
                            <span
                              title="مهام متأخرة"
                              className="w-2 h-2 rounded-full bg-rose-600"
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 mt-1">
                        {dayItems.slice(0, maxVisible).map((item) => (
                          <div
                            key={item.uid}
                            draggable={canEdit}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              if (item.kind === 'task') {
                                startDrag(e, { kind: 'task', id: item.id });
                              } else if (item.kind === 'event') {
                                startDrag(e, { kind: 'event', id: item.id });
                              } else {
                                startDrag(e, {
                                  kind: 'meeting',
                                  meetingId: item.id,
                                  occurrenceKey: item.occurrenceKey,
                                });
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openItemDetails(item);
                            }}
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border border-r-2 truncate flex items-center gap-1 cursor-pointer ${itemStyleClasses(
                              item
                            )}`}
                          >
                            {item.kind === 'meeting' && (
                              <Users className="w-2.5 h-2.5 shrink-0" />
                            )}
                            <span className="truncate">
                              {item.startTime ? `${item.startTime} ` : ''}
                              {item.title}
                            </span>
                          </div>
                        ))}
                        {dayItems.length > maxVisible && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateKey(cell.dateKey);
                              handleSelectViewMode('day');
                            }}
                            className="text-[10px] font-semibold text-[#1E3A5F] hover:underline px-1 cursor-pointer"
                          >
                            +{dayItems.length - maxVisible} أخرى
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: YEAR VIEW */}
          {viewMode === 'year' && (
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }, (_, mIdx) => {
                const year = cursorDate.getFullYear();
                const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
                const monthPrefix = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
                const monthItemsCount = allCalendarItems.filter((it) =>
                  it.dateKey.startsWith(monthPrefix)
                ).length;
                const monthDoneCount = allCalendarItems.filter(
                  (it) => it.dateKey.startsWith(monthPrefix) && it.done
                ).length;

                return (
                  <div
                    key={mIdx}
                    className="border border-slate-200 rounded-xl p-3 bg-slate-50/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setCursorDate(new Date(year, mIdx, 1));
                          handleSelectViewMode('month');
                        }}
                        className="text-xs font-bold text-[#1E3A5F] hover:underline cursor-pointer"
                      >
                        {formatArabicMonthOnly(year, mIdx)}
                      </button>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {monthItemsCount} نشاط
                        {monthDoneCount > 0 ? ` (${monthDoneCount} منجز)` : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: daysInMonth }, (_, dIdx) => {
                        const dayNum = dIdx + 1;
                        const dKey = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                        const count = (itemsByDate[dKey] ?? []).length;
                        const hasDeadline = (deadlinesByDate[dKey] ?? []).length > 0;
                        const isToday = dKey === todayKey;

                        const heatClass =
                          count >= 4
                            ? 'bg-[#1E3A5F] text-white'
                            : count >= 2
                            ? 'bg-[#1E3A5F]/65 text-white'
                            : count === 1
                            ? 'bg-[#1E3A5F]/20 text-slate-900'
                            : 'bg-white text-slate-600 hover:bg-slate-100';

                        return (
                          <button
                            key={dKey}
                            type="button"
                            title={`${dKey}: ${count} عناصر`}
                            onClick={() => {
                              setSelectedDateKey(dKey);
                              setCursorDate(parseDateKey(dKey));
                              handleSelectViewMode('day');
                            }}
                            className={`h-6 rounded text-[10px] font-medium tabular-nums flex items-center justify-center relative cursor-pointer ${heatClass} ${
                              isToday ? 'ring-2 ring-amber-500 font-bold' : ''
                            }`}
                          >
                            {dayNum}
                            {hasDeadline && (
                              <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-rose-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Day Compact Agenda Strip Below Month/Year Views */}
          {(viewMode === 'month' || viewMode === 'year') && (
            <div className="border-t border-slate-200 p-4 bg-slate-50/70 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  جدول اليوم المختار: {formatArabicFullDate(selectedDateKey)}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectViewMode('day')}
                    className="text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    فتح تفصيليًا ←
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateAtSlot(selectedDateKey)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] rounded-md cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> إضافة
                  </button>
                </div>
              </div>

              {(itemsByDate[selectedDateKey] ?? []).length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا توجد مهام أو مواعيد مسجلة لهذا اليوم بعد.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(itemsByDate[selectedDateKey] ?? []).map((item) => (
                    <div
                      key={item.uid}
                      onClick={() => openItemDetails(item)}
                      className={`p-2.5 rounded-lg border border-r-4 flex items-center justify-between gap-2 cursor-pointer ${itemStyleClasses(
                        item
                      )}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleItemDone(item);
                          }}
                          className="shrink-0 cursor-pointer"
                        >
                          {item.done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4 opacity-60" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] opacity-75 tabular-nums">
                            {item.startTime
                              ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
                              : 'بدون وقت'}{' '}
                            · {item.kind === 'meeting' ? 'لقاء أسبوعي' : item.categoryLabel}
                          </p>
                        </div>
                      </div>
                      {item.overdue && (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* CREATE TASK / EVENT MODAL */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                إضافة جديدة في التقويم
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setCreateType('task')}
                className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  createType === 'task'
                    ? 'bg-white text-[#1E3A5F] shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                مهمة مجدولة
              </button>
              <button
                type="button"
                onClick={() => setCreateType('event')}
                className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  createType === 'event'
                    ? 'bg-white text-[#1E3A5F] shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                موعد / حدث تقويم
              </button>
            </div>

            <input
              type="text"
              required
              autoFocus
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={
                createType === 'task' ? 'عنوان المهمة...' : 'عنوان الموعد أو النشاط...'
              }
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />

            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[11px] text-slate-600">
                التاريخ
                <input
                  type="date"
                  value={createDateKey}
                  onChange={(e) => setCreateDateKey(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-[11px] text-slate-600">
                وقت البدء
                <input
                  type="time"
                  value={createStartTime}
                  onChange={(e) => setCreateStartTime(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-[11px] text-slate-600">
                المدة
                <select
                  value={createDuration}
                  onChange={(e) => setCreateDuration(Number(e.target.value))}
                  className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} د
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {createType === 'task' ? (
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-[11px] text-slate-600">
                  المجال
                  <select
                    value={createHub}
                    onChange={(e) =>
                      setCreateHub(e.target.value as LearningHubId)
                    }
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {LEARNING_HUBS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.shortTitle}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] text-slate-600">
                  الأولوية
                  <select
                    value={createPriority}
                    onChange={(e) =>
                      setCreatePriority(e.target.value as TaskPriority)
                    }
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="high">عالية</option>
                    <option value="medium">متوسطة</option>
                    <option value="low">منخفضة</option>
                  </select>
                </label>
                <label className="block text-[11px] text-slate-600">
                  موعد نهائي
                  <input
                    type="date"
                    value={createDeadline}
                    onChange={(e) => setCreateDeadline(e.target.value)}
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 items-center">
                <label className="block text-[11px] text-slate-600">
                  التصنيف
                  <select
                    value={createCategory}
                    onChange={(e) =>
                      setCreateCategory(e.target.value as CalendarCategory)
                    }
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center justify-end gap-1.5 pt-4">
                  {(Object.keys(COLOR_STYLES) as CalendarColor[]).map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setCreateColor(col)}
                      aria-label={COLOR_STYLES[col].label}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer ${
                        createColor === col
                          ? 'border-slate-900 ring-2 ring-slate-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${COLOR_STYLES[col].dot}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              rows={2}
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="ملاحظات إضافية (اختياري)..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> حفظ في التقويم
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ITEM DETAILS & EDIT / RESCHEDULE MODAL */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveActiveItem}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {activeItem.kind === 'meeting' ? (
                  <Users className="w-4 h-4 text-indigo-700" />
                ) : activeItem.kind === 'task' ? (
                  <ListTodo className="w-4 h-4 text-[#1E3A5F]" />
                ) : (
                  <CalendarDays className="w-4 h-4 text-[#1E3A5F]" />
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  {activeItem.kind === 'meeting'
                    ? 'تفاصيل وتعديل هذا اللقاء'
                    : activeItem.kind === 'task'
                    ? 'تفاصيل وجدولة المهمة'
                    : 'تفاصيل وتعديل الموعد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!canEdit && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>سجّل الدخول لتعديل أو إعادة جدولة العناصر.</span>
              </div>
            )}

            <input
              type="text"
              required
              readOnly={!canEdit}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg"
            />

            {/* Quick reschedule buttons */}
            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500">تقديم/تأجيل سريع:</span>
                <button
                  type="button"
                  onClick={() => setEditDate(todayKey)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 cursor-pointer"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setEditDate(addDays(todayKey, 1))}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 cursor-pointer"
                >
                  غدًا
                </button>
                <button
                  type="button"
                  onClick={() => setEditDate(addDays(editDate || todayKey, 7))}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-800 cursor-pointer"
                >
                  +أسبوع
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[11px] text-slate-600">
                التاريخ
                <input
                  type="date"
                  disabled={!canEdit}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-[11px] text-slate-600">
                وقت البدء
                <input
                  type="time"
                  disabled={!canEdit}
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <label className="block text-[11px] text-slate-600">
                المدة
                <select
                  disabled={!canEdit}
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                  className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} دقيقة
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeItem.kind === 'task' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="block text-[11px] text-slate-600">
                  الحالة
                  <select
                    disabled={!canEdit}
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as UnifiedTaskStatus)
                    }
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="todo">قيد الانتظار</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="done">مكتملة</option>
                  </select>
                </label>
                <label className="block text-[11px] text-slate-600">
                  الأولوية
                  <select
                    disabled={!canEdit}
                    value={editPriority}
                    onChange={(e) =>
                      setEditPriority(e.target.value as TaskPriority)
                    }
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="high">عالية</option>
                    <option value="medium">متوسطة</option>
                    <option value="low">منخفضة</option>
                  </select>
                </label>
                <label className="block text-[11px] text-slate-600">
                  موعد نهائي
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-[11px] text-slate-600">
                  الربط (مشروع / كورس / مسار)
                  <select
                    disabled={!canEdit}
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">بدون ربط</option>
                    {editProjectId &&
                      !projects.some((p) => p.id === editProjectId) &&
                      !courses.some((c) => `course:${c.id}` === editProjectId) &&
                      !learningPaths.some((lp) => `path:${lp.id}` === editProjectId) && (
                        <option value={editProjectId}>
                          {activeItem.kind === 'task' && activeItem.raw.linkedLabel
                            ? `مرتبط: ${activeItem.raw.linkedLabel}`
                            : editProjectId}
                        </option>
                      )}
                    {projects.length > 0 && (
                      <optgroup label="المشاريع">
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {courses.length > 0 && (
                      <optgroup label="الكورسات">
                        {courses.map((c) => (
                          <option key={`course:${c.id}`} value={`course:${c.id}`}>
                            {c.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {learningPaths.length > 0 && (
                      <optgroup label="المسارات التعليمية">
                        {learningPaths.map((lp) => (
                          <option key={`path:${lp.id}`} value={`path:${lp.id}`}>
                            {lp.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
              </div>
            )}

            {activeItem.kind === 'event' && (
              <div className="grid grid-cols-2 gap-2 items-center">
                <label className="block text-[11px] text-slate-600">
                  التصنيف
                  <select
                    disabled={!canEdit}
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(e.target.value as CalendarCategory)
                    }
                    className="mt-1 w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center justify-end gap-1.5 pt-4">
                  {(Object.keys(COLOR_STYLES) as CalendarColor[]).map((col) => (
                    <button
                      key={col}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setEditColor(col)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer ${
                        editColor === col
                          ? 'border-slate-900 ring-2 ring-slate-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${COLOR_STYLES[col].dot}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              rows={3}
              readOnly={!canEdit}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="ملاحظات وتفاصيل..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {canEdit && activeItem.kind === 'task' && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateUnifiedTask(activeItem.id, {
                        scheduledDate: '',
                        startTime: '',
                        endTime: '',
                      });
                      setActiveItem(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>إلغاء الجدولة</span>
                  </button>
                )}

                {canEdit && activeItem.kind !== 'meeting' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDelete({
                        kind: activeItem.kind,
                        id: activeItem.id,
                        title: activeItem.title,
                      });
                      setActiveItem(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                )}

                {activeItem.kind === 'meeting' && onOpenMeetingsSection && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveItem(null);
                      onOpenMeetingsSection();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>إدارة السلسلة والمتابعات</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إغلاق
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ التعديلات</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="تأكيد الحذف"
        message={`هل تريد حذف «${pendingDelete?.title}» نهائيًا؟`}
        confirmLabel="حذف"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            if (pendingDelete.kind === 'task') {
              onDeleteUnifiedTask(pendingDelete.id);
            } else {
              onDeleteEvent(pendingDelete.id);
            }
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
