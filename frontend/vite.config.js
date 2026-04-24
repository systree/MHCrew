import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // manifest is served from public/manifest.json

      // injectManifest: we provide our own SW source (src/sw-custom.js)
      // so we can add push notification event handlers.
      // Workbox injects the precache manifest into self.__WB_MANIFEST.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw-custom.js',

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3000,
    hmr: {
      host: 'localhost',
      port: 3000,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
