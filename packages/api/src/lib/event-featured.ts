/** True when event is marked featured and optional expiry has not passed. */
export function isEventFeatured(row: {
  featured?: boolean | null
  featuredUntil?: Date | string | null
}): boolean {
  if (!row.featured) return false
  if (!row.featuredUntil) return true
  const until = row.featuredUntil instanceof Date ? row.featuredUntil : new Date(row.featuredUntil)
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now()
}
