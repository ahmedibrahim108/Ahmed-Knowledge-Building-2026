export type TextDir = 'rtl' | 'ltr';

export interface BidiSegment {
  text: string;
  dir: TextDir;
  isOpposite: boolean;
}

const RTL_STRONG_RE =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200F]/;

const LTR_STRONG_RE =
  /[A-Za-z\u00C0-\u024F\u0370-\u052F\u1E00-\u1EFF\u200E]/;

const ARABIC_DIACRITIC_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;

const DIGIT_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]/;

const LEADING_MARKERS_RE =
  /^[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]*(?:(?:[-•*–—▪◦‣]+|#{1,6}|>+|[0-9\u0660-\u0669]{1,4}[.)\-:])[\s]+)*/;

/**
 * Automatically detects the primary direction ('rtl' | 'ltr') of a text block
 * from its first strong directional character (ignoring leading bullets/numbering/punctuation).
 */
export function detectTextDirection(
  text: string,
  fallback: TextDir = 'rtl'
): TextDir {
  if (!text) return fallback;
  const cleaned = text.replace(LEADING_MARKERS_RE, '');

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (RTL_STRONG_RE.test(ch)) return 'rtl';
    if (LTR_STRONG_RE.test(ch)) return 'ltr';
  }

  // Fallback scan on full string if leading marker strip swallowed something unexpected
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (RTL_STRONG_RE.test(ch)) return 'rtl';
    if (LTR_STRONG_RE.test(ch)) return 'ltr';
  }

  return fallback;
}

function findMatchingCloser(
  text: string,
  openIndex: number,
  openChar: string,
  closeChar: string
): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') return -1;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function containsRtlStrong(slice: string): boolean {
  return RTL_STRONG_RE.test(slice);
}

function containsLtrStrong(slice: string): boolean {
  return LTR_STRONG_RE.test(slice);
}

/**
 * Checks whether scanning forward from `start` can reach an LTR strong character
 * without crossing an RTL strong character or a line break.
 */
function hasUpcomingLtrBeforeRtl(text: string, start: number): boolean {
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') return false;
    if (RTL_STRONG_RE.test(ch)) return false;
    if (LTR_STRONG_RE.test(ch)) return true;
  }
  return false;
}

/**
 * Checks whether scanning forward from `start` can reach an RTL strong character
 * without crossing an LTR strong character or a line break.
 */
function hasUpcomingRtlBeforeLtr(text: string, start: number): boolean {
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') return false;
    if (LTR_STRONG_RE.test(ch)) return false;
    if (RTL_STRONG_RE.test(ch)) return true;
  }
  return false;
}

