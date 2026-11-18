import { useState } from 'react';
import { FileSpreadsheet, PenLine } from 'lucide-react';
import { MonthPlan } from '../data/curriculumData';

interface NotesJournalViewProps {
  months: MonthPlan[];
  onUpdateMonthNotes: (id: number, notes: string) => void;
  onExportExcel: () => void;
}

export default function NotesJournalView({
  months,
  onUpdateMonthNotes,
  onExportExcel,
}: NotesJournalViewProps) {
  const [filter, setFilter] = useState<'all' | 'written' | 'empty'>('all');

  const filtered = months.filter((m) => {
    const hasNotes = m.notes.trim().length > 0;
    if (filter === 'written') return hasNotes;
    if (filter === 'empty') return !hasNotes;
    return true;
  });

  const writtenCount = months.filter((m) => m.notes.trim().length > 0).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            القراءة والاستماع والتلخيص والمناقشة والتطبيق
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            دفتر التلخيص والمناقشة
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            الفكرة التي لا تُكتب ولا تُناقش تتبخر سريعًا. دوّن هنا خلاصتك الشهرية وإجاباتك عن أسئلة المقارنة، وستُحفظ محليًا وتُدرج تلقائيًا في ملف Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `الكل (12)` },
                { id: 'written', label: `مكتوب (${writtenCount})` },
                { id: 'empty', label: `بانتظار التدوين (${12 - writtenCount})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>تصدير الدفتر في Excel</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <PenLine className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-800">
            لا توجد دفاتر مطابقة لهذا التصنيف حاليًا
          </p>
          <p className="text-xs text-slate-500">
            اختر «الكل» لعرض جميع الأشهر والبدء بكتابة أول ملخص شهري.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((month) => (
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
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                <p className="text-xs font-medium text-slate-500">سؤال المناقشة:</p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {month.discussionPrompt}
                </p>
              </div>

              <textarea
                rows={4}
                aria-label={`ملاحظات الشهر ${month.id}`}
                value={month.notes}
                onChange={(e) => onUpdateMonthNotes(month.id, e.target.value)}
                placeholder="اكتب خلاصتك وأفكارك القابلة للتطبيق هنا..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white transition-colors leading-relaxed"
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
