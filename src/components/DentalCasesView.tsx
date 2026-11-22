import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Edit3,
  Eye,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import {
  DentalCase,
  DentalCaseStatus,
  PersonalCourse,
  getTodayDateKey,
} from '../data/curriculumData';
import {
  deleteDentalCaseCoverStorage,
  resolveDentalCaseCoverUrl,
  uploadDentalCaseCover,
} from '../utils/imageStorage';
import BidiText from './BidiText';
import ConfirmDialog from './ConfirmDialog';
import ImageAttachmentGallery from './ImageAttachmentGallery';

interface DentalCasesViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  dentalCases: DentalCase[];
  courses: PersonalCourse[];
  onAddDentalCase: (payload: Omit<DentalCase, 'id'>) => string | undefined;
  onUpdateDentalCase: (id: string, updates: Partial<DentalCase>) => void;
  onDeleteDentalCase: (id: string) => void;
  onOpenCourse?: (courseId: number) => void;
}

const DENTAL_SPECIALTIES = [
  'علاج الجذور (Endodontics)',
  'العلاج التحفظي والحشوات (Operative)',
  'التركيبات الثابتة (Fixed Prosthodontics)',
  'التركيبات المتحركة (Removable)',
  'جراحة الفم (Oral Surgery)',
  'تجميل الأسنان (Esthetic Dentistry)',
  'طب أسنان الأطفال (Pedodontics)',
  'علاج اللثة (Periodontics)',
];

const STATUS_META: Record<
  DentalCaseStatus,
  { label: string; badgeClass: string }
