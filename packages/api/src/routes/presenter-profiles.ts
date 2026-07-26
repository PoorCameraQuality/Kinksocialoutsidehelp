import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { recalculatePresenterRating } from '../lib/presenter-reputation.js'
import { loadFeaturedOfferingTitles, loadPublishedArticleCounts } from '../lib/presenter-list-enrich.js'
import { parsePresenterListSort, presenterListOrderBy } from '../lib/presenter-list-sort.js'
import { loadPresenterScheduleCredits } from '../lib/presenter-schedule-credits.js'
import { loadPresenterTeachingCredits } from '../lib/presenter-teaching-credits.js'
import { userAttendedEvent, userStaffCheckedInForEvent } from '../lib/attendance-gate.js'
import { accountAgeDays } from '../lib/reputation-anti-gaming.js'
import {
  formatPronounDisplay,
  REVIEW_MIN_ACCOUNT_AGE_DAYS,
  validatePresenterExternalUrl,
  visibleProfileIdentityFields,
} from '@c2k/shared'
import {
  canSeePresenterOrganizerFields,
  offeringForViewer,
  presenterProfileForViewer,
} from '../lib/presenter-profile-public.js'
import { viewerCanSeeActivityHistory } from '../lib/activity-history-visibility.js'
import { loadWritingPreviewForUser } from './education-articles-routes.js'
import { canAccessPresenterRunnerMaterials } from '../lib/presenter-runner-access.js'
import { loadAcceptedFriendUserIds } from '../lib/accepted-friends.js'
import { enrichProfileIdentityRead } from './profile.js'
import {
  loadPresenterFocusFields,
  loadPresenterFocusFieldsMap,
  PRESENTER_PROFILE_FOCUS_VALUES,
  savePresenterFocusFields,
  type PresenterProfileFocus,
} from '../lib/presenter-profile-focuses.js'
import { derivePresenterBadges, loadPresenterBadgeCounts } from '../lib/presenter-badges.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ORG_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
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

function optionalViewerId(req: FastifyRequest): string | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) return null
  return getViewerUserId(v.payload)
}

const profileKindSchema = z.enum(['PRES', 'AUTHOR', 'BOTH', 'PHOTO'])
const directoryVisibilitySchema = z.enum(['PUBLIC', 'UNLISTED'])
const profileFocusSchema = z.enum(PRESENTER_PROFILE_FOCUS_VALUES)

const patchPresenterBody = z.object({
  headline: z.string().max(255).optional().nullable(),
  bioShort: z.string().max(2000).optional().nullable(),
  bio: z.string().max(8000).optional().nullable(),
  links: z.record(z.string(), z.string()).optional(),
  profileKind: profileKindSchema.optional(),
  expertiseTags: z.array(z.string().max(64)).max(40).optional().nullable(),
  directoryVisibility: directoryVisibilitySchema.optional(),
  eckePublish: z.boolean().optional(),
  backgroundStory: z.string().max(16000).optional().nullable(),
  mentorshipOffered: z.boolean().optional(),
  mentorshipNotes: z.string().max(4000).optional().nullable(),
  profileFocuses: z.array(profileFocusSchema).max(9).optional(),
  primaryProfileFocus: profileFocusSchema.optional().nullable(),
})

const runnerMaterialItem = z.object({
  label: z.string().min(1).max(200),
  url: z.string().min(1).max(2000),
})

const offeringBody = z.object({
  title: z.string().min(1).max(512),
  tease: z.string().max(4000).optional().nullable(),
  outline: z.string().max(16000).optional().nullable(),
  durationMinutes: z.number().int().positive().max(24 * 60).optional().nullable(),
  level: z.string().max(64).optional().nullable(),
  format: z.string().max(64).optional().nullable(),
  tags: z.array(z.string().max(64)).max(30).optional().nullable(),
  runnerMaterials: z.array(runnerMaterialItem).max(20).optional().nullable(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

const patchOfferingBody = offeringBody.partial()

const galleryImageBody = z.object({
  imageUrl: z.string().min(1).max(4000),
  caption: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
})

const teachingCreditBody = z.object({
  title: z.string().min(1).max(512),
  eventName: z.string().min(1).max(512),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  detailUrl: z.string().max(2000).optional().nullable(),
})

const patchTeachingCreditBody = teachingCreditBody.partial()

const skillClaimBody = z.object({
  skillLabel: z.string().min(1).max(128),
  yearsActive: z.number().int().min(0).max(80).optional().nullable(),
  frequency: z.enum(['rarely', 'monthly', 'weekly', 'daily', 'professional']).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
})

const patchSkillClaimBody = skillClaimBody.partial()

const postReviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(8000).optional().nullable(),
  sourceKind: z.enum(['ATTENDEE', 'ORGANIZATION']),
  eventId: z.string().uuid(),
  organizationId: z.string().uuid().optional().nullable(),
  scheduleSlotId: z.string().uuid().optional().nullable(),
})

async function loadUserByUsernameOrId(key: string) {
  if (UUID_RE.test(key)) {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, key)).limit(1)
    return u ?? null
  }
  const [u] = await db.select().from(schema.users).where(ilike(schema.users.username, key)).limit(1)
  return u ?? null
}

