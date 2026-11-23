import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, Trash2, Volume2 } from 'lucide-react';
import {
  SavedAudioClipSummary,
  deleteAudioClipFromCache,
  loadAudioClipById,
} from '../utils/audioCache';

interface ReflectionAudioPlayerProps {
  uid?: string | null;
  clips: SavedAudioClipSummary[];
  compact?: boolean;
  canEdit?: boolean;
  onClipDeleted?: (clipId: string) => void;
}

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const s = (safe % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ReflectionAudioPlayer({
  uid,
  clips,
  compact = false,
  canEdit = false,
  onClipDeleted,
}: ReflectionAudioPlayerProps) {
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  if (!clips || clips.length === 0) return null;

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingClipId(null);
  };

  const handleTogglePlay = async (clip: SavedAudioClipSummary) => {
    setErrorMsg(null);

    if (playingClipId === clip.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingClipId(null);
      return;
    }

    if (activeClipId === clip.id && audioRef.current) {
      try {
        await audioRef.current.play();
        setPlayingClipId(clip.id);
        return;
      } catch {
        // Re-load below if stream handle became invalid
      }
    }

    stopAudio();
    setLoadingClipId(clip.id);
    setActiveClipId(clip.id);
    try {
      const entry = await loadAudioClipById(uid, clip.id);
      if (!entry) {
        setErrorMsg('تعذر تحميل التسجيل الصوتي.');
        setActiveClipId(null);
        return;
      }
      const url = URL.createObjectURL(entry.blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audio.setAttribute('playsinline', 'true');
      audio.onended = () => {
        setPlayingClipId(null);
      };
      audio.onerror = () => {
        setPlayingClipId(null);
        setErrorMsg('تعذر تشغيل هذا الملف الصوتي على المتصفح الحالي.');
      };
      audioRef.current = audio;
      await audio.play();
      setPlayingClipId(clip.id);
    } catch {
      setErrorMsg('تعذر تشغيل التسجيل الصوتي.');
      setPlayingClipId(null);
    } finally {
      setLoadingClipId(null);
    }
  };

  const handleDelete = async (clip: SavedAudioClipSummary) => {
    if (activeClipId === clip.id) {
      stopAudio();
      setActiveClipId(null);
    }
    await deleteAudioClipFromCache(uid, clip.id);
    onClipDeleted?.(clip.id);
  };

  if (compact) {
    const primary = clips[0];
    const isPlaying = playingClipId === primary.id;
    const isLoading = loadingClipId === primary.id;
    return (
      <div
        className="flex flex-wrap items-center gap-1.5 pt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleTogglePlay(primary);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            isPlaying
              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
              : 'bg-white/90 text-[#1E3A5F] border-slate-200 hover:bg-slate-50'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3 shrink-0" aria-hidden="true" />
          ) : (
            <Play className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          <span>{isPlaying ? 'إيقاف الصوت' : 'استماع للتسجيل'}</span>
          {primary.durationSeconds > 0 && (
            <span className="tabular-nums opacity-80">
              · {formatSec(primary.durationSeconds)}
            </span>
          )}
        </button>
        {clips.length > 1 && (
          <span className="text-[10px] font-medium text-slate-500">
            +{clips.length - 1} مقطع
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-black/5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Volume2 className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
        <span>التسجيلات الصوتية المرفقة ({clips.length})</span>
      </div>
      <div className="space-y-1.5">
        {clips.map((clip, idx) => {
          const isPlaying = playingClipId === clip.id;
          const isLoading = loadingClipId === clip.id;
          return (
            <div
              key={clip.id}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-white/85 border border-slate-200 rounded-xl text-xs"
            >
              <button
                type="button"
                onClick={() => void handleTogglePlay(clip)}
                className="inline-flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer"
              >
                <span
                  className={`w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${
                    isPlaying
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-slate-100 text-[#1E3A5F]'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : isPlaying ? (
                    <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </span>
                <span className="truncate font-medium text-slate-800">
                  {clip.title || `تسجيل صوتي ${idx + 1}`}
                </span>
                {clip.durationSeconds > 0 && (
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                    ({formatSec(clip.durationSeconds)})
                  </span>
                )}
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete(clip)}
                  aria-label="حذف التسجيل الصوتي"
                  title="حذف التسجيل الصوتي"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {errorMsg && (
        <p className="text-[11px] text-red-700">{errorMsg}</p>
      )}
    </div>
  );
}