const LTR_TECH_JOINER_RE = /[+\-#./_&:=><@'%~]/;
const LTR_TRAILING_SAFE_RE = /[+#%]/;

/**
 * Consumes a contiguous embedded LTR phrase starting at `start` inside an RTL block.
 * Preserves exact characters while keeping Latin words, numbers, math/code operators (C++, ROI = 25%),
 * and pure-LTR parenthesized expressions like (Marketing Strategy) atomic.
 */
function consumeLtrRun(text: string, start: number): number {
  let i = start;
  let lastValidEnd = start;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r' || RTL_STRONG_RE.test(ch)) {
      break;
    }

    if (LTR_STRONG_RE.test(ch)) {
      i++;
      lastValidEnd = i;
      continue;
    }

    if (DIGIT_RE.test(ch)) {
      i++;
      lastValidEnd = i;
      continue;
    }

    if (LTR_TRAILING_SAFE_RE.test(ch)) {
      i++;
      lastValidEnd = i;
      continue;
    }

    if (ch === '(' || ch === '[') {
      const closeChar = ch === '(' ? ')' : ']';
      const closer = findMatchingCloser(text, i, ch, closeChar);
      if (closer !== -1) {
        const inner = text.slice(i + 1, closer);
        if (!containsRtlStrong(inner) && (containsLtrStrong(inner) || DIGIT_RE.test(inner))) {
          i = closer + 1;
          lastValidEnd = i;
          continue;
        }
      }
      break;
    }

    // Internal spaces, commas, or technical operators kept ONLY if followed by more LTR/digits/safe-group
    if (ch === ' ' || ch === '\t' || ch === ',' || LTR_TECH_JOINER_RE.test(ch)) {
      // Look ahead across harmless spaces/joiners/digits/parens to see if another LTR/digit continues the phrase
      let j = i + 1;
      let foundContinuation = false;
      while (j < text.length) {
        const next = text[j];
        if (next === '\n' || next === '\r' || RTL_STRONG_RE.test(next)) break;
        if (LTR_STRONG_RE.test(next)) {
          foundContinuation = true;
          break;
        }
        if (DIGIT_RE.test(next) && ch !== ' ' && ch !== ',') {
          // e.g. "Web 2.0" or "Analytics 4" or "ROI = 25%"
          foundContinuation = true;
          break;
        }
        if (ch === ' ' && DIGIT_RE.test(next)) {
          // Include space + trailing number like "Analytics 4" or "ROI = 25%" ONLY if preceded by LTR/operator
          // Wait: avoid swallowing Arabic year like "React في 2025" (already blocked by RTL 'ف')
          // Also avoid swallowing trailing standalone year at end before Arabic unless followed by % or LTR
          let k = j;
          while (k < text.length && (DIGIT_RE.test(text[k]) || text[k] === '.' || text[k] === '%')) {
            k++;
          }
          const numSlice = text.slice(j, k);
          if (numSlice.includes('%') || hasUpcomingLtrBeforeRtl(text, k)) {
            foundContinuation = true;
            break;
          }
          // Version/part number like "Analytics 4" at end of phrase before Arabic conjunction/end
          if (numSlice.length <= 3 && !text.slice(k).trimStart().startsWith('م')) {
            foundContinuation = true;
            break;
          }
          break;
        }
        if (next === '(' || next === '[') {
          const closer = findMatchingCloser(text, j, next, next === '(' ? ')' : ']');
          if (closer !== -1) {
            const inner = text.slice(j + 1, closer);
            if (!containsRtlStrong(inner) && (containsLtrStrong(inner) || DIGIT_RE.test(inner))) {
              foundContinuation = true;
              break;
            }
          }
          break;
        }
        if (next === ' ' || next === '\t' || LTR_TECH_JOINER_RE.test(next)) {
          j++;
          continue;
        }
        break;
      }
      if (foundContinuation) {
        i++;
        continue;
      }
      break;
    }

    break;
  }

  return lastValidEnd;
}

/**
 * Consumes a contiguous embedded RTL phrase starting at `start` inside an LTR block.
 */
function consumeRtlRun(text: string, start: number): number {
  let i = start;
  let lastValidEnd = start;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r' || LTR_STRONG_RE.test(ch)) {
      break;
    }

    if (RTL_STRONG_RE.test(ch) || ARABIC_DIACRITIC_RE.test(ch)) {
      i++;
      lastValidEnd = i;
      continue;
    }

    if (ch === '(' || ch === '[') {
      const closeChar = ch === '(' ? ')' : ']';
      const closer = findMatchingCloser(text, i, ch, closeChar);
      if (closer !== -1) {
        const inner = text.slice(i + 1, closer);
        if (!containsLtrStrong(inner) && containsRtlStrong(inner)) {
          i = closer + 1;
          lastValidEnd = i;
          continue;
        }
      }
      break;
    }

    if (
      ch === ' ' ||
      ch === '\t' ||
      ch === '-' ||
      ch === '،' ||
      ch === '؛' ||
      ch === '/' ||
      DIGIT_RE.test(ch)
    ) {
      if (hasUpcomingRtlBeforeLtr(text, i + 1)) {
        i++;
        continue;
      }
      break;
    }

    break;
  }

  return lastValidEnd;
}

/**
 * Splits a single paragraph/line into ordered lossless segments where embedded
 * opposite-script phrases (including pure-script parenthesized terms like "(Marketing Strategy)")
 * are flagged with `isOpposite: true` so they can be wrapped with `unicode-bidi: isolate`.
 */
