/* Offline-friendly cache for convention program JSON (best-effort). */
const CACHE = 'c2k-program-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    url.pathname.includes('/api/v1/conventions/') &&
    url.pathname.endsWith('/slots') &&
    event.request.method === 'GET'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match(event.request))
    )
  }
})
