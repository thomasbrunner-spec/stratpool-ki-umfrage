import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_PORT avoids the local Docker container on :3000 (see STATUS.md)
const apiPort = process.env.API_PORT ?? '3210';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5180),
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
  build: { outDir: 'dist' },
});
