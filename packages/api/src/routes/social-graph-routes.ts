import { and, desc, eq, inArray, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { normalizePrivacySettings } from '@c2k/shared'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from '../lib/accepted-friends.js'
import { isBlockedPair, loadBlockedUserIds } from '../lib/blocks.js'
import { assertCanInitiateDm, resolveProfileMessageHint } from '../lib/dm-privacy.js'
import { getDmRequestStatusBetween } from '../lib/conversation-dm-status.js'
import { redactListProfileIdentityFields } from '../lib/profile-field-redaction.js'
import { loadFollowerUserIds, loadFollowingUserIds } from '../lib/follows.js'
import { emitActivity } from '../lib/feed-activities.js'
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

async function resolveUserByUsername(username: string) {
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  return row ?? null
}

async function targetAllowsFollow(targetUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ privacySettings: schema.userSettings.privacySettings })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, targetUserId))
    .limit(1)
  return normalizePrivacySettings(row?.privacySettings).allowFollow
}

async function connectionBetween(
  userIdA: string,
  userIdB: string
): Promise<typeof schema.connections.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(schema.connections)
    .where(
      or(
        and(eq(schema.connections.requesterId, userIdA), eq(schema.connections.recipientId, userIdB)),
        and(eq(schema.connections.requesterId, userIdB), eq(schema.connections.recipientId, userIdA))
      )
    )
    .limit(1)
  return row ?? null
}

