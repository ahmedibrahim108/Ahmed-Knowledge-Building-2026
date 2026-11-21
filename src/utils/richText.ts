import {
  HighlightColorKey,
  NoteBorderMode,
  NoteMarginMode,
  NoteWidthMode,
  UserPreferences,
} from '../data/curriculumData';
import {
  TextDir,
  applyBidiToHtml,
  detectTextDirection,
  parsePlainTextToBidiBlocks,
} from './bidi';

export function getNoteLayoutClasses(
  prefs?: Partial<
    Pick<
      UserPreferences,
      'noteMargin' | 'noteWidth' | 'noteBorder' | 'notePaperTone'
    >
  >
) {
  const margin: NoteMarginMode = prefs?.noteMargin ?? 'normal';
  const width: NoteWidthMode = prefs?.noteWidth ?? 'full';
  const border: NoteBorderMode = prefs?.noteBorder ?? 'subtle';
  const paperTone = prefs?.notePaperTone ?? 'clean';

  const canvasPaddingClass: Record<NoteMarginMode, string> = {
    compact: 'p-2.5 sm:p-3',
    normal: 'p-3.5 sm:p-5',
    wide: 'p-5 sm:p-7',
    spacious: 'p-6 sm:p-10',
  };

  const widthClass: Record<NoteWidthMode, string> = {
    focused: 'max-w-2xl mx-auto w-full',
    balanced: 'max-w-4xl mx-auto w-full',
    full: 'w-full',
  };

  const borderClass: Record<NoteBorderMode, string> = {
    none: 'border border-transparent shadow-none',
    subtle: 'border border-slate-200',
    medium: 'border-2 border-slate-300 shadow-xs',
    framed: 'border-2 border-[#1E3A5F]/45 shadow-sm ring-2 ring-[#1E3A5F]/10',
  };

  const paperToneClass: Record<UserPreferences['notePaperTone'], string> = {
    clean: 'bg-white',
    warm: 'bg-[#FFFDF7]',
    slate: 'bg-slate-50/90',
  };

  return {
    margin,
    width,
    border,
    paperTone,
    canvasPaddingClass: canvasPaddingClass[margin],
    widthClass: widthClass[width],
    borderClass: borderClass[border],
    paperToneClass: paperToneClass[paperTone],
  };
}

export const HIGHLIGHT_SWATCHES: Record<
  HighlightColorKey,
  { label: string; bgHex: string; swatchClass: string }
> = {
  amber: {
    label: 'أصفر عنبري',
    bgHex: '#FEF08A',
    swatchClass: 'bg-[#FEF08A] border-amber-300',
  },
  emerald: {
    label: 'أخضر زمردي',
    bgHex: '#A7F3D0',
    swatchClass: 'bg-[#A7F3D0] border-emerald-300',
  },
  sky: {
    label: 'أزرق سماوي',
    bgHex: '#BAE6FD',
    swatchClass: 'bg-[#BAE6FD] border-sky-300',
  },
  rose: {
    label: 'وردي هادئ',
    bgHex: '#FECDD3',
    swatchClass: 'bg-[#FECDD3] border-rose-300',
  },
};

const ALLOWED_TAGS = new Set([
  'P',
  'DIV',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'MARK',
  'SPAN',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
]);

const ALLOWED_BG_COLORS = new Set([
  '#fef08a',
  'rgb(254, 240, 138)',
  '#a7f3d0',
  'rgb(167, 243, 208)',
  '#bae6fd',
  'rgb(186, 230, 253)',
  '#fecdd3',
  'rgb(254, 205, 211)',
]);

const BLOCK_DIR_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'LI',
  'BLOCKQUOTE',
  'TH',
  'TD',
  'TABLE',
]);

const STRONG_CHAR_RE =
  /[A-Za-z\u00C0-\u024F\u0370-\u052F\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u1E00-\u1EFF]/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?(p|div|br|b|strong|i|em|u|ul|ol|li|blockquote|h1|h2|h3|h4|mark|span|table|thead|tbody|tfoot|tr|th|td)\b/i.test(
    value
  );
}

