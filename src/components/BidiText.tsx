import React from 'react';
import {
  TextDir,
  detectTextDirection,
  parsePlainTextToBidiBlocks,
  splitBidiSegments,
} from '../utils/bidi';

interface BidiTextProps {
  text: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  multiline?: boolean;
  fallbackDir?: TextDir;
  [key: string]: unknown;
}

function renderInlineSegments(text: string, baseDir: TextDir): React.ReactNode {
  const segments = splitBidiSegments(text, baseDir);
  if (segments.length === 0) return text;
  if (segments.length === 1 && !segments[0].isOpposite) {
    return segments[0].text;
  }
  return segments.map((seg, idx) =>
    seg.isOpposite ? (
      <span key={idx} dir={seg.dir} className="bidi-isolate">
        {seg.text}
      </span>
    ) : (
      <React.Fragment key={idx}>{seg.text}</React.Fragment>
    )
  );
}

/**
 * Reusable component for rendering Arabic (RTL), English (LTR), and mixed bilingual
 * text, technical terms, parentheses, headings, bullet points, and numbered lists
 * with automatic direction detection and opposite-script isolation.
 */
export default function BidiText({
  text,
  as: Component = 'span',
  className = '',
  multiline = false,
  fallbackDir = 'rtl',
  ...props
}: BidiTextProps) {
  const safeText = text ?? '';

  if (multiline) {
    const blocks = parsePlainTextToBidiBlocks(safeText);
    const ContainerTag = Component === 'span' ? 'div' : Component;
    return React.createElement(
      ContainerTag,
      {
        className: `prose-bidi space-y-1.5 ${className}`.trim(),
        ...props,
      },
      blocks.length === 0
        ? null
        : blocks.map((block, bIdx) => {
            if (block.type === 'ul' && block.items) {
              return (
                <ul key={bIdx} dir={block.dir}>
                  {block.items.map((item, iIdx) => (
                    <li key={iIdx} dir={item.dir}>
                      {renderInlineSegments(item.text, item.dir)}
                    </li>
                  ))}
                </ul>
              );
            }
            if (block.type === 'ol' && block.items) {
              return (
                <ol
                  key={bIdx}
                  dir={block.dir}
                  data-mixed={block.mixed ? 'true' : undefined}
                  start={block.startNumber}
                >
                  {block.items.map((item, iIdx) => (
                    <li key={iIdx} dir={item.dir}>
                      {renderInlineSegments(item.text, item.dir)}
                    </li>
                  ))}
                </ol>
              );
            }
            if (block.type === 'heading') {
              const HeadingTag = (`h${block.headingLevel ?? 3}`) as
                | 'h1'
                | 'h2'
                | 'h3'
                | 'h4';
              return (
                <HeadingTag key={bIdx} dir={block.dir} className="font-bold">
                  {renderInlineSegments(block.text ?? '', block.dir)}
                </HeadingTag>
              );
            }
            if (block.type === 'quote') {
              return (
                <blockquote key={bIdx} dir={block.dir}>
                  {renderInlineSegments(block.text ?? '', block.dir)}
                </blockquote>
              );
            }
            return (
              <p key={bIdx} dir={block.dir}>
                {renderInlineSegments(block.text ?? '', block.dir)}
              </p>
            );
          })
    );
  }

  const detectedDir = detectTextDirection(safeText, fallbackDir);
  const baseBidiClass = Component === 'span' ? 'bidi-isolate' : 'bidi-auto';

  return React.createElement(
    Component,
    {
      dir: detectedDir,
      className: `${baseBidiClass} ${className}`.trim(),
      ...props,
    },
    renderInlineSegments(safeText, detectedDir)
  );
}
