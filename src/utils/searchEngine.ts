import {
  BlogPost,
  BookNote,
  CalendarEvent,
  DailyJournalRecord,
  DentalCase,
  DomainId,
  DomainInfo,
  GrantedWorkspaceData,
  LearningHubId,
  LearningHubMeta,
  LearningPath,
  MonthPlan,
  PersonalCourse,
  PersonalReflection,
  PracticalProject,
  PublicPageId,
  ReadingLibraryItem,
  StudyResource,
  UnifiedTask,
  WeeklyMeeting,
  formatShortArabicDate,
  getDayArabicName,
  getHubMeta,
  resolveCourseStudyStage,
  toLocalDateKey,
} from '../data/curriculumData';
import type { CloudAttachmentItem } from '../services/supabaseSync';
import type { ActiveTab } from '../components/Header';
import { richHtmlToPlainText } from './richText';

export type SearchEntityType =
  | 'course'
  | 'note'
  | 'task'
  | 'project'
  | 'daily_journal'
  | 'reflection'
  | 'blog'
  | 'path'
  | 'book'
  | 'month'
  | 'domain'
  | 'calendar'
  | 'meeting'
  | 'dental_case'
  | 'attachment'
  | 'nav';

export type SearchFilterGroup =
  | 'all'
  | 'courses'
  | 'notes'
  | 'tasks'
  | 'journals'
  | 'reflections_blogs'
  | 'paths_books'
  | 'schedule_files'
  | 'nav';

export type SearchStatusFilter =
  | 'all'
  | 'active'
  | 'completed'
  | 'public'
  | 'has_attachment';

export type SearchDateRangeFilter =
  | 'all'
  | 'today'
  | 'last_7'
  | 'last_30'
  | 'custom';

export type SearchSortBy = 'relevance' | 'newest' | 'title';

export type SearchActionPayload =
  | { type: 'tab'; tab: ActiveTab }
  | { type: 'course'; courseId: number }
  | { type: 'note'; noteId: string }
  | { type: 'task'; task: UnifiedTask }
  | { type: 'daily_journal'; dateKey: string }
  | { type: 'reflection'; reflectionId: string }
  | { type: 'blog'; blogId: string }
  | { type: 'month'; monthId: number }
  | { type: 'domain'; domainId: DomainId }
  | { type: 'dental_cases' }
  | {
      type: 'attachment';
      title: string;
      fileName: string;
      resourceId?: string;
      storagePath?: string;
      downloadUrl?: string;
      mimeType?: string;
      contextLabel?: string;
    }
  | {
      type: 'public_page';
      page: PublicPageId;
      scrollToSectionId?: string;
    }
  | {
      type: 'public_detail';
      detail:
        | { type: 'course'; item: PersonalCourse; linkedNotes?: BookNote[] }
        | { type: 'note'; item: BookNote }
        | { type: 'path'; item: LearningPath }
        | { type: 'book'; item: ReadingLibraryItem }
        | { type: 'reflection'; item: PersonalReflection }
        | { type: 'blog'; item: BlogPost };
    };

export interface SearchDocument {
  id: string;
  entityType: SearchEntityType;
  typeLabel: string;
  groupKey: Exclude<SearchFilterGroup, 'all'>;
  title: string;
  subtitle?: string;
  bodyText: string;
  keywordsText: string;
  hubId?: LearningHubId;
  hubLabel?: string;
  hubAccentHex?: string;
  isCompleted?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  hasAttachment?: boolean;
  dateKey?: string;
  timestampMs?: number;
  metaLine: string;
  action: SearchActionPayload;
  // Pre-normalized fields for fast client filtering
  normTitle: string;
  normSubtitle: string;
  normBody: string;
  normKeywords: string;
}

export interface SearchFiltersState {
  query: string;
  group: SearchFilterGroup;
  hubId: LearningHubId | 'all';
  statusFilter: SearchStatusFilter;
  dateRange: SearchDateRangeFilter;
  customFrom: string;
  customTo: string;
  sortBy: SearchSortBy;
}

export interface RankedSearchResult {
  doc: SearchDocument;
  score: number;
  snippet: string;
}

export const SEARCH_GROUP_LABELS: Array<{
  id: SearchFilterGroup;
  label: string;
}> = [
  { id: 'all', label: 'الكل' },
  { id: 'courses', label: 'الكورسات والحالات' },
  { id: 'notes', label: 'الملخصات والنوتس' },
  { id: 'tasks', label: 'المهام والمشاريع' },
  { id: 'journals', label: 'اليوميات' },
  { id: 'reflections_blogs', label: 'الخواطر والمقالات' },
  { id: 'paths_books', label: 'المسارات والمكتبة' },
  { id: 'schedule_files', label: 'التقويم والخطة والملفات' },
  { id: 'nav', label: 'صفحات المنصة' },
];

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_TATWEEL_RE = /\u0640/g;

/**
 * Normalizes Arabic & Latin text for forgiving bilingual search:
 * removes diacritics/tatweel, unifies Alef/Teh-Marbuta/Alef-Maksura/Hamza forms, lowercases English.
 */
