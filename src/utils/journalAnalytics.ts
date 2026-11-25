import {
  ActivityLogEntry,
  BlogPost,
  BookNote,
  CalendarEvent,
  CourseStudyStage,
  DentalCase,
  LEARNING_HUBS,
  LearningHubId,
  LearningHubMeta,
  LearningPath,
  MonthPlan,
  PeriodReviewType,
  PersonalCourse,
  PersonalReflection,
  PracticalProject,
  ReadingLibraryItem,
  UnifiedTask,
  WeeklyMeeting,
  WeeklyPlanRecord,
  addDaysToDateKey,
  expandWeeklyMeetingsInRange,
  getHubMeta,
  getMonthRange,
  getQuarterRange,
  getSatFriWeekRange,
  getYearRange,
  resolveCourseStudyStage,
  shiftWeekKey,
  toLocalDateKey,
} from '../data/curriculumData';
import {
  doesTaskOccurOnDate,
  expandTaskOccurrenceDates,
  isTaskCompletedOnDate,
} from './taskRecurrence';

export interface WorkspaceAnalyticsInput {
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  reflections: PersonalReflection[];
  blogPosts: BlogPost[];
  unifiedTasks: UnifiedTask[];
  projects: PracticalProject[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  calendarEvents: CalendarEvent[];
  weeklyMeetings: WeeklyMeeting[];
  dentalCases: DentalCase[];
  months: MonthPlan[];
  activityLogs: ActivityLogEntry[];
  hubs?: LearningHubMeta[];
}

export type JournalNavAction =
  | { type: 'course'; courseId: number }
  | { type: 'note'; noteId: string }
  | { type: 'task'; taskId: string }
  | { type: 'project'; projectId: string }
  | { type: 'path'; pathId: string }
  | { type: 'book'; bookId: string }
  | { type: 'reflection'; reflectionId: string }
  | { type: 'blog'; blogId: string }
  | { type: 'calendar'; dateKey: string }
  | { type: 'month'; monthId: number };

export interface DailyJournalItem {
  key: string; // entityType:entityId
  activityLogId?: string;
  entityType: ActivityLogEntry['entityType'];
  entityId: string;
  title: string;
  subtitle?: string;
  typeLabel: string;
  statusLabel: string;
  statusCategory: 'completed' | 'in_progress' | 'postponed' | 'note' | 'reflection' | 'learning';
  statusTone: 'emerald' | 'blue' | 'amber' | 'slate';
  hubId: LearningHubId;
  hubTitle: string;
  hubAccentHex: string;
  timeLabel: string;
  sortOrderMs: number;
  navAction: JournalNavAction;
}

export interface DailyJournalFilterOptions {
  hiddenActivityIds?: string[];
  hiddenActivityTypes?: ActivityLogEntry['entityType'][];
}

export interface DailyJournalSummary {
  dateKey: string;
  timelineItems: DailyJournalItem[];
  groupedByHub: Array<{
    hubId: LearningHubId;
    hubTitle: string;
    hubAccentHex: string;
    items: DailyJournalItem[];
  }>;
  counts: {
    completed: number;
    inProgress: number;
    postponed: number;
    summariesAndNotes: number;
    reflections: number;
    learningActivities: number;
    total: number;
  };
}

function formatTimeFromMs(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function msToLocalDateKey(ms?: number): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '';
  return toLocalDateKey(new Date(ms));
}

function taskStatusLabel(status: UnifiedTask['status']): {
  label: string;
  category: DailyJournalItem['statusCategory'];
  tone: DailyJournalItem['statusTone'];
} {
  if (status === 'done') {
    return { label: 'مكتملة', category: 'completed', tone: 'emerald' };
  }
  if (status === 'in_progress') {
    return { label: 'قيد التنفيذ', category: 'in_progress', tone: 'blue' };
  }
  if (status === 'postponed') {
    return { label: 'مؤجّلة', category: 'postponed', tone: 'amber' };
  }
  return { label: 'مجدولة', category: 'in_progress', tone: 'slate' };
}

function resolveEntityMeta(
  entityType: ActivityLogEntry['entityType'],
  entityId: string,
  data: WorkspaceAnalyticsInput,
  fallbackTitle: string,
  fallbackSubtitle?: string,
  fallbackHubId?: LearningHubId,
  dateKey?: string
): {
  title: string;
  subtitle?: string;
  hubId: LearningHubId;
  typeLabel: string;
  navAction: JournalNavAction;
  liveStatusLabel?: string;
  liveCategory?: DailyJournalItem['statusCategory'];
  liveTone?: DailyJournalItem['statusTone'];
} {
  if (entityType === 'course') {
    const course = data.courses.find(
      (c) => String(c.id) === entityId || c.docId === entityId
    );
    const stage: CourseStudyStage | undefined = course
      ? resolveCourseStudyStage(course)
      : undefined;
    const liveStatusLabel =
      stage === 'completed'
        ? 'كورس مكتمل'
        : stage === 'deferred'
        ? 'كورس مؤجّل'
        : stage === 'focus_now'
        ? 'قيد التركيز'
        : 'دراسة كورس';
    return {
      title: course?.title || fallbackTitle,
      subtitle: course
        ? `${course.progressPct}% مكتمل${course.instructor ? ` · ${course.instructor}` : ''}`
        : fallbackSubtitle,
      hubId: course?.hubId || fallbackHubId || 'knowledge',
      typeLabel: 'كورس',
      navAction: { type: 'course', courseId: course?.id || Number(entityId) || 0 },
      liveStatusLabel,
      liveCategory:
        stage === 'completed'
          ? 'completed'
          : stage === 'deferred'
          ? 'postponed'
          : 'learning',
      liveTone:
        stage === 'completed'
          ? 'emerald'
          : stage === 'deferred'
          ? 'amber'
          : 'blue',
    };
  }

  if (entityType === 'course_task') {
    const [cidStr, tid] = entityId.split(':');
    const course = data.courses.find((c) => String(c.id) === cidStr);
    const cTask = course?.tasks.find((t) => t.id === tid);
    const done = cTask?.done ?? false;
    return {
      title: cTask?.text || fallbackTitle,
      subtitle: course ? `كورس: ${course.title}` : fallbackSubtitle,
      hubId: course?.hubId || fallbackHubId || 'knowledge',
      typeLabel: 'درس / مهمة كورس',
      navAction: { type: 'course', courseId: course?.id || Number(cidStr) || 0 },
      liveStatusLabel: done ? 'مكتمل' : 'قيد الدراسة',
      liveCategory: done ? 'completed' : 'learning',
      liveTone: done ? 'emerald' : 'blue',
    };
  }

  if (entityType === 'book_note') {
    const note = data.bookNotes.find((n) => n.id === entityId);
    return {
      title: note ? note.lectureTitle || note.bookTitle : fallbackTitle,
      subtitle: note?.courseTitle || note?.author || fallbackSubtitle,
      hubId: note?.hubId || fallbackHubId || 'knowledge',
      typeLabel:
        note?.noteType === 'course_lecture'
          ? 'تلخيص محاضرة'
          : note?.noteType === 'general'
          ? 'ملاحظة'
          : 'تلخيص كتاب',
      navAction: { type: 'note', noteId: note?.id || entityId },
      liveStatusLabel: 'تلخيص ومراجعة',
      liveCategory: 'note',
      liveTone: 'blue',
    };
  }

  if (entityType === 'reflection') {
    const refl = data.reflections.find((r) => r.id === entityId);
    return {
      title: refl?.title || fallbackTitle,
      subtitle: refl ? `${refl.moodTag}${refl.categoryTag ? ` · ${refl.categoryTag}` : ''}` : fallbackSubtitle,
      hubId: fallbackHubId || 'knowledge',
      typeLabel: 'خاطرة وتأمل',
      navAction: { type: 'reflection', reflectionId: refl?.id || entityId },
      liveStatusLabel: refl?.moodTag || 'خاطرة',
      liveCategory: 'reflection',
      liveTone: 'slate',
    };
  }

  if (entityType === 'blog_post') {
    const post = data.blogPosts.find((p) => p.id === entityId);
    return {
      title: post?.title || fallbackTitle,
      subtitle: post?.categoryLabel || fallbackSubtitle,
      hubId: fallbackHubId || 'knowledge',
      typeLabel: 'مقال ومدونة',
      navAction: { type: 'blog', blogId: post?.id || entityId },
      liveStatusLabel: post?.isPublic ? 'منشور' : 'مسودة مقال',
      liveCategory: 'note',
      liveTone: 'blue',
    };
  }

  if (entityType === 'task') {
    const task = data.unifiedTasks.find((t) => t.id === entityId);
    const effectiveStatus: UnifiedTask['status'] | undefined = task
      ? task.recurrence && task.recurrence.frequency !== 'none' && dateKey
        ? isTaskCompletedOnDate(task, dateKey)
          ? 'done'
          : task.status === 'done'
          ? 'todo'
          : task.status
        : task.status
      : undefined;
    const meta = effectiveStatus ? taskStatusLabel(effectiveStatus) : null;
    return {
      title: task?.title || fallbackTitle,
      subtitle: task?.linkedLabel || task?.categoryLabel || fallbackSubtitle,
      hubId: task?.hubId || fallbackHubId || 'knowledge',
      typeLabel: 'مهمة',
      navAction: { type: 'task', taskId: task?.id || entityId },
      liveStatusLabel: meta?.label,
      liveCategory: meta?.category,
      liveTone: meta?.tone,
    };
  }

  if (entityType === 'project') {
    const proj = data.projects.find((p) => p.id === entityId);
    const done = proj?.status === 'completed';
    return {
      title: proj?.title || fallbackTitle,
      subtitle: proj ? `${proj.progressPct}% إنجاز` : fallbackSubtitle,
      hubId: proj?.hubId || fallbackHubId || 'knowledge',
      typeLabel: 'مشروع تطبيقي',
      navAction: { type: 'project', projectId: proj?.id || entityId },
      liveStatusLabel: done ? 'مشروع مكتمل' : proj?.status === 'in_progress' ? 'قيد التنفيذ' : 'مخطط',
      liveCategory: done ? 'completed' : 'learning',
      liveTone: done ? 'emerald' : 'blue',
    };
  }

  if (entityType === 'learning_path') {
    if (entityId.startsWith('recovery-')) {
      const parts = entityId.split(':');
      const targetPathId = parts[1] || '';
      const path = data.learningPaths.find((p) => p.id === targetPathId);
      const isTool = entityId.startsWith('recovery-tool:');
      const isService = entityId.startsWith('recovery-service:');
      return {
        title: fallbackTitle,
        subtitle: fallbackSubtitle || (path ? `مسار ${path.title}` : undefined),
        hubId: path?.hubId || fallbackHubId || 'knowledge',
        typeLabel: isTool
          ? 'أداة تعافي'
          : isService
          ? 'خدمة تعافي'
          : 'مورد تعافي',
        navAction: { type: 'path', pathId: path?.id || targetPathId },
        liveStatusLabel: isService ? 'تم إنجاز الخدمة' : 'تمت الممارسة',
        liveCategory: 'completed',
        liveTone: 'emerald',
      };
    }
    const path = data.learningPaths.find((p) => p.id === entityId);
    const done = path?.status === 'completed';
    return {
      title: path?.title || fallbackTitle,
      subtitle: path ? `${path.progressPct}% من المسار` : fallbackSubtitle,
      hubId: path?.hubId || fallbackHubId || 'knowledge',
      typeLabel: 'مسار تعلّم',
      navAction: { type: 'path', pathId: path?.id || entityId },
      liveStatusLabel: done ? 'مسار مكتمل' : 'تقدّم في المسار',
      liveCategory: done ? 'completed' : 'learning',
      liveTone: done ? 'emerald' : 'blue',
    };
  }

  if (entityType === 'reading_item') {
    const book = data.readingItems.find((b) => b.id === entityId);
    const done = book?.status === 'completed';
    return {
      title: book?.title || fallbackTitle,
      subtitle: book?.author || fallbackSubtitle,
      hubId: book?.hubId || fallbackHubId || 'knowledge',
      typeLabel: book?.itemType || 'كتاب',
      navAction: { type: 'book', bookId: book?.id || entityId },
      liveStatusLabel: done ? 'تمت القراءة' : book?.status === 'reading' ? 'قيد القراءة' : 'للقراءة',
      liveCategory: done ? 'completed' : 'learning',
      liveTone: done ? 'emerald' : 'blue',
    };
  }

  if (entityType === 'calendar_event') {
    const ev = data.calendarEvents.find((e) => e.id === entityId);
    return {
      title: ev?.title || fallbackTitle,
      subtitle: ev?.timeSlot ? `الساعة ${ev.timeSlot}` : fallbackSubtitle,
      hubId: fallbackHubId || 'knowledge',
      typeLabel: 'حدث تقويمي',
      navAction: { type: 'calendar', dateKey: ev?.dateKey || toLocalDateKey() },
      liveStatusLabel: ev?.done ? 'مكتمل' : 'مجدول',
      liveCategory: ev?.done ? 'completed' : 'in_progress',
      liveTone: ev?.done ? 'emerald' : 'blue',
    };
  }

  if (entityType === 'meeting') {
    if (entityId.startsWith('recovery-meeting:')) {
      const parts = entityId.split(':');
      const targetPathId = parts[1] || '';
      const path = data.learningPaths.find((p) => p.id === targetPathId);
      return {
        title: fallbackTitle,
        subtitle: fallbackSubtitle || (path ? `مسار ${path.title}` : undefined),
        hubId: path?.hubId || fallbackHubId || 'knowledge',
        typeLabel: 'اجتماع تعافي',
        navAction: targetPathId
          ? { type: 'path', pathId: targetPathId }
          : { type: 'calendar', dateKey: toLocalDateKey() },
        liveStatusLabel: 'تم الحضور',
        liveCategory: 'completed',
        liveTone: 'emerald',
      };
    }
    const mtg = data.weeklyMeetings.find((m) => m.id === entityId);
    return {
      title: mtg?.title || fallbackTitle,
      subtitle: fallbackSubtitle,
      hubId: mtg?.hubId || fallbackHubId || 'knowledge',
      typeLabel: 'لقاء أسبوعي',
      navAction: { type: 'calendar', dateKey: toLocalDateKey() },
      liveStatusLabel: 'لقاء',
      liveCategory: 'learning',
      liveTone: 'blue',
    };
  }

  const mId = Number(entityId) || 1;
  const month = data.months.find((m) => m.id === mId);
  return {
    title: month?.theme || fallbackTitle,
    subtitle: month?.quarterTitle || fallbackSubtitle,
    hubId: month?.hubId || fallbackHubId || 'knowledge',
    typeLabel: 'خطة شهرية',
    navAction: { type: 'month', monthId: mId },
    liveStatusLabel: month?.status === 'completed' ? 'مكتمل' : 'نشط',
    liveCategory: month?.status === 'completed' ? 'completed' : 'learning',
    liveTone: month?.status === 'completed' ? 'emerald' : 'blue',
  };
}

function actionLabelFallback(action: ActivityLogEntry['action']): {
  label: string;
  category: DailyJournalItem['statusCategory'];
  tone: DailyJournalItem['statusTone'];
} {
  switch (action) {
    case 'completed':
      return { label: 'مكتمل', category: 'completed', tone: 'emerald' };
    case 'postponed':
      return { label: 'مؤجّل', category: 'postponed', tone: 'amber' };
    case 'reviewed':
      return { label: 'مراجعة', category: 'note', tone: 'blue' };
    case 'studied':
      return { label: 'مذاكرة وتعلّم', category: 'learning', tone: 'blue' };
    case 'scheduled':
      return { label: 'مجدول', category: 'in_progress', tone: 'slate' };
    default:
      return { label: 'محدّث', category: 'learning', tone: 'slate' };
  }
}

export function buildDailyJournalSummary(
  dateKey: string,
  data: WorkspaceAnalyticsInput,
  filterOptions?: DailyJournalFilterOptions
): DailyJournalSummary {
  const hubs = data.hubs && data.hubs.length > 0 ? data.hubs : LEARNING_HUBS;
  const itemsByKey = new Map<string, DailyJournalItem>();

  const putItem = (item: DailyJournalItem) => {
    const existing = itemsByKey.get(item.key);
    if (!existing || item.sortOrderMs >= existing.sortOrderMs) {
      itemsByKey.set(item.key, item);
    }
  };

  // 1. Aggregate Activity Logs recorded on dateKey
  const dayLogs = data.activityLogs
    .filter((l) => l.dateKey === dateKey)
    .sort((a, b) => a.occurredAtMs - b.occurredAtMs);

  for (const log of dayLogs) {
    const meta = resolveEntityMeta(
      log.entityType,
      log.entityId,
      data,
      log.title,
      log.subtitle,
      log.hubId,
      dateKey
    );
    const hub = getHubMeta(meta.hubId, hubs);
    const actMeta = actionLabelFallback(log.action);
    const useLive = log.entityType === 'task' || log.entityType === 'course_task';
    const statusLabel =
      (useLive ? meta.liveStatusLabel : undefined) ||
      (log.action === 'completed'
        ? 'تم الإنجاز'
        : log.action === 'postponed'
        ? 'تم التأجيل'
        : log.action === 'created'
        ? 'أُضيف اليوم'
        : log.action === 'reviewed'
        ? 'تمت المراجعة'
        : meta.liveStatusLabel || actMeta.label);
    const statusCategory: DailyJournalItem['statusCategory'] =
      log.entityType === 'reflection'
        ? 'reflection'
        : log.entityType === 'book_note' || log.entityType === 'blog_post'
        ? 'note'
        : (useLive ? meta.liveCategory : undefined) || actMeta.category;
    const statusTone: DailyJournalItem['statusTone'] =
      (useLive ? meta.liveTone : undefined) || actMeta.tone;

    putItem({
      key: `${log.entityType}:${log.entityId}`,
      activityLogId: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      title: meta.title,
      subtitle: meta.subtitle,
      typeLabel: meta.typeLabel,
      statusLabel,
      statusCategory,
      statusTone,
      hubId: meta.hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: formatTimeFromMs(log.occurredAtMs),
      sortOrderMs: log.occurredAtMs,
      navAction: meta.navAction,
    });
  }

  // 2. Live dated & recurring UnifiedTasks occurring on dateKey
  const baseDateMs = new Date(`${dateKey}T09:00:00`).getTime();
  for (const task of data.unifiedTasks) {
    if (!doesTaskOccurOnDate(task, dateKey)) continue;
    const isRecurring = Boolean(
      task.recurrence && task.recurrence.frequency !== 'none'
    );
    const effectiveStatus: UnifiedTask['status'] = isRecurring
      ? isTaskCompletedOnDate(task, dateKey)
        ? 'done'
        : task.status === 'done'
        ? 'todo'
        : task.status
      : task.status;
    const st = taskStatusLabel(effectiveStatus);
    const hub = getHubMeta(task.hubId, hubs);
    const key = `task:${task.id}`;
    if (itemsByKey.has(key)) continue;
    putItem({
      key,
      entityType: 'task',
      entityId: task.id,
      title: task.title,
      subtitle: task.linkedLabel || task.categoryLabel || undefined,
      typeLabel: isRecurring ? 'مهمة متكررة' : 'مهمة',
      statusLabel: st.label,
      statusCategory: st.category,
      statusTone: st.tone,
      hubId: task.hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: task.startTime || '',
      sortOrderMs: baseDateMs,
      navAction: { type: 'task', taskId: task.id },
    });
  }

  // 3. Calendar events on dateKey
  for (const ev of data.calendarEvents) {
    if (ev.dateKey !== dateKey) continue;
    const key = `calendar_event:${ev.id}`;
    if (itemsByKey.has(key)) continue;
    const hub = getHubMeta('knowledge', hubs);
    putItem({
      key,
      entityType: 'calendar_event',
      entityId: ev.id,
      title: ev.title,
      subtitle: ev.category,
      typeLabel: 'موعد تقويمي',
      statusLabel: ev.done ? 'مكتمل' : 'مجدول',
      statusCategory: ev.done ? 'completed' : 'in_progress',
      statusTone: ev.done ? 'emerald' : 'blue',
      hubId: 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: ev.timeSlot || '',
      sortOrderMs: baseDateMs,
      navAction: { type: 'calendar', dateKey },
    });
  }

  // 4. Weekly meetings occurring on dateKey
  const dayMeetings = expandWeeklyMeetingsInRange(data.weeklyMeetings, dateKey, dateKey);
  for (const occ of dayMeetings) {
    const hub = getHubMeta(occ.meeting.hubId, hubs);
    const key = `meeting:${occ.meeting.id}`;
    putItem({
      key,
      entityType: 'meeting',
      entityId: occ.meeting.id,
      title: occ.title,
      subtitle: `${occ.startTime} – ${occ.endTime}`,
      typeLabel: 'لقاء أسبوعي',
      statusLabel:
        occ.completed || occ.attendance === 'attended'
          ? 'تم الحضور'
          : occ.attendance === 'missed'
          ? 'لم يُحضر'
          : 'مجدول',
      statusCategory:
        occ.completed || occ.attendance === 'attended'
          ? 'completed'
          : occ.attendance === 'missed'
          ? 'postponed'
          : 'learning',
      statusTone:
        occ.completed || occ.attendance === 'attended'
          ? 'emerald'
          : occ.attendance === 'missed'
          ? 'amber'
          : 'blue',
      hubId: occ.meeting.hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: occ.startTime || '',
      sortOrderMs: baseDateMs,
      navAction: { type: 'calendar', dateKey },
    });
  }

  // 5. BookNotes actually created/written on dateKey (no passive lastReviewedDateKey auto-entries)
  for (const bn of data.bookNotes) {
    const createdKey = msToLocalDateKey(bn.createdAtMs);
    if (createdKey !== dateKey) continue;
    const key = `book_note:${bn.id}`;
    if (itemsByKey.has(key)) continue;
    const hub = getHubMeta(bn.hubId || 'knowledge', hubs);
    putItem({
      key,
      entityType: 'book_note',
      entityId: bn.id,
      title: bn.lectureTitle || bn.bookTitle,
      subtitle: bn.courseTitle || bn.author || undefined,
      typeLabel: bn.noteType === 'course_lecture' ? 'تلخيص محاضرة' : 'تلخيص',
      statusLabel: 'أُنشئ اليوم',
      statusCategory: 'note',
      statusTone: 'blue',
      hubId: bn.hubId || 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: formatTimeFromMs(bn.createdAtMs || 0),
      sortOrderMs: bn.createdAtMs || baseDateMs,
      navAction: { type: 'note', noteId: bn.id },
    });
  }

  // 6. Reflections created on dateKey
  for (const r of data.reflections) {
    if (msToLocalDateKey(r.createdAtMs) !== dateKey) continue;
    const key = `reflection:${r.id}`;
    if (itemsByKey.has(key)) continue;
    const hub = getHubMeta('knowledge', hubs);
    putItem({
      key,
      entityType: 'reflection',
      entityId: r.id,
      title: r.title,
      subtitle: r.moodTag,
      typeLabel: 'خاطرة وتأمل',
      statusLabel: r.moodTag,
      statusCategory: 'reflection',
      statusTone: 'slate',
      hubId: 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: formatTimeFromMs(r.createdAtMs),
      sortOrderMs: r.createdAtMs || baseDateMs,
      navAction: { type: 'reflection', reflectionId: r.id },
    });
  }

  // 7. Blog posts created on dateKey
  for (const post of data.blogPosts) {
    if (msToLocalDateKey(post.createdAtMs) !== dateKey) continue;
    const key = `blog_post:${post.id}`;
    if (itemsByKey.has(key)) continue;
    const hub = getHubMeta('knowledge', hubs);
    putItem({
      key,
      entityType: 'blog_post',
      entityId: post.id,
      title: post.title,
      subtitle: post.categoryLabel || undefined,
      typeLabel: 'مقال',
      statusLabel: post.isPublic ? 'منشور' : 'مسودة',
      statusCategory: 'note',
      statusTone: 'blue',
      hubId: 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: formatTimeFromMs(post.createdAtMs),
      sortOrderMs: post.createdAtMs || baseDateMs,
      navAction: { type: 'blog', blogId: post.id },
    });
  }

  const hiddenIdSet = new Set(filterOptions?.hiddenActivityIds || []);
  const hiddenTypeSet = new Set(filterOptions?.hiddenActivityTypes || []);

  const timelineItems = Array.from(itemsByKey.values())
    .filter((item) => {
      if (hiddenTypeSet.has(item.entityType)) return false;
      if (hiddenIdSet.has(item.key)) return false;
      if (item.activityLogId && hiddenIdSet.has(item.activityLogId)) return false;
      return true;
    })
    .sort((a, b) => b.sortOrderMs - a.sortOrderMs);

  const byHubMap = new Map<LearningHubId, DailyJournalItem[]>();
  for (const item of timelineItems) {
    const arr = byHubMap.get(item.hubId) || [];
    arr.push(item);
    byHubMap.set(item.hubId, arr);
  }

  const groupedByHub = Array.from(byHubMap.entries()).map(([hubId, items]) => {
    const hub = getHubMeta(hubId, hubs);
    return {
      hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      items,
    };
  });

  const counts = {
    completed: timelineItems.filter((i) => i.statusCategory === 'completed').length,
    inProgress: timelineItems.filter((i) => i.statusCategory === 'in_progress').length,
    postponed: timelineItems.filter((i) => i.statusCategory === 'postponed').length,
    summariesAndNotes: timelineItems.filter((i) => i.statusCategory === 'note').length,
    reflections: timelineItems.filter((i) => i.statusCategory === 'reflection').length,
    learningActivities: timelineItems.filter((i) => i.statusCategory === 'learning').length,
    total: timelineItems.length,
  };

  return {
    dateKey,
    timelineItems,
    groupedByHub,
    counts,
  };
}

// ============================================================================
// Period Reviews Analytics (Weekly Sat-Fri, Monthly, Quarterly, Yearly)
// ============================================================================

export interface PeriodReviewAnalytics {
  periodType: PeriodReviewType;
  periodKey: string;
  startKey: string;
  endKey: string;
  activeDaysCount: number;
  achievements: DailyJournalItem[];
  incompleteOrPostponed: DailyJournalItem[];
  learningItems: DailyJournalItem[];
  summariesAndReflections: DailyJournalItem[];
  metrics: {
    tasksCompleted: number;
    tasksPostponed: number;
    tasksPendingInPeriod: number;
    coursesActiveOrCompleted: number;
    summariesCreatedOrReviewed: number;
    reflectionsCount: number;
    meetingsAttended: number;
    meetingsMissed: number;
    totalEntitiesTouched: number;
  };
  planVsActual?: {
    plannedTasksCount: number;
    completedPlannedTasks: number;
    postponedPlannedTasks: number;
    completionPct: number;
    goalsDone: number;
    goalsTotal: number;
    focusCoursesCount: number;
    focusCoursesStudied: number;
  };
  previousComparison?: {
    prevPeriodKey: string;
    tasksCompletedDelta: number;
    summariesDelta: number;
    activeDaysDelta: number;
    prevTasksCompleted: number;
    prevSummaries: number;
    prevActiveDays: number;
  };
  factStrengths: string[];
  improvementAreas: Array<{ kind: 'fact' | 'observation'; text: string }>;
  suggestedAdjustments: string[];
  hubBreakdown: Array<{
    hubId: LearningHubId;
    hubTitle: string;
    accentHex: string;
    count: number;
    completedCount: number;
  }>;
  yearlyCharts?: {
    monthlyActivityBars: Array<{
      monthIndex: number;
      monthLabel: string;
      completedCount: number;
      learningCount: number;
    }>;
    objectivesSummary: {
      achieved: number;
      total: number;
      percentage: number;
    };
    topCourses: Array<{
      id: number;
      title: string;
      progressPct: number;
      notesCount: number;
      hubTitle: string;
    }>;
    booksSummary: {
      total: number;
      reading: number;
      completed: number;
      totalPagesRead: number;
    };
  };
}

export function resolvePeriodRange(
  periodType: PeriodReviewType,
  periodKey: string
): { startKey: string; endKey: string; prevKey: string } {
  if (periodType === 'weekly') {
    const r = getSatFriWeekRange(periodKey);
    return {
      startKey: r.startKey,
      endKey: r.endKey,
      prevKey: shiftWeekKey(r.startKey, -1),
    };
  }
  if (periodType === 'monthly') {
    const r = getMonthRange(periodKey);
    const [y, m] = r.monthKey.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    return {
      startKey: r.startKey,
      endKey: r.endKey,
      prevKey: `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`,
    };
  }
  if (periodType === 'quarterly') {
    const r = getQuarterRange(periodKey);
    const match = /^(\d{4})-Q([1-4])$/.exec(r.quarterKey);
    const y = match ? Number(match[1]) : new Date().getFullYear();
    const q = match ? Number(match[2]) : 1;
    const prevKey = q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
    return { startKey: r.startKey, endKey: r.endKey, prevKey };
  }
  const r = getYearRange(periodKey);
  return {
    startKey: r.startKey,
    endKey: r.endKey,
    prevKey: String(Number(r.yearKey) - 1),
  };
}

function collectRawPeriodWindow(
  startKey: string,
  endKey: string,
  data: WorkspaceAnalyticsInput
) {
  const hubs = data.hubs && data.hubs.length > 0 ? data.hubs : LEARNING_HUBS;
  const activeDaySet = new Set<string>();
  const dedupMap = new Map<string, DailyJournalItem>();

  const putDedup = (item: DailyJournalItem, priorityWeight = 1) => {
    const existing = dedupMap.get(item.key);
    if (!existing || item.sortOrderMs + priorityWeight >= existing.sortOrderMs) {
      dedupMap.set(item.key, item);
    }
  };

  // Activity logs inside [startKey, endKey]
  for (const log of data.activityLogs) {
    if (log.dateKey < startKey || log.dateKey > endKey) continue;
    activeDaySet.add(log.dateKey);
    const meta = resolveEntityMeta(
      log.entityType,
      log.entityId,
      data,
      log.title,
      log.subtitle,
      log.hubId
    );
    const hub = getHubMeta(meta.hubId, hubs);
    const act = actionLabelFallback(log.action);
    const isTaskLike = log.entityType === 'task' || log.entityType === 'course_task';
    putDedup({
      key: `${log.entityType}:${log.entityId}`,
      entityType: log.entityType,
      entityId: log.entityId,
      title: meta.title,
      subtitle: meta.subtitle,
      typeLabel: meta.typeLabel,
      statusLabel: (isTaskLike ? meta.liveStatusLabel : undefined) || act.label,
      statusCategory:
        log.entityType === 'reflection'
          ? 'reflection'
          : log.entityType === 'book_note' || log.entityType === 'blog_post'
          ? 'note'
          : (isTaskLike ? meta.liveCategory : undefined) || act.category,
      statusTone: (isTaskLike ? meta.liveTone : undefined) || act.tone,
      hubId: meta.hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: log.dateKey,
      sortOrderMs: log.occurredAtMs,
      navAction: meta.navAction,
    });
  }

  // Unified tasks scheduled/due/recurring in range
  for (const task of data.unifiedTasks) {
    const occDates = expandTaskOccurrenceDates(task, startKey, endKey);
    if (occDates.length === 0) continue;
    const isRecurring = Boolean(
      task.recurrence && task.recurrence.frequency !== 'none'
    );
    const eff = occDates[occDates.length - 1];
    const completedInRange = isRecurring
      ? occDates.some((d) => isTaskCompletedOnDate(task, d))
      : task.status === 'done';
    if (completedInRange) {
      for (const d of occDates) {
        if (!isRecurring || isTaskCompletedOnDate(task, d)) {
          activeDaySet.add(d);
        }
      }
    }
    const effectiveStatus: UnifiedTask['status'] = isRecurring
      ? completedInRange
        ? 'done'
        : task.status === 'done'
        ? 'todo'
        : task.status
      : task.status;
    const st = taskStatusLabel(effectiveStatus);
    const hub = getHubMeta(task.hubId, hubs);
    putDedup({
      key: `task:${task.id}`,
      entityType: 'task',
      entityId: task.id,
      title: task.title,
      subtitle: eff,
      typeLabel: isRecurring ? 'مهمة متكررة' : 'مهمة',
      statusLabel: st.label,
      statusCategory: st.category,
      statusTone: st.tone,
      hubId: task.hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: eff,
      sortOrderMs: new Date(`${eff}T12:00:00`).getTime(),
      navAction: { type: 'task', taskId: task.id },
    }, 10);
  }

  // BookNotes created in range
  for (const bn of data.bookNotes) {
    const cKey = msToLocalDateKey(bn.createdAtMs);
    if (!cKey || cKey < startKey || cKey > endKey) continue;
    activeDaySet.add(cKey);
    const hub = getHubMeta(bn.hubId || 'knowledge', hubs);
    putDedup({
      key: `book_note:${bn.id}`,
      entityType: 'book_note',
      entityId: bn.id,
      title: bn.lectureTitle || bn.bookTitle,
      subtitle: bn.courseTitle || bn.author || cKey,
      typeLabel: bn.noteType === 'course_lecture' ? 'تلخيص محاضرة' : 'تلخيص',
      statusLabel: 'تلخيص',
      statusCategory: 'note',
      statusTone: 'blue',
      hubId: bn.hubId || 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: cKey,
      sortOrderMs: bn.createdAtMs || new Date(`${cKey}T12:00:00`).getTime(),
      navAction: { type: 'note', noteId: bn.id },
    });
  }

  // Reflections & BlogPosts created in range
  for (const r of data.reflections) {
    const cKey = msToLocalDateKey(r.createdAtMs);
    if (!cKey || cKey < startKey || cKey > endKey) continue;
    activeDaySet.add(cKey);
    const hub = getHubMeta('knowledge', hubs);
    putDedup({
      key: `reflection:${r.id}`,
      entityType: 'reflection',
      entityId: r.id,
      title: r.title,
      subtitle: `${r.moodTag} · ${cKey}`,
      typeLabel: 'خاطرة',
      statusLabel: r.moodTag,
      statusCategory: 'reflection',
      statusTone: 'slate',
      hubId: 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: cKey,
      sortOrderMs: r.createdAtMs,
      navAction: { type: 'reflection', reflectionId: r.id },
    });
  }

  for (const post of data.blogPosts) {
    const cKey = msToLocalDateKey(post.createdAtMs);
    if (!cKey || cKey < startKey || cKey > endKey) continue;
    activeDaySet.add(cKey);
    const hub = getHubMeta('knowledge', hubs);
    putDedup({
      key: `blog_post:${post.id}`,
      entityType: 'blog_post',
      entityId: post.id,
      title: post.title,
      subtitle: cKey,
      typeLabel: 'مقال',
      statusLabel: post.isPublic ? 'منشور' : 'مسودة',
      statusCategory: 'note',
      statusTone: 'blue',
      hubId: 'knowledge',
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: cKey,
      sortOrderMs: post.createdAtMs,
      navAction: { type: 'blog', blogId: post.id },
    });
  }

  // Weekly meetings in range
  const mtgs = expandWeeklyMeetingsInRange(data.weeklyMeetings, startKey, endKey);
  let meetingsAttended = 0;
  let meetingsMissed = 0;
  for (const occ of mtgs) {
    if (occ.completed || occ.attendance === 'attended') {
      meetingsAttended += 1;
      activeDaySet.add(occ.dateKey);
    } else if (occ.attendance === 'missed') {
      meetingsMissed += 1;
    }
    const hub = getHubMeta(occ.meeting.hubId, hubs);
    putDedup({
      key: `meeting:${occ.meeting.id}:${occ.occurrenceKey}`,
      entityType: 'meeting',
      entityId: occ.meeting.id,
      title: occ.title,
      subtitle: occ.dateKey,
      typeLabel: 'لقاء أسبوعي',
      statusLabel:
        occ.completed || occ.attendance === 'attended'
          ? 'تم الحضور'
          : occ.attendance === 'missed'
          ? 'فات'
          : 'مجدول',
      statusCategory:
        occ.completed || occ.attendance === 'attended'
          ? 'completed'
          : occ.attendance === 'missed'
          ? 'postponed'
          : 'learning',
      statusTone:
        occ.completed || occ.attendance === 'attended'
          ? 'emerald'
          : occ.attendance === 'missed'
          ? 'amber'
          : 'blue',
      hubId: occ.meeting.hubId,
      hubTitle: hub.shortTitle,
      hubAccentHex: hub.accentHex,
      timeLabel: occ.dateKey,
      sortOrderMs: new Date(`${occ.dateKey}T12:00:00`).getTime(),
      navAction: { type: 'calendar', dateKey: occ.dateKey },
    });
  }

  const allItems = Array.from(dedupMap.values()).sort(
    (a, b) => b.sortOrderMs - a.sortOrderMs
  );

  return {
    allItems,
    activeDaysCount: activeDaySet.size,
    meetingsAttended,
    meetingsMissed,
  };
}

export function buildPeriodReviewAnalytics(
  periodType: PeriodReviewType,
  periodKey: string,
  data: WorkspaceAnalyticsInput,
  weeklyPlan?: WeeklyPlanRecord | null
): PeriodReviewAnalytics {
  const hubs = data.hubs && data.hubs.length > 0 ? data.hubs : LEARNING_HUBS;
  const { startKey, endKey, prevKey } = resolvePeriodRange(periodType, periodKey);
  const current = collectRawPeriodWindow(startKey, endKey, data);

  const achievements = current.allItems.filter(
    (i) => i.statusCategory === 'completed' || i.statusCategory === 'note'
  );
  const incompleteOrPostponed = current.allItems.filter(
    (i) => i.statusCategory === 'postponed' || i.statusCategory === 'in_progress'
  );
  const learningItems = current.allItems.filter(
    (i) =>
      i.entityType === 'course' ||
      i.entityType === 'course_task' ||
      i.entityType === 'learning_path' ||
      i.entityType === 'reading_item' ||
      i.entityType === 'book_note'
  );
  const summariesAndReflections = current.allItems.filter(
    (i) => i.statusCategory === 'note' || i.statusCategory === 'reflection'
  );

  const tasksCompleted = current.allItems.filter(
    (i) => i.entityType === 'task' && i.statusCategory === 'completed'
  ).length;
  const tasksPostponed = current.allItems.filter(
    (i) => i.entityType === 'task' && i.statusCategory === 'postponed'
  ).length;
  const tasksPendingInPeriod = current.allItems.filter(
    (i) => i.entityType === 'task' && i.statusCategory === 'in_progress'
  ).length;
  const coursesActiveOrCompleted = new Set(
    current.allItems
      .filter((i) => i.entityType === 'course' || i.entityType === 'course_task')
      .map((i) => i.entityId.split(':')[0])
  ).size;
  const summariesCreatedOrReviewed = current.allItems.filter(
    (i) => i.entityType === 'book_note'
  ).length;
  const reflectionsCount = current.allItems.filter(
    (i) => i.entityType === 'reflection'
  ).length;

  // Plan vs Actual for weekly review when weeklyPlan exists
  let planVsActual: PeriodReviewAnalytics['planVsActual'];
  if (periodType === 'weekly' && weeklyPlan) {
    const taskMap = new Map(data.unifiedTasks.map((t) => [t.id, t]));
    const plannedTasks = weeklyPlan.linkedTaskIds
      .map((id) => taskMap.get(id))
      .filter((t): t is UnifiedTask => Boolean(t));
    const completedPlannedTasks = plannedTasks.filter((t) => t.status === 'done').length;
    const postponedPlannedTasks = plannedTasks.filter((t) => t.status === 'postponed').length;
    const touchedCourseSet = new Set(
      current.allItems
        .filter((i) => i.entityType === 'course' || i.entityType === 'course_task')
        .map((i) => Number(i.entityId.split(':')[0]))
    );
    const focusCoursesStudied = weeklyPlan.focusCourseIds.filter((cid) =>
      touchedCourseSet.has(cid)
    ).length;

    planVsActual = {
      plannedTasksCount: plannedTasks.length,
      completedPlannedTasks,
      postponedPlannedTasks,
      completionPct:
        plannedTasks.length > 0
          ? Math.round((completedPlannedTasks / plannedTasks.length) * 100)
          : 0,
      goalsDone: weeklyPlan.goals.filter((g) => g.done).length,
      goalsTotal: weeklyPlan.goals.length,
      focusCoursesCount: weeklyPlan.focusCourseIds.length,
      focusCoursesStudied,
    };
  }

  // Previous period comparison ONLY when previous period actually has data
  const prevRange = resolvePeriodRange(periodType, prevKey);
  const prevRaw = collectRawPeriodWindow(prevRange.startKey, prevRange.endKey, data);
  let previousComparison: PeriodReviewAnalytics['previousComparison'];
  if (prevRaw.allItems.length > 0 || prevRaw.activeDaysCount > 0) {
    const prevTasksCompleted = prevRaw.allItems.filter(
      (i) => i.entityType === 'task' && i.statusCategory === 'completed'
    ).length;
    const prevSummaries = prevRaw.allItems.filter(
      (i) => i.entityType === 'book_note'
    ).length;
    previousComparison = {
      prevPeriodKey: prevKey,
      tasksCompletedDelta: tasksCompleted - prevTasksCompleted,
      summariesDelta: summariesCreatedOrReviewed - prevSummaries,
      activeDaysDelta: current.activeDaysCount - prevRaw.activeDaysCount,
      prevTasksCompleted,
      prevSummaries,
      prevActiveDays: prevRaw.activeDaysCount,
    };
  }

  // Fact-based strengths vs Improvement areas (fact vs observation)
  const factStrengths: string[] = [];
  if (current.activeDaysCount >= 3) {
    factStrengths.push(
      `حافظت على نشاط تعلّم وإنتاجية مسجّل خلال ${current.activeDaysCount} أيام في هذه الفترة.`
    );
  }
  if (tasksCompleted > 0) {
    factStrengths.push(`أنجزت ${tasksCompleted} مهام عملية بنجاح.`);
  }
  if (summariesCreatedOrReviewed > 0) {
    factStrengths.push(
      `دوّنت أو راجعت ${summariesCreatedOrReviewed} تلخيصات/محاضرات مما يعزّز تثبيت الفهم.`
    );
  }
  if (coursesActiveOrCompleted > 0) {
    factStrengths.push(
      `تفاعلت فعليًا مع ${coursesActiveOrCompleted} كورسات خلال الفترة.`
    );
  }
  if (planVsActual && planVsActual.plannedTasksCount > 0 && planVsActual.completionPct >= 70) {
    factStrengths.push(
      `حققت ${planVsActual.completionPct}% من المهام المخططة في خطة الأسبوع.`
    );
  }

  const improvementAreas: Array<{ kind: 'fact' | 'observation'; text: string }> = [];
  if (tasksPostponed > 0) {
    improvementAreas.push({
      kind: 'fact',
      text: `تم تأجيل ${tasksPostponed} مهام في هذه الفترة وتحتاج لإعادة جدولة أو تفكيك.`,
    });
  }
  if (tasksPendingInPeriod > 0) {
    improvementAreas.push({
      kind: 'fact',
      text: `هناك ${tasksPendingInPeriod} مهام مجدولة لم تُغلق بعد بنهاية الفترة.`,
    });
  }
  if (current.meetingsMissed > 0) {
    improvementAreas.push({
      kind: 'fact',
      text: `فاتت ${current.meetingsMissed} لقاءات أسبوعية مسجلة في التقويم.`,
    });
  }
  const unscheduledActive = data.unifiedTasks.filter(
    (t) => t.status !== 'done' && !t.scheduledDate && !t.dueDate
  ).length;
  if (unscheduledActive >= 3) {
    improvementAreas.push({
      kind: 'observation',
      text: `ملاحظة محتملة: لديك ${unscheduledActive} مهام نشطة غير مجدولة بتاريخ محدد، مما قد يشتت تركيز التنفيذ اليومي.`,
    });
  }
  if (coursesActiveOrCompleted > 0 && summariesCreatedOrReviewed === 0) {
    improvementAreas.push({
      kind: 'observation',
      text: 'ملاحظة محتملة: تم التقدم في الكورسات دون إضافة تلخيصات مكتوبة — إضافة خلاصة قصيرة بعد كل درس تثبّت الأثر.',
    });
  }

  const suggestedAdjustments: string[] = [];
  if (tasksPostponed + tasksPendingInPeriod > 0) {
    suggestedAdjustments.push(
      'ابدأ الأسبوع القادم بترحيل المهمتين الأهم فقط من المؤجّلات إلى يومي السبت والأحد قبل إضافة مهام جديدة.'
    );
  }
  if (unscheduledActive >= 3) {
    suggestedAdjustments.push(
      'استخدم شاشة «تخطيط الأسبوع» يوم الجمعة لتوزيع المهام غير المجدولة على أيام السبت–الجمعة.'
    );
  }
  if (summariesCreatedOrReviewed === 0 && current.allItems.length > 0) {
    suggestedAdjustments.push(
      'خصّص 20 دقيقة لتحويل أهم ما تعلّمته هذا الأسبوع إلى تلخيص واحد في دفتر التلخيص.'
    );
  }

  const hubMap = new Map<LearningHubId, { count: number; completedCount: number }>();
  for (const item of current.allItems) {
    const prev = hubMap.get(item.hubId) || { count: 0, completedCount: 0 };
    prev.count += 1;
    if (item.statusCategory === 'completed') prev.completedCount += 1;
    hubMap.set(item.hubId, prev);
  }
  const hubBreakdown = Array.from(hubMap.entries()).map(([hubId, stats]) => {
    const h = getHubMeta(hubId, hubs);
    return {
      hubId,
      hubTitle: h.shortTitle,
      accentHex: h.accentHex,
      count: stats.count,
      completedCount: stats.completedCount,
    };
  });

  // Yearly / Macro visual breakdown when periodType === 'yearly' or 'quarterly' or 'monthly'
  let yearlyCharts: PeriodReviewAnalytics['yearlyCharts'];
  if (periodType === 'yearly' || periodType === 'quarterly' || periodType === 'monthly') {
    const yearPrefix = startKey.slice(0, 4);
    const ARABIC_MONTHS = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];
    const monthlyActivityBars = ARABIC_MONTHS.map((label, idx) => {
      const mKey = `${yearPrefix}-${String(idx + 1).padStart(2, '0')}`;
      const mRange = getMonthRange(mKey);
      const completedCount = data.unifiedTasks.filter((t) => {
        const d = t.scheduledDate || t.dueDate || '';
        return t.status === 'done' && d >= mRange.startKey && d <= mRange.endKey;
      }).length;
      const learningCount =
        data.bookNotes.filter((n) => {
          const d = msToLocalDateKey(n.createdAtMs);
          return d >= mRange.startKey && d <= mRange.endKey;
        }).length +
        data.activityLogs.filter(
          (l) => l.dateKey >= mRange.startKey && l.dateKey <= mRange.endKey
        ).length;
      return {
        monthIndex: idx + 1,
        monthLabel: label,
        completedCount,
        learningCount,
      };
    });

    const allObjectives = [
      ...data.courses.flatMap((c) => c.learningObjectives || []),
      ...data.learningPaths.flatMap((p) => p.learningObjectives || []),
      ...data.readingItems.flatMap((b) => b.learningObjectives || []),
    ];
    const achieved = allObjectives.filter((o) => o.achieved).length;
    const total = allObjectives.length;

    const topCourses = [...data.courses]
      .map((c) => ({
        id: c.id,
        title: c.title,
        progressPct: c.progressPct ?? 0,
        notesCount: data.bookNotes.filter((n) => n.courseId === c.id).length,
        hubTitle: getHubMeta(c.hubId, hubs).shortTitle,
      }))
      .sort((a, b) => b.notesCount + b.progressPct / 25 - (a.notesCount + a.progressPct / 25))
      .slice(0, 6);

    const booksSummary = {
      total: data.readingItems.length,
      reading: data.readingItems.filter((b) => b.status === 'reading').length,
      completed: data.readingItems.filter((b) => b.status === 'completed').length,
      totalPagesRead: data.readingItems.reduce(
        (sum, b) => sum + (b.status === 'completed' ? b.totalPages || b.currentPage : b.currentPage || 0),
        0
      ),
    };

    yearlyCharts = {
      monthlyActivityBars,
      objectivesSummary: {
        achieved,
        total,
        percentage: total > 0 ? Math.round((achieved / total) * 100) : 0,
      },
      topCourses,
      booksSummary,
    };
  }

