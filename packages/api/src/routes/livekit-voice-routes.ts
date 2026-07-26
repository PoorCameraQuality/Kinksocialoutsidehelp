/**
 * Short-lived LiveKit tokens for org voice/video channels (ADR 002).
 * Room name: `${LIVEKIT_ROOM_PREFIX}_org_${orgId}_channel_${channelId}` (deterministic).
 */
import { and, eq } from 'drizzle-orm'
import { AccessToken } from 'livekit-server-sdk'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { isUserScopeBanned } from '../lib/org-moderation-access.js'
import { parseOrgFeatureFlags } from '../lib/org-features.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
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

const VOICE_KINDS = new Set(['VOICE', 'VIDEO', 'LIVE_STREAM'])

export async function registerLiveKitVoiceRoutes(app: FastifyInstance) {
  app.post('/api/v1/organizations/:orgKey/channels/:channelId/voice/token', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL?.trim()
    if (!apiKey || !apiSecret || !livekitUrl) {
      return reply.status(503).send({
        error: 'LiveKit is not configured',
        hint: 'Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET',
      })
    }

    const { orgKey, channelId } = req.params as { orgKey: string; channelId: string }
    if (!UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid channel id' })

    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Organization not found' })

    if (await isUserScopeBanned('organization', orgId, actor.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }

    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled) {
      return reply.status(400).send({ error: 'Chat disabled' })
    }

    const [mem] = await db
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, actor.userId)
        )
      )
      .limit(1)
    if (!mem) return reply.status(403).send({ error: 'Members only' })

    const [ch] = await db
      .select()
      .from(schema.orgChannels)
      .where(and(eq(schema.orgChannels.organizationId, orgId), eq(schema.orgChannels.id, channelId)))
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Channel not found' })
    if (!VOICE_KINDS.has(ch.kind)) {
      return reply.status(400).send({ error: 'This channel is not a voice or live room' })
    }

    const prefix = (process.env.LIVEKIT_ROOM_PREFIX ?? 'c2k').replace(/[^a-zA-Z0-9_-]/g, '') || 'c2k'
    const roomName = `${prefix}_org_${orgId}_channel_${channelId}`

    const [prof] = await db
      .select({ displayName: schema.profiles.displayName, username: schema.users.username })
      .from(schema.profiles)
      .innerJoin(schema.users, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.profiles.userId, actor.userId))
      .limit(1)
    const displayName = prof?.displayName ?? prof?.username ?? 'Participant'

    const at = new AccessToken(apiKey, apiSecret, {
      identity: actor.userId,
      name: displayName,
      ttl: '15m',
    })
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    })
    const token = await at.toJwt()

    return reply.send({
      token,
      url: livekitUrl,
      roomName,
    })
  })
}
