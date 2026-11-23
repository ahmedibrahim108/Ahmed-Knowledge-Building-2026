import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FileUp,
  GraduationCap,
  Layers,
  Lock,
  PenLine,
  Plus,
  Repeat,
  Save,
  Search,
  SlidersHorizontal,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  BookNote,
  CustomCategory,
  EntitySortMode,
  HighlightColorKey,
  LEARNING_HUBS,
  LearningHubId,
  MonthPlan,
  NOTE_COLOR_THEMES,
  NoteCategoryType,
  NoteColorKey,
  PersonalCourse,
  ReadAloudVoiceName,
  UserPreferences,
  VoiceDialectMode,
  VoiceInsertMode,
  getHubMeta,
  getTodayDateKey,
  sortBookNotesList,
} from '../data/curriculumData';
import {
  exportNotebookBundleAsWord,
  exportSingleBookNoteAsWord,
  parseDocumentFile,
} from '../utils/documentImportExport';
import {
  exportNotebookBundleAsExcel,
  exportNotebookBundleAsMarkdown,
  exportSingleBookNoteAsExcel,
  exportSingleBookNoteAsMarkdown,
} from '../utils/excelExport';
import {
  HIGHLIGHT_SWATCHES,
  ensureRichHtml,
  getNoteLayoutClasses,
  renderSafeBidiHtml,
  richHtmlToPlainText,
  sanitizeRichHtml,
} from '../utils/richText';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import NoteAttachmentsPanel from './NoteAttachmentsPanel';
import type { ActivePdfTarget } from './PDFViewerModal';
import ReadAloudButton from './ReadAloudButton';
import RichTextNoteEditor from './RichTextNoteEditor';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
import VoiceRecorderButton from './VoiceRecorderButton';

interface NotesJournalViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  months: MonthPlan[];
  courses: PersonalCourse[];
  customCategories: CustomCategory[];
  bookNotes: BookNote[];
  activeBookNoteId: string | null;
  onSelectBookNote: (id: string | null) => void;
  onOpenFocusStudy?: (noteId: string, startInEdit?: boolean) => void;
  activeHubFilter?: LearningHubId | 'all';
  onChangeHubFilter?: (hub: LearningHubId | 'all') => void;
  hubCategories?: Record<LearningHubId, string[]>;
  onOpenPdf?: (target: ActivePdfTarget) => void;
  showExcelExport?: boolean;
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
  }) => void;
  onUpdateBookNote: (id: string, updates: Partial<BookNote>) => void;
  onDeleteBookNote: (id: string) => void;
  onUpdateMonthNotes: (id: number, notes: string) => void;
  onLogVoiceNote?: (noteTitle: string) => void;
  onExportExcel: () => void;
}

interface NoteDraft {
  bookTitle: string;
  hubId: LearningHubId;
  noteType: NoteCategoryType;
  noteColor: NoteColorKey;
  categoryLabel: string;
  author: string;
  courseId: number;
  courseTitle: string;
  lectureTitle: string;
  progressMarker: string;
  content: string;
  quotes: string;
}

const NOTE_TYPE_LABELS: Record<NoteCategoryType, string> = {
  book: 'كتاب',
  course_lecture: 'كورس / محاضرة',
  general: 'ملاحظة عامة',
};

function escapePlainToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDraftFromNote(note: BookNote): NoteDraft {
  return {
    bookTitle: note.bookTitle,
    hubId: note.hubId ?? 'knowledge',
    noteType: note.noteType ?? 'book',
    noteColor: note.noteColor ?? 'default',
    categoryLabel: note.categoryLabel ?? '',
    author: note.author ?? '',
    courseId: note.courseId ?? 0,
    courseTitle: note.courseTitle ?? '',
    lectureTitle: note.lectureTitle ?? '',
    progressMarker: note.progressMarker ?? '',
    content: note.content ?? '',
    quotes: note.quotes ?? '',
  };
}

