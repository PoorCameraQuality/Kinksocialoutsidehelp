/** Relative time for notifications and messages (matches NotificationsPageClient). */
export function shortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d ago`
  return d.toLocaleDateString()
}
