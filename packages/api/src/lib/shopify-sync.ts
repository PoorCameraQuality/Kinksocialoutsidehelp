import { and, eq, isNotNull, notInArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { decryptExternalSecretsJson } from './encrypt-external-secrets.js'

const SHOPIFY_PROVIDER = 'shopify'
const API_VER = process.env.SHOPIFY_API_VERSION ?? '2024-10'

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  image?: { src?: string }
  images?: { src?: string }[]
  variants?: { price?: string }[]
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const parts = linkHeader.split(',')
  for (const p of parts) {
    const m = p.match(/<([^>]+)>;\s*rel="next"/)
    if (m) return m[1]
  }
  return null
}

function priceToCents(price: string | undefined): number {
  if (!price) return 0
  const n = Number.parseFloat(price)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

export async function syncVendorShopifyListings(
  vendorId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorId))
    .limit(1)
  if (!vendor?.externalStoreSecretsEnc) {
    return { ok: false, error: 'Shopify not connected' }
  }
  const secrets = decryptExternalSecretsJson(vendor.externalStoreSecretsEnc)
  const accessToken = secrets?.accessToken
  if (typeof accessToken !== 'string' || !accessToken) {
    return { ok: false, error: 'Missing Shopify access token' }
  }
  const pub = vendor.externalStorePublic as { shopifyShop?: string } | null | undefined
  const shop = pub?.shopifyShop?.replace(/^https?:\/\//, '').split('/')[0]
  if (!shop) {
    return { ok: false, error: 'Missing Shopify shop domain' }
  }

  const now = new Date()
  const seenIds: string[] = []
  let url: string | null = `https://${shop}/admin/api/${API_VER}/products.json?limit=100`

  try {
    while (url) {
      const r = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          Accept: 'application/json',
        },
      })
      if (!r.ok) {
        const t = await r.text().catch(() => '')
        return { ok: false, error: t || `Shopify products failed (${r.status})` }
      }
      const j = (await r.json()) as { products?: ShopifyProduct[] }
      const products = Array.isArray(j.products) ? j.products : []
      for (const p of products) {
        const idStr = String(p.id)
        seenIds.push(idStr)
        const variantPrice = p.variants?.[0]?.price
        const priceCents = priceToCents(variantPrice)
        const title = (p.title ?? 'Product').slice(0, 5000)
        const handle = p.handle ?? idStr
        const listingUrl = `https://${shop}/products/${encodeURIComponent(handle)}`
        const img = p.image?.src ?? p.images?.[0]?.src ?? null

        await db
          .insert(schema.vendorExternalListings)
          .values({
            vendorId,
            provider: SHOPIFY_PROVIDER,
            externalListingId: idStr,
            title,
            priceCents,
            currency: 'USD',
            primaryImageUrl: img,
            listingUrl,
            syncedAt: now,
            raw: p as unknown as Record<string, unknown>,
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
              listingUrl,
              primaryImageUrl: img,
              syncedAt: now,
              raw: p as unknown as Record<string, unknown>,
            },
          })
      }
      url = parseLinkNext(r.headers.get('link'))
    }

    if (seenIds.length === 0) {
      await db
        .delete(schema.vendorExternalListings)
        .where(
          and(
            eq(schema.vendorExternalListings.vendorId, vendorId),
            eq(schema.vendorExternalListings.provider, SHOPIFY_PROVIDER)
          )
        )
    } else {
      await db
        .delete(schema.vendorExternalListings)
        .where(
          and(
            eq(schema.vendorExternalListings.vendorId, vendorId),
            eq(schema.vendorExternalListings.provider, SHOPIFY_PROVIDER),
            notInArray(schema.vendorExternalListings.externalListingId, seenIds)
          )
        )
    }

    await db
      .update(schema.vendorProfiles)
      .set({ externalListingsSyncedAt: now, externalSyncError: null })
      .where(eq(schema.vendorProfiles.id, vendorId))

    return { ok: true, count: seenIds.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .update(schema.vendorProfiles)
      .set({ externalSyncError: msg.slice(0, 2000) })
      .where(eq(schema.vendorProfiles.id, vendorId))
    return { ok: false, error: msg }
  }
}

export async function syncAllShopifyVendors(): Promise<{ vendors: number; errors: string[] }> {
  const rows = await db
    .select({ id: schema.vendorProfiles.id })
    .from(schema.vendorProfiles)
    .where(
      and(eq(schema.vendorProfiles.externalStoreType, 'shopify'), isNotNull(schema.vendorProfiles.externalStoreSecretsEnc))
    )
  const errors: string[] = []
  let n = 0
  for (const r of rows) {
    const res = await syncVendorShopifyListings(r.id)
    n++
    if (!res.ok) errors.push(`${r.id}: ${res.error}`)
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return { vendors: n, errors }
}
