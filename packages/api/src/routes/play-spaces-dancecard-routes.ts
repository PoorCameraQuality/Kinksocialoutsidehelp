/**
 * Play Spaces dancecard APIs — calendar, share links, guest/member bookings,
 * program slots, prefs/profile, maps.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, ilike, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'
import {
  alphaUploadDisabledResponse,
  isAlphaUploadDisabled,
} from '../lib/alpha-upload-policy.js'
import { defaultBucket, getS3Client, publicUrlForKey, putObject } from '../lib/s3-upload.js'
import {
  computePlayFreeGapsForUser,
  loadPlayDancecardCalendar,
  playGuestCalendarConflict,
  playIntervalInsideHostFreeGaps,
  upsertPlayDancecardBufferMinutes,
} from '../lib/play-space-dancecard-calendar.js'
import type { IsoInterval } from '../lib/dancecard-intervals.js'
import { notifyPlaySpaceDancecard } from '../lib/play-space-dancecard-notify.js'
import { loadPublicProfilePhotos } from './profile-photos.js'
import { pickPrimaryProfilePhoto } from '@c2k/shared'

function optionalUserId(req: FastifyRequest): string | null {
  const viewer = resolveViewerFromRequest(req)
  if (!viewer.authenticated) return null
  return getViewerUserId(viewer.payload)
}

async function requireExistingDbUser(req: FastifyRequest, reply: FastifyReply) {
  const actor = requireAuthenticatedDbUser(req, reply)
  if (!actor) return null
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, actor.userId), isNull(schema.users.deletedAt)))
    .limit(1)
  if (!rows[0]) {
    reply.status(401).send({
      error: 'Session user is missing. Sign out and sign back in with kink.social, then try again.',
    })
    return null
  }
  return actor
}

async function loadSpaceByKey(key: string) {
  const bySlug = await db
    .select()
    .from(schema.playSpaces)
    .where(eq(schema.playSpaces.slug, key.toLowerCase()))
    .limit(1)
  if (bySlug[0]) return bySlug[0]
  if (!z.string().uuid().safeParse(key).success) return null
  const byId = await db.select().from(schema.playSpaces).where(eq(schema.playSpaces.id, key)).limit(1)
  return byId[0] ?? null
}

async function membership(spaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(schema.playSpaceMembers)
    .where(
      and(eq(schema.playSpaceMembers.playSpaceId, spaceId), eq(schema.playSpaceMembers.userId, userId)),
    )
    .limit(1)
  return rows[0] ?? null
}

async function requireMember(
  req: FastifyRequest,
  reply: FastifyReply,
  space: typeof schema.playSpaces.$inferSelect,
) {
  const actor = await requireExistingDbUser(req, reply)
  if (!actor) return null
  const m = await membership(space.id, actor.userId)
  if (!m) {
    reply.status(403).send({ error: 'Join this play space to continue' })
    return null
  }
  return { userId: actor.userId, role: m.role }
}

function isoGaps(gaps: IsoInterval[]) {
  return gaps.map((g) => ({ startsAt: g.startsAt.toISOString(), endsAt: g.endsAt.toISOString() }))
}

const entryBody = z.object({
  title: z.string().trim().min(1).max(255),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().trim().max(512).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

const bookingBody = z.object({
  shareToken: z.string().min(16).max(64),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().trim().max(512).optional().nullable(),
  description: z.string().trim().max(2000).default(''),
  guestDisplayName: z.string().trim().min(1).max(128).optional(),
  guestContact: z.string().trim().max(255).optional(),
})

const programBody = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).optional().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().trim().max(512).optional().nullable(),
  published: z.boolean().optional(),
})

const prefsBody = z.object({
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  displayName: z.string().trim().max(128).optional().nullable(),
  bio: z.string().trim().max(2000).optional().nullable(),
  avatarUrl: z.string().trim().max(2000).optional().nullable(),
  contactNote: z.string().trim().max(512).optional().nullable(),
})

const mapBody = z.object({
  label: z.string().trim().min(1).max(255).default('Venue map'),
  imageUrl: z.string().trim().url().max(4000),
})

const bookingPatchBody = z.object({
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(512).optional().nullable(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
})

type PartyProfile = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

async function loadPartyProfile(userId: string): Promise<PartyProfile | null> {
  const [hostUser] = await db
    .select({
      username: schema.users.username,
      profileId: schema.profiles.id,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!hostUser?.username) return null

  let avatarUrl: string | null = hostUser.avatarUrl?.trim() || null
  if (hostUser.profileId) {
    try {
      const photos = await loadPublicProfilePhotos(hostUser.profileId)
      const primary = pickPrimaryProfilePhoto(photos) ?? photos[0]
      if (primary?.url?.trim()) avatarUrl = primary.url.trim()
    } catch {
      // Fall back to profiles.avatarUrl
    }
  }

  return {
    userId,
    username: hostUser.username,
    displayName: hostUser.displayName?.trim() || null,
    avatarUrl,
  }
}

async function enrichBookingRow(
  row: typeof schema.playSpaceBookingRequests.$inferSelect,
  viewerUserId: string,
  profileCache: Map<string, PartyProfile | null>,
) {
  async function cached(userId: string) {
    if (profileCache.has(userId)) return profileCache.get(userId) ?? null
    const p = await loadPartyProfile(userId)
    profileCache.set(userId, p)
    return p
  }

  const host = await cached(row.hostUserId)
  const guest =
    row.guestUserId ? await cached(row.guestUserId)
    : row.guestDisplayName?.trim() ?
      {
        userId: '',
        username: '',
        displayName: row.guestDisplayName.trim(),
        avatarUrl: null as string | null,
      }
    : null

  const viewerIsHost = row.hostUserId === viewerUserId
  const counterpart = viewerIsHost ? guest : host

  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    host,
    guest,
    counterpart,
  }
}

export async function registerPlaySpaceDancecardRoutes(app: FastifyInstance) {
  /** Unified calendar for member (shape aligned with convention dancecard calendar). */
  app.get('/api/v1/play-spaces/:key/dancecard/calendar', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const cal = await loadPlayDancecardCalendar(space.id, member.userId)
    const { freeGaps } = await computePlayFreeGapsForUser(
      space.id,
      member.userId,
      space.startsAt,
      space.endsAt,
      15,
    )
    const startsAt = space.startsAt.toISOString()
    const endsAt = space.endsAt.toISOString()
    return reply.send({
      ...cal,
      freeGaps: isoGaps(freeGaps),
      conventionStartsAt: startsAt,
      conventionEndsAt: endsAt,
      playSpaceStartsAt: startsAt,
      playSpaceEndsAt: endsAt,
      timezone: space.timezone,
    })
  })

  app.get('/api/v1/play-spaces/:key/dancecard/prefs', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [row] = await db
      .select()
      .from(schema.playSpaceDancecardPrefs)
      .where(
        and(
          eq(schema.playSpaceDancecardPrefs.playSpaceId, space.id),
          eq(schema.playSpaceDancecardPrefs.userId, member.userId),
        ),
      )
      .limit(1)
    return reply.send({
      bufferMinutes: row?.bufferMinutes ?? 0,
      displayName: row?.displayName ?? null,
      bio: row?.bio ?? null,
      avatarUrl: row?.avatarUrl ?? null,
      contactNote: row?.contactNote ?? null,
    })
  })

  app.patch('/api/v1/play-spaces/:key/dancecard/prefs', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const parsed = prefsBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    if (parsed.data.bufferMinutes !== undefined) {
      await upsertPlayDancecardBufferMinutes(space.id, member.userId, parsed.data.bufferMinutes)
    }

    const [ex] = await db
      .select({ id: schema.playSpaceDancecardPrefs.id })
      .from(schema.playSpaceDancecardPrefs)
      .where(
        and(
          eq(schema.playSpaceDancecardPrefs.playSpaceId, space.id),
          eq(schema.playSpaceDancecardPrefs.userId, member.userId),
        ),
      )
      .limit(1)

    const patch = {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
      ...(parsed.data.contactNote !== undefined ? { contactNote: parsed.data.contactNote } : {}),
      updatedAt: new Date(),
    }

    if (ex) {
      await db.update(schema.playSpaceDancecardPrefs).set(patch).where(eq(schema.playSpaceDancecardPrefs.id, ex.id))
    } else {
      await db.insert(schema.playSpaceDancecardPrefs).values({
        playSpaceId: space.id,
        userId: member.userId,
        bufferMinutes: parsed.data.bufferMinutes ?? 0,
        displayName: parsed.data.displayName ?? null,
        bio: parsed.data.bio ?? null,
        avatarUrl: parsed.data.avatarUrl ?? null,
        contactNote: parsed.data.contactNote ?? null,
      })
    }

    const [row] = await db
      .select()
      .from(schema.playSpaceDancecardPrefs)
      .where(
        and(
          eq(schema.playSpaceDancecardPrefs.playSpaceId, space.id),
          eq(schema.playSpaceDancecardPrefs.userId, member.userId),
        ),
      )
      .limit(1)
    return reply.send({
      bufferMinutes: row?.bufferMinutes ?? 0,
      displayName: row?.displayName ?? null,
      bio: row?.bio ?? null,
      avatarUrl: row?.avatarUrl ?? null,
      contactNote: row?.contactNote ?? null,
    })
  })

  app.post('/api/v1/play-spaces/:key/dancecard/share', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const parsed = z.object({ label: z.string().max(128).optional() }).safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const token = randomBytes(24).toString('hex')
    const [row] = await db
      .insert(schema.playSpaceDancecardShareLinks)
      .values({
        playSpaceId: space.id,
        ownerUserId: member.userId,
        token,
        label: parsed.data.label?.trim() || undefined,
      })
      .returning()
    const base = (
      process.env.C2K_DANCECARD_PUBLIC_WEB_URL ??
      process.env.C2K_PUBLIC_WEB_URL ??
      process.env.VITE_SITE_URL ??
      'http://localhost:5173'
    ).replace(/\/$/, '')
    const path = `/play/${encodeURIComponent(space.slug)}/s/${token}`
    return reply.send({ share: row, url: `${base}${path}`, path })
  })

  app.get('/api/v1/play-spaces/:key/dancecard/shares', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const rows = await db
      .select()
      .from(schema.playSpaceDancecardShareLinks)
      .where(
        and(
          eq(schema.playSpaceDancecardShareLinks.playSpaceId, space.id),
          eq(schema.playSpaceDancecardShareLinks.ownerUserId, member.userId),
        ),
      )
      .orderBy(desc(schema.playSpaceDancecardShareLinks.createdAt))
    return reply.send({ items: rows })
  })

  app.delete('/api/v1/play-spaces/:key/dancecard/shares/:shareId', async (req, reply) => {
    const { key, shareId } = req.params as { key: string; shareId: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [row] = await db
      .update(schema.playSpaceDancecardShareLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.playSpaceDancecardShareLinks.id, shareId),
          eq(schema.playSpaceDancecardShareLinks.playSpaceId, space.id),
          eq(schema.playSpaceDancecardShareLinks.ownerUserId, member.userId),
        ),
      )
      .returning({ id: schema.playSpaceDancecardShareLinks.id })
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  async function sharedPayloadForHost(
    space: typeof schema.playSpaces.$inferSelect,
    hostUserId: string,
    shareToken?: string | null,
  ) {
    const [hostUser] = await db
      .select({
        username: schema.users.username,
        profileId: schema.profiles.id,
        displayName: schema.profiles.displayName,
        bio: schema.profiles.bio,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.id, hostUserId))
      .limit(1)

    const [prefs] = await db
      .select()
      .from(schema.playSpaceDancecardPrefs)
      .where(
        and(
          eq(schema.playSpaceDancecardPrefs.playSpaceId, space.id),
          eq(schema.playSpaceDancecardPrefs.userId, hostUserId),
        ),
      )
      .limit(1)

    let ksAvatarUrl: string | null = hostUser?.avatarUrl?.trim() || null
    if (hostUser?.profileId) {
      try {
        const photos = await loadPublicProfilePhotos(hostUser.profileId)
        const primary = pickPrimaryProfilePhoto(photos) ?? photos[0]
        if (primary?.url?.trim()) ksAvatarUrl = primary.url.trim()
      } catch {
        // Fall back to profiles.avatarUrl
      }
    }

    const { freeGaps } = await computePlayFreeGapsForUser(
      space.id,
      hostUserId,
      space.startsAt,
      space.endsAt,
      15,
    )

    const startsAt = space.startsAt.toISOString()
    const endsAt = space.endsAt.toISOString()
    return {
      playSpaceName: space.title,
      /** Aliases so ConventionDancecardCompareGrid / compare utils work unchanged. */
      conventionName: space.title,
      timezone: space.timezone,
      playSpaceStartsAt: startsAt,
      playSpaceEndsAt: endsAt,
      conventionStartsAt: startsAt,
      conventionEndsAt: endsAt,
      freeGaps: isoGaps(freeGaps),
      sharer: {
        username: hostUser?.username ?? '',
        displayName:
          prefs?.displayName?.trim() ||
          (hostUser?.displayName?.trim() ? hostUser.displayName.trim() : null),
        /** Prefer kink.social primary photo; prefs avatar is an optional override. */
        avatarUrl: prefs?.avatarUrl?.trim() || ksAvatarUrl,
        bio: prefs?.bio?.trim() || hostUser?.bio?.trim() || null,
      },
      allowGuestReserve: true,
      shareToken: shareToken ?? null,
    }
  }

  /** Public: host free gaps for share token (no auth). */
  app.get('/api/v1/play-spaces/:key/dancecard/shared/:token', async (req, reply) => {
    const { key, token } = req.params as { key: string; token: string }
    if (token.length < 16 || token.length > 64) return reply.status(400).send({ error: 'Invalid token' })
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Not found' })
    const [link] = await db
      .select()
      .from(schema.playSpaceDancecardShareLinks)
      .where(
        and(
          eq(schema.playSpaceDancecardShareLinks.token, token),
          eq(schema.playSpaceDancecardShareLinks.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!link || link.revokedAt) return reply.status(404).send({ error: 'Not found' })
    return reply.send(await sharedPayloadForHost(space, link.ownerUserId, link.token))
  })

  /**
   * Authenticated member compare by username when the partner has an active share link
   * (they opted in by sharing). Same payload shape as /shared/:token.
   */
  app.post('/api/v1/play-spaces/:key/dancecard/compare/by-username', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const parsed = z
      .object({ username: z.string().trim().min(2).max(64) })
      .safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Username required' })
    const username = parsed.data.username.replace(/^@/, '').trim()
    const [hostUser] = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(and(ilike(schema.users.username, username), isNull(schema.users.deletedAt)))
      .limit(1)
    if (!hostUser) {
      return reply.status(404).send({ error: 'Compare not available for that username.' })
    }
    if (hostUser.id === member.userId) {
      return reply.status(400).send({
        error: 'You cannot compare with your own username. Paste a partner share link or another username.',
      })
    }
    const hostMember = await membership(space.id, hostUser.id)
    if (!hostMember) {
      return reply.status(404).send({ error: 'Compare not available for that username.' })
    }
    const [activeShare] = await db
      .select({ token: schema.playSpaceDancecardShareLinks.token })
      .from(schema.playSpaceDancecardShareLinks)
      .where(
        and(
          eq(schema.playSpaceDancecardShareLinks.playSpaceId, space.id),
          eq(schema.playSpaceDancecardShareLinks.ownerUserId, hostUser.id),
          isNull(schema.playSpaceDancecardShareLinks.revokedAt),
        ),
      )
      .orderBy(desc(schema.playSpaceDancecardShareLinks.createdAt))
      .limit(1)
    if (!activeShare) {
      return reply.status(404).send({
        error: 'That person has not shared their availability yet. Ask for their share link.',
      })
    }
    return reply.send(await sharedPayloadForHost(space, hostUser.id, activeShare.token))
  })

  /**
   * Create booking. Authenticated members OR guests (no session) with shareToken + guestDisplayName.
   */
  app.post('/api/v1/play-spaces/:key/dancecard/booking-requests', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const parsed = bookingBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const [link] = await db
      .select()
      .from(schema.playSpaceDancecardShareLinks)
      .where(
        and(
          eq(schema.playSpaceDancecardShareLinks.token, parsed.data.shareToken),
          eq(schema.playSpaceDancecardShareLinks.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!link || link.revokedAt) return reply.status(404).send({ error: 'Share link not found' })

    const hostUserId = link.ownerUserId
    const userId = optionalUserId(req)
    const isGuest = !userId

    if (isGuest && !parsed.data.guestDisplayName?.trim()) {
      return reply.status(400).send({
        error: 'guestDisplayName is required when not signed in',
        code: 'guest_name_required',
      })
    }
    if (userId && hostUserId === userId) {
      return reply.status(400).send({ error: 'Cannot book your own dancecard' })
    }

    const proposed: IsoInterval = {
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    }
    if (!(proposed.endsAt > proposed.startsAt)) {
      return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    }

    const hostOk = await playIntervalInsideHostFreeGaps(
      space.id,
      hostUserId,
      space.startsAt,
      space.endsAt,
      proposed,
    )
    if (!hostOk) return reply.status(422).send({ error: 'host_unavailable', code: 'host_unavailable' })

    if (userId) {
      const { conflicts } = await playGuestCalendarConflict(space.id, userId, proposed)
      if (conflicts.length > 0) {
        return reply.status(422).send({
          error: 'guest_calendar_conflict',
          code: 'guest_calendar_conflict',
          overlaps: conflicts.map((c) => ({
            startsAt: c.startsAt.toISOString(),
            endsAt: c.endsAt.toISOString(),
          })),
        })
      }
    }

    const location = parsed.data.location?.trim() || null
    const [row] = await db
      .insert(schema.playSpaceBookingRequests)
      .values({
        playSpaceId: space.id,
        hostUserId,
        guestUserId: userId,
        guestDisplayName: isGuest ? parsed.data.guestDisplayName!.trim() : null,
        guestContact: isGuest ? parsed.data.guestContact?.trim() || null : null,
        startsAt: proposed.startsAt,
        endsAt: proposed.endsAt,
        location,
        description: parsed.data.description.trim() || (isGuest ? 'Guest reservation request' : ''),
        status: 'PENDING',
      })
      .returning()

    await notifyPlaySpaceDancecard({
      userId: hostUserId,
      type: 'dancecard_booking_requested',
      playSpaceId: space.id,
      playSpaceSlug: space.slug,
      bookingRequestId: row!.id,
      actorUserId: userId ?? undefined,
    })

    return reply.status(201).send({ request: row })
  })

  app.get('/api/v1/play-spaces/:key/dancecard/booking-requests', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return

    const incomingRows = await db
      .select()
      .from(schema.playSpaceBookingRequests)
      .where(
        and(
          eq(schema.playSpaceBookingRequests.playSpaceId, space.id),
          eq(schema.playSpaceBookingRequests.hostUserId, member.userId),
          inArray(schema.playSpaceBookingRequests.status, ['PENDING', 'ACCEPTED']),
        ),
      )
      .orderBy(asc(schema.playSpaceBookingRequests.createdAt))

    const outgoingRows = await db
      .select()
      .from(schema.playSpaceBookingRequests)
      .where(
        and(
          eq(schema.playSpaceBookingRequests.playSpaceId, space.id),
          eq(schema.playSpaceBookingRequests.guestUserId, member.userId),
          inArray(schema.playSpaceBookingRequests.status, ['PENDING', 'ACCEPTED']),
        ),
      )
      .orderBy(asc(schema.playSpaceBookingRequests.createdAt))

    const profileCache = new Map<string, PartyProfile | null>()
    const incoming = await Promise.all(
      incomingRows.map((row) => enrichBookingRow(row, member.userId, profileCache)),
    )
    const outgoing = await Promise.all(
      outgoingRows.map((row) => enrichBookingRow(row, member.userId, profileCache)),
    )

    return reply.send({ incoming, outgoing })
  })

  app.post('/api/v1/play-spaces/:key/dancecard/booking-requests/:id/accept', async (req, reply) => {
    const { key, id } = req.params as { key: string; id: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return

    const [reqRow] = await db
      .select()
      .from(schema.playSpaceBookingRequests)
      .where(
        and(
          eq(schema.playSpaceBookingRequests.id, id),
          eq(schema.playSpaceBookingRequests.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!reqRow) return reply.status(404).send({ error: 'Not found' })
    if (reqRow.hostUserId !== member.userId) return reply.status(403).send({ error: 'Only the host can accept' })
    if (reqRow.status !== 'PENDING') return reply.status(400).send({ error: 'Not pending' })

    const guestLabel = reqRow.guestDisplayName?.trim() || 'Guest'
    const sceneLocation = reqRow.location?.trim() || null
    const [hostEntry] = await db
      .insert(schema.playSpaceDancecardEntries)
      .values({
        playSpaceId: space.id,
        userId: reqRow.hostUserId,
        title: `Scene with ${guestLabel}`,
        startsAt: reqRow.startsAt,
        endsAt: reqRow.endsAt,
        location: sceneLocation,
        notes: reqRow.description || null,
        sourceKind: 'scene_booking',
        sourceId: reqRow.id,
      })
      .returning()

    let guestEntryId: string | null = null
    if (reqRow.guestUserId) {
      const [guestEntry] = await db
        .insert(schema.playSpaceDancecardEntries)
        .values({
          playSpaceId: space.id,
          userId: reqRow.guestUserId,
          title: 'Scene booking',
          startsAt: reqRow.startsAt,
          endsAt: reqRow.endsAt,
          location: sceneLocation,
          notes: reqRow.description || null,
          sourceKind: 'scene_booking',
          sourceId: reqRow.id,
        })
        .returning()
      guestEntryId = guestEntry.id
    }

    const [updated] = await db
      .update(schema.playSpaceBookingRequests)
      .set({
        status: 'ACCEPTED',
        hostEntryId: hostEntry.id,
        guestEntryId,
        updatedAt: new Date(),
      })
      .where(eq(schema.playSpaceBookingRequests.id, id))
      .returning()

    await notifyPlaySpaceDancecard({
      userId: reqRow.guestUserId,
      type: 'dancecard_booking_accepted',
      playSpaceId: space.id,
      playSpaceSlug: space.slug,
      bookingRequestId: reqRow.id,
      actorUserId: member.userId,
    })

    return reply.send({ request: updated })
  })

  app.post('/api/v1/play-spaces/:key/dancecard/booking-requests/:id/decline', async (req, reply) => {
    const { key, id } = req.params as { key: string; id: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [reqRow] = await db
      .select()
      .from(schema.playSpaceBookingRequests)
      .where(
        and(
          eq(schema.playSpaceBookingRequests.id, id),
          eq(schema.playSpaceBookingRequests.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!reqRow) return reply.status(404).send({ error: 'Not found' })
    if (reqRow.hostUserId !== member.userId) return reply.status(403).send({ error: 'Only the host can decline' })
    const [updated] = await db
      .update(schema.playSpaceBookingRequests)
      .set({ status: 'DECLINED', updatedAt: new Date() })
      .where(eq(schema.playSpaceBookingRequests.id, id))
      .returning()

    await notifyPlaySpaceDancecard({
      userId: reqRow.guestUserId,
      type: 'dancecard_booking_declined',
      playSpaceId: space.id,
      playSpaceSlug: space.slug,
      bookingRequestId: reqRow.id,
      actorUserId: member.userId,
    })

    return reply.send({ request: updated })
  })

  app.post('/api/v1/play-spaces/:key/dancecard/booking-requests/:id/cancel', async (req, reply) => {
    const { key, id } = req.params as { key: string; id: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [reqRow] = await db
      .select()
      .from(schema.playSpaceBookingRequests)
      .where(
        and(
          eq(schema.playSpaceBookingRequests.id, id),
          eq(schema.playSpaceBookingRequests.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!reqRow) return reply.status(404).send({ error: 'Not found' })
    const isParty =
      reqRow.hostUserId === member.userId ||
      (reqRow.guestUserId && reqRow.guestUserId === member.userId)
    if (!isParty) return reply.status(403).send({ error: 'Forbidden' })

    const entryIds = [reqRow.hostEntryId, reqRow.guestEntryId].filter(
      (x): x is string => Boolean(x),
    )
    if (entryIds.length > 0) {
      await db
        .delete(schema.playSpaceDancecardEntries)
        .where(inArray(schema.playSpaceDancecardEntries.id, entryIds))
    }

    const [updated] = await db
      .update(schema.playSpaceBookingRequests)
      .set({
        status: 'CANCELLED',
        cancelledByUserId: member.userId,
        cancelledAt: new Date(),
        hostEntryId: null,
        guestEntryId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.playSpaceBookingRequests.id, id))
      .returning()

    const other =
      reqRow.hostUserId === member.userId ? reqRow.guestUserId : reqRow.hostUserId
    await notifyPlaySpaceDancecard({
      userId: other,
      type: 'dancecard_scene_cancelled',
      playSpaceId: space.id,
      playSpaceSlug: space.slug,
      bookingRequestId: reqRow.id,
      actorUserId: member.userId,
    })

    return reply.send({ request: updated })
  })

  /** Update notes and/or reschedule an accepted scene (either party). */
  app.patch('/api/v1/play-spaces/:key/dancecard/booking-requests/:id', async (req, reply) => {
    const { key, id } = req.params as { key: string; id: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return

    const parsed = bookingPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    if (
      parsed.data.description === undefined &&
      parsed.data.location === undefined &&
      parsed.data.startsAt === undefined &&
      parsed.data.endsAt === undefined
    ) {
      return reply.status(400).send({ error: 'Nothing to update' })
    }

    const [reqRow] = await db
      .select()
      .from(schema.playSpaceBookingRequests)
      .where(
        and(
          eq(schema.playSpaceBookingRequests.id, id),
          eq(schema.playSpaceBookingRequests.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!reqRow) return reply.status(404).send({ error: 'Not found' })
    const isParty =
      reqRow.hostUserId === member.userId ||
      (reqRow.guestUserId && reqRow.guestUserId === member.userId)
    if (!isParty) return reply.status(403).send({ error: 'Forbidden' })
    if (reqRow.status !== 'ACCEPTED' && reqRow.status !== 'PENDING') {
      return reply.status(400).send({ error: 'Scene cannot be updated in this status' })
    }

    const nextStarts = parsed.data.startsAt ? new Date(parsed.data.startsAt) : reqRow.startsAt
    const nextEnds = parsed.data.endsAt ? new Date(parsed.data.endsAt) : reqRow.endsAt
    if (Number.isNaN(nextStarts.getTime()) || Number.isNaN(nextEnds.getTime())) {
      return reply.status(400).send({ error: 'Invalid time range' })
    }
    if (nextEnds.getTime() <= nextStarts.getTime()) {
      return reply.status(400).send({ error: 'End must be after start' })
    }

    const patch: Partial<typeof schema.playSpaceBookingRequests.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (parsed.data.description !== undefined) patch.description = parsed.data.description
    if (parsed.data.location !== undefined) {
      patch.location = parsed.data.location?.trim() || null
    }
    if (parsed.data.startsAt !== undefined) patch.startsAt = nextStarts
    if (parsed.data.endsAt !== undefined) patch.endsAt = nextEnds

    const [updated] = await db
      .update(schema.playSpaceBookingRequests)
      .set(patch)
      .where(eq(schema.playSpaceBookingRequests.id, id))
      .returning()

    const entryIds = [reqRow.hostEntryId, reqRow.guestEntryId].filter(
      (x): x is string => Boolean(x),
    )
    if (entryIds.length > 0) {
      const entryPatch: { notes?: string; location?: string | null; startsAt?: Date; endsAt?: Date } =
        {}
      if (parsed.data.description !== undefined) entryPatch.notes = parsed.data.description
      if (parsed.data.location !== undefined) {
        entryPatch.location = parsed.data.location?.trim() || null
      }
      if (parsed.data.startsAt !== undefined) entryPatch.startsAt = nextStarts
      if (parsed.data.endsAt !== undefined) entryPatch.endsAt = nextEnds
      if (Object.keys(entryPatch).length > 0) {
        await db
          .update(schema.playSpaceDancecardEntries)
          .set(entryPatch)
          .where(inArray(schema.playSpaceDancecardEntries.id, entryIds))
      }
    }

    const timesChanged =
      parsed.data.startsAt !== undefined || parsed.data.endsAt !== undefined
    if (timesChanged) {
      const other =
        reqRow.hostUserId === member.userId ? reqRow.guestUserId : reqRow.hostUserId
      await notifyPlaySpaceDancecard({
        userId: other,
        type: 'dancecard_reschedule_requested',
        playSpaceId: space.id,
        playSpaceSlug: space.slug,
        bookingRequestId: reqRow.id,
        actorUserId: member.userId,
      })
    }

    return reply.send({ request: updated })
  })

  /** Program slots */
  app.get('/api/v1/play-spaces/:key/program', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const userId = optionalUserId(req)
    const m = userId ? await membership(space.id, userId) : null
    if (space.visibility === 'private' && !m) {
      return reply.status(403).send({ error: 'Join required' })
    }
    const isOwner = m?.role === 'owner'
    const items = await db
      .select()
      .from(schema.playSpaceProgramSlots)
      .where(
        isOwner
          ? eq(schema.playSpaceProgramSlots.playSpaceId, space.id)
          : and(
              eq(schema.playSpaceProgramSlots.playSpaceId, space.id),
              eq(schema.playSpaceProgramSlots.published, true),
            ),
      )
      .orderBy(asc(schema.playSpaceProgramSlots.startsAt))

    const onPlan = new Map<string, string>()
    if (userId && items.length > 0) {
      const entries = await db
        .select({
          id: schema.playSpaceDancecardEntries.id,
          sourceId: schema.playSpaceDancecardEntries.sourceId,
        })
        .from(schema.playSpaceDancecardEntries)
        .where(
          and(
            eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
            eq(schema.playSpaceDancecardEntries.userId, userId),
            eq(schema.playSpaceDancecardEntries.sourceKind, 'slot_signup'),
          ),
        )
      for (const e of entries) {
        if (e.sourceId) onPlan.set(e.sourceId, e.id)
      }
    }

    return reply.send({
      items: items.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        location: s.location,
        published: s.published,
        isOnMyDancecard: onPlan.has(s.id),
        personalEntryId: onPlan.get(s.id) ?? null,
      })),
      canEdit: Boolean(isOwner),
    })
  })

  app.post('/api/v1/play-spaces/:key/program', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    if (space.ownerUserId !== actor.userId) return reply.status(403).send({ error: 'Owner only' })
    const parsed = programBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    if (!(endsAt > startsAt)) return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    const [row] = await db
      .insert(schema.playSpaceProgramSlots)
      .values({
        playSpaceId: space.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        startsAt,
        endsAt,
        location: parsed.data.location ?? null,
        published: parsed.data.published ?? true,
      })
      .returning()
    return reply.status(201).send({
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      location: row.location,
      published: row.published,
    })
  })

  app.delete('/api/v1/play-spaces/:key/program/:slotId', async (req, reply) => {
    const { key, slotId } = req.params as { key: string; slotId: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    if (space.ownerUserId !== actor.userId) return reply.status(403).send({ error: 'Owner only' })
    await db
      .delete(schema.playSpaceProgramSlots)
      .where(
        and(
          eq(schema.playSpaceProgramSlots.id, slotId),
          eq(schema.playSpaceProgramSlots.playSpaceId, space.id),
        ),
      )
    return reply.send({ ok: true })
  })

  /** Add program slot to my dancecard */
  app.post('/api/v1/play-spaces/:key/program/:slotId/add-to-dancecard', async (req, reply) => {
    const { key, slotId } = req.params as { key: string; slotId: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [slot] = await db
      .select()
      .from(schema.playSpaceProgramSlots)
      .where(
        and(
          eq(schema.playSpaceProgramSlots.id, slotId),
          eq(schema.playSpaceProgramSlots.playSpaceId, space.id),
          eq(schema.playSpaceProgramSlots.published, true),
        ),
      )
      .limit(1)
    if (!slot) return reply.status(404).send({ error: 'Slot not found' })
    const [existing] = await db
      .select({ id: schema.playSpaceDancecardEntries.id })
      .from(schema.playSpaceDancecardEntries)
      .where(
        and(
          eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
          eq(schema.playSpaceDancecardEntries.userId, member.userId),
          eq(schema.playSpaceDancecardEntries.sourceKind, 'slot_signup'),
          eq(schema.playSpaceDancecardEntries.sourceId, slot.id),
        ),
      )
      .limit(1)
    if (existing) {
      return reply.send({
        id: existing.id,
        title: slot.title,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        alreadyAdded: true,
      })
    }
    const [row] = await db
      .insert(schema.playSpaceDancecardEntries)
      .values({
        playSpaceId: space.id,
        userId: member.userId,
        title: slot.title,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        location: slot.location,
        notes: slot.description,
        sourceKind: 'slot_signup',
        sourceId: slot.id,
      })
      .returning()
    return reply.status(201).send({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      alreadyAdded: false,
    })
  })

  /** Remove a program session from my personal plan. */
  app.delete('/api/v1/play-spaces/:key/program/:slotId/add-to-dancecard', async (req, reply) => {
    const { key, slotId } = req.params as { key: string; slotId: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const deleted = await db
      .delete(schema.playSpaceDancecardEntries)
      .where(
        and(
          eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
          eq(schema.playSpaceDancecardEntries.userId, member.userId),
          eq(schema.playSpaceDancecardEntries.sourceKind, 'slot_signup'),
          eq(schema.playSpaceDancecardEntries.sourceId, slotId),
        ),
      )
      .returning({ id: schema.playSpaceDancecardEntries.id })
    if (deleted.length === 0) return reply.status(404).send({ error: 'Not on your plan' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/play-spaces/:key/maps', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const userId = optionalUserId(req)
    const m = userId ? await membership(space.id, userId) : null
    if (space.visibility === 'private' && !m) {
      return reply.status(403).send({ error: 'Join required' })
    }
    const rows = await db
      .select()
      .from(schema.playSpaceMaps)
      .where(eq(schema.playSpaceMaps.playSpaceId, space.id))
      .orderBy(asc(schema.playSpaceMaps.sortOrder))
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        label: r.label,
        imageUrl: r.imageUrl,
      })),
      canEdit: m?.role === 'owner',
    })
  })

  app.post('/api/v1/play-spaces/:key/maps/upload', async (req, reply) => {
    if (isAlphaUploadDisabled('convention_maps')) {
      return alphaUploadDisabledResponse(reply, 'convention_maps')
    }
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    if (space.ownerUserId !== actor.userId) return reply.status(403).send({ error: 'Owner only' })
    const client = getS3Client()
    if (!client) return reply.status(503).send({ error: 'File upload is not configured' })
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const ext = data.filename.includes('.') ? data.filename.slice(data.filename.lastIndexOf('.')) : ''
    const path = `play-spaces/${space.id}/maps/${randomUUID()}${ext}`
    const buffer = await data.toBuffer()
    try {
      await putObject(client, {
        Bucket: defaultBucket(),
        Key: path,
        Body: buffer,
        ContentType: data.mimetype || 'application/octet-stream',
      })
    } catch (e) {
      const err = e as { name?: string; message?: string }
      req.log?.error({ err }, 'play-spaces maps/upload PutObject failed')
      return reply.status(502).send({
        error: `Upload storage error (${err.name ?? 'Unknown'}): ${err.message ?? 'failed to write file'}`,
      })
    }
    const url = publicUrlForKey(path)
    if (!url) return reply.status(502).send({ error: 'Upload succeeded but public URL is not configured' })
    return reply.send({ path, url })
  })

  app.post('/api/v1/play-spaces/:key/maps', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    if (space.ownerUserId !== actor.userId) return reply.status(403).send({ error: 'Owner only' })
    const parsed = mapBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.playSpaceMaps)
      .values({
        playSpaceId: space.id,
        label: parsed.data.label,
        imageUrl: parsed.data.imageUrl,
      })
      .returning()
    return reply.status(201).send({ id: row.id, label: row.label, imageUrl: row.imageUrl })
  })

  app.delete('/api/v1/play-spaces/:key/maps/:mapId', async (req, reply) => {
    const { key, mapId } = req.params as { key: string; mapId: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const actor = await requireExistingDbUser(req, reply)
    if (!actor) return
    if (space.ownerUserId !== actor.userId) return reply.status(403).send({ error: 'Owner only' })
    await db
      .delete(schema.playSpaceMaps)
      .where(and(eq(schema.playSpaceMaps.id, mapId), eq(schema.playSpaceMaps.playSpaceId, space.id)))
    return reply.send({ ok: true })
  })

  /** Reschedule / edit a personal busy block (manual entries only). */
  app.patch('/api/v1/play-spaces/:key/dancecard/entries/:id', async (req, reply) => {
    const { key, id: rawId } = req.params as { key: string; id: string }
    const id = rawId.startsWith('dc:') ? rawId.slice(3) : rawId
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return

    const patchBody = z.object({
      title: z.string().trim().min(1).max(255).optional(),
      startsAt: z.string().min(1).optional(),
      endsAt: z.string().min(1).optional(),
      location: z.string().trim().max(512).optional().nullable(),
      notes: z.string().trim().max(2000).optional().nullable(),
    })
    const parsed = patchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (
      parsed.data.title === undefined &&
      parsed.data.startsAt === undefined &&
      parsed.data.endsAt === undefined &&
      parsed.data.location === undefined &&
      parsed.data.notes === undefined
    ) {
      return reply.status(400).send({ error: 'Nothing to update' })
    }

    const [existing] = await db
      .select()
      .from(schema.playSpaceDancecardEntries)
      .where(
        and(
          eq(schema.playSpaceDancecardEntries.id, id),
          eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (existing.userId !== member.userId) {
      return reply.status(403).send({ error: 'Not your dancecard entry' })
    }
    const sk = existing.sourceKind ?? 'manual'
    if (sk !== 'manual') {
      return reply.status(400).send({
        error:
          sk === 'scene_booking' ?
            'Reschedule scenes with Cancel / Reschedule on the booking, not this entry.'
          : 'Program items cannot be rescheduled here. Remove them from your dancecard instead.',
      })
    }

    const nextStarts = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existing.startsAt
    const nextEnds = parsed.data.endsAt ? new Date(parsed.data.endsAt) : existing.endsAt
    if (Number.isNaN(nextStarts.getTime()) || Number.isNaN(nextEnds.getTime())) {
      return reply.status(400).send({ error: 'Invalid time range' })
    }
    if (nextEnds.getTime() <= nextStarts.getTime()) {
      return reply.status(400).send({ error: 'End must be after start' })
    }

    const [row] = await db
      .update(schema.playSpaceDancecardEntries)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.startsAt !== undefined ? { startsAt: nextStarts } : {}),
        ...(parsed.data.endsAt !== undefined ? { endsAt: nextEnds } : {}),
        ...(parsed.data.location !== undefined ?
          { location: parsed.data.location?.trim() || null }
        : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() || null } : {}),
      })
      .where(eq(schema.playSpaceDancecardEntries.id, id))
      .returning()

    return reply.send({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      location: row.location,
      notes: row.notes,
      userId: row.userId,
    })
  })

  /** Alias matching convention DELETE .../dancecard/entries/:id (accepts raw UUID or dc:UUID). */
  app.delete('/api/v1/play-spaces/:key/dancecard/entries/:id', async (req, reply) => {
    const { key, id: rawId } = req.params as { key: string; id: string }
    const id = rawId.startsWith('dc:') ? rawId.slice(3) : rawId
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const [existing] = await db
      .select()
      .from(schema.playSpaceDancecardEntries)
      .where(
        and(
          eq(schema.playSpaceDancecardEntries.id, id),
          eq(schema.playSpaceDancecardEntries.playSpaceId, space.id),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (existing.userId !== member.userId && member.role !== 'owner') {
      return reply.status(403).send({ error: 'Not your dancecard entry' })
    }
    await db.delete(schema.playSpaceDancecardEntries).where(eq(schema.playSpaceDancecardEntries.id, id))
    return reply.send({ ok: true })
  })

  // Keep entry create for busy blocks (also on base routes); enhance with sourceKind default
  app.post('/api/v1/play-spaces/:key/dancecard/entries', async (req, reply) => {
    const { key } = req.params as { key: string }
    const space = await loadSpaceByKey(key)
    if (!space) return reply.status(404).send({ error: 'Play space not found' })
    const member = await requireMember(req, reply, space)
    if (!member) return
    const parsed = entryBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    if (!(endsAt > startsAt)) return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    const [row] = await db
      .insert(schema.playSpaceDancecardEntries)
      .values({
        playSpaceId: space.id,
        userId: member.userId,
        title: parsed.data.title,
        startsAt,
        endsAt,
        location: parsed.data.location ?? null,
        notes: parsed.data.notes ?? null,
        sourceKind: 'manual',
      })
      .returning()
    return reply.status(201).send({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      location: row.location,
      notes: row.notes,
      userId: row.userId,
    })
  })
}