/**
 * Converts legacy plain-text notes (with newlines, bullet prefixes, numbered lists,
 * headings, or quotes) into clean bidirectional HTML with automatic per-block direction.
 */
export function ensureRichHtml(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (looksLikeHtml(trimmed)) {
    return sanitizeRichHtml(trimmed);
  }

  const blocks = parsePlainTextToBidiBlocks(trimmed);
  return blocks
    .map((block) => {
      if (block.type === 'ul' && block.items) {
        const itemsHtml = block.items
          .map((item) => `<li dir="${item.dir}">${escapeHtml(item.text)}</li>`)
          .join('');
        return `<ul dir="${block.dir}">${itemsHtml}</ul>`;
      }
      if (block.type === 'ol' && block.items) {
        const itemsHtml = block.items
          .map((item) => `<li dir="${item.dir}">${escapeHtml(item.text)}</li>`)
          .join('');
        const mixedAttr = block.mixed ? ' data-mixed="true"' : '';
        const startAttr =
          block.startNumber && block.startNumber > 1
            ? ` start="${block.startNumber}"`
            : '';
        return `<ol dir="${block.dir}"${mixedAttr}${startAttr}>${itemsHtml}</ol>`;
      }
      if (block.type === 'heading') {
        const tag = `h${block.headingLevel ?? 3}`;
        return `<${tag} dir="${block.dir}">${escapeHtml(block.text ?? '')}</${tag}>`;
      }
      if (block.type === 'quote') {
        return `<blockquote dir="${block.dir}">${escapeHtml(block.text ?? '')}</blockquote>`;
      }
      return `<p dir="${block.dir}">${escapeHtml(block.text ?? '')}</p>`;
    })
    .join('');
}

function hasDirectBlockChild(el: HTMLElement): boolean {
  return Array.from(el.children).some((c) => {
    const t = c.tagName.toUpperCase();
    return (
      t === 'P' ||
      t === 'DIV' ||
      t === 'H1' ||
      t === 'H2' ||
      t === 'H3' ||
      t === 'H4' ||
      t === 'UL' ||
      t === 'OL' ||
      t === 'BLOCKQUOTE' ||
      t === 'TABLE'
    );
  });
}

function getOwnElementText(el: HTMLElement): string {
  if (el.tagName.toUpperCase() !== 'LI') {
    return (el.textContent || '').trim();
  }
  const parts: string[] = [];
  Array.from(el.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName.toUpperCase();
      if (tag === 'UL' || tag === 'OL') return;
    }
    parts.push(child.textContent || '');
  });
  return parts.join('').trim();
}

function resolveSanitizedBlockDir(
  el: HTMLElement,
  ignoreExternalDir: boolean
): TextDir | '' {
  const isManual = !ignoreExternalDir && el.getAttribute('data-manual-dir') === 'true';
  const rawDir = (el.getAttribute('dir') || '').toLowerCase();
  if (isManual && (rawDir === 'ltr' || rawDir === 'rtl')) {
    return rawDir;
  }

  const text = getOwnElementText(el);
  if (STRONG_CHAR_RE.test(text)) {
    return detectTextDirection(text, 'rtl');
  }

  if (!ignoreExternalDir && (rawDir === 'ltr' || rawDir === 'rtl')) {
    return rawDir;
  }
  return '';
}

function resolveSanitizedAlignAttr(
  el: HTMLElement,
  ignoreExternalDir: boolean
): string {
  const rawData = (el.getAttribute('data-align') || '').toLowerCase();
  if (
    !ignoreExternalDir &&
    (rawData === 'right' || rawData === 'center' || rawData === 'left')
  ) {
    return ` data-align="${rawData}"`;
  }
  const rawStyleAlign = (el.style?.textAlign || '').toLowerCase();
  const rawLegacyAlign = (el.getAttribute('align') || '').toLowerCase();
  const candidate = rawStyleAlign || rawLegacyAlign;
  if (ignoreExternalDir) {
    return candidate === 'center' ? ' data-align="center"' : '';
  }
  if (candidate === 'right' || candidate === 'center' || candidate === 'left') {
    return ` data-align="${candidate}"`;
  }
  return '';
}

