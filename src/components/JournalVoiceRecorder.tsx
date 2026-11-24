import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Save,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  SavedAudioClipSummary,
  deleteAudioClipFromCache,
  loadAudioClipById,
  saveVoiceRecordingToCache,
} from '../utils/audioCache';
import ConfirmDialog from './ConfirmDialog';

interface JournalVoiceRecorderProps {
  dateKey: string;
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  savedClips: SavedAudioClipSummary[];
  onClipSaved?: (clip: SavedAudioClipSummary) => void;
  onClipDeleted?: (clipId: string) => void;
}

type RecordPhase = 'idle' | 'requesting' | 'recording' | 'paused' | 'preview';

const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB (matches audio-cache bucket limit)

function formatDurationMmSs(secRaw: number): string {
  const sec = Math.max(0, Math.round(secRaw));
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatCreatedStamp(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toLocaleString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export default function JournalVoiceRecorder({
  dateKey,
  uid,
  canEdit,
  onRequireAuth,
  savedClips,
  onClipSaved,
  onClipDeleted,
}: JournalVoiceRecorderProps) {
  const isMediaRecorderSupported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator?.mediaDevices?.getUserMedia);

  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);

  const [draftClip, setDraftClip] = useState<{
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
    url: string;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [playingDraft, setPlayingDraft] = useState(false);

  // Playback state for saved recordings
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null);
  const [isPlayingSaved, setIsPlayingSaved] = useState(false);
  const [savedCurrentSec, setSavedCurrentSec] = useState(0);
  const [savedDurationSec, setSavedDurationSec] = useState(0);
  const [confirmDeleteClip, setConfirmDeleteClip] =
    useState<SavedAudioClipSummary | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const accumulatedMsRef = useRef<number>(0);
  const segmentStartMsRef = useRef<number>(0);
  const draftAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedObjectUrlRef = useRef<string | null>(null);

  const dayEntityId = `journal:${dateKey}`;

  const dayClips = useMemo(
    () =>
      savedClips
        .filter((c) => c.entityId === dayEntityId)
        .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0)),
    [savedClips, dayEntityId]
  );

  // Reset recorder state if dateKey changes
  useEffect(() => {
    setErrorMsg(null);
    setStatusNotice(null);
    setIsPermissionError(false);
    if (draftAudioRef.current) {
      draftAudioRef.current.pause();
      draftAudioRef.current = null;
    }
    setPlayingDraft(false);
    if (draftClip?.url) {
      URL.revokeObjectURL(draftClip.url);
    }
    setDraftClip(null);
    setDraftTitle('');
    if (phase === 'preview') setPhase('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // Live timer while recording
  useEffect(() => {
    if (phase !== 'recording') return;
    const interval = window.setInterval(() => {
      const currentMs =
        accumulatedMsRef.current +
        (segmentStartMsRef.current ? Date.now() - segmentStartMsRef.current : 0);
      setElapsedSeconds(Math.floor(currentMs / 1000));
    }, 250);
    return () => window.clearInterval(interval);
  }, [phase]);

  // Cleanup streams & object URLs on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (draftAudioRef.current) draftAudioRef.current.pause();
      if (savedAudioRef.current) savedAudioRef.current.pause();
      if (savedObjectUrlRef.current) URL.revokeObjectURL(savedObjectUrlRef.current);
    };
  }, []);

  const mapMicError = (err: unknown): { message: string; perm: boolean } => {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        perm: true,
        message:
          'تم رفض إذن الميكروفون. اسمح للمتصفح بالوصول إلى الميكروفون ثم اضغط «إعادة المحاولة».',
      };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        perm: false,
        message: 'لم يُعثر على ميكروفون متصل بهذا الجهاز.',
      };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        perm: false,
        message: 'الميكروفون مستخدم في تطبيق آخر حاليًا. أغلقه ثم حاول مجددًا.',
      };
    }
    if (name === 'SecurityError') {
      return {
        perm: true,
        message: 'يتطلب تسجيل الصوت اتصالاً آمنًا (HTTPS).',
      };
    }
    return {
      perm: true,
      message: 'تعذر بدء التسجيل الصوتي. تأكد من صلاحيات الميكروفون.',
    };
  };

  const handleStartRecording = async () => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    if (!isMediaRecorderSupported) {
      setErrorMsg(
        'المتصفح الحالي لا يدعم واجهة MediaRecorder لتسجيل الصوت. جرّب استخدام متصفح حديث مثل Chrome أو Safari أو Firefox.'
      );
      return;
    }

    setErrorMsg(null);
    setStatusNotice(null);
    setIsPermissionError(false);

    if (draftClip?.url) {
      URL.revokeObjectURL(draftClip.url);
    }
    setDraftClip(null);
    setPhase('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
      ];
      const mimeType =
        preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      accumulatedMsRef.current = 0;
      setElapsedSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPhase('idle');
        setErrorMsg('انقطع التسجيل الصوتي بشكل غير متوقع. حاول مرة أخرى.');
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (segmentStartMsRef.current > 0) {
          accumulatedMsRef.current += Date.now() - segmentStartMsRef.current;
          segmentStartMsRef.current = 0;
        }
        const totalSec = Math.max(1, Math.round(accumulatedMsRef.current / 1000));
        const actualType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        chunksRef.current = [];

        if (blob.size < 256) {
          setPhase('idle');
          setErrorMsg('التسجيل قصير جدًا أو فارغ. سجّل لمدة ثانية على الأقل.');
          return;
        }
        if (blob.size > MAX_AUDIO_BYTES) {
          setPhase('idle');
          setErrorMsg('تجاوز حجم التسجيل الحد الأقصى المسموح (100 ميجابايت).');
          return;
        }

        const stamp = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const objUrl = URL.createObjectURL(blob);
        setDraftClip({
          blob,
          mimeType: actualType,
          durationSeconds: totalSec,
          url: objUrl,
        });
        setDraftTitle(`مذكرة صوتية (${stamp})`);
        setPhase('preview');
      };

      mediaRecorderRef.current = recorder;
      segmentStartMsRef.current = Date.now();
      recorder.start(250);
      setPhase('recording');
    } catch (err) {
      const mapped = mapMicError(err);
      setIsPermissionError(mapped.perm);
      setErrorMsg(mapped.message);
      setPhase('idle');
    }
  };

  const handlePauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    if (typeof rec.pause === 'function') {
      rec.pause();
      if (segmentStartMsRef.current > 0) {
        accumulatedMsRef.current += Date.now() - segmentStartMsRef.current;
        segmentStartMsRef.current = 0;
      }
      setElapsedSeconds(Math.floor(accumulatedMsRef.current / 1000));
      setPhase('paused');
    }
  };

  const handleResumeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    if (typeof rec.resume === 'function') {
      rec.resume();
      segmentStartMsRef.current = Date.now();
      setPhase('recording');
    }
  };

  const handleStopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    try {
      if (rec.state === 'recording' || rec.state === 'paused') {
        rec.requestData();
        rec.stop();
      }
    } catch {
      setPhase('idle');
    }
    mediaRecorderRef.current = null;
  };

  const handleTogglePlayDraft = async () => {
    if (!draftClip) return;
    if (playingDraft && draftAudioRef.current) {
      draftAudioRef.current.pause();
      setPlayingDraft(false);
      return;
    }
    const audio = draftAudioRef.current || new Audio(draftClip.url);
    audio.setAttribute('playsinline', 'true');
    audio.onended = () => setPlayingDraft(false);
    draftAudioRef.current = audio;
    try {
      await audio.play();
      setPlayingDraft(true);
    } catch {
      setPlayingDraft(false);
    }
  };

  const handleDiscardDraft = () => {
    if (draftAudioRef.current) {
      draftAudioRef.current.pause();
      draftAudioRef.current = null;
    }
    setPlayingDraft(false);
    if (draftClip?.url) {
      URL.revokeObjectURL(draftClip.url);
    }
    setDraftClip(null);
    setDraftTitle('');
    setPhase('idle');
  };

  const handleSaveDraftToJournal = async () => {
    if (!draftClip) return;
    if (!canEdit || !uid) {
      onRequireAuth();
      return;
    }
    setSavingDraft(true);
    setErrorMsg(null);
    try {
      const cleanTitle = draftTitle.trim() || `مذكرة صوتية · ${dateKey}`;
      const res = await saveVoiceRecordingToCache(
        uid,
        draftClip.blob,
        draftClip.mimeType,
        draftClip.durationSeconds,
        cleanTitle,
        {
          entityType: 'other',
          entityId: dayEntityId,
          title: cleanTitle,
        }
      );

      const newClip: SavedAudioClipSummary = {
        id: res.cacheId,
        title: cleanTitle,
        previewText: '',
        entityType: 'other',
        entityId: dayEntityId,
        voiceName: 'Kore',
        speed: 'normal',
        mimeType: draftClip.mimeType,
        sizeBytes: draftClip.blob.size,
        durationSeconds: draftClip.durationSeconds,
        lastPositionSeconds: 0,
        playbackRate: 1,
        updatedAtMs: Date.now(),
      };
      onClipSaved?.(newClip);
      handleDiscardDraft();
      setStatusNotice(
        res.cloudSaved
          ? 'تم حفظ التسجيل الصوتي في يومية اليوم وسحابة الحساب بنجاح.'
          : 'تم حفظ التسجيل محليًا في اليومية (تحقق من صلاحيات التخزين للمزامنة السحابية).'
      );
      window.setTimeout(() => setStatusNotice(null), 3500);
    } catch {
      setErrorMsg('تعذر حفظ التسجيل الصوتي. حاول مرة أخرى.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleTogglePlaySavedClip = async (clip: SavedAudioClipSummary) => {
    setErrorMsg(null);

    if (activeClipId === clip.id && savedAudioRef.current) {
      if (isPlayingSaved) {
        savedAudioRef.current.pause();
        setIsPlayingSaved(false);
      } else {
        try {
          await savedAudioRef.current.play();
          setIsPlayingSaved(true);
        } catch {
          setIsPlayingSaved(false);
        }
      }
      return;
    }

    if (savedAudioRef.current) {
      savedAudioRef.current.pause();
      savedAudioRef.current = null;
    }
    if (savedObjectUrlRef.current) {
      URL.revokeObjectURL(savedObjectUrlRef.current);
      savedObjectUrlRef.current = null;
    }

    setLoadingClipId(clip.id);
    try {
      const loaded = await loadAudioClipById(uid, clip.id);
      if (!loaded) {
        setErrorMsg('تعذر تحميل ملف التسجيل الصوتي. تأكد من اتصالك بالإنترنت.');
        return;
      }

      const url = URL.createObjectURL(loaded.blob);
      savedObjectUrlRef.current = url;
      const audio = new Audio(url);
      audio.setAttribute('playsinline', 'true');
      savedAudioRef.current = audio;

      audio.onloadedmetadata = () => {
        setSavedDurationSec(
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : clip.durationSeconds
        );
      };
      audio.ontimeupdate = () => {
        setSavedCurrentSec(audio.currentTime || 0);
      };
      audio.onended = () => {
        setIsPlayingSaved(false);
        setSavedCurrentSec(0);
      };

      setActiveClipId(clip.id);
      setSavedCurrentSec(0);
      setSavedDurationSec(clip.durationSeconds || 0);
      await audio.play();
      setIsPlayingSaved(true);
    } catch {
      setErrorMsg('تعذر تشغيل هذا التسجيل الصوتي في المتصفح الحالي.');
    } finally {
      setLoadingClipId(null);
    }
  };

  const handleSeekSavedClip = (sec: number) => {
    if (!savedAudioRef.current) return;
    savedAudioRef.current.currentTime = sec;
    setSavedCurrentSec(sec);
  };

  const handleConfirmDeleteSavedClip = async () => {
    const target = confirmDeleteClip;
    if (!target) return;
    setConfirmDeleteClip(null);
    if (activeClipId === target.id && savedAudioRef.current) {
      savedAudioRef.current.pause();
      savedAudioRef.current = null;
      setActiveClipId(null);
      setIsPlayingSaved(false);
    }
    await deleteAudioClipFromCache(uid, target.id);
    onClipDeleted?.(target.id);
  };

  return (
    <div className="space-y-4">
      {/* Recorder Controls Bar */}
      <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-900">
              تسجيل مذكرة صوتية لليوم
            </p>
            <p className="text-[11px] text-slate-500">
              سجّل أفكارك مباشرة بالصوت مع إمكانية الإيقاف المؤقت والاستئناف والحفظ الآمن دون تفريغ تلقائي.
            </p>
          </div>

          {!isMediaRecorderSupported && (
            <span className="text-[11px] font-semibold text-amber-800">
              المتصفح لا يدعم تسجيل الصوت مباشرة
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {phase === 'idle' && (
            <button
              type="button"
              disabled={!isMediaRecorderSupported}
              onClick={() => void handleStartRecording()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Mic className="w-4 h-4" aria-hidden="true" />
              <span>بدء التسجيل الصوتي</span>
            </button>
          )}

          {phase === 'requesting' && (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>جاري طلب إذن الميكروفون...</span>
            </span>
          )}

          {(phase === 'recording' || phase === 'paused') && (
            <div className="flex flex-wrap items-center gap-2 w-full">
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                  phase === 'recording'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {phase === 'recording' ? 'جاري التسجيل' : 'متوقف مؤقتًا'}
                </span>
                <span className="font-mono-num tabular-nums">
                  {formatDurationMmSs(elapsedSeconds)}
                </span>
              </div>

              {phase === 'recording' ? (
                <button
                  type="button"
                  onClick={handlePauseRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إيقاف مؤقت</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResumeRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-white hover:bg-slate-100 border border-[#1E3A5F]/30 rounded-xl cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>استئناف</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                <span>إنهاء التسجيل</span>
              </button>
            </div>
          )}

          {phase === 'preview' && draftClip && (
            <div className="w-full p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  معاينة التسجيل قبل الحفظ
                </span>
                <span className="text-xs font-mono-num tabular-nums text-slate-500">
                  المدة: {formatDurationMmSs(draftClip.durationSeconds)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    maxLength={140}
                    placeholder="عنوان التسجيل الصوتي..."
                    className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                <div className="sm:col-span-6 flex flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => void handleTogglePlayDraft()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    {playingDraft ? (
                      <Pause className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    )}
                    <span>{playingDraft ? 'إيقاف' : 'استماع'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingDraft}
                    onClick={() => void handleSaveDraftToJournal()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {savingDraft ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{savingDraft ? 'جاري الحفظ...' : 'حفظ في اليومية'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    aria-label="تجاهل التسجيل"
                    className="p-2 text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {statusNotice && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{statusNotice}</span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
          >
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </span>
            {isPermissionError && (
              <button
                type="button"
                onClick={() => void handleStartRecording()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-red-200 rounded-md hover:bg-red-100 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>إعادة المحاولة</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Saved Recordings for this Day */}
      {dayClips.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
          لا توجد تسجيلات صوتية محفوظة لهذا اليوم بعد.
        </div>
      ) : (
        <div className="space-y-2.5">
          {dayClips.map((clip) => {
            const isActive = activeClipId === clip.id;
            const isLoading = loadingClipId === clip.id;
            const totalDur = isActive && savedDurationSec > 0
              ? savedDurationSec
              : clip.durationSeconds;
            return (
              <div
                key={clip.id}
                className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => void handleTogglePlaySavedClip(clip)}
                      aria-label={
                        isActive && isPlayingSaved
                          ? `إيقاف ${clip.title}`
                          : `تشغيل ${clip.title}`
                      }
                      className="w-9 h-9 rounded-lg bg-[#1E3A5F] hover:bg-[#162C49] text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isActive && isPlayingSaved ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {clip.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Volume2 className="w-3 h-3" aria-hidden="true" />
                          {formatDurationMmSs(clip.durationSeconds)}
                        </span>
                        {clip.updatedAtMs ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              {formatCreatedStamp(clip.updatedAtMs)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteClip(clip)}
                      title="حذف التسجيل"
                      aria-label="حذف التسجيل"
                      className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isActive && (
                  <div className="flex items-center gap-2.5 pt-1">
                    <span className="text-[11px] font-mono-num tabular-nums text-slate-500">
                      {formatDurationMmSs(savedCurrentSec)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, Math.round(totalDur))}
                      value={Math.min(
                        Math.round(savedCurrentSec),
                        Math.max(1, Math.round(totalDur))
                      )}
                      onChange={(e) => handleSeekSavedClip(Number(e.target.value))}
                      aria-label="موضع التشغيل"
                      className="flex-1 accent-[#1E3A5F] cursor-pointer"
                    />
                    <span className="text-[11px] font-mono-num tabular-nums text-slate-500">
                      {formatDurationMmSs(totalDur)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteClip)}
        title="حذف التسجيل الصوتي"
        message={`هل تريد حذف التسجيل «${confirmDeleteClip?.title || ''}» نهائيًا من هذه اليومية؟`}
        confirmLabel="حذف التسجيل"
        onConfirm={() => void handleConfirmDeleteSavedClip()}
        onCancel={() => setConfirmDeleteClip(null)}
      />
    </div>
  );
}
