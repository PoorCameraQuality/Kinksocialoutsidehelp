import { apexSiteOrigin } from '@/lib/dancecard-host'

/** Absolute share URL for an ISO (OG crawlers hit API /share/iso/:username). */
export function isoSharePath(username: string): string {
  return `/share/iso/${encodeURIComponent(username)}`
}

/** Prefer apex origin so Dancecard host copies still resolve OG + redirect on kink.social. */
export function isoShareAbsoluteUrl(
  username: string,
  origin = typeof window !== 'undefined' ? apexSiteOrigin() : 'https://kink.social',
): string {
  return `${origin.replace(/\/$/, '')}${isoSharePath(username)}`
}

export function isoCardPngPath(username: string): string {
  return `/api/v1/iso/${encodeURIComponent(username)}/card.png`
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** Download the server-rendered OG card PNG (owner/public). */
export async function downloadIsoCardPng(username: string, filename?: string): Promise<boolean> {
  try {
    const r = await fetch(isoCardPngPath(username), { credentials: 'include' })
    if (!r.ok) return false
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? `iso-${username}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}
