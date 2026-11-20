import React from 'react';

interface BidiTextProps {
  text: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  [key: string]: unknown;
}

/**
 * Reusable component for rendering mixed Arabic (RTL) and English (LTR) text,
 * technical terms, numbers, and symbols without punctuation/bracket misalignment.
 */
export default function BidiText({
  text,
  as: Component = 'span',
  className = '',
  ...props
}: BidiTextProps) {
  const safeText = text ?? '';
  return React.createElement(
    Component,
    {
      dir: 'auto',
      className: `bidi-auto ${className}`.trim(),
      ...props,
    },
    safeText
  );
}
