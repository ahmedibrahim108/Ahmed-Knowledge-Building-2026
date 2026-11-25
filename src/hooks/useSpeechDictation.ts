import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceDialectMode } from '../data/curriculumData';

export type SpeechDialectInput = VoiceDialectMode | 'ar-EG' | 'ar-SA' | 'en-US';

export function resolveSpeechLang(dialect?: SpeechDialectInput): string {
  if (!dialect || dialect === 'egyptian_arabic' || dialect === 'bilingual') {
    return 'ar-EG';
  }
  if (dialect === 'standard_arabic') return 'ar-SA';
  return dialect;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechDictationOptions {
  dialect?: SpeechDialectInput;
  onTranscriptSegment: (finalText: string) => void;
}

export function useSpeechDictation({
  dialect = 'egyptian_arabic',
  onTranscriptSegment,
}: UseSpeechDictationOptions) {
  const [isSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionCtor()));
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldKeepActiveRef = useRef(false);
  const pausedRef = useRef(false);
  const onSegmentRef = useRef(onTranscriptSegment);
  onSegmentRef.current = onTranscriptSegment;

  const stop = useCallback(() => {
    shouldKeepActiveRef.current = false;
    pausedRef.current = false;
    setIsPaused(false);
    setIsListening(false);
    setInterimText('');
    if (recRef.current) {
      try {
        recRef.current.onend = null;
        recRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recRef.current = null;
    }
  }, []);

  const start = useCallback(
    (overrideDialect?: SpeechDialectInput) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError('متصفحك لا يدعم الإملاء الصوتي المباشر؛ يُنصح باستخدام Chrome أو Edge.');
        return;
      }

      stop();
      setError(null);
      shouldKeepActiveRef.current = true;
      pausedRef.current = false;
      setIsPaused(false);

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = resolveSpeechLang(overrideDialect || dialect);

      rec.onresult = (event) => {
        if (pausedRef.current) return;
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalChunk += (finalChunk ? ' ' : '') + text.trim();
          } else {
            interimChunk += text;
          }
        }
        setInterimText(interimChunk.trim());
        if (finalChunk.trim()) {
          onSegmentRef.current(finalChunk.trim());
        }
      };

      rec.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('يرجى السماح بصلاحية الميكروفون في المتصفح لبدء الإملاء الصوتي.');
          stop();
        } else if (event.error === 'no-speech') {
          // Benign timeout; allow auto-restart if still listening
        } else if (event.error === 'network') {
          setError('الإملاء الصوتي يتطلب اتصالاً نشطًا بالإنترنت في هذا المتصفح.');
          stop();
        } else if (event.error !== 'aborted') {
          setError('تعذر متابعة الإملاء الصوتي مؤقتًا.');
        }
      };

      rec.onend = () => {
        setInterimText('');
        if (shouldKeepActiveRef.current && !pausedRef.current) {
          try {
            rec.start();
          } catch {
            setIsListening(false);
            shouldKeepActiveRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      try {
        rec.start();
        recRef.current = rec;
        setIsListening(true);
      } catch {
        setError('تعذر تشغيل الميكروفون؛ تأكد من عدم استخدامه في تطبيق آخر.');
        stop();
      }
    },
    [dialect, stop]
  );

  const pauseToggle = useCallback(() => {
    if (!isListening && !pausedRef.current) return;
    if (pausedRef.current) {
      pausedRef.current = false;
      setIsPaused(false);
      start();
    } else {
      pausedRef.current = true;
      setIsPaused(true);
      setInterimText('');
      if (recRef.current) {
        try {
          recRef.current.onend = null;
          recRef.current.stop();
        } catch {
          // ignore
        }
      }
    }
  }, [isListening, start]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      shouldKeepActiveRef.current = false;
      if (recRef.current) {
        try {
          recRef.current.onend = null;
          recRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    isPaused,
    interimText,
    error,
    clearError: () => setError(null),
    start,
    pauseToggle,
    stop,
    toggle,
  };
}
