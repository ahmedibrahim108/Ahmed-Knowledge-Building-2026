import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Monitor,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  /**
   * 'default' = regular install CTA button
   * 'utility-mobile' = small subtle top-bar trigger tailored to Mobile install
   * 'utility-desktop' = small subtle top-bar trigger tailored to Desktop standalone app install
   */
  variant?: 'default' | 'utility-mobile' | 'utility-desktop';
}

export default function PWAInstallButton({
  compact = false,
  variant = 'default',
}: PWAInstallButtonProps) {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
  } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [guideFocus, setGuideFocus] = useState<'mobile' | 'desktop'>(() =>
    variant === 'utility-desktop' ? 'desktop' : 'mobile'
  );
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isUtility = variant === 'utility-mobile' || variant === 'utility-desktop';

  // In standalone mode hide prominent install CTA, or render quiet status indicator on desktop if not utility
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setGuideFocus(variant === 'utility-desktop' ? 'desktop' : 'mobile');
    if (isInstallable) {
      setInstalling(true);
      try {
        const accepted = await install();
        if (!accepted) {
          return;
        }
      } finally {
        setInstalling(false);
      }
      return;
    }

    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked in restricted contexts
    }
  };

  const renderTrigger = () => {
    if (variant === 'utility-mobile') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          title="تثبيت كتطبيق على الهاتف (Android / iPhone)"
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] hover:bg-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{installing ? 'جاري التثبيت...' : 'تطبيق الهاتف'}</span>
        </button>
      );
    }
    if (variant === 'utility-desktop') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          title="تنزيل كتطبيق مستقل على الكمبيوتر (Desktop App)"
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] hover:bg-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Monitor className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{installing ? 'جاري التثبيت...' : 'تطبيق الكمبيوتر'}</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        title="تثبيت تطبيق ميزان المعرفة على الهاتف أو الكمبيوتر"
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] ${
          compact
            ? 'px-2.5 py-1.5 text-xs border border-[#1E3A5F]/25 bg-[#1E3A5F]/5 text-[#1E3A5F] hover:bg-[#1E3A5F]/10'
            : 'px-3 py-2 text-xs sm:text-sm border border-[#1E3A5F]/25 bg-[#1E3A5F]/8 text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          {installing
            ? 'جاري التثبيت...'
            : compact
            ? 'تثبيت التطبيق'
            : 'تثبيت التطبيق الآن'}
        </span>
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1E3A5F] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  {guideFocus === 'desktop' ? (
                    <Monitor className="w-5 h-5 text-amber-300" aria-hidden="true" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-amber-300" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h3
                    id="pwa-install-title"
                    className="text-base font-bold leading-snug"
                  >
                    {guideFocus === 'desktop'
                      ? 'تنزيل ميزان المعرفة كتطبيق كمبيوتر مستقل'
                      : 'تثبيت ميزان المعرفة على الهاتف'}
                  </h3>
                  <p className="text-xs text-slate-200">
                    يعمل بنافذة مستقلة سريعة ودون شريط متصفح مع دعم التخزين المحلي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm text-slate-700">
              {isUtility && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setGuideFocus('mobile')}
                    className={`flex-1 py-1.5 px-2.5 rounded-md font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      guideFocus === 'mobile'
                        ? 'bg-white text-[#1E3A5F] shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تثبيت على الهاتف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideFocus('desktop')}
                    className={`flex-1 py-1.5 px-2.5 rounded-md font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      guideFocus === 'desktop'
                        ? 'bg-white text-[#1E3A5F] shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تطبيق للكمبيوتر</span>
                  </button>
                </div>
              )}

              {isInIframe && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2.5">
                  <p className="text-xs font-medium text-amber-900 leading-relaxed">
                    أنت تشاهد التطبيق الآن داخل نافذة معاينة. لتفعيل التثبيت المباشر على جهازك، افتح رابط التطبيق مباشرة في المتصفح:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={
                        typeof window !== 'undefined' ? window.location.href : '/'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#162C49]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>فتح في نافذة مستقلة</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs font-medium hover:bg-amber-100 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          <span>تم نسخ الرابط</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {guideFocus === 'desktop' ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                    <Monitor className="w-4 h-4" aria-hidden="true" />
                    <span>تثبيت تطبيق مستقل على اللابتوب / الكمبيوتر (Chrome أو Edge):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed">
                    <li>
                      في متصفح <strong>Google Chrome</strong> أو <strong>Microsoft Edge</strong>، انظر إلى أيقونة <strong>التثبيت (شاشة وسهم)</strong> داخل شريط العنوان في الأعلى.
                    </li>
                    <li>
                      أو افتح قائمة المتصفح (<strong>⋮</strong>) ← <strong>حفظ ومشاركة (Cast, save, and share)</strong> ← <strong>تثبيت ميزان المعرفة كتطبيق</strong>.
                    </li>
                    <li>
                      يظهر التطبيق فورًا في قائمة البرامج / سطح المكتب ويفتح في نافذة منفصلة تمامًا عن المتصفح.
                    </li>
                  </ol>
                </div>
              ) : isIOS ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                    <Share className="w-4 h-4" aria-hidden="true" />
                    <span>خطوات التثبيت على iPhone و iPad (Safari):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed">
                    <li>
                      اضغط على زر <strong>المشاركة (Share)</strong> أسفل شريط المتصفح.
                    </li>
                    <li>
                      مرّر للأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong>.
                    </li>
                    <li>
                      اضغط <strong>«إضافة» (Add)</strong> ليظهر التطبيق بأيقونته على شاشتك.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" aria-hidden="true" />
                    <span>خطوات التثبيت على هاتف أندرويد (Chrome):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed">
                    <li>
                      افتح قائمة المتصفح (<strong>⋮</strong>) في أعلى الشاشة.
                    </li>
                    <li>
                      اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
                    </li>
                    <li>
                      أكّد بالضغط على <strong>«تثبيت»</strong>.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                    <p className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4" aria-hidden="true" />
                      <span>على الهاتف (Android / iPhone):</span>
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      في <strong>Android (Chrome)</strong>: قائمة (<strong>⋮</strong>) ← «تثبيت التطبيق». وفي <strong>iPhone (Safari)</strong>: زر المشاركة ← «إضافة إلى الشاشة الرئيسية».
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                    <p className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                      <Monitor className="w-4 h-4" aria-hidden="true" />
                      <span>على الكمبيوتر (Chrome أو Edge):</span>
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      اضغط على أيقونة <strong>التثبيت</strong> في يمين شريط العنوان، أو افتح قائمة المتصفح واختر <strong>«تثبيت ميزان المعرفة»</strong>.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                فهمت، إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
