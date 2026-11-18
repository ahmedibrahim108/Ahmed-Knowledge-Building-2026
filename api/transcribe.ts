import { GoogleGenAI } from '@google/genai';

interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (data: unknown) => void;
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

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'مفتاح GEMINI_API_KEY غير مهيأ على الخادم.',
      });
      return;
    }

    const body = (typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body) as {
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
        error:
          'التسجيل قصير جدًا أو فارغ. تحدّث لمدة ثانية على الأقل ثم أوقف التسجيل.',
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
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

    const promptPart = { text: dialectPrompt };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: { parts: [audioPart, promptPart] },
      });
    } catch {
      response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts: [audioPart, promptPart] },
      });
    }

    const text = (response.text ?? '').trim();
    if (!text) {
      res.status(422).json({
        error:
          'لم يتم التعرف على كلام واضح في التسجيل. حاول التحدث بوضوح وإعادة المحاولة.',
      });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    const rawMsg =
      err instanceof Error ? err.message : 'تعذر تحويل الصوت إلى نص حاليًا.';
    res.status(500).json({ error: rawMsg });
  }
}
