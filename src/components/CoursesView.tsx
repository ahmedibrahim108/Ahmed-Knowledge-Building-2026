import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookMarked,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  Headphones,
  Loader2,
  PenLine,
  Plus,
  Repeat,
  Search,
  Square,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  LEARNING_HUBS,
  LearningHubId,
  PersonalCourse,
  StudyResource,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';
import { auth } from '../firebase';
import {
  downloadResourceAttachment,
  isPdfAttachment,
  parseDocumentFile,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import { ActivePdfTarget } from './PDFViewerModal';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';

interface CoursesViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  courses: PersonalCourse[];
  selectedCourseId: number | null;
  onSelectCourse: (id: number | null) => void;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  hubCategories: Record<LearningHubId, string[]>;
  onOpenPdf: (target: ActivePdfTarget) => void;
  onAddCourse: (course: {
    title: string;
    hubId: LearningHubId;
    category: string;
    instructor?: string;
    platform?: string;
    durationLabel?: string;
    startDate?: string;
    targetDate?: string;
    notes?: string;
    complementaryBook: string;
    bookAuthor: string;
    applicationMilestone: string;
    linkedMonths: number[];
  }) => void;
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
  onOpenCourseNote: (
    course: PersonalCourse,
    lectureTitle?: string,
    initialContent?: string
  ) => void;
}

