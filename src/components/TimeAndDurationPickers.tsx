import { Clock, Timer, X } from 'lucide-react';
import { useMemo } from 'react';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const padded = String(h).padStart(2, '0');
  const period = h < 12 ? 'ص' : 'م';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    value: padded,
    label: `${String(h12).padStart(2, '0')} ${period} (${padded})`,
  };
});

const BASE_MINUTES = [
  '00',
  '05',
  '10',
  '15',
  '20',
  '25',
  '30',
  '35',
  '40',
  '45',
  '50',
  '55',
];

const QUICK_TIME_PRESETS = ['08:00', '10:00', '13:00', '16:00', '18:00', '20:00', '22:00'];

export const DURATION_PRESET_MINUTES = [15, 30, 45, 60, 90, 120];

interface TimePickerFieldProps {
  value: string;
  onChange: (nextTime: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
  compact?: boolean;
  presets?: string[];
  ariaLabel?: string;
}

export function TimePickerField({
  value,
  onChange,
  disabled = false,
  allowClear = true,
  compact = false,
  presets = QUICK_TIME_PRESETS,
  ariaLabel = 'اختيار الوقت',
}: TimePickerFieldProps) {
  const parsed = useMemo(() => {
    const match = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
    if (!match) return { hour: '', minute: '' };
    const hh = String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, Number(match[2])))).padStart(2, '0');
    return { hour: hh, minute: mm };
  }, [value]);

  const minuteOptions = useMemo(() => {
    if (parsed.minute && !BASE_MINUTES.includes(parsed.minute)) {
      return [...BASE_MINUTES, parsed.minute].sort();
    }
    return BASE_MINUTES;
  }, [parsed.minute]);

  const handleHourChange = (nextHour: string) => {
    if (!nextHour) {
      onChange('');
      return;
    }
    const mm = parsed.minute || '00';
    onChange(`${nextHour}:${mm}`);
  };

  const handleMinuteChange = (nextMinute: string) => {
    const hh = parsed.hour || '09';
    onChange(`${hh}:${nextMinute || '00'}`);
  };

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-1.5" dir="ltr">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <select
          aria-label={`${ariaLabel} - الساعة`}
          disabled={disabled}
          value={parsed.hour}
          onChange={(e) => handleHourChange(e.target.value)}
          className={`flex-1 min-w-0 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium tabular-nums focus:outline-none focus:border-[#1E3A5F] ${
            compact ? 'px-2 py-1.5 min-h-[34px] text-[11px]' : 'px-2.5 py-2 min-h-[38px] text-xs'
          }`}
        >
          <option value="">الساعة</option>
          {HOUR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-slate-400 font-bold text-xs">:</span>
        <select
          aria-label={`${ariaLabel} - الدقيقة`}
          disabled={disabled}
          value={parsed.minute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className={`w-[72px] shrink-0 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium tabular-nums focus:outline-none focus:border-[#1E3A5F] ${
            compact ? 'px-2 py-1.5 min-h-[34px] text-[11px]' : 'px-2 py-2 min-h-[38px] text-xs'
          }`}
        >
          <option value="">الدقيقة</option>
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="مسح الوقت"
            aria-label="مسح الوقت"
            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {!compact && presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" dir="ltr">
          {presets.map((preset) => {
            const active = value === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DurationPickerFieldProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  compact?: boolean;
  presets?: number[];
  ariaLabel?: string;
}

export function DurationPickerField({
  value,
  onChange,
  disabled = false,
  compact = false,
  presets = DURATION_PRESET_MINUTES,
  ariaLabel = 'مدة المهمة بالدقائق',
}: DurationPickerFieldProps) {
  const safeVal = Number.isFinite(value) && value > 0 ? Math.round(value) : 30;

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((m) => {
          const active = safeVal === m;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onChange(m)}
              className={`rounded-md font-semibold tabular-nums border cursor-pointer transition-colors ${
                compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
              } ${
                active
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {m}د
            </button>
          );
        })}

        <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:border-[#1E3A5F]">
          <Timer className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            type="number"
            aria-label={ariaLabel}
            disabled={disabled}
            min={5}
            max={600}
            step={5}
            value={safeVal}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isFinite(raw)) {
                onChange(Math.min(600, Math.max(5, raw)));
              }
            }}
            className={`w-12 bg-transparent text-slate-900 font-semibold tabular-nums focus:outline-none text-center ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          />
          <span className="text-[10px] text-slate-500">د</span>
        </div>
      </div>
    </div>
  );
}
