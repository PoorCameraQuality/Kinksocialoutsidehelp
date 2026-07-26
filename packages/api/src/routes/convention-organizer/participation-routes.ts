import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  isParticipationWindowOpen,
  participationFromConventionSettings,
  parseParticipationSettings,
} from '@c2k/shared'
import {
  acceptParticipationOffer,
  createParticipationOfferDraft,
  declineParticipationOffer,
  loadParticipationOpportunities,
  mapParticipationOffer,
  OfferBody,
  resolveOfferApplicant,
  sendParticipationOffer,
} from '../../lib/convention-participation-offers.js'
import { getViewerUserId } from '../../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../../auth/resolve-viewer.js'
import { createRegistrar, requireDb, requireOrganizer, requireUser, UUID_RE } from './shared.js'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'

const ParticipationSettingsBody = z.object({
  participation: z.record(z.string(), z.unknown()).optional(),
})

const VendorApplicationBody = z.object({
  productSummary: z.string().min(1).max(5000),
  boothPreferences: z.string().max(5000).optional(),
  powerNeeds: z.string().max(2000).optional(),
  hours: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
})

async function loadConventionByKey(key: string) {
  const [bySlug] = await db.select().from(schema.conventions).where(eq(schema.conventions.slug, key)).limit(1)
  if (bySlug) return bySlug
  if (UUID_RE.test(key)) {
    const [byId] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, key)).limit(1)
    return byId ?? null
  }
  return null
}

