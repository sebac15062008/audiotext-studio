import { TtsSession, HF_BASE, PATH_MAP, download as downloadVoiceModel, type Progress } from '@realtimex/piper-tts-web';

export type { Progress };

const BASE = import.meta.env.BASE_URL || './';

/** ONNX Runtime resuelve las rutas del wasm desde su propio módulo, así que
 *  hay que pasarle URLs absolutas calculadas desde la página. */
function asset(path: string): string {
  return new URL(`${BASE}${path}`, document.baseURI).href;
}

let patched = false;
let localFiles: Set<string> | null = null;

/**
 * Si el modelo está incluido en `public/voices`, se sirve desde ahí (offline).
 * Si no, se descarga una única vez desde el repositorio estático de modelos y
 * se guarda en la caché del navegador. En ningún caso se envía el texto a un
 * servidor: la inferencia ocurre siempre en el dispositivo.
 */
function patchModelFetch() {
  if (patched) return;
  patched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.startsWith(HF_BASE)) {
      const file = url.substring(url.lastIndexOf('/') + 1);
      if (!localFiles) {
        try {
          const manifest = await originalFetch(asset('voices/manifest.json'));
          const names: string[] = manifest.ok ? await manifest.json() : [];
          localFiles = new Set(names);
        } catch {
          localFiles = new Set();
        }
      }
      if (localFiles.has(file)) {
        try {
          const local = await originalFetch(asset(`voices/${file}`), init);
          if (local.ok) return local;
        } catch {
          /* se usa la fuente original */
        }
      }
    }
    return originalFetch(input, init);
  };
}

export function isLocalVoice(voiceId: string): boolean {
  const path = (PATH_MAP as Record<string, string>)[voiceId];
  if (!path) return false;
  const file = path.substring(path.lastIndexOf('/') + 1);
  return localFiles?.has(file) ?? false;
}

export async function preloadLocalManifest() {
  patchModelFetch();
  if (localFiles) return;
  try {
    const res = await fetch(asset('voices/manifest.json'));
    localFiles = new Set(res.ok ? await res.json() : []);
  } catch {
    localFiles = new Set();
  }
}

/** Fuerza una sesión nueva para cada voz (la librería reutiliza una instancia singleton). */
function resetSession() {
  (TtsSession as unknown as { _instance: TtsSession | null })._instance = null;
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  onProgress?: (p: Progress) => void
): Promise<Blob> {
  patchModelFetch();
  resetSession();

  // ONNX Runtime usa workers cuando hay SharedArrayBuffer. Forzar 1 hilo evita
  // depender de cabeceras COOP/COEP tanto en Vercel como en Electron.
  const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency');
  Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 1 });

  try {
    const session = await TtsSession.create({
      voiceId: voiceId as never,
      progress: onProgress,
      wasmPaths: {
        onnxWasm: asset('onnx/'),
        piperData: asset('piper/piper_phonemize.data'),
        piperWasm: asset('piper/piper_phonemize.wasm'),
      },
      fallbackStrategy: 'local',
    });
    return await session.predict(text);
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'hardwareConcurrency', descriptor);
    else delete (navigator as unknown as Record<string, unknown>).hardwareConcurrency;
  }
}

/** Descarga el modelo de una voz a la caché local para poder usarla sin conexión. */
export function prefetchVoice(voiceId: string, onProgress?: (p: Progress) => void): Promise<void> {
  patchModelFetch();
  return downloadVoiceModel(voiceId as never, onProgress);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