export function splitBidiSegments(
  text: string,
  baseDir?: TextDir
): BidiSegment[] {
  if (!text) return [];
  const resolvedBase = baseDir ?? detectTextDirection(text);
  const segments: BidiSegment[] = [];

  const pushSegment = (slice: string, dir: TextDir, isOpposite: boolean) => {
    if (!slice) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.dir === dir && prev.isOpposite === isOpposite) {
      prev.text += slice;
    } else {
      segments.push({ text: slice, dir, isOpposite });
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (resolvedBase === 'rtl') {
      let runEnd = i;

      // Start an LTR island on an opening paren/bracket ONLY if it encloses pure LTR content
      if (ch === '(' || ch === '[') {
        const closer = findMatchingCloser(text, i, ch, ch === '(' ? ')' : ']');
        if (closer !== -1) {
          const inner = text.slice(i + 1, closer);
          if (!containsRtlStrong(inner) && containsLtrStrong(inner)) {
            runEnd = consumeLtrRun(text, i);
          }
        }
      } else if (LTR_STRONG_RE.test(ch)) {
        runEnd = consumeLtrRun(text, i);
      }

      if (runEnd > i) {
        pushSegment(text.slice(i, runEnd), 'ltr', true);
        i = runEnd;
        continue;
      }

      pushSegment(ch, 'rtl', false);
      i++;
    } else {
      let runEnd = i;

      if (ch === '(' || ch === '[') {
        const closer = findMatchingCloser(text, i, ch, ch === '(' ? ')' : ']');
        if (closer !== -1) {
          const inner = text.slice(i + 1, closer);
          if (!containsLtrStrong(inner) && containsRtlStrong(inner)) {
            runEnd = consumeRtlRun(text, i);
          }
        }
      } else if (RTL_STRONG_RE.test(ch)) {
        runEnd = consumeRtlRun(text, i);
      }

      if (runEnd > i) {
        pushSegment(text.slice(i, runEnd), 'rtl', true);
        i = runEnd;
        continue;
      }

      pushSegment(ch, 'ltr', false);
      i++;
    }
  }

  return segments;
}

export interface PlainTextLineBlock {
  type: 'heading' | 'paragraph' | 'quote' | 'ul-item' | 'ol-item';
  text: string;
  dir: TextDir;
  headingLevel?: 1 | 2 | 3 | 4;
  orderNumber?: number;
}

export interface PlainTextGroupedBlock {
  type: 'heading' | 'paragraph' | 'quote' | 'ul' | 'ol';
  dir: TextDir;
  mixed?: boolean;
  startNumber?: number;
  headingLevel?: 1 | 2 | 3 | 4;
  text?: string;
  items?: Array<{ text: string; dir: TextDir }>;
}

const BULLET_LINE_RE = /^[-•*▪◦‣]\s+(.*)$/;
const ORDERED_LINE_RE = /^([0-9\u0660-\u0669]{1,3})[.)]\s+(.*)$/;
const HEADING_LINE_RE = /^(#{1,4})\s+(.*)$/;
const QUOTE_LINE_RE = /^>\s+(.*)$/;

/**
 * Parses raw plain text (supporting paragraphs, headings, quotes, `- ` / `• ` / `* ` bullets,
 * and `1. ` / `2) ` numbered lists) into grouped bilingual blocks with automatic per-block
 * and per-list-item direction detection.
 */
export function parsePlainTextToBidiBlocks(
  raw: string
): PlainTextGroupedBlock[] {
  const normalized = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const parsedLines: Array<PlainTextLineBlock | null> = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const bulletMatch = trimmed.match(BULLET_LINE_RE);
    if (bulletMatch) {
      const content = bulletMatch[1];
      return {
        type: 'ul-item',
        text: content,
        dir: detectTextDirection(content),
      };
    }

    const orderedMatch = trimmed.match(ORDERED_LINE_RE);
    if (orderedMatch) {
      const numStr = orderedMatch[1].replace(/[\u0660-\u0669]/g, (d) =>
        String(d.charCodeAt(0) - 0x0660)
      );
      const content = orderedMatch[2];
      return {
        type: 'ol-item',
        text: content,
        dir: detectTextDirection(content),
        orderNumber: parseInt(numStr, 10) || 1,
      };
    }

    const headingMatch = trimmed.match(HEADING_LINE_RE);
    if (headingMatch) {
      const level = Math.min(4, Math.max(1, headingMatch[1].length)) as
        | 1
        | 2
        | 3
        | 4;
      const content = headingMatch[2];
      return {
        type: 'heading',
        text: content,
        dir: detectTextDirection(content),
        headingLevel: level,
      };
    }

    const quoteMatch = trimmed.match(QUOTE_LINE_RE);
    if (quoteMatch) {
      const content = quoteMatch[1];
      return {
        type: 'quote',
        text: content,
        dir: detectTextDirection(content),
      };
    }

    return {
      type: 'paragraph',
      text: trimmed,
      dir: detectTextDirection(trimmed),
    };
  });

  const blocks: PlainTextGroupedBlock[] = [];
  let i = 0;

  while (i < parsedLines.length) {
    const item = parsedLines[i];
    if (!item) {
      i++;
      continue;
    }

    if (item.type === 'ul-item') {
      // Group consecutive UL items of the same direction so each direction gets clean native padding
      const groupDir = item.dir;
      const items: Array<{ text: string; dir: TextDir }> = [];
      while (
        i < parsedLines.length &&
        parsedLines[i]?.type === 'ul-item' &&
        parsedLines[i]!.dir === groupDir
      ) {
        items.push({ text: parsedLines[i]!.text, dir: parsedLines[i]!.dir });
        i++;
      }
      blocks.push({ type: 'ul', dir: groupDir, items });
      continue;
    }

    if (item.type === 'ol-item') {
      const items: Array<{ text: string; dir: TextDir }> = [];
      const startNumber = item.orderNumber ?? 1;
      while (i < parsedLines.length && parsedLines[i]?.type === 'ol-item') {
        items.push({ text: parsedLines[i]!.text, dir: parsedLines[i]!.dir });
        i++;
      }
      const allRtl = items.every((x) => x.dir === 'rtl');
      const allLtr = items.every((x) => x.dir === 'ltr');
      blocks.push({
        type: 'ol',
        dir: allLtr ? 'ltr' : allRtl ? 'rtl' : items[0].dir,
        mixed: !allRtl && !allLtr,
        startNumber: startNumber !== 1 ? startNumber : undefined,
        items,
      });
      continue;
    }

    if (item.type === 'heading') {
      blocks.push({
        type: 'heading',
        dir: item.dir,
        headingLevel: item.headingLevel,
        text: item.text,
      });
      i++;
      continue;
    }

    if (item.type === 'quote') {
      blocks.push({
        type: 'quote',
        dir: item.dir,
        text: item.text,
      });
      i++;
      continue;
    }

    blocks.push({
      type: 'paragraph',
      dir: item.dir,
      text: item.text,
    });
    i++;
  }

  return blocks;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a plain string into HTML with inline <span dir="ltr|rtl" class="bidi-isolate">
 * for opposite-direction runs while preserving every single character verbatim.
 */