export function normalizeSearchText(raw: string | undefined | null): string {
  if (!raw) return '';
  return raw
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(ARABIC_TATWEEL_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(rawQuery: string): string[] {
  const norm = normalizeSearchText(rawQuery);
  if (!norm) return [];
  const tokens = norm.split(' ').filter(Boolean);
  return Array.from(new Set(tokens));
}

function finalizeDoc(
  raw: Omit<
    SearchDocument,
    'normTitle' | 'normSubtitle' | 'normBody' | 'normKeywords'
  >
): SearchDocument {
  return {
    ...raw,
    normTitle: normalizeSearchText(raw.title),
    normSubtitle: normalizeSearchText(raw.subtitle),
    normBody: normalizeSearchText(raw.bodyText),
    normKeywords: normalizeSearchText(raw.keywordsText),
  };
}

function joinResourcesSearchText(resources?: StudyResource[]): string {
  if (!resources || resources.length === 0) return '';
  return resources
    .map((r) =>
      [r.title, r.note, r.attachmentName, r.extractedPreview, r.type]
        .filter(Boolean)
        .join(' ')
    )
    .join(' · ');
}

export interface AdminSearchIndexInput {
  courses: PersonalCourse[];
  bookNotes: BookNote[];
  unifiedTasks: UnifiedTask[];
  projects: PracticalProject[];
  dailyJournals: DailyJournalRecord[];
  reflections: PersonalReflection[];
  blogPosts: BlogPost[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  months: MonthPlan[];
  domains: DomainInfo[];
  calendarEvents: CalendarEvent[];
  weeklyMeetings: WeeklyMeeting[];
  dentalCases: DentalCase[];
  cloudAttachments: CloudAttachmentItem[];
  hubs: LearningHubMeta[];
}

export function buildAdminSearchIndex(
  input: AdminSearchIndexInput
): SearchDocument[] {
  const docs: SearchDocument[] = [];
  const hubs = input.hubs;

  // 1. Courses
  for (const c of input.courses) {
    const hub = getHubMeta(c.hubId, hubs);
    const stage = resolveCourseStudyStage(c);
    const stageLabel =
      c.completed || stage === 'completed'
        ? 'مكتمل'
        : stage === 'focus_now'
        ? 'تركيز حالي'
        : stage === 'in_progress'
        ? 'قيد الدراسة'
        : stage === 'scheduled_later'
        ? 'مجدول لاحقًا'
        : stage === 'deferred'
        ? 'مؤجل'
        : 'تم سماعه مسبقًا';
    const objectivesText = (c.learningObjectives || [])
      .map((o) => o.text)
      .join(' · ');
    const tasksText = (c.tasks || []).map((t) => t.text).join(' · ');
    const resText = joinResourcesSearchText(c.resources);
    const bodyText = [c.notes, objectivesText, tasksText, resText]
      .filter(Boolean)
      .join('\n');

    docs.push(
      finalizeDoc({
        id: `course:${c.id}`,
        entityType: 'course',
        typeLabel: 'كورس',
        groupKey: 'courses',
        title: c.title,
        subtitle: [c.instructor, c.platform, c.complementaryBook]
          .filter(Boolean)
          .join(' · '),
        bodyText,
        keywordsText: [
          c.category,
          c.bookAuthor,
          c.applicationMilestone,
          hub.title,
          hub.englishTitle,
          stageLabel,
        ]
          .filter(Boolean)
          .join(' '),
        hubId: c.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: Boolean(c.completed || stage === 'completed'),
        isActive: !c.completed && stage !== 'completed',
        isPublic: Boolean(c.isPublic),
        hasAttachment: (c.resources || []).some(
          (r) => Boolean(r.attachmentName || r.storagePath || r.downloadUrl)
        ),
        dateKey: c.startDate || c.targetDate || undefined,
        metaLine: [
          'كورس',
          hub.shortTitle,
          c.category,
          stageLabel,
          c.progressPct != null ? `${c.progressPct}%` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'course', courseId: c.id },
      })
    );

    // Index PDF/document resources inside courses for direct jump
    for (const r of c.resources || []) {
      if (r.storagePath || r.downloadUrl || r.attachmentName) {
        docs.push(
          finalizeDoc({
            id: `course-res:${c.id}:${r.id}`,
            entityType: 'attachment',
            typeLabel: 'ملف كورس',
            groupKey: 'schedule_files',
            title: r.title || r.attachmentName || 'ملف مرفق',
            subtitle: `تابع لكورس: ${c.title}`,
            bodyText: [r.note, r.extractedPreview].filter(Boolean).join('\n'),
            keywordsText: [r.attachmentName, r.type, c.title, hub.shortTitle]
              .filter(Boolean)
              .join(' '),
            hubId: c.hubId,
            hubLabel: hub.shortTitle,
            hubAccentHex: hub.accentHex,
            hasAttachment: true,
            metaLine: ['مرفق كورس', c.title, r.attachmentName || r.type]
              .filter(Boolean)
              .join(' · '),
            action: {
              type: 'attachment',
              title: r.title || r.attachmentName || 'ملف مرفق',
              fileName: r.attachmentName || 'document.pdf',
              resourceId: r.id,
              storagePath: r.storagePath,
              downloadUrl: r.downloadUrl,
              mimeType: r.mimeType,
              contextLabel: c.title,
            },
          })
        );
      }
    }
  }

  // 2. Book & Lecture Notes
  for (const n of input.bookNotes) {
    const hub = getHubMeta(n.hubId, hubs);
    const plainContent = richHtmlToPlainText(n.content || '');
    const resText = joinResourcesSearchText(n.resources);
    const kindLabel =
      n.noteType === 'course_lecture'
        ? 'تلخيص محاضرة'
        : n.noteType === 'general'
        ? 'ملخص عام'
        : 'تلخيص كتاب';
    docs.push(
      finalizeDoc({
        id: `note:${n.id}`,
        entityType: 'note',
        typeLabel: kindLabel,
        groupKey: 'notes',
        title: n.bookTitle || 'ملخص بدون عنوان',
        subtitle: [n.courseTitle, n.lectureTitle, n.author]
          .filter(Boolean)
          .join(' · '),
        bodyText: [plainContent, n.quotes, resText].filter(Boolean).join('\n'),
        keywordsText: [
          n.categoryLabel,
          n.progressMarker,
          hub.title,
          kindLabel,
          n.updatedAt,
        ]
          .filter(Boolean)
          .join(' '),
        hubId: n.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isActive: true,
        hasAttachment: (n.resources || []).some(
          (r) => Boolean(r.attachmentName || r.storagePath || r.downloadUrl)
        ),
        timestampMs: n.createdAtMs,
        metaLine: [
          kindLabel,
          hub.shortTitle,
          n.courseTitle || n.author || n.categoryLabel,
          n.progressMarker,
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'note', noteId: n.id },
      })
    );
  }

  // 3. Unified Tasks
  for (const t of input.unifiedTasks) {
    const hub = getHubMeta(t.hubId, hubs);
    const statusAr =
      t.status === 'done'
        ? 'منجزة'
        : t.status === 'in_progress'
        ? 'قيد التنفيذ'
        : t.status === 'postponed'
        ? 'مؤجلة'
        : 'مطلوب تنفيذها';
    const prioAr =
      t.priority === 'high'
        ? 'أولوية عالية'
        : t.priority === 'medium'
        ? 'أولوية متوسطة'
        : 'أولوية منخفضة';
    docs.push(
      finalizeDoc({
        id: `task:${t.id}`,
        entityType: 'task',
        typeLabel: 'مهمة',
        groupKey: 'tasks',
        title: t.title,
        subtitle: t.linkedLabel || t.categoryLabel || '',
        bodyText: t.description || '',
        keywordsText: [
          statusAr,
          prioAr,
          hub.title,
          t.categoryLabel,
          t.linkedLabel,
          t.scheduledDate || t.dueDate,
        ]
          .filter(Boolean)
          .join(' '),
        hubId: t.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: t.status === 'done',
        isActive: t.status !== 'done',
        dateKey: t.scheduledDate || t.deadline || t.dueDate || undefined,
        metaLine: [
          'مهمة',
          statusAr,
          prioAr,
          t.scheduledDate || t.deadline || t.dueDate || '',
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'task', task: t },
      })
    );
  }

  // 4. Practical Projects
  for (const p of input.projects) {
    const hub = getHubMeta(p.hubId, hubs);
    const statusAr =
      p.status === 'completed'
        ? 'مكتمل'
        : p.status === 'in_progress'
        ? 'قيد التنفيذ'
        : 'مخطط';
    docs.push(
      finalizeDoc({
        id: `project:${p.id}`,
        entityType: 'project',
        typeLabel: 'مشروع تطبيقي',
        groupKey: 'tasks',
        title: p.title,
        subtitle: p.categoryLabel || hub.shortTitle,
        bodyText: [p.description, p.objectives, p.deliverables, p.notes]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [hub.title, statusAr, p.categoryLabel].join(' '),
        hubId: p.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: p.status === 'completed',
        isActive: p.status !== 'completed',
        dateKey: p.startDate || p.targetDate || undefined,
        metaLine: [
          'مشروع تطبيقي',
          hub.shortTitle,
          statusAr,
          `${p.progressPct}%`,
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'tab', tab: 'tasks' },
      })
    );
  }

  // 5. Daily Journals
  for (const j of input.dailyJournals) {
    const bodyPlain = richHtmlToPlainText(j.bodyHtml || '');
    const sectionsText = (j.sections || [])
      .map((s) => `${s.heading} ${richHtmlToPlainText(s.bodyHtml || '')}`)
      .join('\n');
    const quickNotesText = (j.quickNotes || [])
      .map((qn) => `${qn.title || ''} ${qn.body}`)
      .join('\n');
    const fullBody = [
      bodyPlain,
      sectionsText,
      quickNotesText,
      j.highlightsText,
      j.reflectionText,
    ]
      .filter(Boolean)
      .join('\n');
    const dayTitle = j.title?.trim()
      ? j.title.trim()
      : `يومية ${getDayArabicName(j.dateKey)} · ${formatShortArabicDate(j.dateKey)}`;

    docs.push(
      finalizeDoc({
        id: `journal:${j.dateKey}`,
        entityType: 'daily_journal',
        typeLabel: 'يومية',
        groupKey: 'journals',
        title: dayTitle,
        subtitle:
          j.subtitle ||
          `${getDayArabicName(j.dateKey)} ${formatShortArabicDate(j.dateKey)}`,
        bodyText: fullBody,
        keywordsText: [
          j.dateKey,
          getDayArabicName(j.dateKey),
          formatShortArabicDate(j.dateKey),
          j.moodLabel,
        ]
          .filter(Boolean)
          .join(' '),
        hasAttachment: Boolean(j.coverImageUrl || j.coverImageStoragePath),
        dateKey: j.dateKey,
        timestampMs: j.updatedAtMs,
        metaLine: [
          'يومية',
          j.dateKey,
          j.moodLabel || '',
          j.quickNotes?.length ? `${j.quickNotes.length} ملاحظات سريعة` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'daily_journal', dateKey: j.dateKey },
      })
    );
  }

  // 6. Reflections
  for (const r of input.reflections) {
    docs.push(
      finalizeDoc({
        id: `reflection:${r.id}`,
        entityType: 'reflection',
        typeLabel: 'خاطرة',
        groupKey: 'reflections_blogs',
        title: r.title,
        subtitle: [r.moodTag, r.categoryTag].filter(Boolean).join(' · '),
        bodyText: r.content,
        keywordsText: [r.moodTag, r.categoryTag, r.createdAtLabel]
          .filter(Boolean)
          .join(' '),
        isPublic: Boolean(r.isPublic),
        hasAttachment: Boolean(r.imageUrl || r.imageStoragePath),
        timestampMs: r.createdAtMs,
        metaLine: ['خاطرة', r.moodTag, r.categoryTag, r.createdAtLabel]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'reflection', reflectionId: r.id },
      })
    );
  }

  // 7. Blog Posts
  for (const b of input.blogPosts) {
    docs.push(
      finalizeDoc({
        id: `blog:${b.id}`,
        entityType: 'blog',
        typeLabel: 'مقال',
        groupKey: 'reflections_blogs',
        title: b.title,
        subtitle: b.subtitle || b.excerpt || '',
        bodyText: [b.excerpt, b.content].filter(Boolean).join('\n'),
        keywordsText: [b.categoryLabel, b.createdAtLabel]
          .filter(Boolean)
          .join(' '),
        isPublic: Boolean(b.isPublic),
        hasAttachment: Boolean(b.coverImageUrl || b.coverStoragePath),
        timestampMs: b.createdAtMs,
        metaLine: [
          'مقال',
          b.categoryLabel || 'المدونة',
          b.isPublic ? 'منشور للعامة' : 'مسودة خاصة',
          b.createdAtLabel,
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'blog', blogId: b.id },
      })
    );
  }

  // 8. Learning Paths
  for (const p of input.learningPaths) {
    const hub = getHubMeta(p.hubId, hubs);
    const stagesText = (p.stages || [])
      .map((s) => `${s.title} ${s.notes || ''}`)
      .join(' · ');
    const objText = (p.learningObjectives || [])
      .map((o) => o.text)
      .join(' · ');
    docs.push(
      finalizeDoc({
        id: `path:${p.id}`,
        entityType: 'path',
        typeLabel: 'مسار تعليمي',
        groupKey: 'paths_books',
        title: p.title,
        subtitle: [p.currentLevel, p.targetLevel].filter(Boolean).join(' → '),
        bodyText: [p.description, p.objectives, objText, stagesText]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [p.categoryLabel, hub.title].filter(Boolean).join(' '),
        hubId: p.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: p.status === 'completed',
        isActive: p.status !== 'completed',
        isPublic: Boolean(p.isPublic),
        dateKey: p.startDate || p.expectedCompletionDate || undefined,
        metaLine: ['مسار تعليمي', hub.shortTitle, `${p.progressPct}%`]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'tab', tab: 'paths' },
      })
    );
  }

  // 9. Reading Library Items (Books / Papers / Articles)
  for (const item of input.readingItems) {
    const hub = getHubMeta(item.hubId, hubs);
    const objText = (item.learningObjectives || [])
      .map((o) => o.text)
      .join(' · ');
    const statusAr =
      item.status === 'completed'
        ? 'مكتمل'
        : item.status === 'reading'
        ? 'أقرؤه حاليًا'
        : 'للقراءة';
    docs.push(
      finalizeDoc({
        id: `book:${item.id}`,
        entityType: 'book',
        typeLabel: item.itemType || 'كتاب',
        groupKey: 'paths_books',
        title: item.title,
        subtitle: item.author ? `تأليف: ${item.author}` : item.categoryLabel,
        bodyText: [item.takeaways, objText].filter(Boolean).join('\n'),
        keywordsText: [
          item.author,
          item.categoryLabel,
          item.attachmentName,
          hub.title,
          statusAr,
        ]
          .filter(Boolean)
          .join(' '),
        hubId: item.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: item.status === 'completed',
        isActive: item.status !== 'completed',
        isPublic: Boolean(item.isPublic),
        hasAttachment: Boolean(
          item.attachmentName || item.storagePath || item.downloadUrl
        ),
        metaLine: [
          item.itemType || 'كتاب',
          hub.shortTitle,
          statusAr,
          item.totalPages > 0 ? `${item.currentPage}/${item.totalPages} ص` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'tab', tab: 'library' },
      })
    );
  }

  // 10. 12-Month Plan Months
  for (const m of input.months) {
    const hub = getHubMeta(m.hubId, hubs);
    const tasksText = (m.tasks || []).map((t) => t.text).join(' · ');
    docs.push(
      finalizeDoc({
        id: `month:${m.id}`,
        entityType: 'month',
        typeLabel: `الشهر ${m.id}`,
        groupKey: 'schedule_files',
        title: `الشهر ${m.id}: ${m.theme}`,
        subtitle: [m.foundational?.title, m.exploratory?.title]
          .filter(Boolean)
          .join(' · '),
        bodyText: [
          m.notes,
          m.discussionPrompt,
          m.applicationTask,
          tasksText,
          joinResourcesSearchText(m.resources),
        ]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [
          m.quarterTitle,
          m.foundational?.author,
          m.exploratory?.author,
          hub.title,
        ]
          .filter(Boolean)
          .join(' '),
        hubId: m.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: m.status === 'completed',
        isActive: m.status !== 'completed',
        metaLine: [
          `خطة 12 شهر`,
          m.quarterTitle,
          m.status === 'completed'
            ? 'مكتمل'
            : m.status === 'in_progress'
            ? 'قيد التنفيذ'
            : 'غير مبدوء',
        ]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'month', monthId: m.id },
      })
    );
  }

  // 11. Knowledge Domains
  for (const d of input.domains) {
    const hub = getHubMeta(d.hubId, hubs);
    const thinkersText = (d.thinkers || [])
      .map((th) => `${th.name} ${th.role} ${th.keyWorks.join(' ')}`)
      .join(' · ');
    docs.push(
      finalizeDoc({
        id: `domain:${d.id}`,
        entityType: 'domain',
        typeLabel: 'محور معرفي',
        groupKey: 'paths_books',
        title: d.title,
        subtitle: d.subtitle,
        bodyText: [d.purpose, thinkersText].filter(Boolean).join('\n'),
        keywordsText: [hub.title, d.subtitle].filter(Boolean).join(' '),
        hubId: d.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isActive: true,
        metaLine: ['محور معرفي', hub.shortTitle].filter(Boolean).join(' · '),
        action: { type: 'domain', domainId: d.id },
      })
    );
  }

  // 12. Calendar Events
  for (const ev of input.calendarEvents) {
    docs.push(
      finalizeDoc({
        id: `calendar:${ev.id}`,
        entityType: 'calendar',
        typeLabel: 'موعد بالتقويم',
        groupKey: 'schedule_files',
        title: ev.title,
        subtitle: [ev.dateKey, ev.timeSlot, ev.category]
          .filter(Boolean)
          .join(' · '),
        bodyText: [ev.notes, ev.linkedTaskText].filter(Boolean).join('\n'),
        keywordsText: [ev.category, ev.dateKey, ev.timeSlot]
          .filter(Boolean)
          .join(' '),
        isCompleted: ev.done,
        isActive: !ev.done,
        dateKey: ev.dateKey,
        metaLine: ['التقويم', ev.dateKey, ev.timeSlot, ev.category]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'tab', tab: 'calendar' },
      })
    );
  }

  // 13. Weekly Meetings
  for (const mtg of input.weeklyMeetings) {
    const hub = getHubMeta(mtg.hubId, hubs);
    const notesJoined = Object.values(mtg.notesByDate || {}).join(' · ');
    docs.push(
      finalizeDoc({
        id: `meeting:${mtg.id}`,
        entityType: 'meeting',
        typeLabel: 'لقاء أسبوعي',
        groupKey: 'schedule_files',
        title: mtg.title,
        subtitle: [mtg.startTime, hub.shortTitle].filter(Boolean).join(' · '),
        bodyText: [mtg.description, notesJoined].filter(Boolean).join('\n'),
        keywordsText: [hub.title, mtg.startDate].filter(Boolean).join(' '),
        hubId: mtg.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isCompleted: mtg.status === 'completed',
        isActive: mtg.status === 'scheduled',
        dateKey: mtg.startDate,
        metaLine: ['لقاء أسبوعي', hub.shortTitle, mtg.startTime]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'tab', tab: 'account' },
      })
    );
  }

  // 14. Dental Cases
  for (const dc of input.dentalCases) {
    const statusAr =
      dc.status === 'completed'
        ? 'مكتملة'
        : dc.status === 'follow_up'
        ? 'متابعة'
        : 'جارية';
    docs.push(
      finalizeDoc({
        id: `dental:${dc.id}`,
        entityType: 'dental_case',
        typeLabel: 'حالة أسنان',
        groupKey: 'courses',
        title: dc.title,
        subtitle: [dc.specialty, dc.caseDate].filter(Boolean).join(' · '),
        bodyText: [dc.patientSummary, dc.procedureDetails]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [dc.specialty, statusAr, dc.caseDate]
          .filter(Boolean)
          .join(' '),
        hubId: 'dental_career',
        hubLabel: 'الدنتال والكارير',
        isCompleted: dc.status === 'completed',
        isActive: dc.status !== 'completed',
        hasAttachment: Boolean(
          dc.coverImageUrl || dc.coverStoragePath || dc.coverDataUrl
        ),
        dateKey: dc.caseDate,
        metaLine: ['حالة طب أسنان', dc.specialty, statusAr, dc.caseDate]
          .filter(Boolean)
          .join(' · '),
        action: { type: 'dental_cases' },
      })
    );
  }

  // 15. Standalone Cloud Attachments (avoid duplicates already indexed by exact storagePath)
  const indexedPaths = new Set(
    docs
      .map((d) =>
        d.action.type === 'attachment' ? d.action.storagePath : undefined
      )
      .filter(Boolean)
  );
  for (const att of input.cloudAttachments) {
    if (att.storagePath && indexedPaths.has(att.storagePath)) continue;
    docs.push(
      finalizeDoc({
        id: `att:${att.id}`,
        entityType: 'attachment',
        typeLabel: 'ملف سحابي',
        groupKey: 'schedule_files',
        title: att.fileName,
        subtitle: 'ملف مرفوع على التخزين السحابي',
        bodyText: '',
        keywordsText: [att.mimeType, att.fileName].filter(Boolean).join(' '),
        hasAttachment: true,
        timestampMs: att.updatedAtMs,
        metaLine: ['ملف سحابي', att.mimeType || 'مستند']
          .filter(Boolean)
          .join(' · '),
        action: {
          type: 'attachment',
          title: att.fileName,
          fileName: att.fileName,
          resourceId: att.id,
          storagePath: att.storagePath,
          mimeType: att.mimeType,
          contextLabel: 'الملفات السحابية',
        },
      })
    );
  }

  // 16. Quick Navigation Pages / Sections across the Platform
  const quickPages: Array<{ tab: ActiveTab; title: string; keywords: string }> = [
    { tab: 'overview', title: 'لوحة المتابعة والمحاور', keywords: 'الرئيسية الداشبورد overview dashboard' },
    { tab: 'focus', title: 'التركيز الحالي', keywords: 'تركيز اليوم المهام الحالية focus' },
    { tab: 'courses', title: 'الكورسات والملفات', keywords: 'الدورات الكورسات حالات اسنان courses' },
    { tab: 'paths', title: 'المسارات التعليمية', keywords: 'مسارات خطة تعليم paths' },
    { tab: 'library', title: 'المكتبة والقراءة', keywords: 'كتب مقالات مكتبة قراءة library books' },
    { tab: 'journal', title: 'دفتر التلخيص والنوتس', keywords: 'تلخيص نوتس مذكرات محاضرات notes' },
    { tab: 'daily_journal', title: 'اليوميات التلقائية ومعرض اليوميات', keywords: 'يوميات يومي دفتر معرض daily journal gallery' },
    { tab: 'tasks', title: 'المهام والمشاريع التطبيقية', keywords: 'مهام مشاريع تاسكات tasks projects' },
    { tab: 'weekly_plan', title: 'تخطيط الأسبوع', keywords: 'اسبوع خطة اسبوعية weekly plan' },
    { tab: 'reviews', title: 'المراجعات الدورية', keywords: 'مراجعة اسبوعية شهرية تقييم reviews' },
    { tab: 'reflections', title: 'خواطري وتأملاتي', keywords: 'خواطر تأمل امتنان افكار reflections' },
    { tab: 'blogs', title: 'المدونة والمقالات', keywords: 'مدونة مقالات كتابة نشر blogs' },
    { tab: 'gallery', title: 'معرض الصور', keywords: 'صور معرض جاليري gallery photos' },
    { tab: 'calendar', title: 'التقويم والجدول الزمني', keywords: 'تقويم مواعيد جدول calendar' },
    { tab: 'plan', title: 'خطة الـ 12 شهرًا', keywords: 'خطة سنة شهر 12 month plan' },
    { tab: 'domains', title: 'المحاور المعرفية', keywords: 'محاور مجالات فكرية domains' },
    { tab: 'account', title: 'مركز الإدارة والحساب والصلاحيات', keywords: 'حساب اعدادات صلاحيات مستخدمين موقع عام account settings' },
  ];
  for (const qp of quickPages) {
    docs.push(
      finalizeDoc({
        id: `nav:${qp.tab}`,
        entityType: 'nav',
        typeLabel: 'صفحة',
        groupKey: 'nav',
        title: qp.title,
        subtitle: 'انتقال مباشر إلى القسم',
        bodyText: '',
        keywordsText: qp.keywords,
        metaLine: 'قسم في المنصة · انتقال سريع',
        action: { type: 'tab', tab: qp.tab },
      })
    );
  }

  return docs;
}

