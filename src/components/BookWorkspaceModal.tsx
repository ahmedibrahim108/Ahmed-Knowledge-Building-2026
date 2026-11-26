import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  Globe,
  Headphones,
  ImagePlus,
  Layers,
  Lightbulb,
  ListTodo,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  Repeat,
  Save,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  BookChapterNote,
  BookNote,
  BookWorkspaceData,
  BookWorkspaceSection,
  DEFAULT_BOOK_COVER_FRAME,
  ImageFrameSpec,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  NOTE_COLOR_THEMES,
  NoteColorKey,
  PersonalCourse,
  PracticalProject,
  ReadingItemStatus,
  ReadingItemType,
  ReadingLibraryItem,
  ReadingModeMeta,
  SPACED_REPETITION_INTERVALS,
  UnifiedTask,
  UserPreferences,
  addDaysToDateKey,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';
import { formatSupabaseErrorMessage } from '../services/supabaseClient';
import {
  downloadResourceAttachmentResult,
  exportSingleBookNoteAsWord,
  isPdfAttachment,
  isViewableDocumentAttachment,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import { exportSingleBookNoteAsMarkdown } from '../utils/excelExport';
import {
  isImageFile,
  removeBookCoverStorage,
  uploadBookCoverImage,
} from '../utils/imageStorage';
import {
  ensureRichHtml,
  getNoteLayoutClasses,
  richHtmlToPlainText,
} from '../utils/richText';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import { FramedImage, ImageFrameEditorModal } from './FramedImage';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import LearningObjectivesPanel from './LearningObjectivesPanel';
import type { ActivePdfTarget } from './PDFViewerModal';
import ReadAloudButton from './ReadAloudButton';
import RichTextNoteEditor from './RichTextNoteEditor';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
import TaskFormModal from './TaskFormModal';
import VoiceRecorderButton from './VoiceRecorderButton';

interface BookWorkspaceModalProps {
  item: ReadingLibraryItem;
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  preferences: UserPreferences;
  onUpdatePreferences?: (updates: Partial<UserPreferences>) => void;
  courses: PersonalCourse[];
  learningPaths: LearningPath[];
  projects: PracticalProject[];
  allReadingItems: ReadingLibraryItem[];
  unifiedTasks: UnifiedTask[];
  bookNotes?: BookNote[];
  hubCategories: Record<LearningHubId, string[]>;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
  onUpdateItem: (id: string, updates: Partial<ReadingLibraryItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddUnifiedTask?: (payload: Omit<UnifiedTask, 'id'>) => void;
  onUpdateUnifiedTask?: (id: string, updates: Partial<UnifiedTask>) => void;
  onDeleteUnifiedTask?: (taskId: string) => void;
  onOpenCalendar?: () => void;
  onOpenTasksTab?: () => void;
  onOpenPdf: (target: ActivePdfTarget) => void;
  onOpenBookNote?: (noteId: string) => void;
  onClose: () => void;
}

interface WorkspaceDraftState {
  notesHtml: string;
  insightsHtml: string;
  quotesHtml: string;
  chapters: BookChapterNote[];
  paperColor: NoteColorKey;
  lastActiveSection: BookWorkspaceSection;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildInitialWorkspaceDraft(item: ReadingLibraryItem): WorkspaceDraftState {
  const ws = item.workspaceData ?? {};
  const seededNotes =
    ws.notesHtml !== undefined
      ? ws.notesHtml
      : item.takeaways?.trim()
      ? ensureRichHtml(item.takeaways)
      : '';
  return {
    notesHtml: seededNotes,
    insightsHtml: ws.insightsHtml ?? '',
    quotesHtml: ws.quotesHtml ?? '',
    chapters: Array.isArray(ws.chapters) ? ws.chapters : [],
    paperColor: ws.paperColor ?? 'default',
    lastActiveSection: ws.lastActiveSection ?? 'notes',
  };
}

export default function BookWorkspaceModal({
  item,
  uid,
  canEdit,
  onRequireAuth,
  preferences,
  onUpdatePreferences,
  courses,
  learningPaths,
  projects,
  allReadingItems,
  unifiedTasks,
  bookNotes = [],
  hubCategories,
  customReadingModes,
  onUpdateReadingModes,
  onUpdateItem,
  onDeleteItem,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onDeleteUnifiedTask,
  onOpenCalendar,
  onOpenTasksTab,
  onOpenPdf,
  onOpenBookNote,
  onClose,
}: BookWorkspaceModalProps) {
  const hubMeta = getHubMeta(item.hubId);
  const today = getTodayDateKey();

  const [draft, setDraft] = useState<WorkspaceDraftState>(() =>
    buildInitialWorkspaceDraft(item)
  );
  const [activeSection, setActiveSection] = useState<BookWorkspaceSection>(
    () => item.workspaceData?.lastActiveSection ?? 'notes'
  );
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    () => item.workspaceData?.chapters?.[0]?.id ?? null
  );
  const [mobilePane, setMobilePane] = useState<'write' | 'chapters' | 'info'>('write');
  const [showCompanionRail, setShowCompanionRail] = useState(true);
  const [minimalWritingMode, setMinimalWritingMode] = useState(false);

  // Quick capture & chapter management
  const [quickCapture, setQuickCapture] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingChapterTitleId, setEditingChapterTitleId] = useState<string | null>(null);
  const [editingChapterTitleVal, setEditingChapterTitleVal] = useState('');

  // Metadata inline editing modal/drawer inside side rail
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState(item.title);
  const [metaAuthor, setMetaAuthor] = useState(item.author);
  const [metaHubId, setMetaHubId] = useState<LearningHubId>(item.hubId);
  const [metaCategory, setMetaCategory] = useState(item.categoryLabel);
  const [metaType, setMetaType] = useState<ReadingItemType>(item.itemType);
  const [metaExternalUrl, setMetaExternalUrl] = useState(item.externalUrl ?? '');

  // Cover upload & frame editing
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [frameEditorOpen, setFrameEditorOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Attachment upload/download
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgressPct, setUploadProgressPct] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [lastReplaceFile, setLastReplaceFile] = useState<File | null>(null);
  const replaceFileRef = useRef<HTMLInputElement | null>(null);

  // Sub-modals
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    initialTask: UnifiedTask | null;
    prefill?: Partial<UnifiedTask>;
  }>({ open: false, initialTask: null });

  // Save state tracking + debounced auto-save
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const pendingDraftRef = useRef<WorkspaceDraftState | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastItemIdRef = useRef<string>(item.id);

  // Reset draft only when switching to a different book
  useEffect(() => {
    if (lastItemIdRef.current !== item.id) {
      lastItemIdRef.current = item.id;
      const fresh = buildInitialWorkspaceDraft(item);
      setDraft(fresh);
      setActiveSection(fresh.lastActiveSection);
      setActiveChapterId(fresh.chapters[0]?.id ?? null);
      setMetaTitle(item.title);
      setMetaAuthor(item.author);
      setMetaHubId(item.hubId);
      setMetaCategory(item.categoryLabel);
      setMetaType(item.itemType);
      setMetaExternalUrl(item.externalUrl ?? '');
      pendingDraftRef.current = null;
      setSaveStatus('idle');
    }
  }, [item]);

  const flushDraftToParent = useCallback(
    (targetDraft: WorkspaceDraftState) => {
      if (!canEdit) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingDraftRef.current = null;
      setSaveStatus('saving');

      const workspaceData: BookWorkspaceData = {
        notesHtml: targetDraft.notesHtml,
        insightsHtml: targetDraft.insightsHtml,
        quotesHtml: targetDraft.quotesHtml,
        chapters: targetDraft.chapters,
        paperColor: targetDraft.paperColor,
        lastActiveSection: targetDraft.lastActiveSection,
      };

      const plainNotes = richHtmlToPlainText(targetDraft.notesHtml).trim();
      const plainInsights = richHtmlToPlainText(targetDraft.insightsHtml).trim();
      const fallbackPlain =
        plainNotes ||
        plainInsights ||
        targetDraft.chapters
          .map((ch) => richHtmlToPlainText(ch.contentHtml).trim())
          .filter(Boolean)[0] ||
        '';

      onUpdateItem(item.id, {
        workspaceData,
        takeaways: fallbackPlain.slice(0, 20000),
        updatedAtLabel: new Date().toLocaleDateString('ar-EG'),
      });
      setSaveStatus('saved');
    },
    [canEdit, item.id, onUpdateItem]
  );

  const scheduleDraftUpdate = useCallback(
    (updater: (prev: WorkspaceDraftState) => WorkspaceDraftState) => {
      setDraft((prev) => {
        const next = updater(prev);
        pendingDraftRef.current = next;
        if (canEdit) {
          setSaveStatus('dirty');
          if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
          }
          saveTimerRef.current = window.setTimeout(() => {
            if (pendingDraftRef.current) {
              flushDraftToParent(pendingDraftRef.current);
            }
          }, 650);
        }
        return next;
      });
    },
    [canEdit, flushDraftToParent]
  );

  const handleCloseWithFlush = useCallback(() => {
    if (pendingDraftRef.current && canEdit) {
      flushDraftToParent(pendingDraftRef.current);
    }
    onClose();
  }, [canEdit, flushDraftToParent, onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (frameEditorOpen || confirmDeleteOpen || taskModalState.open) return;
        handleCloseWithFlush();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    confirmDeleteOpen,
    frameEditorOpen,
    handleCloseWithFlush,
    taskModalState.open,
  ]);

  const activeChapter = useMemo(() => {
    if (draft.chapters.length === 0) return null;
    return (
      draft.chapters.find((c) => c.id === activeChapterId) ?? draft.chapters[0]
    );
  }, [activeChapterId, draft.chapters]);

  const hasAttachedFile =
    Boolean(item.attachmentName) ||
    Boolean(item.downloadUrl) ||
    Boolean(item.storagePath);
  const isPdf =
    isPdfAttachment(item.attachmentName) ||
    (!item.attachmentName &&
      Boolean(item.downloadUrl || item.storagePath) &&
      item.itemType === 'ملف PDF');
  const isViewable =
    hasAttachedFile &&
    (isPdf ||
      isViewableDocumentAttachment(item.attachmentName) ||
      Boolean(item.attachmentResourceId));

  const linkedBookTasks = useMemo(
    () =>
      unifiedTasks.filter(
        (ut) =>
          ut.linkedBookId === item.id ||
          ut.projectId === `book:${item.id}` ||
          ut.projectId?.startsWith(`book:${item.id}:`)
      ),
    [item.id, unifiedTasks]
  );

  const matchedNotebookCards = useMemo(() => {
    const normTitle = item.title.trim().toLowerCase();
    if (!normTitle) return [];
    return bookNotes.filter(
      (bn) =>
        bn.bookTitle.trim().toLowerCase() === normTitle ||
        (bn.noteType === 'book' &&
          normTitle.length > 3 &&
          bn.bookTitle.toLowerCase().includes(normTitle))
    );
  }, [bookNotes, item.title]);

  const noteLayout = getNoteLayoutClasses(preferences);
  const activeColorKey: NoteColorKey = draft.paperColor || 'default';
  const activeColorTheme =
    NOTE_COLOR_THEMES[activeColorKey] ?? NOTE_COLOR_THEMES.default;

  const currentReadingPct =
    item.totalPages > 0
      ? Math.min(100, Math.round((item.currentPage / item.totalPages) * 100))
      : 0;

  const isDueToday = Boolean(
    item.nextReviewDateKey && item.nextReviewDateKey <= today
  );

  const handleSelectSection = (sec: BookWorkspaceSection) => {
    setActiveSection(sec);
    if (sec === 'chapters') {
      setMobilePane('chapters');
    } else {
      setMobilePane('write');
    }
    if (canEdit) {
      scheduleDraftUpdate((prev) => ({
        ...prev,
        lastActiveSection: sec,
      }));
    }
  };

  const handleActiveEditorChange = (html: string) => {
    if (!canEdit) return;
    if (activeSection === 'notes') {
      scheduleDraftUpdate((prev) => ({ ...prev, notesHtml: html }));
    } else if (activeSection === 'insights') {
      scheduleDraftUpdate((prev) => ({ ...prev, insightsHtml: html }));
    } else if (activeSection === 'quotes') {
      scheduleDraftUpdate((prev) => ({ ...prev, quotesHtml: html }));
    } else if (activeSection === 'chapters' && activeChapter) {
      const targetId = activeChapter.id;
      scheduleDraftUpdate((prev) => ({
        ...prev,
        chapters: prev.chapters.map((ch) =>
          ch.id === targetId
            ? { ...ch, contentHtml: html, updatedAtMs: Date.now() }
            : ch
        ),
      }));
    }
  };

  const handleAppendQuickCapture = (rawText: string) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const clean = rawText.trim();
    if (!clean) return;
    const escaped = escapeHtml(clean);
    const blockHtml =
      activeSection === 'quotes'
        ? `<blockquote>«${escaped}»</blockquote>`
        : `<p>${escaped}</p>`;

    scheduleDraftUpdate((prev) => {
      if (activeSection === 'insights') {
        return {
          ...prev,
          insightsHtml: prev.insightsHtml
            ? `${prev.insightsHtml}${blockHtml}`
            : blockHtml,
        };
      }
      if (activeSection === 'quotes') {
        return {
          ...prev,
          quotesHtml: prev.quotesHtml
            ? `${prev.quotesHtml}${blockHtml}`
            : blockHtml,
        };
      }
      if (activeSection === 'chapters' && activeChapter) {
        return {
          ...prev,
          chapters: prev.chapters.map((ch) =>
            ch.id === activeChapter.id
              ? {
                  ...ch,
                  contentHtml: ch.contentHtml
                    ? `${ch.contentHtml}${blockHtml}`
                    : blockHtml,
                  updatedAtMs: Date.now(),
                }
              : ch
          ),
        };
      }
      return {
        ...prev,
        notesHtml: prev.notesHtml ? `${prev.notesHtml}${blockHtml}` : blockHtml,
      };
    });
    setQuickCapture('');
  };

  const handleAddChapter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle =
      newChapterTitle.trim() || `الفصل ${draft.chapters.length + 1}`;
    const newCh: BookChapterNote = {
      id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      contentHtml: '',
      updatedAtMs: Date.now(),
    };
    scheduleDraftUpdate((prev) => ({
      ...prev,
      chapters: [...prev.chapters, newCh],
      lastActiveSection: 'chapters',
    }));
    setActiveChapterId(newCh.id);
    setActiveSection('chapters');
    setMobilePane('chapters');
    setNewChapterTitle('');
  };

  const handleRenameChapter = (chId: string) => {
    const clean = editingChapterTitleVal.trim();
    setEditingChapterTitleId(null);
    if (!clean) return;
    scheduleDraftUpdate((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === chId ? { ...ch, title: clean, updatedAtMs: Date.now() } : ch
      ),
    }));
  };

  const handleDeleteChapter = (chId: string) => {
    if (!canEdit) return;
    const remaining = draft.chapters.filter((ch) => ch.id !== chId);
    scheduleDraftUpdate((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((ch) => ch.id !== chId),
    }));
    if (activeChapterId === chId) {
      setActiveChapterId(remaining[0]?.id ?? null);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    if (!isImageFile(file)) {
      setCoverError('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    setUploadingCover(true);
    setCoverError(null);
    try {
      const oldPath = item.coverStoragePath;
      const uploaded = await uploadBookCoverImage(item.id, file, uid);
      onUpdateItem(item.id, {
        coverImageUrl: uploaded.imageUrl || uploaded.localObjectUrl,
        coverStoragePath: uploaded.imageStoragePath || undefined,
        coverStorageProvider: uploaded.coverStorageProvider,
        coverFrame: item.coverFrame ?? DEFAULT_BOOK_COVER_FRAME,
      });
      if (oldPath && oldPath !== uploaded.imageStoragePath) {
        void removeBookCoverStorage(oldPath);
      }
      setFrameEditorOpen(true);
    } catch (err) {
      setCoverError(
        formatSupabaseErrorMessage(
          err,
          'تعذر رفع صورة الغلاف. حاول مرة أخرى.'
        )
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    if (!canEdit) return;
    const oldPath = item.coverStoragePath;
    onUpdateItem(item.id, {
      coverImageUrl: undefined,
      coverStoragePath: undefined,
      coverStorageProvider: undefined,
      coverFrame: undefined,
    });
    if (oldPath) {
      void removeBookCoverStorage(oldPath);
    }
  };

  const performReplacePdf = async (file: File) => {
    setLastReplaceFile(file);
    setUploadingFile(true);
    setUploadProgressPct(0);
    setDownloadError(null);
    try {
      const resId = item.attachmentResourceId || `lib-res-${Date.now()}`;
      const uploaded = await uploadResourceAttachment(
        uid,
        resId,
        file,
        undefined,
        (pct) => setUploadProgressPct(pct),
        'library_book'
      );
      onUpdateItem(item.id, {
        attachmentName: file.name,
        attachmentResourceId: resId,
        storagePath: uploaded.storagePath,
        storageProvider: uploaded.storageProvider,
        downloadUrl: uploaded.downloadUrl,
        ...(isPdfAttachment(file.name, file.type)
          ? { itemType: 'ملف PDF' as ReadingItemType }
          : {}),
      });
      if (uploaded.uploadedToCloud) {
        setLastReplaceFile(null);
      } else {
        setDownloadError(
          uploaded.errorMessage ||
            'تم ربط الملف محليًا فقط، تعذر رفعه للسحابة. جرّب إعادة المحاولة.'
        );
      }
    } catch (err) {
      setDownloadError(
        formatSupabaseErrorMessage(
          err,
          'تعذر رفع الملف للسحابة. يمكنك إعادة المحاولة.'
        )
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const cleanTitle = metaTitle.trim();
    if (!cleanTitle) return;
    onUpdateItem(item.id, {
      title: cleanTitle,
      author: metaAuthor.trim(),
      hubId: metaHubId,
      categoryLabel: metaCategory.trim(),
      itemType: metaType,
      externalUrl: metaExternalUrl.trim() || undefined,
    });
    setEditingMeta(false);
  };

  const handleQuickSpacedReview = () => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const currentStage = item.repetitionStage ?? 0;
    const nextStage = Math.min(
      SPACED_REPETITION_INTERVALS.length - 1,
      currentStage + 1
    );
    const interval = SPACED_REPETITION_INTERVALS[nextStage];
    onUpdateItem(item.id, {
      reviewCount: (item.reviewCount ?? 0) + 1,
      repetitionStage: nextStage,
      lastReviewedDateKey: today,
      nextReviewDateKey: addDaysToDateKey(today, interval),
    });
  };

  const buildCompositeExportNote = (): BookNote => {
    const sections: string[] = [];
    if (richHtmlToPlainText(draft.notesHtml)) {
      sections.push(`<h3>التلخيص والملاحظات العامة</h3>${draft.notesHtml}`);
    }
    if (richHtmlToPlainText(draft.insightsHtml)) {
      sections.push(`<h3>أبرز الأفكار والاستنتاجات</h3>${draft.insightsHtml}`);
    }
    if (draft.chapters.length > 0) {
      const chHtml = draft.chapters
        .map(
          (ch) =>
            `<h3>${escapeHtml(ch.title)}</h3>${
              ch.contentHtml || '<p>لا يوجد محتوى مسجل.</p>'
            }`
        )
        .join('');
      sections.push(chHtml);
    }
    return {
      id: item.id,
      hubId: item.hubId,
      noteType: 'book',
      bookTitle: item.title,
      author: item.author,
      categoryLabel: item.categoryLabel,
      progressMarker:
        item.totalPages > 0 ? `${item.currentPage}/${item.totalPages} ص` : '',
      content: sections.join('<hr />'),
      quotes: draft.quotesHtml,
      updatedAt: item.updatedAtLabel || new Date().toLocaleDateString('ar-EG'),
    };
  };

  const activeEditorValue =
    activeSection === 'notes'
      ? draft.notesHtml
      : activeSection === 'insights'
      ? draft.insightsHtml
      : activeSection === 'quotes'
      ? draft.quotesHtml
      : activeChapter?.contentHtml ?? '';

  const activeEditorKey =
    activeSection === 'chapters'
      ? `book-ws:${item.id}:ch:${activeChapter?.id ?? 'none'}`
      : `book-ws:${item.id}:${activeSection}`;

  const activeReadAloudText = richHtmlToPlainText(activeEditorValue);

  const sectionTabs: Array<{
    id: BookWorkspaceSection;
    label: string;
    shortLabel: string;
    icon: typeof PenLine;
    hasContent: boolean;
  }> = [
    {
      id: 'notes',
      label: 'ملاحظاتي والتلخيص',
      shortLabel: 'ملاحظاتي',
      icon: PenLine,
      hasContent: Boolean(richHtmlToPlainText(draft.notesHtml)),
    },
    {
      id: 'insights',
      label: 'أبرز الأفكار (Insights)',
      shortLabel: 'الأفكار',
      icon: Lightbulb,
      hasContent: Boolean(richHtmlToPlainText(draft.insightsHtml)),
    },
    {
      id: 'quotes',
      label: 'اقتباسات ومقتطفات',
      shortLabel: 'اقتباسات',
      icon: Quote,
      hasContent: Boolean(richHtmlToPlainText(draft.quotesHtml)),
    },
    {
      id: 'chapters',
      label: `الفصول والأقسام (${draft.chapters.length})`,
      shortLabel: `الفصول (${draft.chapters.length})`,
      icon: Layers,
      hasContent: draft.chapters.length > 0,
    },
  ];

  const hasCover = Boolean(item.coverImageUrl || item.coverStoragePath);

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-0 lg:p-6 overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={`مساحة قراءة وتدوين: ${item.title}`}
      onClick={handleCloseWithFlush}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-[100dvh] max-h-[100dvh] rounded-none lg:max-w-[1320px] lg:h-[92dvh] lg:max-h-[92dvh] lg:rounded-2xl bg-[#FAFBFD] border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Workspace Header */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Mobile Back Button */}
            <button
              type="button"
              onClick={handleCloseWithFlush}
              aria-label="إغلاق مساحة الكتاب"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  className={`px-2 py-0.5 font-semibold border rounded-md ${hubMeta.badgeClass}`}
                >
                  {hubMeta.shortTitle}
                </span>
                <span className="text-slate-500">{item.itemType}</span>
                {item.categoryLabel && (
                  <span className="text-slate-400 hidden sm:inline">
                    · {item.categoryLabel}
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    item.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : item.status === 'reading'
                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.status === 'completed'
                    ? 'مكتمل'
                    : item.status === 'reading'
                    ? 'أقرؤه حاليًا'
                    : 'للقراءة'}
                </span>
                {saveStatus === 'dirty' && (
                  <span className="text-[11px] font-medium text-amber-700">
                    · جاري الحفظ...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <Check className="w-3 h-3" aria-hidden="true" />
                    تم الحفظ تلقائيًا
                  </span>
                )}
              </div>

              <h1 className="font-editorial text-base sm:text-xl font-bold text-slate-900 truncate">
                <BidiText text={item.title} />
              </h1>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {canEdit && saveStatus === 'dirty' && (
              <button
                type="button"
                onClick={() => flushDraftToParent(draft)}
                className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حفظ</span>
              </button>
            )}

            {hasAttachedFile && isViewable && (
              <button
                type="button"
                onClick={() => {
                  setDownloadError(null);
                  onOpenPdf({
                    uid,
                    title: item.title,
                    fileName: item.attachmentName || `${item.title}.pdf`,
                    resourceId: item.attachmentResourceId,
                    storagePath: item.storagePath,
                    downloadUrl: item.downloadUrl,
                    extractedPreview:
                      richHtmlToPlainText(draft.notesHtml) ||
                      item.takeaways ||
                      undefined,
                    contextLabel: `مكتبة القراءة · ${hubMeta.title}`,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {isPdf ? 'قراءة PDF' : 'فتح المستند'}
                </span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}

            {/* Reading Width Presets on Desktop */}
            {onUpdatePreferences && (
              <div
                className="hidden xl:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px]"
                role="group"
                aria-label="عرض ورقة التدوين"
              >
                {(
                  [
                    { id: 'focused', label: 'مريح' },
                    { id: 'balanced', label: 'متوازن' },
                    { id: 'full', label: 'كامل' },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onUpdatePreferences({ noteWidth: w.id })}
                    className={`px-2 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                      (preferences.noteWidth ?? 'focused') === w.id
                        ? 'bg-white text-[#1E3A5F] shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            )}

            {/* Export buttons */}
            <button
              type="button"
              onClick={() => exportSingleBookNoteAsWord(buildCompositeExportNote())}
              title="تصدير ملخص الكتاب كملف Word"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span className="hidden md:inline">Word</span>
            </button>
            <button
              type="button"
              onClick={() => exportSingleBookNoteAsMarkdown(buildCompositeExportNote())}
              title="تصدير ملخص الكتاب بصيغة Markdown"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden md:inline">MD</span>
            </button>

            {/* Desktop Toggle Companion Rail */}
            <button
              type="button"
              onClick={() => setShowCompanionRail((v) => !v)}
              title={
                showCompanionRail
                  ? 'إخفاء اللوحة الجانبية للتركيز في التدوين'
                  : 'إظهار الغلاف والتكرار والمهام'
              }
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              {showCompanionRail ? (
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="hidden xl:inline">
                {showCompanionRail ? 'وضع التركيز' : 'الغلاف والتكرار'}
              </span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="حذف المادة"
                title="حذف من المكتبة"
                className="inline-flex items-center justify-center w-9 h-9 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseWithFlush}
              aria-label="إغلاق"
              className="hidden lg:inline-flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Desktop Secondary Study & Sections Bar */}
        <div className="hidden lg:flex items-center justify-between gap-3 px-6 py-2 bg-white/90 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="أقسام التدوين">
            {sectionTabs.map((sec) => {
              const Icon = sec.icon;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectSection(sec.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{sec.label}</span>
                  {sec.hasContent && !active && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-600"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ReadAloudButton
              text={activeReadAloudText}
              voiceName={preferences.readAloudVoice}
              speed={preferences.readAloudSpeed}
              disabled={!canEdit && !activeReadAloudText}
              onRequireAuth={onRequireAuth}
            />
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateItem(item.id, {
                      listenCount: (item.listenCount ?? 0) + 1,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span className="tabular-nums">+1 سماع ({item.listenCount ?? 0})</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickSpacedReview}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg cursor-pointer ${
                    isDueToday
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تمت المراجعة الآن</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Top Workspace Tabs */}
        <div className="lg:hidden shrink-0 bg-white border-b border-slate-200 px-3 py-2 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMobilePane('write');
              if (activeSection === 'chapters') setActiveSection('notes');
            }}
            className={`py-2 px-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              mobilePane === 'write'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            التدوين والأفكار
          </button>
          <button
            type="button"
            onClick={() => {
              setMobilePane('chapters');
              setActiveSection('chapters');
            }}
            className={`py-2 px-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              mobilePane === 'chapters'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            الفصول ({draft.chapters.length})
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('info')}
            className={`py-2 px-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              mobilePane === 'info'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            الغلاف والتكرار
          </button>
        </div>

        {/* Workspace Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Reading & Writing Board */}
          <div
            className={`flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6 space-y-5 ${
              mobilePane === 'info' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className={`${noteLayout.widthClass} space-y-4`}>
              {/* Mobile Writing Sub-tabs (Notes / Insights / Quotes) */}
              {mobilePane === 'write' && (
                <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1">
                  {sectionTabs
                    .filter((s) => s.id !== 'chapters')
                    .map((sec) => {
                      const Icon = sec.icon;
                      const active = activeSection === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => handleSelectSection(sec.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-[#1E3A5F] text-white'
                              : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{sec.shortLabel}</span>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Chapters Navigator Bar (when in Chapters section) */}
              {activeSection === 'chapters' && (
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                      <h2 className="text-sm font-bold text-slate-900">
                        فصول وأقسام الكتاب ({draft.chapters.length})
                      </h2>
                    </div>
                    {canEdit && (
                      <form
                        onSubmit={handleAddChapter}
                        className="flex items-center gap-1.5 w-full sm:w-auto"
                      >
                        <input
                          type="text"
                          value={newChapterTitle}
                          onChange={(e) => setNewChapterTitle(e.target.value)}
                          placeholder="اسم الفصل أو القسم..."
                          className="flex-1 sm:w-48 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إضافة فصل</span>
                        </button>
                      </form>
                    )}
                  </div>

                  {draft.chapters.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto thin-scrollbar">
                      {draft.chapters.map((ch, idx) => {
                        const isActive = activeChapter?.id === ch.id;
                        const isRenaming = editingChapterTitleId === ch.id;
                        if (isRenaming) {
                          return (
                            <div
                              key={ch.id}
                              className="inline-flex items-center gap-1 bg-slate-100 border border-[#1E3A5F] rounded-lg px-2 py-1"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editingChapterTitleVal}
                                onChange={(e) =>
                                  setEditingChapterTitleVal(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameChapter(ch.id);
                                  if (e.key === 'Escape')
                                    setEditingChapterTitleId(null);
                                }}
                                className="w-32 text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameChapter(ch.id)}
                                className="text-[11px] font-semibold text-emerald-700 cursor-pointer"
                              >
                                حفظ
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={ch.id}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveChapterId(ch.id)}
                              className="cursor-pointer"
                            >
                              {idx + 1}. <BidiText text={ch.title} />
                            </button>
                            {canEdit && isActive && (
                              <>
                                <button
                                  type="button"
                                  aria-label="تعديل عنوان الفصل"
                                  onClick={() => {
                                    setEditingChapterTitleId(ch.id);
                                    setEditingChapterTitleVal(ch.title);
                                  }}
                                  className="p-0.5 opacity-80 hover:opacity-100 cursor-pointer"
                                >
                                  <PenLine className="w-3 h-3" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="حذف الفصل"
                                  onClick={() => handleDeleteChapter(ch.id)}
                                  className="p-0.5 text-rose-200 hover:text-white cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/70">
                      <p className="text-xs text-slate-600">
                        قسّم كتابك إلى فصول أو محاور لتلخيص كل فصل على حدة بأريحية.
                      </p>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleAddChapter()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إنشاء الفصل الأول</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Paper Card Containing RichTextNoteEditor */}
              {(activeSection !== 'chapters' || activeChapter) && (
                <div
                  data-custom-card-surface={
                    activeColorKey !== 'default' ||
                    noteLayout.paperTone !== 'clean'
                      ? 'light'
                      : undefined
                  }
                  className={`${activeColorTheme.cardClass} ${noteLayout.borderClass} ${
                    activeColorKey === 'default' ? noteLayout.paperToneClass : ''
                  } rounded-2xl p-3 sm:p-5 transition-colors space-y-3`}
                >
                  {/* Paper Bar: Section Title + Paper Color Swatches + Mobile ReadAloud */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                    <div className="space-y-0.5">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        {activeSection === 'notes' &&
                          'مساحة التلخيص والملاحظات الحرة'}
                        {activeSection === 'insights' &&
                          'أبرز الأفكار والاستنتاجات التطبيقية (Insights)'}
                        {activeSection === 'quotes' &&
                          'الاقتباسات والمقتطفات الملهمة'}
                        {activeSection === 'chapters' && activeChapter && (
                          <>
                            تلخيص:{' '}
                            <BidiText text={activeChapter.title} />
                          </>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {activeSection === 'quotes'
                          ? 'ظلّل أي جملة للتلوين أو التنسيق كاقتباس.'
                          : 'محرر منسّق يدعم العناوين، التظليل، القوائم، الجداول، والإملاء الصوتي.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="lg:hidden">
                        <ReadAloudButton
                          text={activeReadAloudText}
                          voiceName={preferences.readAloudVoice}
                          speed={preferences.readAloudSpeed}
                          disabled={!canEdit && !activeReadAloudText}
                          onRequireAuth={onRequireAuth}
                        />
                      </div>

                      {canEdit && (
                        <div
                          className="flex items-center gap-1.5"
                          role="group"
                          aria-label="لون ورقة الملاحظة"
                        >
                          {(
                            Object.keys(NOTE_COLOR_THEMES) as NoteColorKey[]
                          ).map((ck) => {
                            const theme = NOTE_COLOR_THEMES[ck];
                            const selected = activeColorKey === ck;
                            return (
                              <button
                                key={ck}
                                type="button"
                                title={theme.label}
                                aria-label={`لون ${theme.label}`}
                                onClick={() =>
                                  scheduleDraftUpdate((prev) => ({
                                    ...prev,
                                    paperColor: ck,
                                  }))
                                }
                                className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                                  theme.swatchClass
                                } ${
                                  selected
                                    ? 'scale-115 ring-2 ring-offset-1 ring-[#1E3A5F]'
                                    : 'opacity-75 hover:opacity-100'
                                }`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reused RichTextNoteEditor */}
                  <RichTextNoteEditor
                    noteKey={activeEditorKey}
                    value={activeEditorValue}
                    onChange={handleActiveEditorChange}
                    canEdit={canEdit}
                    onRequireAuth={onRequireAuth}
                    preferences={preferences}
                    onUpdatePreferences={onUpdatePreferences}
                    minimalMode={minimalWritingMode}
                    onToggleMinimalMode={() =>
                      setMinimalWritingMode((v) => !v)
                    }
                    voiceDialect={preferences.voiceDialect}
                    minHeightClass="min-h-[300px] sm:min-h-[360px]"
                    placeholder={
                      activeSection === 'insights'
                        ? 'دوّن الدروس المستفادة والقواعد الذهبية التي تود تطبيقها...'
                        : activeSection === 'quotes'
                        ? 'اكتب الاقتباسات المميزة مع رقم الصفحة أو السياق...'
                        : activeSection === 'chapters'
                        ? 'لخّص أهم أفكار هذا الفصل ونقاطه المحورية...'
                        : 'ابدأ بتدوين أفكارك، تلخيصاتك، وأسئلتك حول هذا الكتاب...'
                    }
                  />
                </div>
              )}

              {/* Quick Voice & Instant Append Strip */}
              {canEdit && (activeSection !== 'chapters' || activeChapter) && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    value={quickCapture}
                    onChange={(e) => setQuickCapture(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickCapture.trim()) {
                        e.preventDefault();
                        handleAppendQuickCapture(quickCapture);
                      }
                    }}
                    placeholder={
                      activeSection === 'quotes'
                        ? 'التقاط اقتباس سريع (Enter للإضافة فوراً)...'
                        : 'أضف فكرة أو سطرًا سريعًا بالكتابة أو الصوت...'
                    }
                    className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!quickCapture.trim()}
                      onClick={() => handleAppendQuickCapture(quickCapture)}
                      className="inline-flex items-center gap-1 px-3 py-2 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إضافة</span>
                    </button>
                    <VoiceRecorderButton
                      label="إملاء سريع"
                      dialect={preferences.voiceDialect}
                      disabled={!canEdit}
                      onRequireAuth={onRequireAuth}
                      onTranscript={(t) => handleAppendQuickCapture(t)}
                    />
                  </div>
                </div>
              )}

              {/* Book Visual Notes & Photographed Pages Gallery */}
              <ImageAttachmentGallery
                uid={uid}
                scopeKey={`book:${item.id}`}
                title="صور ومخططات وصفحات مصوّرة من الكتاب"
                canEdit={canEdit}
                onRequireAuth={onRequireAuth}
                compact
                hideEmptyWhenReadOnly
              />
            </div>
          </div>

          {/* Companion Rail: Cover, Reading Progress, PDF, Objectives, Repetition, Linked Tasks */}
          <aside
            className={`${
              mobilePane === 'info'
                ? 'block flex-1 min-h-0'
                : showCompanionRail
                ? 'hidden lg:block lg:w-[390px] xl:w-[420px] shrink-0'
                : 'hidden'
            } border-t lg:border-t-0 lg:border-r border-slate-200 bg-white overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5`}
          >
            {/* 1. Book Cover & Metadata Card */}
            <section className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3.5">
              <div className="flex items-start gap-3.5">
                {/* Book Cover Preview Sleeve */}
                <div className="w-24 sm:w-28 shrink-0">
                  {hasCover ? (
                    <FramedImage
                      srcUrl={item.coverImageUrl}
                      storagePath={item.coverStoragePath}
                      frame={{
                        ...(item.coverFrame ?? DEFAULT_BOOK_COVER_FRAME),
                        customHeightPx: undefined,
                        aspect: item.coverFrame?.aspect || '3:4',
                      }}
                      defaultFrame={DEFAULT_BOOK_COVER_FRAME}
                      alt={item.title}
                      mode="card"
                      className="rounded-r-lg rounded-l-sm shadow-md ring-1 ring-black/10"
                    />
                  ) : (
                    <div
                      className={`aspect-[3/4] w-full rounded-r-lg rounded-l-sm border border-slate-200 border-r-4 shadow-xs flex flex-col items-center justify-center p-2.5 text-center gap-1.5 ${
                        item.hubId === 'marketing'
                          ? 'bg-amber-50/90 border-r-amber-700'
                          : item.hubId === 'dental_career'
                          ? 'bg-emerald-50/90 border-r-emerald-700'
                          : 'bg-[#F5F2EB] border-r-[#1E3A5F]'
                      }`}
                    >
                      <BookOpen
                        className="w-5 h-5 text-[#1E3A5F]/75"
                        aria-hidden="true"
                      />
                      <span className="text-[10px] font-bold text-slate-800 line-clamp-3 leading-snug">
                        {item.title}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-slate-900 line-clamp-2">
                        <BidiText text={item.title} />
                      </h2>
                      {item.author && (
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          <BidiText text={item.author} />
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingMeta((v) => !v)}
                        title="تعديل بيانات الكتاب"
                        className="p-1.5 text-slate-500 hover:text-[#1E3A5F] bg-white border border-slate-200 rounded-lg cursor-pointer shrink-0"
                      >
                        <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Cover Actions */}
                  {canEdit && (
                    <div className="flex flex-wrap gap-1.5">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleCoverUpload(e)}
                      />
                      <button
                        type="button"
                        disabled={uploadingCover}
                        onClick={() => coverInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-60"
                      >
                        <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {uploadingCover
                            ? 'جاري الرفع...'
                            : hasCover
                            ? 'تغيير الغلاف'
                            : 'رفع صورة غلاف'}
                        </span>
                      </button>
                      {hasCover && (
                        <>
                          <button
                            type="button"
                            onClick={() => setFrameEditorOpen(true)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <SlidersHorizontal
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                            <span>إطار</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveCover}
                            aria-label="إزالة الغلاف"
                            className="p-1.5 text-red-600 bg-white border border-slate-200 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {coverError && (
                    <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                      {coverError}
                    </p>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateItem(item.id, { isPublic: !item.isPublic })
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                        item.isPublic
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.isPublic ? (
                        <Globe className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <Lock className="w-3 h-3" aria-hidden="true" />
                      )}
                      <span>
                        {item.isPublic ? 'منشور في الموقع العام' : 'مادة خاصة'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Metadata Editor */}
              {editingMeta && canEdit && (
                <form
                  onSubmit={handleSaveMeta}
                  className="pt-3 border-t border-slate-200 space-y-2.5"
                >
                  <input
                    type="text"
                    required
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="عنوان الكتاب..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={metaAuthor}
                      onChange={(e) => setMetaAuthor(e.target.value)}
                      placeholder="المؤلف / المصدر"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <select
                      value={metaType}
                      onChange={(e) =>
                        setMetaType(e.target.value as ReadingItemType)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="كتاب">كتاب</option>
                      <option value="ملف PDF">ملف PDF</option>
                      <option value="مقال">مقال</option>
                      <option value="بحث">بحث</option>
                      <option value="ورقة علمية">ورقة علمية</option>
                      <option value="ملخص">ملخص</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={metaHubId}
                      onChange={(e) =>
                        setMetaHubId(e.target.value as LearningHubId)
                      }
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      {LEARNING_HUBS.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.shortTitle}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      list="ws-meta-cats"
                      value={metaCategory}
                      onChange={(e) => setMetaCategory(e.target.value)}
                      placeholder="التصنيف الفرعي"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <datalist id="ws-meta-cats">
                      {(hubCategories[metaHubId] ?? []).map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <input
                    type="url"
                    value={metaExternalUrl}
                    onChange={(e) => setMetaExternalUrl(e.target.value)}
                    placeholder="رابط خارجي (اختياري)..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingMeta(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 bg-slate-200/70 rounded-md cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-semibold text-white bg-[#1E3A5F] rounded-md cursor-pointer"
                    >
                      حفظ البيانات
                    </button>
                  </div>
                </form>
              )}

              {/* Status & Page Progress */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <label className="block text-[11px] font-medium text-slate-700">
                    الحالة
                    <select
                      disabled={!canEdit}
                      value={item.status}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          status: e.target.value as ReadingItemStatus,
                        })
                      }
                      className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="to_read">للقراءة</option>
                      <option value="reading">أقرؤه حاليًا</option>
                      <option value="completed">مكتمل</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-medium text-slate-700">
                    الصفحة الحالية
                    <input
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={item.currentPage}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          currentPage: Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0
                          ),
                        })
                      }
                      className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-slate-700">
                    إجمالي الصفحات
                    <input
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={item.totalPages}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          totalPages: Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0
                          ),
                        })
                      }
                      className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                    />
                  </label>
                </div>

                {item.totalPages > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 tabular-nums">
                      <span>تقدم القراءة</span>
                      <span className="font-semibold text-[#1E3A5F]">
                        {item.currentPage} / {item.totalPages} ({currentReadingPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A5F] transition-all"
                        style={{ width: `${currentReadingPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PDF / External Link / Download Actions */}
              <div className="pt-2.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                {hasAttachedFile && isViewable && (
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadError(null);
                      onOpenPdf({
                        uid,
                        title: item.title,
                        fileName: item.attachmentName || `${item.title}.pdf`,
                        resourceId: item.attachmentResourceId,
                        storagePath: item.storagePath,
                        storageProvider: item.storageProvider,
                        downloadUrl: item.downloadUrl,
                        extractedPreview:
                          richHtmlToPlainText(draft.notesHtml) ||
                          item.takeaways ||
                          undefined,
                        contextLabel: `مكتبة القراءة · ${hubMeta.title}`,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isPdf ? 'فتح PDF' : 'فتح المستند'}</span>
                  </button>
                )}

                {hasAttachedFile && (
                  <button
                    type="button"
                    onClick={async () => {
                      setDownloadError(null);
                      const result = await downloadResourceAttachmentResult({
                        uid,
                        resourceId: item.attachmentResourceId,
                        fileName: item.attachmentName || `${item.title}.pdf`,
                        storagePath: item.storagePath,
                        storageProvider: item.storageProvider,
                        downloadUrl: item.downloadUrl,
                      });
                      if (!result.ok && result.errorMessage) {
                        setDownloadError(result.errorMessage);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تنزيل</span>
                  </button>
                )}

                {canEdit && (
                  <>
                    <input
                      ref={replaceFileRef}
                      type="file"
                      accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.txt,text/plain,.md,.markdown"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void performReplacePdf(file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => replaceFileRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-60"
                    >
                      <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {uploadingFile
                          ? `${uploadProgressPct}%...`
                          : hasAttachedFile
                          ? 'تحديث الملف'
                          : 'إرفاق PDF'}
                      </span>
                    </button>
                  </>
                )}

                {item.externalUrl && (
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
                  >
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    <span>رابط خارجي</span>
                  </a>
                )}
              </div>

              {downloadError && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2">
                  <span>{downloadError}</span>
                  {lastReplaceFile && (
                    <button
                      type="button"
                      disabled={uploadingFile}
                      onClick={() => void performReplacePdf(lastReplaceFile)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-semibold rounded cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>إعادة</span>
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* 2. Learning Objectives */}
            <LearningObjectivesPanel
              objectives={item.learningObjectives}
              canEdit={canEdit}
              compact
              onChange={(next) =>
                onUpdateItem(item.id, { learningObjectives: next })
              }
            />

            {/* 3. Spaced Repetition & Reading Modes */}
            <SpacedRepetitionPanel
              canEdit={canEdit}
              compact
              value={item}
              onChange={(updates) => onUpdateItem(item.id, updates)}
              customReadingModes={customReadingModes}
              onUpdateReadingModes={onUpdateReadingModes}
            />

            {/* 4. Linked Unified Tasks */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                  <span>المهام المرتبطة ({linkedBookTasks.length})</span>
                </h3>
                <div className="flex items-center gap-2 text-[11px]">
                  {canEdit && onAddUnifiedTask && (
                    <button
                      type="button"
                      onClick={() =>
                        setTaskModalState({
                          open: true,
                          initialTask: null,
                          prefill: {
                            hubId: item.hubId,
                            linkedBookId: item.id,
                            linkedLabel: item.title,
                            projectId: `book:${item.id}`,
                          },
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>مهمة</span>
                    </button>
                  )}
                  {onOpenTasksTab && (
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseWithFlush();
                        onOpenTasksTab();
                      }}
                      className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      المهام
                    </button>
                  )}
                  {onOpenCalendar && (
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseWithFlush();
                        onOpenCalendar();
                      }}
                      className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      التقويم
                    </button>
                  )}
                </div>
              </div>

              {linkedBookTasks.length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا توجد مهام مجدولة لهذا الكتاب بعد.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {linkedBookTasks.map((ut) => {
                    const isDone = ut.status === 'done';
                    return (
                      <div
                        key={ut.id}
                        className="px-3 py-2 bg-white flex items-start justify-between gap-2"
                      >
                        <button
                          type="button"
                          disabled={!canEdit || !onUpdateUnifiedTask}
                          onClick={() =>
                            onUpdateUnifiedTask?.(ut.id, {
                              status: isDone ? 'todo' : 'done',
                            })
                          }
                          className="flex items-start gap-2 text-right flex-1 min-w-0 cursor-pointer disabled:opacity-60"
                        >
                          {isDone ? (
                            <CheckSquare
                              className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <Square
                              className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <span
                              className={`block text-xs break-words ${
                                isDone
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800 font-medium'
                              }`}
                            >
                              {ut.title}
                            </span>
                            {(ut.scheduledDate || ut.dueDate) && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#1E3A5F] tabular-nums">
                                <Calendar className="w-2.5 h-2.5" aria-hidden="true" />
                                {ut.scheduledDate || ut.dueDate}
                                {ut.startTime ? ` · ${ut.startTime}` : ''}
                              </span>
                            )}
                          </div>
                        </button>
                        {canEdit && onUpdateUnifiedTask && (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskModalState({
                                open: true,
                                initialTask: ut,
                              })
                            }
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer shrink-0"
                          >
                            تعديل
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 5. Linked Notebook Cards (if any exist in NotesJournalView) */}
            {matchedNotebookCards.length > 0 && onOpenBookNote && (
              <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-[#1E3A5F]"
                    aria-hidden="true"
                  />
                  <span>بطاقات مرتبطة في دفتر الملاحظات ({matchedNotebookCards.length})</span>
                </h3>
                <div className="space-y-1.5">
                  {matchedNotebookCards.map((bn) => (
                    <button
                      key={bn.id}
                      type="button"
                      onClick={() => {
                        handleCloseWithFlush();
                        onOpenBookNote(bn.id);
                      }}
                      className="w-full text-right px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-[#1E3A5F] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="truncate">{bn.bookTitle}</span>
                      <span className="text-[11px] shrink-0">فتح ←</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {/* Cover Frame & Crop Editor Modal */}
      {frameEditorOpen && hasCover && (
        <ImageFrameEditorModal
          open={frameEditorOpen}
          srcUrl={item.coverImageUrl}
          storagePath={item.coverStoragePath}
          initialFrame={item.coverFrame}
          defaultFrame={DEFAULT_BOOK_COVER_FRAME}
          title={`تعديل إطار غلاف: ${item.title}`}
          onSave={(nextFrame: ImageFrameSpec) => {
            onUpdateItem(item.id, { coverFrame: nextFrame });
            setFrameEditorOpen(false);
          }}
          onClose={() => setFrameEditorOpen(false)}
        />
      )}

      {/* Delete Book Confirm Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="تأكيد حذف المادة"
        message={`هل تريد حذف «${item.title}» من مكتبة القراءة؟`}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDeleteItem(item.id);
          onClose();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Linked Task Form Modal */}
      <TaskFormModal
        open={taskModalState.open}
        onClose={() => setTaskModalState({ open: false, initialTask: null })}
        initialTask={taskModalState.initialTask}
        prefill={taskModalState.prefill}
        courses={courses}
        learningPaths={learningPaths}
        readingItems={allReadingItems}
        projects={projects}
        hubCategories={hubCategories}
        onSubmit={(payload, existingId) => {
          if (existingId && onUpdateUnifiedTask) {
            onUpdateUnifiedTask(existingId, payload);
          } else if (onAddUnifiedTask) {
            onAddUnifiedTask(payload);
          }
        }}
        onDelete={onDeleteUnifiedTask}
      />
    </div>
  );
}
