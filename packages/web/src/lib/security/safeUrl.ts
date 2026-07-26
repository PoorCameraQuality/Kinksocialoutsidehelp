/** HTTPS URL validation for client-side profile links. */
export function assertHttpsUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function assertHttpsImageUrl(raw: string): string | null {
  const url = assertHttpsUrl(raw)
  if (!url) return null
  return url
}
