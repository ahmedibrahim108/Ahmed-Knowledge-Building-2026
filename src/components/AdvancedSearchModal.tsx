import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  Calendar,
  CalendarHeart,
  CheckSquare,
  Compass,
  Feather,
  FileText,
  Filter,
  FolderKanban,
  GraduationCap,
  History,
  Layers,
  NotebookPen,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { LearningHubMeta } from '../data/curriculumData';
import {
  RankedSearchResult,
  SEARCH_GROUP_LABELS,
  SearchActionPayload,
  SearchDateRangeFilter,
  SearchDocument,
  SearchEntityType,
  SearchFilterGroup,
  SearchFiltersState,
  SearchSortBy,
  SearchStatusFilter,
  executeAdvancedSearch,
  splitTextForHighlight,
} from '../utils/searchEngine';

interface AdvancedSearchModalProps {
  open: boolean;
  onClose: () => void;
  documents: SearchDocument[];
  hubs: LearningHubMeta[];
  isAdminMode: boolean;
  onSelectAction: (action: SearchActionPayload) => void;
}

const DEFAULT_FILTERS: SearchFiltersState = {
  query: '',
  group: 'all',
  hubId: 'all',
  statusFilter: 'all',
  dateRange: 'all',
  customFrom: '',
  customTo: '',
  sortBy: 'relevance',
};

const MAX_RECENT_QUERIES = 6;
const MAX_RENDERED_RESULTS = 80;

function getHistoryStorageKey(isAdminMode: boolean): string {
  return isAdminMode
    ? 'kb_adv_search_history_admin_v1'
    : 'kb_adv_search_history_public_v1';
}

function loadRecentQueries(isAdminMode: boolean): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getHistoryStorageKey(isAdminMode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, MAX_RECENT_QUERIES);
  } catch {
    return [];
  }
}

function saveRecentQueries(isAdminMode: boolean, queries: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getHistoryStorageKey(isAdminMode),
      JSON.stringify(queries.slice(0, MAX_RECENT_QUERIES))
    );
  } catch {
    // Ignore storage quota restrictions
  }
}

function renderEntityIcon(entityType: SearchEntityType) {
  const cls = 'w-4 h-4 shrink-0 text-[#1E3A5F]';
  switch (entityType) {
    case 'course':
      return <GraduationCap className={cls} aria-hidden="true" />;
    case 'note':
      return <NotebookPen className={cls} aria-hidden="true" />;
    case 'task':
      return <CheckSquare className={cls} aria-hidden="true" />;
    case 'project':
      return <FolderKanban className={cls} aria-hidden="true" />;
    case 'daily_journal':
      return <CalendarHeart className={cls} aria-hidden="true" />;
    case 'reflection':
      return <Feather className={cls} aria-hidden="true" />;
    case 'blog':
      return <BookOpenText className={cls} aria-hidden="true" />;
    case 'path':
      return <Compass className={cls} aria-hidden="true" />;
    case 'book':
      return <BookOpen className={cls} aria-hidden="true" />;
    case 'month':
    case 'calendar':
      return <Calendar className={cls} aria-hidden="true" />;
    case 'meeting':
      return <Users className={cls} aria-hidden="true" />;
    case 'domain':
      return <Layers className={cls} aria-hidden="true" />;
    case 'dental_case':
      return <Stethoscope className={cls} aria-hidden="true" />;
    case 'attachment':
      return <FileText className={cls} aria-hidden="true" />;
    case 'nav':
    default:
      return <ArrowLeft className={cls} aria-hidden="true" />;
  }
}

function HighlightedText({
  text,
  tokens,
  className = '',
}: {
  text: string;
  tokens: string[];
  className?: string;
}) {
  const segments = useMemo(
    () => splitTextForHighlight(text, tokens),
    [text, tokens]
  );
  return (
    <span className={className}>
      {segments.map((seg, idx) =>
        seg.matched ? (
          <mark
            key={idx}
            className="bg-amber-200/80 text-slate-900 px-0.5 rounded-xs font-semibold"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={idx}>{seg.text}</span>
        )
      )}
    </span>
  );
}

