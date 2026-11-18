import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  ListTodo,
  Lock,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import {
  CalendarCategory,
  CalendarColor,
  CalendarEvent,
  MonthPlan,
  PersonalCourse,
} from '../data/curriculumData';

interface CalendarViewProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  events: CalendarEvent[];
  months: MonthPlan[];
  courses: PersonalCourse[];
  onAddEvent: (payload: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent: (id: string) => void;
  onJumpToMonth: (monthId: number) => void;
}

const WEEKDAYS_AR = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

const CATEGORIES: CalendarCategory[] = [
  'شخصي',
  'موعد',
  'دراسة',
  'مراجعة',
  'قراءة',
];

const COLOR_STYLES: Record<
  CalendarColor,
  { label: string; dot: string; chip: string; border: string }
> = {
  navy: {
    label: 'كحلي',
    dot: 'bg-[#1E3A5F]',
    chip: 'bg-slate-100 text-[#1E3A5F] border-slate-200',
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

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Saturday-first weekday index (0 = Saturday ... 6 = Friday)
function getSatFirstIndex(d: Date): number {
  return (d.getDay() + 1) % 7;
}

function formatArabicMonthYear(d: Date): string {
  try {
    return d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  } catch {
    return `${d.getMonth() + 1}/${d.getFullYear()}`;
  }
}

function formatArabicFullDate(dateKey: string): string {
  try {
    const d = parseDateKey(dateKey);
    return d.toLocaleDateString('ar-EG', {
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

export default function CalendarView({
  canEdit,
  onRequireAuth,
  events,
  months,
  courses,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onJumpToMonth,
}: CalendarViewProps) {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [syncTasksEnabled, setSyncTasksEnabled] = useState<boolean>(false);

  // Add event state
  const [title, setTitle] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [category, setCategory] = useState<CalendarCategory>('شخصي');
  const [color, setColor] = useState<CalendarColor>('navy');
  const [notes, setNotes] = useState('');
  const [linkedTaskText, setLinkedTaskText] = useState('');

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.dateKey]) map[ev.dateKey] = [];
      map[ev.dateKey].push(ev);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) =>
        (a.timeSlot || '99:99').localeCompare(b.timeSlot || '99:99')
      );
    }
    return map;
  }, [events]);

  // Pending tasks from plan & courses for optional calendar sync
  const pendingPlanTasks = useMemo(() => {
    const list: Array<{
      id: string;
      sourceLabel: string;
      text: string;
      monthId?: number;
    }> = [];
    for (const m of months) {
      for (const t of m.tasks) {
        if (!t.done) {
          list.push({
            id: `m-${m.id}-${t.id}`,
            sourceLabel: `الوحدة ${m.id}`,
            text: t.text,
            monthId: m.id,
          });
        }
      }
    }
    for (const c of courses) {
      for (const t of c.tasks) {
        if (!t.done) {
          list.push({
            id: `c-${c.id}-${t.id}`,
            sourceLabel: c.title,
            text: t.text,
          });
        }
      }
    }
    return list;
  }, [months, courses]);

  // Monthly calendar cells (6 rows x 7 cols = 42 cells, Saturday-first)
  const monthCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = getSatFirstIndex(firstOfMonth);
    const gridStart = new Date(year, month, 1 - startOffset);

    const cells: Array<{ date: Date; dateKey: string; inCurrentMonth: boolean }> =
      [];
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      cells.push({
        date: cellDate,
        dateKey: toDateKey(cellDate),
        inCurrentMonth: cellDate.getMonth() === month,
      });
    }
    return cells;
  }, [cursorDate]);

  // Weekly calendar days (7 days starting Saturday of cursorDate's week)
  const weekDays = useMemo(() => {
    const startOffset = getSatFirstIndex(cursorDate);
    const weekStart = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      cursorDate.getDate() - startOffset
    );
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + i
      );
      return {
        date: d,
        dateKey: toDateKey(d),
        dayName: WEEKDAYS_AR[i],
      };
    });
  }, [cursorDate]);

  const selectedDayEvents = eventsByDate[selectedDateKey] ?? [];

  const handleNavigate = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      setCursorDate(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
      );
    } else {
      setCursorDate(
        (prev) =>
          new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + direction * 7)
      );
    }
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDateKey(toDateKey(now));
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    onAddEvent({
      dateKey: selectedDateKey,
      timeSlot: timeSlot.trim(),
      title: cleanTitle,
      notes: notes.trim(),
      category,
      color,
      done: false,
      linkedTaskText: linkedTaskText.trim(),
    });

    setTitle('');
    setTimeSlot('');
    setNotes('');
    setLinkedTaskText('');
  };

  const handleQuickScheduleTask = (task: {
    sourceLabel: string;
    text: string;
  }) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    onAddEvent({
      dateKey: selectedDateKey,
      timeSlot: '',
      title: task.text,
      notes: `مهمة مجدولة من ${task.sourceLabel}`,
      category: 'دراسة',
      color: 'emerald',
      done: false,
      linkedTaskText: `${task.sourceLabel}: ${task.text}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs text-slate-500">
            التقويم الشخصي والجدول الدراسي · عرض أسبوعي وشهري مرن
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            التقويم والمواعيد
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            تقويم عادي لحياتك ومواعيدك اليومية بالعرضين الشهري والأسبوعي، مع خيار تفعيل ربط المهام الدراسية متى أردت.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Monthly / Weekly Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white text-[#1E3A5F] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تقويم شهري</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-[#1E3A5F] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تقويم أسبوعي</span>
            </button>
          </div>

          {/* Optional Task Sync Switch */}
          <button
            type="button"
            onClick={() => setSyncTasksEnabled((v) => !v)}
            aria-pressed={syncTasksEnabled}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              syncTasksEnabled
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {syncTasksEnabled
                ? 'ربط المهام بالتقويم: مفعّل'
                : 'تفعيل سماع المهام في التقويم'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigate(-1)}
            aria-label={viewMode === 'month' ? 'الشهر السابق' : 'الأسبوع السابق'}
            className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleJumpToday}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => handleNavigate(1)}
            aria-label={viewMode === 'month' ? 'الشهر التالي' : 'الأسبوع التالي'}
            className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <h2 className="font-editorial text-xl font-bold text-slate-900">
          {viewMode === 'month'
            ? formatArabicMonthYear(cursorDate)
            : `الأسبوع: ${formatArabicShortDay(weekDays[0].date)} — ${formatArabicShortDay(weekDays[6].date)}`}
        </h2>

        <span className="text-xs text-slate-500 tabular-nums">
          إجمالي المواعيد المسجلة: {events.length}
        </span>
      </div>

      {/* Main Grid: Calendar Surface + Selected Day Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main: Monthly OR Weekly Grid */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {viewMode === 'month' ? (
            <div>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {WEEKDAYS_AR.map((day) => (
                  <div
                    key={day}
                    className="py-2.5 text-center text-[11px] font-semibold text-slate-600 border-l last:border-l-0 border-slate-200"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 42 Month Cells */}
              <div className="grid grid-cols-7">
                {monthCells.map((cell) => {
                  const dayEvents = eventsByDate[cell.dateKey] ?? [];
                  const isToday = cell.dateKey === todayKey;
                  const isSelected = cell.dateKey === selectedDateKey;

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(cell.dateKey);
                        if (!cell.inCurrentMonth) {
                          setCursorDate(cell.date);
                        }
                      }}
                      className={`min-h-[96px] sm:min-h-[110px] p-1.5 sm:p-2 border-b border-l border-slate-200 text-right flex flex-col justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100/90 ring-2 ring-inset ring-[#1E3A5F]'
                          : cell.inCurrentMonth
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-slate-50/60 text-slate-400 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
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
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1 w-full">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const style = COLOR_STYLES[ev.color] ?? COLOR_STYLES.navy;
                          return (
                            <div
                              key={ev.id}
                              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border truncate ${
                                style.chip
                              } ${ev.done ? 'line-through opacity-60' : ''}`}
                            >
                              {ev.timeSlot ? `${ev.timeSlot} ` : ''}
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] font-semibold text-[#1E3A5F] px-1">
                            +{dayEvents.length - 2} أخرى
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* WEEKLY VIEW: 7 Clean Day Columns / Rows */
            <div className="divide-y divide-slate-200">
              {weekDays.map((wd) => {
                const dayEvents = eventsByDate[wd.dateKey] ?? [];
                const isToday = wd.dateKey === todayKey;
                const isSelected = wd.dateKey === selectedDateKey;

                return (
                  <div
                    key={wd.dateKey}
                    className={`p-4 sm:p-5 transition-colors ${
                      isSelected ? 'bg-slate-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDateKey(wd.dateKey)}
                        className="flex items-center gap-2.5 text-right cursor-pointer"
                      >
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg tabular-nums ${
                            isToday
                              ? 'bg-[#1E3A5F] text-white'
                              : isSelected
                              ? 'bg-slate-200 text-slate-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {wd.dayName} · {formatArabicShortDay(wd.date)}
                        </span>
                        {isToday && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            اليوم
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDateKey(wd.dateKey);
                          if (!canEdit) onRequireAuth();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>إضافة في هذا اليوم</span>
                      </button>
                    </div>

                    {dayEvents.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        يوم حر — لا توجد مواعيد مضافة بعد.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {dayEvents.map((ev) => {
                          const style = COLOR_STYLES[ev.color] ?? COLOR_STYLES.navy;
                          return (
                            <div
                              key={ev.id}
                              className={`p-3 rounded-lg border border-slate-200 border-r-4 ${style.border} bg-white flex items-start justify-between gap-2`}
                            >
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() =>
                                  onUpdateEvent(ev.id, { done: !ev.done })
                                }
                                className="flex items-start gap-2 text-right flex-1 min-w-0 cursor-pointer disabled:opacity-75"
                              >
                                {ev.done ? (
                                  <CheckSquare
                                    className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Square
                                    className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                )}
                                <div className="min-w-0 space-y-0.5">
                                  <p
                                    className={`text-xs font-semibold truncate ${
                                      ev.done
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {ev.title}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    <span>{ev.category}</span>
                                    {ev.timeSlot && (
                                      <span className="inline-flex items-center gap-0.5 tabular-nums">
                                        <Clock className="w-3 h-3" aria-hidden="true" />
                                        {ev.timeSlot}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteEvent(ev.id)}
                                  aria-label="حذف الموعد"
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Day Agenda + Add Event Form + Optional Task Sync */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="pb-3 border-b border-slate-200 space-y-1">
              <p className="text-[11px] font-semibold text-[#1E3A5F]">
                تفاصيل اليوم المختار
              </p>
              <h3 className="text-base font-bold text-slate-900">
                {formatArabicFullDate(selectedDateKey)}
              </h3>
            </div>

            {/* Events for Selected Day */}
            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                لا توجد مواعيد في هذا اليوم. أضف موعدًا أو ملاحظة يومية بالأسفل.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                {selectedDayEvents.map((ev) => {
                  const style = COLOR_STYLES[ev.color] ?? COLOR_STYLES.navy;
                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-lg border border-slate-200 border-r-4 ${style.border} bg-slate-50/70 space-y-1.5`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onUpdateEvent(ev.id, { done: !ev.done })}
                          className="flex items-start gap-2 text-right flex-1 min-w-0 cursor-pointer disabled:opacity-75"
                        >
                          {ev.done ? (
                            <CheckSquare
                              className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <Square
                              className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`text-xs font-semibold leading-snug ${
                              ev.done
                                ? 'line-through text-slate-400'
                                : 'text-slate-900'
                            }`}
                          >
                            {ev.title}
                          </span>
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onDeleteEvent(ev.id)}
                            aria-label="حذف"
                            className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pr-6">
                        <span className="font-medium text-slate-700">
                          {ev.category}
                        </span>
                        {ev.timeSlot && (
                          <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {ev.timeSlot}
                          </span>
                        )}
                      </div>

                      {ev.notes && (
                        <p className="text-[11px] text-slate-600 pr-6 leading-relaxed">
                          {ev.notes}
                        </p>
                      )}

                      {ev.linkedTaskText && (
                        <p className="text-[11px] text-[#1E3A5F] pr-6 inline-flex items-center gap-1">
                          <Link2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>مرتبطة بمهمة: {ev.linkedTaskText}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Event Form */}
            <form
              onSubmit={handleCreateEvent}
              className="pt-4 border-t border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  إضافة موعد أو حدث جديد
                </h4>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>للحسابات المسجلة</span>
                  </span>
                )}
              </div>

              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onClick={() => {
                  if (!canEdit) onRequireAuth();
                }}
                readOnly={!canEdit}
                placeholder="عنوان الموعد أو النشاط (مثلاً: لقاء أسبوعي / قراءة حرة)..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] text-slate-600">
                  التصنيف
                  <select
                    value={category}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setCategory(e.target.value as CalendarCategory)
                    }
                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] text-slate-600">
                  الوقت (اختياري)
                  <input
                    type="time"
                    value={timeSlot}
                    disabled={!canEdit}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600">اللون:</span>
                <div className="flex items-center gap-1.5">
                  {(Object.keys(COLOR_STYLES) as CalendarColor[]).map((col) => {
                    const active = color === col;
                    return (
                      <button
                        key={col}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setColor(col)}
                        aria-label={COLOR_STYLES[col].label}
                        className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer ${
                          active
                            ? 'border-slate-900 ring-2 ring-slate-200'
                            : 'border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${COLOR_STYLES[col].dot}`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {syncTasksEnabled && pendingPlanTasks.length > 0 && (
                <label className="block text-[11px] text-slate-600">
                  ربط اختياري بمهمة من الخطة أو الكورسات
                  <select
                    value={linkedTaskText}
                    disabled={!canEdit}
                    onChange={(e) => setLinkedTaskText(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="">— حدث حر بدون ربط بمهمة —</option>
                    {pendingPlanTasks.slice(0, 25).map((pt) => {
                      const val = `${pt.sourceLabel}: ${pt.text}`;
                      return (
                        <option key={pt.id} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              <textarea
                rows={2}
                value={notes}
                readOnly={!canEdit}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية (اختياري)..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة إلى {selectedDateKey}</span>
              </button>
            </form>
          </div>

          {/* Optional Task Sync Panel (When Toggled ON) */}
          {syncTasksEnabled && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#1E3A5F] inline-flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4" aria-hidden="true" />
                  <span>جدولة مهام الخطة والكورسات</span>
                </h3>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {pendingPlanTasks.length} مهمة
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                اضغط «جدولة في هذا اليوم» لنسخ أي مهمة دراسية إلى يوم {selectedDateKey} في تقويمك.
              </p>

              {pendingPlanTasks.length === 0 ? (
                <p className="text-xs text-emerald-700">
                  كل المهام الحالية مكتملة!
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-[260px] overflow-y-auto">
                  {pendingPlanTasks.slice(0, 15).map((task) => (
                    <div
                      key={task.id}
                      className="p-2.5 bg-white flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        {task.monthId ? (
                          <button
                            type="button"
                            onClick={() => onJumpToMonth(task.monthId!)}
                            className="text-[10px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                          >
                            {task.sourceLabel}
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-800 block">
                            {task.sourceLabel}
                          </span>
                        )}
                        <p className="text-xs text-slate-800 leading-snug">
                          {task.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickScheduleTask(task)}
                        className="px-2 py-1 text-[10px] font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        + جدولة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
