export type DomainId = string;

export type LearningHubId = string;

export type ReadingMode = string;

export interface ReadingModeMeta {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

export type CourseStudyStage =
  | 'focus_now'
  | 'in_progress'
  | 'scheduled_later'
  | 'deferred'
  | 'heard_before'
  | 'completed';

export const COURSE_STUDY_STAGES_META: Array<{
  id: CourseStudyStage;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
}> = [
  {
    id: 'focus_now',
    label: 'أركّز عليه الآن',
    shortLabel: 'تركيز الآن',
    description: 'ضمن الكورسات المحددة للتركيز المكثف هذا الشهر.',
    badgeClass: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
  },
  {
    id: 'in_progress',
    label: 'قيد الدراسة',
    shortLabel: 'قيد الدراسة',
    description: 'كورس نشط ومفتوح للتعلم المتدرج.',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  {
    id: 'scheduled_later',
    label: 'مجدول لوقت آخر',
    shortLabel: 'مجدول لاحقًا',
    description: 'مخطط لدراسته في فترة قادمة بدون استعجال الآن.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  {
    id: 'deferred',
    label: 'مؤجّل حاليًا',
    shortLabel: 'مؤجّل',
    description: 'مؤقتًا على الرف حتى تفرغ الأولويات الحالية.',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  {
    id: 'heard_before',
    label: 'تم سماعه سابقًا',
    shortLabel: 'مسموع سابقًا',
    description: 'مررت عليه من قبل وجاهز للمراجعة أو الاستخلاص.',
    badgeClass: 'bg-violet-50 text-violet-900 border-violet-200',
  },
  {
    id: 'completed',
    label: 'مكتمل',
    shortLabel: 'مكتمل',
    description: 'أتممت دراسته وتطبيقه العملي.',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
];

export function resolveCourseStudyStage(c: {
  studyStage?: CourseStudyStage;
  completed?: boolean;
}): CourseStudyStage {
  if (c.studyStage) return c.studyStage;
  return c.completed ? 'completed' : 'in_progress';
}

export function getCourseStageMeta(stage: CourseStudyStage) {
  return (
    COURSE_STUDY_STAGES_META.find((s) => s.id === stage) ??
    COURSE_STUDY_STAGES_META[1]
  );
}

export type NoteColorKey =
  | 'default'
  | 'navy'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet';

export const NOTE_COLOR_THEMES: Record<
  NoteColorKey,
  {
    label: string;
    cardClass: string;
    accentBarClass: string;
    swatchClass: string;
  }
> = {
  default: {
    label: 'افتراضي',
    cardClass: 'bg-white border-slate-200',
    accentBarClass: 'bg-slate-200',
    swatchClass: 'bg-white border-slate-300',
  },
  navy: {
    label: 'أزرق داكن',
    cardClass: 'bg-[#F4F7FB] border-[#1E3A5F]/25',
    accentBarClass: 'bg-[#1E3A5F]',
    swatchClass: 'bg-[#1E3A5F] border-[#1E3A5F]',
  },
  emerald: {
    label: 'زمردي',
    cardClass: 'bg-emerald-50/45 border-emerald-200',
    accentBarClass: 'bg-emerald-600',
    swatchClass: 'bg-emerald-600 border-emerald-700',
  },
  amber: {
    label: 'عنبري',
    cardClass: 'bg-amber-50/55 border-amber-200',
    accentBarClass: 'bg-amber-500',
    swatchClass: 'bg-amber-400 border-amber-500',
  },
  rose: {
    label: 'وردي',
    cardClass: 'bg-rose-50/50 border-rose-200',
    accentBarClass: 'bg-rose-500',
    swatchClass: 'bg-rose-500 border-rose-600',
  },
  violet: {
    label: 'بنفسجي',
    cardClass: 'bg-violet-50/50 border-violet-200',
    accentBarClass: 'bg-violet-600',
    swatchClass: 'bg-violet-600 border-violet-700',
  },
};

export type DentalCaseStatus = 'in_progress' | 'follow_up' | 'completed';

export interface DentalCase {
  id: string;
  title: string;
  specialty: string;
  patientSummary: string;
  procedureDetails: string;
  caseDate: string;
  status: DentalCaseStatus;
  coverImageUrl?: string;
  coverStoragePath?: string;
  coverDataUrl?: string;
  linkedCourseId?: number;
  updatedAtLabel?: string;
}

export interface LearningHubMeta {
  id: LearningHubId;
  title: string;
  shortTitle: string;
  englishTitle: string;
  purpose: string;
  accentHex: string;
  badgeClass: string;
  defaultCategories: string[];
}

export interface HubAccentPreset {
  id: string;
  label: string;
  accentHex: string;
  badgeClass: string;
}

export const HUB_ACCENT_PRESETS: HubAccentPreset[] = [
  {
    id: 'amber',
    label: 'عنبري',
    accentHex: '#B45309',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  {
    id: 'emerald',
    label: 'زمردي',
    accentHex: '#047857',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  {
    id: 'navy',
    label: 'كحلي',
    accentHex: '#1E3A5F',
    badgeClass: 'bg-slate-100 text-[#1E3A5F] border-slate-300',
  },
  {
    id: 'indigo',
    label: 'نيلي',
    accentHex: '#4338CA',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  },
  {
    id: 'teal',
    label: 'بترولي',
    accentHex: '#0F766E',
    badgeClass: 'bg-teal-50 text-teal-900 border-teal-200',
  },
  {
    id: 'rose',
    label: 'توتي',
    accentHex: '#BE123C',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-200',
  },
];

export const DEFAULT_LEARNING_HUBS: LearningHubMeta[] = [
  {
    id: 'marketing',
    title: 'الماركتينج والأعمال',
    shortTitle: 'الماركتينج',
    englishTitle: 'Marketing & Business',
    purpose:
      'إدارة تعليم التسويق الرقمي، كتابة المحتوى، الإعلانات الممولة، الاستراتيجية، وريادة الأعمال.',
    accentHex: '#B45309',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    defaultCategories: [
      'أساسيات التسويق (Marketing Fundamentals)',
      'التسويق الرقمي (Digital Marketing)',
      'السوشيال ميديا (Social Media Marketing)',
      'تسويق المحتوى (Content Marketing)',
      'كتابة المحتوى والإعلانات (Copywriting)',
      'تحسين محركات البحث (SEO)',
      'إعلانات ميتا (Meta Advertising)',
      'استراتيجية التسويق (Marketing Strategy)',
      'الأعمال وريادة الأعمال (Business & Entrepreneurship)',
    ],
  },
  {
    id: 'dental_career',
    title: 'الدنتال والكارير والتطوير المهني',
    shortTitle: 'الدنتال والكارير',
    englishTitle: 'Career & Dental Development',
    purpose:
      'إدارة التعليم الطبي لطب الأسنان، المهارات الإكلينيكية، التصميم والتقنية، والقيادة والمشاريع المهنية.',
    accentHex: '#047857',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    defaultCategories: [
      'طب الأسنان والتطوير الإكلينيكي (Dentistry & Clinical)',
      'علاج الجذور (Endodontics)',
      'العلاج التحفظي (Operative Dentistry)',
      'التركيبات الثابتة (Fixed Prosthodontics)',
      'جراحة الفم (Oral Surgery)',
      'تصميم UI/UX (UI/UX Design)',
      'التكنولوجيا (Technology)',
      'مهارات التواصل (Communication Skills)',
      'القيادة والإدارة (Leadership & Management)',
      'المشاريع المهنية (Professional Projects)',
    ],
  },
  {
    id: 'knowledge',
    title: 'الثقافة والمعرفة والتطوير الشخصي',
    shortTitle: 'المعرفة والثقافة',
    englishTitle: 'Intellectual & Personal Development',
    purpose:
      'منظومة البناء المعرفي والفكري، خطة الـ 12 شهرًا، العلوم الشرعية والفلسفة والتاريخ وعلم النفس والأدب.',
    accentHex: '#1E3A5F',
    badgeClass: 'bg-slate-100 text-[#1E3A5F] border-slate-300',
    defaultCategories: [
      'الدراسات الإسلامية (Islamic Studies)',
      'الفلسفة والفكر (Philosophy & Thought)',
      'التاريخ والحضارة (History & Civilization)',
      'علم النفس (Psychology)',
      'التفكير النقدي (Critical Thinking)',
      'الإنسانيات (Humanities)',
      'القراءة والأدب (Reading & Literature)',
      'المعرفة العامة (General Knowledge)',
      'التطوير الشخصي (Personal Development)',
    ],
  },
];

// Active synchronized hubs array (mutated safely via setActiveLearningHubs so
// every module reading LEARNING_HUBS sees edited/4th+ hubs automatically)
export const LEARNING_HUBS: LearningHubMeta[] = DEFAULT_LEARNING_HUBS.map((h) => ({
  ...h,
  defaultCategories: [...h.defaultCategories],
}));

export const READING_MODES_META: ReadingModeMeta[] = [
  {
    id: 'surface',
    label: 'قراءة سطحية',
    shortLabel: 'سطحية',
    description: 'تصفح أولي وسريع لاستكشاف الفكرة العامة والانطباع المبدئي.',
  },
  {
    id: 'survey',
    label: 'قراءة مسح',
    shortLabel: 'مسح',
    description: 'عملية مسح منظمة للفهرس والعناوين الرئيسية والخلاصات.',
  },
  {
    id: 'deep',
    label: 'قراءة عميقة',
    shortLabel: 'عميقة',
    description: 'قراءة فاحصة وتحليلية للأدلة والمفاهيم والتفاصيل الدقيقة.',
  },
  {
    id: 'applied',
    label: 'قراءة تطبيقية',
    shortLabel: 'تطبيقية',
    description: 'استخراج خطوات عملية وربط المعرفة بمشاريع ومهام واقعية.',
  },
  {
    id: 'breakdown',
    label: 'قراءة تكسير',
    shortLabel: 'تكسير',
    description: 'تفكيك المادة المعقدة لأجزاء صغيرة وإعادة صياغتها وتكرارها.',
  },
];

export const DEFAULT_LEARNING_METHODS: string[] = [
  'استماع متكرر',
  'تلخيص مكتوب',
  'تطبيق عملي',
  'بطاقات استرجاع',
  'خرائط ذهنية',
  'مناقشة وتعليم',
];

export const SPACED_REPETITION_INTERVALS = [1, 3, 7, 14, 30, 60];

export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveLearningHubs(
  customHubs?: LearningHubMeta[]
): LearningHubMeta[] {
  if (Array.isArray(customHubs) && customHubs.length > 0) {
    return customHubs.map((h) => ({
      ...h,
      defaultCategories: Array.isArray(h.defaultCategories)
        ? [...h.defaultCategories]
        : [],
    }));
  }
  return DEFAULT_LEARNING_HUBS.map((h) => ({
    ...h,
    defaultCategories: [...h.defaultCategories],
  }));
}

export function setActiveLearningHubs(customHubs?: LearningHubMeta[]) {
  const next = resolveLearningHubs(customHubs);
  LEARNING_HUBS.splice(0, LEARNING_HUBS.length, ...next);
}

export function getHubMeta(
  hubId?: LearningHubId,
  hubsOverride?: LearningHubMeta[]
): LearningHubMeta {
  const list = hubsOverride && hubsOverride.length > 0 ? hubsOverride : LEARNING_HUBS;
  return (
    list.find((h) => h.id === hubId) ??
    DEFAULT_LEARNING_HUBS.find((h) => h.id === hubId) ??
    list[list.length - 1] ??
    DEFAULT_LEARNING_HUBS[2]
  );
}

export type MonthStatus = 'not_started' | 'in_progress' | 'completed';

export type ResourceFormat = 'كتاب' | 'سلسلة محاضرات' | 'كتاب + محاضرات';

export interface QuarterInfo {
  id: string;
  number: number;
  title: string;
  subtitle: string;
}

export interface SmallTask {
  id: string;
  text: string;
  track: 'foundational' | 'exploratory' | 'action';
  done: boolean;
  custom?: boolean;
}

export interface StudyResource {
  id: string;
  title: string;
  type:
    | 'كتاب'
    | 'سلسلة محاضرات'
    | 'مقال / مدخل'
    | 'أداة تطبيق'
    | 'ملف / مستند'
    | 'رابط خارجي';
  note: string;
  searchQuery: string;
  externalUrl?: string;
  attachmentName?: string;
  extractedPreview?: string;
  storagePath?: string;
  downloadUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  custom?: boolean;
}

export interface TrackItem {
  title: string;
  author: string;
  format: ResourceFormat;
  domainId: DomainId;
  pace: string;
  focus: string;
}

export interface MonthActivities {
  reading: boolean;
  listening: boolean;
  summarizing: boolean;
  discussing: boolean;
}

export interface MonthPlan {
  id: number;
  docId?: string;
  hubId?: LearningHubId;
  quarter: number;
  quarterTitle: string;
  theme: string;
  foundational: TrackItem;
  exploratory: TrackItem;
  courseId: number;
  discussionPrompt: string;
  applicationTask: string;
  activities: MonthActivities;
  status: MonthStatus;
  notes: string;
  tasks: SmallTask[];
  resources: StudyResource[];
  readingModes?: ReadingMode[];
  learningMethods?: string[];
  reviewCount?: number;
  listenCount?: number;
  repetitionStage?: number;
  nextReviewDateKey?: string;
  lastReviewedDateKey?: string;
}

export interface ThinkerInfo {
  name: string;
  role: string;
  keyWorks: string[];
  contribution: string;
}

export interface DomainInfo {
  id: DomainId;
  order?: number;
  hubId?: LearningHubId;
  title: string;
  subtitle: string;
  purpose: string;
  thinkers: ThinkerInfo[];
}

export interface LearningObjective {
  id: string;
  text: string;
  achieved: boolean;
  createdAt?: string;
}

export interface PersonalCourse {
  id: number;
  docId?: string;
  hubId?: LearningHubId;
  title: string;
  category: string;
  instructor?: string;
  platform?: string;
  durationLabel?: string;
  startDate?: string;
  targetDate?: string;
  progressPct?: number;
  notes?: string;
  linkedMonths: number[];
  complementaryBook: string;
  bookAuthor: string;
  applicationMilestone: string;
  completed: boolean;
  studyStage?: CourseStudyStage;
  scheduledPeriod?: string;
  learningObjectives?: LearningObjective[];
  sortOrder?: number;
  isPublic?: boolean;
  resources: StudyResource[];
  tasks: SmallTask[];
  readingModes?: ReadingMode[];
  learningMethods?: string[];
  reviewCount?: number;
  listenCount?: number;
  repetitionStage?: number;
  nextReviewDateKey?: string;
  lastReviewedDateKey?: string;
}

export type NoteCategoryType = 'book' | 'course_lecture' | 'general';

export interface BookNote {
  id: string;
  hubId?: LearningHubId;
  noteType?: NoteCategoryType;
  noteColor?: NoteColorKey;
  bookTitle: string;
  author: string;
  courseId?: number;
  courseTitle?: string;
  lectureTitle?: string;
  categoryLabel?: string;
  progressMarker: string;
  content: string;
  quotes: string;
  updatedAt: string;
  resources?: StudyResource[];
  sortOrder?: number;
  createdAtMs?: number;
  readingModes?: ReadingMode[];
  learningMethods?: string[];
  reviewCount?: number;
  listenCount?: number;
  repetitionStage?: number;
  nextReviewDateKey?: string;
  lastReviewedDateKey?: string;
}

export interface CustomCategory {
  id: string;
  hubId?: LearningHubId | 'all';
  title: string;
  description: string;
  color: 'navy' | 'emerald' | 'amber' | 'slate';
  createdAtLabel: string;
}

export interface LearningPathStage {
  id: string;
  title: string;
  done: boolean;
  notes?: string;
}

export type LearningPathStatus = 'planned' | 'in_progress' | 'completed';

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  hubId: LearningHubId;
  categoryLabel: string;
  objectives: string;
  learningObjectives?: LearningObjective[];
  sortOrder?: number;
  isPublic?: boolean;
  currentLevel: string;
  targetLevel: string;
  startDate: string;
  expectedCompletionDate: string;
  progressPct: number;
  status: LearningPathStatus;
  stages: LearningPathStage[];
  linkedCourseIds: number[];
  readingModes?: ReadingMode[];
  learningMethods?: string[];
  reviewCount?: number;
  listenCount?: number;
}

export type ReadingItemType =
  | 'كتاب'
  | 'مقال'
  | 'بحث'
  | 'ورقة علمية'
  | 'ملف PDF'
  | 'ملخص';

export type ReadingItemStatus = 'to_read' | 'reading' | 'completed';

export interface ReadingLibraryItem {
  id: string;
  title: string;
  author: string;
  hubId: LearningHubId;
  categoryLabel: string;
  itemType: ReadingItemType;
  status: ReadingItemStatus;
  currentPage: number;
  totalPages: number;
  takeaways: string;
  learningObjectives?: LearningObjective[];
  sortOrder?: number;
  isPublic?: boolean;
  attachmentName?: string;
  attachmentResourceId?: string;
  storagePath?: string;
  downloadUrl?: string;
  externalUrl?: string;
  readingModes: ReadingMode[];
  learningMethods: string[];
  reviewCount: number;
  listenCount: number;
  repetitionStage: number;
  nextReviewDateKey?: string;
  lastReviewedDateKey?: string;
  updatedAtLabel: string;
}

export type ProjectStatus = 'planned' | 'in_progress' | 'completed';

export interface PracticalProject {
  id: string;
  title: string;
  description: string;
  hubId: LearningHubId;
  categoryLabel: string;
  objectives: string;
  status: ProjectStatus;
  progressPct: number;
  deliverables: string;
  startDate: string;
  targetDate: string;
  linkedCourseId?: number;
  notes: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type UnifiedTaskStatus = 'todo' | 'in_progress' | 'postponed' | 'done';

export const DEFAULT_TASK_STATUS_ORDER: UnifiedTaskStatus[] = [
  'in_progress',
  'todo',
  'postponed',
  'done',
];

export function sanitizeTaskStatusOrder(raw: unknown): UnifiedTaskStatus[] {
  const valid: UnifiedTaskStatus[] = ['in_progress', 'todo', 'postponed', 'done'];
  if (!Array.isArray(raw)) return [...DEFAULT_TASK_STATUS_ORDER];
  const seen: UnifiedTaskStatus[] = [];
  for (const item of raw) {
    if (
      (item === 'todo' ||
        item === 'in_progress' ||
        item === 'postponed' ||
        item === 'done') &&
      !seen.includes(item)
    ) {
      seen.push(item);
    }
  }
  for (const st of valid) {
    if (!seen.includes(st)) seen.push(st);
  }
  return seen;
}

export interface UnifiedTask {
  id: string;
  title: string;
  description: string;
  hubId: LearningHubId;
  categoryLabel: string;
  priority: TaskPriority;
  status: UnifiedTaskStatus;
  dueDate: string; // legacy/sync alias or target date
  scheduledDate?: string; // YYYY-MM-DD (empty string = unscheduled)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  durationMinutes?: number; // e.g. 60
  deadline?: string; // YYYY-MM-DD optional deadline
  projectId?: string;
  linkedLabel?: string;
  linkedCourseId?: number;
  linkedPathId?: string;
  linkedBookId?: string;
}

export interface StudyHistoryEntry {
  id: string;
  actionType: 'note' | 'voice' | 'task' | 'course' | 'domain' | 'month';
  title: string;
  detail: string;
  targetTab:
    | 'overview'
    | 'focus'
    | 'plan'
    | 'domains'
    | 'courses'
    | 'journal'
    | 'calendar'
    | 'paths'
    | 'library'
    | 'tasks'
    | 'reflections'
    | 'blogs'
    | 'daily_journal'
    | 'weekly_plan'
    | 'reviews'
    | 'account';
  targetNoteId?: string;
  targetMonthId?: number;
  targetCourseId?: number;
  timestampLabel: string;
  createdAtMs: number;
}

export type ReflectionMood = 'تأمل' | 'فكرة' | 'امتنان' | 'هدف';

export type ReflectionColorKey =
  | 'auto'
  | 'sage'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'lavender'
  | 'slate';

export const REFLECTION_COLOR_PALETTE: Record<
  Exclude<ReflectionColorKey, 'auto'>,
  {
    id: Exclude<ReflectionColorKey, 'auto'>;
    label: string;
    cardClass: string;
    cardBg: string;
    cardBorder: string;
    accentText: string;
    badgeClass: string;
    swatchClass: string;
    swatchHex: string;
    hex: string;
  }
> = {
  sage: {
    id: 'sage',
    label: 'أخضر هادئ (امتنان)',
    cardClass: 'bg-[#F3F8F5] border-[#C9DEC9] hover:border-[#A7CBB5]',
    cardBg: 'bg-[#F3F8F5]',
    cardBorder: 'border-[#C9DEC9] hover:border-[#A7CBB5]',
    accentText: 'text-[#1D5438]',
    badgeClass: 'bg-[#E2EFE6] text-[#1D5438]',
    swatchClass: 'bg-[#CDE5D6] border-[#7BAE91]',
    swatchHex: '#CDE5D6',
    hex: '#F3F8F5',
  },
  sky: {
    id: 'sky',
    label: 'أزرق سماوي هادئ (تأمل)',
    cardClass: 'bg-[#F3F7FB] border-[#CBD8E6] hover:border-[#9EB7D2]',
    cardBg: 'bg-[#F3F7FB]',
    cardBorder: 'border-[#CBD8E6] hover:border-[#9EB7D2]',
    accentText: 'text-[#1E3A5F]',
    badgeClass: 'bg-[#E3ECF6] text-[#1E3A5F]',
    swatchClass: 'bg-[#CFE0F2] border-[#6F96BE]',
    swatchHex: '#CFE0F2',
    hex: '#F3F7FB',
  },
  amber: {
    id: 'amber',
    label: 'رملي دافئ (فكرة)',
    cardClass: 'bg-[#FBF8F1] border-[#E7DCC4] hover:border-[#D3C099]',
    cardBg: 'bg-[#FBF8F1]',
    cardBorder: 'border-[#E7DCC4] hover:border-[#D3C099]',
    accentText: 'text-[#7A5413]',
    badgeClass: 'bg-[#F3EBDA] text-[#7A5413]',
    swatchClass: 'bg-[#EFE0BE] border-[#C29C53]',
    swatchHex: '#EFE0BE',
    hex: '#FBF8F1',
  },
  lavender: {
    id: 'lavender',
    label: 'ليلكي ناعم (هدف)',
    cardClass: 'bg-[#F6F5FB] border-[#DCD8EB] hover:border-[#BBB3DA]',
    cardBg: 'bg-[#F6F5FB]',
    cardBorder: 'border-[#DCD8EB] hover:border-[#BBB3DA]',
    accentText: 'text-[#4C3D7A]',
    badgeClass: 'bg-[#EAE7F5] text-[#4C3D7A]',
    swatchClass: 'bg-[#DDD6F3] border-[#8F80C4]',
    swatchHex: '#DDD6F3',
    hex: '#F6F5FB',
  },
  rose: {
    id: 'rose',
    label: 'وردي خفيف',
    cardClass: 'bg-[#FCF5F6] border-[#EAD0D5] hover:border-[#D9A7B2]',
    cardBg: 'bg-[#FCF5F6]',
    cardBorder: 'border-[#EAD0D5] hover:border-[#D9A7B2]',
    accentText: 'text-[#842D43]',
    badgeClass: 'bg-[#F6E4E8] text-[#842D43]',
    swatchClass: 'bg-[#F3D5DC] border-[#C67A8D]',
    swatchHex: '#F3D5DC',
    hex: '#FCF5F6',
  },
  slate: {
    id: 'slate',
    label: 'أبيض رمادي صافي',
    cardClass: 'bg-[#F8F9FB] border-slate-200 hover:border-slate-300',
    cardBg: 'bg-[#F8F9FB]',
    cardBorder: 'border-slate-200 hover:border-slate-300',
    accentText: 'text-slate-700',
    badgeClass: 'bg-slate-200/75 text-slate-700',
    swatchClass: 'bg-slate-100 border-slate-400',
    swatchHex: '#E2E8F0',
    hex: '#F8F9FB',
  },
};

export function resolveReflectionColorKey(
  reflection: Pick<PersonalReflection, 'colorKey' | 'moodTag'>
): Exclude<ReflectionColorKey, 'auto'> {
  if (reflection.colorKey && reflection.colorKey !== 'auto') {
    return reflection.colorKey;
  }
  switch (reflection.moodTag) {
    case 'امتنان':
      return 'sage';
    case 'فكرة':
      return 'amber';
    case 'هدف':
      return 'lavender';
    case 'تأمل':
    default:
      return 'sky';
  }
}

export function getReflectionCardStyle(
  reflection: Pick<PersonalReflection, 'colorKey' | 'moodTag'>
) {
  return REFLECTION_COLOR_PALETTE[resolveReflectionColorKey(reflection)];
}

export type ImageFrameAspect = 'auto' | '1:1' | '4:3' | '16:9' | '21:9' | '3:4';
export type ImageDisplaySize = 'xs' | 'sm' | 'md' | 'lg' | 'full';

export interface ImageFrameSpec {
  aspect: ImageFrameAspect;
  fitMode: 'cover' | 'contain';
  zoom: number;
  offsetX: number;
  offsetY: number;
  sizePreset: ImageDisplaySize;
  customHeightPx?: number;
}

export const DEFAULT_IMAGE_FRAME_SPEC: ImageFrameSpec = {
  aspect: '4:3',
  fitMode: 'cover',
  zoom: 1,
  offsetX: 50,
  offsetY: 50,
  sizePreset: 'md',
};

export const DEFAULT_REFLECTION_IMAGE_FRAME: ImageFrameSpec = {
  aspect: '21:9',
  fitMode: 'cover',
  zoom: 1,
  offsetX: 50,
  offsetY: 50,
  sizePreset: 'sm',
  customHeightPx: 140,
};

export const DEFAULT_DASHBOARD_HERO_FRAME: ImageFrameSpec = {
  aspect: 'auto',
  fitMode: 'cover',
  zoom: 1,
  offsetX: 50,
  offsetY: 50,
  sizePreset: 'lg',
};

export function sanitizeImageFrameSpec(
  raw: unknown,
  fallback: ImageFrameSpec = DEFAULT_IMAGE_FRAME_SPEC
): ImageFrameSpec {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const obj = raw as Record<string, unknown>;
  const aspectRaw = String(obj.aspect ?? fallback.aspect);
  const aspect: ImageFrameAspect =
    aspectRaw === 'auto' ||
    aspectRaw === '1:1' ||
    aspectRaw === '4:3' ||
    aspectRaw === '16:9' ||
    aspectRaw === '21:9' ||
    aspectRaw === '3:4'
      ? aspectRaw
      : fallback.aspect;
  const fitMode: 'cover' | 'contain' =
    obj.fitMode === 'contain' ? 'contain' : 'cover';
  const zoomNum = Number(obj.zoom);
  const zoom = Number.isFinite(zoomNum)
    ? Math.max(0.4, Math.min(3, Math.round(zoomNum * 100) / 100))
    : fallback.zoom;
  const offsetXNum = Number(obj.offsetX);
  const offsetX = Number.isFinite(offsetXNum)
    ? Math.max(0, Math.min(100, Math.round(offsetXNum * 10) / 10))
    : fallback.offsetX;
  const offsetYNum = Number(obj.offsetY);
  const offsetY = Number.isFinite(offsetYNum)
    ? Math.max(0, Math.min(100, Math.round(offsetYNum * 10) / 10))
    : fallback.offsetY;
  const sizeRaw = String(obj.sizePreset ?? fallback.sizePreset);
  const sizePreset: ImageDisplaySize =
    sizeRaw === 'xs' ||
    sizeRaw === 'sm' ||
    sizeRaw === 'md' ||
    sizeRaw === 'lg' ||
    sizeRaw === 'full'
      ? sizeRaw
      : fallback.sizePreset;
  const ch = Number(obj.customHeightPx);
  const customHeightPx =
    Number.isFinite(ch) && ch >= 80 && ch <= 560 ? Math.round(ch) : undefined;
  return {
    aspect,
    fitMode,
    zoom,
    offsetX,
    offsetY,
    sizePreset,
    ...(customHeightPx ? { customHeightPx } : {}),
  };
}

export interface PersonalReflection {
  id: string;
  title: string;
  content: string;
  moodTag: ReflectionMood;
  categoryTag?: string;
  colorKey?: ReflectionColorKey;
  isPublic?: boolean;
  imageUrl?: string;
  imageStoragePath?: string;
  imageFrame?: ImageFrameSpec;
  pinned: boolean;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface BlogPost {
  id: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  content: string;
  categoryLabel?: string;
  coverImageUrl?: string;
  coverStoragePath?: string;
  coverFrame?: ImageFrameSpec;
  readingTimeMinutes?: number;
  isPublic?: boolean;
  pinned: boolean;
  sortOrder?: number;
  createdAtLabel: string;
  createdAtMs: number;
  updatedAtLabel?: string;
}

export const DEFAULT_BLOG_CATEGORIES: string[] = [
  'فكر ومنهج',
  'تطوير مهني',
  'طب الأسنان',
  'التسويق والأعمال',
  'قراءات ومراجعات',
  'تجارب شخصية',
];

export function estimateReadingTimeMinutes(text: string): number {
  const words = (text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 160));
}

export type PublicPageId = 'home' | 'reflections' | 'blogs';

export type CalendarCategory = 'شخصي' | 'دراسة' | 'موعد' | 'مراجعة' | 'قراءة';
export type CalendarColor = 'navy' | 'emerald' | 'amber' | 'rose';

export interface CalendarEvent {
  id: string;
  dateKey: string; // YYYY-MM-DD
  timeSlot: string;
  endTime?: string;
  durationMinutes?: number;
  title: string;
  notes: string;
  category: CalendarCategory;
  color: CalendarColor;
  done: boolean;
  linkedTaskText?: string;
  linkedTaskId?: string;
}

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year';
export type CalendarDensity = 'compact' | 'expanded';
export type WeekStartDay = 6 | 0 | 1; // 6=Sat, 0=Sun, 1=Mon

export interface CalendarPreferences {
  defaultView: CalendarViewMode;
  density: CalendarDensity;
  showCompleted: boolean;
  showWeekends: boolean;
  weekStartDay: WeekStartDay;
  filterHub: LearningHubId | 'all';
  filterPriority: TaskPriority | 'all';
  filterStatus: 'all' | 'pending' | 'done';
  dayStartHour?: number;
  dayEndHour?: number;
}

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  defaultView: 'week',
  density: 'expanded',
  showCompleted: true,
  showWeekends: true,
  weekStartDay: 6,
  filterHub: 'all',
  filterPriority: 'all',
  filterStatus: 'all',
  dayStartHour: 0,
  dayEndHour: 24,
};

export type MeetingAttendanceStatus = 'pending' | 'attended' | 'missed' | 'excused';

export interface WeeklyMeetingFollowUp {
  id: string;
  text: string;
  done: boolean;
  occurrenceDate?: string;
  linkedTaskId?: string;
}

export interface WeeklyMeetingException {
  cancelled?: boolean;
  movedDateKey?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  title?: string;
}

export interface WeeklyMeeting {
  id: string;
  title: string;
  description: string;
  hubId: LearningHubId;
  startDate: string; // YYYY-MM-DD anchor date
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  isRecurringWeekly: boolean;
  recurrenceEndDate?: string; // YYYY-MM-DD or ''
  color: CalendarColor;
  status: 'scheduled' | 'completed' | 'cancelled';
  completedDates: string[];
  attendanceByDate: Record<string, MeetingAttendanceStatus>;
  notesByDate: Record<string, string>;
  followUps: WeeklyMeetingFollowUp[];
  linkedTaskIds: string[];
  exceptions: Record<string, WeeklyMeetingException>;
}

export interface WeeklyMeetingOccurrence {
  meeting: WeeklyMeeting;
  occurrenceKey: string; // canonical dateKey on series (YYYY-MM-DD)
  dateKey: string; // effective dateKey (after movedDateKey override)
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  completed: boolean;
  attendance: MeetingAttendanceStatus;
  notes: string;
}

export function computeEndTimeFromMinutes(startTime: string, durationMinutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return '';
  const startTotal = Math.max(0, Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2])));
  const endTotal = Math.min(23 * 60 + 59, startTotal + Math.max(15, durationMinutes));
  const hh = String(Math.floor(endTotal / 60)).padStart(2, '0');
  const mm = String(endTotal % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function expandWeeklyMeetingsInRange(
  meetings: WeeklyMeeting[],
  rangeStartKey: string,
  rangeEndKey: string
): WeeklyMeetingOccurrence[] {
  const results: WeeklyMeetingOccurrence[] = [];
  const parseDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y || 2026, (m || 1) - 1, d || 1);
  };
  const rangeStart = parseDate(rangeStartKey);
  const rangeEnd = parseDate(rangeEndKey);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return results;
  }

  for (const mtg of meetings) {
    if (!mtg.startDate || mtg.status === 'cancelled') continue;
    const anchor = parseDate(mtg.startDate);
    if (Number.isNaN(anchor.getTime())) continue;
    const recEnd =
      mtg.recurrenceEndDate && /^\d{4}-\d{2}-\d{2}$/.test(mtg.recurrenceEndDate)
        ? parseDate(mtg.recurrenceEndDate)
        : null;

    const pushOccurrence = (canonDateKey: string) => {
      const ex = mtg.exceptions?.[canonDateKey];
      if (ex?.cancelled) return;
      const effDate = ex?.movedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(ex.movedDateKey)
        ? ex.movedDateKey
        : canonDateKey;
      if (effDate < rangeStartKey || effDate > rangeEndKey) return;
      const effDuration = ex?.durationMinutes ?? mtg.durationMinutes ?? 60;
      const effStart = ex?.startTime ?? mtg.startTime ?? '18:00';
      const effEnd = ex?.endTime ?? mtg.endTime ?? computeEndTimeFromMinutes(effStart, effDuration);
      const completed = (mtg.completedDates || []).includes(canonDateKey) || mtg.status === 'completed';
      const attendance = mtg.attendanceByDate?.[canonDateKey] ?? (completed ? 'attended' : 'pending');
      const notes = mtg.notesByDate?.[canonDateKey] ?? '';
      results.push({
        meeting: mtg,
        occurrenceKey: canonDateKey,
        dateKey: effDate,
        title: ex?.title || mtg.title,
        startTime: effStart,
        endTime: effEnd,
        durationMinutes: effDuration,
        completed,
        attendance,
        notes,
      });
    };

    if (!mtg.isRecurringWeekly) {
      pushOccurrence(mtg.startDate);
      continue;
    }

    // Iterate weekly steps covering [rangeStart - 7d, rangeEnd + 7d] so movedDateKey exceptions in window are included
    const cursor = new Date(anchor.getTime());
    const minWindow = new Date(rangeStart.getTime());
    minWindow.setDate(minWindow.getDate() - 7);
    const maxWindow = new Date(rangeEnd.getTime());
    maxWindow.setDate(maxWindow.getDate() + 7);

    if (cursor < minWindow) {
      const diffDays = Math.floor((minWindow.getTime() - cursor.getTime()) / 86400000);
      const weeks = Math.floor(diffDays / 7);
      cursor.setDate(cursor.getDate() + weeks * 7);
    }

    let guard = 0;
    while (cursor <= maxWindow && guard < 120) {
      guard += 1;
      if (cursor >= anchor && (!recEnd || cursor <= recEnd)) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        pushOccurrence(`${y}-${m}-${d}`);
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return results.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}

export type HighlightColorKey = 'amber' | 'emerald' | 'sky' | 'rose';
export type NoteMarginMode = 'compact' | 'normal' | 'wide' | 'spacious';
export type NoteWidthMode = 'focused' | 'balanced' | 'full';
export type NoteBorderMode = 'none' | 'subtle' | 'medium' | 'framed';
export type VoiceDialectMode = 'standard_arabic' | 'egyptian_arabic' | 'bilingual';
export type VoiceInsertMode = 'append_paragraph' | 'append_bullet' | 'append_quote';
export type ReadAloudVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface WeeklyRhythmItem {
  id: string;
  pillar: string;
  suggestedDuration: string;
  targetHours?: number;
  focus: string;
  guideline: string;
  days?: string[];
  active?: boolean;
}

export const WEEKLY_RHYTHM_DAYS = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
] as const;

export const DEFAULT_WEEKLY_RHYTHM: WeeklyRhythmItem[] = [
  {
    id: 'reading',
    pillar: 'القراءة المتأنية',
    suggestedDuration: '3.5 ساعات أسبوعيًا',
    targetHours: 3.5,
    focus: 'كتاب المسار التأسيسي + كتاب المسار الاستكشافي',
    guideline: '30–40 دقيقة يوميًا بوتيرة هادئة دون التزام بعدد صفحات قسري.',
    days: ['السبت', 'الأحد', 'الثلاثاء', 'الخميس'],
    active: true,
  },
  {
    id: 'listening',
    pillar: 'الاستماع والمحاضرات',
    suggestedDuration: '1.5 ساعة أسبوعيًا',
    targetHours: 1.5,
    focus: 'سلاسل البناء المنهجي أو المحاضرات الفلسفية والتاريخية',
    guideline: 'استغلال أوقات التنقل مع تدوين نقطة محورية واحدة بعد كل محاضرة.',
    days: ['الأحد', 'الإثنين', 'الأربعاء'],
    active: true,
  },
  {
    id: 'summarizing',
    pillar: 'التلخيص والبطاقات الفكرية',
    suggestedDuration: '1 ساعة أسبوعيًا',
    targetHours: 1,
    focus: 'تحويل المقروء والمسموع إلى أفكار خاصة بك',
    guideline: 'كتابة خلاصة من 5 أسطر بلغتك الخاصة لا بنقل العبارات حرفيًا.',
    days: ['الخميس'],
    active: true,
  },
  {
    id: 'discussing',
    pillar: 'المناقشة والتطبيق',
    suggestedDuration: '1 ساعة أسبوعيًا',
    targetHours: 1,
    focus: 'حوار مع صديق أو ربط بكورس التطوير الشخصي',
    guideline: 'اختبار الفكرة في الواقع: سؤال نقاشي + خطوة عملية من الكورس المرتبط.',
    days: ['الجمعة'],
    active: true,
  },
];

export const DEFAULT_REFLECTION_CATEGORIES: string[] = [
  'فكر ومنهج',
  'طب الأسنان',
  'التسويق والأعمال',
  'تطوير ذاتي',
  'كتب ومحاضرات',
];

export interface PublicSiteSection {
  id: string;
  title: string;
  body: string;
  visible: boolean;
}

export interface PublicSiteVisibilityFlags {
  showHero: boolean;
  showBackground: boolean;
  showSkills: boolean;
  showInterests: boolean;
  showPhilosophy: boolean;
  showCourses: boolean;
  showPaths: boolean;
  showBooks: boolean;
  showReflections?: boolean;
  showBlogs?: boolean;
}

export interface PublicSiteConfig {
  id: string;
  ownerId: string;
  heroTitle: string;
  heroSubtitle: string;
  introBio: string;
  backgroundText: string;
  skills: string[];
  interests: string[];
  philosophyText: string;
  sections: PublicSiteSection[];
  visibilityFlags: PublicSiteVisibilityFlags;
  publicReflectionCategories?: string[];
  creatorName?: string;
  linkedinUrl?: string;
  contactEmail?: string;
  showContactForm?: boolean;
  updatedAtMs: number;
}

export const DEFAULT_PUBLIC_SITE_CONFIG: PublicSiteConfig = {
  id: 'main',
  ownerId: '',
  heroTitle: 'ميزان المعرفة — الرحلة الفكرية والمهنية',
  heroSubtitle: 'مساحة معرفية للتعلّم المنضبط، القراءة العميقة، وبناء المشاريع الواقعية.',
  introBio:
    'أهلاً بكم في واجهة ميزان المعرفة العامة. تجمع هذه المساحة خلاصة الكورسات والمسارات والكتب المختارة التي أشاركها للقرّاء والمهتمين بالتعلّم المنهجي والتطوير المهني.',
  backgroundText:
    'الجمع بين الممارسة الإكلينيكية في طب الأسنان، والعمل في التسويق الرقمي وبناء المشاريع، والتأسيس الفكري والمنهجي طويل الأمد.',
  skills: [
    'طب الأسنان الإكلينيكي',
    'استراتيجية التسويق الرقمي',
    'التلخيص المنهجي والبحث',
    'إدارة المشاريع المعرفية',
  ],
  interests: [
    'الفكر الإسلامي وبناء المنهج',
    'علم النفس المعرفي واتخاذ القرار',
    'التاريخ والحضارة',
    'الأدب العربي الرفيع',
  ],
  philosophyText:
    'المعرفة الحقيقية ليست جمعًا عشوائيًا للمعلومات، بل بناء متدرج يوازن بين التأصيل النظري والتطبيق العملي الهادئ.',
  sections: [
    {
      id: 'sec-methodology',
      title: 'منهجية القراءة والتلخيص',
      body: 'تعتمد الخطة على التوازن بين مسار تأسيسي يرسّخ الأصول ومسار استكشافي يوسّع الأفق، مع تحويل كل مادة مقروءة إلى خلاصة وأسئلة وتطبيق عملي.',
      visible: true,
    },
  ],
  visibilityFlags: {
    showHero: true,
    showBackground: true,
    showSkills: true,
    showInterests: true,
    showPhilosophy: true,
    showCourses: true,
    showPaths: true,
    showBooks: true,
    showReflections: true,
    showBlogs: true,
  },
  publicReflectionCategories: [],
  creatorName: 'Ahmed Ibrahim',
  linkedinUrl: '',
  contactEmail: 'ahmedibrahim108@outlook.com',
  showContactForm: true,
  updatedAtMs: 0,
};

export interface UserProfileItem {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string;
  role: 'user' | 'admin';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt?: string;
}

export type GrantAccessMode = 'read_only' | 'can_annotate';

export interface ContentAccessGrant {
  id: string;
  ownerId: string;
  granteeUid: string;
  granteeEmail: string;
  courseDocIds: string[];
  includeCourseNotes: boolean;
  noteIds: string[];
  pathIds: string[];
  bookIds: string[];
  reflectionIds: string[];
  reflectionCategories: string[];
  blogIds?: string[];
  accessMode?: GrantAccessMode;
  allowUserNotes?: boolean;
  customAdditionTitle?: string;
  customAdditionBody?: string;
  notesForUser: string;
  updatedAtMs: number;
}

export interface GrantedItemNote {
  id: string;
  ownerId: string;
  authorUid: string;
  authorEmail: string;
  authorName: string;
  targetType: 'course' | 'note' | 'path' | 'book' | 'reflection';
  targetId: string;
  content: string;
  isAdminReply?: boolean;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface GrantedWorkspaceData {
  grants: ContentAccessGrant[];
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  reflections: PersonalReflection[];
  blogPosts?: BlogPost[];
  itemNotes?: GrantedItemNote[];
}

export type EntitySortMode =
  | 'manual'
  | 'logical'
  | 'updated'
  | 'title'
  | 'stage'
  | 'progress';

export interface UserPreferences {
  noteFontSize: 'sm' | 'base' | 'lg';
  noteHighlightColor: HighlightColorKey;
  notePaperTone: 'clean' | 'warm' | 'slate';
  noteMargin?: NoteMarginMode;
  noteWidth?: NoteWidthMode;
  noteBorder?: NoteBorderMode;
  autoAddTimestampOnVoice: boolean;
  voiceDialect: VoiceDialectMode;
  voiceInsertMode: VoiceInsertMode;
  readAloudVoice: ReadAloudVoiceName;
  readAloudSpeed: 'normal' | 'calm';
  showExcelExport?: boolean;
  hubCategories?: Record<LearningHubId, string[]>;
  calendarPrefs?: CalendarPreferences;
  weeklyRhythm?: WeeklyRhythmItem[];
  reflectionCategories?: string[];
  customReadingModes?: ReadingModeMeta[];
  pinnedNavTabs?: string[];
  customHubs?: LearningHubMeta[];
  dashboardHeroImageUrl?: string;
  dashboardHeroImageStoragePath?: string;
  dashboardHeroImageFrame?: ImageFrameSpec;
  taskStatusOrder?: UnifiedTaskStatus[];
  activeFocusPinCollectionId?: string | null;
}

export interface PinnableNavTabMeta {
  id:
    | 'focus'
    | 'daily_journal'
    | 'weekly_plan'
    | 'reviews'
    | 'courses'
    | 'paths'
    | 'library'
    | 'journal'
    | 'reflections'
    | 'blogs'
    | 'gallery'
    | 'tasks'
    | 'calendar'
    | 'plan'
    | 'domains';
  label: string;
  description: string;
}

export const NAV_PINNABLE_TABS_META: PinnableNavTabMeta[] = [
  { id: 'focus', label: 'التركيز', description: 'كورساتك ومهامك النشطة حاليًا.' },
  { id: 'daily_journal', label: 'اليوميات', description: 'سجل يومي تلقائي لكل ما أنجزته وتعلّمته يوميًا.' },
  { id: 'weekly_plan', label: 'تخطيط الأسبوع', description: 'تخطيط الأسبوع القادم (السبت ← الجمعة) بدون تكرار المهام.' },
  { id: 'reviews', label: 'المراجعات', description: 'مراجعات أسبوعية وشهرية وربع سنوية وسنوية.' },
  { id: 'courses', label: 'الكورسات', description: 'إدارة الدورات والدروس وحالات الأسنان.' },
  { id: 'paths', label: 'المسارات', description: 'خرائط التعلّم طويلة المدى ومراحلها.' },
  { id: 'library', label: 'المكتبة', description: 'الكتب والأبحاث وملفات PDF المقروءة.' },
  { id: 'journal', label: 'التلخيص', description: 'دفاتر التلخيص والتكرار المتباعد.' },
  { id: 'reflections', label: 'خواطري', description: 'التأملات اليومية والمقالات السريعة.' },
  { id: 'blogs', label: 'المدونة والمقالات', description: 'مقالاتك التحريرية والمنشورة في الموقع العام.' },
  { id: 'gallery', label: 'معرض الصور', description: 'ألبوم صورك وإطاراتها السحابية.' },
  { id: 'tasks', label: 'المهام', description: 'المهام العملية والمشاريع المربوطة بالتقويم.' },
  { id: 'calendar', label: 'التقويم', description: 'الجدول الزمني الـ 24 ساعة وسحب المهام.' },
  { id: 'plan', label: 'خطة الـ 12 شهرًا', description: 'الوحدات الشهرية والأرباع السنوية.' },
  { id: 'domains', label: 'المحاور المعرفية', description: 'تصنيف المجالات الفكرية والمفكرين.' },
];

export const DEFAULT_PINNED_NAV_TABS: string[] = [
  'focus',
  'daily_journal',
  'weekly_plan',
  'reviews',
  'courses',
  'paths',
  'library',
  'journal',
  'reflections',
  'tasks',
  'calendar',
];

// ============================================================================
// Daily Journal, Activity Log, Period Reviews, Weekly Planner & Saved Pins
// ============================================================================

export type ActivityEntityType =
  | 'course'
  | 'course_task'
  | 'book_note'
  | 'reflection'
  | 'task'
  | 'project'
  | 'learning_path'
  | 'reading_item'
  | 'blog_post'
  | 'calendar_event'
  | 'meeting'
  | 'month';

export type ActivityActionKind =
  | 'created'
  | 'updated'
  | 'completed'
  | 'postponed'
  | 'studied'
  | 'reviewed'
  | 'scheduled';

export interface ActivityLogEntry {
  id: string;
  dateKey: string; // Local YYYY-MM-DD
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityActionKind;
  title: string;
  subtitle?: string;
  hubId?: LearningHubId;
  statusSnapshot?: string;
  occurredAtMs: number;
}

export interface DailyJournalRecord {
  dateKey: string; // YYYY-MM-DD (one per user + local date)
  reflectionText: string;
  highlightsText: string;
  moodLabel?: string;
  energyScore?: number; // 1..5 optional
  updatedAtMs: number;
}

export type PeriodReviewType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PeriodReviewRecord {
  id: string; // e.g. weekly_2026-11-21
  periodType: PeriodReviewType;
  periodKey: string; // Sat-Fri startKey for weekly, YYYY-MM, YYYY-Q1, YYYY
  periodStartKey: string;
  periodEndKey: string;
  reflectionText: string;
  adjustmentsText: string;
  nextPeriodFocusText: string;
  rating?: number; // 1..5 optional
  updatedAtMs: number;
}

export interface WeeklyPlanGoal {
  id: string;
  text: string;
  hubId?: LearningHubId;
  done: boolean;
}

export interface WeeklyPlanRecord {
  weekKey: string; // YYYY-MM-DD of Saturday
  weekStartKey: string; // Saturday YYYY-MM-DD
  weekEndKey: string; // Friday YYYY-MM-DD
  focusHubIds: LearningHubId[];
  focusCourseIds: number[];
  linkedTaskIds: string[]; // References to UnifiedTask.id (never copies!)
  goals: WeeklyPlanGoal[];
  notes: string;
  plannedAtMs: number;
  updatedAtMs: number;
}

export type PinEntityType = 'course' | 'note' | 'path' | 'task' | 'project';

export interface PinCollectionItem {
  entityType: PinEntityType;
  entityId: string; // docId or stringified numeric id or entity id
  addedAtMs: number;
}

export interface PinCollection {
  id: string;
  title: string;
  description?: string;
  colorKey: NoteColorKey;
  sortOrder: number;
  items: PinCollectionItem[];
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ContactMessageRecord {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  createdAtMs: number;
}

// ============================================================================
// Local Date & Saturday -> Friday Week Utilities
// ============================================================================

export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDateKey(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateKey || '').trim());
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const d = parseLocalDateKey(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return toLocalDateKey(d);
}

/**
 * Strict Saturday -> Friday week calculation (matches weekStartDay = 6).
 * JS getDay(): Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6.
 */
export function getSatFriWeekRange(dateOrKey?: Date | string): {
  weekKey: string;
  startKey: string;
  endKey: string;
  days: string[];
} {
  const base =
    typeof dateOrKey === 'string'
      ? parseLocalDateKey(dateOrKey)
      : dateOrKey
      ? new Date(dateOrKey.getFullYear(), dateOrKey.getMonth(), dateOrKey.getDate())
      : new Date();
  const dayIdx = base.getDay(); // 0..6
  const offsetSinceSaturday = (dayIdx + 1) % 7; // Sat(6)->0, Sun(0)->1 ... Fri(5)->6
  const sat = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offsetSinceSaturday);
  const startKey = toLocalDateKey(sat);
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(addDaysToDateKey(startKey, i));
  }
  const endKey = days[6];
  return { weekKey: startKey, startKey, endKey, days };
}

export function shiftWeekKey(startKey: string, deltaWeeks: number): string {
  return addDaysToDateKey(getSatFriWeekRange(startKey).startKey, deltaWeeks * 7);
}

export function getSatFriWeekDays(startKey: string): string[] {
  return getSatFriWeekRange(startKey).days;
}

export function getMonthRange(monthKey: string): {
  monthKey: string;
  startKey: string;
  endKey: string;
} {
  const m = /^(\d{4})-(\d{2})$/.exec((monthKey || '').trim());
  const now = new Date();
  const year = m ? Number(m[1]) : now.getFullYear();
  const monthIdx = m ? Number(m[2]) - 1 : now.getMonth();
  const start = new Date(year, monthIdx, 1);
  const end = new Date(year, monthIdx + 1, 0);
  return {
    monthKey: `${year}-${String(monthIdx + 1).padStart(2, '0')}`,
    startKey: toLocalDateKey(start),
    endKey: toLocalDateKey(end),
  };
}

export function getQuarterRange(quarterKey: string): {
  quarterKey: string;
  startKey: string;
  endKey: string;
} {
  const m = /^(\d{4})-Q([1-4])$/i.exec((quarterKey || '').trim());
  const now = new Date();
  const year = m ? Number(m[1]) : now.getFullYear();
  const qNum = m ? Number(m[2]) : Math.floor(now.getMonth() / 3) + 1;
  const startMonth = (qNum - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    quarterKey: `${year}-Q${qNum}`,
    startKey: toLocalDateKey(start),
    endKey: toLocalDateKey(end),
  };
}

export function getYearRange(yearKey: string): {
  yearKey: string;
  startKey: string;
  endKey: string;
} {
  const yearNum = /^\d{4}$/.test((yearKey || '').trim())
    ? Number(yearKey.trim())
    : new Date().getFullYear();
  return {
    yearKey: String(yearNum),
    startKey: `${yearNum}-01-01`,
    endKey: `${yearNum}-12-31`,
  };
}

const ARABIC_DAYS_BY_JS_DAY = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function getDayArabicName(dateKey: string): string {
  const d = parseLocalDateKey(dateKey);
  return ARABIC_DAYS_BY_JS_DAY[d.getDay()] || '';
}

export function formatShortArabicDate(dateKey: string): string {
  const d = parseLocalDateKey(dateKey);
  try {
    return d.toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateKey;
  }
}

export const DEFAULT_HUB_CATEGORIES: Record<LearningHubId, string[]> = {
  marketing: DEFAULT_LEARNING_HUBS[0].defaultCategories,
  dental_career: DEFAULT_LEARNING_HUBS[1].defaultCategories,
  knowledge: DEFAULT_LEARNING_HUBS[2].defaultCategories,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  noteFontSize: 'base',
  noteHighlightColor: 'amber',
  notePaperTone: 'clean',
  noteMargin: 'normal',
  noteWidth: 'focused',
  noteBorder: 'subtle',
  autoAddTimestampOnVoice: false,
  voiceDialect: 'standard_arabic',
  voiceInsertMode: 'append_paragraph',
  readAloudVoice: 'Kore',
  readAloudSpeed: 'normal',
  showExcelExport: true,
  hubCategories: DEFAULT_HUB_CATEGORIES,
  calendarPrefs: DEFAULT_CALENDAR_PREFERENCES,
  weeklyRhythm: DEFAULT_WEEKLY_RHYTHM,
  reflectionCategories: DEFAULT_REFLECTION_CATEGORIES,
  customReadingModes: READING_MODES_META,
  pinnedNavTabs: DEFAULT_PINNED_NAV_TABS,
  customHubs: DEFAULT_LEARNING_HUBS,
  taskStatusOrder: DEFAULT_TASK_STATUS_ORDER,
};

export interface WeeklyRhythmSlot {
  id: string;
  pillar: string;
  suggestedDuration: string;
  focus: string;
  guideline: string;
}

export const HERO_IMAGE_PATH = '/assets/aistudio/image_453deeef.png';

export const INITIAL_QUARTERS: QuarterInfo[] = [
  {
    id: 'quarter-1',
    number: 1,
    title: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    subtitle: 'الأشهر 1–3 · بناء المنهج قبل كثرة المحفوظات',
  },
  {
    id: 'quarter-2',
    number: 2,
    title: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    subtitle: 'الأشهر 4–6 · التفكير الناقد والانحيازات والمكان',
  },
  {
    id: 'quarter-3',
    number: 3,
    title: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    subtitle: 'الأشهر 7–9 · سنن الاجتماع والنموذج المعرفي',
  },
  {
    id: 'quarter-4',
    number: 4,
    title: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    subtitle: 'الأشهر 10–12 · الحصاد والربط التطبيقي',
  },
];

export const DOMAINS: DomainInfo[] = [
  {
    id: 'islamic_thought',
    title: 'الفكر الإسلامي وبناء المنهج',
    subtitle: 'التأسيس العقدي، قراءة الوحي، ونقد الخطاب المعاصر',
    purpose: 'بناء مرجعية راسخة تجمع بين عمق التراث وفهم أسئلة العصر وإشكالاته الفكرية.',
    thinkers: [
      {
        name: 'أحمد بن يوسف السيد',
        role: 'البناء المنهجي وتدبر الوحي',
        keyWorks: ['البوصلة القرآنية', 'سلسلة البناء المنهجي', 'المسلكيات'],
        contribution: 'تأسيس خارطة طريق متدرجة لطالب العلم والمثقف المسلم بعيدًا عن العشوائية.',
      },
      {
        name: 'إبراهيم السكران',
        role: 'تحليل الخطاب والفكر الرقائقي',
        keyWorks: ['الطريق إلى القرآن', 'رقائق القرآن', 'مآلات الخطاب المدني'],
        contribution: 'الربط بين التزكية القلبية والصلابة المنهجية في تحليل النصوص والواقع.',
      },
      {
        name: 'عبدالله العجيري',
        role: 'الفلسفة العقدية ونقد الإلحاد',
        keyWorks: ['شموع النهار', 'ميليشيا الإلحاد', 'خرافة السر'],
        contribution: 'مناقشة الأسئلة الوجودية والشكوك المعاصرة بأسلوب عقلي منضبط.',
      },
      {
        name: 'سلطان العميري',
        role: 'تأصيل القضايا الفكرية والحريات',
        keyWorks: ['الظاهرة الإلحادية الحديثة', 'فضاءات الحرية', 'محاضرات التأسيس العقدي'],
        contribution: 'تفكيك المقولات الفلسفية والحداثية وبيان أصولها النظرية.',
      },
    ],
  },
  {
    id: 'philosophy',
    title: 'التفكير والفلسفة',
    subtitle: 'التفكير العلمي، تجديد العقل، ونقد النماذج المعرفية',
    purpose: 'صقل أدوات التحليل المنطقي، والتمييز بين العلم والانطباع، واكتشاف التحيزات الخفية في الأفكار.',
    thinkers: [
      {
        name: 'فؤاد زكريا',
        role: 'فلسفة العلم والتفكير النقدي',
        keyWorks: ['التفكير العلمي', 'آراء نقدية في مشكلات الفكر والثقافة'],
        contribution: 'ترسيخ قواعد التفكير العلمي الموضوعي في مقاربة الظواهر الثقافية.',
      },
      {
        name: 'زكي نجيب محمود',
        role: 'المنطق وتجديد الفكر العربي',
        keyWorks: ['تجديد الفكر العربي', 'المعقول واللامعقول في تراثنا الفكري', 'قصة عقل'],
        contribution: 'موازنة العقلانية المعاصرة مع قراءة التراث العربي قراءة تحليلية ناقدة.',
      },
      {
        name: 'عبد الوهاب المسيري',
        role: 'النموذج المعرفي وإشكالية التحيز',
        keyWorks: ['رحلتي الفكرية', 'إشكالية التحيز', 'العلمانية الجزئية والعلمانية الشاملة'],
        contribution: 'تعليم كيفية النظر إلى ما وراء المفاهيم والمصطلحات لكشف الرؤية الكونية الكامنة.',
      },
    ],
  },
  {
    id: 'psychology',
    title: 'علم النفس وفهم الذات',
    subtitle: 'البحث عن المعنى، الحرية النفسية، وانحيازات العقل',
    purpose: 'فهم النفس البشرية وآليات اتخاذ القرار والمشاعر، مما يحوّل المعرفة إلى وعي ذاتي سليم.',
    thinkers: [
      {
        name: 'فيكتور فرانكل',
        role: 'العلاج بالمعنى',
        keyWorks: ['الإنسان يبحث عن المعنى'],
        contribution: 'تأسيس فكرة أن المعنى والغاية هما المحرك الأعمق لصمود الإنسان.',
      },
      {
        name: 'إريك فروم',
        role: 'التحليل النفسي الاجتماعي',
        keyWorks: ['فن الحب', 'الخوف من الحرية', 'الإنسان بين الجوهر والمظهر'],
        contribution: 'تحليل علاقة الفرد بالحرية والانتماء والنضج العاطفي بعيدًا عن الاستهلاك.',
      },
      {
        name: 'دانيال كانيمان',
        role: 'علم النفس المعرفي واقتصاد السلوك',
        keyWorks: ['التفكير السريع والبطيء'],
        contribution: 'كشف الأخطاء الإدراكية والتحيزات اللاواعية في أحكامنا اليومية.',
      },
    ],
  },
  {
    id: 'society_history',
    title: 'المجتمع والتاريخ',
    subtitle: 'جغرافية المكان، سنن الحضارة، وفقه العمران',
    purpose: 'فهم القوانين العميقة التي تحكم نهضة المجتمعات وتراجعها، وتأثير الجغرافيا والتاريخ في الواقع.',
    thinkers: [
      {
        name: 'جمال حمدان',
        role: 'الجغرافيا التاريخية وفلسفة المكان',
        keyWorks: ['شخصية مصر: دراسة في عبقرية المكان', 'استراتيجية الاستعمار والتحرير'],
        contribution: 'قراءة التكوين الحضاري والاجتماعي للمكان بوصفه مفتاحًا لفهم الحاضر والمستقبل.',
      },
      {
        name: 'مالك بن نبي',
        role: 'فلسفة الحضارة ومشكلات النهضة',
        keyWorks: ['شروط النهضة', 'مشكلة الأفكار في العالم الإسلامي', 'وجهة العالم الإسلامي'],
        contribution: 'تشخيص أزمة الحضارة باعتبارها أزمة أفكار وإنسان وتوجيه للطاقات قبل الإمكانات المادية.',
      },
      {
        name: 'ابن خلدون',
        role: 'علم العمران البشري وفلسفة التاريخ',
        keyWorks: ['مقدمة ابن خلدون (مختارات مشروحة)'],
        contribution: 'اكتشاف السنن الاجتماعية والعصبية وأطوار الدول ومنهج نقد الرواية التاريخية.',
      },
    ],
  },
  {
    id: 'literature_biographies',
    title: 'الأدب والسير',
    subtitle: 'بيان العربية، التجربة الإدارية، والرحلات الإنسانية',
    purpose: 'تهذيب الذائقة اللغوية والوجدانية، والاطلاع على التجارب الإنسانية الحية في الإدارة والتحولات الفكرية.',
    thinkers: [
      {
        name: 'مصطفى صادق الرافعي',
        role: 'مدرسة البيان والأدب الرفيع',
        keyWorks: ['وحي القلم', 'تحت راية القرآن', 'تاريخ آداب العرب'],
        contribution: 'بناء الملكة اللغوية الراقية وربط الجمال البياني بالقيم الفكرية والروحية.',
      },
      {
        name: 'غازي القصيبي',
        role: 'أدب السيرة والتجربة الإدارية',
        keyWorks: ['حياة في الإدارة', 'سبعة', 'أبو شلاخ البرمائي'],
        contribution: 'نقل خلاصة تجربة قيادية وإدارية واقعية بلغة أدبية ساخرة ورشيقة.',
      },
      {
        name: 'تجارب إنسانية متنوعة',
        role: 'سير رحلات وتحولات عالمية',
        keyWorks: ['الطريق إلى مكة — محمد أسد', 'رحلة جبلية رحلة صعبة — فدوى طوقان'],
        contribution: 'توسيع الأفق الإنساني عبر معايشة تحولات الآخرين الفكرية والروحية والثقافية.',
      },
    ],
  },
  {
    id: 'personal_dev',
    title: 'التطوير الشخصي والكورسات الستة',
    subtitle: 'تحويل الأفكار إلى مهارات يومية ومشاريع عملية',
    purpose: 'منع الانفصال بين الثقافة النظرية والواقع العملي عبر ربط الكورسات الستة بمراجع عميقة.',
    thinkers: [
      {
        name: 'الكورسات الستة المشترك فيها',
        role: 'مسار التطبيق والمهارات',
        keyWorks: ['ربط كل كورس بمرجع مكمل', 'مشاريع تطبيقية شهرية'],
        contribution: 'ضمان خروج كل شهر بخطوة عملية ملموسة في التفكير أو الإنتاجية أو التواصل.',
      },
    ],
  },
];

export const INITIAL_COURSES: PersonalCourse[] = [
  {
    id: 1,
    title: 'الكورس 1: مهارات التعلم الفعّال وإدارة المعرفة',
    category: 'التعلم والإنتاجية',
    linkedMonths: [1, 2],
    complementaryBook: 'مفاتيح القراءة المثمرة ومنهجية التلخيص',
    bookAuthor: 'مرجع مكمل: أحمد بن يوسف السيد (البوصلة القرآنية)',
    applicationMilestone: 'بناء نظام بطاقات التلخيص (Zettelkasten / دفاتر القراءة) لأول شهرين.',
    completed: false,
    resources: [
      {
        id: 'c1-r1',
        title: 'كتاب: كيف تقرأ كتابًا — مورتيمر أدلر (القراءة التحليلية)',
        type: 'كتاب',
        note: 'أفضل مرجع عملي للتفريق بين القراءة السريعة والقراءة الفاحصة والتلخيص.',
        searchQuery: 'كتاب كيف تقرأ كتابا مورتيمر أدلر',
      },
      {
        id: 'c1-r2',
        title: 'سلسلة البناء المنهجي — أحمد بن يوسف السيد (المحاضرات التمهيدية)',
        type: 'سلسلة محاضرات',
        note: 'تشرح التدرج في تلقي العلوم وتفادي التشتت بين الكتب.',
        searchQuery: 'سلسلة البناء المنهجي أحمد بن يوسف السيد',
      },
      {
        id: 'c1-r3',
        title: 'كتاب: القراءة الذكية — ساجد العبدلي',
        type: 'كتاب',
        note: 'مدخل عربي خفيف لتهيئة بيئة القراءة وكتابة الملاحظات.',
        searchQuery: 'كتاب القراءة الذكية ساجد العبدلي',
      },
    ],
    tasks: [
      { id: 'c1-t1', text: 'تطبيق طريقة القراءة الاستكشافية (فهرس + مقدمة + خاتمة) قبل البدء بأي كتاب.', track: 'action', done: false },
      { id: 'c1-t2', text: 'إنشاء قالب ثابت لبطاقة الفكرة (اسم الكتاب + الفكرة بلغة الكاتب + صياغتي الخاصة).', track: 'action', done: false },
      { id: 'c1-t3', text: 'تلخيص الدرس الأول من الكورس وربطه بفصل من كتاب «البوصلة القرآنية».', track: 'foundational', done: false },
    ],
  },
  {
    id: 2,
    title: 'الكورس 2: التفكير النقدي وحل المشكلات',
    category: 'المهارات العقلية',
    linkedMonths: [3, 4],
    complementaryBook: 'التفكير العلمي + فن الاستدلال',
    bookAuthor: 'مرجع مكمل: فؤاد زكريا وعبدالله العجيري',
    applicationMilestone: 'تحليل مقالتين معاصرتين وتفكيك المقدمات والنتائج فيهما كتابيًا.',
    completed: false,
    resources: [
      {
        id: 'c2-r1',
        title: 'كتاب: التفكير العلمي — فؤاد زكريا',
        type: 'كتاب',
        note: 'يعرض سمات العقلية العلمية وعقبات التفكير الخرافي والانطباعي.',
        searchQuery: 'كتاب التفكير العلمي فؤاد زكريا',
      },
      {
        id: 'c2-r2',
        title: 'كتاب: المغالطات المنطقية — عادل مصطفى',
        type: 'كتاب',
        note: 'مرجع تطبيقي لرصد مغالطات الحوار اليومي والإعلامي بأمثلة عربية.',
        searchQuery: 'كتاب المغالطات المنطقية عادل مصطفى',
      },
      {
        id: 'c2-r3',
        title: 'محاضرات: صناعة المحاور / التفكير الناقد — عبدالله العجيري',
        type: 'سلسلة محاضرات',
        note: 'تطبيق عملي للاستدلال العقلي والتمييز بين الدعوى والبرهان.',
        searchQuery: 'محاضرات عبدالله العجيري التفكير الناقد',
      },
    ],
    tasks: [
      { id: 'c2-t1', text: 'كتابة قائمة بأشهر 5 مغالطات منطقية ومراقبة ظهورها في النقاشات اليومية.', track: 'exploratory', done: false },
      { id: 'c2-t2', text: 'اختيار مقال رأي وتحديد: ما الدعوى؟ ما الدليل؟ وما الفرضية المستترة؟', track: 'action', done: false },
      { id: 'c2-t3', text: 'مراجعة تمرينات حل المشكلات في الكورس وتطبيقها على تحدٍ واقعي واحد.', track: 'action', done: false },
    ],
  },
  {
    id: 3,
    title: 'الكورس 3: الذكاء العاطفي وإدارة الضغوط',
    category: 'النفس والعلاقات',
    linkedMonths: [5, 8],
    complementaryBook: 'الإنسان يبحث عن المعنى + فن الحب',
    bookAuthor: 'مرجع مكمل: فيكتور فرانكل وإريك فروم',
    applicationMilestone: 'تدوين مواقف القرارات السريعة والبطيئة أسبوعيًا وملاحظة الانحيازات.',
    completed: false,
    resources: [
      {
        id: 'c3-r1',
        title: 'كتاب: الإنسان يبحث عن المعنى — فيكتور فرانكل',
        type: 'كتاب',
        note: 'يفسر كيف يحمي وجود «غاية» الإنسان من الانهيار تحت الضغوط.',
        searchQuery: 'كتاب الإنسان يبحث عن المعنى فيكتور فرانكل',
      },
      {
        id: 'c3-r2',
        title: 'كتاب: فن الحب — إريك فروم',
        type: 'كتاب',
        note: 'يفرّق بين النضج العاطفي المسؤول وبين التعلق والأنوية.',
        searchQuery: 'كتاب فن الحب إريك فروم',
      },
      {
        id: 'c3-r3',
        title: 'كتاب: التفكير السريع والبطيء — دانيال كانيمان',
        type: 'كتاب',
        note: 'يساعد في ضبط الاندفاع العاطفي قبل القرارات المهمة.',
        searchQuery: 'التفكير السريع والبطيء دانيال كانيمان',
      },
    ],
    tasks: [
      { id: 'c3-t1', text: 'تطبيق قاعدة التوقف 10 ثوانٍ (تفعيل النظام البطيء) في موقف ضغط خلال الأسبوع.', track: 'action', done: false },
      { id: 'c3-t2', text: 'تدوين 3 مواقف استثارت غضبًا أو قلقًا وتحليل «الفكرة الكامنة» خلفها.', track: 'exploratory', done: false },
      { id: 'c3-t3', text: 'استخلاص مهارة إنصات واحدة من الكورس وتجربتها في حوار عائلي أو مهني.', track: 'action', done: false },
    ],
  },
  {
    id: 4,
    title: 'الكورس 4: القيادة والإدارة التنفيذية',
    category: 'الإدارة والعمل',
    linkedMonths: [6, 7],
    complementaryBook: 'حياة في الإدارة',
    bookAuthor: 'مرجع مكمل: غازي القصيبي',
    applicationMilestone: 'استخلاص 5 مبادئ قيادية واقعية وتطبيق أحدها في مشروع أو فريق عمل.',
    completed: false,
    resources: [
      {
        id: 'c4-r1',
        title: 'كتاب: حياة في الإدارة — غازي القصيبي',
        type: 'كتاب',
        note: 'سيرة إدارية عربية غنية بدروس التفويض، التعامل مع الأزمات، وإدارة الفرق.',
        searchQuery: 'كتاب حياة في الإدارة غازي القصيبي',
      },
      {
        id: 'c4-r2',
        title: 'مقدمة ابن خلدون — فصول السياسة والعمران والملك',
        type: 'كتاب',
        note: 'لفهم ديناميكيات الجماعات والقيادة والتحولات المؤسسية.',
        searchQuery: 'فصول القيادة والعمران في مقدمة ابن خلدون',
      },
      {
        id: 'c4-r3',
        title: 'كتاب: العادات السبع للناس الأكثر فاعلية — ستيفن كوفي',
        type: 'كتاب',
        note: 'مرجع كلاسيكي ممتاز لربط القيادة الذاتية بالقيادة الجماعية.',
        searchQuery: 'العادات السبع ستيفن كوفي',
      },
    ],
    tasks: [
      { id: 'c4-t1', text: 'استخراج 5 قواعد إدارية من تجربة غازي القصيبي ومقارنتها بمحتوى الكورس.', track: 'exploratory', done: false },
      { id: 'c4-t2', text: 'إعداد خطة تفويض أو تنظيم لمهمة متكررة في عملك أو دراستك.', track: 'action', done: false },
      { id: 'c4-t3', text: 'تقييم أسلوب تواصلك في الاجتماعات بناءً على قائمة مهارات القيادة بالكورس.', track: 'action', done: false },
    ],
  },
  {
    id: 5,
    title: 'الكورس 5: مهارات التواصل والبيان والإقناع',
    category: 'التواصل والكتابة',
    linkedMonths: [9, 10],
    complementaryBook: 'مختارات من وحي القلم + مشكلة الأفكار',
    bookAuthor: 'مرجع مكمل: مصطفى صادق الرافعي ومالك بن نبي',
    applicationMilestone: 'كتابة مقال نقدي أو عرض صوتي لملخص كتاب بلغة عربية سليمة ومقنعة.',
    completed: false,
    resources: [
      {
        id: 'c5-r1',
        title: 'كتاب: وحي القلم (مختارات) — مصطفى صادق الرافعي',
        type: 'كتاب',
        note: 'يرفع الحس البلاغي وقوة الصياغة والقدرة على التأثير الوجداني والفكري.',
        searchQuery: 'وحي القلم مصطفى صادق الرافعي',
      },
      {
        id: 'c5-r2',
        title: 'كتاب: مشكلة الأفكار في العالم الإسلامي — مالك بن نبي',
        type: 'كتاب',
        note: 'يعينك على امتلاك «محتوى فكري عميق» لا مجرد مهارة إلقاء شكلية.',
        searchQuery: 'مشكلة الأفكار في العالم الإسلامي مالك بن نبي',
      },
      {
        id: 'c5-r3',
        title: 'سلسلة: فن الإلقاء وبناء الحجة المقنعة (مختارات مسموعة)',
        type: 'سلسلة محاضرات',
        note: 'تمارين عملية على ترتيب الحجة: المقدمة، الدليل، المثال، والخاتمة.',
        searchQuery: 'مهارات الإلقاء وبناء الحجة المقنعة',
      },
    ],
    tasks: [
      { id: 'c5-t1', text: 'قراءة مقالتين للرافعي بصوت مسموع لتدريب اللسان على الإيقاع اللغوي.', track: 'exploratory', done: false },
      { id: 'c5-t2', text: 'كتابة فقرة من 150 كلمة تشرح فكرة معقدة بأسلوب بسيط ومقنع لصديق.', track: 'action', done: false },
      { id: 'c5-t3', text: 'تسجيل ملخص صوتي لمدة 3 دقائق لكتاب الشهر والاستماع إليه لتقييم الوضوح.', track: 'action', done: false },
    ],
  },
  {
    id: 6,
    title: 'الكورس 6: التخطيط الاستراتيجي وبناء المشاريع',
    category: 'التخطيط والمستقبل',
    linkedMonths: [11, 12],
    complementaryBook: 'شخصية مصر (مختارات) + شروط النهضة',
    bookAuthor: 'مرجع مكمل: جمال حمدان ومالك بن نبي',
    applicationMilestone: 'إعداد وثيقة الحصاد السنوي ورسم خطة السنة الثانية بناءً على الفجوات.',
    completed: false,
    resources: [
      {
        id: 'c6-r1',
        title: 'كتاب: شخصية مصر (مدخل عبقرية المكان) — جمال حمدان',
        type: 'كتاب',
        note: 'نموذج مذهل في الرؤية الاستراتيجية الشاملة وربط المعطيات ببعضها.',
        searchQuery: 'شخصية مصر جمال حمدان',
      },
      {
        id: 'c6-r2',
        title: 'كتاب: شروط النهضة — مالك بن نبي',
        type: 'كتاب',
        note: 'التفكير في المشاريع الكبرى عبر توجيه الثقافة والوقت والطاقات.',
        searchQuery: 'شروط النهضة مالك بن نبي',
      },
      {
        id: 'c6-r3',
        title: 'أداة عملية: نموذج التخطيط السنوي ومراجعة الأرباع الأربعة',
        type: 'أداة تطبيق',
        note: 'تقييم ما أنجزته في الـ 12 شهرًا وبناء أهداف السنة القادمة.',
        searchQuery: 'نموذج التخطيط الاستراتيجي الشخصي السنوي',
      },
    ],
    tasks: [
      { id: 'c6-t1', text: 'تحديد 3 فجوات معرفية أو مهارية ظهرت لك خلال العام ووضعها في أولوية السنة الثانية.', track: 'action', done: false },
      { id: 'c6-t2', text: 'ربط مشروع عملي واحد من الكورس السادس بملخصات قراءاتك الفكرية.', track: 'action', done: false },
      { id: 'c6-t3', text: 'مراجعة كل دفاتر التلخيص وتصدير النسخة الختامية من ملف Excel.', track: 'foundational', done: false },
    ],
  },
];

export const INITIAL_MONTHS: MonthPlan[] = [
  {
    id: 1,
    quarter: 1,
    quarterTitle: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    theme: 'كيف نبني المنهج قبل كثرة المحفوظات؟',
    foundational: {
      title: 'البوصلة القرآنية + محاضرات البناء المنهجي',
      author: 'أحمد بن يوسف السيد',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: '30 صفحة أسبوعيًا + محاضرتان قصيرتان',
      focus: 'رسم خارطة القراءة الصحيحة وترتيب الأولويات المعرفية.',
    },
    exploratory: {
      title: 'التفكير العلمي (الفصول التأسيسية)',
      author: 'فؤاد زكريا',
      format: 'كتاب',
      domainId: 'philosophy',
      pace: '25 صفحة أسبوعيًا',
      focus: 'التفريق بين المنهج العلمي والتعميمات العاطفية.',
    },
    courseId: 1,
    discussionPrompt: 'ما الفرق بين القراءة العشوائية والقراءة المنهجية؟ وكيف يلتقي التدبر الشرعي مع الانضباط العلمي؟',
    applicationTask: 'إعداد جدول الإيقاع الأسبوعي وتخصيص دفتر واحد للتلخيص (بطاقة فكرة واحدة لكل فصل).',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'in_progress',
    notes: '',
    resources: [
      {
        id: 'm1-r1',
        title: 'سلسلة البناء المنهجي — اللقاءات التأسيسية (أحمد بن يوسف السيد)',
        type: 'سلسلة محاضرات',
        note: 'ابدأ بالمحاضرة الأولى والثانية لفهم معنى التدرج وعدم القفز على التأسيس.',
        searchQuery: 'البناء المنهجي أحمد بن يوسف السيد المحاضرة الأولى',
      },
      {
        id: 'm1-r2',
        title: 'كتاب البوصلة القرآنية — أحمد بن يوسف السيد',
        type: 'كتاب',
        note: 'فصول ترتيب الأولويات الإيمانية والمنهجية في بناء الوعي.',
        searchQuery: 'كتاب البوصلة القرآنية أحمد بن يوسف السيد',
      },
      {
        id: 'm1-r3',
        title: 'كتاب التفكير العلمي — فؤاد زكريا (الفصل 1 و2)',
        type: 'كتاب',
        note: 'سمات التفكير العلمي ومعوقات التفكير النقدي في ثقافتنا.',
        searchQuery: 'كتاب التفكير العلمي فؤاد زكريا',
      },
    ],
    tasks: [
      { id: 'm1-t1', text: 'تثبيت أوقات الإيقاع الأسبوعي (مثلًا 30 دقيقة قراءة يوميًا + ساعة تلخيص أسبوعية).', track: 'action', done: false },
      { id: 'm1-t2', text: 'الاستماع لأول محاضرتين في «البناء المنهجي» وتدوين 5 قواعد لتجنب القراءة العشوائية.', track: 'foundational', done: false },
      { id: 'm1-t3', text: 'قراءة الفصل الأول والثاني من «التفكير العلمي» لفؤاد زكريا وتلخيص عقبات التفكير.', track: 'exploratory', done: false },
      { id: 'm1-t4', text: 'قراءة الثلث الأول من «البوصلة القرآنية» وكتابة بطاقة مقارنة بين الحفظ المجرد والبناء المنهجي.', track: 'foundational', done: false },
      { id: 'm1-t5', text: 'كتابة إجابة سؤال المناقشة في دفتر التلخيص وربطها بمبادئ الكورس الأول.', track: 'action', done: false },
    ],
  },
  {
    id: 2,
    quarter: 1,
    quarterTitle: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    theme: 'بناء المعنى الداخلي واتصال القلب بالفكر',
    foundational: {
      title: 'الطريق إلى القرآن',
      author: 'إبراهيم السكران',
      format: 'كتاب',
      domainId: 'islamic_thought',
      pace: '35 صفحة أسبوعيًا',
      focus: 'إحياء الصلة التأسيسية بالنص القرآني ومعالجة فتور التلقي.',
    },
    exploratory: {
      title: 'الإنسان يبحث عن المعنى',
      author: 'فيكتور فرانكل',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '35 صفحة أسبوعيًا',
      focus: 'كيف يمنح المعنى الإنسان صلابة نفسية في أشد الظروف؟',
    },
    courseId: 1,
    discussionPrompt: 'كيف يفسّر كل من السكران وفرانكل أزمة الفراغ الروحي والمعنى عند الإنسان المعاصر؟',
    applicationTask: 'تلخيص كتاب «الإنسان يبحث عن المعنى» في صفحتين ومناقشته مع صديق أو مجموعة قراءة.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm2-r1',
        title: 'كتاب الطريق إلى القرآن — إبراهيم السكران',
        type: 'كتاب',
        note: 'التركيز على فصول أسباب قسوة القلب وبواعث التدبر العملي.',
        searchQuery: 'كتاب الطريق إلى القرآن إبراهيم السكران',
      },
      {
        id: 'm2-r2',
        title: 'كتاب الإنسان يبحث عن المعنى — فيكتور فرانكل',
        type: 'كتاب',
        note: 'القسم الأول (تجربة المعتقل) ثم القسم الثاني (العلاج بالمعنى).',
        searchQuery: 'كتاب الإنسان يبحث عن المعنى فيكتور فرانكل',
      },
      {
        id: 'm2-r3',
        title: 'مناقشة صوتية لكتاب الطريق إلى القرآن',
        type: 'سلسلة محاضرات',
        note: 'استماع مرافق أثناء التنقل لتثبيت الأفكار الرئيسية.',
        searchQuery: 'مراجعة ومناقشة كتاب الطريق إلى القرآن إبراهيم السكران',
      },
    ],
    tasks: [
      { id: 'm2-t1', text: 'قراءة النصف الأول من «الطريق إلى القرآن» وتحديد أسباب «فتور التلقي».', track: 'foundational', done: false },
      { id: 'm2-t2', text: 'قراءة القسم السردي من «الإنسان يبحث عن المعنى» (حوالي 90 صفحة) بهدوء.', track: 'exploratory', done: false },
      { id: 'm2-t3', text: 'تلخيص الركائز الثلاث للمعنى عند فرانكل في بطاقة فكرية.', track: 'exploratory', done: false },
      { id: 'm2-t4', text: 'عقد جلسة نقاش (أو تسجيل صوتي ذاتي) لمقارنة مفهوم المعنى في الكتابين.', track: 'action', done: false },
    ],
  },
  {
    id: 3,
    quarter: 1,
    quarterTitle: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    theme: 'تذوق البيان العربي وفهم شروط النهضة',
    foundational: {
      title: 'شروط النهضة',
      author: 'مالك بن نبي',
      format: 'كتاب + محاضرات',
      domainId: 'society_history',
      pace: '30 صفحة أسبوعيًا + محاضرة تعريفية بمدرسة بن نبي',
      focus: 'معادلة الحضارة (الإنسان + التراب + الوقت) وأزمة القابلية للاستعمار.',
    },
    exploratory: {
      title: 'وحي القلم — مختارات الجزء الأول',
      author: 'مصطفى صادق الرافعي',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '3 مقالات أدبية أسبوعيًا بتمعن لغوي',
      focus: 'تربية الذائقة البيانية العربية وفهم عمق الصورة والأسلوب عند الرافعي.',
    },
    courseId: 2,
    discussionPrompt: 'لماذا يربط الرافعي بين قوة اللغة والبيان وبين نهضة الوعي عند مالك بن نبي؟',
    applicationTask: 'استخراج 10 تعبيرات بليغة من «وحي القلم» وإعادة صياغة فكرة معاصرة بأسلوب رصين.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm3-r1',
        title: 'كتاب شروط النهضة — مالك بن نبي',
        type: 'كتاب',
        note: 'مفاهيم الدورة الحضارية، القابلية للاستعمار، ومعادلة النهضة.',
        searchQuery: 'كتاب شروط النهضة مالك بن نبي',
      },
      {
        id: 'm3-r2',
        title: 'مدخل صوتي إلى مشروع مالك بن نبي الحضاري',
        type: 'سلسلة محاضرات',
        note: 'محاضرات شارحة لفكرة عالم الأشخاص وعالم الأفكار وعالم الأشياء.',
        searchQuery: 'محاضرات شرح مشروع مالك بن نبي شروط النهضة',
      },
      {
        id: 'm3-r3',
        title: 'وحي القلم (الجزء الأول) — مصطفى صادق الرافعي',
        type: 'كتاب',
        note: 'ابدأ بمقالات مثل «سمو النفس» و«في اللهب ولا تحترق» و«فلسفة الصوم».',
        searchQuery: 'وحي القلم الجزء الأول مصطفى صادق الرافعي',
      },
    ],
    tasks: [
      { id: 'm3-t1', text: 'الاستماع لمحاضرة تمهيدية عن فكر مالك بن نبي قبل البدء في «شروط النهضة».', track: 'foundational', done: false },
      { id: 'm3-t2', text: 'تلخيص معادلة الحضارة (الإنسان + التراب + الوقت) وأمثلتها الواقعية.', track: 'foundational', done: false },
      { id: 'm3-t3', text: 'قراءة 6 مقالات منتقاة من «وحي القلم» وتدوين 10 أساليب بلاغية لافتة.', track: 'exploratory', done: false },
      { id: 'm3-t4', text: 'كتابة فقرة نقدية من 200 كلمة تطبق قواعد التفكير النقدي (الكورس 2) بأسلوب عربي متين.', track: 'action', done: false },
    ],
  },
  {
    id: 4,
    quarter: 2,
    quarterTitle: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    theme: 'أسئلة الوجود والعقل وتجديد الفكر',
    foundational: {
      title: 'شموع النهار + محاضرات نقد الخطاب المعاصر',
      author: 'عبدالله العجيري',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: '35 صفحة أسبوعيًا + محاضرة أسبوعية',
      focus: 'مناقشة الإشكالات العقدية والأسئلة الكبرى بأدوات عقلية هادئة.',
    },
    exploratory: {
      title: 'تجديد الفكر العربي',
      author: 'زكي نجيب محمود',
      format: 'كتاب',
      domainId: 'philosophy',
      pace: '30 صفحة أسبوعيًا',
      focus: 'كيف يتعامل العقل العربي مع التراث العلمي والفلسفي في ضوء الحاضر؟',
    },
    courseId: 2,
    discussionPrompt: 'أين يتفق العجيري وزكي نجيب محمود في أهمية الصرامة العقلية، وأين تختلف منطلقاتهما الفلسفية؟',
    applicationTask: 'كتابة ورقة مقارنة من صفحة واحدة حول «التوفيق بين الأصالة المنهجية والتجديد».',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm4-r1',
        title: 'كتاب شموع النهار — عبدالله العجيري',
        type: 'كتاب',
        note: 'التركيز على أدلة الإيمان الكلية وكيفية بناء اليقين العقلي.',
        searchQuery: 'كتاب شموع النهار عبدالله العجيري',
      },
      {
        id: 'm4-r2',
        title: 'محاضرات عبدالله العجيري في قضايا الإلحاد والمعرفة',
        type: 'سلسلة محاضرات',
        note: 'متابعة الحلقات التطبيقية في نقض الشبهات الفلسفية.',
        searchQuery: 'محاضرات عبدالله العجيري شموع النهار',
      },
      {
        id: 'm4-r3',
        title: 'كتاب تجديد الفكر العربي — زكي نجيب محمود',
        type: 'كتاب',
        note: 'قراءة نقدية متوازنة: نستفيد من صرامته التحليلية ونناقش حدود الوضعية المنطقية.',
        searchQuery: 'كتاب تجديد الفكر العربي زكي نجيب محمود',
      },
    ],
    tasks: [
      { id: 'm4-t1', text: 'رسم خريطة للأدلة العقلية الواردة في «شموع النهار».', track: 'foundational', done: false },
      { id: 'm4-t2', text: 'قراءة الفصول الأولى من «تجديد الفكر العربي» وتحديد موقف زكي نجيب محمود من التراث.', track: 'exploratory', done: false },
      { id: 'm4-t3', text: 'كتابة ورقة مقارنة من صفحة واحدة بين منطلقات العجيري ومنطلقات زكي نجيب محمود.', track: 'action', done: false },
    ],
  },
  {
    id: 5,
    quarter: 2,
    quarterTitle: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    theme: 'سيكولوجيا الحرية والانحيازات العقلية',
    foundational: {
      title: 'التفكير السريع والبطيء (النظام 1 والنظام 2)',
      author: 'دانيال كانيمان',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '40 صفحة أسبوعيًا (النصف الأول)',
      focus: 'فهم كيف تقودنا البديهة السريعة إلى أخطاء في الحكم والتقدير.',
    },
    exploratory: {
      title: 'فن الحب / مدخل إلى الخوف من الحرية',
      author: 'إريك فروم',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '25 صفحة أسبوعيًا',
      focus: 'تحليل العلاقة بين النضج الإنساني والحب المسؤول بعيدًا عن التملك.',
    },
    courseId: 3,
    discussionPrompt: 'متى نحتاج إلى إيقاف «النظام السريع» في أحكامنا على الناس والأفكار؟',
    applicationTask: 'رصد 3 انحيازات إدراكية وقعت فيها خلال الأسبوع وتدوين آلية تصحيحها.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm5-r1',
        title: 'كتاب التفكير السريع والبطيء — دانيال كانيمان (الأجزاء 1–2)',
        type: 'كتاب',
        note: 'اقرأ بتأنٍّ مع تسجيل التجارب النفسية البسيطة في هامش الكتاب.',
        searchQuery: 'كتاب التفكير السريع والبطيء دانيال كانيمان',
      },
      {
        id: 'm5-r2',
        title: 'كتاب فن الحب — إريك فروم',
        type: 'كتاب',
        note: 'كتاب قصير وعميق عن النضج العاطفي والاهتمام والمسؤولية.',
        searchQuery: 'كتاب فن الحب إريك فروم',
      },
    ],
    tasks: [
      { id: 'm5-t1', text: 'تلخيص الفروق بين النظام 1 (السريع التلقائي) والنظام 2 (البطيء التحليلي).', track: 'foundational', done: false },
      { id: 'm5-t2', text: 'قراءة «فن الحب» لإريك فروم وتحديد العناصر الأربعة للحب الناضج.', track: 'exploratory', done: false },
      { id: 'm5-t3', text: 'تدوين 3 مواقف شخصية انخدعت فيها بتحيز الإرساء أو التوفر وتصحيحها.', track: 'action', done: false },
    ],
  },
  {
    id: 6,
    quarter: 2,
    quarterTitle: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    theme: 'عبقرية المكان وتجربة الإدارة الواقعية',
    foundational: {
      title: 'شخصية مصر: دراسة في عبقرية المكان (المدخل والمفاهيم الأساسية)',
      author: 'جمال حمدان',
      format: 'كتاب + محاضرات',
      domainId: 'society_history',
      pace: '35 صفحة مختارة أسبوعيًا + محاضرات تعريفية بفكر جمال حمدان',
      focus: 'اكتشاف كيف تصنع الجغرافيا والتاريخ ملامح الشخصية المجتمعية والسياسية.',
    },
    exploratory: {
      title: 'حياة في الإدارة',
      author: 'غازي القصيبي',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '40 صفحة أسبوعيًا',
      focus: 'القيادة الواقعية، التعامل مع البيروقراطية، وأخلاقيات المسؤولية.',
    },
    courseId: 4,
    discussionPrompt: 'كيف تؤثر البيئة الجغرافية والتاريخية التي يصفها جمال حمدان في تحديات الإدارة التي واجهها غازي القصيبي؟',
    applicationTask: 'استخلاص 5 دروس إدارية من «حياة في الإدارة» وربطها بالكورس الرابع.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm6-r1',
        title: 'شخصية مصر (النسخة الموجزة أو المجلد الأول — المدخل)',
        type: 'كتاب',
        note: 'ممتاز كمدخل قبل التوسع في الأجزاء التفصيلية للموسوعة.',
        searchQuery: 'شخصية مصر جمال حمدان النسخة الموجزة',
      },
      {
        id: 'm6-r2',
        title: 'وثائقي ومحاضرات تعريفية بجمال حمدان ومنهجه الجغرافي',
        type: 'سلسلة محاضرات',
        note: 'تساعدك على تخيل الخرائط والمفاهيم الجيوسياسية التي يكتب عنها.',
        searchQuery: 'منهج جمال حمدان في شخصية مصر محاضرة',
      },
      {
        id: 'm6-r3',
        title: 'كتاب حياة في الإدارة — غازي القصيبي',
        type: 'كتاب',
        note: 'قراءة ممتعة ومباشرة، دوّن المواقف الإدارية القابلة للتطبيق فورًا.',
        searchQuery: 'كتاب حياة في الإدارة غازي القصيبي',
      },
    ],
    tasks: [
      { id: 'm6-t1', text: 'الاستماع لمحاضرة تعريفية عن منهج جمال حمدان في «شخصية مصر».', track: 'foundational', done: false },
      { id: 'm6-t2', text: 'قراءة الفصول التأسيسية حول «عبقرية المكان» وتدوين 4 مفاهيم جغرافية-اجتماعية.', track: 'foundational', done: false },
      { id: 'm6-t3', text: 'قراءة «حياة في الإدارة» للقصيبي واستخلاص 5 دروس قيادية للكورس الرابع.', track: 'exploratory', done: false },
    ],
  },
  {
    id: 7,
    quarter: 3,
    quarterTitle: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    theme: 'سنن العمران ونقد المقولات المعاصرة',
    foundational: {
      title: 'سلسلة التأسيس العقدي والظاهرة الإلحادية والحريات',
      author: 'سلطان العميري',
      format: 'سلسلة محاضرات',
      domainId: 'islamic_thought',
      pace: 'محاضرتان أسبوعيًا مع تفريغ أو تلخيص النقاط',
      focus: 'التدقيق المفاهيمي في قضايا الحرية، الدليل العقدي، والمذاهب الفكرية.',
    },
    exploratory: {
      title: 'مقدمة ابن خلدون (مختارات العمران والعصبية)',
      author: 'ابن خلدون',
      format: 'كتاب + محاضرات',
      domainId: 'society_history',
      pace: '25 صفحة مشروحة أسبوعيًا + درس شارح للمقدمة',
      focus: 'فهم قانون العصبية وأطوار الدول ومنهج التحقق التاريخي.',
    },
    courseId: 4,
    discussionPrompt: 'كيف تسهم القراءة الخلدونية لسنن المجتمعات في ضبط النقاشات المعاصرة حول الحرية والدولة؟',
    applicationTask: 'بناء خريطة ذهنية لأطوار الدولة والعمران عند ابن خلدون ومقارنتها بواقع معاصر.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm7-r1',
        title: 'محاضرات الدكتور سلطان العميري (فضاءات الحرية / التأصيل العقدي)',
        type: 'سلسلة محاضرات',
        note: 'ركّز على ضبط المصطلحات قبل مناقشة أي قضية فكرية.',
        searchQuery: 'محاضرات سلطان العميري فضاءات الحرية',
      },
      {
        id: 'm7-r2',
        title: 'مقدمة ابن خلدون (طبعة مشروحة أو مختصر المقدمة)',
        type: 'كتاب',
        note: 'التركيز على الباب الأول والثاني والثالث (العمران والعصبية والدول).',
        searchQuery: 'شرح مقدمة ابن خلدون العصبية والعمران',
      },
    ],
    tasks: [
      { id: 'm7-t1', text: 'الاستماع لمحاضرتين لسلطان العميري مع تدوين تعريف دقيق لمفهوم الحرية المنضبطة.', track: 'foundational', done: false },
      { id: 'm7-t2', text: 'قراءة أخطاء المؤرخين في مقدمة ابن خلدون وتلخيص قواعد التثبت من الأخبار.', track: 'exploratory', done: false },
      { id: 'm7-t3', text: 'رسم مخطط لأطوار الدولة الخمسة عند ابن خلدون.', track: 'action', done: false },
    ],
  },
  {
    id: 8,
    quarter: 3,
    quarterTitle: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    theme: 'النموذج المعرفي وإشكالية التحيز',
    foundational: {
      title: 'رحلتي الفكرية + مدخل إشكالية التحيز',
      author: 'عبد الوهاب المسيري',
      format: 'كتاب + محاضرات',
      domainId: 'philosophy',
      pace: '35 صفحة أسبوعيًا + محاضرة حول التحيز المعرفي',
      focus: 'تتبع التحول الفكري للمسيري وفهم معنى «النموذج المعرفي الكامن».',
    },
    exploratory: {
      title: 'التفكير السريع والبطيء (الجزء الثاني: الاحتمالات والاختيار)',
      author: 'دانيال كانيمان',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '35 صفحة أسبوعيًا',
      focus: 'استكمال فهم التحيزات في التوقعات واتخاذ القرار تحت عدم اليقين.',
    },
    courseId: 3,
    discussionPrompt: 'ما العلاقة بين «التحيز المعرفي» عند المسيري و«الانحيازات الإدراكية» عند كانيمان؟',
    applicationTask: 'تحليل مصطلح شائع في الإعلام أو الإدارة وكشف التحيز المعرفي الكامن خلفه.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm8-r1',
        title: 'كتاب رحلتي الفكرية: في البذور والجذور والثمر — عبد الوهاب المسيري',
        type: 'كتاب',
        note: 'مقدمة رائعة لفهم تحولات المسيري ونقده للعلمانية الشاملة.',
        searchQuery: 'كتاب رحلتي الفكرية عبد الوهاب المسيري',
      },
      {
        id: 'm8-r2',
        title: 'محاضرة: النموذج المعرفي وإشكالية التحيز — عبد الوهاب المسيري',
        type: 'سلسلة محاضرات',
        note: 'توضح كيف تتخفى الرؤية الفلسفية داخل المصطلحات «المحايدة» ظاهرًا.',
        searchQuery: 'محاضرة إشكالية التحيز عبد الوهاب المسيري',
      },
    ],
    tasks: [
      { id: 'm8-t1', text: 'تلخيص معنى «النموذج المعرفي» و«العلمانية الجزئية مقابل الشاملة» عند المسيري.', track: 'foundational', done: false },
      { id: 'm8-t2', text: 'استكمال النصف الثاني من «التفكير السريع والبطيء» لكانيمان.', track: 'exploratory', done: false },
      { id: 'm8-t3', text: 'تطبيق عملي: تفكيك 3 مصطلحات شائعة وكشف الفرضيات الكامنة خلفها.', track: 'action', done: false },
    ],
  },
  {
    id: 9,
    quarter: 3,
    quarterTitle: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    theme: 'صناعة الأفكار وبلاغة الموقف',
    foundational: {
      title: 'مشكلة الأفكار في العالم الإسلامي',
      author: 'مالك بن نبي',
      format: 'كتاب',
      domainId: 'society_history',
      pace: '30 صفحة أسبوعيًا',
      focus: 'التمييز بين الأفكار المطبوعة والأفكار الموضوعة، ودور الفكرة الميتة والقاتلة.',
    },
    exploratory: {
      title: 'تحت راية القرآن (أو مختارات وحي القلم ج2)',
      author: 'مصطفى صادق الرافعي',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '30 صفحة أسبوعيًا',
      focus: 'استيعاب معركة التجديد والبيان في مطلع القرن العشرين وأسلوب الرافعي الجدلي.',
    },
    courseId: 5,
    discussionPrompt: 'كيف يحوّل الكاتب «الفكرة الحية» إلى بيان مؤثر دون أن يسقط في الإنشائية الفارغة؟',
    applicationTask: 'كتابة نص تعبيري أو عرض شرائح قصير حول فكرة «عالم الأفكار وعالم الأشياء».',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm9-r1',
        title: 'كتاب مشكلة الأفكار في العالم الإسلامي — مالك بن نبي',
        type: 'كتاب',
        note: 'التركيز على فصول الأفكار المطبوعة والموضوعة والأفكار المميتة.',
        searchQuery: 'مشكلة الأفكار في العالم الإسلامي مالك بن نبي',
      },
      {
        id: 'm9-r2',
        title: 'تحت راية القرآن / وحي القلم ج2 — مصطفى صادق الرافعي',
        type: 'كتاب',
        note: 'ملاحظة كيفية دفاع الرافعي عن الهوية اللغوية والأدبية.',
        searchQuery: 'تحت راية القرآن مصطفى صادق الرافعي',
      },
    ],
    tasks: [
      { id: 'm9-t1', text: 'تلخيص الفرق بين الفكرة الحية والفكرة الميتة والفكرة القاتلة عند مالك بن نبي.', track: 'foundational', done: false },
      { id: 'm9-t2', text: 'قراءة مختارات من «تحت راية القرآن» أو «وحي القلم ج2» للرافعي.', track: 'exploratory', done: false },
      { id: 'm9-t3', text: 'كتابة مقال تطبيقي (400 كلمة) يدمج وضوح الفكرة مع رصانة البيان.', track: 'action', done: false },
    ],
  },
  {
    id: 10,
    quarter: 4,
    quarterTitle: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    theme: 'النقد الثقافي وتجدد التراث وفقه الواقع',
    foundational: {
      title: 'مآلات الخطاب المدني + محاضرات فقه الواقع الفكري',
      author: 'إبراهيم السكران وعبدالله العجيري',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: '30 صفحة أسبوعيًا + محاضرتان في تحليل التيارات',
      focus: 'قراءة التحولات الثقافية في الخطاب المعاصر بعين ناقدة متزنة.',
    },
    exploratory: {
      title: 'المعقول واللامعقول في تراثنا الفكري (مختارات)',
      author: 'زكي نجيب محمود',
      format: 'كتاب',
      domainId: 'philosophy',
      pace: '30 صفحة أسبوعيًا',
      focus: 'التعرف على الجدل الفكري حول العقلانية في التراث ومناقشته بموضوعية.',
    },
    courseId: 5,
    discussionPrompt: 'كيف نناقش أطروحة فكرية تخالفنا دون اختزالها أو التسرع في الحكم عليها؟',
    applicationTask: 'إعداد ملخص حواري متوازن يعرض وجهة نظر زكي نجيب محمود ومناقشة السكران لها.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm10-r1',
        title: 'كتاب مآلات الخطاب المدني — إبراهيم السكران',
        type: 'كتاب',
        note: 'مراجعة التحولات الفكرية بأسلوب رصين موثق.',
        searchQuery: 'كتاب مآلات الخطاب المدني إبراهيم السكران',
      },
      {
        id: 'm10-r2',
        title: 'المعقول واللامعقول في تراثنا الفكري — زكي نجيب محمود',
        type: 'كتاب',
        note: 'قراءة متأنية لتمييز جوانب الاتفاق والاختلاف المنهجي.',
        searchQuery: 'المعقول واللامعقول زكي نجيب محمود',
      },
    ],
    tasks: [
      { id: 'm10-t1', text: 'قراءة «مآلات الخطاب المدني» وتلخيص منهجية تتبع تطور الأفكار.', track: 'foundational', done: false },
      { id: 'm10-t2', text: 'قراءة 4 فصول مختارة من «المعقول واللامعقول» لزكي نجيب محمود.', track: 'exploratory', done: false },
      { id: 'm10-t3', text: 'التدرب على «صياغة حجة الخصم بأقوى صورة لها» قبل الرد عليها كتابيًا.', track: 'action', done: false },
    ],
  },
  {
    id: 11,
    quarter: 4,
    quarterTitle: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    theme: 'التجارب الإنسانية العابرة للثقافات والجغرافيا',
    foundational: {
      title: 'استراتيجية الاستعمار والتحرير (أو مختارات متقدمة من شخصية مصر)',
      author: 'جمال حمدان',
      format: 'كتاب',
      domainId: 'society_history',
      pace: '35 صفحة أسبوعيًا',
      focus: 'قراءة الخرائط الجيوسياسية وفهم صراعات النفوذ والاستقلال.',
    },
    exploratory: {
      title: 'الطريق إلى مكة (أو سيرة إنسانية عالمية مختارة)',
      author: 'محمد أسد (تجارب إنسانية متنوعة)',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '45 صفحة أسبوعيًا',
      focus: 'معايشة رحلة روحية وفكرية بين الثقافة الأوروبية والعالم الإسلامي.',
    },
    courseId: 6,
    discussionPrompt: 'ماذا تضيف السيرة الذاتية العابرة للثقافات إلى التحليل الجيوسياسي عند جمال حمدان؟',
    applicationTask: 'تسجيل مراجعة صوتية أو مكتوبة من 5 دقائق تربط السيرة الإنسانية بالسياق التاريخي.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm11-r1',
        title: 'استراتيجية الاستعمار والتحرير — جمال حمدان',
        type: 'كتاب',
        note: 'قراءة تحليلية رائدة لخرائط القوى الدولية وعوامل التحرر.',
        searchQuery: 'استراتيجية الاستعمار والتحرير جمال حمدان',
      },
      {
        id: 'm11-r2',
        title: 'الطريق إلى مكة — محمد أسد',
        type: 'كتاب',
        note: 'من أجمل التجارب الإنسانية والفكرية في القرن العشرين.',
        searchQuery: 'كتاب الطريق إلى مكة محمد أسد',
      },
    ],
    tasks: [
      { id: 'm11-t1', text: 'تلخيص الخريطة الاستراتيجية التي رسمها جمال حمدان في الكتاب.', track: 'foundational', done: false },
      { id: 'm11-t2', text: 'قراءة رحلة محمد أسد وتدوين محطات التحول العقلي والروحي فيها.', track: 'exploratory', done: false },
      { id: 'm11-t3', text: 'كتابة خلاصة مقارنة بين النظرة الجغرافية الكلية والتجربة الفردية.', track: 'action', done: false },
    ],
  },
  {
    id: 12,
    quarter: 4,
    quarterTitle: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    theme: 'الحصاد المعرفي والتركيب والمراجعة الشاملة',
    foundational: {
      title: 'رقائق القرآن + استكمال سلسلة البناء المنهجي',
      author: 'إبراهيم السكران وأحمد بن يوسف السيد',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: 'قراءة هادئة ومراجعة شاملة لدفاتر التلخيص',
      focus: 'تجديد البوصلة الروحية وتقييم ما تغيّر في طريقة التفكير خلال العام.',
    },
    exploratory: {
      title: 'المشروع الختامي: تركيب الأفكار بين المحاور الستة',
      author: 'مراجعة ذاتية وكتابات المستخدم',
      format: 'كتاب + محاضرات',
      domainId: 'personal_dev',
      pace: 'مراجعة 3 دفاتر تلخيص أسبوعيًا + جلسة مناقشة ختامية',
      focus: 'تجميع المخرجات الفكرية من الكورسات والكتب في خريطة وعي متماسكة.',
    },
    courseId: 6,
    discussionPrompt: 'ما أبرز ثلاث أفكار غيّرت نظرتك إلى الإنسان أو الواقع أو الدين خلال الـ 12 شهرًا؟',
    applicationTask: 'كتابة «بيان الحصاد السنوي» وتصدير النسخة الكاملة لملف Excel كمرجع شخصي.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
    resources: [
      {
        id: 'm12-r1',
        title: 'كتاب رقائق القرآن — إبراهيم السكران',
        type: 'كتاب',
        note: 'ختام روحي هادئ يوازن الجهد الفكري والعقلي خلال العام.',
        searchQuery: 'كتاب رقائق القرآن إبراهيم السكران',
      },
      {
        id: 'm12-r2',
        title: 'مراجعة كل دفاتر التلخيص ونوتس الكتب الخاصة بك',
        type: 'أداة تطبيق',
        note: 'استخرج أهم 10 أفكار ستكمل معك في السنة الثانية.',
        searchQuery: 'طريقة مراجعة ملاحظات القراءة السنوية',
      },
    ],
    tasks: [
      { id: 'm12-t1', text: 'قراءة «رقائق القرآن» بروح هادئة ومراجعة التوازن الإيماني والفكري.', track: 'foundational', done: false },
      { id: 'm12-t2', text: 'مراجعة نوتس جميع الكتب التي قرأتها وتجميع أفضل 10 أفكار في وثيقة الحصاد.', track: 'action', done: false },
      { id: 'm12-t3', text: 'تصدير ملف Excel النهائي ووضع ملامح خطة السنة الثانية بناءً على اهتماماتك الجديدة.', track: 'action', done: false },
    ],
  },
];

