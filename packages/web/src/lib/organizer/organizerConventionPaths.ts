/** Build organizer workspace paths for a convention (Kink Social org-scoped routes). */
export function organizerConventionBasePath(orgSlug: string | undefined, conventionSlug: string): string {
  const slug = conventionSlug.toLowerCase()
  if (orgSlug) {
    return `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(slug)}`
  }
  return `/organizer/conventions/${encodeURIComponent(slug)}`
}

export function organizerConventionSubPath(
  orgSlug: string | undefined,
  conventionSlug: string,
  suffix: string,
): string {
  const base = organizerConventionBasePath(orgSlug, conventionSlug)
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${base}${path}`
}
