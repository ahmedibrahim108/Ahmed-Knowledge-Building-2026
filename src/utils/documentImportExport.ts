import mammoth from 'mammoth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { BookNote } from '../data/curriculumData';
import { auth, db, storage } from '../firebase';
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

export const BUNDLED_APP_DOCUMENTS: Array<{
  id: string;
  title: string;
  fileName: string;
  downloadUrl: string;
  subtitle: string;
  mimeType: string;
}> = [
  {
    id: 'bundled-zoho-notebook-pdf',
    title: 'المستند المرفق بالتطبيق (Untitled PDF)',
    fileName: '_data_user_0_com.zoho.notebook_files_Untitled__1__6ee5100a.pdf',
    downloadUrl:
      '/assets/aistudio/_data_user_0_com.zoho.notebook_files_Untitled__1__6ee5100a.pdf',
    subtitle: 'ملف PDF مرفق بالتطبيق · جاهز للعرض والتنزيل',
    mimeType: 'application/pdf',
  },
];

export function isPdfAttachment(fileName?: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) return true;
  if (!fileName) return false;
  return /\.pdf($|\?)/i.test(fileName.trim());
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
const PDF_CHUNK_CHAR_SIZE = 550_000;

function openAttachmentsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE);
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
    const database = await openAttachmentsDb();
    const tx = database.transaction(IDB_STORE, 'readwrite');
    const resolvedName =
      file instanceof File ? file.name : fileName || 'document.pdf';
    tx.objectStore(IDB_STORE).put(
      { blob: file, name: resolvedName, type: file.type || 'application/pdf' },
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
    const database = await openAttachmentsDb();
    const tx = database.transaction(IDB_STORE, 'readonly');
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  cloudErrorCode?: 'PERMISSION' | 'NETWORK' | 'SIZE_LIMIT';
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function decodeDataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const base64 = dataUrl.slice(commaIdx + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function normalizePdfBytes(raw: Uint8Array): { valid: boolean; bytes: Uint8Array; blob: Blob } {
  const bytes = new Uint8Array(raw);
  // Check for "%PDF-" within first 1024 bytes (handles BOM/leading whitespace)
  let hasPdfMagic = false;
  const checkLimit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i <= checkLimit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 // F
    ) {
      hasPdfMagic = true;
      break;
    }
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return { valid: hasPdfMagic && bytes.length > 32, bytes, blob };
}

export async function uploadResourceAttachment(
  uid: string | undefined,
  resourceId: string,
  file: File
): Promise<UploadedAttachmentResult> {
  const mimeType =
    file.type ||
    (isPdfAttachment(file.name) ? 'application/pdf' : 'application/octet-stream');

  await saveLocalAttachment(resourceId, file, file.name);

  if (!uid) {
    return {
      mimeType,
      sizeBytes: file.size,
      uploadedToCloud: false,
    };
  }

  const safeId = resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  let storagePath: string | undefined;
  let downloadUrl: string | undefined;
  let uploadedToCloud = false;

  try {
    const safeFileName =
      file.name.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_').slice(0, 120) ||
      'attachment';
    storagePath = `users/${uid}/resources/${safeId}/${safeFileName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: mimeType });
    downloadUrl = await getDownloadURL(storageRef);
    uploadedToCloud = true;
  } catch (err) {
    console.warn('Cloud Storage upload fallback:', err);
    storagePath = undefined;
  }

  let cloudErrorCode: UploadedAttachmentResult['cloudErrorCode'];

  // Persist files <= 4.5MB directly in Firestore (single doc <= 850KB or chunked subcollection)
  // so mobile Android Chrome never fails due to Storage CORS or blocked blob fetches.
  if (file.size <= 4.5 * 1024 * 1024) {
    try {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl.length <= 850_000) {
        // Omit chunkCount when single doc so BOTH old and new firestore.rules accept it
        await setDoc(doc(db, 'users', uid, 'attachments', safeId), {
          id: safeId,
          ownerId: uid,
          fileName: file.name.slice(0, 200),
          mimeType: mimeType.slice(0, 120),
          sizeBytes: Math.round(file.size),
          dataUrl,
          updatedAt: serverTimestamp(),
        });
        uploadedToCloud = true;
      } else if (dataUrl.length <= 8_000_000) {
        const chunkCount = Math.ceil(dataUrl.length / PDF_CHUNK_CHAR_SIZE);
        await setDoc(doc(db, 'users', uid, 'attachments', safeId), {
          id: safeId,
          ownerId: uid,
          fileName: file.name.slice(0, 200),
          mimeType: mimeType.slice(0, 120),
          sizeBytes: Math.round(file.size),
          dataUrl: '',
          chunkCount,
          updatedAt: serverTimestamp(),
        });
        const batch = writeBatch(db);
        for (let i = 0; i < chunkCount; i++) {
          const chunkId = `chunk_${String(i).padStart(4, '0')}`;
          const slice = dataUrl.slice(
            i * PDF_CHUNK_CHAR_SIZE,
            (i + 1) * PDF_CHUNK_CHAR_SIZE
          );
          batch.set(doc(db, 'users', uid, 'attachments', safeId, 'chunks', chunkId), {
            id: chunkId,
            ownerId: uid,
            chunkIndex: i,
            data: slice,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        uploadedToCloud = true;
      } else {
        cloudErrorCode = 'SIZE_LIMIT';
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (code === 'permission-denied' || msg.includes('permission')) {
        cloudErrorCode = 'PERMISSION';
      } else {
        cloudErrorCode = 'NETWORK';
      }
      console.warn('Firestore attachment backup failed:', err);
    }
  } else if (!uploadedToCloud) {
    cloudErrorCode = 'SIZE_LIMIT';
  }

  return {
    storagePath,
    downloadUrl,
    mimeType,
    sizeBytes: file.size,
    uploadedToCloud,
    cloudErrorCode,
  };
}

export type PdfLoadResult =
  | {
      ok: true;
      data: Uint8Array;
      blob: Blob;
      mimeType: string;
      source: 'local' | 'firestore' | 'storage' | 'url';
      sizeBytes: number;
    }
  | {
      ok: false;
      errorCode: 'NOT_FOUND' | 'INVALID_PDF' | 'NETWORK_OR_CORS' | 'PERMISSION';
      message: string;
      fallbackUrl?: string;
    };

/**
 * Loads raw PDF bytes safely across Desktop & Android Chrome without relying on ephemeral blob URLs.
 * Enforces application/pdf MIME, verifies %PDF magic bytes, and provides diagnostic error codes.
 */
export async function loadPdfBytesForViewing(options: {
  resourceId?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<PdfLoadResult> {
  // 1. Local IndexedDB cache (fastest, offline-safe)
  if (options.resourceId) {
    const local = await getLocalAttachmentBlob(options.resourceId);
    if (local?.blob) {
      const ab = await local.blob.arrayBuffer();
      const norm = normalizePdfBytes(new Uint8Array(ab));
      if (norm.valid) {
        return {
          ok: true,
          data: norm.bytes,
          blob: norm.blob,
          mimeType: 'application/pdf',
          source: 'local',
          sizeBytes: norm.bytes.byteLength,
        };
      }
    }
  }

  // 2. Firestore attachments doc + chunks (completely bypasses Storage CORS on mobile browsers)
  const uid = auth?.currentUser?.uid;
  if (uid && options.resourceId) {
    try {
      const safeId = options.resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const snap = await getDoc(doc(db, 'users', uid, 'attachments', safeId));
      if (snap.exists()) {
        const raw = snap.data() as {
          dataUrl?: string;
          chunkCount?: number;
          fileName?: string;
        };
        let combinedDataUrl = raw.dataUrl || '';
        if (!combinedDataUrl && raw.chunkCount && raw.chunkCount > 0) {
          const chunksSnap = await getDocs(
            query(
              collection(db, 'users', uid, 'attachments', safeId, 'chunks'),
              where('ownerId', '==', uid)
            )
          );
          if (!chunksSnap.empty) {
            combinedDataUrl = chunksSnap.docs
              .map((d) => d.data() as { chunkIndex: number; data: string })
              .sort((a, b) => a.chunkIndex - b.chunkIndex)
              .map((c) => c.data)
              .join('');
          }
        }
        if (combinedDataUrl) {
          const rawBytes = decodeDataUrlToBytes(combinedDataUrl);
          if (rawBytes) {
            const norm = normalizePdfBytes(rawBytes);
            if (norm.valid) {
              await saveLocalAttachment(options.resourceId, norm.blob, raw.fileName);
              return {
                ok: true,
                data: norm.bytes,
                blob: norm.blob,
                mimeType: 'application/pdf',
                source: 'firestore',
                sizeBytes: norm.bytes.byteLength,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed reading attachment from Firestore:', err);
    }
  }

  // 3. Firebase Storage SDK
  let hadNetworkOrCorsError = false;
  let hadPermissionError = false;

  if (options.storagePath) {
    try {
      const blob = await getBlob(ref(storage, options.storagePath));
      const ab = await blob.arrayBuffer();
      const norm = normalizePdfBytes(new Uint8Array(ab));
      if (norm.valid) {
        if (options.resourceId) {
          await saveLocalAttachment(options.resourceId, norm.blob);
        }
        return {
          ok: true,
          data: norm.bytes,
          blob: norm.blob,
          mimeType: 'application/pdf',
          source: 'storage',
          sizeBytes: norm.bytes.byteLength,
        };
      }
      return {
        ok: false,
        errorCode: 'INVALID_PDF',
        message: 'الملف المسترجع من التخزين لا يبدو كملف PDF صالح.',
        fallbackUrl: options.downloadUrl,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('unauthorized') || msg.includes('permission')) {
        hadPermissionError = true;
      } else {
        hadNetworkOrCorsError = true;
      }
      console.warn('Failed reading PDF via Storage SDK:', err);
    }
  }

  // 4. Direct downloadUrl / external / local public asset URL
  if (options.downloadUrl) {
    try {
      const res = await fetch(options.downloadUrl, {
        credentials: options.downloadUrl.startsWith('/') ? 'same-origin' : 'omit',
      });
      if (!res.ok) {
        return {
          ok: false,
          errorCode: res.status === 401 || res.status === 403 ? 'PERMISSION' : 'NETWORK_OR_CORS',
          message:
            res.status === 401 || res.status === 403
              ? 'ليست لديك صلاحية قراءة هذا الملف مباشرة عبر الرابط.'
              : `تعذّر تحميل الملف من الخادم (رمز ${res.status}).`,
          fallbackUrl: options.downloadUrl,
        };
      }
      const ab = await res.arrayBuffer();
      const norm = normalizePdfBytes(new Uint8Array(ab));
      if (!norm.valid) {
        return {
          ok: false,
          errorCode: 'INVALID_PDF',
          message:
            'الرابط المرفق لم يرجع ملف PDF صالحًا (قد يكون صفحة ويب أو رابطًا يتطلب فتحه خارجيًا).',
          fallbackUrl: options.downloadUrl,
        };
      }
      if (options.resourceId) {
        await saveLocalAttachment(options.resourceId, norm.blob);
      }
      return {
        ok: true,
        data: norm.bytes,
        blob: norm.blob,
        mimeType: 'application/pdf',
        source: 'url',
        sizeBytes: norm.bytes.byteLength,
      };
    } catch (err) {
      hadNetworkOrCorsError = true;
      console.warn('Failed fetching PDF URL:', err);
    }
  }

  if (hadPermissionError) {
    return {
      ok: false,
      errorCode: 'PERMISSION',
      message: 'تعذّر الوصول للملف بسبب صلاحيات التخزين. تأكد من تسجيل الدخول بنفس الحساب المالك.',
      fallbackUrl: options.downloadUrl,
    };
  }

  if (hadNetworkOrCorsError) {
    return {
      ok: false,
      errorCode: 'NETWORK_OR_CORS',
      message:
        'منع المتصفح تحميل الملف مباشرة عبر الشبكة (CORS أو انقطاع الاتصال). يمكنك تنزيله أو فتح الرابط الأصلي أدناه.',
      fallbackUrl: options.downloadUrl,
    };
  }

  return {
    ok: false,
    errorCode: 'NOT_FOUND',
    message:
      'تعذّر العثور على ملف PDF على هذا الجهاز أو في السحابة. إذا رُفع الملف على جهاز آخر قبل المزامنة، أعد رفعه أو تأكد من الاتصال.',
    fallbackUrl: options.downloadUrl,
  };
}

export async function getPdfBlobForViewing(options: {
  resourceId?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<Blob | null> {
  const res = await loadPdfBytesForViewing(options);
  return res.ok ? res.blob : null;
}

export type UniversalAttachmentLoadResult =
  | {
      ok: true;
      kind: 'pdf';
      data: Uint8Array;
      blob: Blob;
      mimeType: string;
      fileName: string;
      source: 'local' | 'firestore' | 'storage' | 'url';
      sizeBytes: number;
    }
  | {
      ok: true;
      kind: 'docx' | 'text' | 'image';
      blob: Blob;
      mimeType: string;
      fileName: string;
      html?: string;
      plainText?: string;
      source: 'local' | 'firestore' | 'storage' | 'url';
      sizeBytes: number;
    }
  | {
      ok: false;
      errorCode: 'NOT_FOUND' | 'INVALID_PDF' | 'NETWORK_OR_CORS' | 'PERMISSION';
      message: string;
      fallbackUrl?: string;
    };

async function fetchRawAttachmentBlob(options: {
  resourceId?: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<
  | { ok: true; blob: Blob; fileName?: string; mimeType?: string; source: 'local' | 'firestore' | 'storage' | 'url' }
  | { ok: false; errorCode: 'NOT_FOUND' | 'NETWORK_OR_CORS' | 'PERMISSION'; message: string; fallbackUrl?: string }
> {
  if (options.resourceId) {
    const local = await getLocalAttachmentBlob(options.resourceId);
    if (local?.blob) {
      return {
        ok: true,
        blob: local.blob,
        fileName: local.name,
        mimeType: local.type || local.blob.type,
        source: 'local',
      };
    }
  }

  const uid = auth?.currentUser?.uid;
  if (uid && options.resourceId) {
    try {
      const safeId = options.resourceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const snap = await getDoc(doc(db, 'users', uid, 'attachments', safeId));
      if (snap.exists()) {
        const raw = snap.data() as {
          dataUrl?: string;
          chunkCount?: number;
          fileName?: string;
          mimeType?: string;
        };
        let combinedDataUrl = raw.dataUrl || '';
        if (!combinedDataUrl && raw.chunkCount && raw.chunkCount > 0) {
          const chunksSnap = await getDocs(
            query(
              collection(db, 'users', uid, 'attachments', safeId, 'chunks'),
              where('ownerId', '==', uid)
            )
          );
          if (!chunksSnap.empty) {
            combinedDataUrl = chunksSnap.docs
              .map((d) => d.data() as { chunkIndex: number; data: string })
              .sort((a, b) => a.chunkIndex - b.chunkIndex)
              .map((c) => c.data)
              .join('');
          }
        }
        if (combinedDataUrl) {
          const rawBytes = decodeDataUrlToBytes(combinedDataUrl);
          if (rawBytes) {
            const mime = raw.mimeType || 'application/octet-stream';
            const blob = new Blob([new Uint8Array(rawBytes)], { type: mime });
            await saveLocalAttachment(options.resourceId, blob, raw.fileName);
            return {
              ok: true,
              blob,
              fileName: raw.fileName,
              mimeType: mime,
              source: 'firestore',
            };
          }
        }
      }
    } catch (err) {
      console.warn('Failed reading attachment from Firestore:', err);
    }
  }

  let hadNetworkOrCorsError = false;
  let hadPermissionError = false;

  if (options.storagePath) {
    try {
      const blob = await getBlob(ref(storage, options.storagePath));
      if (options.resourceId) {
        await saveLocalAttachment(options.resourceId, blob);
      }
      return {
        ok: true,
        blob,
        mimeType: blob.type || undefined,
        source: 'storage',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('unauthorized') || msg.includes('permission')) {
        hadPermissionError = true;
      } else {
        hadNetworkOrCorsError = true;
      }
      console.warn('Failed reading attachment via Storage SDK:', err);
    }
  }

  if (options.downloadUrl) {
    try {
      const res = await fetch(options.downloadUrl, {
        credentials: options.downloadUrl.startsWith('/') ? 'same-origin' : 'omit',
      });
      if (!res.ok) {
        return {
          ok: false,
          errorCode: res.status === 401 || res.status === 403 ? 'PERMISSION' : 'NETWORK_OR_CORS',
          message:
            res.status === 401 || res.status === 403
              ? 'ليست لديك صلاحية قراءة هذا الملف مباشرة عبر الرابط.'
              : `تعذّر تحميل الملف من الخادم (رمز ${res.status}).`,
          fallbackUrl: options.downloadUrl,
        };
      }
      const blob = await res.blob();
      if (options.resourceId) {
        await saveLocalAttachment(options.resourceId, blob);
      }
      return {
        ok: true,
        blob,
        mimeType: blob.type || undefined,
        source: 'url',
      };
    } catch (err) {
      hadNetworkOrCorsError = true;
      console.warn('Failed fetching attachment URL:', err);
    }
  }

  if (hadPermissionError) {
    return {
      ok: false,
      errorCode: 'PERMISSION',
      message: 'تعذّر الوصول للملف بسبب صلاحيات التخزين. تأكد من تسجيل الدخول بنفس الحساب المالك.',
      fallbackUrl: options.downloadUrl,
    };
  }

  if (hadNetworkOrCorsError) {
    return {
      ok: false,
      errorCode: 'NETWORK_OR_CORS',
      message:
        'منع المتصفح تحميل الملف مباشرة عبر الشبكة (CORS أو انقطاع الاتصال). يمكنك معاينته عبر الرابط أو تنزيله أدناه.',
      fallbackUrl: options.downloadUrl,
    };
  }

  return {
    ok: false,
    errorCode: 'NOT_FOUND',
    message:
      'تعذّر العثور على الملف على هذا الجهاز أو في السحابة. إذا رُفع الملف على جهاز آخر قبل تفعيل قواعد المزامنة، أعد رفعه.',
    fallbackUrl: options.downloadUrl,
  };
}

export async function loadAnyAttachmentForViewing(options: {
  resourceId?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  downloadUrl?: string;
  fallbackText?: string;
}): Promise<UniversalAttachmentLoadResult> {
  const rawRes = await fetchRawAttachmentBlob(options);
  if (!rawRes.ok) {
    if (options.fallbackText?.trim()) {
      const textBlob = new Blob([options.fallbackText], { type: 'text/plain;charset=utf-8' });
      return {
        ok: true,
        kind: 'text',
        blob: textBlob,
        mimeType: 'text/plain;charset=utf-8',
        fileName: options.fileName || 'document.txt',
        plainText: options.fallbackText,
        source: 'local',
        sizeBytes: textBlob.size,
      };
    }
    return rawRes;
  }

  const effectiveName = rawRes.fileName || options.fileName || 'document';
  const effectiveMime = (rawRes.mimeType || options.mimeType || rawRes.blob.type || '').toLowerCase();
  const ab = await rawRes.blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const normPdf = normalizePdfBytes(bytes);
  const looksLikePdf =
    normPdf.valid ||
    isPdfAttachment(effectiveName, effectiveMime);

  if (normPdf.valid) {
    return {
      ok: true,
      kind: 'pdf',
      data: normPdf.bytes,
      blob: normPdf.blob,
      mimeType: 'application/pdf',
      fileName: effectiveName,
      source: rawRes.source,
      sizeBytes: normPdf.bytes.byteLength,
    };
  }

  if (looksLikePdf) {
    return {
      ok: false,
      errorCode: 'INVALID_PDF',
      message:
        'الرابط أو الملف المرفق لا يحمل ترويسة PDF صالحة (قد يكون صفحة ويب خارجية). يمكنك فتحه في نافذة جديدة.',
      fallbackUrl: options.downloadUrl,
    };
  }

  const lowerName = effectiveName.toLowerCase();
  if (effectiveMime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lowerName)) {
    return {
      ok: true,
      kind: 'image',
      blob: rawRes.blob,
      mimeType: effectiveMime || 'image/png',
      fileName: effectiveName,
      source: rawRes.source,
      sizeBytes: rawRes.blob.size,
    };
  }

  if (lowerName.endsWith('.docx') || effectiveMime.includes('wordprocessingml')) {
    try {
      const mRes = await mammoth.convertToHtml({ arrayBuffer: ab });
      const html = ensureRichHtml(mRes.value || '');
      const plainText = richHtmlToPlainText(html);
      return {
        ok: true,
        kind: 'docx',
        blob: rawRes.blob,
        mimeType: effectiveMime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: effectiveName,
        html,
        plainText,
        source: rawRes.source,
        sizeBytes: rawRes.blob.size,
      };
    } catch {
      // Fallback to text extraction below
    }
  }

  const textStr = await rawRes.blob.text();
  return {
    ok: true,
    kind: 'text',
    blob: rawRes.blob,
    mimeType: effectiveMime || 'text/plain;charset=utf-8',
    fileName: effectiveName,
    plainText: textStr || options.fallbackText || '',
    source: rawRes.source,
    sizeBytes: rawRes.blob.size,
  };
}

export async function downloadResourceAttachment(options: {
  resourceId?: string;
  fileName: string;
  storagePath?: string;
  downloadUrl?: string;
}): Promise<boolean> {
  const triggerBlobDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.fileName || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const rawRes = await fetchRawAttachmentBlob({
    resourceId: options.resourceId,
    storagePath: options.storagePath,
    downloadUrl: options.downloadUrl,
  });
  if (rawRes.ok) {
    triggerBlobDownload(rawRes.blob);
    return true;
  }

  if (options.downloadUrl) {
    const a = document.createElement('a');
    a.href = options.downloadUrl;
    a.download = options.fileName || 'document';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  return false;
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
