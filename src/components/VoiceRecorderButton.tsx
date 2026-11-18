import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

interface VoiceRecorderButtonProps {
  onTranscript: (text: string) => void;
  label?: string;
}

export default function VoiceRecorderButton({
  onTranscript,
  label = 'إملاء صوتي',
}: VoiceRecorderButtonProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>(
    'idle'
  );
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (status !== 'recording') {
      setSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('فشل قراءة الملف الصوتي.'));
      reader.readAsDataURL(blob);
    });
  };

  const handleStart = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('المتصفح الحالي لا يدعم تسجيل الصوت.');
      return;
    }

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
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const actualType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        chunksRef.current = [];

        if (blob.size < 256) {
          setStatus('idle');
          setErrorMsg('التسجيل قصير جدًا، حاول التحدث بوضوح.');
          return;
        }

        setStatus('transcribing');
        try {
          const audioBase64 = await blobToBase64(blob);
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: actualType,
            }),
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok || !data.text) {
            throw new Error(data.error || 'تعذر تحويل الصوت إلى نص.');
          }
          onTranscript(data.text);
        } catch (err) {
          setErrorMsg(
            err instanceof Error ? err.message : 'حدث خطأ أثناء التفريغ الصوتي.'
          );
        } finally {
          setStatus('idle');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch {
      setErrorMsg('يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.');
      setStatus('idle');
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {status === 'idle' && (
        <button
          type="button"
          onClick={handleStart}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Mic className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </button>
      )}

      {status === 'recording' && (
        <button
          type="button"
          onClick={handleStop}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full bg-white animate-pulse"
          />
          <Square className="w-3 h-3 fill-current" aria-hidden="true" />
          <span>إيقاف وتحويل</span>
          <span className="font-mono-num tabular-nums">
            {formatDuration(seconds)}
          </span>
        </button>
      )}

      {status === 'transcribing' && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg whitespace-nowrap shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          <span>جاري تحويل الصوت...</span>
        </span>
      )}

      {errorMsg && (
        <span className="text-[11px] text-red-700">{errorMsg}</span>
      )}
    </div>
  );
}
