import { and, asc, eq, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { NOTIFICATION_TYPES } from '@c2k/shared'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import { loadAcceptedFriendUserIds } from '../lib/accepted-friends.js'
import { canViewerReadProfile } from '../lib/profile-access.js'
import { createNotification } from '../lib/create-notification.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return { userId }
}

const relationshipBody = z.object({
  kind: z.enum(['relationship', 'ds']),
  label: z.string().min(1).max(128),
  partnerUserId: z.string().uuid().nullable().optional(),
  partnerUsername: z.string().min(1).max(64).nullable().optional(),
  customText: z.string().max(2000).nullable().optional(),
  visibility: z.enum(['public', 'friends', 'hidden']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const patchRelationshipBody = relationshipBody
  .omit({ partnerUserId: true, partnerUsername: true })
  .partial()
  .extend({
    partnerUserId: z.string().uuid().nullable().optional(),
    partnerUsername: z.string().min(1).max(64).nullable().optional(),
  })

const reorderBody = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

const respondBody = z.object({
  action: z.enum(['accept', 'decline']),
})

type RelationshipRow = typeof schema.profileRelationships.$inferSelect

function mapRelationship(row: RelationshipRow, partnerUsername: string | null) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    partnerUserId: row.partnerUserId,
    partnerUsername,
    customText: row.customText,
    status: row.status,
    visibility: row.visibility,
    sortOrder: row.sortOrder,
  }
}

function mapIncomingRequest(
  row: RelationshipRow,
  requesterUsername: string | null,
  requesterUserId: string
) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    customText: row.customText,
    status: row.status,
    requesterUserId,
    requesterUsername,
    visibility: row.visibility,
  }
}

async function assertPartnerFriendship(
  userId: string,
  partnerUserId: string | null | undefined,
  reply: FastifyReply
): Promise<boolean> {
  if (!partnerUserId) return true
  if (partnerUserId === userId) {
    reply.status(400).send({ error: 'Cannot link yourself as partner' })
    return false
  }
  const friendIds = await loadAcceptedFriendUserIds(userId)
  if (!friendIds.has(partnerUserId)) {
    reply.status(400).send({ error: 'Partner link requires accepted friendship' })
    return false
  }
  return true
}

async function resolvePartnerUserId(
  partnerUserId: string | null | undefined,
  partnerUsername: string | null | undefined,
  reply: FastifyReply
): Promise<string | null | undefined> {
  if (partnerUserId) return partnerUserId
  if (!partnerUsername?.trim()) return null
  const [partner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, partnerUsername.trim()))
    .limit(1)
  if (!partner) {
    reply.status(404).send({ error: 'Partner user not found' })
    return undefined
  }
  return partner.id
}

async function loadRelationshipsForUser(userId: string) {
  const rows = await db
    .select({
      rel: schema.profileRelationships,
      partnerUsername: schema.users.username,
    })
    .from(schema.profileRelationships)
    .leftJoin(schema.users, eq(schema.profileRelationships.partnerUserId, schema.users.id))
    .where(eq(schema.profileRelationships.userId, userId))
    .orderBy(asc(schema.profileRelationships.sortOrder), asc(schema.profileRelationships.id))

  return rows.map((r) => mapRelationship(r.rel, r.partnerUsername))
}

async function assertNoDuplicatePartnerLink(
  userId: string,
  partnerUserId: string,
  kind: 'relationship' | 'ds',
  reply: FastifyReply
): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.profileRelationships.id })
    .from(schema.profileRelationships)
    .where(
      and(
        eq(schema.profileRelationships.userId, userId),
        eq(schema.profileRelationships.partnerUserId, partnerUserId),
        eq(schema.profileRelationships.kind, kind),
        or(
          eq(schema.profileRelationships.status, 'pending'),
          eq(schema.profileRelationships.status, 'active')
        )
      )
    )
    .limit(1)
  if (existing) {
    reply.status(409).send({ error: 'A pending or active link with this partner already exists for this section' })
    return false
  }
  return true
}

