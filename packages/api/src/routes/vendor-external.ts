import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { preprocessVendorWriteBody } from '@c2k/shared'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { encryptExternalSecretsJson } from '../lib/encrypt-external-secrets.js'
import { externalStoreSupportsSync, resolveExternalProvider } from '../lib/external-provider.js'
import { getExternalSyncQueue } from '../lib/external-sync-queue.js'
import { syncVendorExternalListings } from '../lib/external-sync.js'
import {
  requireVendorShopManager,
  resolveManagedVendorForMeRoutes,
  type VendorProfileRow,
} from '../lib/vendor-shop-people.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Database not enabled' })
    return false
  }
  return true
}

const MANUAL_SYNC_MIN_INTERVAL_MS = 120_000

const patchExternalBody = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('none') }),
  z.object({ provider: z.literal('link_only'), storeUrl: z.string().url().max(2000) }),
  z.object({
    provider: z.literal('woocommerce'),
    siteUrl: z.string().min(8).max(2000),
    consumerKey: z.string().min(1).max(256),
    consumerSecret: z.string().min(1).max(256),
  }),
  /** Vendor custom-app Admin API token (no C2K Shopify OAuth app). */
  z.object({
    provider: z.literal('shopify'),
    shopDomain: z.string().min(3).max(255),
    accessToken: z.string().min(8).max(512),
  }),
])

async function clearExternalListings(vendorId: string): Promise<void> {
  await db.delete(schema.vendorExternalListings).where(eq(schema.vendorExternalListings.vendorId, vendorId))
}

function vendorIdHintFromRequest(req: FastifyRequest): string | undefined {
  const q = req.query as { vendorId?: string }
  return typeof q.vendorId === 'string' && q.vendorId.trim() ? q.vendorId.trim() : undefined
}

async function patchExternalStoreForVendor(
  vendor: VendorProfileRow,
  body: z.infer<typeof patchExternalBody>,
): Promise<VendorProfileRow | null> {
  if (body.provider === 'none') {
    await clearExternalListings(vendor.id)
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'none',
        externalStorePublic: null,
        externalStoreSecretsEnc: null,
        externalListingsSyncedAt: null,
        externalSyncError: null,
        usesEtsy: false,
        etsyShopId: null,
        etsyShopUrl: null,
        etsyShopName: null,
        etsyListingsSyncedAt: null,
        etsySyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, vendor.id))
      .returning()
    return updated ?? null
  }

  if (body.provider === 'link_only') {
    await clearExternalListings(vendor.id)
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'link_only',
        externalStorePublic: { storefrontUrl: body.storeUrl },
        externalStoreSecretsEnc: null,
        externalListingsSyncedAt: null,
        externalSyncError: null,
        website: body.storeUrl,
        usesEtsy: false,
        etsyShopId: null,
        etsyShopUrl: null,
        etsyShopName: null,
        etsyListingsSyncedAt: null,
        etsySyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, vendor.id))
      .returning()
    return updated ?? null
  }

  if (body.provider === 'woocommerce') {
    const site = body.siteUrl.trim().replace(/\/$/, '')
    const secretsEnc = encryptExternalSecretsJson({
      consumerKey: body.consumerKey.trim(),
      consumerSecret: body.consumerSecret.trim(),
    })
    await clearExternalListings(vendor.id)
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'woocommerce',
        externalStorePublic: { wooSiteUrl: site },
        externalStoreSecretsEnc: secretsEnc,
        externalSyncError: null,
        usesEtsy: false,
        etsyShopId: null,
        etsyShopUrl: null,
        etsyShopName: null,
        etsyListingsSyncedAt: null,
        etsySyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, vendor.id))
      .returning()

    try {
      await getExternalSyncQueue().add(
        'sync-vendor',
        { vendorId: vendor.id },
        { removeOnComplete: 50, removeOnFail: 20 },
      )
    } catch (e) {
      console.warn('[woo] queue add failed, syncing inline', e)
      await syncVendorExternalListings(vendor.id)
    }

    const [fresh] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendor.id)).limit(1)
    return fresh ?? updated ?? null
  }

  if (body.provider === 'shopify') {
    const shop = body.shopDomain
      .trim()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .toLowerCase()
    if (!shop.includes('.')) {
      return null
    }
    const secretsEnc = encryptExternalSecretsJson({
      accessToken: body.accessToken.trim(),
    })
    await clearExternalListings(vendor.id)
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'shopify',
        externalStorePublic: { shopifyShop: shop, byoAccessToken: true },
        externalStoreSecretsEnc: secretsEnc,
        externalSyncError: null,
        usesEtsy: false,
        etsyShopId: null,
        etsyShopUrl: null,
        etsyShopName: null,
        etsyListingsSyncedAt: null,
        etsySyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, vendor.id))
      .returning()

    try {
      await getExternalSyncQueue().add(
        'sync-vendor',
        { vendorId: vendor.id },
        { removeOnComplete: 50, removeOnFail: 20 },
      )
    } catch (e) {
      console.warn('[shopify] queue add failed, syncing inline', e)
      await syncVendorExternalListings(vendor.id)
    }

    const [fresh] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendor.id)).limit(1)
    return fresh ?? updated ?? null
  }

  return null
}

