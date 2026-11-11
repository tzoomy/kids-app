import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Vite root is web/, publicDir is repo public/, build outDir is repo dist/.
// base is /kids-app/ to match the GitHub Pages project path.
export default defineConfig({
  root: 'web',
  base: '/kids-app/',
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [
    VitePWA({
      srcDir: 'web',
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        // Precache the app shell plus the voice clips (~1.5 MB of 48 kbps mono MP3) so the
        // restaurant speaks offline from the first launch. Other world assets are cached at runtime
        // as they are requested, so first install does not pull the whole library.
        globPatterns: ['**/*.{js,css,html,woff,woff2,json,svg,png,webmanifest,ico,mp3}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ogg|mp3|woff2?|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kids-app-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
