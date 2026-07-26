import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { S3Client } from '@aws-sdk/client-s3'
import { putObject } from '../lib/s3-upload.js'
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import type { ConventionPublicSettings } from '../db/schema.js'
import { escapeCsvCell } from '../lib/csv-parse.js'
import {
  resolveUserIdByEmail,
  resolveUserParticipationDefaults,
  syncAccessGrantOnRegistration,
  registrationCategoryValidForConvention,
  upsertConventionRegistrant,
} from '../lib/convention-participation.js'
import { computeDancecardConflicts } from '../lib/convention-organizer/conflictScanner.js'
import { wouldCreateParentCycle } from '../lib/convention-organizer/locationHierarchyHelpers.js'
import { mapDbLocationToDto } from '../lib/convention-organizer/organizerLocationDto.js'
import { mapStaffShiftRow } from '../lib/convention-organizer/organizerStaffShiftDto.js'
import { requireConventionCommand, resolveConventionCommandAccess } from '../lib/convention-command-access.js'
import { registerConventionOrganizerExtensionRoutes } from './convention-organizer/index.js'
import { getConventionWithAccess } from './conventions-routes.js'
import { migrateVenueRoomsToLocations } from '../lib/convention-organizer/venueRoomsMigration.js'
import {
  candidateFromImportRow,
  publishProgramCandidates,
  publishStaffImportRows,
} from '../lib/convention-organizer/scheduleImportPublish.js'
import {
  apiPayloadToParsedRows,
  applyRoomMatchesToParsedRows,
  findBestMappingProfile,
  insertImportBatchFromParsed,
} from '../lib/convention-organizer/organizerImportBatch.js'
import { loadDirectoryPersonIdByUserId } from '../lib/convention-people-links.js'
import { getEmailFromUserRow, userEmailSelect } from '../lib/user-email.js'
import { requestConventionPeopleDirectorySync } from '../lib/convention-people-sync-queue.js'
import {
  alphaUploadDisabledResponse,
  isAlphaUploadDisabled,
} from '../lib/alpha-upload-policy.js'
import {
  mapRegistrantFull,
  resolveCheckInUpdate,
} from '../lib/convention-organizer/registration.js'
import {
  inferRoleKindFromCategoryName,
  roleKindLabel,
  VETTING_STATUS_VALUES,
} from '../lib/convention-registrant-fields.js'
import type { CommandRequirement } from '@c2k/shared'
import { APP_NAME, commandPermissionIncludes, NOTIFICATION_TYPES } from '@c2k/shared'
import { createNotification } from '../lib/create-notification.js'
import { sanitizeDmHtml } from '../lib/sanitize-dm-body.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DEFAULT_MODULES: Record<string, boolean> = {
  schedule_embed: true,
  map_embed: true,
  shift_swaps: false,
  vetting_applications: false,
  policy_public_summary: false,
  iso_board: false,
  session_feedback: false,
  attendee_groups: false,
  meal_signups: false,
  exhibitor_directory: false,
  attendee_directory: false,
}

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