export function registerParticipationRoutes(app: FastifyInstance, registered: string[]) {
  const reg = createRegistrar(app, registered)

  reg('GET', '/api/v1/public/conventions/:key/participation-opportunities', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const userId = viewer.authenticated ? getViewerUserId(viewer.payload) : null

    const convRow = await loadConventionByKey(key)
    if (!convRow) return reply.status(404).send({ error: 'Not found' })

    const data = await loadParticipationOpportunities(
      convRow.id,
      convRow.slug,
      convRow.settings as Record<string, unknown> | null,
      userId,
    )
    return reply.send({
      convention: { id: convRow.id, slug: convRow.slug, name: convRow.name },
      ...data,
    })
  })

  reg('POST', '/api/v1/public/conventions/:key/vendor-applications', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = VendorApplicationBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [conv] = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.slug, key))
      .limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })

    const participation = participationFromConventionSettings(conv.settings as Record<string, unknown>)
    if (!isParticipationWindowOpen(participation.vendorApply)) {
      return reply.status(403).send({ error: 'Vendor applications are not open' })
    }

    const [vendorProfile] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, actor.userId))
      .limit(1)
    if (!vendorProfile) {
      return reply.status(400).send({ error: 'Complete vendor onboarding before applying' })
    }

    const [existing] = await db
      .select()
      .from(schema.conventionExhibitors)
      .where(
        and(
          eq(schema.conventionExhibitors.conventionId, conv.id),
          eq(schema.conventionExhibitors.applicantUserId, actor.userId),
        ),
      )
      .limit(1)
    if (existing && existing.applicationStatus !== 'rejected') {
      return reply.status(409).send({ error: 'Application already submitted' })
    }

    const [row] = await db
      .insert(schema.conventionExhibitors)
      .values({
        conventionId: conv.id,
        name: vendorProfile.displayName ?? 'Vendor application',
        vendorProfileId: vendorProfile.id,
        applicantUserId: actor.userId,
        applicationStatus: 'pending',
        isPublished: false,
        applicationPayload: parsed.data,
        url: parsed.data.url ?? null,
        hours: parsed.data.hours ?? null,
        description: parsed.data.productSummary,
      })
      .returning()

    return reply.status(201).send({
      application: {
        id: row!.id,
        applicationStatus: row!.applicationStatus,
        name: row!.name,
      },
    })
  })

  reg('GET', '/api/v1/conventions/:key/me/participation-offers', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }

    const [conv] = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.slug, key))
      .limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })

    const rows = await db
      .select()
      .from(schema.conventionParticipationOffers)
      .where(
        and(
          eq(schema.conventionParticipationOffers.conventionId, conv.id),
          eq(schema.conventionParticipationOffers.applicantUserId, actor.userId),
        ),
      )
      .orderBy(desc(schema.conventionParticipationOffers.updatedAt))

    return reply.send({ offers: rows.map(mapParticipationOffer) })
  })

  reg('POST', '/api/v1/conventions/:key/participation-offers/:offerId/accept', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, offerId } = req.params as { key: string; offerId: string }
    if (!UUID_RE.test(offerId)) return reply.status(400).send({ error: 'Invalid id' })

    const [conv] = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.slug, key))
      .limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })

    const result = await acceptParticipationOffer(offerId, conv.id, actor.userId, conv.slug)
    if ('error' in result) {
      const status = result.error === 'expired' ? 410 : result.error === 'not_found' ? 404 : 400
      return reply.status(status).send({ error: result.error })
    }
    return reply.send(result)
  })

  reg('POST', '/api/v1/conventions/:key/participation-offers/:offerId/decline', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, offerId } = req.params as { key: string; offerId: string }
    if (!UUID_RE.test(offerId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ reason: z.string().max(2000).optional() }).safeParse(req.body ?? {})

    const [conv] = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.slug, key))
      .limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })

    const result = await declineParticipationOffer(
      offerId,
      conv.id,
      actor.userId,
      parsed.success ? parsed.data.reason : undefined,
    )
    if ('error' in result) {
      return reply.status(result.error === 'not_found' ? 404 : 400).send({ error: result.error })
    }
    return reply.send(result)
  })

  reg('GET', '/api/v1/conventions/:key/participation-offers', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const q = req.query as { status?: string; sourceType?: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, ['registration', 'scheduler', 'staff_ops'])
    if (!ctx) return

    const rows = await db
      .select()
      .from(schema.conventionParticipationOffers)
      .where(eq(schema.conventionParticipationOffers.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionParticipationOffers.updatedAt))

    let filtered = rows
    if (q.status) filtered = filtered.filter((r) => r.status === q.status)
    if (q.sourceType) filtered = filtered.filter((r) => r.sourceType === q.sourceType)
    return reply.send({ offers: filtered.map(mapParticipationOffer) })
  })

  reg('POST', '/api/v1/conventions/:key/participation-offers', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = OfferBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const perm =
      parsed.data.sourceType === 'presenter_request' ? 'scheduler' : (
        parsed.data.sourceType === 'vendor_application' ? 'staff_ops' : 'registration'
      )
    const ctx = await requireOrganizer(key, actor.userId, reply, perm)
    if (!ctx) return

    const [profile] = await db
      .select({ displayName: schema.profiles.displayName, username: schema.users.username })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.id, actor.userId))
      .limit(1)

    const applicant = await resolveOfferApplicant(
      parsed.data.sourceType,
      parsed.data.sourceId,
      ctx.conv.id,
    )
    if (!applicant) return reply.status(404).send({ error: 'Application not found' })

    const [applicantProfile] = await db
      .select({ displayName: schema.profiles.displayName, username: schema.users.username })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.users.id, applicant.applicantUserId))
      .limit(1)

    const result = await createParticipationOfferDraft({
      conventionId: ctx.conv.id,
      createdByUserId: actor.userId,
      body: parsed.data,
      conventionName: ctx.conv.name,
      applicantName:
        applicantProfile?.displayName ?? applicantProfile?.username ?? 'Applicant',
      settings: ctx.conv.settings as Record<string, unknown>,
    })
    if ('error' in result) return reply.status(404).send({ error: result.error })
    return reply.status(201).send(result)
  })

  reg('PATCH', '/api/v1/conventions/:key/participation-offers/:offerId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, offerId } = req.params as { key: string; offerId: string }
    if (!UUID_RE.test(offerId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = OfferBody.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const ctx = await requireOrganizer(key, actor.userId, reply, ['registration', 'scheduler', 'staff_ops'])
    if (!ctx) return

    const patch: Partial<typeof schema.conventionParticipationOffers.$inferInsert> = {
      updatedAt: new Date(),
    }
    const d = parsed.data
    if (d.letterHtml !== undefined) patch.letterHtml = d.letterHtml
    if (d.letterText !== undefined) patch.letterText = d.letterText
    if (d.registrationCategoryId !== undefined) patch.registrationCategoryId = d.registrationCategoryId
    if (d.accessCode !== undefined) patch.accessCode = d.accessCode
    if (d.boothLabel !== undefined) patch.boothLabel = d.boothLabel
    if (d.feeCents !== undefined) patch.feeCents = d.feeCents
    if (d.feeInstructions !== undefined) patch.feeInstructions = d.feeInstructions
    if (d.expectedHours !== undefined) patch.expectedHours = d.expectedHours
    if (d.grantsStaffAccess !== undefined) patch.grantsStaffAccess = d.grantsStaffAccess
    if (d.approvedOfferingIds !== undefined) patch.approvedOfferingIds = d.approvedOfferingIds
    if (d.expiresAt !== undefined) patch.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null
    if (d.payload !== undefined) patch.payload = d.payload

    const [row] = await db
      .update(schema.conventionParticipationOffers)
      .set(patch)
      .where(
        and(
          eq(schema.conventionParticipationOffers.id, offerId),
          eq(schema.conventionParticipationOffers.conventionId, ctx.conv.id),
          eq(schema.conventionParticipationOffers.status, 'draft'),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found or not editable' })
    return reply.send({ offer: mapParticipationOffer(row) })
  })

  reg('POST', '/api/v1/conventions/:key/participation-offers/:offerId/send', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, offerId } = req.params as { key: string; offerId: string }
    if (!UUID_RE.test(offerId)) return reply.status(400).send({ error: 'Invalid id' })

    const ctx = await requireOrganizer(key, actor.userId, reply, ['registration', 'scheduler', 'staff_ops'])
    if (!ctx) return

    const result = await sendParticipationOffer(offerId, ctx.conv.id)
    if ('error' in result) {
      return reply.status(result.error === 'not_found' ? 404 : 400).send({ error: result.error })
    }
    return reply.send(result)
  })

  reg('GET', '/api/v1/conventions/:key/participation-settings', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    return reply.send({
      participation: participationFromConventionSettings(ctx.conv.settings as Record<string, unknown>),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/participation-settings', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = ParticipationSettingsBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return

    const prev = (ctx.conv.settings ?? {}) as Record<string, unknown>
    const participation = parseParticipationSettings({
      ...(typeof prev.participation === 'object' && prev.participation ? prev.participation : {}),
      ...(parsed.data.participation ?? {}),
    })

    const [updated] = await db
      .update(schema.conventions)
      .set({
        settings: { ...prev, participation },
      })
      .where(eq(schema.conventions.id, ctx.conv.id))
      .returning()

    return reply.send({
      participation: participationFromConventionSettings(updated!.settings as Record<string, unknown>),
    })
  })
}
