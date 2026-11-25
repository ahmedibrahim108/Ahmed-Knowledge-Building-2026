import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  Eye,
  EyeOff,
  Layers,
  LayoutGrid,
  ListTree,
  Maximize2,
  PauseCircle,
  PenLine,
  Quote,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  ActivityEntityType,
  DEFAULT_USER_PREFERENCES,
  DailyJournalRecord,
  LearningHubMeta,
  UserPreferences,
  addDaysToDateKey,
  formatShortArabicDate,
  getDayArabicName,
  toLocalDateKey,
} from '../data/curriculumData';
import {
  SavedAudioClipSummary,
  subscribeUserAudioClips,
} from '../utils/audioCache';
import {
  QUOTE_COLOR_THEMES,
  resolveEffectiveDailyQuote,
  rotateDailyQuoteFromLibrary,
} from '../utils/dailyQuotes';
import {
  StoredImageRecord,
  subscribeJournalImagesSummary,
} from '../utils/imageStorage';
import {
  DailyJournalItem,
  JournalNavAction,
  WorkspaceAnalyticsInput,
  buildDailyJournalSummary,
} from '../utils/journalAnalytics';
import {
  OfflineSyncState,
  getOfflineSyncState,
  subscribeOfflineSyncState,
} from '../utils/offlineQueue';
import { syncAllPendingOfflineChanges } from '../utils/offlineSync';
import { richHtmlToPlainText } from '../utils/richText';
import AutoResizeTextarea from './AutoResizeTextarea';
import JournalDayModal, { DiaryTab } from './JournalDayModal';
import JournalGalleryView from './JournalGalleryView';

type DailyJournalViewMode = 'timeline' | 'by_category' | 'overview';
type JournalSurfaceTab = 'dashboard' | 'gallery';

interface DailyJournalViewProps {
  analyticsInput: WorkspaceAnalyticsInput;
  dailyJournals: DailyJournalRecord[];
  canEdit: boolean;
  uid?: string;
  preferences?: UserPreferences;
  onUpdatePreferences?: (updates: Partial<UserPreferences>) => void;
  onRequireAuth: () => void;
  onSaveDailyJournal: (rec: DailyJournalRecord) => void;
  onOpenEntity: (action: JournalNavAction) => void;
  onDeleteActivityLog?: (entryId: string) => void;
  hubs?: LearningHubMeta[];
  externalOpenDayKey?: string | null;
  onConsumeExternalOpenDayKey?: () => void;
}

const TIMELINE_CATEGORY_FILTERS: Array<{
  type: ActivityEntityType;
  label: string;
}> = [
  { type: 'task', label: 'المهام' },
  { type: 'course_task', label: 'دروس الكورسات' },
  { type: 'book_note', label: 'التلخيصات' },
  { type: 'reflection', label: 'الخواطر' },
  { type: 'blog_post', label: 'المقالات' },
  { type: 'calendar_event', label: 'التقويم' },
  { type: 'meeting', label: 'اللقاءات' },
  { type: 'course', label: 'الكورسات' },
];

function statusToneTextClass(tone: DailyJournalItem['statusTone']): string {
  switch (tone) {
    case 'emerald':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'amber':
      return 'text-amber-700 dark:text-amber-400';
    case 'blue':
      return 'text-[#1E3A5F] dark:text-sky-300';
    default:
      return 'text-slate-600 dark:text-slate-300';
  }
}

