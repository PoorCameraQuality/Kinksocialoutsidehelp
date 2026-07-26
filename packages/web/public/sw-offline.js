/* Minimal offline shell — v3 §14 PWA fallback */
const CACHE = 'c2k-offline-v2'
const SHELL = ['/', '/home', '/manifest.json', '/og-default.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled(SHELL.map((url) => cache.add(url)))
      await self.skipWaiting()
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  // Vite dev assets and JS modules must never get an HTML shell fallback.
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    event.request.destination === 'script' ||
    event.request.destination === 'worker'
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.mode === 'navigate') {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return res
      })
      .catch(() => {
        if (event.request.mode !== 'navigate') {
          return caches.match(event.request)
        }
        return caches.match(event.request).then((cached) => cached ?? caches.match('/home'))
      }),
  )
})
