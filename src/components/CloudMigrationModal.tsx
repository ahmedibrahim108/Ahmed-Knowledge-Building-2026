import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  Loader2,
  PauseCircle,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { isSupabaseConfigured, supabaseInitError } from '../services/supabaseClient';
import {
  MigrationProgressSnapshot,
  MigrationReport,
  MigrationRunMode,
  MigrationScanPreview,
  MigrationValidationReport,
  WorkspaceBackupSnapshot,
  clearMigrationCheckpoint,
  exportRawFirestoreBackupJson,
  exportWorkspaceBackupJson,
  loadMigrationCheckpoint,
  runFirestoreToSupabaseMigration,
  scanFirestoreForMigration,
  validateMigratedWorkspace,
} from '../services/firebaseToSupabaseMigration';

interface CloudMigrationModalProps {
  open: boolean;
  user: User | null;
  snapshot: WorkspaceBackupSnapshot | null;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

export default function CloudMigrationModal({
  open,
  user,
  snapshot,
  onClose,
  onMigrationComplete,
}: CloudMigrationModalProps) {
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<MigrationScanPreview | null>(null);
  const [runMode, setRunMode] = useState<MigrationRunMode>('upsert_all');

  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgressSnapshot | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<MigrationValidationReport | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stepNotice, setStepNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const cancelSignalRef = useRef<{ aborted: boolean }>({ aborted: false });

  useEffect(() => {
    if (!open) {
      cancelSignalRef.current.aborted = false;
    }
  }, [open]);

  if (!open) return null;

  const savedCheckpoint = user ? loadMigrationCheckpoint(user.uid) : null;

  const handleDownloadWorkspaceBackup = () => {
    if (!snapshot) return;
    exportWorkspaceBackupJson(snapshot);
    setBackupNotice('تم تنزيل نسخة مساحة العمل الحالية (JSON).');
    window.setTimeout(() => setBackupNotice(null), 4000);
  };

  const handleDownloadRawFirestoreBackup = () => {
    if (!scanPreview) return;
    exportRawFirestoreBackupJson(scanPreview);
    setBackupNotice('تم تنزيل نسخة Firestore الخام الأصلية (JSON) كاملة.');
    window.setTimeout(() => setBackupNotice(null), 4000);
  };

  const handleScanFirestore = async () => {
    if (!user) return;
    setScanning(true);
    setErrorMsg(null);
    setValidation(null);
    setStepNotice('جاري قراءة وفحص مجموعات Firebase Firestore...');
    try {
      const preview = await scanFirestoreForMigration(user, (msg) =>
        setStepNotice(msg)
      );
      setScanPreview(preview);
      if (preview.savedCheckpoint) {
        setRunMode('resume_skip_existing');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر فحص بيانات Firestore. تحقق من تسجيل الدخول واتصال الشبكة.'
      );
    } finally {
      setScanning(false);
      setStepNotice('');
    }
  };

  const handleStartMigration = async (resumeCheckpoint = false) => {
    if (!user) return;
    setMigrating(true);
    setErrorMsg(null);
    setReport(null);
    setValidation(null);
    cancelSignalRef.current = { aborted: false };

    let activeScan = scanPreview;
    try {
      if (!activeScan) {
        setStepNotice('جاري فحص Firestore قبل الترحيل...');
        activeScan = await scanFirestoreForMigration(user, (msg) =>
          setStepNotice(msg)
        );
        setScanPreview(activeScan);
      }

      const effectiveMode: MigrationRunMode = resumeCheckpoint
        ? 'resume_skip_existing'
        : runMode;

      const res = await runFirestoreToSupabaseMigration(user, activeScan, {
        mode: effectiveMode,
        resumeFromCheckpoint: resumeCheckpoint,
        cancelSignal: cancelSignalRef.current,
        onProgress: (snap) => setProgress(snap),
      });
      setReport(res);

      // Refresh preview counts after migration
      const refreshedScan = await scanFirestoreForMigration(user).catch(() => null);
      if (refreshedScan) setScanPreview(refreshedScan);

      // Automatically run Phase 4 Validation
      setValidating(true);
      const valReport = await validateMigratedWorkspace(
        user,
        refreshedScan || activeScan
      );
      setValidation(valReport);
      setValidating(false);

      onMigrationComplete?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام الترحيل من Firebase إلى Supabase.'
      );
    } finally {
      setMigrating(false);
      setValidating(false);
      setStepNotice('');
    }
  };

