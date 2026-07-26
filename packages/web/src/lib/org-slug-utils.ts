/** Matches API `slugify` in organizations route. */
export function slugifyOrgName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeOrgSlugInput(input: string): string {
  return slugifyOrgName(input)
}

export function orgSlugPreview(displayName: string, slugInput: string): string {
  const fromSlug = normalizeOrgSlugInput(slugInput)
  if (fromSlug.length >= 2) return fromSlug
  const fromName = slugifyOrgName(displayName)
  if (fromName.length >= 2) return fromName
  return 'your-organization'
}

export function validateOrgSlugInput(slugInput: string): string | null {
  const trimmed = slugInput.trim()
  if (!trimmed) return null
  const normalized = normalizeOrgSlugInput(trimmed)
  if (normalized.length < 2) {
    return 'URL slug must be at least 2 characters (letters and numbers).'
  }
  if (normalized.length > 128) {
    return 'URL slug must be 128 characters or fewer.'
  }
  return null
}
