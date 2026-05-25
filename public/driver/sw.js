// Service worker for the /driver web app.
//
// Goal: the driver mobile shell (Capacitor APK wrapping /driver) keeps
// working when the device has no signal at cold launch. We do that by
// caching the Next.js static bundle aggressively and storing each
// /driver page we successfully render so it's available offline next time.
//
// What we DON'T cache:
//   - /api/* — API responses must always hit the network (writes are
//     queued separately by Phase 2 of the offline plan).
//   - Cross-origin requests — pass through.
//   - Non-GET requests — pass through.
//
// Scope: registered at "/driver/" so it only governs the driver app.

const CACHE_VERSION = 'driver-sw-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const PAGES_CACHE  = `${CACHE_VERSION}-pages`

// New service worker installs immediately, doesn't wait for old tabs to close.
self.addEventListener('install', () => {
  self.skipWaiting()
})

// On activate, clear caches from older SW versions.
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

  // Never cache API requests. Phase 2's IndexedDB write queue handles
  // offline writes; offline reads should fail cleanly.
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
            (cached) => cached || caches.match('/driver')
          )
        )
    )
    return
  }

  // Everything else passes through to the network with no caching.
})