function resolveSanitizedIndentAttr(
  el: HTMLElement,
  ignoreExternalDir: boolean
): string {
  if (ignoreExternalDir) return '';
  const indentNum = parseInt(el.getAttribute('data-indent') || '', 10);
  if (!Number.isNaN(indentNum) && indentNum >= 1 && indentNum <= 5) {
    return ` data-indent="${indentNum}"`;
  }
  return '';
}

function runSanitizeHtml(
  dirtyHtml: string,
  options: { ignoreExternalDir?: boolean; unwrapContainerDivs?: boolean } = {}
): string {
  const { ignoreExternalDir = false, unwrapContainerDivs = false } = options;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return dirtyHtml;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${dirtyHtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'META' || tag === 'LINK') {
      return '';
    }

    const childrenHtml = Array.from(el.childNodes).map(walk).join('');

    if (!ALLOWED_TAGS.has(tag)) {
      return childrenHtml;
    }

    if (tag === 'BR') return '<br>';

    if (tag === 'MARK' || tag === 'SPAN') {
      const rawBg = (el.style.backgroundColor || '').trim().toLowerCase();
      const dataColor = el.getAttribute('data-highlight') as HighlightColorKey | null;
      let bgHex = '';
      if (dataColor && HIGHLIGHT_SWATCHES[dataColor]) {
        bgHex = HIGHLIGHT_SWATCHES[dataColor].bgHex;
      } else if (ALLOWED_BG_COLORS.has(rawBg)) {
        bgHex = rawBg;
      }
      const spanDir = (el.getAttribute('dir') || '').toLowerCase();
      const spanDirAttr =
        !ignoreExternalDir && (spanDir === 'ltr' || spanDir === 'rtl')
          ? ` dir="${spanDir}" class="bidi-isolate"`
          : '';

      if (tag === 'MARK') {
        const finalBg = bgHex || HIGHLIGHT_SWATCHES.amber.bgHex;
        return `<mark${spanDirAttr} style="background-color: ${finalBg};">${childrenHtml}</mark>`;
      }
      if (bgHex) {
        return `<mark${spanDirAttr} style="background-color: ${bgHex};">${childrenHtml}</mark>`;
      }
      if (spanDirAttr) {
        return `<span${spanDirAttr}>${childrenHtml}</span>`;
      }
      return childrenHtml;
    }

    if (tag === 'TH' || tag === 'TD') {
      const attrs: string[] = [];
      const colspan = parseInt(el.getAttribute('colspan') || '', 10);
      const rowspan = parseInt(el.getAttribute('rowspan') || '', 10);
      if (!Number.isNaN(colspan) && colspan > 1 && colspan <= 20) {
        attrs.push(`colspan="${colspan}"`);
      }
      if (!Number.isNaN(rowspan) && rowspan > 1 && rowspan <= 20) {
        attrs.push(`rowspan="${rowspan}"`);
      }
      const cellDir = resolveSanitizedBlockDir(el, ignoreExternalDir);
      if (cellDir) {
        attrs.push(`dir="${cellDir}"`);
      }
      if (!ignoreExternalDir && el.getAttribute('data-manual-dir') === 'true') {
        attrs.push('data-manual-dir="true"');
      }
      const cellAlign = resolveSanitizedAlignAttr(el, ignoreExternalDir).trim();
      if (cellAlign) {
        attrs.push(cellAlign);
      }
      const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
      const lowerCell = tag.toLowerCase();
      return `<${lowerCell}${attrStr}>${childrenHtml || '<br>'}</${lowerCell}>`;
    }

    const lower = tag.toLowerCase();
    if (lower === 'b') return `<strong>${childrenHtml}</strong>`;
    if (lower === 'i') return `<em>${childrenHtml}</em>`;

    if (tag === 'DIV' && unwrapContainerDivs) {
      if (hasDirectBlockChild(el)) {
        return childrenHtml;
      }
      const pDir = resolveSanitizedBlockDir(el, ignoreExternalDir);
      const pAlign = resolveSanitizedAlignAttr(el, ignoreExternalDir);
      return `<p${pDir ? ` dir="${pDir}"` : ''}${pAlign}>${childrenHtml}</p>`;
    }

    if (tag === 'UL' || tag === 'OL') {
      const liChildren = Array.from(el.children).filter(
        (c) => c.tagName.toUpperCase() === 'LI'
      ) as HTMLElement[];
      const liDirs = liChildren
        .map((li) => resolveSanitizedBlockDir(li, ignoreExternalDir))
        .filter((d): d is TextDir => d === 'rtl' || d === 'ltr');

      let listDirAttr = '';
      let mixedAttr = '';
      if (liDirs.length > 0) {
        const allRtl = liDirs.every((d) => d === 'rtl');
        const allLtr = liDirs.every((d) => d === 'ltr');
        if (allRtl) {
          listDirAttr = ' dir="rtl"';
        } else if (allLtr) {
          listDirAttr = ' dir="ltr"';
        } else {
          listDirAttr = ` dir="${liDirs[0]}"`;
          mixedAttr = ' data-mixed="true"';
        }
      } else {
        const rawDir = (el.getAttribute('dir') || '').toLowerCase();
        if (!ignoreExternalDir && (rawDir === 'ltr' || rawDir === 'rtl')) {
          listDirAttr = ` dir="${rawDir}"`;
        }
      }

      const startVal =
        tag === 'OL' ? parseInt(el.getAttribute('start') || '', 10) : NaN;
      const startAttr =
        !Number.isNaN(startVal) && startVal > 1 ? ` start="${startVal}"` : '';
      const listIndentAttr = resolveSanitizedIndentAttr(el, ignoreExternalDir);

      return `<${lower}${listDirAttr}${mixedAttr}${startAttr}${listIndentAttr}>${childrenHtml}</${lower}>`;
    }

    if (BLOCK_DIR_TAGS.has(tag)) {
      if (tag === 'DIV' && hasDirectBlockChild(el)) {
        return `<${lower}>${childrenHtml}</${lower}>`;
      }
      const resolvedDir = resolveSanitizedBlockDir(el, ignoreExternalDir);
      const dirAttr = resolvedDir ? ` dir="${resolvedDir}"` : '';
      const manualAttr =
        !ignoreExternalDir && el.getAttribute('data-manual-dir') === 'true'
          ? ' data-manual-dir="true"'
          : '';
      const alignAttr = resolveSanitizedAlignAttr(el, ignoreExternalDir);
      const indentAttr = resolveSanitizedIndentAttr(el, ignoreExternalDir);
      return `<${lower}${dirAttr}${manualAttr}${alignAttr}${indentAttr}>${childrenHtml}</${lower}>`;
    }

    return `<${lower}>${childrenHtml}</${lower}>`;
  };

  return walk(root).trim();
}

