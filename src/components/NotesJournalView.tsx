import { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  PenLine,
  Plus,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  BookNote,
  CustomCategory,
  MonthPlan,
  NoteCategoryType,
  PersonalCourse,
} from '../data/curriculumData';
import {
  exportSingleBookNoteAsExcel,
  exportSingleBookNoteAsMarkdown,
} from '../utils/excelExport';
import VoiceRecorderButton from './VoiceRecorderButton';

interface NotesJournalViewProps {
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

export default function NotesJournalView({
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
  const [subTab, setSubTab] = useState<'organized' | 'units'>('organized');
  const [typeFilter, setTypeFilter] = useState<NoteCategoryType | 'all'>('all');
  const [courseFilterId, setCourseFilterId] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchNotes, setSearchNotes] = useState('');

  // Structured Note Composer State
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

  const [monthFilter, setMonthFilter] = useState<'all' | 'written' | 'empty'>(
    'all'
  );
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  );

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
        const text = [
          bn.bookTitle,
          bn.author,
          bn.courseTitle,
          bn.lectureTitle,
          bn.categoryLabel,
          bn.content,
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [bookNotes, typeFilter, courseFilterId, categoryFilter, searchNotes]);

  const activeNote =
    filteredNotes.find((bn) => bn.id === activeBookNoteId) ??
    bookNotes.find((bn) => bn.id === activeBookNoteId) ??
    filteredNotes[0] ??
    null;

  const filteredMonths = months.filter((m) => {
    const hasNotes = m.notes.trim().length > 0;
    if (monthFilter === 'written') return hasNotes;
    if (monthFilter === 'empty') return !hasNotes;
    return true;
  });

  const writtenCount = months.filter((m) => m.notes.trim().length > 0).length;

