/** Match API `normalizeHttpUrl` - prepend https:// when organizers omit the scheme. */
export function normalizeHttpUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

export function formatOrgContentSaveError(error?: string, details?: unknown): string {
  if (error && error !== 'Invalid body') return error
  const flat = details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined
  if (flat?.fieldErrors) {
    for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
      if (msgs?.[0]) {
        if (field.includes('links') || field.includes('url')) {
          return 'Resource links need a valid URL. Use https://example.com or example.com'
        }
        return msgs[0]
      }
    }
  }
  if (flat?.formErrors?.[0]) return flat.formErrors[0]
  return 'Could not save. Check resource link URLs and optional module link fields.'
}
