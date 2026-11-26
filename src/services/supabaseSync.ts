import { User } from 'firebase/auth';
import {
  ActivityActionKind,
  ActivityEntityType,
  ActivityLogEntry,
  BlogPost,
  BookChapterNote,
  BookNote,
  BookWorkspaceData,
  BookWorkspaceSection,
  CalendarCategory,
  CalendarColor,
  CalendarEvent,
  CalendarPreferences,
  ContactMessageRecord,
  ContentAccessGrant,
  CourseStudyStage,
  CustomCategory,
  DEFAULT_BOOK_COVER_FRAME,
  DEFAULT_CALENDAR_PREFERENCES,
  DEFAULT_DASHBOARD_HERO_FRAME,
  DEFAULT_HUB_CATEGORIES,
  DEFAULT_IMAGE_FRAME_SPEC,
  DEFAULT_LEARNING_HUBS,
  DEFAULT_NAV_TAB_ORDER,
  DEFAULT_PINNED_NAV_TABS,
  DEFAULT_PUBLIC_SITE_CONFIG,
  DEFAULT_REFLECTION_CATEGORIES,
  DEFAULT_REFLECTION_IMAGE_FRAME,
  DEFAULT_THEME_CONFIG,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_WEEKLY_RHYTHM,
  DailyJournalRecord,
  DentalCase,
  DentalCaseStatus,
  DomainInfo,
  GrantAccessMode,
  GrantedItemNote,
  GrantedWorkspaceData,
  HUB_ACCENT_PRESETS,
  JOURNAL_CARD_THEMES,
  JournalCardColorKey,
  JournalQuickNote,
  JournalQuickNoteKind,
  JournalQuoteMeta,
  JournalTextSection,
  LearningHubId,
  LearningHubMeta,
  LearningObjective,
  LearningPath,
  LearningPathStage,
  LearningPathStatus,
  MeetingAttendanceStatus,
  MonthPlan,
  NoteCategoryType,
  NoteColorKey,
  PeriodReviewRecord,
  PeriodReviewType,
  PersonalCourse,
  PersonalReflection,
  PinCollection,
  PinCollectionItem,
  PinEntityType,
  PracticalProject,
  ProjectStatus,
  PublicSiteConfig,
  PublicSiteSection,
  PublicSiteVisibilityFlags,
  QuarterInfo,
  READING_MODES_META,
  ReadingItemStatus,
  ReadingItemType,
  ReadingLibraryItem,
  ReadingMode,
  ReadingModeMeta,
  ReflectionColorKey,
  ReflectionMood,
  SmallTask,
  StudyHistoryEntry,
  StudyResource,
  TaskPriority,
  ThemeConfig,
  ThinkerInfo,
  UnifiedTask,
  UnifiedTaskStatus,
  UserPreferences,
  UserProfileItem,
  UserQuoteItem,
  WEEKLY_RHYTHM_DAYS,
  WeeklyMeeting,
  WeeklyMeetingException,
  WeeklyMeetingFollowUp,
  WeeklyPlanGoal,
  WeeklyPlanRecord,
  WeeklyRhythmItem,
  estimateReadingTimeMinutes,
  getSatFriWeekRange,
  sanitizeImageFrameSpec,
  sanitizeTaskStatusOrder,
  toLocalDateKey,
} from '../data/curriculumData';
import { sanitizeThemeConfig } from '../utils/themeEngine';
import { sanitizeRecoveryWorkspacesMap } from '../utils/recoveryPathStorage';
import { normalizeRecurrenceRule } from '../utils/taskRecurrence';
import {
  QueuedSupabaseMutation,
  enqueueSupabaseDelete,
  enqueueSupabaseUpsert,
  getOfflineOutboxMapForTable,
  isAppOnline,
  isNetworkOrOfflineError,
  loadCachedUserProfile,
  saveCachedUserProfile,
} from '../utils/offlineQueue';
import {
  StorageProvider,
  resolveEffectiveStorageProvider,
} from './storageService';
import {
  ensureSupabaseRealtimeAuth,
  formatSupabaseErrorMessage,
  isSupabaseConfigured,
  supabase,
  withFirebaseTokenRetry,
} from './supabaseClient';

function clip(val: string | undefined | null, max: number): string {
  return (val ?? '').slice(0, max);
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return (cleaned || `item_${Date.now()}`).slice(0, 128);
}

const VALID_HUB_IDS: LearningHubId[] = ['marketing', 'dental_career', 'knowledge'];
const VALID_REFLECTION_COLORS: ReflectionColorKey[] = [
  'auto',
  'sage',
  'sky',
  'amber',
  'rose',
  'lavender',
  'slate',
];
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

function sanitizeReflectionColor(raw: unknown): ReflectionColorKey {
  return VALID_REFLECTION_COLORS.includes(raw as ReflectionColorKey)
    ? (raw as ReflectionColorKey)
    : 'auto';
}

function sanitizeHubId(raw: unknown): LearningHubId {
  if (typeof raw !== 'string') return 'knowledge';
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || 'knowledge';
}

function sanitizeCustomHubs(raw: unknown): LearningHubMeta[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_LEARNING_HUBS;
  const cleaned = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .slice(0, 12)
    .map((item, idx) => {
      const idRaw = typeof item.id === 'string' ? item.id.trim() : '';
      const id = sanitizeHubId(idRaw || `hub_${idx + 1}`);
      const fallbackDefault =
        DEFAULT_LEARNING_HUBS.find((h) => h.id === id) ?? HUB_ACCENT_PRESETS[idx % HUB_ACCENT_PRESETS.length];
      const title = clip(typeof item.title === 'string' ? item.title.trim() : '', 120);
      const shortTitle = clip(
        typeof item.shortTitle === 'string' && item.shortTitle.trim()
          ? item.shortTitle.trim()
          : title,
        60
      );
      const englishTitle = clip(
        typeof item.englishTitle === 'string' ? item.englishTitle.trim() : '',
        120
      );
      const purpose = clip(typeof item.purpose === 'string' ? item.purpose.trim() : '', 400);
      const accentHexRaw = typeof item.accentHex === 'string' ? item.accentHex.trim() : '';
      const matchedPreset =
        HUB_ACCENT_PRESETS.find((p) => p.accentHex.toLowerCase() === accentHexRaw.toLowerCase()) ??
        fallbackDefault;
      const badgeClass =
        typeof item.badgeClass === 'string' && item.badgeClass.trim()
          ? clip(item.badgeClass.trim(), 160)
          : matchedPreset.badgeClass;
      const defaultCategories = Array.isArray(item.defaultCategories)
        ? sanitizeStringList(item.defaultCategories, 30, 120)
        : [];
      return {
        id,
        title: title || `مجال ${idx + 1}`,
        shortTitle: shortTitle || title || `مجال ${idx + 1}`,
        englishTitle,
        purpose,
        accentHex: accentHexRaw || matchedPreset.accentHex,
        badgeClass,
        defaultCategories,
      };
    })
    .filter((h) => h.id.length > 0);
  return cleaned.length > 0 ? cleaned : DEFAULT_LEARNING_HUBS;
}

function sanitizeReadingModes(raw: unknown): ReadingMode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => clip(typeof v === 'string' ? v.trim() : '', 80))
    .filter(Boolean)
    .slice(0, 16);
}

function sanitizeCustomReadingModesConfig(raw: unknown): ReadingModeMeta[] {
  if (!Array.isArray(raw) || raw.length === 0) return READING_MODES_META;
  const cleaned = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .slice(0, 24)
    .map((item, idx) => {
      const label = clip(typeof item.label === 'string' ? item.label.trim() : '', 100);
      const shortLabel = clip(
        typeof item.shortLabel === 'string' && item.shortLabel.trim()
          ? item.shortLabel.trim()
          : label,
        50
      );
      const idRaw = typeof item.id === 'string' ? item.id.trim() : '';
      return {
        id: clip(idRaw || `mode_${idx + 1}`, 80),
        label,
        shortLabel,
        description: clip(
          typeof item.description === 'string' ? item.description.trim() : '',
          320
        ),
      };
    })
    .filter((m) => m.label.length > 0);
  return cleaned.length > 0 ? cleaned : READING_MODES_META;
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

function sanitizeTimeSlotOrEmpty(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return /^\d{1,2}:\d{2}$/.test(trimmed) ? trimmed : '';
}

function pickEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function parsePositiveInt(raw: unknown, docIdHint?: string, prefix?: string): number {
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0) return Math.round(num);
  if (typeof docIdHint === 'string' && prefix) {
    const match = docIdHint.match(new RegExp(`^${prefix}-(\\d+)`));
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    }
  }
  return 1;
}

function sanitizeCalendarPrefs(raw?: Partial<CalendarPreferences>): CalendarPreferences {
  const defaultView =
    raw?.defaultView === 'day' ||
    raw?.defaultView === 'week' ||
    raw?.defaultView === 'month' ||
    raw?.defaultView === 'year'
      ? raw.defaultView
      : DEFAULT_CALENDAR_PREFERENCES.defaultView;
  const density =
    raw?.density === 'compact' || raw?.density === 'expanded'
      ? raw.density
      : DEFAULT_CALENDAR_PREFERENCES.density;
  const weekStartDay =
    raw?.weekStartDay === 0 || raw?.weekStartDay === 1 || raw?.weekStartDay === 6
      ? raw.weekStartDay
      : DEFAULT_CALENDAR_PREFERENCES.weekStartDay;
  const filterHubRaw = typeof raw?.filterHub === 'string' ? raw.filterHub.trim() : 'all';
  const filterHub =
    filterHubRaw === 'all' || !filterHubRaw
      ? 'all'
      : sanitizeHubId(filterHubRaw);
  const filterPriority =
    raw?.filterPriority === 'low' ||
    raw?.filterPriority === 'medium' ||
    raw?.filterPriority === 'high'
      ? raw.filterPriority
      : 'all';
  const filterStatus =
    raw?.filterStatus === 'pending' || raw?.filterStatus === 'done'
      ? raw.filterStatus
      : 'all';

  return {
    defaultView,
    density,
    showCompleted: raw?.showCompleted !== false,
    showWeekends: raw?.showWeekends !== false,
    weekStartDay,
    filterHub,
    filterPriority,
    filterStatus,
  };
}

function sanitizeResourceList(items: StudyResource[]): StudyResource[] {
  return (items || []).slice(0, 40).map((r) => ({
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
    ...(r.storagePath || r.storageProvider
      ? {
          storageProvider: resolveEffectiveStorageProvider(
            r.storageProvider,
            r.storagePath
          ),
        }
      : {}),
    ...(r.downloadUrl ? { downloadUrl: clip(r.downloadUrl, 1200) } : {}),
    ...(r.mimeType ? { mimeType: clip(r.mimeType, 120) } : {}),
    ...(typeof r.sizeBytes === 'number' && r.sizeBytes >= 0
      ? { sizeBytes: Math.round(r.sizeBytes) }
      : {}),
    custom: Boolean(r.custom),
  }));
}

function sanitizeLearningObjectives(raw: unknown): LearningObjective[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .slice(0, 60)
    .map((item, idx) => ({
      id: clip(typeof item.id === 'string' && item.id ? item.id : `obj-${idx + 1}`, 128),
      text: clip(typeof item.text === 'string' ? item.text.trim() : '', 500),
      achieved: Boolean(item.achieved),
      ...(typeof item.createdAt === 'string' && item.createdAt
        ? { createdAt: clip(item.createdAt, 60) }
        : {}),
    }))
    .filter((obj) => obj.text.length > 0);
}

function sanitizeStringList(raw: unknown, maxItems = 30, maxLen = 120): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => clip(typeof s === 'string' ? s.trim() : '', maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeWeeklyRhythm(raw: unknown): WeeklyRhythmItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_WEEKLY_RHYTHM;
  const validDays = new Set<string>(WEEKLY_RHYTHM_DAYS);
  const cleaned = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .slice(0, 20)
    .map((item, idx) => {
      const hours = Number(item.targetHours);
      const safeHours = Number.isFinite(hours) && hours >= 0 && hours <= 80 ? hours : undefined;
      return {
        id: clip(typeof item.id === 'string' && item.id ? item.id : `rhythm-${idx + 1}`, 100),
        pillar: clip(typeof item.pillar === 'string' ? item.pillar.trim() : 'نشاط أسبوعي', 160),
        suggestedDuration: clip(
          typeof item.suggestedDuration === 'string'
            ? item.suggestedDuration.trim()
            : safeHours !== undefined
            ? `${safeHours} ساعات أسبوعيًا`
            : '1 ساعة أسبوعيًا',
          80
        ),
        ...(safeHours !== undefined ? { targetHours: safeHours } : {}),
        focus: clip(typeof item.focus === 'string' ? item.focus.trim() : '', 240),
        guideline: clip(typeof item.guideline === 'string' ? item.guideline.trim() : '', 500),
        days: Array.isArray(item.days)
          ? item.days.filter((d): d is string => typeof d === 'string' && validDays.has(d)).slice(0, 7)
          : [],
        active: item.active !== false,
      };
    })
    .filter((item) => item.pillar.length > 0);
  return cleaned.length > 0 ? cleaned : DEFAULT_WEEKLY_RHYTHM;
}

function sanitizeSafeHttpUrl(raw: unknown, maxLen = 500): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().slice(0, maxLen);
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

function sanitizePublicQuotesList(rawList: unknown): UserQuoteItem[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter(
      (q): q is Record<string, unknown> =>
        Boolean(q && typeof q === 'object' && typeof (q as Record<string, unknown>).text === 'string' && String((q as Record<string, unknown>).text).trim())
    )
    .slice(0, 60)
    .map((q, idx) => ({
      id: sanitizeId(typeof q.id === 'string' && q.id ? q.id : `pub_q_${idx + 1}`),
      text: clip(String(q.text).trim(), 600),
      author: clip(typeof q.author === 'string' ? q.author.trim() : '', 120),
      theme: typeof q.theme === 'string' && q.theme.trim() ? clip(q.theme.trim(), 80) : undefined,
      dateKey:
        typeof q.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.dateKey)
          ? q.dateKey
          : toLocalDateKey(),
      colorKey:
        typeof q.colorKey === 'string' && q.colorKey.trim()
          ? clip(q.colorKey.trim(), 40)
          : undefined,
      reflection:
        typeof q.reflection === 'string' && q.reflection.trim()
          ? clip(q.reflection.trim(), 2000)
          : undefined,
      isDailyPinned: Boolean(q.isDailyPinned),
      isPublic: true,
      createdAtMs: Number(q.createdAtMs) || Date.now(),
      updatedAtMs: Number(q.updatedAtMs) || Date.now(),
    }));
}

function mapPublicSiteConfigRow(raw: Record<string, unknown> | null | undefined): PublicSiteConfig {
  if (!raw) return DEFAULT_PUBLIC_SITE_CONFIG;
  const rawFlags =
    raw.visibility_flags && typeof raw.visibility_flags === 'object'
      ? (raw.visibility_flags as Record<string, unknown>)
      : {};
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sections: PublicSiteSection[] = rawSections
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .slice(0, 20)
    .map((s, idx) => ({
      id: clip(typeof s.id === 'string' && s.id ? s.id : `sec-${idx + 1}`, 100),
      title: clip(typeof s.title === 'string' ? s.title : '', 200),
      body: clip(typeof s.body === 'string' ? s.body : '', 4000),
      visible: s.visible !== false,
    }))
    .filter((s) => s.title.trim().length > 0 || s.body.trim().length > 0);

  return {
    id: String(raw.id || 'main'),
    ownerId: String(raw.owner_id || ''),
    heroTitle: String(raw.hero_title ?? DEFAULT_PUBLIC_SITE_CONFIG.heroTitle),
    heroSubtitle: String(raw.hero_subtitle ?? DEFAULT_PUBLIC_SITE_CONFIG.heroSubtitle),
    introBio: String(raw.intro_bio ?? DEFAULT_PUBLIC_SITE_CONFIG.introBio),
    backgroundText: String(raw.background_text ?? DEFAULT_PUBLIC_SITE_CONFIG.backgroundText),
    skills: Array.isArray(raw.skills)
      ? sanitizeStringList(raw.skills, 30, 100)
      : DEFAULT_PUBLIC_SITE_CONFIG.skills,
    interests: Array.isArray(raw.interests)
      ? sanitizeStringList(raw.interests, 30, 100)
      : DEFAULT_PUBLIC_SITE_CONFIG.interests,
    philosophyText: String(raw.philosophy_text ?? DEFAULT_PUBLIC_SITE_CONFIG.philosophyText),
    sections: sections.length > 0 || Array.isArray(raw.sections)
      ? sections
      : DEFAULT_PUBLIC_SITE_CONFIG.sections,
    visibilityFlags: {
      showHero: rawFlags.showHero !== false,
      showBackground: rawFlags.showBackground !== false,
      showSkills: rawFlags.showSkills !== false,
      showInterests: rawFlags.showInterests !== false,
      showPhilosophy: rawFlags.showPhilosophy !== false,
      showCourses: rawFlags.showCourses !== false,
      showPaths: rawFlags.showPaths !== false,
      showBooks: rawFlags.showBooks !== false,
      showReflections: rawFlags.showReflections !== false,
      showBlogs: rawFlags.showBlogs !== false,
      showQuotes: rawFlags.showQuotes !== false,
    },
    publicReflectionCategories: sanitizeStringList(
      raw.public_reflection_categories,
      40,
      80
    ),
    publicQuotes: sanitizePublicQuotesList(rawFlags.publicQuotes),
    pinnedPublicQuoteId:
      typeof rawFlags.pinnedPublicQuoteId === 'string' && rawFlags.pinnedPublicQuoteId.trim()
        ? clip(rawFlags.pinnedPublicQuoteId.trim(), 128)
        : null,
    publicQuotesHeading:
      typeof rawFlags.publicQuotesHeading === 'string' && rawFlags.publicQuotesHeading.trim()
        ? clip(rawFlags.publicQuotesHeading.trim(), 160)
        : DEFAULT_PUBLIC_SITE_CONFIG.publicQuotesHeading,
    creatorName:
      typeof rawFlags.creatorName === 'string' && rawFlags.creatorName.trim()
        ? clip(rawFlags.creatorName.trim(), 120)
        : DEFAULT_PUBLIC_SITE_CONFIG.creatorName,
    linkedinUrl: sanitizeSafeHttpUrl(rawFlags.linkedinUrl),
    contactEmail:
      typeof rawFlags.contactEmail === 'string' && rawFlags.contactEmail.trim()
        ? clip(rawFlags.contactEmail.trim(), 160)
        : DEFAULT_PUBLIC_SITE_CONFIG.contactEmail,
    showContactForm: rawFlags.showContactForm !== false,
    updatedAtMs: Number(raw.updated_at_ms ?? 0),
  };
}

// ============================================================================
// Payload Builders (TypeScript Domain Model -> PostgreSQL Row)
// ============================================================================

export function buildQuarterRow(uid: string, q: QuarterInfo) {
  const rawNum = Number(q.number);
  const safeNumber =
    Number.isFinite(rawNum) && rawNum > 0 ? Math.min(999, Math.round(rawNum)) : 1;
  return {
    owner_id: uid,
    id: sanitizeId(q.id || `quarter-${safeNumber}`),
    number: safeNumber,
    title: clip(q.title || `المرحلة ${safeNumber}`, 200),
    subtitle: clip(q.subtitle || '', 300),
  };
}

export function buildMonthRow(uid: string, m: MonthPlan) {
  const docId = sanitizeId(m.docId || `month-${m.id ?? 1}`);
  const monthNumber = parsePositiveInt(m.id, docId, 'month');
  const rawQuarter = Number(m.quarter);
  const safeQuarter =
    Number.isFinite(rawQuarter) && rawQuarter > 0 ? Math.min(99, Math.round(rawQuarter)) : 1;
  return {
    owner_id: uid,
    doc_id: docId,
    month_number: Math.min(999, monthNumber),
    hub_id: sanitizeHubId(m.hubId),
    quarter: safeQuarter,
    quarter_title: clip(m.quarterTitle, 200),
    theme: clip(m.theme, 250),
    foundational: {
      title: clip(m.foundational?.title, 300),
      author: clip(m.foundational?.author, 200),
      format: clip(m.foundational?.format || 'كتاب', 80),
      domainId: sanitizeId(m.foundational?.domainId || 'islamic_thought'),
      pace: clip(m.foundational?.pace, 120),
      focus: clip(m.foundational?.focus, 400),
    },
    exploratory: {
      title: clip(m.exploratory?.title, 300),
      author: clip(m.exploratory?.author, 200),
      format: clip(m.exploratory?.format || 'كتاب', 80),
      domainId: sanitizeId(m.exploratory?.domainId || 'philosophy_logic'),
      pace: clip(m.exploratory?.pace, 120),
      focus: clip(m.exploratory?.focus, 400),
    },
    course_id: Math.max(0, Math.round(Number(m.courseId) || 0)),
    discussion_prompt: clip(m.discussionPrompt, 1000),
    application_task: clip(m.applicationTask, 1000),
    activities: {
      reading: Boolean(m.activities?.reading),
      listening: Boolean(m.activities?.listening),
      summarizing: Boolean(m.activities?.summarizing),
      discussing: Boolean(m.activities?.discussing),
    },
    status: pickEnum(m.status, ['not_started', 'in_progress', 'completed'] as const, 'not_started'),
    notes: clip(m.notes, 20000),
    tasks: (Array.isArray(m.tasks) ? m.tasks : []).slice(0, 60).map((t) => ({
      id: clip(t.id, 128),
      text: clip(t.text, 500),
      track: t.track || 'foundational',
      done: Boolean(t.done),
      custom: Boolean(t.custom),
    })),
    resources: sanitizeResourceList(Array.isArray(m.resources) ? m.resources : []),
    reading_modes: sanitizeReadingModes(m.readingModes),
    learning_methods: sanitizeLearningMethods(m.learningMethods),
    review_count: Math.max(0, Math.min(999, Math.round(Number(m.reviewCount) || 0))),
    listen_count: Math.max(0, Math.min(999, Math.round(Number(m.listenCount) || 0))),
    repetition_stage: Math.max(0, Math.min(10, Math.round(Number(m.repetitionStage) || 0))),
    next_review_date_key: sanitizeDateKeyOrEmpty(m.nextReviewDateKey),
    last_reviewed_date_key: sanitizeDateKeyOrEmpty(m.lastReviewedDateKey),
  };
}

export function buildDomainRow(uid: string, d: DomainInfo, order: number) {
  const rawOrder = Number(d.order ?? order);
  return {
    owner_id: uid,
    id: sanitizeId(d.id || `domain_${order}`),
    sort_order: Number.isFinite(rawOrder) ? Math.max(0, Math.min(999, Math.round(rawOrder))) : order,
    hub_id: sanitizeHubId(d.hubId),
    title: clip(d.title, 200),
    subtitle: clip(d.subtitle, 300),
    purpose: clip(d.purpose, 1000),
    thinkers: (Array.isArray(d.thinkers) ? d.thinkers : []).slice(0, 30).map((t) => ({
      name: clip(t.name, 160),
      role: clip(t.role, 200),
      keyWorks: (Array.isArray(t.keyWorks) ? t.keyWorks : []).slice(0, 12).map((w) => clip(w, 200)),
      contribution: clip(t.contribution, 600),
    })),
  };
}

