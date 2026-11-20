import { useEffect, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';

type Props = {
  wavesurfer: WaveSurfer | null;
  playing: boolean;
  dark: boolean;
};

/** Única onda del resultado: se mueve con el audio y late suavemente en reposo. */
export default function LiveWave({ wavesurfer, playing, dark }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!wavesurfer) return;
    const media = wavesurfer.getMediaElement();
    if (!media) return;

    const context = new AudioContext();
    const source = context.createMediaElementSource(media);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(context.destination);

    const resume = () => context.resume().catch(() => undefined);
    media.addEventListener('play', resume);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ratio = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
          canvas.width = Math.floor(width * ratio);
          canvas.height = Math.floor(height * ratio);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.clearRect(0, 0, width, height);

          const active = playingRef.current;
          if (active) analyser.getByteTimeDomainData(data);
          const middle = height / 2;
          const amplitude = height * (active ? 0.4 : 0.12);
          const time = performance.now() / 1000;

          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, dark ? '#2dd4bf' : '#0d9488');
          gradient.addColorStop(0.5, dark ? '#5eead4' : '#059669');
          gradient.addColorStop(1, dark ? '#2dd4bf' : '#0d9488');

          ctx.beginPath();
          for (let x = 0; x <= width; x += 2) {
            let value: number;
            if (active) {
              const index = Math.floor((x / width) * (data.length - 1));
              value = (data[index] - 128) / 128;
            } else {
              value =
                Math.sin(x * 0.035 - time * 1.6) *
                Math.sin(x * 0.006 + time * 0.7) *
                0.55;
            }
            const y = middle + value * amplitude;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = gradient;
          ctx.lineWidth = active ? 2.4 : 1.8;
          ctx.lineJoin = 'round';
          ctx.shadowColor = dark ? '#2dd4bf' : '#0d9488';
          ctx.shadowBlur = active ? 12 : 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('play', resume);
      source.disconnect();
      analyser.disconnect();
      context.close().catch(() => undefined);
    };
  }, [wavesurfer, dark]);

  return <canvas ref={canvasRef} className="live-wave" aria-hidden="true" />;
}
