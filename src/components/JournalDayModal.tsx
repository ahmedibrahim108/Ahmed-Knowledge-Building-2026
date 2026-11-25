import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crop,
  Edit3,
  ImagePlus,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Minimize2,
  Palette,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Save,
  StickyNote,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  DEFAULT_IMAGE_FRAME_SPEC,
  DailyJournalRecord,
  ImageFrameSpec,
  JOURNAL_CARD_THEMES,
  JOURNAL_QUICK_NOTE_META,
  JournalCardColorKey,
  JournalQuickNote,
  JournalQuickNoteKind,
  JournalTextSection,
  UserPreferences,
  addDaysToDateKey,
  formatShortArabicDate,
  getDayArabicName,
  sanitizeImageFrameSpec,
} from '../data/curriculumData';
import { SavedAudioClipSummary } from '../utils/audioCache';
import {
  StoredImageRecord,
  compressAndSaveImages,
  deleteJournalCoverStorage,
  deleteStoredImage,
  replaceStoredImage,
  resolveImageFallbackUrl,
  resolveStorageImageUrl,
  subscribeImagesForScope,
  updateStoredImageCaption,
  uploadJournalCoverImage,
  validateImageFileForUpload,
} from '../utils/imageStorage';
import { useSpeechDictation } from '../hooks/useSpeechDictation';
import {
  QUOTE_COLOR_THEMES,
  resolveEffectiveDailyQuote,
  rotateDailyQuoteFromLibrary,
} from '../utils/dailyQuotes';
import {
  DailyJournalItem,
  JournalNavAction,
  WorkspaceAnalyticsInput,
  buildDailyJournalSummary,
} from '../utils/journalAnalytics';
import { renderSafeBidiHtml } from '../utils/richText';
import AutoResizeTextarea from './AutoResizeTextarea';
import ConfirmDialog from './ConfirmDialog';
import { ImageFrameEditorModal } from './FramedImage';
import JournalVoiceRecorder from './JournalVoiceRecorder';
import RichTextNoteEditor from './RichTextNoteEditor';

type DiaryTab =
  | 'continuous'
  | 'writing'
  | 'photos'
  | 'voice'
  | 'notes'
  | 'activities';

interface ResolvedPhotoItem extends StoredImageRecord {
  resolvedUrl: string;
  isObjectUrl: boolean;
}

interface JournalDayModalProps {
  open: boolean;
  dateKey: string;
  onChangeDateKey: (nextDateKey: string) => void;
  onClose: () => void;
  journalRecord?: DailyJournalRecord;
  analyticsInput: WorkspaceAnalyticsInput;
  canEdit: boolean;
  uid?: string;
  preferences: UserPreferences;
  onUpdatePreferences?: (updates: Partial<UserPreferences>) => void;
  onRequireAuth: () => void;
  onSaveDailyJournal: (rec: DailyJournalRecord) => void;
  onOpenEntity: (action: JournalNavAction) => void;
  savedAudioClips: SavedAudioClipSummary[];
  onAudioClipSaved?: (clip: SavedAudioClipSummary) => void;
  onAudioClipDeleted?: (clipId: string) => void;
  initialShowCustomize?: boolean;
}

function buildInitialDraft(
  dateKey: string,
  existing?: DailyJournalRecord
): DailyJournalRecord {
  return {
    dateKey,
    title: existing?.title || '',
    subtitle: existing?.subtitle || '',
    bodyHtml: existing?.bodyHtml || '',
    sections: existing?.sections ? existing.sections.map((s) => ({ ...s })) : [],
    quickNotes: existing?.quickNotes
      ? existing.quickNotes.map((n) => ({ ...n }))
      : [],
    cardColor: existing?.cardColor || 'default',
    coverImageUrl: existing?.coverImageUrl || '',
    coverImageStoragePath: existing?.coverImageStoragePath || '',
    coverFrame: existing?.coverFrame,
    dailyQuote: existing?.dailyQuote,
    reflectionText: existing?.reflectionText || '',
    highlightsText: existing?.highlightsText || '',
    moodLabel: existing?.moodLabel || '',
    energyScore: existing?.energyScore,
    updatedAtMs: existing?.updatedAtMs || 0,
  };
}

function hasJournalDraftChanged(
  a: DailyJournalRecord,
  b: DailyJournalRecord
): boolean {
  return (
    (a.title || '') !== (b.title || '') ||
    (a.subtitle || '') !== (b.subtitle || '') ||
    (a.bodyHtml || '') !== (b.bodyHtml || '') ||
    (a.reflectionText || '') !== (b.reflectionText || '') ||
    (a.highlightsText || '') !== (b.highlightsText || '') ||
    (a.moodLabel || '') !== (b.moodLabel || '') ||
    (a.energyScore ?? null) !== (b.energyScore ?? null) ||
    (a.cardColor || 'default') !== (b.cardColor || 'default') ||
    (a.coverImageUrl || '') !== (b.coverImageUrl || '') ||
    (a.coverImageStoragePath || '') !== (b.coverImageStoragePath || '') ||
    (a.dailyQuote?.text || '') !== (b.dailyQuote?.text || '') ||
    JSON.stringify(a.coverFrame || null) !== JSON.stringify(b.coverFrame || null) ||
    JSON.stringify(a.sections || []) !== JSON.stringify(b.sections || []) ||
    JSON.stringify(a.quickNotes || []) !== JSON.stringify(b.quickNotes || [])
  );
}

