import express from 'express';
import { EdgeTTS } from '@andresaya/edge-tts';

const app = express();
app.use(express.json());
const PORT = 3000;

app.post('/api/tts/generate', async (req, res) => {
  try {
    const { text, voice = 'es-ES-ElviraNeural' } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Debes proporcionar un texto.' });
    }
    const tts = new EdgeTTS();
    const result = await tts.generate(String(text).trim(), voice);
    const base64 = (result as any).audio.toString('base64');
    res.json({ success: true, audioBase64: base64, mimeType: 'audio/mpeg', voice });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Error' });
  }
});

app.use(express.static('dist'));
app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: 'dist' }));

app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));