export interface PublicSearchIndexInput {
  publicCourses: PersonalCourse[];
  publicPaths: LearningPath[];
  publicBooks: ReadingLibraryItem[];
  publicReflections: PersonalReflection[];
  publicBlogs: BlogPost[];
  grantedWorkspace?: GrantedWorkspaceData | null;
  hubs: LearningHubMeta[];
}

export function buildPublicSearchIndex(
  input: PublicSearchIndexInput
): SearchDocument[] {
  const docs: SearchDocument[] = [];
  const seenIds = new Set<string>();
  const hubs = input.hubs;

  const pushUnique = (doc: SearchDocument) => {
    if (seenIds.has(doc.id)) return;
    seenIds.add(doc.id);
    docs.push(doc);
  };

  const notesByCourseId = new Map<number, BookNote[]>();
  for (const bn of input.grantedWorkspace?.bookNotes || []) {
    if (bn.courseId) {
      const arr = notesByCourseId.get(bn.courseId) || [];
      arr.push(bn);
      notesByCourseId.set(bn.courseId, arr);
    }
  }

  const allCourses = [
    ...input.publicCourses,
    ...(input.grantedWorkspace?.courses || []),
  ];
  for (const c of allCourses) {
    const hub = getHubMeta(c.hubId, hubs);
    const objText = (c.learningObjectives || []).map((o) => o.text).join(' · ');
    pushUnique(
      finalizeDoc({
        id: `pub-course:${c.id}`,
        entityType: 'course',
        typeLabel: 'كورس',
        groupKey: 'courses',
        title: c.title,
        subtitle: [c.instructor, c.platform].filter(Boolean).join(' · '),
        bodyText: [c.notes, objText, c.complementaryBook]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [c.category, hub.title, c.bookAuthor].filter(Boolean).join(' '),
        hubId: c.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isPublic: true,
        hasAttachment: (c.resources || []).length > 0,
        metaLine: ['كورس متاح', hub.shortTitle, c.category]
          .filter(Boolean)
          .join(' · '),
        action: {
          type: 'public_detail',
          detail: {
            type: 'course',
            item: c,
            linkedNotes: notesByCourseId.get(c.id),
          },
        },
      })
    );
  }

  for (const bn of input.grantedWorkspace?.bookNotes || []) {
    const hub = getHubMeta(bn.hubId, hubs);
    pushUnique(
      finalizeDoc({
        id: `pub-note:${bn.id}`,
        entityType: 'note',
        typeLabel: 'تلخيص مشارَك',
        groupKey: 'notes',
        title: bn.bookTitle,
        subtitle: [bn.courseTitle, bn.lectureTitle, bn.author]
          .filter(Boolean)
          .join(' · '),
        bodyText: [richHtmlToPlainText(bn.content || ''), bn.quotes]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [bn.categoryLabel, hub.title].filter(Boolean).join(' '),
        hubId: bn.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        hasAttachment: (bn.resources || []).length > 0,
        timestampMs: bn.createdAtMs,
        metaLine: ['تلخيص مشارَك', bn.courseTitle || bn.author || '']
          .filter(Boolean)
          .join(' · '),
        action: {
          type: 'public_detail',
          detail: { type: 'note', item: bn },
        },
      })
    );
  }

  const allPaths = [
    ...input.publicPaths,
    ...(input.grantedWorkspace?.learningPaths || []),
  ];
  for (const p of allPaths) {
    const hub = getHubMeta(p.hubId, hubs);
    pushUnique(
      finalizeDoc({
        id: `pub-path:${p.id}`,
        entityType: 'path',
        typeLabel: 'مسار تعليمي',
        groupKey: 'paths_books',
        title: p.title,
        subtitle: [p.currentLevel, p.targetLevel].filter(Boolean).join(' → '),
        bodyText: [
          p.description,
          p.objectives,
          (p.stages || []).map((s) => s.title).join(' · '),
        ]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [p.categoryLabel, hub.title].filter(Boolean).join(' '),
        hubId: p.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isPublic: true,
        metaLine: ['مسار تعليمي', hub.shortTitle].filter(Boolean).join(' · '),
        action: {
          type: 'public_detail',
          detail: { type: 'path', item: p },
        },
      })
    );
  }

  const allBooks = [
    ...input.publicBooks,
    ...(input.grantedWorkspace?.readingItems || []),
  ];
  for (const b of allBooks) {
    const hub = getHubMeta(b.hubId, hubs);
    pushUnique(
      finalizeDoc({
        id: `pub-book:${b.id}`,
        entityType: 'book',
        typeLabel: b.itemType || 'كتاب',
        groupKey: 'paths_books',
        title: b.title,
        subtitle: b.author ? `تأليف: ${b.author}` : '',
        bodyText: [
          b.takeaways,
          (b.learningObjectives || []).map((o) => o.text).join(' · '),
        ]
          .filter(Boolean)
          .join('\n'),
        keywordsText: [b.author, b.categoryLabel, hub.title]
          .filter(Boolean)
          .join(' '),
        hubId: b.hubId,
        hubLabel: hub.shortTitle,
        hubAccentHex: hub.accentHex,
        isPublic: true,
        hasAttachment: Boolean(b.storagePath || b.downloadUrl),
        metaLine: [b.itemType || 'كتاب', hub.shortTitle]
          .filter(Boolean)
          .join(' · '),
        action: {
          type: 'public_detail',
          detail: { type: 'book', item: b },
        },
      })
    );
  }

  const allReflections = [
    ...input.publicReflections,
    ...(input.grantedWorkspace?.reflections || []),
  ];
  for (const r of allReflections) {
    pushUnique(
      finalizeDoc({
        id: `pub-refl:${r.id}`,
        entityType: 'reflection',
        typeLabel: 'خاطرة',
        groupKey: 'reflections_blogs',
        title: r.title,
        subtitle: [r.moodTag, r.categoryTag].filter(Boolean).join(' · '),
        bodyText: r.content,
        keywordsText: [r.moodTag, r.categoryTag, r.createdAtLabel]
          .filter(Boolean)
          .join(' '),
        isPublic: true,
        timestampMs: r.createdAtMs,
        metaLine: ['خاطرة وتأمل', r.moodTag, r.createdAtLabel]
          .filter(Boolean)
          .join(' · '),
        action: {
          type: 'public_detail',
          detail: { type: 'reflection', item: r },
        },
      })
    );
  }

  const allBlogs = [
    ...input.publicBlogs,
    ...(input.grantedWorkspace?.blogPosts || []),
  ];
  for (const b of allBlogs) {
    pushUnique(
      finalizeDoc({
        id: `pub-blog:${b.id}`,
        entityType: 'blog',
        typeLabel: 'مقال',
        groupKey: 'reflections_blogs',
        title: b.title,
        subtitle: b.subtitle || b.excerpt || '',
        bodyText: [b.excerpt, b.content].filter(Boolean).join('\n'),
        keywordsText: [b.categoryLabel, b.createdAtLabel]
          .filter(Boolean)
          .join(' '),
        isPublic: true,
        timestampMs: b.createdAtMs,
        metaLine: ['مقال', b.categoryLabel || 'المدونة', b.createdAtLabel]
          .filter(Boolean)
          .join(' · '),
        action: {
          type: 'public_detail',
          detail: { type: 'blog', item: b },
        },
      })
    );
  }

  // Public site navigation targets
  const publicSections: Array<{
    id: string;
    title: string;
    keywords: string;
    page: PublicPageId;
    scrollToSectionId?: string;
  }> = [
    {
      id: 'pub-nav:home',
      title: 'الصفحة الرئيسية للموقع',
      keywords: 'الرئيسية البداية home',
      page: 'home',
    },
    {
      id: 'pub-nav:reflections',
      title: 'صفحة خواطري وتأملاتي',
      keywords: 'خواطر تأملات امتنان reflections',
      page: 'reflections',
    },
    {
      id: 'pub-nav:blogs',
      title: 'صفحة المدونة والمقالات',
      keywords: 'مدونة مقالات كتابات blogs articles',
      page: 'blogs',
    },
    {
      id: 'pub-nav:contact',
      title: 'تواصل معنا وإرسال رسالة',
      keywords: 'تواصل رسالة بريد contact email',
      page: 'home',
      scrollToSectionId: 'contact-us-section',
    },
  ];
  for (const sec of publicSections) {
    pushUnique(
      finalizeDoc({
        id: sec.id,
        entityType: 'nav',
        typeLabel: 'قسم بالموقع',
        groupKey: 'nav',
        title: sec.title,
        subtitle: 'انتقال مباشر',
        bodyText: '',
        keywordsText: sec.keywords,
        isPublic: true,
        metaLine: 'الموقع العام · انتقال سريع',
        action: {
          type: 'public_page',
          page: sec.page,
          scrollToSectionId: sec.scrollToSectionId,
        },
      })
    );
  }

  return docs;
}