/**
 * Sanitizes editor HTML so only safe structural, bold, italic, list, quote, table,
 * highlight, and bidirectional attributes remain.
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
  return runSanitizeHtml(dirtyHtml, {
    ignoreExternalDir: false,
    unwrapContainerDivs: false,
  });
}

/**
 * Sanitizes clipboard HTML on paste, stripping external wrapper directions/styles
 * and re-detecting Arabic/English direction per pasted paragraph and list item.
 */
export function sanitizePastedHtml(
  dirtyHtml: string,
  fallbackPlainText = ''
): string {
  const hasMeaningfulMarkup =
    /<(ul|ol|li|table|thead|tbody|tr|th|td|h1|h2|h3|h4|blockquote|strong|b|em|i|u|mark)\b/i.test(
      dirtyHtml
    );

  if (!hasMeaningfulMarkup && fallbackPlainText.trim()) {
    return ensureRichHtml(fallbackPlainText);
  }

  return runSanitizeHtml(dirtyHtml, {
    ignoreExternalDir: true,
    unwrapContainerDivs: true,
  });
}

/**
 * Renders stored notes, quotes, or extracted document HTML/plain-text into safe,
 * display-ready bilingual HTML with:
 * - Automatic per-block RTL/LTR direction detection
 * - Clean RTL/LTR list grouping so bullets/numbers align strictly on the right for Arabic
 *   and strictly on the left for English (even in mixed Arabic+English sections)
 * - Isolated inline opposite-script runs (`<span dir="ltr|rtl" class="bidi-isolate">`)
 *   preserving parentheses, punctuation, and exact original wording verbatim.
 */
