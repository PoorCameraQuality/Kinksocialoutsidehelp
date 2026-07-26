import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { etsyConfigured } from '../lib/etsy-credentials.js'
import {
  buildEtsyAuthorizeUrl,
  encryptEtsyOAuthSecrets,
  exchangeEtsyAuthorizationCode,
  fetchEtsyUserShops,
  generatePkce,
  parseEtsyOauthState,
  parseEtsyUserIdFromAccessToken,
  signEtsyOauthState,
} from '../lib/etsy-oauth.js'
import { getExternalSyncQueue } from '../lib/external-sync-queue.js'
import { syncVendorExternalListings } from '../lib/external-sync.js'
import { requireVendorShopManager, resolveManagedVendorForMeRoutes } from '../lib/vendor-shop-people.js'

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

function publicApiBase(): string {
  return (process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
}

function webOrigin(): string {
  return process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:5173'
}

export async function registerEtsyIntegrationRoutes(app: FastifyInstance) {
  app.get('/api/v1/integrations/etsy/install', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireDb(reply)) return
    if (!etsyConfigured()) {
      return reply.status(503).send({ error: 'Etsy is not configured (set ETSY_X_API_KEY on the server)' })
    }

    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Log in to connect Etsy' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })

    const vendorIdHint = (req.query as { vendorId?: string }).vendorId?.trim()
    let vendorId: string
    if (vendorIdHint) {
      const gate = await requireVendorShopManager(vendorIdHint, userId)
      if (!gate.ok) {
        return reply.status(gate.status).send({ error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' })
      }
      vendorId = gate.vendor.id
    } else {
      const gate = await resolveManagedVendorForMeRoutes(userId)
      if (!gate.ok) return reply.status(gate.status).send({ error: gate.error })
      vendorId = gate.vendor.id
    }

    const { codeVerifier, codeChallenge } = generatePkce()
    const state = signEtsyOauthState(vendorId, userId, codeVerifier)
    const redirectUri = `${publicApiBase()}/api/v1/integrations/etsy/callback`
    const authUrl = buildEtsyAuthorizeUrl({ redirectUri, state, codeChallenge })
    return reply.redirect(authUrl, 302)
  })

  app.get('/api/v1/integrations/etsy/callback', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireDb(reply)) return
    if (!etsyConfigured()) {
      return reply.status(503).send({ error: 'Etsy is not configured' })
    }

    const q = req.query as Record<string, string | undefined>
    const error = q.error
    if (error) {
      const web = webOrigin()
      return reply.redirect(
        `${web}/settings?vendor=etsy&etsy=error&reason=${encodeURIComponent(q.error_description ?? error)}`,
        302,
      )
    }

    const code = q.code
    const state = q.state
    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state' })
    }

    const parsed = parseEtsyOauthState(state)
    if (!parsed) {
      return reply.status(400).send({ error: 'Invalid or expired OAuth state' })
    }

    const managerGate = await requireVendorShopManager(parsed.vendorId, parsed.userId)
    if (!managerGate.ok) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const redirectUri = `${publicApiBase()}/api/v1/integrations/etsy/callback`
    let oauthSecrets
    try {
      oauthSecrets = await exchangeEtsyAuthorizationCode(code, parsed.codeVerifier, redirectUri)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return reply.status(502).send({ error: msg })
    }

    const etsyUserId =
      oauthSecrets.etsyUserId ?? parseEtsyUserIdFromAccessToken(oauthSecrets.accessToken)
    if (!etsyUserId) {
      return reply.status(502).send({ error: 'Could not parse Etsy user id from access token' })
    }

    let shops
    try {
      shops = await fetchEtsyUserShops(oauthSecrets.accessToken, etsyUserId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return reply.status(502).send({ error: msg })
    }
    if (shops.length === 0) {
      return reply.status(400).send({ error: 'No Etsy shop found on this Etsy account' })
    }

    const shop = shops[0]
    const shopIdStr = String(shop.shop_id)
    const shopUrl =
      shop.url ?? `https://www.etsy.com/shop/${encodeURIComponent(shop.shop_name ?? shopIdStr)}`
    const shopName = shop.shop_name ?? shop.title ?? null

    await db
      .delete(schema.vendorExternalListings)
      .where(eq(schema.vendorExternalListings.vendorId, parsed.vendorId))

    const secretsEnc = encryptEtsyOAuthSecrets(oauthSecrets)
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'etsy',
        externalStorePublic: { etsyShopName: shopName, etsyOAuth: true },
        externalStoreSecretsEnc: secretsEnc,
        externalSyncError: null,
        usesEtsy: true,
        etsyShopId: shopIdStr,
        etsyShopUrl: shopUrl,
        etsyShopName: shopName,
        etsySyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, parsed.vendorId))
      .returning()

    if (!updated) return reply.status(404).send({ error: 'Vendor not found' })

    try {
      await getExternalSyncQueue().add(
        'sync-vendor',
        { vendorId: parsed.vendorId },
        { removeOnComplete: 50, removeOnFail: 20 },
      )
    } catch (e) {
      console.warn('[etsy] queue add failed, syncing inline', e)
      await syncVendorExternalListings(parsed.vendorId)
    }

    const slug = updated.slug
    return reply.redirect(`${webOrigin()}/vendors/${encodeURIComponent(slug)}?etsy=connected`, 302)
  })
}
