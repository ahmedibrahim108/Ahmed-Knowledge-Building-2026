import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
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
  Loader2,
  NotebookPen,
  PenLine,
  Plus,
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
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthPlan,
  NoteCategoryType,
  PersonalCourse,
  PracticalProject,
  StudyResource,
  UnifiedTask,
  UserPreferences,
  getCourseStageMeta,
  getHubMeta,
  resolveCourseStudyStage,
} from '../data/curriculumData';
import { auth } from '../firebase';
import {
  downloadResourceAttachmentResult,
  isPdfAttachment,
  isViewableDocumentAttachment,
  parseDocumentFile,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import { ensureRichHtml, richHtmlToPlainText, sanitizeRichHtml } from '../utils/richText';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import type { ActivePdfTarget } from './PDFViewerModal';
import ReadAloudButton from './ReadAloudButton';
import RichTextNoteEditor from './RichTextNoteEditor';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
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
  onDeleteCourseResource: (courseId: number, resourceId: string) => void;
  onJumpToMonth: (monthId: number) => void;
  onOpenPaths: () => void;
  onOpenTasksTab: () => void;
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
  allMonths,
  onBack,
  onOpenPdf,
  onUpdateCourse,
  onDeleteCourse,
  onToggleCourseTask,
  onAddCourseTask,
  onDeleteCourseTask,
  onAddCourseResource,
  onDeleteCourseResource,
  onJumpToMonth,
  onOpenPaths,
  onOpenTasksTab,
  onOpenNoteById,
  onAddStructuredNote,
  onUpdateBookNote,
  onDeleteBookNote,
  onUpdateUnifiedTask,
  onAddUnifiedTask,
}: CourseDetailPageProps) {
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
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [resourceActionError, setResourceActionError] = useState<string | null>(
    null
  );
  const [expandedResId, setExpandedResId] = useState<string | null>(null);
  const courseResFileRef = useRef<HTMLInputElement | null>(null);

  // Course Notes (in-page structured notes management)
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

  useEffect(() => {
    setSectionFocus('all');
    setIsEditingCourse(false);
    setShowAddResource(false);
    setNewTaskText('');
    setNewLinkedUnifiedTask('');
    setExpandedResId(null);
    setIsEditingNote(false);
    setShowNewNoteForm(false);
  }, [requestedCourseId]);

  useEffect(() => {
    if (courseNotes.length === 0) {
      setActiveNoteId(null);
      setIsEditingNote(false);
      return;
    }
    if (!activeNoteId || !courseNotes.some((n) => n.id === activeNoteId)) {
      setActiveNoteId(courseNotes[0].id);
      setIsEditingNote(false);
    }
  }, [courseNotes, activeNoteId]);

  const activeNote = useMemo(
    () =>
      activeNoteId
        ? courseNotes.find((n) => n.id === activeNoteId) ?? null
        : courseNotes[0] ?? null,
    [courseNotes, activeNoteId]
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
    onAddUnifiedTask({
      title,
      description: `مهمة تطبيقية مرتبطة بكورس: ${course.title}`,
      hubId: course.hubId ?? 'knowledge',
      categoryLabel: course.category || 'تطبيق الكورسات',
      priority: 'medium',
      status: 'todo',
      dueDate: '',
      linkedLabel: course.title,
    });
    setNewLinkedUnifiedTask('');
  };

  const handlePickCourseResourceFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireEdit()) return;

    setUploadingFile(true);
    setUploadStatusMsg(null);
    setResourceActionError(null);
    try {
      const generatedId = `c${course.id}-res-${Date.now()}`;
      setPendingResId(generatedId);
      const effectiveUid = uid || auth?.currentUser?.uid;
      const uploadRes = await uploadResourceAttachment(
        effectiveUid,
        generatedId,
        file
      );
      const parsed = await parseDocumentFile(file);
      if (!newResTitle.trim()) {
        setNewResTitle(parsed.title);
      }
      setNewResType('ملف / مستند');
      setNewResAttachmentName(file.name);
      setNewResPreview(
        isPdfAttachment(file.name, file.type)
          ? ''
          : parsed.plainText.slice(0, 7500)
      );
      setNewResStoragePath(uploadRes.storagePath ?? '');
      setNewResDownloadUrl(uploadRes.downloadUrl ?? '');
      setNewResMimeType(uploadRes.mimeType);
      setNewResSizeBytes(uploadRes.sizeBytes);
      if (!newResNote.trim()) {
        setNewResNote(`ملف مرفق (${file.name})`);
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
    } finally {
      setUploadingFile(false);
    }
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
    setUploadStatusMsg(null);
    setShowAddResource(false);
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
      <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canEdit && (
            <>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
            <span>+ نوت جديدة للكورس</span>
          </button>
        </div>
      </div>

      {/* Standalone Hero Summary & KPI Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
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
                  {course.title}
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
                        className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
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

      {/* SECTION 1: Course Details, Complementary Book, Links & Spaced Repetition */}
      {showInfo && (
        <div className="space-y-6">
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
                      {course.complementaryBook || '—'}
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
                    <p className="text-slate-800 leading-relaxed">
                      {course.applicationMilestone}
                    </p>
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
                        accept=".pdf,.docx,.doc,.txt,.md,.markdown"
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
                            ? 'جاري رفع الملف للسحابة...'
                            : newResAttachmentName
                            ? `مرفق: ${newResAttachmentName}`
                            : 'رفع PDF / Word / نص'}
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
                    <p
                      className={`text-xs px-3 py-2 rounded-lg border ${
                        uploadStatusMsg.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {uploadStatusMsg.text}
                    </p>
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
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>{resourceActionError}</span>
                  <button
                    type="button"
                    onClick={() => setResourceActionError(null)}
                    className="text-amber-700 hover:text-amber-950 font-semibold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              )}

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50/40">
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
                                <span className="text-[11px] text-emerald-700 font-medium truncate">
                                  ({res.attachmentName})
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
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                              {res.extractedPreview}
                            </div>
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
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <h2 className="text-base font-bold text-slate-900">
                    مهام الدروس والتطبيق المباشر ({tasksDone} / {course.tasks.length})
                  </h2>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {course.tasks.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">
                      لا توجد مهام مضافة بعد. أضف أول مهمة عملية للكورس.
                    </p>
                  ) : (
                    course.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-2 px-3.5 py-2.5 bg-white"
                      >
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onToggleCourseTask(course.id, task.id)}
                          aria-pressed={task.done}
                          className="flex items-start gap-2.5 text-right flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75"
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
                            className={`text-xs sm:text-sm leading-relaxed ${
                              task.done
                                ? 'line-through text-slate-400'
                                : 'text-slate-800'
                            }`}
                          >
                            {task.text}
                          </span>
                        </button>

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
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {canEdit && (
                  <form
                    onSubmit={handleTaskSubmit}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      placeholder="أضف مهمة أو درسًا جديدًا داخل الكورس..."
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إضافة</span>
                    </button>
                  </form>
                )}
              </section>

              {/* Linked Unified Tasks & Practical Projects */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
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
                  <button
                    type="button"
                    onClick={onOpenTasksTab}
                    className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    إدارة كل المهام والمشاريع ←
                  </button>
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
                              {proj.title}
                            </p>
                            {proj.deliverables && (
                              <p className="text-[11px] text-slate-600 truncate">
                                المخرجات: {proj.deliverables}
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
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {linkedUnifiedTasks.map((ut) => {
                      const isDone = ut.status === 'done';
                      return (
                        <div
                          key={ut.id}
                          className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              onUpdateUnifiedTask(ut.id, {
                                status: isDone ? 'todo' : 'done',
                              })
                            }
                            className="flex items-center gap-2.5 text-right flex-1 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {isDone ? (
                              <CheckSquare
                                className="w-4 h-4 text-emerald-700 shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <Square
                                className="w-4 h-4 text-slate-400 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span
                              className={`text-xs ${
                                isDone
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800 font-medium'
                              }`}
                            >
                              {ut.title}
                            </span>
                          </button>
                          {ut.dueDate && (
                            <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                              {ut.dueDate}
                            </span>
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
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newLinkedUnifiedTask}
                      onChange={(e) => setNewLinkedUnifiedTask(e.target.value)}
                      placeholder="إضافة مهمة في قائمة المهام العامة مرتبطة بهذا الكورس..."
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>ربط مهمة</span>
                    </button>
                  </form>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: Dedicated Course Notes & Quick Scratchpad */}
      {showNotes && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
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
              <div className="lg:col-span-4 space-y-2">
                {courseNotes.map((bn) => {
                  const isSelected = activeNote?.id === bn.id;
                  const snippet = richHtmlToPlainText(bn.content).slice(0, 90);
                  return (
                    <div
                      key={bn.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveNoteId(bn.id);
                        setIsEditingNote(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveNoteId(bn.id);
                          setIsEditingNote(false);
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
                        {bn.bookTitle}
                      </p>
                      {snippet && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {snippet}
                        </p>
                      )}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          {isSelected ? 'معروض بالجانب' : 'اضغط للمعاينة'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNoteById(bn.id);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#1E3A5F] bg-white border border-[#1E3A5F]/25 hover:bg-[#1E3A5F] hover:text-white rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <span>فتح صفحة التلخيص</span>
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <span>فتح صفحة التلخيص ↗</span>
                      </button>

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
                        <div className="p-4 bg-white border border-slate-200 rounded-xl overflow-x-auto">
                          <div
                            dir="auto"
                            className="text-sm text-slate-800 leading-relaxed [&_[dir='ltr']]:text-left [&_[dir='rtl']]:text-right [&_ul]:list-disc [&_ul]:pr-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pr-6 [&_ol]:my-2 [&_li]:my-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_blockquote]:border-r-2 [&_blockquote]:border-[#1E3A5F] [&_blockquote]:pr-3 [&_blockquote]:my-2 [&_blockquote]:text-slate-700 [&_blockquote]:italic [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-xs [&_mark]:text-slate-900 [&_strong]:font-bold [&_strong]:text-slate-900 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs [&_table]:sm:text-sm [&_th]:bg-slate-100 [&_th]:font-bold [&_th]:text-slate-900 [&_th]:border [&_th]:border-slate-300 [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-right [&_th]:min-w-[80px] [&_td]:border [&_td]:border-slate-300 [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_td]:min-w-[80px] [&_td]:bg-white"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeRichHtml(
                                ensureRichHtml(activeNote.content)
                              ),
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
    </div>
  );
}
