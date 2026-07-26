import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { createNotification } from '../lib/create-notification.js'
import {
  computeFreeGapsForUser,
  guestCalendarConflict,
  intervalInsideHostFreeGaps,
  loadUnifiedDancecardCalendar,
  upsertDancecardBufferMinutes,
} from '../lib/convention-dancecard-calendar.js'
import type { IsoInterval } from '../lib/dancecard-intervals.js'

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

async function resolveConventionId(key: string): Promise<string | null> {
  if (UUID_RE.test(key)) return key
  const [row] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, key))
    .limit(1)
  return row?.id ?? null
}

const ORG_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

async function orgMembership(orgId: string, userId: string) {
  const [m] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId))
    )
    .limit(1)
  return m ?? null
}

async function getConventionWithAccess(key: string, userId: string | null) {
  const id = await resolveConventionId(key)
  if (!id) return { notFound: true as const }
  const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
  if (!conv) return { notFound: true as const }
  if (!conv.organizationId) return { forbidden: true as const }
  const [member] = userId
    ? await db
        .select({ role: schema.organizationMembers.role })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, conv.organizationId),
            eq(schema.organizationMembers.userId, userId)
          )
        )
        .limit(1)
    : [undefined]
  const [grant] = userId
    ? await db
        .select()
        .from(schema.conventionAccessGrants)
        .where(and(eq(schema.conventionAccessGrants.conventionId, conv.id), eq(schema.conventionAccessGrants.userId, userId)))
        .limit(1)
    : [undefined]
  const hasPaidAccess = Boolean(grant && grant.paidConfirmed && grant.attendingConfirmed)
  const isStaff = Boolean(grant && (grant.role === 'STAFF' || grant.role === 'MODERATOR' || grant.staffPreAccess))
  const canManage = Boolean(member && ORG_ROLE_RANK[member.role] >= ORG_ROLE_RANK.MODERATOR)
  const canView = canManage || hasPaidAccess || isStaff
  return { conv, canView, canManage, hasPaidAccess, isStaff, userId }
}

const bookingBody = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  description: z.string().min(1).max(2000),
  shareToken: z.string().min(16).max(64),
})

const rescheduleBody = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().max(500).optional(),
})

function isoGaps(gaps: IsoInterval[]) {
  return gaps.map((g) => ({
    startsAt: g.startsAt.toISOString(),
    endsAt: g.endsAt.toISOString(),
  }))
}

