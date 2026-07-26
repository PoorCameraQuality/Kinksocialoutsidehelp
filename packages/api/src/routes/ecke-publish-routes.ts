/**
 * HTTP routes for ECKE outbound publish (listings, dancecard events, queue/inline).
 *
 * Prefer thin handlers that call `ecke-publish-service` / queue / client modules.
 * Some paths still embed payload build + transport (second service layer) — full
 * thin-handler split deferred (A10). Outbound-only; never authenticate ECKE users here.
 *
 * @see docs/ECKE_PUBLIC_PUBLISHING_CONTRACT.md
 */
import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import {
  buildConventionListingPayload,
  buildDancecardEventPayload,
  buildGroupListingPayload,
  buildOrgListingPayload,
  derivePublishStatus,
  hashEckePayload,
  isDancecardPublishEnabled,
  type EckeListingPayload,
  type EckePublishTargetPreview,
} from '../lib/ecke-publish-payload.js'
import {
  loadEckePublishClientConfig,
  publishDancecardEventToEcke,
  publishDungeonRowToEcke,
  publishListingToEcke,
  resolveEckePublicEventUrl,
  type EckePublishResult,
} from '../lib/ecke-publish-client.js'
import {
  buildEckeDungeonRowFromOrg,
  buildEckeEventRowFromListing,
  buildEckeEventRowFromStandaloneEvent,
  isOrgDungeonListing,
} from '../lib/ecke-directory-sync.js'
import { parseOrgFeatureFlags } from '../lib/org-features.js'
import { resolveVenueGeoFromFlags } from '../lib/org-venue-sync.js'
import {
  requestEckeConventionEventPublish,
  requestEckeStandaloneEventPublish,
} from '../lib/ecke-publish-queue.js'
import {
  executeEckePublishConventionEvent,
  executeEckePublishStandaloneEvent,
  executeEckeUnpublishConventionEvent,
  executeEckeUnpublishStandaloneEvent,
} from '../lib/ecke-publish-executor.js'
import {
  buildStandaloneEventListingPayload,
  isStandaloneEventEckeEligible,
  resolveStandaloneEventEckeSlug,
} from '../lib/ecke-publish-payload.js'
import { resolveConventionCommandAccess } from '../lib/convention-command-access.js'
import { filterSlotsForPublicProgram } from '../lib/convention-program-policy.js'

function buildOrgDungeonRow(org: {
  id: string
  slug: string
  displayName: string
  bio: string | null
  externalSiteUrl: string | null
  visibility: string
  featureFlags: unknown
}) {
  const geo = resolveVenueGeoFromFlags(parseOrgFeatureFlags(org.featureFlags))
  return buildEckeDungeonRowFromOrg({
    id: org.id,
    slug: org.slug,
    displayName: org.displayName,
    bio: org.bio,
    websiteUrl: org.externalSiteUrl,
    visibility: org.visibility,
    city: geo.city,
    state: geo.state,
  })
}

function orgDungeonTargetPreview(org: {
  id: string
  slug: string
  displayName: string
  bio: string | null
  externalSiteUrl: string | null
  visibility: string
  featureFlags: unknown
}): EckePublishTargetPreview | null {
  if (!isOrgDungeonListing(org.featureFlags)) return null
  const dungeonRow = buildOrgDungeonRow({
    id: org.id,
    slug: org.slug,
    displayName: org.displayName,
    bio: org.bio,
    externalSiteUrl: org.externalSiteUrl ?? null,
    visibility: org.visibility,
    featureFlags: org.featureFlags,
  })
  return {
    targetKind: 'ecke_dungeon',
    externalSlug: dungeonRow.slug,
    payload: dungeonRow,
    contentHash: hashEckePayload(dungeonRow),
  }
}

const ORG_ROLE_RANK: Record<string, number> = {
  MEMBER: 1,
  STAFF: 2,
  MODERATOR: 3,
  ADMIN: 4,
  OWNER: 5,
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

function isBridgeConnected(): boolean {
  return loadEckePublishClientConfig() !== null
}

async function requireOrgModerator(orgSlug: string, userId: string, reply: FastifyReply) {
  const [row] = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
      bio: schema.organizations.bio,
      logoUrl: schema.organizations.logoUrl,
      visibility: schema.organizations.visibility,
      featureFlags: schema.organizations.featureFlags,
      externalSiteUrl: schema.organizations.externalSiteUrl,
      role: schema.organizationMembers.role,
    })
    .from(schema.organizations)
    .innerJoin(
      schema.organizationMembers,
      eq(schema.organizationMembers.organizationId, schema.organizations.id),
    )
    .where(and(eq(schema.organizations.slug, orgSlug), eq(schema.organizationMembers.userId, userId)))
    .limit(1)

  if (!row) {
    reply.status(404).send({ error: 'Organization not found' })
    return null
  }
  if ((ORG_ROLE_RANK[row.role] ?? 0) < ORG_ROLE_RANK.MODERATOR) {
    reply.status(403).send({ error: 'Moderator access required' })
    return null
  }
  return row
}