  return {
    periodType,
    periodKey,
    startKey,
    endKey,
    activeDaysCount: current.activeDaysCount,
    achievements,
    incompleteOrPostponed,
    learningItems,
    summariesAndReflections,
    metrics: {
      tasksCompleted,
      tasksPostponed,
      tasksPendingInPeriod,
      coursesActiveOrCompleted,
      summariesCreatedOrReviewed,
      reflectionsCount,
      meetingsAttended: current.meetingsAttended,
      meetingsMissed: current.meetingsMissed,
      totalEntitiesTouched: current.allItems.length,
    },
    planVsActual,
    previousComparison,
    factStrengths,
    improvementAreas,
    suggestedAdjustments,
    hubBreakdown,
    yearlyCharts,
  };
}

export function getCarriedOverIncompleteTasks(
  targetWeekStartKey: string,
  unifiedTasks: UnifiedTask[]
): UnifiedTask[] {
  return unifiedTasks.filter((t) => {
    if (t.status === 'done') return false;
    const d = t.scheduledDate || t.dueDate || '';
    if (t.status === 'postponed') return true;
    return Boolean(d && d < targetWeekStartKey);
  });
}

export function getDefaultPlanningWeekStartKey(today: Date = new Date()): string {
  const currentWeek = getSatFriWeekRange(today);
  // Friday (5) -> plan next week starting tomorrow (Saturday)
  if (today.getDay() === 5) {
    return addDaysToDateKey(currentWeek.startKey, 7);
  }
  return currentWeek.startKey;
}
