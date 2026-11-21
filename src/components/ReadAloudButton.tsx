import { useEffect, useRef, useState } from 'react';
import {
  Database,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Square,
  Volume2,
} from 'lucide-react';
import { ReadAloudVoiceName } from '../data/curriculumData';
import { auth } from '../firebase';
import {
  AudioEntityType,
  loadCachedAudioClip,
  saveAudioClipToCache,
  updateAudioPlaybackProgress,
} from '../utils/audioCache';

interface ReadAloudButtonProps {
  text: string;
  voiceName: ReadAloudVoiceName;
  speed: 'normal' | 'calm';
  uid?: string | null;
  entityType?: AudioEntityType;
  entityId?: string;
  title?: string;
  disabled?: boolean;
  cacheOnlyMode?: boolean;
  onJumpToCreateAudio?: () => void;
  onRequireAuth?: () => void;
  onAudioSaved?: () => void;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
type PlaybackRateValue = (typeof PLAYBACK_RATES)[number];

type PlayerStatus = 'idle' | 'ready' | 'loading' | 'playing' | 'paused';

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ReadAloudButton({
  text,
  voiceName,
  speed,
  uid,
  entityType,
  entityId,
  title,
  disabled = false,
  cacheOnlyMode = false,
  onJumpToCreateAudio,
  onRequireAuth,
  onAudioSaved,
}: ReadAloudButtonProps) {
  const effectiveUid = uid ?? auth?.currentUser?.uid ?? null;
  const cleanText = text.trim();

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [checkingCache, setCheckingCache] = useState(false);
  const [hasCachedAudio, setHasCachedAudio] = useState(false);
  const [cacheSource, setCacheSource] = useState<'local' | 'cloud' | null>(null);
  const [cacheId, setCacheId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRateValue>(1);
  const [usingSpeechFallback, setUsingSpeechFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cacheSignatureRef = useRef<string>('');
  const lastSyncRef = useRef<{ time: number; ts: number }>({ time: 0, ts: 0 });
  const cacheIdRef = useRef<string>('');
  const playbackRateRef = useRef<PlaybackRateValue>(1);
  const durationRef = useRef<number>(0);

  cacheIdRef.current = cacheId;
  playbackRateRef.current = playbackRate;
  durationRef.current = duration;

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const persistProgress = (pos: number, force = false) => {
    const cid = cacheIdRef.current;
    if (!cid) return;
    const now = Date.now();
    if (!force && now - lastSyncRef.current.ts < 4500 && Math.abs(pos - lastSyncRef.current.time) < 3) {
      return;
    }
    lastSyncRef.current = { time: pos, ts: now };
    void updateAudioPlaybackProgress(
      effectiveUid,
      cid,
      pos,
      playbackRateRef.current,
      durationRef.current > 0 ? durationRef.current : undefined
    );
  };

  const cleanupAudioElement = (resetPos = true) => {
    if (audioRef.current) {
      const pos = audioRef.current.currentTime || 0;
      if (cacheIdRef.current && pos > 0) {
        persistProgress(pos, true);
      }
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current = null;
    }
    revokeObjectUrl();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (resetPos) {
      setCurrentTime(0);
      setDuration(0);
    }
    setUsingSpeechFallback(false);
  };

  useEffect(() => {
    return () => {
      cleanupAudioElement(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload cached audio & saved position across devices
  useEffect(() => {
    const signature = `${effectiveUid || 'anon'}|${voiceName}|${speed}|${entityId || ''}|${cleanText}`;
    if (cacheSignatureRef.current === signature) return;
    cacheSignatureRef.current = signature;

    cleanupAudioElement(true);
    setStatus('idle');
    setHasCachedAudio(false);
    setCacheSource(null);
    setCacheId('');
    setErrorMsg(null);

    if (!cleanText) return;

    let cancelled = false;
    setCheckingCache(true);
    void loadCachedAudioClip(effectiveUid, cleanText, voiceName, speed, {
      entityType,
      entityId,
      title,
    })
      .then((cached) => {
        if (cancelled || !cached) return;
        setHasCachedAudio(true);
        setCacheSource(cached.source);
        setCacheId(cached.cacheId);
        if (cached.durationSeconds && cached.durationSeconds > 0) {
          setDuration(cached.durationSeconds);
        }
        if (cached.lastPositionSeconds && cached.lastPositionSeconds > 0) {
          setCurrentTime(cached.lastPositionSeconds);
        }
        const savedRate = cached.playbackRate;
        if (
          savedRate === 0.75 ||
          savedRate === 1 ||
          savedRate === 1.25 ||
          savedRate === 1.5 ||
          savedRate === 2
        ) {
          setPlaybackRate(savedRate);
        }
        setStatus('ready');
      })
      .finally(() => {
        if (!cancelled) setCheckingCache(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUid, cleanText, voiceName, speed, entityId, entityType, title]);

  const attachBlobToAudioAndPlay = async (
    blob: Blob,
    startAt = 0,
    rate: PlaybackRateValue = playbackRate
  ) => {
    cleanupAudioElement(false);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audio.playbackRate = rate;
    audioRef.current = audio;
    setUsingSpeechFallback(false);

    audio.onloadedmetadata = () => {
      audio.playbackRate = playbackRateRef.current;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationRef.current = audio.duration;
      }
      if (startAt > 0 && startAt < (audio.duration || Infinity)) {
        audio.currentTime = startAt;
        setCurrentTime(startAt);
      }
    };

    audio.ontimeupdate = () => {
      const pos = audio.currentTime || 0;
      setCurrentTime(pos);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        durationRef.current = audio.duration;
      }
      persistProgress(pos, false);
    };

    audio.onended = () => {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      persistProgress(0, true);
      setStatus('ready');
    };

    audio.onerror = () => {
      setErrorMsg('تعذّر تشغيل الملف الصوتي المحفوظ.');
      setStatus('ready');
    };

    await audio.play();
    setStatus('playing');
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleSelectPlaybackRate = (next: PlaybackRateValue) => {
    setPlaybackRate(next);
    playbackRateRef.current = next;
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
    if (cacheIdRef.current) {
      void updateAudioPlaybackProgress(
        effectiveUid,
        cacheIdRef.current,
        currentTime,
        next,
        durationRef.current > 0 ? durationRef.current : undefined
      );
    }
  };

  const handleCyclePlaybackRate = () => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    handleSelectPlaybackRate(next);
  };

  const playBrowserSpeechFallback = (textToSpeak: string): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      cleanupAudioElement(true);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'ar-EG';
      utterance.rate = (speed === 'calm' ? 0.85 : 1.0) * playbackRate;
      utterance.onend = () => {
        setUsingSpeechFallback(false);
        setStatus(hasCachedAudio ? 'ready' : 'idle');
      };
      utterance.onerror = () => {
        setUsingSpeechFallback(false);
        setStatus(hasCachedAudio ? 'ready' : 'idle');
        setErrorMsg('تعذّر تشغيل القراءة الصوتية حاليًا.');
      };
      window.speechSynthesis.speak(utterance);
      setUsingSpeechFallback(true);
      setStatus('playing');
      return true;
    } catch {
      return false;
    }
  };

  const generateOrLoadAndPlay = async (forceRefresh = false, restartFromZero = false) => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }
    if (!cleanText) {
      setErrorMsg('اكتب ملاحظة أو نصًا أولاً للاستماع إليه.');
      return;
    }

    setErrorMsg(null);
    const resumeTarget = restartFromZero ? 0 : currentTime;

    if (!forceRefresh && audioRef.current) {
      if (restartFromZero) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      } else if (resumeTarget > 0 && Math.abs(audioRef.current.currentTime - resumeTarget) > 1) {
        audioRef.current.currentTime = resumeTarget;
      }
      try {
        await audioRef.current.play();
        setStatus('playing');
        return;
      } catch {
        // Reload blob below
      }
    }

    // 1. Check IndexedDB / Firestore cross-device cache before /api/tts
    if (!forceRefresh) {
      const cached = await loadCachedAudioClip(effectiveUid, cleanText, voiceName, speed, {
        entityType,
        entityId,
        title,
      });
      if (cached) {
        setHasCachedAudio(true);
        setCacheSource(cached.source);
        setCacheId(cached.cacheId);
        cacheIdRef.current = cached.cacheId;
        if (cached.durationSeconds && cached.durationSeconds > 0) {
          setDuration(cached.durationSeconds);
        }
        const effectiveStart = restartFromZero
          ? 0
          : resumeTarget > 0
          ? resumeTarget
          : cached.lastPositionSeconds ?? 0;
        await attachBlobToAudioAndPlay(cached.blob, effectiveStart, playbackRate);
        return;
      }
    }

    if (cacheOnlyMode) {
      setErrorMsg('لم يتم إنشاء صوت لهذا التلخيص بعد — يمكنك إنشاؤه من صفحة التلخيص.');
      return;
    }

    // 2. Call /api/tts when not yet cached (or user explicitly clicks Regenerate)
    setStatus('loading');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceName,
          speed,
        }),
      });
      const rawText = await res.text();
      let data: {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }
      if (!res.ok || !data.audioBase64) {
        if (playBrowserSpeechFallback(cleanText)) {
          return;
        }
        throw new Error(data.error || 'تعذّر توليد الصوت حاليًا.');
      }

