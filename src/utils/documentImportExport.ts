import mammoth from 'mammoth';
import { BookNote } from '../data/curriculumData';
import { ensureRichHtml, richHtmlToPlainText } from './richText';

export interface ParsedImportedDocument {
  title: string;
  html: string;
  plainText: string;
  fileName: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripExtension(name: string): string {
  return name.replace(/\.(docx|doc|txt|md|markdown|pdf|html|htm)$/i, '').trim();
}

export async function parseDocumentFile(
  file: File
): Promise<ParsedImportedDocument> {
  const lower = file.name.toLowerCase();
  const baseTitle = stripExtension(file.name) || 'مستند مستورد';

  if (lower.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = ensureRichHtml(result.value || '');
    const plainText = richHtmlToPlainText(html);
    return {
      title: baseTitle,
      html: html || `<p>${escapeHtml(plainText)}</p>`,
      plainText,
      fileName: file.name,
    };
  }

  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const raw = await file.text();
    const html = ensureRichHtml(raw);
    const plainText = richHtmlToPlainText(html);
    return {
      title: baseTitle,
      html,
      plainText,
      fileName: file.name,
    };
  }

  if (lower.endsWith('.doc') || lower.endsWith('.html') || lower.endsWith('.htm')) {
    const raw = await file.text();
    // Many .doc files are HTML/MIME Word docs or UTF-8 text
    if (raw.includes('<body') || raw.includes('<p') || raw.includes('<div')) {
      const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const htmlContent = bodyMatch ? bodyMatch[1] : raw;
      const html = ensureRichHtml(htmlContent);
      const plainText = richHtmlToPlainText(html);
      return {
        title: baseTitle,
        html,
        plainText,
        fileName: file.name,
      };
    }
    const cleaned = raw.replace(/[^\u0600-\u06FF\u0020-\u007E\n\r\t]/g, ' ').trim();
    const html = ensureRichHtml(cleaned || `تم إرفاق الملف: ${file.name}`);
    return {
      title: baseTitle,
      html,
      plainText: richHtmlToPlainText(html),
      fileName: file.name,
    };
  }

  // Binary PDF or other file formats — attach metadata cleanly
  return {
    title: baseTitle,
    html: `<p><strong>مستند مرفق:</strong> ${escapeHtml(file.name)} (${Math.max(1, Math.round(file.size / 1024))} كيلوبايت)</p>`,
    plainText: `مستند مرفق: ${file.name}`,
    fileName: file.name,
  };
}

// --- Lightweight IndexedDB cache for locally attached files (PDF / Word / Docs) ---
const IDB_NAME = 'mizan_attachments_db';
const IDB_STORE = 'files';

function openAttachmentsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalAttachment(
  resourceId: string,
  file: File
): Promise<void> {
  try {
    const db = await openAttachmentsDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(
      { blob: file, name: file.name, type: file.type },
      resourceId
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal if IndexedDB unavailable
  }
}

export async function downloadLocalAttachment(
  resourceId: string,
  fallbackName: string
): Promise<boolean> {
  try {
    const db = await openAttachmentsDb();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(resourceId);
    const record = await new Promise<
      { blob: Blob; name?: string } | undefined
    >((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as { blob: Blob; name?: string } | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!record?.blob) return false;
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.name || fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

// --- Export Notes to Word (.doc) ---
function buildWordHtmlWrapper(title: string, bodyHtml: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; color: #1e293b; line-height: 1.8; margin: 32px; }
  h1 { color: #1E3A5F; font-size: 22pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; }
  h2 { color: #1E3A5F; font-size: 15pt; margin-top: 20px; }
  h3 { color: #334155; font-size: 12pt; margin-top: 14px; }
  .meta { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
  blockquote { border-right: 3px solid #1E3A5F; padding: 6px 12px; background: #f8fafc; margin: 10px 0; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 24px 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function triggerWordDownload(fileName: string, htmlDocument: string) {
  const blob = new Blob(['\ufeff', htmlDocument], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSingleBookNoteAsWord(note: BookNote): void {
  const meta = [
    note.author ? `المؤلف/المحاضر: ${escapeHtml(note.author)}` : '',
    note.courseTitle ? `الكورس: ${escapeHtml(note.courseTitle)}` : '',
    note.lectureTitle ? `المحاضرة: ${escapeHtml(note.lectureTitle)}` : '',
    note.progressMarker ? `الموضع: ${escapeHtml(note.progressMarker)}` : '',
    note.updatedAt ? `آخر تحديث: ${escapeHtml(note.updatedAt)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const contentHtml = ensureRichHtml(note.content || '<p>لا توجد ملاحظات مسجلة بعد.</p>');
  const quotesHtml = note.quotes?.trim()
    ? `<h2>اقتباسات وأسئلة للنقاش</h2>${ensureRichHtml(note.quotes)}`
    : '';

  const body = `
    <h1>${escapeHtml(note.bookTitle)}</h1>
    <div class="meta">${meta}</div>
    <h2>الملاحظات والأفكار المستخلصة</h2>
    ${contentHtml}
    ${quotesHtml}
  `;

  const safeFile =
    note.bookTitle.replace(/[^\u0600-\u06FFa-zA-Z0-9_\-\s]/g, '').trim() ||
    'ملاحظات';
  triggerWordDownload(`${safeFile}.doc`, buildWordHtmlWrapper(note.bookTitle, body));
}

export function exportNotebookBundleAsWord(
  notebookTitle: string,
  notes: BookNote[]
): void {
  const sections = notes
    .map((bn, idx) => {
      const meta = [
        bn.lectureTitle ? `المحاضرة: ${escapeHtml(bn.lectureTitle)}` : '',
        bn.author ? `المؤلف/المحاضر: ${escapeHtml(bn.author)}` : '',
        bn.progressMarker ? `الموضع: ${escapeHtml(bn.progressMarker)}` : '',
        bn.updatedAt ? `التحديث: ${escapeHtml(bn.updatedAt)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      return `
        <h2>${idx + 1}. ${escapeHtml(bn.bookTitle)}</h2>
        <div class="meta">${meta}</div>
        ${ensureRichHtml(bn.content || '<p>لا توجد ملاحظات مسجلة.</p>')}
        ${
          bn.quotes?.trim()
            ? `<h3>اقتباسات ونقاشات</h3>${ensureRichHtml(bn.quotes)}`
            : ''
        }
        <hr />
      `;
    })
    .join('\n');

  const body = `
    <h1>دفتر تلخيص: ${escapeHtml(notebookTitle)}</h1>
    <div class="meta">عدد الملاحظات المصدّرة: ${notes.length}</div>
    ${sections}
  `;

  const safeName =
    notebookTitle.replace(/[^\u0600-\u06FFa-zA-Z0-9_\-\s]/g, '').trim() ||
    'دفتر_التلخيص';
  triggerWordDownload(
    `دفتر_${safeName}.doc`,
    buildWordHtmlWrapper(notebookTitle, body)
  );
}
