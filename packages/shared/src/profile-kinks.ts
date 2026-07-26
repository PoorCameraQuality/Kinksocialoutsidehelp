/** Max kink rows per profile (PUT /api/profile/me/kinks). */
export const PROFILE_KINK_MAX = 50

/** Interest statuses shown on public profiles (non-owner API filter). */
export const PUBLIC_PROFILE_KINK_STATUSES = ['into', 'curious'] as const

export type PublicProfileKinkStatus = (typeof PUBLIC_PROFILE_KINK_STATUSES)[number]

export function isPublicProfileKinkStatus(status: string): status is PublicProfileKinkStatus {
  return (PUBLIC_PROFILE_KINK_STATUSES as readonly string[]).includes(status)
}
