# Contributing

## Stack

Leafspots is a React 19 app built with Vite and TypeScript.

- Mapping: `leaflet`, `react-leaflet`
- PWA/service worker: `vite-plugin-pwa` with Workbox-generated `sw.js`
- Tests: `vitest`

Important files:

- `vite.config.ts`: Vite config, Workbox caching rules, cache versioning
- `src/components/MapView.tsx`: Leaflet tile layer setup
- `src/lib/leaflet-client.ts`: optional URL shortener/auth integration
- `src/utils/pwaCache.ts`: manual cache reset helpers

## Getting Started

Requirements:

- Node.js 20+ recommended
- npm

Install and run:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run lint
```

Before opening a PR or handing work off, run at least:

```bash
npm run build
npm run test
```

## Environment

The app works without custom env vars, but these are supported:

- `VITE_LEAFLET_API_ORIGIN`: override the shortener/auth API origin
- `VITE_LEAFLET_FRONTEND_ORIGIN`: override the frontend origin used for login URLs
- `VITE_CACHE_VERSION`: override the runtime cache version suffix

If `VITE_CACHE_VERSION` is not set, runtime caches fall back to `package.json` version.

## PWA Workflow

The service worker is generated at build time by Workbox via `vite-plugin-pwa`.

Precache is for the app shell only:

- JS, CSS, HTML
- icons and bundled static assets
- built JSON/SVG assets shipped with the app

Runtime caching is intentionally narrow:

- OSM tiles: `StaleWhileRevalidate`
- same-origin images: `StaleWhileRevalidate`
- same-origin `.json`: `StaleWhileRevalidate`
- same-origin `/api/*` GET endpoints: `NetworkFirst`
- `https://leaflet.lair.nntin.xyz/*`: `NetworkOnly`

Runtime assets are only cached when they are valid:

- images must return `200` and an `image/*` content type
- JSON must return `200` and a JSON content type

This is deliberate. We do not want to persist HTML error pages, broken image responses, or transient failures in runtime caches.

## PWA Testing

Do not treat `npm run dev` as a full service-worker test environment. The production service worker is generated for build output, so cache behavior should be verified with:

```bash
npm run build
npm run preview
```

Use browser DevTools Application tab to inspect:

- Service Workers
- Cache Storage
- precache vs runtime cache names

## Force Invalidation Strategy

This project uses versioned runtime cache names:

- `leafspots-osm-tiles-<version>`
- `leafspots-images-<version>`
- `leafspots-data-<version>`
- `leafspots-api-<version>`

The version comes from:

1. `VITE_CACHE_VERSION`, if set
2. `package.json` version, otherwise
3. `'v1'` as a final fallback

When to bump the cache version:

- you changed runtime caching rules in `vite.config.ts`
- you changed cache admission logic and want old bad entries abandoned
- you changed the semantics of cached JSON/image responses
- users are stuck with broken runtime assets and you need a clean cutover

When not to bump it:

- normal UI changes that only affect already-revisioned precached assets
- changes unrelated to runtime cache contents

How to bump it:

```bash
VITE_CACHE_VERSION=2026-04-18-1 npm run build
```

or update the deployed environment to provide a new `VITE_CACHE_VERSION`.

Effect of a bump:

- new builds write to new runtime cache names
- old runtime caches stop being used
- users recover without needing manual cache deletion

This is the preferred production invalidation mechanism for runtime caches.

## Manual Cache Reset

Manual reset helpers live in `src/utils/pwaCache.ts`.

Available functions:

- `clearLeafspotsRuntimeCaches()`: delete runtime caches only
- `resetLeafspotsPwa({ hard?: boolean, reload?: boolean })`

Behavior:

- `hard: false`: deletes runtime caches and asks registrations to update
- `hard: true`: deletes runtime caches, deletes precache-prefixed caches, unregisters service workers
- `reload: true`: reloads the page after reset

Typical usage in a temporary debug button:

```ts
import { resetLeafspotsPwa } from './utils/pwaCache'

await resetLeafspotsPwa({ hard: true })
```

Do not leave debug reset UI in production by accident unless it is intentional product behavior.

## OpenStreetMap Notes

The app uses the official OSM tile endpoint:

```text
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Keep these constraints in mind when touching map behavior:

- do not add tile prefetching or offline bulk download
- do not switch back to legacy `{a,b,c}.tile.openstreetmap.org` hostnames
- keep attribution visible
- prefer modest cache sizes and automatic background revalidation

Reference:

- https://operations.osmfoundation.org/policies/tiles/

## Contribution Notes

If you change any of the following, mention it clearly in your PR or handoff notes:

- `vite.config.ts` runtime caching
- `VITE_CACHE_VERSION`
- tile URL/provider behavior
- any new API endpoints that should or should not be SW-cached

If a change can strand users behind old runtime cache contents, include the invalidation plan explicitly.