export function buildCourseRow(uid: string, c: PersonalCourse) {
  const docId = sanitizeId(c.docId || `course-${c.id ?? Date.now()}`);
  const courseNumber = parsePositiveInt(c.id, docId, 'course');
  const studyStage = sanitizeCourseStudyStage(c.studyStage, c.completed);
  return {
    owner_id: uid,
    doc_id: docId,
    course_number: courseNumber,
    hub_id: sanitizeHubId(c.hubId),
    title: clip(c.title, 300),
    category: clip(c.category, 160),
    study_stage: studyStage,
    scheduled_period: clip(c.scheduledPeriod, 120),
    instructor: clip(c.instructor, 200),
    platform: clip(c.platform, 200),
    duration_label: clip(c.durationLabel, 120),
    start_date: clip(c.startDate, 60),
    target_date: clip(c.targetDate, 60),
    progress_pct: Math.max(0, Math.min(100, Math.round(Number(c.progressPct) || 0))),
    notes: clip(c.notes, 20000),
    linked_months: (Array.isArray(c.linkedMonths) ? c.linkedMonths : [])
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 999)
      .slice(0, 24),
    complementary_book: clip(c.complementaryBook, 300),
    book_author: clip(c.bookAuthor, 250),
    application_milestone: clip(c.applicationMilestone, 1000),
    completed: studyStage === 'completed' ? true : Boolean(c.completed),
    learning_objectives: sanitizeLearningObjectives(c.learningObjectives),
    sort_order: Math.max(0, Math.round(Number(c.sortOrder) || 0)),
    is_public: Boolean(c.isPublic),
    resources: sanitizeResourceList(Array.isArray(c.resources) ? c.resources : []),
    tasks: (Array.isArray(c.tasks) ? c.tasks : []).slice(0, 80).map((t) => ({
      id: clip(t.id, 128),
      text: clip(t.text, 500),
      track: t.track || 'action',
      done: Boolean(t.done),
      custom: Boolean(t.custom),
    })),
    reading_modes: sanitizeReadingModes(c.readingModes),
    learning_methods: sanitizeLearningMethods(c.learningMethods),
    review_count: Math.max(0, Math.min(999, Math.round(Number(c.reviewCount) || 0))),
    listen_count: Math.max(0, Math.min(999, Math.round(Number(c.listenCount) || 0))),
    repetition_stage: Math.max(0, Math.min(10, Math.round(Number(c.repetitionStage) || 0))),
    next_review_date_key: sanitizeDateKeyOrEmpty(c.nextReviewDateKey),
    last_reviewed_date_key: sanitizeDateKeyOrEmpty(c.lastReviewedDateKey),
  };
}

export function buildBookNoteRow(uid: string, bn: BookNote) {
  const noteType: NoteCategoryType = pickEnum(
    bn.noteType,
    ['book', 'course_lecture', 'general'] as const,
    'book'
  );
  return {
    owner_id: uid,
    id: sanitizeId(bn.id),
    hub_id: sanitizeHubId(bn.hubId),
    note_type: noteType,
    note_color: sanitizeNoteColor(bn.noteColor),
    book_title: clip(bn.bookTitle, 300),
    author: clip(bn.author, 200),
    course_id: Math.max(0, Math.round(Number(bn.courseId) || 0)),
    course_title: clip(bn.courseTitle, 250),
    lecture_title: clip(bn.lectureTitle, 250),
    category_label: clip(bn.categoryLabel, 120),
    progress_marker: clip(bn.progressMarker, 200),
    content: clip(bn.content, 200000),
    quotes: clip(bn.quotes, 60000),
    updated_at_label: clip(bn.updatedAt, 100),
    resources: sanitizeResourceList(Array.isArray(bn.resources) ? bn.resources : []),
    sort_order: Math.max(0, Math.round(Number(bn.sortOrder) || 0)),
    created_at_ms: Math.max(0, Math.round(Number(bn.createdAtMs) || 0)),
    reading_modes: sanitizeReadingModes(bn.readingModes),
    learning_methods: sanitizeLearningMethods(bn.learningMethods),
    review_count: Math.max(0, Math.min(999, Math.round(Number(bn.reviewCount) || 0))),
    listen_count: Math.max(0, Math.min(999, Math.round(Number(bn.listenCount) || 0))),
    repetition_stage: Math.max(0, Math.min(10, Math.round(Number(bn.repetitionStage) || 0))),
    next_review_date_key: sanitizeDateKeyOrEmpty(bn.nextReviewDateKey),
    last_reviewed_date_key: sanitizeDateKeyOrEmpty(bn.lastReviewedDateKey),
  };
}

export function buildCustomCategoryRow(uid: string, cat: CustomCategory) {
  const hubId: LearningHubId | 'all' =
    !cat.hubId || cat.hubId === 'all' ? 'all' : sanitizeHubId(cat.hubId);
  return {
    owner_id: uid,
    id: sanitizeId(cat.id),
    hub_id: hubId,
    title: clip(cat.title, 160),
    description: clip(cat.description, 400),
    color: pickEnum(cat.color, ['navy', 'emerald', 'amber', 'slate'] as const, 'navy'),
    created_at_label: clip(cat.createdAtLabel, 80),
  };
}

export function buildHistoryRow(uid: string, entry: StudyHistoryEntry) {
  const rawMs = Number(entry.createdAtMs);
  return {
    owner_id: uid,
    id: sanitizeId(entry.id),
    action_type: pickEnum(
      entry.actionType,
      ['note', 'voice', 'task', 'course', 'domain', 'month'] as const,
      'note'
    ),
    title: clip(entry.title, 250),
    detail: clip(entry.detail, 400),
    target_tab: clip(entry.targetTab || 'overview', 60),
    target_note_id: clip(entry.targetNoteId, 128),
    target_month_id: Math.max(0, Math.round(Number(entry.targetMonthId) || 0)),
    target_course_id: Math.max(0, Math.round(Number(entry.targetCourseId) || 0)),
    timestamp_label: clip(entry.timestampLabel, 80),
    created_at_ms: Number.isFinite(rawMs) ? Math.round(rawMs) : 0,
  };
}

export function buildUserPreferencesRow(uid: string, prefs: UserPreferences) {
  const sanitizedHubs = sanitizeCustomHubs(prefs.customHubs);
  const rawCats = prefs.hubCategories ?? DEFAULT_HUB_CATEGORIES;
  const cleanHubCategories: Record<string, string[]> = {
    marketing: (Array.isArray(rawCats.marketing) ? rawCats.marketing : DEFAULT_HUB_CATEGORIES.marketing)
      .map((s) => clip(String(s).trim(), 120))
      .filter(Boolean)
      .slice(0, 30),
    dental_career: (Array.isArray(rawCats.dental_career) ? rawCats.dental_career : DEFAULT_HUB_CATEGORIES.dental_career)
      .map((s) => clip(String(s).trim(), 120))
      .filter(Boolean)
      .slice(0, 30),
    knowledge: (Array.isArray(rawCats.knowledge) ? rawCats.knowledge : DEFAULT_HUB_CATEGORIES.knowledge)
      .map((s) => clip(String(s).trim(), 120))
      .filter(Boolean)
      .slice(0, 30),
  };

  for (const [k, v] of Object.entries(rawCats)) {
    const cleanKey = sanitizeHubId(k);
    if (cleanKey && Array.isArray(v) && !(cleanKey in cleanHubCategories)) {
      cleanHubCategories[cleanKey] = v
        .map((s) => clip(String(s).trim(), 120))
        .filter(Boolean)
        .slice(0, 30);
    }
  }
  for (const h of sanitizedHubs) {
    if (!(h.id in cleanHubCategories)) {
      cleanHubCategories[h.id] = h.defaultCategories.length > 0 ? h.defaultCategories : ['عام', 'أساسي', 'متقدم'];
    }
  }

  const sanitizedPins = Array.isArray(prefs.pinnedNavTabs)
    ? sanitizeStringList(prefs.pinnedNavTabs, 20, 40)
    : DEFAULT_PINNED_NAV_TABS;
  const sanitizedTabOrder =
    Array.isArray(prefs.navTabOrder) && prefs.navTabOrder.length > 0
      ? sanitizeStringList(prefs.navTabOrder, 30, 40)
      : DEFAULT_NAV_TAB_ORDER;

  const heroUrl = clip(prefs.dashboardHeroImageUrl || '', 2000);
  const heroStoragePath = clip(prefs.dashboardHeroImageStoragePath || '', 500);
  const heroFrame = prefs.dashboardHeroImageFrame
    ? sanitizeImageFrameSpec(
        prefs.dashboardHeroImageFrame,
        DEFAULT_DASHBOARD_HERO_FRAME
      )
    : undefined;
  const dashboardHeroObj =
    heroUrl || heroStoragePath || heroFrame
      ? {
          imageUrl: heroUrl,
          storagePath: heroStoragePath,
          ...(heroFrame ? { frame: heroFrame } : {}),
        }
      : {};

  const validStatuses: UnifiedTaskStatus[] = ['todo', 'in_progress', 'postponed', 'done'];
  const sanitizedHiddenStatuses = Array.isArray(prefs.hiddenTaskStatuses)
    ? Array.from(
        new Set(
          prefs.hiddenTaskStatuses.filter((s): s is UnifiedTaskStatus =>
            validStatuses.includes(s)
          )
        )
      )
    : [];
  const sanitizedQuotesLibrary: UserQuoteItem[] = Array.isArray(prefs.quotesLibrary)
    ? prefs.quotesLibrary
        .filter((q): q is UserQuoteItem => Boolean(q && typeof q.text === 'string' && q.text.trim()))
        .slice(0, 200)
        .map((q) => ({
          id: sanitizeId(q.id || `q_${Date.now()}`),
          text: clip(q.text.trim(), 600),
          author: clip((q.author || '').trim(), 120),
          theme: q.theme ? clip(q.theme.trim(), 80) : undefined,
          dateKey: sanitizeDateKeyOrEmpty(q.dateKey) || toLocalDateKey(),
          colorKey: q.colorKey ? clip(q.colorKey, 40) : undefined,
          reflection: q.reflection ? clip(q.reflection, 4000) : undefined,
          isDailyPinned: Boolean(q.isDailyPinned),
          isPublic: Boolean(q.isPublic),
          createdAtMs: Number(q.createdAtMs) || Date.now(),
          updatedAtMs: Number(q.updatedAtMs) || Date.now(),
        }))
    : [];
  const extraPrefsObj = {
    hiddenTaskStatuses: sanitizedHiddenStatuses,
    quotesLibrary: sanitizedQuotesLibrary,
    pinnedDailyQuoteId: prefs.pinnedDailyQuoteId
      ? clip(String(prefs.pinnedDailyQuoteId), 128)
      : null,
    hiddenActivityIds: Array.isArray(prefs.hiddenActivityIds)
      ? sanitizeStringList(prefs.hiddenActivityIds, 300, 128)
      : [],
    hiddenActivityTypes: Array.isArray(prefs.hiddenActivityTypes)
      ? sanitizeStringList(prefs.hiddenActivityTypes, 20, 40)
      : [],
    minimalWritingMode: Boolean(prefs.minimalWritingMode),
    recoveryPathWorkspaces: sanitizeRecoveryWorkspacesMap(
      prefs.recoveryPathWorkspaces
    ),
  };

  return {
    owner_id: uid,
    id: 'settings',
    note_font_size: pickEnum(prefs.noteFontSize, ['sm', 'base', 'lg'] as const, DEFAULT_USER_PREFERENCES.noteFontSize),
    note_highlight_color: pickEnum(prefs.noteHighlightColor, ['amber', 'emerald', 'sky', 'rose'] as const, DEFAULT_USER_PREFERENCES.noteHighlightColor),
    note_paper_tone: pickEnum(prefs.notePaperTone, ['clean', 'warm', 'slate'] as const, DEFAULT_USER_PREFERENCES.notePaperTone),
    note_margin: pickEnum(prefs.noteMargin, ['compact', 'normal', 'wide', 'spacious'] as const, 'normal'),
    note_width: pickEnum(prefs.noteWidth, ['focused', 'balanced', 'full'] as const, 'focused'),
    note_border: pickEnum(prefs.noteBorder, ['none', 'subtle', 'medium', 'framed'] as const, 'subtle'),
    auto_add_timestamp_on_voice: Boolean(prefs.autoAddTimestampOnVoice),
    voice_dialect: pickEnum(prefs.voiceDialect, ['standard_arabic', 'egyptian_arabic', 'bilingual'] as const, DEFAULT_USER_PREFERENCES.voiceDialect),
    voice_insert_mode: pickEnum(prefs.voiceInsertMode, ['append_paragraph', 'append_bullet', 'append_quote'] as const, DEFAULT_USER_PREFERENCES.voiceInsertMode),
    read_aloud_voice: pickEnum(prefs.readAloudVoice, ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const, DEFAULT_USER_PREFERENCES.readAloudVoice),
    read_aloud_speed: pickEnum(prefs.readAloudSpeed, ['normal', 'calm'] as const, DEFAULT_USER_PREFERENCES.readAloudSpeed),
    show_excel_export: prefs.showExcelExport !== false,
    hub_categories: cleanHubCategories,
    calendar_prefs: {
      ...sanitizeCalendarPrefs(prefs.calendarPrefs),
      pinnedNavTabsMirror: sanitizedPins,
      navTabOrderMirror: sanitizedTabOrder,
      customHubsMirror: sanitizedHubs,
      dashboardHeroMirror: dashboardHeroObj,
      taskStatusOrderMirror: sanitizeTaskStatusOrder(prefs.taskStatusOrder),
      activeFocusPinCollectionIdMirror: prefs.activeFocusPinCollectionId
        ? clip(String(prefs.activeFocusPinCollectionId), 128)
        : null,
      themeConfigMirror: sanitizeThemeConfig(prefs.themeConfig ?? DEFAULT_THEME_CONFIG),
      extraPrefsMirror: extraPrefsObj,
    },
    weekly_rhythm: sanitizeWeeklyRhythm(prefs.weeklyRhythm),
    reflection_categories: sanitizeStringList(
      prefs.reflectionCategories ?? DEFAULT_REFLECTION_CATEGORIES,
      40,
      80
    ),
    custom_reading_modes: sanitizeCustomReadingModesConfig(
      prefs.customReadingModes ?? READING_MODES_META
    ),
    pinned_nav_tabs: sanitizedPins,
    custom_hubs: sanitizedHubs,
    dashboard_hero: dashboardHeroObj,
    extra_prefs: extraPrefsObj,
  };
}

export function buildReflectionRow(uid: string, r: PersonalReflection) {
  const rawMs = Number(r.createdAtMs);
  return {
    owner_id: uid,
    id: sanitizeId(r.id),
    title: clip(r.title, 200),
    content: clip(r.content, 20000),
    mood_tag: pickEnum(r.moodTag, ['تأمل', 'فكرة', 'امتنان', 'هدف'] as const, 'تأمل'),
    category_tag: clip(r.categoryTag, 80),
    color_key: sanitizeReflectionColor(r.colorKey),
    is_public: Boolean(r.isPublic),
    image_url: clip(r.imageUrl || '', 2000),
    image_storage_path: clip(r.imageStoragePath || '', 500),
    image_storage_provider: resolveEffectiveStorageProvider(
      r.imageStorageProvider,
      r.imageStoragePath
    ),
    image_frame: r.imageFrame
      ? sanitizeImageFrameSpec(r.imageFrame, DEFAULT_REFLECTION_IMAGE_FRAME)
      : {},
    pinned: Boolean(r.pinned),
    created_at_label: clip(r.createdAtLabel, 80),
    created_at_ms: Number.isFinite(rawMs) ? Math.round(rawMs) : 0,
  };
}

export function buildBlogPostRow(uid: string, post: BlogPost) {
  const rawMs = Number(post.createdAtMs);
  const readingMins =
    typeof post.readingTimeMinutes === 'number' && post.readingTimeMinutes > 0
      ? Math.min(180, Math.round(post.readingTimeMinutes))
      : estimateReadingTimeMinutes(post.content);
  return {
    owner_id: uid,
    id: sanitizeId(post.id),
    title: clip(post.title, 260),
    subtitle: clip(post.subtitle || '', 400),
    excerpt: clip(post.excerpt || '', 1200),
    content: clip(post.content, 60000),
    category_label: clip(post.categoryLabel || '', 100),
    cover_image_url: clip(post.coverImageUrl || '', 2000),
    cover_storage_path: clip(post.coverStoragePath || '', 500),
    cover_storage_provider: resolveEffectiveStorageProvider(
      post.coverStorageProvider,
      post.coverStoragePath
    ),
    cover_frame: post.coverFrame
      ? sanitizeImageFrameSpec(post.coverFrame, DEFAULT_IMAGE_FRAME_SPEC)
      : {},
    reading_time_minutes: readingMins,
    is_public: Boolean(post.isPublic),
    pinned: Boolean(post.pinned),
    sort_order: Math.max(0, Math.round(Number(post.sortOrder) || 0)),
    created_at_label: clip(post.createdAtLabel, 80),
    created_at_ms: Number.isFinite(rawMs) ? Math.round(rawMs) : 0,
    updated_at_label: clip(post.updatedAtLabel || '', 80),
  };
}

export function buildCalendarEventRow(uid: string, ev: CalendarEvent) {
  return {
    owner_id: uid,
    id: sanitizeId(ev.id),
    date_key: clip(ev.dateKey, 20),
    time_slot: clip(ev.timeSlot, 20),
    end_time: sanitizeTimeSlotOrEmpty(ev.endTime),
    duration_minutes:
      typeof ev.durationMinutes === 'number' && ev.durationMinutes > 0
        ? Math.min(720, Math.round(ev.durationMinutes))
        : null,
    title: clip(ev.title, 240),
    notes: clip(ev.notes, 3000),
    category: pickEnum(ev.category, ['شخصي', 'دراسة', 'موعد', 'مراجعة', 'قراءة'] as const, 'شخصي'),
    color: pickEnum(ev.color, ['navy', 'emerald', 'amber', 'rose'] as const, 'navy'),
    done: Boolean(ev.done),
    linked_task_text: clip(ev.linkedTaskText, 240),
    linked_task_id: ev.linkedTaskId ? clip(ev.linkedTaskId, 128) : null,
  };
}

export function buildLearningPathRow(uid: string, path: LearningPath) {
  return {
    owner_id: uid,
    id: sanitizeId(path.id),
    title: clip(path.title, 240),
    description: clip(path.description, 2000),
    hub_id: sanitizeHubId(path.hubId),
    category_label: clip(path.categoryLabel, 140),
    objectives: clip(path.objectives, 2000),
    learning_objectives: sanitizeLearningObjectives(path.learningObjectives),
    sort_order: Math.max(0, Math.round(Number(path.sortOrder) || 0)),
    is_public: Boolean(path.isPublic),
    current_level: clip(path.currentLevel, 160),
    target_level: clip(path.targetLevel, 160),
    start_date: clip(path.startDate, 40),
    expected_completion_date: clip(path.expectedCompletionDate, 40),
    progress_pct: Math.max(0, Math.min(100, Math.round(Number(path.progressPct) || 0))),
    status: pickEnum(path.status, ['planned', 'in_progress', 'completed'] as const, 'planned'),
    stages: (Array.isArray(path.stages) ? path.stages : []).slice(0, 50).map((s) => ({
      id: clip(s.id, 128),
      title: clip(s.title, 300),
      done: Boolean(s.done),
      notes: clip(s.notes, 600),
    })),
    linked_course_ids: (Array.isArray(path.linkedCourseIds) ? path.linkedCourseIds : [])
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n) && n >= 1)
      .slice(0, 30),
    reading_modes: sanitizeReadingModes(path.readingModes),
    learning_methods: sanitizeLearningMethods(path.learningMethods),
    review_count: Math.max(0, Math.min(999, Math.round(Number(path.reviewCount) || 0))),
    listen_count: Math.max(0, Math.min(999, Math.round(Number(path.listenCount) || 0))),
  };
}

function sanitizeBookWorkspaceData(raw: unknown): BookWorkspaceData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const notesHtml = typeof obj.notesHtml === 'string' ? clip(obj.notesHtml, 60000) : '';
  const insightsHtml =
    typeof obj.insightsHtml === 'string' ? clip(obj.insightsHtml, 40000) : '';
  const quotesHtml =
    typeof obj.quotesHtml === 'string' ? clip(obj.quotesHtml, 40000) : '';
  const rawChapters = Array.isArray(obj.chapters) ? obj.chapters : [];
  const chapters: BookChapterNote[] = rawChapters
    .filter((ch): ch is Record<string, unknown> => Boolean(ch && typeof ch === 'object'))
    .slice(0, 60)
    .map((ch, idx) => ({
      id: clip(String(ch.id || `ch-${idx + 1}`), 120),
      title: clip(String(ch.title || `فصل ${idx + 1}`), 240),
      contentHtml: clip(String(ch.contentHtml || ''), 40000),
      updatedAtMs: Number.isFinite(Number(ch.updatedAtMs))
        ? Math.round(Number(ch.updatedAtMs))
        : 0,
    }));

  const paperRaw = String(obj.paperColor ?? '');
  const paperColor = VALID_NOTE_COLORS.includes(paperRaw as NoteColorKey)
    ? (paperRaw as NoteColorKey)
    : undefined;

  const sectionRaw = String(obj.lastActiveSection ?? '');
  const lastActiveSection: BookWorkspaceSection | undefined =
    sectionRaw === 'notes' ||
    sectionRaw === 'insights' ||
    sectionRaw === 'quotes' ||
    sectionRaw === 'chapters'
      ? (sectionRaw as BookWorkspaceSection)
      : undefined;

  if (
    !notesHtml &&
    !insightsHtml &&
    !quotesHtml &&
    chapters.length === 0 &&
    !paperColor &&
    !lastActiveSection
  ) {
    return undefined;
  }

  return {
    ...(notesHtml ? { notesHtml } : {}),
    ...(insightsHtml ? { insightsHtml } : {}),
    ...(quotesHtml ? { quotesHtml } : {}),
    ...(chapters.length > 0 ? { chapters } : {}),
    ...(paperColor ? { paperColor } : {}),
    ...(lastActiveSection ? { lastActiveSection } : {}),
  };
}

export function buildReadingItemRow(uid: string, item: ReadingLibraryItem) {
  const cleanWorkspace = sanitizeBookWorkspaceData(item.workspaceData);
  return {
    owner_id: uid,
    id: sanitizeId(item.id),
    title: clip(item.title, 300),
    author: clip(item.author, 200),
    hub_id: sanitizeHubId(item.hubId),
    category_label: clip(item.categoryLabel, 140),
    item_type: clip(item.itemType || 'كتاب', 80),
    status: pickEnum(item.status, ['to_read', 'reading', 'completed'] as const, 'to_read'),
    current_page: Math.max(0, Math.min(99999, Math.round(Number(item.currentPage) || 0))),
    total_pages: Math.max(0, Math.min(99999, Math.round(Number(item.totalPages) || 0))),
    takeaways: clip(item.takeaways, 20000),
    learning_objectives: sanitizeLearningObjectives(item.learningObjectives),
    sort_order: Math.max(0, Math.round(Number(item.sortOrder) || 0)),
    is_public: Boolean(item.isPublic),
    cover_image_url: clip(item.coverImageUrl || '', 2000),
    cover_storage_path: clip(item.coverStoragePath || '', 500),
    cover_storage_provider: resolveEffectiveStorageProvider(
      item.coverStorageProvider,
      item.coverStoragePath
    ),
    cover_frame: item.coverFrame
      ? sanitizeImageFrameSpec(item.coverFrame, DEFAULT_BOOK_COVER_FRAME)
      : {},
    workspace_data: cleanWorkspace ?? {},
    attachment_name: clip(item.attachmentName, 240),
    attachment_resource_id: clip(item.attachmentResourceId, 160),
    storage_bucket:
      resolveEffectiveStorageProvider(item.storageProvider, item.storagePath) === 'r2'
        ? 'r2'
        : 'study-files',
    storage_path: clip(item.storagePath, 400),
    storage_provider: resolveEffectiveStorageProvider(
      item.storageProvider,
      item.storagePath
    ),
    download_url: clip(item.downloadUrl, 1200),
    external_url: clip(item.externalUrl, 800),
    reading_modes: sanitizeReadingModes(item.readingModes),
    learning_methods: sanitizeLearningMethods(item.learningMethods),
    review_count: Math.max(0, Math.min(999, Math.round(Number(item.reviewCount) || 0))),
    listen_count: Math.max(0, Math.min(999, Math.round(Number(item.listenCount) || 0))),
    repetition_stage: Math.max(0, Math.min(10, Math.round(Number(item.repetitionStage) || 0))),
    next_review_date_key: sanitizeDateKeyOrEmpty(item.nextReviewDateKey),
    last_reviewed_date_key: sanitizeDateKeyOrEmpty(item.lastReviewedDateKey),
    updated_at_label: clip(item.updatedAtLabel, 100),
  };
}

