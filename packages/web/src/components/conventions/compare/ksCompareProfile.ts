import { pickPrimaryProfilePhoto } from '@c2k/shared'
import type { CompareProfile } from '@/components/conventions/compare/CompareProfileCard'

type KsProfilePhoto = { url?: string | null; order?: number }
type KsProfilePayload = {
  user?: { username?: string }
  profile?: {
    displayName?: string | null
    bio?: string | null
    pronouns?: string | null
    avatarUrl?: string | null
  } | null
  photos?: KsProfilePhoto[]
}

/** Map a kink.social `/api/profile/:username` payload into a Compare card. */
export function ksProfileToCompareProfile(
  data: KsProfilePayload,
  fallbackUsername: string,
): CompareProfile {
  const username = data.user?.username?.trim() || fallbackUsername
  const photos = (data.photos ?? [])
    .filter((p): p is KsProfilePhoto & { url: string; order: number } => Boolean(p.url?.trim()))
    .map((p, i) => ({ url: p.url!.trim(), order: typeof p.order === 'number' ? p.order : i }))
  const primary = pickPrimaryProfilePhoto(photos) ?? photos[0]
  const avatarUrl = primary?.url?.trim() || data.profile?.avatarUrl?.trim() || null

  return {
    displayName: data.profile?.displayName?.trim() || username,
    username,
    pronouns: data.profile?.pronouns?.trim() || null,
    bio: data.profile?.bio?.trim() || null,
    avatarUrl,
  }
}

export async function fetchKsCompareProfile(username: string): Promise<CompareProfile | null> {
  const r = await fetch(`/api/profile/${encodeURIComponent(username)}`, { credentials: 'include' })
  if (!r.ok) return null
  const data = (await r.json()) as KsProfilePayload
  return ksProfileToCompareProfile(data, username)
}