export const INITIAL_CUSTOM_CATEGORIES: CustomCategory[] = [
  {
    id: 'cat-core-reading',
    title: 'قراءات تأسيسية',
    description: 'أمهات الكتب والمصادر المنهجية التي أعود إليها باستمرار.',
    color: 'navy',
    createdAtLabel: 'تصنيف افتراضي',
  },
  {
    id: 'cat-courses-lectures',
    title: 'محاضرات وتطبيق عملي',
    description: 'تلخيصات المحاضرات ومشاريع الكورسات اليومية.',
    color: 'emerald',
    createdAtLabel: 'تصنيف افتراضي',
  },
  {
    id: 'cat-review-later',
    title: 'أفكار للمناقشة والمراجعة',
    description: 'أسئلة نقاشية وتأملات تستحق المتابعة والحوار.',
    color: 'amber',
    createdAtLabel: 'تصنيف افتراضي',
  },
];

export const INITIAL_BOOK_NOTES: BookNote[] = [
  {
    id: 'bn-sample-1',
    noteType: 'book',
    bookTitle: 'البوصلة القرآنية / التفكير العلمي (بداية الشهر 1)',
    author: 'أحمد بن يوسف السيد / فؤاد زكريا',
    courseId: 0,
    courseTitle: '',
    lectureTitle: '',
    categoryLabel: 'قراءات تأسيسية',
    progressMarker: 'الأسبوع الأول — المقدمات التأسيسية',
    content:
      'القاعدة الأساسية التي استوقفتني: كثرة القراءة بدون منهج تشبه تجميع أحجار بدون مخطط هندسي. البناء يبدأ بتحديد الأولويات ثم اختيار المصادر الموثوقة وتلخيصها بلغتنا الخاصة.',
    quotes: '«ليست العبرة بكمّ الكتب التي تمر عليها، بل بمدى قدرتك على فهم الأفكار والربط بينها ومناقشتها».',
    updatedAt: 'مثال استرشادي — يمكنك تعديله أو إضافة كتب جديدة',
  },
];

