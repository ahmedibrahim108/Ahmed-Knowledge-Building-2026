import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Edit3,
  FolderPlus,
  Layers,
  Pin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  NOTE_COLOR_THEMES,
  NoteColorKey,
  PinCollection,
  PinEntityType,
} from '../data/curriculumData';

const PIN_SWATCH_COLORS: Array<{
  key: NoteColorKey;
  label: string;
  chipActive: string;
  dotClass: string;
}> = [
  {
    key: 'navy',
    label: 'كحلي',
    chipActive: 'bg-[#1E3A5F] text-white border-[#1E3A5F]',
    dotClass: 'bg-[#1E3A5F]',
  },
  {
    key: 'emerald',
    label: 'أخضر',
    chipActive: 'bg-emerald-700 text-white border-emerald-700',
    dotClass: 'bg-emerald-600',
  },
  {
    key: 'amber',
    label: 'عنبر',
    chipActive: 'bg-amber-700 text-white border-amber-700',
    dotClass: 'bg-amber-500',
  },
  {
    key: 'rose',
    label: 'وردي',
    chipActive: 'bg-rose-700 text-white border-rose-700',
    dotClass: 'bg-rose-500',
  },
  {
    key: 'violet',
    label: 'بنفسجي',
    chipActive: 'bg-violet-700 text-white border-violet-700',
    dotClass: 'bg-violet-600',
  },
];

export function isEntityInCollection(
  col: PinCollection,
  entityType: PinEntityType,
  entityId: string
): boolean {
  return col.items.some(
    (it) => it.entityType === entityType && it.entityId === entityId
  );
}

export function isEntityPinnedAnywhere(
  collections: PinCollection[],
  entityType: PinEntityType,
  entityId: string
): boolean {
  return collections.some((col) => isEntityInCollection(col, entityType, entityId));
}

interface PinCollectionsBarProps {
  collections: PinCollection[];
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  canEdit: boolean;
  onSaveCollection: (col: PinCollection) => void;
  onDeleteCollection: (id: string) => void;
  filterEntityType?: PinEntityType;
  compact?: boolean;
}

