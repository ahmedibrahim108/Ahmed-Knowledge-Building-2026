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
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

    const mimeType =
      typeof body.mimeType === 'string' && body.mimeType.startsWith('audio/')
        ? body.mimeType.split(';')[0]
        : 'audio/webm';

    const audioPart = {
      inlineData: {
        mimeType,
        data: body.audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          {
            text: 'فرّغ هذا التسجيل الصوتي بدقة إلى نص عربي واضح ومضبوط الإملاء مع علامات الترقيم المناسبة، وأعد النص المفرّغ فقط بدون أي مقدمات أو تعليقات.',
          },
        ],
      },
    });

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
