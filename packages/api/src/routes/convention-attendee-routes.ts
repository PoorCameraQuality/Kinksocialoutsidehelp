/**
 * Attendee-facing convention APIs (dancecard weekend app) - groups, published policies.
 * Organizer CRUD stays on convention-organizer routes; these extend the same tables.
 */
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import { getConventionWithAccess } from './conventions-routes.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireDb(reply: FastifyReply): boolean {
  if (!db) {
    reply.status(503).send({ error: 'Database not configured' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Sign in required' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

async function requireAttendee(key: string, userId: string, reply: FastifyReply) {
  const resolved = await getConventionWithAccess(key, userId)
  if ('notFound' in resolved) {
    reply.status(404).send({ error: 'Not found' })
    return null
  }
  if ('forbidden' in resolved) {
    reply.status(400).send({ error: 'Convention must be org-owned' })
    return null
  }
  if (!resolved.canView) {
    reply.status(403).send({ error: 'Registration required' })
    return null
  }
  return resolved
}

function mapGroup(g: typeof schema.conventionAttendeeGroups.$inferSelect, memberCount = 0) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    visibility: g.visibility,
    status: g.status,
    capacity: g.capacity,
    memberCount,
    recruitmentStatus: g.status === 'open' ? 'seeking' : 'closed',
  }
}

async function memberCount(groupId: string) {
  const [row] = await db!
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.conventionAttendeeGroupMembers)
    .where(eq(schema.conventionAttendeeGroupMembers.groupId, groupId))
  return Number(row?.n ?? 0)
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

function mapOpenVolunteerShift(r: typeof schema.conventionVolunteerShifts.$inferSelect, signupCount: number) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    role: r.role,
    location: r.location,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    capacityMax: r.capacityMax,
    signupCount,
    shiftStatus: r.shiftStatus,
  }
}

async function userOwnsVolunteerShift(shiftId: string, conventionId: string, userId: string): Promise<boolean> {
  const [shift] = await db!
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(
      and(eq(schema.conventionVolunteerShifts.id, shiftId), eq(schema.conventionVolunteerShifts.conventionId, conventionId)),
    )
    .limit(1)
  if (!shift) return false
  if (shift.personId === userId || shift.claimedByUserId === userId) return true
  const [signup] = await db!
    .select({ shiftId: schema.conventionVolunteerShiftSignups.shiftId })
    .from(schema.conventionVolunteerShiftSignups)
    .where(
      and(
        eq(schema.conventionVolunteerShiftSignups.shiftId, shiftId),
        eq(schema.conventionVolunteerShiftSignups.userId, userId),
      ),
    )
    .limit(1)
  return Boolean(signup)
}

