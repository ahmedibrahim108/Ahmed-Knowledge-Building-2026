import { useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Headphones,
  Plus,
  Repeat,
  Sparkles,
} from 'lucide-react';
import {
  DEFAULT_LEARNING_METHODS,
  READING_MODES_META,
  ReadingMode,
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
}

export default function SpacedRepetitionPanel({
  canEdit,
  value,
  onChange,
  title = 'أنماط القراءة، أساليب التعلم والتكرار المتباعد',
  compact = false,
}: SpacedRepetitionPanelProps) {
  const [customMethod, setCustomMethod] = useState('');

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

      {/* 5 Reading Modes */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
          <span>أنماط القراءة المطبّقة (اختر نمطًا أو أكثر):</span>
        </div>
        <div
          className={
            compact
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2'
          }
        >
          {READING_MODES_META.map((mode) => {
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
                <p
                  className={`text-[10px] mt-0.5 leading-snug ${
                    active ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {mode.description}
                </p>
              </button>
            );
          })}
        </div>
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
            className="flex items-center gap-2 max-w-sm pt-1"
          >
            <input
              type="text"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
              placeholder="أسلوب تعلم إضافي (اختياري)..."
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
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
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Headphones className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span>عدّاد السماع / التسجيل المتكرر</span>
            </p>
            <p className="text-[11px] text-slate-500">
              تابِع المواد التي سمعتها أو سجلتها أكثر من مرة ({listenCount} مرة)
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canEdit || listenCount <= 0}
              onClick={() => handleListenDelta(-1)}
              className="px-2.5 py-1.5 min-h-[34px] text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
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
              className="px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg disabled:opacity-50 cursor-pointer"
            >
              +1 سماع / تسجيل
            </button>
          </div>
        </div>

        {/* Spaced Repetition Queue Control */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <CalendarClock className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تمت المراجعة (+1)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <label className="inline-flex items-center gap-2">
              <span>تاريخ المراجعة القادمة (اختياري):</span>
              <input
                type="date"
                disabled={!canEdit}
                value={nextReviewDateKey}
                onChange={(e) =>
                  onChange({ nextReviewDateKey: e.target.value })
                }
                className="px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
