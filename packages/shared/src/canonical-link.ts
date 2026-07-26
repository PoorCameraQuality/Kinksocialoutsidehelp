/** Month + year for public profile "Member since" (locale-aware). */
export function formatMemberSinceMonthYear(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Build absolute canonical URL from an app path (leading slash required or added). */
export function buildCanonicalUrl(path: string, siteBase?: string): string {
  const base = (siteBase ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/** Copy canonical URL for `path` to clipboard. Returns true on success (browser only). */
export async function copyCanonicalLink(path: string, siteBase?: string): Promise<boolean> {
  const resolvedBase =
    siteBase ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  const url = buildCanonicalUrl(path, resolvedBase)
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}
