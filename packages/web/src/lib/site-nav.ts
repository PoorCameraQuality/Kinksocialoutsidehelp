/** Nav link shape shared by site chrome config. */
export type SiteNavLink = { readonly href: string; readonly label: string }

/** Drop items whose href already appears in primary nav (G3). */
export function dedupeNavByHref<T extends SiteNavLink>(
  primary: readonly SiteNavLink[],
  items: readonly T[],
): readonly T[] {
  const primaryHrefs = new Set(primary.map((l) => l.href))
  return items.filter((l) => !primaryHrefs.has(l.href))
}

export type NavSecondaryBadge = 'notifications' | 'messaging' | 'events'

export type NavSecondaryLink = SiteNavLink & { readonly badge?: NavSecondaryBadge }
