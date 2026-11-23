import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Calendar,
  CheckSquare,
  Download,
  ExternalLink,
  Eye,
  FileUp,
  Globe,
  ListTodo,
  Lock,
  Plus,
  RefreshCw,
  Repeat,
  Square,
  Trash2,
} from 'lucide-react';
import {
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthPlan,
  PersonalCourse,
  PracticalProject,
  READING_MODES_META,
  ReadingItemStatus,
  ReadingItemType,
  ReadingLibraryItem,
  ReadingMode,
  ReadingModeMeta,
  UnifiedTask,
  getHubMeta,
  getTodayDateKey,
  sortReadingItemsList,
} from '../data/curriculumData';
import { auth } from '../firebase';
import { formatSupabaseErrorMessage } from '../services/supabaseClient';
import { CloudAttachmentItem } from '../services/supabaseSync';
import {
  downloadResourceAttachmentResult,
  isPdfAttachment,
  isViewableDocumentAttachment,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import LearningObjectivesPanel from './LearningObjectivesPanel';
import type { ActivePdfTarget } from './PDFViewerModal';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
import TaskFormModal from './TaskFormModal';

interface LibraryViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  items: ReadingLibraryItem[];
  cloudAttachments?: CloudAttachmentItem[];
  courses?: PersonalCourse[];
  learningPaths?: LearningPath[];
  projects?: PracticalProject[];
  unifiedTasks?: UnifiedTask[];
  months?: MonthPlan[];
  hubCategories: Record<LearningHubId, string[]>;
  activeHubFilter: LearningHubId | 'all';
  onChangeHubFilter: (hub: LearningHubId | 'all') => void;
  onAddItem: (item: Omit<ReadingLibraryItem, 'id'>) => void;
  onUpdateItem: (id: string, updates: Partial<ReadingLibraryItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddUnifiedTask?: (payload: Omit<UnifiedTask, 'id'>) => void;
  onUpdateUnifiedTask?: (id: string, updates: Partial<UnifiedTask>) => void;
  onDeleteUnifiedTask?: (taskId: string) => void;
  onOpenCalendar?: () => void;
  onOpenTasksTab?: () => void;
  onOpenPdf: (target: ActivePdfTarget) => void;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
}

const STATUS_AR: Record<ReadingItemStatus, string> = {
  to_read: 'للقراءة',
  reading: 'أقرؤه حاليًا',
  completed: 'مكتمل',
};

export default function LibraryView({
  uid,
  canEdit,
  onRequireAuth,
  items,
  courses = [],
  learningPaths = [],
  projects = [],
  unifiedTasks = [],
  hubCategories,
  activeHubFilter,
  onChangeHubFilter,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAddUnifiedTask,
  onUpdateUnifiedTask,
  onDeleteUnifiedTask,
  onOpenCalendar,
  onOpenTasksTab,
  onOpenPdf,
  customReadingModes,
  onUpdateReadingModes,
}: LibraryViewProps) {
  const readingModesList =
    customReadingModes && customReadingModes.length > 0
      ? customReadingModes
      : READING_MODES_META;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<ReadingMode | 'all'>('all');
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [onlyDueToday, setOnlyDueToday] = useState(false);
  const [sortMode, setSortMode] = useState<'manual' | 'stage' | 'title'>('manual');
  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    initialTask: UnifiedTask | null;
    prefill?: Partial<UnifiedTask>;
  }>({ open: false, initialTask: null });

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [hubId, setHubId] = useState<LearningHubId>(
    activeHubFilter === 'all' ? 'knowledge' : activeHubFilter
  );
  const [categoryLabel, setCategoryLabel] = useState('');
  const [itemType, setItemType] = useState<ReadingItemType>('كتاب');
  const [totalPages, setTotalPages] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [takeaways, setTakeaways] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [lastPickedFile, setLastPickedFile] = useState<File | null>(null);
  const [lastReplaceTarget, setLastReplaceTarget] = useState<{
    file: File;
    itemId: string;
  } | null>(null);
  const [pendingResId, setPendingResId] = useState('');
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingStoragePath, setPendingStoragePath] = useState<string | undefined>();
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<ReadingLibraryItem | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const replaceFileRef = useRef<HTMLInputElement | null>(null);

  const today = getTodayDateKey();

  const filteredItems = useMemo(() => {
    const base = items.filter((item) => {
      if (activeHubFilter !== 'all' && item.hubId !== activeHubFilter) {
        return false;
      }
      if (modeFilter !== 'all' && !(item.readingModes ?? []).includes(modeFilter)) {
        return false;
      }
      if (
        onlyRepeated &&
        (item.reviewCount ?? 0) < 2 &&
        (item.listenCount ?? 0) < 2
      ) {
        return false;
      }
      if (
        onlyDueToday &&
        (!item.nextReviewDateKey || item.nextReviewDateKey > today)
      ) {
        return false;
      }
      return true;
    });
    return sortReadingItemsList(base, sortMode);
  }, [items, activeHubFilter, modeFilter, onlyRepeated, onlyDueToday, today, sortMode]);

  const handleMoveItemOrder = (itemId: string, dir: -1 | 1) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const idx = filteredItems.findIndex((i) => i.id === itemId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= filteredItems.length) return;
    const reordered = [...filteredItems];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    reordered.forEach((it, pos) => {
      const nextOrder = pos + 1;
      if ((it.sortOrder ?? 0) !== nextOrder) {
        onUpdateItem(it.id, { sortOrder: nextOrder });
      }
    });
  };

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const performPickUpload = async (file: File) => {
    setLastPickedFile(file);
    setUploadingFile(true);
    setUploadProgressPct(0);
    setUploadStatusMsg(null);
    try {
      const resId = `lib-res-${Date.now()}`;
      const effectiveUid = uid || auth?.currentUser?.uid;
      const uploaded = await uploadResourceAttachment(
        effectiveUid,
        resId,
        file,
        undefined,
        (pct) => setUploadProgressPct(pct)
      );
      setPendingResId(resId);
      setPendingFileName(file.name);
      setPendingStoragePath(uploaded.storagePath);
      setPendingDownloadUrl(uploaded.downloadUrl);
      if (!title.trim()) {
        setTitle(
          file.name.replace(/\.(pdf|docx|doc|txt|md|markdown)$/i, '').trim()
        );
      }
      if (isPdfAttachment(file.name, file.type)) {
        setItemType('ملف PDF');
      }
      if (uploaded.uploadedToCloud) {
        setLastPickedFile(null);
        setUploadStatusMsg({
          ok: true,
          text: 'تم رفع الملف ومزامنته سحابيًا ليفتح على الهاتف واللابتوب معًا.',
        });
      } else {
        setUploadStatusMsg({
          ok: false,
          text:
            uploaded.errorMessage ||
            'تعذر رفع الملف للسحابة وتم حفظه محليًا فقط على هذا الجهاز.',
        });
      }
    } catch (err) {
      setUploadStatusMsg({
        ok: false,
        text: formatSupabaseErrorMessage(
          err,
          'تعذر رفع الملف للسحابة. يمكنك إعادة المحاولة الآن.'
        ),
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handlePickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await performPickUpload(file);
  };

  const performReplaceUpload = async (file: File, item: ReadingLibraryItem) => {
    setLastReplaceTarget({ file, itemId: item.id });
    setUploadingFile(true);
    setUploadProgressPct(0);
    setDownloadError(null);
    try {
      const resId = item.attachmentResourceId || `lib-res-${Date.now()}`;
      const effectiveUid = uid || auth?.currentUser?.uid;
      const uploaded = await uploadResourceAttachment(
        effectiveUid,
        resId,
        file,
        undefined,
        (pct) => setUploadProgressPct(pct)
      );
      onUpdateItem(item.id, {
        attachmentName: file.name,
        attachmentResourceId: resId,
        storagePath: uploaded.storagePath,
        downloadUrl: uploaded.downloadUrl,
        ...(isPdfAttachment(file.name, file.type)
          ? { itemType: 'ملف PDF' as ReadingItemType }
          : {}),
      });
      if (uploaded.uploadedToCloud) {
        setLastReplaceTarget(null);
      } else {
        setDownloadError(
          uploaded.errorMessage ||
            'تم ربط الملف محليًا فقط، تعذر رفعه للسحابة. جرّب إعادة المحاولة.'
        );
      }
    } catch (err) {
      setDownloadError(
        formatSupabaseErrorMessage(
          err,
          'تعذر رفع الملف للسحابة. يمكنك إعادة المحاولة.'
        )
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleReplaceSelectedItemPdf = async (
    e: React.ChangeEvent<HTMLInputElement>,
    item: ReadingLibraryItem
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    await performReplaceUpload(file, item);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    onAddItem({
      title: cleanTitle,
      author: author.trim(),
      hubId,
      categoryLabel: categoryLabel.trim(),
      itemType,
      status: 'to_read',
      currentPage: 0,
      totalPages: Math.max(0, parseInt(totalPages, 10) || 0),
      takeaways: takeaways.trim(),
      attachmentName: pendingFileName || undefined,
      attachmentResourceId: pendingResId || undefined,
      storagePath: pendingStoragePath,
      downloadUrl: pendingDownloadUrl,
      externalUrl: externalUrl.trim() || undefined,
      readingModes: [],
      learningMethods: [],
      reviewCount: 0,
      listenCount: 0,
      repetitionStage: 0,
      nextReviewDateKey: '',
      lastReviewedDateKey: '',
      updatedAtLabel: new Date().toLocaleDateString('ar-EG'),
    });

    setTitle('');
    setAuthor('');
    setCategoryLabel('');
    setTotalPages('');
    setExternalUrl('');
    setTakeaways('');
    setPendingResId('');
    setPendingFileName('');
    setPendingStoragePath(undefined);
    setPendingDownloadUrl(undefined);
    setUploadStatusMsg(null);
    setShowAddForm(false);
  };

  // Dedicated Single Library Item View
  if (selectedItem) {
    const hubMeta = getHubMeta(selectedItem.hubId);
    const hasAttachedFile =
      Boolean(selectedItem.attachmentName) ||
      Boolean(selectedItem.downloadUrl) ||
      Boolean(selectedItem.storagePath);
    const isPdf =
      isPdfAttachment(selectedItem.attachmentName) ||
      (!selectedItem.attachmentName &&
        Boolean(selectedItem.downloadUrl || selectedItem.storagePath) &&
        selectedItem.itemType === 'ملف PDF');
    const isViewable =
      hasAttachedFile &&
      (isPdf ||
        isViewableDocumentAttachment(selectedItem.attachmentName) ||
        Boolean(selectedItem.attachmentResourceId));
    const resolvedUid = uid || auth?.currentUser?.uid;
    const linkedBookTasks = unifiedTasks.filter(
      (ut) =>
        ut.linkedBookId === selectedItem.id ||
        ut.projectId === `book:${selectedItem.id}` ||
        ut.projectId?.startsWith(`book:${selectedItem.id}:`)
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedItemId(null)}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>العودة إلى مكتبة القراءة والملفات</span>
          </button>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateItem(selectedItem.id, {
                    isPublic: !selectedItem.isPublic,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold rounded-lg border cursor-pointer ${
                  selectedItem.isPublic
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {selectedItem.isPublic ? (
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {selectedItem.isPublic ? 'منشور في الموقع العام' : 'مادة خاصة'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(selectedItem)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حذف المادة</span>
              </button>
            </div>
          )}
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-2.5 py-0.5 font-semibold border rounded-md ${hubMeta.badgeClass}`}
                >
                  {hubMeta.title}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                  {selectedItem.itemType}
                </span>
                {selectedItem.categoryLabel && (
                  <span className="text-slate-600">· {selectedItem.categoryLabel}</span>
                )}
              </div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                {selectedItem.title}
              </h1>
              {selectedItem.author && (
                <p className="text-sm text-slate-600">
                  المؤلف / المصدر: {selectedItem.author}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {hasAttachedFile && isViewable && (
                <button
                  type="button"
                  onClick={() => {
                    setDownloadError(null);
                    onOpenPdf({
                      uid: resolvedUid,
                      title: selectedItem.title,
                      fileName:
                        selectedItem.attachmentName ||
                        `${selectedItem.title}.pdf`,
                      resourceId: selectedItem.attachmentResourceId,
                      storagePath: selectedItem.storagePath,
                      downloadUrl: selectedItem.downloadUrl,
                      extractedPreview: selectedItem.takeaways || undefined,
                      contextLabel: `مكتبة القراءة · ${hubMeta.title}`,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isPdf
                      ? 'فتح وقراءة PDF داخل المنصة'
                      : 'فتح وقراءة المستند داخل المنصة'}
                  </span>
                </button>
              )}
              {hasAttachedFile && (
                <button
                  type="button"
                  onClick={async () => {
                    setDownloadError(null);
                    const result = await downloadResourceAttachmentResult({
                      uid: resolvedUid,
                      resourceId: selectedItem.attachmentResourceId,
                      fileName:
                        selectedItem.attachmentName ||
                        `${selectedItem.title}.pdf`,
                      storagePath: selectedItem.storagePath,
                      downloadUrl: selectedItem.downloadUrl,
                    });
                    if (!result.ok && result.errorMessage) {
                      setDownloadError(result.errorMessage);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isPdf ? 'تنزيل PDF' : 'تنزيل الملف'}</span>
                </button>
              )}
              {canEdit && (
                <>
                  <input
                    ref={replaceFileRef}
                    type="file"
                    accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.txt,text/plain,.md,.markdown"
                    className="hidden"
                    onChange={(e) =>
                      void handleReplaceSelectedItemPdf(e, selectedItem)
                    }
                  />
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={() => replaceFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-[#1E3A5F] bg-slate-50 border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {uploadingFile
                        ? `جاري الرفع ${uploadProgressPct}%...`
                        : hasAttachedFile
                        ? 'تحديث / استبدال الملف'
                        : 'إرفاق PDF / ملف (حتى 100 ميجا)'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {downloadError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
              <span>{downloadError}</span>
              <div className="flex items-center gap-2">
                {lastReplaceTarget && lastReplaceTarget.itemId === selectedItem.id && (
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={() =>
                      void performReplaceUpload(lastReplaceTarget.file, selectedItem)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-semibold rounded cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    <span>إعادة المحاولة</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDownloadError(null)}
                  className="text-amber-700 hover:text-amber-950 font-semibold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}

          <LearningObjectivesPanel
            objectives={selectedItem.learningObjectives}
            canEdit={canEdit}
            onChange={(next) =>
              onUpdateItem(selectedItem.id, { learningObjectives: next })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block text-xs font-medium text-slate-700">
              حالة القراءة
              <select
                disabled={!canEdit}
                value={selectedItem.status}
                onChange={(e) =>
                  onUpdateItem(selectedItem.id, {
                    status: e.target.value as ReadingItemStatus,
                  })
                }
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="to_read">للقراءة</option>
                <option value="reading">أقرؤه حاليًا</option>
                <option value="completed">مكتمل</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              الصفحة الحالية (اختياري)
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={selectedItem.currentPage}
                onChange={(e) =>
                  onUpdateItem(selectedItem.id, {
                    currentPage: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              إجمالي الصفحات (اختياري)
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={selectedItem.totalPages}
                onChange={(e) =>
                  onUpdateItem(selectedItem.id, {
                    totalPages: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            أهم الأفكار والملخصات (اختياري)
            <textarea
              rows={5}
              readOnly={!canEdit}
              value={selectedItem.takeaways}
              onChange={(e) =>
                onUpdateItem(selectedItem.id, { takeaways: e.target.value })
              }
              placeholder="دوّن خلاصة ما استوعبته أو نقاط التطبيق..."
              className="mt-1.5 w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl leading-relaxed"
            />
          </label>

          <SpacedRepetitionPanel
            canEdit={canEdit}
            value={selectedItem}
            onChange={(updates) => onUpdateItem(selectedItem.id, updates)}
            customReadingModes={customReadingModes}
            onUpdateReadingModes={onUpdateReadingModes}
          />

          {/* Linked Unified Tasks for this Book / Library Material */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>المهام وجدولة القراءة المرتبطة ({linkedBookTasks.length})</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {canEdit && onAddUnifiedTask && (
                  <button
                    type="button"
                    onClick={() =>
                      setTaskModalState({
                        open: true,
                        initialTask: null,
                        prefill: {
                          hubId: selectedItem.hubId,
                          linkedBookId: selectedItem.id,
                          linkedLabel: selectedItem.title,
                          projectId: `book:${selectedItem.id}`,
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إنشاء مهمة مرتبطة بالكتاب</span>
                  </button>
                )}
                {onOpenTasksTab && (
                  <button
                    type="button"
                    onClick={onOpenTasksTab}
                    className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    كل المهام ←
                  </button>
                )}
                {onOpenCalendar && (
                  <button
                    type="button"
                    onClick={onOpenCalendar}
                    className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    التقويم ←
                  </button>
                )}
              </div>
            </div>

            {linkedBookTasks.length === 0 ? (
              <p className="text-xs text-slate-500">
                لا توجد مهام مجدولة لهذا الكتاب أو الملف بعد.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {linkedBookTasks.map((ut) => {
                  const isDone = ut.status === 'done';
                  return (
                    <div
                      key={ut.id}
                      className="px-3.5 py-2.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        disabled={!canEdit || !onUpdateUnifiedTask}
                        onClick={() =>
                          onUpdateUnifiedTask?.(ut.id, {
                            status: isDone ? 'todo' : 'done',
                          })
                        }
                        className="flex items-start gap-2.5 text-right flex-1 min-w-0 cursor-pointer disabled:opacity-60"
                      >
                        {isDone ? (
                          <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                        <span
                          className={`text-xs leading-relaxed break-words min-w-0 ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                          }`}
                        >
                          {ut.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 pr-6 sm:pr-0 shrink-0">
                        {(ut.scheduledDate || ut.dueDate) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#1E3A5F] font-medium tabular-nums">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            {ut.scheduledDate || ut.dueDate}
                            {ut.startTime ? ` · ${ut.startTime}` : ''}
                          </span>
                        )}
                        {canEdit && onUpdateUnifiedTask && (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskModalState({
                                open: true,
                                initialTask: ut,
                              })
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            تعديل
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          title="تأكيد حذف المادة"
          message={`هل تريد حذف «${confirmDelete?.title ?? ''}» من مكتبة القراءة؟`}
          onConfirm={() => {
            if (confirmDelete) {
              onDeleteItem(confirmDelete.id);
              setConfirmDelete(null);
              setSelectedItemId(null);
            }
          }}
          onCancel={() => setConfirmDelete(null)}
        />

        <TaskFormModal
          open={taskModalState.open}
          onClose={() => setTaskModalState({ open: false, initialTask: null })}
          initialTask={taskModalState.initialTask}
          prefill={taskModalState.prefill}
          courses={courses}
          learningPaths={learningPaths}
          readingItems={items}
          projects={projects}
          hubCategories={hubCategories}
          onSubmit={(payload, existingId) => {
            if (existingId && onUpdateUnifiedTask) {
              onUpdateUnifiedTask(existingId, payload);
            } else if (onAddUnifiedTask) {
              onAddUnifiedTask(payload);
            }
          }}
          onDelete={onDeleteUnifiedTask}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            مكتبة القراءة والـ PDF · التكرار المتباعد وأنماط القراءة الخمسة
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            مكتبة القراءة والمعرفة الموحدة ({items.length})
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            اجمع كتبك ومقالاتك وملفات الـ PDF عبر الماركتينج والدنتال والثقافة، واقرأ الـ PDF مباشرة داخل المنصة مع متابعة أنماط القراءة والتكرار المتباعد.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canEdit) {
              onRequireAuth();
              return;
            }
            setShowAddForm((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showAddForm ? 'إلغاء' : 'إضافة كتاب / ملف PDF'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeHubFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
              activeHubFilter === 'all'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            الكل ({items.length})
          </button>
          {LEARNING_HUBS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onChangeHubFilter(h.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                activeHubFilter === h.id
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {h.shortTitle} ({items.filter((i) => i.hubId === h.id).length})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              فلترة بنمط القراءة والتكرار:
            </span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as ReadingMode | 'all')}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="all">كل أنماط القراءة</option>
              {readingModesList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOnlyDueToday((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                onlyDueToday
                  ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              مستحق للمراجعة اليوم
            </button>
            <button
              type="button"
              onClick={() => setOnlyRepeated((v) => !v)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                onlyRepeated
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              <span>مكرر / مسموع أكثر من مرة</span>
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>الترتيب:</span>
            <select
              value={sortMode}
              onChange={(e) =>
                setSortMode(e.target.value as 'manual' | 'stage' | 'title')
              }
              className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="manual">يدوي (الترتيب الشخصي)</option>
              <option value="stage">حالة القراءة</option>
              <option value="title">أبجدي / رقمي</option>
            </select>
          </label>
        </div>
      </div>

      {showAddForm && canEdit && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            إضافة مادة قراءة أو ملف PDF جديد
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-slate-700">
              العنوان (مطلوب)
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="اسم الكتاب، المقال، البحث أو ملف الـ PDF..."
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              المؤلف / المصدر (اختياري)
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="اسم المؤلف أو الجهة..."
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              المجال الكبير (Hub)
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value as LearningHubId)}
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              >
                {LEARNING_HUBS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              التصنيف الفرعي (اختياري)
              <input
                type="text"
                list="lib-cats"
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                placeholder="اختر أو اكتب..."
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
              <datalist id="lib-cats">
                {(hubCategories[hubId] ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              النوع
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ReadingItemType)}
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="كتاب">كتاب</option>
                <option value="ملف PDF">ملف PDF</option>
                <option value="مقال">مقال</option>
                <option value="بحث">بحث</option>
                <option value="ورقة علمية">ورقة علمية</option>
                <option value="ملخص">ملخص</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              عدد الصفحات (اختياري)
              <input
                type="number"
                min={0}
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                placeholder="0"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword,.txt,text/plain,.md,.markdown"
              className="hidden"
              onChange={(e) => void handlePickPdf(e)}
            />
            <button
              type="button"
              disabled={uploadingFile}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#1E3A5F] bg-slate-50 border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <FileUp className="w-4 h-4" aria-hidden="true" />
              <span>
                {uploadingFile
                  ? `جاري رفع الملف للسحابة (${uploadProgressPct}%)...`
                  : pendingFileName
                  ? `تم إرفاق: ${pendingFileName}`
                  : 'رفع PDF / Word حتى 100 ميجا (اختياري)'}
              </span>
            </button>

            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="أو رابط خارجي (اختياري)..."
              className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          {uploadStatusMsg && (
            <div
              className={`text-xs px-3 py-2 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${
                uploadStatusMsg.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span>{uploadStatusMsg.text}</span>
              {!uploadStatusMsg.ok && lastPickedFile && (
                <button
                  type="button"
                  disabled={uploadingFile}
                  onClick={() => void performPickUpload(lastPickedFile)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-semibold rounded cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
            </div>
          )}

          <label className="block text-xs font-medium text-slate-700">
            ملاحظات مبدئية (اختياري)
            <textarea
              rows={2}
              value={takeaways}
              onChange={(e) => setTakeaways(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploadingFile}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer disabled:opacity-50"
            >
              حفظ المادة
            </button>
          </div>
        </form>
      )}

      {filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            لا توجد مواد مطابقة للفلترة الحالية
          </p>
          <p className="text-xs text-slate-500">
            يمكنك إضافة كتب أو ملفات PDF وتحديد أنماط القراءة الخمسة وجدولة التكرار المتباعد.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item, itemIdx) => {
            const hubMeta = getHubMeta(item.hubId);
            const hasAttachedFile =
              Boolean(item.attachmentName) ||
              Boolean(item.downloadUrl) ||
              Boolean(item.storagePath);
            const isPdf =
              isPdfAttachment(item.attachmentName) ||
              (!item.attachmentName &&
                Boolean(item.downloadUrl || item.storagePath) &&
                item.itemType === 'ملف PDF');
            const isViewable =
              hasAttachedFile &&
              (isPdf ||
                isViewableDocumentAttachment(item.attachmentName) ||
                Boolean(item.attachmentResourceId));
            const due = Boolean(item.nextReviewDateKey && item.nextReviewDateKey <= today);
            const resolvedUid = uid || auth?.currentUser?.uid;

            return (
              <article
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <span
                      className={`px-2 py-0.5 font-semibold border rounded-md ${hubMeta.badgeClass}`}
                    >
                      {hubMeta.shortTitle}
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      {item.isPublic && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">
                          <Globe className="w-2.5 h-2.5" aria-hidden="true" />
                          عام
                        </span>
                      )}
                      <span>
                        {item.itemType} · {STATUS_AR[item.status]}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className="text-right block w-full cursor-pointer group"
                  >
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F]">
                      <BidiText text={item.title} />
                    </h2>
                  </button>

                  {item.author && (
                    <p className="text-xs text-slate-500">
                      <BidiText text={item.author} />
                    </p>
                  )}

                  {(item.readingModes?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.readingModes.map((m) => {
                        const meta = readingModesList.find((rm) => rm.id === m);
                        return (
                          <span
                            key={m}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-md"
                          >
                            {meta?.label ?? m}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {(due || item.listenCount >= 2 || item.reviewCount >= 2) && (
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {due && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-md font-semibold">
                          مراجعة اليوم
                        </span>
                      )}
                      {item.listenCount >= 2 && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-semibold">
                          مسموع {item.listenCount}×
                        </span>
                      )}
                      {item.reviewCount >= 2 && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-semibold">
                          مراجعة {item.reviewCount}×
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                    >
                      التفاصيل والتكرار ←
                    </button>
                    {isViewable && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPdf({
                            uid: resolvedUid,
                            title: item.title,
                            fileName:
                              item.attachmentName || `${item.title}.pdf`,
                            resourceId: item.attachmentResourceId,
                            storagePath: item.storagePath,
                            downloadUrl: item.downloadUrl,
                            extractedPreview: item.takeaways || undefined,
                            contextLabel: `مكتبة القراءة · ${hubMeta.shortTitle}`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                      >
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span>{isPdf ? 'فتح PDF' : 'فتح الملف'}</span>
                      </button>
                    )}
                    {!hasAttachedFile && item.externalUrl && (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-[#1E3A5F] hover:underline"
                        aria-label="فتح الرابط الخارجي"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {sortMode === 'manual' && (
                        <>
                          <button
                            type="button"
                            disabled={itemIdx === 0}
                            onClick={() => handleMoveItemOrder(item.id, -1)}
                            aria-label="تقديم المادة"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={itemIdx === filteredItems.length - 1}
                            onClick={() => handleMoveItemOrder(item.id, 1)}
                            aria-label="تأخير المادة"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(item)}
                        aria-label={`حذف ${item.title}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="تأكيد حذف المادة"
        message={`هل تريد حذف «${confirmDelete?.title ?? ''}» من مكتبة القراءة؟`}
        onConfirm={() => {
          if (confirmDelete) {
            onDeleteItem(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
