import { voices as fetchVoices, type Voice } from '@realtimex/piper-tts-web';

export type { Voice };

/** Nombres amigables para las voces en español. */
const VOICE_NAMES: Record<string, string> = {
  'es_ES-davefx-medium': 'Daniel',
  'es_ES-sharvard-medium': 'Lucía',
  'es_MX-ald-medium': 'Alejandro',
  'es_MX-claude-high': 'Claudia',
  'es_ES-carlfm-x_low': 'Carlos',
  'es_ES-mls_10246-low': 'Marta',
  'es_ES-mls_9972-low': 'Pablo',
};

export function voiceName(voice: Voice): string {
  return VOICE_NAMES[voice.key] || voice.name;
}

/** Solo voces en español. */
export const SPANISH_VOICE_IDS = [
  'es_ES-davefx-medium',
  'es_ES-sharvard-medium',
  'es_MX-ald-medium',
  'es_MX-claude-high',
  'es_ES-carlfm-x_low',
  'es_ES-mls_10246-low',
  'es_ES-mls_9972-low',
] as const;

const FALLBACK: Voice[] = SPANISH_VOICE_IDS.map((key) => ({
  key,
  name: VOICE_NAMES[key] || key.split('-').slice(1, -1).join(' '),
  language: {
    code: key.startsWith('es_MX') ? 'es_MX' : 'es_ES',
    family: 'es',
    region: key.startsWith('es_MX') ? 'MX' : 'ES',
    name_native: 'Español',
    name_english: 'Spanish',
    country_english: key.startsWith('es_MX') ? 'Mexico' : 'Spain',
  },
  quality: key.includes('high') ? 'high' : key.includes('medium') ? 'medium' : 'low',
  num_speakers: 0,
  speaker_id_map: {},
  files: {},
  aliases: [],
}));

let cache: Voice[] | null = null;

export async function getVoices(): Promise<Voice[]> {
  if (cache) return cache;
  let all: Voice[] = [];
  try {
    all = await fetchVoices();
  } catch {
    all = [];
  }
  const spanish = all.filter((voice) => {
    const code = String(voice?.language?.code || '').toLowerCase();
    const family = String(voice?.language?.family || '').toLowerCase();
    return code.startsWith('es') || family === 'es';
  });

  cache = (spanish.length ? spanish : FALLBACK).sort((a, b) => {
    const aMx = String(a.language?.code || '').startsWith('es_MX') ? 1 : 0;
    const bMx = String(b.language?.code || '').startsWith('es_MX') ? 1 : 0;
    return aMx - bMx || voiceName(a).localeCompare(voiceName(b));
  });
  return cache;
}

export function voiceRegion(voice: Voice): string {
  const code = String(voice.language?.code || '');
  if (code === 'es_MX') return 'México';
  if (code === 'es_ES') return 'España';
  return voice.language?.country_english || voice.language?.region || code;
}

export function voiceLanguageLabel(voice: Voice): string {
  return voice.language?.name_native || voice.language?.name_english || 'Español';
}

export function voiceQualityLabel(voice: Voice): string {
  const q = String(voice.quality || '').toLowerCase();
  if (q === 'x_low') return 'Ultra ligera';
  if (q === 'low') return 'Ligera';
  if (q === 'medium') return 'Media';
  if (q === 'high') return 'Alta';
  return voice.quality || '';
}
