import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Columns3,
  Eraser,
  Heading3,
  Highlighter,
  Italic,
  Languages,
  List,
  ListOrdered,
  Lock,
  Plus,
  Quote,
  Redo2,
  Rows3,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { HighlightColorKey, UserPreferences } from '../data/curriculumData';
import { TextDir, detectTextDirection } from '../utils/bidi';
import {
  HIGHLIGHT_SWATCHES,
  ensureRichHtml,
  sanitizePastedHtml,
  sanitizeRichHtml,
} from '../utils/richText';

interface RichTextNoteEditorProps {
  noteKey: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  canEdit: boolean;
  onRequireAuth?: () => void;
  preferences: UserPreferences;
  onSelectDefaultHighlight?: (color: HighlightColorKey) => void;
  minHeightClass?: string;
}

const FONT_SIZE_CLASS: Record<UserPreferences['noteFontSize'], string> = {
  sm: 'text-xs leading-relaxed',
  base: 'text-sm leading-relaxed',
  lg: 'text-base leading-loose',
};

const PAPER_TONE_CLASS: Record<UserPreferences['notePaperTone'], string> = {
  clean: 'bg-white',
  warm: 'bg-[#FFFDF7]',
  slate: 'bg-slate-50/90',
};

const QUICK_TABLE_PRESETS: Array<{ rows: number; cols: number; label: string }> = [
  { rows: 2, cols: 2, label: '2 × 2' },
  { rows: 3, cols: 3, label: '3 × 3' },
  { rows: 4, cols: 3, label: '4 × 3' },
  { rows: 4, cols: 4, label: '4 × 4' },
];