export function renderInlineBidiHtml(text: string, baseDir: TextDir): string {
  const segments = splitBidiSegments(text, baseDir);
  return segments
    .map((seg) => {
      const safe = escapeHtml(seg.text);
      if (seg.isOpposite) {
        return `<span dir="${seg.dir}" class="bidi-isolate">${safe}</span>`;
      }
      return safe;
    })
    .join('');
}

const BLOCK_LEVEL_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
]);

function hasBlockChild(el: HTMLElement): boolean {
  return Array.from(el.children).some((c) =>
    BLOCK_LEVEL_TAGS.has(c.tagName.toUpperCase())
  );
}

/**
 * Collects inline text runs separated by <br> or block children inside a block element,
 * then isolates opposite-script character spans cleanly across inline formatting tags (<strong>, <em>, <mark>).
 */
function isolateInlineSegmentsInElement(
  doc: Document,
  blockEl: HTMLElement,
  blockDir: TextDir
): void {
  interface TextEntry {
    node: Text;
    start: number;
    end: number;
  }

  const processInlineSlice = (nodes: Node[]) => {
    const entries: TextEntry[] = [];
    let offset = 0;

    const collectText = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n as Text;
        const len = t.data.length;
        if (len > 0) {
          entries.push({ node: t, start: offset, end: offset + len });
          offset += len;
        }
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (tag === 'BR' || BLOCK_LEVEL_TAGS.has(tag)) return;
      // Do not re-wrap spans that already carry explicit dir
      if (tag === 'SPAN' && (el.getAttribute('dir') === 'ltr' || el.getAttribute('dir') === 'rtl')) {
        return;
      }
      Array.from(el.childNodes).forEach(collectText);
    };

    nodes.forEach(collectText);
    if (entries.length === 0) return;

    const fullText = entries.map((e) => e.node.data).join('');
    if (!fullText.trim()) return;

    const segments = splitBidiSegments(fullText, blockDir);
    // Compute ranges for opposite-script segments
    const oppositeRanges: Array<{ start: number; end: number; dir: TextDir }> = [];
    let cursor = 0;
    for (const seg of segments) {
      const segStart = cursor;
      const segEnd = cursor + seg.text.length;
      if (seg.isOpposite && segEnd > segStart) {
        oppositeRanges.push({ start: segStart, end: segEnd, dir: seg.dir });
      }
      cursor = segEnd;
    }

    if (oppositeRanges.length === 0) return;

    // Apply from end to start so earlier offsets remain valid
    for (let idx = oppositeRanges.length - 1; idx >= 0; idx--) {
      const { start, end, dir } = oppositeRanges[idx];
      const startEntry = entries.find((e) => start >= e.start && start < e.end);
      const endEntry = entries.find((e) => end > e.start && end <= e.end);
      if (!startEntry || !endEntry) continue;

      try {
        if (startEntry.node === endEntry.node) {
          // Fast path: single Text node
          const localStart = start - startEntry.start;
          const localEnd = end - startEntry.start;
          const targetNode = startEntry.node;
          let midNode: Text = targetNode;
          if (localEnd < midNode.data.length) {
            midNode.splitText(localEnd);
          }
          if (localStart > 0) {
            midNode = midNode.splitText(localStart);
          }
          const span = doc.createElement('span');
          span.setAttribute('dir', dir);
          span.className = 'bidi-isolate';
          midNode.parentNode?.insertBefore(span, midNode);
          span.appendChild(midNode);
          // Keep entry end synced in case an earlier segment also lives in this Text node
          startEntry.end = startEntry.start + localStart;
        } else {
          // Crosses inline formatting tags (e.g., <strong>Digital</strong> Marketing)
          const startLocal = start - startEntry.start;
          const endLocal = end - endEntry.start;

          let firstNodeInRange = startEntry.node;
          if (startLocal > 0) {
            firstNodeInRange = startEntry.node.splitText(startLocal);
            startEntry.end = startEntry.start + startLocal;
          }

          const lastNodeInRange = endEntry.node;
          if (endLocal < lastNodeInRange.data.length) {
            lastNodeInRange.splitText(endLocal);
          }

          const range = doc.createRange();
          range.setStartBefore(firstNodeInRange);
          range.setEndAfter(lastNodeInRange);

          const extracted = range.extractContents();
          const span = doc.createElement('span');
          span.setAttribute('dir', dir);
          span.className = 'bidi-isolate';
          span.appendChild(extracted);
          range.insertNode(span);
        }
      } catch {
        // Never fail rendering if Range extraction hits an unusual DOM boundary
      }
    }
  };

  // Partition direct children into inline line slices split by BR or nested block elements
  let currentSlice: Node[] = [];
  const childrenSnapshot = Array.from(blockEl.childNodes);
  for (const child of childrenSnapshot) {
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      ((child as HTMLElement).tagName.toUpperCase() === 'BR' ||
        BLOCK_LEVEL_TAGS.has((child as HTMLElement).tagName.toUpperCase()))
    ) {
      if (currentSlice.length > 0) {
        processInlineSlice(currentSlice);
        currentSlice = [];
      }
    } else {
      currentSlice.push(child);
    }
  }
  if (currentSlice.length > 0) {
    processInlineSlice(currentSlice);
  }
}