async function requireConventionModerator(conventionSlug: string, userId: string, reply: FastifyReply) {
  const [conv] = await db
    .select({
      id: schema.conventions.id,
      slug: schema.conventions.slug,
      name: schema.conventions.name,
      description: schema.conventions.description,
      timezone: schema.conventions.timezone,
      startsAt: schema.conventions.startsAt,
      endsAt: schema.conventions.endsAt,
      settings: schema.conventions.settings,
      organizationId: schema.conventions.organizationId,
      anchorEventId: schema.conventions.anchorEventId,
    })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, conventionSlug))
    .limit(1)

  if (!conv) {
    reply.status(404).send({ error: 'Convention not found' })
    return null
  }
  if (!conv.organizationId) {
    reply.status(403).send({ error: 'Convention has no owning organization' })
    return null
  }

  const [convRow] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.id, conv.id))
    .limit(1)
  if (!convRow) {
    reply.status(404).send({ error: 'Convention not found' })
    return null
  }
  const access = await resolveConventionCommandAccess(convRow, userId)
  if (!access.permissions.isFullAdmin) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  let org: { slug: string; displayName: string; logoUrl: string | null } | null = null
  const [orgRow] = await db
    .select({
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
      logoUrl: schema.organizations.logoUrl,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, conv.organizationId))
    .limit(1)
  org = orgRow ?? null

  let anchor: {
    title: string | null
    description: string | null
    startsAt: Date | null
    endsAt: Date | null
    location: string | null
    publicLocationSummary: string | null
    imageUrl: string | null
    visibility: string | null
  } | null = null

  if (conv.anchorEventId) {
    const [ev] = await db
      .select({
        title: schema.events.title,
        description: schema.events.description,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        location: schema.events.location,
        publicLocationSummary: schema.events.publicLocationSummary,
        imageUrl: schema.events.imageUrl,
        visibility: schema.events.visibility,
      })
      .from(schema.events)
      .where(eq(schema.events.id, conv.anchorEventId))
      .limit(1)
    anchor = ev ?? null
  }

  const slotsRaw = await db
    .select({
      id: schema.scheduleSlots.id,
      startsAt: schema.scheduleSlots.startsAt,
      endsAt: schema.scheduleSlots.endsAt,
      title: schema.scheduleSlots.title,
      description: schema.scheduleSlots.description,
      location: schema.scheduleSlots.location,
      trackLabel: schema.scheduleSlots.trackLabel,
      roomLabel: schema.scheduleSlots.roomLabel,
      locationId: schema.scheduleSlots.locationId,
      sortOrder: schema.scheduleSlots.sortOrder,
      isPublished: schema.scheduleSlots.isPublished,
      visibility: schema.scheduleSlots.visibility,
    })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conv.id))
    .orderBy(asc(schema.scheduleSlots.startsAt), asc(schema.scheduleSlots.sortOrder))

  const slotsPublished = filterSlotsForPublicProgram(slotsRaw, 'anonymous')

  const locationRows = await db
    .select({
      id: schema.conventionLocations.id,
      name: schema.conventionLocations.name,
      shortName: schema.conventionLocations.shortName,
      capacity: schema.conventionLocations.capacity,
      sortOrder: schema.conventionLocations.sortOrder,
      parentId: schema.conventionLocations.parentId,
    })
    .from(schema.conventionLocations)
    .where(eq(schema.conventionLocations.conventionId, conv.id))
    .orderBy(asc(schema.conventionLocations.sortOrder))

  const locationNameById = new Map(locationRows.map((l) => [l.id, l.name]))

  const volunteerShifts = await db
    .select({
      id: schema.conventionVolunteerShifts.id,
      title: schema.conventionVolunteerShifts.title,
      startsAt: schema.conventionVolunteerShifts.startsAt,
      endsAt: schema.conventionVolunteerShifts.endsAt,
      locationId: schema.conventionVolunteerShifts.locationId,
      sortOrder: schema.conventionVolunteerShifts.sortOrder,
    })
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conv.id))
    .orderBy(asc(schema.conventionVolunteerShifts.startsAt), asc(schema.conventionVolunteerShifts.sortOrder))

  return {
    conv,
    org,
    anchor,
    slots: slotsPublished.map((s) => ({
      ...s,
      locationName: s.locationId ? locationNameById.get(s.locationId) ?? null : null,
    })),
    locations: locationRows,
    volunteerShifts,
  }
}

async function requireGroupModerator(groupId: string, userId: string, reply: FastifyReply) {
  const [g] = await db
    .select({
      id: schema.groups.id,
      slug: schema.groups.slug,
      name: schema.groups.name,
      description: schema.groups.description,
      visibility: schema.groups.visibility,
      organizationId: schema.groups.organizationId,
    })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1)

  if (!g || g.visibility === 'owner_absent') {
    reply.status(404).send({ error: 'Group not found' })
    return null
  }

  const [membership] = await db
    .select({ role: schema.groupMembers.role })
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
    .limit(1)

  const groupRole = membership?.role?.toLowerCase() ?? ''
  const groupMod = ['owner', 'admin', 'moderator', 'event_host'].includes(groupRole)

  let orgMod = false
  let org: { slug: string; displayName: string } | null = null
  if (g.organizationId) {
    const [orgRow] = await db
      .select({
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizations)
      .innerJoin(
        schema.organizationMembers,
        eq(schema.organizationMembers.organizationId, schema.organizations.id),
      )
      .where(and(eq(schema.organizations.id, g.organizationId), eq(schema.organizationMembers.userId, userId)))
      .limit(1)
    if (orgRow && (ORG_ROLE_RANK[orgRow.role] ?? 0) >= ORG_ROLE_RANK.MODERATOR) {
      orgMod = true
      org = { slug: orgRow.slug, displayName: orgRow.displayName }
    } else if (g.organizationId) {
      const [po] = await db
        .select({ slug: schema.organizations.slug, displayName: schema.organizations.displayName })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, g.organizationId))
        .limit(1)
      org = po ?? null
    }
  }

  if (!groupMod && !orgMod) {
    reply.status(403).send({ error: 'Group moderator access required' })
    return null
  }

  return { group: g, org }
}

async function upsertTargetRow(input: {
  scopeType: 'organization' | 'convention' | 'group' | 'event'
  organizationId?: string | null
  conventionId?: string | null
  groupId?: string | null
  eventId?: string | null
  targetKind: 'ecke_listing' | 'dancecard_event' | 'ecke_event' | 'ecke_dungeon'
  externalSlug: string
  contentHash: string
  userId: string
}) {
  const now = new Date()
  const existing =
    input.scopeType === 'organization' ?
      await db
        .select({ id: schema.eckePublishTargets.id, publishedContentHash: schema.eckePublishTargets.publishedContentHash, lastPublishedAt: schema.eckePublishTargets.lastPublishedAt })
        .from(schema.eckePublishTargets)
        .where(
          and(
            eq(schema.eckePublishTargets.organizationId, input.organizationId!),
            eq(schema.eckePublishTargets.targetKind, input.targetKind),
          ),
        )
        .limit(1)
    : input.scopeType === 'convention' ?
      await db
        .select({ id: schema.eckePublishTargets.id, publishedContentHash: schema.eckePublishTargets.publishedContentHash, lastPublishedAt: schema.eckePublishTargets.lastPublishedAt })
        .from(schema.eckePublishTargets)
        .where(
          and(
            eq(schema.eckePublishTargets.conventionId, input.conventionId!),
            eq(schema.eckePublishTargets.targetKind, input.targetKind),
          ),
        )
        .limit(1)
    : input.scopeType === 'event' ?
      await db
        .select({ id: schema.eckePublishTargets.id, publishedContentHash: schema.eckePublishTargets.publishedContentHash, lastPublishedAt: schema.eckePublishTargets.lastPublishedAt })
        .from(schema.eckePublishTargets)
        .where(
          and(
            eq(schema.eckePublishTargets.eventId, input.eventId!),
            eq(schema.eckePublishTargets.targetKind, input.targetKind),
          ),
        )
        .limit(1)
    : await db
        .select({ id: schema.eckePublishTargets.id, publishedContentHash: schema.eckePublishTargets.publishedContentHash, lastPublishedAt: schema.eckePublishTargets.lastPublishedAt })
        .from(schema.eckePublishTargets)
        .where(
          and(
            eq(schema.eckePublishTargets.groupId, input.groupId!),
            eq(schema.eckePublishTargets.targetKind, input.targetKind),
          ),
        )
        .limit(1)

  const prev = existing[0]
  const status = derivePublishStatus(input.contentHash, prev?.publishedContentHash, prev?.lastPublishedAt)

  if (prev) {
    await db
      .update(schema.eckePublishTargets)
      .set({
        externalSlug: input.externalSlug,
        contentHash: input.contentHash,
        status,
        lastPreviewAt: now,
        updatedAt: now,
      })
      .where(eq(schema.eckePublishTargets.id, prev.id))
    return status
  }

  await db.insert(schema.eckePublishTargets).values({
    scopeType: input.scopeType,
    organizationId: input.organizationId ?? null,
    conventionId: input.conventionId ?? null,
    groupId: input.groupId ?? null,
    eventId: input.eventId ?? null,
    targetKind: input.targetKind,
    externalSlug: input.externalSlug,
    contentHash: input.contentHash,
    status,
    lastPreviewAt: now,
  })

  return status
}

