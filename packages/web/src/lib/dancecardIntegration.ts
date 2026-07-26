/** Kink Social ↔ ECKE Dancecard URL helpers (UI Phase 8). */

export type DancecardConventionSettings = {
  dancecardSlug?: string
  dancecardHost?: string
  dancecardEnabled?: boolean
  dancecardEmbedTokenHint?: string
  dancecardAttendeeSameTab?: boolean
}

const DEFAULT_ECKE_HOST = 'https://www.eastcoastkinkevents.com'

export function isDancecardLinked(settings: DancecardConventionSettings | null | undefined): boolean {
  if (!settings?.dancecardSlug?.trim()) return false
  if (settings.dancecardEnabled === false) return false
  return true
}

export function dancecardHost(settings: DancecardConventionSettings | null | undefined): string {
  const h = settings?.dancecardHost?.trim()
  if (!h) return DEFAULT_ECKE_HOST
  return h.replace(/\/$/, '')
}

export function dancecardOrganizerUrl(settings: DancecardConventionSettings | null | undefined): string | null {
  const slug = settings?.dancecardSlug?.trim()
  if (!slug || !isDancecardLinked(settings)) return null
  return `${dancecardHost(settings)}/organizer/dancecard/${encodeURIComponent(slug.toLowerCase())}`
}

export function dancecardAttendeeUrl(settings: DancecardConventionSettings | null | undefined): string | null {
  const slug = settings?.dancecardSlug?.trim()
  if (!slug || !isDancecardLinked(settings)) return null
  return `${dancecardHost(settings)}/dancecard/${encodeURIComponent(slug.toLowerCase())}`
}

export function dancecardEmbedScheduleUrl(
  settings: DancecardConventionSettings | null | undefined,
  token: string,
  opts?: { chrome?: 'minimal' },
): string | null {
  const slug = settings?.dancecardSlug?.trim()
  if (!slug || !token) return null
  const q = new URLSearchParams({ token })
  if (opts?.chrome === 'minimal') q.set('chrome', 'minimal')
  return `${dancecardHost(settings)}/embed/dancecard/${encodeURIComponent(slug.toLowerCase())}/schedule?${q}`
}

export function dancecardOpsSummaryEmbedUrl(
  settings: DancecardConventionSettings | null | undefined,
  token: string,
): string | null {
  const slug = settings?.dancecardSlug?.trim()
  if (!slug || !token) return null
  return `${dancecardHost(settings)}/embed/dancecard/${encodeURIComponent(slug.toLowerCase())}/ops-summary?token=${encodeURIComponent(token)}`
}
