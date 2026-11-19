import { useEffect, useRef } from 'react';

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playing: boolean;
  ready: boolean;
};

const BAR_COUNT = 40;

export default function AudioVisualizer({ audioRef, playing, ready }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    let ctx: AudioContext | null = null;
    let raf = 0;

    try {
      ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }

    const draw = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ratio = window.devicePixelRatio || 1;
      const width = cvs.clientWidth;
      const height = cvs.clientHeight;
      if (cvs.width !== Math.floor(width * ratio) || cvs.height !== Math.floor(height * ratio)) {
        cvs.width = Math.floor(width * ratio);
        cvs.height = Math.floor(height * ratio);
      }
      const g = cvs.getContext('2d');
      if (!g) return;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.clearRect(0, 0, width, height);

      const style = getComputedStyle(document.documentElement);
      const rgb = style.getPropertyValue('--accent-rgb').trim() || '13 148 136';
      const mutedRgb = style.getPropertyValue('--bar-muted-rgb').trim() || '148 163 184';

      const analyser = analyserRef.current;
      let data: Uint8Array<ArrayBuffer> | null = null;
      if (playingRef.current && analyser) {
        data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
      }

      const gap = 4;
      const barWidth = Math.max(2, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
      const now = performance.now() / 1000;

      for (let i = 0; i < BAR_COUNT; i++) {
        let value: number;
        if (data) {
          const index = Math.floor(Math.pow(i / BAR_COUNT, 1.35) * (data.length * 0.72));
          value = data[index] / 255;
          value = Math.pow(value, 0.85);
        } else if (ready) {
          value = 0.1 + 0.05 * (Math.sin(now * 1.4 + i * 0.45) + 1) / 2;
        } else {
          value = 0.06 + 0.02 * (Math.sin(now * 0.9 + i * 0.3) + 1) / 2;
        }
        const barHeight = Math.max(4, value * (height - 12));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        const radius = Math.min(barWidth / 2, 3);

        g.beginPath();
        g.roundRect(x, y, barWidth, barHeight, radius);
        const active = playingRef.current && data;
        g.fillStyle = active ? `rgb(${rgb} / ${0.55 + value * 0.45})` : `rgb(${mutedRgb} / 0.32)`;
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      analyserRef.current = null;
      ctx?.close().catch(() => undefined);
    };
  }, [audioRef, ready]);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-hidden="true" />;
}
