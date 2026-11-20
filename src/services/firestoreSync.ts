import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BookNote,
  CalendarCategory,
  CalendarColor,
  CalendarEvent,
  CourseStudyStage,
  CustomCategory,
  DEFAULT_HUB_CATEGORIES,
  DEFAULT_USER_PREFERENCES,
  DentalCase,
  DentalCaseStatus,
  DomainInfo,
  LearningHubId,
  LearningPath,
  LearningPathStage,
  LearningPathStatus,
  MonthPlan,
  NoteColorKey,
  PersonalCourse,
  PersonalReflection,
  PracticalProject,
  ProjectStatus,
  QuarterInfo,
  READING_MODES_META,
  ReadingItemStatus,
  ReadingItemType,
  ReadingLibraryItem,
  ReadingMode,
  ReflectionMood,
  StudyHistoryEntry,
  StudyResource,
  TaskPriority,
  UnifiedTask,
  UnifiedTaskStatus,
  UserPreferences,
} from '../data/curriculumData';
import { OperationType, db, handleFirestoreError } from '../firebase';

function clip(val: string | undefined, max: number): string {
  return (val ?? '').slice(0, max);
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return (cleaned || `item_${Date.now()}`).slice(0, 128);
}

const VALID_HUB_IDS: LearningHubId[] = ['marketing', 'dental_career', 'knowledge'];
const VALID_READING_MODES: ReadingMode[] = READING_MODES_META.map((m) => m.id);
const VALID_STUDY_STAGES: CourseStudyStage[] = [
  'focus_now',
  'in_progress',
  'scheduled_later',
  'deferred',
  'heard_before',
  'completed',
];
const VALID_NOTE_COLORS: NoteColorKey[] = [
  'default',
  'navy',
  'emerald',
  'amber',
  'rose',
  'violet',
];

function sanitizeCourseStudyStage(
  raw: unknown,
  completed?: boolean
): CourseStudyStage {
  if (VALID_STUDY_STAGES.includes(raw as CourseStudyStage)) {
    return raw as CourseStudyStage;
  }
  return completed ? 'completed' : 'in_progress';
}

function sanitizeNoteColor(raw: unknown): NoteColorKey {
  return VALID_NOTE_COLORS.includes(raw as NoteColorKey)
    ? (raw as NoteColorKey)
    : 'default';
}

function sanitizeHubId(raw: unknown): LearningHubId {
  if (raw === 'marketing' || raw === 'dental_career' || raw === 'knowledge') {
    return raw;
  }
  return 'knowledge';
}

function sanitizeReadingModes(raw: unknown): ReadingMode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is ReadingMode =>
      VALID_READING_MODES.includes(v as ReadingMode)
    )
    .slice(0, 5);
}

function sanitizeLearningMethods(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => clip(typeof v === 'string' ? v.trim() : '', 80))
    .filter(Boolean)
    .slice(0, 15);
}

