import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  Globe,
  ImagePlus,
  Layers,
  Plus,
  RefreshCw,
  Repeat,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  BookNote,
  DEFAULT_BOOK_COVER_FRAME,
  DEFAULT_USER_PREFERENCES,
  ImageFrameSpec,
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
  UserPreferences,
  getHubMeta,
  getTodayDateKey,
  sortReadingItemsList,
} from '../data/curriculumData';
import { auth } from '../firebase';
import { formatSupabaseErrorMessage } from '../services/supabaseClient';
import type { StorageProvider } from '../services/storageService';
import { CloudAttachmentItem } from '../services/supabaseSync';
import {
  deleteCloudAttachment,
  isPdfAttachment,
  isViewableDocumentAttachment,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import {
  isImageFile,
  removeBookCoverStorage,
  uploadBookCoverImage,
} from '../utils/imageStorage';
import { richHtmlToPlainText } from '../utils/richText';
import BidiText from './BidiText';
import BookWorkspaceModal from './BookWorkspaceModal';
import ConfirmDialog from './ConfirmDialog';
import { FramedImage, ImageFrameEditorModal } from './FramedImage';
import type { ActivePdfTarget } from './PDFViewerModal';

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
  bookNotes?: BookNote[];
  preferences?: UserPreferences;
  onUpdatePreferences?: (updates: Partial<UserPreferences>) => void;
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
  onOpenBookNote?: (noteId: string) => void;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
}

const STATUS_AR: Record<ReadingItemStatus, string> = {
  to_read: 'للقراءة',
  reading: 'أقرؤه حاليًا',
  completed: 'مكتمل',
};

function getHubCoverTheme(hubId: LearningHubId): {
  stageBg: string;
  placeholderBg: string;
  spineBorder: string;
  accentText: string;
} {
  if (hubId === 'marketing') {
    return {
      stageBg: 'bg-amber-50/45',
      placeholderBg: 'bg-gradient-to-br from-amber-50 via-white to-amber-100/70',
      spineBorder: 'border-r-amber-700',
      accentText: 'text-amber-900',
    };
  }
  if (hubId === 'dental_career') {
    return {
      stageBg: 'bg-emerald-50/45',
      placeholderBg: 'bg-gradient-to-br from-emerald-50 via-white to-teal-100/70',
      spineBorder: 'border-r-emerald-700',
      accentText: 'text-emerald-900',
    };
  }
  return {
    stageBg: 'bg-slate-100/60',
    placeholderBg: 'bg-gradient-to-br from-[#F7F4EC] via-white to-slate-100',
    spineBorder: 'border-r-[#1E3A5F]',
    accentText: 'text-[#1E3A5F]',
  };
}

