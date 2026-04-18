import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const RUNTIME_CACHE_VERSION =
  process.env.VITE_CACHE_VERSION ?? process.env.npm_package_version ?? 'v1'

function runtimeCacheName(name: string): string {
  return `leafspots-${name}-${RUNTIME_CACHE_VERSION}`
}

const imageResponsePlugin = {
  cacheWillUpdate: async ({ response }: { response?: any }) => {
    if (!response || response.status !== 200) return null

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    return contentType.startsWith('image/') ? response : null
  },
}

const jsonResponsePlugin = {
  cacheWillUpdate: async ({ response }: { response?: any }) => {
    if (!response || response.status !== 200) return null

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    return contentType.includes('application/json') || contentType.includes('+json')
      ? response
      : null
  },
}

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
        cacheId: 'leafspots',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Precache the app shell and bundled static assets. Runtime data stays out
        // of precache so failures are recoverable and cache growth stays bounded.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,avif,woff2,json,txt}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        runtimeCaching: [
          {
            // OSM tiles should refresh when the network is back. Keep a local cache
            // for offline revisits, but always try to revalidate in the background.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: runtimeCacheName('osm-tiles'),
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                purgeOnQuotaError: true,
              },
              plugins: [imageResponsePlugin],
            },
          },
          {
            // Same-origin images can be reused offline, but should heal
            // automatically after a transient failure or a redeploy.
            urlPattern: ({ request, sameOrigin }) =>
              request.destination === 'image' && sameOrigin,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: runtimeCacheName('images'),
              expiration: {
                maxEntries: 96,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                purgeOnQuotaError: true,
              },
              plugins: [imageResponsePlugin],
            },
          },
          {
            // Public JSON data and static map metadata can be reused offline.
            urlPattern: ({ request, url, sameOrigin }) =>
              request.method === 'GET' && sameOrigin && url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: runtimeCacheName('data'),
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
                purgeOnQuotaError: true,
              },
              plugins: [jsonResponsePlugin],
            },
          },
          {
            // The shortening/auth service is stateful and user-specific.
            // Keep it off the SW cache entirely.
            urlPattern: /^https:\/\/leaflet\.lair\.nntin\.xyz\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Optional same-origin GET API caching for future public endpoints.
            // Explicitly excludes auth/session paths.
            urlPattern: ({ request, url, sameOrigin }) =>
              request.method === 'GET' &&
              sameOrigin &&
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/auth/') &&
              !url.pathname.startsWith('/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: runtimeCacheName('api'),
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 5, // 5 minutes
                purgeOnQuotaError: true,
              },
              plugins: [jsonResponsePlugin],
            },
          },
        ],
      },
    }),
  ],
  // Vercel serves from the domain root, while GitHub Pages serves from /leafspots/.
  base: process.env.VERCEL === '1' ? '/' : '/leafspots/',
})
