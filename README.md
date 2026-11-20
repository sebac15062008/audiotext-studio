# AudioText Studio

Convierte texto en audio con voces neuronales **Piper**. Sin API, sin servidor, sin subir tu texto: la inferencia ocurre en tu dispositivo con ONNX Runtime Web.

Funciona en dos modes:

- **Web (Vercel):** aplicación estática; los modelos se descargan una sola vez y se cachean en el navegador.
- **Escritorio (Electron):** aplicación local. Si incluyes los modelos en `public/voices/`, funciona completamente offline y puedes usar todas las voces del catálogo.

## Desarrollo

```bash
npm install
npm run dev            # http://127.0.0.1:5173
```

## Escritorio (Electron)

```bash
npm run electron:dev    # Vite + Electron en modo desarrollo
npm run electron:build  # genera el instalador en release/
```

Para empaquetar voces dentro de la app (recomendado para uso offline):

```bash
npm run electron:build:offline
```

o, si ya descargaste las voces:

```bash
npm run voices:download
npm run electron:build
```

El script descarga las 7 voces en español a `public/voices/` (carpeta ignorada por Git). Puedes elegir otras con:

```bash
PIPER_VOICES=es_ES-davefx-medium,es_MX-ald-medium npm run voices:download
```

## Producción / Vercel

```bash
npm run build
```

Despliega la carpeta `dist`. La app es 100 % estática: no hay functions ni endpoints.

## Voces

El selector muestra únicamente voces en español, con nombres sencillos: Daniel, Lucía, Alejandro, Claudia, Carlos, Marta y Pablo. Todas se generan localmente; en Electron puedes incluirlas dentro de la app con `npm run electron:build:offline`.

## Notas técnicas

- Motor: [`@realtimex/piper-tts-web`](https://www.npmjs.com/package/@realtimex/piper-tts-web) + `onnxruntime-web` 1.22.
- Fonemizador y datos eSpeak: `public/piper/`.
- Salida: WAV mono; el resultado muestra la forma de onda real con `wavesurfer.js` y, al reproducir, una onda en vivo que se mueve con el audio (`AnalyserNode`).
- Los archivos de voz se sirven desde `public/voices/` cuando están presentes; si no, se obtienen del repositorio estático de modelos y se guardan en la caché del navegador.
- El proyecto no contiene código de servidor ni llamadas a APIs de terceros para sintetizar voz.