export function renderSafeBidiHtml(raw: string): string {
  const rich = ensureRichHtml(raw);
  if (!rich) return '';
  return applyBidiToHtml(rich, {
    inlineIsolation: true,
    splitMixedLists: true,
  });
}

/**
 * Strips HTML into clean readable plain text (used for Excel export, previews, and TTS).
 */
export function richHtmlToPlainText(raw: string): string {
  if (!raw) return '';
  if (!looksLikeHtml(raw)) return raw.trim();

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const lines: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? '';
      if (txt) lines.push(txt);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag === 'BR') {
      lines.push('\n');
      return;
    }
    if (tag === 'TR') {
      const cells = Array.from(el.children)
        .filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
        .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (cells.length > 0) {
        lines.push(`\n${cells.join(' | ')}`);
      }
      return;
    }
    if (tag === 'OL') {
      const startNum = parseInt(el.getAttribute('start') || '1', 10) || 1;
      let idx = startNum;
      Array.from(el.children).forEach((child) => {
        if (child.tagName.toUpperCase() === 'LI') {
          lines.push(`\n${idx++}. `);
          child.childNodes.forEach(walk);
        } else {
          walk(child);
        }
      });
      lines.push('\n');
      return;
    }
    if (tag === 'LI') {
      lines.push('\n• ');
      el.childNodes.forEach(walk);
      return;
    }
    if (
      tag === 'P' ||
      tag === 'DIV' ||
      tag === 'BLOCKQUOTE' ||
      tag === 'H1' ||
      tag === 'H2' ||
      tag === 'H3' ||
      tag === 'H4' ||
      tag === 'TABLE'
    ) {
      if (lines.length > 0) lines.push('\n');
      el.childNodes.forEach(walk);
      lines.push('\n');
      return;
    }
    el.childNodes.forEach(walk);
  };

  root.childNodes.forEach(walk);
  return lines
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converts rich HTML into clean Markdown preserving bold, bullet lists, quotes, tables, and ==highlights==.
 */
export function richHtmlToMarkdown(raw: string): string {
  if (!raw) return '';
  if (!looksLikeHtml(raw)) return raw.trim();
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return richHtmlToPlainText(raw);
  }

  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    const inner = Array.from(el.childNodes).map(walk).join('');

    switch (tag) {
      case 'BR':
        return '\n';
      case 'STRONG':
      case 'B':
        return inner.trim() ? `**${inner.trim()}**` : '';
      case 'EM':
      case 'I':
        return inner.trim() ? `*${inner.trim()}*` : '';
      case 'MARK':
        return inner.trim() ? `==${inner.trim()}==` : '';
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
        return inner.trim() ? `\n### ${inner.trim()}\n\n` : '';
      case 'BLOCKQUOTE':
        return inner.trim() ? `\n> ${inner.trim()}\n\n` : '';
      case 'UL':
        return `\n${inner}\n`;
      case 'OL': {
        let idx = parseInt(el.getAttribute('start') || '1', 10) || 1;
        return (
          '\n' +
          Array.from(el.children)
            .map((child) => `${idx++}. ${walk(child).replace(/^- /, '').trim()}`)
            .join('\n') +
          '\n\n'
        );
      }
      case 'LI':
        return `- ${inner.trim()}\n`;
      case 'TABLE': {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        const mdRows = rows.map((tr) => {
          const cells = Array.from(tr.children)
            .filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
            .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
          return `| ${cells.join(' | ')} |`;
        });
        if (mdRows.length >= 1) {
          const firstCols = Math.max(
            1,
            Array.from(rows[0].children).filter(
              (c) => c.tagName === 'TH' || c.tagName === 'TD'
            ).length
          );
          const sep = `| ${Array(firstCols).fill('---').join(' | ')} |`;
          mdRows.splice(1, 0, sep);
        }
        return `\n${mdRows.join('\n')}\n\n`;
      }
      case 'P':
      case 'DIV':
        return inner.trim() ? `${inner.trim()}\n\n` : '\n';
      default:
        return inner;
    }
  };

  return walk(root).replace(/\n{3,}/g, '\n\n').trim();
}
