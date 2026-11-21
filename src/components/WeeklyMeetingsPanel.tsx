import { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  ListTodo,
  Lock,
  Plus,
  Repeat,
  Save,
  Square,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  CalendarColor,
  LEARNING_HUBS,
  LearningHubId,
  MeetingAttendanceStatus,
  UnifiedTask,
  WeeklyMeeting,
  WeeklyMeetingOccurrence,
  addDaysToDateKey,
  computeEndTimeFromMinutes,
  expandWeeklyMeetingsInRange,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';
import ConfirmDialog from './ConfirmDialog';

interface WeeklyMeetingsPanelProps {
  canEdit: boolean;
  onRequireAuth: () => void;
  meetings: WeeklyMeeting[];
  onAddMeeting: (meeting: Omit<WeeklyMeeting, 'id'>) => void;
  onUpdateMeeting: (id: string, updates: Partial<WeeklyMeeting>) => void;
  onDeleteMeeting: (id: string) => void;
  onCreateTaskFromFollowUp?: (task: Omit<UnifiedTask, 'id'>) => string | void;
  onOpenCalendar?: () => void;
}

const ATTENDANCE_LABELS: Record<
  MeetingAttendanceStatus,
  { label: string; badge: string }
> = {
  pending: {
    label: 'قيد الانتظار',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  attended: {
    label: 'حاضر / منجز',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  excused: {
    label: 'معتذر',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  missed: {
    label: 'غائب',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

const COLOR_BADGE: Record<CalendarColor, string> = {
  navy: 'bg-[#1E3A5F]',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-500',
  rose: 'bg-rose-600',
};

function formatShortArabicDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString('ar-EG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateKey;
  }
}

export default function WeeklyMeetingsPanel({
  canEdit,
  onRequireAuth,
  meetings,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  onCreateTaskFromFollowUp,
  onOpenCalendar,
}: WeeklyMeetingsPanelProps) {
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const [filterMode, setFilterMode] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hubId, setHubId] = useState<LearningHubId>('knowledge');
  const [startDate, setStartDate] = useState(todayKey);
  const [startTime, setStartTime] = useState('19:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isRecurringWeekly, setIsRecurringWeekly] = useState(true);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [color, setColor] = useState<CalendarColor>('navy');

  // Expanded occurrences window: [-28 days, +56 days]
  const occurrences = useMemo(() => {
    const startWindow = addDaysToDateKey(todayKey, -28);
    const endWindow = addDaysToDateKey(todayKey, 56);
    const all = expandWeeklyMeetingsInRange(meetings, startWindow, endWindow);
    if (filterMode === 'upcoming') {
      return all.filter((o) => o.dateKey >= todayKey);
    }
    if (filterMode === 'past') {
      return all.filter((o) => o.dateKey < todayKey).reverse();
    }
    return all;
  }, [meetings, todayKey, filterMode]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const clampedIdx =
    occurrences.length === 0
      ? 0
      : Math.max(0, Math.min(selectedIndex, occurrences.length - 1));
  const activeOccurrence: WeeklyMeetingOccurrence | null =
    occurrences[clampedIdx] ?? null;

  // Notes & follow-up draft for selected occurrence
  const [noteDraftMap, setNoteDraftMap] = useState<Record<string, string>>({});
  const [newFollowUpText, setNewFollowUpText] = useState('');

  // Edit modal / inline panel
  const [editingOcc, setEditingOcc] = useState<WeeklyMeetingOccurrence | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editDesc, setEditDesc] = useState('');
  const [editRecurring, setEditRecurring] = useState(true);
  const [editEndDate, setEditEndDate] = useState('');

  const [pendingDelete, setPendingDelete] = useState<WeeklyMeeting | null>(null);

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const dt = new Date(`${startDate || todayKey}T00:00:00`);
    const dayOfWeek = Number.isNaN(dt.getTime()) ? 6 : dt.getDay();
    const endTime = computeEndTimeFromMinutes(startTime, durationMinutes);

    onAddMeeting({
      title: cleanTitle,
      description: description.trim(),
      hubId,
      startDate: startDate || todayKey,
      dayOfWeek,
      startTime,
      endTime,
      durationMinutes,
      isRecurringWeekly,
      recurrenceEndDate: isRecurringWeekly ? recurrenceEndDate : '',
      color,
      status: 'scheduled',
      completedDates: [],
      attendanceByDate: {},
      notesByDate: {},
      followUps: [],
      linkedTaskIds: [],
      exceptions: {},
    });

    setTitle('');
    setDescription('');
    setRecurrenceEndDate('');
    setShowAddForm(false);
    setFilterMode('upcoming');
    setSelectedIndex(0);
  };

  const toggleOccurrenceComplete = (occ: WeeklyMeetingOccurrence) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const prev = occ.meeting.completedDates || [];
    const isNowDone = !prev.includes(occ.occurrenceKey);
    const nextDates = isNowDone
      ? [...prev, occ.occurrenceKey]
      : prev.filter((d) => d !== occ.occurrenceKey);
    const nextAttendance: Record<string, MeetingAttendanceStatus> = {
      ...(occ.meeting.attendanceByDate || {}),
      [occ.occurrenceKey]: isNowDone
        ? 'attended'
        : occ.attendance === 'attended'
        ? 'pending'
        : occ.attendance,
    };
    onUpdateMeeting(occ.meeting.id, {
      completedDates: nextDates,
      attendanceByDate: nextAttendance,
    });
  };

  const handleSetAttendance = (
    occ: WeeklyMeetingOccurrence,
    status: MeetingAttendanceStatus
  ) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const prevDone = occ.meeting.completedDates || [];
    const nextDates =
      status === 'attended'
        ? Array.from(new Set([...prevDone, occ.occurrenceKey]))
        : prevDone.filter((d) => d !== occ.occurrenceKey);
    onUpdateMeeting(occ.meeting.id, {
      attendanceByDate: {
        ...(occ.meeting.attendanceByDate || {}),
        [occ.occurrenceKey]: status,
      },
      completedDates: nextDates,
    });
  };

  const handleSaveOccurrenceNote = (occ: WeeklyMeetingOccurrence) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const key = `${occ.meeting.id}:${occ.occurrenceKey}`;
    const text = noteDraftMap[key] ?? occ.notes;
    onUpdateMeeting(occ.meeting.id, {
      notesByDate: {
        ...(occ.meeting.notesByDate || {}),
        [occ.occurrenceKey]: text.trim(),
      },
    });
  };

  const handleAddFollowUp = (occ: WeeklyMeetingOccurrence) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = newFollowUpText.trim();
    if (!clean) return;
    const nextFollowUps = [
      ...(occ.meeting.followUps || []),
      {
        id: `fu_${Date.now().toString(36)}`,
        text: clean,
        done: false,
        occurrenceDate: occ.occurrenceKey,
      },
    ];
    onUpdateMeeting(occ.meeting.id, { followUps: nextFollowUps });
    setNewFollowUpText('');
  };

  const handleToggleFollowUp = (occ: WeeklyMeetingOccurrence, followUpId: string) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const nextFollowUps = (occ.meeting.followUps || []).map((f) =>
      f.id === followUpId ? { ...f, done: !f.done } : f
    );
    onUpdateMeeting(occ.meeting.id, { followUps: nextFollowUps });
  };

  const handleConvertFollowUpToTask = (
    occ: WeeklyMeetingOccurrence,
    followUpId: string,
    text: string
  ) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    if (!onCreateTaskFromFollowUp) return;
    const createdId = onCreateTaskFromFollowUp({
      title: text,
      description: `من متابعة الاجتماع الأسبوعي: ${occ.title} (${occ.dateKey})`,
      hubId: occ.meeting.hubId,
      categoryLabel: 'اجتماع أسبوعي',
      priority: 'medium',
      status: 'todo',
      dueDate: occ.dateKey,
      scheduledDate: '',
      linkedLabel: occ.title,
    });
    if (typeof createdId === 'string' && createdId) {
      const nextFollowUps = (occ.meeting.followUps || []).map((f) =>
        f.id === followUpId ? { ...f, linkedTaskId: createdId } : f
      );
      onUpdateMeeting(occ.meeting.id, {
        followUps: nextFollowUps,
        linkedTaskIds: Array.from(
          new Set([...(occ.meeting.linkedTaskIds || []), createdId])
        ),
      });
    }
  };

  const openEditModal = (occ: WeeklyMeetingOccurrence) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setEditingOcc(occ);
    setEditTitle(occ.title);
    setEditDate(occ.dateKey);
    setEditTime(occ.startTime);
    setEditDuration(occ.durationMinutes);
    setEditDesc(occ.meeting.description);
    setEditRecurring(occ.meeting.isRecurringWeekly);
    setEditEndDate(occ.meeting.recurrenceEndDate || '');
  };

  const handleSaveEdit = (scope: 'single' | 'series') => {
    if (!editingOcc) return;
    const cleanTitle = editTitle.trim() || editingOcc.title;
    const endTime = computeEndTimeFromMinutes(editTime, editDuration);

    if (scope === 'single' && editingOcc.meeting.isRecurringWeekly) {
      onUpdateMeeting(editingOcc.meeting.id, {
        exceptions: {
          ...(editingOcc.meeting.exceptions || {}),
          [editingOcc.occurrenceKey]: {
            ...(editingOcc.meeting.exceptions?.[editingOcc.occurrenceKey] || {}),
            title: cleanTitle,
            movedDateKey: editDate,
            startTime: editTime,
            endTime,
            durationMinutes: editDuration,
          },
        },
      });
    } else {
      const dt = new Date(`${editDate || editingOcc.meeting.startDate}T00:00:00`);
      onUpdateMeeting(editingOcc.meeting.id, {
        title: cleanTitle,
        description: editDesc.trim(),
        startDate: editDate || editingOcc.meeting.startDate,
        dayOfWeek: Number.isNaN(dt.getTime())
          ? editingOcc.meeting.dayOfWeek
          : dt.getDay(),
        startTime: editTime,
        endTime,
        durationMinutes: editDuration,
        isRecurringWeekly: editRecurring,
        recurrenceEndDate: editRecurring ? editEndDate : '',
      });
    }
    setEditingOcc(null);
  };

  const activeNoteKey = activeOccurrence
    ? `${activeOccurrence.meeting.id}:${activeOccurrence.occurrenceKey}`
    : '';
  const activeNoteValue = activeOccurrence
    ? noteDraftMap[activeNoteKey] ?? activeOccurrence.notes
    : '';

  return (
    <section
      aria-labelledby="weekly-meetings-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
            <span>اللقاءات والاجتماعات الأسبوعية التفاعلية</span>
          </div>
          <h2
            id="weekly-meetings-heading"
            className="font-editorial text-xl sm:text-2xl font-bold text-slate-900"
          >
            اجتماعات المتابعة الأسبوعية
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>عرض في التقويم</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!canEdit) {
                onRequireAuth();
                return;
              }
              setShowAddForm((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showAddForm ? 'إغلاق النموذج' : 'إضافة اجتماع'}</span>
          </button>
        </div>
      </div>

      {/* Add Meeting Form */}
      {showAddForm && canEdit && (
        <form
          onSubmit={handleCreateMeeting}
          className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-1">
              عنوان الاجتماع (مطلوب)
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: جلسة مراجعة الخطة والمناقشة"
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المجال
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value as LearningHubId)}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {LEARNING_HUBS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-700">
              تاريخ البداية
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              وقت البدء
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المدة
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value={30}>30 دقيقة</option>
                <option value={45}>45 دقيقة</option>
                <option value={60}>60 دقيقة (ساعة)</option>
                <option value={90}>90 دقيقة</option>
                <option value={120}>120 دقيقة (ساعتان)</option>
              </select>
            </label>

            <div className="flex flex-col justify-end gap-1.5">
              <span className="text-xs font-medium text-slate-700">التكرار الأسبوعي</span>
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurringWeekly}
                  onChange={(e) => setIsRecurringWeekly(e.target.checked)}
                  className="accent-[#1E3A5F]"
                />
                <Repeat className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>يتكرر كل أسبوع</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
            {isRecurringWeekly && (
              <label className="block text-xs font-medium text-slate-700">
                تاريخ انتهاء التكرار (اختياري)
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </label>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">اللون:</span>
              {(['navy', 'emerald', 'amber', 'rose'] as CalendarColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer ${
                    color === c ? 'border-slate-900 ring-2 ring-slate-300' : 'border-slate-200'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${COLOR_BADGE[c]}`} />
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            محاور الاجتماع أو وصف مختصر (اختياري)
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="جدول الأعمال أو نقاط النقاش الأساسية..."
              className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حفظ الاجتماع</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs + Previous / Next Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
          {(
            [
              { id: 'upcoming', label: 'القادمة واليوم' },
              { id: 'past', label: 'السابقة' },
              { id: 'all', label: 'الكل' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterMode(tab.id);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-white text-[#1E3A5F] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {occurrences.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              disabled={clampedIdx <= 0}
              onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              aria-label="الاجتماع السابق"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="px-2 text-slate-600 tabular-nums font-medium">
              {clampedIdx + 1} / {occurrences.length}
            </span>
            <button
              type="button"
              disabled={clampedIdx >= occurrences.length - 1}
              onClick={() =>
                setSelectedIndex((i) => Math.min(occurrences.length - 1, i + 1))
              }
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              aria-label="الاجتماع التالي"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Empty State vs Interactive Meeting Workspace */}
      {occurrences.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
          <CalendarPlus className="w-8 h-8 text-[#1E3A5F]/70 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            {meetings.length === 0
              ? 'لا توجد اجتماعات أسبوعية مضافة بعد'
              : 'لا توجد جلسات ضمن هذه التصفية'}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            أضف جلساتك الأسبوعية أو لقاءات المتابعة مع شريك التعلم لتتبع الحضور والملاحظات وبنود المتابعة تلقائيًا في لوحة التحكم والتقويم.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!canEdit) {
                onRequireAuth();
                return;
              }
              setShowAddForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>جدولة اجتماع أسبوعي</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Upcoming / Past Occurrences Strip */}
          <div className="lg:col-span-5 space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
            {occurrences.map((occ, idx) => {
              const isSelected = idx === clampedIdx;
              const isToday = occ.dateKey === todayKey;
              const attMeta = ATTENDANCE_LABELS[occ.attendance];
              const hubMeta = getHubMeta(occ.meeting.hubId);
              return (
                <button
                  key={`${occ.meeting.id}-${occ.occurrenceKey}`}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-right p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-slate-50 border-[#1E3A5F] ring-1 ring-[#1E3A5F]/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          COLOR_BADGE[occ.meeting.color]
                        }`}
                      />
                      <span
                        className={`text-sm font-bold truncate ${
                          occ.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        {occ.title}
                      </span>
                    </div>
                    {occ.meeting.isRecurringWeekly && (
                      <Repeat
                        className="w-3.5 h-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-[#1E3A5F] tabular-nums">
                      {isToday ? 'اليوم' : formatShortArabicDate(occ.dateKey)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {occ.startTime}–{occ.endTime}
                    </span>
                    <span>· {hubMeta.shortTitle}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium border rounded ${attMeta.badge}`}>
                      {attMeta.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Occurrence Details, Attendance, Notes & Follow-ups */}
          {activeOccurrence && (
            <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-[#1E3A5F]">
                      {formatShortArabicDate(activeOccurrence.dateKey)}
                    </span>
                    <span className="tabular-nums">
                      {activeOccurrence.startTime} — {activeOccurrence.endTime} (
                      {activeOccurrence.durationMinutes} د)
                    </span>
                    {activeOccurrence.meeting.isRecurringWeekly && (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Repeat className="w-3 h-3" aria-hidden="true" />
                        <span>أسبوعي</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {activeOccurrence.title}
                  </h3>
                  {activeOccurrence.meeting.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {activeOccurrence.meeting.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleOccurrenceComplete(activeOccurrence)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      activeOccurrence.completed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{activeOccurrence.completed ? 'مكتمل' : 'إتمام الجلسة'}</span>
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(activeOccurrence)}
                        aria-label="تعديل الاجتماع"
                        className="p-2 text-slate-500 hover:text-[#1E3A5F] bg-white border border-slate-200 rounded-lg cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(activeOccurrence.meeting)}
                        aria-label="حذف الاجتماع"
                        className="p-2 text-slate-500 hover:text-red-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Attendance Status Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>حالة الحضور والمشاركة لهذه الجلسة:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ATTENDANCE_LABELS) as MeetingAttendanceStatus[]).map(
                    (st) => {
                      const active = activeOccurrence.attendance === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleSetAttendance(activeOccurrence, st)}
                          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                            active
                              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ATTENDANCE_LABELS[st].label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Occurrence Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    ملاحظات ومحضر هذه الجلسة
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleSaveOccurrenceNote(activeOccurrence)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      <Save className="w-3 h-3" aria-hidden="true" />
                      <span>حفظ الملاحظة</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  readOnly={!canEdit}
                  value={activeNoteValue}
                  onChange={(e) =>
                    setNoteDraftMap((prev) => ({
                      ...prev,
                      [activeNoteKey]: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    if (canEdit && noteDraftMap[activeNoteKey] !== undefined) {
                      handleSaveOccurrenceNote(activeOccurrence);
                    }
                  }}
                  placeholder="أبرز النقاط التي نوقشت أو القرارات..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              {/* Follow-up Actions + Convert to UnifiedTask */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>إجراءات المتابعة والمخرجات</span>
                </span>

                {(activeOccurrence.meeting.followUps || []).length > 0 && (
                  <div className="space-y-1.5">
                    {activeOccurrence.meeting.followUps.map((fu) => (
                      <div
                        key={fu.id}
                        className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFollowUp(activeOccurrence, fu.id)
                          }
                          className="flex items-center gap-2 text-right flex-1 min-w-0 cursor-pointer"
                        >
                          {fu.done ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span
                            className={`text-xs truncate ${
                              fu.done
                                ? 'line-through text-slate-400'
                                : 'text-slate-800'
                            }`}
                          >
                            {fu.text}
                          </span>
                        </button>
                        {onCreateTaskFromFollowUp && (
                          <button
                            type="button"
                            disabled={Boolean(fu.linkedTaskId)}
                            onClick={() =>
                              handleConvertFollowUpToTask(
                                activeOccurrence,
                                fu.id,
                                fu.text
                              )
                            }
                            className={`px-2 py-1 text-[10px] font-semibold rounded border shrink-0 cursor-pointer ${
                              fu.linkedTaskId
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-default'
                                : 'bg-slate-50 text-[#1E3A5F] border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {fu.linkedTaskId ? 'تم الربط بمهمة ✓' : 'تحويل لمهمة ←'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canEdit && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFollowUpText}
                      onChange={(e) => setNewFollowUpText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFollowUp(activeOccurrence);
                        }
                      }}
                      placeholder="أضف خطوة متابعة جديدة..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFollowUp(activeOccurrence)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                    >
                      إضافة
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Single Occurrence OR Series Modal */}
      {editingOcc && (
        <div
          className="fixed inset-0 z-[75] bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingOcc(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                تعديل الاجتماع الأسبوعي
              </h3>
              <button
                type="button"
                onClick={() => setEditingOcc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-medium text-slate-700">
                عنوان الاجتماع
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block font-medium text-slate-700">
                  التاريخ
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block font-medium text-slate-700">
                  الوقت
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="mt-1 w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block font-medium text-slate-700">
                  المدة (د)
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value) || 60)}
                    className="mt-1 w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editRecurring}
                  onChange={(e) => setEditRecurring(e.target.checked)}
                  className="accent-[#1E3A5F]"
                />
                <span>اجتماع أسبوعي متكرر</span>
              </label>
              {editRecurring && (
                <label className="block font-medium text-slate-700">
                  تاريخ انتهاء التكرار (اختياري)
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              )}
              <label className="block font-medium text-slate-700">
                الوصف / المحاور
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
              {editingOcc.meeting.isRecurringWeekly && (
                <button
                  type="button"
                  onClick={() => handleSaveEdit('single')}
                  className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  حفظ لهذه الجلسة فقط
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveEdit('series')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                {editingOcc.meeting.isRecurringWeekly
                  ? 'حفظ للسلسلة كلها'
                  : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canEdit && meetings.length > 0 && (
        <p className="text-[11px] text-amber-800 inline-flex items-center gap-1">
          <Lock className="w-3 h-3" aria-hidden="true" />
          <span>سجّل الدخول لتعديل أو إضافة الاجتماعات.</span>
        </p>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="تأكيد حذف الاجتماع"
        message={`هل تريد حذف الاجتماع «${pendingDelete?.title ?? ''}» نهائيًا؟`}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteMeeting(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
