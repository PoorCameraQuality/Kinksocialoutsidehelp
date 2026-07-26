import { and, eq, isNotNull, notInArray, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { fetchActiveListingsPage, fetchListingPrimaryImageUrl, etsyConfigured } from './etsy-client.js'
import { decryptExternalSecretsJson } from './encrypt-external-secrets.js'
import { encryptEtsyOAuthSecrets, getValidEtsyOAuthSecrets } from './etsy-oauth.js'
import { getEtsyXApiKey } from './etsy-credentials.js'

const PAGE_SIZE = 100
const ETSY_PROVIDER = 'etsy'

function moneyToCents(price: { amount?: number; divisor?: number } | undefined): number {
  if (!price || typeof price.amount !== 'number') return 0
  const div = typeof price.divisor === 'number' && price.divisor > 0 ? price.divisor : 100
  return Math.max(0, Math.round((price.amount / div) * 100))
}

function vendorEtsyApiKey(secretsEnc: string | null | undefined): string | null {
  if (!secretsEnc) return null
  const secrets = decryptExternalSecretsJson(secretsEnc)
  const key = secrets?.xApiKey
  return typeof key === 'string' && key.trim() ? key.trim() : null
}

/**
 * Full sync of active Etsy listings into vendor_external_listings.
 * Uses the vendor's BYO x-api-key when present; otherwise the server ETSY_X_API_KEY.
 */
export async function syncVendorEtsyListings(vendorId: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorId))
    .limit(1)
  if (!vendor?.etsyShopId) {
    return { ok: false, error: 'Vendor has no Etsy shop connected' }
  }

  const byoKey = vendorEtsyApiKey(vendor.externalStoreSecretsEnc)
  if (!byoKey && !etsyConfigured()) {
    return {
      ok: false,
      error: 'Etsy API key required: paste your Etsy app key on the shop, or set ETSY_X_API_KEY on the server',
    }
  }

  const shopId = vendor.etsyShopId
  const now = new Date()
  const apiKey = byoKey ?? getEtsyXApiKey()

  if (vendor.externalStoreSecretsEnc && !byoKey) {
    const oauth = await getValidEtsyOAuthSecrets(vendor.externalStoreSecretsEnc)
    if (oauth) {
      await db
        .update(schema.vendorProfiles)
        .set({ externalStoreSecretsEnc: encryptEtsyOAuthSecrets(oauth) })
        .where(eq(schema.vendorProfiles.id, vendorId))
    }
  }

  const seenIds: string[] = []
  let offset = 0

  try {
    for (;;) {
      const { listings, count } = await fetchActiveListingsPage(shopId, offset, PAGE_SIZE, apiKey)
      const imageUrls = await Promise.all(
        listings.map((L) => fetchListingPrimaryImageUrl(L.listing_id, apiKey).catch(() => null)),
      )
      for (let i = 0; i < listings.length; i++) {
        const L = listings[i]
        const idStr = String(L.listing_id)
        seenIds.push(idStr)
        const priceCents = moneyToCents(L.price)
        const currency = (L.price?.currency_code ?? 'USD').slice(0, 8) || 'USD'
        const title = (L.title ?? 'Listing').slice(0, 5000)
        const listingUrl = L.url ?? `https://www.etsy.com/listing/${L.listing_id}`
        const primaryImageUrl = imageUrls[i] ?? null

        await db
          .insert(schema.vendorExternalListings)
          .values({
            vendorId,
            provider: ETSY_PROVIDER,
            externalListingId: idStr,
            title,
            priceCents,
            currency,
            primaryImageUrl,
            listingUrl,
            syncedAt: now,
            raw: L as unknown as Record<string, unknown>,
          })
          .onConflictDoUpdate({
            target: [
              schema.vendorExternalListings.vendorId,
              schema.vendorExternalListings.provider,
              schema.vendorExternalListings.externalListingId,
            ],
            set: {
              title,
              priceCents,
              currency,
              primaryImageUrl,
              listingUrl,
              syncedAt: now,
              raw: L as unknown as Record<string, unknown>,
            },
          })
      }
      offset += listings.length
      if (listings.length === 0 || offset >= count) break
    }

    if (seenIds.length === 0) {
      await db
        .delete(schema.vendorExternalListings)
        .where(
          and(eq(schema.vendorExternalListings.vendorId, vendorId), eq(schema.vendorExternalListings.provider, ETSY_PROVIDER))
        )
    } else {
      await db
        .delete(schema.vendorExternalListings)
        .where(
          and(
            eq(schema.vendorExternalListings.vendorId, vendorId),
            eq(schema.vendorExternalListings.provider, ETSY_PROVIDER),
            notInArray(schema.vendorExternalListings.externalListingId, seenIds)
          )
        )
    }

    await db
      .update(schema.vendorProfiles)
      .set({
        externalListingsSyncedAt: now,
        externalSyncError: null,
        etsyListingsSyncedAt: now,
        etsySyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, vendorId))

    return { ok: true, count: seenIds.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .update(schema.vendorProfiles)
      .set({
        externalSyncError: msg.slice(0, 2000),
        etsySyncError: msg.slice(0, 2000),
      })
      .where(eq(schema.vendorProfiles.id, vendorId))
    return { ok: false, error: msg }
  }
}

export async function syncAllEtsyVendors(): Promise<{ vendors: number; errors: string[] }> {
  const rows = await db
    .select({ id: schema.vendorProfiles.id })
    .from(schema.vendorProfiles)
    .where(
      or(
        and(eq(schema.vendorProfiles.externalStoreType, 'etsy'), isNotNull(schema.vendorProfiles.etsyShopId)),
        and(eq(schema.vendorProfiles.usesEtsy, true), isNotNull(schema.vendorProfiles.etsyShopId))
      )
    )
  const uniq = [...new Map(rows.map((r) => [r.id, r])).values()]
  const errors: string[] = []
  let n = 0
  for (const r of uniq) {
    const res = await syncVendorEtsyListings(r.id)
    n++
    if (!res.ok) errors.push(`${r.id}: ${res.error}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return { vendors: n, errors }
}
