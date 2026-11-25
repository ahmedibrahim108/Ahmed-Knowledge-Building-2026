import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  FileUp,
  Headphones,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Repeat,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  BookNote,
  CustomCategory,
  LEARNING_HUBS,
  LearningHubId,
  MonthPlan,
  NOTE_COLOR_THEMES,
  NoteCategoryType,
  NoteColorKey,
  PersonalCourse,
  SPACED_REPETITION_INTERVALS,
  UserPreferences,
  addDaysToDateKey,
  getHubMeta,
  getTodayDateKey,
} from '../data/curriculumData';
import {
  exportSingleBookNoteAsWord,
  parseDocumentFile,
} from '../utils/documentImportExport';
import {
  exportSingleBookNoteAsExcel,
  exportSingleBookNoteAsMarkdown,
} from '../utils/excelExport';
import {
  ensureRichHtml,
  getNoteLayoutClasses,
  renderSafeBidiHtml,
  richHtmlToPlainText,
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

interface FocusNoteStudyModalProps {
  note: BookNote | null;
  startInEdit?: boolean;
  uid?: string | null;
  canEdit: boolean;
  preferences: UserPreferences;
  months: MonthPlan[];
  courses: PersonalCourse[];
  customCategories: CustomCategory[];
  hubCategories?: Record<LearningHubId, string[]>;
  showExcelExport?: boolean;
  onClose: () => void;
  onRequireAuth: () => void;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onUpdateBookNote: (id: string, updates: Partial<BookNote>) => void;
  onDeleteBookNote: (id: string) => void;
  onOpenPdf?: (target: ActivePdfTarget) => void;
  onLogVoiceNote?: (noteTitle: string) => void;
}

interface MainDraftState {
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

function buildMainDraft(note: BookNote): MainDraftState {
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
  };
}

export default function FocusNoteStudyModal({
  note,
  startInEdit = false,
  uid,
  canEdit,
  preferences,
  months,
  courses,
  customCategories,
  hubCategories,
  showExcelExport = true,
  onClose,
  onRequireAuth,
  onUpdatePreferences,
  onUpdateBookNote,
  onDeleteBookNote,
  onOpenPdf,
  onLogVoiceNote,
}: FocusNoteStudyModalProps) {
  const [isEditingMain, setIsEditingMain] = useState(startInEdit);
  const [mainDraft, setMainDraft] = useState<MainDraftState | null>(null);
  const [discussionDraft, setDiscussionDraft] = useState<string>('');
  const [quickMainCapture, setQuickMainCapture] = useState<string>('');
  const [companionOpen, setCompanionOpen] = useState<boolean>(true);
  const [companionTab, setCompanionTab] = useState<'discussion' | 'repetition'>(
    'discussion'
  );
  const [mobilePane, setMobilePane] = useState<
    'note' | 'discussion' | 'repetition'
  >('note');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [studyFeedback, setStudyFeedback] = useState<string | null>(null);
  const [discussionSavedNotice, setDiscussionSavedNotice] = useState<
    string | null
  >(null);
  const [importingFile, setImportingFile] = useState(false);

  const appendFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeNoteIdRef = useRef<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const noteLayout = getNoteLayoutClasses(preferences);
  const today = getTodayDateKey();

  // Sync draft state only when switching to a different note ID
  useEffect(() => {
    if (!note) {
      activeNoteIdRef.current = null;
      setMainDraft(null);
      setIsEditingMain(false);
      setShowExportMenu(false);
      setConfirmDeleteOpen(false);
      return;
    }
    if (activeNoteIdRef.current !== note.id) {
      activeNoteIdRef.current = note.id;
      setMainDraft(buildMainDraft(note));
      setDiscussionDraft(note.quotes ?? '');
      setIsEditingMain(Boolean(startInEdit && canEdit));
      setQuickMainCapture('');
      setStudyFeedback(null);
      setDiscussionSavedNotice(null);
      setShowExportMenu(false);
      setConfirmDeleteOpen(false);
      setMobilePane('note');
    }
  }, [note, startInEdit, canEdit]);

  // Keep discussionDraft updated if saved externally and user hasn't modified it locally
  const serverQuotes = note?.quotes ?? '';
  const discussionDirty = note ? discussionDraft !== serverQuotes : false;

  // Lock page scroll behind blurred backdrop
  useEffect(() => {
    if (!note || typeof document === 'undefined') return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevHtmlOverscroll = htmlEl.style.overscrollBehavior;
    const prevBodyOverscroll = bodyEl.style.overscrollBehavior;
    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    htmlEl.style.overscrollBehavior = 'none';
    bodyEl.style.overscrollBehavior = 'none';
    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      htmlEl.style.overscrollBehavior = prevHtmlOverscroll;
      bodyEl.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [Boolean(note)]);

  // Escape key closes modal (when confirm dialog is not open)
  useEffect(() => {
    if (!note) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDeleteOpen) {
          setConfirmDeleteOpen(false);
          return;
        }
        if (showExportMenu) {
          setShowExportMenu(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [note, confirmDeleteOpen, showExportMenu, onClose]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const linkedCourse = useMemo(() => {
    if (!note?.courseId) return null;
    return courses.find((c) => c.id === note.courseId) ?? null;
  }, [note?.courseId, courses]);

  const relatedMonth = useMemo(() => {
    if (!linkedCourse) {
      if (!note) return null;
      const normalizedTitle = note.bookTitle.trim().toLowerCase();
      return (
        months.find(
          (m) =>
            m.foundational.title.trim().toLowerCase() === normalizedTitle ||
            m.exploratory.title.trim().toLowerCase() === normalizedTitle
        ) ?? null
      );
    }
    const linkedMonthId = linkedCourse.linkedMonths?.[0];
    if (linkedMonthId) {
      const m = months.find((item) => item.id === linkedMonthId);
      if (m) return m;
    }
    return months.find((m) => m.courseId === linkedCourse.id) ?? null;
  }, [linkedCourse, months, note]);

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

  if (!note) return null;

  const activeDraft = mainDraft ?? buildMainDraft(note);
  const activeHubMeta = getHubMeta(
    isEditingMain ? activeDraft.hubId : note.hubId
  );
  const activeColorKey: NoteColorKey = isEditingMain
    ? activeDraft.noteColor
    : note.noteColor ?? 'default';
  const activeColorTheme =
    NOTE_COLOR_THEMES[activeColorKey] ?? NOTE_COLOR_THEMES.default;

  const reviewCount = note.reviewCount ?? 0;
  const listenCount = note.listenCount ?? 0;
  const repetitionStage = note.repetitionStage ?? 0;
  const nextReviewDateKey = note.nextReviewDateKey ?? '';
  const isDueToday = Boolean(nextReviewDateKey) && nextReviewDateKey <= today;
  const nextIntervalDays =
    SPACED_REPETITION_INTERVALS[
      Math.min(repetitionStage, SPACED_REPETITION_INTERVALS.length - 1)
    ];

  const showTimedFeedback = (msg: string) => {
    setStudyFeedback(msg);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      setStudyFeedback(null);
    }, 3500);
  };

  const requireEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth();
      return false;
    }
    return true;
  };

  const formatVoiceSnippet = (transcript: string): string => {
    let formattedText = escapePlainToHtml(transcript.trim());
    if (preferences.autoAddTimestampOnVoice) {
      const stamp = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      formattedText = `<strong>[${stamp}]</strong> ${formattedText}`;
    }
    if (preferences.voiceInsertMode === 'append_bullet') {
      return `<ul><li>${formattedText}</li></ul>`;
    }
    if (preferences.voiceInsertMode === 'append_quote') {
      return `<blockquote>${formattedText}</blockquote>`;
    }
    return `<p>${formattedText}</p>`;
  };

  const handleSaveMainDraft = () => {
    if (!requireEdit() || !mainDraft) return;
    const cleanTitle = mainDraft.bookTitle.trim() || note.bookTitle;
    const selectedCourseObj = courses.find((c) => c.id === mainDraft.courseId);
    onUpdateBookNote(note.id, {
      bookTitle: cleanTitle,
      hubId: mainDraft.hubId,
      noteType: mainDraft.noteType,
      noteColor: mainDraft.noteColor,
      categoryLabel: mainDraft.categoryLabel.trim(),
      author: mainDraft.author.trim(),
      courseId: mainDraft.courseId,
      courseTitle:
        mainDraft.courseId > 0
          ? selectedCourseObj?.title ?? mainDraft.courseTitle
          : '',
      lectureTitle: mainDraft.lectureTitle.trim(),
      progressMarker: mainDraft.progressMarker.trim(),
      content: mainDraft.content,
    });
    setIsEditingMain(false);
    showTimedFeedback('تم حفظ تعديلات الملاحظة.');
  };

  const handleSaveDiscussion = () => {
    if (!requireEdit()) return;
    onUpdateBookNote(note.id, { quotes: discussionDraft });
    setDiscussionSavedNotice('تم حفظ ملاحظات النقاش.');
    window.setTimeout(() => setDiscussionSavedNotice(null), 3000);
  };

  const handleAppendQuickMainNote = (rawText: string) => {
    if (!requireEdit()) return;
    const clean = rawText.trim();
    if (!clean) return;
    const snippet = formatVoiceSnippet(clean);
    const base = isEditingMain ? activeDraft.content : note.content;
    const existing = ensureRichHtml(base || '');
    const nextHtml = existing ? `${existing}${snippet}` : snippet;
    if (isEditingMain && mainDraft) {
      setMainDraft({ ...mainDraft, content: nextHtml });
    } else {
      onUpdateBookNote(note.id, { content: nextHtml });
    }
    setQuickMainCapture('');
    showTimedFeedback('تمت إضافة النقطة إلى متن الملاحظة.');
  };

  const handleQuickSpacedReview = () => {
    if (!requireEdit()) return;
    const nextStage = Math.min(
      repetitionStage + 1,
      SPACED_REPETITION_INTERVALS.length - 1
    );
    const nextDate = addDaysToDateKey(today, nextIntervalDays);
    onUpdateBookNote(note.id, {
      reviewCount: reviewCount + 1,
      repetitionStage: nextStage,
      lastReviewedDateKey: today,
      nextReviewDateKey: nextDate,
    });
    showTimedFeedback(
      `سُجّلت الإعادة الآن · المراجعة القادمة بعد ${nextIntervalDays} ${
        nextIntervalDays === 1 ? 'يوم' : 'أيام'
      } (${nextDate}).`
    );
  };

  const handleQuickIncrementListen = () => {
    if (!requireEdit()) return;
    onUpdateBookNote(note.id, { listenCount: listenCount + 1 });
    showTimedFeedback(`تم تسجيل السماع (${listenCount + 1}×).`);
  };

  const handleAppendFileToMain = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!requireEdit()) return;

    setImportingFile(true);
    try {
      const parsed = await parseDocumentFile(file);
      const headerHtml = `<p><strong>محتوى مستورد من: ${escapePlainToHtml(
        file.name
      )}</strong></p>`;
      const base = isEditingMain ? activeDraft.content : note.content;
      const existing = ensureRichHtml(base || '');
      const nextHtml = existing
        ? `${existing}${headerHtml}${parsed.html}`
        : `${headerHtml}${parsed.html}`;
      if (isEditingMain && mainDraft) {
        setMainDraft({ ...mainDraft, content: nextHtml });
      } else {
        onUpdateBookNote(note.id, { content: nextHtml });
      }
      showTimedFeedback(`تم إدراج محتوى «${file.name}» في الملاحظة.`);
    } catch {
      showTimedFeedback('تعذر قراءة الملف المرفق.');
    } finally {
      setImportingFile(false);
    }
  };

  const discussionPromptText =
    relatedMonth?.discussionPrompt?.trim() ||
    linkedCourse?.applicationMilestone?.trim() ||
    relatedMonth?.applicationTask?.trim() ||
    '';

  const metadataSegments = [
    activeHubMeta.shortTitle,
    NOTE_TYPE_LABELS[activeDraft.noteType],
    note.categoryLabel || '',
    note.courseTitle || '',
    note.lectureTitle || '',
    note.progressMarker || '',
    note.updatedAt ? `تحديث: ${note.updatedAt}` : '',
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 transition-opacity overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={`وضع المذاكرة المركّز: ${note.bookTitle}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1220px] max-h-[92dvh] h-[92dvh] bg-[#FAFBFD] rounded-2xl border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden overscroll-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Distraction-Free Top Bar */}
        <header className="bg-white border-b border-slate-200/90 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              {metadataSegments.join(' · ')}
            </p>
            <h2 className="font-editorial text-lg sm:text-xl font-bold text-slate-900 truncate">
              <BidiText text={note.bookTitle} />
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Reading Width Toggle */}
            {!isEditingMain && (
              <div className="hidden md:inline-flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[11px]">
                {(
                  [
                    { id: 'focused', label: 'مريح' },
                    { id: 'balanced', label: 'متوازن' },
                    { id: 'full', label: 'كامل' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onUpdatePreferences({ noteWidth: opt.id })}
                    title={
                      opt.id === 'focused'
                        ? 'عمود قراءة مريح (~12 كلمة في السطر)'
                        : opt.id === 'balanced'
                        ? 'عرض متوازن'
                        : 'عرض كامل'
                    }
                    className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-60 ${
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

            {/* Desktop Toggle Companion Rail */}
            <button
              type="button"
              onClick={() => setCompanionOpen((v) => !v)}
              className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                companionOpen
                  ? 'bg-slate-100 border-slate-300 text-[#1E3A5F]'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={
                companionOpen
                  ? 'إخفاء لوحة النقاش والمراجعة للقراءة المنفردة'
                  : 'إظهار لوحة النقاش وأخذ الملاحظات والمراجعة'
              }
            >
              {companionOpen ? (
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{companionOpen ? 'تركيز فردي' : 'النقاش والمراجعة'}</span>
            </button>

            {canEdit && !isEditingMain && (
              <button
                type="button"
                onClick={() => {
                  setMainDraft(buildMainDraft(note));
                  setIsEditingMain(true);
                  setMobilePane('note');
                }}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تعديل المتن</span>
              </button>
            )}

            {canEdit && isEditingMain && (
              <>
                <button
                  type="button"
                  onClick={handleSaveMainDraft}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>حفظ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMainDraft(buildMainDraft(note));
                    setIsEditingMain(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>إلغاء</span>
                </button>
              </>
            )}

            {/* Export Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                aria-expanded={showExportMenu}
                aria-label="خيارات التصدير"
                title="تصدير الملاحظة"
                className="inline-flex items-center justify-center p-2 min-h-[38px] min-w-[38px] text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-30 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      exportSingleBookNoteAsWord(note);
                      setShowExportMenu(false);
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>تصدير Word (.doc)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportSingleBookNoteAsMarkdown(note);
                      setShowExportMenu(false);
                    }}
                    className="w-full text-right px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>تصدير نصي (.md)</span>
                  </button>
                  {showExcelExport && (
                    <button
                      type="button"
                      onClick={() => {
                        exportSingleBookNoteAsExcel(note);
                        setShowExportMenu(false);
                      }}
                      className="w-full text-right px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                      <span>تصدير Excel (.xlsx)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="حذف الملاحظة"
                title="حذف الملاحظة"
                className="inline-flex items-center justify-center p-2 min-h-[38px] min-w-[38px] text-slate-500 hover:text-red-700 bg-white border border-slate-200 hover:bg-red-50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق وضع التركيز"
              title="إغلاق (Esc)"
              className="inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[38px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">إغلاق</span>
            </button>
          </div>
        </header>

        {/* Desktop Persistent Study Audio + Repetition Control Bar */}
        <div className="hidden lg:flex bg-white/95 border-b border-slate-200 px-6 py-2.5 flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReadAloudButton
              uid={uid}
              entityType={
                note.noteType === 'course_lecture' ? 'course' : 'note'
              }
              entityId={note.id}
              title={note.bookTitle}
              text={richHtmlToPlainText(
                isEditingMain ? activeDraft.content : note.content
              )}
              voiceName={preferences.readAloudVoice}
              speed={preferences.readAloudSpeed}
              disabled={!canEdit}
              onRequireAuth={onRequireAuth}
            />

            <button
              type="button"
              onClick={handleQuickIncrementListen}
              title="تسجيل مرة سماع إضافية"
              className="inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[38px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Headphones className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span className="tabular-nums">+1 سماع ({listenCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-slate-600 tabular-nums">
              المراجعة: {reviewCount}×
              {isDueToday
                ? ' · مستحق اليوم'
                : nextReviewDateKey
                ? ` · القادمة: ${nextReviewDateKey}`
                : ''}
            </span>
            <button
              type="button"
              onClick={handleQuickSpacedReview}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                isDueToday
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إعادة / تمت المراجعة الآن</span>
            </button>
          </div>
        </div>

        {/* Transient Feedback Banner */}
        {studyFeedback && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>{studyFeedback}</span>
            </span>
            <button
              type="button"
              onClick={() => setStudyFeedback(null)}
              className="text-[11px] font-semibold hover:underline cursor-pointer"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Mobile View Switcher (< lg) */}
        <div className="lg:hidden grid grid-cols-3 bg-white border-b border-slate-200 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobilePane('note')}
            className={`py-2.5 min-h-[42px] border-b-2 transition-colors cursor-pointer ${
              mobilePane === 'note'
                ? 'border-[#1E3A5F] text-[#1E3A5F] bg-slate-50/70'
                : 'border-transparent text-slate-600'
            }`}
          >
            المذاكرة والقراءة
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('discussion')}
            className={`py-2.5 min-h-[42px] border-b-2 transition-colors cursor-pointer ${
              mobilePane === 'discussion'
                ? 'border-[#1E3A5F] text-[#1E3A5F] bg-slate-50/70'
                : 'border-transparent text-slate-600'
            }`}
          >
            النقاش وأخذ نوت
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('repetition')}
            className={`py-2.5 min-h-[42px] border-b-2 transition-colors cursor-pointer ${
              mobilePane === 'repetition'
                ? 'border-[#1E3A5F] text-[#1E3A5F] bg-slate-50/70'
                : 'border-transparent text-slate-600'
            }`}
          >
            التكرار ({reviewCount}×)
          </button>
        </div>

        {/* Main Focus Workspace: Note Paper + Discussion & Repetition Companion */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Primary Reading / Editing Canvas */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 ${
              mobilePane !== 'note' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Mobile Compact Audio & Quick Review Strip inside single scroll container */}
            <div className="lg:hidden bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
              <ReadAloudButton
                uid={uid}
                entityType={
                  note.noteType === 'course_lecture' ? 'course' : 'note'
                }
                entityId={note.id}
                title={note.bookTitle}
                text={richHtmlToPlainText(
                  isEditingMain ? activeDraft.content : note.content
                )}
                voiceName={preferences.readAloudVoice}
                speed={preferences.readAloudSpeed}
                disabled={!canEdit}
                onRequireAuth={onRequireAuth}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickIncrementListen}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Headphones className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span className="tabular-nums">+1 سماع ({listenCount})</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickSpacedReview}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap ${
                    isDueToday
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تمت المراجعة الآن</span>
                </button>
              </div>
            </div>
            {/* Main Paper Container */}
            <div className={`${noteLayout.widthClass} space-y-5`}>
              {/* Paper Card Header Controls (Color Theme + Author/Marker) */}
              {!isEditingMain ? (
                <div className="space-y-4">
                  <div
                    data-custom-card-surface={
                      activeColorKey !== 'default' || noteLayout.paperTone !== 'clean'
                        ? 'light'
                        : undefined
                    }
                    className={`${activeColorTheme.cardClass} ${noteLayout.canvasPaddingClass} ${noteLayout.borderClass} ${activeColorKey === 'default' ? noteLayout.paperToneClass : ''} rounded-2xl transition-all space-y-5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                        {note.author && <span>المصدر: {note.author}</span>}
                        {note.author && note.progressMarker && (
                          <span aria-hidden="true">·</span>
                        )}
                        {note.progressMarker && (
                          <span>الموضع: {note.progressMarker}</span>
                        )}
                        {!note.author && !note.progressMarker && (
                          <span className="text-slate-400">
                            وضع القراءة الهادئ
                          </span>
                        )}
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
                                  onUpdateBookNote(note.id, { noteColor: ck })
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

                    {richHtmlToPlainText(note.content) ? (
                      <div
                        className="prose-bidi text-[15px] sm:text-base leading-[1.85] text-slate-800 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-[var(--kb-fg)] [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-[var(--kb-fg)] [&_h2]:mt-3.5 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[var(--kb-fg)] [&_h3]:mt-3 [&_h3]:mb-1.5 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-xs [&_mark]:text-[#0F172A] [&_strong]:font-bold [&_strong]:text-[var(--kb-fg)]"
                        dangerouslySetInnerHTML={{
                          __html: renderSafeBidiHtml(note.content),
                        }}
                      />
                    ) : (
                      <div className="py-10 text-center space-y-3">
                        <p className="text-sm text-slate-500">
                          لا يوجد محتوى مكتوب في هذه الملاحظة بعد.
                        </p>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setMainDraft(buildMainDraft(note));
                              setIsEditingMain(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>ابدأ كتابة الملاحظة</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Voice/Text Append Without Leaving Reading Mode */}
                  {canEdit && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                      <input
                        type="text"
                        value={quickMainCapture}
                        onChange={(e) => setQuickMainCapture(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && quickMainCapture.trim()) {
                            e.preventDefault();
                            handleAppendQuickMainNote(quickMainCapture);
                          }
                        }}
                        placeholder="أضف فكرة سريعة إلى متن الملاحظة بدون مغادرة القراءة..."
                        className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!quickMainCapture.trim()}
                          onClick={() =>
                            handleAppendQuickMainNote(quickMainCapture)
                          }
                          className="inline-flex items-center gap-1 px-3 py-2 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إضافة</span>
                        </button>
                        <VoiceRecorderButton
                          label="إضافة بالصوت"
                          dialect={preferences.voiceDialect}
                          disabled={!canEdit}
                          onRequireAuth={onRequireAuth}
                          onTranscript={(t) => {
                            handleAppendQuickMainNote(t);
                            onLogVoiceNote?.(note.bookTitle);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <ImageAttachmentGallery
                    uid={uid ?? undefined}
                    scopeKey={`note:${note.id}`}
                    title="الصور والمخططات المرفقة بهذه الملاحظة"
                    canEdit={canEdit}
                    onRequireAuth={onRequireAuth}
                    compact
                    hideEmptyWhenReadOnly
                  />

                  <NoteAttachmentsPanel
                    uid={uid ?? undefined}
                    noteId={note.id}
                    noteTitle={note.bookTitle}
                    resources={note.resources}
                    canEdit={canEdit}
                    onRequireAuth={onRequireAuth}
                    onUpdateResources={(next) =>
                      onUpdateBookNote(note.id, { resources: next })
                    }
                    onOpenPdf={onOpenPdf ?? (() => {})}
                  />
                </div>
              ) : (
                /* Edit Main Note Workspace */
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-600">
                      عنوان الملاحظة أو المحاضرة
                      <input
                        type="text"
                        value={activeDraft.bookTitle}
                        onChange={(e) =>
                          setMainDraft({
                            ...activeDraft,
                            bookTitle: e.target.value,
                          })
                        }
                        className="mt-1.5 w-full font-editorial text-xl font-bold text-slate-900 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                      />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <label className="block text-xs font-medium text-slate-600">
                        المجال (Hub)
                        <select
                          value={activeDraft.hubId}
                          onChange={(e) =>
                            setMainDraft({
                              ...activeDraft,
                              hubId: e.target.value as LearningHubId,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
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
                            setMainDraft({
                              ...activeDraft,
                              noteType: e.target.value as NoteCategoryType,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                        >
                          <option value="book">ملاحظات كتاب</option>
                          <option value="course_lecture">كورس / محاضرة</option>
                          <option value="general">موضوع عام</option>
                        </select>
                      </label>

                      <label className="block text-xs font-medium text-slate-600">
                        التصنيف
                        <select
                          value={activeDraft.categoryLabel}
                          onChange={(e) =>
                            setMainDraft({
                              ...activeDraft,
                              categoryLabel: e.target.value,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
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
                        المؤلف / المحاضر
                        <input
                          type="text"
                          value={activeDraft.author}
                          onChange={(e) =>
                            setMainDraft({
                              ...activeDraft,
                              author: e.target.value,
                            })
                          }
                          className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
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
                                setMainDraft({
                                  ...activeDraft,
                                  courseId: cid,
                                  courseTitle: c?.title ?? '',
                                });
                              }}
                              className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
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
                            المحاضرة
                            <input
                              type="text"
                              value={activeDraft.lectureTitle}
                              onChange={(e) =>
                                setMainDraft({
                                  ...activeDraft,
                                  lectureTitle: e.target.value,
                                })
                              }
                              className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                            />
                          </label>
                        </>
                      )}

                      <label className="block text-xs font-medium text-slate-600">
                        موضع التوقف / الدقيقة
                        <input
                          type="text"
                          value={activeDraft.progressMarker}
                          onChange={(e) =>
                            setMainDraft({
                              ...activeDraft,
                              progressMarker: e.target.value,
                            })
                          }
                          placeholder="مثلاً: الفصل 3 أو د 14:20"
                          className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        متن الملاحظة والتلخيص
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={appendFileInputRef}
                          type="file"
                          accept=".docx,.doc,.txt,.md,.markdown"
                          className="hidden"
                          onChange={(e) => void handleAppendFileToMain(e)}
                        />
                        <button
                          type="button"
                          disabled={!canEdit || importingFile}
                          onClick={() => appendFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {importingFile ? 'جاري الاستيراد...' : 'استيراد Word / نص'}
                          </span>
                        </button>

                        <VoiceRecorderButton
                          label="إملاء في المتن"
                          dialect={preferences.voiceDialect}
                          disabled={!canEdit}
                          onRequireAuth={onRequireAuth}
                          onTranscript={(t) => {
                            const snippet = formatVoiceSnippet(t);
                            const existing = ensureRichHtml(
                              activeDraft.content || ''
                            );
                            setMainDraft({
                              ...activeDraft,
                              content: existing
                                ? `${existing}${snippet}`
                                : snippet,
                            });
                            onLogVoiceNote?.(note.bookTitle);
                          }}
                        />
                      </div>
                    </div>

                    <RichTextNoteEditor
                      noteKey={`focus-main-${note.id}`}
                      value={activeDraft.content}
                      onChange={(html) => {
                        if (!canEdit) return;
                        setMainDraft({ ...activeDraft, content: html });
                      }}
                      canEdit={canEdit}
                      onRequireAuth={onRequireAuth}
                      preferences={preferences}
                      onUpdatePreferences={onUpdatePreferences}
                      onSelectDefaultHighlight={(color) => {
                        if (canEdit)
                          onUpdatePreferences({ noteHighlightColor: color });
                      }}
                      minimalMode={Boolean(preferences.minimalWritingMode)}
                      onToggleMinimalMode={() =>
                        onUpdatePreferences({
                          minimalWritingMode: !preferences.minimalWritingMode,
                        })
                      }
                      voiceDialect={preferences.voiceDialect}
                      onLogVoiceNote={() => onLogVoiceNote?.(note.bookTitle)}
                      minHeightClass="min-h-[280px]"
                    />
                  </div>

                  <ImageAttachmentGallery
                    uid={uid ?? undefined}
                    scopeKey={`note:${note.id}`}
                    title="الصور والمخططات المرفقة بهذه الملاحظة"
                    canEdit={canEdit}
                    onRequireAuth={onRequireAuth}
                    compact
                  />

                  <NoteAttachmentsPanel
                    uid={uid ?? undefined}
                    noteId={note.id}
                    noteTitle={note.bookTitle}
                    resources={note.resources}
                    canEdit={canEdit}
                    onRequireAuth={onRequireAuth}
                    onUpdateResources={(next) =>
                      onUpdateBookNote(note.id, { resources: next })
                    }
                    onOpenPdf={onOpenPdf ?? (() => {})}
                  />

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMainDraft(buildMainDraft(note));
                        setIsEditingMain(false);
                      }}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      إلغاء التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMainDraft}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حفظ التغييرات</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Study Companion Panel: Discussion Notes + Spaced Repetition */}
          <aside
            className={`${
              companionOpen ? 'lg:flex' : 'lg:hidden'
            } ${
              mobilePane === 'note' ? 'hidden lg:flex' : 'flex'
            } w-full lg:w-[410px] xl:w-[450px] shrink-0 border-t lg:border-t-0 lg:border-r border-slate-200 bg-white flex-col min-h-0 overflow-hidden`}
          >
            {/* Desktop Companion Sub-Tabs */}
            <div className="hidden lg:grid grid-cols-2 border-b border-slate-200 shrink-0 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCompanionTab('discussion')}
                className={`py-3 px-3 inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                  companionTab === 'discussion'
                    ? 'border-[#1E3A5F] text-[#1E3A5F] bg-slate-50/70'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>النقاش وأخذ نوت</span>
              </button>
              <button
                type="button"
                onClick={() => setCompanionTab('repetition')}
                className={`py-3 px-3 inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                  companionTab === 'repetition'
                    ? 'border-[#1E3A5F] text-[#1E3A5F] bg-slate-50/70'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                <span>الإعادة والتكرار ({reviewCount}×)</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
              {/* Discussion & Note-Taking Companion */}
              {(mobilePane === 'discussion' ||
                (mobilePane === 'note' && companionTab === 'discussion')) && (
                <div className="space-y-4">
                  {discussionPromptText && (
                    <div className="bg-amber-50/55 border border-amber-200/80 rounded-xl p-3.5 space-y-1.5">
                      <p className="text-[11px] font-bold text-amber-900">
                        محور النقاش والتطبيق المرتبط
                      </p>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                        <BidiText text={discussionPromptText} />
                      </p>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          نوت النقاش والأفكار أثناء المذاكرة
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          دوّن أفكارك وإجابات النقاش أثناء الاستماع أو القراءة
                        </p>
                      </div>
                      {canEdit && (
                        <VoiceRecorderButton
                          label="إملاء للنقاش"
                          dialect={preferences.voiceDialect}
                          disabled={!canEdit}
                          onRequireAuth={onRequireAuth}
                          onTranscript={(t) => {
                            const snippet = formatVoiceSnippet(t);
                            const existing = ensureRichHtml(
                              discussionDraft || ''
                            );
                            const nextHtml = existing
                              ? `${existing}${snippet}`
                              : snippet;
                            setDiscussionDraft(nextHtml);
                            onLogVoiceNote?.(`${note.bookTitle} (نقاش)`);
                          }}
                        />
                      )}
                    </div>

                    <RichTextNoteEditor
                      noteKey={`focus-discussion-${note.id}`}
                      value={discussionDraft}
                      onChange={(html) => {
                        if (!canEdit) return;
                        setDiscussionDraft(html);
                      }}
                      placeholder="اكتب هنا ملاحظاتك أثناء السماع، أسئلة النقاش، أو الاقتباسات التي تريد حفظها..."
                      canEdit={canEdit}
                      onRequireAuth={onRequireAuth}
                      preferences={preferences}
                      onUpdatePreferences={onUpdatePreferences}
                      onSelectDefaultHighlight={(color) => {
                        if (canEdit)
                          onUpdatePreferences({ noteHighlightColor: color });
                      }}
                      minimalMode={Boolean(preferences.minimalWritingMode)}
                      onToggleMinimalMode={() =>
                        onUpdatePreferences({
                          minimalWritingMode: !preferences.minimalWritingMode,
                        })
                      }
                      voiceDialect={preferences.voiceDialect}
                      onLogVoiceNote={() =>
                        onLogVoiceNote?.(`${note.bookTitle} (نقاش)`)
                      }
                      minHeightClass="min-h-[200px]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500">
                        {discussionSavedNotice ? (
                          <span className="text-emerald-700 font-semibold">
                            {discussionSavedNotice}
                          </span>
                        ) : discussionDirty ? (
                          <span className="text-amber-700 font-medium">
                            يوجد تعديل غير محفوظ
                          </span>
                        ) : (
                          'محفوظ مع الملاحظة'
                        )}
                      </span>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleSaveDiscussion}
                          disabled={!discussionDirty}
                          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors disabled:opacity-45 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حفظ ملاحظات النقاش</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Spaced Repetition & Study Methods Companion */}
              {(mobilePane === 'repetition' ||
                (mobilePane === 'note' && companionTab === 'repetition')) && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          تسجيل إعادة سريعة للملاحظة
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {note.lastReviewedDateKey
                            ? `آخر مراجعة: ${note.lastReviewedDateKey}`
                            : 'لم تُسجّل مراجعة بعد'}
                          {nextReviewDateKey
                            ? ` · القادمة: ${nextReviewDateKey}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={handleQuickSpacedReview}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>تمت المراجعة الآن (جدولة بعد {nextIntervalDays} يوم)</span>
                    </button>
                  </div>

                  <SpacedRepetitionPanel
                    compact
                    canEdit={canEdit}
                    title="أنماط القراءة وأساليب التثبيت"
                    value={{
                      readingModes: note.readingModes,
                      learningMethods: note.learningMethods,
                      reviewCount: note.reviewCount,
                      listenCount: note.listenCount,
                      repetitionStage: note.repetitionStage,
                      nextReviewDateKey: note.nextReviewDateKey,
                      lastReviewedDateKey: note.lastReviewedDateKey,
                    }}
                    onChange={(updates) => onUpdateBookNote(note.id, updates)}
                    customReadingModes={preferences.customReadingModes}
                    onUpdateReadingModes={(nextModes) =>
                      onUpdatePreferences({ customReadingModes: nextModes })
                    }
                  />
                </div>
              )}
            </div>
          </aside>
        </div>

        <ConfirmDialog
          open={confirmDeleteOpen}
          title="تأكيد حذف الملاحظة"
          message={`هل أنت متأكد من حذف «${note.bookTitle}» نهائيًا؟`}
          confirmLabel="تأكيد حذف الملاحظة"
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            setConfirmDeleteOpen(false);
            onDeleteBookNote(note.id);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
