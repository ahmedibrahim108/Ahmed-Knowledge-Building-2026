export type DomainId = string;

export type LearningHubId = 'marketing' | 'dental_career' | 'knowledge';

export type ReadingMode =
  | 'surface'
  | 'survey'
  | 'deep'
  | 'applied'
  | 'breakdown';

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

export const LEARNING_HUBS: LearningHubMeta[] = [
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

export const READING_MODES_META: Array<{
  id: ReadingMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
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

export function addDaysToDateKey(baseDateKey: string, days: number): string {
  const [y, m, d] = baseDateKey.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, (d || 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getHubMeta(hubId?: LearningHubId): LearningHubMeta {
  return (
    LEARNING_HUBS.find((h) => h.id === hubId) ??
    LEARNING_HUBS[2]
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
export type UnifiedTaskStatus = 'todo' | 'in_progress' | 'done';

export interface UnifiedTask {
  id: string;
  title: string;
  description: string;
  hubId: LearningHubId;
  categoryLabel: string;
  priority: TaskPriority;
  status: UnifiedTaskStatus;
  dueDate: string;
  linkedLabel?: string;
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
    | 'tasks';
  targetNoteId?: string;
  targetMonthId?: number;
  targetCourseId?: number;
  timestampLabel: string;
  createdAtMs: number;
}

export type ReflectionMood = 'تأمل' | 'فكرة' | 'امتنان' | 'هدف';

export interface PersonalReflection {
  id: string;
  title: string;
  content: string;
  moodTag: ReflectionMood;
  pinned: boolean;
  createdAtLabel: string;
  createdAtMs: number;
}

export type CalendarCategory = 'شخصي' | 'دراسة' | 'موعد' | 'مراجعة' | 'قراءة';
export type CalendarColor = 'navy' | 'emerald' | 'amber' | 'rose';

export interface CalendarEvent {
  id: string;
  dateKey: string; // YYYY-MM-DD
  timeSlot: string;
  title: string;
  notes: string;
  category: CalendarCategory;
  color: CalendarColor;
  done: boolean;
  linkedTaskText?: string;
}

export type HighlightColorKey = 'amber' | 'emerald' | 'sky' | 'rose';
export type VoiceDialectMode = 'standard_arabic' | 'egyptian_arabic' | 'bilingual';
export type VoiceInsertMode = 'append_paragraph' | 'append_bullet' | 'append_quote';
export type ReadAloudVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface UserPreferences {
  noteFontSize: 'sm' | 'base' | 'lg';
  noteHighlightColor: HighlightColorKey;
  notePaperTone: 'clean' | 'warm' | 'slate';
  autoAddTimestampOnVoice: boolean;
  voiceDialect: VoiceDialectMode;
  voiceInsertMode: VoiceInsertMode;
  readAloudVoice: ReadAloudVoiceName;
  readAloudSpeed: 'normal' | 'calm';
  showExcelExport?: boolean;
  hubCategories?: Record<LearningHubId, string[]>;
}

export const DEFAULT_HUB_CATEGORIES: Record<LearningHubId, string[]> = {
  marketing: LEARNING_HUBS[0].defaultCategories,
  dental_career: LEARNING_HUBS[1].defaultCategories,
  knowledge: LEARNING_HUBS[2].defaultCategories,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  noteFontSize: 'base',
  noteHighlightColor: 'amber',
  notePaperTone: 'clean',
  autoAddTimestampOnVoice: false,
  voiceDialect: 'standard_arabic',
  voiceInsertMode: 'append_paragraph',
  readAloudVoice: 'Kore',
  readAloudSpeed: 'normal',
  showExcelExport: true,
  hubCategories: DEFAULT_HUB_CATEGORIES,
};

export interface WeeklyRhythmSlot {
  id: string;
  pillar: string;
  suggestedDuration: string;
  focus: string;
  guideline: string;
}

export const HERO_IMAGE_PATH = '/src/assets/images/editorial_study_library_1795029579941.jpg';

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
