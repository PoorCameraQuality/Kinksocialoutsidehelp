/* C215 — minimal Web Push handler (separate from program cache SW). */
self.addEventListener('push', (event) => {
  let data = { title: 'Kink Social', body: '', url: '/' }
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kink Social', {
      body: data.body || '',
      data: { url: data.url || '/' },
      icon: '/og-default.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          void client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