> = {
  in_progress: {
    label: 'قيد العمل',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  follow_up: {
    label: 'جلسة متابعة',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  completed: {
    label: 'مكتملة',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
};

function DentalCoverImage({
  dentalCase,
  className = 'w-full h-52 object-cover',
}: {
  dentalCase: Pick<
    DentalCase,
    'title' | 'coverImageUrl' | 'coverStoragePath' | 'coverDataUrl'
  >;
  className?: string;
}) {
  const [src, setSrc] = useState<string>(
    dentalCase.coverDataUrl || dentalCase.coverImageUrl || ''
  );
  const [triedStorage, setTriedStorage] = useState(false);

  useEffect(() => {
    setSrc(dentalCase.coverDataUrl || dentalCase.coverImageUrl || '');
    setTriedStorage(false);
  }, [
    dentalCase.coverDataUrl,
    dentalCase.coverImageUrl,
    dentalCase.coverStoragePath,
  ]);

  if (!src && !dentalCase.coverStoragePath) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 flex flex-col items-center justify-center gap-1.5 text-emerald-800/70`}
      >
        <Stethoscope className="w-8 h-8" aria-hidden="true" />
        <span className="text-[11px] font-medium">حالة إكلينيكية</span>
      </div>
    );
  }

  return (
    <img
      src={src || undefined}
      alt={dentalCase.title}
      referrerPolicy="no-referrer"
      onError={async () => {
        if (triedStorage) return;
        setTriedStorage(true);
        if (dentalCase.coverStoragePath) {
          const resolved = await resolveDentalCaseCoverUrl(
            dentalCase.coverStoragePath
          );
          if (resolved?.url) {
            setSrc(resolved.url);
            return;
          }
        }
        if (dentalCase.coverDataUrl && src !== dentalCase.coverDataUrl) {
          setSrc(dentalCase.coverDataUrl);
        }
      }}
      className={className}
    />
  );
}

export default function DentalCasesView({
  uid,
  canEdit,
  onRequireAuth,
  dentalCases,
  courses,
  onAddDentalCase,
  onUpdateDentalCase,
  onDeleteDentalCase,
  onOpenCourse,
}: DentalCasesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DentalCaseStatus | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DentalCase | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState(DENTAL_SPECIALTIES[0]);
  const [patientSummary, setPatientSummary] = useState('');
  const [procedureDetails, setProcedureDetails] = useState('');
  const [caseDate, setCaseDate] = useState(getTodayDateKey());
  const [status, setStatus] = useState<DentalCaseStatus>('in_progress');
  const [linkedCourseId, setLinkedCourseId] = useState<number>(0);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [coverStoragePath, setCoverStoragePath] = useState<string>('');
  const [coverDataUrl, setCoverDataUrl] = useState<string>('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dentalCourses = useMemo(
    () => courses.filter((c) => (c.hubId ?? 'knowledge') === 'dental_career'),
    [courses]
  );

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dentalCases.filter((dc) => {
      if (statusFilter !== 'all' && dc.status !== statusFilter) return false;
      if (q) {
        const hay = [
          dc.title,
          dc.specialty,
          dc.patientSummary,
          dc.procedureDetails,
          dc.caseDate,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dentalCases, statusFilter, searchQuery]);

  const selectedCase = useMemo(
    () =>
      selectedCaseId
        ? dentalCases.find((c) => c.id === selectedCaseId) ?? null
        : null,
    [dentalCases, selectedCaseId]
  );

  const resetForm = () => {
    setEditingCaseId(null);
    setTitle('');
    setSpecialty(DENTAL_SPECIALTIES[0]);
    setPatientSummary('');
    setProcedureDetails('');
    setCaseDate(getTodayDateKey());
    setStatus('in_progress');
    setLinkedCourseId(0);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setCoverImageUrl('');
    setCoverStoragePath('');
    setCoverDataUrl('');
    setCoverUploadError(null);
  };

  const beginEditCase = (dc: DentalCase) => {
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    setSelectedCaseId(null);
    setEditingCaseId(dc.id);
    setTitle(dc.title);
    setSpecialty(dc.specialty || DENTAL_SPECIALTIES[0]);
    setPatientSummary(dc.patientSummary || '');
    setProcedureDetails(dc.procedureDetails || '');
    setCaseDate(dc.caseDate || getTodayDateKey());
    setStatus(dc.status);
    setLinkedCourseId(dc.linkedCourseId ?? 0);
    setCoverFile(null);
    setCoverPreviewUrl(dc.coverImageUrl || dc.coverDataUrl || '');
    setCoverImageUrl(dc.coverImageUrl || '');
    setCoverStoragePath(dc.coverStoragePath || '');
    setCoverDataUrl(dc.coverDataUrl || '');
    setShowAddForm(true);
  };

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onRequireAuth();
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setUploadingCover(true);
    setCoverUploadError(null);
    try {
      const targetId =
        editingCaseId ||
        `dcase-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let finalImageUrl = coverImageUrl;
      let finalStoragePath = coverStoragePath;
      let finalDataUrl = coverDataUrl;

      if (coverFile) {
        const previousPath = coverStoragePath;
        const uploaded = await uploadDentalCaseCover(targetId, coverFile, uid);
        finalImageUrl = uploaded.coverImageUrl;
        finalStoragePath = uploaded.coverStoragePath;
        finalDataUrl = uploaded.coverDataUrl;
        if (
          previousPath &&
          finalStoragePath &&
          previousPath !== finalStoragePath
        ) {
          void deleteDentalCaseCoverStorage(previousPath);
        }
      }

      const payload: Omit<DentalCase, 'id'> = {
        title: cleanTitle,
        specialty: specialty.trim() || DENTAL_SPECIALTIES[0],
        patientSummary: patientSummary.trim(),
        procedureDetails: procedureDetails.trim(),
        caseDate: caseDate || getTodayDateKey(),
        status,
        coverImageUrl: finalImageUrl,
        coverStoragePath: finalStoragePath,
        coverDataUrl: finalDataUrl,
        linkedCourseId: linkedCourseId > 0 ? linkedCourseId : 0,
      };

      if (editingCaseId) {
        onUpdateDentalCase(editingCaseId, payload);
      } else {
        onAddDentalCase(payload);
      }

      resetForm();
      setShowAddForm(false);
    } catch (err) {
      setCoverUploadError(
        err instanceof Error
          ? err.message
          : 'تعذر رفع صورة الغلاف إلى التخزين السحابي.'
      );
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header + Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <Stethoscope className="w-4 h-4" aria-hidden="true" />
              <span>ملف الحالات الإكلينيكية · Dental Career Cases</span>
            </div>
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              حالات طب الأسنان والتوثيق الإكلينيكي ({dentalCases.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              ارفع صور الحالة من الهاتف أو اللابتوب، وثّق خطوات الشغل الإكلينيكي وتفاصيل السنة والجلسات في كارت منظم يغطي واجهته صورة الحالة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!canEdit) {
                onRequireAuth();
                return;
              }
              if (showAddForm) {
                resetForm();
                setShowAddForm(false);
              } else {
                resetForm();
                setShowAddForm(true);
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showAddForm ? 'إلغاء' : '+ إضافة حالة جديدة'}</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `كل الحالات (${dentalCases.length})` },
                { id: 'in_progress', label: 'قيد العمل' },
                { id: 'follow_up', label: 'جلسة متابعة' },
                { id: 'completed', label: 'مكتملة' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الحالات..."
              className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>
        </div>
      </div>

      {/* Add / Edit Case Form */}
      {showAddForm && canEdit && (
        <form
          onSubmit={(e) => void handleSaveCase(e)}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              {editingCaseId ? 'تعديل بيانات الحالة' : 'توثيق حالة أسنان جديدة'}
            </h3>
            <span className="text-[11px] text-slate-500">
              صورة الغلاف تُحفظ وتظهر تلقائيًا على الهاتف واللابتوب
            </span>
          </div>

          {/* Photo Cover Picker */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="w-full sm:w-44 h-32 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt="معاينة صورة الحالة"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-1">
                  <Camera className="w-6 h-6 mx-auto" aria-hidden="true" />
                  <span className="block text-[11px]">صورة واجهة الحالة</span>
                </div>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs font-semibold text-slate-800">
                الصورة الرئيسية للحالة (تغطي واجهة الكارت بالكامل)
              </p>
              <p className="text-[11px] text-slate-500">
                اختر أو التقط صورة واضحة للشغل الإكلينيكي أو الأشعة، ويمكنك إضافة صور أخرى داخل تفاصيل الحالة بعد الحفظ.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverPick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E3A5F] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{coverPreviewUrl ? 'تغيير الصورة' : 'رفع / التقاط صورة'}</span>
              </button>
            </div>
          </div>

          {coverUploadError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
            >
              {coverUploadError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
              عنوان الحالة *
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: Lower 6 Endodontic Treatment (#46) أو Class II Composite"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              التخصص
              <input
                type="text"
                list="dental-specialty-list"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
              <datalist id="dental-specialty-list">
                {DENTAL_SPECIALTIES.map((sp) => (
                  <option key={sp} value={sp} />
                ))}
              </datalist>
            </label>

            <label className="block text-xs font-medium text-slate-700">
              السن / وصف مختصر للحالة (اختياري)
              <input
                type="text"
                value={patientSummary}
                onChange={(e) => setPatientSummary(e.target.value)}
                placeholder="مثلاً: Tooth #36 — 4 canals / Obturation"
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              تاريخ الحالة
              <input
                type="date"
                value={caseDate}
                onChange={(e) => setCaseDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              حالة الجلسة
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DentalCaseStatus)}
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="in_progress">قيد العمل</option>
                <option value="follow_up">تحتاج جلسة متابعة</option>
                <option value="completed">مكتملة</option>
              </select>
            </label>

            {dentalCourses.length > 0 && (
              <label className="block text-xs font-medium text-slate-700 sm:col-span-3">
                ربط بكورس من مسار الدنتال (اختياري)
                <select
                  value={linkedCourseId}
                  onChange={(e) => setLinkedCourseId(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value={0}>بدون ربط بكورس</option>
                  {dentalCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label className="block text-xs font-medium text-slate-700">
            ما تم إجراؤه بالتفصيل (البروتوكول، الأدوات، المواد، ملاحظات إكلينيكية)
            <textarea
              rows={4}
              dir="auto"
              value={procedureDetails}
              onChange={(e) => setProcedureDetails(e.target.value)}
              placeholder="اكتب خطوات الشغل بالعربية أو الإنجليزية بحرية (Working length, irrigants, obturation material, bonding, composite shade...)"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploadingCover}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-60"
            >
              {uploadingCover
                ? 'جاري رفع الصورة وحفظ الحالة...'
                : editingCaseId
                ? 'حفظ التعديلات'
                : 'حفظ الحالة'}
            </button>
          </div>
        </form>
      )}

      {/* Visual Dental Cases Cards Grid (Cover Photo Fills Card Top Cleanly) */}
      {filteredCases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <Stethoscope className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            لا توجد حالات مسجلة في هذا التصنيف بعد
          </p>
          <p className="text-xs text-slate-500">
            وثّق حالاتك الإكلينيكية بالصور والتفاصيل لتتابع تطور مهاراتك في طب الأسنان بوضوح.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCases.map((dc) => {
            const st = STATUS_META[dc.status] ?? STATUS_META.in_progress;
            return (
              <article
                key={dc.id}
                onClick={() => setSelectedCaseId(dc.id)}
                className="bg-white border border-slate-200 hover:border-emerald-600/60 rounded-xl overflow-hidden flex flex-col justify-between transition-colors cursor-pointer group"
              >
                {/* Full-Bleed Card Cover Photo */}
                <div className="relative overflow-hidden bg-slate-100">
                  <DentalCoverImage
                    dentalCase={dc}
                    className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent pointer-events-none" />
                  <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold backdrop-blur-xs ${st.badgeClass}`}
                    >
                      {st.label}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(dc);
                        }}
                        aria-label={`حذف ${dc.title}`}
                        className="p-1.5 bg-white/90 text-slate-600 hover:text-red-600 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="absolute bottom-2.5 right-3 left-3 text-white">
                    <p className="text-[11px] font-medium text-white/90 truncate">
                      {dc.specialty}
                      {dc.caseDate ? ` · ${dc.caseDate}` : ''}
                    </p>
                    <h3 className="text-base font-bold leading-snug line-clamp-1">
                      {dc.title}
                    </h3>
                  </div>
                </div>

                {/* Card Body & Quick View Action */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    {dc.patientSummary && (
                      <p dir="auto" className="text-xs font-semibold text-emerald-800">
                        {dc.patientSummary}
                      </p>
                    )}
                    <p
                      dir="auto"
                      className="text-xs text-slate-600 line-clamp-2 leading-relaxed"
                    >
                      {dc.procedureDetails || 'اضغط لعرض التفاصيل والصور الإكلينيكية الكاملة...'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F]">
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>عرض التفاصيل والصور</span>
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          beginEditCase(dc);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Full Case Detail Modal */}
      {selectedCase && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedCase.title}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedCaseId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-xl"
          >
            {/* Hero Cover Photo */}
            <div className="relative bg-slate-100">
              <DentalCoverImage
                dentalCase={selectedCase}
                className="w-full max-h-80 object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedCaseId(null)}
                aria-label="إغلاق نافذة الحالة"
                className="absolute top-3 left-3 p-2 bg-white/95 text-slate-800 hover:bg-white rounded-full shadow-sm cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded border font-semibold ${
                        (STATUS_META[selectedCase.status] ?? STATUS_META.in_progress)
                          .badgeClass
                      }`}
                    >
                      {
                        (STATUS_META[selectedCase.status] ?? STATUS_META.in_progress)
                          .label
                      }
                    </span>
                    <span className="font-semibold text-emerald-800">
                      {selectedCase.specialty}
                    </span>
                    {selectedCase.caseDate && (
                      <span className="text-slate-500 tabular-nums">
                        · {selectedCase.caseDate}
                      </span>
                    )}
                  </div>
                  <h2 dir="auto" className="font-editorial text-2xl font-bold text-slate-900">
                    {selectedCase.title}
                  </h2>
                  {selectedCase.patientSummary && (
                    <p dir="auto" className="text-xs font-medium text-slate-600">
                      {selectedCase.patientSummary}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => beginEditCase(selectedCase)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>تعديل الحالة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(selectedCase)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Linked Dental Course */}
              {selectedCase.linkedCourseId &&
                (() => {
                  const lc = courses.find(
                    (c) => c.id === selectedCase.linkedCourseId
                  );
                  if (!lc) return null;
                  return (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700">
                        الكورس المرتبط: <strong>{lc.title}</strong>
                      </span>
                      {onOpenCourse && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCaseId(null);
                            onOpenCourse(lc.id);
                          }}
                          className="font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                        >
                          فتح صفحة الكورس ←
                        </button>
                      )}
                    </div>
                  );
                })()}

              {/* Full Procedure Details */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>تفاصيل ما تم إجراؤه في الحالة</span>
                </h3>
                <BidiText
                  text={
                    selectedCase.procedureDetails ||
                    'لم يتم إضافة تفاصيل إضافية بعد.'
                  }
                  as="div"
                  multiline
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed"
                />
              </div>

              {/* Additional Clinical & Radiograph Gallery Synced Cross-Device */}
              <ImageAttachmentGallery
                uid={uid}
                scopeKey={`case:${selectedCase.id}`}
                title="صور إضافية وأشعة الحالة (متزامنة بين الهاتف واللابتوب)"
                canEdit={canEdit}
                onRequireAuth={onRequireAuth}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="حذف الحالة الإكلينيكية"
        message={
          confirmDelete
            ? `هل أنت متأكد من حذف الحالة «${confirmDelete.title}» نهائيًا؟`
            : ''
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            if (selectedCaseId === confirmDelete.id) setSelectedCaseId(null);
            onDeleteDentalCase(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
