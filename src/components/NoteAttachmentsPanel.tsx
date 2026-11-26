import { useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  Eye,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { StudyResource } from '../data/curriculumData';
import {
  deleteCloudAttachment,
  downloadResourceAttachmentResult,
  inferMimeTypeFromFileName,
  isPdfAttachment,
  parseDocumentFile,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import type { ActivePdfTarget } from './PDFViewerModal';

interface NoteAttachmentsPanelProps {
  uid?: string;
  noteId: string;
  noteTitle: string;
  resources?: StudyResource[];
  canEdit: boolean;
  onRequireAuth: () => void;
  onUpdateResources: (nextResources: StudyResource[]) => void;
  onOpenPdf: (target: ActivePdfTarget) => void;
}

export default function NoteAttachmentsPanel({
  uid,
  noteId,
  noteTitle,
  resources = [],
  canEdit,
  onRequireAuth,
  onUpdateResources,
  onOpenPdf,
}: NoteAttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [lastPendingFile, setLastPendingFile] = useState<File | null>(null);

  const performUpload = async (file: File) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    setErrorMessage(null);
    setActionNotice(null);
    setLastPendingFile(file);

    try {
      const resourceId = `note-${noteId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const mimeType = inferMimeTypeFromFileName(file.name, file.type);

      let extractedPreview = '';
      try {
        if (!isPdfAttachment(file.name, mimeType)) {
          const parsed = await parseDocumentFile(file);
          extractedPreview = parsed.html.slice(0, 8000);
        }
      } catch {
        // Optional preview parse failure does not block binary upload
      }

      const uploaded = await uploadResourceAttachment(
        uid,
        resourceId,
        file,
        extractedPreview,
        (pct) => setUploadProgress(pct),
        'note_attachment'
      );

      const newRes: StudyResource = {
        id: resourceId,
        title: file.name.replace(/\.[^.]+$/, '') || file.name,
        type: 'ملف / مستند',
        note: '',
        searchQuery: file.name,
        attachmentName: file.name,
        mimeType: uploaded.mimeType || mimeType,
        sizeBytes: uploaded.sizeBytes ?? file.size,
        storagePath: uploaded.storagePath,
        storageProvider: uploaded.storageProvider,
        downloadUrl: uploaded.downloadUrl,
        extractedPreview: extractedPreview || undefined,
      };

      onUpdateResources([...resources, newRes]);
      setLastPendingFile(null);
      if (!uploaded.uploadedToCloud && uploaded.errorMessage) {
        setActionNotice(uploaded.errorMessage);
      } else {
        setActionNotice('تم حفظ المرفق وربطه بهذه الملاحظة فقط.');
      }
    } catch (err) {
      console.error('Note attachment upload error:', err);
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'تعذّر رفع الملف. تأكد من الاتصال وحاول مجددًا.'
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await performUpload(file);
  };

  const handleDownload = async (res: StudyResource) => {
    setErrorMessage(null);
    const result = await downloadResourceAttachmentResult({
      uid,
      resourceId: res.id,
      fileName: res.attachmentName || res.title,
      mimeType: res.mimeType,
      storagePath: res.storagePath,
      storageProvider: res.storageProvider,
      downloadUrl: res.downloadUrl,
    });
    if (!result.ok && result.errorMessage) {
      setErrorMessage(result.errorMessage);
    }
  };

  const handleDelete = async (res: StudyResource) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setErrorMessage(null);
    onUpdateResources(resources.filter((item) => item.id !== res.id));
    await deleteCloudAttachment(uid, res.id, res.storagePath, res.storageProvider);
  };

  return (
    <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              مرفقات هذه الملاحظة فقط
            </h4>
            <p className="text-[11px] text-slate-500">
              ملفات PDF أو Word أو نصية خاصة بهذه الملاحظة دون مشاركة ملفات الكورس الرئيسية.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.markdown"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {uploading ? `جاري الرفع (${uploadProgress}%)` : 'إرفاق PDF / مستند'}
              </span>
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          {lastPendingFile && canEdit && (
            <button
              type="button"
              onClick={() => void performUpload(lastPendingFile)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-300 text-red-800 rounded-md font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>إعادة المحاولة</span>
            </button>
          )}
        </div>
      )}

      {actionNotice && !errorMessage && (
        <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
          {actionNotice}
        </div>
      )}

      {resources.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          لا توجد ملفات مرفقة بهذه الملاحظة بعد.
        </p>
      ) : (
        <div className="space-y-2">
          {resources.map((res) => (
            <div
              key={res.id}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {res.title || res.attachmentName || 'مستند مرفق'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {res.attachmentName || res.type}
                    {res.sizeBytes
                      ? ` · ${Math.max(1, Math.round(res.sizeBytes / 1024))} ك.ب`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onOpenPdf({
                      title: res.title || res.attachmentName || 'مستند مرفق',
                      fileName: res.attachmentName || res.title || 'document.pdf',
                      resourceId: res.id,
                      storagePath: res.storagePath,
                      storageProvider: res.storageProvider,
                      downloadUrl: res.downloadUrl,
                      mimeType: res.mimeType,
                      extractedPreview: res.extractedPreview,
                      contextLabel: noteTitle,
                      uid,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>فتح</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload(res)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تنزيل</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(res)}
                    aria-label="حذف المرفق"
                    className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
