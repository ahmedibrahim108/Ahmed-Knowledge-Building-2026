import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Send,
} from 'lucide-react';
import { PublicSiteConfig } from '../data/curriculumData';
import { saveContactMessageLocalFallback } from '../services/supabaseSync';
import AutoResizeTextarea from './AutoResizeTextarea';

interface ContactUsSectionProps {
  siteConfig: PublicSiteConfig;
  defaultName?: string;
  defaultEmail?: string;
}

export default function ContactUsSection({
  siteConfig,
  defaultName = '',
  defaultEmail = '',
}: ContactUsSectionProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (siteConfig.showContactForm === false) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (cleanName.length < 2) {
      setErrorMsg('يرجى كتابة الاسم (حرفان على الأقل).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (cleanMessage.length < 5) {
      setErrorMsg('يرجى كتابة رسالة واضحة (5 أحرف على الأقل).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          subject: cleanSubject,
          message: cleanMessage,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        persisted?: boolean;
        needsMigration012?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setErrorMsg(json.error || 'تعذر إرسال الرسالة حاليًا. حاول مرة أخرى.');
        return;
      }

      if (json.needsMigration012 || !json.persisted) {
        saveContactMessageLocalFallback({
          id: json.id || `msg_${Date.now()}`,
          senderName: cleanName,
          senderEmail: cleanEmail,
          subject: cleanSubject,
          message: cleanMessage,
          status: 'unread',
          createdAtMs: Date.now(),
        });
      }

      setSuccessMsg(
        json.message || 'تم استلام رسالتك وحفظها في صندوق رسائل المنصة بنجاح.'
      );
      setSubject('');
      setMessage('');
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم حاليًا. تأكد من اتصالك وحاول مجددًا.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="contact-us-section"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
            <h2 className="font-editorial text-2xl font-bold text-slate-900">
              تواصل معنا
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            هل لديك سؤال حول المحتوى المعرفي أو مقترح تعاون؟ أرسل رسالتك مباشرة وستُحفظ في صندوق رسائل{' '}
            <span className="font-semibold text-slate-900">
              {siteConfig.creatorName || 'Ahmed Ibrahim'}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {siteConfig.linkedinUrl && (
            <a
              href={siteConfig.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E3A5F] bg-[#F0F4F9] hover:bg-[#E3ECF6] border border-[#1E3A5F]/20 rounded-xl"
            >
              <span>LinkedIn · {siteConfig.creatorName || 'Ahmed Ibrahim'}</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
          {siteConfig.contactEmail && (
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-xl"
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              <span dir="ltr">{siteConfig.contactEmail}</span>
            </a>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              الاسم *
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الكامل"
              className="w-full px-3.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              البريد الإلكتروني *
            </label>
            <input
              type="email"
              required
              maxLength={160}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              الموضوع
            </label>
            <input
              type="text"
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="موضوع الرسالة (اختياري)"
              className="w-full px-3.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 block">
            الرسالة *
          </label>
          <AutoResizeTextarea
            required
            minRows={3}
            maxLength={3200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب رسالتك أو استفسارك هنا..."
            className="w-full px-3.5 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-xl focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{submitting ? 'جاري الإرسال...' : 'إرسال الرسالة'}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