function addDaysDelta(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + delta);
  return toLocalDateKey(dt);
}

function matchesDateRange(
  doc: SearchDocument,
  filters: SearchFiltersState,
  todayKey: string
): boolean {
  if (filters.dateRange === 'all') return true;
  const effectiveDate =
    doc.dateKey ||
    (doc.timestampMs ? toLocalDateKey(new Date(doc.timestampMs)) : '');
  if (!effectiveDate) return false;

  if (filters.dateRange === 'today') {
    return effectiveDate === todayKey;
  }
  if (filters.dateRange === 'last_7') {
    return effectiveDate >= addDaysDelta(todayKey, -6) && effectiveDate <= todayKey;
  }
  if (filters.dateRange === 'last_30') {
    return effectiveDate >= addDaysDelta(todayKey, -29) && effectiveDate <= todayKey;
  }
  if (filters.dateRange === 'custom') {
    if (filters.customFrom && effectiveDate < filters.customFrom) return false;
    if (filters.customTo && effectiveDate > filters.customTo) return false;
    return true;
  }
  return true;
}

function matchesStatusFilter(
  doc: SearchDocument,
  statusFilter: SearchStatusFilter
): boolean {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'completed') return Boolean(doc.isCompleted);
  if (statusFilter === 'active') return Boolean(doc.isActive);
  if (statusFilter === 'public') return Boolean(doc.isPublic);
  if (statusFilter === 'has_attachment') return Boolean(doc.hasAttachment);
  return true;
}

