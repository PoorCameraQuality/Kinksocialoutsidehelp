/** Response shape for `GET /api/v1/users/:username/ecosystem`. */

export type UserEcosystemOrg = {
  slug: string
  displayName: string
  role: string
  logoUrl?: string | null
}

export type UserEcosystemGroup = {
  id: string
  slug: string
  name: string
  role?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
}

export type UserEcosystemVendor = {
  id: string
  slug: string | null
  displayName: string
}

export type UserEcosystemPresenter = {
  headline: string | null
  directoryVisibility: string | null
  profileKind: string | null
}

export type UserEcosystemEventSnippet = {
  id: string
  title: string
  startsAt: string
  organizationId: string | null
  imageUrl?: string | null
  location?: string | null
  /** Hosting vs attending via RSVP. Defaults to hosting when omitted (legacy payloads). */
  participation?: 'hosting' | 'rsvp'
  rsvpStatus?: 'going' | 'maybe' | 'waitlist' | null
}

export type UserEcosystemPayload = {
  userId: string
  username: string
  /** Global profile trust score (same source as peer reputation rollup). */
  trustScore?: number
  orgs: UserEcosystemOrg[]
  groups: UserEcosystemGroup[]
  vendor: UserEcosystemVendor | null
  presenter: UserEcosystemPresenter | null
  upcomingEvents: UserEcosystemEventSnippet[]
}

export function vendorProfilePath(v: Pick<UserEcosystemVendor, 'slug' | 'id'>): string {
  const key = v.slug?.trim() || v.id
  return `/vendors/${encodeURIComponent(key)}`
}

/** Returns null if DB unavailable (503) or user not found; throws on network failure only if caller wants - we catch in UI. */
export async function fetchUserEcosystem(username: string): Promise<UserEcosystemPayload | null> {
  const u = username.trim()
  if (!u) return null
  try {
    const r = await fetch(`/api/v1/users/${encodeURIComponent(u)}/ecosystem`, { credentials: 'include' })
    if (r.status === 503 || r.status === 404) return null
    if (!r.ok) return null
    return (await r.json()) as UserEcosystemPayload
  } catch {
    return null
  }
}
