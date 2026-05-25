import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'psyskript_cards.json', 'study_content.json'],
      manifest: {
        name: 'PsychoLogisch',
        short_name: 'PsychoLogisch',
        description: 'Karteikarten-App für Psychologie mit Spaced Repetition',
        theme_color: '#0d9488',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'de',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Cache strategy: app shell + JSON data files for offline use
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        runtimeCaching: [
          {
            // External fonts / CDN images (none currently, but future-proof)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // App data JSON files (psyskript_cards.json, study_content.json) → stale-while-revalidate
            urlPattern: /\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'data-cache',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false, // Service Worker nur im Production-Build
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          icons: ['lucide-react'],
        }
      }
    }
  }
});