export function extractSearchSnippet(
  text: string,
  tokens: string[],
  maxLen = 170
): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (tokens.length === 0) {
    return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}...` : clean;
  }

  // Locate first token match in original string by scanning normalized sliding matches
  const normClean = normalizeSearchText(clean);
  let bestNormPos = -1;
  for (const t of tokens) {
    const idx = normClean.indexOf(t);
    if (idx !== -1 && (bestNormPos === -1 || idx < bestNormPos)) {
      bestNormPos = idx;
    }
  }

  if (bestNormPos === -1) {
    return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}...` : clean;
  }

  // Approximate original character offset proportionally (very accurate on plain Arabic/English text)
  const ratio = normClean.length > 0 ? clean.length / normClean.length : 1;
  const approxIdx = Math.floor(bestNormPos * ratio);
  const start = Math.max(0, approxIdx - 45);
  const end = Math.min(clean.length, start + maxLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Safely splits text into matched/unmatched segments for React rendering (no HTML injection).
 * Uses character-to-normalized-index mapping so Arabic diacritics/Alef normalization highlights accurately!
 */
export function splitTextForHighlight(
  text: string,
  tokens: string[]
): HighlightSegment[] {
  if (!text) return [];
  if (tokens.length === 0) return [{ text, matched: false }];

  // Build normalized string with source-character index map
  const normChars: string[] = [];
  const origStartIdx: number[] = [];
  const origEndIdx: number[] = [];

  const isDiacriticOrTatweel = (ch: string) =>
    /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/.test(ch);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isDiacriticOrTatweel(ch)) {
      // Attach diacritics to previous base char end if any
      if (origEndIdx.length > 0) {
        origEndIdx[origEndIdx.length - 1] = i + 1;
      }
      continue;
    }
    const mapped = normalizeSearchText(ch);
    if (!mapped) {
      normChars.push(' ');
    } else {
      normChars.push(mapped);
    }
    origStartIdx.push(i);
    origEndIdx.push(i + 1);
  }

  const normStr = normChars.join('');
  const ranges: Array<[number, number]> = [];

  for (const token of tokens) {
    if (!token) continue;
    let searchFrom = 0;
    while (searchFrom < normStr.length) {
      const hit = normStr.indexOf(token, searchFrom);
      if (hit === -1) break;
      const startOrig = origStartIdx[hit] ?? 0;
      const endOrig = origEndIdx[hit + token.length - 1] ?? startOrig + token.length;
      if (endOrig > startOrig) {
        ranges.push([startOrig, endOrig]);
      }
      searchFrom = hit + token.length;
    }
  }

  if (ranges.length === 0) return [{ text, matched: false }];

  // Merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (!prev || r[0] > prev[1]) {
      merged.push([...r]);
    } else {
      prev[1] = Math.max(prev[1], r[1]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), matched: false });
    }
    segments.push({ text: text.slice(start, end), matched: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}

export function executeAdvancedSearch(
  docs: SearchDocument[],
  filters: SearchFiltersState
): {
  results: RankedSearchResult[];
  groupCounts: Record<SearchFilterGroup, number>;
  tokens: string[];
} {
  const tokens = tokenizeQuery(filters.query);
  const normFullQuery = normalizeSearchText(filters.query);
  const todayKey = toLocalDateKey();

  const groupCounts: Record<SearchFilterGroup, number> = {
    all: 0,
    courses: 0,
    notes: 0,
    tasks: 0,
    journals: 0,
    reflections_blogs: 0,
    paths_books: 0,
    schedule_files: 0,
    nav: 0,
  };

  const preGroupMatches: RankedSearchResult[] = [];

  for (const doc of docs) {
    if (filters.hubId !== 'all' && doc.hubId !== filters.hubId) {
      continue;
    }
    if (!matchesStatusFilter(doc, filters.statusFilter)) {
      continue;
    }
    if (!matchesDateRange(doc, filters, todayKey)) {
      continue;
    }

    let score = 0;
    if (tokens.length > 0) {
      const combined = `${doc.normTitle} ${doc.normSubtitle} ${doc.normKeywords} ${doc.normBody}`;
      let allMatch = true;
      for (const tk of tokens) {
        if (!combined.includes(tk)) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) continue;

      // Compute weighted relevance score
      if (doc.normTitle === normFullQuery) score += 140;
      else if (doc.normTitle.startsWith(normFullQuery)) score += 95;
      else if (doc.normTitle.includes(normFullQuery)) score += 65;

      for (const tk of tokens) {
        if (doc.normTitle.includes(tk)) score += 32;
        if (doc.normSubtitle.includes(tk)) score += 16;
        if (doc.normKeywords.includes(tk)) score += 12;
        if (doc.normBody.includes(tk)) score += 6;
      }
      // Slightly boost concrete records over generic nav shortcuts unless nav matches directly
      if (doc.entityType !== 'nav') score += 4;
    } else {
      // No query: show recent/important items cleanly; boost non-nav items first
      score = doc.entityType === 'nav' ? 5 : 20;
      if (doc.dateKey === todayKey) score += 15;
    }

    groupCounts.all += 1;
    groupCounts[doc.groupKey] += 1;

    if (filters.group !== 'all' && doc.groupKey !== filters.group) {
      continue;
    }

    const snippetSource =
      doc.bodyText || doc.subtitle || doc.keywordsText || '';
    preGroupMatches.push({
      doc,
      score,
      snippet: extractSearchSnippet(snippetSource, tokens),
    });
  }

  preGroupMatches.sort((a, b) => {
    if (filters.sortBy === 'title') {
      return a.doc.title.localeCompare(b.doc.title, 'ar');
    }
    if (filters.sortBy === 'newest') {
      const aDate = a.doc.dateKey || '';
      const bDate = b.doc.dateKey || '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      const aTs = a.doc.timestampMs || 0;
      const bTs = b.doc.timestampMs || 0;
      if (aTs !== bTs) return bTs - aTs;
      return b.score - a.score;
    }
    if (b.score !== a.score) return b.score - a.score;
    const aDate = a.doc.dateKey || '';
    const bDate = b.doc.dateKey || '';
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return (b.doc.timestampMs || 0) - (a.doc.timestampMs || 0);
  });

  return {
    results: preGroupMatches,
    groupCounts,
    tokens,
  };
}