function activityStatusClass(tone: DailyJournalItem['statusTone']): string {
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

export default function JournalDayModal({
  open,
  dateKey,
  onChangeDateKey,
  onClose,
  journalRecord,
  analyticsInput,
  canEdit,
  uid,
  preferences,
  onUpdatePreferences,
  onRequireAuth,
  onSaveDailyJournal,
  onOpenEntity,
  savedAudioClips,
  onAudioClipSaved,
  onAudioClipDeleted,
  initialShowCustomize = false,
}: JournalDayModalProps) {
  const [activeTab, setActiveTab] = useState<DiaryTab>('continuous');
  const [showCustomize, setShowCustomize] = useState(initialShowCustomize);

  const [draft, setDraft] = useState<DailyJournalRecord>(() =>
    buildInitialDraft(dateKey, journalRecord)
  );
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const lastSavedRef = useRef<DailyJournalRecord>(buildInitialDraft(dateKey, journalRecord));
  const draftRef = useRef<DailyJournalRecord>(draft);
  const autosaveTimerRef = useRef<number | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<ResolvedPhotoItem[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] =
    useState<ResolvedPhotoItem | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState('');
  const [coverFrameEditorOpen, setCoverFrameEditorOpen] = useState(false);

  // Quick Note composer + edit state
  const [noteKind, setNoteKind] = useState<JournalQuickNoteKind>('thought');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteKind, setEditNoteKind] = useState<JournalQuickNoteKind>('thought');
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteBody, setEditNoteBody] = useState('');

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetRef = useRef<ResolvedPhotoItem | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const activeObjectUrlsRef = useRef<string[]>([]);

  const isMinimalWriting = Boolean(preferences.minimalWritingMode);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const highlightsMic = useSpeechDictation({
    dialect: preferences.voiceDialect,
    onTranscriptSegment: (segment) => {
      setDraft((prev) => ({
        ...prev,
        highlightsText: prev.highlightsText
          ? `${prev.highlightsText.trimEnd()} ${segment}`
          : segment,
      }));
    },
  });

  const reflectionMic = useSpeechDictation({
    dialect: preferences.voiceDialect,
    onTranscriptSegment: (segment) => {
      setDraft((prev) => ({
        ...prev,
        reflectionText: prev.reflectionText
          ? `${prev.reflectionText.trimEnd()} ${segment}`
          : segment,
      }));
    },
  });

  useEffect(() => {
    setShowCustomize(initialShowCustomize);
  }, [initialShowCustomize, dateKey, open]);

  // Sync incoming journalRecord ONLY when dateKey changes OR remote record is newer than local un-dirty draft
  useEffect(() => {
    const fresh = buildInitialDraft(dateKey, journalRecord);
    if (draftRef.current.dateKey !== dateKey) {
      setDraft(fresh);
      draftRef.current = fresh;
      lastSavedRef.current = fresh;
      setSaveState('idle');
      setPhotoError(null);
      setLightboxIndex(null);
      setEditingNoteId(null);
    } else if (
      saveState !== 'dirty' &&
      saveState !== 'saving' &&
      (journalRecord?.updatedAtMs ?? 0) > (draftRef.current.updatedAtMs ?? 0)
    ) {
      setDraft(fresh);
      draftRef.current = fresh;
      lastSavedRef.current = fresh;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, journalRecord]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const flushSaveNow = useCallback(
    (explicitDraft?: DailyJournalRecord) => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const target = explicitDraft || draftRef.current;
      if (!canEdit) return;
      if (!hasJournalDraftChanged(target, lastSavedRef.current)) {
        return;
      }
      const stamped: DailyJournalRecord = {
        ...target,
        updatedAtMs: Date.now(),
      };
      setSaveState('saving');
      onSaveDailyJournal(stamped);
      lastSavedRef.current = stamped;
      draftRef.current = stamped;
      setDraft(stamped);
      setSaveState('saved');
      window.setTimeout(() => {
        setSaveState((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2200);
    },
    [canEdit, onSaveDailyJournal]
  );

  // Debounced autosave (~750ms after any draft change)
  useEffect(() => {
    if (!open || !canEdit) return;
    if (!hasJournalDraftChanged(draft, lastSavedRef.current)) return;
    setSaveState('dirty');
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      flushSaveNow(draftRef.current);
    }, 750);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draft, open, canEdit, flushSaveNow]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Subscribe to photos for this dateKey
  useEffect(() => {
    if (!open) return;
    const scopeKey = `journal:${dateKey}`;
    let disposed = false;

    const unsub = subscribeImagesForScope(scopeKey, uid, (records) => {
      if (disposed) return;
      void (async () => {
        activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        const nextUrls: string[] = [];
        const resolved: ResolvedPhotoItem[] = [];

        for (const rec of records) {
          if (rec.downloadUrl) {
            resolved.push({ ...rec, resolvedUrl: rec.downloadUrl, isObjectUrl: false });
          } else if (rec.dataUrl) {
            resolved.push({ ...rec, resolvedUrl: rec.dataUrl, isObjectUrl: false });
          } else if (rec.blob) {
            const url = URL.createObjectURL(rec.blob);
            nextUrls.push(url);
            resolved.push({ ...rec, resolvedUrl: url, isObjectUrl: true });
          } else {
            const fb = await resolveImageFallbackUrl(rec);
            if (fb?.url) {
              if (fb.isObjectUrl) nextUrls.push(fb.url);
              resolved.push({
                ...rec,
                resolvedUrl: fb.url,
                isObjectUrl: fb.isObjectUrl,
              });
            }
          }
        }
        if (disposed) {
          nextUrls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        activeObjectUrlsRef.current = nextUrls;
        setPhotos(resolved);
      })();
    });

    return () => {
      disposed = true;
      unsub();
      activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      activeObjectUrlsRef.current = [];
    };
  }, [open, dateKey, uid]);

  // Resolve card cover URL privately if storagePath exists
  useEffect(() => {
    if (!open) return;
    let active = true;
    let objUrl = '';
    const sp = draft.coverImageStoragePath;
    if (sp) {
      void resolveStorageImageUrl(sp).then((res) => {
        if (!active) return;
        if (res?.url) {
          if (res.isObjectUrl) objUrl = res.url;
          setResolvedCoverUrl(res.url);
        } else {
          setResolvedCoverUrl(draft.coverImageUrl || '');
        }
      });
    } else {
      setResolvedCoverUrl(draft.coverImageUrl || '');
    }
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [open, draft.coverImageStoragePath, draft.coverImageUrl]);

  // Keyboard navigation (Escape closes lightbox first, then modal; ArrowLeft/Right in lightbox)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex !== null) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setLightboxIndex(null);
          return;
        }
        if (e.key === 'ArrowRight' && photos.length > 1) {
          setLightboxIndex((prev) =>
            prev === null ? null : (prev - 1 + photos.length) % photos.length
          );
        }
        if (e.key === 'ArrowLeft' && photos.length > 1) {
          setLightboxIndex((prev) =>
            prev === null ? null : (prev + 1) % photos.length
          );
        }
        return;
      }

      if (e.key === 'Escape' && !confirmDeletePhoto) {
        flushSaveNow();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, lightboxIndex, photos.length, confirmDeletePhoto, flushSaveNow, onClose]);

  const summary = useMemo(
    () =>
      buildDailyJournalSummary(dateKey, analyticsInput, {
        hiddenActivityIds: preferences.hiddenActivityIds,
        hiddenActivityTypes: preferences.hiddenActivityTypes,
      }),
    [
      dateKey,
      analyticsInput,
      preferences.hiddenActivityIds,
      preferences.hiddenActivityTypes,
    ]
  );

  const resolvedQuote = useMemo(
    () =>
      resolveEffectiveDailyQuote({
        dateKey,
        journalQuote: draft.dailyQuote,
        quotesLibrary: preferences.quotesLibrary,
        pinnedDailyQuoteId: preferences.pinnedDailyQuoteId,
      }),
    [
      dateKey,
      draft.dailyQuote,
      preferences.quotesLibrary,
      preferences.pinnedDailyQuoteId,
    ]
  );

  const dayVoiceCount = useMemo(
    () => savedAudioClips.filter((c) => c.entityId === `journal:${dateKey}`).length,
    [savedAudioClips, dateKey]
  );

  if (!open) return null;

  const theme =
    JOURNAL_CARD_THEMES[draft.cardColor || 'default'] ||
    JOURNAL_CARD_THEMES.default;

  const updateDraft = (updater: (prev: DailyJournalRecord) => DailyJournalRecord) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setDraft((prev) => updater(prev));
  };

  const handleCloseSafely = () => {
    flushSaveNow();
    onClose();
  };

  const handleShiftDay = (delta: number) => {
    flushSaveNow();
    onChangeDateKey(addDaysToDateKey(dateKey, delta));
  };

  // Multiple Text Sections Handlers
  const handleAddSection = () => {
    if (!canEdit) return onRequireAuth();
    const newSec: JournalTextSection = {
      id: `jsec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      heading: '',
      bodyHtml: '',
      updatedAtMs: Date.now(),
    };
    updateDraft((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), newSec],
    }));
  };

  const handleUpdateSection = (
    secId: string,
    patch: Partial<JournalTextSection>
  ) => {
    updateDraft((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((s) =>
        s.id === secId ? { ...s, ...patch, updatedAtMs: Date.now() } : s
      ),
    }));
  };

  const handleDeleteSection = (secId: string) => {
    if (editingSectionId === secId) setEditingSectionId(null);
    updateDraft((prev) => ({
      ...prev,
      sections: (prev.sections || []).filter((s) => s.id !== secId),
    }));
  };

  const handleToggleMinimalWriting = () => {
    if (!canEdit) return onRequireAuth();
    onUpdatePreferences?.({ minimalWritingMode: !isMinimalWriting });
  };

  const handleRotateQuote = () => {
    if (!canEdit) return onRequireAuth();
    const rotated = rotateDailyQuoteFromLibrary(
      dateKey,
      resolvedQuote.quote.text,
      preferences.quotesLibrary || []
    );
    if (preferences.pinnedDailyQuoteId && onUpdatePreferences) {
      onUpdatePreferences({ pinnedDailyQuoteId: null });
    }
    updateDraft((prev) => ({ ...prev, dailyQuote: rotated.quote }));
  };

  // Quick Notes Handlers
  const handleAddQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return onRequireAuth();
    const bodyClean = noteBody.trim();
    const titleClean = noteTitle.trim();
    if (!bodyClean && !titleClean) return;

    const now = Date.now();
    const nextNote: JournalQuickNote = {
      id: `jqn_${now}_${Math.floor(Math.random() * 1000)}`,
      kind: noteKind,
      title: titleClean,
      body: bodyClean,
      createdAtMs: now,
      updatedAtMs: now,
    };
    updateDraft((prev) => ({
      ...prev,
      quickNotes: [nextNote, ...(prev.quickNotes || [])],
    }));
    setNoteTitle('');
    setNoteBody('');
  };

  const handleSaveEditedQuickNote = () => {
    if (!editingNoteId) return;
    if (!canEdit) return onRequireAuth();
    updateDraft((prev) => ({
      ...prev,
      quickNotes: (prev.quickNotes || []).map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              kind: editNoteKind,
              title: editNoteTitle.trim(),
              body: editNoteBody.trim(),
              updatedAtMs: Date.now(),
            }
          : n
      ),
    }));
    setEditingNoteId(null);
  };

  const handleDeleteQuickNote = (id: string) => {
    updateDraft((prev) => ({
      ...prev,
      quickNotes: (prev.quickNotes || []).filter((n) => n.id !== id),
    }));
  };

  // Photos Handlers
  const handleUploadPhotos = async (fileList: FileList | File[]) => {
    if (!canEdit) return onRequireAuth();
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setPhotoError(null);
    for (const f of files) {
      const check = validateImageFileForUpload(f);
      if (!check.valid) {
        setPhotoError(check.error || 'بعض الملفات غير صالحة.');
        return;
      }
    }

    setUploadingPhotos(true);
    try {
      await compressAndSaveImages(`journal:${dateKey}`, files, uid);
    } catch {
      setPhotoError('تعذر رفع الصورة حاليًا. تأكد من اتصالك وصلاحيات التخزين.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleReplacePhoto = async (file: File) => {
    const target = replaceTargetRef.current;
    if (!target || !canEdit) return;
    setPhotoError(null);
    setReplacingPhotoId(target.id);
    try {
      await replaceStoredImage(target, file, uid);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'تعذر استبدال الصورة حاليًا.'
      );
    } finally {
      setReplacingPhotoId(null);
      replaceTargetRef.current = null;
    }
  };

  const handleConfirmDeletePhoto = async () => {
    const target = confirmDeletePhoto;
    if (!target) return;
    setConfirmDeletePhoto(null);
    await deleteStoredImage(target, uid);
    setLightboxIndex(null);
    // If deleted photo was set as cover, clear cover link cleanly
    if (
      target.storagePath &&
      target.storagePath === draft.coverImageStoragePath
    ) {
      updateDraft((prev) => ({
        ...prev,
        coverImageStoragePath: '',
        coverImageUrl: '',
      }));
    }
  };

  const handleSetPhotoAsCover = (photo: ResolvedPhotoItem) => {
    updateDraft((prev) => ({
      ...prev,
      cardColor: prev.cardColor || 'default',
      coverImageStoragePath: photo.storagePath || '',
      coverImageUrl: photo.downloadUrl || photo.resolvedUrl || '',
    }));
  };

  const handleUploadCustomCover = async (file: File) => {
    if (!canEdit) return onRequireAuth();
    setPhotoError(null);
    setUploadingCover(true);
    try {
      const oldDedicated =
        draft.coverImageStoragePath &&
        draft.coverImageStoragePath.includes('/images/journal_cover_')
          ? draft.coverImageStoragePath
          : '';
      const res = await uploadJournalCoverImage(dateKey, file, uid);
      if (oldDedicated && oldDedicated !== res.imageStoragePath) {
        void deleteJournalCoverStorage(oldDedicated);
      }
      updateDraft((prev) => ({
        ...prev,
        coverImageStoragePath: res.imageStoragePath,
        coverImageUrl: res.imageUrl || res.localObjectUrl || '',
      }));
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'تعذر رفع صورة الغلاف.'
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRestoreDefaultAppearance = async () => {
    if (!canEdit) return onRequireAuth();
    const oldPath = draft.coverImageStoragePath;
    const isSharedDayPhoto =
      oldPath && photos.some((p) => p.storagePath === oldPath);
    if (oldPath && !isSharedDayPhoto) {
      await deleteJournalCoverStorage(oldPath);
    }
    updateDraft((prev) => ({
      ...prev,
      cardColor: 'default',
      coverImageStoragePath: '',
      coverImageUrl: '',
      coverFrame: undefined,
    }));
  };

  const quoteTheme =
    (resolvedQuote.customQuote?.colorKey &&
      QUOTE_COLOR_THEMES[resolvedQuote.customQuote.colorKey]) ||
    QUOTE_COLOR_THEMES.amber;

  const renderWrittenSection = () => (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">
            التدوين اليومي والكتابة الحرة
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && onUpdatePreferences && (
            <button
              type="button"
              onClick={handleToggleMinimalWriting}
              aria-pressed={isMinimalWriting}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isMinimalWriting
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>كتابة هادئة</span>
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={handleAddSection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] border border-[#1E3A5F]/20 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إضافة قسم كتابة</span>
            </button>
          )}
        </div>
      </div>

      {/* Quote of the Day Strip (hidden in minimal writing mode) */}
      {!isMinimalWriting && (
        <div
          data-custom-card-surface="light"
          className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 ${quoteTheme.cardClass}`}
        >
          <div className="min-w-0 flex-1 flex items-start gap-2">
            <Quote
              className={`w-4 h-4 shrink-0 mt-0.5 ${quoteTheme.accentTextClass}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                «{resolvedQuote.quote.text}»
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {resolvedQuote.quote.author || 'حكمة اليوم'}
                {resolvedQuote.quote.theme ? ` · ${resolvedQuote.quote.theme}` : ''}
              </p>
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleRotateQuote}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white/85 hover:bg-white text-slate-700 border border-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>تبديل الحكمة</span>
            </button>
          )}
        </div>
      )}

      {/* Title & Subtitle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            عنوان اليومية (اختياري)
          </label>
          <input
            type="text"
            value={draft.title || ''}
            disabled={!canEdit}
            onChange={(e) =>
              updateDraft((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="مثال: يوم هادئ ومثمر في المذاكرة"
            className="w-full px-3.5 py-2 text-sm font-semibold bg-white/90 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            وصف قصير أو خلاصة سريعة (اختياري)
          </label>
          <input
            type="text"
            value={draft.subtitle || ''}
            disabled={!canEdit}
            onChange={(e) =>
              updateDraft((prev) => ({ ...prev, subtitle: e.target.value }))
            }
            placeholder="جملة قصيرة تلخص شعور أو مسار اليوم..."
            className="w-full px-3.5 py-2 text-sm bg-white/90 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>
      </div>

      {/* Main Free-Form Rich Text Canvas */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700">
          صفحة اليوم الحرة
        </label>
        {canEdit ? (
          <RichTextNoteEditor
            noteKey={`journal_main_${dateKey}`}
            value={draft.bodyHtml || ''}
            onChange={(html) =>
              updateDraft((prev) => ({ ...prev, bodyHtml: html }))
            }
            placeholder="اكتب بحرية عن يومك، أفكارك، مشاعرك، أو ما حدث اليوم... يمكنك تنسيق العناوين والنقاط والتظليل بحرية."
            canEdit={canEdit}
            onRequireAuth={onRequireAuth}
            preferences={preferences}
            onUpdatePreferences={onUpdatePreferences}
            minimalMode={isMinimalWriting}
            onToggleMinimalMode={handleToggleMinimalWriting}
            voiceDialect={preferences.voiceDialect}
            minHeightClass="min-h-[200px]"
          />
        ) : draft.bodyHtml ? (
          <div
            className="prose-bidi p-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-800"
            dangerouslySetInnerHTML={{
              __html: renderSafeBidiHtml(draft.bodyHtml),
            }}
          />
        ) : (
          <p className="text-xs text-slate-500 p-4 rounded-xl bg-white/70 border border-slate-200">
            لا يوجد تدوين نصي لهذا اليوم بعد.
          </p>
        )}
      </div>

      {/* Multiple Custom Free-Form Sections with Edit/Rename/Delete CRUD */}
      {(draft.sections || []).map((sec, idx) => {
        const isRenaming = editingSectionId === sec.id || !sec.heading;
        return (
          <div
            key={sec.id}
            className="p-4 rounded-xl bg-white/90 border border-slate-200 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isRenaming && canEdit ? (
                <input
                  type="text"
                  value={sec.heading}
                  onChange={(e) =>
                    handleUpdateSection(sec.id, { heading: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && sec.heading.trim()) {
                      e.preventDefault();
                      setEditingSectionId(null);
                    }
                  }}
                  placeholder={`عنوان القسم الإضافي #${idx + 1}...`}
                  className="flex-1 min-w-[180px] px-3 py-1.5 text-sm font-bold bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              ) : (
                <h4 className="flex-1 text-sm font-bold text-slate-900">
                  {sec.heading || `قسم إضافي #${idx + 1}`}
                </h4>
              )}
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSectionId(isRenaming && sec.heading.trim() ? null : sec.id)
                    }
                    title={isRenaming ? 'اعتماد العنوان' : 'تعديل عنوان القسم'}
                    aria-label={isRenaming ? 'اعتماد العنوان' : 'تعديل عنوان القسم'}
                    className="p-2 text-slate-500 hover:text-[#1E3A5F] hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    {isRenaming && sec.heading.trim() ? (
                      <Check className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Edit3 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(sec.id)}
                    title="حذف القسم"
                    aria-label="حذف القسم"
                    className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {canEdit ? (
              <RichTextNoteEditor
                noteKey={`journal_sec_${dateKey}_${sec.id}`}
                value={sec.bodyHtml}
                onChange={(html) =>
                  handleUpdateSection(sec.id, { bodyHtml: html })
                }
                placeholder="اكتب محتوى هذا القسم..."
                canEdit={canEdit}
                onRequireAuth={onRequireAuth}
                preferences={preferences}
                onUpdatePreferences={onUpdatePreferences}
                minimalMode={isMinimalWriting}
                onToggleMinimalMode={handleToggleMinimalWriting}
                voiceDialect={preferences.voiceDialect}
                minHeightClass="min-h-[140px]"
              />
            ) : (
              <div
                className="prose-bidi text-sm text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: renderSafeBidiHtml(sec.bodyHtml),
                }}
              />
            )}
          </div>
        );
      })}

      {/* Synced Dashboard Takeaways & Evening Reflection with Inline Mic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700">
              أهم نقطة تعلّمتها أو أنجزتها
            </label>
            {canEdit && highlightsMic.isSupported && (
              <button
                type="button"
                onClick={() => highlightsMic.toggle()}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  highlightsMic.isListening
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {highlightsMic.isListening ? (
                  <MicOff className="w-3 h-3" />
                ) : (
                  <Mic className="w-3 h-3" />
                )}
                <span>{highlightsMic.isListening ? 'إيقاف' : 'إملاء'}</span>
              </button>
            )}
          </div>
          <AutoResizeTextarea
            minRows={2}
            disabled={!canEdit}
            value={draft.highlightsText}
            onChange={(e) =>
              updateDraft((prev) => ({
                ...prev,
                highlightsText: e.target.value,
              }))
            }
            placeholder="أبرز إنجاز أو نقطة تركيز اليوم..."
            className="w-full px-3.5 py-2 text-xs bg-white/90 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700">
              تأمل ختام اليوم
            </label>
            {canEdit && reflectionMic.isSupported && (
              <button
                type="button"
                onClick={() => reflectionMic.toggle()}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  reflectionMic.isListening
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {reflectionMic.isListening ? (
                  <MicOff className="w-3 h-3" />
                ) : (
                  <Mic className="w-3 h-3" />
                )}
                <span>{reflectionMic.isListening ? 'إيقاف' : 'إملاء'}</span>
              </button>
            )}
          </div>
          <AutoResizeTextarea
            minRows={2}
            disabled={!canEdit}
            value={draft.reflectionText}
            onChange={(e) =>
              updateDraft((prev) => ({
                ...prev,
                reflectionText: e.target.value,
              }))
            }
            placeholder="كيف سار اليوم؟ وما الذي تريد البناء عليه غدًا؟"
            className="w-full px-3.5 py-2 text-xs bg-white/90 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>
      </div>
    </section>
  );

  const renderPhotosSection = () => (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">
            صور اليوم ({photos.length})
          </h3>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={uploadingPhotos}
            onClick={() => photoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer disabled:opacity-50"
          >
            {uploadingPhotos ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5" />
            )}
            <span>{uploadingPhotos ? 'جاري الرفع...' : 'إضافة صور'}</span>
          </button>
        )}
      </div>

      <input
        ref={photoInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleUploadPhotos(e.target.files);
          e.target.value = '';
        }}
      />

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleReplacePhoto(f);
          e.target.value = '';
        }}
      />

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            if (e.dataTransfer.files) {
              void handleUploadPhotos(e.dataTransfer.files);
            }
          }}
          className={`p-4 rounded-xl border-2 border-dashed text-center transition-colors ${
            isDraggingOver
              ? 'border-[#1E3A5F] bg-[#F0F4F9]'
              : 'border-slate-200 bg-white/60 hover:border-slate-300'
          }`}
        >
          <UploadCloud className="w-5 h-5 text-slate-400 mx-auto mb-1" aria-hidden="true" />
          <p className="text-xs text-slate-600">
            اسحب الصور وأفلتها هنا، أو اضغط «إضافة صور» لرفع صورة أو أكثر (JPG, PNG, WebP — حتى 20 ميجابايت).
          </p>
        </div>
      )}

      {photoError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
          {photoError}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="p-6 rounded-xl bg-white/60 border border-slate-200 text-center text-xs text-slate-500">
          لا توجد صور مرفقة بهذا اليوم بعد.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo, index) => {
            const isCover =
              Boolean(draft.coverImageStoragePath) &&
              photo.storagePath === draft.coverImageStoragePath;
            const isReplacing = replacingPhotoId === photo.id;
            return (
              <div
                key={photo.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-slate-100 group">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="w-full h-full block cursor-zoom-in focus:outline-none"
                    aria-label={`معاينة ${photo.name}`}
                  >
                    <img
                      src={photo.resolvedUrl}
                      alt={photo.caption || photo.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                  {isReplacing && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#1E3A5F]" />
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <input
                    type="text"
                    disabled={!canEdit}
                    defaultValue={photo.caption}
                    placeholder="أضف تعليقًا لهذه الصورة..."
                    onBlur={(e) => {
                      const nextCap = e.target.value.trim();
                      if (nextCap !== (photo.caption || '')) {
                        void updateStoredImageCaption(photo.id, nextCap, uid);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />

                  {canEdit && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleSetPhotoAsCover(photo)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer ${
                          isCover
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                            : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>{isCover ? 'غلاف البطاقة' : 'تعيين كغلاف'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            replaceTargetRef.current = photo;
                            replaceInputRef.current?.click();
                          }}
                          title="استبدال الصورة"
                          className="p-1.5 text-slate-500 hover:text-[#1E3A5F] hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePhoto(photo)}
                          title="حذف الصورة"
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderVoiceSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-900">
          التسجيلات الصوتية ({dayVoiceCount})
        </h3>
      </div>

      <JournalVoiceRecorder
        dateKey={dateKey}
        uid={uid}
        canEdit={canEdit}
        onRequireAuth={onRequireAuth}
        savedClips={savedAudioClips}
        onClipSaved={onAudioClipSaved}
        onClipDeleted={onAudioClipDeleted}
      />
    </section>
  );

  const renderQuickNotesSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-900">
          الملاحظات السريعة لليوم ({(draft.quickNotes || []).length})
        </h3>
      </div>

      {canEdit && (
        <form
          onSubmit={handleAddQuickNote}
          className="p-4 rounded-xl bg-white/90 border border-slate-200 space-y-3"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              Object.keys(JOURNAL_QUICK_NOTE_META) as JournalQuickNoteKind[]
            ).map((k) => {
              const meta = JOURNAL_QUICK_NOTE_META[k];
              const active = noteKind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNoteKind(k)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-4">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                maxLength={160}
                placeholder="عنوان مختصر (اختياري)"
                className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            <div className="sm:col-span-6">
              <AutoResizeTextarea
                minRows={1}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={JOURNAL_QUICK_NOTE_META[noteKind].hint}
                className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!noteBody.trim() && !noteTitle.trim()}
                className="w-full h-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer disabled:opacity-45"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {(draft.quickNotes || []).length === 0 ? (
        <div className="p-5 rounded-xl bg-white/60 border border-slate-200 text-center text-xs text-slate-500">
          أضف خواطر سريعة، شيئًا تعلّمته اليوم، تذكيرًا، حدثًا مهمًا، أو فكرة مشروع مرتبطة بهذا اليوم.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(draft.quickNotes || []).map((qn) => {
            const meta =
              JOURNAL_QUICK_NOTE_META[qn.kind] || JOURNAL_QUICK_NOTE_META.thought;
            const isEditing = editingNoteId === qn.id;

            return (
              <div
                key={qn.id}
                className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <select
                      value={editNoteKind}
                      onChange={(e) =>
                        setEditNoteKind(e.target.value as JournalQuickNoteKind)
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                    >
                      {(
                        Object.keys(
                          JOURNAL_QUICK_NOTE_META
                        ) as JournalQuickNoteKind[]
                      ).map((k) => (
                        <option key={k} value={k}>
                          {JOURNAL_QUICK_NOTE_META[k].label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editNoteTitle}
                      onChange={(e) => setEditNoteTitle(e.target.value)}
                      placeholder="عنوان الملاحظة"
                      className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                    />
                    <AutoResizeTextarea
                      minRows={2}
                      value={editNoteBody}
                      onChange={(e) => setEditNoteBody(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditedQuickNote}
                        className="px-2.5 py-1 text-xs bg-[#1E3A5F] text-white rounded-lg cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {meta.label}
                        {qn.createdAtMs ? (
                          <>
                            {' · '}
                            <span className="tabular-nums">
                              {new Date(qn.createdAtMs).toLocaleTimeString(
                                'ar-EG',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </span>
                          </>
                        ) : null}
                      </span>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(qn.id);
                              setEditNoteKind(qn.kind);
                              setEditNoteTitle(qn.title || '');
                              setEditNoteBody(qn.body);
                            }}
                            aria-label="تعديل الملاحظة"
                            className="p-1 text-slate-400 hover:text-[#1E3A5F] rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuickNote(qn.id)}
                            aria-label="حذف الملاحظة"
                            className="p-1 text-slate-400 hover:text-red-700 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {qn.title && (
                      <p className="text-xs font-bold text-slate-900">
                        {qn.title}
                      </p>
                    )}
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {qn.body}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderActivitiesSection = () => (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">
            الأنشطة التلقائية المرتبطة بهذا اليوم ({summary.timelineItems.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">
          متزامنة مع لوحة اليوميات تلقائيًا
        </span>
      </div>

      {summary.timelineItems.length === 0 ? (
        <div className="p-5 rounded-xl bg-white/60 border border-slate-200 text-center text-xs text-slate-500">
          لم تُسجل أنشطة تلقائية (كورسات، مهام، تلخيصات، خواطر) في هذا اليوم بعد.
        </div>
      ) : (
        <div className="space-y-2 max-h-[340px] overflow-y-auto thin-scrollbar pl-1">
          {summary.timelineItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                flushSaveNow();
                onClose();
                onOpenEntity(item.navAction);
              }}
              className="w-full text-right p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#1E3A5F]/40 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.hubAccentHex }}
                  />
                  <span className="font-semibold text-slate-600">
                    {item.typeLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{item.hubTitle}</span>
                  {item.timeLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {item.timeLabel}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#1E3A5F] truncate">
                  {item.title}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${activityStatusClass(
                    item.statusTone
                  )}`}
                >
                  {item.statusLabel}
                </span>
                <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-[#1E3A5F]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diary-modal-title"
      onClick={handleCloseSafely}
    >
      <div
        data-custom-card-surface={
          draft.cardColor && draft.cardColor !== 'default' ? 'light' : undefined
        }
        className={`w-full max-h-[92dvh] h-[92dvh] sm:max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${theme.cardClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                aria-label="اليوم السابق"
                title="اليوم السابق"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                aria-label="اليوم التالي"
                title="اليوم التالي"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>{getDayArabicName(dateKey)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatShortArabicDate(dateKey)}</span>
              </div>
              <h2
                id="diary-modal-title"
                className="font-editorial text-lg sm:text-xl font-bold text-slate-900 truncate"
              >
                {draft.title?.trim() || `صفحة يوم ${formatShortArabicDate(dateKey)}`}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Autosave Status */}
            {canEdit && (
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 px-2">
                {saveState === 'saving' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-[#1E3A5F]" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : saveState === 'dirty' ? (
                  <span>تعديلات قيد الحفظ...</span>
                ) : saveState === 'saved' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-emerald-800 font-semibold">تم الحفظ تلقائيًا</span>
                  </>
                ) : (
                  <span>حفظ تلقائي مفعّل</span>
                )}
              </span>
            )}

            {canEdit && saveState === 'dirty' && (
              <button
                type="button"
                onClick={() => flushSaveNow()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ الآن</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCustomize((s) => !s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                showCustomize
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>تخصيص المظهر</span>
            </button>

            <button
              type="button"
              onClick={handleCloseSafely}
              aria-label="إغلاق اليومية"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Optional Cover Banner + Customization Panel */}
        {(resolvedCoverUrl || showCustomize) && (
          <div className="bg-white/80 border-b border-slate-200 px-4 sm:px-6 py-4 space-y-4 shrink-0 max-h-[42vh] overflow-y-auto thin-scrollbar">
            {resolvedCoverUrl && (() => {
              const safeCoverFrame = sanitizeImageFrameSpec(
                draft.coverFrame,
                DEFAULT_IMAGE_FRAME_SPEC
              );
              return (
                <div className="relative h-36 sm:h-48 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={resolvedCoverUrl}
                    alt={draft.title || 'غلاف اليومية'}
                    referrerPolicy="no-referrer"
                    style={{
                      objectFit: safeCoverFrame.fitMode,
                      objectPosition: `${safeCoverFrame.offsetX}% ${safeCoverFrame.offsetY}%`,
                      transform:
                        safeCoverFrame.zoom !== 1
                          ? `scale(${safeCoverFrame.zoom})`
                          : undefined,
                      transformOrigin:
                        safeCoverFrame.fitMode === 'contain' &&
                        safeCoverFrame.zoom < 1
                          ? '50% 50%'
                          : `${safeCoverFrame.offsetX}% ${safeCoverFrame.offsetY}%`,
                    }}
                    className="w-full h-full"
                  />
                  {draft.subtitle && (
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                      <p className="text-xs sm:text-sm font-semibold text-white">
                        {draft.subtitle}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {showCustomize && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">
                    تخصيص هوية يومية {formatShortArabicDate(dateKey)}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void handleRestoreDefaultAppearance()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>استعادة المظهر الافتراضي</span>
                    </button>
                  )}
                </div>

                {/* Curated Color Swatches */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    لون خلفية البطاقة والصفحة
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      Object.keys(JOURNAL_CARD_THEMES) as JournalCardColorKey[]
                    ).map((colorKey) => {
                      const t = JOURNAL_CARD_THEMES[colorKey];
                      const active = (draft.cardColor || 'default') === colorKey;
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          disabled={!canEdit}
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              cardColor: colorKey,
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer ${
                            active
                              ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 bg-white font-bold text-slate-900'
                              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border ${t.swatchClass}`}
                          />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cover Image & Mood Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadCustomCover(f);
                        e.target.value = '';
                      }}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        disabled={uploadingCover}
                        onClick={() => coverInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] border border-[#1E3A5F]/20 rounded-lg cursor-pointer"
                      >
                        {uploadingCover ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {resolvedCoverUrl ? 'تغيير صورة الغلاف' : 'إضافة صورة غلاف'}
                        </span>
                      </button>
                    )}

                    {canEdit && resolvedCoverUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCoverFrameEditorOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] rounded-lg cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>ضبط الفريم</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((prev) => ({
                              ...prev,
                              coverImageUrl: '',
                              coverImageStoragePath: '',
                              coverFrame: undefined,
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>إزالة الغلاف</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Energy / Mood optional fields */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={draft.moodLabel || ''}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          moodLabel: e.target.value,
                        }))
                      }
                      maxLength={40}
                      placeholder="المزاج اليوم (مثال: هادئ)"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-40"
                    />
                    <select
                      disabled={!canEdit}
                      value={draft.energyScore ?? ''}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          energyScore: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                      aria-label="مستوى الطاقة"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="">الطاقة (اختياري)</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          طاقة {n}/5
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diary Section Navigation Bar */}
        <nav
          aria-label="أقسام اليومية"
          className="bg-white/90 border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0"
        >
          {(
            [
              { id: 'continuous', label: 'العرض المتصل', icon: BookOpen },
              { id: 'writing', label: 'الكتابة', icon: PenLine },
              {
                id: 'photos',
                label: `الصور (${photos.length})`,
                icon: Camera,
              },
              {
                id: 'voice',
                label: `الصوتيات (${dayVoiceCount})`,
                icon: Mic,
              },
              {
                id: 'notes',
                label: `ملاحظات سريعة (${(draft.quickNotes || []).length})`,
                icon: StickyNote,
              },
              {
                id: 'activities',
                label: `الأنشطة (${summary.timelineItems.length})`,
                icon: Layers,
              },
            ] as Array<{ id: DiaryTab; label: string; icon: typeof BookOpen }>
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Scrollable Diary Body */}
        <div className="flex-1 overflow-y-auto thin-scrollbar p-4 sm:p-6 space-y-8">
          {activeTab === 'continuous' && (
            <>
              {renderWrittenSection()}
              <hr className="border-slate-200/80" />
              {renderPhotosSection()}
              <hr className="border-slate-200/80" />
              {renderVoiceSection()}
              <hr className="border-slate-200/80" />
              {renderQuickNotesSection()}
              <hr className="border-slate-200/80" />
              {renderActivitiesSection()}
            </>
          )}
          {activeTab === 'writing' && renderWrittenSection()}
          {activeTab === 'photos' && renderPhotosSection()}
          {activeTab === 'voice' && renderVoiceSection()}
          {activeTab === 'notes' && renderQuickNotesSection()}
          {activeTab === 'activities' && renderActivitiesSection()}
        </div>
      </div>

      {/* Fullscreen Photo Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[65] bg-slate-950/90 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxIndex(null);
          }}
        >
          <div
            className="w-full max-w-5xl flex items-center justify-between text-white pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs sm:text-sm font-semibold truncate">
              {photos[lightboxIndex].caption || photos[lightboxIndex].name}
              <span className="text-slate-400 mr-2 tabular-nums">
                ({lightboxIndex + 1} / {photos.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="إغلاق المعاينة"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="relative flex-1 w-full max-w-5xl flex items-center justify-center min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev === null
                      ? null
                      : (prev - 1 + photos.length) % photos.length
                  )
                }
                aria-label="الصورة السابقة"
                className="p-3 rounded-full bg-white/15 hover:bg-white/25 text-white ml-3 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <img
              src={photos[lightboxIndex].resolvedUrl}
              alt={photos[lightboxIndex].caption || photos[lightboxIndex].name}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] max-w-full object-contain rounded-xl"
            />

            {photos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev === null ? null : (prev + 1) % photos.length
                  )
                }
                aria-label="الصورة التالية"
                className="p-3 rounded-full bg-white/15 hover:bg-white/25 text-white mr-3 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeletePhoto)}
        title="حذف الصورة"
        message="هل تريد حذف هذه الصورة نهائيًا من يومية هذا اليوم؟"
        confirmLabel="حذف الصورة"
        onConfirm={() => void handleConfirmDeletePhoto()}
        onCancel={() => setConfirmDeletePhoto(null)}
      />

      {resolvedCoverUrl && (
        <ImageFrameEditorModal
          open={coverFrameEditorOpen}
          srcUrl={draft.coverImageUrl || resolvedCoverUrl}
          storagePath={draft.coverImageStoragePath}
          title="ضبط إطار وقص صورة الغلاف"
          initialFrame={draft.coverFrame}
          defaultFrame={DEFAULT_IMAGE_FRAME_SPEC}
          onSave={(nextFrame: ImageFrameSpec) => {
            updateDraft((prev) => ({ ...prev, coverFrame: nextFrame }));
            setCoverFrameEditorOpen(false);
          }}
          onClose={() => setCoverFrameEditorOpen(false)}
        />
      )}
    </div>
  );
}
