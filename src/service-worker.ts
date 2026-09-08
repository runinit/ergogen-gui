/**
 * Ergogen GUI Service Worker
 *
 * This file is compiled by CRA's Workbox InjectManifest plugin (because it
 * exists at `src/service-worker.ts`). The plugin injects the precache manifest
 * into `self.__WB_MANIFEST` at build time.
 *
 * Caching strategy overview:
 * - **Precache** (install-time): All webpack-bundled JS/CSS/HTML assets are
 *   precached automatically via `self.__WB_MANIFEST`. These include the app
 *   shell, chunks, and the entry HTML.
 * - **Runtime – public dependencies**: Large third-party JS bundles loaded via
 *   `<script>` tags in index.html (`dependencies/*.js`, `kicanvas.js`, etc.)
 *   are cached on first use with a CacheFirst strategy so they load instantly
 *   on subsequent visits, even offline.
 * - **Fonts**: Locally bundled Fontsource assets are precached with the app.
 * - **Runtime – Google Analytics**: Uses workbox-google-analytics to queue
 *   analytics events in IndexedDB when offline and replay them when
 *   connectivity is restored. The gtag.js script itself is cached too.
 *
 * Update flow:
 * - On every page load the browser re-fetches this file from the server.
 * - If the file has changed (new build deployed), the browser installs the new
 *   SW in a "waiting" state and the app shows an update banner.
 * - When the user clicks "Reload", `SKIP_WAITING` is sent to this SW, it
 *   activates, and all clients are refreshed.
 */

import packageJson from '../package.json';

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { initialize as initializeGoogleAnalytics } from 'workbox-google-analytics';

declare const self: ServiceWorkerGlobalScope;

const publicUrl = process.env.PUBLIC_URL || '';

// --------------------------------------------------------------------------
// Core: claim clients and set up skip-waiting message handler
// --------------------------------------------------------------------------

clientsClaim();

/**
 * When the update banner calls `registration.waiting.postMessage({ type: 'SKIP_WAITING' })`,
 * this SW immediately takes control, triggering a page reload with fresh assets.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// --------------------------------------------------------------------------
// Precache: all webpack-bundled assets (injected at build time by CRA)
// --------------------------------------------------------------------------

precacheAndRoute(self.__WB_MANIFEST);

// --------------------------------------------------------------------------
// SPA Navigation: route all navigation requests to index.html so that React
// Router's client-side routing continues to work offline.
// --------------------------------------------------------------------------

const fileExtensionRegexp = /\/[^/?]+\.[^/]+$/;

registerRoute(
  ({ request, url }: { request: Request; url: URL }) => {
    if (request.mode !== 'navigate') return false;
    // Skip Webpack HMR & internal routes.
    if (url.pathname.startsWith('/_')) return false;
    // Skip direct file requests (e.g., manifest.json, favicon.ico).
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// --------------------------------------------------------------------------
// Runtime – Public dependencies
//
// The large third-party bundles loaded via <script> tags (maker.js, bezier.js,
// hull.js, kle.js, kicanvas.js) live under /dependencies/. They are NOT part
// of the webpack bundle so they are not precached. We cache them on first
// access so subsequent loads (including offline) are instant.
// --------------------------------------------------------------------------

registerRoute(
  ({ url }: { url: URL }) =>
    url.pathname.startsWith(`${publicUrl}/dependencies/`),
  new CacheFirst({
    cacheName: `public-dependencies-${publicUrl}-${packageJson.version}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        // 30-day cache — these files only change when we update the project.
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// --------------------------------------------------------------------------
// Runtime – Public images (previews and logo assets)
// --------------------------------------------------------------------------
registerRoute(
  ({ url }: { url: URL }) =>
    url.pathname.startsWith(`${publicUrl}/images/`) ||
    url.pathname === `${publicUrl}/ergogen.png` ||
    url.pathname === `${publicUrl}/favicon.ico`,
  new CacheFirst({
    cacheName: `public-images-${publicUrl}-v1`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        // 30-day cache — static assets that rarely change.
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// --------------------------------------------------------------------------
// Runtime – Google Tag Manager / gtag.js
//
// Cache the gtag.js script with NetworkFirst so we always try to get the
// latest analytics code, but fall back to the cached version when offline.
// --------------------------------------------------------------------------

registerRoute(
  ({ url }: { url: URL }) =>
    url.hostname === 'www.googletagmanager.com' ||
    url.hostname === 'www.google-analytics.com',
  new NetworkFirst({
    cacheName: `google-analytics-scripts-${publicUrl}`,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  })
);

// --------------------------------------------------------------------------
// Google Analytics – offline queue
//
// workbox-google-analytics intercepts all measurement requests to
// google-analytics.com and queues them in IndexedDB when offline.
// They are automatically replayed once connectivity is restored.
// --------------------------------------------------------------------------

initializeGoogleAnalytics();

// CAD and solver binaries load on demand; keep content-hashed assets for offline reuse.
const HTTP_OK = 200;
registerRoute(
  ({ url }: { url: URL }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith(`${publicUrl}/assets/`) &&
    url.pathname.endsWith('.wasm'),
  new CacheFirst({
    cacheName: `design-wasm-${publicUrl}`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [HTTP_OK] }),
      new ExpirationPlugin({ maxEntries: 4 }),
    ],
  })
);
