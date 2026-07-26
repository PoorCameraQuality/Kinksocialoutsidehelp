const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'file:', 'blob:', 'vbscript:'])

export type PresenterExternalUrlResult =
  | { ok: true; href: string }
  | { ok: false; error: string }

/**
 * Validates external HTTPS URLs for presenter gallery images and runner materials.
 * Remote images are not trusted uploads. Display them with referrerPolicy in the UI.
 */
export function validatePresenterExternalUrl(raw: string): PresenterExternalUrlResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'URL is required' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }

  const protocol = parsed.protocol.toLowerCase()
  if (BLOCKED_PROTOCOLS.has(protocol)) {
    return { ok: false, error: 'URL scheme is not allowed' }
  }
  if (protocol !== 'https:') {
    return { ok: false, error: 'URL must use HTTPS' }
  }
  if (!parsed.hostname) {
    return { ok: false, error: 'URL must include a host' }
  }

  return { ok: true, href: parsed.href }
}
