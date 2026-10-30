import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EdgeTTS } from '@andresaya/edge-tts';

export const config = { maxDuration: 60 };

const VOICES: Record<string, string> = {
  'es-ES-ElviraNeural': 'es-ES-ElviraNeural',
  'es-ES-AlvaroNeural': 'es-ES-AlvaroNeural',
  'es-MX-DaliaNeural': 'es-MX-DaliaNeural',
  'es-MX-JorgeNeural': 'es-MX-JorgeNeural',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo no permitido.' });
  }
  try {
    const { text, voice = 'es-ES-ElviraNeural' } = (req.body || {}) as any;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Debes proporcionar un texto.' });
    }
    const chosenVoice = VOICES[voice] ? voice : 'es-ES-ElviraNeural';
    const tts = new EdgeTTS();
    const result = await tts.generate(String(text).trim(), chosenVoice);
    const base64 = (result as any).audio.toString('base64');
    return res.json({ success: true, audioBase64: base64, mimeType: 'audio/mpeg', voice: chosenVoice });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error al generar audio.' });
  }
}