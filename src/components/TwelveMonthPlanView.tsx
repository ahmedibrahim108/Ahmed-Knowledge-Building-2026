import { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  Headphones,
  Loader2,
  MessageSquare,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Square,
  Trash2,
} from 'lucide-react';
import {
  DomainId,
  DomainInfo,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  PersonalCourse,
  QuarterInfo,
  ResourceFormat,
  SmallTask,
  StudyResource,
  VoiceDialectMode,
} from '../data/curriculumData';
import { auth } from '../firebase';
import {
  downloadResourceAttachmentResult,
  isPdfAttachment,
  isViewableDocumentAttachment,
  parseDocumentFile,
  uploadResourceAttachment,
} from '../utils/documentImportExport';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';
import type { ActivePdfTarget } from './PDFViewerModal';
import SpacedRepetitionPanel from './SpacedRepetitionPanel';
import VoiceRecorderButton from './VoiceRecorderButton';

interface TwelveMonthPlanViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  voiceDialect: VoiceDialectMode;
  quarters: QuarterInfo[];
  months: MonthPlan[];
  domains: DomainInfo[];
  courses: PersonalCourse[];
  selectedMonthId: number;
  domainFilter: DomainId | 'all';
  onSelectMonth: (id: number) => void;
  onChangeDomainFilter: (domainId: DomainId | 'all') => void;
  onOpenPdf?: (target: ActivePdfTarget) => void;
  onAddQuarter: (title: string, subtitle: string) => void;
  onUpdateQuarter: (id: string, updates: Partial<QuarterInfo>) => void;
  onDeleteQuarter: (id: string) => void;
  onAddMonth: (payload: {
    quarter: number;
    theme: string;
    foundationalTitle: string;
    foundationalAuthor: string;
    exploratoryTitle: string;
    exploratoryAuthor: string;
    courseId: number;
  }) => void;
  onUpdateMonth: (id: number, updates: Partial<MonthPlan>) => void;
  onDeleteMonth: (id: number) => void;
  onUpdateMonthStatus: (id: number, status: MonthStatus) => void;
  onToggleActivity: (id: number, key: keyof MonthActivities) => void;
  onUpdateMonthNotes: (id: number, notes: string) => void;
  onUpdateTrackItem: (
    id: number,
    track: 'foundational' | 'exploratory',
    field: 'title' | 'author' | 'pace' | 'domainId' | 'format' | 'focus',
    value: string
  ) => void;
  onToggleMonthTask: (monthId: number, taskId: string) => void;
  onAddMonthTask: (
    monthId: number,
    text: string,
    track: SmallTask['track']
  ) => void;
  onDeleteMonthTask: (monthId: number, taskId: string) => void;
  onAddMonthResource: (
    monthId: number,
    title: string,
    type: StudyResource['type'],
    note: string,
    extras?: {
      id?: string;
      externalUrl?: string;
      attachmentName?: string;
      extractedPreview?: string;
      storagePath?: string;
      downloadUrl?: string;
      mimeType?: string;
      sizeBytes?: number;
    }
  ) => void;
  onDeleteMonthResource: (monthId: number, resourceId: string) => void;
  onOpenBookNote: (
    bookTitle: string,
    author: string,
    initialContent?: string
  ) => void;
}

const STATUS_META: Record<
  MonthStatus,
  { label: string; textColor: string; Icon: typeof CheckCircle2 }
> = {
  not_started: {
    label: 'لم يبدأ',
    textColor: 'text-slate-500',
    Icon: Circle,
  },
  in_progress: {
    label: 'قيد الدراسة',
    textColor: 'text-amber-700',
    Icon: Clock,
  },
  completed: {
    label: 'مكتمل',
    textColor: 'text-emerald-700',
    Icon: CheckCircle2,
  },
};

const TRACK_LABELS: Record<SmallTask['track'], string> = {
  foundational: 'تأسيسي',
  exploratory: 'استكشافي',
  action: 'تطبيق',
};

