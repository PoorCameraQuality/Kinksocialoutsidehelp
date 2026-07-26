/** Resolve uploaded media URLs for display (MinIO dev vs production). */
export function mediaDisplayUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined
  const u = url.trim()
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')) return u
  const api = import.meta.env.VITE_API_URL ?? ''
  if (api && u.startsWith('/uploads/')) return `${api.replace(/\/$/, '')}${u}`
  return u
}
