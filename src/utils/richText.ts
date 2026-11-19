import { HighlightColorKey } from '../data/curriculumData';

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?(p|div|br|b|strong|i|em|u|ul|ol|li|blockquote|h3|h4|mark|span|table|thead|tbody|tfoot|tr|th|td)\b/i.test(
    value
  );
}

/**
 * Converts legacy plain-text notes (with newlines or bullet prefixes) into safe HTML
 * when opening them in the rich text editor.
 */
export function ensureRichHtml(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (looksLikeHtml(trimmed)) {
    return sanitizeRichHtml(trimmed);
  }
  const lines = trimmed.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inList = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      continue;
    }
    if (t.startsWith('- ') || t.startsWith('• ')) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${escapeHtml(t.slice(2))}</li>`);
    } else {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(`<p>${escapeHtml(t)}</p>`);
    }
  }
  if (inList) htmlParts.push('</ul>');
  return htmlParts.join('');
}

/**
 * Sanitizes editor HTML so only safe structural, bold, italic, list, quote, table, and highlight tags remain.
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
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
      if (tag === 'MARK') {
        const finalBg = bgHex || HIGHLIGHT_SWATCHES.amber.bgHex;
        return `<mark style="background-color: ${finalBg};">${childrenHtml}</mark>`;
      }
      if (bgHex) {
        return `<mark style="background-color: ${bgHex};">${childrenHtml}</mark>`;
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
      const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
      const lowerCell = tag.toLowerCase();
      return `<${lowerCell}${attrStr}>${childrenHtml || '<br>'}</${lowerCell}>`;
    }

    const lower = tag.toLowerCase();
    if (lower === 'b') return `<strong>${childrenHtml}</strong>`;
    if (lower === 'i') return `<em>${childrenHtml}</em>`;
    return `<${lower}>${childrenHtml}</${lower}>`;
  };

  return walk(root).trim();
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
    if (tag === 'LI') {
      lines.push('\n• ');
      el.childNodes.forEach(walk);
      return;
    }
    if (
      tag === 'P' ||
      tag === 'DIV' ||
      tag === 'BLOCKQUOTE' ||
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
      case 'H3':
      case 'H4':
        return inner.trim() ? `\n### ${inner.trim()}\n\n` : '';
      case 'BLOCKQUOTE':
        return inner.trim() ? `\n> ${inner.trim()}\n\n` : '';
      case 'UL':
        return `\n${inner}\n`;
      case 'OL': {
        let idx = 1;
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
