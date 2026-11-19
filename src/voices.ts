import { voices as fetchVoices, type Voice } from '@realtimex/piper-tts-web';

export type { Voice };

/** Voces en español que se muestran primero en el selector. */
export const FEATURED_VOICE_IDS = [
  'es_ES-davefx-medium',
  'es_ES-sharvard-medium',
  'es_MX-ald-medium',
  'es_MX-claude-high',
  'es_ES-carlfm-x_low',
  'es_ES-mls_10246-low',
  'es_ES-mls_9972-low',
] as const;

/** Copia local por si no hay conexión al cargar el catálogo remoto. */
const FALLBACK: Voice[] = FEATURED_VOICE_IDS.map((key) => ({
  key,
  name: key.split('-').slice(1, -1).join(' '),
  language: {
    code: key.startsWith('es_MX') ? 'es_MX' : 'es_ES',
    family: 'español',
    region: key.startsWith('es_MX') ? 'México' : 'España',
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

/** Devuelve todas las voces Piper disponibles (español primero). Sin llamadas a una API propia. */
export async function getVoices(): Promise<Voice[]> {
  if (cache) return cache;
  try {
    const all = await fetchVoices();
    cache = all.length ? all : FALLBACK;
  } catch {
    cache = FALLBACK;
  }
  return cache;
}

export function voiceRegion(voice: Voice): string {
  return voice.language?.country_english || voice.language?.region || voice.language?.code || '';
}

export function voiceLanguageLabel(voice: Voice): string {
  const english = voice.language?.name_english || voice.language?.name_native || voice.language?.code || 'Otros';
  return english.charAt(0).toUpperCase() + english.slice(1);
}

export function voiceQualityLabel(voice: Voice): string {
  const q = String(voice.quality || '').toLowerCase();
  if (q === 'x_low') return 'Ultra ligera';
  if (q === 'low') return 'Ligera';
  if (q === 'medium') return 'Media';
  if (q === 'high') return 'Alta';
  return voice.quality || '';
}