export default function AdvancedSearchModal({
  open,
  onClose,
  documents,
  hubs,
  isAdminMode,
  onSelectAction,
}: AdvancedSearchModalProps) {
  const [filters, setFilters] = useState<SearchFiltersState>(DEFAULT_FILTERS);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>(() =>
    loadRecentQueries(isAdminMode)
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setRecentQueries(loadRecentQueries(isAdminMode));
  }, [isAdminMode]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(t);
  }, [open]);

  const { results, groupCounts, tokens } = useMemo(
    () => executeAdvancedSearch(documents, filters),
    [documents, filters]
  );

  const visibleResults = useMemo(
    () => results.slice(0, MAX_RENDERED_RESULTS),
    [results]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [
    filters.query,
    filters.group,
    filters.hubId,
    filters.statusFilter,
    filters.dateRange,
    filters.customFrom,
    filters.customTo,
    filters.sortBy,
  ]);

  useEffect(() => {
    if (!open) return;
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const activeResult: RankedSearchResult | undefined =
    visibleResults[activeIndex] ?? visibleResults[0];

  const hasNonDefaultFilters =
    filters.group !== 'all' ||
    filters.hubId !== 'all' ||
    filters.statusFilter !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.sortBy !== 'relevance';

  const commitRecentQuery = (q: string) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    setRecentQueries((prev) => {
      const next = [clean, ...prev.filter((item) => item !== clean)].slice(
        0,
        MAX_RECENT_QUERIES
      );
      saveRecentQueries(isAdminMode, next);
      return next;
    });
  };

  const handleOpenResult = (res: RankedSearchResult) => {
    commitRecentQuery(filters.query);
    onClose();
    onSelectAction(res.doc.action);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        if (visibleResults.length === 0) return;
        e.preventDefault();
        setActiveIndex((prev) =>
          prev + 1 < visibleResults.length ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        if (visibleResults.length === 0) return;
        e.preventDefault();
        setActiveIndex((prev) =>
          prev - 1 >= 0 ? prev - 1 : visibleResults.length - 1
        );
      } else if (e.key === 'Enter') {
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag === 'SELECT' || tag === 'BUTTON') return;
        if (activeResult) {
          e.preventDefault();
          handleOpenResult(activeResult);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visibleResults.length, activeResult, filters.query]);

  if (!open) return null;

  const availableGroups = SEARCH_GROUP_LABELS.filter(
    (g) => g.id === 'all' || groupCounts[g.id] > 0 || filters.group === g.id
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="البحث المتقدم في المنصة"
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-start justify-center sm:pt-10 sm:px-4 pb-0 sm:pb-6"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[86vh] max-w-5xl bg-white sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Bar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center gap-2.5 bg-white">
          <Search
            className="w-5 h-5 text-[#1E3A5F] shrink-0"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            dir="auto"
            value={filters.query}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, query: e.target.value }))
            }
            placeholder={
              isAdminMode
                ? 'ابحث في الكورسات، التلخيصات، المهام، اليوميات، الخواطر، المقالات، المسارات، الكتب، والملفات...'
                : 'ابحث في الكورسات المتاحة، الخواطر، المقالات، المسارات، والكتب...'
            }
            className="flex-1 min-w-0 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
          />

          {filters.query && (
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, query: '' }))}
              aria-label="مسح نص البحث"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFiltersPanel((v) => !v)}
            aria-expanded={showFiltersPanel}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showFiltersPanel || hasNonDefaultFilters
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">فلاتر متقدمة</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق البحث"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="hidden sm:inline font-mono text-[11px]">Esc</span>
            <X className="w-4 h-4 sm:hidden" />
          </button>
        </div>

        {/* Scope Segmented Tabs */}
        <div className="px-4 sm:px-5 py-2 bg-[#F7F8FA] border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {availableGroups.map((g) => {
            const active = filters.group === g.id;
            const count = groupCounts[g.id];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, group: g.id }))
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#1E3A5F] border border-slate-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border border-transparent'
                }`}
              >
                <span>{g.label}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showFiltersPanel && (
          <div className="px-4 sm:px-5 py-3.5 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Hub Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Filter className="w-3 h-3" aria-hidden="true" />
                <span>المحور المعرفي</span>
              </label>
              <select
                value={filters.hubId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    hubId: e.target.value as SearchFiltersState['hubId'],
                  }))
                }
                className="w-full px-2.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
              >
                <option value="all">جميع المحاور</option>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.shortTitle}
                  </option>
                ))}
              </select>
            </div>

            {/* Status / Property Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                الحالة والخصائص
              </label>
              <select
                value={filters.statusFilter}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    statusFilter: e.target.value as SearchStatusFilter,
                  }))
                }
                className="w-full px-2.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
              >
                <option value="all">كل الحالات</option>
                {isAdminMode && (
                  <>
                    <option value="active">نشط / قيد التعلّم</option>
                    <option value="completed">مكتمل / منجز</option>
                    <option value="public">منشور للعامة</option>
                  </>
                )}
                <option value="has_attachment">يحتوي مرفقات أو صور</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                النطاق الزمني
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: e.target.value as SearchDateRangeFilter,
                  }))
                }
                className="w-full px-2.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
              >
                <option value="all">كل التواريخ</option>
                <option value="today">اليوم فقط</option>
                <option value="last_7">آخر 7 أيام</option>
                <option value="last_30">آخر 30 يومًا</option>
                <option value="custom">نطاق تاريخ مخصص</option>
              </select>
            </div>

            {/* Sort Order & Reset */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                ترتيب النتائج
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: e.target.value as SearchSortBy,
                    }))
                  }
                  className="flex-1 px-2.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                >
                  <option value="relevance">الأكثر صلة</option>
                  <option value="newest">الأحدث أولاً</option>
                  <option value="title">أبجديًا</option>
                </select>
                {hasNonDefaultFilters && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...DEFAULT_FILTERS,
                        query: prev.query,
                      }))
                    }
                    title="إعادة ضبط الفلاتر"
                    className="p-2 text-slate-600 hover:text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 rounded-lg cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {filters.dateRange === 'custom' && (
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <span>من:</span>
                  <input
                    type="date"
                    value={filters.customFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        customFrom: e.target.value,
                      }))
                    }
                    className="px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <span>إلى:</span>
                  <input
                    type="date"
                    value={filters.customTo}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        customTo: e.target.value,
                      }))
                    }
                    className="px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Searches Strip when input is empty */}
        {!filters.query.trim() && recentQueries.length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 min-w-0">
              <History
                className="w-3.5 h-3.5 text-slate-400 shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                عمليات بحث سابقة:
              </span>
              <div className="flex items-center gap-1.5">
                {recentQueries.map((rq) => (
                  <button
                    key={rq}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, query: rq }))
                    }
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-[#F7F8FA] hover:bg-slate-200/70 border border-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {rq}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecentQueries([]);
                saveRecentQueries(isAdminMode, []);
              }}
              className="text-[11px] text-slate-500 hover:text-red-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              مسح السجل
            </button>
          </div>
        )}

        {/* Results Split Area: Results List + Desktop Preview Pane */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Results List */}
          <div className="lg:col-span-7 overflow-y-auto divide-y divide-slate-100 bg-white">
            {visibleResults.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-2.5">
                <Search
                  className="w-8 h-8 text-slate-300 mx-auto"
                  aria-hidden="true"
                />
                <p className="text-sm font-bold text-slate-800">
                  لا توجد نتائج مطابقة لهذا البحث
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  جرّب استخدام كلمات أقل أو إزالة بعض الفلاتر لعرض محتوى أوسع من
                  المنصة.
                </p>
                {hasNonDefaultFilters && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...DEFAULT_FILTERS,
                        query: prev.query,
                      }))
                    }
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إعادة ضبط الفلاتر</span>
                  </button>
                )}
              </div>
            ) : (
              visibleResults.map((res, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={res.doc.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleOpenResult(res)}
                    className={`w-full text-right px-4 sm:px-5 py-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#F3F7FB]' : 'hover:bg-[#F7F8FA]'
                    }`}
                  >
                    <div className="mt-0.5 p-2 rounded-lg bg-[#F7F8FA] border border-slate-200 shrink-0">
                      {renderEntityIcon(res.doc.entityType)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          <HighlightedText
                            text={res.doc.title}
                            tokens={tokens}
                          />
                        </p>
                        <ArrowLeft
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isSelected
                              ? 'text-[#1E3A5F] -translate-x-0.5'
                              : 'text-slate-300'
                          }`}
                          aria-hidden="true"
                        />
                      </div>

                      {res.doc.subtitle && (
                        <p className="text-xs text-slate-600 truncate">
                          <HighlightedText
                            text={res.doc.subtitle}
                            tokens={tokens}
                          />
                        </p>
                      )}

                      {res.snippet && res.snippet !== res.doc.subtitle && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          <HighlightedText
                            text={res.snippet}
                            tokens={tokens}
                          />
                        </p>
                      )}

                      <p className="text-[11px] text-slate-500 truncate tabular-nums">
                        {res.doc.metaLine}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Instant Desktop Preview Pane */}
          <aside className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-[#F7F8FA] border-r border-slate-200 p-5 overflow-y-auto">
            {activeResult ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shrink-0">
                    {renderEntityIcon(activeResult.doc.entityType)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold text-[#1E3A5F]">
                      {activeResult.doc.typeLabel}
                      {activeResult.doc.hubLabel
                        ? ` · ${activeResult.doc.hubLabel}`
                        : ''}
                    </p>
                    <h3 className="font-editorial text-lg font-bold text-slate-900 leading-snug">
                      <HighlightedText
                        text={activeResult.doc.title}
                        tokens={tokens}
                      />
                    </h3>
                  </div>
                </div>

                {activeResult.doc.subtitle && (
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                    <HighlightedText
                      text={activeResult.doc.subtitle}
                      tokens={tokens}
                    />
                  </p>
                )}

                <div className="text-[11px] text-slate-500 border-y border-slate-200 py-2.5 tabular-nums">
                  {activeResult.doc.metaLine}
                </div>

                {activeResult.doc.bodyText ? (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-[260px] overflow-y-auto whitespace-pre-wrap">
                    <HighlightedText
                      text={activeResult.doc.bodyText.slice(0, 900)}
                      tokens={tokens}
                    />
                    {activeResult.doc.bodyText.length > 900 ? '...' : ''}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    اضغط لفتح العنصر والانتقال إليه مباشرة.
                  </p>
                )}
              </div>
            ) : (
              <div className="m-auto text-center text-xs text-slate-400">
                اختر أي نتيجة لعرض تفاصيلها السريعة هنا
              </div>
            )}

            {activeResult && (
              <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 tabular-nums">
                  اضغط Enter للفتح المباشر
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenResult(activeResult)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>فتح الآن</span>
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </aside>
        </div>

        {/* Footer Status & Keyboard Legend */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#F7F8FA] border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
          <span>
            {results.length > MAX_RENDERED_RESULTS
              ? `عرض أول ${MAX_RENDERED_RESULTS} من أصل ${results.length} نتيجة`
              : `${results.length} نتيجة متاحة`}
          </span>
          <div className="hidden sm:flex items-center gap-3">
            <span>↑ ↓ للتنقل</span>
            <span aria-hidden="true">·</span>
            <span>Enter للفتح</span>
            <span aria-hidden="true">·</span>
            <span>Ctrl+K لفتح البحث من أي مكان</span>
          </div>
        </div>
      </div>
    </div>
  );
}
