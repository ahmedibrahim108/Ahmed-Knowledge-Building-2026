import { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  FileText,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react';
import { BookNote, MonthPlan } from '../data/curriculumData';
import {
  exportSingleBookNoteAsExcel,
  exportSingleBookNoteAsMarkdown,
} from '../utils/excelExport';
import VoiceRecorderButton from './VoiceRecorderButton';

interface NotesJournalViewProps {
  months: MonthPlan[];
  bookNotes: BookNote[];
  activeBookNoteId: string | null;
  onSelectBookNote: (id: string | null) => void;
  onAddBookNote: (bookTitle: string, author: string) => void;
  onUpdateBookNote: (id: string, updates: Partial<BookNote>) => void;
  onDeleteBookNote: (id: string) => void;
  onUpdateMonthNotes: (id: number, notes: string) => void;
  onExportExcel: () => void;
}

export default function NotesJournalView({
  months,
  bookNotes,
  activeBookNoteId,
  onSelectBookNote,
  onAddBookNote,
  onUpdateBookNote,
  onDeleteBookNote,
  onUpdateMonthNotes,
  onExportExcel,
}: NotesJournalViewProps) {
  const [subTab, setSubTab] = useState<'books' | 'months'>('books');
  const [monthFilter, setMonthFilter] = useState<'all' | 'written' | 'empty'>(
    'all'
  );
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [selectedCurriculumBook, setSelectedCurriculumBook] = useState('');
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  );

  // Build unique list of all curriculum books/series for quick selection
  const curriculumBookOptions = useMemo(() => {
    const items: Array<{ label: string; title: string; author: string }> = [];
    const seen = new Set<string>();
    for (const m of months) {
      for (const track of [m.foundational, m.exploratory]) {
        const key = `${track.title}::${track.author}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            label: `الشهر ${m.id}: ${track.title} — ${track.author}`,
            title: track.title,
            author: track.author,
          });
        }
      }
    }
    return items;
  }, [months]);

  const activeNote =
    bookNotes.find((bn) => bn.id === activeBookNoteId) ?? bookNotes[0] ?? null;

  const filteredMonths = months.filter((m) => {
    const hasNotes = m.notes.trim().length > 0;
    if (monthFilter === 'written') return hasNotes;
    if (monthFilter === 'empty') return !hasNotes;
    return true;
  });

  const writtenCount = months.filter((m) => m.notes.trim().length > 0).length;

  const handleCreateCustomBook = (e: React.FormEvent) => {
    e.preventDefault();
    const title = customTitle.trim();
    if (!title) return;
    onAddBookNote(title, customAuthor.trim() || 'مؤلف / مصدر حر');
    setCustomTitle('');
    setCustomAuthor('');
  };

  const handlePickCurriculumBook = (value: string) => {
    setSelectedCurriculumBook(value);
    if (!value) return;
    const found = curriculumBookOptions.find((o) => o.label === value);
    if (found) {
      onAddBookNote(found.title, found.author);
      setSelectedCurriculumBook('');
    }
  };

  const appendBookVoiceText = (
    note: BookNote,
    field: 'content' | 'quotes',
    transcript: string
  ) => {
    const current = (note[field] || '').trim();
    const next = current ? `${current}\n${transcript}` : transcript;
    onUpdateBookNote(note.id, { [field]: next });
  };

  return (
    <div className="space-y-6">
      {/* Top Header + Mode Switch */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            القراءة والاستماع والتلخيص · الإملاء الصوتي المباشر
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            دفتر التلخيص وملاحظات الكتب
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            اكتب ملاحظاتك أو سجّلها بصوتك لأي كتاب تقرؤه حاليًا وحوّلها تلقائيًا إلى نص قابل للتعديل والتحميل في ملف مستقل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('books')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'books'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نوتس كتاب معيّن ({bookNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('months')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'months'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ملخصات الأشهر ({months.length})
            </button>
          </div>

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>تصدير الخطة كاملة (.xlsx)</span>
          </button>
        </div>
      </div>

      {subTab === 'books' ? (
        <div className="space-y-6">
          {/* Quick-Add Book / Material Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-5 space-y-1.5">
                <label
                  htmlFor="pick-curriculum-book"
                  className="block text-xs font-semibold text-slate-700"
                >
                  افتح دفتر نوتس لكتاب من الخطة
                </label>
                <select
                  id="pick-curriculum-book"
                  value={selectedCurriculumBook}
                  onChange={(e) => handlePickCurriculumBook(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                >
                  <option value="">اختر كتابًا أو سلسلة من الخطة...</option>
                  {curriculumBookOptions.map((opt) => (
                    <option key={opt.label} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <form
                onSubmit={handleCreateCustomBook}
                className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
              >
                <div className="sm:col-span-5 space-y-1.5">
                  <label
                    htmlFor="custom-book-title"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    أو أضف أي كتاب / مقال تقرؤه الآن
                  </label>
                  <input
                    id="custom-book-title"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="اسم الكتاب أو المحاضرة..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1.5">
                  <label
                    htmlFor="custom-book-author"
                    className="block text-xs text-slate-500"
                  >
                    المؤلف / المحاضر (اختياري)
                  </label>
                  <input
                    id="custom-book-author"
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    placeholder="اسم الكاتب..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>فتح دفتر</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Master-Detail Book Notes Workspace */}
          {bookNotes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <BookOpen
                className="w-8 h-8 text-slate-300 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-800">
                لا توجد دفاتر كتب مضافة بعد
              </p>
              <p className="text-xs text-slate-500">
                اختر كتابًا من القائمة أعلاه أو اكتب اسم الكتاب الذي تقرؤه حاليًا للبدء بتدوين ملاحظاتك بالكتابة أو بالصوت.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Book List */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    كتبي وقراءاتي
                  </h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {bookNotes.length} {bookNotes.length === 1 ? 'كتاب' : 'كتب'}
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {bookNotes.map((bn) => {
                    const isSelected = activeNote?.id === bn.id;
                    return (
                      <button
                        key={bn.id}
                        type="button"
                        onClick={() => {
                          onSelectBookNote(bn.id);
                          setConfirmDeleteNoteId(null);
                        }}
                        className={`w-full text-right px-5 py-4 transition-colors cursor-pointer space-y-1 ${
                          isSelected
                            ? 'bg-slate-100/90'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900 leading-snug">
                          {bn.bookTitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{bn.author || 'غير محدد'}</span>
                          {bn.progressMarker && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{bn.progressMarker}</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Book Editor & Voice Dictation & Per-Book Download */}
              {activeNote && (
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                    <div className="space-y-1 flex-1">
                      <span className="text-xs text-slate-500">
                        آخر تحديث: {activeNote.updatedAt}
                      </span>
                      <input
                        type="text"
                        aria-label="اسم الكتاب"
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
                        <span>حذف الدفتر</span>
                      </button>
                    )}
                  </div>

                  {/* Book Metadata Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        placeholder="اسم المؤلف أو السلسلة..."
                        className="mt-1.5 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                      />
                    </label>

                    <label className="block text-xs font-medium text-slate-600">
                      موضع القراءة (الفصل / رقم الصفحة)
                      <input
                        type="text"
                        value={activeNote.progressMarker}
                        onChange={(e) =>
                          onUpdateBookNote(activeNote.id, {
                            progressMarker: e.target.value,
                          })
                        }
                        placeholder="مثلاً: الفصل الثالث — ص 85"
                        className="mt-1.5 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
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
                      placeholder="اقتباس من الكتاب أو سؤال تود طرحه للنقاش..."
                      className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white leading-relaxed"
                    />
                  </div>

                  {/* Per-Book Direct Download Actions */}
                  <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      تحميل نوتس هذا الكتاب فقط في ملف مستقل:
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
        /* Monthly Summaries Sub-view */
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-600">
              تصفية ملخصات الأشهر:
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
                اختر «الكل» لعرض جميع الأشهر والبدء بكتابة أول ملخص شهري.
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
                          الشهر {month.id}
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
                    aria-label={`ملاحظات الشهر ${month.id}`}
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
