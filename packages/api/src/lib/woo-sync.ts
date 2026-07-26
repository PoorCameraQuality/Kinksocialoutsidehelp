import { and, eq, isNotNull, notInArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { decryptExternalSecretsJson } from './encrypt-external-secrets.js'

const WOO_PROVIDER = 'woocommerce'

type WooProduct = {
  id: number
  name?: string
  permalink?: string
  prices?: { price?: string; currency_code?: string }
  price?: string
  images?: { src?: string }[]
}

function normalizeSiteUrl(raw: string): string {
  const u = raw.trim().replace(/\/$/, '')
  if (!/^https?:\/\//i.test(u)) return `https://${u}`
  return u
}

function priceToCents(price: string | undefined): number {
  if (!price) return 0
  const n = Number.parseFloat(price)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

export async function syncVendorWooListings(
  vendorId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorId))
    .limit(1)
  if (!vendor?.externalStoreSecretsEnc) {
    return { ok: false, error: 'WooCommerce not connected' }
  }
  const secrets = decryptExternalSecretsJson(vendor.externalStoreSecretsEnc)
  const consumerKey = secrets?.consumerKey
  const consumerSecret = secrets?.consumerSecret
  if (typeof consumerKey !== 'string' || typeof consumerSecret !== 'string') {
    return { ok: false, error: 'Missing WooCommerce API credentials' }
  }
  const pub = vendor.externalStorePublic as { wooSiteUrl?: string } | null | undefined
  const site = pub?.wooSiteUrl ? normalizeSiteUrl(pub.wooSiteUrl) : null
  if (!site) {
    return { ok: false, error: 'Missing WooCommerce site URL' }
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  const now = new Date()
  const seenIds: string[] = []
  let page = 1

  try {
    for (;;) {
      const url = `${site}/wp-json/wc/v3/products?per_page=100&page=${page}`
      const r = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      })
      if (!r.ok) {
        const t = await r.text().catch(() => '')
        return { ok: false, error: t || `WooCommerce products failed (${r.status})` }
      }
      const arr = (await r.json()) as WooProduct[]
      if (!Array.isArray(arr) || arr.length === 0) break
      for (const p of arr) {
        const idStr = String(p.id)
        seenIds.push(idStr)
        const priceStr = p.prices?.price ?? p.price ?? '0'
        const currency = (p.prices?.currency_code ?? 'USD').slice(0, 8) || 'USD'
        const priceCents = priceToCents(priceStr)
        const title = (p.name ?? 'Product').slice(0, 5000)
        const listingUrl = p.permalink ?? `${site}/?p=${p.id}`
        const img = p.images?.[0]?.src ?? null

        await db
          .insert(schema.vendorExternalListings)
          .values({
            vendorId,
            provider: WOO_PROVIDER,
            externalListingId: idStr,
            title,
            priceCents,
            currency,
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
              currency,
              listingUrl,
              primaryImageUrl: img,
              syncedAt: now,
              raw: p as unknown as Record<string, unknown>,
            },
          })
      }
      if (arr.length < 100) break
      page++
    }

    if (seenIds.length === 0) {
      await db
        .delete(schema.vendorExternalListings)
        .where(
          and(eq(schema.vendorExternalListings.vendorId, vendorId), eq(schema.vendorExternalListings.provider, WOO_PROVIDER))
        )
    } else {
      await db
        .delete(schema.vendorExternalListings)
        .where(
          and(
            eq(schema.vendorExternalListings.vendorId, vendorId),
            eq(schema.vendorExternalListings.provider, WOO_PROVIDER),
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

export async function syncAllWooVendors(): Promise<{ vendors: number; errors: string[] }> {
  const rows = await db
    .select({ id: schema.vendorProfiles.id })
    .from(schema.vendorProfiles)
    .where(
      and(
        eq(schema.vendorProfiles.externalStoreType, 'woocommerce'),
        isNotNull(schema.vendorProfiles.externalStoreSecretsEnc)
      )
    )
  const errors: string[] = []
  let n = 0
  for (const r of rows) {
    const res = await syncVendorWooListings(r.id)
    n++
    if (!res.ok) errors.push(`${r.id}: ${res.error}`)
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return { vendors: n, errors }
}
