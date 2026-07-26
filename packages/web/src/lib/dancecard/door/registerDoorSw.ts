/** Register door-kiosk service worker (scoped to organizer door routes). */
export function registerDoorServiceWorker(scope = '/organizer/'): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const path = '/sw-door-kiosk.js'
  void navigator.serviceWorker.register(path, { scope }).catch(() => {
    /* optional - door mode still works online without SW */
  })
}

export function cacheDoorRoster(eventSlug: string, payload: unknown): void {
  if (typeof caches === 'undefined') return
  const url = `/api/v1/conventions/${encodeURIComponent(eventSlug)}/door/roster`
  void caches.open('dancecard-door-v1').then((cache) => {
    void cache.put(
      url,
      new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })
}
