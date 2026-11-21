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