export const WEEKLY_RHYTHM: WeeklyRhythmSlot[] = [
  {
    id: 'reading',
    pillar: 'القراءة المتأنية',
    suggestedDuration: '3.5 ساعات أسبوعيًا',
    focus: 'كتاب المسار التأسيسي + كتاب المسار الاستكشافي',
    guideline: '30–40 دقيقة يوميًا بوتيرة هادئة دون التزام بعدد صفحات قسري.',
  },
  {
    id: 'listening',
    pillar: 'الاستماع والمحاضرات',
    suggestedDuration: '1.5 ساعة أسبوعيًا',
    focus: 'سلاسل البناء المنهجي أو المحاضرات الفلسفية والتاريخية',
    guideline: 'استغلال أوقات التنقل مع تدوين نقطة محورية واحدة بعد كل محاضرة.',
  },
  {
    id: 'summarizing',
    pillar: 'التلخيص والبطاقات الفكرية',
    suggestedDuration: '1 ساعة أسبوعيًا',
    focus: 'تحويل المقروء والمسموع إلى أفكار خاصة بك',
    guideline: 'كتابة خلاصة من 5 أسطر بلغتك الخاصة لا بنقل العبارات حرفيًا.',
  },
  {
    id: 'discussing',
    pillar: 'المناقشة والتطبيق',
    suggestedDuration: '1 ساعة أسبوعيًا',
    focus: 'حوار مع صديق أو ربط بكورس التطوير الشخصي',
    guideline: 'اختبار الفكرة في الواقع: سؤال نقاشي + خطوة عملية من الكورس المرتبط.',
  },
];

