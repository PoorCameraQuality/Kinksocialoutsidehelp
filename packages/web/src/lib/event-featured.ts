/** True when event is marked featured and optional expiry has not passed. */
export function isEventFeatured(row: {
  featured?: boolean | null
  featuredUntil?: string | null
}): boolean {
  if (!row.featured) return false
  if (!row.featuredUntil) return true
  const until = new Date(row.featuredUntil)
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now()
}
