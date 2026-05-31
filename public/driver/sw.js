// Service worker for the /driver web app.
//
// Goal: the driver mobile shell (Capacitor APK wrapping /driver) keeps
// working when the device has no signal at cold launch. Strategy:
//   1. On install, pre-cache the Next.js static bundle layout AND the
//      main /driver routes so a cold offline launch has something to
//      serve immediately.
//   2. Cache each /driver page on every successful render so the cache
//      always holds the latest version of what the driver has visited.
//   3. Cache Next.js static assets (cache-first — they're content-hashed
//      and immutable).
//
// What we DON'T cache:
//   - /api/* — API responses must always hit the network (writes are
//     queued separately by the IndexedDB queue inside the app).
//   - Cross-origin requests — pass through.
//   - Non-GET requests — pass through.
//
// If even the SW can't serve the navigation (very first launch with no
// signal, no cached pages), Capacitor's errorPath kicks in and shows
// www/offline.html instead of the Android ERR_FAILED screen.

const CACHE_VERSION = 'driver-sw-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const PAGES_CACHE  = `${CACHE_VERSION}-pages`

// Pre-cache list. We can't request these on install (they're rendered
// pages, not static files) — instead, we warm them up here so they end
// up in the cache the moment the user first lands on /driver.
const PRECACHE_ROUTES = [
  '/driver',
  '/driver/dashboard',
  '/driver/map',
  '/driver/messages',
  '/driver/performance',
  '/driver/completed-orders',
]

self.addEventListener('install', (event) => {
  // Best-effort warm-up of the main driver routes. Failures (offline at
  // install time) don't block activation.
  event.waitUntil(
    caches.open(PAGES_CACHE).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ROUTES.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((res) => res.ok ? cache.put(url, res.clone()) : null)
            .catch(() => null)
        )
      )
    })
  )
  // New SW activates immediately — don't wait for old tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Only act on same-origin requests.
  if (url.origin !== self.location.origin) return

  // Never cache API requests. The in-app IndexedDB queue handles offline
  // writes; offline reads should fail cleanly so the app can show its
  // "saved offline" UX rather than stale data.
  if (url.pathname.startsWith('/api/')) return

  // ── Cache-first: Next.js static bundle ─────────────────────────────
  // /_next/static/* and /_next/image* are content-hashed by Next.js,
  // so once cached they never need re-validation.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone())
            }
            return response
          })
        })
      )
    )
    return
  }

  // ── Network-first with cache fallback: /driver HTML pages ──────────
  // Online: get the latest HTML, also stash it for next offline launch.
  // Offline: serve last cached version of this page (or /driver as a
  // last-resort fallback so the driver at least sees the login screen).
  const isDriverNav =
    (url.pathname === '/driver' || url.pathname.startsWith('/driver/')) &&
    (request.mode === 'navigate' || request.destination === 'document')

  if (isDriverNav) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match('/driver/dashboard') || caches.match('/driver')
          )
        )
    )
    return
  }

  // Everything else passes through to the network with no caching.
})

// Allow the app to trigger an on-demand re-warm of the page cache, e.g.
// after the driver logs in — at that point we know the dashboard is the
// most important page to have cached. Use:
//   navigator.serviceWorker.controller?.postMessage({ type: 'precache' })
self.addEventListener('message', (event) => {
  if (event.data?.type === 'precache') {
    event.waitUntil(
      caches.open(PAGES_CACHE).then((cache) =>
        Promise.allSettled(
          PRECACHE_ROUTES.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => res.ok ? cache.put(url, res.clone()) : null)
              .catch(() => null)
          )
        )
      )
    )
  }
})
