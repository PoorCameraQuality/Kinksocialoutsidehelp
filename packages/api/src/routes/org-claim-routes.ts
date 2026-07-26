import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import {
  mintClaimTokenValue,
  previewClaimToken,
  redeemOrganizationClaimToken,
  resolveClaimPublicUrl,
} from '../lib/org-claim.js'
import { isSiteAdmin, isSiteOwner } from '../lib/platform-staff.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Database not enabled' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

async function resolveOrganizationId(orgKey: string): Promise<string | null> {
  if (UUID_RE.test(orgKey)) return orgKey
  const [row] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, orgKey))
    .limit(1)
  return row?.id ?? null
}

async function userCanMintClaimToken(orgId: string, userId: string): Promise<boolean> {
  const [org] = await db
    .select({ ownerId: schema.organizations.ownerId })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)
  if (!org) return false
  if (org.ownerId === userId) return true
  if (await isSiteOwner(userId)) return true
  if (await isSiteAdmin(userId)) return true
  return false
}

export async function registerOrgClaimRoutes(app: FastifyInstance) {
  app.get('/api/v1/organizations/claim/preview/:token', async (req, reply) => {
    if (!requireDb(reply)) return
    const { token } = req.params as { token: string }
    if (!token || token.length < 16) return reply.status(400).send({ error: 'Invalid token' })
    const preview = await previewClaimToken(token)
    return reply.send(preview)
  })

  app.post('/api/v1/organizations/claim/redeem', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const parsed = z.object({ token: z.string().min(16).max(128) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const result = await redeemOrganizationClaimToken({
      token: parsed.data.token,
      claimerUserId: actor.userId,
    })
    if (!result.ok) return reply.status(result.status).send({ error: result.error })

    return reply.send({
      ok: true,
      organizationSlug: result.organizationSlug,
      ownerId: result.ownerId,
      alreadyOwner: result.alreadyOwner,
    })
  })

  app.post('/api/v1/organizations/:orgKey/claim-tokens', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await userCanMintClaimToken(orgId, actor.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const body = z
      .object({ expiresInHours: z.number().int().min(1).max(24 * 30).optional() })
      .safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })

    const token = mintClaimTokenValue()
    const expiresAt = new Date(Date.now() + (body.data.expiresInHours ?? 168) * 60 * 60 * 1000)
    const [invite] = await db
      .insert(schema.organizationClaimTokens)
      .values({
        organizationId: orgId,
        token,
        createdByUserId: actor.userId,
        expiresAt,
      })
      .returning()

    return reply.send({
      invite: {
        id: invite!.id,
        token: invite!.token,
        expiresAt: invite!.expiresAt.toISOString(),
        claimUrl: resolveClaimPublicUrl(invite!.token),
      },
    })
  })
}
