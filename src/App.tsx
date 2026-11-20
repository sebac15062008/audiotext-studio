import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Mic,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import LiveWave from './components/LiveWave';
import { downloadBlob, formatTime, generateSpeech, type Progress } from './tts';
import { getVoices, voiceName, voiceQualityLabel, voiceRegion, type Voice } from './voices';

type Stage = 'idle' | 'generating' | 'result';
type ElectronAPI = {
  isElectron: boolean;
  saveAudio?: (data: number[], filename: string) => Promise<boolean>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const INITIAL_TEXT = 'Escribe aquí el texto que quieres convertir en audio.';

export default function App() {
  const [stage, setStage] = useState<Stage>('idle');
  const [leaving, setLeaving] = useState(false);
  const [text, setText] = useState(INITIAL_TEXT);
  const [voiceId, setVoiceId] = useState('es_ES-davefx-medium');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMenuUp, setVoiceMenuUp] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveformInstance, setWaveformInstance] = useState<WaveSurfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('audiotext-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const voiceBoxRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('audiotext-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    getVoices().then(setVoices);
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

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  /** Cambia de pantalla y espera a que la nueva se haya dibujado antes de
   *  empezar el trabajo pesado, para que "Generando" aparezca al instante. */
  const changeStage = useCallback((next: Stage): Promise<void> => {
    return new Promise((resolve) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setLeaving(true);
      timerRef.current = window.setTimeout(() => {
        setStage(next);
        setLeaving(false);
        timerRef.current = null;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }, 120);
    });
  }, []);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.key === voiceId),
    [voices, voiceId]
  );

  const filteredVoices = useMemo(() => {
    const query = voiceSearch.trim().toLowerCase();
    const list = query
      ? voices.filter((voice) =>
          `${voiceName(voice)} ${voiceRegion(voice)} ${voiceQualityLabel(voice)}`
            .toLowerCase()
            .includes(query)
        )
      : voices;
    return [...list].sort((a, b) => {
      const aMx = a.key.startsWith('es_MX') ? 1 : 0;
      const bMx = b.key.startsWith('es_MX') ? 1 : 0;
      return aMx - bMx || voiceName(a).localeCompare(voiceName(b));
    });
  }, [voices, voiceSearch]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      url: audioUrl,
      height: 128,
      waveColor: dark ? '#78716c' : '#d6d3d1',
      progressColor: dark ? '#2dd4bf' : '#0d9488',
      cursorColor: dark ? '#5eead4' : '#0f766e',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 3,
      barRadius: 3,
      barMinHeight: 2,
      normalize: true,
      dragToSeek: true,
    });
    wavesurferRef.current = wavesurfer;
    setWaveformInstance(wavesurfer);
    wavesurfer.on('ready', (length) => setDuration(length));
    wavesurfer.on('timeupdate', (time) => setCurrentTime(time));
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => setIsPlaying(false));
    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
      setWaveformInstance(null);
    };
  }, [audioUrl, dark]);

  const clearAudio = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setAudioUrl(null);
    setAudioBlob(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      setError('Escribe un texto antes de generar el audio.');
      return;
    }
    setError(null);
    setProgress(0);
    await changeStage('generating');
    clearAudio();

    try {
      const blob = await generateSpeech(text.trim(), voiceId, (event: Progress) => {
        if (event.total > 0) {
          setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setProgress(100);
      setAudioBlob(blob);
      setAudioUrl(url);
      changeStage('result');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el audio.');
      setProgress(0);
      changeStage('idle');
    }
  }, [text, voiceId, clearAudio, changeStage]);

  const handleRestart = () => {
    wavesurferRef.current?.pause();
    setError(null);
    setProgress(0);
    changeStage('idle');
  };

  const toggleVoiceMenu = () => {
    if (!voiceOpen && voiceBoxRef.current) {
      const rect = voiceBoxRef.current.getBoundingClientRect();
      setVoiceMenuUp(window.innerHeight - rect.bottom < 280);
    }
    setVoiceOpen((open) => !open);
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
      <div className={`screen ${leaving ? 'is-leaving' : ''}`} key={stage}>
        {stage === 'idle' && (
          <main className="landing">
            <section className="hero">
              <div className="hero__mark"><Mic size={26} strokeWidth={2.2} /></div>
              <h1>AudioText Studio</h1>
              <p>Convierte tus textos en audio natural con voces en español.</p>
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setDark((value) => !value)}
                aria-label="Cambiar tema"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
                <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
              </button>
            </section>

            <section className="composer">
              <div className="composer__head">
                <h2>Texto a convertir</h2>
                <span className="counter">{wordCount} palabras · {text.length} caracteres</span>
              </div>

              <textarea
                className="text-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Escribe o pega aquí tu texto..."
                spellCheck={false}
              />

              <label className="field-label">Voz</label>
              <div className="voice-select" ref={voiceBoxRef}>
                <button
                  type="button"
                  className={`voice-select__trigger ${voiceOpen ? 'is-open' : ''}`}
                  onClick={toggleVoiceMenu}
                >
                  <span className="voice-select__avatar">
                    {(selectedVoice ? voiceName(selectedVoice) : 'V').charAt(0).toUpperCase()}
                  </span>
                  <span className="voice-select__info">
                    <strong>{selectedVoice ? voiceName(selectedVoice) : 'Cargando voces…'}</strong>
                    <small>
                      {selectedVoice
                        ? `${voiceRegion(selectedVoice)} · ${voiceQualityLabel(selectedVoice)}`
                        : 'Cargando voces…'}
                    </small>
                  </span>
                  <ChevronDown size={18} className="voice-select__chevron" />
                </button>

                {voiceOpen && (
                  <div className={`voice-menu ${voiceMenuUp ? 'voice-menu--up' : ''}`}>
                    <div className="voice-menu__search">
                      <Search size={16} />
                      <input
                        autoFocus
                        value={voiceSearch}
                        onChange={(event) => setVoiceSearch(event.target.value)}
                        placeholder="Buscar voz…"
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
                          <span className="voice-option__avatar">
                            {voiceName(voice).charAt(0).toUpperCase()}
                          </span>
                          <span className="voice-option__info">
                            <strong>{voiceName(voice)}</strong>
                            <small>{voiceRegion(voice)} · {voiceQualityLabel(voice)}</small>
                          </span>
                          {voice.key === voiceId && <Check size={16} className="voice-option__check" />}
                        </button>
                      ))}
                      {!filteredVoices.length && <p className="voice-menu__empty">Sin resultados</p>}
                    </div>
                  </div>
                )}
              </div>

              <button className="generate-button" onClick={handleGenerate}>
                <Sparkles size={17} />
                Generar audio
              </button>

              {error && <p className="error-message">{error}</p>}
            </section>
          </main>
        )}

        {stage === 'generating' && (
          <main className="stage">
            <div className="generation">
              <div className="gen-boxes" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span className="gen-box" key={index} />
                ))}
              </div>
              <h2>Generando tu audio…</h2>
              <p>{progress > 0 ? `Preparando la voz · ${progress}%` : 'Iniciando el motor de voz'}</p>
              {progress > 0 && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </main>
        )}

        {stage === 'result' && (
          <main className="stage">
            <section className="result-card">
              <div className="result-card__head">
                <div>
                  <h2>Audio listo</h2>
                  <p>
                    {selectedVoice ? voiceName(selectedVoice) : voiceId} · {selectedVoice ? voiceRegion(selectedVoice) : ''}
                  </p>
                </div>
                <button className="round-button" onClick={handleRestart} title="Generar otro audio">
                  <RotateCcw size={17} />
                </button>
              </div>

              <div className="waveform">
                <div className="waveform__engine" ref={waveformRef} />
                <LiveWave wavesurfer={waveformInstance} playing={isPlaying} dark={dark} />
              </div>

              <div className="player">
                <button
                  className="play-button"
                  onClick={() => wavesurferRef.current?.playPause().catch(() => undefined)}
                  aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                  {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
                </button>
                <div className="player__timeline">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => {
                      const time = Number(event.target.value);
                      wavesurferRef.current?.setTime(time);
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

              <div className="result-card__actions">
                <button className="download-button" onClick={handleDownload}>
                  <Download size={16} /> Descargar WAV
                </button>
                <button className="secondary-button" onClick={handleRestart}>
                  Generar otro audio
                </button>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
