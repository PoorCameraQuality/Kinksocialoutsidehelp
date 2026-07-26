/**
 * Minimal Etsy Open API v3 client (read-only).
 * Base URL and x-api-key auth: https://developers.etsy.com/documentation
 *
 * Prefer a per-vendor key (BYO) when provided; fall back to ETSY_X_API_KEY.
 */
import { etsyConfigured, getEtsyXApiKey } from './etsy-credentials.js'

export { etsyConfigured, getEtsyKeystring, getEtsyXApiKey } from './etsy-credentials.js'

const DEFAULT_BASE = 'https://openapi.etsy.com'

function baseUrl(): string {
  return (process.env.ETSY_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
}

function resolveApiKey(override?: string | null): string | null {
  const o = override?.trim()
  if (o) return o
  return getEtsyXApiKey()
}

async function etsyFetch(
  path: string,
  searchParams?: Record<string, string | number | undefined>,
  apiKeyOverride?: string | null,
): Promise<Response> {
  const key = resolveApiKey(apiKeyOverride)
  if (!key) {
    throw new Error('Etsy API key is not set (vendor key or ETSY_X_API_KEY)')
  }
  const u = new URL(`${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`)
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v))
    }
  }
  return fetch(u.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': key,
    },
  })
}

export type EtsyShop = {
  shop_id: number
  shop_name?: string
  title?: string
  url?: string
  icon_url_fullxfull?: string
}

export type EtsyListing = {
  listing_id: number
  title?: string
  url?: string
  price?: { amount?: number; divisor?: number; currency_code?: string }
  /** Present on some listing payloads */
  image_id?: number
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function parseEtsyShopInput(raw: string): string {
  const t = raw.trim()
  const m = t.match(/etsy\.com\/shop\/([^/?#]+)/i)
  if (m) return decodeURIComponent(m[1].replace(/\/$/, ''))
  return t.replace(/^@/, '').trim()
}

/** Resolve shop: numeric id uses getShop; else findShops by name. */
export async function resolveEtsyShop(
  input: string,
  apiKeyOverride?: string | null,
): Promise<{ shop: EtsyShop } | { error: string }> {
  const parsed = parseEtsyShopInput(input)
  if (!parsed) return { error: 'Shop name or URL is required' }

  if (/^\d+$/.test(parsed)) {
    const r = await etsyFetch(`/v3/application/shops/${parsed}`, undefined, apiKeyOverride)
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { error: err || `Etsy getShop failed (${r.status})` }
    }
    const j = (await r.json()) as { shop?: unknown }
    const rec = asRecord(j.shop ?? j)
    if (!rec || typeof rec.shop_id !== 'number') return { error: 'Invalid shop response from Etsy' }
    return { shop: rec as unknown as EtsyShop }
  }

  const r = await etsyFetch(
    '/v3/application/shops',
    {
      shop_name: parsed,
      limit: 10,
      offset: 0,
    },
    apiKeyOverride,
  )
  if (!r.ok) {
    const err = await r.text().catch(() => '')
    return { error: err || `Etsy findShops failed (${r.status})` }
  }
  const j = (await r.json()) as { results?: unknown[]; count?: number }
  const results = Array.isArray(j.results) ? j.results : []
  if (results.length === 0) return { error: `No Etsy shop found for “${parsed}”` }

  const lower = parsed.toLowerCase()
  let best = asRecord(results[0])
  for (const row of results) {
    const rec = asRecord(row)
    const name = String(rec?.shop_name ?? '').toLowerCase()
    if (name === lower) {
      best = rec
      break
    }
  }
  if (!best || typeof best.shop_id !== 'number') return { error: 'Invalid shop search response from Etsy' }
  return { shop: best as unknown as EtsyShop }
}

export function extractEtsyListingImageUrl(imageRow: unknown): string | null {
  const rec = asRecord(imageRow)
  if (!rec) return null
  for (const key of ['url_570xN', 'url_fullxfull', 'url_170x135', 'url_75x75'] as const) {
    const url = rec[key]
    if (typeof url === 'string' && url.length > 0) return url
  }
  return null
}

/** First listing image URL, or null if none / API error. */
export async function fetchListingPrimaryImageUrl(
  listingId: number,
  apiKeyOverride?: string | null,
): Promise<string | null> {
  const r = await etsyFetch(
    `/v3/application/listings/${listingId}/images`,
    { limit: 1, offset: 0 },
    apiKeyOverride,
  )
  if (!r.ok) return null
  const j = (await r.json()) as { results?: unknown[] }
  const results = Array.isArray(j.results) ? j.results : []
  if (results.length === 0) return null
  return extractEtsyListingImageUrl(results[0])
}

export async function fetchActiveListingsPage(
  shopId: string,
  offset: number,
  limit: number,
  apiKeyOverride?: string | null,
): Promise<{ listings: EtsyListing[]; count: number }> {
  const r = await etsyFetch(
    `/v3/application/shops/${shopId}/listings/active`,
    {
      limit,
      offset,
    },
    apiKeyOverride,
  )
  if (!r.ok) {
    const err = await r.text().catch(() => '')
    throw new Error(err || `Etsy listings failed (${r.status})`)
  }
  const j = (await r.json()) as { results?: unknown[]; count?: number }
  const results = Array.isArray(j.results) ? j.results : []
  const listings: EtsyListing[] = []
  for (const row of results) {
    const rec = asRecord(row)
    if (rec && typeof rec.listing_id === 'number') {
      listings.push(rec as unknown as EtsyListing)
    }
  }
  return { listings, count: typeof j.count === 'number' ? j.count : listings.length }
}