function redactRelationships(
  items: ReturnType<typeof mapRelationship>[],
  ctx: { viewerId: string | null; targetUserId: string; friendIds: Set<string>; isOwner: boolean }
) {
  const visible = ctx.isOwner ? items : items.filter((item) => item.status === 'active')

  return visible
    .filter((item) => {
      if (item.visibility === 'hidden') return false
      if (item.visibility === 'friends' && !ctx.friendIds.has(ctx.targetUserId) && !ctx.isOwner) {
        return false
      }
      return true
    })
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      partnerUsername:
        item.partnerUserId && (ctx.isOwner || ctx.friendIds.has(ctx.targetUserId)) ?
          item.partnerUsername
        : null,
      customText: item.customText,
      status: item.status,
      visibility: item.visibility,
      sortOrder: item.sortOrder,
    }))
}

export async function registerProfileRelationshipRoutes(app: FastifyInstance) {
  app.get('/api/profile/me/relationships', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return
    const items = await loadRelationshipsForUser(user.userId)
    return reply.send({ relationships: items })
  })

  app.get('/api/profile/me/relationships/incoming', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return

    const rows = await db
      .select({
        rel: schema.profileRelationships,
        requesterUsername: schema.users.username,
      })
      .from(schema.profileRelationships)
      .innerJoin(schema.users, eq(schema.profileRelationships.userId, schema.users.id))
      .where(
        and(
          eq(schema.profileRelationships.partnerUserId, user.userId),
          eq(schema.profileRelationships.status, 'pending')
        )
      )
      .orderBy(asc(schema.profileRelationships.sortOrder), asc(schema.profileRelationships.id))

    return reply.send({
      requests: rows.map((r) => mapIncomingRequest(r.rel, r.requesterUsername, r.rel.userId)),
    })
  })

  app.post('/api/profile/me/relationships', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const parsed = relationshipBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const partnerUserId = await resolvePartnerUserId(
      parsed.data.partnerUserId ?? null,
      parsed.data.partnerUsername ?? null,
      reply
    )
    if (partnerUserId === undefined) return
    if (!(await assertPartnerFriendship(user.userId, partnerUserId, reply))) return
    if (partnerUserId && !(await assertNoDuplicatePartnerLink(user.userId, partnerUserId, parsed.data.kind, reply))) {
      return
    }

    const existing = await db
      .select({ sortOrder: schema.profileRelationships.sortOrder })
      .from(schema.profileRelationships)
      .where(eq(schema.profileRelationships.userId, user.userId))
    const sortOrder = parsed.data.sortOrder ?? existing.length
    const status = partnerUserId ? 'pending' : 'active'

    const [row] = await db
      .insert(schema.profileRelationships)
      .values({
        userId: user.userId,
        kind: parsed.data.kind,
        label: parsed.data.label.trim(),
        partnerUserId: partnerUserId ?? null,
        customText: parsed.data.customText ?? null,
        status,
        visibility: parsed.data.visibility ?? 'public',
        sortOrder,
      })
      .returning()

    let partnerUsername: string | null = null
    if (row!.partnerUserId) {
      const [p] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, row!.partnerUserId!))
        .limit(1)
      partnerUsername = p?.username ?? null
    }

    if (partnerUserId && status === 'pending') {
      const [requester] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, user.userId))
        .limit(1)
      try {
        await createNotification(partnerUserId, NOTIFICATION_TYPES.profileRelationshipRequest, {
          relationshipId: row!.id,
          requesterUsername: requester?.username ?? '',
          label: row!.label,
          kind: row!.kind,
        })
      } catch (err) {
        req.log.warn({ err }, 'failed to insert profile_relationship_request notification')
      }
    }

    return reply.status(201).send({ relationship: mapRelationship(row!, partnerUsername) })
  })

  app.post('/api/profile/me/relationships/:id/respond', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = respondBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [existing] = await db
      .select()
      .from(schema.profileRelationships)
      .where(eq(schema.profileRelationships.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (existing.partnerUserId !== user.userId) {
      return reply.status(403).send({ error: 'Only the tagged partner can respond' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ error: 'Request is not pending' })
    }

    if (parsed.data.action === 'decline') {
      await db.delete(schema.profileRelationships).where(eq(schema.profileRelationships.id, id))
      const [responder] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, user.userId))
        .limit(1)
      try {
        await createNotification(existing.userId, NOTIFICATION_TYPES.profileRelationshipDeclined, {
          relationshipId: id,
          partnerUsername: responder?.username ?? '',
          label: existing.label,
        })
      } catch (err) {
        req.log.warn({ err }, 'failed to insert profile_relationship_declined notification')
      }
      return reply.send({ ok: true, status: 'declined' })
    }

    const [updated] = await db
      .update(schema.profileRelationships)
      .set({ status: 'active' })
      .where(eq(schema.profileRelationships.id, id))
      .returning()

    const [responder] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, user.userId))
      .limit(1)
    try {
      await createNotification(existing.userId, NOTIFICATION_TYPES.profileRelationshipAccepted, {
        relationshipId: id,
        partnerUsername: responder?.username ?? '',
        label: existing.label,
      })
    } catch (err) {
      req.log.warn({ err }, 'failed to insert profile_relationship_accepted notification')
    }

    let partnerUsername: string | null = null
    if (updated!.partnerUserId) {
      const [p] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, updated!.partnerUserId!))
        .limit(1)
      partnerUsername = p?.username ?? null
    }

    return reply.send({ relationship: mapRelationship(updated!, partnerUsername) })
  })

  app.patch('/api/profile/me/relationships/:id', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = patchRelationshipBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [existing] = await db
      .select()
      .from(schema.profileRelationships)
      .where(and(eq(schema.profileRelationships.id, id), eq(schema.profileRelationships.userId, user.userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const d = parsed.data
    const [updated] = await db
      .update(schema.profileRelationships)
      .set({
        kind: d.kind ?? existing.kind,
        label: d.label !== undefined ? d.label.trim() : existing.label,
        customText: d.customText !== undefined ? d.customText : existing.customText,
        visibility: d.visibility ?? existing.visibility,
        sortOrder: d.sortOrder ?? existing.sortOrder,
      })
      .where(eq(schema.profileRelationships.id, id))
      .returning()

    let partnerUsername: string | null = null
    if (updated!.partnerUserId) {
      const [p] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, updated!.partnerUserId!))
        .limit(1)
      partnerUsername = p?.username ?? null
    }

    return reply.send({ relationship: mapRelationship(updated!, partnerUsername) })
  })

  app.delete('/api/profile/me/relationships/:id', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })

    const [existing] = await db
      .select()
      .from(schema.profileRelationships)
      .where(eq(schema.profileRelationships.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const isOwner = existing.userId === user.userId
    const isTaggedPartner = existing.partnerUserId === user.userId
    if (!isOwner && !isTaggedPartner) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    await db.delete(schema.profileRelationships).where(eq(schema.profileRelationships.id, id))
    return reply.send({ ok: true })
  })

  app.post('/api/profile/me/relationships/reorder', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const parsed = reorderBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const owned = await db
      .select({ id: schema.profileRelationships.id })
      .from(schema.profileRelationships)
      .where(eq(schema.profileRelationships.userId, user.userId))
    const ownedIds = new Set(owned.map((r) => r.id))
    if (parsed.data.orderedIds.some((id) => !ownedIds.has(id))) {
      return reply.status(400).send({ error: 'Invalid relationship id in order list' })
    }

    await Promise.all(
      parsed.data.orderedIds.map((id, index) =>
        db
          .update(schema.profileRelationships)
          .set({ sortOrder: index })
          .where(and(eq(schema.profileRelationships.id, id), eq(schema.profileRelationships.userId, user.userId)))
      )
    )

    const items = await loadRelationshipsForUser(user.userId)
    return reply.send({ relationships: items })
  })

  app.get('/api/profile/:username/relationships', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Profile relationships API requires USE_DATABASE=true' })
    }
    const { username } = req.params as { username: string }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    if (!profile) return reply.status(404).send({ error: 'Not found' })

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const isOwner = viewerId !== null && viewerId === user.id
    if (!canViewerReadProfile(profile.visibility, { viewerId, isOwner })) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const friendIds =
      viewerId && !isOwner ? await loadAcceptedFriendUserIds(viewerId) : new Set<string>()

    const items = await loadRelationshipsForUser(user.id)
    return reply.send({
      relationships: redactRelationships(items, {
        viewerId,
        targetUserId: user.id,
        friendIds,
        isOwner,
      }),
    })
  })
}
