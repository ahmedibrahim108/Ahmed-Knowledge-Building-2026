import { useEffect, useState } from 'react';
import {
  Clock,
  Edit3,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_WEEKLY_RHYTHM,
  WEEKLY_RHYTHM_DAYS,
  WeeklyRhythmItem,
} from '../data/curriculumData';

interface WeeklyRhythmSectionProps {
  items?: WeeklyRhythmItem[];
  canEdit: boolean;
  onSaveRhythm: (next: WeeklyRhythmItem[]) => void;
}

export default function WeeklyRhythmSection({
  items,
  canEdit,
  onSaveRhythm,
}: WeeklyRhythmSectionProps) {
  const rhythmList =
    items && items.length > 0 ? items : DEFAULT_WEEKLY_RHYTHM;

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<WeeklyRhythmItem[]>(rhythmList);

  useEffect(() => {
    if (!modalOpen) return;
    setDraft(rhythmList.map((item) => ({ ...item, days: [...(item.days ?? [])] })));
  }, [modalOpen, rhythmList]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const activeItems = rhythmList.filter((item) => item.active !== false);
  const totalHours = activeItems.reduce(
    (sum, item) => sum + (Number(item.targetHours) || 0),
    0
  );

  const handleToggleDay = (itemId: string, day: string) => {
    setDraft((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentDays = item.days ?? [];
        const exists = currentDays.includes(day);
        return {
          ...item,
          days: exists
            ? currentDays.filter((d) => d !== day)
            : [...currentDays, day],
        };
      })
    );
  };

  const handleAddDraftItem = () => {
    setDraft((prev) => [
      ...prev,
      {
        id: `rhythm-${Date.now()}`,
        pillar: 'نشاط تعلّمي جديد',
        suggestedDuration: '1 ساعة أسبوعيًا',
        targetHours: 1,
        focus: 'وصف موجز لمحور التركيز',
        guideline: 'قاعدة تنفيذ هادئة ومستمرة',
        days: ['الجمعة'],
        active: true,
      },
    ]);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft
      .filter((item) => item.pillar.trim().length > 0)
      .map((item) => ({
        ...item,
        pillar: item.pillar.trim(),
        suggestedDuration:
          item.suggestedDuration.trim() ||
          `${Number(item.targetHours) || 1} ساعة أسبوعيًا`,
        targetHours: Math.max(0.5, Number(item.targetHours) || 1),
        focus: item.focus.trim(),
        guideline: item.guideline.trim(),
        days: item.days ?? [],
        active: item.active !== false,
      }));
    onSaveRhythm(cleaned.length > 0 ? cleaned : DEFAULT_WEEKLY_RHYTHM);
    setModalOpen(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
              إيقاع التعلّم الأسبوعي
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
            إجمالي الالتزام الأسبوعي المستهدف: {totalHours} ساعات موزعة على{' '}
            {activeItems.length} ركائز.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>تخصيص الإيقاع الأسبوعي</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {activeItems.map((item) => (
          <article
            key={item.id}
            onClick={() => {
              if (canEdit) setModalOpen(true);
            }}
            className={`bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 transition-colors ${
              canEdit ? 'hover:border-[#1E3A5F]/50 cursor-pointer' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {item.pillar}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F] whitespace-nowrap shrink-0 tabular-nums">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {item.suggestedDuration}
              </span>
            </div>

            {item.focus && (
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                {item.focus}
              </p>
            )}

            {item.guideline && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {item.guideline}
              </p>
            )}

            {item.days && item.days.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1">
                {item.days.map((day) => (
                  <span
                    key={day}
                    className="px-2 py-0.5 text-[10px] font-medium bg-[#F7F8FA] text-slate-700 border border-slate-200 rounded-md"
                  >
                    {day}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Interactive Weekly Rhythm Editor Popup */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تخصيص إيقاع التعلّم الأسبوعي"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تخصيص إيقاع التعلّم الأسبوعي
                </h3>
                <p className="text-[11px] text-slate-500">
                  اضبط ساعاتك وأيام التنفيذ والقاعدة الإرشادية لكل ركيزة دون ازدحام في الصفحة الرئيسية.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveModal}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {draft.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.active !== false}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, active: e.target.checked }
                                : row
                            )
                          )
                        }
                      />
                      <span>مفعّل في الصفحة الرئيسية (ركيزة {idx + 1})</span>
                    </label>
                    {draft.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => prev.filter((row) => row.id !== item.id))
                        }
                        className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        اسم النشاط
                      </label>
                      <input
                        type="text"
                        value={item.pillar}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, pillar: e.target.value }
                                : row
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        الساعات المستهدفة أسبوعيًا
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="40"
                        value={item.targetHours ?? 1}
                        onChange={(e) => {
                          const hrs = Number(e.target.value) || 1;
                          setDraft((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? {
                                    ...row,
                                    targetHours: hrs,
                                    suggestedDuration: `${hrs} ساعة أسبوعيًا`,
                                  }
                                : row
                            )
                          );
                        }}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        الصيغة المعروضة للوقت
                      </label>
                      <input
                        type="text"
                        value={item.suggestedDuration}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, suggestedDuration: e.target.value }
                                : row
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        محور التركيز
                      </label>
                      <input
                        type="text"
                        value={item.focus}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, focus: e.target.value }
                                : row
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        القاعدة الإرشادية
                      </label>
                      <input
                        type="text"
                        value={item.guideline}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, guideline: e.target.value }
                                : row
                            )
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[11px] text-slate-600">
                      أيام التنفيذ في الأسبوع
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKLY_RHYTHM_DAYS.map((day) => {
                        const selected = (item.days ?? []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleDay(item.id, day)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                              selected
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddDraftItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة ركيزة أسبوعية جديدة</span>
              </button>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  حفظ الإيقاع الأسبوعي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
