import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Layers,
  Mic,
  Palette,
  PenLine,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import {
  ARABIC_MONTH_NAMES,
  DEFAULT_IMAGE_FRAME_SPEC,
  DailyJournalRecord,
  ImageFrameSpec,
  JOURNAL_CARD_THEMES,
  formatShortArabicDate,
  getArabicMonthTitle,
  getDayArabicName,
  getMonthDaysList,
  sanitizeImageFrameSpec,
  shiftMonthKey,
  toLocalDateKey,
} from '../data/curriculumData';
import { SavedAudioClipSummary } from '../utils/audioCache';
import {
  StoredImageRecord,
  resolveImageFallbackUrl,
  resolveStorageImageUrl,
} from '../utils/imageStorage';
import {
  WorkspaceAnalyticsInput,
  buildDailyJournalSummary,
} from '../utils/journalAnalytics';
import { richHtmlToPlainText } from '../utils/richText';
import JournalCardCustomizeModal from './JournalCardCustomizeModal';

export type JournalGalleryFilter =
  | 'all'
  | 'written'
  | 'photos'
  | 'voice'
  | 'notes';

interface JournalGalleryViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  dailyJournals: DailyJournalRecord[];
  analyticsInput: WorkspaceAnalyticsInput;
  journalImages: StoredImageRecord[];
  savedAudioClips: SavedAudioClipSummary[];
  onSaveDailyJournal: (rec: DailyJournalRecord) => void;
  onOpenDay: (dateKey: string, openCustomize?: boolean) => void;
}

const CARD_COVER_DEFAULT_FRAME: ImageFrameSpec = {
  ...DEFAULT_IMAGE_FRAME_SPEC,
  aspect: '16:9',
  fitMode: 'cover',
  sizePreset: 'sm',
  customHeightPx: 112,
};

function JournalCardCover({
  coverStoragePath,
  coverImageUrl,
  coverFrame,
  alt,
}: {
  coverStoragePath?: string;
  coverImageUrl?: string;
  coverFrame?: ImageFrameSpec;
  alt: string;
}) {
  const [src, setSrc] = useState(coverImageUrl || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objUrl = '';
    setFailed(false);

    if (coverStoragePath) {
      void resolveStorageImageUrl(coverStoragePath).then((res) => {
        if (!active) return;
        if (res?.url) {
          if (res.isObjectUrl) objUrl = res.url;
          setSrc(res.url);
        } else if (coverImageUrl) {
          setSrc(coverImageUrl);
        } else {
          setSrc('');
        }
      });
    } else {
      setSrc(coverImageUrl || '');
    }

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [coverStoragePath, coverImageUrl]);

  if (!src || failed) return null;

  const safeFrame = sanitizeImageFrameSpec(coverFrame, CARD_COVER_DEFAULT_FRAME);

  return (
    <div className="relative h-28 w-full overflow-hidden border-b border-black/5 bg-slate-100">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{
          objectFit: safeFrame.fitMode,
          objectPosition: `${safeFrame.offsetX}% ${safeFrame.offsetY}%`,
          transform:
            safeFrame.zoom !== 1 ? `scale(${safeFrame.zoom})` : undefined,
          transformOrigin:
            safeFrame.fitMode === 'contain' && safeFrame.zoom < 1
              ? '50% 50%'
              : `${safeFrame.offsetX}% ${safeFrame.offsetY}%`,
        }}
        className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}