/**
 * Post-processes sanitized HTML in a browser DOMParser to ensure:
 * 1. Every block element (p, h1-h4, blockquote, li, th, td, leaf div) has accurate dir="rtl"|"ltr"
 *    unless locked by data-manual-dir="true".
 * 2. Every <ul>/<ol> sets matching dir="rtl"|"ltr" (splitting mixed <ul> groups into consecutive
 *    rtl/ltr <ul>s when splitMixedLists=true, and tagging mixed <ol> with data-mixed="true").
 * 3. Embedded opposite-script inline phrases inside RTL/LTR blocks are wrapped with
 *    <span dir="ltr|rtl" class="bidi-isolate"> without changing any text characters.
 */
export function applyBidiToHtml(
  html: string,
  options: { inlineIsolation?: boolean; splitMixedLists?: boolean } = {}
): string {
  const { inlineIsolation = true, splitMixedLists = true } = options;
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;

  const getOwnElementText = (el: HTMLElement): string => {
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
  };

  const resolveElDir = (el: HTMLElement, fallback: TextDir = 'rtl'): TextDir => {
    const isManual = el.getAttribute('data-manual-dir') === 'true';
    const existing = (el.getAttribute('dir') || '').toLowerCase();
    if (isManual && (existing === 'rtl' || existing === 'ltr')) {
      return existing;
    }
    const text = getOwnElementText(el);
    if (!text) {
      return existing === 'rtl' || existing === 'ltr' ? existing : fallback;
    }
    // Check if there are strong chars; if not, preserve existing or fallback
    if (!RTL_STRONG_RE.test(text) && !LTR_STRONG_RE.test(text)) {
      return existing === 'rtl' || existing === 'ltr' ? existing : fallback;
    }
    return detectTextDirection(text, fallback);
  };

  // First pass: resolve leaf/text blocks and normalize lists
  const allBlocks = Array.from(
    root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,blockquote,li,th,td,div,table')
  ) as HTMLElement[];

  for (const el of allBlocks) {
    const tag = el.tagName.toUpperCase();
    if (tag === 'DIV' && hasBlockChild(el)) {
      el.removeAttribute('dir');
      continue;
    }
    if (tag === 'TABLE') {
      const tableDir = resolveElDir(el, 'rtl');
      el.setAttribute('dir', tableDir);
      continue;
    }
    const dir = resolveElDir(el, 'rtl');
    el.setAttribute('dir', dir);
  }

  // Handle loose direct text/inline nodes directly under root (legacy fragments without <p>)
  const hasAnyBlock = hasBlockChild(root);
  const rootText = (root.textContent || '').trim();
  if (!hasAnyBlock && rootText.length > 0) {
    const rootDir = detectTextDirection(rootText);
    if (inlineIsolation) {
      isolateInlineSegmentsInElement(doc, root, rootDir);
      const p = doc.createElement('p');
      p.setAttribute('dir', rootDir);
      while (root.firstChild) {
        p.appendChild(root.firstChild);
      }
      root.appendChild(p);
      return root.innerHTML;
    }
  } else if (inlineIsolation) {
    const hasDirectText = Array.from(root.childNodes).some(
      (n) =>
        n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0
    );
    if (hasDirectText) {
      const rootDir = detectTextDirection(root.textContent || '');
      isolateInlineSegmentsInElement(doc, root, rootDir);
    }
  }

  // Second pass: normalize UL and OL direction & split mixed UL groups for crisp marker placement
  const lists = Array.from(root.querySelectorAll('ul,ol')) as HTMLElement[];
  for (const list of lists) {
    const tag = list.tagName.toUpperCase();
    const listItems = Array.from(list.children).filter(
      (c) => c.tagName.toUpperCase() === 'LI'
    ) as HTMLElement[];
    if (listItems.length === 0) continue;

    const dirs = listItems.map((li) => resolveElDir(li, 'rtl'));
    const allRtl = dirs.every((d) => d === 'rtl');
    const allLtr = dirs.every((d) => d === 'ltr');

    if (allRtl) {
      list.setAttribute('dir', 'rtl');
      list.removeAttribute('data-mixed');
    } else if (allLtr) {
      list.setAttribute('dir', 'ltr');
      list.removeAttribute('data-mixed');
    } else if (tag === 'UL' && splitMixedLists && list.parentNode) {
      // Split mixed UL into consecutive same-direction ULs
      const frag = doc.createDocumentFragment();
      const parentIndent = list.getAttribute('data-indent');
      const parentAlign = list.getAttribute('data-align');
      let currentDir: TextDir | null = null;
      let currentUl: HTMLElement | null = null;
      listItems.forEach((li, idx) => {
        const d = dirs[idx];
        li.setAttribute('dir', d);
        if (!currentUl || currentDir !== d) {
          currentUl = doc.createElement('ul');
          currentUl.setAttribute('dir', d);
          if (parentIndent) currentUl.setAttribute('data-indent', parentIndent);
          if (parentAlign) currentUl.setAttribute('data-align', parentAlign);
          frag.appendChild(currentUl);
          currentDir = d;
        }
        currentUl.appendChild(li);
      });
      list.parentNode.replaceChild(frag, list);
    } else {
      // Ordered list or non-split mixed list: keep numbering continuous with data-mixed="true"
      list.setAttribute('dir', dirs[0]);
      list.setAttribute('data-mixed', 'true');
    }
  }

  // Third pass: isolate inline opposite-script phrases inside blocks
  if (inlineIsolation) {
    const leafBlocks = Array.from(
      root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,blockquote,li,th,td,div')
    ) as HTMLElement[];
    for (const el of leafBlocks) {
      if (el.tagName.toUpperCase() === 'DIV' && hasBlockChild(el)) continue;
      // For LI containing nested UL/OL, isolate only its own inline text before/outside nested list
      const dirAttr = (el.getAttribute('dir') || '').toLowerCase();
      const blockDir: TextDir =
        dirAttr === 'ltr' || dirAttr === 'rtl' ? dirAttr : 'rtl';
      isolateInlineSegmentsInElement(doc, el, blockDir);
    }
  }

  return root.innerHTML;
}