export async function registerSocialGraphRoutes(app: FastifyInstance) {
  app.get('/api/v1/users/:username/graph-status', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const { username } = req.params as { username: string }
    const target = await resolveUserByUsername(username)
    if (!target) return reply.status(404).send({ error: 'User not found' })
    if (!viewerId) {
      return reply.send({
        connectionStatus: null,
        isFollowing: false,
        isFollowedBy: false,
      })
    }
    if (viewerId === target.id) {
      return reply.send({
        connectionStatus: 'self',
        isFollowing: false,
        isFollowedBy: false,
      })
    }
    const conn = await connectionBetween(viewerId, target.id)
    let connectionStatus: string | null = null
    if (conn) {
      if (conn.status === 'ACCEPTED') connectionStatus = 'connected'
      else if (conn.status === 'PENDING') {
        connectionStatus = conn.requesterId === viewerId ? 'pending_outgoing' : 'pending_incoming'
      } else if (conn.status === 'IGNORED' && conn.recipientId === viewerId) {
        connectionStatus = 'ignored'
      } else if (conn.status === 'DECLINED') connectionStatus = 'declined'
    }
    const [followOut] = await db
      .select()
      .from(schema.userFollows)
      .where(
        and(eq(schema.userFollows.followerId, viewerId), eq(schema.userFollows.followingId, target.id))
      )
      .limit(1)
    const [followIn] = await db
      .select()
      .from(schema.userFollows)
      .where(
        and(eq(schema.userFollows.followerId, target.id), eq(schema.userFollows.followingId, viewerId))
      )
      .limit(1)
    const connected = connectionStatus === 'connected'
    const dmGate = await assertCanInitiateDm(viewerId, target.id)
    const canMessage = dmGate.ok
    const messageHint = resolveProfileMessageHint({
      canMessage: dmGate.ok,
      gateError: dmGate.ok ? undefined : dmGate.error,
      connected,
    })
    const dmRequest = await getDmRequestStatusBetween(viewerId, target.id)
    return reply.send({
      connectionStatus,
      isFollowing: Boolean(followOut),
      isFollowedBy: Boolean(followIn),
      connectionId: conn?.id ?? null,
      canMessage,
      messageHint,
      dmRequestStatus: dmRequest.status,
      dmConversationId: dmRequest.conversationId,
    })
  })

  app.post('/api/v1/users/:username/follow', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { username } = req.params as { username: string }
    const target = await resolveUserByUsername(username)
    if (!target) return reply.status(404).send({ error: 'User not found' })
    if (target.id === user.userId) return reply.status(400).send({ error: 'Cannot follow yourself' })
    if (await isBlockedPair(user.userId, target.id)) {
      return reply.status(403).send({ error: 'Blocked' })
    }
    if (!(await targetAllowsFollow(target.id))) {
      return reply.status(403).send({ error: 'This member is not accepting new followers' })
    }
    const [inserted] = await db
      .insert(schema.userFollows)
      .values({ followerId: user.userId, followingId: target.id })
      .onConflictDoNothing()
      .returning({ followerId: schema.userFollows.followerId })
    if (inserted) {
      emitActivity({
        actorId: user.userId,
        verb: 'followed',
        objectType: 'user',
        objectId: target.id,
        metadata: {
          targetUsername: target.username,
          usernames: [target.username],
          count: 1,
        },
      })
    }
    return reply.send({ ok: true })
  })

  app.delete('/api/v1/users/:username/follow', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { username } = req.params as { username: string }
    const target = await resolveUserByUsername(username)
    if (!target) return reply.status(404).send({ error: 'User not found' })
    await db
      .delete(schema.userFollows)
      .where(
        and(eq(schema.userFollows.followerId, user.userId), eq(schema.userFollows.followingId, target.id))
      )
    return reply.send({ ok: true })
  })

  app.get('/api/v1/me/follows', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { direction?: string }
    const direction = q.direction === 'followers' ? 'followers' : 'following'
    const ids =
      direction === 'followers' ?
        [...(await loadFollowerUserIds(user.userId))]
      : [...(await loadFollowingUserIds(user.userId))]
    if (ids.length === 0) return reply.send({ items: [] })
    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(inArray(schema.users.id, ids))
    return reply.send({ items: users, direction })
  })

  app.post('/api/v1/connections/:connectionId/disconnect', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { connectionId } = req.params as { connectionId: string }
    const body = z.object({ keepFollowing: z.boolean().optional() }).safeParse(req.body ?? {})
    const keepFollowing = body.success ? body.data.keepFollowing : false
    const [c] = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1)
    if (!c) return reply.status(404).send({ error: 'Not found' })
    if (c.requesterId !== user.userId && c.recipientId !== user.userId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (c.status !== 'ACCEPTED') return reply.status(400).send({ error: 'Not connected' })
    const partnerId = c.requesterId === user.userId ? c.recipientId : c.requesterId
    await db.delete(schema.connections).where(eq(schema.connections.id, connectionId))
    if (!keepFollowing) {
      await db
        .delete(schema.userFollows)
        .where(
          and(eq(schema.userFollows.followerId, user.userId), eq(schema.userFollows.followingId, partnerId))
        )
    }
    return reply.send({ ok: true })
  })

  app.post('/api/v1/connections/:connectionId/ignore', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { connectionId } = req.params as { connectionId: string }
    const [c] = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1)
    if (!c) return reply.status(404).send({ error: 'Not found' })
    if (c.recipientId !== user.userId) return reply.status(403).send({ error: 'Only the recipient can ignore' })
    if (c.status !== 'PENDING') return reply.status(400).send({ error: 'Not pending' })
    const [updated] = await db
      .update(schema.connections)
      .set({ status: 'IGNORED' })
      .where(eq(schema.connections.id, connectionId))
      .returning()
    return reply.send({ connection: updated })
  })

  app.post('/api/v1/connections/:connectionId/unignore', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { connectionId } = req.params as { connectionId: string }
    const [c] = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1)
    if (!c) return reply.status(404).send({ error: 'Not found' })
    if (c.recipientId !== user.userId) return reply.status(403).send({ error: 'Only the recipient can unignore' })
    if (c.status !== 'IGNORED') return reply.status(400).send({ error: 'Not ignored' })
    const [updated] = await db
      .update(schema.connections)
      .set({ status: 'PENDING' })
      .where(eq(schema.connections.id, connectionId))
      .returning()
    return reply.send({ connection: updated })
  })

  app.post('/api/v1/connections/:connectionId/cancel', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { connectionId } = req.params as { connectionId: string }
    const [c] = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1)
    if (!c) return reply.status(404).send({ error: 'Not found' })
    if (c.requesterId !== user.userId) return reply.status(403).send({ error: 'Only the requester can cancel' })
    if (c.status !== 'PENDING') return reply.status(400).send({ error: 'Not pending' })
    await db.delete(schema.connections).where(eq(schema.connections.id, connectionId))
    return reply.send({ ok: true })
  })

  app.get('/api/v1/me/ticket-history', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select({
        grantId: schema.conventionAccessGrants.id,
        grantedAt: schema.conventionAccessGrants.grantedAt,
        paidConfirmed: schema.conventionAccessGrants.paidConfirmed,
        attendingConfirmed: schema.conventionAccessGrants.attendingConfirmed,
        role: schema.conventionAccessGrants.role,
        conventionId: schema.conventions.id,
        conventionSlug: schema.conventions.slug,
        conventionName: schema.conventions.name,
        conventionStartsAt: schema.conventions.startsAt,
        conventionEndsAt: schema.conventions.endsAt,
        organizationSlug: schema.organizations.slug,
        ticketPurchaseUrl: schema.events.ticketPurchaseUrl,
        ticketingProvider: schema.events.ticketingProvider,
        expectedCostText: schema.events.expectedCostText,
      })
      .from(schema.conventionAccessGrants)
      .innerJoin(schema.conventions, eq(schema.conventions.id, schema.conventionAccessGrants.conventionId))
      .leftJoin(schema.organizations, eq(schema.organizations.id, schema.conventions.organizationId))
      .leftJoin(schema.events, eq(schema.events.id, schema.conventions.anchorEventId))
      .where(eq(schema.conventionAccessGrants.userId, user.userId))
      .orderBy(desc(schema.conventionAccessGrants.grantedAt))

    return reply.send({
      items: rows.map((r) => ({
        id: r.grantId,
        grantedAt: r.grantedAt.toISOString(),
        paidConfirmed: r.paidConfirmed,
        attendingConfirmed: r.attendingConfirmed,
        role: r.role,
        convention: {
          id: r.conventionId,
          slug: r.conventionSlug,
          name: r.conventionName,
          startsAt: r.conventionStartsAt.toISOString(),
          endsAt: r.conventionEndsAt.toISOString(),
          organizationSlug: r.organizationSlug,
        },
        ticketPurchaseUrl: r.ticketPurchaseUrl,
        ticketingProvider: r.ticketingProvider,
        expectedCostText: r.expectedCostText,
      })),
    })
  })

  app.get('/api/v1/me/blocks', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { q?: string }
    const blockedIds = [...(await loadBlockedUserIds(user.userId))]
    if (blockedIds.length === 0) return reply.send({ items: [] })
    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        age: schema.profiles.age,
        gender: schema.profiles.gender,
        genders: schema.profiles.genders,
        roles: schema.profiles.roles,
        location: schema.profiles.location,
        fieldVisibility: schema.profiles.fieldVisibility,
        blockedAt: schema.blocks.createdAt,
      })
      .from(schema.blocks)
      .innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.blocks.blockerId, user.userId))
      .orderBy(desc(schema.blocks.createdAt))
    let items = users
    const needle = typeof q.q === 'string' ? q.q.trim().toLowerCase() : ''
    if (needle) {
      items = items.filter(
        (u) =>
          u.username.toLowerCase().includes(needle) ||
          (u.displayName?.toLowerCase().includes(needle) ?? false)
      )
    }
    const friendIds = await loadAcceptedFriendUserIds(user.userId)
    return reply.send({
      items: items.map((u) => {
        const redacted = redactListProfileIdentityFields(
          {
            userId: u.id,
            age: u.age,
            gender: u.gender,
            genders: u.genders ?? [],
            location: u.location,
            fieldVisibility: u.fieldVisibility,
          },
          user.userId,
          friendIds,
        )
        return {
          userId: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          age: redacted.age,
          gender: redacted.gender,
          genders: redacted.genders ?? [],
          roles: u.roles ?? [],
          location: redacted.location,
          blockedAt: u.blockedAt?.toISOString() ?? null,
        }
      }),
    })
  })

  const blockBody = z.object({ username: z.string().min(1) })
  app.post('/api/v1/me/blocks', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = blockBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const target = await resolveUserByUsername(parsed.data.username)
    if (!target) return reply.status(404).send({ error: 'User not found' })
    if (target.id === user.userId) return reply.status(400).send({ error: 'Cannot block yourself' })
    await db
      .insert(schema.blocks)
      .values({ blockerId: user.userId, blockedId: target.id })
      .onConflictDoNothing()
    await db
      .delete(schema.userFollows)
      .where(
        or(
          and(eq(schema.userFollows.followerId, user.userId), eq(schema.userFollows.followingId, target.id)),
          and(eq(schema.userFollows.followerId, target.id), eq(schema.userFollows.followingId, user.userId))
        )
      )
    const conn = await connectionBetween(user.userId, target.id)
    if (conn) await db.delete(schema.connections).where(eq(schema.connections.id, conn.id))
    return reply.send({ ok: true })
  })

  app.delete('/api/v1/me/blocks/:username', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { username } = req.params as { username: string }
    const target = await resolveUserByUsername(username)
    if (!target) return reply.status(404).send({ error: 'User not found' })
    await db
      .delete(schema.blocks)
      .where(and(eq(schema.blocks.blockerId, user.userId), eq(schema.blocks.blockedId, target.id)))
    return reply.send({ ok: true })
  })
}
