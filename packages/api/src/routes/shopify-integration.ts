import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { encryptExternalSecretsJson } from '../lib/encrypt-external-secrets.js'
import { getExternalSyncQueue } from '../lib/external-sync-queue.js'
import { syncVendorShopifyListings } from '../lib/shopify-sync.js'
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

function shopifyCreds(): { key: string; secret: string } | null {
  const key = process.env.SHOPIFY_API_KEY?.trim()
  const secret = process.env.SHOPIFY_API_SECRET?.trim()
  if (!key || !secret) return null
  return { key, secret }
}

function publicApiBase(): string {
  return (process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
}

function oauthScopes(): string {
  return process.env.SHOPIFY_SCOPES?.trim() ?? 'read_products'
}

function signState(vendorId: string, shop: string, userId: string, secret: string): string {
  const payload = JSON.stringify({ vendorId, shop, userId, t: Date.now() })
  const b64 = Buffer.from(payload, 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function parseState(state: string, secret: string): { vendorId: string; shop: string; userId: string } | null {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  const expected = createHmac('sha256', secret).update(b64).digest('base64url')
  try {
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  } catch {
    return null
  }
  try {
    const j = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as {
      vendorId?: string
      shop?: string
      userId?: string
      t?: number
    }
    if (!j.vendorId || !j.shop || !j.userId) return null
    if (typeof j.t !== 'number' || Date.now() - j.t > 15 * 60 * 1000) return null
    return { vendorId: j.vendorId, shop: j.shop, userId: j.userId }
  } catch {
    return null
  }
}

function verifyShopifyOAuthHmac(query: Record<string, string>, secret: string): boolean {
  const hmac = query.hmac
  if (!hmac) return false
  const message = Object.keys(query)
    .filter((k) => k !== 'hmac' && k !== 'signature')
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&')
  const gen = createHmac('sha256', secret).update(message).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(gen, 'hex'), Buffer.from(hmac, 'hex'))
  } catch {
    return false
  }
}

function normalizeShopHost(shop: string): string | null {
  const s = shop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
  if (!s.endsWith('.myshopify.com')) return null
  return s
}

export async function registerShopifyIntegrationRoutes(app: FastifyInstance) {
  app.get('/api/v1/integrations/shopify/install', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireDb(reply)) return
    const creds = shopifyCreds()
    if (!creds) {
      return reply.status(503).send({ error: 'Shopify is not configured (SHOPIFY_API_KEY / SHOPIFY_API_SECRET)' })
    }
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Log in to connect Shopify' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })

    const shopRaw = (req.query as { shop?: string }).shop
    if (!shopRaw || typeof shopRaw !== 'string') {
      return reply.status(400).send({ error: 'Missing shop query (e.g. your-store.myshopify.com)' })
    }
    const shop = normalizeShopHost(shopRaw)
    if (!shop) {
      return reply.status(400).send({ error: 'shop must be a *.myshopify.com hostname' })
    }

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

    const state = signState(vendorId, shop, userId, creds.secret)
    const redirectUri = `${publicApiBase()}/api/v1/integrations/shopify/callback`
    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`)
    authUrl.searchParams.set('client_id', creds.key)
    authUrl.searchParams.set('scope', oauthScopes())
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    return reply.redirect(authUrl.toString(), 302)
  })

  app.get('/api/v1/integrations/shopify/callback', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!requireDb(reply)) return
    const creds = shopifyCreds()
    if (!creds) {
      return reply.status(503).send({ error: 'Shopify is not configured' })
    }

    const q = req.query as Record<string, string>
    const flat: Record<string, string> = {}
    for (const [k, val] of Object.entries(q)) {
      flat[k] = Array.isArray(val) ? val[0] : val
    }

    if (!verifyShopifyOAuthHmac(flat, creds.secret)) {
      return reply.status(400).send({ error: 'Invalid OAuth HMAC' })
    }

    const code = flat.code
    const state = flat.state
    const shop = normalizeShopHost(flat.shop ?? '')
    if (!code || !state || !shop) {
      return reply.status(400).send({ error: 'Missing code, state, or shop' })
    }

    const parsed = parseState(state, creds.secret)
    if (!parsed || parsed.shop !== shop) {
      return reply.status(400).send({ error: 'Invalid or expired state' })
    }

    const managerGate = await requireVendorShopManager(parsed.vendorId, parsed.userId)
    if (!managerGate.ok) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const redirectUri = `${publicApiBase()}/api/v1/integrations/shopify/callback`
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: creds.key,
        client_secret: creds.secret,
        code,
      }),
    })
    if (!tokenRes.ok) {
      const t = await tokenRes.text().catch(() => '')
      return reply.status(502).send({ error: t || 'Token exchange failed' })
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    const accessToken = tokenJson.access_token
    if (!accessToken) {
      return reply.status(502).send({ error: 'No access_token in response' })
    }

    await db.delete(schema.vendorExternalListings).where(eq(schema.vendorExternalListings.vendorId, parsed.vendorId))

    const secretsEnc = encryptExternalSecretsJson({ accessToken })
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        externalStoreType: 'shopify',
        externalStorePublic: { shopifyShop: shop },
        externalStoreSecretsEnc: secretsEnc,
        usesEtsy: false,
        etsyShopId: null,
        etsyShopUrl: null,
        etsyShopName: null,
        etsyListingsSyncedAt: null,
        etsySyncError: null,
        externalSyncError: null,
      })
      .where(eq(schema.vendorProfiles.id, parsed.vendorId))
      .returning()

    if (!updated) return reply.status(404).send({ error: 'Vendor not found' })

    try {
      await getExternalSyncQueue().add(
        'sync-vendor',
        { vendorId: parsed.vendorId },
        { removeOnComplete: 50, removeOnFail: 20 }
      )
    } catch (e) {
      console.warn('[shopify] queue add failed, syncing inline', e)
      await syncVendorShopifyListings(parsed.vendorId)
    }

    const web = process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:5173'
    const slug = updated.slug
    return reply.redirect(`${web}/vendors/${encodeURIComponent(slug)}?shopify=connected`, 302)
  })
}
