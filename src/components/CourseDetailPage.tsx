import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Compass,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  FolderKanban,
  Globe,
  Loader2,
  Lock,
  NotebookPen,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Square,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  BookNote,
  COURSE_STUDY_STAGES_META,
  CourseStudyStage,
  EntitySortMode,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthPlan,
  NoteCategoryType,
  PersonalCourse,
  PinCollection,
  PinEntityType,
  PracticalProject,
  ReadingLibraryItem,
  StudyResource,
  TaskPriority,
  UnifiedTask,
  UserPreferences,
  getCourseStageMeta,
  getHubMeta,
  getTodayDateKey,
  resolveCourseStudyStage,
  sortBookNotesList,
} from '../data/curriculumData';

const COURSE_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

function computeEndTimeFromStart(startTime: string, durationMinutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return '';
  const startMins = Number(m[1]) * 60 + Number(m[2]);
  const endMins = Math.min(23 * 60 + 59, startMins + Math.max(15, durationMinutes));
  return `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
}
import { auth } from '../firebase';
import { formatSupabaseErrorMessage } from '../services/supabaseClient';
import {
  downloadResourceAttachmentResult,
  isPdfAttachment,
  isViewableDocumentAttachment,
  parseDocumentFile,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import {
  getNoteLayoutClasses,
  renderSafeBidiHtml,
  richHtmlToPlainText,
  sanitizeRichHtml,
} from '../utils/richText';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import LearningObjectivesPanel from './LearningObjectivesPanel';
import NoteAttachmentsPanel from './NoteAttachmentsPanel';
import type { ActivePdfTarget } from './PDFViewerModal';
import { PinEntityButton } from './PinCollectionsBar';
import ReadAloudButton from './ReadAloudButton';
import RichTextNoteEditor from './RichTextNoteEditor';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
import TaskFormModal from './TaskFormModal';
import VoiceRecorderButton from './VoiceRecorderButton';

type CourseSectionFocus = 'all' | 'info' | 'tasks' | 'resources' | 'notes';

interface CourseDetailPageProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  course: PersonalCourse | null;
  requestedCourseId: number;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  hubCategories: Record<LearningHubId, string[]>;
  courseNotes: BookNote[];
  linkedProjects: PracticalProject[];
  linkedUnifiedTasks: UnifiedTask[];
  linkedPaths: LearningPath[];
  allCourses?: PersonalCourse[];
  allLearningPaths?: LearningPath[];
  readingItems?: ReadingLibraryItem[];
  allProjects?: PracticalProject[];
  allMonths: MonthPlan[];
  onBack: () => void;
  onOpenPdf: (target: ActivePdfTarget) => void;
  onUpdateCourse: (id: number, updates: Partial<PersonalCourse>) => void;
  onDeleteCourse: (id: number) => void;
  onToggleCourseTask: (courseId: number, taskId: string) => void;
  onAddCourseTask: (courseId: number, text: string) => void;
  onDeleteCourseTask: (courseId: number, taskId: string) => void;
  onAddCourseResource: (
    courseId: number,
    title: string,
    type: StudyResource['type'],
    note: string,
    extras?: {
      id?: string;
      externalUrl?: string;
      attachmentName?: string;
      extractedPreview?: string;
      storagePath?: string;
      downloadUrl?: string;
      mimeType?: string;
      sizeBytes?: number;
    }
  ) => void;
  onUpdateCourseResource?: (
    courseId: number,
    resourceId: string,
    updates: Partial<StudyResource>
  ) => void;
  onDeleteCourseResource: (courseId: number, resourceId: string) => void;
  onJumpToMonth: (monthId: number) => void;
  onOpenPaths: () => void;
  onOpenTasksTab: () => void;
  onOpenCalendar?: () => void;
  onOpenNoteById: (noteId: string) => void;
  onAddStructuredNote: (payload: {
    hubId?: LearningHubId;
    noteType: NoteCategoryType;
    bookTitle: string;
    author: string;
    courseId?: number;
    courseTitle?: string;
    lectureTitle?: string;
    categoryLabel?: string;
    initialContent?: string;
    stayInCurrentView?: boolean;
  }) => string | void;
  onUpdateBookNote: (id: string, updates: Partial<BookNote>) => void;
  onDeleteBookNote: (id: string) => void;
  onUpdateUnifiedTask: (id: string, updates: Partial<UnifiedTask>) => void;
  onAddUnifiedTask: (payload: Omit<UnifiedTask, 'id'>) => void;
  onDeleteUnifiedTask?: (taskId: string) => void;
  pinCollections?: PinCollection[];
  onTogglePinEntity?: (collectionId: string, entityType: PinEntityType, entityId: string) => void;
  onQuickCreatePinCollection?: (title: string, entityType: PinEntityType, entityId: string) => void;
}

export default function CourseDetailPage({
  uid,
  canEdit,
  onRequireAuth,
  course,
  requestedCourseId,
  preferences,
  onUpdatePreferences,
  hubCategories,
  courseNotes,
  linkedProjects,
  linkedUnifiedTasks,
  linkedPaths,
  allCourses,
  allLearningPaths,
  readingItems,
  allProjects,
  allMonths,
  onBack,
  onOpenPdf,
  onUpdateCourse,
  onDeleteCourse,
  onToggleCourseTask,
  onAddCourseTask,
  onDeleteCourseTask,
  onAddCourseResource,
  onUpdateCourseResource,
  onDeleteCourseResource,
  onJumpToMonth,
  onOpenPaths,
  onOpenTasksTab,
  onOpenCalendar,
  onOpenNoteById,
  onAddStructuredNote,
  onUpdateBookNote,
  onDeleteBookNote,
  onUpdateUnifiedTask,
  onAddUnifiedTask,
  onDeleteUnifiedTask,
  pinCollections = [],
  onTogglePinEntity,
  onQuickCreatePinCollection,
}: CourseDetailPageProps) {
  const noteLayout = getNoteLayoutClasses(preferences);
  const [sectionFocus, setSectionFocus] = useState<CourseSectionFocus>('all');

  // Course edit form state
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [draftEdit, setDraftEdit] = useState<Partial<PersonalCourse>>({});

  // Confirm delete dialog
  const [confirmState, setConfirmState] = useState<
    | { type: 'course'; course: PersonalCourse }
    | { type: 'task'; courseId: number; taskId: string; label: string }
    | { type: 'resource'; courseId: number; resourceId: string; label: string }
    | { type: 'note'; noteId: string; label: string }
    | null
  >(null);

  // Tasks & Unified Tasks forms
  const [newTaskText, setNewTaskText] = useState('');
  const [newLinkedUnifiedTask, setNewLinkedUnifiedTask] = useState('');
  const [showNewUnifiedSched, setShowNewUnifiedSched] = useState(false);
  const [newUnifiedDate, setNewUnifiedDate] = useState<string>(() => getTodayDateKey());
  const [newUnifiedTime, setNewUnifiedTime] = useState<string>('18:00');
  const [newUnifiedDuration, setNewUnifiedDuration] = useState<number>(60);
  const [newUnifiedPriority, setNewUnifiedPriority] =
    useState<TaskPriority>('medium');

  // Inline task scheduling state (for course.tasks and linkedUnifiedTasks)
  const [schedCourseTaskId, setSchedCourseTaskId] = useState<string | null>(null);
  const [schedUnifiedTaskId, setSchedUnifiedTaskId] = useState<string | null>(
    null
  );
  const [schedDate, setSchedDate] = useState<string>(() => getTodayDateKey());
  const [schedTime, setSchedTime] = useState<string>('18:00');
  const [schedDuration, setSchedDuration] = useState<number>(60);
  const [schedPriority, setSchedPriority] = useState<TaskPriority>('medium');
  const [schedFeedback, setSchedFeedback] = useState<string | null>(null);

  // Add resource state
  const [showAddResource, setShowAddResource] = useState(false);
  const [newResTitle, setNewResTitle] = useState('');
  const [newResType, setNewResType] =
    useState<StudyResource['type']>('كتاب');
  const [newResNote, setNewResNote] = useState('');
  const [newResUrl, setNewResUrl] = useState('');
  const [newResAttachmentName, setNewResAttachmentName] = useState('');
  const [newResPreview, setNewResPreview] = useState('');
  const [newResStoragePath, setNewResStoragePath] = useState('');
  const [newResDownloadUrl, setNewResDownloadUrl] = useState('');
  const [newResMimeType, setNewResMimeType] = useState('');
  const [newResSizeBytes, setNewResSizeBytes] = useState<number | undefined>(
    undefined
  );
  const [pendingResId, setPendingResId] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [resourceActionError, setResourceActionError] = useState<string | null>(
    null
  );
  const [expandedResId, setExpandedResId] = useState<string | null>(null);
  const [replacingResId, setReplacingResId] = useState<string | null>(null);
  const [lastPickedResFile, setLastPickedResFile] = useState<File | null>(null);
  const [lastReplaceRetry, setLastReplaceRetry] = useState<{
    resId: string;
    file: File;
  } | null>(null);
  const courseResFileRef = useRef<HTMLInputElement | null>(null);
  const replaceResFileRef = useRef<HTMLInputElement | null>(null);

  // Unified Task Modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingUnifiedTask, setEditingUnifiedTask] = useState<UnifiedTask | null>(
    null
  );

  // Course Notes (in-page structured notes management + natural logical sorting)
  const [notesSortMode, setNotesSortMode] = useState<EntitySortMode>('logical');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState<{
    bookTitle: string;
    lectureTitle: string;
    progressMarker: string;
    content: string;
    quotes: string;
  }>({
    bookTitle: '',
    lectureTitle: '',
    progressMarker: '',
    content: '',
    quotes: '',
  });
  const [showNewNoteForm, setShowNewNoteForm] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteLecture, setNewNoteLecture] = useState('');

  const sortedCourseNotes = useMemo(
    () => sortBookNotesList(courseNotes, notesSortMode),
    [courseNotes, notesSortMode]
  );

  useEffect(() => {
    setSectionFocus('all');
    setIsEditingCourse(false);
    setShowAddResource(false);
    setNewTaskText('');
    setNewLinkedUnifiedTask('');
    setShowNewUnifiedSched(false);
    setSchedCourseTaskId(null);
    setSchedUnifiedTaskId(null);
    setSchedFeedback(null);
    setExpandedResId(null);
    setIsEditingNote(false);
    setShowNewNoteForm(false);
    setTaskModalOpen(false);
    setEditingUnifiedTask(null);
  }, [requestedCourseId]);

  useEffect(() => {
    if (sortedCourseNotes.length === 0) {
      setActiveNoteId(null);
      setIsEditingNote(false);
      return;
    }
    if (!activeNoteId || !sortedCourseNotes.some((n) => n.id === activeNoteId)) {
      setActiveNoteId(sortedCourseNotes[0].id);
      setIsEditingNote(false);
    }
  }, [sortedCourseNotes, activeNoteId]);

  const activeNote = useMemo(
    () =>
      activeNoteId
        ? sortedCourseNotes.find((n) => n.id === activeNoteId) ?? null
        : sortedCourseNotes[0] ?? null,
    [sortedCourseNotes, activeNoteId]
  );

  // Missing / deleted course route state
  if (!course) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center space-y-4">
        <p className="text-xs text-slate-500 tabular-nums">
          مسار الكورس #{requestedCourseId}
        </p>
        <h1 className="font-editorial text-2xl font-bold text-slate-900">
          تعذّر العثور على هذا الكورس
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          ربما تم حذف هذا الكورس أو تغيّر رقم المسار، أو أن بيانات حسابك قيد التحميل.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span>العودة إلى صفحة الكورسات</span>
        </button>
      </div>
    );
  }

  const hubMeta = getHubMeta(course.hubId);
  const tasksDone = course.tasks.filter((t) => t.done).length;
  const unifiedDone = linkedUnifiedTasks.filter((t) => t.status === 'done').length;
  const totalTasksCount = course.tasks.length + linkedUnifiedTasks.length;
  const totalTasksDone = tasksDone + unifiedDone;

  const coursePct =
    course.progressPct ??
    (course.completed
      ? 100
      : course.tasks.length > 0
      ? Math.round((tasksDone / course.tasks.length) * 100)
      : 0);

  const editHubCats =
    hubCategories[draftEdit.hubId ?? course.hubId ?? 'knowledge'] ?? [];

  const requireEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const startEditingCourse = () => {
    setDraftEdit({
      title: course.title,
      hubId: course.hubId ?? 'knowledge',
      category: course.category,
      studyStage: resolveCourseStudyStage(course),
      scheduledPeriod: course.scheduledPeriod ?? '',
      instructor: course.instructor ?? '',
      platform: course.platform ?? '',
      durationLabel: course.durationLabel ?? '',
      startDate: course.startDate ?? '',
      targetDate: course.targetDate ?? '',
      complementaryBook: course.complementaryBook,
      bookAuthor: course.bookAuthor,
      applicationMilestone: course.applicationMilestone,
      linkedMonths: [...course.linkedMonths],
      notes: course.notes ?? '',
    });
    setIsEditingCourse(true);
  };

  const handleSaveCourseEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;
    if (!(draftEdit.title ?? '').trim()) return;
    const nextStage = draftEdit.studyStage ?? resolveCourseStudyStage(course);
    onUpdateCourse(course.id, {
      ...draftEdit,
      title: (draftEdit.title ?? '').trim(),
      studyStage: nextStage,
      completed: nextStage === 'completed',
    });
    setIsEditingCourse(false);
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const text = newTaskText.trim();
    if (!text) return;
    onAddCourseTask(course.id, text);
    setNewTaskText('');
  };

  const handleAddLinkedUnifiedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const title = newLinkedUnifiedTask.trim();
    if (!title) return;
    const pickedDate = showNewUnifiedSched ? newUnifiedDate : '';
    const pickedTime = showNewUnifiedSched ? newUnifiedTime : '';
    const pickedDuration = showNewUnifiedSched ? newUnifiedDuration : 60;
    onAddUnifiedTask({
      title,
      description: `مهمة تطبيقية مرتبطة بكورس: ${course.title}`,
      hubId: course.hubId ?? 'knowledge',
      categoryLabel: course.category || 'تطبيق الكورسات',
      priority: showNewUnifiedSched ? newUnifiedPriority : 'medium',
      status: 'todo',
      dueDate: pickedDate,
      scheduledDate: pickedDate,
      startTime: pickedTime,
      endTime: pickedTime
        ? computeEndTimeFromStart(pickedTime, pickedDuration)
        : '',
      durationMinutes: pickedDuration,
      projectId: `course:${course.id}`,
      linkedLabel: course.title,
    });
    setNewLinkedUnifiedTask('');
    if (showNewUnifiedSched) {
      setShowNewUnifiedSched(false);
      setSchedFeedback(`تمت إضافة «${title}» وجدولتها ليوم ${pickedDate || 'بدون تاريخ'}.`);
    }
  };

  const uploadCourseResourceFile = async (file: File) => {
    if (!requireEdit()) return;
    setLastPickedResFile(file);
    setUploadingFile(true);
    setUploadProgressPct(0);
    setUploadStatusMsg(null);
    setResourceActionError(null);
    try {
      const generatedId = `c${course.id}-res-${Date.now()}`;
      setPendingResId(generatedId);
      const effectiveUid = uid || auth?.currentUser?.uid;
      const parsed = await parseDocumentFile(file);
      const previewSlice = isPdfAttachment(file.name, file.type)
        ? ''
        : parsed.plainText.slice(0, 7500);
      const uploadRes = await uploadResourceAttachment(
        effectiveUid,
        generatedId,
        file,
        previewSlice,
        (pct) => setUploadProgressPct(pct)
      );
      if (!newResTitle.trim()) {
        setNewResTitle(parsed.title);
      }
      setNewResType('ملف / مستند');
      setNewResAttachmentName(file.name);
      setNewResPreview(previewSlice);
      setNewResStoragePath(uploadRes.storagePath ?? '');
      setNewResDownloadUrl(uploadRes.downloadUrl ?? '');
      setNewResMimeType(uploadRes.mimeType);
      setNewResSizeBytes(uploadRes.sizeBytes);
      if (!newResNote.trim()) {
        setNewResNote(`ملف مرفق (${file.name})`);
      }
      if (uploadRes.uploadedToCloud) {
        setLastPickedResFile(null);
      }
      setUploadStatusMsg(
        uploadRes.uploadedToCloud
          ? {
              ok: true,
              text: 'تم رفع الملف ومزامنته سحابيًا ليفتح على الهاتف واللابتوب معًا.',
            }
          : {
              ok: false,
              text:
                uploadRes.errorMessage ||
                'تعذر رفع الملف للسحابة وتم حفظه محليًا فقط على هذا الجهاز.',
            }
      );
    } catch (err) {
      console.error('Course resource upload error:', err);
      setUploadStatusMsg({
        ok: false,
        text: formatSupabaseErrorMessage(err),
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handlePickCourseResourceFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadCourseResourceFile(file);
  };

  const handleResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const title = newResTitle.trim();
    if (!title) return;
    onAddCourseResource(course.id, title, newResType, newResNote.trim(), {
      id: pendingResId || undefined,
      externalUrl: newResUrl.trim() || undefined,
      attachmentName: newResAttachmentName || undefined,
      extractedPreview: newResPreview || undefined,
      storagePath: newResStoragePath || undefined,
      downloadUrl: newResDownloadUrl || undefined,
      mimeType: newResMimeType || undefined,
      sizeBytes: newResSizeBytes,
    });
    setNewResTitle('');
    setNewResNote('');
    setNewResUrl('');
    setNewResAttachmentName('');
    setNewResPreview('');
    setNewResStoragePath('');
    setNewResDownloadUrl('');
    setNewResMimeType('');
    setNewResSizeBytes(undefined);
    setPendingResId('');
    setLastPickedResFile(null);
    setUploadStatusMsg(null);
    setShowAddResource(false);
  };

  const replaceCourseResourceWithFile = async (targetResId: string, file: File) => {
    if (!course || !onUpdateCourseResource) return;
    if (!requireEdit()) {
      setReplacingResId(null);
      return;
    }

    setLastReplaceRetry({ resId: targetResId, file });
    setReplacingResId(targetResId);
    setUploadingFile(true);
    setUploadProgressPct(0);
    setResourceActionError(null);
    try {
      const effectiveUid = uid || auth?.currentUser?.uid;
      const parsed = await parseDocumentFile(file);
      const previewSlice = isPdfAttachment(file.name, file.type)
        ? ''
        : parsed.plainText.slice(0, 7500);
      const uploadRes = await uploadResourceAttachment(
        effectiveUid,
        targetResId,
        file,
        previewSlice,
        (pct) => setUploadProgressPct(pct)
      );
      onUpdateCourseResource(course.id, targetResId, {
        attachmentName: file.name,
        mimeType: uploadRes.mimeType,
        sizeBytes: uploadRes.sizeBytes,
        storagePath: uploadRes.storagePath,
        downloadUrl: uploadRes.downloadUrl,
        ...(previewSlice ? { extractedPreview: previewSlice } : {}),
      });
      if (!uploadRes.uploadedToCloud && uploadRes.errorMessage) {
        setResourceActionError(uploadRes.errorMessage);
      } else {
        setLastReplaceRetry(null);
      }
    } catch (err) {
      console.error('Replace course resource error:', err);
      setResourceActionError(formatSupabaseErrorMessage(err));
    } finally {
      setUploadingFile(false);
      setReplacingResId(null);
    }
  };

  const handleReplaceCourseResourceFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const targetResId = replacingResId;
    e.target.value = '';
    if (!file || !targetResId || !course || !onUpdateCourseResource) {
      setReplacingResId(null);
      return;
    }
    await replaceCourseResourceWithFile(targetResId, file);
  };

  const createCourseNoteInPlace = (
    lectureTitle?: string,
    initialContent?: string,
    customBookTitle?: string
  ) => {
    if (!requireEdit()) return;
    const lecTitle =
      (lectureTitle || '').trim() || `المحاضرة ${courseNotes.length + 1}`;
    const title =
      (customBookTitle || '').trim() || `${course.title} — ${lecTitle}`;
    const createdId = onAddStructuredNote({
      hubId: course.hubId || 'knowledge',
      noteType: 'course_lecture',
      bookTitle: title,
      author: course.instructor || course.bookAuthor || '',
      courseId: course.id,
      courseTitle: course.title,
      lectureTitle: lecTitle,
      categoryLabel: course.category || 'محاضرات وتطبيق عملي',
      initialContent: initialContent || '',
      stayInCurrentView: true,
    });
    if (typeof createdId === 'string' && createdId) {
      setActiveNoteId(createdId);
      setNoteDraft({
        bookTitle: title,
        lectureTitle: lecTitle,
        progressMarker: '',
        content: initialContent || '',
        quotes: '',
      });
      setIsEditingNote(true);
      setSectionFocus((prev) => (prev === 'all' ? 'all' : 'notes'));
    }
  };

  const handleCreateNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCourseNoteInPlace(newNoteLecture, '', newNoteTitle);
    setNewNoteTitle('');
    setNewNoteLecture('');
    setShowNewNoteForm(false);
  };

  const beginEditActiveNote = (note: BookNote) => {
    if (!requireEdit()) return;
    setNoteDraft({
      bookTitle: note.bookTitle,
      lectureTitle: note.lectureTitle ?? '',
      progressMarker: note.progressMarker ?? '',
      content: note.content ?? '',
      quotes: note.quotes ?? '',
    });
    setIsEditingNote(true);
  };

  const handleSaveActiveNote = (note: BookNote) => {
    if (!requireEdit()) return;
    const cleanTitle = noteDraft.bookTitle.trim() || note.bookTitle;
    onUpdateBookNote(note.id, {
      bookTitle: cleanTitle,
      lectureTitle: noteDraft.lectureTitle.trim(),
      progressMarker: noteDraft.progressMarker.trim(),
      content: sanitizeRichHtml(noteDraft.content),
      quotes: sanitizeRichHtml(noteDraft.quotes),
    });
    setIsEditingNote(false);
  };

  const handleConfirmDeleteAction = () => {
    if (!confirmState) return;
    if (confirmState.type === 'course') {
      onDeleteCourse(confirmState.course.id);
      onBack();
    } else if (confirmState.type === 'task') {
      onDeleteCourseTask(confirmState.courseId, confirmState.taskId);
    } else if (confirmState.type === 'resource') {
      onDeleteCourseResource(confirmState.courseId, confirmState.resourceId);
    } else if (confirmState.type === 'note') {
      onDeleteBookNote(confirmState.noteId);
      setIsEditingNote(false);
    }
    setConfirmState(null);
  };

  const showInfo = sectionFocus === 'all' || sectionFocus === 'info';
  const showTasks = sectionFocus === 'all' || sectionFocus === 'tasks';
  const showResources = sectionFocus === 'all' || sectionFocus === 'resources';
  const showNotes = sectionFocus === 'all' || sectionFocus === 'notes';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-3.5 sm:px-6 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>العودة إلى الكورسات</span>
          </button>

          <nav
            aria-label="مسار التنقل"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 min-w-0"
          >
            <button
              type="button"
              onClick={onBack}
              className="hover:text-[#1E3A5F] cursor-pointer whitespace-nowrap"
            >
              الكورسات
            </button>
            <span aria-hidden="true">/</span>
            <span className="truncate max-w-[160px]">{hubMeta.shortTitle}</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-800 truncate max-w-[260px]">
              {course.title}
            </span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {onTogglePinEntity && (
            <PinEntityButton
              entityType="course"
              entityId={String(course.id)}
              collections={pinCollections}
              canEdit={canEdit}
              onToggleItemInCollection={onTogglePinEntity}
              onQuickCreateCollection={onQuickCreatePinCollection}
              size="sm"
            />
          )}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() =>
                  onUpdateCourse(course.id, { isPublic: !course.isPublic })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  course.isPublic
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {course.isPublic ? (
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{course.isPublic ? 'منشور للعامة' : 'خاص'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUnifiedTask(null);
                  setTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إنشاء مهمة</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  isEditingCourse ? setIsEditingCourse(false) : startEditingCourse()
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isEditingCourse ? 'إلغاء التعديل' : 'تعديل الكورس'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmState({ type: 'course', course })}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حذف</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => createCourseNoteInPlace()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer flex-1 sm:flex-initial"
          >
            <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
            <span>+ نوت جديدة للكورس</span>
          </button>
        </div>
      </div>

      {/* Standalone Hero Summary & KPI Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-8 space-y-6">
        {isEditingCourse && canEdit ? (
          <form onSubmit={handleSaveCourseEdit} className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                تعديل بيانات الكورس
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                اسم الكورس *
                <input
                  type="text"
                  required
                  value={draftEdit.title ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, title: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                مسار التعلّم الكبير
                <select
                  value={draftEdit.hubId ?? 'knowledge'}
                  onChange={(e) =>
                    setDraftEdit((p) => ({
                      ...p,
                      hubId: e.target.value as LearningHubId,
                    }))
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {LEARNING_HUBS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                الفئة / المجال (اختياري)
                <input
                  type="text"
                  list="edit-course-cat-list"
                  value={draftEdit.category ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, category: e.target.value }))
                  }
                  placeholder="اختر أو اكتب فئة..."
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
                <datalist id="edit-course-cat-list">
                  {editHubCats.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                تصنيف الحالة والتركيز
                <select
                  value={draftEdit.studyStage ?? resolveCourseStudyStage(course)}
                  onChange={(e) =>
                    setDraftEdit((p) => ({
                      ...p,
                      studyStage: e.target.value as CourseStudyStage,
                    }))
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {COURSE_STUDY_STAGES_META.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </label>

              {draftEdit.studyStage === 'scheduled_later' && (
                <label className="block text-xs font-medium text-slate-700">
                  الفترة المجدولة خلال السنة
                  <input
                    type="text"
                    value={draftEdit.scheduledPeriod ?? ''}
                    onChange={(e) =>
                      setDraftEdit((p) => ({
                        ...p,
                        scheduledPeriod: e.target.value,
                      }))
                    }
                    placeholder="مثلاً: الربع الثالث 2026"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              )}

              <label className="block text-xs font-medium text-slate-700">
                المحاضر / المدرب (اختياري)
                <input
                  type="text"
                  value={draftEdit.instructor ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, instructor: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                المنصة / المصدر (اختياري)
                <input
                  type="text"
                  value={draftEdit.platform ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, platform: e.target.value }))
                  }
                  placeholder="Coursera / YouTube /..."
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                المدة الزمنية (اختياري)
                <input
                  type="text"
                  value={draftEdit.durationLabel ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({
                      ...p,
                      durationLabel: e.target.value,
                    }))
                  }
                  placeholder="مثلاً: 12 ساعة"
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                تاريخ البدء (اختياري)
                <input
                  type="date"
                  value={draftEdit.startDate ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, startDate: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                التاريخ المستهدف (اختياري)
                <input
                  type="date"
                  value={draftEdit.targetDate ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, targetDate: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                المرجع المكمل (اختياري)
                <input
                  type="text"
                  value={draftEdit.complementaryBook ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({
                      ...p,
                      complementaryBook: e.target.value,
                    }))
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                مؤلف المرجع (اختياري)
                <input
                  type="text"
                  value={draftEdit.bookAuthor ?? ''}
                  onChange={(e) =>
                    setDraftEdit((p) => ({ ...p, bookAuthor: e.target.value }))
                  }
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                الوحدات المرتبطة (اختياري)
                <input
                  type="text"
                  value={(draftEdit.linkedMonths ?? []).join(', ')}
                  onChange={(e) => {
                    const nums = e.target.value
                      .split(/[,،\s]+/)
                      .map((n) => parseInt(n, 10))
                      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 100);
                    setDraftEdit((p) => ({ ...p, linkedMonths: nums }));
                  }}
                  placeholder="1, 2"
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-slate-700">
              هدف التطبيق العملي (اختياري)
              <textarea
                rows={2}
                value={draftEdit.applicationMilestone ?? ''}
                onChange={(e) =>
                  setDraftEdit((p) => ({
                    ...p,
                    applicationMilestone: e.target.value,
                  }))
                }
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingCourse(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                إلغاء التعديلات
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                حفظ التغييرات
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-[#1E3A5F]">
                    {hubMeta.title}
                  </span>
                  {course.category && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-medium text-slate-700">
                        {course.category}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    كورس #{String(course.id).padStart(2, '0')}
                  </span>
                </div>

                <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                  <BidiText text={course.title} />
                </h1>

                {(course.instructor ||
                  course.platform ||
                  course.durationLabel ||
                  course.startDate ||
                  course.targetDate) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                    {course.instructor && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>المحاضر: {course.instructor}</span>
                      </span>
                    )}
                    {course.platform && (
                      <span>المنصة: {course.platform}</span>
                    )}
                    {course.durationLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Clock
                          className="w-3.5 h-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <span>{course.durationLabel}</span>
                      </span>
                    )}
                    {(course.startDate || course.targetDate) && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar
                          className="w-3.5 h-3.5 text-slate-400"
                          aria-hidden="true"
                        />
                        <span>
                          {course.startDate || '—'} ← {course.targetDate || '—'}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  const nextDone = !course.completed;
                  onUpdateCourse(course.id, {
                    completed: nextDone,
                    studyStage: nextDone ? 'completed' : 'in_progress',
                    progressPct: nextDone ? 100 : coursePct,
                  });
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                  course.completed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {course.completed ? (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-700"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="w-4 h-4 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <span>{course.completed ? 'كورس مكتمل' : 'تحديد كمكتمل'}</span>
              </button>
            </div>

            {/* Study Stage & Focus Triage Controls */}
            {(() => {
              const currentStage = resolveCourseStudyStage(course);
              const currentMeta = getCourseStageMeta(currentStage);
              return (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        تصنيف وتركيز الكورس:
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded border ${currentMeta.badgeClass}`}
                      >
                        {currentMeta.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      حدّد أولوية هذا الكورس لتظهر في «التركيز الحالي» دون تشتّت
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {COURSE_STUDY_STAGES_META.map((st) => {
                      const active = currentStage === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          disabled={!canEdit}
                          onClick={() =>
                            onUpdateCourse(course.id, {
                              studyStage: st.id,
                              completed: st.id === 'completed',
                            })
                          }
                          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                            active
                              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  {currentStage === 'scheduled_later' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium text-slate-700">
                        الفترة المجدولة:
                      </span>
                      <input
                        type="text"
                        readOnly={!canEdit}
                        value={course.scheduledPeriod ?? ''}
                        onChange={(e) =>
                          onUpdateCourse(course.id, {
                            scheduledPeriod: e.target.value,
                          })
                        }
                        placeholder="مثلاً: الربع الثالث 2026 / شهر سبتمبر..."
                        className="w-full sm:flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 4-Column Summary Strip + Progress Slider */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-500 block">
                  التقدم العام
                </span>
                <span className="text-lg font-bold text-[#1E3A5F] tabular-nums">
                  {coursePct}%
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-500 block">
                  المهام المرتبطة
                </span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {totalTasksDone} / {totalTasksCount}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-500 block">
                  المصادر والملفات
                </span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {course.resources.length}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[11px] text-slate-500 block">
                  النوتس والتلخيصات
                </span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {courseNotes.length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  تحديث نسبة التقدم في الكورس
                </span>
                <span className="font-bold text-[#1E3A5F] tabular-nums">
                  {coursePct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                disabled={!canEdit}
                value={coursePct}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  onUpdateCourse(course.id, {
                    progressPct: pct,
                    completed: pct >= 100,
                  });
                }}
                className="w-full accent-[#1E3A5F] cursor-pointer disabled:opacity-60"
              />
            </div>

            {/* Section Focus Bar */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'العرض الشامل (جميع الأقسام)' },
                  { id: 'info', label: 'المعلومات والتكرار' },
                  { id: 'tasks', label: `المهام المرتبطة (${totalTasksCount})` },
                  {
                    id: 'resources',
                    label: `المصادر والملفات (${course.resources.length})`,
                  },
                  {
                    id: 'notes',
                    label: `النوتس الخاصة (${courseNotes.length})`,
                  },
                ] as const
              ).map((tab) => {
                const active = sectionFocus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSectionFocus(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-[#1E3A5F] font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 1: Learning Objectives, Course Details, Complementary Book, Links & Spaced Repetition */}
      {showInfo && (
        <div className="space-y-6">
          <LearningObjectivesPanel
            objectives={course.learningObjectives}
            canEdit={canEdit}
            onChange={(next) =>
              onUpdateCourse(course.id, { learningObjectives: next })
            }
            title={`أهداف التعلّم — ${course.title}`}
            subtitle="حدّد لماذا تدرس هذا الكورس والنتائج أو المهارات العملية التي تستهدف تحقيقها."
          />

          {(course.complementaryBook ||
            course.applicationMilestone ||
            course.linkedMonths.length > 0 ||
            linkedPaths.length > 0) && (
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                تفاصيل المنهج والتطبيق والروابط
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {(course.complementaryBook || course.bookAuthor) && (
                  <div className="p-4 bg-slate-50/75 border border-slate-200 rounded-lg space-y-1">
                    <span className="font-semibold text-slate-500 block">
                      المرجع المكمل
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      <BidiText text={course.complementaryBook || '—'} />
                    </p>
                    {course.bookAuthor && (
                      <p className="text-slate-600">{course.bookAuthor}</p>
                    )}
                  </div>
                )}

                {course.applicationMilestone && (
                  <div className="p-4 bg-slate-50/75 border border-slate-200 rounded-lg space-y-1">
                    <span className="font-semibold text-slate-500 block">
                      هدف التطبيق العملي
                    </span>
                    <BidiText
                      text={course.applicationMilestone}
                      as="div"
                      multiline
                      className="text-slate-800 leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {(course.linkedMonths.length > 0 || linkedPaths.length > 0) && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  {course.linkedMonths.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-500">
                        الوحدات المرتبطة:
                      </span>
                      {course.linkedMonths.map((monthNum) => {
                        const mObj = allMonths.find((m) => m.id === monthNum);
                        return (
                          <button
                            key={monthNum}
                            type="button"
                            onClick={() => onJumpToMonth(monthNum)}
                            className="px-2.5 py-1 font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md tabular-nums cursor-pointer"
                          >
                            {mObj ? `الوحدة ${monthNum}: ${mObj.theme}` : `الوحدة ${monthNum}`}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {linkedPaths.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-500">
                        مسارات التعلّم:
                      </span>
                      {linkedPaths.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={onOpenPaths}
                          className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <Compass className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                          <span>{p.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <SpacedRepetitionPanel
            canEdit={canEdit}
            value={{
              readingModes: course.readingModes,
              learningMethods: course.learningMethods,
              reviewCount: course.reviewCount,
              listenCount: course.listenCount,
              repetitionStage: course.repetitionStage,
              nextReviewDateKey: course.nextReviewDateKey,
              lastReviewedDateKey: course.lastReviewedDateKey,
            }}
            onChange={(updates) => onUpdateCourse(course.id, updates)}
            title="تتبع التكرار المتباعد، السماع المتكرر وأنماط القراءة لهذا الكورس"
            customReadingModes={preferences.customReadingModes}
            onUpdateReadingModes={(nextModes) =>
              onUpdatePreferences({ customReadingModes: nextModes })
            }
          />
        </div>
      )}

      {/* SECTION 2 & 3: Tasks + Resources Side-by-Side (or full width when focused) */}
      {(showTasks || showResources) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Resources & PDFs + Cloud Images */}
          {showResources && (
            <section
              className={`${
                showTasks ? 'lg:col-span-6' : 'lg:col-span-12'
              } bg-white border border-slate-200 rounded-xl p-6 space-y-4`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookMarked
                    className="w-4 h-4 text-[#1E3A5F]"
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-bold text-slate-900">
                    المصادر والملفات وملفات الـ PDF ({course.resources.length})
                  </h2>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowAddResource((v) => !v)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {showAddResource ? 'إلغاء' : '+ إضافة مصدر / PDF'}
                  </button>
                )}
              </div>

              {showAddResource && canEdit && (
                <form
                  onSubmit={handleResourceSubmit}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={newResTitle}
                      onChange={(e) => setNewResTitle(e.target.value)}
                      placeholder="عنوان المصدر أو الملف..."
                      className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                    />
                    <select
                      value={newResType}
                      onChange={(e) =>
                        setNewResType(e.target.value as StudyResource['type'])
                      }
                      className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="كتاب">كتاب</option>
                      <option value="سلسلة محاضرات">سلسلة محاضرات</option>
                      <option value="مقال / مدخل">مقال / مدخل</option>
                      <option value="أداة تطبيق">أداة تطبيق</option>
                      <option value="ملف / مستند">ملف / مستند (PDF / Word)</option>
                      <option value="رابط خارجي">رابط خارجي</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="url"
                      value={newResUrl}
                      onChange={(e) => setNewResUrl(e.target.value)}
                      placeholder="رابط خارجي اختياري (https://...)"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <div>
                      <input
                        ref={courseResFileRef}
                        type="file"
                        accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.txt,text/plain,.md,.markdown"
                        className="hidden"
                        onChange={(e) => void handlePickCourseResourceFile(e)}
                      />
                      <button
                        type="button"
                        disabled={uploadingFile}
                        onClick={() => courseResFileRef.current?.click()}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {uploadingFile ? (
                          <Loader2
                            className="w-3.5 h-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span className="truncate">
                          {uploadingFile
                            ? `جاري الرفع للسحابة (${uploadProgressPct}%)...`
                            : newResAttachmentName
                            ? `مرفق: ${newResAttachmentName}`
                            : 'رفع PDF / Word (حتى 100 ميجا)'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={newResNote}
                    onChange={(e) => setNewResNote(e.target.value)}
                    placeholder="ملاحظة مختصرة (اختياري)..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />

                  {uploadStatusMsg && (
                    <div
                      className={`text-xs px-3 py-2 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${
                        uploadStatusMsg.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <span>{uploadStatusMsg.text}</span>
                      {!uploadStatusMsg.ok && lastPickedResFile && (
                        <button
                          type="button"
                          onClick={() =>
                            void uploadCourseResourceFile(lastPickedResFile)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-md font-semibold cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" aria-hidden="true" />
                          <span>إعادة المحاولة</span>
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={uploadingFile}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    حفظ المصدر
                  </button>
                </form>
              )}

              {resourceActionError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                  <span>{resourceActionError}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {lastReplaceRetry && (
                      <button
                        type="button"
                        onClick={() =>
                          void replaceCourseResourceWithFile(
                            lastReplaceRetry.resId,
                            lastReplaceRetry.file
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-md font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        <span>إعادة المحاولة</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setResourceActionError(null);
                        setLastReplaceRetry(null);
                      }}
                      className="text-amber-700 hover:text-amber-950 font-semibold cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={replaceResFileRef}
                type="file"
                accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.txt,text/plain,.md,.markdown"
                className="hidden"
                onChange={(e) => void handleReplaceCourseResourceFile(e)}
              />

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50/40 max-h-[380px] overflow-y-auto thin-scrollbar">
                {course.resources.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">
                    لا توجد مصادر أو ملفات PDF أو Word مضافة لهذا الكورس بعد.
                  </p>
                ) : (
                  course.resources.map((res) => {
                    const isPdf =
                      isPdfAttachment(res.attachmentName, res.mimeType) ||
                      (res.externalUrl ? isPdfAttachment(res.externalUrl) : false);
                    const hasAttachedFile = Boolean(
                      res.attachmentName || res.storagePath || res.downloadUrl
                    );
                    const needsCloudSync =
                      Boolean(res.attachmentName) &&
                      (!res.storagePath || res.storagePath.startsWith('users/'));
                    const isReplacingThis =
                      uploadingFile && replacingResId === res.id;
                    const isViewable =
                      isPdf ||
                      isViewableDocumentAttachment(
                        res.attachmentName,
                        res.mimeType
                      ) ||
                      Boolean(res.extractedPreview) ||
                      hasAttachedFile;
                    const isPreviewOpen = expandedResId === res.id;
                    const resolvedUid = uid || auth?.currentUser?.uid;

                    const handleOpenDocModal = () => {
                      setResourceActionError(null);
                      onOpenPdf({
                        uid: resolvedUid,
                        title: res.title,
                        fileName:
                          res.attachmentName ||
                          (isPdf ? `${res.title}.pdf` : `${res.title}.docx`),
                        resourceId: res.id,
                        storagePath: res.storagePath,
                        downloadUrl:
                          res.downloadUrl || (isPdf ? res.externalUrl : undefined),
                        mimeType: res.mimeType,
                        extractedPreview: res.extractedPreview,
                        contextLabel: course.title,
                      });
                    };

                    return (
                      <div
                        key={res.id}
                        className="bg-white first:rounded-t-xl last:rounded-b-xl"
                      >
                        <div className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {isViewable ? (
                                <button
                                  type="button"
                                  onClick={handleOpenDocModal}
                                  className="font-bold text-[#1E3A5F] hover:underline text-right cursor-pointer"
                                >
                                  {res.title}
                                </button>
                              ) : (
                                <span className="font-semibold text-slate-900">
                                  {res.title}
                                </span>
                              )}
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-slate-500">{res.type}</span>
                              {res.attachmentName && (
                                <span className="text-[11px] text-emerald-700 font-medium break-all">
                                  ({res.attachmentName})
                                </span>
                              )}
                              {needsCloudSync && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 rounded">
                                  محلي فقط — يحتاج مزامنة للسحابة
                                </span>
                              )}
                            </div>
                            {res.note && (
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                {res.note}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {isViewable && (
                              <button
                                type="button"
                                onClick={handleOpenDocModal}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                              >
                                <Eye className="w-3 h-3" aria-hidden="true" />
                                <span>{isPdf ? 'فتح PDF' : 'فتح الملف'}</span>
                              </button>
                            )}

                            {res.extractedPreview && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedResId(
                                      isPreviewOpen ? null : res.id
                                    )
                                  }
                                  title="معاينة النص"
                                  className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                                >
                                  <FileText
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      createCourseNoteInPlace(
                                        res.title,
                                        res.extractedPreview
                                      )
                                    }
                                    title="إنشاء نوت من هذا النص"
                                    className="p-1.5 text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                                  >
                                    <PenLine
                                      className="w-3.5 h-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                )}
                              </>
                            )}

                            {hasAttachedFile && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setResourceActionError(null);
                                  const result =
                                    await downloadResourceAttachmentResult({
                                      uid: resolvedUid,
                                      resourceId: res.id,
                                      fileName: res.attachmentName || res.title,
                                      mimeType: res.mimeType,
                                      storagePath: res.storagePath,
                                      downloadUrl: res.downloadUrl,
                                    });
                                  if (!result.ok && result.errorMessage) {
                                    setResourceActionError(result.errorMessage);
                                  }
                                }}
                                title="تنزيل الملف"
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                <Download
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                />
                                <span>تنزيل</span>
                              </button>
                            )}

                            {canEdit && onUpdateCourseResource && (
                              <button
                                type="button"
                                disabled={uploadingFile}
                                onClick={() => {
                                  setReplacingResId(res.id);
                                  replaceResFileRef.current?.click();
                                }}
                                title="رفع أو استبدال ملف PDF ومزامنته على كل الأجهزة"
                                className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-md cursor-pointer disabled:opacity-50 ${
                                  needsCloudSync
                                    ? 'text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                                    : 'text-[#1E3A5F] bg-slate-100 hover:bg-slate-200'
                                }`}
                              >
                                {isReplacingThis ? (
                                  <Loader2
                                    className="w-3 h-3 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <FileUp
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                )}
                                <span>
                                  {isReplacingThis
                                    ? `${uploadProgressPct}%`
                                    : needsCloudSync
                                    ? 'مزامنة للسحابة'
                                    : hasAttachedFile
                                    ? 'استبدال'
                                    : 'إرفاق ملف'}
                                </span>
                              </button>
                            )}

                            {res.externalUrl && !isPdf && (
                              <a
                                href={res.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`فتح رابط ${res.title}`}
                                className="p-1.5 text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md"
                              >
                                <ExternalLink
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              </a>
                            )}

                            {!res.attachmentName && !res.externalUrl && (
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(
                                  res.searchQuery || res.title
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`بحث عن ${res.title}`}
                                className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                              >
                                <ExternalLink
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              </a>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmState({
                                    type: 'resource',
                                    courseId: course.id,
                                    resourceId: res.id,
                                    label: res.title,
                                  })
                                }
                                aria-label="حذف المصدر"
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        {isPreviewOpen && res.extractedPreview && (
                          <div className="px-3.5 pb-3">
                            <BidiText
                              text={res.extractedPreview}
                              as="div"
                              multiline
                              className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 max-h-48 overflow-y-auto leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <ImageAttachmentGallery
                uid={uid}
                scopeKey={`course:${course.id}`}
                title="صور الكورس والمخططات (متزامنة بين الهاتف واللابتوب)"
                canEdit={canEdit}
                onRequireAuth={onRequireAuth}
              />
            </section>
          )}

          {/* Tasks & Linked Projects Column */}
          {showTasks && (
            <div
              className={`${
                showResources ? 'lg:col-span-6' : 'lg:col-span-12'
              } space-y-6`}
            >
              {/* Course Lesson & Action Tasks */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <h2 className="text-base font-bold text-slate-900">
                    مهام الدروس والتطبيق المباشر ({tasksDone} / {course.tasks.length})
                  </h2>
                  {onOpenCalendar && (
                    <button
                      type="button"
                      onClick={onOpenCalendar}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>فتح تقويم الجدولة ←</span>
                    </button>
                  )}
                </div>

                {schedFeedback && (
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2">
                    <span>{schedFeedback}</span>
                    <button
                      type="button"
                      onClick={() => setSchedFeedback(null)}
                      className="text-[11px] font-semibold hover:underline cursor-pointer"
                    >
                      إخفاء
                    </button>
                  </div>
                )}

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-[340px] sm:max-h-[380px] overflow-y-auto thin-scrollbar">
                  {course.tasks.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">
                      لا توجد مهام مضافة بعد. أضف أول مهمة عملية للكورس.
                    </p>
                  ) : (
                    course.tasks.map((task) => {
                      const canonicalId = `course:${course.id}:${task.id}`;
                      const linkedCalTask = linkedUnifiedTasks.find(
                        (ut) => ut.projectId === canonicalId
                      );
                      const scheduledDate =
                        linkedCalTask?.scheduledDate ||
                        linkedCalTask?.dueDate ||
                        '';
                      const isSchedulingThis = schedCourseTaskId === task.id;

                      return (
                        <div key={task.id} className="bg-white px-3.5 py-3 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => onToggleCourseTask(course.id, task.id)}
                                aria-pressed={task.done}
                                className="flex items-start gap-2.5 text-right flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75"
                              >
                                {task.done ? (
                                  <CheckSquare
                                    className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Square
                                    className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className={`text-xs sm:text-sm leading-relaxed break-words ${
                                    task.done
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  <BidiText text={task.text} />
                                </span>
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSchedulingThis) {
                                      setSchedCourseTaskId(null);
                                      return;
                                    }
                                    setSchedUnifiedTaskId(null);
                                    setSchedCourseTaskId(task.id);
                                    setSchedDate(scheduledDate || getTodayDateKey());
                                    setSchedTime(linkedCalTask?.startTime || '18:00');
                                    setSchedDuration(
                                      linkedCalTask?.durationMinutes || 60
                                    );
                                    setSchedPriority(
                                      linkedCalTask?.priority || 'medium'
                                    );
                                  }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer ${
                                    scheduledDate
                                      ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/30 text-[#1E3A5F]'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <Calendar
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {scheduledDate ? 'تعديل الجدول' : 'جدولة'}
                                  </span>
                                </button>
                              )}

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({
                                      type: 'task',
                                      courseId: course.id,
                                      taskId: task.id,
                                      label: task.text,
                                    })
                                  }
                                  aria-label="حذف المهمة"
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>

                          {scheduledDate && (
                            <div className="flex flex-wrap items-center gap-2 pr-6 text-[11px] text-[#1E3A5F]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded border border-slate-200 font-medium tabular-nums">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                <span>
                                  مجدولة: {scheduledDate}
                                  {linkedCalTask?.startTime
                                    ? ` · ${linkedCalTask.startTime}`
                                    : ''}
                                  {linkedCalTask?.durationMinutes
                                    ? ` · ${linkedCalTask.durationMinutes}د`
                                    : ''}
                                </span>
                              </span>
                              {onOpenCalendar && (
                                <button
                                  type="button"
                                  onClick={onOpenCalendar}
                                  className="font-semibold hover:underline cursor-pointer"
                                >
                                  عرض في التقويم ←
                                </button>
                              )}
                            </div>
                          )}

                          {isSchedulingThis && canEdit && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <label className="block text-[11px] text-slate-600">
                                  التاريخ
                                  <input
                                    type="date"
                                    value={schedDate}
                                    onChange={(e) => setSchedDate(e.target.value)}
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </label>
                                <label className="block text-[11px] text-slate-600">
                                  وقت البدء
                                  <input
                                    type="time"
                                    value={schedTime}
                                    onChange={(e) => setSchedTime(e.target.value)}
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </label>
                                <label className="block text-[11px] text-slate-600">
                                  المدة
                                  <select
                                    value={schedDuration}
                                    onChange={(e) =>
                                      setSchedDuration(Number(e.target.value))
                                    }
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  >
                                    {COURSE_DURATION_OPTIONS.map((m) => (
                                      <option key={m} value={m}>
                                        {m} دقيقة
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-[11px] text-slate-600">
                                  الأولوية
                                  <select
                                    value={schedPriority}
                                    onChange={(e) =>
                                      setSchedPriority(
                                        e.target.value as TaskPriority
                                      )
                                    }
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  >
                                    <option value="high">عالية</option>
                                    <option value="medium">متوسطة</option>
                                    <option value="low">منخفضة</option>
                                  </select>
                                </label>
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {linkedCalTask && scheduledDate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateUnifiedTask(linkedCalTask.id, {
                                        scheduledDate: '',
                                        dueDate: '',
                                        startTime: '',
                                        endTime: '',
                                      });
                                      setSchedCourseTaskId(null);
                                      setSchedFeedback('تم إلغاء جدولة المهمة من التقويم.');
                                    }}
                                    className="px-2.5 py-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                                  >
                                    إلغاء الجدولة
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSchedCourseTaskId(null)}
                                  className="px-3 py-1.5 text-[11px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const endTime = schedTime
                                      ? computeEndTimeFromStart(
                                          schedTime,
                                          schedDuration
                                        )
                                      : '';
                                    if (linkedCalTask) {
                                      onUpdateUnifiedTask(linkedCalTask.id, {
                                        scheduledDate: schedDate,
                                        dueDate: schedDate,
                                        startTime: schedTime,
                                        endTime,
                                        durationMinutes: schedDuration,
                                        priority: schedPriority,
                                        status: task.done ? 'done' : 'todo',
                                      });
                                    } else {
                                      onAddUnifiedTask({
                                        title: task.text,
                                        description: `مهمة درس / تطبيق من كورس: ${course.title}`,
                                        hubId: course.hubId ?? 'knowledge',
                                        categoryLabel:
                                          course.category || 'مهام ودروس الكورسات',
                                        priority: schedPriority,
                                        status: task.done ? 'done' : 'todo',
                                        dueDate: schedDate,
                                        scheduledDate: schedDate,
                                        startTime: schedTime,
                                        endTime,
                                        durationMinutes: schedDuration,
                                        projectId: canonicalId,
                                        linkedLabel: course.title,
                                      });
                                    }
                                    setSchedCourseTaskId(null);
                                    setSchedFeedback(
                                      `تم حفظ جدولة «${task.text}» يوم ${schedDate} الساعة ${schedTime}.`
                                    );
                                  }}
                                  className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                                >
                                  حفظ في المهام والتقويم
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {canEdit && (
                  <form
                    onSubmit={handleTaskSubmit}
                    className="flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      placeholder="أضف مهمة أو درسًا جديدًا داخل الكورس..."
                      className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إضافة</span>
                    </button>
                  </form>
                )}
              </section>

              {/* Linked Unified Tasks & Practical Projects */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderKanban
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-bold text-slate-900">
                      المهام والمشاريع العامة المرتبطة بالكورس (
                      {linkedProjects.length + linkedUnifiedTasks.length})
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUnifiedTask(null);
                          setTaskModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>إنشاء مهمة مرتبطة</span>
                      </button>
                    )}
                    {onOpenCalendar && (
                      <button
                        type="button"
                        onClick={onOpenCalendar}
                        className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                      >
                        التقويم ←
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenTasksTab}
                      className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      إدارة كل المهام والمشاريع ←
                    </button>
                  </div>
                </div>

                {linkedProjects.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500 block">
                      مشاريع تطبيقية مرتبطة
                    </span>
                    <div className="space-y-2">
                      {linkedProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              <BidiText text={proj.title} />
                            </p>
                            {proj.deliverables && (
                              <p className="text-[11px] text-slate-600 truncate">
                                المخرجات: <BidiText text={proj.deliverables} />
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-[#1E3A5F] tabular-nums shrink-0">
                            {proj.progressPct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {linkedUnifiedTasks.length > 0 ? (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-[340px] sm:max-h-[380px] overflow-y-auto thin-scrollbar">
                    {linkedUnifiedTasks.map((ut) => {
                      const isDone = ut.status === 'done';
                      const utSchedDate = ut.scheduledDate || ut.dueDate || '';
                      const isSchedulingUt = schedUnifiedTaskId === ut.id;
                      return (
                        <div key={ut.id} className="px-3.5 py-2.5 bg-white space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                onUpdateUnifiedTask(ut.id, {
                                  status: isDone ? 'todo' : 'done',
                                })
                              }
                              className="flex items-start gap-2.5 text-right flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed"
                            >
                              {isDone ? (
                                <CheckSquare
                                  className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Square
                                  className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <div className="min-w-0 flex-1 space-y-1">
                                <span
                                  className={`text-xs block break-words ${
                                    isDone
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-800 font-medium'
                                  }`}
                                >
                                  <BidiText text={ut.title} />
                                </span>
                                {utSchedDate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-100 border border-slate-200 text-[#1E3A5F] rounded tabular-nums">
                                    <Clock className="w-3 h-3" aria-hidden="true" />
                                    <span>
                                      {utSchedDate}
                                      {ut.startTime ? ` · ${ut.startTime}` : ''}
                                      {ut.durationMinutes
                                        ? ` · ${ut.durationMinutes}د`
                                        : ''}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {utSchedDate && onOpenCalendar && (
                                <button
                                  type="button"
                                  onClick={onOpenCalendar}
                                  className="px-2 py-1 text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                                >
                                  في التقويم
                                </button>
                              )}
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUnifiedTask(ut);
                                      setTaskModalOpen(true);
                                    }}
                                    className="px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                                  >
                                    تعديل
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isSchedulingUt) {
                                        setSchedUnifiedTaskId(null);
                                        return;
                                      }
                                      setSchedCourseTaskId(null);
                                      setSchedUnifiedTaskId(ut.id);
                                      setSchedDate(utSchedDate || getTodayDateKey());
                                      setSchedTime(ut.startTime || '18:00');
                                      setSchedDuration(ut.durationMinutes || 60);
                                      setSchedPriority(ut.priority || 'medium');
                                    }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer ${
                                      utSchedDate
                                        ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/30 text-[#1E3A5F]'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <Calendar
                                      className="w-3 h-3"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {utSchedDate ? 'تعديل الجدول' : 'جدولة'}
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {isSchedulingUt && canEdit && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <label className="block text-[11px] text-slate-600">
                                  التاريخ
                                  <input
                                    type="date"
                                    value={schedDate}
                                    onChange={(e) => setSchedDate(e.target.value)}
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </label>
                                <label className="block text-[11px] text-slate-600">
                                  وقت البدء
                                  <input
                                    type="time"
                                    value={schedTime}
                                    onChange={(e) => setSchedTime(e.target.value)}
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  />
                                </label>
                                <label className="block text-[11px] text-slate-600">
                                  المدة
                                  <select
                                    value={schedDuration}
                                    onChange={(e) =>
                                      setSchedDuration(Number(e.target.value))
                                    }
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  >
                                    {COURSE_DURATION_OPTIONS.map((m) => (
                                      <option key={m} value={m}>
                                        {m} دقيقة
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-[11px] text-slate-600">
                                  الأولوية
                                  <select
                                    value={schedPriority}
                                    onChange={(e) =>
                                      setSchedPriority(
                                        e.target.value as TaskPriority
                                      )
                                    }
                                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                  >
                                    <option value="high">عالية</option>
                                    <option value="medium">متوسطة</option>
                                    <option value="low">منخفضة</option>
                                  </select>
                                </label>
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {utSchedDate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateUnifiedTask(ut.id, {
                                        scheduledDate: '',
                                        dueDate: '',
                                        startTime: '',
                                        endTime: '',
                                      });
                                      setSchedUnifiedTaskId(null);
                                      setSchedFeedback('تم إلغاء جدولة المهمة.');
                                    }}
                                    className="px-2.5 py-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                                  >
                                    إلغاء الجدولة
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSchedUnifiedTaskId(null)}
                                  className="px-3 py-1.5 text-[11px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateUnifiedTask(ut.id, {
                                      scheduledDate: schedDate,
                                      dueDate: schedDate,
                                      startTime: schedTime,
                                      endTime: schedTime
                                        ? computeEndTimeFromStart(
                                            schedTime,
                                            schedDuration
                                          )
                                        : '',
                                      durationMinutes: schedDuration,
                                      priority: schedPriority,
                                    });
                                    setSchedUnifiedTaskId(null);
                                    setSchedFeedback(
                                      `تم تحديث موعد «${ut.title}» إلى ${schedDate}.`
                                    );
                                  }}
                                  className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                                >
                                  حفظ الموعد
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  linkedProjects.length === 0 && (
                    <p className="text-xs text-slate-500">
                      لا توجد مهام عامة أو مشاريع مرتبطة بهذا الكورس حتى الآن.
                    </p>
                  )
                )}

                {canEdit && (
                  <form
                    onSubmit={handleAddLinkedUnifiedSubmit}
                    className="space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={newLinkedUnifiedTask}
                        onChange={(e) => setNewLinkedUnifiedTask(e.target.value)}
                        placeholder="إضافة مهمة أو تطبيق عملي مرتبط بالكورس..."
                        className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                      />
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowNewUnifiedSched((v) => !v)}
                          className={`inline-flex items-center gap-1 px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg border cursor-pointer ${
                            showNewUnifiedSched
                              ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/30 text-[#1E3A5F]'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>جدولة بالوقت</span>
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>ربط مهمة</span>
                        </button>
                      </div>
                    </div>

                    {showNewUnifiedSched && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <label className="block text-[11px] text-slate-600">
                          التاريخ
                          <input
                            type="date"
                            value={newUnifiedDate}
                            onChange={(e) => setNewUnifiedDate(e.target.value)}
                            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </label>
                        <label className="block text-[11px] text-slate-600">
                          وقت البدء
                          <input
                            type="time"
                            value={newUnifiedTime}
                            onChange={(e) => setNewUnifiedTime(e.target.value)}
                            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </label>
                        <label className="block text-[11px] text-slate-600">
                          المدة
                          <select
                            value={newUnifiedDuration}
                            onChange={(e) =>
                              setNewUnifiedDuration(Number(e.target.value))
                            }
                            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          >
                            {COURSE_DURATION_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m} دقيقة
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[11px] text-slate-600">
                          الأولوية
                          <select
                            value={newUnifiedPriority}
                            onChange={(e) =>
                              setNewUnifiedPriority(e.target.value as TaskPriority)
                            }
                            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          >
                            <option value="high">عالية</option>
                            <option value="medium">متوسطة</option>
                            <option value="low">منخفضة</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </form>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: Dedicated Course Notes & Quick Scratchpad */}
      {showNotes && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <NotebookPen
                  className="w-4 h-4 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-bold text-slate-900">
                  النوتس والتلخيصات الخاصة بالكورس ({courseNotes.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                أضف نوتس المحاضرات، راجعها، وعدّلها هنا مباشرة داخل صفحة الكورس.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <select
                  aria-label="ترتيب محاضرات الكورس"
                  value={notesSortMode}
                  onChange={(e) =>
                    setNotesSortMode(e.target.value as EntitySortMode)
                  }
                  className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="manual">ترتيب يدوي (تحريك لأعلى/لأسفل)</option>
                  <option value="logical">ترتيب منطقي (١، ٢، ٣)</option>
                  <option value="updated">الأحدث تعديلاً</option>
                  <option value="title">ترتيب أبجدي</option>
                </select>
              </label>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowNewNoteForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{showNewNoteForm ? 'إلغاء' : '+ نوت محاضرة جديدة'}</span>
                </button>
              )}
            </div>
          </div>

          {showNewNoteForm && canEdit && (
            <form
              onSubmit={handleCreateNoteSubmit}
              className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  عنوان المحاضرة / الدرس (اختياري)
                  <input
                    type="text"
                    value={newNoteLecture}
                    onChange={(e) => setNewNoteLecture(e.target.value)}
                    placeholder={`مثلاً: المحاضرة ${courseNotes.length + 1}`}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  عنوان النوت (اختياري)
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder={`${course.title} — ملخص...`}
                    className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewNoteForm(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  إنشاء النوت والبدء بالكتابة
                </button>
              </div>
            </form>
          )}

          {courseNotes.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
              <BookOpen
                className="w-7 h-7 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-800">
                لا توجد نوتس مهيكلة مسجلة لهذا الكورس بعد
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يمكنك إنشاء نوت محاضرة مخصصة الآن مع المحرر المنسق والتسجيل الصوتي وإرفاق الصور.
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => createCourseNoteInPlace()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة أول نوت للكورس</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Course Notes List Sidebar */}
              <div className="lg:col-span-4 space-y-2 max-h-[460px] overflow-y-auto thin-scrollbar pl-0.5">
                {sortedCourseNotes.map((bn, idx) => {
                  const isSelected = activeNote?.id === bn.id;
                  const snippet = richHtmlToPlainText(bn.content).slice(0, 90);
                  const moveNote = (dir: 'up' | 'down') => {
                    if (!requireEdit()) return;
                    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
                    if (targetIdx < 0 || targetIdx >= sortedCourseNotes.length) return;
                    const reordered = [...sortedCourseNotes];
                    const [moved] = reordered.splice(idx, 1);
                    reordered.splice(targetIdx, 0, moved);
                    reordered.forEach((item, orderIdx) => {
                      const nextOrder = orderIdx + 1;
                      if ((item.sortOrder ?? 0) !== nextOrder) {
                        onUpdateBookNote(item.id, { sortOrder: nextOrder });
                      }
                    });
                  };
                  return (
                    <div
                      key={bn.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveNoteId(bn.id);
                        setIsEditingNote(false);
                        onOpenNoteById(bn.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveNoteId(bn.id);
                          setIsEditingNote(false);
                          onOpenNoteById(bn.id);
                        }
                      }}
                      className={`w-full text-right p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-[#1E3A5F]/5 border-[#1E3A5F]'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate font-medium text-[#1E3A5F]">
                          {bn.lectureTitle || 'ملاحظة كورس'}
                        </span>
                        <span className="tabular-nums shrink-0">
                          {bn.updatedAt}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">
                        <BidiText text={bn.bookTitle} />
                      </p>
                      {snippet && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          <BidiText text={snippet} />
                        </p>
                      )}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveNoteId(bn.id);
                              setIsEditingNote(false);
                            }}
                            className="text-[10px] text-slate-500 hover:text-[#1E3A5F] hover:underline cursor-pointer"
                          >
                            {isSelected ? 'معروض بالجانب' : 'معاينة بالجانب'}
                          </button>
                          {canEdit && notesSortMode === 'manual' && (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveNote('up');
                                }}
                                aria-label="تقديم للأعلى"
                                className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sortedCourseNotes.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveNote('down');
                                }}
                                aria-label="تأخير للأسفل"
                                className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNoteById(bn.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-[#1E3A5F] bg-white border border-[#1E3A5F]/25 hover:bg-[#1E3A5F] hover:text-white rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <span>فتح للمذاكرة</span>
                          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Course Note Reader / Editor Workspace */}
              {activeNote && (
                <div className="lg:col-span-8 border border-slate-200 rounded-xl p-5 bg-slate-50/40 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {activeNote.lectureTitle && (
                          <span className="font-semibold text-[#1E3A5F]">
                            {activeNote.lectureTitle}
                          </span>
                        )}
                        {activeNote.progressMarker && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{activeNote.progressMarker}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          آخر تحديث: {activeNote.updatedAt}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        {activeNote.bookTitle}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <ReadAloudButton
                        uid={uid}
                        entityType="course"
                        entityId={activeNote.id}
                        title={activeNote.bookTitle}
                        text={richHtmlToPlainText(activeNote.content)}
                        voiceName={preferences.readAloudVoice}
                        speed={preferences.readAloudSpeed}
                        cacheOnlyMode={true}
                        onJumpToCreateAudio={() => onOpenNoteById(activeNote.id)}
                        disabled={!canEdit}
                        onRequireAuth={onRequireAuth}
                      />

                      <button
                        type="button"
                        onClick={() => onOpenNoteById(activeNote.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                      >
                        <span>وضع التركيز والنقاش ↗</span>
                      </button>

                      {canEdit && !isEditingNote && (
                        <div className="hidden sm:inline-flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px]">
                          {(
                            [
                              { id: 'focused', label: 'مريح (~12 كلمة)' },
                              { id: 'balanced', label: 'متوازن' },
                              { id: 'full', label: 'كامل' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => onUpdatePreferences({ noteWidth: opt.id })}
                              className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                                noteLayout.width === opt.id
                                  ? 'bg-[#1E3A5F] text-white'
                                  : 'text-slate-600 hover:bg-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {canEdit && !isEditingNote && (
                        <button
                          type="button"
                          onClick={() => beginEditActiveNote(activeNote)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" aria-hidden="true" />
                          <span>تعديل</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              type: 'note',
                              noteId: activeNote.id,
                              label: activeNote.bookTitle,
                            })
                          }
                          aria-label="حذف النوت"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingNote && canEdit ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block text-xs font-medium text-slate-700 sm:col-span-1">
                          عنوان النوت
                          <input
                            type="text"
                            value={noteDraft.bookTitle}
                            onChange={(e) =>
                              setNoteDraft((d) => ({
                                ...d,
                                bookTitle: e.target.value,
                              }))
                            }
                            className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-700">
                          المحاضرة / الدرس
                          <input
                            type="text"
                            value={noteDraft.lectureTitle}
                            onChange={(e) =>
                              setNoteDraft((d) => ({
                                ...d,
                                lectureTitle: e.target.value,
                              }))
                            }
                            className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-700">
                          نقطة التوقف / الدقيقة
                          <input
                            type="text"
                            value={noteDraft.progressMarker}
                            onChange={(e) =>
                              setNoteDraft((d) => ({
                                ...d,
                                progressMarker: e.target.value,
                              }))
                            }
                            placeholder="مثلاً: الدقيقة 25"
                            className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            محتوى الملخص
                          </span>
                          <VoiceRecorderButton
                            label="إضافة بالصوت"
                            dialect={preferences.voiceDialect}
                            disabled={!canEdit}
                            onRequireAuth={onRequireAuth}
                            onTranscript={(text) =>
                              setNoteDraft((d) => ({
                                ...d,
                                content: `${d.content || ''}<p>${text}</p>`,
                              }))
                            }
                          />
                        </div>
                        <RichTextNoteEditor
                          noteKey={`course-note-${activeNote.id}`}
                          value={noteDraft.content}
                          onChange={(html) =>
                            setNoteDraft((d) => ({ ...d, content: html }))
                          }
                          canEdit={canEdit}
                          onRequireAuth={onRequireAuth}
                          preferences={preferences}
                          onUpdatePreferences={onUpdatePreferences}
                          onSelectDefaultHighlight={(color) =>
                            onUpdatePreferences({ noteHighlightColor: color })
                          }
                          minHeightClass="min-h-[200px]"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingNote(false)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إلغاء</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveActiveNote(activeNote)}
                          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حفظ النوت</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {richHtmlToPlainText(activeNote.content) ? (
                        <div
                          data-custom-card-surface={noteLayout.paperTone !== 'clean' ? 'light' : undefined}
                          className={`${noteLayout.widthClass} ${noteLayout.canvasPaddingClass} ${noteLayout.borderClass} ${noteLayout.paperToneClass} rounded-xl overflow-x-auto transition-all`}
                        >
                          <div
                            className="prose-bidi text-sm sm:text-base text-slate-800 leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-xs [&_mark]:text-slate-900 [&_strong]:font-bold [&_strong]:text-slate-900"
                            dangerouslySetInnerHTML={{
                              __html: renderSafeBidiHtml(activeNote.content),
                            }}
                          />
                        </div>
                      ) : (
                        <div className="p-5 bg-white border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                          <p className="text-xs text-slate-500">
                            هذه النوت فارغة حاليًا.
                          </p>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => beginEditActiveNote(activeNote)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" aria-hidden="true" />
                              <span>ابدأ الكتابة الآن</span>
                            </button>
                          )}
                        </div>
                      )}

                      <ImageAttachmentGallery
                        uid={uid}
                        scopeKey={`note:${activeNote.id}`}
                        title="صور مرفقة بهذه النوت"
                        canEdit={canEdit}
                        onRequireAuth={onRequireAuth}
                        compact
                        hideEmptyWhenReadOnly
                      />

                      <NoteAttachmentsPanel
                        uid={uid}
                        noteId={activeNote.id}
                        noteTitle={activeNote.bookTitle}
                        resources={activeNote.resources}
                        canEdit={canEdit}
                        onRequireAuth={onRequireAuth}
                        onUpdateResources={(next) =>
                          onUpdateBookNote(activeNote.id, { resources: next })
                        }
                        onOpenPdf={onOpenPdf}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Preserved Quick Course Scratchpad */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                مسودة سريعة خاصة بالكورس (حفظ تلقائي)
              </span>
            </div>
            <textarea
              rows={4}
              readOnly={!canEdit}
              value={course.notes ?? ''}
              onClick={() => {
                if (!canEdit) onRequireAuth();
              }}
              onChange={(e) =>
                onUpdateCourse(course.id, { notes: e.target.value })
              }
              placeholder="دوّن هنا أي أفكار سريعة أو نقاط متابعة عامة لهذا الكورس..."
              className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white leading-relaxed"
            />
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title="تأكيد الحذف"
        message={
          confirmState?.type === 'course'
            ? `هل أنت متأكد من حذف الكورس «${confirmState.course.title}» نهائيًا؟`
            : confirmState?.type === 'task'
            ? `هل تريد حذف المهمة «${confirmState.label}»؟`
            : confirmState?.type === 'resource'
            ? `هل تريد حذف المصدر «${confirmState.label}»؟`
            : confirmState?.type === 'note'
            ? `هل تريد حذف النوت «${confirmState.label}» نهائيًا؟`
            : ''
        }
        onConfirm={handleConfirmDeleteAction}
        onCancel={() => setConfirmState(null)}
      />

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingUnifiedTask(null);
        }}
        initialTask={editingUnifiedTask}
        prefill={
          editingUnifiedTask
            ? undefined
            : {
                hubId: course.hubId ?? 'knowledge',
                categoryLabel: course.category || '',
                linkedCourseId: course.id,
                linkedLabel: course.title,
                projectId: `course:${course.id}`,
              }
        }
        courses={allCourses ?? [course]}
        learningPaths={allLearningPaths ?? linkedPaths}
        readingItems={readingItems ?? []}
        projects={allProjects ?? linkedProjects}
        hubCategories={hubCategories}
        onSubmit={(payload, existingId) => {
          if (existingId) {
            onUpdateUnifiedTask(existingId, payload);
          } else {
            onAddUnifiedTask(payload);
          }
        }}
        onDelete={onDeleteUnifiedTask}
      />
    </div>
  );
}