export default function RichTextNoteEditor({
  noteKey,
  value,
  onChange,
  placeholder = 'ابدأ الكتابة هنا، أو استخدم شريط الأدوات لإضافة خط عريض (Bold) أو نقاط (Bullet Points) أو جدول أو تظليل...',
  canEdit,
  onRequireAuth,
  preferences,
  onSelectDefaultHighlight,
  minHeightClass = 'min-h-[220px]',
}: RichTextNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Tracks the exact string emitted by this editor so we NEVER overwrite innerHTML while user types/deletes
  const lastEmittedRef = useRef<string>('');
  const lastNoteKeyRef = useRef<string>('');
  const savedRangeRef = useRef<Range | null>(null);

  const [activeHighlight, setActiveHighlight] = useState<HighlightColorKey>(
    preferences.noteHighlightColor
  );
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [insideTable, setInsideTable] = useState(false);
  const [editorDir, setEditorDir] = useState<'auto' | 'rtl' | 'ltr'>('auto');
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    ul: false,
    ol: false,
  });

  useEffect(() => {
    setActiveHighlight(preferences.noteHighlightColor);
  }, [preferences.noteHighlightColor]);

  const STRONG_CHAR_RE =
    /[A-Za-z\u00C0-\u024F\u0370-\u052F\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u1E00-\u1EFF]/;

  const syncBlocksBidi = (el: HTMLElement, mode: 'auto' | 'rtl' | 'ltr') => {
    const blockSelector = 'p,div,h1,h2,h3,h4,blockquote,li,th,td';
    const blocks = Array.from(el.querySelectorAll(blockSelector)) as HTMLElement[];

    for (const block of blocks) {
      const tag = block.tagName.toUpperCase();
      if (
        tag === 'DIV' &&
        Array.from(block.children).some((c) =>
          /^(P|DIV|H1|H2|H3|H4|UL|OL|BLOCKQUOTE|TABLE)$/i.test(c.tagName)
        )
      ) {
        if (block.hasAttribute('dir')) block.removeAttribute('dir');
        continue;
      }

      if (mode === 'auto' && block.getAttribute('data-manual-dir') === 'true') {
        continue;
      }

      const text = (block.textContent || '').trim();
      let nextDir: TextDir;
      if (mode === 'ltr' || mode === 'rtl') {
        nextDir = mode;
      } else if (STRONG_CHAR_RE.test(text)) {
        nextDir = detectTextDirection(text, 'rtl');
      } else if (tag === 'LI') {
        // Inherit previous list item direction while typing a brand new empty bullet
        const prevLi = block.previousElementSibling as HTMLElement | null;
        const prevDir = (prevLi?.getAttribute('dir') || '').toLowerCase();
        nextDir = prevDir === 'ltr' || prevDir === 'rtl' ? prevDir : 'rtl';
      } else {
        const currentDir = (block.getAttribute('dir') || '').toLowerCase();
        nextDir = currentDir === 'ltr' || currentDir === 'rtl' ? currentDir : 'rtl';
      }

      if (block.getAttribute('dir') !== nextDir) {
        block.setAttribute('dir', nextDir);
      }
    }

    const lists = Array.from(el.querySelectorAll('ul,ol')) as HTMLElement[];
    for (const list of lists) {
      const liChildren = Array.from(list.children).filter(
        (c) => c.tagName.toUpperCase() === 'LI'
      ) as HTMLElement[];
      if (liChildren.length === 0) continue;

      const dirs = liChildren.map((li) =>
        (li.getAttribute('dir') || '').toLowerCase() === 'ltr' ? 'ltr' : 'rtl'
      );
      const allLtr = dirs.every((d) => d === 'ltr');
      const allRtl = dirs.every((d) => d === 'rtl');

      if (allLtr) {
        if (list.getAttribute('dir') !== 'ltr') list.setAttribute('dir', 'ltr');
        if (list.hasAttribute('data-mixed')) list.removeAttribute('data-mixed');
      } else if (allRtl) {
        if (list.getAttribute('dir') !== 'rtl') list.setAttribute('dir', 'rtl');
        if (list.hasAttribute('data-mixed')) list.removeAttribute('data-mixed');
      } else {
        if (list.getAttribute('dir') !== dirs[0]) list.setAttribute('dir', dirs[0]);
        if (list.getAttribute('data-mixed') !== 'true') {
          list.setAttribute('data-mixed', 'true');
        }
      }
    }
  };

  // Safely synchronize DOM ONLY on noteKey change or genuine external change when not actively typing
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const noteChanged = lastNoteKeyRef.current !== noteKey;
    if (noteChanged) {
      const normalized = ensureRichHtml(value);
      el.innerHTML = normalized;
      syncBlocksBidi(el, editorDir);
      lastEmittedRef.current = value;
      lastNoteKeyRef.current = noteKey;
      setInsideTable(false);
      return;
    }

    // If this change originated from our own emitChange, DO NOT touch el.innerHTML!
    // Touching innerHTML during typing/deleting destroys browser Selection and pushes the caret backward.
    if (value === lastEmittedRef.current) {
      return;
    }

    const isFocused =
      typeof document !== 'undefined' && document.activeElement === el;
    const normalized = ensureRichHtml(value);
    const currentSanitized = sanitizeRichHtml(el.innerHTML);

    if (normalized === currentSanitized) {
      lastEmittedRef.current = value;
      return;
    }

    // Only apply external updates (e.g., voice dictation or file import or cancel reset)
    if (!isFocused) {
      el.innerHTML = normalized;
      syncBlocksBidi(el, editorDir);
      lastEmittedRef.current = value;
    } else {
      // External update happened while focused: replace content and place caret cleanly at end
      el.innerHTML = normalized;
      syncBlocksBidi(el, editorDir);
      lastEmittedRef.current = value;
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {
        // ignore selection failure
      }
    }
  }, [noteKey, value]);

  const getActiveTableCell = (): HTMLTableCellElement | null => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== el) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        ((node as HTMLElement).tagName === 'TD' ||
          (node as HTMLElement).tagName === 'TH')
      ) {
        return node as HTMLTableCellElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const syncFormatState = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
      setInsideTable(Boolean(getActiveTableCell()));
    } catch {
      // ignore if unsupported in current selection
    }
  };

  useEffect(() => {
    const handler = () => {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (
        document.activeElement === el ||
        (sel && sel.anchorNode && el.contains(sel.anchorNode))
      ) {
        syncFormatState();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  const emitChange = (normalizeEmptyOnBlur = false) => {
    const el = editorRef.current;
    if (!el) return;
    syncBlocksBidi(el, editorDir);
    let cleaned = sanitizeRichHtml(el.innerHTML);
    const plainCheck = cleaned
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (normalizeEmptyOnBlur && !plainCheck && !/<table\b/i.test(cleaned)) {
      cleaned = '';
      if (el.innerHTML !== '') {
        el.innerHTML = '';
      }
    }
    lastEmittedRef.current = cleaned;
    onChange(cleaned);
    syncFormatState();
  };

  const guardEdit = (): boolean => {
    if (!canEdit) {
      onRequireAuth?.();
      return false;
    }
    return true;
  };

  const saveCurrentRange = () => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const runExec = (command: string, commandVal?: string) => {
    if (!guardEdit()) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, commandVal);
    emitChange();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!guardEdit()) {
      e.preventDefault();
      return;
    }
    const el = editorRef.current;
    if (!el) return;

    const clipboard = e.clipboardData;
    if (!clipboard) return;
    const html = clipboard.getData('text/html');
    const plain = clipboard.getData('text/plain');

    if (!html && !plain) return;
    e.preventDefault();
    el.focus();

    if (html && html.trim()) {
      const cleaned = sanitizePastedHtml(html, plain);
      if (cleaned) {
        // If pasting a single plain paragraph inside an existing block/list item without block tags, unwrap <p>
        const singlePMatch = cleaned.match(/^<p(?:\s+dir="(?:ltr|rtl)")?>([\s\S]*)<\/p>$/i);
        const sel = window.getSelection();
        let insideBlockWithText = false;
        if (sel && sel.anchorNode) {
          let cur: Node | null = sel.anchorNode;
          while (cur && cur !== el) {
            if (
              cur.nodeType === Node.ELEMENT_NODE &&
              /^(LI|P|H1|H2|H3|H4|BLOCKQUOTE|TD|TH)$/i.test(
                (cur as HTMLElement).tagName
              ) &&
              ((cur as HTMLElement).textContent || '').trim().length > 0
            ) {
              insideBlockWithText = true;
              break;
            }
            cur = cur.parentNode;
          }
        }
        const toInsert =
          singlePMatch && insideBlockWithText ? singlePMatch[1] : cleaned;
        const ok = document.execCommand('insertHTML', false, toInsert);
        if (!ok && sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const frag = range.createContextualFragment(toInsert);
          range.insertNode(frag);
          range.collapse(false);
        }
        emitChange(false);
        return;
      }
    }

    if (plain) {
      const hasStructuredLines =
        /\r?\n/.test(plain) ||
        /^[\s]*(?:[-•*▪◦‣]\s+|\d{1,3}[.)]\s+|#{1,4}\s+|>\s+)/m.test(plain);
      if (hasStructuredLines) {
        const richFromPlain = ensureRichHtml(plain);
        if (richFromPlain) {
          const ok = document.execCommand('insertHTML', false, richFromPlain);
          if (!ok) {
            document.execCommand('insertText', false, plain);
          }
          emitChange(false);
          return;
        }
      }
      document.execCommand('insertText', false, plain);
      emitChange(false);
    }
  };

  const applyHighlight = (colorKey: HighlightColorKey) => {
    if (!guardEdit()) return;
    setActiveHighlight(colorKey);
    onSelectDefaultHighlight?.(colorKey);
    setShowHighlightMenu(false);

    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const hex = HIGHLIGHT_SWATCHES[colorKey].bgHex;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      return;
    }

    const mark = document.createElement('mark');
    mark.setAttribute('data-highlight', colorKey);
    mark.style.backgroundColor = hex;
    try {
      const extracted = range.extractContents();
      mark.appendChild(extracted);
      range.insertNode(mark);
      selection.removeAllRanges();
      const afterRange = document.createRange();
      afterRange.selectNodeContents(mark);
      afterRange.collapse(false);
      selection.addRange(afterRange);
    } catch {
      document.execCommand('hiliteColor', false, hex);
    }
    emitChange();
  };

  const removeHighlight = () => {
    if (!guardEdit()) return;
    setShowHighlightMenu(false);
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('removeFormat');
    emitChange();
  };

  const toggleSubheading = () => {
    if (!guardEdit()) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const blockVal = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock', false, blockVal === 'h3' ? 'p' : 'h3');
    emitChange();
  };

  const toggleQuote = () => {
    if (!guardEdit()) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const blockVal = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand(
      'formatBlock',
      false,
      blockVal === 'blockquote' ? 'p' : 'blockquote'
    );
    emitChange();
  };

  const applyBlockDirection = (targetDir: 'ltr' | 'rtl') => {
    if (!guardEdit()) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.anchorNode;
    const blockTags = new Set([
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
    ]);
    let targetBlock: HTMLElement | null = null;
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toUpperCase();
        if (blockTags.has(tag)) {
          targetBlock = node as HTMLElement;
          break;
        }
      }
      node = node.parentNode;
    }
    if (targetBlock && targetBlock !== el) {
      targetBlock.setAttribute('dir', targetDir);
      targetBlock.setAttribute('data-manual-dir', 'true');
      emitChange();
      return;
    }
    // Wrap current line or insert a clean directed paragraph
    const p = document.createElement('p');
    p.setAttribute('dir', targetDir);
    p.setAttribute('data-manual-dir', 'true');
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      try {
        const frag = range.extractContents();
        p.appendChild(frag);
        range.insertNode(p);
        placeCaretInNode(p, false);
        emitChange();
        return;
      } catch {
        // fallback below
      }
    }
    p.innerHTML = '<br>';
    el.appendChild(p);
    placeCaretInNode(p, true);
    emitChange();
  };

  const placeCaretInNode = (node: Node, collapseToStart = true) => {
    try {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(collapseToStart);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // ignore
    }
  };

  const insertTable = (rowsCount: number, colsCount: number) => {
    if (!guardEdit()) return;
    const el = editorRef.current;
    if (!el) return;

    const safeRows = Math.max(1, Math.min(12, Math.round(rowsCount)));
    const safeCols = Math.max(1, Math.min(8, Math.round(colsCount)));
    setShowTableMenu(false);
    el.focus();

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');
    for (let c = 0; c < safeCols; c++) {
      const th = document.createElement('th');
      th.textContent = `العمود ${c + 1}`;
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const bodyRowsCount = Math.max(1, safeRows - 1);
    for (let r = 0; r < bodyRowsCount; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < safeCols; c++) {
        const td = document.createElement('td');
        td.innerHTML = '<br>';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const trailingP = document.createElement('p');
    trailingP.innerHTML = '<br>';

    const sel = window.getSelection();
    let range: Range | null = null;
    if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
      range = savedRangeRef.current;
    } else if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    }

    if (range) {
      range.deleteContents();
      const frag = document.createDocumentFragment();
      frag.appendChild(table);
      frag.appendChild(trailingP);
      range.insertNode(frag);
    } else {
      el.appendChild(table);
      el.appendChild(trailingP);
    }

    const firstCell = table.querySelector('tbody td') || table.querySelector('th');
    if (firstCell) {
      placeCaretInNode(firstCell, true);
    }
    savedRangeRef.current = null;
    emitChange();
  };

  const handleAddTableRow = () => {
    if (!guardEdit()) return;
    const cell = getActiveTableCell();
    if (!cell) return;
    const currentRow = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest('table');
    if (!currentRow || !table) return;

    const colCount = Math.max(1, currentRow.cells.length);
    const newRow = document.createElement('tr');
    for (let c = 0; c < colCount; c++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      newRow.appendChild(td);
    }
    if (currentRow.parentElement?.tagName === 'THEAD') {
      const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
      tbody.insertBefore(newRow, tbody.firstChild);
    } else {
      currentRow.parentElement?.insertBefore(newRow, currentRow.nextSibling);
    }
    if (newRow.firstElementChild) {
      placeCaretInNode(newRow.firstElementChild, true);
    }
    emitChange();
  };

  const handleDeleteTableRow = () => {
    if (!guardEdit()) return;
    const cell = getActiveTableCell();
    if (!cell) return;
    const currentRow = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest('table');
    if (!currentRow || !table) return;

    const allRows = table.querySelectorAll('tr');
    if (allRows.length <= 1) {
      table.remove();
      setInsideTable(false);
      emitChange();
      return;
    }

    const nextRow =
      (currentRow.nextElementSibling as HTMLTableRowElement | null) ||
      (currentRow.previousElementSibling as HTMLTableRowElement | null);
    currentRow.remove();
    if (nextRow?.firstElementChild) {
      placeCaretInNode(nextRow.firstElementChild, true);
    }
    emitChange();
  };

  const handleAddTableCol = () => {
    if (!guardEdit()) return;
    const cell = getActiveTableCell();
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;
    const colIdx = cell.cellIndex;

    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach((tr) => {
      const isHeader = tr.parentElement?.tagName === 'THEAD' || tr.cells[0]?.tagName === 'TH';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      if (isHeader) {
        newCell.textContent = `العمود ${tr.cells.length + 1}`;
      } else {
        newCell.innerHTML = '<br>';
      }
      const refCell = tr.cells[colIdx + 1] || null;
      tr.insertBefore(newCell, refCell);
    });
    emitChange();
  };

  const handleDeleteTableCol = () => {
    if (!guardEdit()) return;
    const cell = getActiveTableCell();
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;
    const colIdx = cell.cellIndex;
    const firstRow = table.querySelector('tr');
    if (firstRow && firstRow.cells.length <= 1) {
      table.remove();
      setInsideTable(false);
      emitChange();
      return;
    }
    Array.from(table.querySelectorAll('tr')).forEach((tr) => {
      if (tr.cells[colIdx]) {
        tr.deleteCell(colIdx);
      }
    });
    emitChange();
  };

  const handleDeleteTable = () => {
    if (!guardEdit()) return;
    const cell = getActiveTableCell();
    const table = cell?.closest('table');
    if (!table) return;
    table.remove();
    setInsideTable(false);
    emitChange();
  };

  const isEmpty =
    (!value ||
      value
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim().length === 0) &&
    !/<table\b/i.test(value || '');

  return (
    <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
      {/* Main Formatting Toolbar (touch-friendly & wraps cleanly on mobile) */}
      <div className="px-2.5 sm:px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-xl flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('bold');
            }}
            title="نص عريض (Bold)"
            aria-label="نص عريض"
            aria-pressed={activeFormats.bold}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              activeFormats.bold
                ? 'bg-[#1E3A5F] text-white'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Bold className="w-3.5 h-3.5" aria-hidden="true" />
            <span>عريض</span>
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('italic');
            }}
            title="نص مائل (Italic)"
            aria-label="نص مائل"
            aria-pressed={activeFormats.italic}
            className={`min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              activeFormats.italic
                ? 'bg-[#1E3A5F] text-white'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Italic className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleSubheading();
            }}
            title="عنوان فرعي"
            aria-label="عنوان فرعي"
            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Heading3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <span aria-hidden="true" className="w-px h-4 bg-slate-300 mx-0.5 sm:mx-1" />

          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('insertUnorderedList');
            }}
            title="قائمة نقطية (Bullet Points)"
            aria-label="قائمة نقطية"
            aria-pressed={activeFormats.ul}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              activeFormats.ul
                ? 'bg-[#1E3A5F] text-white'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <List className="w-3.5 h-3.5" aria-hidden="true" />
            <span>نقاط</span>
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('insertOrderedList');
            }}
            title="قائمة مرقمة"
            aria-label="قائمة مرقمة"
            aria-pressed={activeFormats.ol}
            className={`min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              activeFormats.ol
                ? 'bg-[#1E3A5F] text-white'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleQuote();
            }}
            title="اقتباس"
            aria-label="اقتباس"
            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Quote className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {/* Insert Table Button + Popover */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              disabled={!canEdit}
              onMouseDown={(e) => {
                e.preventDefault();
                saveCurrentRange();
                setShowHighlightMenu(false);
                setShowTableMenu((v) => !v);
              }}
              title="إدراج جدول داخل الملاحظة"
              aria-label="إدراج جدول"
              aria-expanded={showTableMenu}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                showTableMenu || insideTable
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>جدول</span>
            </button>

            {showTableMenu && canEdit && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[#1E3A5F]">
                    إدراج جدول في الملاحظة
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTableMenu(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_TABLE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertTable(preset.rows, preset.cols);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-[#1E3A5F] hover:text-white border border-slate-200 rounded-lg transition-colors tabular-nums cursor-pointer"
                    >
                      جدول {preset.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] text-slate-500">أو حدد المقاس يدويًا:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-slate-600">
                      الصفوف
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={tableRows}
                        onChange={(e) => setTableRows(Number(e.target.value) || 2)}
                        className="mt-1 w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md tabular-nums"
                      />
                    </label>
                    <label className="text-[11px] text-slate-600">
                      الأعمدة
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={tableCols}
                        onChange={(e) => setTableCols(Number(e.target.value) || 2)}
                        className="mt-1 w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md tabular-nums"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => insertTable(tableRows, tableCols)}
                    className="w-full py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                  >
                    إدراج الجدول ({tableRows} × {tableCols})
                  </button>
                </div>
              </div>
            )}
          </div>

          <span aria-hidden="true" className="w-px h-4 bg-slate-300 mx-0.5 sm:mx-1" />

          {/* Highlight Button + Swatches */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              disabled={!canEdit}
              onMouseDown={(e) => {
                e.preventDefault();
                applyHighlight(activeHighlight);
              }}
              title="تظليل النص المحدد (Highlight)"
              aria-label="تظليل النص المحدد"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-r-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
              <span>تظليل</span>
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-xs border ${HIGHLIGHT_SWATCHES[activeHighlight].swatchClass}`}
              />
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowTableMenu(false);
                setShowHighlightMenu((v) => !v);
              }}
              aria-label="اختيار لون التظليل"
              className="px-2 py-1.5 min-h-[34px] text-[10px] text-slate-600 bg-white border border-r-0 border-slate-200 hover:bg-slate-100 rounded-l-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              ▾
            </button>

            {showHighlightMenu && canEdit && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500 px-1">
                  اختر لون التظليل:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColorKey[]).map(
                    (key) => {
                      const sw = HIGHLIGHT_SWATCHES[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyHighlight(key);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-800 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer"
                        >
                          <span
                            className={`w-3 h-3 rounded-xs border shrink-0 ${sw.swatchClass}`}
                          />
                          <span className="truncate">{sw.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    removeHighlight();
                  }}
                  className="w-full text-center py-1 text-[11px] text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                >
                  إزالة التظليل / التنسيق
                </button>
              </div>
            )}
          </div>

          <span aria-hidden="true" className="w-px h-4 bg-slate-300 mx-0.5 sm:mx-1" />

          {/* Bilingual Arabic + English Direction Controls */}
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5">
            <span
              title="اتجاه المحرر (يدعم العربية والإنجليزية معًا)"
              className="inline-flex items-center px-1.5 text-slate-500"
            >
              <Languages className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <button
              type="button"
              disabled={!canEdit}
              onMouseDown={(e) => {
                e.preventDefault();
                const nextMode =
                  editorDir === 'auto'
                    ? 'rtl'
                    : editorDir === 'rtl'
                    ? 'ltr'
                    : 'auto';
                setEditorDir(nextMode);
                if (editorRef.current) {
                  if (nextMode === 'auto') {
                    editorRef.current
                      .querySelectorAll('[data-manual-dir="true"]')
                      .forEach((n) => n.removeAttribute('data-manual-dir'));
                  }
                  syncBlocksBidi(editorRef.current, nextMode);
                  emitChange(false);
                }
              }}
              title="تبديل اتجاه المحرر العام (تلقائي ثنائي اللغة / عربي RTL / إنجليزي LTR)"
              className="px-2 py-1 min-h-[28px] text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded cursor-pointer disabled:opacity-45"
            >
              {editorDir === 'auto'
                ? 'تلقائي AR/EN'
                : editorDir === 'rtl'
                ? 'عربي RTL'
                : 'EN LTR'}
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onMouseDown={(e) => {
                e.preventDefault();
                applyBlockDirection('ltr');
              }}
              title="تحويل الفقرة الحالية للإنجليزية (يسار لليمين LTR)"
              className="px-1.5 py-1 min-h-[28px] text-[10px] font-bold text-[#1E3A5F] bg-slate-50 hover:bg-[#1E3A5F] hover:text-white border border-slate-200 rounded cursor-pointer disabled:opacity-45"
            >
              EN ↳
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onMouseDown={(e) => {
                e.preventDefault();
                applyBlockDirection('rtl');
              }}
              title="تحويل الفقرة الحالية للعربية (يمين لليسار RTL)"
              className="px-1.5 py-1 min-h-[28px] text-[10px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-200 border border-slate-200 rounded cursor-pointer disabled:opacity-45"
            >
              ع ↲
            </button>
          </div>
        </div>

        {/* Right Controls: Clear / Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('removeFormat');
            }}
            title="مسح التنسيق"
            aria-label="مسح التنسيق"
            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('undo');
            }}
            title="تراجع"
            aria-label="تراجع"
            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onMouseDown={(e) => {
              e.preventDefault();
              runExec('redo');
            }}
            title="إعادة"
            aria-label="إعادة"
            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Contextual Table Row/Column Tools when caret is inside a table */}
      {insideTable && canEdit && (
        <div className="px-3 py-1.5 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold text-[#1E3A5F] inline-flex items-center gap-1 ml-1">
            <Table2 className="w-3 h-3" aria-hidden="true" />
            أدوات الجدول:
          </span>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleAddTableRow();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-slate-700 font-medium cursor-pointer"
          >
            <Plus className="w-3 h-3 text-emerald-700" aria-hidden="true" />
            <Rows3 className="w-3 h-3" aria-hidden="true" />
            <span>صف</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleAddTableCol();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-slate-700 font-medium cursor-pointer"
          >
            <Plus className="w-3 h-3 text-emerald-700" aria-hidden="true" />
            <Columns3 className="w-3 h-3" aria-hidden="true" />
            <span>عمود</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleDeleteTableRow();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-amber-50 rounded-md text-slate-700 cursor-pointer"
          >
            <span>حذف صف</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleDeleteTableCol();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-amber-50 rounded-md text-slate-700 cursor-pointer"
          >
            <span>حذف عمود</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleDeleteTable();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md text-red-700 font-medium cursor-pointer"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>حذف الجدول</span>
          </button>
        </div>
      )}

      {/* Editable Rich Canvas */}
      <div
        className={`relative rounded-b-xl overflow-x-auto ${PAPER_TONE_CLASS[preferences.notePaperTone]}`}
        onClick={() => {
          if (!canEdit) onRequireAuth?.();
        }}
      >
        {isEmpty && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-4 right-4 left-4 text-slate-400 ${
              FONT_SIZE_CLASS[preferences.noteFontSize]
            }`}
          >
            {canEdit
              ? placeholder
              : 'سجّل الدخول بحساب Google للكتابة والتنسيق وإضافة الجداول والنقاط والتظليل...'}
          </div>
        )}

        {!canEdit && (
          <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-medium text-slate-600">
            <Lock className="w-3 h-3" aria-hidden="true" />
            <span>للقراءة فقط</span>
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={canEdit}
          suppressContentEditableWarning
          dir={editorDir}
          role="textbox"
          aria-multiline="true"
          aria-label="محرر الملاحظات المنسّق ثنائي اللغة"
          style={{ caretColor: '#1E3A5F' }}
          onInput={() => emitChange(false)}
          onBlur={() => emitChange(true)}
          onPaste={handlePaste}
          onKeyUp={syncFormatState}
          onMouseUp={syncFormatState}
          className={`prose-bidi w-full p-3.5 sm:p-4 ${minHeightClass} ${
            FONT_SIZE_CLASS[preferences.noteFontSize]
          } ${
            editorDir === 'ltr' ? 'text-left' : editorDir === 'rtl' ? 'text-right' : 'text-start'
          } text-slate-800 break-words focus:outline-none rounded-b-xl touch-manipulation [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_blockquote]:italic [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-xs [&_mark]:text-slate-900 [&_strong]:font-bold [&_strong]:text-slate-900 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs [&_table]:sm:text-sm [&_th]:bg-slate-100 [&_th]:font-bold [&_th]:text-slate-900 [&_th]:border [&_th]:border-slate-300 [&_th]:px-2.5 [&_th]:py-2 [&_th]:min-w-[80px] [&_td]:border [&_td]:border-slate-300 [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_td]:min-w-[80px] [&_td]:bg-white/60 ${
            !canEdit ? 'cursor-not-allowed opacity-85' : ''
          }`}
        />
      </div>
    </div>
  );
}
