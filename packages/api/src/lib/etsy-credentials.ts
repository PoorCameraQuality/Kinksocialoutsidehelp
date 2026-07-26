/**
 * Etsy Open API v3 credentials.
 * x-api-key header value is keystring:shared_secret (see Etsy authentication docs).
 * ETSY_X_API_KEY is preferred; ETSY_KEYSTRING is a deprecated alias.
 */
export function getEtsyXApiKey(): string | null {
  const k = process.env.ETSY_X_API_KEY?.trim() || process.env.ETSY_KEYSTRING?.trim()
  return k && k.length > 0 ? k : null
}

/** @deprecated Use getEtsyXApiKey */
export function getEtsyKeystring(): string | null {
  return getEtsyXApiKey()
}

/** Keystring portion used as OAuth client_id. */
export function getEtsyClientId(): string | null {
  const key = getEtsyXApiKey()
  if (!key) return null
  const idx = key.indexOf(':')
  return idx > 0 ? key.slice(0, idx) : key
}

export function getEtsySharedSecret(): string | null {
  const key = getEtsyXApiKey()
  if (!key) return null
  const idx = key.indexOf(':')
  return idx > 0 ? key.slice(idx + 1) : null
}

export function etsyConfigured(): boolean {
  return getEtsyXApiKey() !== null
}
