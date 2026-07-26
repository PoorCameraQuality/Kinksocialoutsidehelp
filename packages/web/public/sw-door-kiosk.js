/* Door kiosk — offline roster cache for organizer door routes */
const CACHE = 'dancecard-door-v1'

function isDoorRosterRequest(url) {
  return /^\/api\/v1\/conventions\/[^/]+\/door\/roster$/.test(url.pathname)
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
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
  if (!isDoorRosterRequest(url)) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return res
      })
      .catch(() => caches.match(event.request)),
  )
})
