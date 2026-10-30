# AudioText Studio

Generador de audio desde texto que funciona 100% en el navegador (sin API keys ni servidor).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Producción / Vercel

```bash
npm run build
```

Despliega la carpeta `dist` en Vercel (o conecta el repositorio: Vercel detecta Vite automáticamente).

El modelo de voz se descarga la primera vez que generas audio y se cachea en el navegador.