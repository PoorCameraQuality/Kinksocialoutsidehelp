/* Minimal offline shell — do not cache arbitrary navigations (stale HTML caused dancecard flicker). */
const CACHE = 'c2k-offline-v5-iso-full-sheet'
const SHELL = ['/', '/play', '/login', '/manifest.json', '/og-default.png', '/og-dancecard.png']

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

function offlineShellFallback() {
  const host = self.location.hostname.toLowerCase()
  if (host === 'dancecard.kink.social' || host.startsWith('dancecard.')) {
    return caches.match('/play').then((cached) => cached ?? caches.match('/login') ?? caches.match('/'))
  }
  return caches.match('/').then((cached) => cached ?? caches.match('/play'))
}

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
    event.request.destination === 'worker' ||
    event.request.destination === 'style'
  ) {
    return
  }

  // Navigations: network-first, never put dynamic HTML into cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => offlineShellFallback()))
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => res)
      .catch(() => caches.match(event.request)),
  )
})
