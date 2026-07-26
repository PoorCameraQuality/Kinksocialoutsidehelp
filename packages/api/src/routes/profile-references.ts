import { and, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { canViewerReadProfile } from '../lib/profile-access.js'
import {
  evaluateReferenceCountsTowardLevel,
  referrerMeetsEstablishedFloor,
} from '../lib/reference-trust.js'
import { rejectIfUserIdentityBanned } from '../lib/moderation-route-auth.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  return requireAuthenticatedDbUser(req, reply)
}

const categorySchema = z.enum(['character', 'play', 'community', 'technique', 'general'])

export async function registerProfileReferenceRoutes(app: FastifyInstance) {
  const offerBody = z.object({
    subjectUsername: z.string().min(1),
    note: z.string().max(500).optional(),
    category: categorySchema.optional().default('general'),
  })

  app.post('/api/v1/profile/references', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const parsed = offerBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [subject] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, parsed.data.subjectUsername.trim()))
      .limit(1)
    if (!subject) return reply.status(404).send({ error: 'User not found' })
    if (subject.id === user.userId) return reply.status(400).send({ error: 'Cannot reference yourself' })
    try {
      const [row] = await db
        .insert(schema.profileReferences)
        .values({
          referrerId: user.userId,
          subjectUserId: subject.id,
          note: parsed.data.note,
          category: parsed.data.category,
          status: 'PENDING',
        })
        .returning()
      return reply.send({ reference: row })
    } catch {
      return reply.status(409).send({ error: 'Reference already exists for this category' })
    }
  })

  app.get('/api/v1/profile/references/incoming', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select({
        id: schema.profileReferences.id,
        referrerId: schema.profileReferences.referrerId,
        subjectUserId: schema.profileReferences.subjectUserId,
        category: schema.profileReferences.category,
        note: schema.profileReferences.note,
        status: schema.profileReferences.status,
        createdAt: schema.profileReferences.createdAt,
        referrerUsername: schema.users.username,
      })
      .from(schema.profileReferences)
      .innerJoin(schema.users, eq(schema.profileReferences.referrerId, schema.users.id))
      .where(
        and(
          eq(schema.profileReferences.subjectUserId, user.userId),
          eq(schema.profileReferences.status, 'PENDING')
        )
      )
    return reply.send({ items: rows })
  })

  async function mutateRef(
    req: FastifyRequest,
    reply: FastifyReply,
    status: 'ACCEPTED' | 'DECLINED'
  ): Promise<FastifyReply> {
    if (!requireDb(reply)) return reply
    const user = requireUser(req, reply)
    if (!user) return reply
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return reply
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const [ref] = await db.select().from(schema.profileReferences).where(eq(schema.profileReferences.id, id)).limit(1)
    if (!ref || ref.subjectUserId !== user.userId) return reply.status(404).send({ error: 'Not found' })
    if (ref.status !== 'PENDING') return reply.status(400).send({ error: 'Already responded' })
    let referrerTrustAtAccept: number | undefined
    let countsTowardLevel = true
    let referrerAccountAgeDaysAtAccept: number | undefined
    let sameSignupCohort = false
    if (status === 'ACCEPTED') {
      const [[referrerUser], [subjectUser], existingCounted] = await Promise.all([
        db
          .select({
            createdAt: schema.users.createdAt,
            registrationIpPrefix: schema.users.registrationIpPrefix,
          })
          .from(schema.users)
          .where(eq(schema.users.id, ref.referrerId))
          .limit(1),
        db
          .select({ createdAt: schema.users.createdAt })
          .from(schema.users)
          .where(eq(schema.users.id, ref.subjectUserId))
          .limit(1),
        db
          .select({ ip: schema.users.registrationIpPrefix })
          .from(schema.profileReferences)
          .innerJoin(schema.users, eq(schema.profileReferences.referrerId, schema.users.id))
          .where(
            and(
              eq(schema.profileReferences.subjectUserId, ref.subjectUserId),
              eq(schema.profileReferences.status, 'ACCEPTED'),
              eq(schema.profileReferences.countsTowardLevel, true)
            )
          ),
      ])
      const [referrerProfile] = await db
        .select({ trustScore: schema.profiles.trustScore })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, ref.referrerId))
        .limit(1)
      referrerTrustAtAccept = referrerProfile?.trustScore ?? 0

      if (referrerUser && subjectUser) {
        const ipPrefixes = new Set(
          existingCounted.map((r) => r.ip?.trim()).filter((ip): ip is string => Boolean(ip))
        )
        const eligibility = evaluateReferenceCountsTowardLevel({
          referrerId: ref.referrerId,
          subjectUserId: ref.subjectUserId,
          referrerCreatedAt: referrerUser.createdAt,
          subjectCreatedAt: subjectUser.createdAt,
          referrerIpPrefix: referrerUser.registrationIpPrefix,
          subjectExistingCountedIpPrefixes: ipPrefixes,
        })
        sameSignupCohort = eligibility.sameSignupCohort
        referrerAccountAgeDaysAtAccept = eligibility.referrerAccountAgeDays
        countsTowardLevel =
          eligibility.countsTowardLevel && (await referrerMeetsEstablishedFloor(ref.referrerId))
      }
    }
    const [updated] = await db
      .update(schema.profileReferences)
      .set({
        status,
        respondedAt: new Date(),
        countsTowardLevel,
        sameSignupCohort,
        ...(referrerTrustAtAccept !== undefined ? { referrerTrustAtAccept } : {}),
        ...(referrerAccountAgeDaysAtAccept !== undefined
          ? { referrerAccountAgeDaysAtAccept }
          : {}),
      })
      .where(eq(schema.profileReferences.id, id))
      .returning()
    return reply.send({ reference: updated })
  }

  app.post('/api/v1/profile/references/:id/accept', async (req, reply) => mutateRef(req, reply, 'ACCEPTED'))

  app.post('/api/v1/profile/references/:id/decline', async (req, reply) => {
    if (!requireDb(reply)) return reply
    const user = requireUser(req, reply)
    if (!user) return reply
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return reply
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const [ref] = await db.select().from(schema.profileReferences).where(eq(schema.profileReferences.id, id)).limit(1)
    if (!ref || ref.subjectUserId !== user.userId) return reply.status(404).send({ error: 'Not found' })
    if (ref.status !== 'PENDING') return reply.status(400).send({ error: 'Already responded' })
    await db.delete(schema.profileReferences).where(eq(schema.profileReferences.id, id))
    return reply.send({ ok: true })
  })

  app.delete('/api/v1/profile/references/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (await rejectIfUserIdentityBanned(user.userId, reply)) return
    const { id } = req.params as { id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const [ref] = await db.select().from(schema.profileReferences).where(eq(schema.profileReferences.id, id)).limit(1)
    if (!ref || (ref.referrerId !== user.userId && ref.subjectUserId !== user.userId)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    await db.delete(schema.profileReferences).where(eq(schema.profileReferences.id, id))
    return reply.send({ ok: true })
  })

  app.get('/api/v1/users/:username/references', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    const [subj] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!subj) return reply.status(404).send({ error: 'Not found' })

    const [profile] = await db
      .select({ visibility: schema.profiles.visibility })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, subj.id))
      .limit(1)
    if (!profile) return reply.status(404).send({ error: 'Not found' })

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const isOwner = viewerId !== null && viewerId === subj.id
    if (!canViewerReadProfile(profile.visibility, { viewerId, isOwner })) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const rows = await db
      .select({
        id: schema.profileReferences.id,
        referrerUsername: schema.users.username,
        category: schema.profileReferences.category,
        note: schema.profileReferences.note,
        status: schema.profileReferences.status,
        countsTowardLevel: schema.profileReferences.countsTowardLevel,
        sameSignupCohort: schema.profileReferences.sameSignupCohort,
        createdAt: schema.profileReferences.createdAt,
      })
      .from(schema.profileReferences)
      .innerJoin(schema.users, eq(schema.profileReferences.referrerId, schema.users.id))
      .where(
        and(
          eq(schema.profileReferences.subjectUserId, subj.id),
          eq(schema.profileReferences.status, 'ACCEPTED')
        )
      )
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        referrerUsername: r.referrerUsername,
        category: r.category,
        note: r.note,
        countsTowardLevel: r.countsTowardLevel,
        sameSignupCohort: r.sameSignupCohort,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  })
}
