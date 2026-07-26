import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { preprocessVendorWriteBody } from '@c2k/shared'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { etsyConfigured, resolveEtsyShop } from '../lib/etsy-client.js'
import { encryptExternalSecretsJson } from '../lib/encrypt-external-secrets.js'
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

const patchEtsyBody = z.object({
  shopUrl: z.union([z.string().min(1).max(2000), z.null()]),
  /** Vendor-created Etsy app key (keystring:shared_secret). Required when server has no ETSY_X_API_KEY. */
  xApiKey: z.string().min(8).max(512).optional(),
})

async function clearExternalListings(vendorId: string): Promise<void> {
  await db.delete(schema.vendorExternalListings).where(eq(schema.vendorExternalListings.vendorId, vendorId))
}

function vendorIdHintFromRequest(req: FastifyRequest): string | undefined {
  const q = req.query as { vendorId?: string }
  return typeof q.vendorId === 'string' && q.vendorId.trim() ? q.vendorId.trim() : undefined
}

async function resolveVendorForEtsyRoute(
  req: FastifyRequest,
  userId: string,
  vendorProfileId?: string,
): Promise<VendorProfileRow | { status: number; error: string }> {
  if (vendorProfileId) {
    const gate = await requireVendorShopManager(vendorProfileId, userId)
    if (!gate.ok) {
      return { status: gate.status, error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' }
    }
    return gate.vendor
  }
  const gate = await resolveManagedVendorForMeRoutes(userId, vendorIdHintFromRequest(req))
  if (!gate.ok) return { status: gate.status, error: gate.error }
  return gate.vendor
}

/** Legacy Etsy-specific routes; also sets unified `external_store_type`. */
export async function registerVendorEtsyRoutes(app: FastifyInstance) {
  const handlePatchEtsy = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })

    const parsed = patchEtsyBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    const vendorOrErr = await resolveVendorForEtsyRoute(req, userId, vendorProfileId)
    if ('error' in vendorOrErr) {
      return reply.status(vendorOrErr.status).send({ error: vendorOrErr.error })
    }
    const vendor = vendorOrErr

    if (parsed.data.shopUrl === null) {
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
      return reply.send({ vendor: updated })
    }

    const byoKey = parsed.data.xApiKey?.trim()
    if (!byoKey && !etsyConfigured()) {
      return reply.status(400).send({
        error:
          'Paste your Etsy app API key (keystring:shared_secret from your own Etsy developer app). Platform Etsy OAuth is not available.',
      })
    }

    const resolved = await resolveEtsyShop(parsed.data.shopUrl, byoKey)
    if ('error' in resolved) {
      return reply.status(400).send({ error: resolved.error })
    }

    const shop = resolved.shop
    const shopIdStr = String(shop.shop_id)
    const shopUrl = shop.url ?? `https://www.etsy.com/shop/${encodeURIComponent(shop.shop_name ?? shopIdStr)}`
    const shopName = shop.shop_name ?? shop.title ?? null

    await clearExternalListings(vendor.id)

    const secretsEnc = byoKey ? encryptExternalSecretsJson({ xApiKey: byoKey }) : null

    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'etsy',
        externalStorePublic: { etsyShopName: shopName, byoApiKey: Boolean(byoKey) },
        externalStoreSecretsEnc: secretsEnc,
        externalSyncError: null,
        usesEtsy: true,
        etsyShopId: shopIdStr,
        etsyShopUrl: shopUrl,
        etsyShopName: shopName,
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
      console.warn('[etsy] queue add failed, syncing inline', e)
      await syncVendorExternalListings(vendor.id)
    }

    return reply.send({ vendor: updated })
  }

  const handleSyncEtsy = async (req: FastifyRequest, reply: FastifyReply, vendorProfileId?: string) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })

    const vendorOrErr = await resolveVendorForEtsyRoute(req, userId, vendorProfileId)
    if ('error' in vendorOrErr) {
      return reply.status(vendorOrErr.status).send({ error: vendorOrErr.error })
    }
    const vendor = vendorOrErr

    if ((!vendor.usesEtsy && vendor.externalStoreType !== 'etsy') || !vendor.etsyShopId) {
      return reply.status(400).send({ error: 'Connect an Etsy shop first' })
    }
    const last = vendor.externalListingsSyncedAt ?? vendor.etsyListingsSyncedAt
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime()
      if (elapsed < MANUAL_SYNC_MIN_INTERVAL_MS) {
        const retryAfterSec = Math.ceil((MANUAL_SYNC_MIN_INTERVAL_MS - elapsed) / 1000)
        return reply
          .status(429)
          .header('Retry-After', String(retryAfterSec))
          .send({ error: 'Please wait before syncing again', retryAfterSec })
      }
    }

    const result = await syncVendorExternalListings(vendor.id)
    if (!result.ok) {
      return reply.status(502).send({ error: result.error })
    }
    const [fresh] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendor.id)).limit(1)
    return reply.send({ synced: result.count, vendor: fresh })
  }

  app.patch('/api/v1/vendors/me/etsy', (req, reply) => handlePatchEtsy(req, reply))
  app.post('/api/v1/vendors/me/etsy/sync', (req, reply) => handleSyncEtsy(req, reply))
  app.patch('/api/v1/vendors/:vendorId/etsy', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return handlePatchEtsy(req, reply, vendorId)
  })
  app.post('/api/v1/vendors/:vendorId/etsy/sync', (req, reply) => {
    const { vendorId } = req.params as { vendorId: string }
    return handleSyncEtsy(req, reply, vendorId)
  })
}