async function syncExternalStoreForVendor(vendor: VendorProfileRow): Promise<
  | { ok: true; count: number; vendor: VendorProfileRow | undefined }
  | { ok: false; status: number; error: string; retryAfterSec?: number }
> {
  const p = resolveExternalProvider(vendor)
  if (!externalStoreSupportsSync(p)) {
    return { ok: false, status: 400, error: 'Connect an API-backed store (Etsy, Shopify, or WooCommerce) first' }
  }

  const last = vendor.externalListingsSyncedAt ?? vendor.etsyListingsSyncedAt
  if (last) {
    const elapsed = Date.now() - new Date(last).getTime()
    if (elapsed < MANUAL_SYNC_MIN_INTERVAL_MS) {
      const retryAfterSec = Math.ceil((MANUAL_SYNC_MIN_INTERVAL_MS - elapsed) / 1000)
      return { ok: false, status: 429, error: 'Please wait before syncing again', retryAfterSec }
    }
  }

  const result = await syncVendorExternalListings(vendor.id)
  if (!result.ok) {
    return { ok: false, status: 502, error: result.error }
  }
  const [fresh] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendor.id)).limit(1)
  return { ok: true, count: result.count, vendor: fresh }
}

export async function registerVendorExternalRoutes(app: FastifyInstance) {
  const handlePatchExternal = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })

    const parsed = patchExternalBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    let vendor: VendorProfileRow | null = null
    if (vendorProfileId) {
      const gate = await requireVendorShopManager(vendorProfileId, userId)
      if (!gate.ok) {
        return reply.status(gate.status).send({ error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' })
      }
      vendor = gate.vendor
    } else {
      const gate = await resolveManagedVendorForMeRoutes(userId, vendorIdHintFromRequest(req))
      if (!gate.ok) return reply.status(gate.status).send({ error: gate.error })
      vendor = gate.vendor
    }

    const updated = await patchExternalStoreForVendor(vendor, parsed.data)
    if (!updated) return reply.status(400).send({ error: 'Unsupported provider' })
    return reply.send({ vendor: updated })
  }

  const handleSyncExternal = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })

    let vendor: VendorProfileRow | null = null
    if (vendorProfileId) {
      const gate = await requireVendorShopManager(vendorProfileId, userId)
      if (!gate.ok) {
        return reply.status(gate.status).send({ error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' })
      }
      vendor = gate.vendor
    } else {
      const gate = await resolveManagedVendorForMeRoutes(userId, vendorIdHintFromRequest(req))
      if (!gate.ok) return reply.status(gate.status).send({ error: gate.error })
      vendor = gate.vendor
    }

    const result = await syncExternalStoreForVendor(vendor)
    if (!result.ok) {
      if (result.retryAfterSec) {
        return reply
          .status(result.status)
          .header('Retry-After', String(result.retryAfterSec))
          .send({ error: result.error, retryAfterSec: result.retryAfterSec })
      }
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.send({ synced: result.count, vendor: result.vendor })
  }

  app.patch('/api/v1/vendors/me/external-store', (req, reply) => handlePatchExternal(req, reply))
  app.post('/api/v1/vendors/me/external-store/sync', (req, reply) => handleSyncExternal(req, reply))
  app.patch('/api/v1/vendors/:vendorId/external-store', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return handlePatchExternal(req, reply, vendorId)
  })
  app.post('/api/v1/vendors/:vendorId/external-store/sync', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return handleSyncExternal(req, reply, vendorId)
  })
}