export function buildPracticalProjectRow(uid: string, proj: PracticalProject) {
  return {
    owner_id: uid,
    id: sanitizeId(proj.id),
    title: clip(proj.title, 260),
    description: clip(proj.description, 2000),
    hub_id: sanitizeHubId(proj.hubId),
    category_label: clip(proj.categoryLabel, 140),
    objectives: clip(proj.objectives, 2000),
    status: pickEnum(proj.status, ['planned', 'in_progress', 'completed'] as const, 'planned'),
    progress_pct: Math.max(0, Math.min(100, Math.round(Number(proj.progressPct) || 0))),
    deliverables: clip(proj.deliverables, 2000),
    start_date: clip(proj.startDate, 40),
    target_date: clip(proj.targetDate, 40),
    linked_course_id: Math.max(0, Math.round(Number(proj.linkedCourseId) || 0)),
    notes: clip(proj.notes, 8000),
  };
}

export function buildUnifiedTaskRow(uid: string, task: UnifiedTask) {
  const courseIdNum = Number(task.linkedCourseId);
  const cleanRecurrence = normalizeRecurrenceRule(task.recurrence) ?? null;
  const cleanCompletedDates = Array.isArray(task.completedOccurrenceDates)
    ? Array.from(
        new Set(
          task.completedOccurrenceDates.filter(
            (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
          )
        )
      ).slice(-180)
    : [];
  return {
    owner_id: uid,
    id: sanitizeId(task.id),
    title: clip(task.title, 300),
    description: clip(task.description, 2000),
    hub_id: sanitizeHubId(task.hubId),
    category_label: clip(task.categoryLabel, 140),
    priority: pickEnum(task.priority, ['low', 'medium', 'high'] as const, 'medium'),
    status: pickEnum(task.status, ['todo', 'in_progress', 'postponed', 'done'] as const, 'todo'),
    due_date: clip(task.dueDate, 40),
    scheduled_date: sanitizeDateKeyOrEmpty(task.scheduledDate ?? task.dueDate),
    start_time: sanitizeTimeSlotOrEmpty(task.startTime),
    end_time: sanitizeTimeSlotOrEmpty(task.endTime),
    duration_minutes:
      typeof task.durationMinutes === 'number' && task.durationMinutes > 0
        ? Math.min(720, Math.round(task.durationMinutes))
        : null,
    deadline: sanitizeDateKeyOrEmpty(task.deadline),
    project_id: clip(task.projectId, 160),
    linked_label: clip(task.linkedLabel, 200),
    linked_course_id:
      Number.isFinite(courseIdNum) && courseIdNum > 0 ? Math.round(courseIdNum) : null,
    linked_path_id: clip(task.linkedPathId, 160),
    linked_book_id: clip(task.linkedBookId, 160),
    recurrence: cleanRecurrence,
    completed_occurrence_dates: cleanCompletedDates,
  };
}

export function buildWeeklyMeetingRow(uid: string, mtg: WeeklyMeeting) {
  const attendanceEntries = Object.entries(mtg.attendanceByDate || {}).slice(0, 120);
  const cleanAttendance: Record<string, MeetingAttendanceStatus> = {};
  for (const [k, v] of attendanceEntries) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
      cleanAttendance[k] =
        v === 'attended' || v === 'missed' || v === 'excused' ? v : 'pending';
    }
  }
  const notesEntries = Object.entries(mtg.notesByDate || {}).slice(0, 120);
  const cleanNotes: Record<string, string> = {};
  for (const [k, v] of notesEntries) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'string') {
      cleanNotes[k] = clip(v, 3000);
    }
  }
  const exEntries = Object.entries(mtg.exceptions || {}).slice(0, 120);
  const cleanExceptions: Record<string, WeeklyMeetingException> = {};
  for (const [k, v] of exEntries) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object') {
      cleanExceptions[k] = {
        ...(v.cancelled ? { cancelled: true } : {}),
        ...(v.movedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(v.movedDateKey)
          ? { movedDateKey: v.movedDateKey }
          : {}),
        ...(v.startTime ? { startTime: sanitizeTimeSlotOrEmpty(v.startTime) } : {}),
        ...(v.endTime ? { endTime: sanitizeTimeSlotOrEmpty(v.endTime) } : {}),
        ...(typeof v.durationMinutes === 'number' && v.durationMinutes > 0
          ? { durationMinutes: Math.min(720, Math.round(v.durationMinutes)) }
          : {}),
        ...(v.title ? { title: clip(v.title, 200) } : {}),
      };
    }
  }

  return {
    owner_id: uid,
    id: sanitizeId(mtg.id),
    title: clip(mtg.title, 260),
    description: clip(mtg.description, 2000),
    hub_id: sanitizeHubId(mtg.hubId),
    start_date: sanitizeDateKeyOrEmpty(mtg.startDate),
    day_of_week: Math.max(0, Math.min(6, Math.round(Number(mtg.dayOfWeek) || 6))),
    start_time: sanitizeTimeSlotOrEmpty(mtg.startTime) || '18:00',
    end_time: sanitizeTimeSlotOrEmpty(mtg.endTime) || '19:00',
    duration_minutes: Math.max(15, Math.min(720, Math.round(Number(mtg.durationMinutes) || 60))),
    is_recurring_weekly: Boolean(mtg.isRecurringWeekly),
    recurrence_end_date: sanitizeDateKeyOrEmpty(mtg.recurrenceEndDate),
    color: pickEnum(mtg.color, ['navy', 'emerald', 'amber', 'rose'] as const, 'navy'),
    status: pickEnum(mtg.status, ['scheduled', 'completed', 'cancelled'] as const, 'scheduled'),
    completed_dates: (Array.isArray(mtg.completedDates) ? mtg.completedDates : [])
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .slice(0, 120),
    attendance_by_date: cleanAttendance,
    notes_by_date: cleanNotes,
    follow_ups: (Array.isArray(mtg.followUps) ? mtg.followUps : []).slice(0, 80).map((f) => ({
      id: clip(f.id, 128),
      text: clip(f.text, 500),
      done: Boolean(f.done),
      ...(f.occurrenceDate && /^\d{4}-\d{2}-\d{2}$/.test(f.occurrenceDate)
        ? { occurrenceDate: f.occurrenceDate }
        : {}),
      ...(f.linkedTaskId ? { linkedTaskId: clip(f.linkedTaskId, 128) } : {}),
    })),
    linked_task_ids: (Array.isArray(mtg.linkedTaskIds) ? mtg.linkedTaskIds : []).slice(0, 80).map((s) => clip(s, 128)),
    exceptions: cleanExceptions,
  };
}

export function buildDentalCaseRow(uid: string, dc: DentalCase) {
  const status: DentalCaseStatus =
    dc.status === 'follow_up' || dc.status === 'completed'
      ? dc.status
      : 'in_progress';
  return {
    owner_id: uid,
    id: sanitizeId(dc.id),
    title: clip(dc.title, 260),
    specialty: clip(dc.specialty, 160),
    patient_summary: clip(dc.patientSummary, 3000),
    procedure_details: clip(dc.procedureDetails, 12000),
    case_date: sanitizeDateKeyOrEmpty(dc.caseDate),
    status,
    cover_image_url: clip(dc.coverImageUrl, 1200),
    cover_storage_bucket:
      resolveEffectiveStorageProvider(
        dc.coverStorageProvider,
        dc.coverStoragePath
      ) === 'r2'
        ? 'r2'
        : 'user-images',
    cover_storage_path: clip(dc.coverStoragePath, 400),
    cover_storage_provider: resolveEffectiveStorageProvider(
      dc.coverStorageProvider,
      dc.coverStoragePath
    ),
    cover_data_url: clip(dc.coverDataUrl, 40000),
    linked_course_id: Math.max(0, Math.round(dc.linkedCourseId ?? 0)),
    updated_at_label: clip(dc.updatedAtLabel, 100),
  };
}

// ============================================================================
// Row Mappers (PostgreSQL Row -> TypeScript Domain Model)
// ============================================================================

function mapQuarterRow(raw: Record<string, unknown>): QuarterInfo {
  return {
    id: String(raw.id),
    number: Number(raw.number ?? 1),
    title: String(raw.title ?? ''),
    subtitle: String(raw.subtitle ?? ''),
  };
}

function mapDomainRow(raw: Record<string, unknown>): DomainInfo {
  return {
    id: String(raw.id),
    order: Number(raw.sort_order ?? 0),
    hubId: sanitizeHubId(raw.hub_id),
    title: String(raw.title ?? ''),
    subtitle: String(raw.subtitle ?? ''),
    purpose: String(raw.purpose ?? ''),
    thinkers: Array.isArray(raw.thinkers) ? (raw.thinkers as ThinkerInfo[]) : [],
  };
}

function mapMonthRow(raw: Record<string, unknown>): MonthPlan {
  return {
    id: Number(raw.month_number ?? 1),
    docId: String(raw.doc_id ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    quarter: Number(raw.quarter ?? 1),
    quarterTitle: String(raw.quarter_title ?? ''),
    theme: String(raw.theme ?? ''),
    foundational: (raw.foundational as MonthPlan['foundational']) || {
      title: '',
      author: '',
      format: 'كتاب',
      domainId: 'islamic_thought',
      pace: '',
      focus: '',
    },
    exploratory: (raw.exploratory as MonthPlan['exploratory']) || {
      title: '',
      author: '',
      format: 'كتاب',
      domainId: 'philosophy_logic',
      pace: '',
      focus: '',
    },
    courseId: Number(raw.course_id ?? 0),
    discussionPrompt: String(raw.discussion_prompt ?? ''),
    applicationTask: String(raw.application_task ?? ''),
    activities: (raw.activities as MonthPlan['activities']) || {
      reading: false,
      listening: false,
      summarizing: false,
      discussing: false,
    },
    status: (raw.status as MonthPlan['status']) || 'not_started',
    notes: String(raw.notes ?? ''),
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as SmallTask[]) : [],
    resources: Array.isArray(raw.resources) ? (raw.resources as StudyResource[]) : [],
    readingModes: sanitizeReadingModes(raw.reading_modes),
    learningMethods: sanitizeLearningMethods(raw.learning_methods),
    reviewCount: Number(raw.review_count ?? 0),
    listenCount: Number(raw.listen_count ?? 0),
    repetitionStage: Number(raw.repetition_stage ?? 0),
    nextReviewDateKey: String(raw.next_review_date_key ?? ''),
    lastReviewedDateKey: String(raw.last_reviewed_date_key ?? ''),
  };
}

function mapCourseRow(raw: Record<string, unknown>): PersonalCourse {
  const completed = Boolean(raw.completed);
  return {
    id: Number(raw.course_number ?? 1),
    docId: String(raw.doc_id ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    title: String(raw.title ?? ''),
    category: String(raw.category ?? ''),
    studyStage: sanitizeCourseStudyStage(raw.study_stage, completed),
    scheduledPeriod: String(raw.scheduled_period ?? ''),
    instructor: String(raw.instructor ?? ''),
    platform: String(raw.platform ?? ''),
    durationLabel: String(raw.duration_label ?? ''),
    startDate: String(raw.start_date ?? ''),
    targetDate: String(raw.target_date ?? ''),
    progressPct: Number(raw.progress_pct ?? 0),
    notes: String(raw.notes ?? ''),
    linkedMonths: Array.isArray(raw.linked_months)
      ? (raw.linked_months as number[])
      : [],
    complementaryBook: String(raw.complementary_book ?? ''),
    bookAuthor: String(raw.book_author ?? ''),
    applicationMilestone: String(raw.application_milestone ?? ''),
    completed,
    learningObjectives: sanitizeLearningObjectives(raw.learning_objectives),
    sortOrder: Number(raw.sort_order ?? 0),
    isPublic: Boolean(raw.is_public),
    resources: Array.isArray(raw.resources) ? (raw.resources as StudyResource[]) : [],
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as SmallTask[]) : [],
    readingModes: sanitizeReadingModes(raw.reading_modes),
    learningMethods: sanitizeLearningMethods(raw.learning_methods),
    reviewCount: Number(raw.review_count ?? 0),
    listenCount: Number(raw.listen_count ?? 0),
    repetitionStage: Number(raw.repetition_stage ?? 0),
    nextReviewDateKey: String(raw.next_review_date_key ?? ''),
    lastReviewedDateKey: String(raw.last_reviewed_date_key ?? ''),
  };
}

function mapBookNoteRow(raw: Record<string, unknown>): BookNote {
  const ntRaw = raw.note_type;
  const noteType: NoteCategoryType =
    ntRaw === 'course_lecture' || ntRaw === 'general' ? ntRaw : 'book';
  return {
    id: String(raw.id),
    hubId: sanitizeHubId(raw.hub_id),
    noteType,
    noteColor: sanitizeNoteColor(raw.note_color),
    bookTitle: String(raw.book_title ?? ''),
    author: String(raw.author ?? ''),
    courseId: Number(raw.course_id ?? 0),
    courseTitle: String(raw.course_title ?? ''),
    lectureTitle: String(raw.lecture_title ?? ''),
    categoryLabel: String(raw.category_label ?? ''),
    progressMarker: String(raw.progress_marker ?? ''),
    content: String(raw.content ?? ''),
    quotes: String(raw.quotes ?? ''),
    updatedAt: String(raw.updated_at_label ?? ''),
    resources: Array.isArray(raw.resources) ? (raw.resources as StudyResource[]) : [],
    sortOrder: Number(raw.sort_order ?? 0),
    createdAtMs: Number(raw.created_at_ms ?? 0),
    readingModes: sanitizeReadingModes(raw.reading_modes),
    learningMethods: sanitizeLearningMethods(raw.learning_methods),
    reviewCount: Number(raw.review_count ?? 0),
    listenCount: Number(raw.listen_count ?? 0),
    repetitionStage: Number(raw.repetition_stage ?? 0),
    nextReviewDateKey: String(raw.next_review_date_key ?? ''),
    lastReviewedDateKey: String(raw.last_reviewed_date_key ?? ''),
  };
}

function mapCustomCategoryRow(raw: Record<string, unknown>): CustomCategory {
  const hubRaw = raw.hub_id;
  const hubId: LearningHubId | 'all' =
    hubRaw === 'marketing' || hubRaw === 'dental_career' || hubRaw === 'knowledge'
      ? hubRaw
      : 'all';
  return {
    id: String(raw.id),
    hubId,
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    color: (raw.color as CustomCategory['color']) || 'navy',
    createdAtLabel: String(raw.created_at_label ?? ''),
  };
}

function mapHistoryRow(raw: Record<string, unknown>): StudyHistoryEntry {
  return {
    id: String(raw.id),
    actionType: (raw.action_type as StudyHistoryEntry['actionType']) || 'note',
    title: String(raw.title ?? ''),
    detail: String(raw.detail ?? ''),
    targetTab: (raw.target_tab as StudyHistoryEntry['targetTab']) || 'overview',
    targetNoteId: raw.target_note_id ? String(raw.target_note_id) : undefined,
    targetMonthId: raw.target_month_id ? Number(raw.target_month_id) : undefined,
    targetCourseId: raw.target_course_id ? Number(raw.target_course_id) : undefined,
    timestampLabel: String(raw.timestamp_label ?? ''),
    createdAtMs: Number(raw.created_at_ms ?? 0),
  };
}

function mapPreferencesRow(raw: Record<string, unknown>): UserPreferences {
  const storedCats =
    raw.hub_categories && typeof raw.hub_categories === 'object'
      ? (raw.hub_categories as Partial<Record<LearningHubId, string[]>>)
      : {};
  const storedCal =
    raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
      ? (raw.calendar_prefs as Partial<CalendarPreferences>)
      : undefined;

  const mappedHubCats: Record<string, string[]> = {
    marketing:
      Array.isArray(storedCats.marketing) && storedCats.marketing.length > 0
        ? storedCats.marketing
        : DEFAULT_HUB_CATEGORIES.marketing,
    dental_career:
      Array.isArray(storedCats.dental_career) &&
      storedCats.dental_career.length > 0
        ? storedCats.dental_career
        : DEFAULT_HUB_CATEGORIES.dental_career,
    knowledge:
      Array.isArray(storedCats.knowledge) && storedCats.knowledge.length > 0
        ? storedCats.knowledge
        : DEFAULT_HUB_CATEGORIES.knowledge,
  };
  for (const [k, v] of Object.entries(storedCats)) {
    if (Array.isArray(v) && !(k in mappedHubCats)) {
      mappedHubCats[k] = sanitizeStringList(v, 30, 120);
    }
  }

  const resolvedCustomHubs = (() => {
    if (Array.isArray(raw.custom_hubs) && raw.custom_hubs.length > 0) {
      return sanitizeCustomHubs(raw.custom_hubs);
    }
    const mirror =
      raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
        ? (raw.calendar_prefs as Record<string, unknown>).customHubsMirror
        : undefined;
    if (Array.isArray(mirror) && mirror.length > 0) {
      return sanitizeCustomHubs(mirror);
    }
    return DEFAULT_LEARNING_HUBS;
  })();

  return {
    noteFontSize:
      (raw.note_font_size as UserPreferences['noteFontSize']) ||
      DEFAULT_USER_PREFERENCES.noteFontSize,
    noteHighlightColor:
      (raw.note_highlight_color as UserPreferences['noteHighlightColor']) ||
      DEFAULT_USER_PREFERENCES.noteHighlightColor,
    notePaperTone:
      (raw.note_paper_tone as UserPreferences['notePaperTone']) ||
      DEFAULT_USER_PREFERENCES.notePaperTone,
    noteMargin:
      (raw.note_margin as UserPreferences['noteMargin']) ||
      DEFAULT_USER_PREFERENCES.noteMargin,
    noteWidth:
      (raw.note_width as UserPreferences['noteWidth']) ||
      DEFAULT_USER_PREFERENCES.noteWidth,
    noteBorder:
      (raw.note_border as UserPreferences['noteBorder']) ||
      DEFAULT_USER_PREFERENCES.noteBorder,
    autoAddTimestampOnVoice: Boolean(raw.auto_add_timestamp_on_voice),
    voiceDialect:
      (raw.voice_dialect as UserPreferences['voiceDialect']) ||
      DEFAULT_USER_PREFERENCES.voiceDialect,
    voiceInsertMode:
      (raw.voice_insert_mode as UserPreferences['voiceInsertMode']) ||
      DEFAULT_USER_PREFERENCES.voiceInsertMode,
    readAloudVoice:
      (raw.read_aloud_voice as UserPreferences['readAloudVoice']) ||
      DEFAULT_USER_PREFERENCES.readAloudVoice,
    readAloudSpeed:
      (raw.read_aloud_speed as UserPreferences['readAloudSpeed']) ||
      DEFAULT_USER_PREFERENCES.readAloudSpeed,
    showExcelExport: raw.show_excel_export !== false,
    hubCategories: mappedHubCats,
    calendarPrefs: sanitizeCalendarPrefs(storedCal),
    weeklyRhythm: sanitizeWeeklyRhythm(raw.weekly_rhythm),
    reflectionCategories:
      Array.isArray(raw.reflection_categories) && raw.reflection_categories.length > 0
        ? sanitizeStringList(raw.reflection_categories, 40, 80)
        : DEFAULT_REFLECTION_CATEGORIES,
    customReadingModes: sanitizeCustomReadingModesConfig(raw.custom_reading_modes),
    pinnedNavTabs: (() => {
      if (Array.isArray(raw.pinned_nav_tabs)) {
        return sanitizeStringList(raw.pinned_nav_tabs, 20, 40);
      }
      const mirror =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? (raw.calendar_prefs as Record<string, unknown>).pinnedNavTabsMirror
          : undefined;
      if (Array.isArray(mirror)) {
        return sanitizeStringList(mirror, 20, 40);
      }
      return DEFAULT_PINNED_NAV_TABS;
    })(),
    navTabOrder: (() => {
      const mirror =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? (raw.calendar_prefs as Record<string, unknown>).navTabOrderMirror
          : undefined;
      if (Array.isArray(mirror) && mirror.length > 0) {
        return sanitizeStringList(mirror, 30, 40);
      }
      return DEFAULT_NAV_TAB_ORDER;
    })(),
    customHubs: resolvedCustomHubs,
    ...(() => {
      const colHero =
        raw.dashboard_hero &&
        typeof raw.dashboard_hero === 'object' &&
        Object.keys(raw.dashboard_hero as Record<string, unknown>).length > 0
          ? (raw.dashboard_hero as Record<string, unknown>)
          : undefined;
      const mirrorHero =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? ((raw.calendar_prefs as Record<string, unknown>).dashboardHeroMirror as
              | Record<string, unknown>
              | undefined)
          : undefined;
      const h = colHero || mirrorHero;
      if (!h) return {};
      const imageUrl = typeof h.imageUrl === 'string' && h.imageUrl ? h.imageUrl : undefined;
      const storagePath =
        typeof h.storagePath === 'string' && h.storagePath ? h.storagePath : undefined;
      const frame =
        h.frame && typeof h.frame === 'object'
          ? sanitizeImageFrameSpec(h.frame, DEFAULT_DASHBOARD_HERO_FRAME)
          : undefined;
      return {
        ...(imageUrl ? { dashboardHeroImageUrl: imageUrl } : {}),
        ...(storagePath ? { dashboardHeroImageStoragePath: storagePath } : {}),
        ...(frame ? { dashboardHeroImageFrame: frame } : {}),
      };
    })(),
    taskStatusOrder: (() => {
      const mirror =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? (raw.calendar_prefs as Record<string, unknown>).taskStatusOrderMirror
          : undefined;
      return sanitizeTaskStatusOrder(mirror);
    })(),
    activeFocusPinCollectionId: (() => {
      const mirror =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? (raw.calendar_prefs as Record<string, unknown>).activeFocusPinCollectionIdMirror
          : undefined;
      return typeof mirror === 'string' && mirror ? mirror : null;
    })(),
    themeConfig: (() => {
      const mirror =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? (raw.calendar_prefs as Record<string, unknown>).themeConfigMirror
          : undefined;
      if (mirror && typeof mirror === 'object' && Object.keys(mirror as Record<string, unknown>).length > 0) {
        return sanitizeThemeConfig(mirror as Partial<ThemeConfig>);
      }
      return undefined;
    })(),
    ...(() => {
      const colExtra =
        raw.extra_prefs &&
        typeof raw.extra_prefs === 'object' &&
        Object.keys(raw.extra_prefs as Record<string, unknown>).length > 0
          ? (raw.extra_prefs as Record<string, unknown>)
          : undefined;
      const mirrorExtra =
        raw.calendar_prefs && typeof raw.calendar_prefs === 'object'
          ? ((raw.calendar_prefs as Record<string, unknown>).extraPrefsMirror as
              | Record<string, unknown>
              | undefined)
          : undefined;
      const ex = colExtra || mirrorExtra || {};
      const validStatuses: UnifiedTaskStatus[] = ['todo', 'in_progress', 'postponed', 'done'];
      const hiddenTaskStatuses = Array.isArray(ex.hiddenTaskStatuses)
        ? (ex.hiddenTaskStatuses.filter((s): s is UnifiedTaskStatus =>
            validStatuses.includes(s as UnifiedTaskStatus)
          ))
        : undefined;
      const quotesLibrary = Array.isArray(ex.quotesLibrary)
        ? (ex.quotesLibrary.filter(
            (q): q is UserQuoteItem =>
              Boolean(q && typeof q === 'object' && typeof (q as UserQuoteItem).text === 'string')
          ))
        : undefined;
      return {
        ...(hiddenTaskStatuses ? { hiddenTaskStatuses } : {}),
        ...(quotesLibrary ? { quotesLibrary } : {}),
        ...(ex.pinnedDailyQuoteId !== undefined
          ? {
              pinnedDailyQuoteId:
                typeof ex.pinnedDailyQuoteId === 'string' && ex.pinnedDailyQuoteId
                  ? ex.pinnedDailyQuoteId
                  : null,
            }
          : {}),
        ...(Array.isArray(ex.hiddenActivityIds)
          ? { hiddenActivityIds: sanitizeStringList(ex.hiddenActivityIds, 300, 128) }
          : {}),
        ...(Array.isArray(ex.hiddenActivityTypes)
          ? {
              hiddenActivityTypes: sanitizeStringList(
                ex.hiddenActivityTypes,
                20,
                40
              ) as ActivityEntityType[],
            }
          : {}),
        ...(typeof ex.minimalWritingMode === 'boolean'
          ? { minimalWritingMode: ex.minimalWritingMode }
          : {}),
        ...(ex.recoveryPathWorkspaces &&
        typeof ex.recoveryPathWorkspaces === 'object'
          ? {
              recoveryPathWorkspaces: sanitizeRecoveryWorkspacesMap(
                ex.recoveryPathWorkspaces
              ),
            }
          : {}),
      };
    })(),
  };
}

