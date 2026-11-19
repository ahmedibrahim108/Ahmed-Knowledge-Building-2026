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
  loadCachedAudioClip,
  saveAudioClipToCache,
} from '../utils/audioCache';

interface ReadAloudButtonProps {
  text: string;
  voiceName: ReadAloudVoiceName;
  speed: 'normal' | 'calm';
  uid?: string | null;
  disabled?: boolean;
  onRequireAuth?: () => void;
}

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
  disabled = false,
  onRequireAuth,
}: ReadAloudButtonProps) {
  const effectiveUid = uid ?? auth.currentUser?.uid ?? null;
  const cleanText = text.trim();

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [hasCachedAudio, setHasCachedAudio] = useState(false);
  const [cacheSource, setCacheSource] = useState<'local' | 'cloud' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [usingSpeechFallback, setUsingSpeechFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cacheSignatureRef = useRef<string>('');

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const cleanupAudioElement = () => {
    if (audioRef.current) {
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
    setCurrentTime(0);
    setDuration(0);
    setUsingSpeechFallback(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioElement();
    };
  }, []);

  // Preload cached audio existence whenever text/voice/speed/uid changes
  useEffect(() => {
    const signature = `${effectiveUid || 'anon'}|${voiceName}|${speed}|${cleanText}`;
    if (cacheSignatureRef.current === signature) return;
    cacheSignatureRef.current = signature;

    cleanupAudioElement();
    setStatus('idle');
    setHasCachedAudio(false);
    setCacheSource(null);
    setErrorMsg(null);

    if (!cleanText) return;

    let cancelled = false;
    void loadCachedAudioClip(effectiveUid, cleanText, voiceName, speed).then(
      (cached) => {
        if (cancelled || !cached) return;
        setHasCachedAudio(true);
        setCacheSource(cached.source);
        setStatus('ready');
      }
    );

    return () => {
      cancelled = true;
    };
  }, [effectiveUid, cleanText, voiceName, speed]);

  const attachBlobToAudioAndPlay = async (blob: Blob, startAt = 0) => {
    cleanupAudioElement();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;
    setUsingSpeechFallback(false);

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      if (startAt > 0 && startAt < (audio.duration || Infinity)) {
        audio.currentTime = startAt;
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setStatus('ready');
    };

    audio.onerror = () => {
      setErrorMsg('تعذر تشغيل الملف الصوتي المحفوظ.');
      setStatus('ready');
    };

    await audio.play();
    setStatus('playing');
  };

  const playBrowserSpeechFallback = (textToSpeak: string): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      cleanupAudioElement();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'ar-EG';
      utterance.rate = speed === 'calm' ? 0.85 : 1.0;
      utterance.onend = () => {
        setUsingSpeechFallback(false);
        setStatus(hasCachedAudio ? 'ready' : 'idle');
      };
      utterance.onerror = () => {
        setUsingSpeechFallback(false);
        setStatus(hasCachedAudio ? 'ready' : 'idle');
        setErrorMsg('تعذر تشغيل القراءة الصوتية حاليًا.');
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
      setErrorMsg('اكتب ملاحظة أولاً للاستماع إليها.');
      return;
    }

    setErrorMsg(null);

    // If audio element is already loaded in memory (e.g. paused or ready) and not regenerating:
    if (!forceRefresh && audioRef.current) {
      if (restartFromZero) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      try {
        await audioRef.current.play();
        setStatus('playing');
        return;
      } catch {
        // fallback to reloading blob below
      }
    }

    // 1. Try persistent DB / local cache BEFORE hitting /api/tts
    if (!forceRefresh) {
      const cached = await loadCachedAudioClip(
        effectiveUid,
        cleanText,
        voiceName,
        speed
      );
      if (cached) {
        setHasCachedAudio(true);
        setCacheSource(cached.source);
        await attachBlobToAudioAndPlay(cached.blob, 0);
        return;
      }
    }

    // 2. Call /api/tts ONLY if not cached yet (or explicitly refreshing)
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
        throw new Error(data.error || 'تعذر تشغيل القراءة الصوتية حاليًا.');
      }

      const saved = await saveAudioClipToCache(
        effectiveUid,
        cleanText,
        voiceName,
        speed,
        data.audioBase64,
        data.mimeType || 'audio/wav'
      );
      setHasCachedAudio(true);
      setCacheSource(saved.source);
      await attachBlobToAudioAndPlay(saved.blob, 0);
    } catch (err) {
      if (playBrowserSpeechFallback(cleanText)) {
        return;
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تشغيل الصوت حاليًا.'
      );
      setStatus(hasCachedAudio ? 'ready' : 'idle');
    }
  };

  // Toggle Pause <-> Resume from exact timestamp without resetting
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
      setStatus('paused');
    } else {
      await audio.play();
      setStatus('playing');
    }
  };

  // Jump -10s or +10s smoothly
  const handleSeekOffset = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxDur = Number.isFinite(audio.duration) ? audio.duration : duration || 0;
    const nextPos = Math.max(
      0,
      Math.min(maxDur > 0 ? maxDur : Infinity, audio.currentTime + deltaSeconds)
    );
    audio.currentTime = nextPos;
    setCurrentTime(nextPos);
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
      setCurrentTime(0);
    }
    setStatus(hasCachedAudio ? 'ready' : 'idle');
  };

  const showPlayerBar =
    status === 'playing' || status === 'paused' || (hasCachedAudio && status === 'ready');

  return (
    <div className="inline-flex flex-col items-stretch sm:items-end gap-1.5 max-w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Primary Create / Replay Saved button */}
        {(status === 'idle' || status === 'ready') && (
          <button
            type="button"
            onClick={() => void generateOrLoadAndPlay(false, false)}
            disabled={disabled}
            title={
              disabled
                ? 'سجّل الدخول لتفعيل الاستماع الصوتي'
                : hasCachedAudio
                ? 'تكرار الاستماع من النسخة المحفوظة في قاعدة البيانات بدون استهلاك جديد'
                : 'إنشاء وتشغيل القراءة الصوتية وحفظها للتكرار لاحقًا'
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              hasCachedAudio
                ? 'text-white bg-emerald-700 hover:bg-emerald-800'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {hasCachedAudio ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>تكرار الاستماع (محفوظ)</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>إنشاء وتشغيل الصوت</span>
              </>
            )}
          </button>
        )}

        {status === 'loading' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 bg-slate-100 rounded-lg whitespace-nowrap shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>جاري توليد الصوت وحفظه...</span>
          </span>
        )}

        {/* Active Player Controls: Pause/Resume right beside Create/Replay + Seek ±10s + Restart + Stop */}
        {(status === 'playing' || status === 'paused') && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 border border-slate-200 rounded-xl p-1">
            {/* Pause / Resume button (keeps position!) */}
            <button
              type="button"
              onClick={() => void handlePauseOrResume()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                {/* Back 10 seconds */}
                <button
                  type="button"
                  onClick={() => handleSeekOffset(-10)}
                  title="ترجيع 10 ثواني"
                  aria-label="ترجيع 10 ثواني"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>-10ث</span>
                </button>

                {/* Forward 10 seconds */}
                <button
                  type="button"
                  onClick={() => handleSeekOffset(10)}
                  title="تقديم 10 ثواني"
                  aria-label="تقديم 10 ثواني"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  <span>+10ث</span>
                  <RotateCw className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                </button>

                {/* Replay from start using saved DB audio */}
                <button
                  type="button"
                  onClick={() => void generateOrLoadAndPlay(false, true)}
                  title="إعادة الاستماع من البداية بدون سحب من الـ API"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3" aria-hidden="true" />
                  <span>من البداية</span>
                </button>
              </>
            )}

            {/* Full Stop (resets to 0 but keeps cached clip) */}
            <button
              type="button"
              onClick={handleStopAndReset}
              title="إنهاء التشغيل"
              aria-label="إنهاء التشغيل"
              className="inline-flex items-center gap-1 px-2 py-1.5 min-h-[34px] text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" aria-hidden="true" />
              <span className="hidden sm:inline">إنهاء</span>
            </button>
          </div>
        )}

        {/* Regenerate from API only when explicitly clicked */}
        {hasCachedAudio && status !== 'loading' && (
          <button
            type="button"
            onClick={() => void generateOrLoadAndPlay(true, true)}
            disabled={disabled}
            title="إعادة توليد الصوت من النص المحدث (يستدعي الـ API)"
            aria-label="تحديث الصوت من النص"
            className="inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        )}
      </div>

      {/* Progress Scrubber + Saved Indicator */}
      {showPlayerBar && !usingSpeechFallback && (status === 'playing' || status === 'paused') && (
        <div className="w-full sm:w-64 flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
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
            }}
            aria-label="شريط موضع الصوت"
            className="w-full accent-[#1E3A5F] cursor-pointer h-1.5"
          />
          <span className="tabular-nums font-mono-num shrink-0">
            {formatAudioTime(duration)}
          </span>
        </div>
      )}

      {hasCachedAudio && status === 'ready' && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
          <Database className="w-2.5 h-2.5" aria-hidden="true" />
          <span>
            {cacheSource === 'cloud'
              ? 'الصوت محفوظ في حسابك — جاهز للتكرار الفوري'
              : 'الصوت محفوظ — جاهز للتكرار بدون استهلاك API'}
          </span>
        </span>
      )}

      {errorMsg && <span className="text-[11px] text-red-700">{errorMsg}</span>}
    </div>
  );
}
