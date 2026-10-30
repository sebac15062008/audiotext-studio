import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Loader2, Mic, Moon, Sparkles, Sun, Volume2 } from 'lucide-react';

const VOICES = [
  { id: 'es-ES-ElviraNeural', label: 'Elvira', language: 'Espanol (Espana)', gender: 'Femenina' },
  { id: 'es-ES-AlvaroNeural', label: 'Alvaro', language: 'Espanol (Espana)', gender: 'Masculina' },
  { id: 'es-MX-DaliaNeural', label: 'Dalia', language: 'Espanol (Mexico)', gender: 'Femenina' },
  { id: 'es-MX-JorgeNeural', label: 'Jorge', language: 'Espanol (Mexico)', gender: 'Masculina' },
];

export default function App() {
  const [text, setText] = useState(
    'Escribe aqui el texto que quieres convertir en audio.'
  );
  const [voice, setVoice] = useState('es-ES-ElviraNeural');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMenuUp, setVoiceMenuUp] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('audiotext-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const audioUrlRef = useRef<string | null>(null);
  const voiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('audiotext-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Escribe un texto antes de generar el audio.');
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), voice }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo generar el audio.');
      }
      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      setAudioUrl(url);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el audio.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceRef.current && !voiceRef.current.contains(event.target as Node)) {
        setVoiceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const selectedVoice = VOICES.find((v) => v.id === voice) ?? VOICES[0];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-teal-50/70 via-white to-stone-50 text-stone-950 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 dark:text-stone-50">
      <header className="shrink-0 border-b border-stone-200 dark:border-stone-700/80 bg-white dark:bg-stone-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight sm:text-lg">AudioText Studio</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 sm:text-sm">Texto a audio natural</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 transition hover:bg-stone-50 dark:hover:bg-stone-800"
            aria-label="Cambiar tema"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto flex flex-1 min-h-0 w-full max-w-2xl flex-col gap-3 overflow-hidden px-4 py-3 sm:py-4">
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 transition-all duration-300">
          <div className="flex shrink-0 items-center justify-between border-b border-stone-100 dark:border-stone-800 px-4 py-2">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">Texto a convertir</h2>
            <span className="text-xs tabular-nums text-stone-400 dark:text-stone-500">
              {wordCount} palabras · {charCount} caracteres
            </span>
          </div>
          <div className="flex min-h-0 flex-1 p-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isGenerating}
              placeholder="Escribe o pega aqui tu texto..."
              className="h-full w-full min-h-[80px] resize-none overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 px-4 py-3 text-sm leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 transition focus:border-teal-500 focus:bg-white dark:focus:bg-stone-900 focus:outline-none focus:outline focus:outline-2 focus:outline-teal-500 disabled:opacity-60"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 transition-all duration-300">
          <div className="border-b border-stone-100 dark:border-stone-800 px-4 py-2">
            <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">Configuracion de voz</h2>
          </div>
          <div className="p-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Voz
              </label>
              <div ref={voiceRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (isGenerating) return;
                    if (!voiceOpen && voiceRef.current) {
                      const rect = voiceRef.current.getBoundingClientRect();
                      setVoiceMenuUp(window.innerHeight - rect.bottom < 220);
                    }
                    setVoiceOpen((o) => !o);
                  }}
                  disabled={isGenerating}
                  className="flex w-full items-center justify-between rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 transition focus:border-teal-500 focus:bg-white dark:focus:bg-stone-900 focus:outline-none focus:outline focus:outline-2 focus:outline-teal-500 disabled:opacity-60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40 text-xs font-semibold text-teal-700 dark:text-teal-300">
                      {selectedVoice.label.charAt(0)}
                    </span>
                    <span className="flex flex-col text-left">
                      <span className="font-medium">{selectedVoice.label}</span>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {selectedVoice.language} · {selectedVoice.gender}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-stone-400 dark:text-stone-500 transition ${voiceOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {voiceOpen && (
                  <div className={`absolute z-20 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-1 ${voiceMenuUp ? 'animate-menu-up bottom-full mb-2' : 'animate-menu-down mt-2'}`}>
                    {VOICES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVoice(v.id);
                          setVoiceOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                          voice === v.id
                            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                            : 'text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800 text-xs font-semibold text-stone-600 dark:text-stone-300">
                          {v.label.charAt(0)}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium">{v.label}</span>
                          <span className="text-xs text-stone-500 dark:text-stone-400">
                            {v.language} · {v.gender}
                          </span>
                        </span>
                        {voice === v.id && (
                          <span className="ml-auto text-xs font-semibold text-teal-600 dark:text-teal-400">Activa</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-teal-500 hover:to-emerald-500 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generando audio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generar audio (MP3)</span>
                </>
              )}
            </button>

            {error && (
              <div className="animate-fade-in mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </section>

        {audioUrl && (
          <section className="animate-slide-up rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 px-4 py-2">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">Audio listo</h2>
              <a
                href={audioUrl}
                download="audio-texto.mp3"
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-500"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar MP3
              </a>
            </div>
            <div className="p-4">
              <audio controls src={audioUrl} className="w-full" />
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                El audio se genera en el servidor (sin API key).
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="shrink-0 py-2" />
    </div>
  );
}