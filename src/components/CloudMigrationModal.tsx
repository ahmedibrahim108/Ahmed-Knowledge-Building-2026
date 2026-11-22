import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { isSupabaseConfigured, supabaseInitError } from '../services/supabaseClient';
import {
  MigrationReport,
  WorkspaceBackupSnapshot,
  exportWorkspaceBackupJson,
  migrateLegacyFirebaseToSupabase,
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
  const [migrating, setMigrating] = useState(false);
  const [stepMsg, setStepMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [backupNotice, setBackupNotice] = useState(false);

  if (!open) return null;

  const handleDownloadBackup = () => {
    if (!snapshot) return;
    exportWorkspaceBackupJson(snapshot);
    setBackupNotice(true);
    window.setTimeout(() => setBackupNotice(false), 4000);
  };

  const handleMigrate = async () => {
    if (!user) return;
    setMigrating(true);
    setErrorMsg(null);
    setReport(null);
    setStepMsg('جاري البدء...');
    try {
      const res = await migrateLegacyFirebaseToSupabase(user, (msg) =>
        setStepMsg(msg)
      );
      setReport(res);
      onMigrationComplete?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام الترحيل من Firebase إلى Supabase.'
      );
    } finally {
      setMigrating(false);
    }
  };

  const totalRowsMigrated = report
    ? Object.values(report.collections).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="النسخ الاحتياطي والترحيل السحابي"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              النسخ الاحتياطي والترحيل إلى Supabase
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>تسجيل الدخول (Firebase Auth) محفوظ بالكامل</span>
            </div>
            <p className="text-xs text-slate-600">
              تُحفظ البيانات والملفات والتسجيلات الصوتية الآن في Supabase PostgreSQL و Supabase Storage تحت نفس حسابك في Google، دون المساس بحسابك أو حذف بياناتك القديمة.
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

          {/* Step 1: JSON Backup */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                1. تنزيل نسخة احتياطية كاملة (JSON)
              </h3>
              <button
                type="button"
                disabled={!snapshot}
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تنزيل النسخة</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              يحفظ جميع خططك، الكورسات، الملاحظات، المهام، التقويم، المسارات، والحالات الإكلينيكية في ملف واحد آمن على جهازك.
            </p>
            {backupNotice && (
              <p className="text-xs font-medium text-emerald-700">
                تم تنزيل ملف النسخة الاحتياطية بنجاح.
              </p>
            )}
          </div>

          {/* Step 2: Non-destructive Firebase -> Supabase Import */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                2. نقل البيانات السابقة من Firebase إلى Supabase
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              يقرأ بياناتك السابقة (Firestore وملفات Storage) بحسابك الحالي وينسخها بأمان إلى Supabase دون حذف أي شيء من Firebase.
            </p>
            <button
              type="button"
              disabled={!user || !isSupabaseConfigured || migrating}
              onClick={handleMigrate}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{stepMsg || 'جاري الترحيل...'}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>بدء الترحيل الآمن من Firebase إلى Supabase</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {report && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>اكتمل الترحيل بنجاح</span>
              </div>
              <p>
                تم نقل {totalRowsMigrated} سجل بيانات، و {report.filesMigrated} ملف مستند (PDF/Word)، و {report.imagesMigrated} صورة، و {report.audioMigrated} مقطع صوتي إلى Supabase.
              </p>
              {report.warnings.length > 0 && (
                <ul className="list-disc pr-4 text-[11px] text-amber-900 space-y-0.5 pt-1">
                  {report.warnings.slice(0, 4).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