function mapReflectionRow(raw: Record<string, unknown>): PersonalReflection {
  const moodRaw = String(raw.mood_tag ?? 'تأمل');
  const moodTag: ReflectionMood =
    moodRaw === 'فكرة' || moodRaw === 'امتنان' || moodRaw === 'هدف'
      ? moodRaw
      : 'تأمل';
  const rawFrame = raw.image_frame;
  const hasFrame =
    rawFrame &&
    typeof rawFrame === 'object' &&
    Object.keys(rawFrame as Record<string, unknown>).length > 0;
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    moodTag,
    categoryTag: raw.category_tag ? String(raw.category_tag) : '',
    colorKey: sanitizeReflectionColor(raw.color_key),
    isPublic: Boolean(raw.is_public),
    imageUrl: raw.image_url ? String(raw.image_url) : undefined,
    imageStoragePath: raw.image_storage_path
      ? String(raw.image_storage_path)
      : undefined,
    imageStorageProvider: resolveEffectiveStorageProvider(
      raw.image_storage_provider
        ? String(raw.image_storage_provider)
        : undefined,
      raw.image_storage_path ? String(raw.image_storage_path) : undefined
    ),
    imageFrame: hasFrame
      ? sanitizeImageFrameSpec(rawFrame, DEFAULT_REFLECTION_IMAGE_FRAME)
      : undefined,
    pinned: Boolean(raw.pinned),
    createdAtLabel: String(raw.created_at_label ?? ''),
    createdAtMs: Number(raw.created_at_ms ?? 0),
  };
}

function mapBlogPostRow(raw: Record<string, unknown>): BlogPost {
  const rawFrame = raw.cover_frame;
  const hasFrame =
    rawFrame &&
    typeof rawFrame === 'object' &&
    Object.keys(rawFrame as Record<string, unknown>).length > 0;
  const content = String(raw.content ?? '');
  const readingMinsRaw = Number(raw.reading_time_minutes ?? 0);
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    subtitle: raw.subtitle ? String(raw.subtitle) : '',
    excerpt: raw.excerpt ? String(raw.excerpt) : '',
    content,
    categoryLabel: raw.category_label ? String(raw.category_label) : '',
    coverImageUrl: raw.cover_image_url ? String(raw.cover_image_url) : undefined,
    coverStoragePath: raw.cover_storage_path
      ? String(raw.cover_storage_path)
      : undefined,
    coverStorageProvider: resolveEffectiveStorageProvider(
      raw.cover_storage_provider
        ? String(raw.cover_storage_provider)
        : undefined,
      raw.cover_storage_path ? String(raw.cover_storage_path) : undefined
    ),
    coverFrame: hasFrame
      ? sanitizeImageFrameSpec(rawFrame, DEFAULT_IMAGE_FRAME_SPEC)
      : undefined,
    readingTimeMinutes:
      Number.isFinite(readingMinsRaw) && readingMinsRaw > 0
        ? readingMinsRaw
        : estimateReadingTimeMinutes(content),
    isPublic: Boolean(raw.is_public),
    pinned: Boolean(raw.pinned),
    sortOrder: Number(raw.sort_order ?? 0),
    createdAtLabel: String(raw.created_at_label ?? ''),
    createdAtMs: Number(raw.created_at_ms ?? 0),
    updatedAtLabel: raw.updated_at_label ? String(raw.updated_at_label) : undefined,
  };
}

function mapCalendarEventRow(raw: Record<string, unknown>): CalendarEvent {
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
    id: String(raw.id),
    dateKey: String(raw.date_key ?? ''),
    timeSlot: String(raw.time_slot ?? ''),
    endTime: raw.end_time ? String(raw.end_time) : '',
    durationMinutes:
      typeof raw.duration_minutes === 'number' ? raw.duration_minutes : undefined,
    title: String(raw.title ?? ''),
    notes: String(raw.notes ?? ''),
    category,
    color,
    done: Boolean(raw.done),
    linkedTaskText: String(raw.linked_task_text ?? ''),
    linkedTaskId: raw.linked_task_id ? String(raw.linked_task_id) : undefined,
  };
}

function mapLearningPathRow(raw: Record<string, unknown>): LearningPath {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    categoryLabel: String(raw.category_label ?? ''),
    objectives: String(raw.objectives ?? ''),
    learningObjectives: sanitizeLearningObjectives(raw.learning_objectives),
    sortOrder: Number(raw.sort_order ?? 0),
    isPublic: Boolean(raw.is_public),
    currentLevel: String(raw.current_level ?? ''),
    targetLevel: String(raw.target_level ?? ''),
    startDate: String(raw.start_date ?? ''),
    expectedCompletionDate: String(raw.expected_completion_date ?? ''),
    progressPct: Number(raw.progress_pct ?? 0),
    status:
      raw.status === 'in_progress' || raw.status === 'completed'
        ? (raw.status as LearningPathStatus)
        : 'planned',
    stages: Array.isArray(raw.stages) ? (raw.stages as LearningPathStage[]) : [],
    linkedCourseIds: Array.isArray(raw.linked_course_ids)
      ? (raw.linked_course_ids as number[])
      : [],
    readingModes: sanitizeReadingModes(raw.reading_modes),
    learningMethods: sanitizeLearningMethods(raw.learning_methods),
    reviewCount: Number(raw.review_count ?? 0),
    listenCount: Number(raw.listen_count ?? 0),
  };
}

function mapReadingItemRow(raw: Record<string, unknown>): ReadingLibraryItem {
  const rawCoverFrame = raw.cover_frame;
  const hasCoverFrame =
    rawCoverFrame &&
    typeof rawCoverFrame === 'object' &&
    Object.keys(rawCoverFrame as Record<string, unknown>).length > 0;
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    author: String(raw.author ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    categoryLabel: String(raw.category_label ?? ''),
    itemType: (raw.item_type as ReadingItemType) || 'كتاب',
    status:
      raw.status === 'reading' || raw.status === 'completed'
        ? (raw.status as ReadingItemStatus)
        : 'to_read',
    currentPage: Number(raw.current_page ?? 0),
    totalPages: Number(raw.total_pages ?? 0),
    takeaways: String(raw.takeaways ?? ''),
    learningObjectives: sanitizeLearningObjectives(raw.learning_objectives),
    sortOrder: Number(raw.sort_order ?? 0),
    isPublic: Boolean(raw.is_public),
    coverImageUrl: raw.cover_image_url ? String(raw.cover_image_url) : undefined,
    coverStoragePath: raw.cover_storage_path
      ? String(raw.cover_storage_path)
      : undefined,
    coverStorageProvider: resolveEffectiveStorageProvider(
      raw.cover_storage_provider
        ? String(raw.cover_storage_provider)
        : undefined,
      raw.cover_storage_path ? String(raw.cover_storage_path) : undefined
    ),
    coverFrame: hasCoverFrame
      ? sanitizeImageFrameSpec(rawCoverFrame, DEFAULT_BOOK_COVER_FRAME)
      : undefined,
    workspaceData: sanitizeBookWorkspaceData(raw.workspace_data),
    attachmentName: raw.attachment_name ? String(raw.attachment_name) : undefined,
    attachmentResourceId: raw.attachment_resource_id
      ? String(raw.attachment_resource_id)
      : undefined,
    storagePath: raw.storage_path ? String(raw.storage_path) : undefined,
    storageProvider: resolveEffectiveStorageProvider(
      raw.storage_provider ? String(raw.storage_provider) : undefined,
      raw.storage_path ? String(raw.storage_path) : undefined
    ),
    downloadUrl: raw.download_url ? String(raw.download_url) : undefined,
    externalUrl: raw.external_url ? String(raw.external_url) : undefined,
    readingModes: sanitizeReadingModes(raw.reading_modes),
    learningMethods: sanitizeLearningMethods(raw.learning_methods),
    reviewCount: Number(raw.review_count ?? 0),
    listenCount: Number(raw.listen_count ?? 0),
    repetitionStage: Number(raw.repetition_stage ?? 0),
    nextReviewDateKey: String(raw.next_review_date_key ?? ''),
    lastReviewedDateKey: String(raw.last_reviewed_date_key ?? ''),
    updatedAtLabel: String(raw.updated_at_label ?? ''),
  };
}

function mapPracticalProjectRow(raw: Record<string, unknown>): PracticalProject {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    categoryLabel: String(raw.category_label ?? ''),
    objectives: String(raw.objectives ?? ''),
    status:
      raw.status === 'in_progress' || raw.status === 'completed'
        ? (raw.status as ProjectStatus)
        : 'planned',
    progressPct: Number(raw.progress_pct ?? 0),
    deliverables: String(raw.deliverables ?? ''),
    startDate: String(raw.start_date ?? ''),
    targetDate: String(raw.target_date ?? ''),
    linkedCourseId:
      typeof raw.linked_course_id === 'number' && raw.linked_course_id > 0
        ? raw.linked_course_id
        : undefined,
    notes: String(raw.notes ?? ''),
  };
}

function mapUnifiedTaskRow(raw: Record<string, unknown>): UnifiedTask {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    categoryLabel: String(raw.category_label ?? ''),
    priority:
      raw.priority === 'low' || raw.priority === 'high'
        ? (raw.priority as TaskPriority)
        : 'medium',
    status:
      raw.status === 'in_progress' ||
      raw.status === 'postponed' ||
      raw.status === 'done'
        ? (raw.status as UnifiedTaskStatus)
        : 'todo',
    dueDate: String(raw.due_date ?? ''),
    scheduledDate: raw.scheduled_date ? String(raw.scheduled_date) : '',
    startTime: raw.start_time ? String(raw.start_time) : '',
    endTime: raw.end_time ? String(raw.end_time) : '',
    durationMinutes:
      typeof raw.duration_minutes === 'number' && raw.duration_minutes > 0
        ? raw.duration_minutes
        : undefined,
    deadline: raw.deadline ? String(raw.deadline) : '',
    projectId: raw.project_id ? String(raw.project_id) : '',
    linkedLabel: raw.linked_label ? String(raw.linked_label) : undefined,
    linkedCourseId:
      typeof raw.linked_course_id === 'number' && raw.linked_course_id > 0
        ? raw.linked_course_id
        : undefined,
    linkedPathId: raw.linked_path_id ? String(raw.linked_path_id) : undefined,
    linkedBookId: raw.linked_book_id ? String(raw.linked_book_id) : undefined,
    recurrence: normalizeRecurrenceRule(raw.recurrence),
    completedOccurrenceDates: Array.isArray(raw.completed_occurrence_dates)
      ? raw.completed_occurrence_dates.filter((d): d is string => typeof d === 'string')
      : [],
  };
}

function mapWeeklyMeetingRow(raw: Record<string, unknown>): WeeklyMeeting {
  const colRaw = String(raw.color ?? 'navy');
  const color: CalendarColor =
    colRaw === 'emerald' || colRaw === 'amber' || colRaw === 'rose'
      ? colRaw
      : 'navy';
  const status: WeeklyMeeting['status'] =
    raw.status === 'completed' || raw.status === 'cancelled'
      ? raw.status
      : 'scheduled';
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    hubId: sanitizeHubId(raw.hub_id),
    startDate: String(raw.start_date ?? ''),
    dayOfWeek: Number(raw.day_of_week ?? 6),
    startTime: String(raw.start_time ?? '18:00'),
    endTime: String(raw.end_time ?? '19:00'),
    durationMinutes: Number(raw.duration_minutes ?? 60),
    isRecurringWeekly: Boolean(raw.is_recurring_weekly),
    recurrenceEndDate: String(raw.recurrence_end_date ?? ''),
    color,
    status,
    completedDates: Array.isArray(raw.completed_dates)
      ? (raw.completed_dates as string[])
      : [],
    attendanceByDate:
      raw.attendance_by_date && typeof raw.attendance_by_date === 'object'
        ? (raw.attendance_by_date as Record<string, MeetingAttendanceStatus>)
        : {},
    notesByDate:
      raw.notes_by_date && typeof raw.notes_by_date === 'object'
        ? (raw.notes_by_date as Record<string, string>)
        : {},
    followUps: Array.isArray(raw.follow_ups)
      ? (raw.follow_ups as WeeklyMeetingFollowUp[])
      : [],
    linkedTaskIds: Array.isArray(raw.linked_task_ids)
      ? (raw.linked_task_ids as string[])
      : [],
    exceptions:
      raw.exceptions && typeof raw.exceptions === 'object'
        ? (raw.exceptions as Record<string, WeeklyMeetingException>)
        : {},
  };
}

function mapDentalCaseRow(raw: Record<string, unknown>): DentalCase {
  const status: DentalCaseStatus =
    raw.status === 'follow_up' || raw.status === 'completed'
      ? raw.status
      : 'in_progress';
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    specialty: String(raw.specialty ?? ''),
    patientSummary: String(raw.patient_summary ?? ''),
    procedureDetails: String(raw.procedure_details ?? ''),
    caseDate: String(raw.case_date ?? ''),
    status,
    coverImageUrl: raw.cover_image_url ? String(raw.cover_image_url) : undefined,
    coverStoragePath: raw.cover_storage_path
      ? String(raw.cover_storage_path)
      : undefined,
    coverStorageProvider: resolveEffectiveStorageProvider(
      raw.cover_storage_provider
        ? String(raw.cover_storage_provider)
        : undefined,
      raw.cover_storage_path ? String(raw.cover_storage_path) : undefined
    ),
    coverDataUrl: raw.cover_data_url ? String(raw.cover_data_url) : undefined,
    linkedCourseId:
      typeof raw.linked_course_id === 'number' && raw.linked_course_id > 0
        ? raw.linked_course_id
        : undefined,
    updatedAtLabel: raw.updated_at_label
      ? String(raw.updated_at_label)
      : undefined,
  };
}

// ============================================================================
// Initial User Profile & Seed (Idempotent, Non-Overwriting, Concurrency-Safe)
// ============================================================================

export interface UserProfileRecord {
  uid: string;
  display_name: string;
  email: string;
  photo_url: string;
  role: 'user' | 'admin';
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at?: string;
  updated_at?: string;
}

export interface DetailedSupabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

function createDetailedSupabaseError(
  context: string,
  err: unknown
): DetailedSupabaseError {
  const e =
    err && typeof err === 'object'
      ? (err as { code?: string; message?: string; details?: string; hint?: string })
      : { message: String(err) };
  const codePart = e.code ? `[${e.code}] ` : '';
  const msgPart = e.message || formatSupabaseErrorMessage(err);
  const extraPart = e.details || e.hint ? ` (${e.details || e.hint})` : '';
  const detailed = new Error(
    `${context}: ${codePart}${msgPart}${extraPart}`
  ) as DetailedSupabaseError;
  detailed.code = e.code;
  detailed.details = e.details;
  detailed.hint = e.hint;
  return detailed;
}

const inFlightProfilePromises = new Map<string, Promise<UserProfileRecord>>();
const inFlightSeedPromises = new Map<string, Promise<UserProfileRecord>>();

/**
 * Ensures the signed-in Firebase user has exactly one row in public.user_profiles.
 * - Strictly keyed by verified Firebase UID (user.uid).
 * - Deduplicates concurrent login calls via in-flight promise lock per UID.
 * - Never overwrites existing profile fields, role, or approval_status on repeat logins.
 * - Always creates new profiles with role='user' and approval_status='pending'
 *   (no automatic admin escalation or platform approval).
 * - Verifies row creation via read-back SELECT and throws actual DB errors if any step fails.
 */
export async function ensureUserProfileExists(
  user: User
): Promise<UserProfileRecord> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase client is not configured.');
  }
  if (!user?.uid) {
    throw new Error('Missing authenticated Firebase UID.');
  }

  const existingPromise = inFlightProfilePromises.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  if (!isAppOnline()) {
    const cached = loadCachedUserProfile(user.uid);
    if (cached) {
      return cached;
    }
  }

  const run = withFirebaseTokenRetry(async (client): Promise<UserProfileRecord> => {
    const profileColumns =
      'uid, display_name, email, photo_url, role, approval_status, created_at, updated_at';

    // 1. Read existing profile without overwriting anything
    const { data: existingRows, error: selectErr } = await client
      .from('user_profiles')
      .select(profileColumns)
      .eq('uid', user.uid);

    if (selectErr) {
      throw createDetailedSupabaseError(
        'Failed to query existing user_profiles row',
        selectErr
      );
    }

    if (existingRows && existingRows.length > 1) {
      throw new Error(
        `DUPLICATE_PROFILE_ROWS: Expected 1 user_profiles row for UID ${user.uid}, found ${existingRows.length}.`
      );
    }

    if (existingRows && existingRows.length === 1) {
      const existing = existingRows[0] as UserProfileRecord;
      if (existing.uid !== user.uid) {
        throw new Error(
          `PROFILE_UID_MISMATCH: Expected UID ${user.uid}, got ${existing.uid}.`
        );
      }
      saveCachedUserProfile(existing);
      return existing;
    }

    // 2. Insert new profile (plain INSERT so only INSERT RLS WITH CHECK applies)
    const newProfilePayload = {
      uid: user.uid,
      display_name: clip(user.displayName || 'مستخدم ميزان المعرفة', 120),
      email: clip(user.email || '', 200),
      photo_url: clip(user.photoURL || '', 600),
      role: 'user' as const,
      approval_status: 'pending' as const,
    };

    const { error: insertErr } = await client
      .from('user_profiles')
      .insert(newProfilePayload);

    // 23505 (unique_violation) means a parallel tab created the row concurrently — fall through to read-back verification
    if (insertErr && insertErr.code !== '23505') {
      throw createDetailedSupabaseError(
        'Failed to create user_profiles row',
        insertErr
      );
    }

    // 3. Verify creation by reading back the row with the Firebase JWT
    const { data: verifiedRows, error: verifyErr } = await client
      .from('user_profiles')
      .select(profileColumns)
      .eq('uid', user.uid);

    if (verifyErr) {
      throw createDetailedSupabaseError(
        'Profile insert completed but verification SELECT failed',
        verifyErr
      );
    }

    if (!verifiedRows || verifiedRows.length === 0) {
      const err = new Error(
        'PROFILE_ROW_MISSING_AFTER_INSERT: Profile insert reported success, but SELECT returned 0 rows. Check user_profiles RLS SELECT/INSERT policies and public.firebase_uid().'
      ) as DetailedSupabaseError;
      err.code = 'PROFILE_ROW_MISSING';
      throw err;
    }

    if (verifiedRows.length > 1) {
      throw new Error(
        `DUPLICATE_PROFILE_ROWS: Expected 1 user_profiles row for UID ${user.uid}, found ${verifiedRows.length}.`
      );
    }

    const verified = verifiedRows[0] as UserProfileRecord;
    if (verified.uid !== user.uid) {
      throw new Error(
        `PROFILE_UID_MISMATCH: Expected UID ${user.uid}, got ${verified.uid}.`
      );
    }

    saveCachedUserProfile(verified);
    return verified;
  })
    .catch((err) => {
      if (isNetworkOrOfflineError(err)) {
        const cached = loadCachedUserProfile(user.uid);
        if (cached) return cached;
      }
      throw err;
    })
    .finally(() => {
      inFlightProfilePromises.delete(user.uid);
    });

  inFlightProfilePromises.set(user.uid, run);
  return run;
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
): Promise<UserProfileRecord | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const existingSeedPromise = inFlightSeedPromises.get(user.uid);
  if (existingSeedPromise) {
    return existingSeedPromise;
  }

  const run = (async (): Promise<UserProfileRecord> => {
    // Always wait for profile creation & verification before seeding child tables
    const profile = await ensureUserProfileExists(user);

    await withFirebaseTokenRetry(async (client) => {
      const { data: existingMonths, error: monthsCheckErr } = await client
        .from('months')
        .select('doc_id')
        .eq('owner_id', user.uid)
        .limit(1);

      if (monthsCheckErr) {
        throw createDetailedSupabaseError(
          'Failed to check workspace months seed state',
          monthsCheckErr
        );
      }

      const upsertSeedBatch = async (
        table: string,
        rows: Record<string, unknown>[],
        onConflict: string
      ) => {
        if (rows.length === 0) return { error: null };
        const res = await client.from(table).upsert(rows, { onConflict });
        if (
          res.error &&
          isMissingColumnError(res.error) &&
          OPTIONAL_007_COLUMNS_BY_TABLE[table]
        ) {
          hasPending007Migration = true;
          const legacyRows = rows.map((r) => strip007Columns(table, r));
          return client.from(table).upsert(legacyRows, { onConflict });
        }
        return res;
      };

      if (!existingMonths || existingMonths.length === 0) {
        const seedResults = await Promise.all([
          seedData.quarters.length > 0
            ? client
                .from('quarters')
                .upsert(
                  seedData.quarters.map((q) => buildQuarterRow(user.uid, q)),
                  { onConflict: 'owner_id,id' }
                )
            : Promise.resolve({ error: null }),
          seedData.months.length > 0
            ? client
                .from('months')
                .upsert(
                  seedData.months.map((m) => buildMonthRow(user.uid, m)),
                  { onConflict: 'owner_id,doc_id' }
                )
            : Promise.resolve({ error: null }),
          seedData.domains.length > 0
            ? client
                .from('domains')
                .upsert(
                  seedData.domains.map((d, idx) =>
                    buildDomainRow(user.uid, d, idx)
                  ),
                  { onConflict: 'owner_id,id' }
                )
            : Promise.resolve({ error: null }),
          upsertSeedBatch(
            'courses',
            seedData.courses.map((c) => buildCourseRow(user.uid, c)),
            'owner_id,doc_id'
          ),
          upsertSeedBatch(
            'book_notes',
            seedData.bookNotes.map((bn) => buildBookNoteRow(user.uid, bn)),
            'owner_id,id'
          ),
          seedData.customCategories.length > 0
            ? client
                .from('custom_categories')
                .upsert(
                  seedData.customCategories.map((cat) =>
                    buildCustomCategoryRow(user.uid, cat)
                  ),
                  { onConflict: 'owner_id,id' }
                )
            : Promise.resolve({ error: null }),
          seedData.history.length > 0
            ? client
                .from('study_history')
                .upsert(
                  seedData.history
                    .slice(0, 25)
                    .map((h) => buildHistoryRow(user.uid, h)),
                  { onConflict: 'owner_id,id' }
                )
            : Promise.resolve({ error: null }),
          upsertSeedBatch(
            'user_preferences',
            [
              buildUserPreferencesRow(
                user.uid,
                seedData.preferences ?? DEFAULT_USER_PREFERENCES
              ),
            ],
            'owner_id,id'
          ),
        ]);

        const firstSeedErr = seedResults.find((r) => r.error)?.error;
        if (firstSeedErr) {
          throw createDetailedSupabaseError(
            'Failed to seed initial workspace data',
            firstSeedErr
          );
        }
      } else {
        const [{ data: existingCats }, { data: existingPrefs }] =
          await Promise.all([
            client
              .from('custom_categories')
              .select('id')
              .eq('owner_id', user.uid)
              .limit(1),
            client
              .from('user_preferences')
              .select('id')
              .eq('owner_id', user.uid)
              .eq('id', 'settings')
              .maybeSingle(),
          ]);

        if (
          (!existingCats || existingCats.length === 0) &&
          seedData.customCategories.length > 0
        ) {
          const { error: catErr } = await client
            .from('custom_categories')
            .upsert(
              seedData.customCategories.map((cat) =>
                buildCustomCategoryRow(user.uid, cat)
              ),
              { onConflict: 'owner_id,id' }
            );
          if (catErr) {
            throw createDetailedSupabaseError(
              'Failed to seed default categories',
              catErr
            );
          }
        }

        if (!existingPrefs) {
          const { error: prefErr } = await upsertSeedBatch(
            'user_preferences',
            [
              buildUserPreferencesRow(
                user.uid,
                seedData.preferences ?? DEFAULT_USER_PREFERENCES
              ),
            ],
            'owner_id,id'
          );
          if (prefErr) {
            throw createDetailedSupabaseError(
              'Failed to seed default preferences',
              prefErr
            );
          }
        }
      }
    });

    return profile;
  })().finally(() => {
    inFlightSeedPromises.delete(user.uid);
  });

  inFlightSeedPromises.set(user.uid, run);
  return run;
}