async function markPublishOutcome(input: {
  scopeType: 'organization' | 'convention' | 'group' | 'event'
  organizationId?: string | null
  conventionId?: string | null
  groupId?: string | null
  eventId?: string | null
  targetKind: 'ecke_listing' | 'dancecard_event' | 'ecke_event' | 'ecke_dungeon'
  contentHash: string
  userId: string
  result: EckePublishResult
}) {
  const now = new Date()
  const where =
    input.scopeType === 'organization' ?
      and(
        eq(schema.eckePublishTargets.organizationId, input.organizationId!),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )
    : input.scopeType === 'convention' ?
      and(
        eq(schema.eckePublishTargets.conventionId, input.conventionId!),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )
    : input.scopeType === 'event' ?
      and(eq(schema.eckePublishTargets.eventId, input.eventId!), eq(schema.eckePublishTargets.targetKind, input.targetKind))
    : and(
        eq(schema.eckePublishTargets.groupId, input.groupId!),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )

  if (input.result.ok) {
    await db
      .update(schema.eckePublishTargets)
      .set({
        status: 'published',
        contentHash: input.contentHash,
        publishedContentHash: input.contentHash,
        lastPublishedAt: now,
        lastAttemptAt: now,
        lastError: null,
        publishedByUserId: input.userId,
        updatedAt: now,
      })
      .where(where)
    return 'published' as const
  }

  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'error',
      lastAttemptAt: now,
      lastError: input.result.error,
      updatedAt: now,
    })
    .where(where)
  return 'error' as const
}

async function publishOrgListing(
  org: {
    id: string
    slug: string
    displayName: string
    bio: string | null
    logoUrl: string | null
    visibility: string
    featureFlags?: unknown
    externalSiteUrl?: string | null
  },
  userId: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      listingPayload: EckeListingPayload
      listingHash: string
      result: EckePublishResult
      status: 'published' | 'error'
      dungeonResult?: EckePublishResult
    }
> {
  const cfg = loadEckePublishClientConfig()
  if (!cfg) {
    return { ok: false as const, error: 'Publish bridge not configured (ECKE_PUBLISH_ENABLED + Supabase creds)' }
  }

  const listingPayload = buildOrgListingPayload(org)
  const listingHash = hashEckePayload(listingPayload)
  await upsertTargetRow({
    scopeType: 'organization',
    organizationId: org.id,
    targetKind: 'ecke_listing',
    externalSlug: listingPayload.slug,
    contentHash: listingHash,
    userId,
  })

  const result = await publishListingToEcke(cfg, listingPayload)
  const status = await markPublishOutcome({
    scopeType: 'organization',
    organizationId: org.id,
    targetKind: 'ecke_listing',
    contentHash: listingHash,
    userId,
    result,
  })

  let dungeonResult: EckePublishResult | undefined
  if (isOrgDungeonListing(org.featureFlags)) {
    const dungeonRow = buildOrgDungeonRow({
      id: org.id,
      slug: org.slug,
      displayName: org.displayName,
      bio: org.bio,
      externalSiteUrl: org.externalSiteUrl ?? null,
      visibility: org.visibility,
      featureFlags: org.featureFlags,
    })
    const dungeonHash = hashEckePayload(dungeonRow)
    await upsertTargetRow({
      scopeType: 'organization',
      organizationId: org.id,
      targetKind: 'ecke_dungeon',
      externalSlug: dungeonRow.slug,
      contentHash: dungeonHash,
      userId,
    })
    dungeonResult = await publishDungeonRowToEcke(cfg, dungeonRow)
    await markPublishOutcome({
      scopeType: 'organization',
      organizationId: org.id,
      targetKind: 'ecke_dungeon',
      contentHash: dungeonHash,
      userId,
      result: dungeonResult,
    })
  }

  return { ok: true, listingPayload, listingHash, result, status, dungeonResult }
}

async function publishConventionTargets(
  resolved: NonNullable<Awaited<ReturnType<typeof requireConventionModerator>>>,
  userId: string,
  dancecardStatus: 'draft' | 'published' = 'published',
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      results: Array<{
        targetKind: 'ecke_listing' | 'dancecard_event' | 'ecke_event' | 'ecke_dungeon'
        externalSlug: string
        status: string
        contentHash: string
        ok: boolean
        error?: string
        publicUrl?: string
        message?: string
        slotCount?: number
        staffShiftCount?: number
      }>
    }