export async function registerConventionDancecardV2Routes(app: FastifyInstance) {
  app.get('/api/v1/conventions/:key/dancecard/calendar', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const { items, bufferMinutes } = await loadUnifiedDancecardCalendar(resolved.conv.id, actor.userId)
    const winStart = new Date(resolved.conv.startsAt)
    const winEnd = new Date(resolved.conv.endsAt)
    const { freeGaps } = await computeFreeGapsForUser(resolved.conv.id, actor.userId, winStart, winEnd, 15)
    return reply.send({
      items,
      bufferMinutes,
      freeGaps: isoGaps(freeGaps),
      conventionStartsAt: resolved.conv.startsAt,
      conventionEndsAt: resolved.conv.endsAt,
      timezone: resolved.conv.timezone,
    })
  })

  app.get('/api/v1/conventions/:key/dancecard/prefs', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const { bufferMinutes } = await loadUnifiedDancecardCalendar(resolved.conv.id, actor.userId)
    return reply.send({ bufferMinutes })
  })

  app.patch('/api/v1/conventions/:key/dancecard/prefs', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ bufferMinutes: z.number().int().min(0).max(120) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const v = await upsertDancecardBufferMinutes(resolved.conv.id, actor.userId, parsed.data.bufferMinutes)
    return reply.send({ bufferMinutes: v })
  })

  app.post('/api/v1/conventions/:key/dancecard/share', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ label: z.string().max(128).optional() }).safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const token = randomBytes(24).toString('hex')
    const [row] = await db
      .insert(schema.conventionDancecardShareLinks)
      .values({
        conventionId: resolved.conv.id,
        ownerUserId: actor.userId,
        token,
        label: parsed.data.label?.trim() || undefined,
      })
      .returning()
    const base = (process.env.C2K_WEB_PUBLIC_URL ?? process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
    const path = `/conventions/${encodeURIComponent(resolved.conv.slug)}/dancecard/s/${token}`
    return reply.send({ share: row, url: `${base}${path}` })
  })

  app.get('/api/v1/conventions/:key/dancecard/shares', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const rows = await db
      .select()
      .from(schema.conventionDancecardShareLinks)
      .where(
        and(
          eq(schema.conventionDancecardShareLinks.conventionId, resolved.conv.id),
          eq(schema.conventionDancecardShareLinks.ownerUserId, actor.userId)
        )
      )
      .orderBy(desc(schema.conventionDancecardShareLinks.createdAt))
    return reply.send({ items: rows })
  })

  app.delete('/api/v1/conventions/:key/dancecard/shares/:shareId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, shareId } = req.params as { key: string; shareId: string }
    if (!UUID_RE.test(shareId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [row] = await db
      .update(schema.conventionDancecardShareLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.conventionDancecardShareLinks.id, shareId),
          eq(schema.conventionDancecardShareLinks.conventionId, resolved.conv.id),
          eq(schema.conventionDancecardShareLinks.ownerUserId, actor.userId)
        )
      )
      .returning({ id: schema.conventionDancecardShareLinks.id })
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/conventions/:key/dancecard/shared/:token', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key, token } = req.params as { key: string; token: string }
    if (token.length < 16 || token.length > 64) return reply.status(400).send({ error: 'Invalid token' })
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!conv?.organizationId) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const [link] = await db
      .select()
      .from(schema.conventionDancecardShareLinks)
      .where(
        and(eq(schema.conventionDancecardShareLinks.token, token), eq(schema.conventionDancecardShareLinks.conventionId, conv.id))
      )
      .limit(1)
    if (!link || link.revokedAt) return reply.status(404).send({ error: 'Not found' })
    const [hostUser] = await db
      .select({
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.id, link.ownerUserId))
      .limit(1)
    const winStart = new Date(conv.startsAt)
    const winEnd = new Date(conv.endsAt)
    const { freeGaps } = await computeFreeGapsForUser(conv.id, link.ownerUserId, winStart, winEnd, 15)
    return reply.send({
      conventionName: conv.name,
      timezone: conv.timezone,
      /** Full convention window (for calendar chrome). Free gaps are only the sharer's availability, not mutual with the viewer. */
      conventionStartsAt: conv.startsAt.toISOString(),
      conventionEndsAt: conv.endsAt.toISOString(),
      freeGaps: isoGaps(freeGaps),
      sharer: {
        username: hostUser?.username ?? '',
        displayName: hostUser?.displayName?.trim() ? hostUser.displayName.trim() : null,
        avatarUrl: hostUser?.avatarUrl?.trim() ? hostUser.avatarUrl.trim() : null,
      },
    })
  })

  app.post('/api/v1/conventions/:key/dancecard/booking-requests/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = bookingBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [link] = await db
      .select()
      .from(schema.conventionDancecardShareLinks)
      .where(
        and(
          eq(schema.conventionDancecardShareLinks.token, parsed.data.shareToken),
          eq(schema.conventionDancecardShareLinks.conventionId, resolved.conv.id)
        )
      )
      .limit(1)
    if (!link || link.revokedAt) return reply.status(404).send({ error: 'Share link not found' })
    const hostUserId = link.ownerUserId
    const proposed: IsoInterval = {
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    }
    if (!(proposed.endsAt.getTime() > proposed.startsAt.getTime())) {
      return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    }
    const winStart = new Date(resolved.conv.startsAt)
    const winEnd = new Date(resolved.conv.endsAt)
    const hostOk = await intervalInsideHostFreeGaps(resolved.conv.id, hostUserId, winStart, winEnd, proposed, undefined)
    const guestCheck = await guestCalendarConflict(resolved.conv.id, actor.userId, proposed, undefined)
    return reply.send({
      hostOk,
      guestConflicts: guestCheck.conflicts.map((c) => ({
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
      })),
    })
  })

  app.post('/api/v1/conventions/:key/dancecard/booking-requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = bookingBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [link] = await db
      .select()
      .from(schema.conventionDancecardShareLinks)
      .where(
        and(
          eq(schema.conventionDancecardShareLinks.token, parsed.data.shareToken),
          eq(schema.conventionDancecardShareLinks.conventionId, resolved.conv.id)
        )
      )
      .limit(1)
    if (!link || link.revokedAt) return reply.status(404).send({ error: 'Share link not found' })
    const hostUserId = link.ownerUserId
    if (hostUserId === actor.userId) return reply.status(400).send({ error: 'Cannot book your own dancecard' })
    const proposed: IsoInterval = {
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    }
    if (!(proposed.endsAt.getTime() > proposed.startsAt.getTime())) {
      return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    }
    const winStart = new Date(resolved.conv.startsAt)
    const winEnd = new Date(resolved.conv.endsAt)
    const hostOk = await intervalInsideHostFreeGaps(resolved.conv.id, hostUserId, winStart, winEnd, proposed, undefined)
    if (!hostOk) return reply.status(422).send({ error: 'host_unavailable', code: 'host_unavailable' })
    const { conflicts } = await guestCalendarConflict(resolved.conv.id, actor.userId, proposed, undefined)
    if (conflicts.length > 0) {
      return reply.status(422).send({
        error: 'guest_calendar_conflict',
        code: 'guest_calendar_conflict',
        overlaps: conflicts.map((c) => ({ startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() })),
      })
    }
    const [row] = await db
      .insert(schema.dancecardBookingRequests)
      .values({
        conventionId: resolved.conv.id,
        hostUserId,
        guestUserId: actor.userId,
        startsAt: proposed.startsAt,
        endsAt: proposed.endsAt,
        description: parsed.data.description.trim(),
        status: 'PENDING',
      })
      .returning()
    await createNotification(hostUserId, 'dancecard_booking_requested', {
      conventionId: resolved.conv.id,
      conventionSlug: resolved.conv.slug,
      bookingRequestId: row?.id,
      guestUserId: actor.userId,
    })
    return reply.send({ request: row })
  })

  app.get('/api/v1/conventions/:key/dancecard/booking-requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const incoming = await db
      .select()
      .from(schema.dancecardBookingRequests)
      .where(
        and(
          eq(schema.dancecardBookingRequests.conventionId, resolved.conv.id),
          eq(schema.dancecardBookingRequests.hostUserId, actor.userId),
          inArray(schema.dancecardBookingRequests.status, ['PENDING', 'RESCHEDULE_PENDING', 'ACCEPTED'])
        )
      )
      .orderBy(asc(schema.dancecardBookingRequests.createdAt))
    const outgoing = await db
      .select()
      .from(schema.dancecardBookingRequests)
      .where(
        and(
          eq(schema.dancecardBookingRequests.conventionId, resolved.conv.id),
          eq(schema.dancecardBookingRequests.guestUserId, actor.userId)
        )
      )
      .orderBy(desc(schema.dancecardBookingRequests.createdAt))
    return reply.send({ incoming, outgoing })
  })

  async function loadBookingForActor(
    conventionId: string,
    bookingId: string,
    actorUserId: string
  ): Promise<(typeof schema.dancecardBookingRequests.$inferSelect) | null> {
    const [b] = await db
      .select()
      .from(schema.dancecardBookingRequests)
      .where(
        and(
          eq(schema.dancecardBookingRequests.id, bookingId),
          eq(schema.dancecardBookingRequests.conventionId, conventionId),
          or(
            eq(schema.dancecardBookingRequests.hostUserId, actorUserId),
            eq(schema.dancecardBookingRequests.guestUserId, actorUserId)
          )
        )
      )
      .limit(1)
    return b ?? null
  }

  app.post('/api/v1/conventions/:key/dancecard/booking-requests/:bookingId/accept', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, bookingId } = req.params as { key: string; bookingId: string }
    if (!UUID_RE.test(bookingId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const b = await loadBookingForActor(resolved.conv.id, bookingId, actor.userId)
    if (!b || b.hostUserId !== actor.userId) return reply.status(404).send({ error: 'Not found' })
    if (b.status !== 'PENDING') return reply.status(409).send({ error: 'Invalid status' })
    const proposed: IsoInterval = { startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt) }
    const winStart = new Date(resolved.conv.startsAt)
    const winEnd = new Date(resolved.conv.endsAt)
    const hostOk = await intervalInsideHostFreeGaps(resolved.conv.id, b.hostUserId, winStart, winEnd, proposed, undefined)
    if (!hostOk) return reply.status(409).send({ error: 'host_no_longer_free' })
    const guestConf = await guestCalendarConflict(resolved.conv.id, b.guestUserId, proposed, undefined)
    if (guestConf.conflicts.length > 0) return reply.status(409).send({ error: 'guest_no_longer_free' })
    const titleHost = `Scene: ${b.description.slice(0, 80)}`
    const titleGuest = `Scene @ host: ${b.description.slice(0, 72)}`
    const [hostEntry] = await db
      .insert(schema.dancecardEntries)
      .values({
        conventionId: resolved.conv.id,
        userId: b.hostUserId,
        title: titleHost,
        startsAt: proposed.startsAt,
        endsAt: proposed.endsAt,
        sourceKind: 'scene_booking',
        sourceId: b.id,
      })
      .returning()
    const [guestEntry] = await db
      .insert(schema.dancecardEntries)
      .values({
        conventionId: resolved.conv.id,
        userId: b.guestUserId,
        title: titleGuest,
        startsAt: proposed.startsAt,
        endsAt: proposed.endsAt,
        sourceKind: 'scene_booking',
        sourceId: b.id,
      })
      .returning()
    const [updated] = await db
      .update(schema.dancecardBookingRequests)
      .set({
        status: 'ACCEPTED',
        hostEntryId: hostEntry?.id,
        guestEntryId: guestEntry?.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.dancecardBookingRequests.id, b.id))
      .returning()
    await createNotification(b.guestUserId, 'dancecard_booking_accepted', {
      conventionId: resolved.conv.id,
      conventionSlug: resolved.conv.slug,
      bookingRequestId: b.id,
    })
    return reply.send({ request: updated })
  })

  app.post('/api/v1/conventions/:key/dancecard/booking-requests/:bookingId/decline', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, bookingId } = req.params as { key: string; bookingId: string }
    if (!UUID_RE.test(bookingId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const b = await loadBookingForActor(resolved.conv.id, bookingId, actor.userId)
    if (!b) return reply.status(404).send({ error: 'Not found' })
    if (b.status === 'RESCHEDULE_PENDING') {
      if (actor.userId === b.proposedByUserId) {
        return reply.status(403).send({ error: 'Only the other party can respond to this reschedule' })
      }
      if (actor.userId !== b.hostUserId && actor.userId !== b.guestUserId) {
        return reply.status(404).send({ error: 'Not found' })
      }
      const [updated] = await db
        .update(schema.dancecardBookingRequests)
        .set({
          status: 'ACCEPTED',
          proposedStartsAt: null,
          proposedEndsAt: null,
          proposedByUserId: null,
          rescheduleNote: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.dancecardBookingRequests.id, b.id))
        .returning()
      if (b.proposedByUserId) {
        await createNotification(b.proposedByUserId, 'dancecard_reschedule_declined', {
          conventionId: resolved.conv.id,
          bookingRequestId: b.id,
        })
      }
      return reply.send({ request: updated })
    }
    if (b.hostUserId !== actor.userId) return reply.status(404).send({ error: 'Not found' })
    if (b.status !== 'PENDING') return reply.status(409).send({ error: 'Invalid status' })
    const [updated] = await db
      .update(schema.dancecardBookingRequests)
      .set({ status: 'DECLINED', updatedAt: new Date() })
      .where(eq(schema.dancecardBookingRequests.id, b.id))
      .returning()
    await createNotification(b.guestUserId, 'dancecard_booking_declined', {
      conventionId: resolved.conv.id,
      bookingRequestId: b.id,
    })
    return reply.send({ request: updated })
  })

  app.post('/api/v1/conventions/:key/dancecard/booking-requests/:bookingId/cancel', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, bookingId } = req.params as { key: string; bookingId: string }
    if (!UUID_RE.test(bookingId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const b = await loadBookingForActor(resolved.conv.id, bookingId, actor.userId)
    if (!b) return reply.status(404).send({ error: 'Not found' })
    if (b.status !== 'ACCEPTED' && b.status !== 'PENDING' && b.status !== 'RESCHEDULE_PENDING') {
      return reply.status(409).send({ error: 'Invalid status' })
    }
    if (b.hostEntryId) {
      await db.delete(schema.dancecardEntries).where(eq(schema.dancecardEntries.id, b.hostEntryId))
    }
    if (b.guestEntryId) {
      await db.delete(schema.dancecardEntries).where(eq(schema.dancecardEntries.id, b.guestEntryId))
    }
    const [updated] = await db
      .update(schema.dancecardBookingRequests)
      .set({
        status: 'CANCELLED',
        cancelledByUserId: actor.userId,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.dancecardBookingRequests.id, b.id))
      .returning()
    const other = b.hostUserId === actor.userId ? b.guestUserId : b.hostUserId
    await createNotification(other, 'dancecard_scene_cancelled', {
      conventionId: resolved.conv.id,
      conventionSlug: resolved.conv.slug,
      bookingRequestId: b.id,
      cancelledByUserId: actor.userId,
    })
    return reply.send({ request: updated })
  })

  app.post('/api/v1/conventions/:key/dancecard/booking-requests/:bookingId/reschedule-request', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, bookingId } = req.params as { key: string; bookingId: string }
    if (!UUID_RE.test(bookingId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = rescheduleBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const b = await loadBookingForActor(resolved.conv.id, bookingId, actor.userId)
    if (!b || b.status !== 'ACCEPTED') return reply.status(404).send({ error: 'Not found' })
    const proposed: IsoInterval = {
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    }
    if (!(proposed.endsAt.getTime() > proposed.startsAt.getTime())) {
      return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    }
    const winStart = new Date(resolved.conv.startsAt)
    const winEnd = new Date(resolved.conv.endsAt)
    const hostOk = await intervalInsideHostFreeGaps(
      resolved.conv.id,
      b.hostUserId,
      winStart,
      winEnd,
      proposed,
      b.id
    )
    const guestOk =
      (await guestCalendarConflict(resolved.conv.id, b.guestUserId, proposed, b.id)).conflicts.length === 0
    if (!hostOk || !guestOk) return reply.status(422).send({ error: 'invalid_reschedule_window' })
    const [updated] = await db
      .update(schema.dancecardBookingRequests)
      .set({
        status: 'RESCHEDULE_PENDING',
        proposedStartsAt: proposed.startsAt,
        proposedEndsAt: proposed.endsAt,
        proposedByUserId: actor.userId,
        rescheduleNote: parsed.data.note?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.dancecardBookingRequests.id, b.id))
      .returning()
    const notify = b.hostUserId === actor.userId ? b.guestUserId : b.hostUserId
    await createNotification(notify, 'dancecard_reschedule_requested', {
      conventionId: resolved.conv.id,
      bookingRequestId: b.id,
    })
    return reply.send({ request: updated })
  })

  app.post('/api/v1/conventions/:key/dancecard/booking-requests/:bookingId/reschedule-accept', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, bookingId } = req.params as { key: string; bookingId: string }
    if (!UUID_RE.test(bookingId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const b = await loadBookingForActor(resolved.conv.id, bookingId, actor.userId)
    if (!b || b.status !== 'RESCHEDULE_PENDING') return reply.status(404).send({ error: 'Not found' })
    if (b.proposedByUserId === actor.userId) return reply.status(403).send({ error: 'Cannot accept own proposal' })
    if (!b.proposedStartsAt || !b.proposedEndsAt) return reply.status(400).send({ error: 'Missing proposal' })
    const proposed: IsoInterval = {
      startsAt: new Date(b.proposedStartsAt),
      endsAt: new Date(b.proposedEndsAt),
    }
    const winStart = new Date(resolved.conv.startsAt)
    const winEnd = new Date(resolved.conv.endsAt)
    const hostOk = await intervalInsideHostFreeGaps(
      resolved.conv.id,
      b.hostUserId,
      winStart,
      winEnd,
      proposed,
      b.id
    )
    const guestOk =
      (await guestCalendarConflict(resolved.conv.id, b.guestUserId, proposed, b.id)).conflicts.length === 0
    if (!hostOk || !guestOk) return reply.status(409).send({ error: 'window_no_longer_valid' })
    if (b.hostEntryId) {
      await db
        .update(schema.dancecardEntries)
        .set({ startsAt: proposed.startsAt, endsAt: proposed.endsAt })
        .where(eq(schema.dancecardEntries.id, b.hostEntryId))
    }
    if (b.guestEntryId) {
      await db
        .update(schema.dancecardEntries)
        .set({ startsAt: proposed.startsAt, endsAt: proposed.endsAt })
        .where(eq(schema.dancecardEntries.id, b.guestEntryId))
    }
    const [updated] = await db
      .update(schema.dancecardBookingRequests)
      .set({
        status: 'ACCEPTED',
        startsAt: proposed.startsAt,
        endsAt: proposed.endsAt,
        proposedStartsAt: null,
        proposedEndsAt: null,
        proposedByUserId: null,
        rescheduleNote: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.dancecardBookingRequests.id, b.id))
      .returning()
    await createNotification(b.proposedByUserId!, 'dancecard_reschedule_accepted', {
      conventionId: resolved.conv.id,
      bookingRequestId: b.id,
    })
    return reply.send({ request: updated })
  })
}
