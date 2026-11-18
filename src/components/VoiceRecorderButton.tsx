import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  RefreshCw,
  Square,
} from 'lucide-react';
import { VoiceDialectMode } from '../data/curriculumData';

interface VoiceRecorderButtonProps {
  onTranscript: (text: string) => void;
  label?: string;
  disabled?: boolean;
  onRequireAuth?: () => void;
  dialect?: VoiceDialectMode;
}

type RecorderPhase =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopped_transcribing'
  | 'stopped_done';

export default function VoiceRecorderButton({
  onTranscript,
  label = 'إملاء صوتي',
  disabled = false,
  onRequireAuth,
  dialect = 'standard_arabic',
}: VoiceRecorderButtonProps) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const doneTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'recording') {
      setSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
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

  const mapMicError = (err: unknown): { message: string; perm: boolean } => {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        perm: true,
        message:
          'تم رفض إذن الميكروفون. اسمح بالوصول للميكروفون من أيقونة القفل/الإعدادات أعلى المتصفح ثم اضغط «إعادة المحاولة».',
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
        message:
          'الميكروفون قيد الاستخدام في برنامج آخر حاليًا. أغلقه ثم أعد المحاولة.',
      };
    }
    if (name === 'SecurityError') {
      return {
        perm: true,
        message:
          'يتطلب الوصول للميكروفون اتصالاً آمنًا (HTTPS) أو إذن الإطار الحالي.',
      };
    }
    return {
      perm: true,
      message:
        'تعذر الوصول إلى الميكروفون. تأكد من توصيل الميكروفون والسماح بالإذن في المتصفح.',
    };
  };

  const handleStart = async () => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }

    if (doneTimerRef.current) {
      window.clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }

    setErrorMsg(null);
    setStatusNotice(null);
    setIsPermissionError(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('المتصفح الحالي لا يدعم واجهة تسجيل الصوت.');
      return;
    }

    setPhase('requesting');

    // Proactively check permission state if supported
    try {
      if (navigator.permissions?.query) {
        const permStatus = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        if (permStatus.state === 'denied') {
          setIsPermissionError(true);
          setErrorMsg(
            'إذن الميكروفون محظور في إعدادات المتصفح. افتح أذونات الموقع واسمح بالميكروفون ثم حاول مجددًا.'
          );
          setPhase('idle');
          return;
        }
      }
    } catch {
      // permissions.query('microphone') isn't supported in all browsers; continue to getUserMedia
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

      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPhase('idle');
        setErrorMsg('انقطع تسجيل الصوت فجأة. حاول التسجيل مرة أخرى.');
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const actualType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        chunksRef.current = [];

        if (blob.size < 256) {
          setPhase('idle');
          setStatusNotice('تم التوقف');
          setErrorMsg(
            'التسجيل قصير جدًا، تحدّث لمدة ثانية على الأقل قبل الإيقاف.'
          );
          return;
        }

        setPhase('stopped_transcribing');
        try {
          const audioBase64 = await blobToBase64(blob);
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: actualType,
              dialect,
            }),
          });
          const rawText = await res.text();
          let data: { text?: string; error?: string } = {};
          try {
            data = JSON.parse(rawText) as { text?: string; error?: string };
          } catch {
            data = { error: rawText || 'تعذر الاتصال بخدمة التفريغ الصوتي.' };
          }
          if (!res.ok || !data.text) {
            throw new Error(data.error || 'تعذر تحويل الصوت إلى نص.');
          }
          onTranscript(data.text);
          setPhase('stopped_done');
          setStatusNotice('تم التوقف وإدراج النص');
          doneTimerRef.current = window.setTimeout(() => {
            setPhase('idle');
            setStatusNotice(null);
          }, 4000);
        } catch (err) {
          setPhase('idle');
          setStatusNotice('تم التوقف');
          setErrorMsg(
            err instanceof Error ? err.message : 'حدث خطأ أثناء التفريغ الصوتي.'
          );
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setPhase('recording');
    } catch (err) {
      const mapped = mapMicError(err);
      setIsPermissionError(mapped.perm);
      setErrorMsg(mapped.message);
      setPhase('idle');
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && phase === 'recording') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch {
        // ignore if unsupported
      }
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleStart}
            title={
              disabled
                ? 'سجّل الدخول بحساب Google لتفعيل التسجيل الصوتي'
                : label
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        )}

        {phase === 'requesting' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg whitespace-nowrap shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>جاري طلب إذن الميكروفون...</span>
          </span>
        )}

        {phase === 'recording' && (
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg whitespace-nowrap shrink-0">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-red-600 animate-pulse"
              />
              <span>جاري التسجيل</span>
              <span className="font-mono-num tabular-nums text-red-800">
                {formatDuration(seconds)}
              </span>
            </span>

            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" aria-hidden="true" />
              <span>إيقاف وتحويل</span>
            </button>
          </div>
        )}

        {phase === 'stopped_transcribing' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>تم التوقف · جاري تحويل الصوت إلى نص...</span>
          </span>
        )}

        {phase === 'stopped_done' && (
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>{statusNotice || 'تم التوقف وإدراج النص'}</span>
            </span>
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تسجيل جديد</span>
            </button>
          </div>
        )}
      </div>

      {phase === 'idle' && statusNotice && !errorMsg && (
        <span className="text-[11px] font-medium text-slate-500">
          الحالة: {statusNotice}
        </span>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-end gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 max-w-sm text-right"
        >
          <span className="inline-flex items-start gap-1.5">
            <AlertCircle
              className="w-3.5 h-3.5 text-red-700 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>{errorMsg}</span>
          </span>
          {isPermissionError && (
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-900 bg-white border border-red-200 rounded-md hover:bg-red-100 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>إعادة المحاولة</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
