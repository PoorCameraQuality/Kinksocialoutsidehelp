export type ProfileVisibility = 'PUBLIC' | 'MEMBERS' | 'PRIVATE' | string

/** Whether a non-owner may load profile body fields (bio, display name, etc.). */
export function canViewerReadProfile(
  visibility: ProfileVisibility,
  opts: { viewerId: string | null; isOwner: boolean },
): boolean {
  if (opts.isOwner) return true
  if (visibility === 'PUBLIC') return true
  if (visibility === 'MEMBERS' && opts.viewerId) return true
  return false
}

/** Email is owner-only on public profile routes. */
export function canViewerReadProfileEmail(isOwner: boolean): boolean {
  return isOwner
}