function s3(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

function publicUrlForPath(path: string): string | null {
  if (/^https?:\/\//i.test(path)) return path
  const webBase = (process.env.C2K_PUBLIC_WEB_URL ?? process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
  if (path.startsWith('public/') && webBase) {
    return `${webBase}/${path.replace(/^public\//, '')}`
  }
  const bucket = process.env.S3_BUCKET ?? 'c2k-uploads'
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? `${process.env.S3_ENDPOINT}/${bucket}`
  if (!publicBase) return null
  return `${publicBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null
  const dt = d instanceof Date ? d : new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

function kitVisibility(dbVis: string | null | undefined): string {
  const v = String(dbVis ?? 'ATTENDEE').toUpperCase()
  if (v === 'STAFF') return 'staff_only'
  if (v === 'HIDDEN') return 'secret'
  return 'public'
}

function dbVisibility(kitVis: string | undefined): string {
  if (!kitVis) return 'ATTENDEE'
  const v = kitVis.toLowerCase()
  if (v === 'staff_only' || v === 'staff') return 'STAFF'
  if (v === 'secret' || v === 'hidden') return 'HIDDEN'
  return 'ATTENDEE'
}

type ConvRow = typeof schema.conventions.$inferSelect

function organizerRoleFromOrg(role: string | null): 'owner' | 'admin' | 'moderator' | 'staff' | 'viewer' {
  if (!role) return 'viewer'
  if (role === 'OWNER') return 'owner'
  if (role === 'ADMIN') return 'admin'
  if (role === 'MODERATOR') return 'moderator'
  if (role === 'STAFF') return 'staff'
  return 'viewer'
}

async function requireOrganizer(
  key: string,
  userId: string,
  reply: FastifyReply,
  requirement: CommandRequirement,
): Promise<
  | {
      conv: ConvRow
      permissions: import('@c2k/shared').ConventionCommandPermissions
      orgRole: string | null
      organizerRole: ReturnType<typeof organizerRoleFromOrg>
    }
  | null
> {
  const access = await requireConventionCommand(key, userId, reply, requirement)
  if (!access) return null
  return {
    conv: access.conv,
    permissions: access.permissions,
    orgRole: access.orgRole,
    organizerRole: organizerRoleFromOrg(access.orgRole),
  }
}

function conventionSettings(conv: ConvRow): ConventionPublicSettings {
  return (conv.settings ?? {}) as ConventionPublicSettings
}

function eventSystemsBlock(conv: ConvRow) {
  return conventionSettings(conv).eventSystems ?? {}
}

function mapEventDto(
  conv: ConvRow,
  opts: { heroImageUrl?: string | null; includeAccessCodes?: boolean } = {},
) {
  const settings = conventionSettings(conv)
  const es = eventSystemsBlock(conv)
  const publishStatus = String(settings.dancecardPublishStatus ?? 'draft')
  const includeAccessCodes = opts.includeAccessCodes ?? false
  return {
    id: conv.id,
    slug: conv.slug,
    productTitle: es.productTitle ?? conv.name,
    eventTitle: es.eventTitle ?? conv.name,
    subtitle: conv.description ?? null,
    timezone: conv.timezone,
    windowStartsAt: iso(conv.startsAt)!,
    windowEndsAt: iso(conv.endsAt)!,
    sharedByLabel: es.sharedByLabel ?? '',
    sharedByDetail: es.sharedByDetail ?? null,
    logoUrl: es.logoUrl ?? null,
    shareImageUrl: settings.shareImageUrl ?? null,
    heroImageUrl: opts.heroImageUrl ?? null,
    status: publishStatus === 'published' ? 'published' : 'draft',
    staffAccessCode: includeAccessCodes ? String(settings.staffAccessCode ?? '') : '',
    registrationAccessCode: includeAccessCodes ? String(settings.registrationAccessCode ?? '') : '',
    badgeLayoutJson: (es.badgeLayoutJson ?? {}) as Record<string, unknown>,
    themeConfig: es.themeConfig,
    eventProfile: (es.eventProfile ?? 'convention') as string,
    peopleHubTemplate: es.peopleHubTemplate === 'munch' ? 'munch' : 'full',
    attendeeGuideJson: (es.attendeeGuideJson ?? {}) as Record<string, unknown>,
    agreementsConfig: (es.agreementsConfig ?? {}) as Record<string, unknown>,
    attendeeProfileConfig: (es.attendeeProfileConfig ?? {}) as Record<string, unknown>,
  }
}

async function loadHeroImageUrl(conv: ConvRow): Promise<string | null> {
  if (!conv.anchorEventId) return null
  const [row] = await db
    .select({ imageUrl: schema.events.imageUrl })
    .from(schema.events)
    .where(eq(schema.events.id, conv.anchorEventId))
    .limit(1)
  return row?.imageUrl ?? null
}

function mergeConventionSettingsJson(
  prev: ConventionPublicSettings | null | undefined,
  patch: Partial<ConventionPublicSettings>,
): ConventionPublicSettings {
  const base: Record<string, unknown> =
    prev && typeof prev === 'object' ? { ...(prev as Record<string, unknown>) } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete base[k]
    else base[k] = v
  }
  return base as ConventionPublicSettings
}

const eventPatchBody = z
  .object({
    productTitle: z.string().min(1).max(255).optional(),
    eventTitle: z.string().min(1).max(255).optional(),
    subtitle: z.string().max(20000).nullable().optional(),
    timezone: z.string().max(64).optional(),
    windowStartsAt: z.string().datetime().optional(),
    windowEndsAt: z.string().datetime().optional(),
    sharedByLabel: z.string().max(255).optional(),
    sharedByDetail: z.string().max(2000).nullable().optional(),
    logoUrl: z.string().url().max(2000).nullable().optional(),
    shareImageUrl: z.string().url().max(2000).nullable().optional(),
    status: z.enum(['draft', 'published']).optional(),
    staffAccessCode: z.string().max(120).optional(),
    registrationAccessCode: z.string().max(120).optional(),
    badgeLayoutJson: z.record(z.string(), z.unknown()).optional(),
    themeConfig: z.record(z.string(), z.unknown()).optional(),
    eventProfile: z.string().max(64).optional(),
    peopleHubTemplate: z.enum(['full', 'munch']).optional(),
    attendeeGuideJson: z.record(z.string(), z.unknown()).optional(),
    agreementsConfig: z.record(z.string(), z.unknown()).optional(),
    attendeeProfileConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

type SlotFilters = {
  locationId?: string
  trackId?: string
  isPublished?: boolean
}

function mapProgramSlot(
  row: typeof schema.scheduleSlots.$inferSelect,
  track?: { name: string; color: string } | null,
  location?: { name: string } | null,
  tags?: { tagId: string; name: string }[],
) {
  const tagList = tags ?? []
  return {
    id: row.id,
    startsAt: row.isUnscheduled ? null : iso(row.startsAt),
    endsAt: row.isUnscheduled ? null : iso(row.endsAt),
    title: row.title,
    track: row.trackLabel ?? track?.name ?? null,
    trackId: row.trackId ?? null,
    trackName: track?.name ?? null,
    trackColor: track?.color ?? null,
    room: row.roomLabel ?? row.location ?? null,
    locationId: row.locationId ?? null,
    locationName: location?.name ?? null,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    visibility: kitVisibility(row.visibility),
    isFrozen: row.isFrozen,
    updatedAt: iso(row.updatedAt),
    photoPolicy: 'allowed' as const,
    organizerNotesInternal: row.organizerNotes ?? null,
    tagIds: tagList.map((t) => t.tagId),
    tagNames: tagList.map((t) => t.name),
  }
}

async function loadProgramSlots(conventionId: string, filters: SlotFilters = {}) {
  const conditions = [eq(schema.scheduleSlots.conventionId, conventionId)]
  if (filters.locationId) conditions.push(eq(schema.scheduleSlots.locationId, filters.locationId))
  if (filters.trackId) conditions.push(eq(schema.scheduleSlots.trackId, filters.trackId))
  if (filters.isPublished !== undefined) conditions.push(eq(schema.scheduleSlots.isPublished, filters.isPublished))

  const rows = await db
    .select()
    .from(schema.scheduleSlots)
    .where(and(...conditions))
    .orderBy(asc(schema.scheduleSlots.startsAt), asc(schema.scheduleSlots.sortOrder))

  const trackIds = Array.from(new Set(rows.map((r) => r.trackId).filter(Boolean))) as string[]
  const locationIds = Array.from(new Set(rows.map((r) => r.locationId).filter(Boolean))) as string[]

  const tracks =
    trackIds.length > 0
      ? await db.select().from(schema.conventionTracks).where(inArray(schema.conventionTracks.id, trackIds))
      : []
  const locations =
    locationIds.length > 0
      ? await db.select().from(schema.conventionLocations).where(inArray(schema.conventionLocations.id, locationIds))
      : []

  const trackById = new Map(tracks.map((t) => [t.id, t]))
  const locById = new Map(locations.map((l) => [l.id, l]))

  const slotIds = rows.map((r) => r.id)
  const slotTags =
    slotIds.length > 0
      ? await db
          .select({
            slotId: schema.scheduleSlotTags.slotId,
            tagId: schema.scheduleSlotTags.tagId,
            name: schema.conventionTags.name,
          })
          .from(schema.scheduleSlotTags)
          .innerJoin(schema.conventionTags, eq(schema.scheduleSlotTags.tagId, schema.conventionTags.id))
          .where(inArray(schema.scheduleSlotTags.slotId, slotIds))
      : []
  const tagsBySlot = new Map<string, { tagId: string; name: string }[]>()
  for (const st of slotTags) {
    const list = tagsBySlot.get(st.slotId) ?? []
    list.push({ tagId: st.tagId, name: st.name })
    tagsBySlot.set(st.slotId, list)
  }

  return rows.map((r) =>
    mapProgramSlot(
      r,
      r.trackId ? trackById.get(r.trackId) : null,
      r.locationId ? locById.get(r.locationId) : null,
      tagsBySlot.get(r.id),
    ),
  )
}

async function loadLocations(conventionId: string) {
  const rows = await db
    .select()
    .from(schema.conventionLocations)
    .where(eq(schema.conventionLocations.conventionId, conventionId))
    .orderBy(asc(schema.conventionLocations.sortOrder), asc(schema.conventionLocations.name))
  return rows.map((r) =>
    mapDbLocationToDto({
      id: r.id,
      name: r.name,
      short_name: r.shortName,
      capacity: r.capacity,
      notes: r.notes,
      sort_order: r.sortOrder,
      parent_id: r.parentId,
      kind: r.kind,
      accessibility_notes: r.accessibilityNotes,
      directions_public: r.directionsPublic,
      internal_notes: r.internalNotes,
    }),
  )
}

async function loadStaffShifts(conventionId: string) {
  const rows = await db
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
    .orderBy(asc(schema.conventionVolunteerShifts.startsAt), asc(schema.conventionVolunteerShifts.sortOrder))
  return rows.map((r) =>
    mapStaffShiftRow({
      id: r.id,
      person_id: r.personId,
      person_name: r.personName ?? r.title,
      role: r.role ?? 'volunteer',
      location_id: r.locationId,
      starts_at: iso(r.startsAt),
      ends_at: iso(r.endsAt),
      sort_order: r.sortOrder,
      shift_status: r.shiftStatus,
      claimed_by_account_id: r.claimedByUserId,
      organizer_notes_staff_only: r.organizerNotesStaffOnly,
      dropped_at: iso(r.droppedAt),
    }),
  )
}

async function buildReadinessChecks(conv: ConvRow, summaryOnly: boolean) {
  const checks: { id: string; severity: 'ok' | 'warning' | 'info'; title: string; detail?: string }[] = []
  const [slotCountRow] = await db
    .select({ n: count() })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conv.id))
  const slotCount = Number(slotCountRow?.n ?? 0)

  const [unpubRow] = await db
    .select({ n: count() })
    .from(schema.scheduleSlots)
    .where(and(eq(schema.scheduleSlots.conventionId, conv.id), eq(schema.scheduleSlots.isPublished, false)))
  const unpublishedCount = Number(unpubRow?.n ?? 0)

  const locations = await loadLocations(conv.id)
  const [shiftCountRow] = await db
    .select({ n: count() })
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conv.id))
  const staffShiftCount = Number(shiftCountRow?.n ?? 0)

  const [catCountRow] = await db
    .select({ n: count() })
    .from(schema.conventionRegistrationCategories)
    .where(eq(schema.conventionRegistrationCategories.conventionId, conv.id))
  const registrationCategoryCount = Number(catCountRow?.n ?? 0)

  const settings = (conv.settings ?? {}) as Record<string, unknown>
  const publishStatus = String(settings.dancecardPublishStatus ?? 'draft')
  if (publishStatus !== 'published') {
    checks.push({
      id: 'event-unpublished',
      severity: 'warning',
      title: 'This event is not live on the public dancecard yet',
      detail: 'Publish the event when you are ready for attendees to find it by name.',
    })
  } else {
    checks.push({ id: 'event-published', severity: 'ok', title: 'Event is live on the public dancecard' })
  }

  if (slotCount === 0) {
    checks.push({
      id: 'program-empty',
      severity: 'warning',
      title: 'No classes on the schedule yet',
      detail: 'Import a spreadsheet or add classes on the program grid.',
    })
  } else {
    checks.push({
      id: 'program-count',
      severity: 'ok',
      title: `${slotCount} class${slotCount === 1 ? '' : 'es'} on the schedule`,
    })
    if (unpublishedCount > 0) {
      checks.push({
        id: 'slots-unpublished',
        severity: 'info',
        title: `${unpublishedCount} class${unpublishedCount === 1 ? ' is' : 'es are'} hidden from the public schedule`,
      })
    }
  }

  if (locations.length === 0) {
    checks.push({
      id: 'locations-none',
      severity: 'info',
      title: 'Rooms are entered as free text only',
    })
  } else {
    checks.push({
      id: 'locations-ok',
      severity: 'ok',
      title: `${locations.length} room${locations.length === 1 ? '' : 's'} in your venue list`,
    })
  }

  if (staffShiftCount === 0) {
    checks.push({
      id: 'staff-empty',
      severity: 'info',
      title: 'No volunteer or staff shifts yet',
    })
  } else {
    checks.push({
      id: 'staff-count',
      severity: 'ok',
      title: `${staffShiftCount} staff or volunteer shift${staffShiftCount === 1 ? '' : 's'} on the board`,
    })
  }

  if (registrationCategoryCount === 0) {
    checks.push({
      id: 'reg-categories-empty',
      severity: 'info',
      title: 'No registration types set up yet',
    })
  } else {
    checks.push({
      id: 'reg-categories-ok',
      severity: 'ok',
      title: `${registrationCategoryCount} registration type${registrationCategoryCount === 1 ? '' : 's'} configured`,
    })
  }

  if (!summaryOnly) {
    const [form] = await db
      .select()
      .from(schema.conventionRegistrationForms)
      .where(eq(schema.conventionRegistrationForms.conventionId, conv.id))
      .limit(1)
    if (!form) {
      checks.push({ id: 'reg-form-missing', severity: 'info', title: 'No registration form yet' })
    } else {
      checks.push({ id: 'reg-form-published', severity: 'ok', title: 'Registration form exists' })
    }
  }

  return checks
}

const locationBody = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().max(64).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  kind: z.string().max(64).optional().nullable(),
  accessibilityNotes: z.string().max(5000).optional().nullable(),
  directionsPublic: z.string().max(5000).optional().nullable(),
  internalNotes: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().optional(),
})

const programSlotPatchBody = z.object({
  locationId: z.string().uuid().nullable().optional(),
  room: z.string().max(128).nullable().optional(),
  isPublished: z.boolean().optional(),
  visibility: z.enum(['public', 'staff_only', 'secret', 'ATTENDEE', 'STAFF', 'HIDDEN']).optional(),
  organizerNotes: z.string().max(10000).nullable().optional(),
  /** Kit UI field name - persisted as organizer_notes. */
  organizerNotesInternal: z.string().max(10000).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  title: z.string().min(1).max(512).optional(),
  track: z.string().max(128).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isFrozen: z.boolean().optional(),
  photoPolicy: z.enum(['allowed', 'restricted', 'none']).optional(),
})

const programSlotCreateBody = z.object({
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  title: z.string().min(1).max(512),
  track: z.string().max(128).nullable().optional(),
  room: z.string().max(128).nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
})

const staffShiftBody = z.object({
  personId: z.string().uuid(),
  personName: z.string().min(1).max(255).optional(),
  role: z.string().min(1).max(128),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  locationId: z.string().uuid().nullable().optional(),
  shiftStatus: z.enum(['draft', 'open', 'assigned', 'dropped']).optional(),
  sortOrder: z.number().int().optional(),
})

const dmReqBody = z.object({
  locationId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  minLead: z.number().int().min(0).optional(),
  minFloat: z.number().int().min(0).optional(),
})

export async function registerConventionOrganizerRoutes(app: FastifyInstance) {
  const registered: string[] = []

  function reg(method: string, path: string, handler: Parameters<FastifyInstance['route']>[0]['handler']) {
    app.route({ method: method as 'GET', url: path, handler })
    registered.push(`${method} ${path}`)
  }

  // --- bootstrap ---
  reg('GET', '/api/v1/conventions/:key/organizer/bootstrap', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'any')
    if (!ctx) return
    await migrateVenueRoomsToLocations(ctx.conv.id, conventionSettings(ctx.conv))
    const { conv, organizerRole, permissions } = ctx
    const includeScheduler = permissions.scheduler || permissions.isFullAdmin
    const includeStaffOps = permissions.staffOps || permissions.isFullAdmin
    const [slots, shifts, locations, heroImageUrl] = await Promise.all([
      includeScheduler ? loadProgramSlots(conv.id) : Promise.resolve([]),
      includeStaffOps ? loadStaffShifts(conv.id) : Promise.resolve([]),
      includeScheduler ? loadLocations(conv.id) : Promise.resolve([]),
      loadHeroImageUrl(conv),
    ])
    return reply.send({
      event: mapEventDto(conv, { heroImageUrl, includeAccessCodes: permissions.isFullAdmin }),
      slots,
      shifts,
      locations,
      timezone: conv.timezone,
      windowStartsAt: iso(conv.startsAt),
      windowEndsAt: iso(conv.endsAt),
      organizerRole,
      permissions,
    })
  })

  reg('GET', '/api/v1/conventions/:key/organizer/command-access', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'any')
    if (!ctx) return
    return reply.send({
      permissions: ctx.permissions,
      organizerRole: ctx.organizerRole,
      hasAnyAccess: true,
    })
  })

  reg('GET', '/api/v1/conventions/:key/event', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const heroImageUrl = await loadHeroImageUrl(ctx.conv)
    return reply.send({ event: mapEventDto(ctx.conv, { heroImageUrl, includeAccessCodes: true }) })
  })

  reg('PATCH', '/api/v1/conventions/:key/event', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = eventPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const prevSettings = conventionSettings(ctx.conv)
    const prevEs = { ...eventSystemsBlock(ctx.conv) }
    const d = parsed.data
    const esPatch: NonNullable<ConventionPublicSettings['eventSystems']> = { ...prevEs }
    if (d.productTitle !== undefined) esPatch.productTitle = d.productTitle
    if (d.eventTitle !== undefined) esPatch.eventTitle = d.eventTitle
    if (d.sharedByLabel !== undefined) esPatch.sharedByLabel = d.sharedByLabel
    if (d.sharedByDetail !== undefined) esPatch.sharedByDetail = d.sharedByDetail
    if (d.logoUrl !== undefined) esPatch.logoUrl = d.logoUrl
    if (d.badgeLayoutJson !== undefined) esPatch.badgeLayoutJson = d.badgeLayoutJson
    if (d.themeConfig !== undefined) esPatch.themeConfig = d.themeConfig
    if (d.eventProfile !== undefined) esPatch.eventProfile = d.eventProfile
    if (d.peopleHubTemplate !== undefined) esPatch.peopleHubTemplate = d.peopleHubTemplate
    if (d.attendeeGuideJson !== undefined) esPatch.attendeeGuideJson = d.attendeeGuideJson
    if (d.agreementsConfig !== undefined) esPatch.agreementsConfig = d.agreementsConfig
    if (d.attendeeProfileConfig !== undefined) esPatch.attendeeProfileConfig = d.attendeeProfileConfig
    const settingsPatch: Partial<ConventionPublicSettings> = { eventSystems: esPatch }
    if (d.shareImageUrl !== undefined) settingsPatch.shareImageUrl = d.shareImageUrl
    if (d.status !== undefined) settingsPatch.dancecardPublishStatus = d.status
    if (d.staffAccessCode !== undefined) settingsPatch.staffAccessCode = d.staffAccessCode
    if (d.registrationAccessCode !== undefined) settingsPatch.registrationAccessCode = d.registrationAccessCode
    const nextSettings = mergeConventionSettingsJson(prevSettings, settingsPatch)
    const convPatch: Partial<ConvRow> = {}
    if (d.subtitle !== undefined) convPatch.description = d.subtitle
    if (d.timezone !== undefined) convPatch.timezone = d.timezone
    if (d.windowStartsAt !== undefined) convPatch.startsAt = new Date(d.windowStartsAt)
    if (d.windowEndsAt !== undefined) convPatch.endsAt = new Date(d.windowEndsAt)
    if (d.eventTitle !== undefined) convPatch.name = d.eventTitle
    const [updated] = await db
      .update(schema.conventions)
      .set({ ...convPatch, settings: nextSettings })
      .where(eq(schema.conventions.id, ctx.conv.id))
      .returning()
    const heroImageUrl = await loadHeroImageUrl(updated!)
    return reply.send({ event: mapEventDto(updated!, { heroImageUrl, includeAccessCodes: true }) })
  })

  reg('GET', '/api/v1/conventions/:key/organizer/print-data', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [slots, locations] = await Promise.all([
      loadProgramSlots(ctx.conv.id),
      loadLocations(ctx.conv.id),
    ])
    const event = mapEventDto(ctx.conv)
    return reply.send({
      eventTitle: event.eventTitle,
      timezone: ctx.conv.timezone,
      slots,
      locations,
    })
  })

  // --- locations ---
  reg('GET', '/api/v1/conventions/:key/locations', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const locations = await loadLocations(ctx.conv.id)
    return reply.send({ locations })
  })

  reg('POST', '/api/v1/conventions/:key/locations', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = locationBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const existing = await db
      .select({ id: schema.conventionLocations.id, parentId: schema.conventionLocations.parentId })
      .from(schema.conventionLocations)
      .where(eq(schema.conventionLocations.conventionId, ctx.conv.id))
    if (parsed.data.parentId && wouldCreateParentCycle(existing, randomUUID(), parsed.data.parentId)) {
      return reply.status(400).send({ error: 'Invalid parent' })
    }
    const [row] = await db
      .insert(schema.conventionLocations)
      .values({
        conventionId: ctx.conv.id,
        name: parsed.data.name.trim(),
        shortName: parsed.data.shortName ?? undefined,
        capacity: parsed.data.capacity ?? undefined,
        notes: parsed.data.notes ?? undefined,
        parentId: parsed.data.parentId ?? undefined,
        kind: parsed.data.kind ?? undefined,
        accessibilityNotes: parsed.data.accessibilityNotes ?? undefined,
        directionsPublic: parsed.data.directionsPublic ?? undefined,
        internalNotes: parsed.data.internalNotes ?? undefined,
        sortOrder: parsed.data.sortOrder ?? existing.length,
      })
      .returning()
    return reply.send({
      location: mapDbLocationToDto({
        id: row!.id,
        name: row!.name,
        short_name: row!.shortName,
        capacity: row!.capacity,
        notes: row!.notes,
        sort_order: row!.sortOrder,
        parent_id: row!.parentId,
        kind: row!.kind,
        accessibility_notes: row!.accessibilityNotes,
        directions_public: row!.directionsPublic,
        internal_notes: row!.internalNotes,
      }),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/locations/:locationId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, locationId } = req.params as { key: string; locationId: string }
    if (!UUID_RE.test(locationId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = locationBody.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const existing = await db
      .select({ id: schema.conventionLocations.id, parentId: schema.conventionLocations.parentId })
      .from(schema.conventionLocations)
      .where(eq(schema.conventionLocations.conventionId, ctx.conv.id))
    if (
      parsed.data.parentId !== undefined &&
      wouldCreateParentCycle(existing, locationId, parsed.data.parentId ?? null)
    ) {
      return reply.status(400).send({ error: 'Parent would create cycle' })
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim()
    if (parsed.data.shortName !== undefined) patch.shortName = parsed.data.shortName
    if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
    if (parsed.data.parentId !== undefined) patch.parentId = parsed.data.parentId
    if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind
    if (parsed.data.accessibilityNotes !== undefined) patch.accessibilityNotes = parsed.data.accessibilityNotes
    if (parsed.data.directionsPublic !== undefined) patch.directionsPublic = parsed.data.directionsPublic
    if (parsed.data.internalNotes !== undefined) patch.internalNotes = parsed.data.internalNotes
    if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder
    const [row] = await db
      .update(schema.conventionLocations)
      .set(patch)
      .where(and(eq(schema.conventionLocations.id, locationId), eq(schema.conventionLocations.conventionId, ctx.conv.id)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      location: mapDbLocationToDto({
        id: row.id,
        name: row.name,
        short_name: row.shortName,
        capacity: row.capacity,
        notes: row.notes,
        sort_order: row.sortOrder,
        parent_id: row.parentId,
        kind: row.kind,
        accessibility_notes: row.accessibilityNotes,
        directions_public: row.directionsPublic,
        internal_notes: row.internalNotes,
      }),
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/locations/:locationId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, locationId } = req.params as { key: string; locationId: string }
    if (!UUID_RE.test(locationId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    await db
      .update(schema.scheduleSlots)
      .set({ locationId: null, updatedAt: new Date() })
      .where(and(eq(schema.scheduleSlots.conventionId, ctx.conv.id), eq(schema.scheduleSlots.locationId, locationId)))
    const del = await db
      .delete(schema.conventionLocations)
      .where(and(eq(schema.conventionLocations.id, locationId), eq(schema.conventionLocations.conventionId, ctx.conv.id)))
      .returning({ id: schema.conventionLocations.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- program slots ---
  reg('GET', '/api/v1/conventions/:key/program-slots', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const q = req.query as Record<string, string | undefined>
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const filters: SlotFilters = {}
    if (q.locationId && UUID_RE.test(q.locationId)) filters.locationId = q.locationId
    if (q.trackId && UUID_RE.test(q.trackId)) filters.trackId = q.trackId
    if (q.isPublished === 'true') filters.isPublished = true
    if (q.isPublished === 'false') filters.isPublished = false
    const slots = await loadProgramSlots(ctx.conv.id, filters)
    return reply.send({
      slots,
      windowStartsAt: iso(ctx.conv.startsAt),
      windowEndsAt: iso(ctx.conv.endsAt),
      timezone: ctx.conv.timezone,
    })
  })

  reg('POST', '/api/v1/conventions/:key/program-slots', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = programSlotCreateBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const isLibrary = !parsed.data.startsAt && !parsed.data.endsAt
    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : ctx.conv.startsAt
    const endsAt = parsed.data.endsAt
      ? new Date(parsed.data.endsAt)
      : new Date(startsAt.getTime() + 3600_000)
    const [row] = await db
      .insert(schema.scheduleSlots)
      .values({
        conventionId: ctx.conv.id,
        title: parsed.data.title,
        startsAt,
        endsAt,
        trackLabel: parsed.data.track ?? undefined,
        roomLabel: parsed.data.room ?? undefined,
        locationId: parsed.data.locationId ?? undefined,
        description: parsed.data.description ?? undefined,
        sortOrder: parsed.data.sortOrder ?? 0,
        isPublished: parsed.data.isPublished ?? false,
        isUnscheduled: isLibrary,
      })
      .returning()
    return reply.send({ slot: mapProgramSlot(row!) })
  })

  reg('DELETE', '/api/v1/conventions/:key/program-slots/:slotId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const del = await db
      .delete(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, ctx.conv.id)))
      .returning({ id: schema.scheduleSlots.id })
    if (!del.length) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  reg('PATCH', '/api/v1/conventions/:key/program-slots/:slotId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, slotId } = req.params as { key: string; slotId: string }
    if (!UUID_RE.test(slotId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = programSlotPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.locationId !== undefined) patch.locationId = parsed.data.locationId
    if (parsed.data.room !== undefined) patch.roomLabel = parsed.data.room
    if (parsed.data.isPublished !== undefined) patch.isPublished = parsed.data.isPublished
    if (parsed.data.visibility !== undefined) patch.visibility = dbVisibility(parsed.data.visibility)
    const notes = parsed.data.organizerNotesInternal ?? parsed.data.organizerNotes
    if (notes !== undefined) patch.organizerNotes = notes
    if (parsed.data.isFrozen !== undefined) patch.isFrozen = parsed.data.isFrozen
    if (parsed.data.startsAt === null && parsed.data.endsAt === null) {
      patch.isUnscheduled = true
    } else {
      if (parsed.data.startsAt !== undefined && parsed.data.startsAt !== null) {
        patch.startsAt = new Date(parsed.data.startsAt)
        patch.isUnscheduled = false
      }
      if (parsed.data.endsAt !== undefined && parsed.data.endsAt !== null) {
        patch.endsAt = new Date(parsed.data.endsAt)
        patch.isUnscheduled = false
      }
    }
    if (parsed.data.title !== undefined) patch.title = parsed.data.title
    if (parsed.data.track !== undefined) patch.trackLabel = parsed.data.track
    if (parsed.data.description !== undefined) patch.description = parsed.data.description
    if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder
    const [row] = await db
      .update(schema.scheduleSlots)
      .set(patch)
      .where(and(eq(schema.scheduleSlots.id, slotId), eq(schema.scheduleSlots.conventionId, ctx.conv.id)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ slot: mapProgramSlot(row) })
  })

  // --- staff shifts ---
  reg('GET', '/api/v1/conventions/:key/staff-shifts', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const shifts = await loadStaffShifts(ctx.conv.id)
    return reply.send({
      shifts,
      windowStartsAt: iso(ctx.conv.startsAt),
      windowEndsAt: iso(ctx.conv.endsAt),
      timezone: ctx.conv.timezone,
    })
  })

  reg('POST', '/api/v1/conventions/:key/staff-shifts', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = staffShiftBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const defaults = await resolveUserParticipationDefaults(parsed.data.personId)
    if (!defaults) return reply.status(400).send({ error: 'User not found' })
    const personName = parsed.data.personName?.trim() || defaults.displayName
    const title = `${parsed.data.role}: ${personName}`.slice(0, 255)
    const [row] = await db
      .insert(schema.conventionVolunteerShifts)
      .values({
        conventionId: ctx.conv.id,
        title,
        personId: parsed.data.personId,
        personName,
        role: parsed.data.role,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        locationId: parsed.data.locationId ?? undefined,
        shiftStatus: parsed.data.shiftStatus ?? 'assigned',
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({
      shift: mapStaffShiftRow({
        id: row!.id,
        person_id: row!.personId,
        person_name: row!.personName,
        role: row!.role,
        location_id: row!.locationId,
        starts_at: iso(row!.startsAt),
        ends_at: iso(row!.endsAt),
        sort_order: row!.sortOrder,
        shift_status: row!.shiftStatus,
        claimed_by_account_id: row!.claimedByUserId,
        organizer_notes_staff_only: row!.organizerNotesStaffOnly,
        dropped_at: iso(row!.droppedAt),
      }),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/staff-shifts/:shiftId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, shiftId } = req.params as { key: string; shiftId: string }
    if (!UUID_RE.test(shiftId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = staffShiftBody.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [existing] = await db
      .select({ personId: schema.conventionVolunteerShifts.personId })
      .from(schema.conventionVolunteerShifts)
      .where(
        and(eq(schema.conventionVolunteerShifts.id, shiftId), eq(schema.conventionVolunteerShifts.conventionId, ctx.conv.id)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const patch: Record<string, unknown> = {}
    if (parsed.data.personId !== undefined) {
      const defaults = await resolveUserParticipationDefaults(parsed.data.personId)
      if (!defaults) return reply.status(400).send({ error: 'User not found' })
      patch.personId = parsed.data.personId
      patch.personName = parsed.data.personName?.trim() || defaults.displayName
    } else if (parsed.data.personName !== undefined) {
      if (!existing.personId) {
        return reply.status(400).send({ error: 'personId required to assign staff by name' })
      }
      patch.personName = parsed.data.personName
    }
    if (parsed.data.role !== undefined) patch.role = parsed.data.role
    if (parsed.data.startsAt !== undefined) patch.startsAt = new Date(parsed.data.startsAt)
    if (parsed.data.endsAt !== undefined) patch.endsAt = new Date(parsed.data.endsAt)
    if (parsed.data.locationId !== undefined) patch.locationId = parsed.data.locationId
    if (parsed.data.shiftStatus !== undefined) patch.shiftStatus = parsed.data.shiftStatus
    if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder
    const [row] = await db
      .update(schema.conventionVolunteerShifts)
      .set(patch)
      .where(
        and(eq(schema.conventionVolunteerShifts.id, shiftId), eq(schema.conventionVolunteerShifts.conventionId, ctx.conv.id)),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      shift: mapStaffShiftRow({
        id: row.id,
        person_id: row.personId,
        person_name: row.personName,
        role: row.role,
        location_id: row.locationId,
        starts_at: iso(row.startsAt),
        ends_at: iso(row.endsAt),
        sort_order: row.sortOrder,
        shift_status: row.shiftStatus,
        claimed_by_account_id: row.claimedByUserId,
        organizer_notes_staff_only: row.organizerNotesStaffOnly,
        dropped_at: iso(row.droppedAt),
      }),
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/staff-shifts/:shiftId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, shiftId } = req.params as { key: string; shiftId: string }
    if (!UUID_RE.test(shiftId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionVolunteerShifts)
      .where(
        and(eq(schema.conventionVolunteerShifts.id, shiftId), eq(schema.conventionVolunteerShifts.conventionId, ctx.conv.id)),
      )
      .returning({ id: schema.conventionVolunteerShifts.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- dm requirements ---
  reg('GET', '/api/v1/conventions/:key/dm-requirements', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionDmRequirements)
      .where(eq(schema.conventionDmRequirements.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionDmRequirements.startsAt))
    return reply.send({
      requirements: rows.map((r) => ({
        id: r.id,
        locationId: r.locationId,
        startsAt: iso(r.startsAt),
        endsAt: iso(r.endsAt),
        minLead: r.minLead,
        minFloat: r.minFloat,
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/dm-requirements', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = dmReqBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionDmRequirements)
      .values({
        conventionId: ctx.conv.id,
        locationId: parsed.data.locationId,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        minLead: parsed.data.minLead ?? 1,
        minFloat: parsed.data.minFloat ?? 0,
      })
      .returning()
    return reply.send({
      requirement: {
        id: row!.id,
        locationId: row!.locationId,
        startsAt: iso(row!.startsAt),
        endsAt: iso(row!.endsAt),
        minLead: row!.minLead,
        minFloat: row!.minFloat,
      },
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/dm-requirements/:requirementId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, requirementId } = req.params as { key: string; requirementId: string }
    if (!UUID_RE.test(requirementId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = dmReqBody.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.locationId !== undefined) patch.locationId = parsed.data.locationId
    if (parsed.data.startsAt !== undefined) patch.startsAt = new Date(parsed.data.startsAt)
    if (parsed.data.endsAt !== undefined) patch.endsAt = new Date(parsed.data.endsAt)
    if (parsed.data.minLead !== undefined) patch.minLead = parsed.data.minLead
    if (parsed.data.minFloat !== undefined) patch.minFloat = parsed.data.minFloat
    const [row] = await db
      .update(schema.conventionDmRequirements)
      .set(patch)
      .where(
        and(
          eq(schema.conventionDmRequirements.id, requirementId),
          eq(schema.conventionDmRequirements.conventionId, ctx.conv.id),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      requirement: {
        id: row.id,
        locationId: row.locationId,
        startsAt: iso(row.startsAt),
        endsAt: iso(row.endsAt),
        minLead: row.minLead,
        minFloat: row.minFloat,
      },
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/dm-requirements/:requirementId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, requirementId } = req.params as { key: string; requirementId: string }
    if (!UUID_RE.test(requirementId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionDmRequirements)
      .where(
        and(
          eq(schema.conventionDmRequirements.id, requirementId),
          eq(schema.conventionDmRequirements.conventionId, ctx.conv.id),
        ),
      )
      .returning({ id: schema.conventionDmRequirements.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- tracks ---
  reg('GET', '/api/v1/conventions/:key/tracks', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionTracks)
      .where(eq(schema.conventionTracks.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionTracks.sortOrder))
    return reply.send({
      tracks: rows.map((r) => ({ id: r.id, name: r.name, color: r.color, sortOrder: r.sortOrder })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/tracks', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ name: z.string().min(1).max(128), color: z.string().max(32).optional() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionTracks)
      .values({ conventionId: ctx.conv.id, name: parsed.data.name.trim(), color: parsed.data.color ?? '#22d3ee' })
      .returning()
    return reply.send({ track: { id: row!.id, name: row!.name, color: row!.color, sortOrder: row!.sortOrder } })
  })

  reg('PATCH', '/api/v1/conventions/:key/tracks/:trackId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, trackId } = req.params as { key: string; trackId: string }
    if (!UUID_RE.test(trackId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({ name: z.string().min(1).max(128).optional(), color: z.string().max(32).optional(), sortOrder: z.number().int().optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .update(schema.conventionTracks)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      })
      .where(and(eq(schema.conventionTracks.id, trackId), eq(schema.conventionTracks.conventionId, ctx.conv.id)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ track: { id: row.id, name: row.name, color: row.color, sortOrder: row.sortOrder } })
  })

  reg('DELETE', '/api/v1/conventions/:key/tracks/:trackId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, trackId } = req.params as { key: string; trackId: string }
    if (!UUID_RE.test(trackId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    await db
      .update(schema.scheduleSlots)
      .set({ trackId: null, updatedAt: new Date() })
      .where(and(eq(schema.scheduleSlots.conventionId, ctx.conv.id), eq(schema.scheduleSlots.trackId, trackId)))
    const del = await db
      .delete(schema.conventionTracks)
      .where(and(eq(schema.conventionTracks.id, trackId), eq(schema.conventionTracks.conventionId, ctx.conv.id)))
      .returning({ id: schema.conventionTracks.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- tags ---
  reg('GET', '/api/v1/conventions/:key/tags', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionTags)
      .where(eq(schema.conventionTags.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionTags.name))
    return reply.send({ tags: rows.map((r) => ({ id: r.id, name: r.name, scope: r.scope })) })
  })

  reg('POST', '/api/v1/conventions/:key/tags', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ name: z.string().min(1).max(128), scope: z.enum(['session', 'person', 'registrant', 'location']).optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionTags)
      .values({ conventionId: ctx.conv.id, name: parsed.data.name.trim(), scope: parsed.data.scope ?? 'session' })
      .returning()
    return reply.send({ tag: { id: row!.id, name: row!.name, scope: row!.scope } })
  })

  reg('PATCH', '/api/v1/conventions/:key/tags/:tagId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, tagId } = req.params as { key: string; tagId: string }
    if (!UUID_RE.test(tagId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({ name: z.string().min(1).max(128).optional(), scope: z.enum(['session', 'person', 'registrant', 'location']).optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .update(schema.conventionTags)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.scope !== undefined ? { scope: parsed.data.scope } : {}),
      })
      .where(and(eq(schema.conventionTags.id, tagId), eq(schema.conventionTags.conventionId, ctx.conv.id)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ tag: { id: row.id, name: row.name, scope: row.scope } })
  })

  reg('DELETE', '/api/v1/conventions/:key/tags/:tagId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, tagId } = req.params as { key: string; tagId: string }
    if (!UUID_RE.test(tagId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionTags)
      .where(and(eq(schema.conventionTags.id, tagId), eq(schema.conventionTags.conventionId, ctx.conv.id)))
      .returning({ id: schema.conventionTags.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- readiness ---
  reg('GET', '/api/v1/conventions/:key/readiness', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    return reply.send({ checks: await buildReadinessChecks(ctx.conv, false) })
  })

  reg('GET', '/api/v1/conventions/:key/readiness/summary', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    return reply.send({ checks: await buildReadinessChecks(ctx.conv, true) })
  })

  // --- program conflicts ---
  reg('GET', '/api/v1/conventions/:key/program-conflicts', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const slotRows = await db
      .select()
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, ctx.conv.id))
    const slotIds = slotRows.map((s) => s.id)
    const slotPeople =
      slotIds.length > 0
        ? await db
            .select()
            .from(schema.scheduleSlotPersons)
            .where(inArray(schema.scheduleSlotPersons.slotId, slotIds))
        : []
    const locRows = await db
      .select({ id: schema.conventionLocations.id, capacity: schema.conventionLocations.capacity })
      .from(schema.conventionLocations)
      .where(eq(schema.conventionLocations.conventionId, ctx.conv.id))
    const locationCapacity: Record<string, number> = {}
    for (const l of locRows) {
      if (l.capacity != null && l.capacity > 0) locationCapacity[l.id] = l.capacity
    }
    const conflicts = computeDancecardConflicts({
      slots: slotRows
        .filter((s) => iso(s.startsAt) && iso(s.endsAt))
        .map((s) => ({
          id: s.id,
          startsAt: iso(s.startsAt)!,
          endsAt: iso(s.endsAt)!,
          locationId: s.locationId,
          room: s.roomLabel ?? s.location,
          isPublished: s.isPublished,
          visibility: s.visibility,
        })),
      slotPeople: slotPeople.map((sp) => ({ slotId: sp.slotId, personId: sp.personId, role: sp.roleLabel })),
      locationCapacity,
    })
    return reply.send({ conflicts })
  })

  // --- maps ---
  reg('GET', '/api/v1/conventions/:key/maps', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const cmd = await resolveConventionCommandAccess(resolved.conv, actor.userId)
    const canRead =
      resolved.canView ||
      (cmd.hasAnyAccess && commandPermissionIncludes('scheduler', cmd.permissions))
    if (!canRead) return reply.status(403).send({ error: 'Registration required' })
    const rows = await db
      .select()
      .from(schema.conventionMaps)
      .where(eq(schema.conventionMaps.conventionId, resolved.conv.id))
      .orderBy(asc(schema.conventionMaps.sortOrder))
    return reply.send({
      maps: rows.map((m) => ({
        id: m.id,
        title: m.title,
        imagePath: m.imagePath,
        imageUrl: publicUrlForPath(m.imagePath),
        sortOrder: m.sortOrder,
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/maps/upload', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('convention_maps')) {
      return alphaUploadDisabledResponse(reply, 'convention_maps')
    }
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const client = s3()
    const bucket = process.env.S3_BUCKET ?? 'c2k-uploads'
    if (!client) return reply.status(503).send({ error: 'S3 not configured' })
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const ext = data.filename.includes('.') ? data.filename.slice(data.filename.lastIndexOf('.')) : ''
    const path = `conventions/${ctx.conv.id}/maps/${randomUUID()}${ext}`
    const buffer = await data.toBuffer()
    try {
      await putObject(client, {
        Bucket: bucket,
        Key: path,
        Body: buffer,
        ContentType: data.mimetype || 'application/octet-stream',
      })
    } catch (e) {
      const err = e as { name?: string; message?: string }
      req.log?.error({ err }, 'maps/upload PutObject failed')
      return reply.status(502).send({
        error: `Upload storage error (${err.name ?? 'Unknown'}): ${err.message ?? 'failed to write file'}`,
      })
    }
    return reply.send({ path, url: publicUrlForPath(path) })
  })

  reg('POST', '/api/v1/conventions/:key/maps', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ title: z.string().min(1).max(255).optional(), imagePath: z.string().min(1), sortOrder: z.number().int().optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionMaps)
      .values({
        conventionId: ctx.conv.id,
        title: parsed.data.title ?? 'Venue map',
        imagePath: parsed.data.imagePath,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({
      map: {
        id: row!.id,
        title: row!.title,
        imagePath: row!.imagePath,
        imageUrl: publicUrlForPath(row!.imagePath),
        sortOrder: row!.sortOrder,
      },
    })
  })

  reg('GET', '/api/v1/conventions/:key/maps/:mapId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, mapId } = req.params as { key: string; mapId: string }
    if (!UUID_RE.test(mapId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .select()
      .from(schema.conventionMaps)
      .where(and(eq(schema.conventionMaps.id, mapId), eq(schema.conventionMaps.conventionId, ctx.conv.id)))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      map: {
        id: row.id,
        title: row.title,
        imagePath: row.imagePath,
        imageUrl: publicUrlForPath(row.imagePath),
        sortOrder: row.sortOrder,
      },
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/maps/:mapId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, mapId } = req.params as { key: string; mapId: string }
    if (!UUID_RE.test(mapId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({ title: z.string().min(1).max(255).optional(), sortOrder: z.number().int().optional() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .update(schema.conventionMaps)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.conventionMaps.id, mapId), eq(schema.conventionMaps.conventionId, ctx.conv.id)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      map: {
        id: row.id,
        title: row.title,
        imagePath: row.imagePath,
        imageUrl: publicUrlForPath(row.imagePath),
        sortOrder: row.sortOrder,
      },
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/maps/:mapId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, mapId } = req.params as { key: string; mapId: string }
    if (!UUID_RE.test(mapId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [row] = await db
      .delete(schema.conventionMaps)
      .where(and(eq(schema.conventionMaps.id, mapId), eq(schema.conventionMaps.conventionId, ctx.conv.id)))
      .returning({ id: schema.conventionMaps.id })
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  reg('GET', '/api/v1/conventions/:key/maps/:mapId/pins', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, mapId } = req.params as { key: string; mapId: string }
    if (!UUID_RE.test(mapId)) return reply.status(400).send({ error: 'Invalid id' })
    const resolved = await getConventionWithAccess(key, actor.userId)
    if ('notFound' in resolved) return reply.status(404).send({ error: 'Not found' })
    if ('forbidden' in resolved) return reply.status(400).send({ error: 'Convention must be org-owned' })
    const cmd = await resolveConventionCommandAccess(resolved.conv, actor.userId)
    const canRead =
      resolved.canView ||
      (cmd.hasAnyAccess && commandPermissionIncludes('scheduler', cmd.permissions))
    if (!canRead) return reply.status(403).send({ error: 'Registration required' })
    const [map] = await db
      .select()
      .from(schema.conventionMaps)
      .where(and(eq(schema.conventionMaps.id, mapId), eq(schema.conventionMaps.conventionId, resolved.conv.id)))
      .limit(1)
    if (!map) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select()
      .from(schema.conventionMapPins)
      .where(eq(schema.conventionMapPins.mapId, mapId))
    return reply.send({
      pins: rows.map((p) => ({
        locationId: p.locationId,
        x: p.x,
        y: p.y,
        label: p.label,
        shape: p.zoneShape ?? 'circle',
        width: p.zoneSize ?? 0.08,
        height: p.zoneSize ?? 0.08,
        rotation: p.zoneRotation ?? 0,
      })),
    })
  })

  reg('PUT', '/api/v1/conventions/:key/maps/:mapId/pins', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, mapId } = req.params as { key: string; mapId: string }
    if (!UUID_RE.test(mapId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({
        pins: z.array(
          z.object({
            locationId: z.string().uuid(),
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            label: z.string().max(128).nullable().optional(),
            shape: z.string().max(32).optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            rotation: z.number().optional(),
          }),
        ),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [map] = await db
      .select({ id: schema.conventionMaps.id })
      .from(schema.conventionMaps)
      .where(and(eq(schema.conventionMaps.id, mapId), eq(schema.conventionMaps.conventionId, ctx.conv.id)))
      .limit(1)
    if (!map) return reply.status(404).send({ error: 'Not found' })
    await db.delete(schema.conventionMapPins).where(eq(schema.conventionMapPins.mapId, mapId))
    if (parsed.data.pins.length > 0) {
      await db.insert(schema.conventionMapPins).values(
        parsed.data.pins.map((p) => ({
          mapId,
          locationId: p.locationId,
          x: p.x,
          y: p.y,
          label: p.label ?? undefined,
          zoneShape: p.shape ?? 'circle',
          zoneSize: p.width ?? p.height ?? 0.08,
          zoneRotation: p.rotation ?? 0,
        })),
      )
    }
    return reply.send({ ok: true, count: parsed.data.pins.length })
  })

  // --- imports ---
  function mapImportBatch(row: typeof schema.conventionImportBatches.$inferSelect) {
    const summary = (row.summary ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      sourceFilename: row.sourceFilename,
      summary: { total: summary.total ?? 0, ...summary },
      createdAt: iso(row.createdAt),
      publishedAt: iso(row.publishedAt),
    }
  }

  function mapImportRow(row: typeof schema.conventionImportRows.$inferSelect) {
    return {
      id: row.id,
      batchId: row.batchId,
      rowKey: row.rowKey,
      kind: row.kind,
      action: row.action,
      draftStatus: row.draftStatus,
      title: row.title,
      personName: row.personName,
      role: row.role,
      track: row.track,
      room: row.room,
      locationId: row.locationId,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      description: row.description,
      sortOrder: row.sortOrder,
      validationErrors: row.validationErrors,
    }
  }

  reg('GET', '/api/v1/conventions/:key/imports/mapping-profiles', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const kindQ = (req.query as { kind?: string }).kind
    const kind = kindQ === 'staff' ? 'staff' : kindQ === 'program' ? 'program' : undefined
    const rows = await db
      .select()
      .from(schema.conventionImportMappingProfiles)
      .where(
        kind
          ? and(
              eq(schema.conventionImportMappingProfiles.conventionId, ctx.conv.id),
              eq(schema.conventionImportMappingProfiles.kind, kind),
            )
          : eq(schema.conventionImportMappingProfiles.conventionId, ctx.conv.id),
      )
      .orderBy(desc(schema.conventionImportMappingProfiles.updatedAt))
    return reply.send({
      profiles: rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        importFormat: row.importFormat,
        spreadsheetId: row.spreadsheetId,
        headerRowIndex: row.headerRowIndex,
        columnMapping: row.columnMapping,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/imports/mapping-profiles', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const parsed = z
      .object({
        name: z.string().min(1).max(128),
        kind: z.enum(['program', 'staff']),
        importFormat: z.enum(['flat_rows', 'program_grid']).default('flat_rows'),
        spreadsheetId: z.string().max(128).nullable().optional(),
        headerRowIndex: z.number().int().min(0).default(0),
        columnMapping: z.record(z.string()).default({}),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.conventionImportMappingProfiles)
      .values({
        conventionId: ctx.conv.id,
        name: parsed.data.name,
        kind: parsed.data.kind,
        importFormat: parsed.data.importFormat,
        spreadsheetId: parsed.data.spreadsheetId ?? null,
        headerRowIndex: parsed.data.headerRowIndex,
        columnMapping: parsed.data.columnMapping,
        createdByUserId: actor.userId,
      })
      .onConflictDoUpdate({
        target: [
          schema.conventionImportMappingProfiles.conventionId,
          schema.conventionImportMappingProfiles.kind,
          schema.conventionImportMappingProfiles.name,
        ],
        set: {
          importFormat: parsed.data.importFormat,
          spreadsheetId: parsed.data.spreadsheetId ?? null,
          headerRowIndex: parsed.data.headerRowIndex,
          columnMapping: parsed.data.columnMapping,
          updatedAt: new Date(),
        },
      })
      .returning()
    return reply.send({
      profile: {
        id: row!.id,
        name: row!.name,
        kind: row!.kind,
        importFormat: row!.importFormat,
        spreadsheetId: row!.spreadsheetId,
        headerRowIndex: row!.headerRowIndex,
        columnMapping: row!.columnMapping,
        createdAt: iso(row!.createdAt),
        updatedAt: iso(row!.updatedAt),
      },
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/imports/mapping-profiles/:profileId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, profileId } = req.params as { key: string; profileId: string }
    if (!UUID_RE.test(profileId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const parsed = z
      .object({
        name: z.string().min(1).max(128).optional(),
        importFormat: z.enum(['flat_rows', 'program_grid']).optional(),
        spreadsheetId: z.string().max(128).nullable().optional(),
        headerRowIndex: z.number().int().min(0).optional(),
        columnMapping: z.record(z.string()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.importFormat !== undefined) patch.importFormat = parsed.data.importFormat
    if (parsed.data.spreadsheetId !== undefined) patch.spreadsheetId = parsed.data.spreadsheetId
    if (parsed.data.headerRowIndex !== undefined) patch.headerRowIndex = parsed.data.headerRowIndex
    if (parsed.data.columnMapping !== undefined) patch.columnMapping = parsed.data.columnMapping
    const [row] = await db
      .update(schema.conventionImportMappingProfiles)
      .set(patch)
      .where(
        and(
          eq(schema.conventionImportMappingProfiles.id, profileId),
          eq(schema.conventionImportMappingProfiles.conventionId, ctx.conv.id),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      profile: {
        id: row.id,
        name: row.name,
        kind: row.kind,
        importFormat: row.importFormat,
        spreadsheetId: row.spreadsheetId,
        headerRowIndex: row.headerRowIndex,
        columnMapping: row.columnMapping,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      },
    })
  })

  reg('GET', '/api/v1/conventions/:key/imports', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionImportBatches)
      .where(eq(schema.conventionImportBatches.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionImportBatches.createdAt))
    return reply.send({ batches: rows.map(mapImportBatch) })
  })

  reg('POST', '/api/v1/conventions/:key/imports', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const parsed = z
      .object({
        kind: z.enum(['program', 'staff']),
        rows: z.array(z.record(z.string(), z.unknown())).default([]),
        filename: z.string().max(512).optional(),
        columnMapping: z.record(z.string()).optional(),
        headerRowIndex: z.number().int().min(0).optional(),
        importFormat: z.enum(['flat_rows', 'program_grid']).optional(),
        sheetName: z.string().max(255).nullable().optional(),
        mappingProfileId: z.string().uuid().optional(),
        spreadsheetId: z.string().max(128).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const locationRows = await db
      .select({
        id: schema.conventionLocations.id,
        name: schema.conventionLocations.name,
        shortName: schema.conventionLocations.shortName,
      })
      .from(schema.conventionLocations)
      .where(eq(schema.conventionLocations.conventionId, ctx.conv.id))

    const parsedRows = applyRoomMatchesToParsedRows(
      apiPayloadToParsedRows(parsed.data.rows),
      locationRows,
    )

    const { batch, rows: importRows } = await insertImportBatchFromParsed({
      conventionId: ctx.conv.id,
      organizerUserId: actor.userId,
      kind: parsed.data.kind,
      sourceFilename: parsed.data.filename ?? `${parsed.data.kind}-import.json`,
      sheetName: parsed.data.sheetName ?? null,
      columnMapping: parsed.data.columnMapping ?? {},
      importFormat: parsed.data.importFormat ?? 'flat_rows',
      headerRowIndex: parsed.data.headerRowIndex ?? 0,
      mappingProfileId: parsed.data.mappingProfileId ?? null,
      rows: parsedRows,
    })

    if (parsed.data.spreadsheetId) {
      const profile = await findBestMappingProfile(
        ctx.conv.id,
        parsed.data.kind,
        parsed.data.spreadsheetId,
      )
      if (
        profile &&
        parsed.data.columnMapping &&
        Object.keys(parsed.data.columnMapping).length > 0
      ) {
        await db
          .update(schema.conventionImportMappingProfiles)
          .set({
            columnMapping: parsed.data.columnMapping,
            headerRowIndex: parsed.data.headerRowIndex ?? profile.headerRowIndex,
            importFormat: parsed.data.importFormat ?? profile.importFormat,
            updatedAt: new Date(),
          })
          .where(eq(schema.conventionImportMappingProfiles.id, profile.id))
      }
    }

    return reply.send({ batch: mapImportBatch(batch), rows: importRows.map(mapImportRow) })
  })

  reg('GET', '/api/v1/conventions/:key/imports/template.csv', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const kind = (req.query as { kind?: string }).kind === 'staff' ? 'staff' : 'program'
    const { buildTemplateCsv } = await import('@c2k/shared')
    const csv = buildTemplateCsv(kind)
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${kind}-import-template.csv"`)
    return reply.send(csv)
  })

  reg('GET', '/api/v1/conventions/:key/imports/:batchId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, batchId } = req.params as { key: string; batchId: string }
    if (!UUID_RE.test(batchId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [batch] = await db
      .select()
      .from(schema.conventionImportBatches)
      .where(and(eq(schema.conventionImportBatches.id, batchId), eq(schema.conventionImportBatches.conventionId, ctx.conv.id)))
      .limit(1)
    if (!batch) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select()
      .from(schema.conventionImportRows)
      .where(eq(schema.conventionImportRows.batchId, batchId))
      .orderBy(asc(schema.conventionImportRows.sortOrder))
    return reply.send({ batch: mapImportBatch(batch), rows: rows.map(mapImportRow) })
  })

  reg('PATCH', '/api/v1/conventions/:key/imports/:batchId/draft-rows/:rowId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, batchId, rowId } = req.params as { key: string; batchId: string; rowId: string }
    if (!UUID_RE.test(batchId) || !UUID_RE.test(rowId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.record(z.string(), z.unknown()).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    const b = parsed.data
    if (typeof b.title === 'string') patch.title = b.title
    if (typeof b.personName === 'string') patch.personName = b.personName
    if (typeof b.role === 'string') patch.role = b.role
    if (typeof b.track === 'string') patch.track = b.track
    if (typeof b.room === 'string') patch.room = b.room
    if (typeof b.locationId === 'string') patch.locationId = b.locationId
    if (typeof b.startsAt === 'string') patch.startsAt = new Date(b.startsAt)
    if (typeof b.endsAt === 'string') patch.endsAt = new Date(b.endsAt)
    if (typeof b.draftStatus === 'string') patch.draftStatus = b.draftStatus
    const [row] = await db
      .update(schema.conventionImportRows)
      .set(patch)
      .where(
        and(
          eq(schema.conventionImportRows.id, rowId),
          eq(schema.conventionImportRows.batchId, batchId),
          eq(schema.conventionImportRows.conventionId, ctx.conv.id),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ row: mapImportRow(row) })
  })

  reg('POST', '/api/v1/conventions/:key/imports/:batchId/publish-preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, batchId } = req.params as { key: string; batchId: string }
    if (!UUID_RE.test(batchId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [batch] = await db
      .select()
      .from(schema.conventionImportBatches)
      .where(and(eq(schema.conventionImportBatches.id, batchId), eq(schema.conventionImportBatches.conventionId, ctx.conv.id)))
      .limit(1)
    if (!batch) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select()
      .from(schema.conventionImportRows)
      .where(eq(schema.conventionImportRows.batchId, batchId))
    if (batch.kind === 'program') {
      const candidates = rows.map((r) => candidateFromImportRow(r, ctx.conv.id, batch.sheetName))
      const { diff, summary } = await publishProgramCandidates(ctx.conv.id, candidates, { dryRun: true })
      return reply.send({ diff, summary, dryRun: true })
    }
    return reply.send({
      diff: {
        newCount: rows.filter((r) => r.personName && r.role && r.startsAt && r.endsAt).length,
        updatedCount: 0,
        unchangedCount: 0,
        invalidCount: rows.length,
        unplacedCount: 0,
        skippedCount: 0,
        missingFromSourceCount: 0,
        missingFromSourceKeys: [],
        conflicts: [],
        total: rows.length,
        byImportKey: {},
      },
      summary: { created: 0, updated: 0, skipped: 0, invalid: 0, unplaced: 0, missingFromSource: 0, errors: [] },
      dryRun: true,
    })
  })

  reg('POST', '/api/v1/conventions/:key/imports/:batchId/publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, batchId } = req.params as { key: string; batchId: string }
    if (!UUID_RE.test(batchId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const [batch] = await db
      .select()
      .from(schema.conventionImportBatches)
      .where(and(eq(schema.conventionImportBatches.id, batchId), eq(schema.conventionImportBatches.conventionId, ctx.conv.id)))
      .limit(1)
    if (!batch) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select()
      .from(schema.conventionImportRows)
      .where(eq(schema.conventionImportRows.batchId, batchId))

    if (batch.kind === 'program') {
      const candidates = rows.map((r) => candidateFromImportRow(r, ctx.conv.id, batch.sheetName))
      const { diff, summary } = await publishProgramCandidates(ctx.conv.id, candidates)
      await db
        .update(schema.conventionImportBatches)
        .set({
          status: 'published',
          publishedAt: new Date(),
          updatedAt: new Date(),
          summary: {
            total: rows.length,
            created: summary.created,
            updated: summary.updated,
            unchanged: summary.unchanged,
            invalid: summary.invalid,
            unplaced: summary.unplaced,
            missingFromSource: summary.missingFromSource,
            diff,
          },
        })
        .where(eq(schema.conventionImportBatches.id, batchId))
      return reply.send({
        summary: {
          added: summary.created,
          updated: summary.updated,
          unchanged: summary.unchanged,
          skipped: summary.skipped + summary.invalid + summary.unplaced,
          invalid: summary.invalid,
          unplaced: summary.unplaced,
          missingFromSource: summary.missingFromSource,
          notified: 0,
          errors: summary.errors,
          warnings: summary.warnings,
        },
        diff,
      })
    }

    const staffResult = await publishStaffImportRows(ctx.conv.id, rows)
    await db
      .update(schema.conventionImportBatches)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
        summary: { total: rows.length, added: staffResult.added, updated: staffResult.updated, skipped: staffResult.skipped },
      })
      .where(eq(schema.conventionImportBatches.id, batchId))
    return reply.send({
      summary: {
        added: staffResult.added,
        updated: staffResult.updated,
        skipped: staffResult.skipped,
        notified: 0,
      },
    })
  })

  // --- registrants ---
  // Local thin wrapper around the shared mapper. Existing call sites pass only
  // (row, categoryName?, profileDisplayName?); for full check-in eligibility,
  // routes that have already loaded the category row should call
  // mapRegistrantFull directly with { categoryRow }.
  function mapRegistrant(
    row: typeof schema.conventionRegistrants.$inferSelect,
    categoryName?: string | null,
    profileDisplayName?: string | null,
  ) {
    return mapRegistrantFull(row, { categoryName, profileDisplayName })
  }

  reg('GET', '/api/v1/conventions/:key/organizer/user-picker', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'any')
    if (!ctx) return
    const qRaw = (req.query as { q?: string }).q?.trim() ?? ''
    if (qRaw.length >= 2) {
      const pattern = `%${qRaw.replace(/[%_\\]/g, '\\$&')}%`
      const hits = await db
        .select({
          userId: schema.users.id,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
        })
        .from(schema.users)
        .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .where(or(ilike(schema.users.username, pattern), ilike(schema.profiles.displayName, pattern)))
        .orderBy(asc(schema.users.username))
        .limit(25)
      return reply.send({
        users: hits.map((m) => ({
          userId: m.userId,
          displayName: m.displayName ?? m.username,
          username: m.username,
        })),
      })
    }
    const members = await db
      .select({
        userId: schema.organizationMembers.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        ...userEmailSelect,
      })
      .from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.organizationMembers.userId))
      .where(eq(schema.organizationMembers.organizationId, ctx.conv.organizationId!))
      .orderBy(asc(schema.users.username))
    return reply.send({
      users: members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName ?? m.username,
        username: m.username,
        email: getEmailFromUserRow(m),
      })),
    })
  })

  reg('GET', '/api/v1/conventions/:key/registrants', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const q = req.query as { limit?: string; offset?: string; q?: string; status?: string; vetting?: string; categoryId?: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const limit = Math.min(Math.max(Number(q.limit ?? 200), 1), 500)
    const offset = Math.max(Number(q.offset ?? 0), 0)
    const filters = [eq(schema.conventionRegistrants.conventionId, ctx.conv.id)]
    if (q.categoryId && UUID_RE.test(q.categoryId)) {
      filters.push(eq(schema.conventionRegistrants.categoryId, q.categoryId))
    }
    if (q.status === 'checked_in') {
      filters.push(isNotNull(schema.conventionRegistrants.checkedInAt))
    } else if (q.status && q.status !== 'checked_in') {
      filters.push(isNull(schema.conventionRegistrants.checkedInAt))
      if (q.status !== 'registered') {
        const normalized = q.status === 'registered' ? 'confirmed' : q.status
        filters.push(eq(schema.conventionRegistrants.registrationStatus, normalized))
      }
    }
    const search = q.q?.trim()
    if (search) {
      const pattern = `%${search.replace(/[%_\\]/g, '\\$&')}%`
      filters.push(
        or(
          ilike(schema.conventionRegistrants.displayName, pattern),
          ilike(schema.conventionRegistrants.email, pattern),
          ilike(schema.profiles.displayName, pattern),
        )!,
      )
    }
    const rows = await db
      .select({
        reg: schema.conventionRegistrants,
        cat: schema.conventionRegistrationCategories,
        profileDisplayName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .leftJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(and(...filters))
      .orderBy(asc(schema.conventionRegistrants.displayName))
      .limit(limit)
      .offset(offset)
    const [totalRow] = await db
      .select({ n: count() })
      .from(schema.conventionRegistrants)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(and(...filters))
    const directoryByUser = await loadDirectoryPersonIdByUserId(ctx.conv.id)
    let mapped = rows.map((r) => {
      const base = mapRegistrantFull(r.reg, {
        categoryName: r.cat?.name ?? null,
        profileDisplayName: r.profileDisplayName,
        categoryRow: r.cat ?? null,
      })
      const uid = r.reg.userId
      return {
        ...base,
        directoryPersonId: uid ? (directoryByUser.get(uid) ?? null) : null,
      }
    })
    if (q.vetting?.trim()) {
      mapped = mapped.filter((r) => r.vettingStatus === q.vetting)
    }
    return reply.send({
      registrants: mapped,
      total: Number(totalRow?.n ?? 0),
      limit,
      offset,
    })
  })

  async function loadRegistrantDetail(conventionId: string, registrantId: string) {
    const [row] = await db
      .select({
        reg: schema.conventionRegistrants,
        cat: schema.conventionRegistrationCategories,
        profileDisplayName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .leftJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(and(eq(schema.conventionRegistrants.id, registrantId), eq(schema.conventionRegistrants.conventionId, conventionId)))
      .limit(1)
    if (!row) return null
    const answersRows = await db
      .select({
        questionId: schema.conventionRegistrantAnswers.questionId,
        value: schema.conventionRegistrantAnswers.value,
      })
      .from(schema.conventionRegistrantAnswers)
      .where(eq(schema.conventionRegistrantAnswers.registrantId, registrantId))
    const answers: Record<string, unknown> = {}
    for (const a of answersRows) {
      answers[a.questionId] = a.value
    }
    const policyRows = await db
      .select({ policyId: schema.conventionRegistrantPolicyAcceptances.policyId })
      .from(schema.conventionRegistrantPolicyAcceptances)
      .where(eq(schema.conventionRegistrantPolicyAcceptances.registrantId, registrantId))
    return {
      ...mapRegistrantFull(row.reg, {
        categoryName: row.cat?.name ?? null,
        profileDisplayName: row.profileDisplayName,
        categoryRow: row.cat ?? null,
      }),
      importedPaymentStatus: row.reg.importedPaymentStatus ?? null,
      answers,
      tagIds: [] as string[],
      policyDocumentIds: policyRows.map((p) => p.policyId),
    }
  }

  reg('GET', '/api/v1/conventions/:key/registrants/:registrantId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, registrantId } = req.params as { key: string; registrantId: string }
    if (!UUID_RE.test(registrantId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const registrant = await loadRegistrantDetail(ctx.conv.id, registrantId)
    if (!registrant) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ registrant })
  })

  reg('POST', '/api/v1/conventions/:key/registrants', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        userId: z.string().uuid(),
        categoryId: z.string().uuid().optional().nullable(),
        badgeName: z.string().max(255).optional().nullable(),
        pronouns: z.string().max(64).optional().nullable(),
        notes: z.string().max(5000).optional().nullable(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const defaults = await resolveUserParticipationDefaults(parsed.data.userId)
    if (!defaults) return reply.status(400).send({ error: 'User not found' })
    if (parsed.data.categoryId) {
      const categoryOk = await registrationCategoryValidForConvention(ctx.conv.id, parsed.data.categoryId)
      if (!categoryOk) {
        return reply.status(400).send({ error: 'Invalid categoryId for this convention' })
      }
    }
    try {
      const { row, created } = await upsertConventionRegistrant({
        conventionId: ctx.conv.id,
        userId: parsed.data.userId,
        categoryId: parsed.data.categoryId,
        badgeName: parsed.data.badgeName,
        pronouns: parsed.data.pronouns,
        notes: parsed.data.notes,
      })
      await syncAccessGrantOnRegistration({
        conventionId: ctx.conv.id,
        userId: parsed.data.userId,
        grantedByUserId: actor.userId,
      })
      await requestConventionPeopleDirectorySync(ctx.conv.id)
      let categoryName: string | null = null
      if (row.categoryId) {
        const [cat] = await db
          .select({ name: schema.conventionRegistrationCategories.name })
          .from(schema.conventionRegistrationCategories)
          .where(eq(schema.conventionRegistrationCategories.id, row.categoryId))
          .limit(1)
        categoryName = cat?.name ?? null
      }
      const [profileRow] = await db
        .select({ displayName: schema.profiles.displayName })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, parsed.data.userId))
        .limit(1)
      return reply.status(created ? 201 : 200).send({
        registrant: mapRegistrant(row, categoryName, profileRow?.displayName ?? null),
        created,
      })
    } catch (err) {
      req.log.warn({ err }, 'POST registrants failed')
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Could not create registrant',
      })
    }
  })

  reg('POST', '/api/v1/conventions/:key/registrants/import', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        rows: z.array(z.record(z.string(), z.unknown())).min(1),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const categories = await db
      .select({
        id: schema.conventionRegistrationCategories.id,
        name: schema.conventionRegistrationCategories.name,
      })
      .from(schema.conventionRegistrationCategories)
      .where(eq(schema.conventionRegistrationCategories.conventionId, ctx.conv.id))
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]))
    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []
    for (const [index, raw] of parsed.data.rows.entries()) {
      const email = typeof raw.email === 'string' ? raw.email.trim() : ''
      if (!email) {
        skipped++
        errors.push(`Row ${index + 1}: email required to link a ${APP_NAME} account`)
        continue
      }
      const userId = await resolveUserIdByEmail(email)
      if (!userId) {
        skipped++
        errors.push(`Row ${index + 1}: no ${APP_NAME} account for ${email}`)
        continue
      }
      let categoryId: string | null = null
      if (typeof raw.categoryId === 'string' && UUID_RE.test(raw.categoryId)) {
        categoryId = raw.categoryId
      } else {
        const categoryName =
          typeof raw.categoryName === 'string'
            ? raw.categoryName.trim()
            : typeof raw.category === 'string'
              ? raw.category.trim()
              : ''
        if (categoryName) {
          categoryId = categoryByName.get(categoryName.toLowerCase()) ?? null
          if (!categoryId) {
            skipped++
            errors.push(`Row ${index + 1}: unknown category "${categoryName}"`)
            continue
          }
        }
      }
      const badgeName =
        typeof raw.legalName === 'string' ? raw.legalName.trim() || null
        : typeof raw.badgeName === 'string' ? raw.badgeName.trim() || null
        : null
      const externalId = typeof raw.externalId === 'string' ? raw.externalId.trim() || null : null
      try {
        const { created: isNew } = await upsertConventionRegistrant({
          conventionId: ctx.conv.id,
          userId,
          categoryId,
          badgeName,
          externalId,
        })
        await syncAccessGrantOnRegistration({
          conventionId: ctx.conv.id,
          userId,
          grantedByUserId: actor.userId,
        })
        if (isNew) created++
        else updated++
      } catch (e) {
        skipped++
        errors.push(`Row ${index + 1}: ${e instanceof Error ? e.message : 'Import failed'}`)
      }
    }
    if (created > 0 || updated > 0) {
      await requestConventionPeopleDirectorySync(ctx.conv.id)
    }
    return reply.send({ created, updated, skipped, errors })
  })

  reg('PATCH', '/api/v1/conventions/:key/registrants/:registrantId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, registrantId } = req.params as { key: string; registrantId: string }
    if (!UUID_RE.test(registrantId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({
        categoryId: z.string().uuid().nullable().optional(),
        badgeName: z.string().max(255).nullable().optional(),
        pronouns: z.string().max(64).nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
        internalNotes: z.string().max(5000).nullable().optional(),
        status: z
          .enum(['imported', 'pending', 'confirmed', 'cancelled', 'waitlisted', 'checked_in', 'registered'])
          .optional(),
        vettingStatus: z.enum(VETTING_STATUS_VALUES).optional(),
        vettingSafetyNotes: z.string().max(5000).nullable().optional(),
        importedPaymentStatus: z.string().max(64).nullable().optional(),
        earlyCheckInOverride: z.boolean().optional(),
        answers: z.record(z.string(), z.unknown()).optional(),
        policyDocumentIds: z.array(z.string().uuid()).optional(),
        tagIds: z.array(z.string().uuid()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const [existing] = await db
      .select()
      .from(schema.conventionRegistrants)
      .where(
        and(eq(schema.conventionRegistrants.id, registrantId), eq(schema.conventionRegistrants.conventionId, ctx.conv.id)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const body = parsed.data
    const patch: Partial<typeof schema.conventionRegistrants.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (body.categoryId !== undefined) patch.categoryId = body.categoryId ?? undefined
    if (body.badgeName !== undefined) patch.badgeName = body.badgeName ?? undefined
    if (body.pronouns !== undefined) patch.pronouns = body.pronouns ?? undefined
    const notes = body.internalNotes ?? body.notes
    if (notes !== undefined) patch.notes = notes ?? undefined
    if (body.vettingStatus !== undefined) patch.vettingStatus = body.vettingStatus
    if (body.vettingSafetyNotes !== undefined) patch.vettingSafetyNotes = body.vettingSafetyNotes ?? undefined
    if (body.importedPaymentStatus !== undefined) {
      patch.importedPaymentStatus = body.importedPaymentStatus ?? undefined
    }
    if (body.status === 'checked_in') {
      let categoryRow: typeof schema.conventionRegistrationCategories.$inferSelect | null = null
      if (existing.categoryId) {
        const [c] = await db
          .select()
          .from(schema.conventionRegistrationCategories)
          .where(eq(schema.conventionRegistrationCategories.id, existing.categoryId))
          .limit(1)
        categoryRow = c ?? null
      }
      const resolvedCheckIn = resolveCheckInUpdate(categoryRow ?? null, {
        earlyCheckInOverride: body.earlyCheckInOverride,
        registrationStatus: existing.registrationStatus,
      })
      if (!resolvedCheckIn.ok) return reply.status(resolvedCheckIn.status).send(resolvedCheckIn.body)
      Object.assign(patch, resolvedCheckIn.patch)
    } else if (body.status !== undefined) {
      patch.checkedInAt = null
      patch.checkedInTiming = null
      patch.registrationStatus = body.status === 'registered' ? 'confirmed' : body.status
    }
    const [row] = await db
      .update(schema.conventionRegistrants)
      .set(patch)
      .where(eq(schema.conventionRegistrants.id, registrantId))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })

    if (body.answers && Object.keys(body.answers).length > 0) {
      for (const [questionId, value] of Object.entries(body.answers)) {
        if (!UUID_RE.test(questionId)) continue
        await db
          .insert(schema.conventionRegistrantAnswers)
          .values({
            registrantId,
            questionId,
            value: typeof value === 'string' ? value : JSON.stringify(value),
          })
          .onConflictDoUpdate({
            target: [schema.conventionRegistrantAnswers.registrantId, schema.conventionRegistrantAnswers.questionId],
            set: { value: typeof value === 'string' ? value : JSON.stringify(value) },
          })
      }
    }

    if (body.policyDocumentIds) {
      await db
        .delete(schema.conventionRegistrantPolicyAcceptances)
        .where(eq(schema.conventionRegistrantPolicyAcceptances.registrantId, registrantId))
      if (body.policyDocumentIds.length > 0) {
        await db.insert(schema.conventionRegistrantPolicyAcceptances).values(
          body.policyDocumentIds.map((policyId) => ({
            registrantId,
            policyId,
          })),
        )
      }
    }

    if (row.userId && (body.pronouns !== undefined || notes !== undefined)) {
      if (body.pronouns !== undefined) {
        await db.update(schema.profiles).set({ pronouns: body.pronouns ?? null }).where(eq(schema.profiles.userId, row.userId))
      }
    }

    await requestConventionPeopleDirectorySync(ctx.conv.id)
    let categoryName: string | null = null
    if (row.categoryId) {
      const [cat] = await db
        .select({ name: schema.conventionRegistrationCategories.name })
        .from(schema.conventionRegistrationCategories)
        .where(eq(schema.conventionRegistrationCategories.id, row.categoryId))
        .limit(1)
      categoryName = cat?.name ?? null
    }
    const profileDisplayName =
      row.userId ?
        (
          await db
            .select({ displayName: schema.profiles.displayName })
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, row.userId))
            .limit(1)
        )[0]?.displayName ?? null
      : null
    return reply.send({ registrant: mapRegistrant(row, categoryName, profileDisplayName) })
  })

  reg('DELETE', '/api/v1/conventions/:key/registrants/:registrantId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, registrantId } = req.params as { key: string; registrantId: string }
    if (!UUID_RE.test(registrantId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionRegistrants)
      .where(
        and(eq(schema.conventionRegistrants.id, registrantId), eq(schema.conventionRegistrants.conventionId, ctx.conv.id)),
      )
      .returning({ id: schema.conventionRegistrants.id })
    if (del.length === 0) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- messaging ---
  reg('GET', '/api/v1/conventions/:key/message-templates', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionMessageTemplates)
      .where(eq(schema.conventionMessageTemplates.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionMessageTemplates.updatedAt))
    return reply.send({
      templates: rows.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        bodyText: t.bodyHtml,
      })),
    })
  })

  reg('GET', '/api/v1/conventions/:key/message-campaigns/audience', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    const {
      parseCampaignAudienceMode,
      countConventionCampaignAudience,
    } = await import('../lib/convention-campaign-audience.js')
    const q = req.query as { audience?: string }
    const audience = parseCampaignAudienceMode({ audience: q.audience ?? 'going_and_interested' })
    const counts = await countConventionCampaignAudience({
      conventionId: ctx.conv.id,
      organizationId: ctx.conv.organizationId,
      anchorEventId: ctx.conv.anchorEventId,
      audience,
    })
    return reply.send({ audience, ...counts })
  })

  reg('POST', '/api/v1/conventions/:key/message-templates', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        name: z.string().min(1).max(255),
        subject: z.string().min(1).max(512),
        bodyText: z.string().min(1).optional(),
        bodyHtml: z.string().min(1).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const rawBody = (parsed.data.bodyHtml ?? parsed.data.bodyText ?? '').trim()
    if (!rawBody) return reply.status(400).send({ error: 'bodyHtml or bodyText required' })
    const bodyHtml = sanitizeDmHtml(rawBody)
    if (!bodyHtml.trim()) return reply.status(400).send({ error: 'bodyHtml or bodyText required' })
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionMessageTemplates)
      .values({
        conventionId: ctx.conv.id,
        name: parsed.data.name.trim(),
        subject: parsed.data.subject.trim(),
        bodyHtml,
      })
      .returning()
    return reply.send({
      template: {
        id: row!.id,
        name: row!.name,
        subject: row!.subject,
        bodyText: row!.bodyHtml,
        bodyHtml: row!.bodyHtml,
      },
    })
  })

  reg('GET', '/api/v1/conventions/:key/message-campaigns', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    const rows = await db
      .select({
        campaign: schema.conventionMessageCampaigns,
        templateName: schema.conventionMessageTemplates.name,
      })
      .from(schema.conventionMessageCampaigns)
      .leftJoin(
        schema.conventionMessageTemplates,
        eq(schema.conventionMessageTemplates.id, schema.conventionMessageCampaigns.templateId),
      )
      .where(eq(schema.conventionMessageCampaigns.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionMessageCampaigns.createdAt))
    const ids = rows.map((r) => r.campaign.id)
    const deliveryCounts = new Map<string, { total: number; sent: number; failed: number }>()
    if (ids.length) {
      const deliveries = await db
        .select()
        .from(schema.conventionMessageDeliveries)
        .where(inArray(schema.conventionMessageDeliveries.campaignId, ids))
      for (const d of deliveries) {
        const bucket = deliveryCounts.get(d.campaignId) ?? { total: 0, sent: 0, failed: 0 }
        bucket.total += 1
        if (d.status === 'sent') bucket.sent += 1
        if (d.status === 'failed') bucket.failed += 1
        deliveryCounts.set(d.campaignId, bucket)
      }
    }
    return reply.send({
      campaigns: rows.map((r) => {
        const c = deliveryCounts.get(r.campaign.id) ?? { total: 0, sent: 0, failed: 0 }
        return {
          id: r.campaign.id,
          name: r.campaign.name,
          templateId: r.campaign.templateId ?? '',
          templateName: r.templateName ?? 'Untitled',
          status: r.campaign.status ?? (r.campaign.sentAt ? 'sent' : 'draft'),
          createdAt: iso(r.campaign.createdAt),
          sentAt: iso(r.campaign.sentAt),
          deliveryTotal: c.total,
          deliverySent: c.sent,
          deliveryFailed: c.failed,
          audienceFilter: r.campaign.audienceFilter ?? {},
          sendError: r.campaign.sendError ?? null,
        }
      }),
    })
  })

  reg('POST', '/api/v1/conventions/:key/message-campaigns', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        name: z.string().min(1).max(255).optional(),
        templateId: z.string().uuid().optional().nullable(),
        audienceFilter: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    let name = parsed.data.name?.trim()
    if (!name && parsed.data.templateId) {
      const [tpl] = await db
        .select({ name: schema.conventionMessageTemplates.name })
        .from(schema.conventionMessageTemplates)
        .where(eq(schema.conventionMessageTemplates.id, parsed.data.templateId))
        .limit(1)
      name = tpl?.name?.trim()
    }
    if (!name) name = `Campaign ${new Date().toISOString()}`
    const { parseCampaignAudienceMode } = await import('../lib/convention-campaign-audience.js')
    const audience = parseCampaignAudienceMode(parsed.data.audienceFilter ?? { audience: 'going_and_interested' })
    const audienceFilter = { audience }
    const [row] = await db
      .insert(schema.conventionMessageCampaigns)
      .values({
        conventionId: ctx.conv.id,
        name,
        templateId: parsed.data.templateId ?? undefined,
        audienceFilter,
        createdByUserId: actor.userId,
        status: 'draft',
      })
      .returning()
    return reply.send({
      campaign: { id: row!.id, name: row!.name, status: row!.status, audienceFilter },
    })
  })

  reg('POST', '/api/v1/conventions/:key/message-campaigns/:campaignId/send', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, campaignId } = req.params as { key: string; campaignId: string }
    if (!UUID_RE.test(campaignId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    const [campaign] = await db
      .select()
      .from(schema.conventionMessageCampaigns)
      .where(
        and(
          eq(schema.conventionMessageCampaigns.conventionId, ctx.conv.id),
          eq(schema.conventionMessageCampaigns.id, campaignId),
        ),
      )
      .limit(1)
    if (!campaign) return reply.status(404).send({ error: 'Not found' })
    if (campaign.status === 'sending' || campaign.status === 'sent') {
      return reply.status(409).send({ error: `Campaign already ${campaign.status}` })
    }
    if (!campaign.templateId) return reply.status(400).send({ error: 'No template configured' })
    const [template] = await db
      .select()
      .from(schema.conventionMessageTemplates)
      .where(eq(schema.conventionMessageTemplates.id, campaign.templateId))
      .limit(1)
    if (!template) return reply.status(400).send({ error: 'Template missing' })

    await db
      .update(schema.conventionMessageCampaigns)
      .set({ status: 'sending', sendError: null })
      .where(eq(schema.conventionMessageCampaigns.id, campaign.id))

    const { parseCampaignAudienceMode } = await import('../lib/convention-campaign-audience.js')
    const {
      resolveConventionInboxCampaignRecipients,
      buildOrganizerCampaignMessageHtml,
      deliverOrganizerCampaignDm,
      deliveryEmailPlaceholder,
    } = await import('../lib/organizer-inbox-campaign.js')
    const { stripToPlainText } = await import('../lib/marketing-email-html.js')
    const audience = parseCampaignAudienceMode(campaign.audienceFilter)
    const recipients = await resolveConventionInboxCampaignRecipients({
      conventionId: ctx.conv.id,
      organizationId: ctx.conv.organizationId,
      anchorEventId: ctx.conv.anchorEventId,
      audience,
    })
    const htmlBody = buildOrganizerCampaignMessageHtml({
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      eventName: ctx.conv.name,
    })
    const bodyPreview = stripToPlainText(htmlBody)

    let sent = 0
    let failed = 0
    let skipped = 0
    for (const r of recipients) {
      if (r.userId === actor.userId) {
        skipped += 1
        continue
      }
      const idemKey = `${campaign.id}:dm:${r.userId}`
      const result = await deliverOrganizerCampaignDm({
        organizerUserId: actor.userId,
        recipientUserId: r.userId,
        htmlBody,
        bodyPreview,
      })
      const status: 'sent' | 'failed' | 'skipped' = result.ok ? 'sent' : 'failed'
      if (result.ok) sent += 1
      else failed += 1
      const email = await deliveryEmailPlaceholder(r.userId, r.email)
      await db
        .insert(schema.conventionMessageDeliveries)
        .values({
          campaignId: campaign.id,
          registrantId: r.registrantId,
          email,
          status,
          idempotencyKey: idemKey,
          providerMessageId: result.ok ? result.messageId : null,
          sentAt: result.ok ? new Date() : null,
          error: result.ok ? null : result.error,
        })
        .onConflictDoNothing()
    }

    const finalStatus = failed && !sent ? 'failed' : 'sent'
    await db
      .update(schema.conventionMessageCampaigns)
      .set({ status: finalStatus, sentAt: new Date() })
      .where(eq(schema.conventionMessageCampaigns.id, campaign.id))
    return reply.send({
      campaign: {
        id: campaign.id,
        status: finalStatus,
        sent,
        failed,
        skipped,
        total: recipients.length,
        audience,
        channel: 'inbox',
      },
      feedPublished: false,
      channel: 'inbox',
      sent,
      failed,
      skipped,
      recipientCount: recipients.length,
      audience,
      emailsSkipped: true,
      emailSkipReason: 'Campaigns deliver to kink.social Messaging inbox (not SMTP email).',
    })
  })

  // --- exports ---
  reg('GET', '/api/v1/conventions/:key/exports/sessions', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const q = req.query as { format?: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const slots = await loadProgramSlots(ctx.conv.id)
    if (q.format === 'csv') {
      const header = ['id', 'title', 'startsAt', 'endsAt', 'track', 'room', 'locationId', 'isPublished']
      const lines = [
        header.join(','),
        ...slots.map((s) =>
          [s.id, s.title, s.startsAt, s.endsAt, s.track, s.room, s.locationId, String(s.isPublished)]
            .map((c) => escapeCsvCell(String(c ?? '')))
            .join(','),
        ),
      ]
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${ctx.conv.slug}-sessions.csv"`)
      return reply.send(lines.join('\n'))
    }
    return reply.send({ sessions: slots })
  })

  reg('GET', '/api/v1/conventions/:key/exports/conflict-report', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const q = req.query as { format?: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const slotRows = await db
      .select()
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, ctx.conv.id))
    const slotIds = slotRows.map((s) => s.id)
    const slotPeople =
      slotIds.length > 0
        ? await db
            .select()
            .from(schema.scheduleSlotPersons)
            .where(inArray(schema.scheduleSlotPersons.slotId, slotIds))
        : []
    const conflicts = computeDancecardConflicts({
      slots: slotRows
        .filter((s) => iso(s.startsAt) && iso(s.endsAt))
        .map((s) => ({
          id: s.id,
          startsAt: iso(s.startsAt)!,
          endsAt: iso(s.endsAt)!,
          locationId: s.locationId,
          room: s.roomLabel ?? s.location,
          isPublished: s.isPublished,
          visibility: s.visibility,
        })),
      slotPeople: slotPeople.map((sp) => ({ slotId: sp.slotId, personId: sp.personId, role: sp.roleLabel })),
    })
    if (q.format === 'csv') {
      const header = ['id', 'severity', 'title', 'detail', 'relatedSlotIds']
      const lines = [
        header.join(','),
        ...conflicts.map((c) =>
          [c.id, c.severity, c.title, c.detail ?? '', c.relatedSlotIds.join(';')]
            .map((cell) => escapeCsvCell(String(cell)))
            .join(','),
        ),
      ]
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${ctx.conv.slug}-conflicts.csv"`)
      return reply.send(lines.join('\n'))
    }
    return reply.send({ conflicts })
  })

  // --- integrations ---
  function mintSecret(prefix: string): { prefix: string; secret: string; hash: string } {
    const secret = `${prefix}_${randomBytes(24).toString('hex')}`
    const hash = createHash('sha256').update(secret).digest('hex')
    return { prefix, secret, hash }
  }

  reg('GET', '/api/v1/conventions/:key/api-keys', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionApiKeys)
      .where(eq(schema.conventionApiKeys.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionApiKeys.createdAt))
    return reply.send({
      keys: rows.map((k) => ({
        id: k.id,
        name: k.label,
        scopes: (k.scopes as string[]) ?? [],
        created_at: iso(k.createdAt),
        revoked_at: iso(k.revokedAt),
        last_used_at: null,
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/api-keys', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ name: z.string().min(1).max(255), scopes: z.array(z.string()).default([]) })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const minted = mintSecret('c2k')
    const [row] = await db
      .insert(schema.conventionApiKeys)
      .values({
        conventionId: ctx.conv.id,
        label: parsed.data.name.trim(),
        keyPrefix: minted.prefix,
        keyHash: minted.hash,
        scopes: parsed.data.scopes,
        createdByUserId: actor.userId,
      })
      .returning()
    return reply.send({
      key: {
        id: row!.id,
        name: row!.label,
        scopes: (row!.scopes as string[]) ?? [],
        created_at: iso(row!.createdAt),
        revoked_at: null,
        last_used_at: null,
      },
      secret: minted.secret,
    })
  })

  reg('GET', '/api/v1/conventions/:key/webhooks', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionWebhookSubscriptions)
      .where(eq(schema.conventionWebhookSubscriptions.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionWebhookSubscriptions.createdAt))
    return reply.send({
      webhooks: rows.map((w) => ({
        id: w.id,
        url: w.url,
        event_types: (w.events as string[]) ?? [],
        eventTypes: (w.events as string[]) ?? [],
        created_at: iso(w.createdAt),
        createdAt: iso(w.createdAt),
        revoked_at: w.active ? null : iso(w.createdAt),
        revokedAt: w.active ? null : iso(w.createdAt),
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/webhooks', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        url: z.string().url(),
        event_types: z.array(z.string()).optional(),
        eventTypes: z.array(z.string()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const eventTypes = parsed.data.eventTypes ?? parsed.data.event_types ?? []
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const secret = randomBytes(16).toString('hex')
    const [row] = await db
      .insert(schema.conventionWebhookSubscriptions)
      .values({
        conventionId: ctx.conv.id,
        url: parsed.data.url,
        events: eventTypes,
        secret,
      })
      .returning()
    const subscription = {
      id: row!.id,
      url: row!.url,
      event_types: (row!.events as string[]) ?? [],
      eventTypes: (row!.events as string[]) ?? [],
      created_at: iso(row!.createdAt),
      createdAt: iso(row!.createdAt),
      revoked_at: null,
      revokedAt: null,
    }
    return reply.send({ webhook: subscription, subscription, secret, signingSecret: secret })
  })

  reg('GET', '/api/v1/conventions/:key/embed-tokens', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionEmbedTokens)
      .where(eq(schema.conventionEmbedTokens.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionEmbedTokens.createdAt))
    return reply.send({
      tokens: rows.map((t) => ({
        id: t.id,
        embedKind: t.kind,
        label: null,
        allowedOrigins: (t.allowedOrigins as string[]) ?? [],
        createdAt: iso(t.createdAt),
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/embed-tokens', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        embedKind: z.string().max(32).optional(),
        label: z.string().max(255).optional(),
        allowedOrigins: z.array(z.string()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const minted = mintSecret('embed')
    const [row] = await db
      .insert(schema.conventionEmbedTokens)
      .values({
        conventionId: ctx.conv.id,
        tokenPrefix: minted.prefix,
        tokenHash: minted.hash,
        kind: parsed.data.embedKind ?? 'schedule',
        allowedOrigins: parsed.data.allowedOrigins ?? [],
      })
      .returning()
    return reply.send({ token: minted.secret, id: row!.id })
  })

  reg('GET', '/api/v1/conventions/:key/event-entitlements', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionEventEntitlements)
      .where(eq(schema.conventionEventEntitlements.conventionId, ctx.conv.id))
    const modules: Record<string, boolean> = { ...DEFAULT_MODULES }
    for (const r of rows) modules[r.moduleKey] = r.enabled
    return reply.send({ modules })
  })

  async function persistEntitlements(conventionId: string, modules: Record<string, boolean>) {
    for (const [moduleKey, enabled] of Object.entries(modules)) {
      await db
        .insert(schema.conventionEventEntitlements)
        .values({ conventionId, moduleKey, enabled, config: {} })
        .onConflictDoUpdate({
          target: [schema.conventionEventEntitlements.conventionId, schema.conventionEventEntitlements.moduleKey],
          set: { enabled, updatedAt: new Date() },
        })
    }
    const rows = await db
      .select()
      .from(schema.conventionEventEntitlements)
      .where(eq(schema.conventionEventEntitlements.conventionId, conventionId))
    const result: Record<string, boolean> = { ...DEFAULT_MODULES }
    for (const r of rows) result[r.moduleKey] = r.enabled
    return result
  }

  for (const method of ['POST', 'PATCH'] as const) {
    reg(method, '/api/v1/conventions/:key/event-entitlements', async (req, reply) => {
      if (!requireDb(reply)) return
      const actor = requireUser(req, reply)
      if (!actor) return
      const { key } = req.params as { key: string }
      const parsed = z.object({ modules: z.record(z.string(), z.boolean()) }).safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      }
      const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
      if (!ctx) return
      const modules = await persistEntitlements(ctx.conv.id, parsed.data.modules)
      return reply.send({ modules })
    })
  }

  reg('GET', '/api/v1/conventions/:key/usage-meter', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const windowDays = 30
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

    const activeKeyRows = await db
      .select({ value: count() })
      .from(schema.conventionApiKeys)
      .where(
        and(eq(schema.conventionApiKeys.conventionId, ctx.conv.id), isNull(schema.conventionApiKeys.revokedAt)),
      )
    const activeApiKeys = Number(activeKeyRows[0]?.value ?? 0)

    // Convention API keys do not yet track lastUsedAt; report 0 until that column lands.
    const apiKeysUsedInWindow = 0

    const deliveryRows = await db
      .select({ value: count() })
      .from(schema.conventionWebhookDeliveries)
      .innerJoin(
        schema.conventionWebhookSubscriptions,
        eq(schema.conventionWebhookSubscriptions.id, schema.conventionWebhookDeliveries.subscriptionId),
      )
      .where(
        and(
          eq(schema.conventionWebhookSubscriptions.conventionId, ctx.conv.id),
          gte(schema.conventionWebhookDeliveries.createdAt, windowStart),
        ),
      )
    const webhookDeliveries30d = Number(deliveryRows[0]?.value ?? 0)

    return reply.send({ windowDays, activeApiKeys, apiKeysUsedInWindow, webhookDeliveries30d })
  })

  // --- shift swaps ---
  reg('GET', '/api/v1/conventions/:key/shift-swaps', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionShiftSwapRequests)
      .where(eq(schema.conventionShiftSwapRequests.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionShiftSwapRequests.createdAt))
    return reply.send({
      swaps: rows.map((s) => ({
        id: s.id,
        from_shift_id: s.shiftId,
        to_shift_id: s.shiftId,
        requester_account_id: s.requesterUserId,
        status: s.status,
        note: s.note,
        created_at: iso(s.createdAt),
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/shift-swaps', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ shiftId: z.string().uuid(), note: z.string().max(2000).optional() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionShiftSwapRequests)
      .values({
        conventionId: ctx.conv.id,
        shiftId: parsed.data.shiftId,
        requesterUserId: actor.userId,
        note: parsed.data.note,
      })
      .returning()
    return reply.send({ swap: { id: row!.id, status: row!.status } })
  })

  reg('PATCH', '/api/v1/conventions/:key/shift-swaps/:swapId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, swapId } = req.params as { key: string; swapId: string }
    if (!UUID_RE.test(swapId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({ status: z.enum(['approved', 'declined', 'rejected', 'denied', 'pending', 'cancelled']) })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const normalizedStatus =
      parsed.data.status === 'declined' || parsed.data.status === 'rejected' ? 'denied' : parsed.data.status
    const [row] = await db
      .update(schema.conventionShiftSwapRequests)
      .set({
        status: normalizedStatus,
        respondedAt: normalizedStatus === 'pending' ? null : new Date(),
      })
      .where(
        and(eq(schema.conventionShiftSwapRequests.id, swapId), eq(schema.conventionShiftSwapRequests.conventionId, ctx.conv.id)),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      swap: {
        id: row.id,
        from_shift_id: row.shiftId,
        to_shift_id: row.shiftId,
        requester_account_id: row.requesterUserId,
        status: row.status,
        note: row.note,
        created_at: iso(row.createdAt),
      },
    })
  })

  // --- vetting applications ---
  reg('GET', '/api/v1/conventions/:key/vetting-applications', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionVettingApplications)
      .where(eq(schema.conventionVettingApplications.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionVettingApplications.createdAt))
    return reply.send({
      applications: rows.map((a) => {
        const payload = (a.payload ?? {}) as Record<string, unknown>
        return {
          id: a.id,
          scene_display_name: a.applicantName,
          email: a.applicantEmail,
          status: a.status === 'denied' ? 'rejected' : a.status === 'withdrawn' ? 'rejected' : a.status,
          organizer_notes: typeof payload.organizerNotes === 'string' ? payload.organizerNotes : null,
          payload,
          trusted_role_id: a.trustedRoleId,
          trusted_role:
            a.trustedRoleId && a.roleApplied ?
              { id: a.trustedRoleId, name: a.roleApplied, apply_slug: a.roleApplied.toLowerCase().replace(/\s+/g, '-') }
            : a.roleApplied ?
              { id: '', name: a.roleApplied, apply_slug: a.roleApplied.toLowerCase().replace(/\s+/g, '-') }
            : null,
          created_at: iso(a.createdAt),
          updated_at: iso(a.updatedAt),
        }
      }),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/vetting-applications/:applicationId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, applicationId } = req.params as { key: string; applicationId: string }
    if (!UUID_RE.test(applicationId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({
        status: z.enum(['pending', 'review', 'approved', 'rejected']).optional(),
        organizerNotes: z.string().max(5000).nullable().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const [existing] = await db
      .select()
      .from(schema.conventionVettingApplications)
      .where(
        and(
          eq(schema.conventionVettingApplications.id, applicationId),
          eq(schema.conventionVettingApplications.conventionId, ctx.conv.id),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const payload = { ...(existing.payload as Record<string, unknown>) }
    if (parsed.data.organizerNotes !== undefined) {
      payload.organizerNotes = parsed.data.organizerNotes
    }
    const nextStatus =
      parsed.data.status === 'rejected' ? 'denied'
      : parsed.data.status === 'review' ? 'pending'
      : parsed.data.status === 'approved' ? 'approved'
      : parsed.data.status === 'pending' ? 'pending'
      : existing.status
    const [row] = await db
      .update(schema.conventionVettingApplications)
      .set({
        status: nextStatus,
        payload,
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionVettingApplications.id, applicationId))
      .returning()

    // After commit: notify the applicant when a decision is made.
    if (
      existing.applicantUserId &&
      nextStatus !== existing.status &&
      (nextStatus === 'approved' || nextStatus === 'denied')
    ) {
      try {
        await createNotification(
          existing.applicantUserId,
          nextStatus === 'approved'
            ? NOTIFICATION_TYPES.conventionApplicationApproved
            : NOTIFICATION_TYPES.conventionApplicationRejected,
          {
            conventionId: ctx.conv.id,
            conventionSlug: ctx.conv.slug,
            applicationId,
            roleTitle: existing.roleApplied ?? null,
          },
        )
      } catch (err) {
        req.log.error({ err }, 'failed to notify applicant of vetting decision')
      }
    }

    return reply.send({ application: row })
  })

  reg('POST', '/api/v1/conventions/:key/vetting-applications', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        applicantName: z.string().min(1).max(255),
        applicantEmail: z.string().email().optional().nullable(),
        roleApplied: z.string().max(128).optional().nullable(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionVettingApplications)
      .values({
        conventionId: ctx.conv.id,
        applicantName: parsed.data.applicantName.trim(),
        applicantEmail: parsed.data.applicantEmail ?? undefined,
        roleApplied: parsed.data.roleApplied ?? undefined,
        payload: parsed.data.payload ?? {},
      })
      .returning()
    return reply.send({ application: { id: row!.id, status: row!.status } })
  })

  // --- safety incidents ---
  reg('GET', '/api/v1/conventions/:key/safety-incidents', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionSafetyIncidents)
      .where(eq(schema.conventionSafetyIncidents.conventionId, ctx.conv.id))
      .orderBy(desc(schema.conventionSafetyIncidents.createdAt))
    return reply.send({
      incidents: rows.map((i) => ({
        id: i.id,
        reportedAt: iso(i.createdAt),
        summary: i.title,
        safetyNotes: i.description,
        status: i.status,
        locationLabel: i.locationLabel,
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/safety-incidents', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        summary: z.string().min(1).max(255),
        safetyNotes: z.string().max(5000).optional(),
        locationLabel: z.string().max(255).optional(),
        severity: z.string().max(32).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionSafetyIncidents)
      .values({
        conventionId: ctx.conv.id,
        reportedByUserId: actor.userId,
        title: parsed.data.summary.trim(),
        description: parsed.data.safetyNotes,
        locationLabel: parsed.data.locationLabel,
        severity: parsed.data.severity ?? 'medium',
      })
      .returning()
    return reply.send({
      incident: {
        id: row!.id,
        reportedAt: iso(row!.createdAt),
        summary: row!.title,
        safetyNotes: row!.description,
        status: row!.status,
        locationLabel: row!.locationLabel,
      },
    })
  })

  const commandTeamBody = z.object({
    canRegistration: z.boolean().optional(),
    canStaffOps: z.boolean().optional(),
    canScheduler: z.boolean().optional(),
    note: z.string().max(500).nullable().optional(),
  })

  reg('GET', '/api/v1/conventions/:key/command-team', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select({
        id: schema.conventionCommandGrants.id,
        userId: schema.conventionCommandGrants.userId,
        canRegistration: schema.conventionCommandGrants.canRegistration,
        canStaffOps: schema.conventionCommandGrants.canStaffOps,
        canScheduler: schema.conventionCommandGrants.canScheduler,
        note: schema.conventionCommandGrants.note,
        grantedAt: schema.conventionCommandGrants.grantedAt,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.conventionCommandGrants)
      .innerJoin(schema.users, eq(schema.conventionCommandGrants.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.conventionCommandGrants.conventionId, ctx.conv.id))
      .orderBy(asc(schema.users.username))
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        canRegistration: r.canRegistration,
        canStaffOps: r.canStaffOps,
        canScheduler: r.canScheduler,
        note: r.note,
        grantedAt: iso(r.grantedAt),
      })),
    })
  })

  reg('PUT', '/api/v1/conventions/:key/command-team/:userId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, userId: targetUserId } = req.params as { key: string; userId: string }
    if (!UUID_RE.test(targetUserId)) return reply.status(400).send({ error: 'Invalid user id' })
    const parsed = commandTeamBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, targetUserId)).limit(1)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const flags = {
      canRegistration: parsed.data.canRegistration ?? false,
      canStaffOps: parsed.data.canStaffOps ?? false,
      canScheduler: parsed.data.canScheduler ?? false,
    }
    if (!flags.canRegistration && !flags.canStaffOps && !flags.canScheduler) {
      await db
        .delete(schema.conventionCommandGrants)
        .where(
          and(
            eq(schema.conventionCommandGrants.conventionId, ctx.conv.id),
            eq(schema.conventionCommandGrants.userId, targetUserId),
          ),
        )
      return reply.send({ ok: true, revoked: true })
    }
    const [row] = await db
      .insert(schema.conventionCommandGrants)
      .values({
        conventionId: ctx.conv.id,
        userId: targetUserId,
        ...flags,
        note: parsed.data.note ?? null,
        grantedByUserId: actor.userId,
      })
      .onConflictDoUpdate({
        target: [schema.conventionCommandGrants.conventionId, schema.conventionCommandGrants.userId],
        set: {
          ...flags,
          note: parsed.data.note ?? null,
          grantedByUserId: actor.userId,
          grantedAt: new Date(),
        },
      })
      .returning()
    return reply.send({
      grant: {
        id: row!.id,
        userId: row!.userId,
        canRegistration: row!.canRegistration,
        canStaffOps: row!.canStaffOps,
        canScheduler: row!.canScheduler,
        note: row!.note,
        grantedAt: iso(row!.grantedAt),
      },
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/command-team/:userId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, userId: targetUserId } = req.params as { key: string; userId: string }
    if (!UUID_RE.test(targetUserId)) return reply.status(400).send({ error: 'Invalid user id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    await db
      .delete(schema.conventionCommandGrants)
      .where(
        and(
          eq(schema.conventionCommandGrants.conventionId, ctx.conv.id),
          eq(schema.conventionCommandGrants.userId, targetUserId),
        ),
      )
    return reply.send({ ok: true })
  })

  registerConventionOrganizerExtensionRoutes(app, registered)

  app.log.info({ count: registered.length, routes: registered }, 'Convention organizer routes registered')
}
