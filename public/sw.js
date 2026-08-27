/* STEAMX PWA service worker — root scope, network-first / passthrough.
 * Exists primarily so Chromium can offer install; caching stays minimal so
 * Next.js App Router RSC / hashed assets are not poisoned. */
const CACHE_NAME = 'steamx-pwa-v1'
const PRECACHE_URLS = ['/icon-192x192.png', '/icon-512x512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (url.origin !== self.location.origin) return

  // Let the browser handle Next internals and APIs — never cache them here.
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/sw.js'
  ) {
    return
  }

  // Network-first for same-origin documents and static public assets.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response.ok &&
          (url.pathname === '/icon-192x192.png' || url.pathname === '/icon-512x512.png')
        ) {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  )
})
