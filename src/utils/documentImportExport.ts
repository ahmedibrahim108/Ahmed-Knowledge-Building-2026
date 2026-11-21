import mammoth from 'mammoth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { BookNote } from '../data/curriculumData';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  storage,
} from '../firebase';
import { ensureRichHtml, richHtmlToPlainText } from './richText';

export interface ParsedImportedDocument {
  title: string;
  html: string;
  plainText: string;
  fileName: string;
}

export type DocumentAttachmentKind = 'pdf' | 'docx' | 'doc' | 'text' | 'other';

export interface BundledAppDocument {
  id: string;
  title: string;
  subtitle: string;
  fileName: string;
  downloadUrl: string;
  mimeType: string;
}

export const BUNDLED_APP_DOCUMENTS: BundledAppDocument[] = [];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripExtension(name: string): string {
  return name.replace(/\.(docx|doc|txt|md|markdown|pdf|html|htm)$/i, '').trim();
}

export function isPdfAttachment(fileName?: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) return true;
  if (!fileName) return false;
  return /\.pdf($|\?)/i.test(fileName.trim());
}

export function isWordAttachment(fileName?: string, mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    mime.includes('vnd.ms-word')
  ) {
    return true;
  }
  if (!fileName) return false;
  return /\.(docx|doc)($|\?)/i.test(fileName.trim());
}

export function isTextAttachment(fileName?: string, mimeType?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('text/plain') || mime.includes('markdown')) return true;
  if (!fileName) return false;
  return /\.(txt|md|markdown|html|htm)($|\?)/i.test(fileName.trim());
}

export function isViewableDocumentAttachment(
  fileName?: string,
  mimeType?: string
): boolean {
  return (
    isPdfAttachment(fileName, mimeType) ||
    isWordAttachment(fileName, mimeType) ||
    isTextAttachment(fileName, mimeType)
  );
}

export function getAttachmentKind(
  fileName?: string,
  mimeType?: string
): DocumentAttachmentKind {
  if (isPdfAttachment(fileName, mimeType)) return 'pdf';
  const cleanName = (fileName || '').split('?')[0].trim().toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (cleanName.endsWith('.docx') || mime.includes('wordprocessingml')) {
    return 'docx';
  }
  if (cleanName.endsWith('.doc') || mime.includes('msword')) {
    return 'doc';
  }
  if (isTextAttachment(fileName, mimeType)) return 'text';
  return 'other';
}