> {
  const cfg = loadEckePublishClientConfig()
  if (!cfg) {
    return { ok: false as const, error: 'Publish bridge not configured (ECKE_PUBLISH_ENABLED + Supabase creds)' }
  }

  const { conv, org, anchor, slots, locations, volunteerShifts } = resolved
  const results: Array<{
    targetKind: 'ecke_listing' | 'dancecard_event' | 'ecke_event' | 'ecke_dungeon'
    externalSlug: string
    status: string
    contentHash: string
    ok: boolean
    error?: string
    publicUrl?: string
    message?: string
    slotCount?: number
    staffShiftCount?: number
  }> = []

  const listingPayload = buildConventionListingPayload({
    conventionSlug: conv.slug,
    conventionName: conv.name,
    conventionDescription: conv.description,
    startsAt: conv.startsAt,
    endsAt: conv.endsAt,
    settings: conv.settings,
    orgSlug: org?.slug ?? null,
    orgDisplayName: org?.displayName ?? null,
    anchor,
  })
  const listingHash = hashEckePayload(listingPayload)
  await upsertTargetRow({
    scopeType: 'convention',
    conventionId: conv.id,
    targetKind: 'ecke_listing',
    externalSlug: listingPayload.slug,
    contentHash: listingHash,
    userId,
  })
  const listingResult = await publishListingToEcke(cfg, listingPayload)
  const listingStatus = await markPublishOutcome({
    scopeType: 'convention',
    conventionId: conv.id,
    targetKind: 'ecke_listing',
    contentHash: listingHash,
    userId,
    result: listingResult,
  })
  results.push({
    targetKind: 'ecke_listing',
    externalSlug: listingPayload.slug,
    status: listingStatus,
    contentHash: listingHash,
    ok: listingResult.ok,
    error: listingResult.ok ? undefined : listingResult.error,
  })

  // Direct Supabase `events` upsert - independent of optional listing webhook
  const eventRow = buildEckeEventRowFromListing(listingPayload, conv.id, 'convention')
  const eventHash = hashEckePayload(eventRow)
  await upsertTargetRow({
    scopeType: 'convention',
    conventionId: conv.id,
    targetKind: 'ecke_event',
    externalSlug: eventRow.slug,
    contentHash: eventHash,
    userId,
  })

  const inline = process.env.C2K_ECKE_PUBLISH_INLINE === 'true'
  if (inline) {
    const eventResult = await executeEckePublishConventionEvent(conv.id, userId)
    results.push({
      targetKind: 'ecke_event',
      externalSlug: eventRow.slug,
      status: eventResult.ok ? 'published' : 'error',
      contentHash: eventHash,
      ok: eventResult.ok,
      error: eventResult.ok ? undefined : eventResult.error,
      publicUrl: eventResult.ok ? resolveEckePublicEventUrl(eventRow.slug) : undefined,
      message: eventResult.ok ? 'Published to ECKE events' : eventResult.error,
    })
  } else {
    try {
      await requestEckeConventionEventPublish(conv.id, userId)
      results.push({
        targetKind: 'ecke_event',
        externalSlug: eventRow.slug,
        status: 'queued',
        contentHash: eventHash,
        ok: true,
        message: 'Queued for ECKE events publish',
      })
    } catch (err) {
      results.push({
        targetKind: 'ecke_event',
        externalSlug: eventRow.slug,
        status: 'error',
        contentHash: eventHash,
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to queue ECKE event publish',
      })
    }
  }

  if (isDancecardPublishEnabled(conv.settings)) {
    const dancecardPayload = buildDancecardEventPayload({
      conventionSlug: conv.slug,
      conventionName: conv.name,
      conventionDescription: conv.description,
      timezone: conv.timezone,
      startsAt: conv.startsAt,
      endsAt: conv.endsAt,
      settings: conv.settings,
      orgDisplayName: org?.displayName ?? null,
      orgSlug: org?.slug ?? null,
      logoUrl: org?.logoUrl ?? null,
      locations,
      slots,
      volunteerShifts,
      publishStatus: dancecardStatus,
    })
    const dancecardHash = hashEckePayload(dancecardPayload)
    await upsertTargetRow({
      scopeType: 'convention',
      conventionId: conv.id,
      targetKind: 'dancecard_event',
      externalSlug: dancecardPayload.slug,
      contentHash: dancecardHash,
      userId,
    })
    const dancecardResult = await publishDancecardEventToEcke(cfg, dancecardPayload)
    const dcStatus = await markPublishOutcome({
      scopeType: 'convention',
      conventionId: conv.id,
      targetKind: 'dancecard_event',
      contentHash: dancecardHash,
      userId,
      result: dancecardResult,
    })
    results.push({
      targetKind: 'dancecard_event',
      externalSlug: dancecardPayload.slug,
      status: dcStatus,
      contentHash: dancecardHash,
      ok: dancecardResult.ok,
      error: dancecardResult.ok ? undefined : dancecardResult.error,
      slotCount: slots.length,
      staffShiftCount: volunteerShifts.length,
    })
  }

  return { ok: true as const, results }
}

async function loadTargetRows(scopeType: 'organization' | 'convention' | 'group' | 'event', scopeId: string) {
  if (scopeType === 'organization') {
    return db
      .select()
      .from(schema.eckePublishTargets)
      .where(eq(schema.eckePublishTargets.organizationId, scopeId))
  }
  if (scopeType === 'convention') {
    return db
      .select()
      .from(schema.eckePublishTargets)
      .where(eq(schema.eckePublishTargets.conventionId, scopeId))
  }
  if (scopeType === 'event') {
    return db
      .select()
      .from(schema.eckePublishTargets)
      .where(eq(schema.eckePublishTargets.eventId, scopeId))
  }
  return db
    .select()
    .from(schema.eckePublishTargets)
    .where(eq(schema.eckePublishTargets.groupId, scopeId))
}

type StandaloneEventContext = {
  ev: {
    id: string
    hostId: string
    title: string
    description: string | null
    startsAt: Date
    endsAt: Date | null
    location: string | null
    publicLocationSummary: string | null
    locationVisibility: 'public' | 'rsvp' | 'approved'
    imageUrl: string | null
    visibility: string
    organizationId: string | null
    category: string | null
    tags: string[] | null
  }
  org: { slug: string; displayName: string } | null
  hostDisplayName: string | null
  isConventionAnchor: boolean
  priorEckeSlug: string | null
}