// ============================================================================
// Workspace Subscriptions (Initial Fetch + Supabase Realtime Changes)
// ============================================================================

export interface WorkspaceCallbacks {
  onQuarters?: (items: QuarterInfo[]) => void;
  onMonths?: (items: MonthPlan[]) => void;
  onDomains?: (items: DomainInfo[]) => void;
  onCourses?: (items: PersonalCourse[]) => void;
  onBookNotes?: (items: BookNote[]) => void;
  onCustomCategories?: (items: CustomCategory[]) => void;
  onHistory?: (items: StudyHistoryEntry[]) => void;
  onPreferences?: (prefs: UserPreferences) => void;
  onReflections?: (items: PersonalReflection[]) => void;
  onBlogPosts?: (items: BlogPost[]) => void;
  onCalendarEvents?: (items: CalendarEvent[]) => void;
  onLearningPaths?: (items: LearningPath[]) => void;
  onReadingItems?: (items: ReadingLibraryItem[]) => void;
  onProjects?: (items: PracticalProject[]) => void;
  onUnifiedTasks?: (items: UnifiedTask[]) => void;
  onDentalCases?: (items: DentalCase[]) => void;
  onWeeklyMeetings?: (items: WeeklyMeeting[]) => void;
  onActivityLogs?: (items: ActivityLogEntry[]) => void;
  onDailyJournals?: (items: DailyJournalRecord[]) => void;
  onPeriodReviews?: (items: PeriodReviewRecord[]) => void;
  onWeeklyPlans?: (items: WeeklyPlanRecord[]) => void;
  onPinCollections?: (items: PinCollection[]) => void;
  onError?: (message: string) => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: WorkspaceCallbacks
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  let disposed = false;

