/**
 * Convention HTTP routes (hub, program, participation, staff, settings).
 * Large multi-audience module — split by audience deferred (audit A12). Prefer
 * extending helpers in `lib/convention-*` over growing unrelated handlers here.
 */
import { createHash, randomBytes } from 'node:crypto'
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import type { ConventionPublicSettings } from '../db/schema.js'
import { parseOrgFeatureFlags } from '../lib/org-features.js'
import { getProgramSummaryForEvent } from '../lib/event-program.js'
import { createNotification } from '../lib/create-notification.js'
import { publishToScope } from '../lib/realtime-bus.js'
import {
  filterSlotsForPublicProgram,
  isPublicProgramListing,
  publicProgramViewerFromAccess,
} from '../lib/convention-program-policy.js'
import { computeAllConventionScheduleWarnings } from '../lib/convention-schedule-warnings.js'
import { buildProgramIcsCalendar } from '../lib/ics-event.js'
import { buildCrewGridFromAssignments } from '../lib/convention-crew-grid.js'
import { buildMyConventionScheduleItems } from '../lib/convention-my-schedule.js'
import { escapeCsvCell, parseCsvRows } from '../lib/csv-parse.js'
import {
  candidateFromCsvRow,
  publishProgramCandidates,
} from '../lib/convention-organizer/scheduleImportPublish.js'
import { toPublicConventionDto } from '../lib/convention-public-dto.js'
import { withAlphaLabel, withAlphaLabels } from '../lib/alpha-seed-labels.js'
import { filterStaffRowsForAttendeeAllowlist, getProgramStaffAttendeeRoleAllowlist } from '../lib/convention-staff-public.js'
import { mintDancecardHandoffCode } from '../lib/dancecardHandoff.js'
import {
  requireHubConventionMutation,
  requireHubConventionRead,
  resolveConventionCommandAccess,
  userHasConventionCommandPermission,
  userHasHubConventionRead,
} from '../lib/convention-command-access.js'
import { buildConventionCalendarFeedIcs } from '../lib/convention-calendar-feed-ics.js'
import { loadMyConventionParticipation } from '../lib/convention-participation.js'
import { emitActivity } from '../lib/feed-activities.js'
import { isParticipationWindowOpen, participationFromConventionSettings } from '@c2k/shared'

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

export async function resolveConventionId(key: string): Promise<string | null> {
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
      and(
        eq(schema.organizationMembers.organizationId, orgId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  return m ?? null
}

export async function canManageConvention(
  conv: typeof schema.conventions.$inferSelect,
  userId: string
): Promise<boolean> {
  if (!conv.organizationId) return false
  const m = await orgMembership(conv.organizationId, userId)
  return Boolean(m && ORG_ROLE_RANK[m.role] >= ORG_ROLE_RANK.MODERATOR)
}

/** Org owner/admin **or** convention staff_ops command grant **or** legacy schedule-assignment flag. */
async function userCanAssignStaffDuties(conv: typeof schema.conventions.$inferSelect, userId: string): Promise<boolean> {
  if (await userHasConventionCommandPermission(conv, userId, 'staff_ops')) return true
  const [g] = await db
    .select({
      role: schema.conventionAccessGrants.role,
      staffPreAccess: schema.conventionAccessGrants.staffPreAccess,
      canAssignStaffSchedules: schema.conventionAccessGrants.canAssignStaffSchedules,
    })
    .from(schema.conventionAccessGrants)
    .where(and(eq(schema.conventionAccessGrants.conventionId, conv.id), eq(schema.conventionAccessGrants.userId, userId)))
    .limit(1)
  if (!g) return false
  const staffLike = g.role === 'STAFF' || g.role === 'MODERATOR' || g.staffPreAccess
  return Boolean(staffLike && g.canAssignStaffSchedules)
}

export async function getConventionWithAccess(key: string, userId: string | null) {
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
        .where(
          and(
            eq(schema.conventionAccessGrants.conventionId, conv.id),
            eq(schema.conventionAccessGrants.userId, userId)
          )
        )
        .limit(1)
    : [undefined]
  const hasPaidAccess = Boolean(grant && grant.paidConfirmed && grant.attendingConfirmed)
  const isStaff = Boolean(grant && (grant.role === 'STAFF' || grant.role === 'MODERATOR' || grant.staffPreAccess))
  const commandAccess = userId ? await resolveConventionCommandAccess(conv, userId) : null
  const canManage = Boolean(
    commandAccess?.permissions.isFullAdmin || commandAccess?.hasAnyAccess,
  )
  const canView = hasPaidAccess || isStaff || canManage
  return { conv, canView, canManage, hasPaidAccess, isStaff, userId }
}

function hasTimeConflict(
  startsAt: Date,
  endsAt: Date,
  existing: Array<{ startsAt: Date; endsAt: Date }>
): boolean {
  return existing.some((it) => startsAt < it.endsAt && endsAt > it.startsAt)
}

const slotBody = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  title: z.string().min(1).max(512),
  description: z.string().max(20000).optional(),
  location: z.string().max(512).optional(),
  linkUrl: z.string().url().max(2000).optional().or(z.literal('')),
  imageGallery: z.array(z.string().url()).max(32).optional(),
  blockId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
  trackLabel: z.string().max(128).optional().nullable(),
  roomLabel: z.string().max(128).optional().nullable(),
  presenterOfferingId: z.string().uuid().optional().nullable(),
  importKey: z.string().max(128).optional().nullable(),
})

const slotPatchBody = slotBody.partial()

const conventionDocumentBody = z.object({
  title: z.string().min(1).max(255),
  type: z.string().min(1).max(64).optional(),
  url: z.string().url().max(2000),
  visibility: z.enum(['ATTENDEE', 'STAFF', 'PUBLIC']).optional(),
  sortOrder: z.number().int().optional(),
})

const customPageBody = z.object({
  slug: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  visibility: z.enum(['ATTENDEE', 'STAFF', 'PUBLIC']).optional(),
  sortOrder: z.number().int().optional(),
  content: z.record(z.string(), z.any()).optional(),
})

const conventionSettingsSchema = z
  .object({
    venueProfile: z.enum(['single_venue', 'hotel_takeover', 'camping', 'urban_multi_venue', 'other']).optional(),
    hotelBlocks: z
      .array(
        z.object({
          label: z.string().min(1).max(200),
          url: z.string().url().max(2000).optional(),
          code: z.string().max(120).optional(),
        })
      )
      .max(20)
      .optional(),
    cocUrl: z.union([z.string().url().max(2000), z.literal('')]).optional(),
    safetyReportingNote: z.string().max(2000).optional(),
    accessibilityVenueNotes: z.string().max(5000).optional(),
    publicProgramListing: z.boolean().optional(),
    isoBoardEnabled: z.boolean().optional(),
    programStaffAttendeeRoles: z.array(z.string().min(1).max(64)).max(32).optional(),
    eckeListingSlug: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .optional(),
    eckeListing: z
      .object({
        highlights: z.array(z.string().min(1).max(120)).max(12).optional(),
        venueName: z.union([z.string().max(160), z.literal('')]).optional(),
        websiteUrl: z.union([z.string().url().max(2000), z.literal('')]).optional(),
      })
      .optional(),
    dancecardSlug: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .optional(),
    dancecardHost: z.union([z.string().url().max(2000), z.literal('')]).optional(),
    dancecardEnabled: z.boolean().optional(),
    dancecardEmbedTokenHint: z.string().max(200).optional(),
    dancecardAttendeeSameTab: z.boolean().optional(),
    dancecardPublishStatus: z.enum(['draft', 'published']).optional(),
    registrationAccessCode: z.string().max(120).optional(),
    staffAccessCode: z.string().max(120).optional(),
    venueRooms: z.array(z.string().min(1).max(128)).max(64).optional(),
  })
  .strict()

function normalizeConventionSettingsPatch(
  patch: z.infer<typeof conventionSettingsSchema>
): Partial<ConventionPublicSettings> {
  const out: Partial<ConventionPublicSettings> = { ...patch }
  if (patch.cocUrl === '') out.cocUrl = undefined
  if (patch.dancecardHost === '') out.dancecardHost = undefined
  if (patch.eckeListing !== undefined) {
    const highlights = (patch.eckeListing.highlights ?? []).map((s) => s.trim()).filter(Boolean)
    const venueName = patch.eckeListing.venueName?.trim() || null
    const websiteUrl = patch.eckeListing.websiteUrl?.trim() || null
    out.eckeListing = { highlights, venueName, websiteUrl }
  }
  return out
}

function mergeConventionSettings(
  prev: ConventionPublicSettings | null | undefined,
  patch: Partial<ConventionPublicSettings>
): ConventionPublicSettings {
  const base: Record<string, unknown> =
    prev && typeof prev === 'object' ? { ...(prev as Record<string, unknown>) } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) {
      delete base[k]
    } else {
      base[k] = v
    }
  }
  return base as ConventionPublicSettings
}

export type ConventionContributorPreview = {
  id: string
  kind: string
  label: string
  vendorSlug: string | null
  username: string | null
}

export async function loadContributorsPreviewForEvent(eventId: string): Promise<ConventionContributorPreview[]> {
  const rows = await db
    .select({
      id: schema.eventContributors.id,
      kind: schema.eventContributors.kind,
      label: schema.eventContributors.label,
      vendorSlug: schema.vendorProfiles.slug,
      username: schema.users.username,
    })
    .from(schema.eventContributors)
    .leftJoin(schema.vendorProfiles, eq(schema.vendorProfiles.id, schema.eventContributors.vendorProfileId))
    .leftJoin(schema.users, eq(schema.users.id, schema.eventContributors.userId))
    .where(eq(schema.eventContributors.eventId, eventId))
    .orderBy(asc(schema.eventContributors.sortOrder))
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    vendorSlug: r.vendorSlug ?? null,
    username: r.username ?? null,
  }))
}