async function isGroupMember(groupId: string, userId: string) {
  const [row] = await db!
    .select({ role: schema.conventionAttendeeGroupMembers.role })
    .from(schema.conventionAttendeeGroupMembers)
    .where(
      and(
        eq(schema.conventionAttendeeGroupMembers.groupId, groupId),
        eq(schema.conventionAttendeeGroupMembers.userId, userId),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function registerConventionAttendeeRoutes(app: FastifyInstance) {
  // --- Published policies (attendee sign) ---
  app.get('/api/v1/conventions/:key/policies/published', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const rows = await db!
      .select()
      .from(schema.conventionPolicyDocuments)
      .where(
        and(
          eq(schema.conventionPolicyDocuments.conventionId, resolved.conv.id),
          sql`${schema.conventionPolicyDocuments.publishedAt} IS NOT NULL`,
        ),
      )
      .orderBy(asc(schema.conventionPolicyDocuments.sortOrder))
    const [registrant] = await db!
      .select({ id: schema.conventionRegistrants.id })
      .from(schema.conventionRegistrants)
      .where(
        and(
          eq(schema.conventionRegistrants.conventionId, resolved.conv.id),
          eq(schema.conventionRegistrants.userId, actor.userId),
        ),
      )
      .limit(1)
    let acceptedIds: string[] = []
    if (registrant) {
      const acc = await db!
        .select({ policyId: schema.conventionRegistrantPolicyAcceptances.policyId })
        .from(schema.conventionRegistrantPolicyAcceptances)
        .where(eq(schema.conventionRegistrantPolicyAcceptances.registrantId, registrant.id))
      acceptedIds = acc.map((a) => a.policyId)
    }
    return reply.send({
      policies: rows.map((p) => ({
        id: p.id,
        title: p.title,
        kind: p.kind,
        version: p.version,
        bodyMarkdown: p.bodyMarkdown,
        bodyHtml: p.bodyHtml,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        accepted: acceptedIds.includes(p.id),
      })),
      registrantId: registrant?.id ?? null,
    })
  })

  app.post('/api/v1/conventions/:key/policies/sign', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        policyIds: z.array(z.string().uuid()).min(1),
        signerName: z.string().min(1).max(255),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const [registrant] = await db!
      .select()
      .from(schema.conventionRegistrants)
      .where(
        and(
          eq(schema.conventionRegistrants.conventionId, resolved.conv.id),
          eq(schema.conventionRegistrants.userId, actor.userId),
        ),
      )
      .limit(1)
    if (!registrant) {
      return reply.status(403).send({ error: 'Register for this convention before signing policies' })
    }
    const [profile] = await db!
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, actor.userId))
      .limit(1)
    const validPolicies = await db!
      .select({ id: schema.conventionPolicyDocuments.id })
      .from(schema.conventionPolicyDocuments)
      .where(
        and(
          eq(schema.conventionPolicyDocuments.conventionId, resolved.conv.id),
          inArray(schema.conventionPolicyDocuments.id, parsed.data.policyIds),
          sql`${schema.conventionPolicyDocuments.publishedAt} IS NOT NULL`,
        ),
      )
    if (validPolicies.length !== parsed.data.policyIds.length) {
      return reply.status(400).send({ error: 'One or more policies are invalid or unpublished' })
    }
    for (const policyId of parsed.data.policyIds) {
      await db!
        .insert(schema.conventionRegistrantPolicyAcceptances)
        .values({
          registrantId: registrant.id,
          policyId,
          signerName: parsed.data.signerName.trim(),
          signerEmail: profile?.email ?? null,
          signatureMethod: 'c2k_web',
        })
        .onConflictDoNothing()
    }
    return reply.send({ ok: true, signed: parsed.data.policyIds.length })
  })

  // --- Attendee groups ---
  app.get('/api/v1/conventions/:key/attendee-groups', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const groups = await db!
      .select()
      .from(schema.conventionAttendeeGroups)
      .where(
        and(
          eq(schema.conventionAttendeeGroups.conventionId, resolved.conv.id),
          eq(schema.conventionAttendeeGroups.hidden, false),
          eq(schema.conventionAttendeeGroups.visibility, 'public'),
        ),
      )
      .orderBy(asc(schema.conventionAttendeeGroups.createdAt))
    const out = await Promise.all(
      groups.map(async (g) => mapGroup(g, await memberCount(g.id))),
    )
    return reply.send({ groups: out })
  })

  app.get('/api/v1/conventions/:key/attendee-groups/mine', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const memberships = await db!
      .select({ groupId: schema.conventionAttendeeGroupMembers.groupId, role: schema.conventionAttendeeGroupMembers.role })
      .from(schema.conventionAttendeeGroupMembers)
      .innerJoin(
        schema.conventionAttendeeGroups,
        eq(schema.conventionAttendeeGroups.id, schema.conventionAttendeeGroupMembers.groupId),
      )
      .where(
        and(
          eq(schema.conventionAttendeeGroups.conventionId, resolved.conv.id),
          eq(schema.conventionAttendeeGroupMembers.userId, actor.userId),
        ),
      )
    const groupIds = memberships.map((m) => m.groupId)
    if (groupIds.length === 0) return reply.send({ groups: [], pendingOwnerCount: 0 })
    const groups = await db!
      .select()
      .from(schema.conventionAttendeeGroups)
      .where(inArray(schema.conventionAttendeeGroups.id, groupIds))
    let pendingOwnerCount = 0
    const out = await Promise.all(
      groups.map(async (g) => {
        const mem = memberships.find((m) => m.groupId === g.id)
        const count = await memberCount(g.id)
        if (mem?.role === 'owner') {
          const [pending] = await db!
            .select({ n: sql<number>`count(*)::int` })
            .from(schema.conventionAttendeeGroupJoinRequests)
            .where(
              and(
                eq(schema.conventionAttendeeGroupJoinRequests.groupId, g.id),
                eq(schema.conventionAttendeeGroupJoinRequests.status, 'pending'),
              ),
            )
          pendingOwnerCount += Number(pending?.n ?? 0)
        }
        return { ...mapGroup(g, count), myRole: mem?.role ?? 'member' }
      }),
    )
    return reply.send({ groups: out, pendingOwnerCount })
  })

  app.post('/api/v1/conventions/:key/attendee-groups', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        name: z.string().min(1).max(255),
        description: z.string().max(10000).optional(),
        visibility: z.enum(['public', 'private', 'invite_only']).optional(),
        capacity: z.number().int().positive().nullable().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const [group] = await db!
      .insert(schema.conventionAttendeeGroups)
      .values({
        conventionId: resolved.conv.id,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() ?? null,
        visibility: parsed.data.visibility ?? 'public',
        status: 'open',
        capacity: parsed.data.capacity ?? null,
      })
      .returning()
    await db!.insert(schema.conventionAttendeeGroupMembers).values({
      groupId: group!.id,
      userId: actor.userId,
      role: 'owner',
    })
    return reply.status(201).send({ group: mapGroup(group!, 1) })
  })

  app.get('/api/v1/conventions/:key/attendee-groups/:groupId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    if (!UUID_RE.test(groupId)) return reply.status(400).send({ error: 'Invalid group id' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const [group] = await db!
      .select()
      .from(schema.conventionAttendeeGroups)
      .where(
        and(
          eq(schema.conventionAttendeeGroups.id, groupId),
          eq(schema.conventionAttendeeGroups.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!group) return reply.status(404).send({ error: 'Not found' })
    const mem = await isGroupMember(groupId, actor.userId)
    if (group.visibility !== 'public' && !mem) {
      return reply.status(403).send({ error: 'Not a member of this group' })
    }
    const members = await db!
      .select({
        userId: schema.conventionAttendeeGroupMembers.userId,
        role: schema.conventionAttendeeGroupMembers.role,
        displayName: schema.profiles.displayName,
        username: schema.users.username,
      })
      .from(schema.conventionAttendeeGroupMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.conventionAttendeeGroupMembers.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.conventionAttendeeGroupMembers.groupId, groupId))
    const announcements = await db!
      .select()
      .from(schema.conventionAttendeeGroupAnnouncements)
      .where(eq(schema.conventionAttendeeGroupAnnouncements.groupId, groupId))
      .orderBy(asc(schema.conventionAttendeeGroupAnnouncements.createdAt))
    const chores = await db!
      .select()
      .from(schema.conventionAttendeeGroupChores)
      .where(eq(schema.conventionAttendeeGroupChores.groupId, groupId))
    const bringItems = await db!
      .select()
      .from(schema.conventionAttendeeGroupBringItems)
      .where(eq(schema.conventionAttendeeGroupBringItems.groupId, groupId))
    return reply.send({
      group: { ...mapGroup(group, members.length), myRole: mem?.role ?? null },
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        displayName: m.displayName ?? m.username,
        username: m.username,
      })),
      announcements,
      chores,
      bringItems,
    })
  })

  app.patch('/api/v1/conventions/:key/attendee-groups/:groupId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    if (!UUID_RE.test(groupId)) return reply.status(400).send({ error: 'Invalid group id' })
    const parsed = z
      .object({
        description: z.string().max(10000).nullable().optional(),
        status: z.enum(['open', 'closed', 'archived']).optional(),
        visibility: z.enum(['public', 'private', 'invite_only']).optional(),
        capacity: z.number().int().positive().nullable().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem || (mem.role !== 'owner' && mem.role !== 'admin')) {
      return reply.status(403).send({ error: 'Owner or admin only' })
    }
    const patch: Partial<typeof schema.conventionAttendeeGroups.$inferInsert> = { updatedAt: new Date() }
    if (parsed.data.description !== undefined) patch.description = parsed.data.description
    if (parsed.data.status !== undefined) patch.status = parsed.data.status
    if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility
    if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity
    const [row] = await db!
      .update(schema.conventionAttendeeGroups)
      .set(patch)
      .where(
        and(
          eq(schema.conventionAttendeeGroups.id, groupId),
          eq(schema.conventionAttendeeGroups.conventionId, resolved.conv.id),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ group: mapGroup(row, await memberCount(groupId)) })
  })

  app.post('/api/v1/conventions/:key/attendee-groups/:groupId/join', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const [group] = await db!
      .select()
      .from(schema.conventionAttendeeGroups)
      .where(
        and(
          eq(schema.conventionAttendeeGroups.id, groupId),
          eq(schema.conventionAttendeeGroups.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!group) return reply.status(404).send({ error: 'Not found' })
    if (group.status !== 'open') return reply.status(400).send({ error: 'Group is not accepting members' })
    const existing = await isGroupMember(groupId, actor.userId)
    if (existing) return reply.send({ ok: true, role: existing.role })
    const count = await memberCount(groupId)
    if (group.capacity != null && count >= group.capacity) {
      return reply.status(400).send({ error: 'Group is full' })
    }
    if (group.visibility === 'invite_only') {
      const parsed = z.object({ message: z.string().max(2000).optional() }).safeParse(req.body ?? {})
      await db!.insert(schema.conventionAttendeeGroupJoinRequests).values({
        groupId,
        userId: actor.userId,
        message: parsed.success ? parsed.data.message?.trim() ?? null : null,
        status: 'pending',
      }).onConflictDoNothing()
      return reply.send({ ok: true, pending: true })
    }
    await db!.insert(schema.conventionAttendeeGroupMembers).values({
      groupId,
      userId: actor.userId,
      role: 'member',
    }).onConflictDoNothing()
    return reply.send({ ok: true, role: 'member' })
  })

  app.get('/api/v1/conventions/:key/attendee-groups/:groupId/join-requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    if (!UUID_RE.test(groupId)) return reply.status(400).send({ error: 'Invalid group id' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem || (mem.role !== 'owner' && mem.role !== 'admin')) {
      return reply.status(403).send({ error: 'Owner or admin only' })
    }
    const rows = await db!
      .select({
        id: schema.conventionAttendeeGroupJoinRequests.id,
        userId: schema.conventionAttendeeGroupJoinRequests.userId,
        message: schema.conventionAttendeeGroupJoinRequests.message,
        createdAt: schema.conventionAttendeeGroupJoinRequests.createdAt,
        displayName: schema.profiles.displayName,
        username: schema.users.username,
      })
      .from(schema.conventionAttendeeGroupJoinRequests)
      .innerJoin(schema.users, eq(schema.users.id, schema.conventionAttendeeGroupJoinRequests.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        and(
          eq(schema.conventionAttendeeGroupJoinRequests.groupId, groupId),
          eq(schema.conventionAttendeeGroupJoinRequests.status, 'pending'),
        ),
      )
      .orderBy(asc(schema.conventionAttendeeGroupJoinRequests.createdAt))
    return reply.send({
      requests: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        message: r.message,
        createdAt: r.createdAt,
        displayName: r.displayName ?? r.username,
        username: r.username,
      })),
    })
  })

  app.patch('/api/v1/conventions/:key/attendee-groups/:groupId/join-requests/:requestId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId, requestId } = req.params as { key: string; groupId: string; requestId: string }
    if (!UUID_RE.test(groupId) || !UUID_RE.test(requestId)) {
      return reply.status(400).send({ error: 'Invalid id' })
    }
    const parsed = z.object({ status: z.enum(['approved', 'denied']) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem || (mem.role !== 'owner' && mem.role !== 'admin')) {
      return reply.status(403).send({ error: 'Owner or admin only' })
    }
    const [group] = await db!
      .select()
      .from(schema.conventionAttendeeGroups)
      .where(
        and(
          eq(schema.conventionAttendeeGroups.id, groupId),
          eq(schema.conventionAttendeeGroups.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!group) return reply.status(404).send({ error: 'Not found' })
    const [reqRow] = await db!
      .select()
      .from(schema.conventionAttendeeGroupJoinRequests)
      .where(
        and(
          eq(schema.conventionAttendeeGroupJoinRequests.id, requestId),
          eq(schema.conventionAttendeeGroupJoinRequests.groupId, groupId),
          eq(schema.conventionAttendeeGroupJoinRequests.status, 'pending'),
        ),
      )
      .limit(1)
    if (!reqRow) return reply.status(404).send({ error: 'Not found' })
    if (parsed.data.status === 'approved') {
      const count = await memberCount(groupId)
      if (group.capacity != null && count >= group.capacity) {
        return reply.status(400).send({ error: 'Group is full' })
      }
      await db!.insert(schema.conventionAttendeeGroupMembers).values({
        groupId,
        userId: reqRow.userId,
        role: 'member',
      }).onConflictDoNothing()
    }
    await db!
      .update(schema.conventionAttendeeGroupJoinRequests)
      .set({ status: parsed.data.status, respondedAt: new Date() })
      .where(eq(schema.conventionAttendeeGroupJoinRequests.id, requestId))
    return reply.send({ ok: true, status: parsed.data.status })
  })

  app.post('/api/v1/conventions/:key/attendee-groups/:groupId/announcements', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    const parsed = z.object({ body: z.string().min(1).max(10000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem) return reply.status(403).send({ error: 'Members only' })
    const [row] = await db!
      .insert(schema.conventionAttendeeGroupAnnouncements)
      .values({ groupId, authorUserId: actor.userId, body: parsed.data.body.trim() })
      .returning()
    return reply.send({ announcement: row })
  })

  app.post('/api/v1/conventions/:key/attendee-groups/:groupId/chores', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    const parsed = z
      .object({ title: z.string().min(1).max(255), description: z.string().max(2000).optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem || (mem.role !== 'owner' && mem.role !== 'admin')) {
      return reply.status(403).send({ error: 'Owner or admin only' })
    }
    const [row] = await db!
      .insert(schema.conventionAttendeeGroupChores)
      .values({
        groupId,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() ?? null,
      })
      .returning()
    return reply.send({ chore: row })
  })

  app.post('/api/v1/conventions/:key/attendee-groups/:groupId/chores/:choreId/signup', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId, choreId } = req.params as { key: string; groupId: string; choreId: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem) return reply.status(403).send({ error: 'Members only' })
    const [row] = await db!
      .update(schema.conventionAttendeeGroupChores)
      .set({ assigneeUserId: actor.userId, status: 'assigned' })
      .where(
        and(
          eq(schema.conventionAttendeeGroupChores.id, choreId),
          eq(schema.conventionAttendeeGroupChores.groupId, groupId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ chore: row })
  })

  app.post('/api/v1/conventions/:key/attendee-groups/:groupId/bring-items', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, groupId } = req.params as { key: string; groupId: string }
    const parsed = z
      .object({
        title: z.string().min(1).max(255),
        quantity: z.number().int().positive().optional(),
        notes: z.string().max(2000).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mem = await isGroupMember(groupId, actor.userId)
    if (!mem || (mem.role !== 'owner' && mem.role !== 'admin')) {
      return reply.status(403).send({ error: 'Owner or admin only' })
    }
    const [row] = await db!
      .insert(schema.conventionAttendeeGroupBringItems)
      .values({
        groupId,
        title: parsed.data.title.trim(),
        quantity: parsed.data.quantity ?? 1,
        notes: parsed.data.notes?.trim() ?? null,
      })
      .returning()
    return reply.send({ item: row })
  })

  app.post(
    '/api/v1/conventions/:key/attendee-groups/:groupId/bring-items/:itemId/signup',
    async (req, reply) => {
      if (!requireDb(reply)) return
      const actor = requireUser(req, reply)
      if (!actor) return
      const { key, groupId, itemId } = req.params as { key: string; groupId: string; itemId: string }
      const resolved = await requireAttendee(key, actor.userId, reply)
      if (!resolved) return
      const mem = await isGroupMember(groupId, actor.userId)
      if (!mem) return reply.status(403).send({ error: 'Members only' })
      const [row] = await db!
        .update(schema.conventionAttendeeGroupBringItems)
        .set({ bringerUserId: actor.userId })
        .where(
          and(
            eq(schema.conventionAttendeeGroupBringItems.id, itemId),
            eq(schema.conventionAttendeeGroupBringItems.groupId, groupId),
          ),
        )
        .returning()
      if (!row) return reply.status(404).send({ error: 'Not found' })
      return reply.send({ item: row })
    },
  )

  // --- Volunteer shifts (attendee claim) ---
  app.get('/api/v1/conventions/:key/volunteer-shifts/open', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const rows = await db!
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(
        and(
          eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id),
          eq(schema.conventionVolunteerShifts.shiftStatus, 'open'),
          isNull(schema.conventionVolunteerShifts.claimedByUserId),
          isNull(schema.conventionVolunteerShifts.personId),
        ),
      )
      .orderBy(asc(schema.conventionVolunteerShifts.startsAt), asc(schema.conventionVolunteerShifts.sortOrder))
    const shifts = []
    for (const row of rows) {
      const [signupRow] = await db!
        .select({ n: count() })
        .from(schema.conventionVolunteerShiftSignups)
        .where(eq(schema.conventionVolunteerShiftSignups.shiftId, row.id))
      const signupCount = Number(signupRow?.n ?? 0)
      if (row.capacityMax != null && signupCount >= row.capacityMax) continue
      shifts.push(mapOpenVolunteerShift(row, signupCount))
    }
    return reply.send({ shifts })
  })

  app.post('/api/v1/conventions/:key/volunteer-shifts/:shiftId/claim', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, shiftId } = req.params as { key: string; shiftId: string }
    if (!UUID_RE.test(shiftId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const [shift] = await db!
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(
        and(
          eq(schema.conventionVolunteerShifts.id, shiftId),
          eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id),
        ),
      )
      .limit(1)
    if (!shift) return reply.status(404).send({ error: 'Not found' })
    if (shift.shiftStatus !== 'open' || shift.claimedByUserId || shift.personId) {
      return reply.status(400).send({ error: 'Shift is not open for claim' })
    }
    const [signupRow] = await db!
      .select({ n: count() })
      .from(schema.conventionVolunteerShiftSignups)
      .where(eq(schema.conventionVolunteerShiftSignups.shiftId, shiftId))
    const signupCount = Number(signupRow?.n ?? 0)
    if (shift.capacityMax != null && signupCount >= shift.capacityMax) {
      return reply.status(400).send({ error: 'Shift is full' })
    }
    const [existingSignup] = await db!
      .select()
      .from(schema.conventionVolunteerShiftSignups)
      .where(
        and(
          eq(schema.conventionVolunteerShiftSignups.shiftId, shiftId),
          eq(schema.conventionVolunteerShiftSignups.userId, actor.userId),
        ),
      )
      .limit(1)
    if (existingSignup) return reply.status(400).send({ error: 'Already signed up for this shift' })
    const [profile] = await db!
      .select({ displayName: schema.profiles.displayName })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, actor.userId))
      .limit(1)
    const [user] = await db!
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, actor.userId))
      .limit(1)
    const personName = profile?.displayName?.trim() || user?.username || 'Volunteer'
    const [updated] = await db!
      .update(schema.conventionVolunteerShifts)
      .set({
        claimedByUserId: actor.userId,
        personId: actor.userId,
        personName,
        shiftStatus: 'assigned',
      })
      .where(
        and(
          eq(schema.conventionVolunteerShifts.id, shiftId),
          eq(schema.conventionVolunteerShifts.shiftStatus, 'open'),
          isNull(schema.conventionVolunteerShifts.claimedByUserId),
        ),
      )
      .returning()
    if (!updated) return reply.status(409).send({ error: 'Shift was just claimed by someone else' })
    await db!
      .insert(schema.conventionVolunteerShiftSignups)
      .values({ shiftId, userId: actor.userId })
      .onConflictDoNothing()
    return reply.send({
      shift: mapOpenVolunteerShift(updated, signupCount + 1),
    })
  })

  // --- Shift swap requests (attendee) ---
  app.get('/api/v1/conventions/:key/shift-swaps/mine', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const rows = await db!
      .select()
      .from(schema.conventionShiftSwapRequests)
      .where(
        and(
          eq(schema.conventionShiftSwapRequests.conventionId, resolved.conv.id),
          eq(schema.conventionShiftSwapRequests.requesterUserId, actor.userId),
        ),
      )
      .orderBy(desc(schema.conventionShiftSwapRequests.createdAt))
    return reply.send({
      swaps: rows.map((s) => ({
        id: s.id,
        shiftId: s.shiftId,
        status: s.status,
        note: s.note,
        createdAt: iso(s.createdAt),
        respondedAt: iso(s.respondedAt),
      })),
    })
  })

  app.get('/api/v1/conventions/:key/shift-swaps/eligible-shifts', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const mineRows = await db!
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(
        and(
          eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id),
          or(
            eq(schema.conventionVolunteerShifts.personId, actor.userId),
            eq(schema.conventionVolunteerShifts.claimedByUserId, actor.userId),
          ),
        ),
      )
      .orderBy(asc(schema.conventionVolunteerShifts.startsAt))
    const signupShiftIds = await db!
      .select({ shiftId: schema.conventionVolunteerShiftSignups.shiftId })
      .from(schema.conventionVolunteerShiftSignups)
      .where(eq(schema.conventionVolunteerShiftSignups.userId, actor.userId))
    const signupIds = new Set(signupShiftIds.map((r) => r.shiftId))
    const mineIds = new Set(mineRows.map((r) => r.id))
    for (const sid of signupIds) mineIds.add(sid)
    const mine: typeof mineRows = [...mineRows]
    if (signupIds.size > mineRows.length) {
      const extra = await db!
        .select()
        .from(schema.conventionVolunteerShifts)
        .where(
          and(
            eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id),
            inArray(schema.conventionVolunteerShifts.id, [...signupIds]),
          ),
        )
      for (const row of extra) {
        if (!mine.some((m) => m.id === row.id)) mine.push(row)
      }
      mine.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    }
    const openRows = await db!
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(
        and(
          eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id),
          eq(schema.conventionVolunteerShifts.shiftStatus, 'open'),
          isNull(schema.conventionVolunteerShifts.claimedByUserId),
        ),
      )
      .orderBy(asc(schema.conventionVolunteerShifts.startsAt))
    const mapShift = (r: (typeof mineRows)[0]) => ({
      id: r.id,
      title: r.title,
      role: r.role,
      startsAt: iso(r.startsAt),
      endsAt: iso(r.endsAt),
      shiftStatus: r.shiftStatus,
    })
    return reply.send({
      myShifts: mine.map(mapShift),
      openShifts: openRows.filter((r) => !mineIds.has(r.id)).map(mapShift),
    })
  })

  app.post('/api/v1/conventions/:key/shift-swaps/requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ shiftId: z.string().uuid(), note: z.string().max(2000).optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const owns = await userOwnsVolunteerShift(parsed.data.shiftId, resolved.conv.id, actor.userId)
    if (!owns) return reply.status(403).send({ error: 'You can only request swaps for your assigned shifts' })
    const [pending] = await db!
      .select({ id: schema.conventionShiftSwapRequests.id })
      .from(schema.conventionShiftSwapRequests)
      .where(
        and(
          eq(schema.conventionShiftSwapRequests.conventionId, resolved.conv.id),
          eq(schema.conventionShiftSwapRequests.shiftId, parsed.data.shiftId),
          eq(schema.conventionShiftSwapRequests.requesterUserId, actor.userId),
          eq(schema.conventionShiftSwapRequests.status, 'pending'),
        ),
      )
      .limit(1)
    if (pending) return reply.status(400).send({ error: 'You already have a pending swap for this shift' })
    const [row] = await db!
      .insert(schema.conventionShiftSwapRequests)
      .values({
        conventionId: resolved.conv.id,
        shiftId: parsed.data.shiftId,
        requesterUserId: actor.userId,
        note: parsed.data.note?.trim() ?? null,
      })
      .returning()
    return reply.send({
      swap: {
        id: row!.id,
        shiftId: row!.shiftId,
        status: row!.status,
        note: row!.note,
        createdAt: iso(row!.createdAt),
      },
    })
  })

  app.patch('/api/v1/conventions/:key/shift-swaps/requests/:swapId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, swapId } = req.params as { key: string; swapId: string }
    if (!UUID_RE.test(swapId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ status: z.literal('cancelled') }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await requireAttendee(key, actor.userId, reply)
    if (!resolved) return
    const [row] = await db!
      .update(schema.conventionShiftSwapRequests)
      .set({ status: 'cancelled', respondedAt: new Date() })
      .where(
        and(
          eq(schema.conventionShiftSwapRequests.id, swapId),
          eq(schema.conventionShiftSwapRequests.conventionId, resolved.conv.id),
          eq(schema.conventionShiftSwapRequests.requesterUserId, actor.userId),
          eq(schema.conventionShiftSwapRequests.status, 'pending'),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found or not cancellable' })
    return reply.send({
      swap: {
        id: row.id,
        shiftId: row.shiftId,
        status: row.status,
        note: row.note,
        createdAt: iso(row.createdAt),
        respondedAt: iso(row.respondedAt),
      },
    })
  })
}
