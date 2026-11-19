import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Loader2,
  Mic,
  Moon,
  Pause,
  Play,
  Search,
  Sparkles,
  Sun,
  Volume2,
} from 'lucide-react';
import AudioVisualizer from './components/AudioVisualizer';
import {
  downloadBlob,
  formatTime,
  generateSpeech,
  isLocalVoice,
  prefetchVoice,
  preloadLocalManifest,
  type Progress,
} from './tts';
import { getVoices, voiceLanguageLabel, voiceQualityLabel, voiceRegion, type Voice } from './voices';

type ElectronAPI = {
  isElectron: boolean;
  platform: string;
  saveAudio?: (data: number[], filename: string) => Promise<boolean>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const INITIAL_TEXT = 'Escribe aquí el texto que quieres convertir en audio.';

export default function App() {
  const [text, setText] = useState(INITIAL_TEXT);
  const [voiceId, setVoiceId] = useState('es_ES-davefx-medium');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('audiotext-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceBoxRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const isElectron = Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('audiotext-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    getVoices().then(setVoices);
    preloadLocalManifest();
  }, []);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (voiceBoxRef.current && !voiceBoxRef.current.contains(event.target as Node)) {
        setVoiceOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const selectedVoice = useMemo(
    () => voices.find((v) => v.key === voiceId),
    [voices, voiceId]
  );

  const filteredVoices = useMemo(() => {
    const q = voiceSearch.trim().toLowerCase();
    const list = q
      ? voices.filter((v) =>
          [v.name, v.key, v.language?.name_english, v.language?.country_english]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : voices;
    return [...list].sort((a, b) => {
      const aEs = a.key.startsWith('es_') ? 0 : 1;
      const bEs = b.key.startsWith('es_') ? 0 : 1;
      return aEs - bEs || a.name.localeCompare(b.name);
    });
  }, [voices, voiceSearch]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      setError('Escribe un texto antes de generar el audio.');
      return;
    }
    setError(null);
    setProgress(0);
    setIsGenerating(true);
    if (audioRef.current) audioRef.current.pause();

    try {
      const blob = await generateSpeech(text.trim(), voiceId, (p: Progress) => {
        if (p.total > 0) setProgress(Math.min(99, Math.round((p.loaded / p.total) * 100)));
      });
      const url = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setAudioBlob(blob);
      setAudioUrl(url);
      setCurrentTime(0);
      setDuration(0);
      setProgress(100);
      requestAnimationFrame(() => audioRef.current?.play().catch(() => undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el audio.');
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  }, [text, voiceId]);

  const handlePrefetch = async () => {
    setIsPrefetching(true);
    setPrefetchProgress(0);
    setError(null);
    try {
      await prefetchVoice(voiceId, (p) => {
        if (p.total > 0) setPrefetchProgress(Math.min(100, Math.round((p.loaded / p.total) * 100)));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar la voz.');
    } finally {
      setIsPrefetching(false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (audio.paused) audio.play().catch(() => undefined);
    else audio.pause();
  };

  const handleDownload = async () => {
    if (!audioBlob) return;
    const filename = `audiotext-${voiceId}.wav`;
    if (window.electronAPI?.saveAudio) {
      const buffer = await audioBlob.arrayBuffer();
      await window.electronAPI.saveAudio(Array.from(new Uint8Array(buffer)), filename);
      return;
    }
    downloadBlob(audioBlob, filename);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__mark"><Mic size={20} strokeWidth={2.2} /></div>
            <div className="brand__text">
              <h1>AudioText Studio</h1>
              <p>Texto a voz natural, 100 % local</p>
            </div>
          </div>
          <div className="topbar__actions">
            <span className="badge"><span className="badge__dot" /> Piper · ONNX local</span>
            {isElectron && <span className="badge badge--desktop">Escritorio</span>}
            <button
              className="icon-button"
              onClick={() => setDark((d) => !d)}
              title={dark ? 'Modo claro' : 'Modo oscuro'}
              aria-label="Cambiar tema"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="panel panel--editor">
          <div className="panel__head">
            <h2>Tu texto</h2>
            <span className="counter">{wordCount} palabras · {text.length} caracteres</span>
          </div>
          <div className="panel__body panel__body--editor">
            <textarea
              className="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isGenerating}
              placeholder="Escribe o pega aquí tu texto…"
              spellCheck={false}
            />
          </div>
        </section>

        <section className="panel panel--settings">
          <div className="panel__head">
            <h2>Voz y generación</h2>
            <span className="panel__hint">Sin API · sin subir tu texto</span>
          </div>
          <div className="panel__body">
            <label className="field-label">Voz</label>
            <div className="voice-select" ref={voiceBoxRef}>
              <button
                type="button"
                className={`voice-select__trigger ${voiceOpen ? 'is-open' : ''}`}
                onClick={() => setVoiceOpen((o) => !o)}
                disabled={isGenerating}
              >
                <span className="voice-select__avatar">
                  {(selectedVoice?.name || 'V').charAt(0).toUpperCase()}
                </span>
                <span className="voice-select__info">
                  <strong>{selectedVoice?.name ?? voiceId}</strong>
                  <small>
                    {selectedVoice
                      ? `${voiceLanguageLabel(selectedVoice)} · ${voiceRegion(selectedVoice)} · ${voiceQualityLabel(selectedVoice)}`
                      : 'Cargando voces…'}
                  </small>
                </span>
                <ChevronDown size={18} className="voice-select__chevron" />
              </button>

              {voiceOpen && (
                <div className="voice-menu">
                  <div className="voice-menu__search">
                    <Search size={16} />
                    <input
                      autoFocus
                      value={voiceSearch}
                      onChange={(e) => setVoiceSearch(e.target.value)}
                      placeholder="Buscar idioma o voz…"
                    />
                  </div>
                  <div className="voice-menu__list">
                    {filteredVoices.map((voice) => (
                      <button
                        type="button"
                        key={voice.key}
                        className={`voice-option ${voice.key === voiceId ? 'is-active' : ''}`}
                        onClick={() => {
                          setVoiceId(voice.key);
                          setVoiceOpen(false);
                          setVoiceSearch('');
                        }}
                      >
                        <span className="voice-option__avatar">{voice.name.charAt(0).toUpperCase()}</span>
                        <span className="voice-option__info">
                          <strong>{voice.name}</strong>
                          <small>{voiceLanguageLabel(voice)} · {voiceRegion(voice)} · {voiceQualityLabel(voice)}</small>
                        </span>
                        {voice.key === voiceId && <Check size={16} className="voice-option__check" />}
                      </button>
                    ))}
                    {!filteredVoices.length && <p className="voice-menu__empty">Sin resultados</p>}
                  </div>
                </div>
              )}
            </div>

            {!isLocalVoice(voiceId) && (
              <button
                type="button"
                className="prefetch-button"
                onClick={handlePrefetch}
                disabled={isPrefetching || isGenerating}
              >
                {isPrefetching
                  ? `Preparando voz para offline… ${prefetchProgress}%`
                  : 'Preparar esta voz para uso sin conexión'}
              </button>
            )}

            <button
              className="generate-button"
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="spin" size={18} />
                  <span>{progress > 0 ? `Preparando voz… ${progress}%` : 'Iniciando motor local…'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generar audio</span>
                </>
              )}
            </button>
            {isGenerating && (
              <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            )}
            {error && <p className="error-message">{error}</p>}
            <p className="privacy-note">
              El modelo se ejecuta en tu dispositivo. La primera vez se descarga la voz; después se reutiliza.
            </p>
          </div>
        </section>

        <section className="panel panel--result">
          <div className="panel__head">
            <h2>Resultado</h2>
            {audioUrl && (
              <button className="download-button" onClick={handleDownload}>
                <Download size={15} /> Descargar WAV
              </button>
            )}
          </div>

          <div className="panel__body panel__body--result">
            {!audioUrl ? (
              <div className="empty-state">
                <div className="empty-state__icon"><Volume2 size={30} /></div>
                <h3>Aquí aparecerá tu audio</h3>
                <p>Genera un texto y escucha el resultado con su visualizador en vivo.</p>
              </div>
            ) : (
              <>
                <div className={`visualizer ${isPlaying ? 'is-playing' : ''}`}>
                  <AudioVisualizer audioRef={audioRef} playing={isPlaying} ready={Boolean(audioUrl)} />
                </div>

                <div className="player">
                  <button className="play-button" onClick={togglePlay} aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <div className="player__timeline">
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.01}
                      value={Math.min(currentTime, duration || 0)}
                      onChange={(e) => {
                        const time = Number(e.target.value);
                        if (audioRef.current) audioRef.current.currentTime = time;
                        setCurrentTime(time);
                      }}
                      style={{ '--played': `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
                      aria-label="Progreso del audio"
                    />
                    <div className="player__times">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