async function orgStaffRank(organizationId: string, userId: string): Promise<number> {
  const [m] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  return m ? ORG_ROLE_RANK[m.role] ?? 0 : 0
}

async function assertOrgRanEvent(organizationId: string, eventId: string): Promise<boolean> {
  const [ev] = await db
    .select({ organizationId: schema.events.organizationId })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  if (ev?.organizationId === organizationId) return true
  const [conv] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(
      and(eq(schema.conventions.anchorEventId, eventId), eq(schema.conventions.organizationId, organizationId))
    )
    .limit(1)
  return Boolean(conv)
}

async function assertPresenterScheduledAtEvent(presenterUserId: string, eventId: string): Promise<boolean> {
  const slotRows = await db
    .select({ id: schema.scheduleSlots.id })
    .from(schema.scheduleSlots)
    .innerJoin(schema.conventions, eq(schema.scheduleSlots.conventionId, schema.conventions.id))
    .where(eq(schema.conventions.anchorEventId, eventId))
  const slotIds = slotRows.map((r) => r.id)
  if (slotIds.length === 0) return false
  const [sp] = await db
    .select()
    .from(schema.scheduleSlotPresenters)
    .where(
      and(
        eq(schema.scheduleSlotPresenters.userId, presenterUserId),
        inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds)
      )
    )
    .limit(1)
  return Boolean(sp)
}

function offeringJson(
  row: typeof schema.presenterOfferings.$inferSelect,
  includeRunnerMaterials: boolean
): Record<string, unknown> {
  return offeringForViewer(row, includeRunnerMaterials)
}

function parseRunnerMaterials(
  materials: { label: string; url: string }[] | null | undefined
): { ok: true; items: { label: string; url: string }[] } | { ok: false; error: string } {
  const out: { label: string; url: string }[] = []
  for (const item of materials ?? []) {
    const label = item.label?.trim()
    if (!label) return { ok: false, error: 'Runner material label is required' }
    const validated = validatePresenterExternalUrl(item.url)
    if (!validated.ok) return { ok: false, error: validated.error }
    out.push({ label, url: validated.href })
  }
  return { ok: true, items: out }
}

type PresenterSessionRow = {
  slotId: string
  startsAt: Date
  endsAt: Date
  title: string
  description: string | null
  location: string | null
  conventionSlug: string
  conventionName: string
  anchorEventId: string | null
}

async function slotsForPresenterUser(
  presenterUserId: string,
  limit: number,
  viewerId: string | null
): Promise<PresenterSessionRow[]> {
  const fetchCap = Math.min(200, limit * 8)
  const rows = await db
    .select({
      slotId: schema.scheduleSlots.id,
      startsAt: schema.scheduleSlots.startsAt,
      endsAt: schema.scheduleSlots.endsAt,
      title: schema.scheduleSlots.title,
      description: schema.scheduleSlots.description,
      location: schema.scheduleSlots.location,
      conventionSlug: schema.conventions.slug,
      conventionName: schema.conventions.name,
      anchorEventId: schema.conventions.anchorEventId,
      conventionId: schema.conventions.id,
    })
    .from(schema.scheduleSlotPresenters)
    .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlotPresenters.scheduleSlotId, schema.scheduleSlots.id))
    .innerJoin(schema.conventions, eq(schema.scheduleSlots.conventionId, schema.conventions.id))
    .where(eq(schema.scheduleSlotPresenters.userId, presenterUserId))
    .orderBy(desc(schema.scheduleSlots.startsAt))
    .limit(fetchCap)

  if (viewerId === presenterUserId) {
    return rows.slice(0, limit).map(({ conventionId: _c, ...rest }) => rest)
  }

  const conIds = [...new Set(rows.map((r) => r.conventionId))]
  if (conIds.length === 0) return []

  const publicCons = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(
      and(
        inArray(schema.conventions.id, conIds),
        sql`(${schema.conventions.settings}::jsonb->>'publicProgramListing') is distinct from 'false'`
      )
    )
  const publicIds = new Set(publicCons.map((r) => r.id))

  const grantRows =
    viewerId ?
      await db
        .select({ conventionId: schema.conventionAccessGrants.conventionId })
        .from(schema.conventionAccessGrants)
        .where(
          and(
            eq(schema.conventionAccessGrants.userId, viewerId),
            inArray(schema.conventionAccessGrants.conventionId, conIds),
            or(
              and(
                eq(schema.conventionAccessGrants.paidConfirmed, true),
                eq(schema.conventionAccessGrants.attendingConfirmed, true)
              ),
              eq(schema.conventionAccessGrants.role, 'STAFF'),
              eq(schema.conventionAccessGrants.role, 'MODERATOR'),
              eq(schema.conventionAccessGrants.staffPreAccess, true)
            )
          )
        )
    : []
  const grantIds = new Set(grantRows.map((r) => r.conventionId))

  const conOrgRows = await db
    .select({ convId: schema.conventions.id, orgId: schema.conventions.organizationId })
    .from(schema.conventions)
    .where(inArray(schema.conventions.id, conIds))
  const orgByConv = new Map(conOrgRows.map((r) => [r.convId, r.orgId]))
  const orgIds = [...new Set(conOrgRows.map((r) => r.orgId).filter((x): x is string => Boolean(x)))]
  const orgModSet = new Set<string>()
  if (viewerId && orgIds.length > 0) {
    const mods = await db
      .select({ organizationId: schema.organizationMembers.organizationId })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.userId, viewerId),
          inArray(schema.organizationMembers.organizationId, orgIds),
          or(
            eq(schema.organizationMembers.role, 'OWNER'),
            eq(schema.organizationMembers.role, 'ADMIN'),
            eq(schema.organizationMembers.role, 'MODERATOR')
          )
        )
      )
    for (const m of mods) orgModSet.add(m.organizationId)
  }

  const canSeeConvention = (convId: string) => {
    if (publicIds.has(convId)) return true
    if (grantIds.has(convId)) return true
    const oid = orgByConv.get(convId)
    return Boolean(oid && orgModSet.has(oid))
  }

  const filtered: PresenterSessionRow[] = []
  for (const r of rows) {
    if (!canSeeConvention(r.conventionId)) continue
    const { conventionId: _drop, ...rest } = r
    filtered.push(rest)
    if (filtered.length >= limit) break
  }
  return filtered
}

