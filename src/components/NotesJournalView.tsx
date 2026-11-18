import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  GraduationCap,
  Layers,
  Lock,
  PenLine,
  Plus,
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
  HighlightColorKey,
  MonthPlan,
  NoteCategoryType,
  PersonalCourse,
  ReadAloudVoiceName,
  UserPreferences,
  VoiceDialectMode,
  VoiceInsertMode,
} from '../data/curriculumData';
import {
  exportNotebookBundleAsExcel,
  exportNotebookBundleAsMarkdown,
  exportSingleBookNoteAsExcel,
  exportSingleBookNoteAsMarkdown,
} from '../utils/excelExport';
import {
  exportNotebookBundleAsWord,
  exportSingleBookNoteAsWord,
  parseDocumentFile,
} from '../utils/documentImportExport';
import {
  HIGHLIGHT_SWATCHES,
  ensureRichHtml,
  richHtmlToPlainText,
} from '../utils/richText';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import ReadAloudButton from './ReadAloudButton';
import RichTextNoteEditor from './RichTextNoteEditor';
import VoiceRecorderButton from './VoiceRecorderButton';

interface NotesJournalViewProps {
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
  onAddStructuredNote: (payload: {
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

export default function NotesJournalView({
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
  onAddStructuredNote,
  onUpdateBookNote,
  onDeleteBookNote,
  onUpdateMonthNotes,
  onLogVoiceNote,
  onExportExcel,
}: NotesJournalViewProps) {
  const [subTab, setSubTab] = useState<'cards' | 'all' | 'units'>('cards');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [selectedCourseNotebookId, setSelectedCourseNotebookId] = useState<
    number | null
  >(null);
  const [showPrefs, setShowPrefs] = useState(false);

  // Filters for "all" view & search
  const [typeFilter, setTypeFilter] = useState<NoteCategoryType | 'all'>('all');
  const [courseFilterId, setCourseFilterId] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchNotes, setSearchNotes] = useState('');

  // Composer form
  const [showComposer, setShowComposer] = useState(false);
  const [newType, setNewType] = useState<NoteCategoryType>('book');
  const [selectedCurriculumBook, setSelectedCurriculumBook] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number>(
    courses[0]?.id ?? 0
  );
  const [lectureTitle, setLectureTitle] = useState('');
  const [categoryLabel, setCategoryLabel] = useState<string>(
    customCategories[0]?.title ?? ''
  );

  // Inline add lecture inside a Course Notebook
  const [inlineLectureTitle, setInlineLectureTitle] = useState('');

  const [monthFilter, setMonthFilter] = useState<'all' | 'written' | 'empty'>(
    'all'
  );
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  );
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const newNoteFileInputRef = useRef<HTMLInputElement | null>(null);
  const appendFileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Open workspace automatically when another tab jumps to a specific note
  const prevActiveIdRef = useRef<string | null>(activeBookNoteId);
  useEffect(() => {
    if (activeBookNoteId && activeBookNoteId !== prevActiveIdRef.current) {
      const target = bookNotes.find((bn) => bn.id === activeBookNoteId);
      if (target) {
        setIsWorkspaceOpen(true);
        if (target.noteType === 'course_lecture' && (target.courseId ?? 0) > 0) {
          setSelectedCourseNotebookId(target.courseId ?? null);
        } else {
          setSelectedCourseNotebookId(null);
        }
      }
    }
    prevActiveIdRef.current = activeBookNoteId;
  }, [activeBookNoteId, bookNotes]);

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

  const bookOnlyNotes = useMemo(
    () => bookNotes.filter((bn) => (bn.noteType ?? 'book') === 'book'),
    [bookNotes]
  );

  const generalNotes = useMemo(
    () => bookNotes.filter((bn) => bn.noteType === 'general'),
    [bookNotes]
  );

  const unlinkedLectureNotes = useMemo(
    () =>
      bookNotes.filter(
        (bn) =>
          bn.noteType === 'course_lecture' &&
          !(bn.courseId && courses.some((c) => c.id === bn.courseId))
      ),
    [bookNotes, courses]
  );

  const filteredNotes = useMemo(() => {
    const q = searchNotes.trim().toLowerCase();
    return bookNotes.filter((bn) => {
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
  }, [bookNotes, typeFilter, courseFilterId, categoryFilter, searchNotes]);

  const selectedCourse = useMemo(
    () =>
      selectedCourseNotebookId !== null
        ? courses.find((c) => c.id === selectedCourseNotebookId) ?? null
        : null,
    [courses, selectedCourseNotebookId]
  );

  const selectedCourseNotes = useMemo(() => {
    if (selectedCourseNotebookId === null) return [];
    return bookNotes.filter(
      (bn) =>
        bn.noteType === 'course_lecture' &&
        (bn.courseId ?? 0) === selectedCourseNotebookId
    );
  }, [bookNotes, selectedCourseNotebookId]);

  const activeNote = useMemo(() => {
    if (subTab === 'cards' && selectedCourseNotebookId !== null) {
      return (
        selectedCourseNotes.find((bn) => bn.id === activeBookNoteId) ??
        selectedCourseNotes[0] ??
        null
      );
    }
    if (subTab === 'all') {
      return (
        filteredNotes.find((bn) => bn.id === activeBookNoteId) ??
        filteredNotes[0] ??
        null
      );
    }
    return bookNotes.find((bn) => bn.id === activeBookNoteId) ?? null;
  }, [
    subTab,
    selectedCourseNotebookId,
    selectedCourseNotes,
    filteredNotes,
    bookNotes,
    activeBookNoteId,
  ]);

  const filteredMonths = months.filter((m) => {
    const hasNotes = m.notes.trim().length > 0;
    if (monthFilter === 'written') return hasNotes;
    if (monthFilter === 'empty') return !hasNotes;
    return true;
  });

  const writtenCount = months.filter((m) => m.notes.trim().length > 0).length;

  const requireEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const handleOpenCourseNotebook = (course: PersonalCourse) => {
    const courseNotes = bookNotes.filter(
      (bn) => bn.noteType === 'course_lecture' && bn.courseId === course.id
    );
    setSelectedCourseNotebookId(course.id);
    setIsWorkspaceOpen(true);
    setSubTab('cards');
    onSelectBookNote(courseNotes[0]?.id ?? null);
    setConfirmDeleteNoteId(null);
  };

  const handleOpenSingleNotebook = (note: BookNote) => {
    setSelectedCourseNotebookId(null);
    setIsWorkspaceOpen(true);
    setSubTab('cards');
    onSelectBookNote(note.id);
    setConfirmDeleteNoteId(null);
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
    setIsWorkspaceOpen(true);
    setSubTab('cards');
    onAddStructuredNote({
      noteType: 'course_lecture',
      bookTitle: `${course.title} — ${lecTitle}`,
      author: course.bookAuthor || 'محاضر الكورس',
      courseId: course.id,
      courseTitle: course.title,
      lectureTitle: lecTitle,
      categoryLabel: customCategories[0]?.title || 'محاضرات وتطبيق عملي',
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
      setIsWorkspaceOpen(true);
      setShowComposer(false);
      onAddStructuredNote({
        noteType: 'book',
        bookTitle: found.title,
        author: found.author,
        categoryLabel: categoryLabel || 'قراءات تأسيسية',
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
        (lec ? lec : course ? `ملاحظات ${course.title}` : 'ملاحظات محاضرة');
      setSelectedCourseNotebookId(course?.id ?? null);
      setIsWorkspaceOpen(true);
      onAddStructuredNote({
        noteType: 'course_lecture',
        bookTitle: title,
        author: customAuthor.trim() || course?.bookAuthor || 'محاضر الكورس',
        courseId: course?.id ?? 0,
        courseTitle: course?.title ?? '',
        lectureTitle: lec || title,
        categoryLabel: categoryLabel || 'محاضرات وتطبيق عملي',
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
    setIsWorkspaceOpen(true);
    onAddStructuredNote({
      noteType: newType,
      bookTitle: title,
      author:
        customAuthor.trim() ||
        (newType === 'book' ? 'مؤلف / مصدر' : 'موضوع شخصي'),
      courseId: 0,
      courseTitle: '',
      lectureTitle: '',
      categoryLabel: categoryLabel || (newType === 'book' ? 'قراءات تأسيسية' : ''),
    });
    setCustomTitle('');
    setCustomAuthor('');
    setShowComposer(false);
  };

  const insertVoiceIntoRichField = (
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

    const currentHtml = ensureRichHtml(note[field] || '');
    const nextHtml = currentHtml ? `${currentHtml}${snippetHtml}` : snippetHtml;
    onUpdateBookNote(note.id, { [field]: nextHtml });
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
      onAddStructuredNote({
        noteType: targetCourse ? 'course_lecture' : 'book',
        bookTitle: parsed.title,
        author: targetCourse?.bookAuthor || 'مستند مستورد',
        courseId: targetCourse?.id ?? 0,
        courseTitle: targetCourse?.title ?? '',
        lectureTitle: targetCourse ? parsed.title : '',
        categoryLabel: customCategories[0]?.title ?? '',
        initialContent: parsed.html,
      });
      setSelectedCourseNotebookId(targetCourse?.id ?? null);
      setIsWorkspaceOpen(true);
      setImportNotice(`تم استيراد «${file.name}» بنجاح. يمكنك الآن تعديله أو تصديره.`);
    } catch {
      setImportNotice('تعذر قراءة الملف. تأكد أنه بصيغة .docx أو .txt أو .md صالحة.');
    } finally {
      setImportingFile(false);
    }
  };

  const handleAppendFileToNote = async (
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
      const headerHtml = `<p><strong>محتوى مستورد من: ${escapePlainToHtml(file.name)}</strong></p>`;
      const existing = ensureRichHtml(note.content || '');
      const nextHtml = existing
        ? `${existing}${headerHtml}${parsed.html}`
        : `${headerHtml}${parsed.html}`;
      onUpdateBookNote(note.id, { content: nextHtml });
      setImportNotice(`تم إدراج محتوى «${file.name}» داخل الملاحظة.`);
    } catch {
      setImportNotice('تعذر قراءة محتوى الملف المرفق.');
    } finally {
      setImportingFile(false);
    }
  };

  const renderActiveNoteEditor = (note: BookNote) => (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-[#1E3A5F]">
              {NOTE_TYPE_LABELS[note.noteType ?? 'book']}
            </span>
            {note.courseTitle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium">
                  {note.courseTitle}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>آخر تحديث: {note.updatedAt}</span>
          </div>
          <input
            type="text"
            aria-label="عنوان الملاحظة أو الكتاب"
            value={note.bookTitle}
            readOnly={!canEdit}
            onClick={() => {
              if (!canEdit) onRequireAuth();
            }}
            onChange={(e) => {
              if (!requireEdit()) return;
              onUpdateBookNote(note.id, { bookTitle: e.target.value });
            }}
            className="w-full font-editorial text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-[#1E3A5F] focus:outline-none py-0.5"
          />
        </div>

        {canEdit &&
          (confirmDeleteNoteId === note.id ? (
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onDeleteBookNote(note.id);
                  setConfirmDeleteNoteId(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer whitespace-nowrap shrink-0"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteNoteId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteNoteId(note.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حذف الملاحظة</span>
            </button>
          ))}
      </div>

      {/* Organization & Metadata Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="block text-xs font-medium text-slate-600">
          نوع الدفتر
          <select
            value={note.noteType ?? 'book'}
            disabled={!canEdit}
            onChange={(e) => {
              if (!requireEdit()) return;
              onUpdateBookNote(note.id, {
                noteType: e.target.value as NoteCategoryType,
              });
            }}
            className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] disabled:opacity-70"
          >
            <option value="book">ملاحظات كتاب</option>
            <option value="course_lecture">كورس / محاضرة</option>
            <option value="general">موضوع عام</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Tag className="w-3 h-3" aria-hidden="true" />
            <span>التصنيف المخصّص</span>
          </span>
          <select
            value={note.categoryLabel ?? ''}
            disabled={!canEdit}
            onChange={(e) => {
              if (!requireEdit()) return;
              onUpdateBookNote(note.id, { categoryLabel: e.target.value });
            }}
            className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] disabled:opacity-70"
          >
            <option value="">بدون تصنيف</option>
            {customCategories.map((cat) => (
              <option key={cat.id} value={cat.title}>
                {cat.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-600">
          المؤلف / المحاضر
          <input
            type="text"
            value={note.author}
            readOnly={!canEdit}
            onClick={() => {
              if (!canEdit) onRequireAuth();
            }}
            onChange={(e) => {
              if (!requireEdit()) return;
              onUpdateBookNote(note.id, { author: e.target.value });
            }}
            placeholder="اسم المؤلف أو المحاضر..."
            className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
          />
        </label>

        {(note.noteType ?? 'book') === 'course_lecture' && (
          <>
            <label className="block text-xs font-medium text-slate-600">
              الكورس المرتبط
              <select
                value={note.courseId ?? 0}
                disabled={!canEdit}
                onChange={(e) => {
                  if (!requireEdit()) return;
                  const cid = Number(e.target.value);
                  const c = courses.find((item) => item.id === cid);
                  onUpdateBookNote(note.id, {
                    courseId: cid,
                    courseTitle: c?.title ?? '',
                  });
                }}
                className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] disabled:opacity-70"
              >
                <option value={0}>كورس خارجي</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              اسم / رقم المحاضرة
              <input
                type="text"
                value={note.lectureTitle ?? ''}
                readOnly={!canEdit}
                onClick={() => {
                  if (!canEdit) onRequireAuth();
                }}
                onChange={(e) => {
                  if (!requireEdit()) return;
                  onUpdateBookNote(note.id, { lectureTitle: e.target.value });
                }}
                placeholder="مثلاً: المحاضرة الثانية"
                className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />
            </label>
          </>
        )}

        <label className="block text-xs font-medium text-slate-600">
          موضع القراءة / الدقيقة
          <input
            type="text"
            value={note.progressMarker}
            readOnly={!canEdit}
            onClick={() => {
              if (!canEdit) onRequireAuth();
            }}
            onChange={(e) => {
              if (!requireEdit()) return;
              onUpdateBookNote(note.id, { progressMarker: e.target.value });
            }}
            placeholder="مثلاً: الفصل 3 — ص 85 أو د 14:20"
            className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
          />
        </label>
      </div>

      {/* Main Rich Text Editor + Voice + Read Aloud */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">
            النوتس والأفكار المستخلصة (شريط التنسيق الكامل + صوت)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={appendFileInputRef}
              type="file"
              accept=".docx,.doc,.txt,.md,.markdown"
              className="hidden"
              onChange={(e) => void handleAppendFileToNote(e, note)}
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
              <span>{importingFile ? 'جاري الاستيراد...' : 'استيراد Word / نص'}</span>
            </button>
            <ReadAloudButton
              text={richHtmlToPlainText(note.content)}
              voiceName={preferences.readAloudVoice}
              speed={preferences.readAloudSpeed}
              disabled={!canEdit}
              onRequireAuth={onRequireAuth}
            />
            <VoiceRecorderButton
              label="تسجيل نوت بالصوت"
              dialect={preferences.voiceDialect}
              disabled={!canEdit}
              onRequireAuth={onRequireAuth}
              onTranscript={(text) =>
                insertVoiceIntoRichField(note, 'content', text)
              }
            />
          </div>
        </div>

        <RichTextNoteEditor
          noteKey={note.id}
          value={note.content}
          onChange={(html) => {
            if (!canEdit) return;
            onUpdateBookNote(note.id, { content: html });
          }}
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
          preferences={preferences}
          onSelectDefaultHighlight={(color) => {
            if (canEdit) onUpdatePreferences({ noteHighlightColor: color });
          }}
          minHeightClass="min-h-[240px]"
        />

        <ImageAttachmentGallery
          scopeKey={`note:${note.id}`}
          title="الصور والمخططات المرفقة بهذه الملاحظة (صورة أو أكثر)"
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
        />
      </div>

      {/* Quotes & Discussion Points Rich Editor + Voice */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">
            اقتباسات مهمة أو أسئلة للنقاش
          </span>
          <VoiceRecorderButton
            label="سؤال نقاشي بالصوت"
            dialect={preferences.voiceDialect}
            disabled={!canEdit}
            onRequireAuth={onRequireAuth}
            onTranscript={(text) =>
              insertVoiceIntoRichField(note, 'quotes', text)
            }
          />
        </div>

        <RichTextNoteEditor
          noteKey={`${note.id}-quotes`}
          value={note.quotes}
          onChange={(html) => {
            if (!canEdit) return;
            onUpdateBookNote(note.id, { quotes: html });
          }}
          placeholder="أضف اقتباسًا مهمًا أو سؤالاً للنقاش مع إمكانية التظليل والنقاط..."
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
          preferences={preferences}
          onSelectDefaultHighlight={(color) => {
            if (canEdit) onUpdatePreferences({ noteHighlightColor: color });
          }}
          minHeightClass="min-h-[120px]"
        />
      </div>

      {/* Per-Note Download Actions */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          تحميل هذا الدفتر فقط في ملف مستقل:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportSingleBookNoteAsWord(note)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>تحميل ملف Word (.doc)</span>
          </button>
          <button
            type="button"
            onClick={() => exportSingleBookNoteAsMarkdown(note)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>ملف نصي (.md)</span>
          </button>
          <button
            type="button"
            onClick={() => exportSingleBookNoteAsExcel(note)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>ملف Excel (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Header + Mode Switch + Preferences Toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            دفاتر التلخيص المستقلة · محرر منسّق (عريض، نقاط، تظليل) · الصوت والقراءة
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            دفتر التلخيص والنوتس
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            لكل كورس ولكل كتاب دفتر تلخيص مستقل في بطاقات منظّمة، مع شريط تنسيق احترافي وإملاء صوتي مخصّص وفق تفضيلات حسابك.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('cards')}
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
              onClick={() => setSubTab('all')}
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
              onClick={() => setSubTab('units')}
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

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Collapsible Personalization Drawer: Notes & Voice Preferences */}
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
                <span>سجّل الدخول بحساب Google لحفظ تخصيصات النوتس والصوت على حسابك.</span>
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
            {/* Notes Customization */}
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

            {/* Voice & Audio Customization */}
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

      {/* TAB 1: CARD-BASED NOTEBOOK HUB OR FOCUSED WORKSPACE */}
      {subTab === 'cards' && (
        <div className="space-y-6">
          {isWorkspaceOpen ? (
            <div className="space-y-5">
              {/* Breadcrumb Back Bar */}
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsWorkspaceOpen(false);
                    setSelectedCourseNotebookId(null);
                    setConfirmDeleteNoteId(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>العودة إلى بطاقات دفاتر التلخيص</span>
                </button>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  {selectedCourse ? (
                    <>
                      <GraduationCap className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
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
                        </div>
                      )}
                    </>
                  ) : activeNote ? (
                    <>
                      <BookOpen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                      <span className="font-semibold text-slate-900">
                        {activeNote.bookTitle}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {selectedCourse ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Course Notebook Lectures Sidebar */}
                  <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">
                          محاضرات وملخصات الكورس
                        </h2>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {selectedCourseNotes.length}
                        </span>
                      </div>

                      {selectedCourseNotes.length > 0 && (() => {
                        const selectedInCourse = selectedCourseNotes.filter((n) =>
                          selectedExportIds.includes(n.id)
                        );
                        const allChecked =
                          selectedInCourse.length === selectedCourseNotes.length;
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                toggleSelectAllInList(selectedCourseNotes)
                              }
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                            >
                              {allChecked ? (
                                <CheckSquare
                                  className="w-3.5 h-3.5 text-[#1E3A5F]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Square
                                  className="w-3.5 h-3.5 text-slate-400"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {allChecked ? 'إلغاء تحديد الكل' : 'تحديد للتصدير'}
                              </span>
                            </button>

                            {selectedInCourse.length > 0 && (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    exportNotebookBundleAsMarkdown(
                                      `${selectedCourse.title}_مختارات`,
                                      selectedInCourse
                                    )
                                  }
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium cursor-pointer"
                                >
                                  .md ({selectedInCourse.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    exportNotebookBundleAsExcel(
                                      `${selectedCourse.title}_مختارات`,
                                      selectedInCourse
                                    )
                                  }
                                  className="px-2 py-1 bg-[#1E3A5F] hover:bg-[#162C49] text-white rounded font-medium cursor-pointer"
                                >
                                  تصدير المحدد ({selectedInCourse.length})
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {canEdit && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleQuickAddCourseLecture(
                              selectedCourse,
                              inlineLectureTitle
                            );
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={inlineLectureTitle}
                            onChange={(e) => setInlineLectureTitle(e.target.value)}
                            placeholder="اسم المحاضرة الجديدة..."
                            className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>إضافة</span>
                          </button>
                        </form>
                      )}
                    </div>

                    {selectedCourseNotes.length === 0 ? (
                      <div className="p-6 text-center space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          لا توجد محاضرات مسجّلة في دفتر هذا الكورس بعد.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleQuickAddCourseLecture(selectedCourse)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>ابدأ تلخيص المحاضرة 1</span>
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 max-h-[560px] overflow-y-auto">
                        {selectedCourseNotes.map((bn) => {
                          const isSelected = activeNote?.id === bn.id;
                          const isChecked = selectedExportIds.includes(bn.id);
                          return (
                            <div
                              key={bn.id}
                              className={`flex items-start gap-2.5 px-4 py-3.5 transition-colors ${
                                isSelected
                                  ? 'bg-slate-100/90'
                                  : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExportSelection(bn.id)}
                                aria-label={`تحديد ${bn.bookTitle} للتصدير`}
                                className="mt-0.5 text-slate-400 hover:text-[#1E3A5F] cursor-pointer shrink-0"
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
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectBookNote(bn.id);
                                  setConfirmDeleteNoteId(null);
                                }}
                                className={`flex-1 min-w-0 text-right cursor-pointer space-y-1 ${
                                  isSelected ? 'font-semibold' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-[#1E3A5F]">
                                    {bn.lectureTitle || 'محاضرة'}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {bn.updatedAt}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {bn.bookTitle}
                                </p>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Active Lecture Editor */}
                  <div className="lg:col-span-8">
                    {activeNote ? (
                      renderActiveNoteEditor(activeNote)
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                        <GraduationCap
                          className="w-8 h-8 text-slate-300 mx-auto"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-slate-900">
                          دفتر تلخيص «{selectedCourse.title}» جاهز
                        </p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                          أضف أول محاضرة أو ملخص تطبيقي لهذا الكورس لتدوينه بالخط العريض والنقاط والتظليل أو بالإملاء الصوتي.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleQuickAddCourseLecture(selectedCourse)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إنشاء أول محاضرة في الدفتر</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeNote ? (
                renderActiveNoteEditor(activeNote)
              ) : null}
            </div>
          ) : (
            /* NOTEBOOK HUB CARDS */
            <div className="space-y-8">
              {/* Quick Create Trigger + Collapsible Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-semibold text-slate-900">
                      مكتبة دفاتر التلخيص ({courses.length} كورس · {bookOnlyNotes.length} كتاب · {generalNotes.length} عام)
                    </h2>
                    <p className="text-xs text-slate-500">
                      افتح أي بطاقة للوصول إلى دفتر التلخيص المستقل الخاص بها، أو أنشئ دفترًا جديدًا لكتاب أو محاضرة.
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
                      <span>{showComposer ? 'إخفاء نموذج الإضافة' : 'إضافة دفتر تلخيص جديد'}</span>
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
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(
                        [
                          { id: 'book', label: 'كتاب', Icon: BookOpen },
                          { id: 'course_lecture', label: 'كورس / محاضرة', Icon: GraduationCap },
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

                    {newType === 'book' && (
                      <div className="pb-2">
                        <label
                          htmlFor="pick-curriculum-book"
                          className="block text-xs font-medium text-slate-600 mb-1.5"
                        >
                          اختيار سريع لكتاب من خطة الدراسة:
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
                            <span>اسم / رقم المحاضرة</span>
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
                              ? 'اسم الكتاب'
                              : 'عنوان الدفتر / الموضوع'}
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
                            ? 'المؤلف'
                            : newType === 'course_lecture'
                            ? 'المحاضر (اختياري)'
                            : 'المرجع (اختياري)'}
                        </span>
                        <input
                          type="text"
                          value={customAuthor}
                          onChange={(e) => setCustomAuthor(e.target.value)}
                          placeholder="الاسم..."
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
                        <span>التصنيف المخصّص</span>
                        <select
                          value={categoryLabel}
                          onChange={(e) => setCategoryLabel(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                        >
                          <option value="">بدون تصنيف</option>
                          {customCategories.map((cat) => (
                            <option key={cat.id} value={cat.title}>
                              {cat.title}
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
                          <span>إنشاء الدفتر</span>
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
                      دفاتر تلخيص الكورسات ({courses.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    لكل كورس دفتر مستقل بمحاضراته وتطبيقاته
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course, idx) => {
                    const cNotes = bookNotes.filter(
                      (bn) =>
                        bn.noteType === 'course_lecture' &&
                        bn.courseId === course.id
                    );
                    const latest = cNotes[0];
                    const snippet = latest
                      ? richHtmlToPlainText(latest.content)
                      : '';

                    return (
                      <article
                        key={course.docId || course.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-[#1E3A5F] tabular-nums">
                              دفتر كورس {idx + 1} · {course.category}
                            </span>
                            <span className="tabular-nums font-medium text-slate-700">
                              {cNotes.length} محاضرات
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-slate-900 leading-snug">
                            {course.title}
                          </h4>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {snippet
                              ? snippet
                              : `المرجع المكمّل: ${course.complementaryBook || 'غير محدد'}`}
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

                            {cNotes.length > 0 && (
                              <button
                                type="button"
                                title="تصدير جميع ملاحظات هذا الكورس إلى Excel"
                                onClick={() =>
                                  exportNotebookBundleAsExcel(course.title, cNotes)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>تصدير</span>
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
                    بطاقة مستقلة لكل كتاب وملاحظاته واقتباساته
                  </span>
                </div>

                {bookOnlyNotes.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    لا توجد دفاتر كتب مضافة بعد. اضغط «إضافة دفتر تلخيص جديد» لبدء دفتر لكتابك.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bookOnlyNotes.map((bn) => {
                      const snippet = richHtmlToPlainText(bn.content);
                      return (
                        <article
                          key={bn.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-emerald-800">
                                {bn.categoryLabel || 'دفتر كتاب'}
                              </span>
                              <span>{bn.updatedAt}</span>
                            </div>

                            <h4 className="text-base font-bold text-slate-900 leading-snug">
                              {bn.bookTitle}
                            </h4>

                            <p className="text-xs text-slate-500">
                              {bn.author || 'مؤلف غير محدد'}
                              {bn.progressMarker ? ` · ${bn.progressMarker}` : ''}
                            </p>

                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {snippet || 'دفتر جاهز للتدوين وتلخيص الفصول...'}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenSingleNotebook(bn)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>فتح الدفتر</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => exportSingleBookNoteAsMarkdown(bn)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>.md</span>
                            </button>
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
                      return (
                        <article
                          key={bn.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-[#1E3A5F]">
                                {NOTE_TYPE_LABELS[bn.noteType ?? 'general']}
                              </span>
                              <span>{bn.updatedAt}</span>
                            </div>
                            <h4 className="text-base font-bold text-slate-900 leading-snug">
                              {bn.bookTitle}
                            </h4>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {snippet || 'دفتر موضوع عام جاهز للتلخيص...'}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenSingleNotebook(bn)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>فتح الدفتر</span>
                            </button>
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

      {/* TAB 2: ALL NOTES FILTERABLE LIST + WORKSPACE */}
      {subTab === 'all' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `الكل (${bookNotes.length})` },
                  { id: 'book', label: `كتب (${bookOnlyNotes.length})` },
                  {
                    id: 'course_lecture',
                    label: `كورسات ومحاضرات (${
                      bookNotes.filter((n) => n.noteType === 'course_lecture')
                        .length
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

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchNotes}
                  onChange={(e) => setSearchNotes(e.target.value)}
                  placeholder="ابحث في النوتس..."
                  className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <select
                aria-label="تصفية حسب الكورس"
                value={courseFilterId}
                onChange={(e) => setCourseFilterId(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value={0}>كل الكورسات</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <select
                aria-label="تصفية حسب التصنيف المخصص"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">كل التصنيفات</option>
                {customCategories.map((cat) => (
                  <option key={cat.id} value={cat.title}>
                    {cat.title}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900">
                      الملاحظات المرتّبة
                    </h2>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {filteredNotes.length}
                    </span>
                  </div>

                  {filteredNotes.length > 0 && (() => {
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
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => toggleSelectAllInList(filteredNotes)}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                        >
                          {allChecked ? (
                            <CheckSquare
                              className="w-3.5 h-3.5 text-[#1E3A5F]"
                              aria-hidden="true"
                            />
                          ) : (
                            <Square
                              className="w-3.5 h-3.5 text-slate-400"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {allChecked ? 'إلغاء تحديد الكل' : 'تحديد نوتس للتصدير'}
                          </span>
                        </button>

                        {selectedFiltered.length > 0 && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                exportNotebookBundleAsMarkdown(
                                  bundleTitle,
                                  selectedFiltered
                                )
                              }
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium cursor-pointer"
                            >
                              .md ({selectedFiltered.length})
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                exportNotebookBundleAsExcel(
                                  bundleTitle,
                                  selectedFiltered
                                )
                              }
                              className="px-2 py-1 bg-[#1E3A5F] hover:bg-[#162C49] text-white rounded font-medium cursor-pointer"
                            >
                              تصدير ({selectedFiltered.length})
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="divide-y divide-slate-200 max-h-[650px] overflow-y-auto">
                  {filteredNotes.map((bn) => {
                    const isSelected = activeNote?.id === bn.id;
                    const isChecked = selectedExportIds.includes(bn.id);
                    const noteType = bn.noteType ?? 'book';
                    return (
                      <div
                        key={bn.id}
                        className={`flex items-start gap-2.5 px-4 py-4 transition-colors ${
                          isSelected
                            ? 'bg-slate-100/90'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExportSelection(bn.id)}
                          aria-label={`تحديد ${bn.bookTitle} للتصدير`}
                          className="mt-1 text-slate-400 hover:text-[#1E3A5F] cursor-pointer shrink-0"
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
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBookNote(bn.id);
                            setConfirmDeleteNoteId(null);
                          }}
                          className={`flex-1 min-w-0 text-right cursor-pointer space-y-1.5 ${
                            isSelected ? 'font-semibold' : ''
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                            <span className="text-[#1E3A5F]">
                              {NOTE_TYPE_LABELS[noteType]}
                            </span>
                            {bn.courseTitle && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="text-emerald-700 truncate max-w-[160px]">
                                  {bn.courseTitle}
                                </span>
                              </>
                            )}
                            {bn.categoryLabel && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="text-slate-500">
                                  {bn.categoryLabel}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {bn.bookTitle}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            {bn.lectureTitle && <span>{bn.lectureTitle}</span>}
                            {bn.lectureTitle && bn.author && (
                              <span aria-hidden="true">·</span>
                            )}
                            <span>{bn.author || 'غير محدد'}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeNote && (
                <div className="lg:col-span-8">
                  {renderActiveNoteEditor(activeNote)}
                </div>
              )}
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
                        <span aria-hidden="true">·</span>
                        <span>{month.foundational.author}</span>
                        <span aria-hidden="true">·</span>
                        <span>{month.exploratory.author}</span>
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {month.theme}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ReadAloudButton
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
    </div>
  );
}
