import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '16mb' }));

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeAudioMimeType(raw?: string): string {
  if (!raw || typeof raw !== 'string') return 'audio/webm';
  const base = raw.split(';')[0].trim().toLowerCase();
  if (
    base === 'audio/webm' ||
    base === 'audio/mp4' ||
    base === 'audio/m4a' ||
    base === 'audio/ogg' ||
    base === 'audio/wav' ||
    base === 'audio/mpeg' ||
    base === 'audio/mp3' ||
    base === 'audio/aac' ||
    base === 'audio/flac'
  ) {
    return base === 'audio/m4a' ? 'audio/mp4' : base;
  }
  return base.startsWith('audio/') ? base : 'audio/webm';
}

async function callTranscribeWithRetry(
  ai: GoogleGenAI,
  model: string,
  audioPart: { inlineData: { mimeType: string; data: string } },
  promptPart: { text: string }
) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ai.models.generateContent({
        model,
        contents: { parts: [audioPart, promptPart] },
      });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('fetch failed') ||
        msg.includes('ECONNRESET');
      if (!isTransient || attempt === 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr;
}

app.post('/api/transcribe', async (req, res) => {
  try {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(500).json({
        error: 'مفتاح GEMINI_API_KEY غير مهيأ على الخادم.',
      });
      return;
    }

    const body = req.body as {
      audioBase64?: string;
      mimeType?: string;
      dialect?: 'standard_arabic' | 'egyptian_arabic' | 'bilingual';
    };

    if (!body?.audioBase64 || typeof body.audioBase64 !== 'string') {
      res.status(400).json({ error: 'بيانات الصوت مفقودة أو غير صالحة.' });
      return;
    }

    if (body.audioBase64.length < 100) {
      res.status(422).json({
        error: 'التسجيل قصير جدًا أو فارغ. تحدّث لمدة ثانية على الأقل ثم أوقف التسجيل.',
      });
      return;
    }

    const mimeType = normalizeAudioMimeType(body.mimeType);

    const audioPart = {
      inlineData: {
        mimeType,
        data: body.audioBase64,
      },
    };

    const dialectPrompt =
      body.dialect === 'egyptian_arabic'
        ? 'فرّغ هذا التسجيل الصوتي بدقة إلى نص عربي مع الحفاظ على تعبيرات اللهجة المصرية الطبيعية وعلامات الترقيم المناسبة. إذا وردت مصطلحات إنجليزية اكتبها كما هي. أعد النص المفرّغ فقط بدون أي مقدمات.'
        : body.dialect === 'bilingual'
        ? 'فرّغ هذا التسجيل الصوتي بدقة مع ضبط العربية والإنجليزية معًا وعلامات الترقيم المناسبة. أعد النص المفرّغ فقط بدون أي مقدمات أو تعليقات.'
        : 'فرّغ هذا التسجيل الصوتي بدقة إلى نص عربي فصيح واضح ومضبوط الإملاء مع علامات الترقيم المناسبة. إذا كان الكلام بالإنجليزية ففرّغه كما هو. أعد النص المفرّغ فقط بدون أي مقدمات أو تعليقات.';

    const promptPart = {
      text: dialectPrompt,
    };

    let response;
    try {
      response = await callTranscribeWithRetry(
        ai,
        'gemini-3.5-transcribe',
        audioPart,
        promptPart
      );
    } catch (primaryErr) {
      const msg =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('not found') ||
        msg.includes('400')
      ) {
        response = await callTranscribeWithRetry(
          ai,
          'gemini-4-hydrogen',
          audioPart,
          promptPart
        );
      } else {
        throw primaryErr;
      }
    }

    const text = (response.text ?? '').trim();
    if (!text) {
      res.status(422).json({
        error: 'لم يتم التعرف على كلام واضح في التسجيل. حاول التحدث بوضوح وإعادة المحاولة.',
      });
      return;
    }

    res.json({ text });
  } catch (err) {
    console.error('Transcription error:', err);
    const rawMsg =
      err instanceof Error ? err.message : 'تعذر تحويل الصوت إلى نص حاليًا.';
    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      res.status(429).json({
        error: 'تم تجاوز حد الطلبات مؤقتًا. انتظر لحظات ثم أعد المحاولة.',
      });
      return;
    }
    res.status(500).json({ error: rawMsg });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(500).json({
        error: 'مفتاح GEMINI_API_KEY غير مهيأ على الخادم.',
      });
      return;
    }

    const body = req.body as {
      text?: string;
      voiceName?: string;
      speed?: 'normal' | 'calm';
    };

    const cleanText = (body?.text ?? '').trim().slice(0, 3500);
    if (!cleanText) {
      res.status(400).json({ error: 'لا يوجد نص للقراءة الصوتية.' });
      return;
    }

    const allowedVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
    const voiceName = allowedVoices.includes(body.voiceName || '')
      ? (body.voiceName as string)
      : 'Kore';

    const style =
      body.speed === 'calm'
        ? 'Calm, reflective, deliberate reading pace suitable for Arabic study notes'
        : 'Clear, warm, well-paced educational narration';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: { style },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const audioBase64 =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      res.status(500).json({ error: 'تعذر توليد الصوت حاليًا.' });
      return;
    }

    res.json({ audioBase64, mimeType: 'audio/wav' });
  } catch (err) {
    console.error('TTS error:', err);
    const message =
      err instanceof Error ? err.message : 'تعذر تشغيل القراءة الصوتية حاليًا.';
    res.status(500).json({ error: message });
  }
});

