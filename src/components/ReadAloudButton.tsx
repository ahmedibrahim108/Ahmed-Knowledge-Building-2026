import { useEffect, useRef, useState } from 'react';
import { Loader2, Square, Volume2 } from 'lucide-react';
import { ReadAloudVoiceName } from '../data/curriculumData';

interface ReadAloudButtonProps {
  text: string;
  voiceName: ReadAloudVoiceName;
  speed: 'normal' | 'calm';
  disabled?: boolean;
  onRequireAuth?: () => void;
}

export default function ReadAloudButton({
  text,
  voiceName,
  speed,
  disabled = false,
  onRequireAuth,
}: ReadAloudButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setStatus('idle');
  };

  const playBrowserSpeechFallback = (cleanText: string): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-EG';
      utterance.rate = speed === 'calm' ? 0.85 : 1.0;
      utterance.onend = () => setStatus('idle');
      utterance.onerror = () => {
        setStatus('idle');
        setErrorMsg('تعذر تشغيل القراءة الصوتية حاليًا.');
      };
      window.speechSynthesis.speak(utterance);
      setStatus('playing');
      return true;
    } catch {
      return false;
    }
  };

  const handlePlay = async () => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }
    const clean = text.trim();
    if (!clean) {
      setErrorMsg('اكتب ملاحظة أولاً للاستماع إليها.');
      return;
    }

    setErrorMsg(null);
    setStatus('loading');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
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
        if (playBrowserSpeechFallback(clean)) {
          return;
        }
        throw new Error(data.error || 'تعذر تشغيل القراءة الصوتية حاليًا.');
      }

      const audio = new Audio(
        `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
      );
      audioRef.current = audio;
      audio.onended = () => {
        setStatus('idle');
        audioRef.current = null;
      };
      audio.onerror = () => {
        if (!playBrowserSpeechFallback(clean)) {
          setErrorMsg('تعذر تشغيل الملف الصوتي.');
          setStatus('idle');
        }
      };
      await audio.play();
      setStatus('playing');
    } catch (err) {
      if (playBrowserSpeechFallback(clean)) {
        return;
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تشغيل الصوت حاليًا.'
      );
      setStatus('idle');
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {status === 'idle' && (
        <button
          type="button"
          onClick={handlePlay}
          disabled={disabled}
          title={
            disabled ? 'سجّل الدخول لتفعيل الاستماع الصوتي' : 'قراءة الملاحظة بالصوت'
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Volume2 className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
          <span>استماع للملاحظة</span>
        </button>
      )}

      {status === 'loading' && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg whitespace-nowrap shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          <span>جاري التجهيز...</span>
        </span>
      )}

      {status === 'playing' && (
        <button
          type="button"
          onClick={handleStop}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Square className="w-3 h-3 fill-current" aria-hidden="true" />
          <span>إيقاف الصوت</span>
        </button>
      )}

      {errorMsg && <span className="text-[11px] text-red-700">{errorMsg}</span>}
    </div>
  );
}
