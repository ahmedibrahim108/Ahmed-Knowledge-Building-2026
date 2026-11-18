import { GoogleGenAI } from '@google/genai';

interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (data: unknown) => void;
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

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
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

    res.status(200).json({ audioBase64, mimeType: 'audio/wav' });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'تعذر تشغيل القراءة الصوتية حاليًا.';
    res.status(500).json({ error: message });
  }
}
