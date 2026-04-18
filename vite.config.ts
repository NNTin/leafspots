import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // manifest.json lives in public/ and is linked in index.html — skip plugin injection
      manifest: false,
      workbox: {
        // Precache the entire app shell (JS, CSS, HTML, icons)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        runtimeCaching: [
          {
            // Cache OpenStreetMap tiles so the map works offline
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Vercel serves from the domain root, while GitHub Pages serves from /leafspots/.
  base: process.env.VERCEL === '1' ? '/' : '/leafspots/',
})
