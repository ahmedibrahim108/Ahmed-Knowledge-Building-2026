import { TextareaHTMLAttributes, useCallback, useEffect, useRef } from 'react';

interface AutoResizeTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

export default function AutoResizeTextarea({
  minRows = 3,
  value,
  onChange,
  className = '',
  style,
  ...rest
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.max(el.scrollHeight, minRows * 24 + 20);
    el.style.height = `${nextHeight}px`;
  }, [minRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => adjustHeight();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [adjustHeight]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        requestAnimationFrame(adjustHeight);
      }}
      style={style}
      className={`overflow-hidden resize-none ${className}`}
      {...rest}
    />
  );
}