export default function NotesJournalView({
  uid,
  canEdit,
  onRequireAuth,
  preferences,
  onUpdatePreferences,
  months,
  courses,
  customCategories,
  bookNotes,
  activeBookNoteId,
  onSelectBookNote,
  onOpenFocusStudy,
  activeHubFilter = 'all',
  onChangeHubFilter,
  hubCategories,
  onOpenPdf,
  showExcelExport = true,
  onAddStructuredNote,
  onUpdateBookNote,
  onDeleteBookNote,
  onUpdateMonthNotes,
  onLogVoiceNote,
  onExportExcel,
}: NotesJournalViewProps) {
  const noteLayout = getNoteLayoutClasses(preferences);
  const [subTab, setSubTab] = useState<'cards' | 'all' | 'units'>('cards');
  const [selectedCourseNotebookId, setSelectedCourseNotebookId] = useState<
    number | null
  >(null);
  const [standaloneNoteOpen, setStandaloneNoteOpen] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState<NoteDraft | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);

  // Filters
  const [localHubFilter, setLocalHubFilter] = useState<LearningHubId | 'all'>(
    activeHubFilter
  );
  const effectiveHubFilter = onChangeHubFilter ? activeHubFilter : localHubFilter;
  const setEffectiveHubFilter = (hub: LearningHubId | 'all') => {
    setLocalHubFilter(hub);
    onChangeHubFilter?.(hub);
  };

  const [typeFilter, setTypeFilter] = useState<NoteCategoryType | 'all'>('all');
  const [courseFilterId, setCourseFilterId] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [searchNotes, setSearchNotes] = useState('');
  const [notesSortMode, setNotesSortMode] = useState<EntitySortMode>('manual');

  // Composer form
  const [showComposer, setShowComposer] = useState(false);
  const [newHubId, setNewHubId] = useState<LearningHubId>(
    effectiveHubFilter === 'all' ? 'knowledge' : effectiveHubFilter
  );
  const [newType, setNewType] = useState<NoteCategoryType>('book');
  const [selectedCurriculumBook, setSelectedCurriculumBook] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number>(
    courses[0]?.id ?? 0
  );
  const [lectureTitle, setLectureTitle] = useState('');
  const [categoryLabel, setCategoryLabel] = useState<string>('');

  // Inline add lecture inside a Course Notebook
  const [inlineLectureTitle, setInlineLectureTitle] = useState('');

  const [monthFilter, setMonthFilter] = useState<'all' | 'written' | 'empty'>(
    'all'
  );
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<BookNote | null>(
    null
  );
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const newNoteFileInputRef = useRef<HTMLInputElement | null>(null);
  const appendFileInputRef = useRef<HTMLInputElement | null>(null);

  const openNewlyCreatedRef = useRef(false);
  const today = getTodayDateKey();

  const toggleExportSelection = (noteId: string) => {
    setSelectedExportIds((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId]
    );
  };

  const toggleSelectAllInList = (notesList: BookNote[]) => {
    const ids = notesList.map((n) => n.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedExportIds.includes(id));
    if (allSelected) {
      setSelectedExportIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedExportIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  // Open standalone note automatically only when external inline fallback is used
  const prevActiveIdRef = useRef<string | null>(activeBookNoteId);
  useEffect(() => {
    if (onOpenFocusStudy) {
      prevActiveIdRef.current = activeBookNoteId;
      return;
    }
    if (activeBookNoteId && activeBookNoteId !== prevActiveIdRef.current) {
      const target = bookNotes.find((bn) => bn.id === activeBookNoteId);
      if (target) {
        setStandaloneNoteOpen(true);
        setDraftNote(buildDraftFromNote(target));
        if (openNewlyCreatedRef.current) {
          setIsEditingNote(true);
          openNewlyCreatedRef.current = false;
        } else {
          setIsEditingNote(false);
        }
        if (target.noteType === 'course_lecture' && (target.courseId ?? 0) > 0) {
          setSelectedCourseNotebookId(target.courseId ?? null);
        } else {
          setSelectedCourseNotebookId(null);
        }
      }
    } else if (!activeBookNoteId && prevActiveIdRef.current) {
      setStandaloneNoteOpen(false);
      setIsEditingNote(false);
    }
    prevActiveIdRef.current = activeBookNoteId;
  }, [activeBookNoteId, bookNotes, onOpenFocusStudy]);

  const curriculumBookOptions = useMemo(() => {
    const items: Array<{ label: string; title: string; author: string }> = [];
    const seen = new Set<string>();
    for (const m of months) {
      for (const track of [m.foundational, m.exploratory]) {
        const key = `${track.title}::${track.author}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            label: `الوحدة ${m.id}: ${track.title} — ${track.author}`,
            title: track.title,
            author: track.author,
          });
        }
      }
    }
    return items;
  }, [months]);

  const hubFilteredNotes = useMemo(() => {
    return bookNotes.filter((bn) => {
      if (
        effectiveHubFilter !== 'all' &&
        (bn.hubId ?? 'knowledge') !== effectiveHubFilter
      ) {
        return false;
      }
      if (
        onlyRepeated &&
        (bn.listenCount ?? 0) < 2 &&
        (bn.reviewCount ?? 0) < 2
      ) {
        return false;
      }
      return true;
    });
  }, [bookNotes, effectiveHubFilter, onlyRepeated]);

  const hubFilteredCourses = useMemo(() => {
    if (effectiveHubFilter === 'all') return courses;
    return courses.filter((c) => (c.hubId ?? 'knowledge') === effectiveHubFilter);
  }, [courses, effectiveHubFilter]);

  const bookOnlyNotes = useMemo(
    () =>
      sortBookNotesList(
        hubFilteredNotes.filter((bn) => (bn.noteType ?? 'book') === 'book'),
        notesSortMode
      ),
    [hubFilteredNotes, notesSortMode]
  );

  const generalNotes = useMemo(
    () =>
      sortBookNotesList(
        hubFilteredNotes.filter((bn) => bn.noteType === 'general'),
        notesSortMode
      ),
    [hubFilteredNotes, notesSortMode]
  );

  const unlinkedLectureNotes = useMemo(
    () =>
      sortBookNotesList(
        hubFilteredNotes.filter(
          (bn) =>
            bn.noteType === 'course_lecture' &&
            !(bn.courseId && courses.some((c) => c.id === bn.courseId))
        ),
        notesSortMode
      ),
    [hubFilteredNotes, courses, notesSortMode]
  );

  const filteredNotes = useMemo(() => {
    const q = searchNotes.trim().toLowerCase();
    const matched = hubFilteredNotes.filter((bn) => {
      const t = bn.noteType ?? 'book';
      if (typeFilter !== 'all' && t !== typeFilter) return false;
      if (courseFilterId > 0 && (bn.courseId ?? 0) !== courseFilterId) {
        return false;
      }
      if (
        categoryFilter !== 'all' &&
        (bn.categoryLabel || '') !== categoryFilter
      ) {
        return false;
      }
      if (q) {
        const plainContent = richHtmlToPlainText(bn.content);
        const text = [
          bn.bookTitle,
          bn.author,
          bn.courseTitle,
          bn.lectureTitle,
          bn.categoryLabel,
          plainContent,
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
    return sortBookNotesList(matched, notesSortMode);
  }, [
    hubFilteredNotes,
    typeFilter,
    courseFilterId,
    categoryFilter,
    searchNotes,
    notesSortMode,
  ]);

  const selectedCourse = useMemo(
    () =>
      selectedCourseNotebookId !== null
        ? courses.find((c) => c.id === selectedCourseNotebookId) ?? null
        : null,
    [courses, selectedCourseNotebookId]
  );

  const selectedCourseNotes = useMemo(() => {
    if (selectedCourseNotebookId === null) return [];
    const list = bookNotes.filter(
      (bn) =>
        bn.noteType === 'course_lecture' &&
        (bn.courseId ?? 0) === selectedCourseNotebookId
    );
    return sortBookNotesList(list, notesSortMode);
  }, [bookNotes, selectedCourseNotebookId, notesSortMode]);

  const standaloneNote = useMemo(() => {
    if (!standaloneNoteOpen || !activeBookNoteId) return null;
    return bookNotes.find((bn) => bn.id === activeBookNoteId) ?? null;
  }, [standaloneNoteOpen, activeBookNoteId, bookNotes]);

  const filteredMonths = months.filter((m) => {
    const hasNotes = m.notes.trim().length > 0;
    if (monthFilter === 'written') return hasNotes;
    if (monthFilter === 'empty') return !hasNotes;
    return true;
  });

  const writtenCount = months.filter((m) => m.notes.trim().length > 0).length;

  const allCategoryChoices = useMemo(() => {
    const set = new Set<string>();
    customCategories.forEach((c) => set.add(c.title));
    if (hubCategories) {
      Object.values(hubCategories).forEach((arr) =>
        arr.forEach((cat) => set.add(cat))
      );
    }
    return Array.from(set);
  }, [customCategories, hubCategories]);

  const requireEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const handleMoveNoteOrder = (
    list: BookNote[],
    index: number,
    direction: 'up' | 'down'
  ) => {
    if (!requireEdit()) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    reordered.forEach((item, idx) => {
      const nextOrder = idx + 1;
      if ((item.sortOrder ?? 0) !== nextOrder) {
        onUpdateBookNote(item.id, { sortOrder: nextOrder });
      }
    });
  };

  const openNoteStandalone = (note: BookNote, startInEdit = false) => {
    if (onOpenFocusStudy) {
      onOpenFocusStudy(note.id, startInEdit);
      return;
    }
    onSelectBookNote(note.id);
    setDraftNote(buildDraftFromNote(note));
    setIsEditingNote(startInEdit);
    setStandaloneNoteOpen(true);
    setSaveFeedback(null);
    setConfirmDeleteNote(null);
  };

  const closeStandaloneNote = () => {
    setStandaloneNoteOpen(false);
    setIsEditingNote(false);
    setDraftNote(null);
    setSaveFeedback(null);
    onSelectBookNote(null);
  };

  const handleOpenCourseNotebook = (course: PersonalCourse) => {
    setSelectedCourseNotebookId(course.id);
    setStandaloneNoteOpen(false);
    setIsEditingNote(false);
    setSubTab('cards');
  };

  const handleQuickAddCourseLecture = (
    course: PersonalCourse,
    lectureName?: string
  ) => {
    if (!requireEdit()) return;
    const count = bookNotes.filter(
      (bn) => bn.noteType === 'course_lecture' && bn.courseId === course.id
    ).length;
    const lecTitle = (lectureName || '').trim() || `المحاضرة ${count + 1}`;
    setSelectedCourseNotebookId(course.id);
    openNewlyCreatedRef.current = true;
    setSubTab('cards');
    onAddStructuredNote({
      hubId: course.hubId ?? 'knowledge',
      noteType: 'course_lecture',
      bookTitle: `${course.title} — ${lecTitle}`,
      author: course.instructor || course.bookAuthor || '',
      courseId: course.id,
      courseTitle: course.title,
      lectureTitle: lecTitle,
      categoryLabel: course.category || '',
    });
    setInlineLectureTitle('');
  };

  const handlePickCurriculumBook = (value: string) => {
    if (!requireEdit()) return;
    setSelectedCurriculumBook(value);
    if (!value) return;
    const found = curriculumBookOptions.find((o) => o.label === value);
    if (found) {
      setSelectedCourseNotebookId(null);
      setShowComposer(false);
      openNewlyCreatedRef.current = true;
      onAddStructuredNote({
        hubId: newHubId,
        noteType: 'book',
        bookTitle: found.title,
        author: found.author,
        categoryLabel: categoryLabel || '',
      });
      setSelectedCurriculumBook('');
    }
  };

  const handleCreateStructuredNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireEdit()) return;

    if (newType === 'course_lecture') {
      const course = courses.find((c) => c.id === selectedCourseId);
      const lec = lectureTitle.trim();
      const title =
        customTitle.trim() ||
        lec ||
        (course ? `ملاحظات ${course.title}` : '');
      if (!title) return;
      setSelectedCourseNotebookId(course?.id ?? null);
      openNewlyCreatedRef.current = true;
      onAddStructuredNote({
        hubId: course?.hubId ?? newHubId,
        noteType: 'course_lecture',
        bookTitle: title,
        author: customAuthor.trim() || course?.instructor || course?.bookAuthor || '',
        courseId: course?.id ?? 0,
        courseTitle: course?.title ?? '',
        lectureTitle: lec,
        categoryLabel: categoryLabel || course?.category || '',
      });
      setCustomTitle('');
      setCustomAuthor('');
      setLectureTitle('');
      setShowComposer(false);
      return;
    }

    const title = customTitle.trim();
    if (!title) return;
    setSelectedCourseNotebookId(null);
    openNewlyCreatedRef.current = true;
    onAddStructuredNote({
      hubId: newHubId,
      noteType: newType,
      bookTitle: title,
      author: customAuthor.trim(),
      courseId: 0,
      courseTitle: '',
      lectureTitle: '',
      categoryLabel: categoryLabel || '',
    });
    setCustomTitle('');
    setCustomAuthor('');
    setShowComposer(false);
  };

  const insertVoiceIntoDraftOrNote = (
    note: BookNote,
    field: 'content' | 'quotes',
    transcript: string
  ) => {
    if (!requireEdit()) return;
    const cleanText = transcript.trim();
    if (!cleanText) return;

    let formattedText = escapePlainToHtml(cleanText);
    if (preferences.autoAddTimestampOnVoice) {
      const now = new Date();
      const stamp = now.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      formattedText = `<strong>[${stamp}]</strong> ${formattedText}`;
    }

    let snippetHtml = `<p>${formattedText}</p>`;
    if (preferences.voiceInsertMode === 'append_bullet') {
      snippetHtml = `<ul><li>${formattedText}</li></ul>`;
    } else if (preferences.voiceInsertMode === 'append_quote') {
      snippetHtml = `<blockquote>${formattedText}</blockquote>`;
    }

    const baseValue =
      isEditingNote && draftNote ? draftNote[field] : note[field];
    const currentHtml = ensureRichHtml(baseValue || '');
    const nextHtml = currentHtml ? `${currentHtml}${snippetHtml}` : snippetHtml;

    if (isEditingNote && draftNote) {
      setDraftNote({ ...draftNote, [field]: nextHtml });
    } else {
      onUpdateBookNote(note.id, { [field]: nextHtml });
    }
    onLogVoiceNote?.(note.bookTitle);
  };

  const handleImportNewNoteFromFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetCourse?: PersonalCourse
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireEdit()) return;

    setImportingFile(true);
    setImportNotice(null);
    try {
      const parsed = await parseDocumentFile(file);
      openNewlyCreatedRef.current = true;
      onAddStructuredNote({
        hubId:
          targetCourse?.hubId ??
          (effectiveHubFilter === 'all' ? 'knowledge' : effectiveHubFilter),
        noteType: targetCourse ? 'course_lecture' : 'book',
        bookTitle: parsed.title,
        author: targetCourse?.instructor || targetCourse?.bookAuthor || '',
        courseId: targetCourse?.id ?? 0,
        courseTitle: targetCourse?.title ?? '',
        lectureTitle: targetCourse ? parsed.title : '',
        categoryLabel: '',
        initialContent: parsed.html,
      });
      setSelectedCourseNotebookId(targetCourse?.id ?? null);
      setImportNotice(
        `تم استيراد «${file.name}» بنجاح. يمكنك الآن تعديله أو حفظ التغييرات.`
      );
    } catch {
      setImportNotice(
        'تعذر قراءة الملف. تأكد أنه بصيغة .docx أو .txt أو .md صالحة.'
      );
    } finally {
      setImportingFile(false);
    }
  };

  const handleAppendFileToDraftOrNote = async (
    e: React.ChangeEvent<HTMLInputElement>,
    note: BookNote
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireEdit()) return;

    setImportingFile(true);
    setImportNotice(null);
    try {
      const parsed = await parseDocumentFile(file);
      const headerHtml = `<p><strong>محتوى مستورد من: ${escapePlainToHtml(
        file.name
      )}</strong></p>`;
      const baseContent =
        isEditingNote && draftNote ? draftNote.content : note.content;
      const existing = ensureRichHtml(baseContent || '');
      const nextHtml = existing
        ? `${existing}${headerHtml}${parsed.html}`
        : `${headerHtml}${parsed.html}`;

      if (isEditingNote && draftNote) {
        setDraftNote({ ...draftNote, content: nextHtml });
      } else {
        onUpdateBookNote(note.id, { content: nextHtml });
      }
      setImportNotice(`تم إدراج محتوى «${file.name}» داخل الملاحظة.`);
    } catch {
      setImportNotice('تعذر قراءة محتوى الملف المرفق.');
    } finally {
      setImportingFile(false);
    }
  };

  const handleSaveDraft = (note: BookNote) => {
    if (!requireEdit() || !draftNote) return;
    const cleanTitle = draftNote.bookTitle.trim() || note.bookTitle;
    const selectedCourseObj = courses.find(
      (c) => c.id === draftNote.courseId
    );
    onUpdateBookNote(note.id, {
      bookTitle: cleanTitle,
      hubId: draftNote.hubId,
      noteType: draftNote.noteType,
      noteColor: draftNote.noteColor,
      categoryLabel: draftNote.categoryLabel.trim(),
      author: draftNote.author.trim(),
      courseId: draftNote.courseId,
      courseTitle:
        draftNote.courseId > 0
          ? selectedCourseObj?.title ?? draftNote.courseTitle
          : '',
      lectureTitle: draftNote.lectureTitle.trim(),
      progressMarker: draftNote.progressMarker.trim(),
      content: draftNote.content,
      quotes: draftNote.quotes,
    });
    setIsEditingNote(false);
    setSaveFeedback('تم حفظ التغييرات في الملاحظة بنجاح.');
    window.setTimeout(() => setSaveFeedback(null), 3500);
  };

  const handleCancelEdit = (note: BookNote) => {
    setDraftNote(buildDraftFromNote(note));
    setIsEditingNote(false);
    setSaveFeedback(null);
  };

  // --- DEDICATED STANDALONE NOTE PAGE (Isolated Single Note View) ---
  if (standaloneNote) {
    const activeHubMeta = getHubMeta(
      isEditingNote && draftNote ? draftNote.hubId : standaloneNote.hubId
    );
    const activeDraft = draftNote ?? buildDraftFromNote(standaloneNote);
    const activeColorKey: NoteColorKey = isEditingNote
      ? activeDraft.noteColor
      : standaloneNote.noteColor ?? 'default';
    const activeColorTheme =
      NOTE_COLOR_THEMES[activeColorKey] ?? NOTE_COLOR_THEMES.default;

    return (
      <div className="space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={closeStandaloneNote}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>
              {selectedCourse
                ? `العودة إلى دفتر كورس «${selectedCourse.title}»`
                : subTab === 'all'
                ? 'العودة إلى كل الملاحظات'
                : 'العودة إلى بطاقات دفاتر التلخيص'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !isEditingNote && (
              <button
                type="button"
                onClick={() => {
                  setDraftNote(buildDraftFromNote(standaloneNote));
                  setIsEditingNote(true);
                  setSaveFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تعديل الملاحظة</span>
              </button>
            )}

            {canEdit && isEditingNote && (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveDraft(standaloneNote)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حفظ التغييرات</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelEdit(standaloneNote)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إلغاء التعديلات</span>
                </button>
              </>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => setConfirmDeleteNote(standaloneNote)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حذف الملاحظة</span>
              </button>
            )}
          </div>
        </div>

        {saveFeedback && (
          <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span>{saveFeedback}</span>
            </span>
            <button
              type="button"
              onClick={() => setSaveFeedback(null)}
              className="text-[11px] font-semibold hover:underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Standalone Full-Width Note Studio */}
        <article
          className={`border rounded-xl p-4 sm:p-8 space-y-5 sm:space-y-6 ${activeColorTheme.cardClass}`}
        >
          {/* Header & Title */}
          <div className="pb-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-md border font-semibold ${activeHubMeta.badgeClass}`}
              >
                {activeHubMeta.shortTitle}
              </span>
              <span className="font-semibold text-[#1E3A5F]">
                {NOTE_TYPE_LABELS[activeDraft.noteType]}
              </span>
              {(standaloneNote.categoryLabel || activeDraft.categoryLabel) && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-slate-700 font-medium">
                    {isEditingNote
                      ? activeDraft.categoryLabel
                      : standaloneNote.categoryLabel}
                  </span>
                </>
              )}
              {(standaloneNote.courseTitle || activeDraft.courseTitle) && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-emerald-700 font-medium">
                    {isEditingNote
                      ? activeDraft.courseTitle
                      : standaloneNote.courseTitle}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-slate-500">
                آخر تحديث: {standaloneNote.updatedAt}
              </span>
            </div>

            {canEdit && (
              <div className="flex items-center gap-1.5" role="group" aria-label="لون بطاقة الملاحظة">
                <span className="text-[11px] text-slate-500 ml-1">لون النوت:</span>
                {(Object.keys(NOTE_COLOR_THEMES) as NoteColorKey[]).map((ck) => {
                  const theme = NOTE_COLOR_THEMES[ck];
                  const selected = activeColorKey === ck;
                  return (
                    <button
                      key={ck}
                      type="button"
                      title={theme.label}
                      aria-label={`اختيار لون ${theme.label}`}
                      onClick={() => {
                        if (isEditingNote && draftNote) {
                          setDraftNote({ ...draftNote, noteColor: ck });
                        } else {
                          onUpdateBookNote(standaloneNote.id, { noteColor: ck });
                        }
                      }}
                      className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${theme.swatchClass} ${
                        selected ? 'scale-110 ring-2 ring-offset-1 ring-[#1E3A5F]' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
            )}
            </div>

            {isEditingNote ? (
              <div className="space-y-4">
                <label className="block text-xs font-medium text-slate-600">
                  عنوان الملاحظة أو الكتاب
                  <input
                    type="text"
                    value={activeDraft.bookTitle}
                    onChange={(e) =>
                      setDraftNote({ ...activeDraft, bookTitle: e.target.value })
                    }
                    className="mt-1.5 w-full font-editorial text-2xl font-bold text-slate-900 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <label className="block text-xs font-medium text-slate-600">
                    المستوى التعليمي (Hub)
                    <select
                      value={activeDraft.hubId}
                      onChange={(e) =>
                        setDraftNote({
                          ...activeDraft,
                          hubId: e.target.value as LearningHubId,
                        })
                      }
                      className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      {LEARNING_HUBS.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-medium text-slate-600">
                    نوع الدفتر
                    <select
                      value={activeDraft.noteType}
                      onChange={(e) =>
                        setDraftNote({
                          ...activeDraft,
                          noteType: e.target.value as NoteCategoryType,
                        })
                      }
                      className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      <option value="book">ملاحظات كتاب</option>
                      <option value="course_lecture">كورس / محاضرة</option>
                      <option value="general">موضوع عام</option>
                    </select>
                  </label>

                  <label className="block text-xs font-medium text-slate-600">
                    التصنيف (اختياري)
                    <select
                      value={activeDraft.categoryLabel}
                      onChange={(e) =>
                        setDraftNote({
                          ...activeDraft,
                          categoryLabel: e.target.value,
                        })
                      }
                      className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    >
                      <option value="">بدون تصنيف</option>
                      {allCategoryChoices.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-medium text-slate-600">
                    المؤلف / المحاضر (اختياري)
                    <input
                      type="text"
                      value={activeDraft.author}
                      onChange={(e) =>
                        setDraftNote({ ...activeDraft, author: e.target.value })
                      }
                      placeholder="اسم المؤلف أو المحاضر..."
                      className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                    />
                  </label>

                  {activeDraft.noteType === 'course_lecture' && (
                    <>
                      <label className="block text-xs font-medium text-slate-600">
                        الكورس المرتبط
                        <select
                          value={activeDraft.courseId}
                          onChange={(e) => {
                            const cid = Number(e.target.value);
                            const c = courses.find((item) => item.id === cid);
                            setDraftNote({
                              ...activeDraft,
                              courseId: cid,
                              courseTitle: c?.title ?? '',
                            });
                          }}
                          className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                        >
                          <option value={0}>بدون ربط بكورس</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-xs font-medium text-slate-600">
                        اسم / رقم المحاضرة (اختياري)
                        <input
                          type="text"
                          value={activeDraft.lectureTitle}
                          onChange={(e) =>
                            setDraftNote({
                              ...activeDraft,
                              lectureTitle: e.target.value,
                            })
                          }
                          placeholder="مثلاً: المحاضرة الثانية"
                          className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </label>
                    </>
                  )}

                  <label className="block text-xs font-medium text-slate-600">
                    موضع القراءة / الدقيقة (اختياري)
                    <input
                      type="text"
                      value={activeDraft.progressMarker}
                      onChange={(e) =>
                        setDraftNote({
                          ...activeDraft,
                          progressMarker: e.target.value,
                        })
                      }
                      placeholder="مثلاً: الفصل 3 — ص 85 أو د 14:20"
                      className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                  {standaloneNote.bookTitle}
                </h1>
                {(standaloneNote.author ||
                  standaloneNote.lectureTitle ||
                  standaloneNote.progressMarker) && (
                  <p className="text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-2">
                    {standaloneNote.author && (
                      <span>المصدر / المؤلف: {standaloneNote.author}</span>
                    )}
                    {standaloneNote.lectureTitle && (
                      <span>· المحاضرة: {standaloneNote.lectureTitle}</span>
                    )}
                    {standaloneNote.progressMarker && (
                      <span>· الموضع: {standaloneNote.progressMarker}</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Note Content Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {isEditingNote
                  ? 'تحرير النوتس والأفكار المستخلصة (تحديد أو مسح أو استبدال النص بحرية)'
                  : 'محتوى الملاحظة والتلخيص'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {isEditingNote && (
                  <>
                    <input
                      ref={appendFileInputRef}
                      type="file"
                      accept=".docx,.doc,.txt,.md,.markdown"
                      className="hidden"
                      onChange={(e) =>
                        void handleAppendFileToDraftOrNote(e, standaloneNote)
                      }
                    />
                    <button
                      type="button"
                      disabled={!canEdit || importingFile}
                      onClick={() => {
                        if (!requireEdit()) return;
                        appendFileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {importingFile ? 'جاري الاستيراد...' : 'استيراد Word / نص'}
                      </span>
                    </button>
                  </>
                )}

                <ReadAloudButton
                  uid={uid}
                  entityType={standaloneNote.noteType === 'course_lecture' ? 'course' : 'note'}
                  entityId={standaloneNote.id}
                  title={standaloneNote.bookTitle}
                  text={richHtmlToPlainText(
                    isEditingNote ? activeDraft.content : standaloneNote.content
                  )}
                  voiceName={preferences.readAloudVoice}
                  speed={preferences.readAloudSpeed}
                  disabled={!canEdit}
                  onRequireAuth={onRequireAuth}
                />

                {!isEditingNote && canEdit && (
                  <div className="inline-flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px]">
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

                {isEditingNote && (
                  <VoiceRecorderButton
                    label="تسجيل نوت بالصوت"
                    dialect={preferences.voiceDialect}
                    disabled={!canEdit}
                    onRequireAuth={onRequireAuth}
                    onTranscript={(text) =>
                      insertVoiceIntoDraftOrNote(standaloneNote, 'content', text)
                    }
                  />
                )}
              </div>
            </div>

            {isEditingNote ? (
              <RichTextNoteEditor
                noteKey={`${standaloneNote.id}-edit`}
                value={activeDraft.content}
                onChange={(html) => {
                  if (!canEdit) return;
                  setDraftNote({ ...activeDraft, content: html });
                }}
                canEdit={canEdit}
                onRequireAuth={onRequireAuth}
                preferences={preferences}
                onUpdatePreferences={onUpdatePreferences}
                onSelectDefaultHighlight={(color) => {
                  if (canEdit) onUpdatePreferences({ noteHighlightColor: color });
                }}
                minHeightClass="min-h-[280px]"
              />
            ) : (
              <div
                className={`${noteLayout.widthClass} ${noteLayout.canvasPaddingClass} ${noteLayout.borderClass} ${noteLayout.paperToneClass} rounded-xl min-h-[140px] overflow-x-auto transition-all`}
              >
                {richHtmlToPlainText(standaloneNote.content) ? (
                <div
                  className="prose-bidi text-sm sm:text-base leading-relaxed text-slate-800 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-xs [&_mark]:text-slate-900 [&_strong]:font-bold [&_strong]:text-slate-900"
                  dangerouslySetInnerHTML={{
                    __html: renderSafeBidiHtml(standaloneNote.content),
                  }}
                />
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-xs text-slate-500">
                      لا يوجد محتوى مكتوب في هذه الملاحظة بعد.
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftNote(buildDraftFromNote(standaloneNote));
                          setIsEditingNote(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>ابدأ كتابة الملاحظة</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <ImageAttachmentGallery
              uid={uid}
              scopeKey={`note:${standaloneNote.id}`}
              title="الصور والمخططات المرفقة بهذه الملاحظة (متزامنة عبر حسابك)"
              canEdit={canEdit}
              onRequireAuth={onRequireAuth}
            />

            <NoteAttachmentsPanel
              uid={uid}
              noteId={standaloneNote.id}
              noteTitle={standaloneNote.bookTitle}
              resources={standaloneNote.resources}
              canEdit={canEdit}
              onRequireAuth={onRequireAuth}
              onUpdateResources={(next) =>
                onUpdateBookNote(standaloneNote.id, { resources: next })
              }
              onOpenPdf={onOpenPdf ?? (() => {})}
            />
          </div>

          {/* Quotes Section */}
          {(isEditingNote || richHtmlToPlainText(standaloneNote.quotes)) && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  اقتباسات مهمة أو أسئلة للنقاش
                </span>
                {isEditingNote && (
                  <VoiceRecorderButton
                    label="سؤال نقاشي بالصوت"
                    dialect={preferences.voiceDialect}
                    disabled={!canEdit}
                    onRequireAuth={onRequireAuth}
                    onTranscript={(text) =>
                      insertVoiceIntoDraftOrNote(standaloneNote, 'quotes', text)
                    }
                  />
                )}
              </div>

              {isEditingNote ? (
                <RichTextNoteEditor
                  noteKey={`${standaloneNote.id}-quotes-edit`}
                  value={activeDraft.quotes}
                  onChange={(html) => {
                    if (!canEdit) return;
                    setDraftNote({ ...activeDraft, quotes: html });
                  }}
                  placeholder="أضف اقتباسًا مهمًا أو سؤالاً للنقاش..."
                  canEdit={canEdit}
                  onRequireAuth={onRequireAuth}
                  preferences={preferences}
                  onUpdatePreferences={onUpdatePreferences}
                  onSelectDefaultHighlight={(color) => {
                    if (canEdit)
                      onUpdatePreferences({ noteHighlightColor: color });
                  }}
                  minHeightClass="min-h-[120px]"
                />
              ) : (
                <div
                  className={`prose-bidi ${noteLayout.widthClass} ${noteLayout.canvasPaddingClass} bg-amber-50/40 border border-amber-200 rounded-xl text-sm text-slate-800 leading-relaxed [&_mark]:px-1 [&_mark]:rounded-xs [&_strong]:font-bold`}
                  dangerouslySetInnerHTML={{
                    __html: renderSafeBidiHtml(standaloneNote.quotes),
                  }}
                />
              )}
            </div>
          )}

          {/* Bottom Save/Cancel bar in Edit Mode */}
          {isEditingNote && canEdit && (
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleCancelEdit(standaloneNote)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إلغاء التعديلات</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveDraft(standaloneNote)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حفظ التغييرات</span>
              </button>
            </div>
          )}

          {/* Spaced Repetition + Reading Modes + Listen Counter */}
          <SpacedRepetitionPanel
            canEdit={canEdit}
            title="أنماط القراءة، أساليب التعلم والتكرار المتباعد للملاحظة"
            value={{
              readingModes: standaloneNote.readingModes,
              learningMethods: standaloneNote.learningMethods,
              reviewCount: standaloneNote.reviewCount,
              listenCount: standaloneNote.listenCount,
              repetitionStage: standaloneNote.repetitionStage,
              nextReviewDateKey: standaloneNote.nextReviewDateKey,
              lastReviewedDateKey: standaloneNote.lastReviewedDateKey,
            }}
            onChange={(updates) => onUpdateBookNote(standaloneNote.id, updates)}
          />

          {/* Per-Note Download Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              تحميل هذه الملاحظة فقط في ملف مستقل:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportSingleBookNoteAsWord(standaloneNote)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تحميل ملف Word (.doc)</span>
              </button>
              <button
                type="button"
                onClick={() => exportSingleBookNoteAsMarkdown(standaloneNote)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ملف نصي (.md)</span>
              </button>
              {showExcelExport && (
                <button
                  type="button"
                  onClick={() => exportSingleBookNoteAsExcel(standaloneNote)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ملف Excel (.xlsx)</span>
                </button>
              )}
            </div>
          </div>
        </article>

        <ConfirmDialog
          open={Boolean(confirmDeleteNote)}
          title="تأكيد حذف الملاحظة"
          message={`هل أنت متأكد من حذف «${confirmDeleteNote?.bookTitle}» نهائيًا؟`}
          confirmLabel="تأكيد حذف الملاحظة"
          onCancel={() => setConfirmDeleteNote(null)}
          onConfirm={() => {
            if (!confirmDeleteNote) return;
            onDeleteBookNote(confirmDeleteNote.id);
            setConfirmDeleteNote(null);
            closeStandaloneNote();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header + Mode Switch + Preferences Toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            دفاتر التلخيص المستقلة · صفحة مستقلة لكل ملاحظة · التكرار المتباعد والصوت
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            دفتر التلخيص والنوتس
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            افتح أي كتاب أو ملاحظة أو محاضرة في صفحتها المستقلة للتركيز والتحرير الكامل مع التكرار المتباعد وأنماط القراءة والصور المتزامنة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setSubTab('cards');
                setSelectedCourseNotebookId(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              بطاقات دفاتر التلخيص
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab('all');
                setSelectedCourseNotebookId(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كل الملاحظات ({bookNotes.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab('units');
                setSelectedCourseNotebookId(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'units'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ملخصات الوحدات ({months.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPrefs((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showPrefs
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>تخصيص النوتس والصوت</span>
          </button>

          {showExcelExport && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <span>تصدير Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Hub Filter Bar */}
      {subTab !== 'units' && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEffectiveHubFilter('all')}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                effectiveHubFilter === 'all'
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              كل المستويات ({bookNotes.length})
            </button>
            {LEARNING_HUBS.map((hub) => {
              const count = bookNotes.filter(
                (n) => (n.hubId ?? 'knowledge') === hub.id
              ).length;
              const active = effectiveHubFilter === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => setEffectiveHubFilter(hub.id)}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {hub.shortTitle} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <select
                aria-label="ترتيب الملاحظات"
                value={notesSortMode}
                onChange={(e) => setNotesSortMode(e.target.value as EntitySortMode)}
                className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="manual">ترتيب يدوي (تحريك لأعلى/لأسفل)</option>
                <option value="logical">ترتيب منطقي (١، ٢، ٣)</option>
                <option value="updated">الأحدث تعديلاً</option>
                <option value="title">ترتيب أبجدي</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setOnlyRepeated((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border cursor-pointer ${
                onlyRepeated
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>الملاحظات المتكررة (2+)</span>
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Personalization Drawer */}
      {showPrefs && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-slate-900">
                تخصيص النوتس والصوت لحسابك
              </h2>
              <p className="text-xs text-slate-500">
                تُحفظ هذه التفضيلات تلقائيًا في حسابك وتنعكس على المحرر والتفريغ والقراءة الصوتية.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPrefs(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إغلاق</span>
            </button>
          </div>

          {!canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  سجّل الدخول بحساب Google لحفظ تخصيصات النوتس والصوت على حسابك.
                </span>
              </span>
              <button
                type="button"
                onClick={onRequireAuth}
                className="font-semibold underline cursor-pointer whitespace-nowrap shrink-0"
              >
                تسجيل الدخول الآن
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <h3 className="text-xs font-bold text-[#1E3A5F]">
                أولاً: تخصيص النوتس والمحرر
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  حجم خط الكتابة
                  <select
                    disabled={!canEdit}
                    value={preferences.noteFontSize}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdatePreferences({
                        noteFontSize: e.target.value as UserPreferences['noteFontSize'],
                      });
                    }}
                    className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg disabled:opacity-65"
                  >
                    <option value="sm">مضغوط (صغير)</option>
                    <option value="base">متوسط مريح (افتراضي)</option>
                    <option value="lg">كبير للقراءة المعمّقة</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  لون ورق الدفتر
                  <select
                    disabled={!canEdit}
                    value={preferences.notePaperTone}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdatePreferences({
                        notePaperTone: e.target.value as UserPreferences['notePaperTone'],
                      });
                    }}
                    className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg disabled:opacity-65"
                  >
                    <option value="clean">أبيض ناصع</option>
                    <option value="warm">ورق دافئ مريح للعين</option>
                    <option value="slate">رمادي هادئ</option>
                  </select>
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700">
                  لون التظليل الافتراضي (Highlight):
                </span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColorKey[]).map(
                    (key) => {
                      const sw = HIGHLIGHT_SWATCHES[key];
                      const active = preferences.noteHighlightColor === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            if (!requireEdit()) return;
                            onUpdatePreferences({ noteHighlightColor: key });
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer disabled:opacity-60 ${
                            active
                              ? 'border-[#1E3A5F] bg-white font-semibold text-slate-900 shadow-xs'
                              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded-xs border shrink-0 ${sw.swatchClass}`}
                          />
                          <span>{sw.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={preferences.autoAddTimestampOnVoice}
                  onChange={(e) => {
                    if (!requireEdit()) return;
                    onUpdatePreferences({
                      autoAddTimestampOnVoice: e.target.checked,
                    });
                  }}
                  className="rounded border-slate-300 text-[#1E3A5F]"
                />
                <span>إضافة التوقيت تلقائيًا [ساعة:دقيقة] قبل كل تسجيل صوتي</span>
              </label>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <h3 className="text-xs font-bold text-[#1E3A5F]">
                ثانيًا: تخصيص الصوت والإملاء والقراءة الآلية
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  لهجة التفريغ الصوتي
                  <select
                    disabled={!canEdit}
                    value={preferences.voiceDialect}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdatePreferences({
                        voiceDialect: e.target.value as VoiceDialectMode,
                      });
                    }}
                    className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg disabled:opacity-65"
                  >
                    <option value="standard_arabic">العربية الفصحى</option>
                    <option value="egyptian_arabic">اللهجة المصرية / العامية</option>
                    <option value="bilingual">عربي + مصطلحات إنجليزية</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  تنسيق إدراج النص الصوتي
                  <select
                    disabled={!canEdit}
                    value={preferences.voiceInsertMode}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdatePreferences({
                        voiceInsertMode: e.target.value as VoiceInsertMode,
                      });
                    }}
                    className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg disabled:opacity-65"
                  >
                    <option value="append_paragraph">فقرة عادية جديدة</option>
                    <option value="append_bullet">نقطة في قائمة (Bullet)</option>
                    <option value="append_quote">اقتباس مبرز</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  نبرة صوت القراءة (استماع للملاحظة)
                  <select
                    disabled={!canEdit}
                    value={preferences.readAloudVoice}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdatePreferences({
                        readAloudVoice: e.target.value as ReadAloudVoiceName,
                      });
                    }}
                    className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg disabled:opacity-65"
                  >
                    <option value="Kore">Kore — صوت متزن وواضح</option>
                    <option value="Zephyr">Zephyr — صوت مشرق وهادئ</option>
                    <option value="Puck">Puck — صوت حيوي</option>
                    <option value="Charon">Charon — صوت رصين</option>
                    <option value="Fenrir">Fenrir — صوت عميق</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-slate-700">
                  سرعة القراءة الصوتية
                  <select
                    disabled={!canEdit}
                    value={preferences.readAloudSpeed}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdatePreferences({
                        readAloudSpeed: e.target.value as UserPreferences['readAloudSpeed'],
                      });
                    }}
                    className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg disabled:opacity-65"
                  >
                    <option value="normal">سرعة طبيعية</option>
                    <option value="calm">إلقاء هادئ ومتأنٍ</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 1: CARDS HUB OR SELECTED COURSE NOTEBOOK LECTURES */}
      {subTab === 'cards' && (
        <div className="space-y-6">
          {selectedCourse ? (
            /* Course Notebook Lectures List (clicking any lecture opens its Standalone Note Page!) */
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCourseNotebookId(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>العودة إلى بطاقات دفاتر التلخيص</span>
                </button>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <GraduationCap
                    className="w-4 h-4 text-[#1E3A5F]"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-slate-900">
                    دفتر كورس: {selectedCourse.title}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {selectedCourseNotes.length} محاضرات / ملخصات
                  </span>
                  {selectedCourseNotes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mr-2">
                      <button
                        type="button"
                        onClick={() =>
                          exportNotebookBundleAsWord(
                            selectedCourse.title,
                            selectedCourseNotes
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>Word (.doc)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          exportNotebookBundleAsMarkdown(
                            selectedCourse.title,
                            selectedCourseNotes
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>.md</span>
                      </button>
                      {showExcelExport && (
                        <button
                          type="button"
                          onClick={() =>
                            exportNotebookBundleAsExcel(
                              selectedCourse.title,
                              selectedCourseNotes
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download className="w-3 h-3" aria-hidden="true" />
                          <span>Excel (.xlsx)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      محاضرات وملخصات «{selectedCourse.title}»
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      اضغط على أي محاضرة لفتحها في صفحة ملاحظة مستقلة كاملة التركيز.
                    </p>
                  </div>

                  {canEdit && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleQuickAddCourseLecture(
                          selectedCourse,
                          inlineLectureTitle
                        );
                      }}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto"
                    >
                      <input
                        type="text"
                        value={inlineLectureTitle}
                        onChange={(e) => setInlineLectureTitle(e.target.value)}
                        placeholder="اسم المحاضرة الجديدة..."
                        className="w-full sm:w-56 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                      />
                      <button
                        type="submit"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>إضافة محاضرة</span>
                      </button>
                    </form>
                  )}
                </div>

                {selectedCourseNotes.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                    <p className="text-xs text-slate-600">
                      لا توجد محاضرات مسجّلة في دفتر هذا الكورس بعد.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleQuickAddCourseLecture(selectedCourse)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>ابدأ تلخيص المحاضرة 1</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedCourseNotes.map((bn, idx) => {
                      const snippet = richHtmlToPlainText(bn.content);
                      return (
                        <article
                          key={bn.id}
                          className="p-5 bg-slate-50/60 border border-slate-200 rounded-xl flex flex-col justify-between gap-3 hover:border-[#1E3A5F]/40 transition-colors"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span className="font-semibold text-[#1E3A5F]">
                                {bn.lectureTitle || 'محاضرة'}
                              </span>
                              <span>{bn.updatedAt}</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">
                              <BidiText text={bn.bookTitle} />
                            </h3>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              <BidiText
                                text={snippet || 'محاضرة جاهزة للكتابة والتلخيص...'}
                              />
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openNoteStandalone(bn, false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                            >
                              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>فتح المحاضرة</span>
                            </button>

                            {canEdit && (
                              <div className="flex items-center gap-1">
                                {notesSortMode === 'manual' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() =>
                                        handleMoveNoteOrder(selectedCourseNotes, idx, 'up')
                                      }
                                      title="تقديم للأعلى"
                                      aria-label="تقديم المحاضرة"
                                      className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === selectedCourseNotes.length - 1}
                                      onClick={() =>
                                        handleMoveNoteOrder(selectedCourseNotes, idx, 'down')
                                      }
                                      title="تأخير للأسفل"
                                      aria-label="تأخير المحاضرة"
                                      className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openNoteStandalone(bn, true)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteNote(bn)}
                                  aria-label="حذف المحاضرة"
                                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* NOTEBOOK HUB CARDS */
            <div className="space-y-8">
              {/* Quick Create Trigger + Collapsible Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-semibold text-slate-900">
                      مكتبة دفاتر التلخيص ({hubFilteredCourses.length} كورس ·{' '}
                      {bookOnlyNotes.length} كتاب · {generalNotes.length} عام)
                    </h2>
                    <p className="text-xs text-slate-500">
                      اضغط على أي بطاقة لفتح الملاحظة أو المحاضرة في صفحة مستقلة للتعديل والحفظ والمراجعة المتباعدة.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={newNoteFileInputRef}
                      type="file"
                      accept=".docx,.doc,.txt,.md,.markdown"
                      className="hidden"
                      onChange={(e) => void handleImportNewNoteFromFile(e)}
                    />
                    <button
                      type="button"
                      disabled={importingFile}
                      onClick={() => {
                        if (!requireEdit()) return;
                        newNoteFileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {importingFile
                          ? 'جاري رفع الملف...'
                          : 'رفع محاضرة / ملف Word (.docx)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!requireEdit()) return;
                        setShowComposer((v) => !v);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {showComposer
                          ? 'إخفاء نموذج الإضافة'
                          : 'إضافة دفتر تلخيص جديد'}
                      </span>
                    </button>
                  </div>
                </div>

                {importNotice && (
                  <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between gap-2">
                    <span>{importNotice}</span>
                    <button
                      type="button"
                      onClick={() => setImportNotice(null)}
                      className="text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                )}

                {showComposer && canEdit && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        {(
                          [
                            { id: 'book', label: 'كتاب', Icon: BookOpen },
                            {
                              id: 'course_lecture',
                              label: 'كورس / محاضرة',
                              Icon: GraduationCap,
                            },
                            { id: 'general', label: 'موضوع عام', Icon: Layers },
                          ] as const
                        ).map(({ id, label, Icon }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setNewType(id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              newType === id
                                ? 'bg-white text-[#1E3A5F] shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {LEARNING_HUBS.map((hub) => (
                          <button
                            key={hub.id}
                            type="button"
                            onClick={() => setNewHubId(hub.id)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                              newHubId === hub.id
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {hub.shortTitle}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newType === 'book' && (
                      <div className="pb-2">
                        <label
                          htmlFor="pick-curriculum-book"
                          className="block text-xs font-medium text-slate-600 mb-1.5"
                        >
                          اختيار سريع لكتاب من خطة الدراسة (اختياري):
                        </label>
                        <select
                          id="pick-curriculum-book"
                          value={selectedCurriculumBook}
                          onChange={(e) => handlePickCurriculumBook(e.target.value)}
                          className="w-full sm:max-w-lg px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                        >
                          <option value="">اختر كتابًا أو سلسلة من خطة الدراسة...</option>
                          {curriculumBookOptions.map((opt) => (
                            <option key={opt.label} value={opt.label}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <form
                      onSubmit={handleCreateStructuredNote}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                    >
                      {newType === 'course_lecture' ? (
                        <>
                          <label className="sm:col-span-4 space-y-1 text-xs font-medium text-slate-600">
                            <span>اختر الكورس</span>
                            <select
                              value={selectedCourseId}
                              onChange={(e) =>
                                setSelectedCourseId(Number(e.target.value))
                              }
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                            >
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                              <option value={0}>كورس خارجي آخر</option>
                            </select>
                          </label>

                          <label className="sm:col-span-4 space-y-1 text-xs font-medium text-slate-600">
                            <span>اسم / رقم المحاضرة *</span>
                            <input
                              type="text"
                              required
                              value={lectureTitle}
                              onChange={(e) => setLectureTitle(e.target.value)}
                              placeholder="مثلاً: المحاضرة 3 — إدارة الانتباه"
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                            />
                          </label>
                        </>
                      ) : (
                        <label className="sm:col-span-4 space-y-1 text-xs font-medium text-slate-600">
                          <span>
                            {newType === 'book'
                              ? 'اسم الكتاب *'
                              : 'عنوان الدفتر / الموضوع *'}
                          </span>
                          <input
                            type="text"
                            required
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder={
                              newType === 'book'
                                ? 'اكتب اسم الكتاب...'
                                : 'اكتب عنوان الموضوع...'
                            }
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                          />
                        </label>
                      )}

                      <label
                        className={`${
                          newType === 'course_lecture'
                            ? 'sm:col-span-2'
                            : 'sm:col-span-3'
                        } space-y-1 text-xs font-medium text-slate-600`}
                      >
                        <span>
                          {newType === 'book'
                            ? 'المؤلف (اختياري)'
                            : newType === 'course_lecture'
                            ? 'المحاضر (اختياري)'
                            : 'المرجع (اختياري)'}
                        </span>
                        <input
                          type="text"
                          value={customAuthor}
                          onChange={(e) => setCustomAuthor(e.target.value)}
                          placeholder="اختياري..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                        />
                      </label>

                      <label
                        className={`${
                          newType === 'course_lecture'
                            ? 'sm:col-span-2'
                            : 'sm:col-span-3'
                        } space-y-1 text-xs font-medium text-slate-600`}
                      >
                        <span>التصنيف (اختياري)</span>
                        <select
                          value={categoryLabel}
                          onChange={(e) => setCategoryLabel(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                        >
                          <option value="">بدون تصنيف</option>
                          {allCategoryChoices.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div
                        className={
                          newType === 'course_lecture'
                            ? 'sm:col-span-12 flex justify-end'
                            : 'sm:col-span-2'
                        }
                      >
                        <button
                          type="submit"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إنشاء وفتح الصفحة</span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Card Group 1: Dedicated Course Notebooks */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-bold text-slate-900">
                      دفاتر تلخيص الكورسات ({hubFilteredCourses.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    لكل كورس دفتر مستقل بمحاضراته
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hubFilteredCourses.map((course, idx) => {
                    const cNotes = bookNotes.filter(
                      (bn) =>
                        bn.noteType === 'course_lecture' &&
                        bn.courseId === course.id
                    );
                    const latest = cNotes[0];
                    const snippet = latest
                      ? richHtmlToPlainText(latest.content)
                      : '';
                    const hubMeta = getHubMeta(course.hubId);

                    return (
                      <article
                        key={course.docId || course.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${hubMeta.badgeClass}`}
                            >
                              {hubMeta.shortTitle}
                            </span>
                            <span className="tabular-nums font-medium text-slate-700">
                              {cNotes.length} محاضرات
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-slate-900 leading-snug">
                            <BidiText text={`${idx + 1}. ${course.title}`} />
                          </h4>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            <BidiText
                              text={
                                snippet ||
                                (course.complementaryBook
                                  ? `المرجع المكمّل: ${course.complementaryBook}`
                                  : course.category || 'دفتر محاضرات الكورس')
                              }
                            />
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenCourseNotebook(course)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>فتح دفتر الكورس</span>
                            </button>

                            {cNotes.length > 0 && showExcelExport && (
                              <button
                                type="button"
                                title="تصدير جميع ملاحظات هذا الكورس إلى Excel"
                                onClick={() =>
                                  exportNotebookBundleAsExcel(course.title, cNotes)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Excel</span>
                              </button>
                            )}
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleQuickAddCourseLecture(course)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>محاضرة</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* Card Group 2: Dedicated Book Notebooks */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-bold text-slate-900">
                      دفاتر تلخيص الكتب ({bookOnlyNotes.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    بطاقة مستقلة لكل كتاب — افتح في صفحتها الكاملة
                  </span>
                </div>

                {bookOnlyNotes.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    لا توجد دفاتر كتب مضافة في هذا التصنيف بعد.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bookOnlyNotes.map((bn, idx) => {
                      const snippet = richHtmlToPlainText(bn.content);
                      const hubMeta = getHubMeta(bn.hubId);
                      const isDue =
                        Boolean(bn.nextReviewDateKey) &&
                        (bn.nextReviewDateKey ?? '') <= today;
                      const colorTheme = NOTE_COLOR_THEMES[bn.noteColor ?? 'default'] ?? NOTE_COLOR_THEMES.default;
                      return (
                        <article
                          key={bn.id}
                          className={`border rounded-xl overflow-hidden flex flex-col justify-between transition-colors ${colorTheme.cardClass}`}
                        >
                          <div className={`h-1.5 w-full ${colorTheme.accentBarClass}`} />
                          <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${hubMeta.badgeClass}`}
                              >
                                {hubMeta.shortTitle}
                              </span>
                              <span className="text-[11px]">
                                {bn.updatedAt}
                              </span>
                            </div>

                            <h4
                              onClick={() => openNoteStandalone(bn, false)}
                              className="text-base font-bold text-slate-900 leading-snug cursor-pointer hover:text-[#1E3A5F]"
                            >
                              <BidiText text={bn.bookTitle} />
                            </h4>

                            {(bn.author || bn.progressMarker || bn.categoryLabel) && (
                              <p className="text-xs text-slate-500">
                                {[bn.author, bn.categoryLabel, bn.progressMarker]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1.5 text-[10px]">
                              {(bn.listenCount ?? 0) >= 2 && (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
                                  تكرار ({bn.listenCount}×)
                                </span>
                              )}
                              {isDue && (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-900 border border-rose-200 font-semibold">
                                  مستحق للمراجعة
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              <BidiText
                                text={snippet || 'دفتر جاهز للتدوين وتلخيص الفصول...'}
                              />
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openNoteStandalone(bn, false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>فتح الدفتر</span>
                            </button>

                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <>
                                  {notesSortMode === 'manual' && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() =>
                                          handleMoveNoteOrder(bookOnlyNotes, idx, 'up')
                                        }
                                        title="تقديم للأعلى"
                                        aria-label="تقديم الدفتر"
                                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === bookOnlyNotes.length - 1}
                                        onClick={() =>
                                          handleMoveNoteOrder(bookOnlyNotes, idx, 'down')
                                        }
                                        title="تأخير للأسفل"
                                        aria-label="تأخير الدفتر"
                                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openNoteStandalone(bn, true)}
                                    title="تعديل"
                                    className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                                  >
                                    تعديل
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteNote(bn)}
                                    aria-label={`حذف ${bn.bookTitle}`}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => exportSingleBookNoteAsMarkdown(bn)}
                                title="تصدير Markdown"
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Card Group 3: General Topic Notebooks + Unlinked Lectures */}
              {(generalNotes.length > 0 || unlinkedLectureNotes.length > 0) && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-bold text-slate-900">
                      دفاتر المواضيع العامة والمحاضرات الخارجية (
                      {generalNotes.length + unlinkedLectureNotes.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...generalNotes, ...unlinkedLectureNotes].map((bn) => {
                      const snippet = richHtmlToPlainText(bn.content);
                      const hubMeta = getHubMeta(bn.hubId);
                      const colorTheme = NOTE_COLOR_THEMES[bn.noteColor ?? 'default'] ?? NOTE_COLOR_THEMES.default;
                      return (
                        <article
                          key={bn.id}
                          className={`border rounded-xl overflow-hidden flex flex-col justify-between transition-colors ${colorTheme.cardClass}`}
                        >
                          <div className={`h-1.5 w-full ${colorTheme.accentBarClass}`} />
                          <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${hubMeta.badgeClass}`}
                              >
                                {hubMeta.shortTitle}
                              </span>
                              <span>{bn.updatedAt}</span>
                            </div>
                            <h4
                              onClick={() => openNoteStandalone(bn, false)}
                              className="text-base font-bold text-slate-900 leading-snug cursor-pointer hover:text-[#1E3A5F]"
                            >
                              <BidiText text={bn.bookTitle} />
                            </h4>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              <BidiText
                                text={snippet || 'دفتر موضوع عام جاهز للتلخيص...'}
                              />
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openNoteStandalone(bn, false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>فتح الدفتر</span>
                            </button>

                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openNoteStandalone(bn, true)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteNote(bn)}
                                  aria-label={`حذف ${bn.bookTitle}`}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL NOTES CLEAN LIST (Clicking opens Standalone Note Page!) */}
      {subTab === 'all' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `الكل (${hubFilteredNotes.length})` },
                  { id: 'book', label: `كتب (${bookOnlyNotes.length})` },
                  {
                    id: 'course_lecture',
                    label: `كورسات ومحاضرات (${
                      hubFilteredNotes.filter(
                        (n) => n.noteType === 'course_lecture'
                      ).length
                    })`,
                  },
                  { id: 'general', label: `عام (${generalNotes.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full lg:w-auto">
              <div className="relative w-full sm:w-56">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchNotes}
                  onChange={(e) => setSearchNotes(e.target.value)}
                  placeholder="ابحث في النوتس..."
                  className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <select
                aria-label="تصفية حسب الكورس"
                value={courseFilterId}
                onChange={(e) => setCourseFilterId(Number(e.target.value))}
                className="w-full sm:w-auto min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value={0}>كل الكورسات</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <select
                aria-label="تصفية حسب التصنيف"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">كل التصنيفات</option>
                {allCategoryChoices.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <BookOpen
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-800">
                لا توجد ملاحظات مطابقة للتصفية الحالية
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const selectedFiltered = filteredNotes.filter((n) =>
                  selectedExportIds.includes(n.id)
                );
                const allChecked =
                  selectedFiltered.length === filteredNotes.length;
                const bundleTitle =
                  courseFilterId > 0
                    ? courses.find((c) => c.id === courseFilterId)?.title ||
                      'نوتس_مختارة'
                    : 'نوتس_مختارة';
                return (
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleSelectAllInList(filteredNotes)}
                      className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      {allChecked ? (
                        <CheckSquare
                          className="w-4 h-4 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Square
                          className="w-4 h-4 text-slate-400"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {allChecked ? 'إلغاء تحديد الكل' : 'تحديد ملاحظات للتصدير'}
                      </span>
                    </button>

                    {selectedFiltered.length > 0 && (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            exportNotebookBundleAsWord(
                              bundleTitle,
                              selectedFiltered
                            )
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1E3A5F] rounded-lg font-medium cursor-pointer"
                        >
                          Word ({selectedFiltered.length})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            exportNotebookBundleAsMarkdown(
                              bundleTitle,
                              selectedFiltered
                            )
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium cursor-pointer"
                        >
                          .md ({selectedFiltered.length})
                        </button>
                        {showExcelExport && (
                          <button
                            type="button"
                            onClick={() =>
                              exportNotebookBundleAsExcel(
                                bundleTitle,
                                selectedFiltered
                              )
                            }
                            className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#162C49] text-white rounded-lg font-medium cursor-pointer"
                          >
                            Excel ({selectedFiltered.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredNotes.map((bn, idx) => {
                  const isChecked = selectedExportIds.includes(bn.id);
                  const noteType = bn.noteType ?? 'book';
                  const hubMeta = getHubMeta(bn.hubId);
                  const snippet = richHtmlToPlainText(bn.content);
                  const colorTheme = NOTE_COLOR_THEMES[bn.noteColor ?? 'default'] ?? NOTE_COLOR_THEMES.default;
                  return (
                    <article
                      key={bn.id}
                      className={`border rounded-xl overflow-hidden flex flex-col justify-between transition-colors ${colorTheme.cardClass}`}
                    >
                      <div className={`h-1.5 w-full ${colorTheme.accentBarClass}`} />
                      <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                              className={`px-2 py-0.5 rounded border font-semibold ${hubMeta.badgeClass}`}
                            >
                              {hubMeta.shortTitle}
                            </span>
                            <span className="font-semibold text-[#1E3A5F]">
                              {NOTE_TYPE_LABELS[noteType]}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleExportSelection(bn.id)}
                            aria-label={`تحديد ${bn.bookTitle}`}
                            className="text-slate-400 hover:text-[#1E3A5F] cursor-pointer shrink-0"
                          >
                            {isChecked ? (
                              <CheckSquare
                                className="w-4 h-4 text-[#1E3A5F]"
                                aria-hidden="true"
                              />
                            ) : (
                              <Square className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>

                        <h3
                          onClick={() => openNoteStandalone(bn, false)}
                          className="text-base font-bold text-slate-900 leading-snug cursor-pointer hover:text-[#1E3A5F]"
                        >
                          <BidiText text={bn.bookTitle} />
                        </h3>

                        {(bn.courseTitle || bn.author || bn.categoryLabel) && (
                          <p className="text-xs text-slate-500 truncate">
                            {[bn.courseTitle, bn.author, bn.categoryLabel]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          <BidiText
                            text={snippet || 'ملاحظة جاهزة للفتح والتحرير...'}
                          />
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openNoteStandalone(bn, false)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                        >
                          <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>فتح الصفحة</span>
                        </button>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            {notesSortMode === 'manual' && (
                              <>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    handleMoveNoteOrder(filteredNotes, idx, 'up')
                                  }
                                  title="تقديم للأعلى"
                                  aria-label="تقديم الملاحظة"
                                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === filteredNotes.length - 1}
                                  onClick={() =>
                                    handleMoveNoteOrder(filteredNotes, idx, 'down')
                                  }
                                  title="تأخير للأسفل"
                                  aria-label="تأخير الملاحظة"
                                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => openNoteStandalone(bn, true)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteNote(bn)}
                              aria-label={`حذف ${bn.bookTitle}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UNIT SUMMARIES */}
      {subTab === 'units' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-600">
              تصفية ملخصات الوحدات الدراسية:
            </span>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `الكل (${months.length})` },
                  { id: 'written', label: `مكتوب (${writtenCount})` },
                  {
                    id: 'empty',
                    label: `بانتظار التدوين (${months.length - writtenCount})`,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMonthFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    monthFilter === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredMonths.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <PenLine
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-800">
                لا توجد دفاتر مطابقة لهذا التصنيف حاليًا
              </p>
              <p className="text-xs text-slate-500">
                اختر «الكل» لعرض جميع الوحدات والبدء بكتابة ملخصك.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMonths.map((month) => (
                <section
                  key={month.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#1E3A5F] tabular-nums">
                          الوحدة {month.id}
                        </span>
                        {month.foundational.author && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{month.foundational.author}</span>
                          </>
                        )}
                        {month.exploratory.author && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{month.exploratory.author}</span>
                          </>
                        )}
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {month.theme}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ReadAloudButton
                        uid={uid}
                        entityType="month"
                        entityId={`month_${month.id}`}
                        title={`ملخص الوحدة ${month.id}: ${month.theme}`}
                        text={month.notes}
                        voiceName={preferences.readAloudVoice}
                        speed={preferences.readAloudSpeed}
                        disabled={!canEdit}
                        onRequireAuth={onRequireAuth}
                      />
                      <VoiceRecorderButton
                        label="إملاء صوتي"
                        dialect={preferences.voiceDialect}
                        disabled={!canEdit}
                        onRequireAuth={onRequireAuth}
                        onTranscript={(text) => {
                          if (!requireEdit()) return;
                          const prev = month.notes.trim();
                          onUpdateMonthNotes(
                            month.id,
                            prev ? `${prev}\n${text}` : text
                          );
                          onLogVoiceNote?.(`ملخص الوحدة ${month.id}`);
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
                    <span className="font-semibold text-slate-800">
                      سؤال النقاش:
                    </span>{' '}
                    {month.discussionPrompt}
                  </p>

                  <textarea
                    rows={5}
                    aria-label={`ملخص الوحدة ${month.id}`}
                    value={month.notes}
                    readOnly={!canEdit}
                    onClick={() => {
                      if (!canEdit) onRequireAuth();
                    }}
                    onChange={(e) => {
                      if (!requireEdit()) return;
                      onUpdateMonthNotes(month.id, e.target.value);
                    }}
                    placeholder={
                      canEdit
                        ? 'دوّن هنا خلاصة الوحدة كتابة أو عبر زر الإملاء الصوتي...'
                        : 'سجّل الدخول بحساب Google لتدوين ملخص هذه الوحدة...'
                    }
                    className={`w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white leading-relaxed ${
                      !canEdit ? 'cursor-not-allowed' : ''
                    }`}
                  />
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteNote)}
        title="تأكيد حذف الملاحظة"
        message={`هل أنت متأكد من حذف «${confirmDeleteNote?.bookTitle}»؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد الحذف"
        onCancel={() => setConfirmDeleteNote(null)}
        onConfirm={() => {
          if (!confirmDeleteNote) return;
          onDeleteBookNote(confirmDeleteNote.id);
          setConfirmDeleteNote(null);
        }}
      />
    </div>
  );
}