export default function DailyJournalView({
  analyticsInput,
  dailyJournals,
  canEdit,
  uid,
  preferences,
  onUpdatePreferences,
  onRequireAuth,
  onSaveDailyJournal,
  onOpenEntity,
  onDeleteActivityLog,
  externalOpenDayKey,
  onConsumeExternalOpenDayKey,
}: DailyJournalViewProps) {
  const todayKey = toLocalDateKey();
  const [surfaceTab, setSurfaceTab] = useState<JournalSurfaceTab>('dashboard');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [viewMode, setViewMode] = useState<DailyJournalViewMode>('timeline');

  const [modalDayKey, setModalDayKey] = useState<string | null>(null);
  const [modalInitialCustomize, setModalInitialCustomize] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<DiaryTab>('writing');
  const [showFilters, setShowFilters] = useState(false);

  const [journalImages, setJournalImages] = useState<StoredImageRecord[]>([]);
  const [savedAudioClips, setSavedAudioClips] = useState<SavedAudioClipSummary[]>([]);
  const [syncState, setSyncState] = useState<OfflineSyncState>(() =>
    getOfflineSyncState()
  );

  useEffect(() => {
    if (!externalOpenDayKey) return;
    setSelectedDateKey(externalOpenDayKey);
    setModalInitialCustomize(false);
    setModalInitialTab('writing');
    setModalDayKey(externalOpenDayKey);
    onConsumeExternalOpenDayKey?.();
  }, [externalOpenDayKey, onConsumeExternalOpenDayKey]);

  useEffect(() => {
    const unsubImages = subscribeJournalImagesSummary(uid, setJournalImages);
    const unsubAudio = subscribeUserAudioClips(uid, setSavedAudioClips);
    const unsubSync = subscribeOfflineSyncState(setSyncState);
    return () => {
      unsubImages();
      unsubAudio();
      unsubSync();
    };
  }, [uid]);

  const existingRecord = useMemo(
    () => dailyJournals.find((j) => j.dateKey === selectedDateKey),
    [dailyJournals, selectedDateKey]
  );

  const [reflectionDraft, setReflectionDraft] = useState(
    existingRecord?.reflectionText || ''
  );
  const [highlightsDraft, setHighlightsDraft] = useState(
    existingRecord?.highlightsText || ''
  );
  const [savedToast, setSavedToast] = useState(false);
  const inlineDirtyRef = useRef(false);

  useEffect(() => {
    inlineDirtyRef.current = false;
    setReflectionDraft(existingRecord?.reflectionText || '');
    setHighlightsDraft(existingRecord?.highlightsText || '');
  }, [selectedDateKey, existingRecord?.reflectionText, existingRecord?.highlightsText]);

  // Smooth debounced autosave for inline reflection notes
  useEffect(() => {
    if (!canEdit || !inlineDirtyRef.current) return;
    const prevRef = existingRecord?.reflectionText || '';
    const prevHigh = existingRecord?.highlightsText || '';
    if (reflectionDraft === prevRef && highlightsDraft === prevHigh) {
      inlineDirtyRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      inlineDirtyRef.current = false;
      onSaveDailyJournal({
        ...(existingRecord || {}),
        dateKey: selectedDateKey,
        reflectionText: reflectionDraft,
        highlightsText: highlightsDraft,
        moodLabel: existingRecord?.moodLabel,
        energyScore: existingRecord?.energyScore,
        dailyQuote: existingRecord?.dailyQuote,
        updatedAtMs: Date.now(),
      });
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 2000);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [
    canEdit,
    reflectionDraft,
    highlightsDraft,
    selectedDateKey,
    existingRecord,
    onSaveDailyJournal,
  ]);

  const hiddenActivityIds = preferences?.hiddenActivityIds || [];
  const hiddenActivityTypes = preferences?.hiddenActivityTypes || [];

  const summary = useMemo(
    () =>
      buildDailyJournalSummary(selectedDateKey, analyticsInput, {
        hiddenActivityIds,
        hiddenActivityTypes,
      }),
    [selectedDateKey, analyticsInput, hiddenActivityIds, hiddenActivityTypes]
  );

  const resolvedQuote = useMemo(
    () =>
      resolveEffectiveDailyQuote({
        dateKey: selectedDateKey,
        journalQuote: existingRecord?.dailyQuote,
        quotesLibrary: preferences?.quotesLibrary,
        pinnedDailyQuoteId: preferences?.pinnedDailyQuoteId,
      }),
    [
      selectedDateKey,
      existingRecord?.dailyQuote,
      preferences?.quotesLibrary,
      preferences?.pinnedDailyQuoteId,
    ]
  );

  // Recent active calendar days for quick switcher
  const recentActiveDays = useMemo(() => {
    const keys = new Set<string>([todayKey]);
    for (const j of dailyJournals) keys.add(j.dateKey);
    for (const l of analyticsInput.activityLogs) keys.add(l.dateKey);
    return Array.from(keys)
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 14);
  }, [todayKey, dailyJournals, analyticsInput.activityLogs]);

  const openWritingModal = (dayKey: string, tab: DiaryTab = 'writing', customize = false) => {
    setModalInitialTab(tab);
    setModalInitialCustomize(customize);
    setModalDayKey(dayKey);
  };

  const writtenPreviewText = useMemo(() => {
    if (!existingRecord?.bodyHtml) return '';
    return richHtmlToPlainText(existingRecord.bodyHtml).trim();
  }, [existingRecord?.bodyHtml]);

  const handleRotateDayQuote = () => {
    if (!canEdit) return onRequireAuth();
    const rotated = rotateDailyQuoteFromLibrary(
      selectedDateKey,
      resolvedQuote.quote.text,
      preferences?.quotesLibrary || []
    );
    if (preferences?.pinnedDailyQuoteId && onUpdatePreferences) {
      onUpdatePreferences({ pinnedDailyQuoteId: null });
    }
    onSaveDailyJournal({
      ...(existingRecord || {}),
      dateKey: selectedDateKey,
      reflectionText: reflectionDraft,
      highlightsText: highlightsDraft,
      dailyQuote: rotated.quote,
      updatedAtMs: Date.now(),
    });
  };

  const handleToggleFilterType = (entityType: ActivityEntityType) => {
    if (!canEdit) return onRequireAuth();
    if (!onUpdatePreferences) return;
    const isHidden = hiddenActivityTypes.includes(entityType);
    const nextTypes = isHidden
      ? hiddenActivityTypes.filter((t) => t !== entityType)
      : [...hiddenActivityTypes, entityType];
    onUpdatePreferences({ hiddenActivityTypes: nextTypes });
  };

  const handleHideTimelineItem = (item: DailyJournalItem) => {
    if (!canEdit) return onRequireAuth();
    if (!onUpdatePreferences) return;
    const nextIds = Array.from(new Set([...hiddenActivityIds, item.key]));
    onUpdatePreferences({ hiddenActivityIds: nextIds });
  };

  const handleResetHiddenFilters = () => {
    if (!canEdit) return onRequireAuth();
    if (!onUpdatePreferences) return;
    onUpdatePreferences({ hiddenActivityIds: [], hiddenActivityTypes: [] });
  };

  const activeModalRecord = useMemo(
    () =>
      modalDayKey
        ? dailyJournals.find((j) => j.dateKey === modalDayKey)
        : undefined,
    [dailyJournals, modalDayKey]
  );

  const renderEntryCard = (item: DailyJournalItem) => (
    <div
      key={item.key}
      role="button"
      tabIndex={0}
      onClick={() => onOpenEntity(item.navAction)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenEntity(item.navAction);
        }
      }}
      className="w-full text-right p-3 rounded-xl bg-[#F7F8FA] hover:bg-white border border-slate-200 hover:border-[#1E3A5F]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] transition-colors flex flex-wrap items-center justify-between gap-2 cursor-pointer group"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: item.hubAccentHex }}
          />
          <span className="font-semibold text-slate-700">{item.typeLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{item.hubTitle}</span>
          {item.timeLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {item.timeLabel}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className={`font-semibold ${statusToneTextClass(item.statusTone)}`}>
            {item.statusLabel}
          </span>
        </div>
        <p className="text-sm font-bold text-slate-900 group-hover:text-[#1E3A5F] truncate">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-xs text-slate-600 truncate">{item.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onUpdatePreferences && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHideTimelineItem(item);
            }}
            title="إخفاء من السجل"
            aria-label={`إخفاء ${item.title} من السجل`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        {item.activityLogId && onDeleteActivityLog && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!canEdit) return onRequireAuth();
              onDeleteActivityLog(item.activityLogId!);
            }}
            title="حذف من سجل النشاط"
            aria-label={`حذف ${item.title} من سجل النشاط`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        <ArrowLeft
          className="w-4 h-4 text-slate-400 group-hover:text-[#1E3A5F] transition-transform group-hover:-translate-x-0.5 mr-1"
          aria-hidden="true"
        />
      </div>
    </div>
  );

  const quoteColorTheme =
    (resolvedQuote.customQuote?.colorKey &&
      QUOTE_COLOR_THEMES[resolvedQuote.customQuote.colorKey]) ||
    QUOTE_COLOR_THEMES.amber;

  return (
    <div className="space-y-5">
      {/* Offline / Pending Database Sync Banner */}
      {(!syncState.isOnline || syncState.totalPendingCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50/90 text-amber-950">
          <div className="flex items-center gap-2.5 text-xs">
            <CloudOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">
                {syncState.isOnline
                  ? `يوجد ${syncState.totalPendingCount} تعديلات أو ملفات محفوظة محليًا بانتظار المزامنة`
                  : 'أنت تعمل حاليًا دون اتصال بالإنترنت — تُحفظ اليوميات والصور محليًا'}
              </p>
              {syncState.lastSyncError && (
                <p className="text-[11px] text-rose-700 mt-0.5">{syncState.lastSyncError}</p>
              )}
            </div>
          </div>
          {syncState.isOnline && uid && (
            <button
              type="button"
              disabled={syncState.isSyncing}
              onClick={() => void syncAllPendingOfflineChanges(uid)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1E3A5F] text-white hover:bg-[#162C49] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {syncState.isSyncing
                  ? 'جاري المزامنة...'
                  : 'مزامنة مع قاعدة البيانات الآن'}
              </span>
            </button>
          )}
        </div>
      )}
      {/* Journal Mode Navigation + Primary Write CTA */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-slate-200 rounded-2xl p-2 sm:px-4">
        <div
          role="tablist"
          aria-label="طرق عرض اليوميات"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={surfaceTab === 'dashboard'}
            onClick={() => setSurfaceTab('dashboard')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 min-h-[38px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              surfaceTab === 'dashboard'
                ? 'bg-white text-[#1E3A5F] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>اليوم</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={surfaceTab === 'gallery'}
            onClick={() => setSurfaceTab('gallery')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 min-h-[38px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              surfaceTab === 'gallery'
                ? 'bg-white text-[#1E3A5F] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
            <span>دفتر اليوميات</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => openWritingModal(selectedDateKey, 'writing', false)}
          className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 min-h-[42px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {selectedDateKey === todayKey
              ? 'كتابة في يومية اليوم'
              : `كتابة في ${formatShortArabicDate(selectedDateKey)}`}
          </span>
        </button>
      </div>

      {surfaceTab === 'gallery' ? (
        <JournalGalleryView
          uid={uid}
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
          dailyJournals={dailyJournals}
          analyticsInput={analyticsInput}
          journalImages={journalImages}
          savedAudioClips={savedAudioClips}
          onSaveDailyJournal={onSaveDailyJournal}
          onOpenDay={(dk, openCustomize = false) => {
            setSelectedDateKey(dk);
            openWritingModal(dk, 'writing', openCustomize);
          }}
        />
      ) : (
        <>
      {/* Compact Header, Date Switcher & Scannable Metrics */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
            <h1 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
              يوميات {getDayArabicName(selectedDateKey)}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center gap-0.5 bg-[#F7F8FA] border border-slate-200 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, -1))}
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center hover:bg-white rounded-lg text-slate-700 cursor-pointer"
                aria-label="اليوم السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="relative inline-flex items-center">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 text-xs font-semibold text-slate-800 hover:bg-white rounded-lg tabular-nums whitespace-nowrap pointer-events-none"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>{formatShortArabicDate(selectedDateKey)}</span>
                </span>
                <input
                  type="date"
                  value={selectedDateKey}
                  onClick={(e) => {
                    const input = e.currentTarget as HTMLInputElement & {
                      showPicker?: () => void;
                    };
                    if (typeof input.showPicker === 'function') {
                      try {
                        input.showPicker();
                      } catch {
                        // Fallback to native input click behavior
                      }
                    }
                  }}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDateKey(e.target.value);
                  }}
                  aria-label="اختيار تاريخ اليومية"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg"
                />
              </div>

              <button
                type="button"
                onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, 1))}
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center hover:bg-white rounded-lg text-slate-700 cursor-pointer"
                aria-label="اليوم التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {selectedDateKey !== todayKey && (
              <button
                type="button"
                onClick={() => setSelectedDateKey(todayKey)}
                className="px-3 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] rounded-xl cursor-pointer whitespace-nowrap"
              >
                اليوم
              </button>
            )}
          </div>
        </div>

        {/* Recent active days quick strip */}
        {recentActiveDays.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {recentActiveDays.map((dk) => {
              const active = dk === selectedDateKey;
              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDateKey(dk)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border cursor-pointer tabular-nums shrink-0 ${
                    active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dk === todayKey ? `اليوم · ${dk.slice(5)}` : `${getDayArabicName(dk)} ${dk.slice(5)}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Calm Unboxed Daily Metrics Strip */}
        <div className="flex items-center justify-between sm:justify-start gap-5 sm:gap-8 overflow-x-auto no-scrollbar py-2 border-y border-slate-100 text-xs tabular-nums">
          <div className="shrink-0">
            <span className="text-slate-500">الإجمالي </span>
            <span className="font-bold text-slate-900">{summary.counts.total}</span>
          </div>
          <div className="shrink-0">
            <span className="text-slate-500">تم إنجازه </span>
            <span className="font-bold text-emerald-700">{summary.counts.completed}</span>
          </div>
          <div className="shrink-0">
            <span className="text-slate-500">قيد العمل </span>
            <span className="font-bold text-sky-700">
              {summary.counts.inProgress + summary.counts.learningActivities}
            </span>
          </div>
          <div className="shrink-0">
            <span className="text-slate-500">مؤجّل </span>
            <span className="font-bold text-amber-700">{summary.counts.postponed}</span>
          </div>
          <div className="shrink-0">
            <span className="text-slate-500">تلخيصات وخواطر </span>
            <span className="font-bold text-[#1E3A5F]">
              {summary.counts.summariesAndNotes + summary.counts.reflections}
            </span>
          </div>
        </div>

        {/* View Mode Switcher + Collapsible Category Filter */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>التسلسل</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('by_category')}
                className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'by_category'
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حسب المسار</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'overview'
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ListTree className="w-3.5 h-3.5" aria-hidden="true" />
                <span>نظرة عامة</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(hiddenActivityIds.length > 0 || hiddenActivityTypes.length > 0) &&
                onUpdatePreferences && (
                  <button
                    type="button"
                    onClick={handleResetHiddenFilters}
                    className="inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-xl text-[11px] font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] whitespace-nowrap cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="tabular-nums">
                      إظهار الكل ({hiddenActivityIds.length + hiddenActivityTypes.length})
                    </span>
                  </button>
                )}

              {onUpdatePreferences && (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`inline-flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-xl text-xs font-semibold border whitespace-nowrap cursor-pointer ${
                    showFilters
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">تصفية</span>
                </button>
              )}
            </div>
          </div>

          {showFilters && onUpdatePreferences && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {TIMELINE_CATEGORY_FILTERS.map((cat) => {
                const active = !hiddenActivityTypes.includes(cat.type);
                return (
                  <button
                    key={cat.type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleToggleFilterType(cat.type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:text-slate-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area + Daily Reflection Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right Main Activity Log View */}
        <div className="lg:col-span-8 space-y-4">
          {summary.timelineItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <Sparkles className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-900">
                لا توجد أنشطة مسجلة لهذا اليوم بعد
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                بمجرد إنجاز مهمة أو كتابة تلخيص أو مراجعة درس أو جدولة نشاط ليوم{' '}
                <span className="tabular-nums font-semibold">{selectedDateKey}</span>{' '}
                سيظهر هنا تلقائيًا مع رابط مباشر لفتحه وتعديله.
              </p>
            </div>
          ) : viewMode === 'timeline' ? (
            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  التسلسل الزمني لنشاط اليوم ({summary.timelineItems.length})
                </h2>
                <span className="text-[11px] text-slate-500">
                  اضغط على أي عنصر لفتحه مباشرة
                </span>
              </div>
              <div className="space-y-2 max-h-[560px] overflow-y-auto thin-scrollbar pl-1">
                {summary.timelineItems.map(renderEntryCard)}
              </div>
            </section>
          ) : viewMode === 'by_category' ? (
            <div className="space-y-4">
              {summary.groupedByHub.map((grp) => (
                <section
                  key={grp.hubId}
                  className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: grp.hubAccentHex }}
                      />
                      <h2 className="text-base font-bold text-slate-900">
                        {grp.hubTitle}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      {grp.items.length} عناصر
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto thin-scrollbar pl-1">
                    {grp.items.map(renderEntryCard)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            /* Daily Overview Mode: grouped by outcome status */
            <div className="space-y-4">
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  <h2 className="text-base font-bold text-slate-900">
                    ما تم إنجازه وتلخيصه اليوم
                  </h2>
                </div>
                {summary.timelineItems.filter(
                  (i) =>
                    i.statusCategory === 'completed' ||
                    i.statusCategory === 'note' ||
                    i.statusCategory === 'reflection' ||
                    i.statusCategory === 'learning'
                ).length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد إنجازات مسجلة بعد.</p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto thin-scrollbar pl-1">
                    {summary.timelineItems
                      .filter(
                        (i) =>
                          i.statusCategory === 'completed' ||
                          i.statusCategory === 'note' ||
                          i.statusCategory === 'reflection' ||
                          i.statusCategory === 'learning'
                      )
                      .map(renderEntryCard)}
                  </div>
                )}
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <PauseCircle className="w-4 h-4 text-amber-700" aria-hidden="true" />
                  <h2 className="text-base font-bold text-slate-900">
                    مهام قيد التنفيذ أو مؤجّلة
                  </h2>
                </div>
                {summary.timelineItems.filter(
                  (i) =>
                    i.statusCategory === 'in_progress' || i.statusCategory === 'postponed'
                ).length === 0 ? (
                  <p className="text-xs text-slate-500">
                    لا توجد مهام معلقة أو مؤجّلة في هذا اليوم.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto thin-scrollbar pl-1">
                    {summary.timelineItems
                      .filter(
                        (i) =>
                          i.statusCategory === 'in_progress' ||
                          i.statusCategory === 'postponed'
                      )
                      .map(renderEntryCard)}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Daily Written Preview + Quick Reflection & Quote */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Quick Journal Page Preview Card (1-tap resume/write) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => openWritingModal(selectedDateKey, 'writing', false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWritingModal(selectedDateKey, 'writing', false);
              }
            }}
            className="bg-white border border-slate-200 hover:border-[#1E3A5F]/40 rounded-2xl p-4 space-y-2 cursor-pointer transition-colors group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A5F]">
                <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تدوين اليوم</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 group-hover:text-[#1E3A5F]">
                <Maximize2 className="w-3 h-3" aria-hidden="true" />
                <span>فتح المحرر</span>
              </span>
            </div>
            {existingRecord?.title?.trim() || writtenPreviewText ? (
              <div className="space-y-1">
                {existingRecord?.title?.trim() && (
                  <p className="font-editorial text-base font-bold text-slate-900 line-clamp-1">
                    {existingRecord.title}
                  </p>
                )}
                {writtenPreviewText && (
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {writtenPreviewText}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                مساحة هادئة للكتابة الحرة، إضافة الصور، والمذكرات الصوتية لهذا اليوم — اضغط للبدء.
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                تأمل سريع
              </h2>
              {savedToast && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>محفوظ</span>
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                أهم نقطة اليوم
              </label>
              <AutoResizeTextarea
                minRows={2}
                value={highlightsDraft}
                onChange={(e) => {
                  if (!canEdit) return onRequireAuth();
                  inlineDirtyRef.current = true;
                  setHighlightsDraft(e.target.value);
                }}
                placeholder="أبرز إنجاز أو فكرة تعلّمتها..."
                className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                تأمل الختام
              </label>
              <AutoResizeTextarea
                minRows={3}
                value={reflectionDraft}
                onChange={(e) => {
                  if (!canEdit) return onRequireAuth();
                  inlineDirtyRef.current = true;
                  setReflectionDraft(e.target.value);
                }}
                placeholder="كيف كان يومك؟ (يُحفظ تلقائيًا)"
                className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>

          {/* Quote of the Day Card */}
          <div
            data-custom-card-surface="light"
            className={`border rounded-2xl p-4 space-y-2 ${quoteColorTheme.cardClass}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Quote
                  className={`w-3.5 h-3.5 ${quoteColorTheme.accentTextClass}`}
                  aria-hidden="true"
                />
                <span>حكمة اليوم</span>
                {resolvedQuote.quote.theme && (
                  <>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="font-medium text-slate-600">
                      {resolvedQuote.quote.theme}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleRotateDayQuote}
                title="تبديل حكمة اليوم"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>تبديل</span>
              </button>
            </div>
            <blockquote className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
              «{resolvedQuote.quote.text}»
            </blockquote>
            {resolvedQuote.quote.author && (
              <p className="text-[11px] text-slate-600">— {resolvedQuote.quote.author}</p>
            )}
          </div>
        </aside>
      </div>
        </>
      )}

      {modalDayKey && (
        <JournalDayModal
          open={Boolean(modalDayKey)}
          dateKey={modalDayKey}
          onChangeDateKey={(nextKey) => {
            setModalInitialCustomize(false);
            setSelectedDateKey(nextKey);
            setModalDayKey(nextKey);
          }}
          onClose={() => {
            setModalDayKey(null);
            setModalInitialCustomize(false);
          }}
          journalRecord={activeModalRecord}
          analyticsInput={analyticsInput}
          canEdit={canEdit}
          uid={uid}
          preferences={preferences || DEFAULT_USER_PREFERENCES}
          onUpdatePreferences={onUpdatePreferences}
          onRequireAuth={onRequireAuth}
          onSaveDailyJournal={onSaveDailyJournal}
          onOpenEntity={onOpenEntity}
          savedAudioClips={savedAudioClips}
          onAudioClipSaved={(clip) =>
            setSavedAudioClips((prev) =>
              prev.some((c) => c.id === clip.id) ? prev : [clip, ...prev]
            )
          }
          onAudioClipDeleted={(clipId) =>
            setSavedAudioClips((prev) => prev.filter((c) => c.id !== clipId))
          }
          initialShowCustomize={modalInitialCustomize}
          initialTab={modalInitialTab}
        />
      )}
    </div>
  );
}