export async function registerPresenterProfileRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/presenter-profile', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const [presenter] = await db
      .select()
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, user.userId))
      .limit(1)
    const upcomingScheduleCredits = await loadPresenterScheduleCredits(user.userId, 60, {
      upcomingOnly: true,
    })
    const focusFields =
      presenter ? await loadPresenterFocusFields(user.userId) : { profileFocuses: [], primaryProfileFocus: null }
    return reply.send({ presenter: presenter ?? null, upcomingScheduleCredits, ...focusFields })
  })

  app.put('/api/v1/me/presenter-profile', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = patchPresenterBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, user.userId))
      .limit(1)
    const values = {
      headline: parsed.data.headline ?? null,
      bioShort: parsed.data.bioShort ?? null,
      bio: parsed.data.bio ?? null,
      links: parsed.data.links ?? {},
      profileKind: parsed.data.profileKind ?? 'PRES',
      expertiseTags: parsed.data.expertiseTags ?? null,
      directoryVisibility: parsed.data.directoryVisibility ?? 'UNLISTED',
      updatedAt: new Date(),
    } as const
    if (existing) {
      const [row] = await db
        .update(schema.presenterProfiles)
        .set(values)
        .where(eq(schema.presenterProfiles.userId, user.userId))
        .returning()
      return reply.send({ presenter: row })
    }
    const [row] = await db
      .insert(schema.presenterProfiles)
      .values({ userId: user.userId, ...values })
      .returning()
    return reply.send({ presenter: row })
  })

  app.get('/api/v1/presenters/me/offerings', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.presenterOfferings)
      .where(eq(schema.presenterOfferings.userId, user.userId))
      .orderBy(asc(schema.presenterOfferings.sortOrder), desc(schema.presenterOfferings.createdAt))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/presenters/me/offerings', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = offeringBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const runnerParsed = parseRunnerMaterials(parsed.data.runnerMaterials ?? [])
    if (!runnerParsed.ok) return reply.status(400).send({ error: runnerParsed.error })
    const [row] = await db
      .insert(schema.presenterOfferings)
      .values({
        userId: user.userId,
        title: parsed.data.title,
        tease: parsed.data.tease ?? undefined,
        outline: parsed.data.outline ?? undefined,
        durationMinutes: parsed.data.durationMinutes ?? undefined,
        level: parsed.data.level ?? undefined,
        format: parsed.data.format ?? undefined,
        tags: parsed.data.tags ?? undefined,
        runnerMaterials: runnerParsed.items,
        isPublic: parsed.data.isPublic ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ offering: row })
  })

  app.patch('/api/v1/presenters/me/offerings/:offeringId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { offeringId } = req.params as { offeringId: string }
    if (!UUID_RE.test(offeringId)) return reply.status(400).send({ error: 'Invalid offering id' })
    const parsed = patchOfferingBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.presenterOfferings)
      .where(and(eq(schema.presenterOfferings.id, offeringId), eq(schema.presenterOfferings.userId, user.userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const next: Record<string, unknown> = { updatedAt: new Date() }
    const d = parsed.data
    if (d.title !== undefined) next.title = d.title
    if (d.tease !== undefined) next.tease = d.tease
    if (d.outline !== undefined) next.outline = d.outline
    if (d.durationMinutes !== undefined) next.durationMinutes = d.durationMinutes
    if (d.level !== undefined) next.level = d.level
    if (d.format !== undefined) next.format = d.format
    if (d.tags !== undefined) next.tags = d.tags
    if (d.runnerMaterials !== undefined) {
      const runnerParsed = parseRunnerMaterials(d.runnerMaterials ?? [])
      if (!runnerParsed.ok) return reply.status(400).send({ error: runnerParsed.error })
      next.runnerMaterials = runnerParsed.items
    }
    if (d.isPublic !== undefined) next.isPublic = d.isPublic
    if (d.sortOrder !== undefined) next.sortOrder = d.sortOrder
    const [row] = await db
      .update(schema.presenterOfferings)
      .set(next as typeof schema.presenterOfferings.$inferInsert)
      .where(eq(schema.presenterOfferings.id, offeringId))
      .returning()
    return reply.send({ offering: row })
  })

  app.delete('/api/v1/presenters/me/offerings/:offeringId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { offeringId } = req.params as { offeringId: string }
    if (!UUID_RE.test(offeringId)) return reply.status(400).send({ error: 'Invalid offering id' })
    const res = await db
      .delete(schema.presenterOfferings)
      .where(and(eq(schema.presenterOfferings.id, offeringId), eq(schema.presenterOfferings.userId, user.userId)))
      .returning()
    if (res.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/presenters/me/gallery', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.presenterGalleryImages)
      .where(eq(schema.presenterGalleryImages.userId, user.userId))
      .orderBy(asc(schema.presenterGalleryImages.sortOrder), desc(schema.presenterGalleryImages.createdAt))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/presenters/me/gallery', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = galleryImageBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const validatedUrl = validatePresenterExternalUrl(parsed.data.imageUrl)
    if (!validatedUrl.ok) return reply.status(400).send({ error: validatedUrl.error })
    const [row] = await db
      .insert(schema.presenterGalleryImages)
      .values({
        userId: user.userId,
        imageUrl: validatedUrl.href,
        caption: parsed.data.caption?.trim() || null,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ image: row })
  })

  app.delete('/api/v1/presenters/me/gallery/:imageId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { imageId } = req.params as { imageId: string }
    if (!UUID_RE.test(imageId)) return reply.status(400).send({ error: 'Invalid id' })
    const res = await db
      .delete(schema.presenterGalleryImages)
      .where(
        and(eq(schema.presenterGalleryImages.id, imageId), eq(schema.presenterGalleryImages.userId, user.userId))
      )
      .returning()
    if (res.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/presenters/me/teaching-credits', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await loadPresenterTeachingCredits(user.userId)
    return reply.send({ items: rows })
  })

  app.post('/api/v1/presenters/me/teaching-credits', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = teachingCreditBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.presenterTeachingCredits)
      .values({
        presenterUserId: user.userId,
        title: parsed.data.title.trim(),
        eventName: parsed.data.eventName.trim(),
        eventDate: parsed.data.eventDate ?? undefined,
        detailUrl: parsed.data.detailUrl?.trim() || null,
        verified: false,
        scheduleSlotId: null,
      })
      .returning()
    return reply.send({ credit: row })
  })

  app.patch('/api/v1/presenters/me/teaching-credits/:creditId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { creditId } = req.params as { creditId: string }
    if (!UUID_RE.test(creditId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = patchTeachingCreditBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.presenterTeachingCredits)
      .where(
        and(
          eq(schema.presenterTeachingCredits.id, creditId),
          eq(schema.presenterTeachingCredits.presenterUserId, user.userId)
        )
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (existing.scheduleSlotId) {
      return reply.status(403).send({ error: 'System-linked credits cannot be edited here' })
    }
    const next: Record<string, unknown> = {}
    const d = parsed.data
    if (d.title !== undefined) next.title = d.title.trim()
    if (d.eventName !== undefined) next.eventName = d.eventName.trim()
    if (d.eventDate !== undefined) next.eventDate = d.eventDate
    if (d.detailUrl !== undefined) next.detailUrl = d.detailUrl?.trim() || null
    if (Object.keys(next).length === 0) return reply.status(400).send({ error: 'No changes' })
    const [row] = await db
      .update(schema.presenterTeachingCredits)
      .set(next as typeof schema.presenterTeachingCredits.$inferInsert)
      .where(eq(schema.presenterTeachingCredits.id, creditId))
      .returning()
    return reply.send({ credit: row })
  })

  app.delete('/api/v1/presenters/me/teaching-credits/:creditId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { creditId } = req.params as { creditId: string }
    if (!UUID_RE.test(creditId)) return reply.status(400).send({ error: 'Invalid id' })
    const [existing] = await db
      .select()
      .from(schema.presenterTeachingCredits)
      .where(
        and(
          eq(schema.presenterTeachingCredits.id, creditId),
          eq(schema.presenterTeachingCredits.presenterUserId, user.userId)
        )
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (existing.scheduleSlotId) {
      return reply.status(403).send({ error: 'System-linked credits cannot be deleted here' })
    }
    await db.delete(schema.presenterTeachingCredits).where(eq(schema.presenterTeachingCredits.id, creditId))
    return reply.send({ ok: true })
  })

  app.get('/api/v1/presenters/me/skill-claims', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.presenterSkillClaims)
      .where(eq(schema.presenterSkillClaims.userId, user.userId))
      .orderBy(asc(schema.presenterSkillClaims.sortOrder), asc(schema.presenterSkillClaims.id))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/presenters/me/skill-claims', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = skillClaimBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const existing = await db
      .select({ id: schema.presenterSkillClaims.id })
      .from(schema.presenterSkillClaims)
      .where(eq(schema.presenterSkillClaims.userId, user.userId))
    const sortOrder = parsed.data.sortOrder ?? existing.length
    const [row] = await db
      .insert(schema.presenterSkillClaims)
      .values({
        userId: user.userId,
        skillLabel: parsed.data.skillLabel.trim(),
        yearsActive: parsed.data.yearsActive ?? null,
        frequency: parsed.data.frequency ?? null,
        note: parsed.data.note ?? null,
        sortOrder,
      })
      .returning()
    return reply.send({ claim: row })
  })

  app.patch('/api/v1/presenters/me/skill-claims/:claimId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { claimId } = req.params as { claimId: string }
    if (!UUID_RE.test(claimId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = patchSkillClaimBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.presenterSkillClaims)
      .where(
        and(eq(schema.presenterSkillClaims.id, claimId), eq(schema.presenterSkillClaims.userId, user.userId))
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const d = parsed.data
    const next: Record<string, unknown> = {}
    if (d.skillLabel !== undefined) next.skillLabel = d.skillLabel.trim()
    if (d.yearsActive !== undefined) next.yearsActive = d.yearsActive
    if (d.frequency !== undefined) next.frequency = d.frequency
    if (d.note !== undefined) next.note = d.note
    if (d.sortOrder !== undefined) next.sortOrder = d.sortOrder
    if (Object.keys(next).length === 0) return reply.status(400).send({ error: 'No changes' })
    const [row] = await db
      .update(schema.presenterSkillClaims)
      .set(next as typeof schema.presenterSkillClaims.$inferInsert)
      .where(eq(schema.presenterSkillClaims.id, claimId))
      .returning()
    return reply.send({ claim: row })
  })

  app.delete('/api/v1/presenters/me/skill-claims/:claimId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { claimId } = req.params as { claimId: string }
    if (!UUID_RE.test(claimId)) return reply.status(400).send({ error: 'Invalid id' })
    const res = await db
      .delete(schema.presenterSkillClaims)
      .where(
        and(eq(schema.presenterSkillClaims.id, claimId), eq(schema.presenterSkillClaims.userId, user.userId))
      )
      .returning()
    if (res.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/presenters', async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as { q?: string; tag?: string; focus?: string; limit?: string; offset?: string; sort?: string }
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '24', 10) || 24))
    const offset = Math.max(0, parseInt(q.offset ?? '0', 10) || 0)
    const sort = parsePresenterListSort(q.sort)
    const search = (q.q ?? '').trim()
    const tag = (q.tag ?? '').trim().toLowerCase()
    const focusRaw = (q.focus ?? '').trim().toUpperCase()
    const focusFilter = profileFocusSchema.safeParse(focusRaw).success ?
      (focusRaw as PresenterProfileFocus)
    : null
    const pattern = search ? `%${search.replace(/%/g, '')}%` : ''

    const searchClause =
      search ?
        or(
          ilike(schema.users.username, pattern),
          ilike(schema.profiles.displayName, pattern),
          ilike(schema.presenterProfiles.headline, pattern),
          ilike(schema.presenterProfiles.bioShort, pattern),
          ilike(schema.presenterProfiles.bio, pattern)
        )!
      : sql`true`

    const tagClause =
      tag ?
        sql`exists (
          select 1 from unnest(coalesce(${schema.presenterProfiles.expertiseTags}, array[]::text[])) as t(x)
          where lower(x) = ${tag}
        )`
      : sql`true`

    const focusClause =
      focusFilter ?
        sql`exists (
          select 1 from presenter_profile_focuses pf
          where pf.user_id = ${schema.presenterProfiles.userId}
            and pf.focus = ${focusFilter}::presenter_profile_focus
        )`
      : sql`true`

    const rows = await db
      .select({
        userId: schema.presenterProfiles.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        headline: schema.presenterProfiles.headline,
        bioShort: schema.presenterProfiles.bioShort,
        profileKind: schema.presenterProfiles.profileKind,
        expertiseTags: schema.presenterProfiles.expertiseTags,
        ratingAvg: schema.presenterProfiles.ratingAvg,
        reviewCount: schema.presenterProfiles.reviewCount,
      })
      .from(schema.presenterProfiles)
      .innerJoin(schema.users, eq(schema.presenterProfiles.userId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        and(
          eq(schema.presenterProfiles.directoryVisibility, 'PUBLIC'),
          searchClause,
          tagClause,
          focusClause
        )
      )
      .orderBy(...presenterListOrderBy(sort))
      .limit(limit)
      .offset(offset)

    if (rows.length === 0) return reply.send({ items: [], limit, offset })

    const userIds = rows.map((r) => r.userId)
    const [offeringTitles, articleCounts, focusMap, badgeCounts] = await Promise.all([
      loadFeaturedOfferingTitles(userIds),
      loadPublishedArticleCounts(userIds),
      loadPresenterFocusFieldsMap(userIds),
      loadPresenterBadgeCounts(userIds),
    ])

    return reply.send({
      items: rows.map((row) => {
        const counts = badgeCounts.get(row.userId)
        const badges =
          counts ? derivePresenterBadges(counts, row.profileKind) : []
        return {
          ...row,
          featuredOfferingTitle: offeringTitles.get(row.userId) ?? null,
          publishedArticleCount: articleCounts.get(row.userId) ?? 0,
          verifiedTeachingCredits: counts?.verifiedTeachingCredits ?? 0,
          badges,
          ...focusMap.get(row.userId) ?? { profileFocuses: [], primaryProfileFocus: null },
        }
      }),
      limit,
      offset,
    })
  })

  app.get('/api/v1/presenters/by-user/:userId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { userId } = req.params as { userId: string }
    if (!UUID_RE.test(userId)) return reply.status(400).send({ error: 'Invalid user id' })
    const [prof] = await db
      .select()
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, userId))
      .limit(1)
    const [u] = await db.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, userId)).limit(1)
    const [p] = await db
      .select({ displayName: schema.profiles.displayName, avatarUrl: schema.profiles.avatarUrl })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1)
    if (!prof && !u) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      userId,
      username: u?.username,
      displayName: p?.displayName ?? null,
      avatarUrl: p?.avatarUrl ?? null,
      presenter: prof ?? null,
    })
  })

  app.get('/api/v1/presenters/:userId/reviews', async (req, reply) => {
    if (!requireDb(reply)) return
    const { userId } = req.params as { userId: string }
    if (!UUID_RE.test(userId)) return reply.status(400).send({ error: 'Invalid user id' })
    const q = req.query as { limit?: string; offset?: string }
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10) || 20))
    const offset = Math.max(0, parseInt(q.offset ?? '0', 10) || 0)
    const rows = await db
      .select({
        id: schema.presenterReviews.id,
        rating: schema.presenterReviews.rating,
        body: schema.presenterReviews.body,
        sourceKind: schema.presenterReviews.sourceKind,
        createdAt: schema.presenterReviews.createdAt,
        eventId: schema.presenterReviews.eventId,
        authorId: schema.presenterReviews.authorId,
        authorUsername: schema.users.username,
        authorDisplayName: schema.profiles.displayName,
      })
      .from(schema.presenterReviews)
      .innerJoin(schema.users, eq(schema.presenterReviews.authorId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.presenterReviews.presenterUserId, userId))
      .orderBy(desc(schema.presenterReviews.createdAt))
      .limit(limit)
      .offset(offset)
    return reply.send({ items: rows })
  })

  app.post('/api/v1/presenters/:presenterUserId/reviews', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = requireUser(req, reply)
    if (!viewer) return
    const { presenterUserId } = req.params as { presenterUserId: string }
    if (!UUID_RE.test(presenterUserId)) return reply.status(400).send({ error: 'Invalid presenter id' })
    if (presenterUserId === viewer.userId) {
      return reply.status(400).send({ error: 'Cannot review yourself' })
    }
    const parsed = postReviewBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [presenterProf] = await db
      .select()
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, presenterUserId))
      .limit(1)
    if (!presenterProf) return reply.status(404).send({ error: 'Presenter profile not found' })

    const [reviewer] = await db
      .select({ createdAt: schema.users.createdAt })
      .from(schema.users)
      .where(eq(schema.users.id, viewer.userId))
      .limit(1)
    if (!reviewer || accountAgeDays(reviewer.createdAt) < REVIEW_MIN_ACCOUNT_AGE_DAYS) {
      return reply.status(403).send({ error: 'Account must be at least 14 days old to leave reviews' })
    }

    if (parsed.data.sourceKind === 'ATTENDEE') {
      const ok = await assertPresenterScheduledAtEvent(presenterUserId, parsed.data.eventId)
      if (!ok) return reply.status(403).send({ error: 'Presenter was not listed on this event program' })
      const attended = await userAttendedEvent(viewer.userId, parsed.data.eventId)
      if (!attended) return reply.status(403).send({ error: 'Attend this event before leaving a review' })
      const [dup] = await db
        .select()
        .from(schema.presenterReviews)
        .where(
          and(
            eq(schema.presenterReviews.presenterUserId, presenterUserId),
            eq(schema.presenterReviews.authorId, viewer.userId),
            eq(schema.presenterReviews.eventId, parsed.data.eventId),
            eq(schema.presenterReviews.sourceKind, 'ATTENDEE')
          )
        )
        .limit(1)
      if (dup) return reply.status(409).send({ error: 'You already reviewed this presenter for this event' })
      const attendeeCheckedIn = await userStaffCheckedInForEvent(viewer.userId, parsed.data.eventId)
      const [row] = await db
        .insert(schema.presenterReviews)
        .values({
          presenterUserId,
          authorId: viewer.userId,
          rating: parsed.data.rating,
          body: parsed.data.body ?? undefined,
          sourceKind: 'ATTENDEE',
          eventId: parsed.data.eventId,
          scheduleSlotId: parsed.data.scheduleSlotId ?? undefined,
          attendeeCheckedIn,
        })
        .returning()
      await recalculatePresenterRating(presenterUserId)
      return reply.send({ review: row })
    }

    const orgId = parsed.data.organizationId
    if (!orgId) return reply.status(400).send({ error: 'organizationId required for organization reviews' })
    const rank = await orgStaffRank(orgId, viewer.userId)
    if (rank < ORG_ROLE_RANK.MODERATOR) {
      return reply.status(403).send({ error: 'Moderator role or higher required' })
    }
    const ran = await assertOrgRanEvent(orgId, parsed.data.eventId)
    if (!ran) return reply.status(403).send({ error: 'Organization did not run this event' })

    const [dupOrg] = await db
      .select()
      .from(schema.presenterReviews)
      .where(
        and(
          eq(schema.presenterReviews.presenterUserId, presenterUserId),
          eq(schema.presenterReviews.organizationId, orgId),
          eq(schema.presenterReviews.eventId, parsed.data.eventId),
          eq(schema.presenterReviews.sourceKind, 'ORGANIZATION')
        )
      )
      .limit(1)
    if (dupOrg) {
      return reply.status(409).send({ error: 'Organization already reviewed this presenter for this event' })
    }

    const [row] = await db
      .insert(schema.presenterReviews)
      .values({
        presenterUserId,
        authorId: viewer.userId,
        rating: parsed.data.rating,
        body: parsed.data.body ?? undefined,
        sourceKind: 'ORGANIZATION',
        eventId: parsed.data.eventId,
        organizationId: orgId,
        scheduleSlotId: parsed.data.scheduleSlotId ?? undefined,
      })
      .returning()
    await recalculatePresenterRating(presenterUserId)
    return reply.send({ review: row })
  })

  app.get('/api/v1/presenters/:key', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    if (key === 'me' || key === 'reviews' || key === 'by-user' || key.includes('/')) {
      return reply.status(400).send({ error: 'Invalid key' })
    }

    const user = await loadUserByUsernameOrId(key)
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const [prof] = await db
      .select()
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, user.id))
      .limit(1)
    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    if (!prof) return reply.status(404).send({ error: 'Presenter profile not found' })

    const viewerId = optionalViewerId(req)
    const isOwner = viewerId === user.id
    const showRunner = await canAccessPresenterRunnerMaterials(viewerId, user.id)
    if (prof.directoryVisibility === 'UNLISTED' && !isOwner && !showRunner) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const canSeeOrganizerFields = canSeePresenterOrganizerFields(isOwner, showRunner)
    const includeRunnerMaterials = showRunner
    const offeringsWhere =
      isOwner || showRunner ?
        eq(schema.presenterOfferings.userId, user.id)
      : and(eq(schema.presenterOfferings.userId, user.id), eq(schema.presenterOfferings.isPublic, true))

    const offeringRows = await db
      .select()
      .from(schema.presenterOfferings)
      .where(offeringsWhere)
      .orderBy(asc(schema.presenterOfferings.sortOrder), desc(schema.presenterOfferings.createdAt))
    const offerings = offeringRows.map((row) => offeringJson(row, includeRunnerMaterials))

    const galleryRows = await db
      .select()
      .from(schema.presenterGalleryImages)
      .where(eq(schema.presenterGalleryImages.userId, user.id))
      .orderBy(asc(schema.presenterGalleryImages.sortOrder), desc(schema.presenterGalleryImages.createdAt))
    const gallery = galleryRows.filter((row) => {
      const validated = validatePresenterExternalUrl(row.imageUrl)
      return validated.ok
    })

    const teachingCredits = await loadPresenterTeachingCredits(user.id)
    const writingPreview = await loadWritingPreviewForUser(user.id, 3)

    const canSeeHistory = await viewerCanSeeActivityHistory(user.id, viewerId)
    const sessions = canSeeHistory ? await slotsForPresenterUser(user.id, 40, viewerId) : []

    const recentReviews = await db
      .select({
        id: schema.presenterReviews.id,
        rating: schema.presenterReviews.rating,
        body: schema.presenterReviews.body,
        sourceKind: schema.presenterReviews.sourceKind,
        createdAt: schema.presenterReviews.createdAt,
        authorId: schema.presenterReviews.authorId,
        authorUsername: schema.users.username,
        authorDisplayName: schema.profiles.displayName,
      })
      .from(schema.presenterReviews)
      .innerJoin(schema.users, eq(schema.presenterReviews.authorId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.presenterReviews.presenterUserId, user.id))
      .orderBy(desc(schema.presenterReviews.createdAt))
      .limit(20)

    const focusFields = await loadPresenterFocusFields(user.id)
    const badgeCounts = await loadPresenterBadgeCounts([user.id])
    const counts = badgeCounts.get(user.id)
    const badges = counts ? derivePresenterBadges(counts, prof.profileKind) : []

    const friendIds = viewerId ? await loadAcceptedFriendUserIds(viewerId) : new Set<string>()
    const visiblePronouns =
      p ?
        formatPronounDisplay(
          visibleProfileIdentityFields(enrichProfileIdentityRead(p), {
            isOwner,
            isFriend: friendIds.has(user.id),
            asPublicProfileView: true,
          }).pronounTags,
        ) || null
      : null

    return reply.send({
      userId: user.id,
      username: user.username,
      displayName: p?.displayName ?? null,
      avatarUrl: p?.avatarUrl ?? null,
      pronouns: visiblePronouns,
      presenter: presenterProfileForViewer(prof, canSeeOrganizerFields),
      ...focusFields,
      badges,
      verifiedTeachingCredits: counts?.verifiedTeachingCredits ?? 0,
      offerings,
      gallery,
      teachingCredits: canSeeHistory ? teachingCredits : [],
      writingPreview,
      historyVisible: canSeeHistory,
      viewerCanSeeRunnerMaterials: showRunner,
      sessions,
      reviews: recentReviews,
    })
  })

  app.patch('/api/v1/presenters/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = patchPresenterBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, user.userId))
      .limit(1)
    let row: typeof schema.presenterProfiles.$inferSelect
    if (existing) {
      ;[row] = await db
        .update(schema.presenterProfiles)
        .set({
          headline: parsed.data.headline !== undefined ? parsed.data.headline : existing.headline,
          bioShort: parsed.data.bioShort !== undefined ? parsed.data.bioShort : existing.bioShort,
          bio: parsed.data.bio !== undefined ? parsed.data.bio : existing.bio,
          links: parsed.data.links !== undefined ? parsed.data.links : existing.links,
          profileKind: parsed.data.profileKind !== undefined ? parsed.data.profileKind : existing.profileKind,
          expertiseTags:
            parsed.data.expertiseTags !== undefined ? parsed.data.expertiseTags : existing.expertiseTags,
          directoryVisibility:
            parsed.data.directoryVisibility !== undefined ?
              parsed.data.directoryVisibility
            : existing.directoryVisibility,
          backgroundStory:
            parsed.data.backgroundStory !== undefined ?
              parsed.data.backgroundStory
            : existing.backgroundStory,
          mentorshipOffered:
            parsed.data.mentorshipOffered !== undefined ?
              parsed.data.mentorshipOffered
            : existing.mentorshipOffered,
          mentorshipNotes:
            parsed.data.mentorshipNotes !== undefined ?
              parsed.data.mentorshipNotes
            : existing.mentorshipNotes,
          eckePublish:
            parsed.data.eckePublish !== undefined ? parsed.data.eckePublish : existing.eckePublish,
          updatedAt: new Date(),
        })
        .where(eq(schema.presenterProfiles.userId, user.userId))
        .returning()
    } else {
      ;[row] = await db
        .insert(schema.presenterProfiles)
        .values({
          userId: user.userId,
          headline: parsed.data.headline ?? undefined,
          bioShort: parsed.data.bioShort ?? undefined,
          bio: parsed.data.bio ?? undefined,
          links: parsed.data.links ?? {},
          profileKind: parsed.data.profileKind ?? 'PRES',
          expertiseTags: parsed.data.expertiseTags ?? undefined,
          directoryVisibility: parsed.data.directoryVisibility ?? 'UNLISTED',
          backgroundStory: parsed.data.backgroundStory ?? undefined,
          mentorshipOffered: parsed.data.mentorshipOffered ?? false,
          mentorshipNotes: parsed.data.mentorshipNotes ?? undefined,
          eckePublish: parsed.data.eckePublish ?? false,
        })
        .returning()
    }

    let focusFields = await loadPresenterFocusFields(user.userId)
    if (parsed.data.profileFocuses !== undefined) {
      focusFields = await savePresenterFocusFields(
        user.userId,
        parsed.data.profileFocuses,
        parsed.data.primaryProfileFocus
      )
    } else if (parsed.data.primaryProfileFocus !== undefined && focusFields.profileFocuses.length > 0) {
      focusFields = await savePresenterFocusFields(
        user.userId,
        focusFields.profileFocuses,
        parsed.data.primaryProfileFocus
      )
    }

    return reply.send({ presenter: row, ...focusFields })
  })
}
