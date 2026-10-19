import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths, so the build works from any folder: a web host, the home-screen app or the Android app.
  base: './',
  server: { port: 5173 },
  // Phaser alone is about 1.2 MB minified, so the default 500 kB warning always fires.
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    // Installable app with a service worker that caches the whole game, so it runs with no internet.
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in main.ts, and only on the web: the Android app already has every file inside it.
      injectRegister: false,
      includeAssets: ['fonts/*', 'icons/*'],
      manifest: {
        name: 'Pixel Tower Defence',
        short_name: 'Tower Defence',
        description: 'Hold the castle against waves of enemies. Plays offline.',
        id: './',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#1a1c2c',
        theme_color: '#1a1c2c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ttf,txt,webmanifest}'],
        // The game bundle (Phaser) is bigger than Workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
