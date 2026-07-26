/** Clear stale service workers on localhost before the app boots (avoids HTML MIME errors in dev). */
export async function clearStaleLocalServiceWorkers(): Promise<void> {
  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]'
  if (isLocal && 'serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  }
  if (isLocal && 'caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
}