  const handlePickCurriculumBook = (value: string) => {
    setSelectedCurriculumBook(value);
    if (!value) return;
    const found = curriculumBookOptions.find((o) => o.label === value);
    if (found) {
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

    if (newType === 'course_lecture') {
      const course = courses.find((c) => c.id === selectedCourseId);
      const lec = lectureTitle.trim();
      const title =
        customTitle.trim() ||
        (lec ? `${lec}` : course ? `ملاحظات ${course.title}` : 'ملاحظات محاضرة');
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
      return;
    }

    const title = customTitle.trim();
    if (!title) return;
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
  };

  const appendBookVoiceText = (
    note: BookNote,
    field: 'content' | 'quotes',
    transcript: string
  ) => {
    const current = (note[field] || '').trim();
    const next = current ? `${current}\n${transcript}` : transcript;
    onUpdateBookNote(note.id, { [field]: next });
    onLogVoiceNote?.(note.bookTitle);
  };

  return (
    <div className="space-y-6">
      {/* Top Header + Mode Switch */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            الكتب · الكورسات والمحاضرات · التدوين الصوتي المباشر
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            دفتر الملاحظات المنظّمة
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            نظّم ملاحظاتك في قاعدة البيانات حسب نوعها: ملاحظات كتاب معيّن، أو ملاحظات محاضرة داخل كورس محدد، أو ملاحظات مصنّفة لحسابك الشخصي، مع دعم الإملاء الصوتي والتصدير.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('organized')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'organized'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              النوتس المنظّمة ({bookNotes.length})
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
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <span>نسخة احتياطية Excel</span>
          </button>
        </div>
      </div>

      {subTab === 'organized' ? (
        <div className="space-y-6">
          {/* Structured Note Composer (Book / Course+Lecture / General) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  إضافة دفتر ملاحظات جديد في قاعدة البيانات
                </h2>
                <p className="text-xs text-slate-500">
                  اختر نوع الملاحظة لترتيبها تلقائيًا مع الكتاب أو الكورس والمحاضرة الخاصة بها.
                </p>
              </div>

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
            </div>

            {newType === 'book' && (
              <div className="pb-4 border-b border-slate-100">
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
              {newType === 'course_lecture' && (
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
              )}

              {newType !== 'course_lecture' && (
                <label className="sm:col-span-4 space-y-1 text-xs font-medium text-slate-600">
                  <span>
                    {newType === 'book' ? 'اسم الكتاب' : 'عنوان الملاحظة / الموضوع'}
                  </span>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={
                      newType === 'book'
                        ? 'اكتب اسم الكتاب...'
                        : 'اكتب عنوان الملاحظة...'
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                </label>
              )}

              <label
                className={`${
                  newType === 'course_lecture' ? 'sm:col-span-2' : 'sm:col-span-3'
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
                  newType === 'course_lecture' ? 'sm:col-span-2' : 'sm:col-span-3'
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
                className={`${
                  newType === 'course_lecture' ? 'sm:col-span-12 flex justify-end' : 'sm:col-span-2'
                }`}
              >
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة نوتس</span>
                </button>
              </div>
            </form>
          </div>

          {/* Filter Bar for Organized Notes */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `الكل (${bookNotes.length})` },
                  {
                    id: 'book',
                    label: `كتب (${
                      bookNotes.filter((n) => (n.noteType ?? 'book') === 'book')
                        .length
                    })`,
                  },
                  {
                    id: 'course_lecture',
                    label: `كورسات ومحاضرات (${
                      bookNotes.filter((n) => n.noteType === 'course_lecture')
                        .length
                    })`,
                  },
                  {
                    id: 'general',
                    label: `عام (${
                      bookNotes.filter((n) => n.noteType === 'general').length
                    })`,
                  },
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

          {/* Master-Detail Notes Workspace */}
          {filteredNotes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <BookOpen
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-800">
                لا توجد ملاحظات مطابقة للتصفية الحالية
              </p>
              <p className="text-xs text-slate-500">
                أضف ملاحظة جديدة لكتاب أو محاضرة في كورس من النموذج أعلاه، أو عدّل خيارات التصفية.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Notes Sidebar */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    الملاحظات المرتّبة
                  </h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {filteredNotes.length} {filteredNotes.length === 1 ? 'نوت' : 'نوتس'}
                  </span>
                </div>

                <div className="divide-y divide-slate-200 max-h-[650px] overflow-y-auto">
                  {filteredNotes.map((bn) => {
                    const isSelected = activeNote?.id === bn.id;
                    const noteType = bn.noteType ?? 'book';
                    return (
                      <button
                        key={bn.id}
                        type="button"
                        onClick={() => {
                          onSelectBookNote(bn.id);
                          setConfirmDeleteNoteId(null);
                        }}
                        className={`w-full text-right px-5 py-4 transition-colors cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-slate-100/90 border-r-4 border-r-[#1E3A5F]'
                            : 'bg-white hover:bg-slate-50'
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
                    );
                  })}
                </div>
              </div>

              {/* Active Note Editor & Voice Dictation */}
              {activeNote && (
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#1E3A5F]">
                          {NOTE_TYPE_LABELS[activeNote.noteType ?? 'book']}
                        </span>
                        {activeNote.courseTitle && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 font-medium">
                              {activeNote.courseTitle}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>آخر تحديث: {activeNote.updatedAt}</span>
                      </div>
                      <input
                        type="text"
                        aria-label="عنوان الملاحظة أو الكتاب"
                        value={activeNote.bookTitle}
                        onChange={(e) =>
                          onUpdateBookNote(activeNote.id, {
                            bookTitle: e.target.value,
                          })
                        }
                        className="w-full font-editorial text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-[#1E3A5F] focus:outline-none py-0.5"
                      />
                    </div>

                    {confirmDeleteNoteId === activeNote.id ? (
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteBookNote(activeNote.id);
                            setConfirmDeleteNoteId(null);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                        >
                          تأكيد الحذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteNoteId(null)}
                          className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteNoteId(activeNote.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>حذف الملاحظة</span>
                      </button>
                    )}
                  </div>

                  {/* Organization & Metadata Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <label className="block text-xs font-medium text-slate-600">
                      نوع الملاحظة
                      <select
                        value={activeNote.noteType ?? 'book'}
                        onChange={(e) =>
                          onUpdateBookNote(activeNote.id, {
                            noteType: e.target.value as NoteCategoryType,
                          })
                        }
                        className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
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
                        value={activeNote.categoryLabel ?? ''}
                        onChange={(e) =>
                          onUpdateBookNote(activeNote.id, {
                            categoryLabel: e.target.value,
                          })
                        }
                        className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
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
                        value={activeNote.author}
                        onChange={(e) =>
                          onUpdateBookNote(activeNote.id, {
                            author: e.target.value,
                          })
                        }
                        placeholder="اسم المؤلف أو المحاضر..."
                        className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                      />
                    </label>

                    {(activeNote.noteType ?? 'book') === 'course_lecture' && (
                      <>
                        <label className="block text-xs font-medium text-slate-600">
                          الكورس المرتبط
                          <select
                            value={activeNote.courseId ?? 0}
                            onChange={(e) => {
                              const cid = Number(e.target.value);
                              const c = courses.find((item) => item.id === cid);
                              onUpdateBookNote(activeNote.id, {
                                courseId: cid,
                                courseTitle: c?.title ?? '',
                              });
                            }}
                            className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
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
                            value={activeNote.lectureTitle ?? ''}
                            onChange={(e) =>
                              onUpdateBookNote(activeNote.id, {
                                lectureTitle: e.target.value,
                              })
                            }
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
                        value={activeNote.progressMarker}
                        onChange={(e) =>
                          onUpdateBookNote(activeNote.id, {
                            progressMarker: e.target.value,
                          })
                        }
                        placeholder="مثلاً: الفصل 3 — ص 85 أو د 14:20"
                        className="mt-1.5 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                      />
                    </label>
                  </div>

                  {/* Main Notes Editor + Voice Recording */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor={`book-content-${activeNote.id}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        النوتس والأفكار المستخلصة (كتابةً أو بالصوت)
                      </label>
                      <VoiceRecorderButton
                        label="تسجيل نوت بالصوت"
                        onTranscript={(text) =>
                          appendBookVoiceText(activeNote, 'content', text)
                        }
                      />
                    </div>
                    <textarea
                      id={`book-content-${activeNote.id}`}
                      rows={7}
                      value={activeNote.content}
                      onChange={(e) =>
                        onUpdateBookNote(activeNote.id, {
                          content: e.target.value,
                        })
                      }
                      placeholder="دوّن هنا الأفكار الرئيسية أو اضغط «تسجيل نوت بالصوت» لتسجيل فكرتك وتحويلها لنص..."
                      className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white leading-relaxed"
                    />
                  </div>

                  {/* Quotes & Discussion Points + Voice Recording */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor={`book-quotes-${activeNote.id}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        اقتباسات مهمة أو أسئلة للنقاش
                      </label>
                      <VoiceRecorderButton
                        label="سؤال نقاشي بالصوت"
                        onTranscript={(text) =>
                          appendBookVoiceText(activeNote, 'quotes', text)
                        }
                      />
                    </div>
                    <textarea
                      id={`book-quotes-${activeNote.id}`}
                      rows={3}
                      value={activeNote.quotes}
                      onChange={(e) =>
                        onUpdateBookNote(activeNote.id, {
                          quotes: e.target.value,
                        })
                      }
                      placeholder="اقتباس مهم أو سؤال تود مناقشته بصوتك أو كتابة..."
                      className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white leading-relaxed"
                    />
                  </div>

                  {/* Per-Note Download Actions */}
                  <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      تحميل هذا الدفتر فقط في ملف مستقل:
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => exportSingleBookNoteAsMarkdown(activeNote)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>تحميل ملف نصي (.md)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSingleBookNoteAsExcel(activeNote)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>تحميل ملف Excel (.xlsx)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Unit Summaries Sub-view */
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

                    <VoiceRecorderButton
                      label="إملاء صوتي"
                      onTranscript={(text) => {
                        const prev = month.notes.trim();
                        onUpdateMonthNotes(
                          month.id,
                          prev ? `${prev}\n${text}` : text
                        );
                        onLogVoiceNote?.(`ملخص الوحدة ${month.id}`);
                      }}
                    />
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                    <p className="text-xs font-medium text-slate-500">
                      سؤال المناقشة:
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {month.discussionPrompt}
                    </p>
                  </div>

                  <textarea
                    rows={4}
                    aria-label={`ملاحظات الوحدة ${month.id}`}
                    value={month.notes}
                    onChange={(e) =>
                      onUpdateMonthNotes(month.id, e.target.value)
                    }
                    placeholder="اكتب خلاصتك أو سجّلها بالصوت..."
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white transition-colors leading-relaxed"
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