      const saved = await saveAudioClipToCache(
        effectiveUid,
        cleanText,
        voiceName,
        speed,
        data.audioBase64,
        data.mimeType || 'audio/wav',
        { entityType, entityId, title }
      );
      setHasCachedAudio(true);
      setCacheSource(saved.source);
      setCacheId(saved.cacheId);
      cacheIdRef.current = saved.cacheId;
      if (saved.durationSeconds && saved.durationSeconds > 0) {
        setDuration(saved.durationSeconds);
      }
      onAudioSaved?.();
      await attachBlobToAudioAndPlay(saved.blob, 0, playbackRate);
    } catch (err) {
      if (playBrowserSpeechFallback(cleanText)) {
        return;
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذّر توليد وتشغيل الصوت حاليًا.'
      );
      setStatus(hasCachedAudio ? 'ready' : 'idle');
    }
  };

  const handlePauseOrResume = async () => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }

    if (usingSpeechFallback && 'speechSynthesis' in window) {
      if (status === 'playing') {
        window.speechSynthesis.pause();
        setStatus('paused');
      } else if (status === 'paused') {
        window.speechSynthesis.resume();
        setStatus('playing');
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      await generateOrLoadAndPlay(false, false);
      return;
    }

    if (status === 'playing') {
      audio.pause();
      persistProgress(audio.currentTime || currentTime, true);
      setStatus('paused');
    } else {
      await audio.play();
      setStatus('playing');
    }
  };

  const handleSeekOffset = async (deltaSeconds: number) => {
    if (!audioRef.current) {
      await generateOrLoadAndPlay(false, false);
      return;
    }
    const audio = audioRef.current;
    const maxDur = Number.isFinite(audio.duration) ? audio.duration : duration || 0;
    const nextPos = Math.max(
      0,
      Math.min(maxDur > 0 ? maxDur : Infinity, audio.currentTime + deltaSeconds)
    );
    audio.currentTime = nextPos;
    setCurrentTime(nextPos);
    persistProgress(nextPos, true);
  };

  const handleStopAndReset = () => {
    if (usingSpeechFallback && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setUsingSpeechFallback(false);
      setStatus(hasCachedAudio ? 'ready' : 'idle');
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    persistProgress(0, true);
    setStatus(hasCachedAudio ? 'ready' : 'idle');
  };

  const showPlayerBar =
    !usingSpeechFallback &&
    (status === 'playing' || status === 'paused' || hasCachedAudio);

  return (
    <div className="inline-flex flex-col items-stretch sm:items-end gap-1.5 max-w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        {(status === 'idle' || status === 'ready') &&
          (cacheOnlyMode && !hasCachedAudio ? (
            onJumpToCreateAudio ? (
              <button
                type="button"
                onClick={onJumpToCreateAudio}
                title="افتح صفحة التلخيص لإنشاء الصوت مرة واحدة ثم اسمعه هنا تلقائيًا"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>أنشئ الصوت من صفحة التلخيص</span>
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => void generateOrLoadAndPlay(false, false)}
              disabled={disabled || checkingCache}
              title={
                disabled
                  ? 'سجّل الدخول لتفعيل الاستماع الصوتي'
                  : hasCachedAudio
                  ? 'تشغيل الصوت المحفوظ على هذا الحساب بدون إعادة توليد'
                  : 'توليد الصوت وحفظه للاستماع على أي جهاز'
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                hasCachedAudio
                  ? 'text-white bg-emerald-700 hover:bg-emerald-800'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {checkingCache ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>فحص الصوت المحفوظ...</span>
                </>
              ) : hasCachedAudio ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>
                    {currentTime > 2
                      ? `متابعة من ${formatAudioTime(currentTime)}`
                      : 'تشغيل الصوت (محفوظ)'}
                  </span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>إنشاء وتشغيل الصوت</span>
                </>
              )}
            </button>
          ))}

        {status === 'loading' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-600 bg-slate-100 rounded-lg whitespace-nowrap shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>جاري توليد الصوت وحفظه سحابيًا...</span>
          </span>
        )}

        {(status === 'playing' || status === 'paused') && (
          <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 border border-slate-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => void handlePauseOrResume()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {status === 'playing' ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>إيقاف مؤقت</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>متابعة</span>
                </>
              )}
            </button>

            {!usingSpeechFallback && (
              <>
                <button
                  type="button"
                  onClick={() => void handleSeekOffset(-10)}
                  title="ترجيع 10 ثواني"
                  aria-label="ترجيع 10 ثواني"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>-10ث</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSeekOffset(10)}
                  title="تقديم 10 ثواني"
                  aria-label="تقديم 10 ثواني"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  <span>+10ث</span>
                  <RotateCw className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={handleCyclePlaybackRate}
                  title="تغيير سرعة التشغيل (0.75x / 1x / 1.25x / 1.5x / 2x)"
                  aria-label="سرعة التشغيل"
                  className="px-2.5 py-1.5 min-h-[36px] text-xs font-bold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  {playbackRate}x
                </button>

                <button
                  type="button"
                  onClick={() => void generateOrLoadAndPlay(false, true)}
                  title="من البداية بدون إعادة توليد"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3" aria-hidden="true" />
                  <span>من البداية</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleStopAndReset}
              title="إيقاف والعودة للبداية"
              aria-label="إيقاف والعودة للبداية"
              className="inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:text-red-700 hover:bg-red-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" aria-hidden="true" />
              <span className="hidden sm:inline">إيقاف</span>
            </button>
          </div>
        )}

        {/* Speed quick selector when cached & paused/ready */}
        {hasCachedAudio && (status === 'idle' || status === 'ready') && (
          <button
            type="button"
            onClick={handleCyclePlaybackRate}
            title="سرعة التشغيل"
            className="px-2.5 py-2 min-h-[38px] text-xs font-bold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg tabular-nums cursor-pointer"
          >
            {playbackRate}x
          </button>
        )}

        {/* Explicit Regenerate button (never consumes API unless clicked) */}
        {!cacheOnlyMode && hasCachedAudio && status !== 'loading' && (
          <button
            type="button"
            onClick={() => void generateOrLoadAndPlay(true, true)}
            disabled={disabled}
            title="إعادة توليد الصوت من النص المحدث (يستدعي الـ API)"
            aria-label="إعادة توليد الصوت"
            className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">إعادة توليد</span>
          </button>
        )}
      </div>

      {/* Persistent Scrubber & Saved State */}
      {showPlayerBar && (
        <div className="w-full sm:w-72 flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
          <span className="tabular-nums font-mono-num shrink-0">
            {formatAudioTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.5}
            value={Math.min(currentTime, duration > 0 ? duration : 1)}
            onChange={(e) => {
              const target = Number(e.target.value);
              if (audioRef.current) {
                audioRef.current.currentTime = target;
              }
              setCurrentTime(target);
              persistProgress(target, true);
            }}
            aria-label="شريط موضع الصوت"
            className="w-full accent-[#1E3A5F] cursor-pointer h-2"
          />
          <span className="tabular-nums font-mono-num shrink-0">
            {duration > 0 ? formatAudioTime(duration) : '--:--'}
          </span>
        </div>
      )}

      {hasCachedAudio && status === 'ready' && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
          <Database className="w-2.5 h-2.5" aria-hidden="true" />
          <span>
            {cacheSource === 'cloud'
              ? 'محفوظ سحابيًا — يعمل على جميع أجهزتك بدون إعادة توليد'
              : 'محفوظ وجاهز للتشغيل الفوري'}
          </span>
        </span>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 text-[11px] text-red-700">
          <span>{errorMsg}</span>
          {!cacheOnlyMode && (
            <button
              type="button"
              onClick={() => void generateOrLoadAndPlay(false, false)}
              className="underline font-semibold cursor-pointer"
            >
              إعادة المحاولة
            </button>
          )}
        </div>
      )}
    </div>
  );
}
