import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Circle,
  Edit3,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { LearningObjective } from '../data/curriculumData';

interface LearningObjectivesPanelProps {
  objectives?: LearningObjective[];
  canEdit?: boolean;
  readOnly?: boolean;
  onChange?: (next: LearningObjective[]) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export default function LearningObjectivesPanel({
  objectives = [],
  canEdit = false,
  readOnly = false,
  onChange,
  title = 'أهداف التعلّم',
  subtitle = 'لماذا أدرس هذه المادة وما الناتج العملي أو المعرفي الذي أستهدفه؟',
  compact = false,
}: LearningObjectivesPanelProps) {
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const editable = canEdit && !readOnly && Boolean(onChange);
  const totalCount = objectives.length;
  const achievedCount = objectives.filter((obj) => obj.achieved).length;
  const pct = totalCount > 0 ? Math.round((achievedCount / totalCount) * 100) : 0;

  if (readOnly && totalCount === 0) {
    return null;
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editable || !onChange) return;
    const trimmed = newText.trim();
    if (!trimmed) return;
    const item: LearningObjective = {
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      achieved: false,
      createdAt: new Date().toISOString(),
    };
    onChange([...objectives, item]);
    setNewText('');
  };

  const handleToggle = (id: string) => {
    if (!editable || !onChange) return;
    onChange(
      objectives.map((obj) =>
        obj.id === id ? { ...obj, achieved: !obj.achieved } : obj
      )
    );
  };

  const handleStartEdit = (obj: LearningObjective) => {
    if (!editable) return;
    setEditingId(obj.id);
    setEditingText(obj.text);
  };

  const handleSaveEdit = (id: string) => {
    if (!editable || !onChange) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    onChange(
      objectives.map((obj) => (obj.id === id ? { ...obj, text: trimmed } : obj))
    );
    setEditingId(null);
    setEditingText('');
  };

  const handleDelete = (id: string) => {
    if (!editable || !onChange) return;
    onChange(objectives.filter((obj) => obj.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingText('');
    }
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    if (!editable || !onChange) return;
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= objectives.length) return;
    const copy = [...objectives];
    const [item] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, item);
    onChange(copy);
  };

  return (
    <section
      className={`bg-white border border-slate-200 rounded-xl ${
        compact ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          {!readOnly && (
            <p className="text-xs text-slate-500 leading-relaxed">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {totalCount > 0 && (
            <span className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
              {achievedCount} / {totalCount} محقق ({pct}%)
            </span>
          )}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {totalCount === 0 ? (
        <div className="py-5 px-4 rounded-lg bg-[#F7F8FA] border border-dashed border-slate-200 text-center text-xs text-slate-500">
          لم تُضف أهداف تعلّم بعد. اكتب هدفًا واضحًا لتحديد ما تريد اكتسابه من هذه المادة.
        </div>
      ) : (
        <ul className="space-y-2">
          {objectives.map((obj, idx) => {
            const isEditing = editingId === obj.id;
            return (
              <li
                key={obj.id}
                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                  obj.achieved
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-[#F7F8FA] border-slate-200'
                }`}
              >
                {editable ? (
                  <button
                    type="button"
                    onClick={() => handleToggle(obj.id)}
                    aria-label={obj.achieved ? 'إلغاء تحقق الهدف' : 'تعيين الهدف كمحقق'}
                    className="mt-0.5 text-slate-500 hover:text-emerald-700 shrink-0 cursor-pointer"
                  >
                    {obj.achieved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <span className="mt-0.5 shrink-0">
                    {obj.achieved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400" />
                    )}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(obj.id);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(obj.id)}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                        title="حفظ التعديل"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md cursor-pointer"
                        title="إلغاء"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p
                      className={`text-sm leading-relaxed break-words ${
                        obj.achieved
                          ? 'line-through text-slate-500'
                          : 'text-slate-800'
                      }`}
                    >
                      {obj.text}
                    </p>
                  )}
                </div>

                {editable && !isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      aria-label="تحريك للأعلى"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === objectives.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      aria-label="تحريك للأسفل"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(obj)}
                      aria-label="تعديل الهدف"
                      className="p-1 text-slate-400 hover:text-[#1E3A5F] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(obj.id)}
                      aria-label="حذف الهدف"
                      className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="أضف هدف تعلّم جديدًا..."
            className="flex-1 min-w-[200px] px-3 py-2 min-h-[38px] text-xs sm:text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#1E3A5F]"
          />
          <button
            type="submit"
            disabled={!newText.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-45 rounded-lg cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>إضافة هدف</span>
          </button>
        </form>
      )}
    </section>
  );
}
