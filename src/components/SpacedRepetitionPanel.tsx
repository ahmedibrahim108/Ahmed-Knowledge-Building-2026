import { useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Headphones,
  PenLine,
  Plus,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_LEARNING_METHODS,
  READING_MODES_META,
  ReadingMode,
  ReadingModeMeta,
  SPACED_REPETITION_INTERVALS,
  addDaysToDateKey,
  getTodayDateKey,
} from '../data/curriculumData';

export interface SpacedRepetitionValue {
  readingModes?: ReadingMode[];
  learningMethods?: string[];
  reviewCount?: number;
  listenCount?: number;
  repetitionStage?: number;
  nextReviewDateKey?: string;
  lastReviewedDateKey?: string;
}

interface SpacedRepetitionPanelProps {
  canEdit: boolean;
  value: SpacedRepetitionValue;
  onChange: (updates: SpacedRepetitionValue) => void;
  title?: string;
  compact?: boolean;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
}

export default function SpacedRepetitionPanel({
  canEdit,
  value,
  onChange,
  title = 'أنماط القراءة، أساليب التعلم والتكرار المتباعد',
  compact = false,
  customReadingModes,
  onUpdateReadingModes,
}: SpacedRepetitionPanelProps) {
  const [customMethod, setCustomMethod] = useState('');
  const [editingModesOpen, setEditingModesOpen] = useState(false);
  const [editingModeId, setEditingModeId] = useState<string | null>(null);
  const [editModeLabel, setEditModeLabel] = useState('');
  const [editModeDesc, setEditModeDesc] = useState('');
  const [newModeLabel, setNewModeLabel] = useState('');
  const [newModeDesc, setNewModeDesc] = useState('');

  const activeModeCatalog: ReadingModeMeta[] =
    customReadingModes && customReadingModes.length > 0
      ? customReadingModes
      : READING_MODES_META;

  const readingModes = value.readingModes ?? [];
  const learningMethods = value.learningMethods ?? [];
  const reviewCount = value.reviewCount ?? 0;
  const listenCount = value.listenCount ?? 0;
  const repetitionStage = value.repetitionStage ?? 0;
  const nextReviewDateKey = value.nextReviewDateKey ?? '';
  const lastReviewedDateKey = value.lastReviewedDateKey ?? '';
  const today = getTodayDateKey();

  const isDueToday =
    Boolean(nextReviewDateKey) && nextReviewDateKey <= today;
  const currentInterval =
    SPACED_REPETITION_INTERVALS[
      Math.min(repetitionStage, SPACED_REPETITION_INTERVALS.length - 1)
    ];

  const toggleReadingMode = (mode: ReadingMode) => {
    if (!canEdit) return;
    const exists = readingModes.includes(mode);
    const next = exists
      ? readingModes.filter((m) => m !== mode)
      : [...readingModes, mode];
    onChange({ readingModes: next });
  };

  const toggleMethod = (method: string) => {
    if (!canEdit) return;
    const exists = learningMethods.includes(method);
    const next = exists
      ? learningMethods.filter((m) => m !== method)
      : [...learningMethods, method];
    onChange({ learningMethods: next });
  };

  const handleAddCustomMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const trimmed = customMethod.trim();
    if (!trimmed) return;
    if (!learningMethods.includes(trimmed)) {
      onChange({ learningMethods: [...learningMethods, trimmed] });
    }
    setCustomMethod('');
  };

  const handleSaveEditedMode = (modeId: string) => {
    if (!onUpdateReadingModes || !editModeLabel.trim()) return;
    const cleanLabel = editModeLabel.trim();
    const next = activeModeCatalog.map((m) =>
      m.id === modeId
        ? {
            ...m,
            label: cleanLabel,
            shortLabel: cleanLabel.replace(/^قراءة\s+/, '').slice(0, 24) || cleanLabel,
            description: editModeDesc.trim(),
          }
        : m
    );
    onUpdateReadingModes(next);
    setEditingModeId(null);
  };

  const handleAddReadingMode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateReadingModes || !newModeLabel.trim()) return;
    const cleanLabel = newModeLabel.trim();
    const id = `mode_${Date.now()}`;
    const newEntry: ReadingModeMeta = {
      id,
      label: cleanLabel,
      shortLabel: cleanLabel.replace(/^قراءة\s+/, '').slice(0, 24) || cleanLabel,
      description:
        newModeDesc.trim() || 'نمط قراءة وتعلّم مخصّص وفق طريقتك في الفهم والتطبيق.',
    };
    onUpdateReadingModes([...activeModeCatalog, newEntry]);
    setNewModeLabel('');
    setNewModeDesc('');
  };

  const handleDeleteReadingMode = (modeId: string) => {
    if (!onUpdateReadingModes || activeModeCatalog.length <= 1) return;
    onUpdateReadingModes(activeModeCatalog.filter((m) => m.id !== modeId));
  };

  const handleLogSpacedReview = () => {
    if (!canEdit) return;
    const nextStage = Math.min(
      repetitionStage + 1,
      SPACED_REPETITION_INTERVALS.length - 1
    );
    const daysToAdd =
      SPACED_REPETITION_INTERVALS[
        Math.min(repetitionStage, SPACED_REPETITION_INTERVALS.length - 1)
      ];
    onChange({
      reviewCount: reviewCount + 1,
      repetitionStage: nextStage,
      lastReviewedDateKey: today,
      nextReviewDateKey: addDaysToDateKey(today, daysToAdd),
    });
  };

  const handleListenDelta = (delta: number) => {
    if (!canEdit) return;
    onChange({ listenCount: Math.max(0, listenCount + delta) });
  };

  const allMethodOptions = Array.from(
    new Set([...DEFAULT_LEARNING_METHODS, ...learningMethods])
  );

  return (
    <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {listenCount >= 2 && (
            <span className="px-2 py-0.5 font-semibold bg-amber-100 text-amber-900 border border-amber-200 rounded-md">
              مسموع / مسجل أكثر من مرة ({listenCount}×)
            </span>
          )}
          {reviewCount >= 2 && (
            <span className="px-2 py-0.5 font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-md">
              مراجعات متكررة ({reviewCount}×)
            </span>
          )}
          {isDueToday && (
            <span className="px-2 py-0.5 font-semibold bg-rose-100 text-rose-900 border border-rose-200 rounded-md">
              مستحق للمراجعة اليوم
            </span>
          )}
        </div>
      </div>

      {/* Customizable Reading Modes */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
            <span>أنماط القراءة المطبّقة (اختر نمطًا أو أكثر):</span>
          </div>
          {canEdit && onUpdateReadingModes && (
            <button
              type="button"
              onClick={() => {
                setEditingModesOpen((v) => !v);
                setEditingModeId(null);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer transition-colors ${
                editingModesOpen
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-[#1E3A5F] border-slate-300 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
              <span>{editingModesOpen ? 'إغلاق التخصيص' : 'تخصيص / إضافة أنماط القراءة'}</span>
            </button>
          )}
        </div>

        <div
          className={
            compact
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2'
          }
        >
          {activeModeCatalog.map((mode) => {
            const active = readingModes.includes(mode.id);
            return (
              <button
                key={mode.id}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleReadingMode(mode.id)}
                title={mode.description}
                aria-pressed={active}
                className={`text-right px-3 py-2.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-65 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-xs font-bold">{mode.label}</p>
                {mode.description && (
                  <p
                    className={`text-[10px] mt-0.5 leading-snug ${
                      active ? 'opacity-85' : 'text-slate-500'
                    }`}
                  >
                    {mode.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Inline Customize Reading Modes Drawer */}
        {editingModesOpen && canEdit && onUpdateReadingModes && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  تخصيص أنماط القراءة (تعديل الاسم أو الوصف أو إضافة نمط مثل: قراءة فهم)
                </p>
                <p className="text-[11px] text-slate-500">
                  التعديلات تُحفظ وتظهر عبر المكتبة والكورسات والمسارات والملاحظات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateReadingModes(READING_MODES_META)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>استعادة الافتراضي</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {activeModeCatalog.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-[#F7F8FA] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  {editingModeId === m.id ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editModeLabel}
                        onChange={(e) => setEditModeLabel(e.target.value)}
                        placeholder="اسم النمط (مثلاً: قراءة فهم)"
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                      />
                      <input
                        type="text"
                        value={editModeDesc}
                        onChange={(e) => setEditModeDesc(e.target.value)}
                        placeholder="وصف مختصر..."
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900">{m.label}</p>
                      <p className="text-[11px] text-slate-500 truncate">{m.description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {editingModeId === m.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveEditedMode(m.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#1E3A5F] text-white rounded-md cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>حفظ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingModeId(null)}
                          className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingModeId(m.id);
                            setEditModeLabel(m.label);
                            setEditModeDesc(m.description);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <PenLine className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        {activeModeCatalog.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteReadingMode(m.id)}
                            aria-label={`حذف ${m.label}`}
                            className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddReadingMode}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100"
            >
              <input
                type="text"
                value={newModeLabel}
                onChange={(e) => setNewModeLabel(e.target.value)}
                placeholder="إضافة نمط جديد (مثل: قراءة فهم، قراءة نقدية...)"
                className="sm:col-span-4 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={newModeDesc}
                onChange={(e) => setNewModeDesc(e.target.value)}
                placeholder="وصف مختصر للنمط (اختياري)..."
                className="sm:col-span-6 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#1E3A5F] text-white hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Learning Methods */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
          <span>أساليب التعلم والاستيعاب المستخدمة:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {allMethodOptions.map((method) => {
            const active = learningMethods.includes(method);
            return (
              <button
                key={method}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleMethod(method)}
                aria-pressed={active}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-65 ${
                  active
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {method}
              </button>
            );
          })}
        </div>
        {canEdit && (
          <form
            onSubmit={handleAddCustomMethod}
            className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:max-w-md pt-1"
          >
            <input
              type="text"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
              placeholder="أسلوب تعلم إضافي (اختياري)..."
              className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3.5 py-2 min-h-[36px] text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إضافة</span>
            </button>
          </form>
        )}
      </div>

      {/* Repetition Counter + Spaced Repetition Scheduler */}
      <div
        className={
          compact
            ? 'grid grid-cols-1 gap-3 pt-2 border-t border-slate-200'
            : 'grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200'
        }
      >
        {/* Re-listen / Record Tracking */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Headphones className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" aria-hidden="true" />
              <span>عدّاد السماع / التسجيل المتكرر</span>
            </p>
            <p className="text-[11px] text-slate-500">
              تابِع المواد التي سمعتها أو سجلتها أكثر من مرة ({listenCount} مرة)
            </p>
          </div>
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!canEdit || listenCount <= 0}
              onClick={() => handleListenDelta(-1)}
              className="px-2.5 py-1.5 min-h-[36px] text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
            >
              -1
            </button>
            <span className="px-2.5 py-1 text-xs font-bold text-slate-900 tabular-nums">
              {listenCount}
            </span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => handleListenDelta(1)}
              className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              +1 سماع / تسجيل
            </button>
          </div>
        </div>

        {/* Spaced Repetition Queue Control */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <CalendarClock className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" aria-hidden="true" />
                <span>جدول التكرار المتباعد (المرحلة {repetitionStage + 1})</span>
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                مرات المراجعة: {reviewCount} · الفترة القادمة: {currentInterval} يوم
                {lastReviewedDateKey ? ` · آخر مراجعة: ${lastReviewedDateKey}` : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={!canEdit}
              onClick={handleLogSpacedReview}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تمت المراجعة (+1)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <span>تاريخ المراجعة القادمة (اختياري):</span>
              <input
                type="date"
                disabled={!canEdit}
                value={nextReviewDateKey}
                onChange={(e) =>
                  onChange({ nextReviewDateKey: e.target.value })
                }
                className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