export function inferMimeTypeFromFileName(
  fileName?: string,
  provided?: string
): string {
  if (provided && provided !== 'application/octet-stream') {
    return provided;
  }
  const clean = (fileName || '').split('?')[0].trim().toLowerCase();
  if (clean.endsWith('.pdf')) return 'application/pdf';
  if (clean.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (clean.endsWith('.doc')) return 'application/msword';
  if (clean.endsWith('.md') || clean.endsWith('.markdown')) {
    return 'text/markdown';
  }
  if (clean.endsWith('.txt')) return 'text/plain';
  if (clean.endsWith('.html') || clean.endsWith('.htm')) return 'text/html';
  return provided || 'application/octet-stream';
}

function parseLegacyDocOrTextRaw(raw: string, fileName: string): string {
  if (
    raw.includes('<html') ||
    raw.includes('<body') ||
    raw.includes('<p') ||
    raw.includes('<div') ||
    raw.includes('<table')
  ) {
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const htmlContent = bodyMatch ? bodyMatch[1] : raw;
    const html = ensureRichHtml(htmlContent);
    if (html) return html;
  }
  const cleaned = raw
    .replace(/[^\u0600-\u06FF\u0020-\u007E\n\r\t]/g, ' ')
    .replace(/ {3,}/g, ' ')
    .trim();
  return ensureRichHtml(cleaned || `تم إرفاق الملف: ${fileName}`);
}

export async function renderDocumentBlobToHtml(
  blob: Blob,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const kind = getAttachmentKind(fileName, mimeType || blob.type);
  if (kind === 'docx') {
    const buffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = ensureRichHtml(result.value || '');
    return (
      html ||
      '<p>المستند فارغ أو لا يحتوي على نص قابل للعرض. يمكنك تنزيله مباشرة.</p>'
    );
  }
  if (kind === 'doc') {
    const raw = await blob.text();
    return parseLegacyDocOrTextRaw(raw, fileName);
  }
  if (kind === 'text') {
    const raw = await blob.text();
    const html = ensureRichHtml(raw);
    return html || '<p>الملف النصي فارغ.</p>';
  }
  return `<p><strong>مستند مرفق:</strong> ${escapeHtml(fileName)}</p>`;
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
    const html = parseLegacyDocOrTextRaw(raw, file.name);
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
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalAttachment(
  resourceId: string,
  file: Blob,
  fileName?: string
): Promise<void> {
  try {
    const idb = await openAttachmentsDb();
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const resolvedName =
      file instanceof File ? file.name : fileName || 'document.pdf';
    const resolvedType = inferMimeTypeFromFileName(resolvedName, file.type);
    tx.objectStore(IDB_STORE).put(
      { blob: file, name: resolvedName, type: resolvedType },
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

export async function getLocalAttachmentBlob(
  resourceId: string
): Promise<{ blob: Blob; name?: string; type?: string } | null> {
  try {
    const idb = await openAttachmentsDb();
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(resourceId);
    const record = await new Promise<
      { blob: Blob; name?: string; type?: string } | undefined
    >((resolve, reject) => {
      req.onsuccess = () =>
        resolve(
          req.result as { blob: Blob; name?: string; type?: string } | undefined
        );
      req.onerror = () => reject(req.error);
    });
    if (!record?.blob) return null;
    return record;
  } catch {
    return null;
  }
}

export async function downloadLocalAttachment(
  resourceId: string,
  fallbackName: string
): Promise<boolean> {
  try {
    const record = await getLocalAttachmentBlob(resourceId);
    if (!record?.blob) return false;
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.name || fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

export interface UploadedAttachmentResult {
  storagePath?: string;
  downloadUrl?: string;
  mimeType: string;
  sizeBytes: number;
  uploadedToCloud: boolean;
  errorMessage?: string;
}

const MAX_FIRESTORE_CHUNKED_BYTES = 15 * 1024 * 1024; // 15 MB across up to 31 chunks
const SINGLE_DOC_THRESHOLD_BYTES = 500 * 1024; // ~670 KB base64 (< 900 KB rule)
const RAW_CHUNK_BYTES = 510 * 1024; // Divisible by 3 -> ~680 KB base64 (< 850 KB chunk rule)

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const step = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += step) {
    const sub = bytes.subarray(i, Math.min(i + step, bytes.length));
    parts.push(String.fromCharCode(...sub));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBlob(
  dataUrl: string,
  mimeType?: string
): Promise<Blob | null> {
  try {
    const res = await fetch(dataUrl);
    const rawBlob = await res.blob();
    if (mimeType && rawBlob.type !== mimeType) {
      return new Blob([rawBlob], { type: mimeType });
    }
    return rawBlob;
  } catch {
    try {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return null;
      const b64 = dataUrl.slice(commaIdx + 1);
      const bytes = base64ToUint8Array(b64);
      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      return new Blob([buf], { type: mimeType || 'application/octet-stream' });
    } catch {
      return null;
    }
  }
}

export async function uploadResourceAttachment(
  uid: string | undefined,
  resourceId: string,
  file: File
): Promise<UploadedAttachmentResult> {
  const mimeType = inferMimeTypeFromFileName(file.name, file.type);

  // Always persist locally in IndexedDB for instant offline/in-app viewing
  await saveLocalAttachment(resourceId, file, file.name);

  const effectiveUid = uid || auth?.currentUser?.uid;
  if (!effectiveUid) {
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
      errorMessage:
        'سجّل الدخول أولاً ليتم حفظ الملف في السحابة ومزامنته بين الهاتف واللابتوب.',
    };
  }

  const safeId = resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  let storagePath: string | undefined;
  let downloadUrl: string | undefined;
  let uploadedToCloud = false;
  let errorMessage: string | undefined;

  // 1) Try Firebase Storage first (fast CDN + supports files > 15 MB)
  if (storage) {
    try {
      const safeFileName =
        file.name
          .replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_')
          .replace(/^_+/, '')
          .slice(0, 120) || 'attachment';
      storagePath = `users/${effectiveUid}/resources/${safeId}/${safeFileName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: mimeType });
      downloadUrl = await getDownloadURL(storageRef);
      uploadedToCloud = true;
    } catch (err) {
      console.warn('Cloud Storage upload fallback:', err);
      storagePath = undefined;
    }
  }

  // 2) Always mirror up to 15 MB into Firestore (`attachments` + optional `chunks`)
  //    so cross-device download & opening NEVER break from Storage CORS issues.
  if (db && file.size <= MAX_FIRESTORE_CHUNKED_BYTES) {
    try {
      const attachmentDocRef = doc(db, 'users', effectiveUid, 'attachments', safeId);

      if (file.size <= SINGLE_DOC_THRESHOLD_BYTES) {
        const dataUrl = await fileToDataUrl(file);
        if (dataUrl.length > 0 && dataUrl.length <= 899_000) {
          await setDoc(attachmentDocRef, {
            id: safeId,
            ownerId: effectiveUid,
            fileName: file.name.slice(0, 200),
            mimeType: mimeType.slice(0, 120),
            sizeBytes: file.size,
            dataUrl,
            chunkCount: 1,
            ...(storagePath ? { storagePath: storagePath.slice(0, 400) } : {}),
            ...(downloadUrl ? { downloadUrl: downloadUrl.slice(0, 1200) } : {}),
            updatedAt: serverTimestamp(),
          });
          uploadedToCloud = true;
        }
      } else {
        const buffer = await file.arrayBuffer();
        const totalChunks = Math.max(1, Math.ceil(buffer.byteLength / RAW_CHUNK_BYTES));
        if (totalChunks <= 40) {
          // Master Gate rule requires parent attachment doc to exist before creating chunks
          await setDoc(attachmentDocRef, {
            id: safeId,
            ownerId: effectiveUid,
            fileName: file.name.slice(0, 200),
            mimeType: mimeType.slice(0, 120),
            sizeBytes: file.size,
            dataUrl: '',
            chunkCount: totalChunks,
            ...(storagePath ? { storagePath: storagePath.slice(0, 400) } : {}),
            ...(downloadUrl ? { downloadUrl: downloadUrl.slice(0, 1200) } : {}),
            updatedAt: serverTimestamp(),
          });

          const BATCH_SIZE = 4;
          for (let start = 0; start < totalChunks; start += BATCH_SIZE) {
            const batch = writeBatch(db);
            const end = Math.min(start + BATCH_SIZE, totalChunks);
            for (let idx = start; idx < end; idx++) {
              const sliceStart = idx * RAW_CHUNK_BYTES;
              const sliceEnd = Math.min(
                sliceStart + RAW_CHUNK_BYTES,
                buffer.byteLength
              );
              const bytes = new Uint8Array(buffer.slice(sliceStart, sliceEnd));
              const b64 = uint8ArrayToBase64(bytes);
              const chunkId = `chunk_${String(idx).padStart(3, '0')}`;
              const chunkRef = doc(
                db,
                'users',
                effectiveUid,
                'attachments',
                safeId,
                'chunks',
                chunkId
              );
              batch.set(chunkRef, {
                id: chunkId,
                ownerId: effectiveUid,
                attachmentId: safeId,
                chunkIndex: idx,
                data: b64,
                updatedAt: serverTimestamp(),
              });
            }
            await batch.commit();
          }
          uploadedToCloud = true;
        }
      }
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `users/${effectiveUid}/attachments/${safeId}`
        );
      } catch {
        // Logged via handleFirestoreError; preserve Storage upload status if succeeded
      }
      if (!uploadedToCloud) {
        errorMessage =
          'تعذر رفع الملف إلى قاعدة البيانات السحابية. تحقق من الاتصال بالإنترنت أو صلاحيات الحساب وحاول مجددًا.';
      }
    }
  } else if (!uploadedToCloud && file.size > MAX_FIRESTORE_CHUNKED_BYTES) {
    errorMessage =
      'حجم الملف أكبر من 15 ميجابايت وتعذر رفعه إلى Firebase Storage. جرّب ضغط الملف أو تقليل حجمه.';
  }

  return {
    storagePath,
    downloadUrl,
    mimeType,
    sizeBytes: file.size,
    uploadedToCloud,
    errorMessage,
  };
}

export async function getPdfBlobForViewing(options: {
  uid?: string;
  resourceId?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<Blob | null> {
  const inferredMime = inferMimeTypeFromFileName(
    options.fileName,
    options.mimeType
  );

  // 1) Local IndexedDB cache (same device / previously downloaded)
  if (options.resourceId) {
    const local = await getLocalAttachmentBlob(options.resourceId);
    if (local?.blob) {
      if (
        inferredMime !== 'application/octet-stream' &&
        local.blob.type !== inferredMime
      ) {
        return new Blob([local.blob], { type: inferredMime });
      }
      return local.blob;
    }
  }

  // 2) Firestore `attachments` (inline dataUrl OR multi-chunk subcollection)
  const effectiveUid = options.uid || auth?.currentUser?.uid;
  if (db && effectiveUid && options.resourceId) {
    const safeId = options.resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    try {
      const snap = await getDoc(
        doc(db, 'users', effectiveUid, 'attachments', safeId)
      );
      if (snap.exists()) {
        const raw = snap.data() as {
          dataUrl?: string;
          chunkCount?: number;
          fileName?: string;
          mimeType?: string;
        };
        const resolvedMime = inferMimeTypeFromFileName(
          raw.fileName || options.fileName,
          raw.mimeType || options.mimeType
        );

        if (raw.dataUrl) {
          const blob = await dataUrlToBlob(raw.dataUrl, resolvedMime);
          if (blob) {
            await saveLocalAttachment(
              options.resourceId,
              blob,
              raw.fileName || options.fileName
            );
            return blob;
          }
        } else if ((raw.chunkCount ?? 0) >= 1) {
          const chunksSnap = await getDocs(
            collection(db, 'users', effectiveUid, 'attachments', safeId, 'chunks')
          );
          if (!chunksSnap.empty) {
            const orderedChunks = chunksSnap.docs
              .map(
                (d) =>
                  d.data() as {
                    chunkIndex?: number;
                    data?: string;
                  }
              )
              .filter((c) => typeof c.data === 'string' && c.data.length > 0)
              .sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

            if (orderedChunks.length > 0) {
              const byteParts: ArrayBuffer[] = orderedChunks.map((c) => {
                const decoded = base64ToUint8Array(c.data!);
                const buf = new ArrayBuffer(decoded.byteLength);
                new Uint8Array(buf).set(decoded);
                return buf;
              });
              const assembled = new Blob(byteParts, { type: resolvedMime });
              await saveLocalAttachment(
                options.resourceId,
                assembled,
                raw.fileName || options.fileName
              );
              return assembled;
            }
          }
        }
      }
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          OperationType.GET,
          `users/${effectiveUid}/attachments/${safeId}`
        );
      } catch {
        // Logged via handleFirestoreError; continue to Storage fallback
      }
    }
  }

  // 3) Firebase Storage SDK `getBlob`
  if (storage && options.storagePath) {
    try {
      const rawBlob = await getBlob(ref(storage, options.storagePath));
      const blob =
        inferredMime !== 'application/octet-stream' &&
        rawBlob.type !== inferredMime
          ? new Blob([rawBlob], { type: inferredMime })
          : rawBlob;
      if (options.resourceId && blob) {
        await saveLocalAttachment(options.resourceId, blob, options.fileName);
      }
      return blob;
    } catch (err) {
      console.warn('Failed reading attachment via Storage SDK:', err);
    }
  }

  // 4) Direct HTTPS downloadUrl fetch fallback
  if (options.downloadUrl) {
    try {
      const res = await fetch(options.downloadUrl);
      if (res.ok) {
        const rawBlob = await res.blob();
        const blob =
          inferredMime !== 'application/octet-stream' &&
          rawBlob.type !== inferredMime
            ? new Blob([rawBlob], { type: inferredMime })
            : rawBlob;
        if (options.resourceId && blob) {
          await saveLocalAttachment(options.resourceId, blob, options.fileName);
        }
        return blob;
      }
    } catch (err) {
      console.warn('Failed fetching attachment URL:', err);
    }
  }

  return null;
}

export interface DownloadAttachmentResult {
  ok: boolean;
  openedExternal?: boolean;
  errorMessage?: string;
}

export async function downloadResourceAttachmentResult(options: {
  uid?: string;
  resourceId?: string;
  fileName: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<DownloadAttachmentResult> {
  const triggerBlobDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.fileName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const blob = await getPdfBlobForViewing({
    uid: options.uid,
    resourceId: options.resourceId,
    fileName: options.fileName,
    mimeType: options.mimeType,
    storagePath: options.storagePath,
    downloadUrl: options.downloadUrl,
  });

  if (blob) {
    triggerBlobDownload(blob);
    return { ok: true };
  }

  if (options.downloadUrl) {
    const a = document.createElement('a');
    a.href = options.downloadUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true, openedExternal: true };
  }

  return {
    ok: false,
    errorMessage:
      'لم يُعثر على محتوى هذا الملف في السحابة أو على هذا الجهاز. إذا كنت قد رفعته قبل تحديث المزامنة، أعد رفعه مرة واحدة من الجهاز الأصلي ليظهر تلقائيًا على كل أجهزتك.',
  };
}

export async function downloadResourceAttachment(options: {
  uid?: string;
  resourceId?: string;
  fileName: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<boolean> {
  const res = await downloadResourceAttachmentResult(options);
  return res.ok;
}

export async function deleteCloudAttachment(
  uid: string | undefined,
  resourceId?: string,
  storagePath?: string
): Promise<void> {
  const effectiveUid = uid || auth?.currentUser?.uid;
  if (effectiveUid && resourceId && db) {
    const safeId = resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    try {
      const chunksSnap = await getDocs(
        collection(db, 'users', effectiveUid, 'attachments', safeId, 'chunks')
      );
      if (!chunksSnap.empty) {
        const batch = writeBatch(db);
        chunksSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'users', effectiveUid, 'attachments', safeId));
    } catch {
      // Non-fatal cleanup
    }
  }
  if (storage && storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // Non-fatal cleanup
    }
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
