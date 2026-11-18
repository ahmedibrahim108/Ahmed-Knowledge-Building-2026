import 'dotenv/config';
import express from 'express';
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
    };

    if (!body?.audioBase64 || typeof body.audioBase64 !== 'string') {
      res.status(400).json({ error: 'بيانات الصوت مفقودة أو غير صالحة.' });
      return;
    }

    const mimeType = normalizeAudioMimeType(body.mimeType);

    const audioPart = {
      inlineData: {
        mimeType,
        data: body.audioBase64,
      },
    };

    const promptPart = {
      text: 'فرّغ هذا التسجيل الصوتي بدقة إلى نص عربي واضح ومضبوط الإملاء مع علامات الترقيم المناسبة. إذا كان الكلام بالإنجليزية ففرّغه كما هو. أعد النص المفرّغ فقط بدون أي مقدمات أو تعليقات.',
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: { parts: [audioPart, promptPart] },
      });
    } catch (primaryErr) {
      const msg =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found')) {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts: [audioPart, promptPart] },
        });
      } else {
        throw primaryErr;
      }
    }

    const text = (response.text ?? '').trim();
    if (!text) {
      res.status(422).json({
        error: 'لم يتم التعرف على كلام واضح في التسجيل. حاول التسجيل مرة أخرى.',
      });
      return;
    }

    res.json({ text });
  } catch (err) {
    console.error('Transcription error:', err);
    const message =
      err instanceof Error ? err.message : 'تعذر تحويل الصوت إلى نص حاليًا.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