export default function TwelveMonthPlanView({
  uid,
  canEdit,
  onRequireAuth,
  voiceDialect,
  quarters,
  months,
  domains,
  courses,
  selectedMonthId,
  domainFilter,
  onSelectMonth,
  onChangeDomainFilter,
  onOpenPdf,
  onAddQuarter,
  onUpdateQuarter,
  onDeleteQuarter,
  onAddMonth,
  onUpdateMonth,
  onDeleteMonth,
  onUpdateMonthStatus,
  onToggleActivity,
  onUpdateMonthNotes,
  onUpdateTrackItem,
  onToggleMonthTask,
  onAddMonthTask,
  onDeleteMonthTask,
  onAddMonthResource,
  onDeleteMonthResource,
  onOpenBookNote,
}: TwelveMonthPlanViewProps) {
  const [quarterFilter, setQuarterFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<MonthStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quarter manager UI state
  const [showQuarterManager, setShowQuarterManager] = useState(false);
  const [newQuarterTitle, setNewQuarterTitle] = useState('');
  const [newQuarterSubtitle, setNewQuarterSubtitle] = useState('');

  // Add Month UI state
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [newMonthQuarter, setNewMonthQuarter] = useState<number>(
    quarters[0]?.number ?? 1
  );
  const [newMonthTheme, setNewMonthTheme] = useState('');
  const [newMonthFTitle, setNewMonthFTitle] = useState('');
  const [newMonthFAuthor, setNewMonthFAuthor] = useState('');
  const [newMonthETitle, setNewMonthETitle] = useState('');
  const [newMonthEAuthor, setNewMonthEAuthor] = useState('');
  const [newMonthCourseId, setNewMonthCourseId] = useState<number>(
    courses[0]?.id ?? 1
  );

  // Edit active month state
  const [isEditingMonth, setIsEditingMonth] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<
    | { type: 'quarter'; id: string; label: string }
    | { type: 'month'; id: number; label: string }
    | { type: 'task'; monthId: number; taskId: string; label: string }
    | { type: 'resource'; monthId: number; resourceId: string; label: string }
    | null
  >(null);

  // Small task & resource inline inputs
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskTrack, setNewTaskTrack] =
    useState<SmallTask['track']>('foundational');
  const [showAddResource, setShowAddResource] = useState(false);
  const [newResTitle, setNewResTitle] = useState('');
  const [newResType, setNewResType] =
    useState<StudyResource['type']>('كتاب');
  const [newResNote, setNewResNote] = useState('');
  const [newResUrl, setNewResUrl] = useState('');
  const [newResAttachmentName, setNewResAttachmentName] = useState('');
  const [newResPreview, setNewResPreview] = useState('');
  const [newResStoragePath, setNewResStoragePath] = useState('');
  const [newResDownloadUrl, setNewResDownloadUrl] = useState('');
  const [newResMimeType, setNewResMimeType] = useState('');
  const [newResSizeBytes, setNewResSizeBytes] = useState<number | undefined>(
    undefined
  );
  const [uploadingResFile, setUploadingResFile] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [resourceActionError, setResourceActionError] = useState<string | null>(
    null
  );
  const [pendingResId, setPendingResId] = useState<string>('');
  const [expandedResPreviewId, setExpandedResPreviewId] = useState<string | null>(
    null
  );
  const resFileInputRef = useRef<HTMLInputElement | null>(null);

  const getDomainTitle = (domainId: DomainId) =>
    domains.find((d) => d.id === domainId)?.title ?? domainId;

  const filteredMonths = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return months.filter((m) => {
      if (quarterFilter !== 0 && m.quarter !== quarterFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (
        domainFilter !== 'all' &&
        m.foundational.domainId !== domainFilter &&
        m.exploratory.domainId !== domainFilter
      ) {
        return false;
      }
      if (q) {
        const haystack = [
          m.theme,
          m.foundational.title,
          m.foundational.author,
          m.exploratory.title,
          m.exploratory.author,
          m.discussionPrompt,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [months, quarterFilter, statusFilter, domainFilter, searchQuery]);

  const activeMonth =
    months.find((m) => m.id === selectedMonthId) ??
    filteredMonths[0] ??
    months[0];

  const linkedCourse = activeMonth
    ? courses.find((c) => c.id === activeMonth.courseId)
    : undefined;
  const doneCount = activeMonth
    ? Object.values(activeMonth.activities).filter(Boolean).length
    : 0;
  const tasksDoneCount = activeMonth
    ? activeMonth.tasks.filter((t) => t.done).length
    : 0;

  const resetFilters = () => {
    setQuarterFilter(0);
    setStatusFilter('all');
    onChangeDomainFilter('all');
    setSearchQuery('');
  };

  const handleSubmitQuarter = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newQuarterTitle.trim();
    if (!title) return;
    onAddQuarter(title, newQuarterSubtitle.trim());
    setNewQuarterTitle('');
    setNewQuarterSubtitle('');
  };

  const handleSubmitNewMonth = (e: React.FormEvent) => {
    e.preventDefault();
    const theme = newMonthTheme.trim();
    if (!theme) return;
    onAddMonth({
      quarter: newMonthQuarter,
      theme,
      foundationalTitle: newMonthFTitle.trim(),
      foundationalAuthor: newMonthFAuthor.trim(),
      exploratoryTitle: newMonthETitle.trim(),
      exploratoryAuthor: newMonthEAuthor.trim(),
      courseId: newMonthCourseId,
    });
    setNewMonthTheme('');
    setNewMonthFTitle('');
    setNewMonthFAuthor('');
    setNewMonthETitle('');
    setNewMonthEAuthor('');
    setShowAddMonth(false);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMonth) return;
    const cleaned = newTaskText.trim();
    if (!cleaned) return;
    onAddMonthTask(activeMonth.id, cleaned, newTaskTrack);
    setNewTaskText('');
  };

  const handlePickMonthResourceFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeMonth) return;

    const generatedId = `m${activeMonth.id}-res-${Date.now()}`;
    setPendingResId(generatedId);
    setUploadingResFile(true);
    setUploadStatusMsg(null);
    setResourceActionError(null);
    try {
      const effectiveUid = uid || auth?.currentUser?.uid;
      const uploaded = await uploadResourceAttachment(
        effectiveUid,
        generatedId,
        file
      );
      const parsed = await parseDocumentFile(file);
      if (!newResTitle.trim()) {
        setNewResTitle(parsed.title || file.name.replace(/\.[^.]+$/, ''));
      }
      setNewResType('ملف / مستند');
      setNewResAttachmentName(file.name);
      setNewResPreview(
        isPdfAttachment(file.name, file.type)
          ? ''
          : parsed.plainText.slice(0, 7500)
      );
      setNewResStoragePath(uploadResPath(uploaded.storagePath));
      setNewResDownloadUrl(uploaded.downloadUrl ?? '');
      setNewResMimeType(uploaded.mimeType || file.type || '');
      setNewResSizeBytes(uploaded.sizeBytes ?? file.size);
      setUploadStatusMsg(
        uploaded.uploadedToCloud
          ? {
              ok: true,
              text: 'تم رفع الملف ومزامنته سحابيًا ليفتح على الهاتف واللابتوب معًا.',
            }
          : {
              ok: false,
              text:
                uploaded.errorMessage ||
                'تعذر رفع الملف للسحابة وتم حفظه محليًا فقط على هذا الجهاز.',
            }
      );
    } finally {
      setUploadingResFile(false);
    }
  };

  const uploadResPath = (path?: string) => path ?? '';

  const handleSubmitResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMonth) return;
    const title = newResTitle.trim();
    if (!title) return;
    onAddMonthResource(
      activeMonth.id,
      title,
      newResType,
      newResNote.trim(),
      {
        id: pendingResId || undefined,
        externalUrl: newResUrl.trim() || undefined,
        attachmentName: newResAttachmentName || undefined,
        extractedPreview: newResPreview || undefined,
        storagePath: newResStoragePath || undefined,
        downloadUrl: newResDownloadUrl || undefined,
        mimeType: newResMimeType || undefined,
        sizeBytes: newResSizeBytes,
      }
    );
    setNewResTitle('');
    setNewResNote('');
    setNewResUrl('');
    setNewResAttachmentName('');
    setNewResPreview('');
    setNewResStoragePath('');
    setNewResDownloadUrl('');
    setNewResMimeType('');
    setNewResSizeBytes(undefined);
    setPendingResId('');
    setUploadStatusMsg(null);
    setShowAddResource(false);
  };

  const handleAppendVoiceToMonthNotes = (transcript: string) => {
    if (!activeMonth) return;
    const current = activeMonth.notes.trim();
    const next = current ? `${current}\n${transcript}` : transcript;
    onUpdateMonthNotes(activeMonth.id, next);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Filter Bar + Quarter Management Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="تصفية حسب مراحل الخطة"
              className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={quarterFilter === 0}
                onClick={() => setQuarterFilter(0)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  quarterFilter === 0
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جميع الوحدات ({months.length})
              </button>
              {quarters.map((q) => {
                const active = quarterFilter === q.number;
                const shortLabel = q.title.split('—')[0].slice(0, 28);
                return (
                  <button
                    key={q.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setQuarterFilter(q.number)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!canEdit}
              title={!canEdit ? 'سجّل الدخول بحساب Google لتعديل المراحل' : undefined}
              onClick={() => setShowQuarterManager((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {showQuarterManager
                  ? 'إغلاق تعديل المراحل'
                  : 'إضافة / تعديل المراحل'}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-52">
              <Search
                className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مفكر أو كتاب..."
                aria-label="ابحث في خطة الدراسة العامة"
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>

            <select
              aria-label="تصفية حسب المحور"
              value={domainFilter}
              onChange={(e) => onChangeDomainFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="all">كل المحاور المعرفية</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>

            <select
              aria-label="تصفية حسب الحالة"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as MonthStatus | 'all')
              }
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="all">كل الحالات</option>
              <option value="not_started">لم يبدأ</option>
              <option value="in_progress">قيد الدراسة</option>
              <option value="completed">مكتمل</option>
            </select>
          </div>
        </div>

        {/* Inline Quarter Manager (Edit الربع الأول / الثاني / إضافة ربع جديد) */}
        {showQuarterManager && canEdit && (
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                تعديل عناوين الأرباع (التأسيس، النقد، العمران...) أو إضافة ربع جديد
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quarters.map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-[#1E3A5F] tabular-nums">
                      الربع رقم {q.number}
                    </span>
                    {quarters.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteTarget({
                            type: 'quarter',
                            id: q.id,
                            label: q.title,
                          })
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label={`حذف ${q.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    aria-label={`عنوان الربع ${q.number}`}
                    value={q.title}
                    onChange={(e) =>
                      onUpdateQuarter(q.id, { title: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <input
                    type="text"
                    aria-label={`وصف الربع ${q.number}`}
                    value={q.subtitle}
                    onChange={(e) =>
                      onUpdateQuarter(q.id, { subtitle: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSubmitQuarter}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <input
                type="text"
                value={newQuarterTitle}
                onChange={(e) => setNewQuarterTitle(e.target.value)}
                placeholder="اسم ربع أو مرحلة جديدة (مثلاً: الربع الخامس: المراجعة والتوسع)..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />
              <input
                type="text"
                value={newQuarterSubtitle}
                onChange={(e) => setNewQuarterSubtitle(e.target.value)}
                placeholder="وصف مختصر..."
                className="sm:w-56 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة ربع</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Add New Month Inline Drawer */}
      {showAddMonth && canEdit && (
        <form
          onSubmit={handleSubmitNewMonth}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              إضافة شهر أو محطة جديدة إلى الخطة
            </h2>
            <button
              type="button"
              onClick={() => setShowAddMonth(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block text-xs font-medium text-slate-600">
              عنوان / محور الشهر
              <input
                type="text"
                required
                value={newMonthTheme}
                onChange={(e) => setNewMonthTheme(e.target.value)}
                placeholder="مثلاً: قراءة في تاريخ العلوم أو مراجعة التأسيس..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>

            <label className="block text-xs font-medium text-slate-600">
              الربع التابع له
              <select
                value={newMonthQuarter}
                onChange={(e) => setNewMonthQuarter(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                {quarters.map((q) => (
                  <option key={q.id} value={q.number}>
                    {q.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              الكورس المرتبط
              <select
                value={newMonthCourseId}
                onChange={(e) => setNewMonthCourseId(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              كتاب / سلسلة المسار التأسيسي
              <input
                type="text"
                value={newMonthFTitle}
                onChange={(e) => setNewMonthFTitle(e.target.value)}
                placeholder="اسم الكتاب أو المحاضرة..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-600">
              مفكر المسار التأسيسي
              <input
                type="text"
                value={newMonthFAuthor}
                onChange={(e) => setNewMonthFAuthor(e.target.value)}
                placeholder="اسم المفكر..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-600">
              كتاب المسار الاستكشافي
              <input
                type="text"
                value={newMonthETitle}
                onChange={(e) => setNewMonthETitle(e.target.value)}
                placeholder="اسم الكتاب الاستكشافي..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-600">
              مؤلف المسار الاستكشافي
              <input
                type="text"
                value={newMonthEAuthor}
                onChange={(e) => setNewMonthEAuthor(e.target.value)}
                placeholder="اسم المؤلف..."
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
            >
              إضافة الشهر إلى الخطة
            </button>
          </div>
        </form>
      )}

      {/* Main Split: Month Index List + Active Month Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Month List (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                خطة الـ {months.length} شهرًا (قابلة للتوسّع)
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                عرض {filteredMonths.length} من {months.length} شهر
              </span>
            </div>

            <button
              type="button"
              disabled={!canEdit}
              title={
                !canEdit
                  ? 'سجّل الدخول بحساب Google لإضافة شهر جديد'
                  : `إضافة الشهر ${months.length + 1}`
              }
              onClick={() => setShowAddMonth((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إضافة الشهر {months.length + 1}</span>
            </button>
          </div>

          {filteredMonths.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm font-medium text-slate-800">
                لا توجد أشهر مطابقة لخيارات التصفية الحالية
              </p>
              <p className="text-xs text-slate-500">
                جرّب تغيير عبارة البحث أو إعادة ضبط التصفيات لعرض كامل الخطة.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#1E3A5F] bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إعادة ضبط التصفية</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredMonths.map((month) => {
                const isSelected = activeMonth?.id === month.id;
                const StatusIcon = STATUS_META[month.status].Icon;
                const mTasksDone = month.tasks.filter((t) => t.done).length;

                return (
                  <button
                    key={month.id}
                    type="button"
                    onClick={() => {
                      onSelectMonth(month.id);
                      setIsEditingMonth(false);
                    }}
                    className={`w-full text-right px-5 py-4 transition-colors duration-150 cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-slate-100/90'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
                        الشهر {month.id}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${STATUS_META[month.status].textColor}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{STATUS_META[month.status].label}</span>
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {month.theme}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {month.foundational.author && (
                        <>
                          <span>{month.foundational.author}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      {month.exploratory.author && (
                        <>
                          <span>{month.exploratory.author}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="tabular-nums">
                        {mTasksDone}/{month.tasks.length} مهام
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Workspace (7 cols) */}
        {activeMonth && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-7">
            {/* Header & Edit/Delete Actions */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#1E3A5F] tabular-nums">
                    الشهر {activeMonth.id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeMonth.quarterTitle}</span>
                </div>
                {isEditingMonth ? (
                  <div className="space-y-2.5 pt-1">
                    <input
                      type="text"
                      aria-label="عنوان الشهر"
                      value={activeMonth.theme}
                      onChange={(e) =>
                        onUpdateMonth(activeMonth.id, { theme: e.target.value })
                      }
                      className="w-full font-editorial text-xl font-bold text-slate-900 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        aria-label="الربع التابع له"
                        value={activeMonth.quarter}
                        onChange={(e) => {
                          const qNum = Number(e.target.value);
                          const qObj = quarters.find((q) => q.number === qNum);
                          onUpdateMonth(activeMonth.id, {
                            quarter: qNum,
                            quarterTitle: qObj?.title ?? activeMonth.quarterTitle,
                          });
                        }}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      >
                        {quarters.map((q) => (
                          <option key={q.id} value={q.number}>
                            {q.title}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="الكورس المرتبط"
                        value={activeMonth.courseId}
                        onChange={(e) =>
                          onUpdateMonth(activeMonth.id, {
                            courseId: Number(e.target.value),
                          })
                        }
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                    {activeMonth.theme}
                  </h2>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!canEdit}
                  title={!canEdit ? 'سجّل الدخول لتعديل الشهر' : undefined}
                  onClick={() => setIsEditingMonth((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isEditingMonth ? 'إنهاء التعديل' : 'تعديل الشهر'}</span>
                </button>

                {canEdit && months.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDeleteTarget({
                        type: 'month',
                        id: activeMonth.id,
                        label: activeMonth.theme,
                      })
                    }
                    aria-label={`حذف الشهر ${activeMonth.id}`}
                    className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Control Row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs font-medium text-slate-600">
                حالة التقدم في هذا الشهر:
              </span>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['not_started', 'in_progress', 'completed'] as MonthStatus[]).map(
                  (st) => {
                    const isCurrent = activeMonth.status === st;
                    const MetaIcon = STATUS_META[st].Icon;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onUpdateMonthStatus(activeMonth.id, st)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                          isCurrent
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <MetaIcon
                          className={`w-3.5 h-3.5 ${
                            isCurrent ? STATUS_META[st].textColor : 'text-slate-400'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{STATUS_META[st].label}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Parallel Tracks Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Foundational */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-[#1E3A5F]">
                      المسار التأسيسي
                    </span>
                    <span>{activeMonth.foundational.format}</span>
                  </div>

                  {isEditingMonth ? (
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-600">
                        الكتاب / السلسلة
                        <input
                          type="text"
                          value={activeMonth.foundational.title}
                          onChange={(e) =>
                            onUpdateTrackItem(
                              activeMonth.id,
                              'foundational',
                              'title',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </label>
                      <label className="block text-xs text-slate-600">
                        المفكر
                        <input
                          type="text"
                          value={activeMonth.foundational.author}
                          onChange={(e) =>
                            onUpdateTrackItem(
                              activeMonth.id,
                              'foundational',
                              'author',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs text-slate-600">
                          المحور
                          <select
                            value={activeMonth.foundational.domainId}
                            onChange={(e) =>
                              onUpdateTrackItem(
                                activeMonth.id,
                                'foundational',
                                'domainId',
                                e.target.value
                              )
                            }
                            className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          >
                            {domains.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-slate-600">
                          النوع
                          <select
                            value={activeMonth.foundational.format}
                            onChange={(e) =>
                              onUpdateTrackItem(
                                activeMonth.id,
                                'foundational',
                                'format',
                                e.target.value as ResourceFormat
                              )
                            }
                            className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          >
                            <option value="كتاب">كتاب</option>
                            <option value="سلسلة محاضرات">سلسلة محاضرات</option>
                            <option value="كتاب + محاضرات">كتاب + محاضرات</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs text-slate-600">
                        الوتيرة الأسبوعية
                        <input
                          type="text"
                          value={activeMonth.foundational.pace}
                          onChange={(e) =>
                            onUpdateTrackItem(
                              activeMonth.id,
                              'foundational',
                              'pace',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 leading-snug">
                          {activeMonth.foundational.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          {activeMonth.foundational.author} ·{' '}
                          {getDomainTitle(activeMonth.foundational.domainId)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {activeMonth.foundational.focus}
                      </p>
                    </>
                  )}
                </div>

                {!isEditingMonth && (
                  <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 truncate">
                      {activeMonth.foundational.pace}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenBookNote(
                          activeMonth.foundational.title,
                          activeMonth.foundational.author
                        )
                      }
                      className="font-semibold text-[#1E3A5F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      نوتس الكتاب
                    </button>
                  </div>
                )}
              </div>

              {/* Exploratory */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">
                      المسار الاستكشافي
                    </span>
                    <span>{activeMonth.exploratory.format}</span>
                  </div>

                  {isEditingMonth ? (
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-600">
                        الكتاب / السلسلة
                        <input
                          type="text"
                          value={activeMonth.exploratory.title}
                          onChange={(e) =>
                            onUpdateTrackItem(
                              activeMonth.id,
                              'exploratory',
                              'title',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </label>
                      <label className="block text-xs text-slate-600">
                        المفكر / الأديب
                        <input
                          type="text"
                          value={activeMonth.exploratory.author}
                          onChange={(e) =>
                            onUpdateTrackItem(
                              activeMonth.id,
                              'exploratory',
                              'author',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs text-slate-600">
                          المحور
                          <select
                            value={activeMonth.exploratory.domainId}
                            onChange={(e) =>
                              onUpdateTrackItem(
                                activeMonth.id,
                                'exploratory',
                                'domainId',
                                e.target.value
                              )
                            }
                            className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          >
                            {domains.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-slate-600">
                          النوع
                          <select
                            value={activeMonth.exploratory.format}
                            onChange={(e) =>
                              onUpdateTrackItem(
                                activeMonth.id,
                                'exploratory',
                                'format',
                                e.target.value as ResourceFormat
                              )
                            }
                            className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          >
                            <option value="كتاب">كتاب</option>
                            <option value="سلسلة محاضرات">سلسلة محاضرات</option>
                            <option value="كتاب + محاضرات">كتاب + محاضرات</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs text-slate-600">
                        الوتيرة الأسبوعية
                        <input
                          type="text"
                          value={activeMonth.exploratory.pace}
                          onChange={(e) =>
                            onUpdateTrackItem(
                              activeMonth.id,
                              'exploratory',
                              'pace',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 leading-snug">
                          {activeMonth.exploratory.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1">
                          {activeMonth.exploratory.author} ·{' '}
                          {getDomainTitle(activeMonth.exploratory.domainId)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {activeMonth.exploratory.focus}
                      </p>
                    </>
                  )}
                </div>

                {!isEditingMonth && (
                  <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 truncate">
                      {activeMonth.exploratory.pace}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenBookNote(
                          activeMonth.exploratory.title,
                          activeMonth.exploratory.author
                        )
                      }
                      className="font-semibold text-[#1E3A5F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      نوتس الكتاب
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Small Actionable Tasks Checklist */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  المهام الصغيرة وخطوات التنفيذ في هذا الشهر
                </h3>
                <span className="text-xs text-slate-500 tabular-nums">
                  {tasksDoneCount} / {activeMonth.tasks.length} منجزة
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {activeMonth.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 bg-white hover:bg-slate-50/70 transition-colors"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onToggleMonthTask(activeMonth.id, task.id)}
                      aria-pressed={task.done}
                      className="flex items-start gap-3 text-right flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      {task.done ? (
                        <CheckSquare
                          className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <Square
                          className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <div className="space-y-0.5">
                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            task.done
                              ? 'line-through text-slate-400'
                              : 'text-slate-800'
                          }`}
                        >
                          {task.text}
                        </p>
                        <span className="text-[11px] text-slate-500">
                          مسار {TRACK_LABELS[task.track]}
                        </span>
                      </div>
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteTarget({
                            type: 'task',
                            monthId: activeMonth.id,
                            taskId: task.id,
                            label: task.text,
                          })
                        }
                        aria-label="حذف المهمة"
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add custom small task */}
              {canEdit && (
                <form
                  onSubmit={handleSubmitTask}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1"
                >
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="أضف مهمة صغيرة (مثلاً: قراءة الفصل الثالث من فؤاد زكريا)..."
                    aria-label="إضافة مهمة صغيرة جديدة"
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] focus:bg-white"
                  />
                  <select
                    aria-label="مسار المهمة"
                    value={newTaskTrack}
                    onChange={(e) =>
                      setNewTaskTrack(e.target.value as SmallTask['track'])
                    }
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1E3A5F]"
                  >
                    <option value="foundational">مسار تأسيسي</option>
                    <option value="exploratory">مسار استكشافي</option>
                    <option value="action">تطبيق عملي</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إضافة مهمة</span>
                  </button>
                </form>
              )}
            </div>

            {/* Suggested Study Resources for this Month */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  المصادر والمحاضرات المقترحة لهذا الشهر
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowAddResource((v) => !v)}
                    className="text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    {showAddResource ? 'إلغاء' : '+ إضافة مصدر'}
                  </button>
                )}
              </div>

              {showAddResource && canEdit && (
                <form
                  onSubmit={handleSubmitResource}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newResTitle}
                      onChange={(e) => setNewResTitle(e.target.value)}
                      placeholder="اسم الكتاب أو المحاضرة أو الملف..."
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <select
                      value={newResType}
                      onChange={(e) =>
                        setNewResType(e.target.value as StudyResource['type'])
                      }
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    >
                      <option value="كتاب">كتاب</option>
                      <option value="سلسلة محاضرات">سلسلة محاضرات</option>
                      <option value="مقال / مدخل">مقال / مدخل</option>
                      <option value="أداة تطبيق">أداة تطبيق</option>
                      <option value="ملف / مستند">ملف / مستند (Word / PDF)</option>
                      <option value="رابط خارجي">رابط خارجي</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="url"
                      value={newResUrl}
                      onChange={(e) => setNewResUrl(e.target.value)}
                      placeholder="رابط خارجي اختياري (https://...) — يوتيوب / درايف / مقال"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        ref={resFileInputRef}
                        type="file"
                        accept=".docx,.doc,.txt,.md,.markdown,.pdf"
                        className="hidden"
                        onChange={(e) => void handlePickMonthResourceFile(e)}
                      />
                      <button
                        type="button"
                        disabled={uploadingResFile}
                        onClick={() => resFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                      >
                        {uploadingResFile ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {uploadingResFile
                            ? 'جاري الرفع...'
                            : newResAttachmentName
                            ? `تم إرفاق: ${newResAttachmentName}`
                            : 'رفع ملف Word / PDF / نص'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={newResNote}
                    onChange={(e) => setNewResNote(e.target.value)}
                    placeholder="ملاحظة مختصرة عن المصدر (اختياري)..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                  {uploadStatusMsg && (
                    <p
                      className={`text-xs px-3 py-2 rounded-lg border ${
                        uploadStatusMsg.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {uploadStatusMsg.text}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={uploadingResFile}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer disabled:opacity-50"
                  >
                    حفظ المصدر
                  </button>
                </form>
              )}

              {resourceActionError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>{resourceActionError}</span>
                  <button
                    type="button"
                    onClick={() => setResourceActionError(null)}
                    className="text-amber-700 hover:text-amber-950 font-semibold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              )}

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {activeMonth.resources.map((res) => {
                  const isPreviewOpen = expandedResPreviewId === res.id;
                  const isPdf = isPdfAttachment(res.attachmentName, res.mimeType);
                  const hasAttachment = Boolean(
                    res.attachmentName || res.storagePath || res.downloadUrl
                  );
                  const isViewable =
                    isPdf ||
                    isViewableDocumentAttachment(
                      res.attachmentName,
                      res.mimeType
                    ) ||
                    Boolean(res.extractedPreview) ||
                    hasAttachment;
                  const resolvedUid = uid || auth?.currentUser?.uid;

                  const handleOpenDocModal = () => {
                    if (!onOpenPdf) return;
                    setResourceActionError(null);
                    onOpenPdf({
                      uid: resolvedUid,
                      title: res.title,
                      fileName:
                        res.attachmentName ||
                        (isPdf ? `${res.title}.pdf` : `${res.title}.docx`),
                      resourceId: res.id,
                      storagePath: res.storagePath,
                      downloadUrl: res.downloadUrl,
                      mimeType: res.mimeType,
                      extractedPreview: res.extractedPreview,
                      contextLabel: `الشهر ${activeMonth.id}: ${activeMonth.theme}`,
                    });
                  };

                  return (
                    <div key={res.id} className="bg-white">
                      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {isViewable && onOpenPdf ? (
                              <button
                                type="button"
                                onClick={handleOpenDocModal}
                                className="font-semibold text-[#1E3A5F] hover:underline text-right cursor-pointer"
                              >
                                {res.title}
                              </button>
                            ) : (
                              <span className="font-semibold text-slate-900">
                                {res.title}
                              </span>
                            )}
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-slate-500">{res.type}</span>
                            {res.attachmentName && (
                              <span className="text-[11px] text-emerald-700 font-medium">
                                ({res.attachmentName})
                              </span>
                            )}
                          </div>
                          {res.note && (
                            <p className="text-xs text-slate-600">{res.note}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isViewable && onOpenPdf && (
                            <button
                              type="button"
                              onClick={handleOpenDocModal}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded cursor-pointer"
                            >
                              <Eye className="w-3 h-3" aria-hidden="true" />
                              <span>{isPdf ? 'فتح PDF' : 'فتح الملف'}</span>
                            </button>
                          )}

                          {res.extractedPreview && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedResPreviewId(
                                    isPreviewOpen ? null : res.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                              >
                                <FileText className="w-3 h-3" aria-hidden="true" />
                                <span>{isPreviewOpen ? 'إخفاء النص' : 'معاينة'}</span>
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenBookNote(
                                      res.title,
                                      activeMonth.theme,
                                      res.extractedPreview
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                                >
                                  <PenLine className="w-3 h-3" aria-hidden="true" />
                                  <span>فتح كدفتر نوتس</span>
                                </button>
                              )}
                            </>
                          )}

                          {hasAttachment && (
                            <button
                              type="button"
                              onClick={async () => {
                                setResourceActionError(null);
                                const result =
                                  await downloadResourceAttachmentResult({
                                    uid: resolvedUid,
                                    resourceId: res.id,
                                    fileName: res.attachmentName || res.title,
                                    mimeType: res.mimeType,
                                    storagePath: res.storagePath,
                                    downloadUrl: res.downloadUrl,
                                  });
                                if (!result.ok && result.errorMessage) {
                                  setResourceActionError(result.errorMessage);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                            >
                              <Download className="w-3 h-3" aria-hidden="true" />
                              <span>تنزيل</span>
                            </button>
                          )}

                          {(!hasAttachment || res.externalUrl) && (
                            <a
                              href={
                                res.externalUrl ||
                                `https://www.google.com/search?q=${encodeURIComponent(
                                  res.searchQuery
                                )}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline whitespace-nowrap"
                            >
                              <span>
                                {res.externalUrl
                                  ? 'فتح الرابط الخارجي'
                                  : 'بحث عن المصدر'}
                              </span>
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteTarget({
                                  type: 'resource',
                                  monthId: activeMonth.id,
                                  resourceId: res.id,
                                  label: res.title,
                                })
                              }
                              aria-label="حذف المصدر"
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isPreviewOpen && res.extractedPreview && (
                        <div className="px-4 pb-3 pt-1">
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                            {res.extractedPreview}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <ImageAttachmentGallery
                uid={uid}
                scopeKey={`month:${activeMonth.id}`}
                title="صور ومخططات الوحدة المرفقة (صورة أو أكثر)"
                canEdit={canEdit}
                onRequireAuth={onRequireAuth}
                hideEmptyWhenReadOnly
              />
            </div>

            {/* 4 Pillars Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  أركان الشهر الأربعة (بدون سباق لإنهاء الكتب)
                </h3>
                <span className="text-xs text-slate-500 tabular-nums">
                  {doneCount} / 4 مكتمل
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    { key: 'reading', label: 'القراءة المتأنية', Icon: BookOpen },
                    {
                      key: 'listening',
                      label: 'الاستماع للمحاضرات',
                      Icon: Headphones,
                    },
                    { key: 'summarizing', label: 'التلخيص الشخصي', Icon: PenLine },
                    {
                      key: 'discussing',
                      label: 'المناقشة والتطبيق',
                      Icon: MessageSquare,
                    },
                  ] as const
                ).map(({ key, label, Icon }) => {
                  const checked = activeMonth.activities[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onToggleActivity(activeMonth.id, key)}
                      aria-pressed={checked}
                      className={`p-3 rounded-lg border text-right transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 flex flex-col gap-2 ${
                        checked
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon
                          className={`w-4 h-4 ${
                            checked ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-medium">
                          {checked ? 'تم' : 'معلّق'}
                        </span>
                      </div>
                      <span className="text-xs font-medium leading-snug">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Discussion, Application & Linked Course */}
            <div className="divide-y divide-slate-200 border-t border-b border-slate-200 py-2 text-sm">
              <div className="py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">
                    سؤال المناقشة والفهم المقارن
                  </p>
                  <VoiceRecorderButton
                    label="ناقش الفكرة بالصوت"
                    disabled={!canEdit}
                    onRequireAuth={onRequireAuth}
                    dialect={voiceDialect}
                    onTranscript={(transcript) => {
                      const prev = activeMonth.notes.trim();
                      const formatted = `«نقاش صوتي»: ${transcript}`;
                      onUpdateMonthNotes(
                        activeMonth.id,
                        prev ? `${prev}\n${formatted}` : formatted
                      );
                    }}
                  />
                </div>
                {isEditingMonth ? (
                  <textarea
                    rows={2}
                    value={activeMonth.discussionPrompt}
                    onChange={(e) =>
                      onUpdateMonth(activeMonth.id, {
                        discussionPrompt: e.target.value,
                      })
                    }
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-800 leading-relaxed">
                    {activeMonth.discussionPrompt}
                  </p>
                )}
              </div>
              <div className="py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500">
                  التطبيق العملي المقترح
                </p>
                {isEditingMonth ? (
                  <textarea
                    rows={2}
                    value={activeMonth.applicationTask}
                    onChange={(e) =>
                      onUpdateMonth(activeMonth.id, {
                        applicationTask: e.target.value,
                      })
                    }
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-800 leading-relaxed">
                    {activeMonth.applicationTask}
                  </p>
                )}
              </div>
              {linkedCourse && (
                <div className="py-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-500">
                    كورس التطوير الشخصي المرتبط ({linkedCourse.category})
                  </p>
                  <p className="text-slate-900 font-medium">
                    {linkedCourse.title}
                  </p>
                  <p className="text-xs text-slate-600">
                    {linkedCourse.complementaryBook} · {linkedCourse.bookAuthor}
                  </p>
                </div>
              )}
            </div>

            {/* Spaced Repetition, Reading Modes & Listen Counter */}
            <SpacedRepetitionPanel
              canEdit={canEdit}
              value={{
                readingModes: activeMonth.readingModes,
                learningMethods: activeMonth.learningMethods,
                reviewCount: activeMonth.reviewCount,
                listenCount: activeMonth.listenCount,
                repetitionStage: activeMonth.repetitionStage,
                nextReviewDateKey: activeMonth.nextReviewDateKey,
                lastReviewedDateKey: activeMonth.lastReviewedDateKey,
              }}
              onChange={(updates) => onUpdateMonth(activeMonth.id, updates)}
            />

            {/* Month Reflection / Summary Box + Voice Dictation */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={`month-notes-${activeMonth.id}`}
                  className="text-sm font-semibold text-slate-900"
                >
                  خلاصة الشهر وملاحظاتك الشخصية
                </label>
                <VoiceRecorderButton
                  label="سجّل ملاحظتك بالصوت"
                  disabled={!canEdit}
                  onRequireAuth={onRequireAuth}
                  dialect={voiceDialect}
                  onTranscript={handleAppendVoiceToMonthNotes}
                />
              </div>
              <textarea
                id={`month-notes-${activeMonth.id}`}
                rows={4}
                readOnly={!canEdit}
                value={activeMonth.notes}
                onChange={(e) => {
                  if (!canEdit) {
                    onRequireAuth();
                    return;
                  }
                  onUpdateMonthNotes(activeMonth.id, e.target.value);
                }}
                placeholder={
                  canEdit
                    ? 'اكتب هنا أو اضغط «سجّل ملاحظتك بالصوت» لإملاء خلاصة الشهر بلغتك...'
                    : 'سجّل الدخول بحساب Google لإضافة خلاصة الشهر...'
                }
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F] focus:bg-white transition-colors leading-relaxed read-only:cursor-not-allowed"
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDeleteTarget)}
        title={`تأكيد الحذف: ${confirmDeleteTarget?.label ?? ''}`}
        message={
          confirmDeleteTarget?.type === 'month'
            ? 'سيتم حذف هذه الوحدة الشهرية ومهامها من خطتك. هل أنت متأكد؟'
            : confirmDeleteTarget?.type === 'quarter'
            ? 'سيتم حذف هذه المرحلة من قائمة المراحل. هل تريد المتابعة؟'
            : confirmDeleteTarget?.type === 'resource'
            ? 'سيتم حذف هذا المصدر المرفق من الشهر. هل تريد المتابعة؟'
            : 'سيتم حذف هذه المهمة من الشهر. هل تريد المتابعة؟'
        }
        onCancel={() => setConfirmDeleteTarget(null)}
        onConfirm={() => {
          if (!confirmDeleteTarget) return;
          if (confirmDeleteTarget.type === 'quarter') {
            onDeleteQuarter(confirmDeleteTarget.id);
          } else if (confirmDeleteTarget.type === 'month') {
            onDeleteMonth(confirmDeleteTarget.id);
          } else if (confirmDeleteTarget.type === 'task') {
            onDeleteMonthTask(
              confirmDeleteTarget.monthId,
              confirmDeleteTarget.taskId
            );
          } else if (confirmDeleteTarget.type === 'resource') {
            onDeleteMonthResource(
              confirmDeleteTarget.monthId,
              confirmDeleteTarget.resourceId
            );
          }
          setConfirmDeleteTarget(null);
        }}
      />
    </div>
  );
}
