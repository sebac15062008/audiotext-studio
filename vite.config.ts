import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => ({
  // Rutas relativas para que funcione tanto en Vercel como cargado desde Electron.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': root,
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
