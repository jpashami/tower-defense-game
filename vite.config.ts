import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  // Phaser alone is about 1.2 MB minified, so the default 500 kB warning always fires.
  build: { chunkSizeWarningLimit: 1500 },
});