async function resolveStandaloneEventContext(eventIdOrSlug: string): Promise<StandaloneEventContext | null> {
  const trimmed = eventIdOrSlug.trim()
  const isUuid = /^[0-9a-f-]{36}$/i.test(trimmed)

  let eventId = isUuid ? trimmed : null
  if (!eventId) {
    const [target] = await db
      .select({ eventId: schema.eckePublishTargets.eventId })
      .from(schema.eckePublishTargets)
      .where(
        and(
          eq(schema.eckePublishTargets.scopeType, 'event'),
          eq(schema.eckePublishTargets.externalSlug, trimmed.toLowerCase()),
          eq(schema.eckePublishTargets.targetKind, 'ecke_event'),
        ),
      )
      .limit(1)
    eventId = target?.eventId ?? null
  }
  if (!eventId) return null

  const [ev] = await db
    .select({
      id: schema.events.id,
      hostId: schema.events.hostId,
      title: schema.events.title,
      description: schema.events.description,
      startsAt: schema.events.startsAt,
      endsAt: schema.events.endsAt,
      location: schema.events.location,
      publicLocationSummary: schema.events.publicLocationSummary,
      locationVisibility: schema.events.locationVisibility,
      imageUrl: schema.events.imageUrl,
      visibility: schema.events.visibility,
      organizationId: schema.events.organizationId,
      category: schema.events.category,
      tags: schema.events.tags,
    })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  if (!ev) return null

  const [anchorConv] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.anchorEventId, ev.id))
    .limit(1)

  let org: { slug: string; displayName: string } | null = null
  if (ev.organizationId) {
    const [o] = await db
      .select({ slug: schema.organizations.slug, displayName: schema.organizations.displayName })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, ev.organizationId))
      .limit(1)
    org = o ?? null
  }

  const [hostProfile] = await db
    .select({ displayName: schema.profiles.displayName, username: schema.users.username })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, ev.hostId))
    .limit(1)

  const [priorTarget] = await db
    .select({ externalSlug: schema.eckePublishTargets.externalSlug })
    .from(schema.eckePublishTargets)
    .where(and(eq(schema.eckePublishTargets.eventId, ev.id), eq(schema.eckePublishTargets.targetKind, 'ecke_event')))
    .limit(1)

  return {
    ev,
    org,
    hostDisplayName: hostProfile?.displayName?.trim() || hostProfile?.username || null,
    isConventionAnchor: Boolean(anchorConv),
    priorEckeSlug: priorTarget?.externalSlug ?? null,
  }
}

async function requireEventPublisher(eventIdOrSlug: string, userId: string, reply: FastifyReply) {
  const ctx = await resolveStandaloneEventContext(eventIdOrSlug)
  if (!ctx) {
    reply.status(404).send({ error: 'Event not found' })
    return null
  }

  if (ctx.ev.hostId === userId) return ctx

  if (ctx.ev.organizationId) {
    const [orgRow] = await db
      .select({ role: schema.organizationMembers.role })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, ctx.ev.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)
    if (orgRow && (ORG_ROLE_RANK[orgRow.role] ?? 0) >= ORG_ROLE_RANK.MODERATOR) {
      return ctx
    }
  }

  reply.status(403).send({ error: 'Event host or org moderator access required' })
  return null
}

function buildStandaloneEventPreview(ctx: StandaloneEventContext): {
  listingPayload: EckeListingPayload
  listingHash: string
  eventRow: ReturnType<typeof buildEckeEventRowFromStandaloneEvent>
  eventHash: string
} {
  const listingPayload = buildStandaloneEventListingPayload({
    eventId: ctx.ev.id,
    title: ctx.ev.title,
    description: ctx.ev.description,
    startsAt: ctx.ev.startsAt,
    endsAt: ctx.ev.endsAt,
    location: ctx.ev.location,
    publicLocationSummary: ctx.ev.publicLocationSummary,
    locationVisibility: ctx.ev.locationVisibility,
    imageUrl: ctx.ev.imageUrl,
    orgSlug: ctx.org?.slug ?? null,
    orgDisplayName: ctx.org?.displayName ?? null,
    hostDisplayName: ctx.hostDisplayName,
    visibility: ctx.ev.visibility,
    eckeSlug: ctx.priorEckeSlug ?? resolveStandaloneEventEckeSlug(ctx.ev.title, ctx.ev.id),
  })
  const listingHash = hashEckePayload(listingPayload)
  const eventRow = buildEckeEventRowFromStandaloneEvent(listingPayload, ctx.ev.id, {
    category: ctx.ev.category,
    tags: ctx.ev.tags,
  })
  const eventHash = hashEckePayload(eventRow)
  return { listingPayload, listingHash, eventRow, eventHash }
}

async function publishStandaloneEventTarget(
  ctx: StandaloneEventContext,
  userId: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      result: {
        targetKind: 'ecke_event'
        externalSlug: string
        status: string
        contentHash: string
        ok: boolean
        error?: string
        publicUrl?: string
        message?: string
      }
    }
> {
  const cfg = loadEckePublishClientConfig()
  if (!cfg) {
    return { ok: false as const, error: 'Publish bridge not configured (ECKE_PUBLISH_ENABLED + Supabase creds)' }
  }

  const eligibility = isStandaloneEventEckeEligible({
    visibility: ctx.ev.visibility,
    isConventionAnchor: ctx.isConventionAnchor,
  })
  if (!eligibility.eligible) {
    return { ok: false as const, error: eligibility.reason ?? 'Event not eligible for ECKE publish' }
  }

  const { listingPayload, eventRow, eventHash } = buildStandaloneEventPreview(ctx)
  if (listingPayload.visibility === 'hidden') {
    return { ok: false as const, error: 'Event listing is not public' }
  }

  await upsertTargetRow({
    scopeType: 'event',
    eventId: ctx.ev.id,
    targetKind: 'ecke_event',
    externalSlug: eventRow.slug,
    contentHash: eventHash,
    userId,
  })

  const inline = process.env.C2K_ECKE_PUBLISH_INLINE === 'true'
  if (inline) {
    const eventResult = await executeEckePublishStandaloneEvent(ctx.ev.id, userId)
    return {
      ok: true,
      result: {
        targetKind: 'ecke_event',
        externalSlug: eventRow.slug,
        status: eventResult.ok ? 'published' : 'error',
        contentHash: eventHash,
        ok: eventResult.ok,
        error: eventResult.ok ? undefined : eventResult.error,
        publicUrl: eventResult.ok ? resolveEckePublicEventUrl(eventRow.slug) : undefined,
        message: eventResult.ok ? 'Published to ECKE events' : eventResult.error,
      },
    }
  }

  try {
    await requestEckeStandaloneEventPublish(ctx.ev.id, userId)
    return {
      ok: true,
      result: {
        targetKind: 'ecke_event',
        externalSlug: eventRow.slug,
        status: 'queued',
        contentHash: eventHash,
        ok: true,
        message: 'Queued for ECKE events publish',
      },
    }
  } catch (err) {
    return {
      ok: true,
      result: {
        targetKind: 'ecke_event',
        externalSlug: eventRow.slug,
        status: 'error',
        contentHash: eventHash,
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to queue ECKE event publish',
      },
    }
  }
}

