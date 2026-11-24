import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ListTree,
  PauseCircle,
  PenLine,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  DailyJournalRecord,
  LearningHubMeta,
  addDaysToDateKey,
  formatShortArabicDate,
  getDayArabicName,
  toLocalDateKey,
} from '../data/curriculumData';
import {
  DailyJournalItem,
  JournalNavAction,
  WorkspaceAnalyticsInput,
  buildDailyJournalSummary,
} from '../utils/journalAnalytics';
import AutoResizeTextarea from './AutoResizeTextarea';

type DailyJournalViewMode = 'timeline' | 'by_category' | 'overview';

interface DailyJournalViewProps {
  analyticsInput: WorkspaceAnalyticsInput;
  dailyJournals: DailyJournalRecord[];
  canEdit: boolean;
  onRequireAuth: () => void;
  onSaveDailyJournal: (rec: DailyJournalRecord) => void;
  onOpenEntity: (action: JournalNavAction) => void;
  hubs?: LearningHubMeta[];
}

function statusPillClass(tone: DailyJournalItem['statusTone']): string {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'amber':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'blue':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function DailyJournalView({
  analyticsInput,
  dailyJournals,
  canEdit,
  onRequireAuth,
  onSaveDailyJournal,
  onOpenEntity,
}: DailyJournalViewProps) {
  const todayKey = toLocalDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [viewMode, setViewMode] = useState<DailyJournalViewMode>('timeline');

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

  useEffect(() => {
    setReflectionDraft(existingRecord?.reflectionText || '');
    setHighlightsDraft(existingRecord?.highlightsText || '');
  }, [selectedDateKey, existingRecord?.reflectionText, existingRecord?.highlightsText]);

  const summary = useMemo(
    () => buildDailyJournalSummary(selectedDateKey, analyticsInput),
    [selectedDateKey, analyticsInput]
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

  const handleSaveReflection = () => {
    if (!canEdit) return onRequireAuth();
    onSaveDailyJournal({
      dateKey: selectedDateKey,
      reflectionText: reflectionDraft,
      highlightsText: highlightsDraft,
      moodLabel: existingRecord?.moodLabel,
      energyScore: existingRecord?.energyScore,
      updatedAtMs: Date.now(),
    });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2200);
  };

  const renderEntryCard = (item: DailyJournalItem) => (
    <button
      key={item.key}
      type="button"
      onClick={() => onOpenEntity(item.navAction)}
      className="w-full text-right p-3 rounded-xl bg-[#F7F8FA] hover:bg-white border border-slate-200 hover:border-[#1E3A5F]/40 transition-colors flex flex-wrap items-center justify-between gap-2 cursor-pointer group"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: item.hubAccentHex }}
          />
          <span className="text-[11px] font-semibold text-slate-600">
            {item.typeLabel}
          </span>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-[11px] text-slate-600">{item.hubTitle}</span>
          {item.timeLabel && (
            <>
              <span className="text-[11px] text-slate-400">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {item.timeLabel}
              </span>
            </>
          )}
        </div>
        <p className="text-sm font-bold text-slate-900 group-hover:text-[#1E3A5F] truncate">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-xs text-slate-600 truncate">{item.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${statusPillClass(
            item.statusTone
          )}`}
        >
          {item.statusLabel}
        </span>
        <ArrowLeft
          className="w-4 h-4 text-slate-400 group-hover:text-[#1E3A5F] transition-transform group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header & Date Navigator */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                اليوميات التلقائية
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              صفحة يومية تتجدد تلقائيًا لكل يوم بالتاريخ المحلي وتجمع كل ما درسته ولخّصته وأنجزته أو أجّلته دون تكرار.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, -1))}
              className="p-2 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              aria-label="اليوم السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F7F8FA] border border-slate-200 rounded-xl">
              <Calendar className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <div className="text-xs">
                <span className="font-bold text-slate-900">
                  {getDayArabicName(selectedDateKey)}
                </span>{' '}
                <span className="text-slate-600 tabular-nums">
                  {formatShortArabicDate(selectedDateKey)}
                </span>
              </div>
              <input
                type="date"
                value={selectedDateKey}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateKey(e.target.value);
                }}
                aria-label="اختيار تاريخ اليومية"
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, 1))}
              className="p-2 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
              aria-label="اليوم التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {selectedDateKey !== todayKey && (
              <button
                type="button"
                onClick={() => setSelectedDateKey(todayKey)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
              >
                العودة لليوم
              </button>
            )}
          </div>
        </div>

        {/* Recent active days quick strip */}
        {recentActiveDays.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {recentActiveDays.map((dk) => {
              const active = dk === selectedDateKey;
              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDateKey(dk)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border cursor-pointer tabular-nums ${
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

        {/* Daily Stats Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
          <div className="p-3 rounded-xl bg-[#F7F8FA] border border-slate-200">
            <p className="text-[11px] text-slate-500">إجمالي الأحداث</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {summary.counts.total}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            <p className="text-[11px] text-emerald-800">تم إنجازه</p>
            <p className="text-xl font-bold text-emerald-900 tabular-nums mt-0.5">
              {summary.counts.completed}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80">
            <p className="text-[11px] text-sky-800">قيد العمل والتعلّم</p>
            <p className="text-xl font-bold text-sky-900 tabular-nums mt-0.5">
              {summary.counts.inProgress + summary.counts.learningActivities}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <p className="text-[11px] text-amber-800">مؤجّل</p>
            <p className="text-xl font-bold text-amber-900 tabular-nums mt-0.5">
              {summary.counts.postponed}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#F0F4F9] border border-[#1E3A5F]/15 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-[#1E3A5F]">تلخيصات وخواطر</p>
            <p className="text-xl font-bold text-[#1E3A5F] tabular-nums mt-0.5">
              {summary.counts.summariesAndNotes + summary.counts.reflections}
            </p>
          </div>
        </div>

        {/* View Mode Switcher (3 required views) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
              viewMode === 'timeline'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>التسلسل الزمني</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('by_category')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
              viewMode === 'by_category'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>حسب المسار والتصنيف</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
              viewMode === 'overview'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" aria-hidden="true" />
            <span>نظرة عامة لليوم</span>
          </button>
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

        {/* Daily Reflection & Key Takeaways Panel */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                تأملات وخلاصة اليوم
              </h2>
            </div>
            {savedToast && (
              <span className="text-[11px] font-semibold text-emerald-700">
                تم الحفظ
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              أهم نقطة تعلّمتها أو أنجزتها اليوم
            </label>
            <AutoResizeTextarea
              minRows={2}
              value={highlightsDraft}
              onChange={(e) => setHighlightsDraft(e.target.value)}
              placeholder="مثال: أنهيت درس التسويق الثالث وطبّقت خطة العميل..."
              className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              تأملك الشخصي / ملاحظات ختام اليوم
            </label>
            <AutoResizeTextarea
              minRows={5}
              value={reflectionDraft}
              onChange={(e) => setReflectionDraft(e.target.value)}
              placeholder="كيف كان تركيزك؟ ما الذي ساعدك أو عطّلك اليوم؟"
              className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveReflection}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>حفظ تأمل اليوم</span>
          </button>
        </aside>
      </div>
    </div>
  );
}
