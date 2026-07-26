import { z } from 'zod'

/**
 * Normalize vendor website / storefront URLs.
 * Prepends https:// when protocol is missing (e.g. etsy.com/shop/foo).
 */
export function normalizeVendorWebsite(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let candidate = trimmed
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`
  }
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

/** Coerce optional website input: empty → `emptyAs`, bare domain → https URL, invalid → null. */
export function coerceVendorWebsiteField(raw: unknown, emptyAs: '' | null = ''): unknown {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (!trimmed) return emptyAs
  return normalizeVendorWebsite(trimmed) ?? null
}

const vendorWebsiteValueSchema = z.union([z.string().url(), z.literal(''), z.null()])

/** Zod preprocess helper for optional nullable vendor website fields. */
export const zVendorWebsiteOptional = z.preprocess(
  (val) => coerceVendorWebsiteField(val, ''),
  vendorWebsiteValueSchema.optional(),
)

/** Zod preprocess helper when empty should become null (profile PUT). */
export const zVendorWebsiteNullable = z.preprocess(
  (val) => coerceVendorWebsiteField(val, null),
  vendorWebsiteValueSchema.optional(),
)