export function PinCollectionsBar({
  collections,
  activeCollectionId,
  onSelectCollection,
  canEdit,
  onSaveCollection,
  onDeleteCollection,
  filterEntityType,
  compact = false,
}: PinCollectionsBarProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState<NoteColorKey>('navy');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState<NoteColorKey>('navy');

  const sortedCollections = [...collections].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAtMs - b.createdAtMs
  );

  const countFor = (col: PinCollection) =>
    filterEntityType
      ? col.items.filter((it) => it.entityType === filterEntityType).length
      : col.items.length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const title = newTitle.trim();
    if (!title) return;
    const now = Date.now();
    onSaveCollection({
      id: `pincol_${now}_${Math.floor(Math.random() * 1000)}`,
      title,
      description: newDesc.trim() || undefined,
      colorKey: newColor,
      sortOrder: collections.length,
      items: [],
      createdAtMs: now,
      updatedAtMs: now,
    });
    setNewTitle('');
    setNewDesc('');
  };

  const handleSaveEdit = (col: PinCollection) => {
    const t = editTitle.trim();
    if (!t) return;
    onSaveCollection({
      ...col,
      title: t,
      description: editDesc.trim() || undefined,
      colorKey: editColor,
      updatedAtMs: Date.now(),
    });
    setEditingId(null);
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl ${
        compact ? 'p-2.5' : 'p-3 sm:p-3.5'
      } space-y-2.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Pin className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-900">
            قوائم التثبيت والتركيز (Saved Pins)
          </span>
          {activeCollectionId && (
            <span className="text-[11px] font-medium text-[#1E3A5F] bg-[#F0F4F9] px-2 py-0.5 rounded-md">
              وضع التركيز مُفعّل
            </span>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{manageOpen ? 'إغلاق الإدارة' : 'إدارة القوائم'}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => onSelectCollection(null)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
            activeCollectionId === null
              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
              : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          <span>عرض الكل</span>
        </button>

        {sortedCollections.map((col) => {
          const isActive = activeCollectionId === col.id;
          const swatch =
            PIN_SWATCH_COLORS.find((s) => s.key === col.colorKey) ??
            PIN_SWATCH_COLORS[0];
          const itemCnt = countFor(col);
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => onSelectCollection(isActive ? null : col.id)}
              title={col.description || col.title}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                isActive
                  ? swatch.chipActive
                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isActive ? 'bg-white' : swatch.dotClass
                }`}
              />
              <span>{col.title}</span>
              <span
                className={`text-[10px] tabular-nums px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {itemCnt}
              </span>
            </button>
          );
        })}

        {sortedCollections.length === 0 && (
          <span className="text-[11px] text-slate-500 px-1">
            لا توجد قوائم تثبيت مخصصة بعد — أنشئ قائمة مثل «تركيز التسويق» أو «مراجعة مهمة».
          </span>
        )}
      </div>

      {manageOpen && canEdit && (
        <div className="pt-2.5 border-t border-slate-100 space-y-3">
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="اسم قائمة التثبيت (مثلاً: أدرسه حاليًا، أولوية هذا الشهر)"
              className="sm:col-span-5 px-3 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              required
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="وصف مختصر (اختياري)"
              className="sm:col-span-4 px-3 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
            <div className="sm:col-span-3 flex items-center gap-2">
              <div className="flex items-center gap-1">
                {PIN_SWATCH_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setNewColor(c.key)}
                    aria-label={c.label}
                    className={`w-5 h-5 rounded-full ${c.dotClass} cursor-pointer ${
                      newColor === c.key ? 'ring-2 ring-offset-1 ring-[#1E3A5F]' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إنشاء</span>
              </button>
            </div>
          </form>

          {sortedCollections.length > 0 && (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto thin-scrollbar">
              {sortedCollections.map((col) => {
                const isEditing = editingId === col.id;
                const theme = NOTE_COLOR_THEMES[col.colorKey] ?? NOTE_COLOR_THEMES.default;
                return (
                  <div
                    key={col.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F7F8FA] border border-slate-200 text-xs"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 min-w-[140px] px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="الوصف..."
                          className="flex-1 min-w-[140px] px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <div className="flex items-center gap-1">
                          {PIN_SWATCH_COLORS.map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setEditColor(c.key)}
                              aria-label={c.label}
                              className={`w-4 h-4 rounded-full ${c.dotClass} cursor-pointer ${
                                editColor === c.key ? 'ring-2 ring-offset-1 ring-[#1E3A5F]' : 'opacity-70'
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(col)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-[#1E3A5F] text-white rounded-lg cursor-pointer"
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.swatchClass}`}
                          />
                          <span className="font-bold text-slate-900 truncate">
                            {col.title}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            ({col.items.length} عناصر)
                          </span>
                          {col.description && (
                            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
                              — {col.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(col.id);
                              setEditTitle(col.title);
                              setEditDesc(col.description || '');
                              setEditColor(col.colorKey);
                            }}
                            aria-label={`تعديل ${col.title}`}
                            className="p-1 text-slate-500 hover:text-[#1E3A5F] rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (activeCollectionId === col.id) {
                                onSelectCollection(null);
                              }
                              onDeleteCollection(col.id);
                            }}
                            title="حذف قائمة التثبيت فقط (تبقى العناصر محفوظة)"
                            aria-label={`حذف قائمة ${col.title}`}
                            className="p-1 text-slate-400 hover:text-red-700 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PinEntityButtonProps {
  entityType: PinEntityType;
  entityId: string;
  collections: PinCollection[];
  canEdit: boolean;
  onToggleItemInCollection: (
    collectionId: string,
    entityType: PinEntityType,
    entityId: string
  ) => void;
  onQuickCreateCollection?: (title: string, entityType: PinEntityType, entityId: string) => void;
  size?: 'xs' | 'sm';
}

export function PinEntityButton({
  entityType,
  entityId,
  collections,
  canEdit,
  onToggleItemInCollection,
  onQuickCreateCollection,
  size = 'xs',
}: PinEntityButtonProps) {
  const [open, setOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const pinnedCols = collections.filter((c) =>
    isEntityInCollection(c, entityType, entityId)
  );
  const isPinned = pinnedCols.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!canEdit && !isPinned) return null;

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!canEdit) return;
          setOpen((v) => !v);
        }}
        title={
          isPinned
            ? `مثبّت في: ${pinnedCols.map((c) => c.title).join('، ')}`
            : 'تثبيت في قائمة تركيز'
        }
        aria-label="تثبيت في قوائم التركيز"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-lg border transition-colors cursor-pointer ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-2 py-1 text-[11px]'
        } ${
          isPinned
            ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-[#1E3A5F]'
        }`}
      >
        <Bookmark
          className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-500 text-amber-600' : ''}`}
          aria-hidden="true"
        />
        {isPinned && (
          <span className="tabular-nums text-[10px]">
            {pinnedCols.length === 1 ? pinnedCols[0].title : pinnedCols.length}
          </span>
        )}
      </button>

      {open && canEdit && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 z-40 space-y-2"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-800">
              تثبيت في قائمة تركيز
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-[180px] overflow-y-auto thin-scrollbar space-y-1">
            {collections.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-1.5 text-center">
                أنشئ أول قائمة تثبيت بالأسفل.
              </p>
            ) : (
              collections.map((col) => {
                const active = isEntityInCollection(col, entityType, entityId);
                const swatch =
                  PIN_SWATCH_COLORS.find((s) => s.key === col.colorKey) ??
                  PIN_SWATCH_COLORS[0];
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onToggleItemInCollection(col.id, entityType, entityId)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-right cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#F0F4F9] text-[#1E3A5F] font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${swatch.dotClass}`} />
                      <span className="truncate">{col.title}</span>
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {onQuickCreateCollection && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = quickTitle.trim();
                if (!clean) return;
                onQuickCreateCollection(clean, entityType, entityId);
                setQuickTitle('');
              }}
              className="pt-1.5 border-t border-slate-100 flex items-center gap-1"
            >
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="قائمة جديدة..."
                className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                type="submit"
                className="px-2 py-1 text-[11px] font-semibold bg-[#1E3A5F] text-white rounded-lg cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