export default function CoursesView({
  uid,
  canEdit,
  onRequireAuth,
  courses,
  selectedCourseId,
  onSelectCourse,
  activeHubFilter,
  onChangeHubFilter,
  hubCategories,
  onOpenPdf,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onToggleCourseTask,
  onAddCourseTask,
  onDeleteCourseTask,
  onAddCourseResource,
  onDeleteCourseResource,
  onJumpToMonth,
  onOpenCourseNote,
}: CoursesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [onlyDueToday, setOnlyDueToday] = useState(false);

  // Add Course State (Only Title Required)
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseHub, setNewCourseHub] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'marketing' : activeHubFilter
  );
  const [newCourseCategory, setNewCourseCategory] = useState('');
  const [newCourseInstructor, setNewCourseInstructor] = useState('');
  const [newCoursePlatform, setNewCoursePlatform] = useState('');
  const [newCourseDuration, setNewCourseDuration] = useState('');
  const [newCourseStartDate, setNewCourseStartDate] = useState('');
  const [newCourseTargetDate, setNewCourseTargetDate] = useState('');
  const [newCourseBook, setNewCourseBook] = useState('');
  const [newCourseAuthor, setNewCourseAuthor] = useState('');
  const [newCourseMilestone, setNewCourseMilestone] = useState('');
  const [newCourseMonths, setNewCourseMonths] = useState('');
  const [newCourseNotes, setNewCourseNotes] = useState('');

  // Standalone Edit Draft State (Save / Cancel)
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [draftEdit, setDraftEdit] = useState<Partial<PersonalCourse>>({});

  // Confirm Dialog State
  const [confirmState, setConfirmState] = useState<
    | { type: 'course'; course: PersonalCourse }
    | { type: 'task'; courseId: number; taskId: string; label: string }
    | { type: 'resource'; courseId: number; resourceId: string; label: string }
    | null
  >(null);

  // Add Task & Resource inside Standalone Course Page
  const [newTaskText, setNewTaskText] = useState('');
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
  const [newResSizeBytes, setNewResSizeBytes] = useState<number | undefined>(undefined);
  const [pendingResId, setPendingResId] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedResId, setExpandedResId] = useState<string | null>(null);
  const courseResFileRef = useRef<HTMLInputElement | null>(null);

  const selectedCourse = useMemo(
    () =>
      selectedCourseId !== null
        ? courses.find((c) => c.id === selectedCourseId) ?? null
        : null,
    [courses, selectedCourseId]
  );

  useEffect(() => {
    setIsEditingCourse(false);
    setShowAddResource(false);
    setNewTaskText('');
    setExpandedResId(null);
  }, [selectedCourseId]);

  useEffect(() => {
    if (activeHubFilter !== 'all') {
      setNewCourseHub(activeHubFilter);
    }
  }, [activeHubFilter]);

  const todayKey = getTodayDateKey();

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      const hub = c.hubId ?? 'knowledge';
      if (activeHubFilter !== 'all' && hub !== activeHubFilter) return false;
      if (onlyRepeated && (c.listenCount ?? 0) < 2 && (c.reviewCount ?? 0) < 2) {
        return false;
      }
      if (
        onlyDueToday &&
        (!c.nextReviewDateKey || c.nextReviewDateKey > todayKey)
      ) {
        return false;
      }
      if (q) {
        const hay = [
          c.title,
          c.category,
          c.instructor,
          c.platform,
          c.complementaryBook,
          c.applicationMilestone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, activeHubFilter, onlyRepeated, onlyDueToday, searchQuery, todayKey]);

  const completedCount = courses.filter((c) => c.completed).length;

  const requireEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const title = newCourseTitle.trim();
    if (!title) return;

    const parsedMonths = newCourseMonths
      .split(/[,،\s]+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 100);

    onAddCourse({
      title,
      hubId: newCourseHub,
      category: newCourseCategory.trim(),
      instructor: newCourseInstructor.trim(),
      platform: newCoursePlatform.trim(),
      durationLabel: newCourseDuration.trim(),
      startDate: newCourseStartDate,
      targetDate: newCourseTargetDate,
      notes: newCourseNotes.trim(),
      complementaryBook: newCourseBook.trim(),
      bookAuthor: newCourseAuthor.trim(),
      applicationMilestone: newCourseMilestone.trim(),
      linkedMonths: parsedMonths,
    });

    setNewCourseTitle('');
    setNewCourseCategory('');
    setNewCourseInstructor('');
    setNewCoursePlatform('');
    setNewCourseDuration('');
    setNewCourseStartDate('');
    setNewCourseTargetDate('');
    setNewCourseBook('');
    setNewCourseAuthor('');
    setNewCourseMilestone('');
    setNewCourseMonths('');
    setNewCourseNotes('');
    setShowAddCourse(false);
  };

  const startEditingCourse = (course: PersonalCourse) => {
    setDraftEdit({
      title: course.title,
      hubId: course.hubId ?? 'knowledge',
      category: course.category,
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

  const handleSaveCourseEdit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    if (!requireEdit()) return;
    if (!(draftEdit.title ?? '').trim()) return;
    onUpdateCourse(courseId, {
      ...draftEdit,
      title: (draftEdit.title ?? '').trim(),
    });
    setIsEditingCourse(false);
  };

  const handleTaskSubmit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const text = newTaskText.trim();
    if (!text) return;
    onAddCourseTask(courseId, text);
    setNewTaskText('');
  };

  const handlePickCourseResourceFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    courseId: number
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireEdit()) return;

    setUploadingFile(true);
    try {
      const generatedId = `c${courseId}-res-${Date.now()}`;
      setPendingResId(generatedId);
      const effectiveUid = uid || auth.currentUser?.uid;
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
      setNewResPreview(isPdfAttachment(file.name, file.type) ? '' : parsed.plainText.slice(0, 7500));
      setNewResStoragePath(uploadRes.storagePath ?? '');
      setNewResDownloadUrl(uploadRes.downloadUrl ?? '');
      setNewResMimeType(uploadRes.mimeType);
      setNewResSizeBytes(uploadRes.sizeBytes);
      if (!newResNote.trim()) {
        setNewResNote(`ملف مرفق (${file.name})`);
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const handleResourceSubmit = (e: React.FormEvent, courseId: number) => {
    e.preventDefault();
    if (!requireEdit()) return;
    const title = newResTitle.trim();
    if (!title) return;
    onAddCourseResource(
      courseId,
      title,
      newResType,
      newResNote.trim(),
      {
        id: pendingResId || undefined,
        externalUrl: newResUrl.trim() || undefined,
        attachmentName: newResAttachmentName || undefined,
        extractedPreview: newResPreview || undefined,
        storagePath: newResStoragePath || undefined,
        downloadUrl: newResDownloadUrl || undefined,
        mimeType: newResMimeType || undefined,
        sizeBytes: newResSizeBytes,
      }
    );
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
    setShowAddResource(false);
  };

  const handleConfirmDeleteAction = () => {
    if (!confirmState) return;
    if (confirmState.type === 'course') {
      onDeleteCourse(confirmState.course.id);
      if (selectedCourseId === confirmState.course.id) {
        onSelectCourse(null);
      }
    } else if (confirmState.type === 'task') {
      onDeleteCourseTask(confirmState.courseId, confirmState.taskId);
    } else if (confirmState.type === 'resource') {
      onDeleteCourseResource(confirmState.courseId, confirmState.resourceId);
    }
    setConfirmState(null);
  };

  // =====================================================================
  // STANDALONE COURSE DETAIL PAGE (SEPARATE VIEW WHEN COURSE IS SELECTED)
  // =====================================================================
  if (selectedCourse) {
    const hubMeta = getHubMeta(selectedCourse.hubId);
    const tasksDone = selectedCourse.tasks.filter((t) => t.done).length;
    const coursePct =
      selectedCourse.progressPct ??
      (selectedCourse.completed
        ? 100
        : selectedCourse.tasks.length > 0
        ? Math.round((tasksDone / selectedCourse.tasks.length) * 100)
        : 0);
    const editHubCats =
      hubCategories[draftEdit.hubId ?? selectedCourse.hubId ?? 'knowledge'] ?? [];

    return (
      <div className="space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectCourse(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>العودة إلى الكورسات</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    isEditingCourse
                      ? setIsEditingCourse(false)
                      : startEditingCourse(selectedCourse)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isEditingCourse ? 'إلغاء التعديل' : 'تعديل الكورس'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmState({ type: 'course', course: selectedCourse })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حذف الكورس</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onOpenCourseNote(selectedCourse)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
            >
              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
              <span>فتح دفتر تلخيص الكورس</span>
            </button>
          </div>
        </div>

        {/* Course Main Summary & Edit Form */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          {isEditingCourse && canEdit ? (
            <form
              onSubmit={(e) => handleSaveCourseEdit(e, selectedCourse.id)}
              className="space-y-4"
            >
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
                  مسار التعلّم الكبير (Hub)
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
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 font-semibold rounded-md border ${hubMeta.badgeClass}`}
                    >
                      {hubMeta.title}
                    </span>
                    {selectedCourse.category && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                        {selectedCourse.category}
                      </span>
                    )}
                    <span className="text-slate-400 tabular-nums">
                      كورس #{String(selectedCourse.id).padStart(2, '0')}
                    </span>
                  </div>
                  <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
                    {selectedCourse.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    {selectedCourse.instructor && (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                        <span>المحاضر: {selectedCourse.instructor}</span>
                      </span>
                    )}
                    {selectedCourse.platform && (
                      <span>المنصة: {selectedCourse.platform}</span>
                    )}
                    {selectedCourse.durationLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        <span>{selectedCourse.durationLabel}</span>
                      </span>
                    )}
                    {(selectedCourse.startDate || selectedCourse.targetDate) && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        <span>
                          {selectedCourse.startDate || '—'} →{' '}
                          {selectedCourse.targetDate || '—'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    onUpdateCourse(selectedCourse.id, {
                      completed: !selectedCourse.completed,
                      progressPct: !selectedCourse.completed ? 100 : coursePct,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 shrink-0 ${
                    selectedCourse.completed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {selectedCourse.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  )}
                  <span>
                    {selectedCourse.completed ? 'كورس مكتمل' : 'تحديد كمكتمل'}
                  </span>
                </button>
              </div>

              {/* Progress Slider */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    نسبة التقدم في الكورس
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
                    onUpdateCourse(selectedCourse.id, {
                      progressPct: pct,
                      completed: pct >= 100,
                    });
                  }}
                  className="w-full accent-[#1E3A5F] cursor-pointer disabled:opacity-60"
                />
              </div>

              {(selectedCourse.complementaryBook ||
                selectedCourse.applicationMilestone ||
                selectedCourse.linkedMonths.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {(selectedCourse.complementaryBook ||
                    selectedCourse.bookAuthor) && (
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-1">
                      <span className="font-semibold text-slate-500 block">
                        المرجع المكمل
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedCourse.complementaryBook || '—'}
                      </p>
                      {selectedCourse.bookAuthor && (
                        <p className="text-slate-600">{selectedCourse.bookAuthor}</p>
                      )}
                    </div>
                  )}
                  {selectedCourse.applicationMilestone && (
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-1">
                      <span className="font-semibold text-slate-500 block">
                        هدف التطبيق العملي
                      </span>
                      <p className="text-slate-800 leading-relaxed">
                        {selectedCourse.applicationMilestone}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedCourse.linkedMonths.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>الوحدات المرتبطة:</span>
                  {selectedCourse.linkedMonths.map((monthNum) => (
                    <button
                      key={monthNum}
                      type="button"
                      onClick={() => onJumpToMonth(monthNum)}
                      className="px-2.5 py-1 font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md tabular-nums cursor-pointer"
                    >
                      الوحدة {monthNum}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Spaced Repetition + 5 Reading Modes + Re-Listen Counter */}
        <SpacedRepetitionPanel
          canEdit={canEdit}
          value={{
            readingModes: selectedCourse.readingModes,
            learningMethods: selectedCourse.learningMethods,
            reviewCount: selectedCourse.reviewCount,
            listenCount: selectedCourse.listenCount,
            repetitionStage: selectedCourse.repetitionStage,
            nextReviewDateKey: selectedCourse.nextReviewDateKey,
            lastReviewedDateKey: selectedCourse.lastReviewedDateKey,
          }}
          onChange={(updates) => onUpdateCourse(selectedCourse.id, updates)}
          title="تتبع التكرار المتباعد، السماع المتكرر وأنماط القراءة لهذا الكورس"
        />

        {/* Two-Column Detail Body: Resources + PDFs / Tasks + Images + Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Resources & PDFs Column */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">
                  المصادر والملفات وملفات الـ PDF ({selectedCourse.resources.length})
                </h2>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowAddResource((v) => !v)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  {showAddResource ? 'إلغاء' : '+ إضافة مصدر / PDF'}
                </button>
              )}
            </div>

            {showAddResource && canEdit && (
              <form
                onSubmit={(e) => handleResourceSubmit(e, selectedCourse.id)}
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
                      onChange={(e) =>
                        void handlePickCourseResourceFile(e, selectedCourse.id)
                      }
                    />
                    <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => courseResFileRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
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

                <button
                  type="submit"
                  disabled={uploadingFile}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  حفظ المصدر
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50/40">
              {selectedCourse.resources.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">
                  لا توجد مصادر أو ملفات PDF مضافة لهذا الكورس بعد.
                </p>
              ) : (
                selectedCourse.resources.map((res) => {
                  const isPdf =
                    isPdfAttachment(res.attachmentName, res.mimeType) ||
                    (res.externalUrl ? isPdfAttachment(res.externalUrl) : false);
                  const isPreviewOpen = expandedResId === res.id;

                  const handleOpenPdfModal = () => {
                    onOpenPdf({
                      title: res.title,
                      fileName: res.attachmentName || `${res.title}.pdf`,
                      resourceId: res.id,
                      storagePath: res.storagePath,
                      downloadUrl: res.downloadUrl || (isPdf ? res.externalUrl : undefined),
                      contextLabel: selectedCourse.title,
                    });
                  };

                  return (
                    <div key={res.id} className="bg-white first:rounded-t-xl last:rounded-b-xl">
                      <div className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {isPdf ? (
                              <button
                                type="button"
                                onClick={handleOpenPdfModal}
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
                          {isPdf && (
                            <button
                              type="button"
                              onClick={handleOpenPdfModal}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                            >
                              <Eye className="w-3 h-3" aria-hidden="true" />
                              <span>فتح PDF</span>
                            </button>
                          )}

                          {res.extractedPreview && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedResId(isPreviewOpen ? null : res.id)
                                }
                                title="معاينة النص"
                                className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenCourseNote(
                                      selectedCourse,
                                      res.title,
                                      res.extractedPreview
                                    )
                                  }
                                  title="فتح كملخص في دفتر التلخيص"
                                  className="p-1.5 text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                                >
                                  <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </>
                          )}

                          {(res.attachmentName || res.storagePath || res.downloadUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                void downloadResourceAttachment({
                                  resourceId: res.id,
                                  fileName: res.attachmentName || res.title,
                                  storagePath: res.storagePath,
                                  downloadUrl: res.downloadUrl,
                                })
                              }
                              title="تنزيل الملف"
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                            >
                              <Download className="w-3 h-3" aria-hidden="true" />
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
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
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
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  type: 'resource',
                                  courseId: selectedCourse.id,
                                  resourceId: res.id,
                                  label: res.title,
                                })
                              }
                              aria-label="حذف المصدر"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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

            {/* Cloud-synced Image Attachment Gallery */}
            <ImageAttachmentGallery
              scopeKey={`course:${selectedCourse.id}`}
              title="صور الكورس والمخططات (متزامنة بين الهاتف واللابتوب)"
              canEdit={canEdit}
              onRequireAuth={onRequireAuth}
            />
          </section>

          {/* Tasks + Course Notes Column */}
          <div className="lg:col-span-6 space-y-6">
            {/* Tasks Card */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <h2 className="text-base font-bold text-slate-900">
                  مهام التطبيق والدروس ({tasksDone} / {selectedCourse.tasks.length})
                </h2>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {selectedCourse.tasks.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">
                    لا توجد مهام مضافة بعد. أضف أول مهمة عملية للكورس.
                  </p>
                ) : (
                  selectedCourse.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-2 px-3.5 py-2.5 bg-white"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          onToggleCourseTask(selectedCourse.id, task.id)
                        }
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
                              courseId: selectedCourse.id,
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
                  onSubmit={(e) => handleTaskSubmit(e, selectedCourse.id)}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="أضف مهمة أو درسًا جديدًا..."
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

            {/* Quick Course Summary Notes */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  ملخص سريع وملاحظات الكورس
                </h2>
                <button
                  type="button"
                  onClick={() => onOpenCourseNote(selectedCourse)}
                  className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  فتح المحرر المتقدم ←
                </button>
              </div>
              <textarea
                rows={5}
                readOnly={!canEdit}
                value={selectedCourse.notes ?? ''}
                onClick={() => {
                  if (!canEdit) onRequireAuth();
                }}
                onChange={(e) =>
                  onUpdateCourse(selectedCourse.id, { notes: e.target.value })
                }
                placeholder="اكتب ملاحظاتك أو ملخصك السريع لهذا الكورس هنا..."
                className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F] focus:bg-white leading-relaxed"
              />
            </section>
          </div>
        </div>

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
              : ''
          }
          onConfirm={handleConfirmDeleteAction}
          onCancel={() => setConfirmState(null)}
        />
      </div>
    );
  }

  // =====================================================================
  // COURSES HUB / LIST VIEW
  // =====================================================================
  const addHubCats = hubCategories[newCourseHub] ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs text-slate-500">
              منظومة الكورسات الشاملة · الماركتينج، الدنتال والكارير، والثقافة والمعرفة
            </p>
            <h1 className="font-editorial text-3xl font-bold text-slate-900">
              الكورسات والتطبيق ({courses.length})
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              اضغط على أي كورس لفتح صفحته المستقلة بالكامل (المصادر وملفات الـ PDF، الصور المتزامنة، المهام، والتكرار المتباعد).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              المنجز: {completedCount} / {courses.length}
            </span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => {
                if (!canEdit) {
                  onRequireAuth();
                  return;
                }
                setShowAddCourse((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{showAddCourse ? 'إلغاء' : '+ إضافة كورس جديد'}</span>
            </button>
          </div>
        </div>

        {/* 3 Learning Hubs Filter + Spaced Repetition Quick Filters */}
        <div className="pt-4 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeHubFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                activeHubFilter === 'all'
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              جميع المسارات ({courses.length})
            </button>
            {LEARNING_HUBS.map((hub) => {
              const count = courses.filter(
                (c) => (c.hubId ?? 'knowledge') === hub.id
              ).length;
              const active = activeHubFilter === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => onChangeHubFilter(hub.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {hub.shortTitle} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyRepeated((v) => !v)}
              aria-pressed={onlyRepeated}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer ${
                onlyRepeated
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
              <span>مسموع / مسجل أكثر من مرة (+2)</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyDueToday((v) => !v)}
              aria-pressed={onlyDueToday}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border cursor-pointer ${
                onlyDueToday
                  ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>مستحق للمراجعة</span>
            </button>

            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الكورسات..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Flexible Add Course Form (Only Title Required) */}
      {showAddCourse && canEdit && (
        <form
          onSubmit={handleCreateCourse}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              إضافة كورس جديد
            </h2>
            <span className="text-[11px] text-slate-500">
              اسم الكورس فقط إجباري وباقي الحقول اختيارية
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
              اسم الكورس *
              <input
                type="text"
                required
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="مثلاً: كورس Meta Ads أو Endodontics Masterclass"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المسار (Hub)
              <select
                value={newCourseHub}
                onChange={(e) => {
                  setNewCourseHub(e.target.value as LearningHubId);
                  setNewCourseCategory('');
                }}
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
              الفئة / التخصص (اختياري)
              <input
                type="text"
                list="new-course-cat-list"
                value={newCourseCategory}
                onChange={(e) => setNewCourseCategory(e.target.value)}
                placeholder="اختر أو اكتب تصنيفًا..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
              <datalist id="new-course-cat-list">
                {addHubCats.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المحاضر / المدرب (اختياري)
              <input
                type="text"
                value={newCourseInstructor}
                onChange={(e) => setNewCourseInstructor(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المنصة / المصدر (اختياري)
              <input
                type="text"
                value={newCoursePlatform}
                onChange={(e) => setNewCoursePlatform(e.target.value)}
                placeholder="YouTube / Coursera / Udemy..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المدة (اختياري)
              <input
                type="text"
                value={newCourseDuration}
                onChange={(e) => setNewCourseDuration(e.target.value)}
                placeholder="مثلاً: 10 ساعات"
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              تاريخ البدء (اختياري)
              <input
                type="date"
                value={newCourseStartDate}
                onChange={(e) => setNewCourseStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              التاريخ المستهدف (اختياري)
              <input
                type="date"
                value={newCourseTargetDate}
                onChange={(e) => setNewCourseTargetDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              المرجع الكتابي المكمل (اختياري)
              <input
                type="text"
                value={newCourseBook}
                onChange={(e) => setNewCourseBook(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              مؤلف المرجع (اختياري)
              <input
                type="text"
                value={newCourseAuthor}
                onChange={(e) => setNewCourseAuthor(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              الوحدات المرتبطة (اختياري)
              <input
                type="text"
                value={newCourseMonths}
                onChange={(e) => setNewCourseMonths(e.target.value)}
                placeholder="أرقام مفصولة بفاصلة"
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            هدف التطبيق العملي (اختياري)
            <textarea
              rows={2}
              value={newCourseMilestone}
              onChange={(e) => setNewCourseMilestone(e.target.value)}
              placeholder="الهدف التطبيقي..."
              className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddCourse(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
            >
              حفظ الكورس
            </button>
          </div>
        </form>
      )}

      {/* Courses Cards Grid */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">
            لا توجد كورسات مطابقة للتصفية الحالية
          </p>
          <p className="text-xs text-slate-500">
            يمكنك إضافة كورس جديد لأي مسار من المسارات الثلاثة بالأعلى.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const hubMeta = getHubMeta(course.hubId);
            const tasksDone = course.tasks.filter((t) => t.done).length;
            const pct =
              course.progressPct ??
              (course.completed
                ? 100
                : course.tasks.length > 0
                ? Math.round((tasksDone / course.tasks.length) * 100)
                : 0);
            const pdfCount = course.resources.filter((r) =>
              isPdfAttachment(r.attachmentName, r.mimeType)
            ).length;

            return (
              <article
                key={course.docId || course.id}
                className="bg-white border border-slate-200 hover:border-[#1E3A5F]/40 rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className={`px-2 py-0.5 font-semibold rounded border ${hubMeta.badgeClass}`}
                      >
                        {hubMeta.shortTitle}
                      </span>
                      {course.category && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {course.category}
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({ type: 'course', course })
                        }
                        aria-label={`حذف ${course.title}`}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCourse(course.id)}
                    className="text-right block w-full cursor-pointer group"
                  >
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F] leading-snug">
                      {course.title}
                    </h2>
                  </button>

                  {(course.instructor || course.platform) && (
                    <p className="text-xs text-slate-500">
                      {[course.instructor, course.platform]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}

                  {course.applicationMilestone && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {course.applicationMilestone}
                    </p>
                  )}

                  {/* Badges for repeated / spaced repetition */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {(course.listenCount ?? 0) >= 2 && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-semibold">
                        سماع متكرر ({course.listenCount}×)
                      </span>
                    )}
                    {(course.reviewCount ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded font-semibold">
                        مراجعات ({course.reviewCount}×)
                      </span>
                    )}
                    {pdfCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-[#1E3A5F] rounded font-semibold">
                        {pdfCount} PDF
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>
                        {tasksDone}/{course.tasks.length} مهام ·{' '}
                        {course.resources.length} مصادر
                      </span>
                      <span className="font-semibold text-slate-800">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          course.completed ? 'bg-emerald-600' : 'bg-[#1E3A5F]'
                        }`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectCourse(course.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors cursor-pointer"
                    >
                      <span>فتح صفحة الكورس</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCourseNote(course)}
                      title="فتح دفتر تلخيص الكورس"
                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>نوتس</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title="تأكيد الحذف"
        message={
          confirmState?.type === 'course'
            ? `هل أنت متأكد من حذف الكورس «${confirmState.course.title}» نهائيًا؟`
            : ''
        }
        onConfirm={handleConfirmDeleteAction}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