export async function registerConventionRoutes(app: FastifyInstance) {
  app.get('/api/v1/events/:eventId/program', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const program = await getProgramSummaryForEvent(eventId)
    return reply.send({ program })
  })

  app.get('/api/v1/conventions/:key', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const viewerUserId = getViewerUserId(viewer.payload)
    const { key } = req.params as { key: string }
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    let organizationSummary: {
      slug: string
      displayName: string
      logoUrl: string | null
      tagline: string | null
      isMember?: boolean
    } | null = null
    if (conv.organizationId) {
      const [o] = await db
        .select({
          slug: schema.organizations.slug,
          displayName: schema.organizations.displayName,
          logoUrl: schema.organizations.logoUrl,
          bio: schema.organizations.bio,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, conv.organizationId))
        .limit(1)
      if (o) {
        const mem = viewerUserId ? await orgMembership(conv.organizationId, viewerUserId) : null
        organizationSummary = {
          slug: o.slug,
          displayName: o.displayName,
          logoUrl: o.logoUrl ?? null,
          tagline: o.bio?.trim() || null,
          isMember: Boolean(mem),
        }
      }
    }
    let isPinned = false
    if (viewerUserId) {
      try {
        const [pin] = await db
          .select()
          .from(schema.conventionPins)
          .where(
            and(eq(schema.conventionPins.userId, viewerUserId), eq(schema.conventionPins.conventionId, conv.id)),
          )
          .limit(1)
        isPinned = Boolean(pin)
      } catch {
        /* convention_pins may be missing until db:migrate-hub-ext runs */
      }
    }
    let anchorEventSummary: {
      id: string
      title: string
      imageUrl: string | null
      locationLabel: string | null
    } | null = null
    if (conv.anchorEventId) {
      const [e] = await db
        .select({
          id: schema.events.id,
          title: schema.events.title,
          imageUrl: schema.events.imageUrl,
          location: schema.events.location,
          publicLocationSummary: schema.events.publicLocationSummary,
          locationVisibility: schema.events.locationVisibility,
        })
        .from(schema.events)
        .where(eq(schema.events.id, conv.anchorEventId))
        .limit(1)
      if (e) {
        const locationLabel =
          e.locationVisibility === 'public' ?
            e.location?.trim() || e.publicLocationSummary?.trim() || null
          : e.publicLocationSummary?.trim() || null
        anchorEventSummary = {
          id: e.id,
          title: e.title,
          imageUrl: e.imageUrl ?? null,
          locationLabel,
        }
      }
    }
    const contributorsPreview =
      conv.anchorEventId ? await loadContributorsPreviewForEvent(conv.anchorEventId) : []
    const includeFullSettings = viewerUserId
      ? await userHasHubConventionRead(conv, viewerUserId, 'admin')
      : false
    const convention = await withAlphaLabel(
      'convention',
      toPublicConventionDto(conv, { includeFullSettings }),
    )
    return reply.send({
      convention,
      organizationSummary,
      anchorEventSummary,
      contributorsPreview,
      isPinned,
    })
  })

  app.get('/api/v1/conventions/:key/organizer/presenter-lookup', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, user.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Convention not found' })
    if ('forbidden' in resolved) return reply.status(403).send({ error: 'Convention is not linked to an organization' })
    if (!(await requireHubConventionRead(resolved.conv, user.userId, reply, ['scheduler', 'staff_ops']))) return
    const q = (req.query as { q?: string; limit?: string }).q?.trim() ?? ''
    const limit = Math.min(100, Math.max(1, parseInt(String((req.query as { limit?: string }).limit ?? '30'), 10) || 30))
    const search = q.length > 0 ? `%${q.replace(/%/g, '')}%` : null
    const rows = await db
      .select({
        userId: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        headline: schema.presenterProfiles.headline,
        profileKind: schema.presenterProfiles.profileKind,
        expertiseTags: schema.presenterProfiles.expertiseTags,
      })
      .from(schema.presenterProfiles)
      .innerJoin(schema.users, eq(schema.presenterProfiles.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        search ?
          or(
            ilike(schema.users.username, search),
            ilike(schema.profiles.displayName, search),
            ilike(schema.presenterProfiles.headline, search)
          )
        : undefined
      )
      .orderBy(desc(schema.presenterProfiles.reviewCount), asc(schema.users.username))
      .limit(limit)
    return reply.send({ items: rows })
  })

  app.patch('/api/v1/conventions/:key', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(20000).optional().nullable(),
        timezone: z.string().max(64).optional(),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
        settings: conventionSettingsSchema.optional(),
      })
      .strict()
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, actor.userId, reply, 'admin'))) return
    const patch: Record<string, unknown> = {}
    if (parsed.data.name === undefined &&
      parsed.data.description === undefined &&
      parsed.data.timezone === undefined &&
      parsed.data.startsAt === undefined &&
      parsed.data.endsAt === undefined &&
      parsed.data.settings === undefined) {
      return reply.status(400).send({ error: 'No changes' })
    }
    const [updated] = await db
      .update(schema.conventions)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.timezone !== undefined ? { timezone: parsed.data.timezone } : {}),
        ...(parsed.data.startsAt !== undefined ? { startsAt: new Date(parsed.data.startsAt) } : {}),
        ...(parsed.data.endsAt !== undefined ? { endsAt: new Date(parsed.data.endsAt) } : {}),
        ...(parsed.data.settings !== undefined
          ? {
              settings: mergeConventionSettings(
                (conv.settings as ConventionPublicSettings | null | undefined) ?? {},
                normalizeConventionSettingsPatch(parsed.data.settings)
              ),
            }
          : {}),
      })
      .where(eq(schema.conventions.id, conv.id))
      .returning()
    return reply.send({ convention: updated })
  })

  app.get('/api/v1/conventions/:key/me/participation', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const participation = await loadMyConventionParticipation(resolved.conv.id, actor.userId)
    if (!participation) return reply.status(404).send({ error: 'Profile not found' })
    return reply.send({
      conventionId: resolved.conv.id,
      conventionSlug: resolved.conv.slug,
      participation,
    })
  })

  app.get('/api/v1/conventions/:key/access', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const q = req.query as { previewRole?: string } | undefined
    const rawPreview = q?.previewRole?.trim().toLowerCase() ?? ''
    const previewRole =
      rawPreview === 'attendee' || rawPreview === 'staff' || rawPreview === 'safety' || rawPreview === 'public'
        ? rawPreview
        : null
    // Only honor `previewRole` when the real viewer is organizer or staff for this convention.
    // Realtime / personal endpoints (chat, my-schedule, iso-board/me) still run as the real viewer.
    if (previewRole && (resolved.canManage || resolved.isStaff)) {
      if (previewRole === 'public') {
        return reply.send({
          canView: false,
          canManage: false,
          hasPaidAccess: false,
          isStaff: false,
          previewRole,
        })
      }
      if (previewRole === 'attendee') {
        return reply.send({
          canView: true,
          canManage: false,
          hasPaidAccess: true,
          isStaff: false,
          previewRole,
        })
      }
      // staff & safety
      return reply.send({
        canView: true,
        canManage: false,
        hasPaidAccess: true,
        isStaff: true,
        previewRole,
      })
    }
    return reply.send({
      canView: resolved.canView,
      canManage: resolved.canManage,
      hasPaidAccess: resolved.hasPaidAccess,
      isStaff: resolved.isStaff,
    })
  })

  app.put('/api/v1/conventions/:key/access/:userId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, userId } = req.params as { key: string; userId: string }
    if (!UUID_RE.test(userId)) return reply.status(400).send({ error: 'Invalid user id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'registration'))) return
    const body = z
      .object({
        role: z.enum(['ATTENDEE', 'STAFF', 'MODERATOR']).optional(),
        paidConfirmed: z.boolean().optional(),
        attendingConfirmed: z.boolean().optional(),
        staffPreAccess: z.boolean().optional(),
        canAssignStaffSchedules: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.conventionAccessGrants)
      .where(
        and(
          eq(schema.conventionAccessGrants.conventionId, resolved.conv.id),
          eq(schema.conventionAccessGrants.userId, userId)
        )
      )
      .limit(1)
    if (existing) {
      const [updated] = await db
        .update(schema.conventionAccessGrants)
        .set({
          role: body.data.role ?? existing.role,
          paidConfirmed: body.data.paidConfirmed ?? existing.paidConfirmed,
          attendingConfirmed: body.data.attendingConfirmed ?? existing.attendingConfirmed,
          staffPreAccess: body.data.staffPreAccess ?? existing.staffPreAccess,
          ...(body.data.canAssignStaffSchedules !== undefined ?
            { canAssignStaffSchedules: body.data.canAssignStaffSchedules }
          : {}),
        })
        .where(eq(schema.conventionAccessGrants.id, existing.id))
        .returning()
      return reply.send({ access: updated })
    }
    const [created] = await db
      .insert(schema.conventionAccessGrants)
      .values({
        conventionId: resolved.conv.id,
        userId,
        role: body.data.role ?? 'ATTENDEE',
        paidConfirmed: body.data.paidConfirmed ?? false,
        attendingConfirmed: body.data.attendingConfirmed ?? false,
        staffPreAccess: body.data.staffPreAccess ?? false,
        canAssignStaffSchedules: body.data.canAssignStaffSchedules ?? false,
        grantedByUserId: actor.userId,
      })
      .returning()
    return reply.send({ access: created })
  })

  app.post('/api/v1/conventions/:key/staff-invite-tokens', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const body = z.object({ expiresInHours: z.number().int().min(1).max(24 * 30).optional() }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'registration'))) return
    const token = randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + (body.data.expiresInHours ?? 72) * 60 * 60 * 1000)
    const [invite] = await db
      .insert(schema.conventionStaffInviteTokens)
      .values({
        conventionId: resolved.conv.id,
        token,
        createdByUserId: actor.userId,
        expiresAt,
      })
      .returning()
    return reply.send({ invite })
  })

  app.post('/api/v1/conventions/:key/staff-invite-tokens/redeem', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const body = z.object({ token: z.string().min(16).max(128) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const [invite] = await db
      .select()
      .from(schema.conventionStaffInviteTokens)
      .where(
        and(
          eq(schema.conventionStaffInviteTokens.conventionId, resolved.conv.id),
          eq(schema.conventionStaffInviteTokens.token, body.data.token)
        )
      )
      .limit(1)
    if (!invite) return reply.status(404).send({ error: 'Invite not found' })
    if (invite.redeemedAt) return reply.status(409).send({ error: 'Invite already redeemed' })
    if (new Date(invite.expiresAt).getTime() < Date.now()) return reply.status(410).send({ error: 'Invite expired' })
    await db
      .update(schema.conventionStaffInviteTokens)
      .set({ redeemedByUserId: actor.userId, redeemedAt: new Date() })
      .where(eq(schema.conventionStaffInviteTokens.id, invite.id))
    const [grant] = await db
      .insert(schema.conventionAccessGrants)
      .values({
        conventionId: resolved.conv.id,
        userId: actor.userId,
        role: 'STAFF',
        paidConfirmed: false,
        attendingConfirmed: true,
        staffPreAccess: true,
        grantedByUserId: invite.createdByUserId,
      })
      .onConflictDoUpdate({
        target: [schema.conventionAccessGrants.conventionId, schema.conventionAccessGrants.userId],
        set: { role: 'STAFF', attendingConfirmed: true, staffPreAccess: true },
      })
      .returning()
    return reply.send({ access: grant })
  })

  app.get('/api/v1/conventions/:key/documents', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const rows = await db
      .select()
      .from(schema.conventionDocuments)
      .where(eq(schema.conventionDocuments.conventionId, resolved.conv.id))
      .orderBy(asc(schema.conventionDocuments.sortOrder), asc(schema.conventionDocuments.createdAt))
    const filtered = rows.filter((row) => {
      if (row.visibility === 'PUBLIC') return true
      if (row.visibility === 'ATTENDEE') return resolved.hasPaidAccess || resolved.isStaff || resolved.canManage
      return resolved.isStaff || resolved.canManage
    })
    return reply.send({ items: filtered })
  })

  app.post('/api/v1/conventions/:key/documents', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = conventionDocumentBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'staff_ops'))) return
    const [row] = await db
      .insert(schema.conventionDocuments)
      .values({
        conventionId: resolved.conv.id,
        title: parsed.data.title,
        type: parsed.data.type ?? 'general',
        url: parsed.data.url,
        visibility: parsed.data.visibility ?? 'ATTENDEE',
        sortOrder: parsed.data.sortOrder ?? 0,
        createdByUserId: actor.userId,
      })
      .returning()
    return reply.send({ document: row })
  })

  app.delete('/api/v1/conventions/:key/documents/:documentId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, documentId } = req.params as { key: string; documentId: string }
    if (!UUID_RE.test(documentId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'staff_ops'))) return
    const del = await db
      .delete(schema.conventionDocuments)
      .where(
        and(
          eq(schema.conventionDocuments.id, documentId),
          eq(schema.conventionDocuments.conventionId, resolved.conv.id)
        )
      )
      .returning({ id: schema.conventionDocuments.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/conventions/:key/slots', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [convRow] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!convRow) return reply.status(404).send({ error: 'Not found' })
    const listingPublic = isPublicProgramListing(convRow.settings)
    if (!listingPublic) {
      const resolved = await getConventionWithAccess(key, viewerId)
      if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
      if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
      if (!resolved.canView && !resolved.canManage) {
        return reply.status(403).send({ error: 'Program listing is limited to attendees and staff' })
      }
    }
    const staffAccess = await getConventionWithAccess(key, viewerId)
    const includeStaffOnProgram =
      !('notFound' in staffAccess) &&
      !('forbidden' in staffAccess) &&
      (staffAccess.canManage || staffAccess.isStaff)
    const programViewer = publicProgramViewerFromAccess(includeStaffOnProgram, viewerId)
    const staffRoleAllowlist = getProgramStaffAttendeeRoleAllowlist(convRow.settings as ConventionPublicSettings)
    const allRows = await db
      .select()
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, id))
      .orderBy(asc(schema.scheduleSlots.startsAt), asc(schema.scheduleSlots.sortOrder))
    const rows = filterSlotsForPublicProgram(allRows, programViewer)
    const slotIds = rows.map((r) => r.id)
    type PresRow = {
      scheduleSlotId: string
      userId: string
      sortOrder: number
      username: string
      displayName: string | null
      avatarUrl: string | null
      vendorSlug: string | null
      presenterPublic: boolean
    }
    const presentersBySlot: Record<string, PresRow[]> = {}
    if (slotIds.length > 0) {
      const allPres = await db
        .select({
          scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId,
          userId: schema.scheduleSlotPresenters.userId,
          sortOrder: schema.scheduleSlotPresenters.sortOrder,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
          avatarUrl: schema.profiles.avatarUrl,
          vendorSlug: schema.vendorProfiles.slug,
          presenterDirectoryVisibility: schema.presenterProfiles.directoryVisibility,
        })
        .from(schema.scheduleSlotPresenters)
        .innerJoin(schema.users, eq(schema.scheduleSlotPresenters.userId, schema.users.id))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .leftJoin(schema.vendorProfiles, eq(schema.vendorProfiles.userId, schema.users.id))
        .leftJoin(schema.presenterProfiles, eq(schema.presenterProfiles.userId, schema.users.id))
        .where(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds))
      for (const p of allPres) {
        if (!presentersBySlot[p.scheduleSlotId]) presentersBySlot[p.scheduleSlotId] = []
        presentersBySlot[p.scheduleSlotId]!.push({
          scheduleSlotId: p.scheduleSlotId,
          userId: p.userId,
          sortOrder: p.sortOrder,
          username: p.username,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          vendorSlug: p.vendorSlug ?? null,
          presenterPublic: p.presenterDirectoryVisibility === 'PUBLIC',
        })
      }
    }
    const materialRows =
      slotIds.length > 0
        ? await db
            .select()
            .from(schema.scheduleSlotMaterials)
            .where(inArray(schema.scheduleSlotMaterials.scheduleSlotId, slotIds))
        : []
    const materialBySlot = new Map<string, Array<typeof schema.scheduleSlotMaterials.$inferSelect>>()
    for (const m of materialRows) {
      const arr = materialBySlot.get(m.scheduleSlotId) ?? []
      arr.push(m)
      materialBySlot.set(m.scheduleSlotId, arr)
    }
    type StaffRow = {
      id: string
      scheduleSlotId: string
      userId: string
      roleLabel: string
      station: string | null
      notes: string | null
      startsAt: string
      endsAt: string
      username: string
      displayName: string | null
      avatarUrl: string | null
      vendorSlug: string | null
      presenterPublic: boolean
    }
    const staffBySlot: Record<string, StaffRow[]> = {}
    if (slotIds.length > 0) {
      const allStaff = await db
        .select({
          id: schema.scheduleSlotStaff.id,
          scheduleSlotId: schema.scheduleSlotStaff.scheduleSlotId,
          userId: schema.scheduleSlotStaff.userId,
          roleLabel: schema.scheduleSlotStaff.roleLabel,
          station: schema.scheduleSlotStaff.station,
          notes: schema.scheduleSlotStaff.notes,
          startsAt: schema.scheduleSlotStaff.startsAt,
          endsAt: schema.scheduleSlotStaff.endsAt,
          updatedAt: schema.scheduleSlotStaff.updatedAt,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
          avatarUrl: schema.profiles.avatarUrl,
          vendorSlug: schema.vendorProfiles.slug,
          presenterDirectoryVisibility: schema.presenterProfiles.directoryVisibility,
        })
        .from(schema.scheduleSlotStaff)
        .innerJoin(schema.users, eq(schema.scheduleSlotStaff.userId, schema.users.id))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .leftJoin(schema.vendorProfiles, eq(schema.vendorProfiles.userId, schema.users.id))
        .leftJoin(schema.presenterProfiles, eq(schema.presenterProfiles.userId, schema.users.id))
        .where(inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds))
      for (const st of allStaff) {
        if (!staffBySlot[st.scheduleSlotId]) staffBySlot[st.scheduleSlotId] = []
        staffBySlot[st.scheduleSlotId]!.push({
          id: st.id,
          scheduleSlotId: st.scheduleSlotId,
          userId: st.userId,
          roleLabel: st.roleLabel,
          station: st.station,
          notes: st.notes,
          startsAt: new Date(st.startsAt).toISOString(),
          endsAt: new Date(st.endsAt).toISOString(),
          username: st.username,
          displayName: st.displayName,
          avatarUrl: st.avatarUrl,
          vendorSlug: st.vendorSlug ?? null,
          presenterPublic: st.presenterDirectoryVisibility === 'PUBLIC',
        })
      }
    }

    const offeringIds = [
      ...new Set(rows.map((r) => r.presenterOfferingId).filter((x): x is string => Boolean(x))),
    ]
    const offeringById = new Map<string, { title: string; ownerUsername: string }>()
    if (offeringIds.length > 0) {
      const offs = await db
        .select({
          id: schema.presenterOfferings.id,
          title: schema.presenterOfferings.title,
          ownerUsername: schema.users.username,
        })
        .from(schema.presenterOfferings)
        .innerJoin(schema.users, eq(schema.presenterOfferings.userId, schema.users.id))
        .where(inArray(schema.presenterOfferings.id, offeringIds))
      for (const o of offs) {
        offeringById.set(o.id, { title: o.title, ownerUsername: o.ownerUsername })
      }
    }

    const payload = rows.map((s) => {
      const staffFull = staffBySlot[s.id] ?? []
      const staffOut = includeStaffOnProgram
        ? staffFull
        : filterStaffRowsForAttendeeAllowlist(staffFull, staffRoleAllowlist)
      return {
        ...s,
        presenters: presentersBySlot[s.id] ?? [],
        presenterOffering:
          s.presenterOfferingId ? (offeringById.get(s.presenterOfferingId) ?? null) : null,
        materials: materialBySlot.get(s.id) ?? [],
        staff: staffOut,
      }
    })
    const rev = createHash('sha256')
      .update(
        payload
          .map((s) => {
            const staffSig = (s.staff as StaffRow[])
              .map((x) => `${x.id}:${x.startsAt}:${x.endsAt}:${x.userId}:${x.vendorSlug ?? ''}:${x.presenterPublic ? 1 : 0}`)
              .sort()
              .join(',')
            const presSig = (s.presenters as PresRow[])
              .map((x) => `${x.userId}:${x.sortOrder}:${x.vendorSlug ?? ''}:${x.presenterPublic ? 1 : 0}`)
              .sort()
              .join(',')
            const po = s.presenterOffering as { title: string; ownerUsername: string } | null | undefined
            const offSig = po ? `${po.title}:${po.ownerUsername}` : ''
            return `${s.id}:${new Date(s.updatedAt ?? s.createdAt).toISOString()}:st:${staffSig}:pr:${presSig}:po:${offSig}`
          })
          .sort()
          .join('|')
      )
      .digest('hex')
      .slice(0, 20)
    const labeledPayload = await withAlphaLabels('schedule_slot', payload)
    return reply.send({ items: labeledPayload, scheduleRevision: rev })
  })

  app.post('/api/v1/conventions/:key/slots/:slotId/materials', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({ title: z.string().min(1).max(255), url: z.string().url().max(2000) })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'scheduler'))) return
    const [slot] = await db
      .select()
      .from(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, resolved.conv.id)))
      .limit(1)
    if (!slot) return reply.status(404).send({ error: 'Slot not found' })
    const [material] = await db
      .insert(schema.scheduleSlotMaterials)
      .values({
        scheduleSlotId: slotId,
        title: parsed.data.title,
        url: parsed.data.url,
        createdByUserId: actor.userId,
      })
      .returning()
    return reply.send({ material })
  })

  app.post('/api/v1/conventions/:key/slots/:slotId/signup', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [slot] = await db
      .select()
      .from(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, resolved.conv.id)))
      .limit(1)
    if (!slot) return reply.status(404).send({ error: 'Slot not found' })
    if (!slot.isPublished) return reply.status(404).send({ error: 'Slot not found' })
    const existing = await db
      .select({ startsAt: schema.dancecardEntries.startsAt, endsAt: schema.dancecardEntries.endsAt })
      .from(schema.dancecardEntries)
      .where(
        and(
          eq(schema.dancecardEntries.conventionId, resolved.conv.id),
          eq(schema.dancecardEntries.userId, actor.userId)
        )
      )
    const conflict = hasTimeConflict(new Date(slot.startsAt), new Date(slot.endsAt), existing)
    await db
      .insert(schema.scheduleSlotSignups)
      .values({ scheduleSlotId: slot.id, userId: actor.userId })
      .onConflictDoNothing()
    await db
      .insert(schema.dancecardEntries)
      .values({
        conventionId: resolved.conv.id,
        userId: actor.userId,
        title: slot.title,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        sourceKind: 'slot_signup',
        sourceId: slot.id,
        location: slot.location,
      })
      .onConflictDoNothing()
    if (conflict) {
      await createNotification(actor.userId, 'schedule_conflict_detected', {
        conventionId: resolved.conv.id,
        slotId: slot.id,
        title: slot.title,
      })
    }
    publishToScope(`convention:${resolved.conv.id}:schedule`, 'schedule_slot_signup', {
      userId: actor.userId,
      slotId: slot.id,
      conflict,
    })
    return reply.send({ ok: true, conflict })
  })

  app.get('/api/v1/conventions/:key/dancecard', async (req, reply) => {
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
      .from(schema.dancecardEntries)
      .where(
        and(
          eq(schema.dancecardEntries.conventionId, resolved.conv.id),
          eq(schema.dancecardEntries.userId, actor.userId)
        )
      )
      .orderBy(asc(schema.dancecardEntries.startsAt))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/conventions/:key/dancecard/organizer-handoff', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'admin'))) return
    const settings = (resolved.conv.settings ?? {}) as ConventionPublicSettings
    const dancecardSlug = settings.dancecardSlug?.trim()
    if (!dancecardSlug || settings.dancecardEnabled === false) {
      return reply.status(400).send({ error: 'Link a Dancecard slug in convention settings first' })
    }
    const [userRow] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, actor.userId))
      .limit(1)
    const code = mintDancecardHandoffCode({
      dancecardSlug,
      c2kConventionSlug: resolved.conv.slug,
      email: userRow?.email ?? undefined,
    })
    if (!code) {
      return reply.status(503).send({ error: 'DANCECARD_C2K_HANDOFF_SECRET not configured' })
    }
    return reply.send({ code, expiresAt: new Date(Date.now() + 60_000).toISOString() })
  })

  app.post('/api/v1/conventions/:key/dancecard', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        title: z.string().min(1).max(255),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        location: z.string().max(512).optional(),
        notes: z.string().max(2000).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    const existing = await db
      .select({ startsAt: schema.dancecardEntries.startsAt, endsAt: schema.dancecardEntries.endsAt })
      .from(schema.dancecardEntries)
      .where(
        and(
          eq(schema.dancecardEntries.conventionId, resolved.conv.id),
          eq(schema.dancecardEntries.userId, actor.userId)
        )
      )
    const conflict = hasTimeConflict(startsAt, endsAt, existing)
    const [entry] = await db
      .insert(schema.dancecardEntries)
      .values({
        conventionId: resolved.conv.id,
        userId: actor.userId,
        title: parsed.data.title,
        startsAt,
        endsAt,
        location: parsed.data.location,
        notes: parsed.data.notes,
      })
      .returning()
    if (conflict) {
      await createNotification(actor.userId, 'schedule_conflict_detected', {
        conventionId: resolved.conv.id,
        dancecardEntryId: entry?.id,
        title: parsed.data.title,
      })
    }
    return reply.send({ entry, conflict })
  })

  app.delete('/api/v1/conventions/:key/dancecard/entries/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, id } = req.params as { key: string; id: string }
    if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [row] = await db
      .delete(schema.dancecardEntries)
      .where(
        and(
          eq(schema.dancecardEntries.id, id),
          eq(schema.dancecardEntries.conventionId, resolved.conv.id),
          eq(schema.dancecardEntries.userId, actor.userId),
        ),
      )
      .returning({ id: schema.dancecardEntries.id })
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.post('/api/v1/conventions/:key/slots', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key } = req.params as { key: string }
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, user.userId, reply, 'scheduler'))) return
    const parsed = slotBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const gal = parsed.data.imageGallery ?? []
    let description = parsed.data.description
    if (parsed.data.presenterOfferingId) {
      const [off] = await db
        .select()
        .from(schema.presenterOfferings)
        .where(eq(schema.presenterOfferings.id, parsed.data.presenterOfferingId))
        .limit(1)
      if (off && !description?.trim()) {
        description = [off.tease, off.outline].filter((x) => x?.trim()).join('\n\n') || undefined
      }
    }
    const [row] = await db
      .insert(schema.scheduleSlots)
      .values({
        conventionId: id,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        title: parsed.data.title,
        description,
        location: parsed.data.location,
        linkUrl: parsed.data.linkUrl || undefined,
        imageGallery: gal,
        blockId: parsed.data.blockId ?? undefined,
        sortOrder: parsed.data.sortOrder ?? 0,
        trackLabel: parsed.data.trackLabel?.trim() || undefined,
        roomLabel: parsed.data.roomLabel?.trim() || undefined,
        presenterOfferingId: parsed.data.presenterOfferingId ?? undefined,
        importKey: parsed.data.importKey?.trim() || undefined,
        updatedAt: new Date(),
      })
      .returning()
    const warnings = await computeAllConventionScheduleWarnings(id)
    publishToScope(`convention:${id}:schedule`, 'schedule_slot_created', {
      slotId: row?.id,
      title: row?.title,
      startsAt: row?.startsAt,
      endsAt: row?.endsAt,
    })
    return reply.send({ slot: row, warnings })
  })

  app.patch('/api/v1/conventions/:key/slots/:slotId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, user.userId, reply, 'scheduler'))) return
    const [slot] = await db
      .select()
      .from(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, id)))
      .limit(1)
    if (!slot) return reply.status(404).send({ error: 'Slot not found' })
    const parsed = slotPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const d = parsed.data
    const setPayload = {
      ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
      ...(d.endsAt !== undefined ? { endsAt: new Date(d.endsAt) } : {}),
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.location !== undefined ? { location: d.location } : {}),
      ...(d.linkUrl !== undefined ? { linkUrl: d.linkUrl || undefined } : {}),
      ...(d.imageGallery !== undefined ? { imageGallery: d.imageGallery } : {}),
      ...(d.blockId !== undefined ? { blockId: d.blockId ?? undefined } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      ...(d.trackLabel !== undefined ? { trackLabel: d.trackLabel?.trim() || null } : {}),
      ...(d.roomLabel !== undefined ? { roomLabel: d.roomLabel?.trim() || null } : {}),
      ...(d.presenterOfferingId !== undefined ? { presenterOfferingId: d.presenterOfferingId ?? null } : {}),
      ...(d.importKey !== undefined ? { importKey: d.importKey?.trim() || null } : {}),
      updatedAt: new Date(),
    }
    const payloadKeys = Object.keys(setPayload).filter((k) => k !== 'updatedAt')
    if (payloadKeys.length === 0) return reply.status(400).send({ error: 'No changes' })
    const [updated] = await db
      .update(schema.scheduleSlots)
      .set(setPayload)
      .where(eq(schema.scheduleSlots.id, slotId))
      .returning()
    const warnings = await computeAllConventionScheduleWarnings(id)
    publishToScope(`convention:${id}:schedule`, 'schedule_slot_updated', { slotId })
    return reply.send({ slot: updated, warnings })
  })

  app.delete('/api/v1/conventions/:key/slots/:slotId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, user.userId, reply, 'scheduler'))) return
    const del = await db
      .delete(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, id)))
      .returning({ id: schema.scheduleSlots.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Slot not found' })
    publishToScope(`convention:${id}:schedule`, 'schedule_slot_deleted', { slotId })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/conventions/:key/slots/export.csv', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, actor.userId, reply, 'scheduler'))) return
    const rows = await db
      .select()
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, cid))
      .orderBy(asc(schema.scheduleSlots.startsAt))
    const slotIds = rows.map((r) => r.id)
    const presentersBySlot: Record<string, string[]> = {}
    if (slotIds.length > 0) {
      const allPres = await db
        .select({
          scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId,
          username: schema.users.username,
          sortOrder: schema.scheduleSlotPresenters.sortOrder,
        })
        .from(schema.scheduleSlotPresenters)
        .innerJoin(schema.users, eq(schema.scheduleSlotPresenters.userId, schema.users.id))
        .where(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds))
        .orderBy(asc(schema.scheduleSlotPresenters.sortOrder))
      for (const p of allPres) {
        if (!presentersBySlot[p.scheduleSlotId]) presentersBySlot[p.scheduleSlotId] = []
        presentersBySlot[p.scheduleSlotId]!.push(p.username)
      }
    }
    const header = [
      'importKey',
      'startsAt',
      'endsAt',
      'title',
      'description',
      'location',
      'linkUrl',
      'trackLabel',
      'roomLabel',
      'presenterUsernames',
    ]
    const lines = [header.join(',')]
    for (const s of rows) {
      const pres = (presentersBySlot[s.id] ?? []).join('|')
      lines.push(
        [
          escapeCsvCell(s.importKey ?? ''),
          escapeCsvCell(new Date(s.startsAt).toISOString()),
          escapeCsvCell(new Date(s.endsAt).toISOString()),
          escapeCsvCell(s.title),
          escapeCsvCell(s.description ?? ''),
          escapeCsvCell(s.location ?? ''),
          escapeCsvCell(s.linkUrl ?? ''),
          escapeCsvCell(s.trackLabel ?? ''),
          escapeCsvCell(s.roomLabel ?? ''),
          escapeCsvCell(pres),
        ].join(',')
      )
    }
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="convention-${conv.slug}-program.csv"`)
      .send(lines.join('\r\n'))
  })

  app.post('/api/v1/conventions/:key/slots/import-csv', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, actor.userId, reply, 'scheduler'))) return
    const body = z.object({ csv: z.string().min(1).max(2_000_000) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })
    const table = parseCsvRows(body.data.csv.trim())
    if (table.length < 2) return reply.status(400).send({ error: 'CSV needs a header and one row' })
    const hdr = table[0]!.map((h) => h.trim().toLowerCase())
    const ix = (name: string) => hdr.indexOf(name)
    const required = ['startsat', 'endsat', 'title'] as const
    for (const r of required) {
      if (ix(r) < 0) return reply.status(400).send({ error: `Missing column: ${r}` })
    }
    let created = 0
    let updated = 0
    const errors: string[] = []
    const candidates = []
    for (let ri = 1; ri < table.length; ri++) {
      const row = table[ri]!
      const g = (names: string[]) => {
        for (const n of names) {
          const i = ix(n)
          if (i >= 0 && row[i] !== undefined) return row[i]!.trim()
        }
        return ''
      }
      candidates.push(candidateFromCsvRow(ri, g, `csv:${conv.slug}`))
    }
    const { summary } = await publishProgramCandidates(cid, candidates)
    created = summary.created
    updated = summary.updated
    errors.push(...summary.errors)
    for (const c of candidates) {
      if (c.validationErrors.length) {
        errors.push(`${c.sourceRowKey}: ${c.validationErrors.join('; ')}`)
      }
    }
    const warnings = summary.warnings ?? (await computeAllConventionScheduleWarnings(cid))
    return reply.send({ ok: true, created, updated, unchanged: summary.unchanged, errors, warnings })
  })

  app.get('/api/v1/conventions/:key/schedule-warnings', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, actor.userId, reply, 'scheduler'))) return
    const warnings = await computeAllConventionScheduleWarnings(cid)
    return reply.send({ warnings })
  })

  app.get('/api/v1/conventions/:key/calendar-feed/:token', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key, token: tokenParam } = req.params as { key: string; token: string }
    const rawToken = tokenParam.replace(/\.ics$/i, '')
    if (!rawToken) return reply.status(400).send({ error: 'Invalid token' })
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [convRow] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!convRow) return reply.status(404).send({ error: 'Not found' })
    const built = await buildConventionCalendarFeedIcs(convRow.id, convRow.slug, convRow.name, rawToken)
    if (!built.ok) {
      return reply.status(built.status).send({ error: built.status === 410 ? 'Feed revoked' : 'Not found' })
    }
    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Cache-Control', 'private, max-age=300')
      .send(built.ics)
  })

  app.get('/api/v1/conventions/:key/program.ics', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [convRow] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!convRow) return reply.status(404).send({ error: 'Not found' })
    const listingPublic = isPublicProgramListing(convRow.settings)
    if (!listingPublic) {
      const resolved = await getConventionWithAccess(key, viewerId)
      if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
      if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
      if (!resolved.canView && !resolved.canManage) {
        return reply.status(403).send({ error: 'Program export requires attendee access' })
      }
    }
    const allIcsRows = await db
      .select()
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, cid))
      .orderBy(asc(schema.scheduleSlots.startsAt))
    const staffAccess = await getConventionWithAccess(key, viewerId)
    const includeStaffOnProgram =
      !('notFound' in staffAccess) &&
      !('forbidden' in staffAccess) &&
      (staffAccess.canManage || staffAccess.isStaff)
    const programViewer = publicProgramViewerFromAccess(includeStaffOnProgram, viewerId)
    const rows = filterSlotsForPublicProgram(allIcsRows, programViewer)
    const base =
      (process.env.C2K_WEB_PUBLIC_URL ?? process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
    const convUrl = `${base}/conventions/${encodeURIComponent(convRow.slug)}`
    const events = rows.map((s) => ({
      uid: `${s.id}@c2k-program`,
      title: s.title,
      description: [s.description, s.trackLabel ? `Track: ${s.trackLabel}` : '', s.roomLabel ? `Room: ${s.roomLabel}` : '']
        .filter(Boolean)
        .join('\n'),
      startsAt: new Date(s.startsAt),
      endsAt: new Date(s.endsAt),
      location: s.location,
      url: convUrl,
    }))
    const ics = buildProgramIcsCalendar(events)
    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="convention-${convRow.slug}-program.ics"`)
      .send(ics)
  })

  app.post('/api/v1/conventions/:key/clone', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        newSlug: z.string().min(2).max(128),
        name: z.string().min(1).max(255).optional(),
        anchorEventId: z.string().uuid().optional().nullable(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const cid = await resolveConventionId(key)
    if (!cid) return reply.status(404).send({ error: 'Not found' })
    const [src] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, cid)).limit(1)
    if (!src) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(src, actor.userId, reply, 'admin'))) return
    try {
      const [newConv] = await db
        .insert(schema.conventions)
        .values({
          slug: parsed.data.newSlug,
          name: parsed.data.name ?? `${src.name} (copy)`,
          description: src.description,
          organizationId: src.organizationId,
          anchorEventId: parsed.data.anchorEventId ?? undefined,
          timezone: src.timezone,
          startsAt: src.startsAt,
          endsAt: src.endsAt,
          settings: src.settings ?? {},
        })
        .returning()
      if (!newConv) return reply.status(500).send({ error: 'Clone failed' })
      const oldSlots = await db
        .select()
        .from(schema.scheduleSlots)
        .where(eq(schema.scheduleSlots.conventionId, cid))
        .orderBy(asc(schema.scheduleSlots.startsAt))
      const idMap = new Map<string, string>()
      for (const s of oldSlots) {
        const [ins] = await db
          .insert(schema.scheduleSlots)
          .values({
            conventionId: newConv.id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            title: s.title,
            description: s.description,
            location: s.location,
            linkUrl: s.linkUrl,
            imageGallery: s.imageGallery,
            blockId: undefined,
            sortOrder: s.sortOrder,
            trackLabel: s.trackLabel,
            roomLabel: s.roomLabel,
            presenterOfferingId: s.presenterOfferingId,
            importKey: s.importKey,
            updatedAt: new Date(),
          })
          .returning({ id: schema.scheduleSlots.id })
        if (ins?.id) idMap.set(s.id, ins.id)
      }
      for (const s of oldSlots) {
        const newId = idMap.get(s.id)
        if (!newId) continue
        const pres = await db
          .select()
          .from(schema.scheduleSlotPresenters)
          .where(eq(schema.scheduleSlotPresenters.scheduleSlotId, s.id))
        for (const p of pres) {
          await db.insert(schema.scheduleSlotPresenters).values({
            scheduleSlotId: newId,
            userId: p.userId,
            sortOrder: p.sortOrder,
          })
        }
        const mats = await db
          .select()
          .from(schema.scheduleSlotMaterials)
          .where(eq(schema.scheduleSlotMaterials.scheduleSlotId, s.id))
        for (const m of mats) {
          await db.insert(schema.scheduleSlotMaterials).values({
            scheduleSlotId: newId,
            title: m.title,
            url: m.url,
            createdByUserId: actor.userId,
          })
        }
        const stf = await db
          .select()
          .from(schema.scheduleSlotStaff)
          .where(eq(schema.scheduleSlotStaff.scheduleSlotId, s.id))
        for (const st of stf) {
          await db.insert(schema.scheduleSlotStaff).values({
            scheduleSlotId: newId,
            userId: st.userId,
            roleLabel: st.roleLabel,
            station: st.station ?? undefined,
            notes: st.notes ?? undefined,
            startsAt: st.startsAt,
            endsAt: st.endsAt,
            updatedAt: new Date(),
          })
        }
      }
      const oldDuties = await db
        .select()
        .from(schema.conventionStaffDuties)
        .where(eq(schema.conventionStaffDuties.conventionId, cid))
      for (const d of oldDuties) {
        await db.insert(schema.conventionStaffDuties).values({
          conventionId: newConv.id,
          userId: d.userId,
          roleLabel: d.roleLabel,
          station: d.station ?? undefined,
          location: d.location ?? undefined,
          notes: d.notes ?? undefined,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          importKey: d.importKey ?? undefined,
          updatedAt: new Date(),
        })
      }
      const docs = await db.select().from(schema.conventionDocuments).where(eq(schema.conventionDocuments.conventionId, cid))
      for (const d of docs) {
        await db.insert(schema.conventionDocuments).values({
          conventionId: newConv.id,
          title: d.title,
          type: d.type,
          url: d.url,
          visibility: d.visibility,
          sortOrder: d.sortOrder,
          createdByUserId: actor.userId,
        })
      }
      const pages = await db
        .select()
        .from(schema.conventionCustomPages)
        .where(eq(schema.conventionCustomPages.conventionId, cid))
      for (const p of pages) {
        await db.insert(schema.conventionCustomPages).values({
          conventionId: newConv.id,
          slug: `${p.slug}-copy-${newConv.id.slice(0, 6)}`,
          title: p.title,
          visibility: p.visibility,
          sortOrder: p.sortOrder,
          content: p.content,
        })
      }
      return reply.send({ convention: newConv })
    } catch {
      return reply.status(409).send({ error: 'Slug may already exist' })
    }
  })

  app.get('/api/v1/conventions/:key/volunteer-shifts', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const resolved = await getConventionWithAccess(key, viewerId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView && !resolved.canManage) return reply.status(403).send({ error: 'Attendee access required' })
    const rows = await db
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id))
      .orderBy(asc(schema.conventionVolunteerShifts.startsAt))
    const shiftIds = rows.map((r) => r.id)
    const counts = new Map<string, number>()
    if (shiftIds.length > 0) {
      const signups = await db
        .select({ shiftId: schema.conventionVolunteerShiftSignups.shiftId })
        .from(schema.conventionVolunteerShiftSignups)
        .where(inArray(schema.conventionVolunteerShiftSignups.shiftId, shiftIds))
      for (const s of signups) {
        counts.set(s.shiftId, (counts.get(s.shiftId) ?? 0) + 1)
      }
    }
    return reply.send({
      items: rows.map((r) => ({
        ...r,
        signupCount: counts.get(r.id) ?? 0,
      })),
    })
  })

  app.post('/api/v1/conventions/:key/volunteer-shifts', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        title: z.string().min(1).max(255),
        description: z.string().max(5000).optional(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        location: z.string().max(512).optional(),
        capacityMax: z.number().int().positive().optional().nullable(),
        sortOrder: z.number().int().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'staff_ops'))) return
    const [row] = await db
      .insert(schema.conventionVolunteerShifts)
      .values({
        conventionId: resolved.conv.id,
        title: parsed.data.title,
        description: parsed.data.description,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        location: parsed.data.location,
        capacityMax: parsed.data.capacityMax ?? undefined,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ shift: row })
  })

  app.delete('/api/v1/conventions/:key/volunteer-shifts/:shiftId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, shiftId } = req.params as { key: string; shiftId: string }
    if (!UUID_RE.test(shiftId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'staff_ops'))) return
    const del = await db
      .delete(schema.conventionVolunteerShifts)
      .where(
        and(
          eq(schema.conventionVolunteerShifts.id, shiftId),
          eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id)
        )
      )
      .returning({ id: schema.conventionVolunteerShifts.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.post('/api/v1/conventions/:key/volunteer-shifts/:shiftId/signup', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, shiftId } = req.params as { key: string; shiftId: string }
    if (!UUID_RE.test(shiftId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const [shift] = await db
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(
        and(
          eq(schema.conventionVolunteerShifts.id, shiftId),
          eq(schema.conventionVolunteerShifts.conventionId, resolved.conv.id)
        )
      )
      .limit(1)
    if (!shift) return reply.status(404).send({ error: 'Not found' })
    if (shift.capacityMax != null) {
      const [cntRow] = await db
        .select({ n: count() })
        .from(schema.conventionVolunteerShiftSignups)
        .where(eq(schema.conventionVolunteerShiftSignups.shiftId, shiftId))
      const c = Number(cntRow?.n ?? 0)
      if (c >= shift.capacityMax) return reply.status(409).send({ error: 'Shift is full' })
    }
    await db
      .insert(schema.conventionVolunteerShiftSignups)
      .values({ shiftId, userId: actor.userId })
      .onConflictDoNothing()
    return reply.send({ ok: true })
  })

  app.get('/api/v1/conventions/:key/check-ins', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await userHasConventionCommandPermission(resolved.conv, actor.userId, 'registration'))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const rows = await db
      .select({
        id: schema.conventionCheckIns.id,
        userId: schema.conventionCheckIns.userId,
        checkedInAt: schema.conventionCheckIns.checkedInAt,
        method: schema.conventionCheckIns.method,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.conventionCheckIns)
      .innerJoin(schema.users, eq(schema.conventionCheckIns.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.conventionCheckIns.conventionId, resolved.conv.id))
      .orderBy(desc(schema.conventionCheckIns.checkedInAt))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/conventions/:key/check-ins', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ userId: z.string().uuid(), method: z.enum(['staff', 'qr']).optional() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await userHasConventionCommandPermission(resolved.conv, actor.userId, 'registration'))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const [row] = await db
      .insert(schema.conventionCheckIns)
      .values({
        conventionId: resolved.conv.id,
        userId: parsed.data.userId,
        checkedInByUserId: actor.userId,
        method: parsed.data.method ?? 'staff',
      })
      .onConflictDoUpdate({
        target: [schema.conventionCheckIns.conventionId, schema.conventionCheckIns.userId],
        set: {
          checkedInAt: new Date(),
          checkedInByUserId: actor.userId,
          method: parsed.data.method ?? 'staff',
        },
      })
      .returning()
    return reply.send({ checkIn: row })
  })

  const createConventionBody = z.object({
    slug: z.string().min(2).max(128),
    name: z.string().min(1).max(255),
    description: z.string().max(20000).optional(),
    organizationId: z.string().uuid(),
    anchorEventId: z.string().uuid().optional().nullable(),
    timezone: z.string().max(64).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    settings: conventionSettingsSchema.optional(),
  })

  app.post('/api/v1/conventions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = createConventionBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const m = await orgMembership(parsed.data.organizationId, user.userId)
    if (!m || ORG_ROLE_RANK[m.role] < ORG_ROLE_RANK.ADMIN) {
      return reply.status(403).send({ error: 'Admin role required' })
    }
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, parsed.data.organizationId))
      .limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).calendarEnabled) {
      return reply.status(400).send({ error: 'Organization calendar disabled' })
    }
    try {
      const initialSettings =
        parsed.data.settings !== undefined
          ? mergeConventionSettings({}, normalizeConventionSettingsPatch(parsed.data.settings))
          : undefined
      const [row] = await db
        .insert(schema.conventions)
        .values({
          slug: parsed.data.slug,
          name: parsed.data.name,
          description: parsed.data.description,
          organizationId: parsed.data.organizationId,
          anchorEventId: parsed.data.anchorEventId ?? undefined,
          timezone: parsed.data.timezone ?? 'America/New_York',
          startsAt: new Date(parsed.data.startsAt),
          endsAt: new Date(parsed.data.endsAt),
          ...(initialSettings !== undefined ? { settings: initialSettings } : {}),
        })
        .returning()
      return reply.send({ convention: row })
    } catch {
      return reply.status(409).send({ error: 'Slug may already exist' })
    }
  })

  app.get('/api/v1/conventions/:key/custom-pages', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView) return reply.status(403).send({ error: 'Attendee access required' })
    const rows = await db
      .select()
      .from(schema.conventionCustomPages)
      .where(eq(schema.conventionCustomPages.conventionId, resolved.conv.id))
      .orderBy(asc(schema.conventionCustomPages.sortOrder), asc(schema.conventionCustomPages.title))
    const filtered = rows.filter((row) => {
      if (row.visibility === 'PUBLIC') return true
      if (row.visibility === 'ATTENDEE') return resolved.hasPaidAccess || resolved.isStaff || resolved.canManage
      return resolved.isStaff || resolved.canManage
    })
    return reply.send({ items: filtered })
  })

  app.post('/api/v1/conventions/:key/custom-pages', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = customPageBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'admin'))) return
    try {
      const [page] = await db
        .insert(schema.conventionCustomPages)
        .values({
          conventionId: resolved.conv.id,
          slug: parsed.data.slug.trim().toLowerCase(),
          title: parsed.data.title,
          visibility: parsed.data.visibility ?? 'ATTENDEE',
          sortOrder: parsed.data.sortOrder ?? 0,
          content: parsed.data.content ?? {},
        })
        .returning()
      return reply.send({ page })
    } catch {
      return reply.status(409).send({ error: 'Page slug already exists' })
    }
  })

  app.patch('/api/v1/conventions/:key/custom-pages/:pageId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, pageId } = req.params as { key: string; pageId: string }
    if (!UUID_RE.test(pageId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = customPageBody.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'admin'))) return
    const [existing] = await db
      .select()
      .from(schema.conventionCustomPages)
      .where(
        and(
          eq(schema.conventionCustomPages.id, pageId),
          eq(schema.conventionCustomPages.conventionId, resolved.conv.id)
        )
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const slugNext =
      parsed.data.slug !== undefined ? parsed.data.slug.trim().toLowerCase() : existing.slug
    try {
      const [page] = await db
        .update(schema.conventionCustomPages)
        .set({
          ...(parsed.data.slug !== undefined ? { slug: slugNext } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
          ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
          ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.conventionCustomPages.id, pageId))
        .returning()
      return reply.send({ page })
    } catch {
      return reply.status(409).send({ error: 'Page slug already exists' })
    }
  })

  app.delete('/api/v1/conventions/:key/custom-pages/:pageId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, pageId } = req.params as { key: string; pageId: string }
    if (!UUID_RE.test(pageId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'admin'))) return
    const del = await db
      .delete(schema.conventionCustomPages)
      .where(
        and(
          eq(schema.conventionCustomPages.id, pageId),
          eq(schema.conventionCustomPages.conventionId, resolved.conv.id)
        )
      )
      .returning({ id: schema.conventionCustomPages.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/conventions/:key/presenter-requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const rows = await db
      .select()
      .from(schema.conventionPresenterRequests)
      .where(
        resolved.canManage
          ? eq(schema.conventionPresenterRequests.conventionId, resolved.conv.id)
          : and(
              eq(schema.conventionPresenterRequests.conventionId, resolved.conv.id),
              eq(schema.conventionPresenterRequests.presenterUserId, actor.userId)
            )
      )
      .orderBy(desc(schema.conventionPresenterRequests.updatedAt))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/conventions/:key/presenter-requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const singleSchema = z.object({
      title: z.string().min(1).max(255),
      presenterOfferingId: z.string().uuid().optional(),
      roomNeeds: z.string().max(5000).optional(),
      materialNeeds: z.string().max(5000).optional(),
    })
    const batchSchema = z.object({
      offerings: z.array(
        z.object({
          presenterOfferingId: z.string().uuid(),
          roomNeeds: z.string().max(5000).optional(),
          materialNeeds: z.string().max(5000).optional(),
        }),
      ).min(1).max(20),
    })
    const body = req.body as unknown
    const batchParsed = batchSchema.safeParse(body)
    const singleParsed = batchParsed.success ? null : singleSchema.safeParse(body)
    if (!batchParsed.success && !singleParsed?.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const participation = participationFromConventionSettings(
      resolved.conv.settings as Record<string, unknown> | null,
    )
    if (!isParticipationWindowOpen(participation.presenterApply)) {
      return reply.status(403).send({ error: 'Presenter applications are not open' })
    }

    const insertOne = async (item: {
      title: string
      presenterOfferingId?: string
      roomNeeds?: string
      materialNeeds?: string
    }) => {
      if (item.presenterOfferingId) {
        const [offering] = await db
          .select()
          .from(schema.presenterOfferings)
          .where(
            and(
              eq(schema.presenterOfferings.id, item.presenterOfferingId),
              eq(schema.presenterOfferings.userId, actor.userId),
            ),
          )
          .limit(1)
        if (!offering) throw new Error('invalid_offering')
        const [dup] = await db
          .select({ id: schema.conventionPresenterRequests.id })
          .from(schema.conventionPresenterRequests)
          .where(
            and(
              eq(schema.conventionPresenterRequests.conventionId, resolved.conv.id),
              eq(schema.conventionPresenterRequests.presenterUserId, actor.userId),
              eq(schema.conventionPresenterRequests.presenterOfferingId, item.presenterOfferingId),
              inArray(schema.conventionPresenterRequests.status, ['PENDING', 'OFFERED', 'APPROVED', 'OFFER_ACCEPTED']),
            ),
          )
          .limit(1)
        if (dup) throw new Error('duplicate')
      }
      const [request] = await db
        .insert(schema.conventionPresenterRequests)
        .values({
          conventionId: resolved.conv.id,
          presenterUserId: actor.userId,
          presenterOfferingId: item.presenterOfferingId,
          title: item.title,
          roomNeeds: item.roomNeeds,
          materialNeeds: item.materialNeeds,
        })
        .returning()
      return request
    }

    try {
      if (batchParsed.success) {
        const created = []
        for (const o of batchParsed.data.offerings) {
          const [offering] = await db
            .select({ title: schema.presenterOfferings.title })
            .from(schema.presenterOfferings)
            .where(
              and(
                eq(schema.presenterOfferings.id, o.presenterOfferingId),
                eq(schema.presenterOfferings.userId, actor.userId),
              ),
            )
            .limit(1)
          if (!offering) return reply.status(400).send({ error: 'Invalid offering' })
          const row = await insertOne({
            title: offering.title,
            presenterOfferingId: o.presenterOfferingId,
            roomNeeds: o.roomNeeds,
            materialNeeds: o.materialNeeds,
          })
          created.push(row)
        }
        return reply.send({ requests: created })
      }
      if (!singleParsed?.success) return reply.status(400).send({ error: 'Invalid body' })
      const request = await insertOne(singleParsed.data)
      return reply.send({ request })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'duplicate') return reply.status(409).send({ error: 'Already submitted for this class' })
      if (msg === 'invalid_offering') return reply.status(400).send({ error: 'Invalid offering' })
      throw e
    }
  })

  app.patch('/api/v1/conventions/:key/presenter-requests/:requestId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, requestId } = req.params as { key: string; requestId: string }
    if (!UUID_RE.test(requestId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'OFFERED', 'OFFER_ACCEPTED', 'OFFER_DECLINED']).optional(),
        reviewNotes: z.string().max(5000).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'scheduler'))) return
    const [existing] = await db
      .select()
      .from(schema.conventionPresenterRequests)
      .where(
        and(
          eq(schema.conventionPresenterRequests.id, requestId),
          eq(schema.conventionPresenterRequests.conventionId, resolved.conv.id)
        )
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const [updated] = await db
      .update(schema.conventionPresenterRequests)
      .set({
        status: parsed.data.status ?? existing.status,
        reviewNotes: parsed.data.reviewNotes ?? existing.reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionPresenterRequests.id, existing.id))
      .returning()
    return reply.send({ request: updated })
  })

  app.post('/api/v1/conventions/:key/presenter-requests/:requestId/promote-to-slot', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, requestId } = req.params as { key: string; requestId: string }
    if (!UUID_RE.test(requestId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        roomLabel: z.string().max(128).optional(),
        trackLabel: z.string().max(128).optional(),
        location: z.string().max(512).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!(await requireHubConventionMutation(resolved.conv, actor.userId, reply, 'scheduler'))) return
    const [existing] = await db
      .select()
      .from(schema.conventionPresenterRequests)
      .where(
        and(
          eq(schema.conventionPresenterRequests.id, requestId),
          eq(schema.conventionPresenterRequests.conventionId, resolved.conv.id)
        )
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    if (existing.status !== 'APPROVED') {
      return reply.status(400).send({ error: 'Presenter request must be approved before promoting to a slot' })
    }
    let description: string | undefined
    if (existing.presenterOfferingId) {
      const [off] = await db
        .select()
        .from(schema.presenterOfferings)
        .where(eq(schema.presenterOfferings.id, existing.presenterOfferingId))
        .limit(1)
      if (off) {
        description = [off.tease, off.outline].filter((x) => x?.trim()).join('\n\n') || undefined
      }
    }
    const [slot] = await db
      .insert(schema.scheduleSlots)
      .values({
        conventionId: resolved.conv.id,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        title: existing.title,
        description,
        location: parsed.data.location,
        presenterOfferingId: existing.presenterOfferingId ?? undefined,
        roomLabel: parsed.data.roomLabel?.trim() || undefined,
        trackLabel: parsed.data.trackLabel?.trim() || undefined,
        updatedAt: new Date(),
      })
      .returning()
    if (!slot) return reply.status(500).send({ error: 'Could not create slot' })
    await db.insert(schema.scheduleSlotPresenters).values({
      scheduleSlotId: slot.id,
      userId: existing.presenterUserId,
      sortOrder: 0,
    })
    emitActivity({
      actorId: existing.presenterUserId,
      verb: 'presenter_assigned',
      objectType: 'schedule_slot',
      objectId: slot.id,
      metadata: {
        slotTitle: slot.title,
        conventionKey: resolved.conv.slug,
        conventionSlug: resolved.conv.slug,
      },
    })
    publishToScope(`convention:${resolved.conv.id}:schedule`, 'schedule_slot_promoted', {
      slotId: slot.id,
      requestId: existing.id,
    })
    const warnings = await computeAllConventionScheduleWarnings(resolved.conv.id)
    return reply.send({ slot, warnings })
  })

  const slotPresentersBody = z.object({
    userIds: z.array(z.string().uuid()).max(20),
  })
  app.put('/api/v1/conventions/:key/slots/:slotId/presenters', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    const id = await resolveConventionId(key)
    if (!id || !UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, user.userId, reply, 'scheduler'))) return
    const [slot] = await db
      .select()
      .from(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, id)))
      .limit(1)
    if (!slot) return reply.status(404).send({ error: 'Slot not found' })
    const parsed = slotPresentersBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db.delete(schema.scheduleSlotPresenters).where(eq(schema.scheduleSlotPresenters.scheduleSlotId, slotId))
    let i = 0
    for (const uid of parsed.data.userIds) {
      await db.insert(schema.scheduleSlotPresenters).values({
        scheduleSlotId: slotId,
        userId: uid,
        sortOrder: i++,
      })
      emitActivity({
        actorId: uid,
        verb: 'presenter_assigned',
        objectType: 'schedule_slot',
        objectId: slotId,
        metadata: {
          slotTitle: slot.title,
          conventionKey: conv.slug,
          conventionSlug: conv.slug,
        },
      })
    }
    return reply.send({ ok: true })
  })

  const slotStaffAssignment = z.object({
    userId: z.string().uuid(),
    roleLabel: z.string().min(1).max(128).optional(),
    station: z.string().max(512).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  const slotStaffPutBody = z.object({ assignments: z.array(slotStaffAssignment).max(40) })

  app.put('/api/v1/conventions/:key/slots/:slotId/staff', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    const id = await resolveConventionId(key)
    if (!id || !UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireHubConventionMutation(conv, user.userId, reply, 'staff_ops'))) return
    const [slot] = await db
      .select()
      .from(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, id)))
      .limit(1)
    if (!slot) return reply.status(404).send({ error: 'Slot not found' })
    const parsed = slotStaffPutBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const prevRows = await db
      .select({ userId: schema.scheduleSlotStaff.userId })
      .from(schema.scheduleSlotStaff)
      .where(eq(schema.scheduleSlotStaff.scheduleSlotId, slotId))
    const prevUserIds = new Set(prevRows.map((r) => r.userId))

    await db.delete(schema.scheduleSlotStaff).where(eq(schema.scheduleSlotStaff.scheduleSlotId, slotId))
    for (const a of parsed.data.assignments) {
      const s = new Date(a.startsAt)
      const e = new Date(a.endsAt)
      if (!(e.getTime() > s.getTime())) {
        return reply.status(400).send({ error: 'Each assignment needs endsAt after startsAt' })
      }
      await db.insert(schema.scheduleSlotStaff).values({
        scheduleSlotId: slotId,
        userId: a.userId,
        roleLabel: a.roleLabel?.trim() || 'staff',
        station: a.station?.trim() || undefined,
        notes: a.notes?.trim() || undefined,
        startsAt: s,
        endsAt: e,
        updatedAt: new Date(),
      })
    }
    const newUserIds = new Set(parsed.data.assignments.map((a) => a.userId))
    const affected = [...new Set([...prevUserIds, ...newUserIds])]
    for (const uid of affected) {
      await createNotification(uid, 'convention_staff_assignment_updated', {
        conventionId: conv.id,
        conventionSlug: conv.slug,
        conventionName: conv.name,
        slotId,
        slotTitle: slot.title,
        scope: 'slot_staff',
      })
    }
    const warnings = await computeAllConventionScheduleWarnings(id)
    publishToScope(`convention:${id}:schedule`, 'schedule_staff_updated', { slotId })
    return reply.send({ ok: true, warnings })
  })

  const standaloneDutyBody = z.object({
    userId: z.string().uuid(),
    roleLabel: z.string().min(1).max(128).optional(),
    station: z.string().max(512).optional().nullable(),
    location: z.string().max(512).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    importKey: z.string().max(128).optional().nullable(),
  })

  app.get('/api/v1/conventions/:key/staff-duties', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await userCanAssignStaffDuties(conv, actor.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const rows = await db
      .select()
      .from(schema.conventionStaffDuties)
      .where(eq(schema.conventionStaffDuties.conventionId, id))
      .orderBy(asc(schema.conventionStaffDuties.startsAt))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/conventions/:key/staff-duties', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await userCanAssignStaffDuties(conv, actor.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const parsed = standaloneDutyBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const s = new Date(parsed.data.startsAt)
    const e = new Date(parsed.data.endsAt)
    if (!(e.getTime() > s.getTime())) return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    const [row] = await db
      .insert(schema.conventionStaffDuties)
      .values({
        conventionId: id,
        userId: parsed.data.userId,
        roleLabel: parsed.data.roleLabel?.trim() || 'staff',
        station: parsed.data.station?.trim() || undefined,
        location: parsed.data.location?.trim() || undefined,
        notes: parsed.data.notes?.trim() || undefined,
        startsAt: s,
        endsAt: e,
        importKey: parsed.data.importKey?.trim() || undefined,
        updatedAt: new Date(),
      })
      .returning()
    await createNotification(parsed.data.userId, 'convention_staff_assignment_updated', {
      conventionId: conv.id,
      conventionSlug: conv.slug,
      conventionName: conv.name,
      scope: 'standalone_duty',
    })
    const warnings = await computeAllConventionScheduleWarnings(id)
    publishToScope(`convention:${id}:schedule`, 'schedule_staff_updated', { dutyId: row?.id })
    return reply.send({ duty: row, warnings })
  })

  app.patch('/api/v1/conventions/:key/staff-duties/:dutyId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, dutyId } = req.params as { key: string; dutyId: string }
    if (!UUID_RE.test(dutyId)) return reply.status(400).send({ error: 'Invalid id' })
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await userCanAssignStaffDuties(conv, actor.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const parsed = standaloneDutyBody.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const d = parsed.data
    const [existing] = await db
      .select()
      .from(schema.conventionStaffDuties)
      .where(and(eq(schema.conventionStaffDuties.id, dutyId), eq(schema.conventionStaffDuties.conventionId, id)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const startsAt = d.startsAt !== undefined ? new Date(d.startsAt) : new Date(existing.startsAt)
    const endsAt = d.endsAt !== undefined ? new Date(d.endsAt) : new Date(existing.endsAt)
    if (!(endsAt.getTime() > startsAt.getTime())) return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    const [updated] = await db
      .update(schema.conventionStaffDuties)
      .set({
        ...(d.userId !== undefined ? { userId: d.userId } : {}),
        ...(d.roleLabel !== undefined ? { roleLabel: d.roleLabel.trim() || 'staff' } : {}),
        ...(d.station !== undefined ? { station: d.station?.trim() || null } : {}),
        ...(d.location !== undefined ? { location: d.location?.trim() || null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
        ...(d.startsAt !== undefined ? { startsAt } : {}),
        ...(d.endsAt !== undefined ? { endsAt } : {}),
        ...(d.importKey !== undefined ? { importKey: d.importKey?.trim() || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionStaffDuties.id, dutyId))
      .returning()
    const notifyIds = new Set([existing.userId, updated?.userId].filter(Boolean) as string[])
    for (const uid of notifyIds) {
      await createNotification(uid, 'convention_staff_assignment_updated', {
        conventionId: conv.id,
        conventionSlug: conv.slug,
        conventionName: conv.name,
        dutyId,
        scope: 'standalone_duty',
      })
    }
    const warnings = await computeAllConventionScheduleWarnings(id)
    publishToScope(`convention:${id}:schedule`, 'schedule_staff_updated', { dutyId })
    return reply.send({ duty: updated, warnings })
  })

  app.delete('/api/v1/conventions/:key/staff-duties/:dutyId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, dutyId } = req.params as { key: string; dutyId: string }
    if (!UUID_RE.test(dutyId)) return reply.status(400).send({ error: 'Invalid id' })
    const id = await resolveConventionId(key)
    if (!id) return reply.status(404).send({ error: 'Not found' })
    const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
    if (!conv) return reply.status(404).send({ error: 'Not found' })
    if (!(await userCanAssignStaffDuties(conv, actor.userId))) return reply.status(403).send({ error: 'Forbidden' })
    const del = await db
      .delete(schema.conventionStaffDuties)
      .where(and(eq(schema.conventionStaffDuties.id, dutyId), eq(schema.conventionStaffDuties.conventionId, id)))
      .returning({ userId: schema.conventionStaffDuties.userId })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    const uid = del[0]!.userId
    await createNotification(uid, 'convention_staff_assignment_updated', {
      conventionId: conv.id,
      conventionSlug: conv.slug,
      conventionName: conv.name,
      dutyId,
      scope: 'standalone_duty_removed',
    })
    const warnings = await computeAllConventionScheduleWarnings(id)
    publishToScope(`convention:${id}:schedule`, 'schedule_staff_updated', { dutyId })
    return reply.send({ ok: true, warnings })
  })

  app.get('/api/v1/conventions/:key/my-schedule', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView && !resolved.canManage) return reply.status(403).send({ error: 'Attendee access required' })
    const items = await buildMyConventionScheduleItems(resolved.conv.id, actor.userId)
    return reply.send({ items })
  })

  app.get('/api/v1/conventions/:key/staff-roster', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (
      !resolved.isStaff &&
      !(await userHasHubConventionRead(resolved.conv, actor.userId, 'staff_ops'))
    ) {
      return reply.status(403).send({ error: 'Staff or organizer access required' })
    }
    const cid = resolved.conv.id
    const slotRows = await db
      .select({ id: schema.scheduleSlots.id, startsAt: schema.scheduleSlots.startsAt, title: schema.scheduleSlots.title })
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, cid))
    const slotIds = slotRows.map((s) => s.id)
    const slotMeta = new Map(slotRows.map((s) => [s.id, s]))

    type RosterEntry = {
      userId: string
      username: string
      displayName: string | null
      avatarUrl: string | null
      roles: string[]
      nextStartsAt: string | null
      nextLabel: string | null
      /** From convention access grant when role is staff/moderator. */
      canAssignStaffSchedules?: boolean
    }
    const roster = new Map<string, RosterEntry>()

    const upsert = (row: {
      userId: string
      username: string
      displayName: string | null
      avatarUrl: string | null
      role: string
      startsAt: Date
      label: string
    }) => {
      const cur = roster.get(row.userId)
      const nextT = row.startsAt.getTime()
      if (!cur) {
        roster.set(row.userId, {
          userId: row.userId,
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          roles: [row.role],
          nextStartsAt: row.startsAt.toISOString(),
          nextLabel: row.label,
        })
        return
      }
      if (!cur.roles.includes(row.role)) cur.roles.push(row.role)
      const curNext = cur.nextStartsAt ? new Date(cur.nextStartsAt).getTime() : Infinity
      if (nextT < curNext) {
        cur.nextStartsAt = row.startsAt.toISOString()
        cur.nextLabel = row.label
      }
    }

    if (slotIds.length > 0) {
      const pres = await db
        .select({
          userId: schema.scheduleSlotPresenters.userId,
          scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
          avatarUrl: schema.profiles.avatarUrl,
        })
        .from(schema.scheduleSlotPresenters)
        .innerJoin(schema.users, eq(schema.scheduleSlotPresenters.userId, schema.users.id))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds))
      for (const p of pres) {
        const sl = slotMeta.get(p.scheduleSlotId)
        if (!sl) continue
        upsert({
          userId: p.userId,
          username: p.username,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          role: 'Presenter',
          startsAt: new Date(sl.startsAt),
          label: sl.title,
        })
      }
      const stf = await db
        .select({
          userId: schema.scheduleSlotStaff.userId,
          roleLabel: schema.scheduleSlotStaff.roleLabel,
          startsAt: schema.scheduleSlotStaff.startsAt,
          scheduleSlotId: schema.scheduleSlotStaff.scheduleSlotId,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
          avatarUrl: schema.profiles.avatarUrl,
        })
        .from(schema.scheduleSlotStaff)
        .innerJoin(schema.users, eq(schema.scheduleSlotStaff.userId, schema.users.id))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds))
      for (const s of stf) {
        const sl = slotMeta.get(s.scheduleSlotId)
        upsert({
          userId: s.userId,
          username: s.username,
          displayName: s.displayName,
          avatarUrl: s.avatarUrl,
          role: s.roleLabel,
          startsAt: new Date(s.startsAt),
          label: `${s.roleLabel}${sl ? ` (${sl.title})` : ''}`,
        })
      }
    }

    const dutyUsers = await db
      .select({
        userId: schema.conventionStaffDuties.userId,
        roleLabel: schema.conventionStaffDuties.roleLabel,
        startsAt: schema.conventionStaffDuties.startsAt,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.conventionStaffDuties)
      .innerJoin(schema.users, eq(schema.conventionStaffDuties.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.conventionStaffDuties.conventionId, cid))
    for (const d of dutyUsers) {
      upsert({
        userId: d.userId,
        username: d.username,
        displayName: d.displayName,
        avatarUrl: d.avatarUrl,
        role: d.roleLabel,
        startsAt: new Date(d.startsAt),
        label: d.roleLabel,
      })
    }

    const volShifts = await db
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(eq(schema.conventionVolunteerShifts.conventionId, cid))
    const vids = volShifts.map((v) => v.id)
    if (vids.length > 0) {
      const signups = await db
        .select({
          userId: schema.conventionVolunteerShiftSignups.userId,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
          avatarUrl: schema.profiles.avatarUrl,
          shiftId: schema.conventionVolunteerShiftSignups.shiftId,
        })
        .from(schema.conventionVolunteerShiftSignups)
        .innerJoin(schema.users, eq(schema.conventionVolunteerShiftSignups.userId, schema.users.id))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(inArray(schema.conventionVolunteerShiftSignups.shiftId, vids))
      const shiftById = new Map(volShifts.map((v) => [v.id, v]))
      for (const su of signups) {
        const sh = shiftById.get(su.shiftId)
        if (!sh) continue
        upsert({
          userId: su.userId,
          username: su.username,
          displayName: su.displayName,
          avatarUrl: su.avatarUrl,
          role: 'Volunteer',
          startsAt: new Date(sh.startsAt),
          label: sh.title,
        })
      }
    }

    const grants = await db
      .select({
        userId: schema.conventionAccessGrants.userId,
        role: schema.conventionAccessGrants.role,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
        canAssignStaffSchedules: schema.conventionAccessGrants.canAssignStaffSchedules,
      })
      .from(schema.conventionAccessGrants)
      .innerJoin(schema.users, eq(schema.conventionAccessGrants.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        and(
          eq(schema.conventionAccessGrants.conventionId, cid),
          inArray(schema.conventionAccessGrants.role, ['STAFF', 'MODERATOR'])
        )
      )
    for (const g of grants) {
      if (!roster.has(g.userId)) {
        roster.set(g.userId, {
          userId: g.userId,
          username: g.username,
          displayName: g.displayName,
          avatarUrl: g.avatarUrl,
          roles: [g.role === 'MODERATOR' ? 'Moderator' : 'Staff grant'],
          nextStartsAt: null,
          nextLabel: null,
          canAssignStaffSchedules: g.canAssignStaffSchedules,
        })
      } else {
        const cur = roster.get(g.userId)!
        cur.canAssignStaffSchedules = g.canAssignStaffSchedules
      }
    }

    const items = [...roster.values()].sort((a, b) => {
      const ta = a.nextStartsAt ? new Date(a.nextStartsAt).getTime() : Infinity
      const tb = b.nextStartsAt ? new Date(b.nextStartsAt).getTime() : Infinity
      if (ta !== tb) return ta - tb
      return a.username.localeCompare(b.username)
    })
    return reply.send({ items })
  })

  app.get('/api/v1/conventions/:key/crew-grid', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (
      !resolved.isStaff &&
      !(await userHasHubConventionRead(resolved.conv, actor.userId, 'staff_ops'))
    ) {
      return reply.status(403).send({ error: 'Staff or organizer access required' })
    }
    const cid = resolved.conv.id
    const convRow = resolved.conv
    const slotRows = await db
      .select()
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, cid))
    const slotIds = slotRows.map((s) => s.id)
    const slotById = new Map(slotRows.map((s) => [s.id, s]))
    const assignments: Array<{
      userId: string
      username: string
      displayName: string | null
      startsAt: Date
      endsAt: Date
      label: string
    }> = []

    if (slotIds.length > 0) {
      const stf = await db
        .select({
          userId: schema.scheduleSlotStaff.userId,
          roleLabel: schema.scheduleSlotStaff.roleLabel,
          startsAt: schema.scheduleSlotStaff.startsAt,
          endsAt: schema.scheduleSlotStaff.endsAt,
          scheduleSlotId: schema.scheduleSlotStaff.scheduleSlotId,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
        })
        .from(schema.scheduleSlotStaff)
        .innerJoin(schema.users, eq(schema.scheduleSlotStaff.userId, schema.users.id))
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds))
      for (const row of stf) {
        const sl = slotById.get(row.scheduleSlotId)
        assignments.push({
          userId: row.userId,
          username: row.username,
          displayName: row.displayName,
          startsAt: new Date(row.startsAt),
          endsAt: new Date(row.endsAt),
          label: `${row.roleLabel}${sl ? ` · ${sl.title}` : ''}`,
        })
      }
    }

    const dutyRows = await db
      .select({
        userId: schema.conventionStaffDuties.userId,
        roleLabel: schema.conventionStaffDuties.roleLabel,
        startsAt: schema.conventionStaffDuties.startsAt,
        endsAt: schema.conventionStaffDuties.endsAt,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.conventionStaffDuties)
      .innerJoin(schema.users, eq(schema.conventionStaffDuties.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.conventionStaffDuties.conventionId, cid))
    for (const row of dutyRows) {
      assignments.push({
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        startsAt: new Date(row.startsAt),
        endsAt: new Date(row.endsAt),
        label: row.roleLabel,
      })
    }

    const days = buildCrewGridFromAssignments(
      new Date(convRow.startsAt),
      new Date(convRow.endsAt),
      assignments
    )
    return reply.send({ days })
  })

  app.get('/api/v1/conventions/:key/my-staff-duties.ics', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    if (!resolved.canView && !resolved.canManage) return reply.status(403).send({ error: 'Attendee access required' })
    const items = await buildMyConventionScheduleItems(resolved.conv.id, actor.userId)
    const staffLike = items.filter((i) => i.kind === 'staff_slot' || i.kind === 'staff_duty' || i.kind === 'volunteer')
    const base =
      (process.env.C2K_WEB_PUBLIC_URL ?? process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
    const convUrl = `${base}/conventions/${encodeURIComponent(resolved.conv.slug)}`
    const events = staffLike.map((it, idx) => ({
      uid: `${resolved.conv.id}-myduty-${idx}@c2k`,
      title: it.title,
      description: it.detail ?? '',
      startsAt: new Date(it.startsAt),
      endsAt: new Date(it.endsAt),
      location: it.location,
      url: convUrl,
    }))
    const ics = buildProgramIcsCalendar(events, '-//C2K//ConventionStaffDuties//EN')
    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="convention-${resolved.conv.slug}-my-duties.ics"`)
      .send(ics)
  })

  /* --- Event contributors (vendors, playspace, etc.) --- */
  app.get('/api/v1/events/:eventId/contributors', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const rows = await db
      .select({
        id: schema.eventContributors.id,
        eventId: schema.eventContributors.eventId,
        kind: schema.eventContributors.kind,
        vendorProfileId: schema.eventContributors.vendorProfileId,
        userId: schema.eventContributors.userId,
        label: schema.eventContributors.label,
        description: schema.eventContributors.description,
        sortOrder: schema.eventContributors.sortOrder,
        createdAt: schema.eventContributors.createdAt,
        vendorSlug: schema.vendorProfiles.slug,
        username: schema.users.username,
      })
      .from(schema.eventContributors)
      .leftJoin(schema.vendorProfiles, eq(schema.vendorProfiles.id, schema.eventContributors.vendorProfileId))
      .leftJoin(schema.users, eq(schema.users.id, schema.eventContributors.userId))
      .where(eq(schema.eventContributors.eventId, eventId))
      .orderBy(asc(schema.eventContributors.sortOrder))
    const items = rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      kind: r.kind,
      vendorProfileId: r.vendorProfileId,
      userId: r.userId,
      label: r.label,
      description: r.description,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      vendorSlug: r.vendorSlug ?? null,
      username: r.username ?? null,
    }))
    return reply.send({ items })
  })

  const contributorBody = z.object({
    kind: z.enum(['vendor', 'playspace', 'sponsor', 'presenter_support', 'other']),
    vendorProfileId: z.string().uuid().optional().nullable(),
    userId: z.string().uuid().optional().nullable(),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    sortOrder: z.number().int().optional(),
  })

  app.post('/api/v1/events/:eventId/contributors', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (!ev.organizationId) return reply.status(400).send({ error: 'Event has no organization' })
    const m = await orgMembership(ev.organizationId, user.userId)
    if (!m || ORG_ROLE_RANK[m.role] < ORG_ROLE_RANK.MODERATOR) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const parsed = contributorBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.eventContributors)
      .values({
        eventId,
        kind: parsed.data.kind,
        vendorProfileId: parsed.data.vendorProfileId ?? undefined,
        userId: parsed.data.userId ?? undefined,
        label: parsed.data.label,
        description: parsed.data.description,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ contributor: row })
  })

  app.delete('/api/v1/events/:eventId/contributors/:contributorId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId, contributorId } = req.params as { eventId: string; contributorId: string }
    if (!UUID_RE.test(eventId) || !UUID_RE.test(contributorId)) {
      return reply.status(400).send({ error: 'Invalid id' })
    }
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (!ev.organizationId) return reply.status(400).send({ error: 'Event has no organization' })
    const m = await orgMembership(ev.organizationId, user.userId)
    if (!m || ORG_ROLE_RANK[m.role] < ORG_ROLE_RANK.MODERATOR) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const [existing] = await db
      .select({ id: schema.eventContributors.id })
      .from(schema.eventContributors)
      .where(and(eq(schema.eventContributors.id, contributorId), eq(schema.eventContributors.eventId, eventId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Contributor not found' })
    await db.delete(schema.eventContributors).where(eq(schema.eventContributors.id, contributorId))
    return reply.send({ ok: true })
  })
}