function DayFallbackThumbnail({ record }: { record: StoredImageRecord }) {
  const [src, setSrc] = useState(record.downloadUrl || record.dataUrl || '');

  useEffect(() => {
    let active = true;
    let objUrl = '';
    if (!record.downloadUrl && !record.dataUrl) {
      void resolveImageFallbackUrl(record).then((res) => {
        if (!active) return;
        if (res?.url) {
          if (res.isObjectUrl) objUrl = res.url;
          setSrc(res.url);
        }
      });
    } else {
      setSrc(record.downloadUrl || record.dataUrl || '');
    }
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [record]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt={record.caption || record.name}
      referrerPolicy="no-referrer"
      className="w-7 h-7 rounded-md object-cover border border-black/10 shrink-0"
    />
  );
}

export default function JournalGalleryView({
  uid,
  canEdit,
  onRequireAuth,
  dailyJournals,
  analyticsInput,
  journalImages,
  savedAudioClips,
  onSaveDailyJournal,
  onOpenDay,
}: JournalGalleryViewProps) {
  const todayKey = toLocalDateKey();
  const currentMonthKey = todayKey.slice(0, 7);

  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAllMonths, setSearchAllMonths] = useState(false);
  const [activeFilter, setActiveFilter] = useState<JournalGalleryFilter>('all');
  const [customizeDayKey, setCustomizeDayKey] = useState<string | null>(null);

  const journalByDate = useMemo(() => {
    const map = new Map<string, DailyJournalRecord>();
    for (const j of dailyJournals) {
      map.set(j.dateKey, j);
    }
    return map;
  }, [dailyJournals]);

  const photosByDate = useMemo(() => {
    const map = new Map<string, StoredImageRecord[]>();
    for (const img of journalImages) {
      if (!img.scopeKey.startsWith('journal:')) continue;
      const dk = img.scopeKey.slice('journal:'.length);
      const list = map.get(dk) || [];
      list.push(img);
      map.set(dk, list);
    }
    return map;
  }, [journalImages]);

  const audioCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const clip of savedAudioClips) {
      if (!clip.entityId.startsWith('journal:')) continue;
      const dk = clip.entityId.slice('journal:'.length);
      map.set(dk, (map.get(dk) || 0) + 1);
    }
    return map;
  }, [savedAudioClips]);

  const activityCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of analyticsInput.activityLogs) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(log.dateKey)) {
        map.set(log.dateKey, (map.get(log.dateKey) || 0) + 1);
      }
    }
    return map;
  }, [analyticsInput.activityLogs]);

  const monthDays = useMemo(
    () => getMonthDaysList(selectedMonthKey),
    [selectedMonthKey]
  );

  // Build candidate day entries (current month days, OR all known active days if global search enabled)
  const candidateDays = useMemo(() => {
    if (searchQuery.trim() && searchAllMonths) {
      const keys = new Set<string>(monthDays.map((d) => d.dateKey));
      for (const j of dailyJournals) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(j.dateKey)) keys.add(j.dateKey);
      }
      for (const dk of photosByDate.keys()) keys.add(dk);
      for (const dk of audioCountByDate.keys()) keys.add(dk);

      return Array.from(keys)
        .sort((a, b) => b.localeCompare(a))
        .map((dk) => ({
          dateKey: dk,
          dayNumber: Number(dk.slice(8, 10)),
          dayName: getDayArabicName(dk),
          shortLabel: formatShortArabicDate(dk),
        }));
    }
    return monthDays;
  }, [
    searchQuery,
    searchAllMonths,
    monthDays,
    dailyJournals,
    photosByDate,
    audioCountByDate,
  ]);

  const cardModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return candidateDays
      .map((day) => {
        const rec = journalByDate.get(day.dateKey);
        const dayPhotos = photosByDate.get(day.dateKey) || [];
        const voiceCount = audioCountByDate.get(day.dateKey) || 0;
        const quickNotesCount = rec?.quickNotes?.length ?? 0;

        const writtenPlain = [
          rec?.bodyHtml ? richHtmlToPlainText(rec.bodyHtml) : '',
          ...(rec?.sections || []).map((s) =>
            [s.heading, richHtmlToPlainText(s.bodyHtml)].filter(Boolean).join(' ')
          ),
          rec?.highlightsText || '',
          rec?.reflectionText || '',
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        const hasWritten = writtenPlain.length > 0 || Boolean(rec?.title?.trim());
        const quickLogCount = activityCountByDate.get(day.dateKey) || 0;
        // For rich preview on active days without heavy scanning, only run full analytics summary if day has activity or journal data
        const activityCount =
          quickLogCount > 0 || hasWritten
            ? buildDailyJournalSummary(day.dateKey, analyticsInput).counts.total
            : 0;

        const previewExcerpt = writtenPlain
          ? writtenPlain.slice(0, 130) + (writtenPlain.length > 130 ? '...' : '')
          : rec?.quickNotes?.[0]?.body
          ? rec.quickNotes[0].body.slice(0, 120)
          : '';

        const searchableText = [
          day.shortLabel,
          day.dayName,
          rec?.title || '',
          rec?.subtitle || '',
          writtenPlain,
          ...(rec?.quickNotes || []).map((qn) => `${qn.title || ''} ${qn.body}`),
        ]
          .join(' ')
          .toLowerCase();

        return {
          ...day,
          rec,
          dayPhotos,
          photoCount: dayPhotos.length,
          voiceCount,
          quickNotesCount,
          activityCount,
          hasWritten,
          previewExcerpt,
          searchableText,
        };
      })
      .filter((item) => {
        if (q && !item.searchableText.includes(q)) return false;
        if (activeFilter === 'written' && !item.hasWritten) return false;
        if (activeFilter === 'photos' && item.photoCount === 0) return false;
        if (activeFilter === 'voice' && item.voiceCount === 0) return false;
        if (activeFilter === 'notes' && item.quickNotesCount === 0) return false;
        return true;
      });
  }, [
    candidateDays,
    journalByDate,
    photosByDate,
    audioCountByDate,
    activityCountByDate,
    analyticsInput,
    searchQuery,
    activeFilter,
  ]);

  const monthStats = useMemo(() => {
    const prefix = `${selectedMonthKey}-`;
    let writtenDays = 0;
    let photoDays = 0;
    let voiceDays = 0;
    const monthSet = new Set(monthDays.map((d) => d.dateKey));
    for (const dk of monthSet) {
      const rec = journalByDate.get(dk);
      if (
        rec &&
        (rec.title?.trim() ||
          rec.bodyHtml?.trim() ||
          rec.reflectionText?.trim() ||
          rec.highlightsText?.trim() ||
          (rec.sections?.length ?? 0) > 0)
      ) {
        writtenDays += 1;
      }
      if ((photosByDate.get(dk)?.length ?? 0) > 0) photoDays += 1;
      if ((audioCountByDate.get(dk) ?? 0) > 0) voiceDays += 1;
    }
    void prefix;
    return { writtenDays, photoDays, voiceDays };
  }, [monthDays, journalByDate, photosByDate, audioCountByDate, selectedMonthKey]);

  const [selectedYearStr, selectedMonthStr] = selectedMonthKey.split('-');
  const selectedYearNum = Number(selectedYearStr) || new Date().getFullYear();
  const selectedMonthNum = Number(selectedMonthStr) || new Date().getMonth() + 1;

  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    const list: number[] = [];
    for (let y = base - 3; y <= base + 2; y += 1) list.push(y);
    return list;
  }, []);

  return (
    <div className="space-y-5">
      {/* Gallery Header, Month Switcher & Filters */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              معرض اليوميات — {getArabicMonthTitle(selectedMonthKey)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              بطاقة شخصية لكل يوم؛ افتح أي يوم للكتابة الحرة وإضافة الصور والتسجيلات الصوتية والملاحظات.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5 tabular-nums">
              <span>{monthDays.length} يومًا في الشهر</span>
              <span aria-hidden="true">·</span>
              <span>{monthStats.writtenDays} أيام مكتوبة</span>
              <span aria-hidden="true">·</span>
              <span>{monthStats.photoDays} أيام بالصور</span>
              <span aria-hidden="true">·</span>
              <span>{monthStats.voiceDays} أيام بالصوت</span>
            </div>
          </div>

          {/* Month & Year Controls + Today Jump */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedMonthKey(shiftMonthKey(selectedMonthKey, -1))
              }
              aria-label="الشهر السابق"
              className="p-2.5 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 bg-[#F7F8FA] border border-slate-200 rounded-xl p-1">
              <select
                value={selectedMonthNum}
                onChange={(e) =>
                  setSelectedMonthKey(
                    `${selectedYearNum}-${String(Number(e.target.value)).padStart(2, '0')}`
                  )
                }
                aria-label="اختيار الشهر"
                className="px-2 py-1 text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {ARABIC_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYearNum}
                onChange={(e) =>
                  setSelectedMonthKey(
                    `${e.target.value}-${String(selectedMonthNum).padStart(2, '0')}`
                  )
                }
                aria-label="اختيار السنة"
                className="px-2 py-1 text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer tabular-nums"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedMonthKey(shiftMonthKey(selectedMonthKey, 1))
              }
              aria-label="الشهر التالي"
              className="p-2.5 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedMonthKey(currentMonthKey);
                onOpenDay(todayKey, false);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>يومية اليوم</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search
                className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في العناوين، التدوينات، والملاحظات..."
                className="w-full pr-9 pl-8 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="p-1 text-slate-400 hover:text-slate-700 absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchAllMonths((v) => !v)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer whitespace-nowrap ${
                  searchAllMonths
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {searchAllMonths ? 'البحث في كل الأشهر' : 'توسيع البحث لكل الأشهر'}
              </button>
            )}
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'all', label: 'كل الأيام' },
                { id: 'written', label: 'تدوين نصي' },
                { id: 'photos', label: 'بها صور' },
                { id: 'voice', label: 'بها صوت' },
                { id: 'notes', label: 'ملاحظات سريعة' },
              ] as Array<{ id: JournalGalleryFilter; label: string }>
            ).map((f) => {
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery Visual Cards Grid */}
      {cardModels.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2.5">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">
            لا توجد أيام مطابقة للبحث أو التصفية الحالية
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            جرّب مسح نص البحث أو اختيار «كل الأيام» لعرض جميع بطاقات الشهر.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] rounded-xl cursor-pointer"
          >
            <span>إعادة عرض جميع الأيام</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {cardModels.map((day) => {
            const isToday = day.dateKey === todayKey;
            const theme =
              JOURNAL_CARD_THEMES[day.rec?.cardColor || 'default'] ||
              JOURNAL_CARD_THEMES.default;
            const hasCover = Boolean(
              day.rec?.coverImageStoragePath || day.rec?.coverImageUrl
            );
            const hasAnyContent =
              day.hasWritten ||
              day.photoCount > 0 ||
              day.voiceCount > 0 ||
              day.quickNotesCount > 0 ||
              day.activityCount > 0;

            return (
              <div
                key={day.dateKey}
                data-custom-card-surface={
                  day.rec?.cardColor && day.rec.cardColor !== 'default'
                    ? 'light'
                    : undefined
                }
                role="button"
                tabIndex={0}
                onClick={() => onOpenDay(day.dateKey, false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDay(day.dateKey, false);
                  }
                }}
                className={`group relative rounded-2xl border overflow-hidden flex flex-col justify-between min-h-[225px] text-right cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                  theme.cardClass
                } ${isToday ? 'ring-2 ring-[#1E3A5F]/40 border-[#1E3A5F]/50' : ''}`}
              >
                {/* Optional Card Cover Image */}
                <div>
                  {hasCover && (
                    <JournalCardCover
                      coverStoragePath={day.rec?.coverImageStoragePath}
                      coverImageUrl={day.rec?.coverImageUrl}
                      coverFrame={day.rec?.coverFrame}
                      alt={day.rec?.title || day.shortLabel}
                    />
                  )}

                  <div className="p-4 space-y-2">
                    {/* Date + Weekday Header + Quick Customize Trigger */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 tabular-nums">
                          <span className="text-slate-900 font-bold">
                            {day.shortLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{day.dayName}</span>
                          {isToday && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#1E3A5F] font-bold">
                                اليوم
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canEdit) return onRequireAuth();
                          setCustomizeDayKey(day.dateKey);
                        }}
                        title="تخصيص لون البطاقة وصورة الغلاف"
                        aria-label={`تخصيص مظهر بطاقة ${day.shortLabel}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#1E3A5F] hover:bg-black/5 opacity-80 sm:opacity-65 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shrink-0"
                      >
                        <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Title & Subtitle */}
                    {day.rec?.title?.trim() ? (
                      <h3 className="font-editorial text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                        {day.rec.title}
                      </h3>
                    ) : null}

                    {day.rec?.subtitle?.trim() ? (
                      <p className="text-[11px] font-medium text-slate-600 line-clamp-1">
                        {day.rec.subtitle}
                      </p>
                    ) : null}

                    {/* Preview Excerpt or Calm Empty Invitation */}
                    {day.previewExcerpt ? (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {day.previewExcerpt}
                      </p>
                    ) : !day.rec?.title?.trim() && !hasAnyContent ? (
                      <p className="text-xs text-slate-400 pt-2 leading-relaxed">
                        مساحة فارغة لهذا اليوم — افتح البطاقة لبدء الكتابة أو التوثيق.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Card Bottom Indicators (Unboxed metadata + optional mini photo strip) */}
                <div className="px-4 pb-3.5 pt-2 border-t border-black/5 space-y-2">
                  {!hasCover && day.dayPhotos.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {day.dayPhotos.slice(0, 4).map((p) => (
                        <DayFallbackThumbnail key={p.id} record={p} />
                      ))}
                      {day.dayPhotos.length > 4 && (
                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums pr-1">
                          +{day.dayPhotos.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {day.photoCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-slate-700 font-medium"
                          title="صور مرفقة"
                        >
                          <Camera className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                          <span>{day.photoCount}</span>
                        </span>
                      )}
                      {day.voiceCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-slate-700 font-medium"
                          title="تسجيلات صوتية"
                        >
                          <Mic className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                          <span>{day.voiceCount}</span>
                        </span>
                      )}
                      {day.quickNotesCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-slate-700 font-medium"
                          title="ملاحظات سريعة"
                        >
                          <StickyNote className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                          <span>{day.quickNotesCount}</span>
                        </span>
                      )}
                      {day.hasWritten && (
                        <span
                          className="inline-flex items-center gap-1 text-slate-700 font-medium"
                          title="يحتوي تدوينًا مكتوبًا"
                        >
                          <PenLine className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
                        </span>
                      )}
                      {day.activityCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-slate-600"
                          title="أنشطة تلقائية"
                        >
                          <Layers className="w-3 h-3" aria-hidden="true" />
                          <span>{day.activityCount}</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-[#1E3A5F] opacity-80 group-hover:opacity-100">
                      فتح
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {customizeDayKey && (
        <JournalCardCustomizeModal
          open={Boolean(customizeDayKey)}
          dateKey={customizeDayKey}
          existingRecord={journalByDate.get(customizeDayKey)}
          dayPhotos={photosByDate.get(customizeDayKey) || []}
          previewTitle={journalByDate.get(customizeDayKey)?.title}
          previewExcerpt={
            cardModels.find((c) => c.dateKey === customizeDayKey)
              ?.previewExcerpt
          }
          uid={uid}
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
          onSaveDailyJournal={onSaveDailyJournal}
          onOpenFullDay={(dk) => onOpenDay(dk, false)}
          onClose={() => setCustomizeDayKey(null)}
        />
      )}
    </div>
  );
}