  const overlayOutboxOnRows = (
    table: string,
    rows: Record<string, unknown>[],
    keyCol: string
  ): Record<string, unknown>[] => {
    const outboxMap = getOfflineOutboxMapForTable(uid, table);
    if (outboxMap.size === 0) return rows;
    const byKey = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const k = String(r[keyCol] ?? '');
      if (k) byKey.set(k, r);
    }
    for (const [k, mut] of outboxMap.entries()) {
      if (mut.op === 'delete') {
        byKey.delete(k);
      } else if (mut.op === 'upsert' && mut.row) {
        const prev = byKey.get(k) || {};
        byKey.set(k, { ...prev, ...mut.row });
      }
    }
    return Array.from(byKey.values());
  };

  const fetchQuarters = async () => {
    if (!callbacks.onQuarters || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('quarters').select('*').eq('owner_id', uid).order('number', { ascending: true })
    );
    if (error) {
      console.warn('Supabase quarters load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('quarters', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onQuarters(rows.map((r) => mapQuarterRow(r)));
    }
  };

  const fetchMonths = async () => {
    if (!callbacks.onMonths || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('months').select('*').eq('owner_id', uid).order('month_number', { ascending: true })
    );
    if (error) {
      console.warn('Supabase months load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('months', (data || []) as Record<string, unknown>[], 'doc_id');
      callbacks.onMonths(rows.map((r) => mapMonthRow(r)));
    }
  };

  const fetchDomains = async () => {
    if (!callbacks.onDomains || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('domains').select('*').eq('owner_id', uid).order('sort_order', { ascending: true })
    );
    if (error) {
      console.warn('Supabase domains load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('domains', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onDomains(rows.map((r) => mapDomainRow(r)));
    }
  };

  const fetchCourses = async () => {
    if (!callbacks.onCourses || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('courses').select('*').eq('owner_id', uid).order('course_number', { ascending: true })
    );
    if (error) {
      console.warn('Supabase courses load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('courses', (data || []) as Record<string, unknown>[], 'doc_id');
      callbacks.onCourses(rows.map((r) => mapCourseRow(r)));
    }
  };

  const fetchBookNotes = async () => {
    if (!callbacks.onBookNotes || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('book_notes').select('*').eq('owner_id', uid).order('updated_at', { ascending: false })
    );
    if (error) {
      console.warn('Supabase book_notes load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('book_notes', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onBookNotes(rows.map((r) => mapBookNoteRow(r)));
    }
  };

  const fetchCustomCategories = async () => {
    if (!callbacks.onCustomCategories || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('custom_categories').select('*').eq('owner_id', uid)
    );
    if (error) {
      console.warn('Supabase custom_categories load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('custom_categories', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onCustomCategories(rows.map((r) => mapCustomCategoryRow(r)));
    }
  };

  const fetchHistory = async () => {
    if (!callbacks.onHistory || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('study_history')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at_ms', { ascending: false })
        .limit(40)
    );
    if (error) {
      console.warn('Supabase study_history load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('study_history', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onHistory(rows.map((r) => mapHistoryRow(r)));
    }
  };

  const fetchPreferences = async () => {
    if (!callbacks.onPreferences || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('user_preferences')
        .select('*')
        .eq('owner_id', uid)
        .eq('id', 'settings')
        .maybeSingle()
    );
    if (error) {
      console.warn('Supabase user_preferences load error:', error);
      return;
    }
    if (!disposed) {
      const outboxPref = getOfflineOutboxMapForTable(uid, 'user_preferences').get('settings');
      const effectiveRow =
        outboxPref?.op === 'upsert' && outboxPref.row
          ? { ...(data || {}), ...outboxPref.row }
          : data;
      if (effectiveRow) {
        callbacks.onPreferences(mapPreferencesRow(effectiveRow as Record<string, unknown>));
      }
    }
  };

  const fetchReflections = async () => {
    if (!callbacks.onReflections || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('reflections')
        .select('*')
        .eq('owner_id', uid)
        .order('pinned', { ascending: false })
        .order('created_at_ms', { ascending: false })
    );
    if (error) {
      console.warn('Supabase reflections load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('reflections', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onReflections(rows.map((r) => mapReflectionRow(r)));
    }
  };

  const fetchBlogPosts = async () => {
    if (!callbacks.onBlogPosts || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('blog_posts')
        .select('*')
        .eq('owner_id', uid)
        .order('pinned', { ascending: false })
        .order('created_at_ms', { ascending: false })
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending010Migration = true;
      } else {
        console.warn('Supabase blog_posts load error:', error);
      }
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('blog_posts', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onBlogPosts(rows.map((r) => mapBlogPostRow(r)));
    }
  };

  const fetchCalendarEvents = async () => {
    if (!callbacks.onCalendarEvents || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('calendar_events')
        .select('*')
        .eq('owner_id', uid)
        .order('date_key', { ascending: true })
        .order('time_slot', { ascending: true })
    );
    if (error) {
      console.warn('Supabase calendar_events load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('calendar_events', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onCalendarEvents(rows.map((r) => mapCalendarEventRow(r)));
    }
  };

  const fetchLearningPaths = async () => {
    if (!callbacks.onLearningPaths || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('learning_paths').select('*').eq('owner_id', uid)
    );
    if (error) {
      console.warn('Supabase learning_paths load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('learning_paths', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onLearningPaths(rows.map((r) => mapLearningPathRow(r)));
    }
  };

  const fetchReadingItems = async () => {
    if (!callbacks.onReadingItems || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('reading_items').select('*').eq('owner_id', uid)
    );
    if (error) {
      console.warn('Supabase reading_items load error:', error);
      return;
    }
    if (!disposed) {
      const localExtras = readLocalReadingExtrasMap(uid);
      const rows = overlayOutboxOnRows(
        'reading_items',
        (data || []) as Record<string, unknown>[],
        'id'
      );
      const mapped = rows.map((r) => {
        const item = mapReadingItemRow(r);
        const extra = localExtras[item.id];
        if (!extra) return item;
        return {
          ...item,
          coverImageUrl: item.coverImageUrl || extra.coverImageUrl,
          coverStoragePath: item.coverStoragePath || extra.coverStoragePath,
          coverFrame: item.coverFrame || extra.coverFrame,
          workspaceData: item.workspaceData || extra.workspaceData,
        };
      });
      callbacks.onReadingItems(mapped);
    }
  };

  const fetchProjects = async () => {
    if (!callbacks.onProjects || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('practical_projects').select('*').eq('owner_id', uid)
    );
    if (error) {
      console.warn('Supabase practical_projects load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('practical_projects', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onProjects(rows.map((r) => mapPracticalProjectRow(r)));
    }
  };

  const fetchUnifiedTasks = async () => {
    if (!callbacks.onUnifiedTasks || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c.from('unified_tasks').select('*').eq('owner_id', uid)
    );
    if (error) {
      console.warn('Supabase unified_tasks load error:', error);
      return;
    }
    if (!disposed) {
      const postponedSet = readLocalPostponedTaskSet(uid);
      const localRecurrenceMap = readLocalTaskRecurrenceMap(uid);
      const rows = overlayOutboxOnRows('unified_tasks', (data || []) as Record<string, unknown>[], 'id');
      const mapped = rows.map((r) => {
        let task = mapUnifiedTaskRow(r);
        if (task.status === 'postponed' && postponedSet.has(task.id)) {
          postponedSet.delete(task.id);
          writeLocalPostponedTaskSet(uid, postponedSet);
        } else if (task.status === 'todo' && postponedSet.has(task.id)) {
          task = { ...task, status: 'postponed' as UnifiedTaskStatus };
        }
        const localRec = localRecurrenceMap[task.id];
        if (localRec) {
          task = {
            ...task,
            recurrence: task.recurrence || localRec.recurrence,
            completedOccurrenceDates:
              task.completedOccurrenceDates && task.completedOccurrenceDates.length > 0
                ? task.completedOccurrenceDates
                : localRec.completedOccurrenceDates || [],
          };
        }
        return task;
      });
      callbacks.onUnifiedTasks(mapped);
    }
  };

  const fetchWeeklyMeetings = async () => {
    if (!callbacks.onWeeklyMeetings || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('weekly_meetings')
        .select('*')
        .eq('owner_id', uid)
        .order('start_date', { ascending: true })
    );
    if (error) {
      console.warn('Supabase weekly_meetings load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('weekly_meetings', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onWeeklyMeetings(rows.map((r) => mapWeeklyMeetingRow(r)));
    }
  };

  const fetchDentalCases = async () => {
    if (!callbacks.onDentalCases || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('dental_cases')
        .select('*')
        .eq('owner_id', uid)
        .order('case_date', { ascending: false })
    );
    if (error) {
      console.warn('Supabase dental_cases load error:', error);
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('dental_cases', (data || []) as Record<string, unknown>[], 'id');
      callbacks.onDentalCases(rows.map((r) => mapDentalCaseRow(r)));
    }
  };

  const fetchActivityLogs = async () => {
    if (!callbacks.onActivityLogs || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('activity_logs')
        .select('*')
        .eq('owner_id', uid)
        .order('occurred_at_ms', { ascending: false })
        .limit(600)
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending012Migration = true;
        if (!disposed) callbacks.onActivityLogs(readLocalFallbackList<ActivityLogEntry>(uid, 'activity_logs'));
      }
      return;
    }
    if (!disposed) {
      const outboxMap = getOfflineOutboxMapForTable(uid, 'activity_logs');
      const remote = (data || [])
        .map((r) => mapActivityLogRow(r as Record<string, unknown>))
        .filter((item) => outboxMap.get(item.id)?.op !== 'delete');
      const local = readLocalFallbackList<ActivityLogEntry>(uid, 'activity_logs').filter(
        (item) => outboxMap.get(item.id)?.op !== 'delete'
      );
      callbacks.onActivityLogs(mergeByKey(remote, local, (x) => x.id, (x) => x.occurredAtMs));
    }
  };

  const fetchDailyJournals = async () => {
    if (!callbacks.onDailyJournals || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('daily_journals')
        .select('*')
        .eq('owner_id', uid)
        .order('date_key', { ascending: false })
        .limit(400)
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending012Migration = true;
        if (!disposed) callbacks.onDailyJournals(readLocalFallbackList<DailyJournalRecord>(uid, 'daily_journals'));
      }
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('daily_journals', (data || []) as Record<string, unknown>[], 'date_key');
      const remote = rows.map((r) => mapDailyJournalRow(r));
      const local = readLocalFallbackList<DailyJournalRecord>(uid, 'daily_journals');
      callbacks.onDailyJournals(mergeByKey(remote, local, (x) => x.dateKey, (x) => x.updatedAtMs));
    }
  };

  const fetchPeriodReviews = async () => {
    if (!callbacks.onPeriodReviews || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('period_reviews')
        .select('*')
        .eq('owner_id', uid)
        .order('period_start_key', { ascending: false })
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending012Migration = true;
        if (!disposed) callbacks.onPeriodReviews(readLocalFallbackList<PeriodReviewRecord>(uid, 'period_reviews'));
      }
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('period_reviews', (data || []) as Record<string, unknown>[], 'id');
      const remote = rows.map((r) => mapPeriodReviewRow(r));
      const local = readLocalFallbackList<PeriodReviewRecord>(uid, 'period_reviews');
      callbacks.onPeriodReviews(mergeByKey(remote, local, (x) => x.id, (x) => x.updatedAtMs));
    }
  };

  const fetchWeeklyPlans = async () => {
    if (!callbacks.onWeeklyPlans || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('weekly_plans')
        .select('*')
        .eq('owner_id', uid)
        .order('week_start_key', { ascending: false })
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending012Migration = true;
        if (!disposed) callbacks.onWeeklyPlans(readLocalFallbackList<WeeklyPlanRecord>(uid, 'weekly_plans'));
      }
      return;
    }
    if (!disposed) {
      const rows = overlayOutboxOnRows('weekly_plans', (data || []) as Record<string, unknown>[], 'week_key');
      const remote = rows.map((r) => mapWeeklyPlanRow(r));
      const local = readLocalFallbackList<WeeklyPlanRecord>(uid, 'weekly_plans');
      callbacks.onWeeklyPlans(mergeByKey(remote, local, (x) => x.weekKey, (x) => x.updatedAtMs));
    }
  };

  const fetchPinCollections = async () => {
    if (!callbacks.onPinCollections || disposed) return;
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('pin_collections')
        .select('*')
        .eq('owner_id', uid)
        .order('sort_order', { ascending: true })
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending012Migration = true;
        if (!disposed) callbacks.onPinCollections(readLocalFallbackList<PinCollection>(uid, 'pin_collections'));
      }
      return;
    }
    if (!disposed) {
      const outboxMap = getOfflineOutboxMapForTable(uid, 'pin_collections');
      const remote = (data || [])
        .map((r) => mapPinCollectionRow(r as Record<string, unknown>))
        .filter((item) => outboxMap.get(item.id)?.op !== 'delete');
      const local = readLocalFallbackList<PinCollection>(uid, 'pin_collections').filter(
        (item) => outboxMap.get(item.id)?.op !== 'delete'
      );
      callbacks.onPinCollections(mergeByKey(remote, local, (x) => x.id, (x) => x.updatedAtMs));
    }
  };

  const fetchAll = async () => {
    await Promise.allSettled([
      fetchQuarters(),
      fetchMonths(),
      fetchDomains(),
      fetchCourses(),
      fetchBookNotes(),
      fetchCustomCategories(),
      fetchHistory(),
      fetchPreferences(),
      fetchReflections(),
      fetchBlogPosts(),
      fetchCalendarEvents(),
      fetchLearningPaths(),
      fetchReadingItems(),
      fetchProjects(),
      fetchUnifiedTasks(),
      fetchWeeklyMeetings(),
      fetchDentalCases(),
      fetchActivityLogs(),
      fetchDailyJournals(),
      fetchPeriodReviews(),
      fetchWeeklyPlans(),
      fetchPinCollections(),
    ]);
  };

  callbacks.onRefreshReady?.(fetchAll);
  void fetchAll();

  const tableRefetchers: Record<string, () => Promise<void>> = {
    quarters: fetchQuarters,
    months: fetchMonths,
    domains: fetchDomains,
    courses: fetchCourses,
    book_notes: fetchBookNotes,
    custom_categories: fetchCustomCategories,
    study_history: fetchHistory,
    user_preferences: fetchPreferences,
    reflections: fetchReflections,
    blog_posts: fetchBlogPosts,
    calendar_events: fetchCalendarEvents,
    learning_paths: fetchLearningPaths,
    reading_items: fetchReadingItems,
    practical_projects: fetchProjects,
    unified_tasks: fetchUnifiedTasks,
    weekly_meetings: fetchWeeklyMeetings,
    dental_cases: fetchDentalCases,
    activity_logs: fetchActivityLogs,
    daily_journals: fetchDailyJournals,
    period_reviews: fetchPeriodReviews,
    weekly_plans: fetchWeeklyPlans,
    pin_collections: fetchPinCollections,
  };

  let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let reconnectTimer: number | null = null;
  let realtimeSubscribed = false;

  const setupRealtimeChannel = async (forceRefreshToken = false) => {
    if (disposed || !supabase) return;
    await ensureSupabaseRealtimeAuth(forceRefreshToken);
    if (disposed || !supabase) return;

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const ch = supabase
      .channel(`workspace_${uid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          filter: `owner_id=eq.${uid}`,
        },
        (payload) => {
          if (disposed) return;
          const fn = tableRefetchers[payload.table];
          if (fn) void fn();
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          realtimeSubscribed = true;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeSubscribed = false;
          if (!reconnectTimer && typeof window !== 'undefined') {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              void setupRealtimeChannel(true);
            }, 4000);
          }
        }
      });

    activeChannel = ch;
  };

  void setupRealtimeChannel(false);

  const onResumeSync = () => {
    if (disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void fetchAll();
    if (!realtimeSubscribed) {
      void setupRealtimeChannel(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onResumeSync);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onResumeSync);
    window.addEventListener('pageshow', onResumeSync);
    window.addEventListener('online', onResumeSync);
  }

  const safetyInterval =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (
            disposed ||
            (typeof document !== 'undefined' &&
              document.visibilityState !== 'visible') ||
            (typeof navigator !== 'undefined' && navigator.onLine === false)
          ) {
            return;
          }
          void fetchAll();
        }, 15000)
      : null;

  return () => {
    disposed = true;
    if (reconnectTimer && typeof window !== 'undefined') {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (safetyInterval && typeof window !== 'undefined') {
      window.clearInterval(safetyInterval);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onResumeSync);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onResumeSync);
      window.removeEventListener('pageshow', onResumeSync);
      window.removeEventListener('online', onResumeSync);
    }
    if (supabase && activeChannel) {
      void supabase.removeChannel(activeChannel);
    }
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

type ConnectedSupabaseClient = NonNullable<typeof supabase>;

let hasPending007Migration = false;
export function isPending007Migration(): boolean {
  return hasPending007Migration;
}

let hasPending010Migration = false;
export function isPending010Migration(): boolean {
  return hasPending010Migration;
}

let hasPending011Migration = false;
export function isPending011Migration(): boolean {
  return hasPending011Migration;
}

let hasPending012Migration = false;
export function isPending012Migration(): boolean {
  return hasPending012Migration;
}

let hasPending013Migration = false;
export function isPending013Migration(): boolean {
  return hasPending013Migration;
}

let hasPending014Migration = false;
export function isPending014Migration(): boolean {
  return hasPending014Migration;
}

let hasPending015Migration = false;
export function isPending015Migration(): boolean {
  return hasPending015Migration;
}

const OPTIONAL_007_COLUMNS_BY_TABLE: Record<string, string[]> = {
  courses: ['learning_objectives', 'sort_order', 'is_public'],
  learning_paths: ['learning_objectives', 'sort_order', 'is_public'],
  reading_items: ['learning_objectives', 'sort_order', 'is_public'],
  book_notes: ['resources', 'sort_order', 'created_at_ms'],
  unified_tasks: [
    'linked_course_id',
    'linked_path_id',
    'linked_book_id',
    'recurrence',
    'completed_occurrence_dates',
  ],
  user_preferences: [
    'weekly_rhythm',
    'reflection_categories',
    'custom_reading_modes',
    'pinned_nav_tabs',
    'custom_hubs',
    'dashboard_hero',
    'extra_prefs',
  ],
  reflections: [
    'category_tag',
    'color_key',
    'is_public',
    'image_url',
    'image_storage_path',
    'image_frame',
  ],
  public_site_config: ['public_reflection_categories'],
};

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const code = (e.code || '').toUpperCase();
  const msg = (e.message || '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('schema cache') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const code = (e.code || '').toUpperCase();
  const msg = (e.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('could not find the table');
}

const OPTIONAL_019_COLUMNS_BY_TABLE: Record<string, string[]> = {
  reading_items: [
    'cover_image_url',
    'cover_storage_path',
    'cover_frame',
    'workspace_data',
  ],
};

const OPTIONAL_020_COLUMNS_BY_TABLE: Record<string, string[]> = {
  reading_items: ['storage_provider', 'cover_storage_provider'],
  reflections: ['image_storage_provider'],
  blog_posts: ['cover_storage_provider'],
  dental_cases: ['cover_storage_provider'],
  daily_journals: ['cover_storage_provider'],
};

function stripColumns(
  row: Record<string, unknown>,
  dropCols: string[]
): Record<string, unknown> {
  if (dropCols.length === 0) return row;
  const clone: Record<string, unknown> = { ...row };
  for (const col of dropCols) {
    delete clone[col];
  }
  return clone;
}

function strip007Columns(
  table: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  return stripColumns(row, OPTIONAL_007_COLUMNS_BY_TABLE[table] ?? []);
}

async function runWrite(
  op: (client: ConnectedSupabaseClient) => PromiseLike<{ error: unknown }>
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await withFirebaseTokenRetry(async (client) => {
    const { error } = await op(client);
    if (error) {
      const msg = formatSupabaseErrorMessage(error);
      console.error('Supabase write error:', error);
      throw new Error(msg);
    }
  });
}

async function runUpsertWith007Fallback(
  table: string,
  row: Record<string, unknown>,
  onConflict: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await withFirebaseTokenRetry(async (client) => {
    const { error } = await client.from(table).upsert(row, { onConflict });
    if (!error) return;
    const cols020 = OPTIONAL_020_COLUMNS_BY_TABLE[table] ?? [];
    const cols019 = OPTIONAL_019_COLUMNS_BY_TABLE[table] ?? [];
    const cols007 = OPTIONAL_007_COLUMNS_BY_TABLE[table] ?? [];
    let workingRow = row;
    let activeErr: unknown = error;

    if (isMissingColumnError(activeErr) && cols020.length > 0) {
      workingRow = stripColumns(workingRow, cols020);
      const { error: err020 } = await client
        .from(table)
        .upsert(workingRow, { onConflict });
      if (!err020) return;
      activeErr = err020;
    }

    if (isMissingColumnError(activeErr) && (cols019.length > 0 || cols007.length > 0)) {
      if (cols019.length > 0) {
        const rowWithout019 = stripColumns(workingRow, cols019);
        const { error: err019 } = await client
          .from(table)
          .upsert(rowWithout019, { onConflict });
        if (!err019) {
          console.warn(
            `Supabase table "${table}" is missing migration 019 columns; saved base columns while keeping local cache.`
          );
          return;
        }
        if (isMissingColumnError(err019) && cols007.length > 0) {
          hasPending007Migration = true;
          const rowLegacy = stripColumns(rowWithout019, cols007);
          const { error: retryErr } = await client
            .from(table)
            .upsert(rowLegacy, { onConflict });
          if (!retryErr) return;
          console.error('Supabase fallback write error:', retryErr);
          throw new Error(formatSupabaseErrorMessage(retryErr));
        }
        console.error('Supabase fallback write error:', err019);
        throw new Error(formatSupabaseErrorMessage(err019));
      }
      hasPending007Migration = true;
      console.warn(
        `Supabase table "${table}" is missing migration 007 columns; retrying with legacy schema:`,
        activeErr
      );
      const fallbackRow = strip007Columns(table, workingRow);
      const { error: retryErr } = await client
        .from(table)
        .upsert(fallbackRow, { onConflict });
      if (!retryErr) return;
      console.error('Supabase fallback write error:', retryErr);
      throw new Error(formatSupabaseErrorMessage(retryErr));
    }
    console.error('Supabase write error:', error);
    throw new Error(formatSupabaseErrorMessage(error));
  });
}

async function runQueuedUpsert(params: {
  uid: string;
  table: string;
  keyCol: string;
  keyVal: string;
  onConflict: string;
  row: Record<string, unknown>;
  use007Fallback?: boolean;
}): Promise<void> {
  const { uid, table, keyCol, keyVal, onConflict, row, use007Fallback } = params;
  if (!isAppOnline() || !isSupabaseConfigured || !supabase) {
    enqueueSupabaseUpsert(uid, { table, keyCol, keyVal, onConflict, row });
    return;
  }
  try {
    if (use007Fallback) {
      await runUpsertWith007Fallback(table, row, onConflict);
    } else {
      await runWrite((c) => c.from(table).upsert(row, { onConflict }));
    }
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      enqueueSupabaseUpsert(uid, { table, keyCol, keyVal, onConflict, row });
      return;
    }
    throw err;
  }
}

async function runQueuedDelete(params: {
  uid: string;
  table: string;
  keyCol: string;
  keyVal: string;
}): Promise<void> {
  const { uid, table, keyCol, keyVal } = params;
  if (!isAppOnline() || !isSupabaseConfigured || !supabase) {
    enqueueSupabaseDelete(uid, { table, keyCol, keyVal });
    return;
  }
  try {
    await runWrite((c) =>
      c.from(table).delete().eq('owner_id', uid).eq(keyCol, keyVal)
    );
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      enqueueSupabaseDelete(uid, { table, keyCol, keyVal });
      return;
    }
    throw err;
  }
}

export async function executeQueuedSupabaseMutation(
  mut: QueuedSupabaseMutation
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }
  if (mut.op === 'delete') {
    await runWrite((c) =>
      c.from(mut.table).delete().eq('owner_id', mut.uid).eq(mut.keyCol, mut.keyVal)
    );
    return;
  }
  const row = mut.row || {};
  if (mut.table === 'daily_journals') {
    try {
      await runWrite((c) =>
        c.from('daily_journals').upsert(row, { onConflict: mut.onConflict || 'owner_id,date_key' })
      );
    } catch (err) {
      if (isMissingColumnError(err)) {
        const clone = { ...row };
        delete clone.daily_quote;
        await runWrite((c) =>
          c.from('daily_journals').upsert(clone, { onConflict: mut.onConflict || 'owner_id,date_key' })
        );
        return;
      }
      throw err;
    }
    return;
  }
  if (OPTIONAL_007_COLUMNS_BY_TABLE[mut.table]) {
    await runUpsertWith007Fallback(mut.table, row, mut.onConflict || 'owner_id,id');
  } else {
    await runWrite((c) =>
      c.from(mut.table).upsert(row, { onConflict: mut.onConflict || 'owner_id,id' })
    );
  }
}

export async function saveQuarterDoc(uid: string, q: QuarterInfo): Promise<void> {
  const row = buildQuarterRow(uid, q);
  await runQueuedUpsert({
    uid,
    table: 'quarters',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deleteQuarterDoc(uid: string, quarterId: string): Promise<void> {
  const id = sanitizeId(quarterId);
  await runQueuedDelete({ uid, table: 'quarters', keyCol: 'id', keyVal: id });
}

export async function saveMonthDoc(uid: string, m: MonthPlan): Promise<void> {
  const row = buildMonthRow(uid, m);
  await runQueuedUpsert({
    uid,
    table: 'months',
    keyCol: 'doc_id',
    keyVal: row.doc_id,
    onConflict: 'owner_id,doc_id',
    row,
  });
}

export async function deleteMonthDoc(uid: string, docId: string): Promise<void> {
  const id = sanitizeId(docId);
  await runQueuedDelete({ uid, table: 'months', keyCol: 'doc_id', keyVal: id });
}

export async function saveDomainDoc(
  uid: string,
  d: DomainInfo,
  order: number
): Promise<void> {
  const row = buildDomainRow(uid, d, order);
  await runQueuedUpsert({
    uid,
    table: 'domains',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deleteDomainDoc(uid: string, domainId: string): Promise<void> {
  const id = sanitizeId(domainId);
  await runQueuedDelete({ uid, table: 'domains', keyCol: 'id', keyVal: id });
}

export async function saveCourseDoc(uid: string, cItem: PersonalCourse): Promise<void> {
  const row = buildCourseRow(uid, cItem);
  await runQueuedUpsert({
    uid,
    table: 'courses',
    keyCol: 'doc_id',
    keyVal: row.doc_id,
    onConflict: 'owner_id,doc_id',
    row,
    use007Fallback: true,
  });
}

export async function deleteCourseDoc(uid: string, docId: string): Promise<void> {
  const id = sanitizeId(docId);
  await runQueuedDelete({ uid, table: 'courses', keyCol: 'doc_id', keyVal: id });
}

export async function saveBookNoteDoc(uid: string, bn: BookNote): Promise<void> {
  const row = buildBookNoteRow(uid, bn);
  await runQueuedUpsert({
    uid,
    table: 'book_notes',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
    use007Fallback: true,
  });
}

export async function deleteBookNoteDoc(uid: string, noteId: string): Promise<void> {
  const id = sanitizeId(noteId);
  await runQueuedDelete({ uid, table: 'book_notes', keyCol: 'id', keyVal: id });
}

export async function saveCustomCategoryDoc(
  uid: string,
  cat: CustomCategory
): Promise<void> {
  const row = buildCustomCategoryRow(uid, cat);
  await runQueuedUpsert({
    uid,
    table: 'custom_categories',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deleteCustomCategoryDoc(
  uid: string,
  categoryId: string
): Promise<void> {
  const id = sanitizeId(categoryId);
  await runQueuedDelete({ uid, table: 'custom_categories', keyCol: 'id', keyVal: id });
}

export async function saveHistoryEntryDoc(
  uid: string,
  entry: StudyHistoryEntry
): Promise<void> {
  const row = buildHistoryRow(uid, entry);
  await runQueuedUpsert({
    uid,
    table: 'study_history',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deleteHistoryEntryDoc(
  uid: string,
  entryId: string
): Promise<void> {
  const id = sanitizeId(entryId);
  await runQueuedDelete({ uid, table: 'study_history', keyCol: 'id', keyVal: id });
}

export async function saveUserPreferencesDoc(
  uid: string,
  prefs: UserPreferences
): Promise<void> {
  const row = buildUserPreferencesRow(uid, prefs);
  if (!prefs.themeConfig && isSupabaseConfigured && supabase && isAppOnline()) {
    try {
      const existing = await withFirebaseTokenRetry(async (c) =>
        c
          .from('user_preferences')
          .select('calendar_prefs')
          .eq('owner_id', uid)
          .eq('id', 'settings')
          .maybeSingle()
      );
      const existingCal =
        existing.data?.calendar_prefs &&
        typeof existing.data.calendar_prefs === 'object'
          ? (existing.data.calendar_prefs as Record<string, unknown>)
          : null;
      if (
        existingCal?.themeConfigMirror &&
        typeof existingCal.themeConfigMirror === 'object'
      ) {
        row.calendar_prefs.themeConfigMirror = sanitizeThemeConfig(
          existingCal.themeConfigMirror
        );
      }
    } catch {
      // Non-blocking fallback
    }
  }
  await runQueuedUpsert({
    uid,
    table: 'user_preferences',
    keyCol: 'id',
    keyVal: 'settings',
    onConflict: 'owner_id,id',
    row,
    use007Fallback: true,
  });
}

function isRlsPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; status?: number; message?: string };
  const code = (e.code || '').toUpperCase();
  const msg = (e.message || '').toLowerCase();
  return (
    code === '42501' ||
    e.status === 403 ||
    msg.includes('row-level security') ||
    msg.includes('permission denied')
  );
}

/**
 * Fetches ONLY the current authenticated user's persisted theme configuration
 * from `user_preferences.calendar_prefs.themeConfigMirror` (safe for both admins
 * and regular non-admin users once migration 015 is applied).
 */
export async function fetchUserThemeConfig(uid: string): Promise<{
  themeConfig: ThemeConfig | null;
  rlsBlocked?: boolean;
  error?: unknown;
}> {
  if (!isSupabaseConfigured || !supabase || !uid) {
    return { themeConfig: null };
  }
  try {
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('user_preferences')
        .select('calendar_prefs')
        .eq('owner_id', uid)
        .eq('id', 'settings')
        .maybeSingle()
    );
    if (error) {
      if (isRlsPermissionError(error)) {
        hasPending015Migration = true;
        return { themeConfig: null, rlsBlocked: true, error };
      }
      return { themeConfig: null, error };
    }
    hasPending015Migration = false;
    const cal =
      data?.calendar_prefs && typeof data.calendar_prefs === 'object'
        ? (data.calendar_prefs as Record<string, unknown>)
        : null;
    const mirror = cal?.themeConfigMirror;
    if (
      mirror &&
      typeof mirror === 'object' &&
      Object.keys(mirror as Record<string, unknown>).length > 0
    ) {
      return { themeConfig: sanitizeThemeConfig(mirror as Partial<ThemeConfig>) };
    }
    return { themeConfig: null };
  } catch (err) {
    if (isRlsPermissionError(err)) {
      hasPending015Migration = true;
      return { themeConfig: null, rlsBlocked: true, error: err };
    }
    return { themeConfig: null, error: err };
  }
}

/**
 * Persists ONLY `themeConfigMirror` inside `user_preferences.calendar_prefs`
 * for the authenticated user (`owner_id = uid`), performing a read-merge-update
 * so existing calendar preferences, pinned nav tabs, custom hubs, hero frame,
 * and unrelated preference columns are never overwritten.
 */
export async function saveUserThemeConfigOnly(
  uid: string,
  themeConfig: ThemeConfig
): Promise<ThemeConfig> {
  const clean = sanitizeThemeConfig(themeConfig);
  if (!isSupabaseConfigured || !supabase || !uid) {
    return clean;
  }

  await withFirebaseTokenRetry(async (client) => {
    const { data: existing, error: selErr } = await client
      .from('user_preferences')
      .select('calendar_prefs')
      .eq('owner_id', uid)
      .eq('id', 'settings')
      .maybeSingle();

    if (selErr) {
      if (isRlsPermissionError(selErr)) {
        hasPending015Migration = true;
        throw new Error(
          'تحتاج قاعدة البيانات إلى تفعيل سياسة حفظ المظهر للحسابات (ملف الترحيل 015) في Supabase.'
        );
      }
      throw new Error(formatSupabaseErrorMessage(selErr));
    }

    if (existing) {
      const prevCal =
        existing.calendar_prefs && typeof existing.calendar_prefs === 'object'
          ? { ...(existing.calendar_prefs as Record<string, unknown>) }
          : {};
      const mergedCal = {
        ...prevCal,
        themeConfigMirror: clean,
      };
      const { error: updErr } = await client
        .from('user_preferences')
        .update({ calendar_prefs: mergedCal })
        .eq('owner_id', uid)
        .eq('id', 'settings');
      if (updErr) {
        if (isRlsPermissionError(updErr)) {
          hasPending015Migration = true;
          throw new Error(
            'تحتاج قاعدة البيانات إلى تفعيل سياسة حفظ المظهر للحسابات (ملف الترحيل 015) في Supabase.'
          );
        }
        throw new Error(formatSupabaseErrorMessage(updErr));
      }
      hasPending015Migration = false;
      return;
    }

    // First-time preferences row for this user
    const freshRow = buildUserPreferencesRow(uid, {
      ...DEFAULT_USER_PREFERENCES,
      themeConfig: clean,
    });
    const { error: insErr } = await client
      .from('user_preferences')
      .upsert(freshRow, { onConflict: 'owner_id,id' });
    if (insErr) {
      if (isMissingColumnError(insErr) && OPTIONAL_007_COLUMNS_BY_TABLE.user_preferences) {
        const fallbackRow = strip007Columns('user_preferences', freshRow);
        const { error: retryErr } = await client
          .from('user_preferences')
          .upsert(fallbackRow, { onConflict: 'owner_id,id' });
        if (retryErr) {
          if (isRlsPermissionError(retryErr)) {
            hasPending015Migration = true;
            throw new Error(
              'تحتاج قاعدة البيانات إلى تفعيل سياسة حفظ المظهر للحسابات (ملف الترحيل 015) في Supabase.'
            );
          }
          throw new Error(formatSupabaseErrorMessage(retryErr));
        }
        hasPending015Migration = false;
        return;
      }
      if (isRlsPermissionError(insErr)) {
        hasPending015Migration = true;
        throw new Error(
          'تحتاج قاعدة البيانات إلى تفعيل سياسة حفظ المظهر للحسابات (ملف الترحيل 015) في Supabase.'
        );
      }
      throw new Error(formatSupabaseErrorMessage(insErr));
    }
    hasPending015Migration = false;
  });

  return clean;
}

export async function saveReflectionDoc(
  uid: string,
  reflection: PersonalReflection
): Promise<void> {
  const row = buildReflectionRow(uid, reflection);
  await runQueuedUpsert({
    uid,
    table: 'reflections',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
    use007Fallback: true,
  });
}

export async function deleteReflectionDoc(
  uid: string,
  reflectionId: string
): Promise<void> {
  const id = sanitizeId(reflectionId);
  await runQueuedDelete({ uid, table: 'reflections', keyCol: 'id', keyVal: id });
}

export async function saveBlogPostDoc(
  uid: string,
  post: BlogPost
): Promise<void> {
  const row = buildBlogPostRow(uid, post);
  try {
    await runQueuedUpsert({
      uid,
      table: 'blog_posts',
      keyCol: 'id',
      keyVal: row.id,
      onConflict: 'owner_id,id',
      row,
      use007Fallback: true,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending010Migration = true;
      return;
    }
    throw err;
  }
}

export async function deleteBlogPostDoc(
  uid: string,
  postId: string
): Promise<void> {
  const id = sanitizeId(postId);
  try {
    await runQueuedDelete({ uid, table: 'blog_posts', keyCol: 'id', keyVal: id });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending010Migration = true;
      return;
    }
    throw err;
  }
}

export async function saveCalendarEventDoc(
  uid: string,
  event: CalendarEvent
): Promise<void> {
  const row = buildCalendarEventRow(uid, event);
  await runQueuedUpsert({
    uid,
    table: 'calendar_events',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deleteCalendarEventDoc(
  uid: string,
  eventId: string
): Promise<void> {
  const id = sanitizeId(eventId);
  await runQueuedDelete({ uid, table: 'calendar_events', keyCol: 'id', keyVal: id });
}

export async function saveLearningPathDoc(
  uid: string,
  pathItem: LearningPath
): Promise<void> {
  const row = buildLearningPathRow(uid, pathItem);
  await runQueuedUpsert({
    uid,
    table: 'learning_paths',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
    use007Fallback: true,
  });
}

export async function deleteLearningPathDoc(
  uid: string,
  pathId: string
): Promise<void> {
  const id = sanitizeId(pathId);
  await runQueuedDelete({ uid, table: 'learning_paths', keyCol: 'id', keyVal: id });
}

type LocalReadingExtrasMap = Record<
  string,
  {
    coverImageUrl?: string;
    coverStoragePath?: string;
    coverFrame?: ReadingLibraryItem['coverFrame'];
    workspaceData?: BookWorkspaceData;
  }
>;

function readLocalReadingExtrasMap(uid: string): LocalReadingExtrasMap {
  if (typeof window === 'undefined' || !uid) return {};
  try {
    const raw = window.localStorage.getItem(`kb_reading_extras_${uid}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object'
      ? (parsed as LocalReadingExtrasMap)
      : {};
  } catch {
    return {};
  }
}

function writeLocalReadingExtrasEntry(
  uid: string,
  itemId: string,
  item?: ReadingLibraryItem | null
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const map = readLocalReadingExtrasMap(uid);
    const cleanWs = item ? sanitizeBookWorkspaceData(item.workspaceData) : undefined;
    if (
      !item ||
      (!item.coverImageUrl &&
        !item.coverStoragePath &&
        !item.coverFrame &&
        !cleanWs)
    ) {
      delete map[itemId];
    } else {
      map[itemId] = {
        ...(item.coverImageUrl ? { coverImageUrl: clip(item.coverImageUrl, 2000) } : {}),
        ...(item.coverStoragePath
          ? { coverStoragePath: clip(item.coverStoragePath, 500) }
          : {}),
        ...(item.coverFrame
          ? {
              coverFrame: sanitizeImageFrameSpec(
                item.coverFrame,
                DEFAULT_BOOK_COVER_FRAME
              ),
            }
          : {}),
        ...(cleanWs ? { workspaceData: cleanWs } : {}),
      };
    }
    window.localStorage.setItem(`kb_reading_extras_${uid}`, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

export async function saveReadingItemDoc(
  uid: string,
  item: ReadingLibraryItem
): Promise<void> {
  const row = buildReadingItemRow(uid, item);
  writeLocalReadingExtrasEntry(uid, row.id, item);
  await runQueuedUpsert({
    uid,
    table: 'reading_items',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
    use007Fallback: true,
  });
}

export async function deleteReadingItemDoc(
  uid: string,
  itemId: string
): Promise<void> {
  const id = sanitizeId(itemId);
  writeLocalReadingExtrasEntry(uid, id, null);
  await runQueuedDelete({ uid, table: 'reading_items', keyCol: 'id', keyVal: id });
}

export async function savePracticalProjectDoc(
  uid: string,
  proj: PracticalProject
): Promise<void> {
  const row = buildPracticalProjectRow(uid, proj);
  await runQueuedUpsert({
    uid,
    table: 'practical_projects',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deletePracticalProjectDoc(
  uid: string,
  projectId: string
): Promise<void> {
  const id = sanitizeId(projectId);
  await runQueuedDelete({ uid, table: 'practical_projects', keyCol: 'id', keyVal: id });
}

function readLocalPostponedTaskSet(uid: string): Set<string> {
  if (typeof window === 'undefined' || !uid) return new Set();
  try {
    const raw = window.localStorage.getItem(`kb_postponed_tasks_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeLocalPostponedTaskSet(uid: string, set: Set<string>): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(
      `kb_postponed_tasks_${uid}`,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // ignore storage quota errors
  }
}

type LocalTaskRecurrenceMap = Record<
  string,
  { recurrence?: UnifiedTask['recurrence']; completedOccurrenceDates?: string[] }
>;

function readLocalTaskRecurrenceMap(uid: string): LocalTaskRecurrenceMap {
  if (typeof window === 'undefined' || !uid) return {};
  try {
    const raw = window.localStorage.getItem(`kb_task_recurrence_${uid}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as LocalTaskRecurrenceMap) : {};
  } catch {
    return {};
  }
}

function writeLocalTaskRecurrenceEntry(
  uid: string,
  taskId: string,
  recurrence?: UnifiedTask['recurrence'],
  completedOccurrenceDates?: string[]
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const map = readLocalTaskRecurrenceMap(uid);
    const cleanRule = normalizeRecurrenceRule(recurrence);
    if (!cleanRule && (!completedOccurrenceDates || completedOccurrenceDates.length === 0)) {
      delete map[taskId];
    } else {
      map[taskId] = {
        ...(cleanRule ? { recurrence: cleanRule } : {}),
        ...(completedOccurrenceDates && completedOccurrenceDates.length > 0
          ? { completedOccurrenceDates }
          : {}),
      };
    }
    window.localStorage.setItem(`kb_task_recurrence_${uid}`, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export async function saveUnifiedTaskDoc(
  uid: string,
  task: UnifiedTask
): Promise<void> {
  const row = buildUnifiedTaskRow(uid, task);
  writeLocalTaskRecurrenceEntry(
    uid,
    row.id,
    task.recurrence,
    task.completedOccurrenceDates
  );
  const postponedSet = readLocalPostponedTaskSet(uid);
  if (task.status !== 'postponed' && postponedSet.has(row.id)) {
    postponedSet.delete(row.id);
    writeLocalPostponedTaskSet(uid, postponedSet);
  }

  try {
    await runQueuedUpsert({
      uid,
      table: 'unified_tasks',
      keyCol: 'id',
      keyVal: row.id,
      onConflict: 'owner_id,id',
      row,
      use007Fallback: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isStatusCheckError =
      task.status === 'postponed' &&
      (msg.includes('23514') || msg.includes('unified_tasks_status_check') || msg.includes('check constraint'));
    if (isStatusCheckError) {
      hasPending012Migration = true;
      postponedSet.add(row.id);
      writeLocalPostponedTaskSet(uid, postponedSet);
      await runQueuedUpsert({
        uid,
        table: 'unified_tasks',
        keyCol: 'id',
        keyVal: row.id,
        onConflict: 'owner_id,id',
        row: { ...row, status: 'todo' },
        use007Fallback: true,
      });
      return;
    }
    throw err;
  }
}

export async function deleteUnifiedTaskDoc(
  uid: string,
  taskId: string
): Promise<void> {
  const id = sanitizeId(taskId);
  writeLocalTaskRecurrenceEntry(uid, id, undefined, undefined);
  await runQueuedDelete({ uid, table: 'unified_tasks', keyCol: 'id', keyVal: id });
}

export async function saveDentalCaseDoc(
  uid: string,
  dentalCase: DentalCase
): Promise<void> {
  const row = buildDentalCaseRow(uid, dentalCase);
  await runQueuedUpsert({
    uid,
    table: 'dental_cases',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
    use007Fallback: true,
  });
}

export async function deleteDentalCaseDoc(
  uid: string,
  caseId: string
): Promise<void> {
  const id = sanitizeId(caseId);
  await runQueuedDelete({ uid, table: 'dental_cases', keyCol: 'id', keyVal: id });
}

export async function saveWeeklyMeetingDoc(
  uid: string,
  meeting: WeeklyMeeting
): Promise<void> {
  const row = buildWeeklyMeetingRow(uid, meeting);
  await runQueuedUpsert({
    uid,
    table: 'weekly_meetings',
    keyCol: 'id',
    keyVal: row.id,
    onConflict: 'owner_id,id',
    row,
  });
}

export async function deleteWeeklyMeetingDoc(
  uid: string,
  meetingId: string
): Promise<void> {
  const id = sanitizeId(meetingId);
  await runQueuedDelete({ uid, table: 'weekly_meetings', keyCol: 'id', keyVal: id });
}

// ============================================================================
// Cloud File Attachments Metadata Subscription
// ============================================================================

export interface CloudAttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
  storageProvider?: StorageProvider;
  updatedAtMs: number;
}

export function subscribeCloudAttachments(
  uid: string,
  onData: (items: CloudAttachmentItem[]) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    onData([]);
    return () => {};
  }

  let disposed = false;

  const fetchAttachments = async () => {
    if (disposed) return;
    try {
      const { data, error } = await withFirebaseTokenRetry(async (c) =>
        c
          .from('file_attachments')
          .select('*')
          .eq('owner_id', uid)
          .order('updated_at', { ascending: false })
      );
      if (error || disposed) {
        if (error) console.warn('Could not fetch file_attachments:', error);
        return;
      }
      const mapped: CloudAttachmentItem[] = (data || []).map((row) => {
        const r = row as Record<string, unknown>;
        const updatedStr = typeof r.updated_at === 'string' ? r.updated_at : '';
        const ms = updatedStr ? Date.parse(updatedStr) : 0;
        const storagePath = r.object_key
          ? String(r.object_key)
          : r.storage_path
          ? String(r.storage_path)
          : undefined;
        return {
          id: String(r.id),
          fileName: String(r.original_name || r.file_name || 'مستند مرفق'),
          mimeType: String(r.mime_type || 'application/pdf'),
          sizeBytes: Number(r.file_size ?? r.size_bytes ?? 0),
          storagePath,
          storageProvider: resolveEffectiveStorageProvider(
            r.storage_provider ? String(r.storage_provider) : undefined,
            storagePath
          ),
          updatedAtMs: Number.isFinite(ms) ? ms : 0,
        };
      });
      onData(mapped);
    } catch (err) {
      console.warn('Could not subscribe to user file_attachments:', err);
      if (!disposed) onData([]);
    }
  };

  void fetchAttachments();

  let activeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let reconnectTimer: number | null = null;
  let realtimeSubscribed = false;

  const setupRealtimeChannel = async (forceRefreshToken = false) => {
    if (disposed || !supabase) return;
    await ensureSupabaseRealtimeAuth(forceRefreshToken);
    if (disposed || !supabase) return;

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const ch = supabase
      .channel(`file_attachments_${uid}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_attachments',
          filter: `owner_id=eq.${uid}`,
        },
        () => {
          if (!disposed) void fetchAttachments();
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          realtimeSubscribed = true;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeSubscribed = false;
          if (!reconnectTimer && typeof window !== 'undefined') {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              void setupRealtimeChannel(true);
            }, 4000);
          }
        }
      });

    activeChannel = ch;
  };

  void setupRealtimeChannel(false);

  const onResumeSync = () => {
    if (disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void fetchAttachments();
    if (!realtimeSubscribed) {
      void setupRealtimeChannel(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onResumeSync);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onResumeSync);
    window.addEventListener('pageshow', onResumeSync);
    window.addEventListener('online', onResumeSync);
  }

  const safetyInterval =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (
            disposed ||
            (typeof document !== 'undefined' &&
              document.visibilityState !== 'visible') ||
            (typeof navigator !== 'undefined' && navigator.onLine === false)
          ) {
            return;
          }
          void fetchAttachments();
        }, 15000)
      : null;

  return () => {
    disposed = true;
    if (reconnectTimer && typeof window !== 'undefined') {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (safetyInterval && typeof window !== 'undefined') {
      window.clearInterval(safetyInterval);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onResumeSync);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onResumeSync);
      window.removeEventListener('pageshow', onResumeSync);
      window.removeEventListener('online', onResumeSync);
    }
    if (supabase && activeChannel) {
      void supabase.removeChannel(activeChannel);
    }
  };
}

// ============================================================================
// Public Homepage Configuration, Public Catalog & Admin RBAC Management
// ============================================================================

export async function fetchPublicSiteConfig(): Promise<PublicSiteConfig> {
  if (!isSupabaseConfigured || !supabase) {
    return DEFAULT_PUBLIC_SITE_CONFIG;
  }
  try {
    const { data, error } = await supabase
      .from('public_site_config')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();
    if (error) {
      if (isMissingTableError(error)) {
        hasPending007Migration = true;
      }
      console.warn('fetchPublicSiteConfig fallback:', error);
      return DEFAULT_PUBLIC_SITE_CONFIG;
    }
    return mapPublicSiteConfigRow(data as Record<string, unknown> | null);
  } catch (err) {
    console.warn('fetchPublicSiteConfig failed:', err);
    return DEFAULT_PUBLIC_SITE_CONFIG;
  }
}

export async function savePublicSiteConfig(
  uid: string,
  cfg: PublicSiteConfig
): Promise<void> {
  const payload = {
    id: 'main',
    owner_id: uid,
    hero_title: clip(cfg.heroTitle, 200),
    hero_subtitle: clip(cfg.heroSubtitle, 300),
    intro_bio: clip(cfg.introBio, 4000),
    background_text: clip(cfg.backgroundText, 4000),
    skills: sanitizeStringList(cfg.skills, 30, 100),
    interests: sanitizeStringList(cfg.interests, 30, 100),
    philosophy_text: clip(cfg.philosophyText, 4000),
    sections: (cfg.sections || []).slice(0, 20).map((s) => ({
      id: clip(s.id, 100),
      title: clip(s.title, 200),
      body: clip(s.body, 4000),
      visible: s.visible !== false,
    })),
    visibility_flags: {
      showHero: cfg.visibilityFlags?.showHero !== false,
      showBackground: cfg.visibilityFlags?.showBackground !== false,
      showSkills: cfg.visibilityFlags?.showSkills !== false,
      showInterests: cfg.visibilityFlags?.showInterests !== false,
      showPhilosophy: cfg.visibilityFlags?.showPhilosophy !== false,
      showCourses: cfg.visibilityFlags?.showCourses !== false,
      showPaths: cfg.visibilityFlags?.showPaths !== false,
      showBooks: cfg.visibilityFlags?.showBooks !== false,
      showReflections: cfg.visibilityFlags?.showReflections !== false,
      showBlogs: cfg.visibilityFlags?.showBlogs !== false,
      showQuotes: cfg.visibilityFlags?.showQuotes !== false,
      publicQuotes: sanitizePublicQuotesList(cfg.publicQuotes),
      pinnedPublicQuoteId: cfg.pinnedPublicQuoteId
        ? clip(String(cfg.pinnedPublicQuoteId), 128)
        : null,
      publicQuotesHeading: clip(
        cfg.publicQuotesHeading ||
          DEFAULT_PUBLIC_SITE_CONFIG.publicQuotesHeading ||
          'اقتباس اليوم ومختارات ملهمة',
        160
      ),
      creatorName: clip(cfg.creatorName || 'Ahmed Ibrahim', 120),
      linkedinUrl: sanitizeSafeHttpUrl(cfg.linkedinUrl),
      contactEmail: clip(cfg.contactEmail || '', 160),
      showContactForm: cfg.showContactForm !== false,
    },
    public_reflection_categories: sanitizeStringList(
      cfg.publicReflectionCategories ?? [],
      40,
      80
    ),
    updated_at_ms: Date.now(),
  };

  await runUpsertWith007Fallback('public_site_config', payload, 'id');
}

export function subscribePublicSiteConfig(
  onData: (cfg: PublicSiteConfig) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    onData(DEFAULT_PUBLIC_SITE_CONFIG);
    return () => {};
  }
  let disposed = false;
  const load = async () => {
    const cfg = await fetchPublicSiteConfig();
    if (!disposed) onData(cfg);
  };
  void load();

  const ch = supabase
    .channel(`public_site_config_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'public_site_config',
      },
      () => {
        if (!disposed) void load();
      }
    )
    .subscribe();

  return () => {
    disposed = true;
    if (supabase) {
      void supabase.removeChannel(ch);
    }
  };
}

export interface PublicCatalogData {
  courses: PersonalCourse[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  reflections: PersonalReflection[];
  blogPosts: BlogPost[];
}

export async function fetchPublicCatalog(
  publicReflectionCategories: string[] = []
): Promise<PublicCatalogData> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      courses: [],
      learningPaths: [],
      readingItems: [],
      reflections: [],
      blogPosts: [],
    };
  }
  try {
    const [coursesRes, pathsRes, booksRes, reflectionsRes, blogsRes] = await Promise.all([
      supabase
        .from('courses')
        .select('*')
        .eq('is_public', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('learning_paths')
        .select('*')
        .eq('is_public', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('reading_items')
        .select('*')
        .eq('is_public', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('reflections')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at_ms', { ascending: false }),
      supabase
        .from('blog_posts')
        .select('*')
        .eq('is_public', true)
        .order('pinned', { ascending: false })
        .order('created_at_ms', { ascending: false }),
    ]);

    if (
      isMissingColumnError(coursesRes.error) ||
      isMissingColumnError(pathsRes.error) ||
      isMissingColumnError(booksRes.error)
    ) {
      hasPending007Migration = true;
      return {
        courses: [],
        learningPaths: [],
        readingItems: [],
        reflections: [],
        blogPosts: [],
      };
    }

    if (isMissingTableError(blogsRes.error)) {
      hasPending010Migration = true;
    }

    const catSet = new Set(publicReflectionCategories.filter(Boolean));
    const rawReflections = reflectionsRes.error
      ? []
      : (reflectionsRes.data || []).map((r) =>
          mapReflectionRow(r as Record<string, unknown>)
        );
    const publicReflections = rawReflections.filter(
      (r) =>
        Boolean(r.isPublic) ||
        (Boolean(r.categoryTag) && catSet.has(r.categoryTag as string))
    );

    const publicBlogs = blogsRes.error
      ? []
      : (blogsRes.data || []).map((b) =>
          mapBlogPostRow(b as Record<string, unknown>)
        );

    return {
      courses: (coursesRes.data || []).map((r) =>
        mapCourseRow(r as Record<string, unknown>)
      ),
      learningPaths: (pathsRes.data || []).map((r) =>
        mapLearningPathRow(r as Record<string, unknown>)
      ),
      readingItems: (booksRes.data || []).map((r) =>
        mapReadingItemRow(r as Record<string, unknown>)
      ),
      reflections: publicReflections,
      blogPosts: publicBlogs,
    };
  } catch (err) {
    console.warn('fetchPublicCatalog failed:', err);
    return {
      courses: [],
      learningPaths: [],
      readingItems: [],
      reflections: [],
      blogPosts: [],
    };
  }
}

export async function fetchAllUserProfiles(): Promise<UserProfileItem[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await withFirebaseTokenRetry(async (c) =>
    c
      .from('user_profiles')
      .select('uid, display_name, email, photo_url, role, approval_status, created_at')
      .order('created_at', { ascending: false })
  );
  if (error) {
    console.error('fetchAllUserProfiles error:', error);
    throw new Error(formatSupabaseErrorMessage(error, 'تعذّر تحميل قائمة المستخدمين.'));
  }
  return (data || []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      uid: String(row.uid || ''),
      displayName: String(row.display_name || 'مستخدم'),
      email: String(row.email || ''),
      photoUrl: String(row.photo_url || ''),
      role: row.role === 'admin' ? 'admin' : 'user',
      approvalStatus:
        row.approval_status === 'approved' ||
        row.approval_status === 'rejected' ||
        row.approval_status === 'suspended'
          ? row.approval_status
          : 'pending',
      createdAt: row.created_at ? String(row.created_at) : undefined,
    };
  });
}

export async function updateUserProfileAccess(
  targetUid: string,
  updates: {
    role?: 'user' | 'admin';
    approvalStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.role) payload.role = updates.role;
  if (updates.approvalStatus) payload.approval_status = updates.approvalStatus;
  if (Object.keys(payload).length === 0) return;

  await runWrite((c) =>
    c.from('user_profiles').update(payload).eq('uid', targetUid)
  );
}

// ============================================================================
// Per-Account Granular Content Access Grants (RBAC)
// ============================================================================

const GRANT_META_MARKER = '\n<!--MIZAN_GRANT_META:';

function parseGrantMetaFromNotes(rawNotes: string): {
  cleanNotes: string;
  meta: {
    accessMode?: GrantAccessMode;
    allowUserNotes?: boolean;
    customAdditionTitle?: string;
    customAdditionBody?: string;
    blogIds?: string[];
  };
} {
  const idx = rawNotes.indexOf(GRANT_META_MARKER);
  if (idx === -1) {
    return { cleanNotes: rawNotes, meta: {} };
  }
  const cleanNotes = rawNotes.slice(0, idx);
  const rest = rawNotes.slice(idx + GRANT_META_MARKER.length);
  const endIdx = rest.indexOf('-->');
  const jsonPart = endIdx >= 0 ? rest.slice(0, endIdx) : rest;
  try {
    const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
    return {
      cleanNotes,
      meta: {
        accessMode:
          parsed.accessMode === 'can_annotate' ? 'can_annotate' : 'read_only',
        allowUserNotes: Boolean(parsed.allowUserNotes),
        customAdditionTitle:
          typeof parsed.customAdditionTitle === 'string'
            ? parsed.customAdditionTitle
            : '',
        customAdditionBody:
          typeof parsed.customAdditionBody === 'string'
            ? parsed.customAdditionBody
            : '',
        blogIds: sanitizeStringList(parsed.blogIds, 200, 160),
      },
    };
  } catch {
    return { cleanNotes, meta: {} };
  }
}

function mapContentGrantRow(raw: Record<string, unknown>): ContentAccessGrant {
  const { cleanNotes, meta } = parseGrantMetaFromNotes(
    String(raw.notes_for_user || '')
  );
  const accessMode: GrantAccessMode =
    raw.access_mode === 'can_annotate' ||
    raw.allow_user_notes === true ||
    meta.accessMode === 'can_annotate'
      ? 'can_annotate'
      : 'read_only';
  const allowUserNotes =
    typeof raw.allow_user_notes === 'boolean'
      ? raw.allow_user_notes
      : accessMode === 'can_annotate' || Boolean(meta.allowUserNotes);

  return {
    id: String(raw.id || ''),
    ownerId: String(raw.owner_id || ''),
    granteeUid: String(raw.grantee_uid || ''),
    granteeEmail: String(raw.grantee_email || ''),
    courseDocIds: sanitizeStringList(raw.course_doc_ids, 200, 160),
    includeCourseNotes: raw.include_course_notes !== false,
    noteIds: sanitizeStringList(raw.note_ids, 300, 160),
    pathIds: sanitizeStringList(raw.path_ids, 200, 160),
    bookIds: sanitizeStringList(raw.book_ids, 300, 160),
    reflectionIds: sanitizeStringList(raw.reflection_ids, 300, 160),
    reflectionCategories: sanitizeStringList(raw.reflection_categories, 60, 80),
    blogIds:
      Array.isArray(raw.blog_ids) && raw.blog_ids.length > 0
        ? sanitizeStringList(raw.blog_ids, 200, 160)
        : meta.blogIds ?? [],
    accessMode,
    allowUserNotes,
    customAdditionTitle:
      typeof raw.custom_addition_title === 'string' && raw.custom_addition_title
        ? raw.custom_addition_title
        : meta.customAdditionTitle ?? '',
    customAdditionBody:
      typeof raw.custom_addition_body === 'string' && raw.custom_addition_body
        ? raw.custom_addition_body
        : meta.customAdditionBody ?? '',
    notesForUser: cleanNotes,
    updatedAtMs: Number(raw.updated_at_ms ?? 0),
  };
}

export async function fetchAllContentGrants(
  ownerUid: string
): Promise<ContentAccessGrant[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await withFirebaseTokenRetry(async (c) =>
    c
      .from('content_access_grants')
      .select('*')
      .eq('owner_id', ownerUid)
      .order('updated_at_ms', { ascending: false })
  );
  if (error) {
    if (isMissingTableError(error)) {
      hasPending007Migration = true;
      return [];
    }
    throw new Error(formatSupabaseErrorMessage(error, 'تعذّر تحميل صلاحيات المحتوى.'));
  }
  return (data || []).map((r) => mapContentGrantRow(r as Record<string, unknown>));
}

export async function upsertContentAccessGrant(
  ownerUid: string,
  grant: Omit<ContentAccessGrant, 'id' | 'ownerId' | 'updatedAtMs'>
): Promise<ContentAccessGrant> {
  const grantId = sanitizeId(`${ownerUid}__${grant.granteeUid}`);
  const accessMode: GrantAccessMode =
    grant.accessMode === 'can_annotate' || grant.allowUserNotes
      ? 'can_annotate'
      : 'read_only';
  const allowUserNotes = accessMode === 'can_annotate';
  const cleanNotes = clip(grant.notesForUser, 1000);
  const customAdditionTitle = clip(grant.customAdditionTitle || '', 240);
  const customAdditionBody = clip(grant.customAdditionBody || '', 3000);
  const blogIds = sanitizeStringList(grant.blogIds ?? [], 200, 160);

  const basePayload = {
    id: grantId,
    owner_id: ownerUid,
    grantee_uid: clip(grant.granteeUid, 128),
    grantee_email: clip(grant.granteeEmail.trim().toLowerCase(), 200),
    course_doc_ids: sanitizeStringList(grant.courseDocIds, 200, 160),
    include_course_notes: grant.includeCourseNotes !== false,
    note_ids: sanitizeStringList(grant.noteIds, 300, 160),
    path_ids: sanitizeStringList(grant.pathIds, 200, 160),
    book_ids: sanitizeStringList(grant.bookIds, 300, 160),
    reflection_ids: sanitizeStringList(grant.reflectionIds, 300, 160),
    reflection_categories: sanitizeStringList(grant.reflectionCategories, 60, 80),
    notes_for_user: cleanNotes,
    updated_at_ms: Date.now(),
  };

  const fullPayload = {
    ...basePayload,
    blog_ids: blogIds,
    access_mode: accessMode,
    allow_user_notes: allowUserNotes,
    custom_addition_title: customAdditionTitle,
    custom_addition_body: customAdditionBody,
  };

  if (isSupabaseConfigured && supabase) {
    await withFirebaseTokenRetry(async (c) => {
      const { error } = await c
        .from('content_access_grants')
        .upsert(fullPayload, { onConflict: 'owner_id,grantee_uid' });
      if (!error) return;
      if (isMissingColumnError(error)) {
        hasPending011Migration = true;
        const metaPacked = JSON.stringify({
          accessMode,
          allowUserNotes,
          customAdditionTitle,
          customAdditionBody,
          blogIds,
        });
        const legacyPayload = {
          ...basePayload,
          notes_for_user: `${cleanNotes}${GRANT_META_MARKER}${metaPacked}-->`,
        };
        const { error: retryErr } = await c
          .from('content_access_grants')
          .upsert(legacyPayload, { onConflict: 'owner_id,grantee_uid' });
        if (retryErr) {
          throw new Error(formatSupabaseErrorMessage(retryErr));
        }
        return;
      }
      throw new Error(formatSupabaseErrorMessage(error));
    });
  }

  return mapContentGrantRow(fullPayload as unknown as Record<string, unknown>);
}

export async function deleteContentAccessGrant(
  ownerUid: string,
  granteeUid: string
): Promise<void> {
  await runWrite((c) =>
    c
      .from('content_access_grants')
      .delete()
      .eq('owner_id', ownerUid)
      .eq('grantee_uid', granteeUid)
  );
}

function mapGrantedItemNoteRow(raw: Record<string, unknown>): GrantedItemNote {
  const tRaw = String(raw.target_type || 'note');
  const targetType: GrantedItemNote['targetType'] =
    tRaw === 'course' ||
    tRaw === 'path' ||
    tRaw === 'book' ||
    tRaw === 'reflection'
      ? tRaw
      : 'note';
  return {
    id: String(raw.id || ''),
    ownerId: String(raw.owner_id || ''),
    authorUid: String(raw.author_uid || ''),
    authorEmail: String(raw.author_email || ''),
    authorName: String(raw.author_name || ''),
    targetType,
    targetId: String(raw.target_id || ''),
    content: String(raw.content || ''),
    isAdminReply: Boolean(raw.is_admin_reply),
    createdAtLabel: String(raw.created_at_label || ''),
    createdAtMs: Number(raw.created_at_ms ?? 0),
  };
}

export async function fetchGrantedItemNotesForOwner(
  ownerUid: string
): Promise<GrantedItemNote[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await withFirebaseTokenRetry(async (c) =>
    c
      .from('granted_item_notes')
      .select('*')
      .eq('owner_id', ownerUid)
      .order('created_at_ms', { ascending: false })
  );
  if (error) {
    if (isMissingTableError(error)) {
      hasPending011Migration = true;
      return [];
    }
    return [];
  }
  return (data || []).map((r) => mapGrantedItemNoteRow(r as Record<string, unknown>));
}

export async function addGrantedItemNote(
  note: Omit<GrantedItemNote, 'id'>
): Promise<GrantedItemNote> {
  const id = sanitizeId(`gnote_${note.createdAtMs || Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const payload = {
    id,
    owner_id: clip(note.ownerId, 128),
    author_uid: clip(note.authorUid, 128),
    author_email: clip(note.authorEmail, 200),
    author_name: clip(note.authorName, 120),
    target_type: note.targetType,
    target_id: clip(note.targetId, 160),
    content: clip(note.content, 4000),
    is_admin_reply: Boolean(note.isAdminReply),
    created_at_label: clip(note.createdAtLabel, 80),
    created_at_ms: Math.round(Number(note.createdAtMs) || Date.now()),
  };
  await runWrite((c) => c.from('granted_item_notes').insert(payload));
  return mapGrantedItemNoteRow(payload as unknown as Record<string, unknown>);
}

export async function deleteGrantedItemNote(noteId: string): Promise<void> {
  await runWrite((c) =>
    c.from('granted_item_notes').delete().eq('id', sanitizeId(noteId))
  );
}

export async function fetchGrantedWorkspaceForUser(
  user: User
): Promise<GrantedWorkspaceData> {
  const empty: GrantedWorkspaceData = {
    grants: [],
    courses: [],
    bookNotes: [],
    learningPaths: [],
    readingItems: [],
    reflections: [],
    blogPosts: [],
    itemNotes: [],
  };
  if (!isSupabaseConfigured || !supabase || !user?.uid) return empty;

  try {
    const { data: grantRows, error: grantErr } = await withFirebaseTokenRetry(async (c) =>
      c.from('content_access_grants').select('*')
    );
    if (grantErr || !grantRows || grantRows.length === 0) {
      return empty;
    }

    const grants = grantRows.map((r) => mapContentGrantRow(r as Record<string, unknown>));
    const grantedCourseDocSet = new Set<string>();
    const grantedNoteSet = new Set<string>();
    const grantedPathSet = new Set<string>();
    const grantedBookSet = new Set<string>();
    const grantedReflSet = new Set<string>();
    const grantedReflCatSet = new Set<string>();
    const grantedBlogSet = new Set<string>();
    let includeCourseNotesAny = false;

    for (const g of grants) {
      g.courseDocIds.forEach((id) => grantedCourseDocSet.add(id));
      g.noteIds.forEach((id) => grantedNoteSet.add(id));
      g.pathIds.forEach((id) => grantedPathSet.add(id));
      g.bookIds.forEach((id) => grantedBookSet.add(id));
      g.reflectionIds.forEach((id) => grantedReflSet.add(id));
      g.reflectionCategories.forEach((cat) => grantedReflCatSet.add(cat));
      (g.blogIds ?? []).forEach((id) => grantedBlogSet.add(id));
      if (g.includeCourseNotes) includeCourseNotesAny = true;
    }

    const [coursesRes, notesRes, pathsRes, booksRes, reflRes, blogsRes, itemNotesRes] =
      await Promise.all([
        grantedCourseDocSet.size > 0
          ? withFirebaseTokenRetry(async (c) =>
              c.from('courses').select('*').in('doc_id', Array.from(grantedCourseDocSet))
            )
          : Promise.resolve({ data: [], error: null }),
        grantedNoteSet.size > 0 || (includeCourseNotesAny && grantedCourseDocSet.size > 0)
          ? withFirebaseTokenRetry(async (c) => c.from('book_notes').select('*'))
          : Promise.resolve({ data: [], error: null }),
        grantedPathSet.size > 0
          ? withFirebaseTokenRetry(async (c) =>
              c.from('learning_paths').select('*').in('id', Array.from(grantedPathSet))
            )
          : Promise.resolve({ data: [], error: null }),
        grantedBookSet.size > 0
          ? withFirebaseTokenRetry(async (c) =>
              c.from('reading_items').select('*').in('id', Array.from(grantedBookSet))
            )
          : Promise.resolve({ data: [], error: null }),
        grantedReflSet.size > 0 || grantedReflCatSet.size > 0
          ? withFirebaseTokenRetry(async (c) =>
              c
                .from('reflections')
                .select('*')
                .order('pinned', { ascending: false })
                .order('created_at_ms', { ascending: false })
            )
          : Promise.resolve({ data: [], error: null }),
        grantedBlogSet.size > 0
          ? withFirebaseTokenRetry(async (c) =>
              c.from('blog_posts').select('*').in('id', Array.from(grantedBlogSet))
            )
          : Promise.resolve({ data: [], error: null }),
        withFirebaseTokenRetry(async (c) =>
          c
            .from('granted_item_notes')
            .select('*')
            .order('created_at_ms', { ascending: false })
        ),
      ]);

    const courses = (coursesRes.data || []).map((r) =>
      mapCourseRow(r as Record<string, unknown>)
    );
    const grantedCourseNumSet = new Set(courses.map((c) => c.id));
    const grantedCourseTitleSet = new Set(
      courses
        .map((c) => (c.title || '').trim().toLowerCase())
        .filter((t) => t.length > 0)
    );

    const bookNotes = (notesRes.data || [])
      .map((r) => mapBookNoteRow(r as Record<string, unknown>))
      .filter(
        (n) =>
          grantedNoteSet.has(n.id) ||
          (includeCourseNotesAny &&
            ((n.courseId && grantedCourseNumSet.has(n.courseId)) ||
              (n.courseTitle &&
                grantedCourseTitleSet.has(n.courseTitle.trim().toLowerCase()))))
      );

    const learningPaths = (pathsRes.data || []).map((r) =>
      mapLearningPathRow(r as Record<string, unknown>)
    );
    const readingItems = (booksRes.data || []).map((r) =>
      mapReadingItemRow(r as Record<string, unknown>)
    );
    const reflections = (reflRes.data || [])
      .map((r) => mapReflectionRow(r as Record<string, unknown>))
      .filter(
        (r) =>
          grantedReflSet.has(r.id) ||
          (Boolean(r.categoryTag) && grantedReflCatSet.has(r.categoryTag as string))
      );
    const blogPosts = (blogsRes.data || []).map((r) =>
      mapBlogPostRow(r as Record<string, unknown>)
    );
    const itemNotes =
      itemNotesRes.error || !itemNotesRes.data
        ? []
        : itemNotesRes.data.map((r) =>
            mapGrantedItemNoteRow(r as Record<string, unknown>)
          );

    return {
      grants,
      courses,
      bookNotes,
      learningPaths,
      readingItems,
      reflections,
      blogPosts,
      itemNotes,
    };
  } catch (err) {
    console.warn('fetchGrantedWorkspaceForUser fallback:', err);
    return empty;
  }
}

// ============================================================================
// Migration 012 Entities: Activity Logs, Daily Journals, Period Reviews,
// Weekly Plans, Saved Pin Collections & Contact Messages
// ============================================================================

function readLocalFallbackList<T>(uid: string, storeKey: string): T[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(`kb_${storeKey}_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFallbackList<T>(uid: string, storeKey: string, list: T[]): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`kb_${storeKey}_${uid}`, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

function upsertLocalFallbackItem<T>(
  uid: string,
  storeKey: string,
  item: T,
  getKey: (x: T) => string,
  maxItems = 500
): void {
  const existing = readLocalFallbackList<T>(uid, storeKey);
  const k = getKey(item);
  const next = [item, ...existing.filter((x) => getKey(x) !== k)].slice(0, maxItems);
  writeLocalFallbackList(uid, storeKey, next);
}

function removeLocalFallbackItem<T>(
  uid: string,
  storeKey: string,
  targetKey: string,
  getKey: (x: T) => string
): void {
  const existing = readLocalFallbackList<T>(uid, storeKey);
  writeLocalFallbackList(
    uid,
    storeKey,
    existing.filter((x) => getKey(x) !== targetKey)
  );
}

function mergeByKey<T>(
  remote: T[],
  local: T[],
  getKey: (x: T) => string,
  getTs: (x: T) => number
): T[] {
  const map = new Map<string, T>();
  for (const item of remote) {
    map.set(getKey(item), item);
  }
  for (const item of local) {
    const k = getKey(item);
    const prev = map.get(k);
    if (!prev || getTs(item) > getTs(prev)) {
      map.set(k, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => getTs(b) - getTs(a));
}

export function buildActivityLogRow(uid: string, log: ActivityLogEntry) {
  return {
    owner_id: uid,
    id: sanitizeId(log.id),
    date_key: sanitizeDateKeyOrEmpty(log.dateKey) || toLocalDateKey(),
    entity_type: clip(log.entityType, 40),
    entity_id: clip(log.entityId, 160),
    action: clip(log.action, 40),
    title: clip(log.title, 260),
    subtitle: clip(log.subtitle || '', 260),
    hub_id: log.hubId ? sanitizeHubId(log.hubId) : 'knowledge',
    status_snapshot: clip(log.statusSnapshot || '', 60),
    occurred_at_ms: Math.round(Number(log.occurredAtMs) || Date.now()),
  };
}

function mapActivityLogRow(raw: Record<string, unknown>): ActivityLogEntry {
  return {
    id: String(raw.id || ''),
    dateKey: String(raw.date_key || toLocalDateKey()),
    entityType: String(raw.entity_type || 'task') as ActivityEntityType,
    entityId: String(raw.entity_id || ''),
    action: String(raw.action || 'updated') as ActivityActionKind,
    title: String(raw.title || ''),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    hubId: raw.hub_id ? sanitizeHubId(raw.hub_id) : undefined,
    statusSnapshot: raw.status_snapshot ? String(raw.status_snapshot) : undefined,
    occurredAtMs: Number(raw.occurred_at_ms ?? 0),
  };
}

export async function saveActivityLogDoc(
  uid: string,
  entry: ActivityLogEntry
): Promise<void> {
  upsertLocalFallbackItem(uid, 'activity_logs', entry, (x) => x.id, 600);
  const row = buildActivityLogRow(uid, entry);
  try {
    await runQueuedUpsert({
      uid,
      table: 'activity_logs',
      keyCol: 'id',
      keyVal: row.id,
      onConflict: 'owner_id,id',
      row,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    console.warn('saveActivityLogDoc fallback kept locally:', err);
  }
}

export async function deleteActivityLogDoc(
  uid: string,
  entryId: string
): Promise<void> {
  removeLocalFallbackItem<ActivityLogEntry>(uid, 'activity_logs', entryId, (x) => x.id);
  const id = sanitizeId(entryId);
  try {
    await runQueuedDelete({ uid, table: 'activity_logs', keyCol: 'id', keyVal: id });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    console.warn('deleteActivityLogDoc fallback removed locally:', err);
  }
}

function sanitizeJournalSections(raw: unknown): JournalTextSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .slice(0, 30)
    .map((s, idx) => ({
      id: sanitizeId(typeof s.id === 'string' && s.id ? s.id : `jsec_${idx + 1}`),
      heading: clip(typeof s.heading === 'string' ? s.heading : '', 200),
      bodyHtml: clip(typeof s.bodyHtml === 'string' ? s.bodyHtml : '', 60000),
      updatedAtMs: Number(s.updatedAtMs ?? 0) || 0,
    }));
}

function sanitizeJournalQuickNotes(raw: unknown): JournalQuickNote[] {
  if (!Array.isArray(raw)) return [];
  const validKinds: JournalQuickNoteKind[] = [
    'thought',
    'learned',
    'remember',
    'event',
    'idea',
  ];
  return raw
    .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === 'object')
    .slice(0, 80)
    .map((n, idx) => ({
      id: sanitizeId(typeof n.id === 'string' && n.id ? n.id : `jqn_${idx + 1}`),
      kind: pickEnum(n.kind, validKinds, 'thought'),
      title: clip(typeof n.title === 'string' ? n.title : '', 200),
      body: clip(typeof n.body === 'string' ? n.body : '', 4000),
      createdAtMs: Number(n.createdAtMs ?? 0) || Date.now(),
      updatedAtMs: Number(n.updatedAtMs ?? 0) || Date.now(),
    }))
    .filter((n) => n.body.trim().length > 0 || (n.title ?? '').trim().length > 0);
}

function sanitizeJournalCardColor(raw: unknown): JournalCardColorKey {
  if (typeof raw === 'string' && raw in JOURNAL_CARD_THEMES) {
    return raw as JournalCardColorKey;
  }
  return 'default';
}

function sanitizeJournalQuote(
  raw: unknown,
  fallbackDateKey: string
): JournalQuoteMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const text = clip(typeof obj.text === 'string' ? obj.text : '', 600).trim();
  if (!text) return undefined;
  const dk =
    sanitizeDateKeyOrEmpty(obj.dateKey) ||
    sanitizeDateKeyOrEmpty(fallbackDateKey) ||
    toLocalDateKey();
  return {
    text,
    author: clip(typeof obj.author === 'string' ? obj.author : '', 120),
    theme: clip(typeof obj.theme === 'string' ? obj.theme : '', 80),
    dateKey: dk,
    savedAtMs:
      typeof obj.savedAtMs === 'number' && Number.isFinite(obj.savedAtMs)
        ? Math.round(obj.savedAtMs)
        : undefined,
  };
}

export function buildDailyJournalBaseRow(uid: string, rec: DailyJournalRecord) {
  return {
    owner_id: uid,
    date_key: sanitizeDateKeyOrEmpty(rec.dateKey) || toLocalDateKey(),
    reflection_text: clip(rec.reflectionText, 20000),
    highlights_text: clip(rec.highlightsText, 6000),
    mood_label: clip(rec.moodLabel || '', 60),
    energy_score:
      typeof rec.energyScore === 'number' && rec.energyScore >= 1 && rec.energyScore <= 5
        ? Math.round(rec.energyScore)
        : null,
    updated_at_ms: Math.round(Number(rec.updatedAtMs) || Date.now()),
  };
}

export function buildDailyJournal013Row(uid: string, rec: DailyJournalRecord) {
  return {
    ...buildDailyJournalBaseRow(uid, rec),
    title: clip(rec.title || '', 240),
    subtitle: clip(rec.subtitle || '', 400),
    body_html: clip(rec.bodyHtml || '', 80000),
    sections: sanitizeJournalSections(rec.sections),
    quick_notes: sanitizeJournalQuickNotes(rec.quickNotes),
    card_color: sanitizeJournalCardColor(rec.cardColor),
    cover_image_storage_path: clip(rec.coverImageStoragePath || '', 500),
    cover_image_url: sanitizeSafeHttpUrl(rec.coverImageUrl),
    cover_frame: rec.coverFrame ? sanitizeImageFrameSpec(rec.coverFrame) : null,
  };
}

export function buildDailyJournalRow(uid: string, rec: DailyJournalRecord) {
  const row013 = buildDailyJournal013Row(uid, rec);
  const cleanQuote = sanitizeJournalQuote(rec.dailyQuote, row013.date_key);
  return {
    ...row013,
    cover_storage_provider: resolveEffectiveStorageProvider(
      rec.coverStorageProvider,
      rec.coverImageStoragePath
    ),
    daily_quote: cleanQuote || null,
  };
}

function mapDailyJournalRow(raw: Record<string, unknown>): DailyJournalRecord {
  const dateKey = String(raw.date_key || toLocalDateKey());
  const coverImageStoragePath = raw.cover_image_storage_path
    ? String(raw.cover_image_storage_path)
    : undefined;
  return {
    dateKey,
    title: raw.title ? String(raw.title) : undefined,
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    bodyHtml: raw.body_html ? String(raw.body_html) : undefined,
    sections: Array.isArray(raw.sections)
      ? sanitizeJournalSections(raw.sections)
      : undefined,
    quickNotes: Array.isArray(raw.quick_notes)
      ? sanitizeJournalQuickNotes(raw.quick_notes)
      : undefined,
    cardColor: sanitizeJournalCardColor(raw.card_color),
    coverImageStoragePath,
    coverStorageProvider: resolveEffectiveStorageProvider(
      raw.cover_storage_provider
        ? String(raw.cover_storage_provider)
        : undefined,
      coverImageStoragePath
    ),
    coverImageUrl: raw.cover_image_url ? String(raw.cover_image_url) : undefined,
    coverFrame:
      raw.cover_frame && typeof raw.cover_frame === 'object'
        ? sanitizeImageFrameSpec(raw.cover_frame)
        : undefined,
    dailyQuote: sanitizeJournalQuote(raw.daily_quote, dateKey),
    reflectionText: String(raw.reflection_text || ''),
    highlightsText: String(raw.highlights_text || ''),
    moodLabel: raw.mood_label ? String(raw.mood_label) : undefined,
    energyScore:
      typeof raw.energy_score === 'number' ? raw.energy_score : undefined,
    updatedAtMs: Number(raw.updated_at_ms ?? 0),
  };
}

export async function saveDailyJournalDoc(
  uid: string,
  rec: DailyJournalRecord
): Promise<void> {
  upsertLocalFallbackItem(uid, 'daily_journals', rec, (x) => x.dateKey, 500);
  const fullRow = buildDailyJournalRow(uid, rec);
  if (!isAppOnline() || !isSupabaseConfigured || !supabase) {
    enqueueSupabaseUpsert(uid, {
      table: 'daily_journals',
      keyCol: 'date_key',
      keyVal: fullRow.date_key,
      onConflict: 'owner_id,date_key',
      row: fullRow,
    });
    return;
  }
  try {
    await runWrite((c) =>
      c.from('daily_journals').upsert(fullRow, { onConflict: 'owner_id,date_key' })
    );
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      enqueueSupabaseUpsert(uid, {
        table: 'daily_journals',
        keyCol: 'date_key',
        keyVal: fullRow.date_key,
        onConflict: 'owner_id,date_key',
        row: fullRow,
      });
      return;
    }
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    if (isMissingColumnError(err)) {
      // First try stripping only migration 020 cover_storage_provider (keeping daily_quote!)
      const rowWithout020 = stripColumns(fullRow, ['cover_storage_provider']);
      try {
        await runWrite((c) =>
          c
            .from('daily_journals')
            .upsert(rowWithout020, { onConflict: 'owner_id,date_key' })
        );
        return;
      } catch (err020) {
        if (!isMissingColumnError(err020)) throw err020;
      }
      hasPending014Migration = true;
      const row013 = buildDailyJournal013Row(uid, rec);
      try {
        await runWrite((c) =>
          c.from('daily_journals').upsert(row013, { onConflict: 'owner_id,date_key' })
        );
        return;
      } catch (err2) {
        if (isMissingColumnError(err2)) {
          hasPending013Migration = true;
          const baseRow = buildDailyJournalBaseRow(uid, rec);
          await runWrite((c) =>
            c.from('daily_journals').upsert(baseRow, { onConflict: 'owner_id,date_key' })
          );
          return;
        }
        throw err2;
      }
    }
    throw err;
  }
}

export function buildPeriodReviewRow(uid: string, rev: PeriodReviewRecord) {
  return {
    owner_id: uid,
    id: sanitizeId(rev.id || `${rev.periodType}_${rev.periodKey}`),
    period_type: pickEnum(
      rev.periodType,
      ['weekly', 'monthly', 'quarterly', 'yearly'] as const,
      'weekly'
    ),
    period_key: clip(rev.periodKey, 40),
    period_start_key: sanitizeDateKeyOrEmpty(rev.periodStartKey),
    period_end_key: sanitizeDateKeyOrEmpty(rev.periodEndKey),
    reflection_text: clip(rev.reflectionText, 25000),
    adjustments_text: clip(rev.adjustmentsText, 12000),
    next_period_focus_text: clip(rev.nextPeriodFocusText, 12000),
    rating:
      typeof rev.rating === 'number' && rev.rating >= 1 && rev.rating <= 5
        ? Math.round(rev.rating)
        : null,
    updated_at_ms: Math.round(Number(rev.updatedAtMs) || Date.now()),
  };
}

function mapPeriodReviewRow(raw: Record<string, unknown>): PeriodReviewRecord {
  const pt = String(raw.period_type || 'weekly');
  const periodType: PeriodReviewType =
    pt === 'monthly' || pt === 'quarterly' || pt === 'yearly' ? pt : 'weekly';
  return {
    id: String(raw.id || `${periodType}_${String(raw.period_key || '')}`),
    periodType,
    periodKey: String(raw.period_key || ''),
    periodStartKey: String(raw.period_start_key || ''),
    periodEndKey: String(raw.period_end_key || ''),
    reflectionText: String(raw.reflection_text || ''),
    adjustmentsText: String(raw.adjustments_text || ''),
    nextPeriodFocusText: String(raw.next_period_focus_text || ''),
    rating: typeof raw.rating === 'number' ? raw.rating : undefined,
    updatedAtMs: Number(raw.updated_at_ms ?? 0),
  };
}

export async function savePeriodReviewDoc(
  uid: string,
  rev: PeriodReviewRecord
): Promise<void> {
  upsertLocalFallbackItem(uid, 'period_reviews', rev, (x) => x.id, 300);
  const row = buildPeriodReviewRow(uid, rev);
  try {
    await runQueuedUpsert({
      uid,
      table: 'period_reviews',
      keyCol: 'id',
      keyVal: row.id,
      onConflict: 'owner_id,id',
      row,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    throw err;
  }
}

export function buildWeeklyPlanRow(uid: string, plan: WeeklyPlanRecord) {
  const range = getSatFriWeekRange(plan.weekStartKey || plan.weekKey);
  return {
    owner_id: uid,
    week_key: range.weekKey,
    week_start_key: range.startKey,
    week_end_key: range.endKey,
    focus_hub_ids: (Array.isArray(plan.focusHubIds) ? plan.focusHubIds : [])
      .map((h) => sanitizeHubId(h))
      .slice(0, 12),
    focus_course_ids: (Array.isArray(plan.focusCourseIds) ? plan.focusCourseIds : [])
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 20),
    linked_task_ids: sanitizeStringList(plan.linkedTaskIds || [], 120, 128),
    goals: (Array.isArray(plan.goals) ? plan.goals : []).slice(0, 30).map((g: WeeklyPlanGoal) => ({
      id: clip(g.id, 128),
      text: clip(g.text, 400),
      ...(g.hubId ? { hubId: sanitizeHubId(g.hubId) } : {}),
      done: Boolean(g.done),
    })),
    notes: clip(plan.notes || '', 12000),
    planned_at_ms: Math.round(Number(plan.plannedAtMs) || Date.now()),
    updated_at_ms: Math.round(Number(plan.updatedAtMs) || Date.now()),
  };
}

function mapWeeklyPlanRow(raw: Record<string, unknown>): WeeklyPlanRecord {
  const range = getSatFriWeekRange(String(raw.week_start_key || raw.week_key || ''));
  return {
    weekKey: String(raw.week_key || range.weekKey),
    weekStartKey: String(raw.week_start_key || range.startKey),
    weekEndKey: String(raw.week_end_key || range.endKey),
    focusHubIds: Array.isArray(raw.focus_hub_ids)
      ? raw.focus_hub_ids.map((h) => sanitizeHubId(h))
      : [],
    focusCourseIds: Array.isArray(raw.focus_course_ids)
      ? raw.focus_course_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
      : [],
    linkedTaskIds: Array.isArray(raw.linked_task_ids)
      ? raw.linked_task_ids.map((s) => String(s))
      : [],
    goals: Array.isArray(raw.goals) ? (raw.goals as WeeklyPlanGoal[]) : [],
    notes: String(raw.notes || ''),
    plannedAtMs: Number(raw.planned_at_ms ?? 0),
    updatedAtMs: Number(raw.updated_at_ms ?? 0),
  };
}

export async function saveWeeklyPlanDoc(
  uid: string,
  plan: WeeklyPlanRecord
): Promise<void> {
  upsertLocalFallbackItem(uid, 'weekly_plans', plan, (x) => x.weekKey, 150);
  const row = buildWeeklyPlanRow(uid, plan);
  try {
    await runQueuedUpsert({
      uid,
      table: 'weekly_plans',
      keyCol: 'week_key',
      keyVal: row.week_key,
      onConflict: 'owner_id,week_key',
      row,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    throw err;
  }
}

export function buildPinCollectionRow(uid: string, col: PinCollection) {
  const validTypes: PinEntityType[] = ['course', 'note', 'path', 'task', 'project'];
  const items = (Array.isArray(col.items) ? col.items : [])
    .filter((it): it is PinCollectionItem => Boolean(it && it.entityId))
    .slice(0, 200)
    .map((it) => ({
      entityType: validTypes.includes(it.entityType) ? it.entityType : 'course',
      entityId: clip(String(it.entityId), 160),
      addedAtMs: Math.round(Number(it.addedAtMs) || Date.now()),
    }));

  return {
    owner_id: uid,
    id: sanitizeId(col.id),
    title: clip(col.title, 120),
    description: clip(col.description || '', 400),
    color_key: sanitizeNoteColor(col.colorKey),
    sort_order: Math.max(0, Math.round(Number(col.sortOrder) || 0)),
    items,
    created_at_ms: Math.round(Number(col.createdAtMs) || Date.now()),
    updated_at_ms: Math.round(Number(col.updatedAtMs) || Date.now()),
  };
}

function mapPinCollectionRow(raw: Record<string, unknown>): PinCollection {
  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    description: raw.description ? String(raw.description) : undefined,
    colorKey: sanitizeNoteColor(raw.color_key),
    sortOrder: Number(raw.sort_order ?? 0),
    items: Array.isArray(raw.items) ? (raw.items as PinCollectionItem[]) : [],
    createdAtMs: Number(raw.created_at_ms ?? 0),
    updatedAtMs: Number(raw.updated_at_ms ?? 0),
  };
}

export async function savePinCollectionDoc(
  uid: string,
  col: PinCollection
): Promise<void> {
  upsertLocalFallbackItem(uid, 'pin_collections', col, (x) => x.id, 100);
  const row = buildPinCollectionRow(uid, col);
  try {
    await runQueuedUpsert({
      uid,
      table: 'pin_collections',
      keyCol: 'id',
      keyVal: row.id,
      onConflict: 'owner_id,id',
      row,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    throw err;
  }
}

export async function deletePinCollectionDoc(
  uid: string,
  colId: string
): Promise<void> {
  removeLocalFallbackItem<PinCollection>(uid, 'pin_collections', colId, (x) => x.id);
  const id = sanitizeId(colId);
  try {
    await runQueuedDelete({ uid, table: 'pin_collections', keyCol: 'id', keyVal: id });
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    throw err;
  }
}

const CONTACT_LOCAL_STORE_KEY = 'kb_contact_messages_local';

function mapContactMessageRow(raw: Record<string, unknown>): ContactMessageRecord {
  const st = String(raw.status || 'unread');
  return {
    id: String(raw.id || ''),
    senderName: String(raw.sender_name || ''),
    senderEmail: String(raw.sender_email || ''),
    subject: String(raw.subject || ''),
    message: String(raw.message || ''),
    status: st === 'read' || st === 'archived' ? st : 'unread',
    createdAtMs: Number(raw.created_at_ms ?? 0),
  };
}

export function saveContactMessageLocalFallback(msg: ContactMessageRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CONTACT_LOCAL_STORE_KEY);
    const list: ContactMessageRecord[] = raw ? JSON.parse(raw) : [];
    const next = [msg, ...list.filter((x) => x.id !== msg.id)].slice(0, 100);
    window.localStorage.setItem(CONTACT_LOCAL_STORE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function fetchContactMessages(): Promise<ContactMessageRecord[]> {
  let local: ContactMessageRecord[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CONTACT_LOCAL_STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) local = parsed as ContactMessageRecord[];
    } catch {
      local = [];
    }
  }
  if (!isSupabaseConfigured || !supabase) return local;
  try {
    const { data, error } = await withFirebaseTokenRetry(async (c) =>
      c
        .from('contact_messages')
        .select('*')
        .order('created_at_ms', { ascending: false })
        .limit(200)
    );
    if (error) {
      if (isMissingTableError(error)) {
        hasPending012Migration = true;
      }
      return local;
    }
    const remote = (data || []).map((r) =>
      mapContactMessageRow(r as Record<string, unknown>)
    );
    return mergeByKey(remote, local, (x) => x.id, (x) => x.createdAtMs);
  } catch {
    return local;
  }
}

export async function updateContactMessageStatus(
  id: string,
  status: ContactMessageRecord['status']
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CONTACT_LOCAL_STORE_KEY);
      const list: ContactMessageRecord[] = raw ? JSON.parse(raw) : [];
      const next = list.map((m) => (m.id === id ? { ...m, status } : m));
      window.localStorage.setItem(CONTACT_LOCAL_STORE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await runWrite((c) =>
      c.from('contact_messages').update({ status }).eq('id', sanitizeId(id))
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    throw err;
  }
}

export async function deleteContactMessage(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CONTACT_LOCAL_STORE_KEY);
      const list: ContactMessageRecord[] = raw ? JSON.parse(raw) : [];
      window.localStorage.setItem(
        CONTACT_LOCAL_STORE_KEY,
        JSON.stringify(list.filter((m) => m.id !== id))
      );
    } catch {
      // ignore
    }
  }
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await runWrite((c) =>
      c.from('contact_messages').delete().eq('id', sanitizeId(id))
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      hasPending012Migration = true;
      return;
    }
    throw err;
  }
}