// ============================================================================
// Natural Arabic/English & Manual Sorting Helpers
// ============================================================================

export function normalizeArabicDigits(input: string): string {
  return (input || '')
    .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
    .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
}

export function extractNaturalSortNumber(title: string): number | null {
  const normalized = normalizeArabicDigits(title);
  // Prefer number next to lecture/lesson/session/unit/module/chapter keywords first
  const labeledMatch = normalized.match(
    /(?:lecture|lesson|module|session|part|ch(?:apter)?|unit|week|sec(?:tion)?|video|ep(?:isode)?|محاضرة|الدرس|درس|الحلقة|حلقة|الوحدة|وحدة|فصل|الفصل|جزء|الجزء|باب|الباب|أسبوع|الأسبوع|رقم)\s*[-:#.]*\s*(\d+)/i
  );
  if (labeledMatch) {
    const n = Number(labeledMatch[1]);
    if (Number.isFinite(n)) return n;
  }
  // Prefer leading number like "10. Intro" or "02 - ..."
  const leadingMatch = normalized.match(/^\s*#?(\d+)(?:\s*[-.:)/]|\s|$)/);
  if (leadingMatch) {
    const n = Number(leadingMatch[1]);
    if (Number.isFinite(n)) return n;
  }
  const ordinals: Array<[RegExp, number]> = [
    [/الأول|الاول|أولى|اولى/, 1],
    [/الثاني|الثانية/, 2],
    [/الثالث|الثالثة/, 3],
    [/الرابع|الرابعة/, 4],
    [/الخامس|الخامسة/, 5],
    [/السادس|السادسة/, 6],
    [/السابع|السابعة/, 7],
    [/الثامن|الثامنة/, 8],
    [/التاسع|التاسعة/, 9],
    [/العاشر|العاشرة/, 10],
  ];
  for (const [rx, num] of ordinals) {
    if (rx.test(normalized)) return num;
  }
  const allMatches = normalized.match(/(\d+)/g);
  if (allMatches && allMatches.length > 0) {
    // Use the last number when multiple numbers appear (e.g., "Course 2 - 10")
    const n = Number(allMatches[allMatches.length - 1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function compareNaturalArabic(a: string, b: string): number {
  const na = normalizeArabicDigits(a).trim();
  const nb = normalizeArabicDigits(b).trim();
  // Tokenize into alternating numeric & non-numeric chunks so "Lecture 2" < "Lecture 10" < "Lecture 20"
  const tokenize = (s: string) => s.match(/(\d+|[^\d]+)/g) || [];
  const ta = tokenize(na);
  const tb = tokenize(nb);
  const len = Math.min(ta.length, tb.length);
  for (let i = 0; i < len; i += 1) {
    const ca = ta[i];
    const cb = tb[i];
    const isNumA = /^\d+$/.test(ca);
    const isNumB = /^\d+$/.test(cb);
    if (isNumA && isNumB) {
      const diff = Number(ca) - Number(cb);
      if (diff !== 0) return diff;
      if (ca.length !== cb.length) return ca.length - cb.length;
    } else {
      const cmp = ca.localeCompare(cb, 'ar', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }
  return ta.length - tb.length;
}

export function sortCoursesList(
  items: PersonalCourse[],
  mode: EntitySortMode
): PersonalCourse[] {
  const list = [...items];
  if (mode === 'title') {
    return list.sort((a, b) => compareNaturalArabic(a.title, b.title));
  }
  if (mode === 'stage') {
    const order: Record<CourseStudyStage, number> = {
      focus_now: 0,
      in_progress: 1,
      scheduled_later: 2,
      heard_before: 3,
      deferred: 4,
      completed: 5,
    };
    return list.sort((a, b) => {
      const sa = order[resolveCourseStudyStage(a)] ?? 9;
      const sb = order[resolveCourseStudyStage(b)] ?? 9;
      if (sa !== sb) return sa - sb;
      return compareNaturalArabic(a.title, b.title);
    });
  }
  if (mode === 'updated') {
    return list.sort((a, b) => b.id - a.id);
  }
  return list.sort((a, b) => {
    const oa = a.sortOrder ?? 0;
    const ob = b.sortOrder ?? 0;
    if (oa !== ob) return oa - ob;
    return a.id - b.id;
  });
}

function compareNotesLogical(a: BookNote, b: BookNote): number {
  const ta = (a.lectureTitle || a.bookTitle || '').trim();
  const tb = (b.lectureTitle || b.bookTitle || '').trim();
  const na = extractNaturalSortNumber(ta);
  const nb = extractNaturalSortNumber(tb);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  const cmp = compareNaturalArabic(ta, tb);
  if (cmp !== 0) return cmp;
  return (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
}

export function sortBookNotesList(
  items: BookNote[],
  mode: EntitySortMode
): BookNote[] {
  const list = [...items];
  if (mode === 'logical') {
    return list.sort(compareNotesLogical);
  }
  if (mode === 'title') {
    return list.sort((a, b) =>
      compareNaturalArabic(a.lectureTitle || a.bookTitle, b.lectureTitle || b.bookTitle)
    );
  }
  if (mode === 'updated') {
    return list.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }
  // manual default: explicit non-zero sortOrder ascending, then logical natural order
  return list.sort((a, b) => {
    const oa = a.sortOrder ?? 0;
    const ob = b.sortOrder ?? 0;
    if (oa !== ob) return oa - ob;
    return compareNotesLogical(a, b);
  });
}

export function sortLearningPathsList(
  items: LearningPath[],
  mode: EntitySortMode
): LearningPath[] {
  const list = [...items];
  if (mode === 'title') {
    return list.sort((a, b) => compareNaturalArabic(a.title, b.title));
  }
  if (mode === 'progress') {
    return list.sort((a, b) => (b.progressPct ?? 0) - (a.progressPct ?? 0));
  }
  return list.sort((a, b) => {
    const oa = a.sortOrder ?? 0;
    const ob = b.sortOrder ?? 0;
    if (oa !== ob) return oa - ob;
    return compareNaturalArabic(a.title, b.title);
  });
}

export function sortReadingItemsList(
  items: ReadingLibraryItem[],
  mode: EntitySortMode
): ReadingLibraryItem[] {
  const list = [...items];
  if (mode === 'title') {
    return list.sort((a, b) => compareNaturalArabic(a.title, b.title));
  }
  if (mode === 'stage') {
    const order: Record<ReadingItemStatus, number> = {
      reading: 0,
      to_read: 1,
      completed: 2,
    };
    return list.sort((a, b) => {
      const d = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (d !== 0) return d;
      return compareNaturalArabic(a.title, b.title);
    });
  }
  return list.sort((a, b) => {
    const oa = a.sortOrder ?? 0;
    const ob = b.sortOrder ?? 0;
    if (oa !== ob) return oa - ob;
    return compareNaturalArabic(a.title, b.title);
  });
}
