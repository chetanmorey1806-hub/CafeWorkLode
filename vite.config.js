import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const API = process.env.API_URL || 'http://localhost:4000';

export default defineConfig({
  plugins: [
    react(),
    // Installable app (Add to Home screen) + offline support via a service worker
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'apple-touch-icon.png', 'fonts/*.ttf'],
      manifest: {
        name: 'Soffity Cafe',
        short_name: 'Soffity',
        description: 'Café POS, kitchen display & table QR ordering',
        theme_color: '#3d2a1e',
        background_color: '#1b120c',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Scan table QR', short_name: 'Scan', url: './#/scan', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'New order', short_name: 'POS', url: './#/pos', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Kitchen display', short_name: 'Kitchen', url: './#/kitchen', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
        runtimeCaching: [
          {
            // customer menu: fresh when online, last copy when offline
            urlPattern: ({ url }) => url.pathname === '/api/public/menu',
            handler: 'NetworkFirst',
            options: { cacheName: 'public-menu', networkTimeoutSeconds: 4, expiration: { maxEntries: 50 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': API,
      '/ws': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
});
