import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react';
import { VoiceDialectMode } from '../data/curriculumData';
import { auth } from '../firebase';
import {
  AudioEntityMeta,
  deleteAudioClipFromCache,
  saveVoiceRecordingToCache,
} from '../utils/audioCache';

interface VoiceRecorderButtonProps {
  onTranscript: (text: string) => void;
  label?: string;
  disabled?: boolean;
  onRequireAuth?: () => void;
  dialect?: VoiceDialectMode;
  audioMeta?: AudioEntityMeta;
}

type RecorderPhase =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopped_transcribing'
  | 'stopped_done';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  0: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function getSpeechLang(dialect: VoiceDialectMode): string {
  if (dialect === 'egyptian_arabic') return 'ar-EG';
  if (dialect === 'bilingual') return 'ar-EG';
  return 'ar-SA';
}

export default function VoiceRecorderButton({
  onTranscript,
  label = 'إملاء صوتي',
  disabled = false,
  onRequireAuth,
  dialect = 'standard_arabic',
  audioMeta,
}: VoiceRecorderButtonProps) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [livePreview, setLivePreview] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [lastClip, setLastClip] = useState<{
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
    savedCacheId?: string;
  } | null>(null);
  const [savingClip, setSavingClip] = useState(false);
  const [playingPreview, setPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const doneTimerRef = useRef<number | null>(null);
  const speechRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechFinalTextRef = useRef<string>('');
  const speechInterimTextRef = useRef<string>('');
  const speechOnlyModeRef = useRef<boolean>(false);
  const startedAtMsRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

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
      try {
        speechRecRef.current?.stop();
      } catch {
        // ignore
      }
      if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
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

  const startShadowSpeechRecognition = (isPrimary: boolean) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;
    try {
      const rec = new Ctor();
      rec.lang = getSpeechLang(dialect);
      rec.continuous = true;
      rec.interimResults = true;
      speechFinalTextRef.current = '';
      speechInterimTextRef.current = '';

      rec.onresult = (ev) => {
        let finalSeg = '';
        let interimSeg = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          const txt = r[0]?.transcript ?? '';
          if (r.isFinal) {
            finalSeg += `${txt} `;
          } else {
            interimSeg += `${txt} `;
          }
        }
        if (finalSeg) {
          speechFinalTextRef.current = `${speechFinalTextRef.current} ${finalSeg}`.trim();
        }
        speechInterimTextRef.current = interimSeg.trim();
        setLivePreview(
          `${speechFinalTextRef.current} ${speechInterimTextRef.current}`.trim()
        );
      };

      rec.onerror = (ev) => {
        if (!isPrimary) return;
        const code = ev.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setIsPermissionError(true);
          setErrorMsg(
            'تم رفض إذن الميكروفون للتفريغ المباشر. اسمح بالميكروفون ثم أعد المحاولة.'
          );
          setPhase('idle');
        }
      };

      rec.onend = () => {
        if (isPrimary && speechOnlyModeRef.current && phase === 'recording') {
          // Wait for explicit handleStop finalization
        }
      };

      rec.start();
      speechRecRef.current = rec;
      return true;
    } catch {
      return false;
    }
  };

  const stopShadowSpeechRecognition = (): string => {
    try {
      speechRecRef.current?.stop();
    } catch {
      // ignore
    }
    speechRecRef.current = null;
    const combined = `${speechFinalTextRef.current} ${speechInterimTextRef.current}`.trim();
    return combined;
  };

  const finishSuccess = (text: string, sourceLabel?: string) => {
    onTranscript(text);
    setLivePreview('');
    setPhase('stopped_done');
    setStatusNotice(sourceLabel || 'تم التوقف وإدراج النص');
    doneTimerRef.current = window.setTimeout(() => {
      setPhase('idle');
      setStatusNotice(null);
    }, 4000);
  };

  const sanitizeServerError = (status: number, rawText: string): string => {
    const trimmed = (rawText || '').trim();
    if (
      status === 404 ||
      trimmed.includes('NOT_FOUND') ||
      trimmed.includes('page could not be found') ||
      trimmed.startsWith('<!') ||
      trimmed.startsWith('<html')
    ) {
      return 'خدمة التفريغ السحابية غير متوفرة على هذا الرابط حاليًا. تأكد من تشغيل الخادم أو استخدم متصفح Chrome/Edge للتفريغ المباشر.';
    }
    return trimmed || 'تعذر تحويل الصوت إلى نص حاليًا.';
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
    setLivePreview('');
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreview(false);
    }
    setLastClip(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      // Try pure browser SpeechRecognition if MediaDevices missing
      if (startShadowSpeechRecognition(true)) {
        speechOnlyModeRef.current = true;
        setPhase('recording');
        return;
      }
      setErrorMsg('المتصفح الحالي لا يدعم واجهة تسجيل الصوت.');
      return;
    }

    setPhase('requesting');

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
      // permissions.query('microphone') isn't supported everywhere
    }

    // If server route was previously confirmed missing (404) & browser SpeechRecognition is available,
    // use pure SpeechRecognition directly so recording works reliably without 404 errors.
    if (speechOnlyModeRef.current && getSpeechRecognitionCtor()) {
      if (startShadowSpeechRecognition(true)) {
        setPhase('recording');
        return;
      }
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
        stopShadowSpeechRecognition();
        setPhase('idle');
        setErrorMsg('انقطع تسجيل الصوت فجأة. حاول التسجيل مرة أخرى.');
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const backupSpeechText = stopShadowSpeechRecognition();

        const actualType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        chunksRef.current = [];
        const durationSec = startedAtMsRef.current
          ? Math.max(1, Math.round((Date.now() - startedAtMsRef.current) / 1000))
          : seconds;

        if (blob.size < 256) {
          if (backupSpeechText) {
            finishSuccess(backupSpeechText, 'تم التوقف وإدراج النص');
            return;
          }
          setPhase('idle');
          setStatusNotice('تم التوقف');
          setErrorMsg(
            'التسجيل قصير جدًا، تحدّث لمدة ثانية على الأقل قبل الإيقاف.'
          );
          return;
        }

        setLastClip({
          blob,
          mimeType: actualType,
          durationSeconds: durationSec,
        });

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
          const isRouteMissing =
            res.status === 404 ||
            rawText.includes('NOT_FOUND') ||
            rawText.includes('page could not be found');

          if (isRouteMissing) {
            speechOnlyModeRef.current = true;
          }

          let data: { text?: string; error?: string } = {};
          try {
            data = JSON.parse(rawText) as { text?: string; error?: string };
          } catch {
            data = { error: sanitizeServerError(res.status, rawText) };
          }

          if (!res.ok || !data.text) {
            // Automatic fallback to browser Web Speech transcript if captured!
            if (backupSpeechText) {
              finishSuccess(
                backupSpeechText,
                'تم التوقف وإدراج النص (تفريغ المتصفح المباشر)'
              );
              return;
            }
            throw new Error(
              sanitizeServerError(res.status, data.error || rawText)
            );
          }

          finishSuccess(data.text, 'تم التوقف وإدراج النص');
        } catch (err) {
          if (backupSpeechText) {
            finishSuccess(
              backupSpeechText,
              'تم التوقف وإدراج النص (تفريغ المتصفح المباشر)'
            );
            return;
          }
          setPhase('idle');
          setLivePreview('');
          setStatusNotice('تم التوقف');
          setErrorMsg(
            err instanceof Error ? err.message : 'حدث خطأ أثناء التفريغ الصوتي.'
          );
        }
      };

      mediaRecorderRef.current = recorder;
      startedAtMsRef.current = Date.now();
      recorder.start(250);
      // Also run silent browser SpeechRecognition in parallel as resilience backup
      startShadowSpeechRecognition(false);
      setPhase('recording');
    } catch (err) {
      const mapped = mapMicError(err);
      setIsPermissionError(mapped.perm);
      setErrorMsg(mapped.message);
      setPhase('idle');
    }
  };

  const handleStop = () => {
    if (phase !== 'recording') return;

    if (speechOnlyModeRef.current && !mediaRecorderRef.current) {
      const captured = stopShadowSpeechRecognition();
      if (captured) {
        finishSuccess(captured, 'تم التوقف وإدراج النص');
      } else {
        setPhase('idle');
        setStatusNotice('تم التوقف');
        setErrorMsg('لم يتم التقاط كلام واضح. حاول التحدث بوضوح وإعادة المحاولة.');
      }
      return;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const handleTogglePlayLastClip = async () => {
    if (!lastClip) return;
    if (playingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreview(false);
      return;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(lastClip.blob);
    previewUrlRef.current = url;
    const audio = new Audio(url);
    audio.onended = () => setPlayingPreview(false);
    previewAudioRef.current = audio;
    try {
      await audio.play();
      setPlayingPreview(true);
    } catch {
      setPlayingPreview(false);
    }
  };

  const handleSaveLastClipToCloud = async () => {
    if (!lastClip || savingClip) return;
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      onRequireAuth?.();
      return;
    }
    setSavingClip(true);
    setErrorMsg(null);
    try {
      const stamp = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const res = await saveVoiceRecordingToCache(
        uid,
        lastClip.blob,
        lastClip.mimeType,
        lastClip.durationSeconds,
        audioMeta?.title ? `تسجيل: ${audioMeta.title}` : `تسجيل صوتي (${stamp})`,
        audioMeta
      );
      if (res.cloudSaved) {
        setLastClip((prev) =>
          prev ? { ...prev, savedCacheId: res.cacheId } : prev
        );
        setStatusNotice('تم حفظ التسجيل الصوتي في السحابة');
      } else {
        setErrorMsg(res.errorMessage || 'تعذر حفظ التسجيل الصوتي في السحابة.');
      }
    } finally {
      setSavingClip(false);
    }
  };

  const handleDeleteLastClip = async () => {
    if (!lastClip) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPlayingPreview(false);
    }
    if (lastClip.savedCacheId) {
      await deleteAudioClipFromCache(auth?.currentUser?.uid, lastClip.savedCacheId);
    }
    setLastClip(null);
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
              <CheckCircle2
                className="w-3.5 h-3.5 text-emerald-700"
                aria-hidden="true"
              />
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

      {phase === 'recording' && livePreview && (
        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 max-w-sm text-right leading-relaxed">
          {livePreview}
        </p>
      )}

      {phase === 'idle' && statusNotice && !errorMsg && (
        <span className="text-[11px] font-medium text-slate-500">
          الحالة: {statusNotice}
        </span>
      )}

      {lastClip && (phase === 'idle' || phase === 'stopped_done') && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
          <button
            type="button"
            onClick={() => void handleTogglePlayLastClip()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            {playingPreview ? (
              <Pause className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
            ) : (
              <Play className="w-3 h-3 text-[#1E3A5F]" aria-hidden="true" />
            )}
            <span>{playingPreview ? 'إيقاف' : 'تشغيل التسجيل'}</span>
          </button>

          {!lastClip.savedCacheId ? (
            <button
              type="button"
              disabled={savingClip}
              onClick={() => void handleSaveLastClipToCloud()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1E3A5F] text-white hover:bg-[#162C49] disabled:opacity-50 cursor-pointer"
            >
              {savingClip ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <CloudUpload className="w-3 h-3" aria-hidden="true" />
              )}
              <span>{savingClip ? 'جاري الحفظ...' : 'حفظ الصوت في السحابة'}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              <span>محفوظ سحابيًا</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => void handleDeleteLastClip()}
            title="حذف التسجيل"
            aria-label="حذف التسجيل"
            className="inline-flex items-center p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
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