function normalizeExternalHref(raw?: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export default function LibraryView({
  uid,
  canEdit,
  onRequireAuth,
  items,
  courses = [],
  learningPaths = [],
  projects = [],
  unifiedTasks = [],
  bookNotes = [],
  preferences = DEFAULT_USER_PREFERENCES,
  onUpdatePreferences,
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
  onOpenBookNote,
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

  // Pending Cover Upload on Add Form
  const [pendingCoverUrl, setPendingCoverUrl] = useState('');
  const [pendingCoverStoragePath, setPendingCoverStoragePath] = useState<
    string | undefined
  >();
  const [pendingCoverStorageProvider, setPendingCoverStorageProvider] =
    useState<StorageProvider | undefined>();
  const [pendingCoverFrame, setPendingCoverFrame] = useState<ImageFrameSpec>(
    DEFAULT_BOOK_COVER_FRAME
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [coverFrameEditorOpen, setCoverFrameEditorOpen] = useState(false);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  // Pending PDF/Doc Upload on Add Form
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [lastPickedFile, setLastPickedFile] = useState<File | null>(null);
  const [pendingResId, setPendingResId] = useState('');
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingStoragePath, setPendingStoragePath] = useState<string | undefined>();
  const [pendingStorageProvider, setPendingStorageProvider] = useState<
    StorageProvider | undefined
  >();
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<ReadingLibraryItem | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const today = getTodayDateKey();
  const resolvedUid = uid || auth?.currentUser?.uid;

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

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

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

  const handlePickAddCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isImageFile(file)) {
      setCoverUploadError('يرجى اختيار ملف صورة صالح للغلاف.');
      return;
    }
    setUploadingCover(true);
    setCoverUploadError(null);
    try {
      const tempId = `new_${Date.now()}`;
      const res = await uploadBookCoverImage(tempId, file, resolvedUid);
      setPendingCoverUrl(res.imageUrl || res.localObjectUrl);
      setPendingCoverStoragePath(res.imageStoragePath || undefined);
      setPendingCoverStorageProvider(res.coverStorageProvider);
      setPendingCoverFrame(DEFAULT_BOOK_COVER_FRAME);
      setCoverFrameEditorOpen(true);
    } catch (err) {
      setCoverUploadError(
        formatSupabaseErrorMessage(
          err,
          'تعذر رفع صورة الغلاف. حاول مرة أخرى.'
        )
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const performPickUpload = async (file: File) => {
    setLastPickedFile(file);
    setUploadingFile(true);
    setUploadProgressPct(0);
    setUploadStatusMsg(null);
    try {
      const resId = `lib-res-${Date.now()}`;
      const uploaded = await uploadResourceAttachment(
        resolvedUid,
        resId,
        file,
        undefined,
        (pct) => setUploadProgressPct(pct),
        'library_book'
      );
      setPendingResId(resId);
      setPendingFileName(file.name);
      setPendingStoragePath(uploaded.uploadedToCloud ? uploaded.storagePath : undefined);
      setPendingStorageProvider(
        uploaded.uploadedToCloud ? uploaded.storageProvider : undefined
      );
      setPendingDownloadUrl(uploaded.uploadedToCloud ? uploaded.downloadUrl : undefined);
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
        const targetLabel =
          uploaded.storageProvider === 'r2' ? 'Cloudflare R2' : 'التخزين السحابي';
        setUploadStatusMsg({
          ok: true,
          text: `تم رفع الملف إلى ${targetLabel} ومزامنته ليفتح على الهاتف واللابتوب معًا.`,
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

  const handleRemovePendingAttachment = () => {
    const oldResId = pendingResId;
    const oldPath = pendingStoragePath;
    const oldProvider = pendingStorageProvider;
    const oldName = pendingFileName;
    setPendingResId('');
    setPendingFileName('');
    setPendingStoragePath(undefined);
    setPendingStorageProvider(undefined);
    setPendingDownloadUrl(undefined);
    setLastPickedFile(null);
    setUploadStatusMsg(null);
    if (itemType === 'ملف PDF') {
      setItemType(externalUrl.trim() ? 'مقال' : 'كتاب');
    }
    if (oldResId || oldPath || oldName) {
      void deleteCloudAttachment(resolvedUid, oldResId || undefined, oldPath, oldProvider, oldName || undefined);
    }
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
      coverImageUrl: pendingCoverUrl || undefined,
      coverStoragePath: pendingCoverStoragePath || undefined,
      coverStorageProvider: pendingCoverStorageProvider,
      coverFrame: pendingCoverUrl ? pendingCoverFrame : undefined,
      attachmentName: pendingFileName || undefined,
      attachmentResourceId: pendingResId || undefined,
      storagePath: pendingStoragePath,
      storageProvider: pendingStorageProvider,
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
    setPendingCoverUrl('');
    setPendingCoverStoragePath(undefined);
    setPendingCoverStorageProvider(undefined);
    setPendingCoverFrame(DEFAULT_BOOK_COVER_FRAME);
    setCoverUploadError(null);
    setPendingResId('');
    setPendingFileName('');
    setPendingStoragePath(undefined);
    setPendingStorageProvider(undefined);
    setPendingDownloadUrl(undefined);
    setUploadStatusMsg(null);
    setShowAddForm(false);
  };

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
            اجمع كتبك ومقالاتك وملفات الـ PDF، واضغط على أي كتاب لفتح مساحة القراءة والتدوين التفاعلية مع ملخصات الفصول والاقتباسات والتكرار المتباعد.
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

          {/* Book Cover Upload Picker */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-3">
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePickAddCover(e)}
            />
            {pendingCoverUrl ? (
              <div className="w-16 shrink-0">
                <FramedImage
                  srcUrl={pendingCoverUrl}
                  storagePath={pendingCoverStoragePath}
                  frame={{
                    ...pendingCoverFrame,
                    customHeightPx: undefined,
                    aspect: pendingCoverFrame.aspect || '3:4',
                  }}
                  defaultFrame={DEFAULT_BOOK_COVER_FRAME}
                  alt="معاينة غلاف الكتاب"
                  mode="card"
                  className="rounded-md ring-1 ring-black/10"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                disabled={uploadingCover}
                onClick={() => coverFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-60"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>
                  {uploadingCover
                    ? 'جاري رفع صورة الغلاف...'
                    : pendingCoverUrl
                    ? 'تغيير صورة الغلاف'
                    : 'إضافة صورة غلاف الكتاب (اختياري)'}
                </span>
              </button>
              {pendingCoverUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => setCoverFrameEditorOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تعديل إطار الغلاف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingCoverStoragePath) {
                        void removeBookCoverStorage(pendingCoverStoragePath);
                      }
                      setPendingCoverUrl('');
                      setPendingCoverStoragePath(undefined);
                    }}
                    className="px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    إزالة
                  </button>
                </>
              )}
            </div>
          </div>
          {coverUploadError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {coverUploadError}
            </p>
          )}

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
                  : 'رفع PDF / Word حتى 250 ميجا (اختياري)'}
              </span>
            </button>
            {pendingFileName && !uploadingFile && (
              <button
                type="button"
                onClick={handleRemovePendingAttachment}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إزالة الملف</span>
              </button>
            )}

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
              disabled={uploadingFile || uploadingCover}
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
            const coverTheme = getHubCoverTheme(item.hubId);
            const hasCover = Boolean(item.coverImageUrl || item.coverStoragePath);
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
            const safeExternalHref = normalizeExternalHref(item.externalUrl);
            const isDriveUrl = Boolean(
              safeExternalHref && /drive\.google\.com|docs\.google\.com/i.test(safeExternalHref)
            );
            const due = Boolean(item.nextReviewDateKey && item.nextReviewDateKey <= today);
            const progressPct =
              item.totalPages > 0
                ? Math.min(100, Math.round((item.currentPage / item.totalPages) * 100))
                : 0;
            const ws = item.workspaceData;
            const chaptersCount = ws?.chapters?.length ?? 0;
            const hasWorkspaceContent =
              Boolean(richHtmlToPlainText(ws?.notesHtml || item.takeaways || '')) ||
              Boolean(richHtmlToPlainText(ws?.insightsHtml || '')) ||
              Boolean(richHtmlToPlainText(ws?.quotesHtml || '')) ||
              chaptersCount > 0;

            return (
              <article
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className="group bg-white border border-slate-200 hover:border-[#1E3A5F]/45 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-all hover:shadow-sm"
              >
                {/* Book Cover / Placeholder Showcase Band */}
                <div
                  className={`relative h-52 sm:h-56 px-4 pt-10 pb-4 border-b border-slate-100 flex items-center justify-center ${coverTheme.stageBg}`}
                >
                  {/* Top floating meta badges */}
                  <div className="absolute top-2.5 inset-x-3 flex items-center justify-between gap-1.5 text-[11px] pointer-events-none">
                    <span
                      className={`px-2 py-0.5 font-semibold border rounded-md ${hubMeta.badgeClass}`}
                    >
                      {hubMeta.shortTitle}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.isPublic && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">
                          <Globe className="w-2.5 h-2.5" aria-hidden="true" />
                          عام
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          item.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : item.status === 'reading'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {STATUS_AR[item.status]}
                      </span>
                    </div>
                  </div>

                  {/* Book Cover Spine Sleeve */}
                  <div className="w-[114px] sm:w-[122px] shrink-0 transition-transform duration-200 group-hover:scale-[1.03]">
                    {hasCover ? (
                      <FramedImage
                        srcUrl={item.coverImageUrl}
                        storagePath={item.coverStoragePath}
                        frame={{
                          ...(item.coverFrame ?? DEFAULT_BOOK_COVER_FRAME),
                          customHeightPx: undefined,
                          aspect: item.coverFrame?.aspect || '3:4',
                        }}
                        defaultFrame={DEFAULT_BOOK_COVER_FRAME}
                        alt={item.title}
                        mode="card"
                        className="rounded-r-lg rounded-l-sm shadow-md ring-1 ring-black/10"
                      />
                    ) : (
                      <div
                        data-custom-card-surface="light"
                        className={`aspect-[3/4] w-full rounded-r-lg rounded-l-sm border border-slate-200 border-r-4 shadow-sm flex flex-col justify-between p-2.5 text-center ${coverTheme.placeholderBg} ${coverTheme.spineBorder}`}
                      >
                        <div className="flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-500">
                          <BookOpen className="w-3 h-3" aria-hidden="true" />
                          <span className="truncate">{item.itemType}</span>
                        </div>
                        <p
                          className={`font-editorial text-xs font-bold leading-snug line-clamp-3 ${coverTheme.accentText}`}
                        >
                          <BidiText text={item.title} />
                        </p>
                        <span className="text-[9px] text-slate-500 truncate">
                          {item.author || hubMeta.shortTitle}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Details & Actions */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-[#1E3A5F] line-clamp-2 leading-snug">
                        <BidiText text={item.title} />
                      </h2>
                      {item.author && (
                        <p className="text-xs text-slate-500 truncate">
                          <BidiText text={item.author} />
                        </p>
                      )}
                    </div>

                    {item.totalPages > 0 && (
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                          <span>
                            {item.currentPage} / {item.totalPages} ص
                          </span>
                          <span className="font-semibold text-[#1E3A5F]">
                            {progressPct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1E3A5F] transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(item.readingModes?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
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

                    {(due ||
                      item.listenCount >= 2 ||
                      item.reviewCount >= 2 ||
                      hasWorkspaceContent) && (
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
                        {chaptersCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                            <Layers className="w-2.5 h-2.5" aria-hidden="true" />
                            {chaptersCount} فصول
                          </span>
                        )}
                        {hasWorkspaceContent && chaptersCount === 0 && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                            <FileText className="w-2.5 h-2.5" aria-hidden="true" />
                            ملاحظات مدوّنة
                          </span>
                        )}
                      </div>
                    )}
                    {hasAttachedFile && (!item.storagePath || item.storagePath.startsWith('users/')) && !item.downloadUrl && (
                      <div className="pt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 rounded-md">
                          محلي فقط — يحتاج إعادة رفع للمزامنة على كل الأجهزة
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#1E3A5F] group-hover:underline me-1">
                        مساحة القراءة والتدوين ←
                      </span>
                      {isViewable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPdf({
                              uid: resolvedUid,
                              title: item.title,
                              fileName:
                                item.attachmentName || `${item.title}.pdf`,
                              resourceId: item.attachmentResourceId,
                              storagePath: item.storagePath,
                              storageProvider: item.storageProvider,
                              downloadUrl: item.downloadUrl,
                              extractedPreview:
                                richHtmlToPlainText(
                                  item.workspaceData?.notesHtml || ''
                                ) ||
                                item.takeaways ||
                                undefined,
                              contextLabel: `مكتبة القراءة · ${hubMeta.shortTitle}`,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-md cursor-pointer"
                        >
                          <Eye className="w-3 h-3" aria-hidden="true" />
                          <span>{isPdf ? 'فتح PDF' : 'فتح الملف'}</span>
                        </button>
                      )}
                      {safeExternalHref && (
                        <a
                          href={safeExternalHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={safeExternalHref}
                          aria-label={isDriveUrl ? 'فتح رابط Google Drive' : 'فتح الرابط الخارجي'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          <span>{isDriveUrl ? 'رابط Drive' : 'فتح الرابط'}</span>
                        </a>
                      )}
                    </div>

                    {canEdit && (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Interactive Book Workspace Modal (Desktop Popup / Mobile Full-Screen) */}
      {selectedItem && (
        <BookWorkspaceModal
          item={selectedItem}
          uid={resolvedUid}
          canEdit={canEdit}
          onRequireAuth={onRequireAuth}
          preferences={preferences}
          onUpdatePreferences={onUpdatePreferences}
          courses={courses}
          learningPaths={learningPaths}
          projects={projects}
          allReadingItems={items}
          unifiedTasks={unifiedTasks}
          bookNotes={bookNotes}
          hubCategories={hubCategories}
          customReadingModes={customReadingModes}
          onUpdateReadingModes={onUpdateReadingModes}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onAddUnifiedTask={onAddUnifiedTask}
          onUpdateUnifiedTask={onUpdateUnifiedTask}
          onDeleteUnifiedTask={onDeleteUnifiedTask}
          onOpenCalendar={onOpenCalendar}
          onOpenTasksTab={onOpenTasksTab}
          onOpenPdf={onOpenPdf}
          onOpenBookNote={onOpenBookNote}
          onClose={() => setSelectedItemId(null)}
        />
      )}

      {/* Cover Frame Editor on Add Form */}
      {coverFrameEditorOpen && pendingCoverUrl && (
        <ImageFrameEditorModal
          open={coverFrameEditorOpen}
          srcUrl={pendingCoverUrl}
          storagePath={pendingCoverStoragePath}
          initialFrame={pendingCoverFrame}
          defaultFrame={DEFAULT_BOOK_COVER_FRAME}
          title="ضبط إطار غلاف الكتاب الجديد"
          onSave={(nextFrame) => {
            setPendingCoverFrame(nextFrame);
            setCoverFrameEditorOpen(false);
          }}
          onClose={() => setCoverFrameEditorOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="تأكيد حذف المادة"
        message={`هل تريد حذف «${confirmDelete?.title ?? ''}» من مكتبة القراءة؟`}
        onConfirm={() => {
          if (confirmDelete) {
            onDeleteItem(confirmDelete.id);
            if (selectedItemId === confirmDelete.id) {
              setSelectedItemId(null);
            }
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