const CONTACT_RECIPIENT_EMAIL = 'ahmedibrahim108@outlook.com';
const contactRateLimiter = new Map<string, { count: number; resetAt: number }>();

function sanitizeContactString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeSingleLineHeader(raw: unknown, maxLen: number): string {
  return sanitizeContactString(raw, maxLen)
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function escapeEmailHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveResendFromAddress(): string {
  const raw = sanitizeSingleLineHeader(process.env.RESEND_FROM_EMAIL, 200);
  if (raw && /^([^<>]+<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,})$/.test(raw)) {
    return raw;
  }
  return 'Knowledge Balance <onboarding@resend.dev>';
}

app.post('/api/contact', async (req, res) => {
  try {
    const clientIp =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : '') ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const bucket = contactRateLimiter.get(clientIp);
    if (bucket && now < bucket.resetAt) {
      if (bucket.count >= 5) {
        res.status(429).json({
          error: 'تم إرسال عدة رسائل خلال وقت قصير. يرجى المحاولة بعد دقائق.',
        });
        return;
      }
      bucket.count += 1;
    } else {
      contactRateLimiter.set(clientIp, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const senderName = sanitizeSingleLineHeader(body.name, 100);
    const senderEmail = sanitizeSingleLineHeader(body.email, 160);
    const subject = sanitizeSingleLineHeader(body.subject, 200);
    const message = sanitizeContactString(body.message, 3200);

    if (senderName.length < 2) {
      res.status(400).json({ error: 'يرجى كتابة الاسم (حرفان على الأقل).' });
      return;
    }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRx.test(senderEmail)) {
      res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
      return;
    }
    if (message.length < 5) {
      res.status(400).json({ error: 'يرجى كتابة رسالة واضحة (5 أحرف على الأقل).' });
      return;
    }

    const id = `msg_${now}_${Math.floor(Math.random() * 10000)}`;
    const sentAtIso = new Date(now).toISOString();

    // 1. Direct email delivery to ahmedibrahim108@outlook.com via Resend HTTPS API
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const emailConfigured = resendApiKey.length > 0;
    let emailSent = false;
    let emailErrorDetail = '';

    if (emailConfigured) {
      const emailSubject = subject
        ? `[Knowledge Balance] ${subject}`
        : `[Knowledge Balance] رسالة جديدة من ${senderName}`;
      const fromAddress = resolveResendFromAddress();

      const textBody = [
        'رسالة جديدة من نموذج «تواصل معنا» — ميزان المعرفة (Knowledge Balance)',
        '',
        `المرسل: ${senderName}`,
        `البريد الإلكتروني: ${senderEmail}`,
        `الموضوع: ${subject || 'بدون موضوع'}`,
        `التاريخ (UTC): ${sentAtIso}`,
        `المعرف: ${id}`,
        '',
        'الرسالة:',
        message,
      ].join('\n');

      const htmlBody = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <body style="margin:0;padding:24px;background-color:#f8fafc;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#1e3a5f;color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:18px;font-weight:700;">رسالة جديدة من نموذج تواصل معنا</h1>
        <p style="margin:6px 0 0;font-size:13px;color:#cbd5e1;">ميزان المعرفة · Knowledge Balance</p>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
          <tr>
            <td style="padding:8px 0;color:#64748b;width:130px;font-weight:600;">الاسم:</td>
            <td style="padding:8px 0;color:#0f172a;font-weight:600;">${escapeEmailHtml(senderName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;">البريد الإلكتروني:</td>
            <td style="padding:8px 0;color:#1e3a5f;" dir="ltr">${escapeEmailHtml(senderEmail)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;">الموضوع:</td>
            <td style="padding:8px 0;color:#0f172a;">${escapeEmailHtml(subject || 'بدون موضوع')}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;">التاريخ (UTC):</td>
            <td style="padding:8px 0;color:#475569;font-size:12px;" dir="ltr">${escapeEmailHtml(sentAtIso)}</td>
          </tr>
        </table>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
          <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px;">نص الرسالة:</div>
          <div style="font-size:14px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${escapeEmailHtml(message)}</div>
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;" dir="ltr">Reference ID: ${escapeEmailHtml(id)}</p>
      </div>
    </div>
  </body>
</html>`.trim();

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [CONTACT_RECIPIENT_EMAIL],
            reply_to: senderEmail,
            subject: emailSubject,
            text: textBody,
            html: htmlBody,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          const errBody = await resendRes.text().catch(() => '');
          emailErrorDetail = `HTTP ${resendRes.status}`;
          console.warn('Resend delivery failed:', resendRes.status, errBody.slice(0, 300));
        }
      } catch (err) {
        emailErrorDetail = 'network_error';
        console.warn('Resend delivery error:', err instanceof Error ? err.message : String(err));
      }
    }

    // 2. Persist record to Supabase contact_messages if configured and migrated
    const payload = {
      id,
      sender_name: senderName,
      sender_email: senderEmail,
      subject,
      message,
      status: 'unread',
      created_at_ms: now,
    };

    let persisted = false;
    let needsMigration012 = false;
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const supabaseKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    if (supabaseUrl && supabaseKey) {
      try {
        const sbRes = await fetch(`${supabaseUrl}/rest/v1/contact_messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(payload),
        });
        if (sbRes.ok) {
          persisted = true;
        } else {
          const errText = await sbRes.text().catch(() => '');
          if (errText.includes('contact_messages') || sbRes.status === 404) {
            needsMigration012 = true;
          }
          console.warn('Supabase contact_messages insert non-OK:', sbRes.status, errText);
        }
      } catch (err) {
        console.warn('Supabase contact_messages fetch error:', err);
      }
    }

    if (emailSent) {
      res.status(201).json({
        ok: true,
        id,
        emailSent: true,
        emailConfigured: true,
        persisted,
        needsMigration012,
        message: persisted
          ? 'تم إرسال رسالتك إلى البريد الإلكتروني وحفظها في صندوق رسائل المنصة بنجاح.'
          : 'تم إرسال رسالتك مباشرة إلى البريد الإلكتروني بنجاح.',
      });
      return;
    }

    if (persisted) {
      res.status(202).json({
        ok: true,
        id,
        emailSent: false,
        emailConfigured,
        persisted: true,
        needsMigration012: false,
        message: emailConfigured
          ? 'تم حفظ رسالتك في صندوق رسائل المنصة، لكن تعذر تسليم النسخة البريدية حاليًا.'
          : 'تم حفظ رسالتك في صندوق رسائل المنصة، لكن خدمة الإرسال البريدي المباشر (RESEND_API_KEY) غير مفعّلة على الخادم بعد.',
      });
      return;
    }

    if (!emailConfigured) {
      res.status(503).json({
        ok: false,
        emailSent: false,
        emailConfigured: false,
        persisted: false,
        needsMigration012,
        error:
          'خدمة إرسال البريد على الخادم غير مهيأة بعد (مفتاح RESEND_API_KEY غير مضبوط). يمكنك التواصل مباشرة عبر البريد الإلكتروني الظاهر في الصفحة.',
      });
      return;
    }

    res.status(502).json({
      ok: false,
      emailSent: false,
      emailConfigured: true,
      persisted: false,
      needsMigration012,
      error: emailErrorDetail
        ? `تعذر تسليم الرسالة عبر مزود البريد الإلكتروني حاليًا (${emailErrorDetail}). يرجى المحاولة لاحقًا أو مراسلتنا عبر البريد المباشر.`
        : 'تعذر تسليم الرسالة عبر مزود البريد الإلكتروني حاليًا. يرجى المحاولة لاحقًا.',
    });
  } catch (err) {
    console.error('Contact route error:', err);
    res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء إرسال الرسالة.' });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const disableHmr =
      process.env.DISABLE_HMR === 'true' ||
      Boolean(process.env.K_SERVICE) ||
      Boolean(process.env.APPLET_ID);
    if (disableHmr) {
      process.env.DISABLE_HMR = 'true';
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : { server: httpServer },
        watch: disableHmr ? null : undefined,
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.use((req, res, next) => {
        if (!req.url.startsWith('/@vite/client')) {
          next();
          return;
        }
        delete req.headers['accept-encoding'];
        const chunks: Buffer[] = [];
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);

        res.write = ((
          chunk: unknown,
          encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
          cb?: (error: Error | null | undefined) => void
        ) => {
          if (chunk) {
            chunks.push(
              Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(
                    String(chunk),
                    typeof encoding === 'string' ? encoding : 'utf8'
                  )
            );
          }
          if (typeof encoding === 'function') {
            encoding(null);
          } else if (typeof cb === 'function') {
            cb(null);
          }
          return true;
        }) as typeof res.write;

        res.end = ((
          chunk?: unknown,
          encoding?: BufferEncoding | (() => void),
          cb?: () => void
        ) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(
              Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(
                    String(chunk),
                    typeof encoding === 'string' ? encoding : 'utf8'
                  )
            );
          }
          let body = Buffer.concat(chunks).toString('utf8');
          body = body.replace(
            /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
            'let wsTransport = { async connect() {}, async disconnect() {}, send() {} };'
          );
          const outBuf = Buffer.from(body, 'utf8');
          res.removeHeader('Content-Length');
          res.setHeader('Content-Length', outBuf.length);
          res.write = origWrite;
          res.end = origEnd;
          if (typeof chunk === 'function') {
            return origEnd(outBuf, chunk as () => void);
          }
          if (typeof encoding === 'function') {
            return origEnd(outBuf, encoding as () => void);
          }
          return typeof cb === 'function' ? origEnd(outBuf, cb) : origEnd(outBuf);
        }) as typeof res.end;

        next();
      });
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