function sanitizeDateKeyOrEmpty(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function buildQuarterPayload(uid: string, q: QuarterInfo) {
  const id = sanitizeId(q.id);
  return {
    id,
    ownerId: uid,
    number: Math.max(1, Math.min(20, Math.round(q.number))),
    title: clip(q.title || `المرحلة ${q.number}`, 200),
    subtitle: clip(q.subtitle || '', 300),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeResourceList(items: StudyResource[]): StudyResource[] {
  return (items || []).slice(0, 30).map((r) => ({
    id: clip(r.id || `res-${Date.now()}`, 128),
    title: clip(r.title || 'مصدر دراسي', 300),
    type: r.type || 'كتاب',
    note: clip(r.note || '', 600),
    searchQuery: clip(r.searchQuery || r.title || '', 300),
    ...(r.externalUrl ? { externalUrl: clip(r.externalUrl, 800) } : {}),
    ...(r.attachmentName ? { attachmentName: clip(r.attachmentName, 200) } : {}),
    ...(r.extractedPreview
      ? { extractedPreview: clip(r.extractedPreview, 8000) }
      : {}),
    ...(r.storagePath ? { storagePath: clip(r.storagePath, 400) } : {}),
    ...(r.downloadUrl ? { downloadUrl: clip(r.downloadUrl, 1200) } : {}),
    ...(r.mimeType ? { mimeType: clip(r.mimeType, 120) } : {}),
    ...(typeof r.sizeBytes === 'number' && r.sizeBytes >= 0
      ? { sizeBytes: Math.round(r.sizeBytes) }
      : {}),
    custom: Boolean(r.custom),
  }));
}

function buildMonthPayload(uid: string, m: MonthPlan) {
  const docId = sanitizeId(m.docId || `month-${m.id}`);
  return {
    id: Math.max(1, Math.min(100, Math.round(m.id))),
    docId,
    ownerId: uid,
    hubId: sanitizeHubId(m.hubId),
    quarter: Math.max(1, Math.min(20, Math.round(m.quarter))),
    quarterTitle: clip(m.quarterTitle || `المرحلة ${m.quarter}`, 200),
    theme: clip(m.theme || `الوحدة ${m.id}`, 250),
    foundational: {
      title: clip(m.foundational.title || '', 300),
      author: clip(m.foundational.author || '', 200),
      format: clip(m.foundational.format || 'كتاب', 60),
      domainId: clip(m.foundational.domainId || 'islamic_thought', 128),
      pace: clip(m.foundational.pace || '', 300),
      focus: clip(m.foundational.focus || '', 500),
    },
    exploratory: {
      title: clip(m.exploratory.title || '', 300),
      author: clip(m.exploratory.author || '', 200),
      format: clip(m.exploratory.format || 'كتاب', 60),
      domainId: clip(m.exploratory.domainId || 'philosophy', 128),
      pace: clip(m.exploratory.pace || '', 300),
      focus: clip(m.exploratory.focus || '', 500),
    },
    courseId: Math.max(0, Math.min(1000, Math.round(m.courseId))),
    discussionPrompt: clip(m.discussionPrompt || '', 1000),
    applicationTask: clip(m.applicationTask || '', 1000),
    activities: {
      reading: Boolean(m.activities.reading),
      listening: Boolean(m.activities.listening),
      summarizing: Boolean(m.activities.summarizing),
      discussing: Boolean(m.activities.discussing),
    },
    status: m.status,
    notes: clip(m.notes || '', 20000),
    tasks: (m.tasks || []).slice(0, 50),
    resources: sanitizeResourceList(m.resources || []),
    readingModes: sanitizeReadingModes(m.readingModes),
    learningMethods: sanitizeLearningMethods(m.learningMethods),
    reviewCount: Math.max(0, Math.min(10000, Math.round(m.reviewCount ?? 0))),
    listenCount: Math.max(0, Math.min(10000, Math.round(m.listenCount ?? 0))),
    repetitionStage: Math.max(0, Math.min(10, Math.round(m.repetitionStage ?? 0))),
    nextReviewDateKey: sanitizeDateKeyOrEmpty(m.nextReviewDateKey),
    lastReviewedDateKey: sanitizeDateKeyOrEmpty(m.lastReviewedDateKey),
    updatedAt: serverTimestamp(),
  };
}

function buildDomainPayload(uid: string, d: DomainInfo, order: number) {
  const id = sanitizeId(d.id);
  return {
    id,
    ownerId: uid,
    hubId: sanitizeHubId(d.hubId),
    order: Math.max(0, Math.min(100, Math.round(d.order ?? order))),
    title: clip(d.title || 'محور معرفي', 200),
    subtitle: clip(d.subtitle || '', 300),
    purpose: clip(d.purpose || '', 1000),
    thinkers: (d.thinkers || []).slice(0, 30),
    updatedAt: serverTimestamp(),
  };
}

function buildCoursePayload(uid: string, c: PersonalCourse) {
  const docId = sanitizeId(c.docId || `course-${c.id}`);
  return {
    id: Math.max(1, Math.min(1000, Math.round(c.id))),
    docId,
    ownerId: uid,
    hubId: sanitizeHubId(c.hubId),
    title: clip(c.title || `كورس ${c.id}`, 250),
    category: clip(c.category || '', 120),
    instructor: clip(c.instructor, 200),
    platform: clip(c.platform, 200),
    durationLabel: clip(c.durationLabel, 120),
    startDate: clip(c.startDate, 20),
    targetDate: clip(c.targetDate, 20),
    progressPct: Math.max(0, Math.min(100, Math.round(c.progressPct ?? (c.completed ? 100 : 0)))),
    notes: clip(c.notes, 20000),
    linkedMonths: (c.linkedMonths || []).slice(0, 24).map((n) => Math.round(n)),
    complementaryBook: clip(c.complementaryBook || '', 300),
    bookAuthor: clip(c.bookAuthor || '', 250),
    applicationMilestone: clip(c.applicationMilestone || '', 1000),
    completed: Boolean(c.completed),
    studyStage: sanitizeCourseStudyStage(c.studyStage, Boolean(c.completed)),
    scheduledPeriod: clip(c.scheduledPeriod, 120),
    resources: sanitizeResourceList(c.resources || []),
    tasks: (c.tasks || []).slice(0, 50),
    readingModes: sanitizeReadingModes(c.readingModes),
    learningMethods: sanitizeLearningMethods(c.learningMethods),
    reviewCount: Math.max(0, Math.min(10000, Math.round(c.reviewCount ?? 0))),
    listenCount: Math.max(0, Math.min(10000, Math.round(c.listenCount ?? 0))),
    repetitionStage: Math.max(0, Math.min(10, Math.round(c.repetitionStage ?? 0))),
    nextReviewDateKey: sanitizeDateKeyOrEmpty(c.nextReviewDateKey),
    lastReviewedDateKey: sanitizeDateKeyOrEmpty(c.lastReviewedDateKey),
    updatedAt: serverTimestamp(),
  };
}

function buildBookNotePayload(uid: string, bn: BookNote) {
  const id = sanitizeId(bn.id);
  const noteType =
    bn.noteType === 'course_lecture' || bn.noteType === 'general'
      ? bn.noteType
      : 'book';
  return {
    id,
    ownerId: uid,
    hubId: sanitizeHubId(bn.hubId),
    noteType,
    noteColor: sanitizeNoteColor(bn.noteColor),
    bookTitle: clip(bn.bookTitle || 'ملاحظة بدون عنوان', 300),
    author: clip(bn.author || '', 200),
    courseId: Math.max(0, Math.min(1000, Math.round(bn.courseId ?? 0))),
    courseTitle: clip(bn.courseTitle || '', 250),
    lectureTitle: clip(bn.lectureTitle || '', 250),
    categoryLabel: clip(bn.categoryLabel || '', 120),
    progressMarker: clip(bn.progressMarker || '', 200),
    content: clip(bn.content || '', 40000),
    quotes: clip(bn.quotes || '', 10000),
    updatedAtLabel: clip(bn.updatedAt || '', 100),
    readingModes: sanitizeReadingModes(bn.readingModes),
    learningMethods: sanitizeLearningMethods(bn.learningMethods),
    reviewCount: Math.max(0, Math.min(10000, Math.round(bn.reviewCount ?? 0))),
    listenCount: Math.max(0, Math.min(10000, Math.round(bn.listenCount ?? 0))),
    repetitionStage: Math.max(0, Math.min(10, Math.round(bn.repetitionStage ?? 0))),
    nextReviewDateKey: sanitizeDateKeyOrEmpty(bn.nextReviewDateKey),
    lastReviewedDateKey: sanitizeDateKeyOrEmpty(bn.lastReviewedDateKey),
    updatedAt: serverTimestamp(),
  };
}

function buildCustomCategoryPayload(uid: string, cat: CustomCategory) {
  const id = sanitizeId(cat.id);
  const color =
    cat.color === 'emerald' || cat.color === 'amber' || cat.color === 'slate'
      ? cat.color
      : 'navy';
  const hubId =
    cat.hubId === 'all' || VALID_HUB_IDS.includes(cat.hubId as LearningHubId)
      ? cat.hubId
      : 'all';
  return {
    id,
    ownerId: uid,
    hubId,
    title: clip(cat.title || 'تصنيف مخصص', 120),
    description: clip(cat.description || '', 300),
    color,
    createdAtLabel: clip(cat.createdAtLabel || '', 100),
    updatedAt: serverTimestamp(),
  };
}

function buildHistoryPayload(uid: string, entry: StudyHistoryEntry) {
  const id = sanitizeId(entry.id);
  const allowedTabs: StudyHistoryEntry['targetTab'][] = [
    'overview',
    'focus',
    'plan',
    'domains',
    'courses',
    'journal',
    'calendar',
    'paths',
    'library',
    'tasks',
  ];
  const targetTab = allowedTabs.includes(entry.targetTab)
    ? entry.targetTab
    : 'overview';
  return {
    id,
    ownerId: uid,
    actionType: entry.actionType,
    title: clip(entry.title || 'نشاط دراسي', 200),
    detail: clip(entry.detail || '', 400),
    targetTab,
    targetNoteId: clip(entry.targetNoteId || '', 128),
    targetMonthId: Math.max(
      0,
      Math.min(1000, Math.round(entry.targetMonthId ?? 0))
    ),
    targetCourseId: Math.max(
      0,
      Math.min(1000, Math.round(entry.targetCourseId ?? 0))
    ),
    timestampLabel: clip(entry.timestampLabel || '', 100),
    createdAtMs: Math.max(0, Math.round(entry.createdAtMs || Date.now())),
    updatedAt: serverTimestamp(),
  };
}

function buildReflectionPayload(uid: string, r: PersonalReflection) {
  const id = sanitizeId(r.id);
  const allowedMoods: ReflectionMood[] = ['تأمل', 'فكرة', 'امتنان', 'هدف'];
  const moodTag: ReflectionMood = allowedMoods.includes(r.moodTag)
    ? r.moodTag
    : 'تأمل';
  return {
    id,
    ownerId: uid,
    title: clip(r.title || '', 200),
    content: clip(r.content || '', 10000),
    moodTag,
    pinned: Boolean(r.pinned),
    createdAtLabel: clip(r.createdAtLabel || '', 100),
    createdAtMs: Math.max(0, Math.round(r.createdAtMs || Date.now())),
    updatedAt: serverTimestamp(),
  };
}

function buildCalendarEventPayload(uid: string, ev: CalendarEvent) {
  const id = sanitizeId(ev.id);
  const allowedCategories: CalendarCategory[] = [
    'شخصي',
    'دراسة',
    'موعد',
    'مراجعة',
    'قراءة',
  ];
  const category: CalendarCategory = allowedCategories.includes(ev.category)
    ? ev.category
    : 'شخصي';
  const allowedColors: CalendarColor[] = ['navy', 'emerald', 'amber', 'rose'];
  const color: CalendarColor = allowedColors.includes(ev.color)
    ? ev.color
    : 'navy';
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(ev.dateKey || '')
    ? ev.dateKey
    : new Date().toISOString().slice(0, 10);

  return {
    id,
    ownerId: uid,
    dateKey,
    timeSlot: clip(ev.timeSlot || '', 20),
    title: clip(ev.title || 'موعد', 200),
    notes: clip(ev.notes || '', 2000),
    category,
    color,
    done: Boolean(ev.done),
    linkedTaskText: clip(ev.linkedTaskText || '', 300),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeHubCategories(
  raw?: Record<LearningHubId, string[]>
): Record<LearningHubId, string[]> {
  const out: Record<LearningHubId, string[]> = {
    marketing: [...DEFAULT_HUB_CATEGORIES.marketing],
    dental_career: [...DEFAULT_HUB_CATEGORIES.dental_career],
    knowledge: [...DEFAULT_HUB_CATEGORIES.knowledge],
  };
  if (!raw) return out;
  for (const hub of VALID_HUB_IDS) {
    if (Array.isArray(raw[hub])) {
      out[hub] = raw[hub]
        .map((c) => clip(typeof c === 'string' ? c.trim() : '', 120))
        .filter(Boolean)
        .slice(0, 30);
    }
  }
  return out;
}

function buildUserPreferencesPayload(uid: string, prefs: UserPreferences) {
  const fontSize =
    prefs.noteFontSize === 'sm' || prefs.noteFontSize === 'lg'
      ? prefs.noteFontSize
      : 'base';
  const highlightColor =
    prefs.noteHighlightColor === 'emerald' ||
    prefs.noteHighlightColor === 'sky' ||
    prefs.noteHighlightColor === 'rose'
      ? prefs.noteHighlightColor
      : 'amber';
  const paperTone =
    prefs.notePaperTone === 'warm' || prefs.notePaperTone === 'slate'
      ? prefs.notePaperTone
      : 'clean';
  const dialect =
    prefs.voiceDialect === 'egyptian_arabic' ||
    prefs.voiceDialect === 'bilingual'
      ? prefs.voiceDialect
      : 'standard_arabic';
  const insertMode =
    prefs.voiceInsertMode === 'append_bullet' ||
    prefs.voiceInsertMode === 'append_quote'
      ? prefs.voiceInsertMode
      : 'append_paragraph';
  const readAloudVoice =
    prefs.readAloudVoice === 'Puck' ||
    prefs.readAloudVoice === 'Charon' ||
    prefs.readAloudVoice === 'Fenrir' ||
    prefs.readAloudVoice === 'Zephyr'
      ? prefs.readAloudVoice
      : 'Kore';
  const readAloudSpeed = prefs.readAloudSpeed === 'calm' ? 'calm' : 'normal';

  return {
    id: 'settings',
    ownerId: uid,
    noteFontSize: fontSize,
    noteHighlightColor: highlightColor,
    notePaperTone: paperTone,
    autoAddTimestampOnVoice: Boolean(prefs.autoAddTimestampOnVoice),
    voiceDialect: dialect,
    voiceInsertMode: insertMode,
    readAloudVoice,
    readAloudSpeed,
    showExcelExport: prefs.showExcelExport !== false,
    hubCategories: sanitizeHubCategories(prefs.hubCategories),
    updatedAt: serverTimestamp(),
  };
}

function buildLearningPathPayload(uid: string, pathItem: LearningPath) {
  const id = sanitizeId(pathItem.id);
  const status: LearningPathStatus =
    pathItem.status === 'in_progress' || pathItem.status === 'completed'
      ? pathItem.status
      : 'planned';
  const stages: LearningPathStage[] = (pathItem.stages || [])
    .slice(0, 40)
    .map((s) => ({
      id: clip(s.id || `stage-${Date.now()}`, 128),
      title: clip(s.title || 'مرحلة', 250),
      done: Boolean(s.done),
      ...(s.notes ? { notes: clip(s.notes, 1000) } : {}),
    }));
  return {
    id,
    ownerId: uid,
    title: clip(pathItem.title || 'مسار تعلم', 250),
    description: clip(pathItem.description, 2000),
    hubId: sanitizeHubId(pathItem.hubId),
    categoryLabel: clip(pathItem.categoryLabel, 120),
    objectives: clip(pathItem.objectives, 2000),
    currentLevel: clip(pathItem.currentLevel, 120),
    targetLevel: clip(pathItem.targetLevel, 120),
    startDate: clip(pathItem.startDate, 20),
    expectedCompletionDate: clip(pathItem.expectedCompletionDate, 20),
    progressPct: Math.max(0, Math.min(100, Math.round(pathItem.progressPct ?? 0))),
    status,
    stages,
    linkedCourseIds: (pathItem.linkedCourseIds || [])
      .slice(0, 30)
      .map((n) => Math.round(n)),
    readingModes: sanitizeReadingModes(pathItem.readingModes),
    learningMethods: sanitizeLearningMethods(pathItem.learningMethods),
    reviewCount: Math.max(0, Math.min(10000, Math.round(pathItem.reviewCount ?? 0))),
    listenCount: Math.max(0, Math.min(10000, Math.round(pathItem.listenCount ?? 0))),
    updatedAt: serverTimestamp(),
  };
}

function buildReadingItemPayload(uid: string, item: ReadingLibraryItem) {
  const id = sanitizeId(item.id);
  const allowedTypes: ReadingItemType[] = [
    'كتاب',
    'مقال',
    'بحث',
    'ورقة علمية',
    'ملف PDF',
    'ملخص',
  ];
  const itemType: ReadingItemType = allowedTypes.includes(item.itemType)
    ? item.itemType
    : 'كتاب';
  const status: ReadingItemStatus =
    item.status === 'reading' || item.status === 'completed'
      ? item.status
      : 'to_read';
  return {
    id,
    ownerId: uid,
    title: clip(item.title || 'مادة قراءة', 300),
    author: clip(item.author, 200),
    hubId: sanitizeHubId(item.hubId),
    categoryLabel: clip(item.categoryLabel, 120),
    itemType,
    status,
    currentPage: Math.max(0, Math.min(50000, Math.round(item.currentPage ?? 0))),
    totalPages: Math.max(0, Math.min(50000, Math.round(item.totalPages ?? 0))),
    takeaways: clip(item.takeaways, 20000),
    attachmentName: clip(item.attachmentName, 200),
    attachmentResourceId: clip(item.attachmentResourceId, 128),
    storagePath: clip(item.storagePath, 400),
    downloadUrl: clip(item.downloadUrl, 1200),
    externalUrl: clip(item.externalUrl, 800),
    readingModes: sanitizeReadingModes(item.readingModes),
    learningMethods: sanitizeLearningMethods(item.learningMethods),
    reviewCount: Math.max(0, Math.min(10000, Math.round(item.reviewCount ?? 0))),
    listenCount: Math.max(0, Math.min(10000, Math.round(item.listenCount ?? 0))),
    repetitionStage: Math.max(0, Math.min(10, Math.round(item.repetitionStage ?? 0))),
    nextReviewDateKey: sanitizeDateKeyOrEmpty(item.nextReviewDateKey),
    lastReviewedDateKey: sanitizeDateKeyOrEmpty(item.lastReviewedDateKey),
    updatedAtLabel: clip(item.updatedAtLabel, 100),
    updatedAt: serverTimestamp(),
  };
}

function buildPracticalProjectPayload(uid: string, proj: PracticalProject) {
  const id = sanitizeId(proj.id);
  const status: ProjectStatus =
    proj.status === 'in_progress' || proj.status === 'completed'
      ? proj.status
      : 'planned';
  return {
    id,
    ownerId: uid,
    title: clip(proj.title || 'مشروع عملي', 250),
    description: clip(proj.description, 3000),
    hubId: sanitizeHubId(proj.hubId),
    categoryLabel: clip(proj.categoryLabel, 120),
    objectives: clip(proj.objectives, 2000),
    status,
    progressPct: Math.max(0, Math.min(100, Math.round(proj.progressPct ?? 0))),
    deliverables: clip(proj.deliverables, 2000),
    startDate: clip(proj.startDate, 20),
    targetDate: clip(proj.targetDate, 20),
    linkedCourseId: Math.max(0, Math.min(1000, Math.round(proj.linkedCourseId ?? 0))),
    notes: clip(proj.notes, 10000),
    updatedAt: serverTimestamp(),
  };
}

function buildUnifiedTaskPayload(uid: string, t: UnifiedTask) {
  const id = sanitizeId(t.id);
  const priority: TaskPriority =
    t.priority === 'low' || t.priority === 'high' ? t.priority : 'medium';
  const status: UnifiedTaskStatus =
    t.status === 'in_progress' || t.status === 'done' ? t.status : 'todo';
  return {
    id,
    ownerId: uid,
    title: clip(t.title || 'مهمة', 300),
    description: clip(t.description, 2000),
    hubId: sanitizeHubId(t.hubId),
    categoryLabel: clip(t.categoryLabel, 120),
    priority,
    status,
    dueDate: sanitizeDateKeyOrEmpty(t.dueDate),
    linkedLabel: clip(t.linkedLabel, 200),
    updatedAt: serverTimestamp(),
  };
}

function buildDentalCasePayload(uid: string, dc: DentalCase) {
  const id = sanitizeId(dc.id);
  const status: DentalCaseStatus =
    dc.status === 'follow_up' || dc.status === 'completed'
      ? dc.status
      : 'in_progress';
  return {
    id,
    ownerId: uid,
    title: clip(dc.title || 'حالة إكلينيكية', 250),
    specialty: clip(dc.specialty || 'علاج الجذور / تحفظي', 150),
    patientSummary: clip(dc.patientSummary, 400),
    procedureDetails: clip(dc.procedureDetails, 20000),
    caseDate: clip(dc.caseDate, 20),
    status,
    coverImageUrl: clip(dc.coverImageUrl, 1200),
    coverStoragePath: clip(dc.coverStoragePath, 400),
    coverDataUrl: clip(dc.coverDataUrl, 895000),
    linkedCourseId: Math.max(
      0,
      Math.min(1000, Math.round(dc.linkedCourseId ?? 0))
    ),
    updatedAtLabel: clip(dc.updatedAtLabel, 100),
    updatedAt: serverTimestamp(),
  };
}

export async function ensureUserDocumentAndSeed(
  user: User,
  seedData: {
    quarters: QuarterInfo[];
    months: MonthPlan[];
    domains: DomainInfo[];
    courses: PersonalCourse[];
    bookNotes: BookNote[];
    customCategories: CustomCategory[];
    history: StudyHistoryEntry[];
    preferences?: UserPreferences;
  }
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  try {
    const existingUser = await getDoc(userRef);
    if (!existingUser.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: clip(user.displayName || 'مستخدم ميزان المعرفة', 120),
        email: clip(user.email || 'user@example.com', 200),
        photoURL: clip(user.photoURL || '', 600),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: clip(user.displayName || 'مستخدم ميزان المعرفة', 120),
        email: clip(user.email || 'user@example.com', 200),
        photoURL: clip(user.photoURL || '', 600),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // Seed core workspace ONLY if user's months collection is currently empty
  const monthsPath = `users/${user.uid}/months`;
  try {
    const existingMonthsSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'months'), where('ownerId', '==', user.uid))
    );
    if (existingMonthsSnap.empty) {
      const batch = writeBatch(db);
      for (const q of seedData.quarters) {
        const p = buildQuarterPayload(user.uid, q);
        batch.set(doc(db, 'users', user.uid, 'quarters', p.id), p);
      }
      for (const m of seedData.months) {
        const p = buildMonthPayload(user.uid, m);
        batch.set(doc(db, 'users', user.uid, 'months', p.docId), p);
      }
      seedData.domains.forEach((d, idx) => {
        const p = buildDomainPayload(user.uid, d, idx);
        batch.set(doc(db, 'users', user.uid, 'domains', p.id), p);
      });
      for (const c of seedData.courses) {
        const p = buildCoursePayload(user.uid, c);
        batch.set(doc(db, 'users', user.uid, 'courses', p.docId), p);
      }
      for (const bn of seedData.bookNotes) {
        const p = buildBookNotePayload(user.uid, bn);
        batch.set(doc(db, 'users', user.uid, 'bookNotes', p.id), p);
      }
      for (const cat of seedData.customCategories) {
        const p = buildCustomCategoryPayload(user.uid, cat);
        batch.set(doc(db, 'users', user.uid, 'customCategories', p.id), p);
      }
      for (const h of seedData.history.slice(0, 25)) {
        const p = buildHistoryPayload(user.uid, h);
        batch.set(doc(db, 'users', user.uid, 'history', p.id), p);
      }
      const prefPayload = buildUserPreferencesPayload(
        user.uid,
        seedData.preferences ?? DEFAULT_USER_PREFERENCES
      );
      batch.set(
        doc(db, 'users', user.uid, 'preferences', 'settings'),
        prefPayload
      );
      await batch.commit();
    } else {
      const existingCatsSnap = await getDocs(
        query(
          collection(db, 'users', user.uid, 'customCategories'),
          where('ownerId', '==', user.uid)
        )
      );
      if (existingCatsSnap.empty && seedData.customCategories.length > 0) {
        const batch = writeBatch(db);
        for (const cat of seedData.customCategories) {
          const p = buildCustomCategoryPayload(user.uid, cat);
          batch.set(doc(db, 'users', user.uid, 'customCategories', p.id), p);
        }
        await batch.commit();
      }
      const prefDocRef = doc(db, 'users', user.uid, 'preferences', 'settings');
      const existingPrefSnap = await getDoc(prefDocRef);
      if (!existingPrefSnap.exists()) {
        await setDoc(
          prefDocRef,
          buildUserPreferencesPayload(
            user.uid,
            seedData.preferences ?? DEFAULT_USER_PREFERENCES
          )
        );
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, monthsPath);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onQuarters: (items: QuarterInfo[]) => void;
    onMonths: (items: MonthPlan[]) => void;
    onDomains: (items: DomainInfo[]) => void;
    onCourses: (items: PersonalCourse[]) => void;
    onBookNotes: (items: BookNote[]) => void;
    onCustomCategories: (items: CustomCategory[]) => void;
    onHistory: (items: StudyHistoryEntry[]) => void;
    onPreferences?: (prefs: UserPreferences) => void;
    onReflections?: (items: PersonalReflection[]) => void;
    onCalendarEvents?: (items: CalendarEvent[]) => void;
    onLearningPaths?: (items: LearningPath[]) => void;
    onReadingItems?: (items: ReadingLibraryItem[]) => void;
    onProjects?: (items: PracticalProject[]) => void;
    onUnifiedTasks?: (items: UnifiedTask[]) => void;
    onDentalCases?: (items: DentalCase[]) => void;
  }
): () => void {
  const unsubQuarters = onSnapshot(
    query(collection(db, 'users', uid, 'quarters'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as QuarterInfo)
        .sort((a, b) => a.number - b.number);
      callbacks.onQuarters(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/quarters`)
  );

  const unsubMonths = onSnapshot(
    query(collection(db, 'users', uid, 'months'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as MonthPlan;
          return {
            ...raw,
            hubId: sanitizeHubId(raw.hubId),
            readingModes: sanitizeReadingModes(raw.readingModes),
            learningMethods: sanitizeLearningMethods(raw.learningMethods),
            reviewCount: Number(raw.reviewCount ?? 0),
            listenCount: Number(raw.listenCount ?? 0),
            repetitionStage: Number(raw.repetitionStage ?? 0),
            nextReviewDateKey: raw.nextReviewDateKey || '',
            lastReviewedDateKey: raw.lastReviewedDateKey || '',
          };
        })
        .sort((a, b) => a.id - b.id);
      callbacks.onMonths(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/months`)
  );

  const unsubDomains = onSnapshot(
    query(collection(db, 'users', uid, 'domains'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as DomainInfo;
          return {
            ...raw,
            hubId: sanitizeHubId(raw.hubId),
          };
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      callbacks.onDomains(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/domains`)
  );

  const unsubCourses = onSnapshot(
    query(collection(db, 'users', uid, 'courses'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as PersonalCourse;
          return {
            ...raw,
            hubId: sanitizeHubId(raw.hubId),
            instructor: raw.instructor ?? '',
            platform: raw.platform ?? '',
            durationLabel: raw.durationLabel ?? '',
            startDate: raw.startDate ?? '',
            targetDate: raw.targetDate ?? '',
            progressPct:
              typeof raw.progressPct === 'number'
                ? raw.progressPct
                : raw.completed
                ? 100
                : 0,
            notes: raw.notes ?? '',
            studyStage: sanitizeCourseStudyStage(raw.studyStage, raw.completed),
            scheduledPeriod: raw.scheduledPeriod ?? '',
            readingModes: sanitizeReadingModes(raw.readingModes),
            learningMethods: sanitizeLearningMethods(raw.learningMethods),
            reviewCount: Number(raw.reviewCount ?? 0),
            listenCount: Number(raw.listenCount ?? 0),
            repetitionStage: Number(raw.repetitionStage ?? 0),
            nextReviewDateKey: raw.nextReviewDateKey || '',
            lastReviewedDateKey: raw.lastReviewedDateKey || '',
          };
        })
        .sort((a, b) => a.id - b.id);
      callbacks.onCourses(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/courses`)
  );

  const unsubBookNotes = onSnapshot(
    query(collection(db, 'users', uid, 'bookNotes'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        const rawType = raw.noteType;
        const noteType =
          rawType === 'course_lecture' || rawType === 'general'
            ? rawType
            : 'book';
        return {
          id: String(raw.id ?? d.id),
          hubId: sanitizeHubId(raw.hubId),
          noteType,
          noteColor: sanitizeNoteColor(raw.noteColor),
          bookTitle: String(raw.bookTitle ?? ''),
          author: String(raw.author ?? ''),
          courseId: Number(raw.courseId ?? 0),
          courseTitle: String(raw.courseTitle ?? ''),
          lectureTitle: String(raw.lectureTitle ?? ''),
          categoryLabel: String(raw.categoryLabel ?? ''),
          progressMarker: String(raw.progressMarker ?? ''),
          content: String(raw.content ?? ''),
          quotes: String(raw.quotes ?? ''),
          updatedAt: String(raw.updatedAtLabel ?? ''),
          readingModes: sanitizeReadingModes(raw.readingModes),
          learningMethods: sanitizeLearningMethods(raw.learningMethods),
          reviewCount: Number(raw.reviewCount ?? 0),
          listenCount: Number(raw.listenCount ?? 0),
          repetitionStage: Number(raw.repetitionStage ?? 0),
          nextReviewDateKey: String(raw.nextReviewDateKey ?? ''),
          lastReviewedDateKey: String(raw.lastReviewedDateKey ?? ''),
        } satisfies BookNote;
      });
      callbacks.onBookNotes(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/bookNotes`)
  );

  const unsubCategories = onSnapshot(
    query(
      collection(db, 'users', uid, 'customCategories'),
      where('ownerId', '==', uid)
    ),
    (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        const color =
          raw.color === 'emerald' ||
          raw.color === 'amber' ||
          raw.color === 'slate'
            ? raw.color
            : 'navy';
        const hubId =
          raw.hubId === 'all' || VALID_HUB_IDS.includes(raw.hubId as LearningHubId)
            ? (raw.hubId as LearningHubId | 'all')
            : 'all';
        return {
          id: String(raw.id ?? d.id),
          hubId,
          title: String(raw.title ?? ''),
          description: String(raw.description ?? ''),
          color,
          createdAtLabel: String(raw.createdAtLabel ?? ''),
        } satisfies CustomCategory;
      });
      callbacks.onCustomCategories(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/customCategories`)
  );

  const unsubHistory = onSnapshot(
    query(collection(db, 'users', uid, 'history'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          return {
            id: String(raw.id ?? d.id),
            actionType: (raw.actionType as StudyHistoryEntry['actionType']) ?? 'note',
            title: String(raw.title ?? ''),
            detail: String(raw.detail ?? ''),
            targetTab: (raw.targetTab as StudyHistoryEntry['targetTab']) ?? 'overview',
            targetNoteId: raw.targetNoteId ? String(raw.targetNoteId) : undefined,
            targetMonthId:
              typeof raw.targetMonthId === 'number' && raw.targetMonthId > 0
                ? raw.targetMonthId
                : undefined,
            targetCourseId:
              typeof raw.targetCourseId === 'number' && raw.targetCourseId > 0
                ? raw.targetCourseId
                : undefined,
            timestampLabel: String(raw.timestampLabel ?? ''),
            createdAtMs: Number(raw.createdAtMs ?? 0),
          } satisfies StudyHistoryEntry;
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 40);
      callbacks.onHistory(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/history`)
  );

  const unsubPrefs = onSnapshot(
    query(collection(db, 'users', uid, 'preferences'), where('ownerId', '==', uid)),
    (snap) => {
      const settingsDoc =
        snap.docs.find((d) => d.id === 'settings') ?? snap.docs[0];
      if (!settingsDoc || !callbacks.onPreferences) return;
      const raw = settingsDoc.data() as Partial<UserPreferences>;
      callbacks.onPreferences({
        ...DEFAULT_USER_PREFERENCES,
        ...raw,
        showExcelExport: raw.showExcelExport !== false,
        hubCategories: sanitizeHubCategories(raw.hubCategories),
      });
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/preferences`)
  );

  const unsubReflections = onSnapshot(
    query(collection(db, 'users', uid, 'reflections'), where('ownerId', '==', uid)),
    (snap) => {
      if (!callbacks.onReflections) return;
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const moodRaw = String(raw.moodTag ?? 'تأمل');
          const moodTag: ReflectionMood =
            moodRaw === 'فكرة' || moodRaw === 'امتنان' || moodRaw === 'هدف'
              ? moodRaw
              : 'تأمل';
          return {
            id: String(raw.id ?? d.id),
            title: String(raw.title ?? ''),
            content: String(raw.content ?? ''),
            moodTag,
            pinned: Boolean(raw.pinned),
            createdAtLabel: String(raw.createdAtLabel ?? ''),
            createdAtMs: Number(raw.createdAtMs ?? 0),
          } satisfies PersonalReflection;
        })
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.createdAtMs - a.createdAtMs;
        });
      callbacks.onReflections(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/reflections`)
  );

  const unsubCalendar = onSnapshot(
    query(
      collection(db, 'users', uid, 'calendarEvents'),
      where('ownerId', '==', uid)
    ),
    (snap) => {
      if (!callbacks.onCalendarEvents) return;
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const catRaw = String(raw.category ?? 'شخصي');
          const category: CalendarCategory =
            catRaw === 'دراسة' ||
            catRaw === 'موعد' ||
            catRaw === 'مراجعة' ||
            catRaw === 'قراءة'
              ? catRaw
              : 'شخصي';
          const colRaw = String(raw.color ?? 'navy');
          const color: CalendarColor =
            colRaw === 'emerald' || colRaw === 'amber' || colRaw === 'rose'
              ? colRaw
              : 'navy';
          return {
            id: String(raw.id ?? d.id),
            dateKey: String(raw.dateKey ?? ''),
            timeSlot: String(raw.timeSlot ?? ''),
            title: String(raw.title ?? ''),
            notes: String(raw.notes ?? ''),
            category,
            color,
            done: Boolean(raw.done),
            linkedTaskText: String(raw.linkedTaskText ?? ''),
          } satisfies CalendarEvent;
        })
        .sort((a, b) => {
          if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
          return (a.timeSlot || '99:99').localeCompare(b.timeSlot || '99:99');
        });
      callbacks.onCalendarEvents(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/calendarEvents`)
  );

  const unsubPaths = onSnapshot(
    query(collection(db, 'users', uid, 'learningPaths'), where('ownerId', '==', uid)),
    (snap) => {
      if (!callbacks.onLearningPaths) return;
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title ?? ''),
          description: String(raw.description ?? ''),
          hubId: sanitizeHubId(raw.hubId),
          categoryLabel: String(raw.categoryLabel ?? ''),
          objectives: String(raw.objectives ?? ''),
          currentLevel: String(raw.currentLevel ?? ''),
          targetLevel: String(raw.targetLevel ?? ''),
          startDate: String(raw.startDate ?? ''),
          expectedCompletionDate: String(raw.expectedCompletionDate ?? ''),
          progressPct: Number(raw.progressPct ?? 0),
          status:
            raw.status === 'in_progress' || raw.status === 'completed'
              ? (raw.status as LearningPathStatus)
              : 'planned',
          stages: Array.isArray(raw.stages)
            ? (raw.stages as LearningPathStage[])
            : [],
          linkedCourseIds: Array.isArray(raw.linkedCourseIds)
            ? (raw.linkedCourseIds as number[])
            : [],
          readingModes: sanitizeReadingModes(raw.readingModes),
          learningMethods: sanitizeLearningMethods(raw.learningMethods),
          reviewCount: Number(raw.reviewCount ?? 0),
          listenCount: Number(raw.listenCount ?? 0),
        } satisfies LearningPath;
      });
      callbacks.onLearningPaths(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/learningPaths`)
  );

  const unsubReading = onSnapshot(
    query(collection(db, 'users', uid, 'readingItems'), where('ownerId', '==', uid)),
    (snap) => {
      if (!callbacks.onReadingItems) return;
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title ?? ''),
          author: String(raw.author ?? ''),
          hubId: sanitizeHubId(raw.hubId),
          categoryLabel: String(raw.categoryLabel ?? ''),
          itemType: (raw.itemType as ReadingItemType) || 'كتاب',
          status:
            raw.status === 'reading' || raw.status === 'completed'
              ? (raw.status as ReadingItemStatus)
              : 'to_read',
          currentPage: Number(raw.currentPage ?? 0),
          totalPages: Number(raw.totalPages ?? 0),
          takeaways: String(raw.takeaways ?? ''),
          attachmentName: raw.attachmentName ? String(raw.attachmentName) : undefined,
          attachmentResourceId: raw.attachmentResourceId
            ? String(raw.attachmentResourceId)
            : undefined,
          storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
          downloadUrl: raw.downloadUrl ? String(raw.downloadUrl) : undefined,
          externalUrl: raw.externalUrl ? String(raw.externalUrl) : undefined,
          readingModes: sanitizeReadingModes(raw.readingModes),
          learningMethods: sanitizeLearningMethods(raw.learningMethods),
          reviewCount: Number(raw.reviewCount ?? 0),
          listenCount: Number(raw.listenCount ?? 0),
          repetitionStage: Number(raw.repetitionStage ?? 0),
          nextReviewDateKey: String(raw.nextReviewDateKey ?? ''),
          lastReviewedDateKey: String(raw.lastReviewedDateKey ?? ''),
          updatedAtLabel: String(raw.updatedAtLabel ?? ''),
        } satisfies ReadingLibraryItem;
      });
      callbacks.onReadingItems(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/readingItems`)
  );

  const unsubProjects = onSnapshot(
    query(collection(db, 'users', uid, 'projects'), where('ownerId', '==', uid)),
    (snap) => {
      if (!callbacks.onProjects) return;
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title ?? ''),
          description: String(raw.description ?? ''),
          hubId: sanitizeHubId(raw.hubId),
          categoryLabel: String(raw.categoryLabel ?? ''),
          objectives: String(raw.objectives ?? ''),
          status:
            raw.status === 'in_progress' || raw.status === 'completed'
              ? (raw.status as ProjectStatus)
              : 'planned',
          progressPct: Number(raw.progressPct ?? 0),
          deliverables: String(raw.deliverables ?? ''),
          startDate: String(raw.startDate ?? ''),
          targetDate: String(raw.targetDate ?? ''),
          linkedCourseId:
            typeof raw.linkedCourseId === 'number' && raw.linkedCourseId > 0
              ? raw.linkedCourseId
              : undefined,
          notes: String(raw.notes ?? ''),
        } satisfies PracticalProject;
      });
      callbacks.onProjects(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/projects`)
  );

  const unsubUnifiedTasks = onSnapshot(
    query(collection(db, 'users', uid, 'unifiedTasks'), where('ownerId', '==', uid)),
    (snap) => {
      if (!callbacks.onUnifiedTasks) return;
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title ?? ''),
          description: String(raw.description ?? ''),
          hubId: sanitizeHubId(raw.hubId),
          categoryLabel: String(raw.categoryLabel ?? ''),
          priority:
            raw.priority === 'low' || raw.priority === 'high'
              ? (raw.priority as TaskPriority)
              : 'medium',
          status:
            raw.status === 'in_progress' || raw.status === 'done'
              ? (raw.status as UnifiedTaskStatus)
              : 'todo',
          dueDate: String(raw.dueDate ?? ''),
          linkedLabel: raw.linkedLabel ? String(raw.linkedLabel) : undefined,
        } satisfies UnifiedTask;
      });
      callbacks.onUnifiedTasks(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/unifiedTasks`)
  );

  const unsubDentalCases = onSnapshot(
    query(collection(db, 'users', uid, 'dentalCases'), where('ownerId', '==', uid)),
    (snap) => {
      if (!callbacks.onDentalCases) return;
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const status: DentalCaseStatus =
            raw.status === 'follow_up' || raw.status === 'completed'
              ? raw.status
              : 'in_progress';
          return {
            id: String(raw.id ?? d.id),
            title: String(raw.title ?? ''),
            specialty: String(raw.specialty ?? ''),
            patientSummary: String(raw.patientSummary ?? ''),
            procedureDetails: String(raw.procedureDetails ?? ''),
            caseDate: String(raw.caseDate ?? ''),
            status,
            coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl) : undefined,
            coverStoragePath: raw.coverStoragePath
              ? String(raw.coverStoragePath)
              : undefined,
            coverDataUrl: raw.coverDataUrl ? String(raw.coverDataUrl) : undefined,
            linkedCourseId:
              typeof raw.linkedCourseId === 'number' && raw.linkedCourseId > 0
                ? raw.linkedCourseId
                : undefined,
            updatedAtLabel: raw.updatedAtLabel
              ? String(raw.updatedAtLabel)
              : undefined,
          } satisfies DentalCase;
        })
        .sort((a, b) => (b.caseDate || '').localeCompare(a.caseDate || ''));
      callbacks.onDentalCases(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/dentalCases`)
  );

  return () => {
    unsubQuarters();
    unsubMonths();
    unsubDomains();
    unsubCourses();
    unsubBookNotes();
    unsubCategories();
    unsubHistory();
    unsubPrefs();
    unsubReflections();
    unsubCalendar();
    unsubPaths();
    unsubReading();
    unsubProjects();
    unsubUnifiedTasks();
    unsubDentalCases();
  };
}

export async function saveQuarterDoc(uid: string, q: QuarterInfo): Promise<void> {
  const p = buildQuarterPayload(uid, q);
  const path = `users/${uid}/quarters/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'quarters', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteQuarterDoc(uid: string, quarterId: string): Promise<void> {
  const id = sanitizeId(quarterId);
  const path = `users/${uid}/quarters/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'quarters', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveMonthDoc(uid: string, m: MonthPlan): Promise<void> {
  const p = buildMonthPayload(uid, m);
  const path = `users/${uid}/months/${p.docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'months', p.docId), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMonthDoc(uid: string, docId: string): Promise<void> {
  const id = sanitizeId(docId);
  const path = `users/${uid}/months/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'months', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDomainDoc(
  uid: string,
  d: DomainInfo,
  order: number
): Promise<void> {
  const p = buildDomainPayload(uid, d, order);
  const path = `users/${uid}/domains/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'domains', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDomainDoc(uid: string, domainId: string): Promise<void> {
  const id = sanitizeId(domainId);
  const path = `users/${uid}/domains/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'domains', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCourseDoc(uid: string, c: PersonalCourse): Promise<void> {
  const p = buildCoursePayload(uid, c);
  const path = `users/${uid}/courses/${p.docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'courses', p.docId), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCourseDoc(uid: string, docId: string): Promise<void> {
  const id = sanitizeId(docId);
  const path = `users/${uid}/courses/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'courses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBookNoteDoc(uid: string, bn: BookNote): Promise<void> {
  const p = buildBookNotePayload(uid, bn);
  const path = `users/${uid}/bookNotes/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'bookNotes', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBookNoteDoc(uid: string, noteId: string): Promise<void> {
  const id = sanitizeId(noteId);
  const path = `users/${uid}/bookNotes/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookNotes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCustomCategoryDoc(
  uid: string,
  cat: CustomCategory
): Promise<void> {
  const p = buildCustomCategoryPayload(uid, cat);
  const path = `users/${uid}/customCategories/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'customCategories', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCustomCategoryDoc(
  uid: string,
  categoryId: string
): Promise<void> {
  const id = sanitizeId(categoryId);
  const path = `users/${uid}/customCategories/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customCategories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveHistoryEntryDoc(
  uid: string,
  entry: StudyHistoryEntry
): Promise<void> {
  const p = buildHistoryPayload(uid, entry);
  const path = `users/${uid}/history/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'history', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHistoryEntryDoc(
  uid: string,
  entryId: string
): Promise<void> {
  const id = sanitizeId(entryId);
  const path = `users/${uid}/history/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'history', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveUserPreferencesDoc(
  uid: string,
  prefs: UserPreferences
): Promise<void> {
  const p = buildUserPreferencesPayload(uid, prefs);
  const path = `users/${uid}/preferences/settings`;
  try {
    await setDoc(doc(db, 'users', uid, 'preferences', 'settings'), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveReflectionDoc(
  uid: string,
  reflection: PersonalReflection
): Promise<void> {
  const p = buildReflectionPayload(uid, reflection);
  const path = `users/${uid}/reflections/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'reflections', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteReflectionDoc(
  uid: string,
  reflectionId: string
): Promise<void> {
  const id = sanitizeId(reflectionId);
  const path = `users/${uid}/reflections/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'reflections', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCalendarEventDoc(
  uid: string,
  event: CalendarEvent
): Promise<void> {
  const p = buildCalendarEventPayload(uid, event);
  const path = `users/${uid}/calendarEvents/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'calendarEvents', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCalendarEventDoc(
  uid: string,
  eventId: string
): Promise<void> {
  const id = sanitizeId(eventId);
  const path = `users/${uid}/calendarEvents/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'calendarEvents', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveLearningPathDoc(
  uid: string,
  pathItem: LearningPath
): Promise<void> {
  const p = buildLearningPathPayload(uid, pathItem);
  const path = `users/${uid}/learningPaths/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'learningPaths', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLearningPathDoc(
  uid: string,
  pathId: string
): Promise<void> {
  const id = sanitizeId(pathId);
  const path = `users/${uid}/learningPaths/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'learningPaths', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveReadingItemDoc(
  uid: string,
  item: ReadingLibraryItem
): Promise<void> {
  const p = buildReadingItemPayload(uid, item);
  const path = `users/${uid}/readingItems/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'readingItems', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteReadingItemDoc(
  uid: string,
  itemId: string
): Promise<void> {
  const id = sanitizeId(itemId);
  const path = `users/${uid}/readingItems/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'readingItems', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePracticalProjectDoc(
  uid: string,
  proj: PracticalProject
): Promise<void> {
  const p = buildPracticalProjectPayload(uid, proj);
  const path = `users/${uid}/projects/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'projects', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePracticalProjectDoc(
  uid: string,
  projectId: string
): Promise<void> {
  const id = sanitizeId(projectId);
  const path = `users/${uid}/projects/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'projects', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveUnifiedTaskDoc(
  uid: string,
  task: UnifiedTask
): Promise<void> {
  const p = buildUnifiedTaskPayload(uid, task);
  const path = `users/${uid}/unifiedTasks/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'unifiedTasks', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUnifiedTaskDoc(
  uid: string,
  taskId: string
): Promise<void> {
  const id = sanitizeId(taskId);
  const path = `users/${uid}/unifiedTasks/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'unifiedTasks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDentalCaseDoc(
  uid: string,
  dentalCase: DentalCase
): Promise<void> {
  const p = buildDentalCasePayload(uid, dentalCase);
  const path = `users/${uid}/dentalCases/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'dentalCases', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDentalCaseDoc(
  uid: string,
  caseId: string
): Promise<void> {
  const id = sanitizeId(caseId);
  const path = `users/${uid}/dentalCases/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'dentalCases', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
