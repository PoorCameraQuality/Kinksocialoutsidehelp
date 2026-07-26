/** Directory/search visibility for vendor_profiles.visibility. HIDDEN = direct link only. */
export function vendorVisibleInDirectory(
  visibility: string | null | undefined,
  viewerUserId: string | null,
): boolean {
  const v = visibility ?? 'PUBLIC'
  if (v === 'PUBLIC') return true
  if (v === 'MEMBERS') return viewerUserId !== null
  return false
}

/** Detail/listings access: PUBLIC open; MEMBERS requires login; HIDDEN managers only. */
export function vendorVisibleForDetail(
  visibility: string | null | undefined,
  viewerUserId: string | null,
  canManageHidden: boolean,
): boolean {
  const v = visibility ?? 'PUBLIC'
  if (canManageHidden) return true
  if (v === 'PUBLIC') return true
  if (v === 'MEMBERS') return viewerUserId !== null
  return false
}

export function filterVendorVisibility<T extends { visibility?: string | null }>(
  rows: T[],
  viewerUserId: string | null,
): T[] {
  return rows.filter((r) => vendorVisibleInDirectory(r.visibility, viewerUserId))
}