  const handleRunValidationOnly = async () => {
    if (!user) return;
    setValidating(true);
    setErrorMsg(null);
    try {
      const res = await validateMigratedWorkspace(user, scanPreview);
      setValidation(res);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر إجراء التحقق من جداول Supabase.'
      );
    } finally {
      setValidating(false);
    }
  };

  const handlePauseMigration = () => {
    cancelSignalRef.current.aborted = true;
    setStepNotice('جاري إيقاف الترحيل بأمان بعد حفظ السجل الحالي...');
  };

  const handleClearCheckpoint = () => {
    if (!user) return;
    clearMigrationCheckpoint(user.uid);
    if (scanPreview) {
      setScanPreview({ ...scanPreview, savedCheckpoint: null });
    }
    setRunMode('upsert_all');
  };

  const activeProgressPct = progress?.percent ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="مركز الترحيل والنسخ الاحتياطي (Firebase إلى Supabase)"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                الترحيل الشامل والنسخ الاحتياطي (Firestore ← Supabase)
              </h2>
              {user && (
                <p className="text-[11px] text-slate-500 font-mono">
                  UID: {user.uid} · {user.email}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={migrating}
            aria-label="إغلاق"
            className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs sm:text-sm text-slate-700 leading-relaxed">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>ترحيل آمن للقراءة فقط من Firestore تحت حماية RLS</span>
            </div>
            <p className="text-xs text-slate-600">
              لا يتم حذف أو تعديل أي سجل في Firebase Firestore. تُنسخ البيانات إلى جداول Supabase تحت معرفك الحالي{' '}
              <code className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[11px]">
                owner_id = Firebase UID
              </code>{' '}
              مع الحفاظ على المعرفات والروابط والتواريخ دون تكرار.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                {supabaseInitError ||
                  'أضف متغيرات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY أولاً لتفعيل المزامنة والترحيل.'}
              </span>
            </div>
          )}

          {/* Resume Checkpoint Banner */}
          {savedCheckpoint && !migrating && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950">
              <div className="space-y-0.5">
                <p className="font-bold">
                  توجد نقطة استكمال محفوظة لعملية ترحيل سابقة
                </p>
                <p className="text-[11px] text-amber-800">
                  تم حفظ {savedCheckpoint.completedKeys.length} سجل مكتمل و{' '}
                  {savedCheckpoint.failedRecords.length} أخطاء سابقة (آخر تحديث:{' '}
                  {new Date(savedCheckpoint.updatedAt).toLocaleString('ar-EG')}).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!user || !isSupabaseConfigured || scanning}
                  onClick={() => handleStartMigration(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استكمال الترحيل</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearCheckpoint}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg cursor-pointer"
                >
                  تجاهل
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Scan & Backups */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  1. فحص بيانات Firestore والنسخ الاحتياطي
                </h3>
                <p className="text-xs text-slate-500">
                  يفحص جميع المجموعات الـ 19 في Firestore ويقارنها مع جداول Supabase قبل نقل أي سجل.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!user || !isSupabaseConfigured || scanning || migrating}
                  onClick={handleScanFirestore}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  {scanning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {scanning
                      ? 'جاري الفحص...'
                      : scanPreview
                        ? 'إعادة فحص Firestore'
                        : 'فحص بيانات Firestore'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!snapshot}
                  onClick={handleDownloadWorkspaceBackup}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>نسخة حالية (JSON)</span>
                </button>

                {scanPreview && (
                  <button
                    type="button"
                    onClick={handleDownloadRawFirestoreBackup}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>نسخة Firestore الخام (JSON)</span>
                  </button>
                )}
              </div>
            </div>

            {stepNotice && !migrating && (
              <p className="text-xs text-[#1E3A5F] font-medium">{stepNotice}</p>
            )}
            {backupNotice && (
              <p className="text-xs font-medium text-emerald-700">{backupNotice}</p>
            )}
          </div>

          {/* Step 2: Preview Migration Table */}
          {scanPreview && (
            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  2. معاينة خطة الترحيل (تم الفحص الساعة {scanPreview.scannedAt})
                </h3>
                <span className="text-[11px] text-slate-500">
                  قاعدة Firestore: {scanPreview.firestoreDatabaseId}
                </span>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-lg font-bold text-slate-900">
                    {scanPreview.totalDetected}
                  </div>
                  <div className="text-[11px] text-slate-500">سجل مرصود في Firestore</div>
                </div>
                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg">
                  <div className="text-lg font-bold text-sky-900">
                    {scanPreview.totalNewToMigrate}
                  </div>
                  <div className="text-[11px] text-sky-700">جديد غير موجود بـ Supabase</div>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-lg font-bold text-emerald-900">
                    {scanPreview.totalAlreadyInSupabase}
                  </div>
                  <div className="text-[11px] text-emerald-700">موجود مسبقًا في Supabase</div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-lg font-bold text-slate-900">
                    {scanPreview.relationalSummary.attachmentsCount +
                      scanPreview.relationalSummary.imagesCount +
                      scanPreview.relationalSummary.audioCacheCount}
                  </div>
                  <div className="text-[11px] text-slate-500">ملفات وصور وصوتيات</div>
                </div>
              </div>

              {/* Relational Summary */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  الكورسات: <strong>{scanPreview.relationalSummary.coursesCount}</strong>
                </span>
                <span>
                  الملاحظات: <strong>{scanPreview.relationalSummary.bookNotesCount}</strong> (مرتبط بكورس:{' '}
                  {scanPreview.relationalSummary.notesLinkedToCourseCount})
                </span>
                <span>
                  الشهور: <strong>{scanPreview.relationalSummary.monthsCount}</strong> (مرتبط بكورس:{' '}
                  {scanPreview.relationalSummary.monthsLinkedToCourseCount})
                </span>
                <span>
                  المرفقات: <strong>{scanPreview.relationalSummary.attachmentsCount}</strong> · الصور:{' '}
                  <strong>{scanPreview.relationalSummary.imagesCount}</strong> · الصوتيات:{' '}
                  <strong>{scanPreview.relationalSummary.audioCacheCount}</strong>
                </span>
              </div>

              {scanPreview.scanWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      تعذر الوصول إلى {scanPreview.blockedCollectionsCount} مجموعة في Firestore
                      (يمكنك ترحيل باقي المجموعات المقروءة بنجاح):
                    </span>
                  </div>
                  <ul className="list-disc pr-5 space-y-0.5 text-[11px] text-amber-900 max-h-24 overflow-y-auto">
                    {scanPreview.scanWarnings.map((warn, idx) => (
                      <li key={idx} className="font-mono break-all">
                        {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mapping Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 font-semibold">مجموعة Firestore</th>
                      <th className="py-2 px-2.5 font-semibold">جدول Supabase</th>
                      <th className="py-2 px-2 font-semibold text-center">مرصود</th>
                      <th className="py-2 px-2 font-semibold text-center">جديد</th>
                      <th className="py-2 px-2 font-semibold text-center">موجود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scanPreview.collections.map((col) => (
                      <tr
                        key={col.firestoreCollection}
                        className={
                          col.scanStatus !== 'ok'
                            ? 'bg-red-50/50 text-red-900'
                            : col.detectedCount === 0
                              ? 'text-slate-400'
                              : 'text-slate-800'
                        }
                      >
                        <td className="py-1.5 px-2.5">
                          <div className="font-medium flex items-center gap-1.5">
                            <span>{col.labelAr}</span>
                            {col.scanStatus === 'permission_denied' && (
                              <span
                                title={col.scanError}
                                className="px-1.5 py-0.5 text-[10px] font-mono bg-red-100 text-red-800 rounded"
                              >
                                403 محظور
                              </span>
                            )}
                            {col.scanStatus === 'error' && (
                              <span
                                title={col.scanError}
                                className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-900 rounded"
                              >
                                خطأ فحص
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {col.firestoreCollection}
                            {col.storageBucket ? ` + ${col.storageBucket}` : ''}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[10px]">
                          {col.supabaseTable}
                        </td>
                        <td className="py-1.5 px-2 text-center font-semibold">
                          {col.scanStatus === 'ok' ? col.detectedCount : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-center text-sky-700 font-semibold">
                          {col.scanStatus === 'ok' ? col.newCount : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-center text-emerald-700">
                          {col.alreadyInSupabaseCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mode Selector & Start Button */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 ${
                      runMode === 'upsert_all'
                        ? 'border-[#1E3A5F] bg-[#F4F7FB]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="migrationMode"
                      checked={runMode === 'upsert_all'}
                      onChange={() => setRunMode('upsert_all')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">
                        دمج وتحديث آمن (Upsert الكل)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        يستبدل السجلات الافتراضية ببيانات Firestore الأصلية دون تكرار.
                      </div>
                    </div>
                  </label>
                  <label
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2 ${
                      runMode === 'resume_skip_existing'
                        ? 'border-[#1E3A5F] bg-[#F4F7FB]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="migrationMode"
                      checked={runMode === 'resume_skip_existing'}
                      onChange={() => setRunMode('resume_skip_existing')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">
                        استكمال الناقص فقط (تخطي الموجود)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        يرحّل السجلات غير الموجودة في Supabase فقط ويتخطى المكرر.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      !user ||
                      !isSupabaseConfigured ||
                      migrating ||
                      scanning ||
                      scanPreview.totalDetected === 0
                    }
                    onClick={() => handleStartMigration(false)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    {migrating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الترحيل ({activeProgressPct}%)...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>بدء الترحيل الآن ({scanPreview.totalDetected} سجل)</span>
                      </>
                    )}
                  </button>

                  {migrating && (
                    <button
                      type="button"
                      onClick={handlePauseMigration}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer"
                    >
                      <PauseCircle className="w-4 h-4" />
                      <span>إيقاف مؤقت بأمان</span>
                    </button>
                  )}

                  {!migrating && (
                    <button
                      type="button"
                      disabled={validating}
                      onClick={handleRunValidationOnly}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>فحص المطابقة</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Progress Bar & Counters */}
          {(migrating || progress) && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900">
                  {progress?.stepMessage || stepNotice || 'جاري التنفيذ...'}
                </span>
                <span className="font-mono font-bold text-[#1E3A5F]">
                  {activeProgressPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1E3A5F] transition-all duration-200"
                  style={{ width: `${activeProgressPct}%` }}
                />
              </div>
              {progress && (
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="p-1.5 bg-white border border-slate-200 rounded">
                    مرصود: <strong>{progress.detectedCount}</strong>
                  </div>
                  <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
                    تم ترحيله: <strong>{progress.migratedCount}</strong>
                  </div>
                  <div className="p-1.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    تم تخطيه: <strong>{progress.skippedCount}</strong>
                  </div>
                  <div
                    className={`p-1.5 border rounded ${
                      progress.failedCount > 0
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    فشل: <strong>{progress.failedCount}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {/* Completion Report */}
          {report && (
            <div
              className={`p-4 rounded-xl border space-y-3 text-xs ${
                report.failedCount === 0 && !report.interrupted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  {report.failedCount === 0 && !report.interrupted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  )}
                  <span>
                    {report.interrupted
                      ? 'توقف الترحيل بأمان — يمكنك الاستكمال في أي وقت'
                      : report.failedCount === 0
                        ? 'تقرير اكتمال الترحيل: نجحت العملية بالكامل'
                        : 'تقرير الترحيل: اكتمل مع وجود بعض السجلات التي تحتاج مراجعة'}
                  </span>
                </div>
                <span className="text-[11px] font-mono">
                  {(report.durationMs / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-white/80 rounded-lg border border-black/5">
                  <div className="font-bold text-base">{report.detectedCount}</div>
                  <div className="text-[11px]">سجل مرصود</div>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-black/5">
                  <div className="font-bold text-base text-emerald-800">
                    {report.migratedCount}
                  </div>
                  <div className="text-[11px]">تم ترحيله</div>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-black/5">
                  <div className="font-bold text-base text-slate-700">
                    {report.skippedCount}
                  </div>
                  <div className="text-[11px]">تم تخطيه</div>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-black/5">
                  <div className="font-bold text-base text-red-700">
                    {report.failedCount}
                  </div>
                  <div className="text-[11px]">فشل</div>
                </div>
              </div>

              <p className="text-[11px]">
                الملفات المرفوعة إلى Storage: <strong>{report.filesMigrated}</strong> مستند ·{' '}
                <strong>{report.imagesMigrated}</strong> صورة ·{' '}
                <strong>{report.audioMigrated}</strong> مقطع صوتي.
              </p>

              {(report.interrupted || report.failedCount > 0) && (
                <button
                  type="button"
                  disabled={migrating}
                  onClick={() => handleStartMigration(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استكمال / إعادة محاولة السجلات المتبقية</span>
                </button>
              )}

              {report.errors.length > 0 && (
                <div className="p-2.5 bg-white border border-red-200 rounded-lg space-y-1 max-h-40 overflow-y-auto">
                  <div className="font-bold text-red-800 text-[11px]">
                    سجل الأخطاء التفصيلي ({report.errors.length}):
                  </div>
                  {report.errors.map((err, i) => (
                    <div
                      key={i}
                      className="text-[11px] font-mono text-red-700 border-b border-red-100 pb-1 last:border-b-0"
                    >
                      [{err.collection} → {err.supabaseTable} · docId={err.docId}]{' '}
                      {err.message}
                    </div>
                  ))}
                </div>
              )}

              {report.warnings.length > 0 && (
                <div className="p-2.5 bg-white/90 border border-amber-200 rounded-lg space-y-0.5 max-h-28 overflow-y-auto">
                  <div className="font-semibold text-amber-900 text-[11px]">
                    ملاحظات ({report.warnings.length}):
                  </div>
                  {report.warnings.map((w, i) => (
                    <div key={i} className="text-[11px] text-amber-800">
                      • {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Phase 4 Validation Report */}
          {validating && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-700">
              <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
              <span>جاري التحقق من مطابقة الأعداد، الملكية، عدم التكرار، وسلامة الروابط...</span>
            </div>
          )}

          {validation && (
            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {validation.allPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  )}
                  <h3 className="text-sm font-bold text-slate-900">
                    نتائج التحقق والمطابقة بعد الترحيل ({validation.validatedAt})
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={validating}
                  onClick={handleRunValidationOnly}
                  className="text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  إعادة التحقق
                </button>
              </div>

              <div className="space-y-1.5">
                {validation.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      chk.ok
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    {chk.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{chk.label}</div>
                      <div className="text-[11px] opacity-90">{chk.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2.5 font-semibold">الجدول</th>
                      <th className="py-1.5 px-2 font-semibold text-center">Firestore</th>
                      <th className="py-1.5 px-2 font-semibold text-center">Supabase</th>
                      <th className="py-1.5 px-2 font-semibold text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validation.tableComparisons.map((row) => (
                      <tr key={row.supabaseTable}>
                        <td className="py-1.5 px-2.5">
                          {row.labelAr}{' '}
                          <span className="text-[10px] font-mono text-slate-400">
                            ({row.supabaseTable})
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono">
                          {row.firestoreCount}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono font-semibold">
                          {row.supabaseCount}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {row.matched ? (
                            <span className="text-emerald-700 font-semibold">متطابق</span>
                          ) : (
                            <span className="text-red-700 font-semibold">ناقص</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
