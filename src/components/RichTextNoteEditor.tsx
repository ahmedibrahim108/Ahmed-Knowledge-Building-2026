import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Eraser,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Lock,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import { HighlightColorKey, UserPreferences } from '../data/curriculumData';
import {
  HIGHLIGHT_SWATCHES,
  ensureRichHtml,
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

export default function RichTextNoteEditor({
  noteKey,
  value,
  onChange,
  placeholder = 'ابدأ الكتابة هنا، أو استخدم شريط الأدوات لإضافة خط عريض (Bold) أو نقاط (Bullet Points) أو تظليل (Highlight)...',
  canEdit,
  onRequireAuth,
  preferences,
  onSelectDefaultHighlight,
  minHeightClass = 'min-h-[220px]',
}: RichTextNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = useRef<string>('');
  const lastNoteKeyRef = useRef<string>('');
  const [activeHighlight, setActiveHighlight] = useState<HighlightColorKey>(
    preferences.noteHighlightColor
  );
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    ul: false,
    ol: false,
  });

  useEffect(() => {
    setActiveHighlight(preferences.noteHighlightColor);
  }, [preferences.noteHighlightColor]);

  // Sync DOM only when switching noteKey or when value changes externally (e.g., voice dictation)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const normalized = ensureRichHtml(value);
    const noteChanged = lastNoteKeyRef.current !== noteKey;
    if (noteChanged || normalized !== lastHtmlRef.current) {
      el.innerHTML = normalized;
      lastHtmlRef.current = normalized;
      lastNoteKeyRef.current = noteKey;
    }
  }, [noteKey, value]);

  const syncFormatState = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      // ignore if unsupported in current selection
    }
  };

  useEffect(() => {
    const handler = () => {
      if (document.activeElement === editorRef.current) {
        syncFormatState();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const cleaned = sanitizeRichHtml(el.innerHTML);
    lastHtmlRef.current = cleaned;
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

  const runExec = (command: string, commandVal?: string) => {
    if (!guardEdit()) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, commandVal);
    emitChange();
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

  const isEmpty =
    !value ||
    value
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length === 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
      {/* Formatting Toolbar */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 rounded-t-xl flex flex-wrap items-center justify-between gap-2">
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
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
            className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Heading3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <span aria-hidden="true" className="w-px h-4 bg-slate-300 mx-1" />

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
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
            className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
            className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Quote className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <span aria-hidden="true" className="w-px h-4 bg-slate-300 mx-1" />

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
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-r-md transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
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
                setShowHighlightMenu((v) => !v);
              }}
              aria-label="اختيار لون التظليل"
              className="px-1.5 py-1.5 text-[10px] text-slate-600 bg-white border border-r-0 border-slate-200 hover:bg-slate-100 rounded-l-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
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
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
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
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
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
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Editable Rich Canvas */}
      <div
        className={`relative rounded-b-xl ${PAPER_TONE_CLASS[preferences.notePaperTone]}`}
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
              : 'سجّل الدخول بحساب Google للكتابة والتنسيق وإضافة النقاط والتظليل...'}
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
          dir="rtl"
          role="textbox"
          aria-multiline="true"
          aria-label="محرر الملاحظات المنسّق"
          onInput={emitChange}
          onBlur={emitChange}
          onKeyUp={syncFormatState}
          onMouseUp={syncFormatState}
          className={`w-full p-4 ${minHeightClass} ${
            FONT_SIZE_CLASS[preferences.noteFontSize]
          } text-slate-800 focus:outline-none rounded-b-xl [&_ul]:list-disc [&_ul]:pr-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pr-6 [&_ol]:my-2 [&_li]:my-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_blockquote]:border-r-2 [&_blockquote]:border-[#1E3A5F] [&_blockquote]:pr-3 [&_blockquote]:my-2 [&_blockquote]:text-slate-700 [&_blockquote]:italic [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-xs [&_mark]:text-slate-900 [&_strong]:font-bold [&_strong]:text-slate-900 ${
            !canEdit ? 'cursor-not-allowed opacity-85' : ''
          }`}
        />
      </div>
    </div>
  );
}