function targetResponse(
  preview: EckePublishTargetPreview,
  row: (typeof schema.eckePublishTargets.$inferSelect) | undefined,
) {
  const contentHash = preview.contentHash
  const publishedContentHash = row?.publishedContentHash ?? null
  const status =
    row?.status === 'error' ? 'error'
    : !row?.lastPreviewAt ? 'never'
    : derivePublishStatus(contentHash, publishedContentHash, row?.lastPublishedAt)

  return {
    targetKind: preview.targetKind,
    externalSlug: preview.externalSlug,
    status,
    contentHash,
    publishedContentHash,
    lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
    lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    slotCount: preview.slotCount ?? null,
    staffShiftCount: preview.staffShiftCount ?? null,
    payload: preview.payload,
  }
}

export async function registerEckePublishRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/api/v1/organizer/ecke-publish/')) {
      reply.header('Deprecation', 'true')
      reply.header(
        'Link',
        '</api/v1/organizations/{slug}/ecke-publish>; rel="successor-version"',
      )
    }
  })

  app.get('/api/v1/organizer/ecke-publish/organizations/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const org = await requireOrgModerator(slug, user.userId, reply)
    if (!org) return

    const listingPayload = buildOrgListingPayload(org)
    const listingHash = hashEckePayload(listingPayload)
    const preview: EckePublishTargetPreview = {
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      payload: listingPayload,
      contentHash: listingHash,
    }

    const rows = await loadTargetRows('organization', org.id)
    const listingRow = rows.find((r) => r.targetKind === 'ecke_listing')
    const dungeonPreview = orgDungeonTargetPreview(org)
    const dungeonRow = rows.find((r) => r.targetKind === 'ecke_dungeon')

    const targets = [targetResponse(preview, listingRow)]
    if (dungeonPreview) targets.push(targetResponse(dungeonPreview, dungeonRow))

    return reply.send({
      scope: { type: 'organization', slug: org.slug, name: org.displayName },
      bridgeConnected: isBridgeConnected(),
      targets,
    })
  })

  app.post('/api/v1/organizer/ecke-publish/organizations/:slug/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const org = await requireOrgModerator(slug, user.userId, reply)
    if (!org) return

    const listingPayload = buildOrgListingPayload(org)
    const listingHash = hashEckePayload(listingPayload)
    const status = await upsertTargetRow({
      scopeType: 'organization',
      organizationId: org.id,
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      contentHash: listingHash,
      userId: user.userId,
    })

    const targets: Array<{
      targetKind: 'ecke_listing' | 'ecke_dungeon'
      externalSlug: string
      status: string
      contentHash: string
      payload: unknown
    }> = [
      {
        targetKind: 'ecke_listing',
        externalSlug: listingPayload.slug,
        status,
        contentHash: listingHash,
        payload: listingPayload,
      },
    ]

    const dungeonPreview = orgDungeonTargetPreview(org)
    if (dungeonPreview) {
      const dungeonStatus = await upsertTargetRow({
        scopeType: 'organization',
        organizationId: org.id,
        targetKind: 'ecke_dungeon',
        externalSlug: dungeonPreview.externalSlug,
        contentHash: dungeonPreview.contentHash,
        userId: user.userId,
      })
      targets.push({
        targetKind: 'ecke_dungeon',
        externalSlug: dungeonPreview.externalSlug,
        status: dungeonStatus,
        contentHash: dungeonPreview.contentHash,
        payload: dungeonPreview.payload,
      })
    }

    return reply.send({
      scope: { type: 'organization', slug: org.slug, name: org.displayName },
      bridgeConnected: isBridgeConnected(),
      targets,
    })
  })

  app.get('/api/v1/organizer/ecke-publish/conventions/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const resolved = await requireConventionModerator(slug, user.userId, reply)
    if (!resolved) return
    const { conv, org, anchor, slots, locations, volunteerShifts } = resolved

    const listingPayload = buildConventionListingPayload({
      conventionSlug: conv.slug,
      conventionName: conv.name,
      conventionDescription: conv.description,
      startsAt: conv.startsAt,
      endsAt: conv.endsAt,
      settings: conv.settings,
      orgSlug: org?.slug ?? null,
      orgDisplayName: org?.displayName ?? null,
      anchor,
    })
    const listingHash = hashEckePayload(listingPayload)
    const previews: EckePublishTargetPreview[] = [
      {
        targetKind: 'ecke_listing',
        externalSlug: listingPayload.slug,
        payload: listingPayload,
        contentHash: listingHash,
      },
    ]

    const eventRow = buildEckeEventRowFromListing(listingPayload, conv.id, 'convention')
    const eventHash = hashEckePayload(eventRow)
    previews.push({
      targetKind: 'ecke_event',
      externalSlug: eventRow.slug,
      payload: listingPayload,
      contentHash: eventHash,
    })

    if (isDancecardPublishEnabled(conv.settings)) {
      const dancecardPayload = buildDancecardEventPayload({
        conventionSlug: conv.slug,
        conventionName: conv.name,
        conventionDescription: conv.description,
        timezone: conv.timezone,
        startsAt: conv.startsAt,
        endsAt: conv.endsAt,
        settings: conv.settings,
        orgDisplayName: org?.displayName ?? null,
        orgSlug: org?.slug ?? null,
        logoUrl: org?.logoUrl ?? null,
        locations,
        slots,
        volunteerShifts,
      })
      const dancecardHash = hashEckePayload(dancecardPayload)
      previews.push({
        targetKind: 'dancecard_event',
        externalSlug: dancecardPayload.slug,
        payload: dancecardPayload,
        contentHash: dancecardHash,
        slotCount: slots.length,
        staffShiftCount: volunteerShifts.length,
      })
    }

    const rows = await loadTargetRows('convention', conv.id)
    return reply.send({
      scope: { type: 'convention', slug: conv.slug, name: conv.name },
      bridgeConnected: isBridgeConnected(),
      targets: previews.map((p) => targetResponse(p, rows.find((r) => r.targetKind === p.targetKind))),
    })
  })

  app.post('/api/v1/organizer/ecke-publish/conventions/:slug/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const resolved = await requireConventionModerator(slug, user.userId, reply)
    if (!resolved) return
    const { conv, org, anchor, slots, locations, volunteerShifts } = resolved

    const targets: Array<{
      targetKind: 'ecke_listing' | 'dancecard_event' | 'ecke_event' | 'ecke_dungeon'
      externalSlug: string
      status: string
      contentHash: string
      slotCount?: number
      staffShiftCount?: number
      payload: unknown
    }> = []

    const listingPayload = buildConventionListingPayload({
      conventionSlug: conv.slug,
      conventionName: conv.name,
      conventionDescription: conv.description,
      startsAt: conv.startsAt,
      endsAt: conv.endsAt,
      settings: conv.settings,
      orgSlug: org?.slug ?? null,
      orgDisplayName: org?.displayName ?? null,
      anchor,
    })
    const listingHash = hashEckePayload(listingPayload)
    const listingStatus = await upsertTargetRow({
      scopeType: 'convention',
      conventionId: conv.id,
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      contentHash: listingHash,
      userId: user.userId,
    })
    targets.push({
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      status: listingStatus,
      contentHash: listingHash,
      payload: listingPayload,
    })

    const eventRow = buildEckeEventRowFromListing(listingPayload, conv.id, 'convention')
    const eventHash = hashEckePayload(eventRow)
    const eventStatus = await upsertTargetRow({
      scopeType: 'convention',
      conventionId: conv.id,
      targetKind: 'ecke_event',
      externalSlug: eventRow.slug,
      contentHash: eventHash,
      userId: user.userId,
    })
    targets.push({
      targetKind: 'ecke_event',
      externalSlug: eventRow.slug,
      status: eventStatus,
      contentHash: eventHash,
      payload: listingPayload,
    })

    if (isDancecardPublishEnabled(conv.settings)) {
      const dancecardPayload = buildDancecardEventPayload({
        conventionSlug: conv.slug,
        conventionName: conv.name,
        conventionDescription: conv.description,
        timezone: conv.timezone,
        startsAt: conv.startsAt,
        endsAt: conv.endsAt,
        settings: conv.settings,
        orgDisplayName: org?.displayName ?? null,
        orgSlug: org?.slug ?? null,
        logoUrl: org?.logoUrl ?? null,
        locations,
        slots,
        volunteerShifts,
      })
      const dancecardHash = hashEckePayload(dancecardPayload)
      const dancecardStatus = await upsertTargetRow({
        scopeType: 'convention',
        conventionId: conv.id,
        targetKind: 'dancecard_event',
        externalSlug: dancecardPayload.slug,
        contentHash: dancecardHash,
        userId: user.userId,
      })
      targets.push({
        targetKind: 'dancecard_event',
        externalSlug: dancecardPayload.slug,
        status: dancecardStatus,
        contentHash: dancecardHash,
        slotCount: slots.length,
        staffShiftCount: volunteerShifts.length,
        payload: dancecardPayload,
      })
    }

    return reply.send({
      scope: { type: 'convention', slug: conv.slug, name: conv.name },
      bridgeConnected: isBridgeConnected(),
      targets,
    })
  })

  app.post('/api/v1/organizer/ecke-publish/organizations/:slug/publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const org = await requireOrgModerator(slug, user.userId, reply)
    if (!org) return

    const outcome = await publishOrgListing(org, user.userId)
    if (!outcome.ok) return reply.status(503).send({ error: outcome.error })

    const targets: Array<{
      targetKind: string
      externalSlug: string
      status: string
      contentHash: string
      ok?: boolean
      error?: string
    }> = [
      {
        targetKind: 'ecke_listing',
        externalSlug: outcome.listingPayload.slug,
        status: outcome.status,
        contentHash: outcome.listingHash,
        ok: outcome.result.ok,
        error: outcome.result.ok ? undefined : outcome.result.error,
      },
    ]

    if (outcome.dungeonResult) {
      const dungeonRow = buildEckeDungeonRowFromOrg({
        id: org.id,
        slug: org.slug,
        displayName: org.displayName,
        bio: org.bio,
        websiteUrl: org.externalSiteUrl,
        visibility: org.visibility,
      })
      targets.push({
        targetKind: 'ecke_dungeon',
        externalSlug: dungeonRow.slug,
        status: outcome.dungeonResult.ok ? 'published' : 'error',
        contentHash: hashEckePayload(dungeonRow),
        ok: outcome.dungeonResult.ok,
        error: outcome.dungeonResult.ok ? undefined : outcome.dungeonResult.error,
      })
    }

    return reply.send({
      scope: { type: 'organization', slug: org.slug, name: org.displayName },
      bridgeConnected: true,
      targets,
    })
  })

  app.post('/api/v1/organizer/ecke-publish/conventions/:slug/publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const resolved = await requireConventionModerator(slug, user.userId, reply)
    if (!resolved) return

    const outcome = await publishConventionTargets(resolved, user.userId)
    if (!outcome.ok) return reply.status(503).send({ error: outcome.error })

    return reply.send({
      scope: { type: 'convention', slug: resolved.conv.slug, name: resolved.conv.name },
      bridgeConnected: true,
      targets: outcome.results,
    })
  })

  app.post('/api/v1/organizer/ecke-publish/conventions/:slug/unpublish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const resolved = await requireConventionModerator(slug, user.userId, reply)
    if (!resolved) return

    if (!isBridgeConnected()) {
      return reply.status(503).send({ error: 'ECKE publish bridge is not configured' })
    }

    const result = await executeEckeUnpublishConventionEvent(resolved.conv.id, user.userId)
    const rows = await loadTargetRows('convention', resolved.conv.id)
    const target = rows.find((r) => r.targetKind === 'ecke_event')

    return reply.send({
      scope: { type: 'convention', slug: resolved.conv.slug, name: resolved.conv.name },
      bridgeConnected: true,
      targets: [
        {
          targetKind: 'ecke_event',
          externalSlug: target?.externalSlug ?? '',
          status: result.ok ? 'stale' : 'error',
          ok: result.ok,
          error: result.ok ? undefined : result.error,
          message: result.ok ? 'Unpublished from ECKE events' : result.error,
        },
      ],
    })
  })

  app.get('/api/v1/organizer/ecke-publish/events/:eventIdOrSlug', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventIdOrSlug } = req.params as { eventIdOrSlug: string }

    const ctx = await requireEventPublisher(eventIdOrSlug, user.userId, reply)
    if (!ctx) return

    const { listingPayload, eventRow, eventHash } = buildStandaloneEventPreview(ctx)
    const preview: EckePublishTargetPreview = {
      targetKind: 'ecke_event',
      externalSlug: eventRow.slug,
      payload: listingPayload,
      contentHash: eventHash,
    }

    const rows = await loadTargetRows('event', ctx.ev.id)
    const eventRowTarget = rows.find((r) => r.targetKind === 'ecke_event')
    const eligibility = isStandaloneEventEckeEligible({
      visibility: ctx.ev.visibility,
      isConventionAnchor: ctx.isConventionAnchor,
    })

    return reply.send({
      scope: { type: 'event', id: ctx.ev.id, title: ctx.ev.title },
      bridgeConnected: isBridgeConnected(),
      eligible: eligibility.eligible,
      ineligibleReason: eligibility.reason ?? null,
      targets: [targetResponse(preview, eventRowTarget)],
    })
  })

  app.post('/api/v1/organizer/ecke-publish/events/:eventIdOrSlug/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventIdOrSlug } = req.params as { eventIdOrSlug: string }

    const ctx = await requireEventPublisher(eventIdOrSlug, user.userId, reply)
    if (!ctx) return

    const eligibility = isStandaloneEventEckeEligible({
      visibility: ctx.ev.visibility,
      isConventionAnchor: ctx.isConventionAnchor,
    })
    if (!eligibility.eligible) {
      return reply.status(403).send({ error: eligibility.reason ?? 'Event not eligible for ECKE publish' })
    }

    const { listingPayload, eventRow, eventHash } = buildStandaloneEventPreview(ctx)
    const status = await upsertTargetRow({
      scopeType: 'event',
      eventId: ctx.ev.id,
      targetKind: 'ecke_event',
      externalSlug: eventRow.slug,
      contentHash: eventHash,
      userId: user.userId,
    })

    return reply.send({
      scope: { type: 'event', id: ctx.ev.id, title: ctx.ev.title },
      bridgeConnected: isBridgeConnected(),
      targets: [
        {
          targetKind: 'ecke_event',
          externalSlug: eventRow.slug,
          status,
          contentHash: eventHash,
          payload: listingPayload,
        },
      ],
    })
  })

  app.post('/api/v1/organizer/ecke-publish/events/:eventIdOrSlug/publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventIdOrSlug } = req.params as { eventIdOrSlug: string }

    const ctx = await requireEventPublisher(eventIdOrSlug, user.userId, reply)
    if (!ctx) return

    const outcome = await publishStandaloneEventTarget(ctx, user.userId)
    if (!outcome.ok) return reply.status(503).send({ error: outcome.error })

    return reply.send({
      scope: { type: 'event', id: ctx.ev.id, title: ctx.ev.title },
      bridgeConnected: true,
      targets: [outcome.result],
    })
  })

  app.post('/api/v1/organizer/ecke-publish/events/:eventIdOrSlug/unpublish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventIdOrSlug } = req.params as { eventIdOrSlug: string }

    const ctx = await requireEventPublisher(eventIdOrSlug, user.userId, reply)
    if (!ctx) return

    if (!isBridgeConnected()) {
      return reply.status(503).send({ error: 'ECKE publish bridge is not configured' })
    }

    const result = await executeEckeUnpublishStandaloneEvent(ctx.ev.id, user.userId)
    const rows = await loadTargetRows('event', ctx.ev.id)
    const target = rows.find((r) => r.targetKind === 'ecke_event')

    return reply.send({
      scope: { type: 'event', id: ctx.ev.id, title: ctx.ev.title },
      bridgeConnected: true,
      targets: [
        {
          targetKind: 'ecke_event',
          externalSlug: target?.externalSlug ?? '',
          status: result.ok ? 'stale' : 'error',
          ok: result.ok,
          error: result.ok ? undefined : result.error,
          message: result.ok ? 'Unpublished from ECKE events' : result.error,
        },
      ],
    })
  })

  app.get('/api/v1/organizer/ecke-publish/groups/:groupId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }

    const resolved = await requireGroupModerator(groupId, user.userId, reply)
    if (!resolved) return
    const { group, org } = resolved

    const listingPayload = buildGroupListingPayload({
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      orgSlug: org?.slug ?? null,
      orgDisplayName: org?.displayName ?? null,
    })
    const listingHash = hashEckePayload(listingPayload)
    const preview: EckePublishTargetPreview = {
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      payload: listingPayload,
      contentHash: listingHash,
    }

    const rows = await loadTargetRows('group', group.id)
    const listingRow = rows.find((r) => r.targetKind === 'ecke_listing')

    return reply.send({
      scope: { type: 'group', slug: group.slug, name: group.name },
      bridgeConnected: isBridgeConnected(),
      targets: [targetResponse(preview, listingRow)],
    })
  })

  app.post('/api/v1/organizer/ecke-publish/groups/:groupId/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }

    const resolved = await requireGroupModerator(groupId, user.userId, reply)
    if (!resolved) return
    const { group, org } = resolved

    const listingPayload = buildGroupListingPayload({
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      orgSlug: org?.slug ?? null,
      orgDisplayName: org?.displayName ?? null,
    })
    const listingHash = hashEckePayload(listingPayload)
    const status = await upsertTargetRow({
      scopeType: 'group',
      groupId: group.id,
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      contentHash: listingHash,
      userId: user.userId,
    })

    return reply.send({
      scope: { type: 'group', slug: group.slug, name: group.name },
      bridgeConnected: isBridgeConnected(),
      targets: [
        {
          targetKind: 'ecke_listing',
          externalSlug: listingPayload.slug,
          status,
          contentHash: listingHash,
          payload: listingPayload,
        },
      ],
    })
  })

  app.post('/api/v1/organizer/ecke-publish/groups/:groupId/publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }

    const resolved = await requireGroupModerator(groupId, user.userId, reply)
    if (!resolved) return
    const { group, org } = resolved

    const cfg = loadEckePublishClientConfig()
    if (!cfg) {
      return reply.status(503).send({ error: 'ECKE publish bridge is not configured' })
    }

    const listingPayload = buildGroupListingPayload({
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      orgSlug: org?.slug ?? null,
      orgDisplayName: org?.displayName ?? null,
    })
    const listingHash = hashEckePayload(listingPayload)
    await upsertTargetRow({
      scopeType: 'group',
      groupId: group.id,
      targetKind: 'ecke_listing',
      externalSlug: listingPayload.slug,
      contentHash: listingHash,
      userId: user.userId,
    })
    const listingResult = await publishListingToEcke(cfg, listingPayload)
    const listingStatus = await markPublishOutcome({
      scopeType: 'group',
      groupId: group.id,
      targetKind: 'ecke_listing',
      contentHash: listingHash,
      userId: user.userId,
      result: listingResult,
    })

    return reply.send({
      scope: { type: 'group', slug: group.slug, name: group.name },
      bridgeConnected: true,
      targets: [
        {
          targetKind: 'ecke_listing',
          externalSlug: listingPayload.slug,
          status: listingStatus,
          contentHash: listingHash,
          ok: listingResult.ok,
          error: listingResult.ok ? undefined : listingResult.error,
        },
      ],
    })
  })
}
