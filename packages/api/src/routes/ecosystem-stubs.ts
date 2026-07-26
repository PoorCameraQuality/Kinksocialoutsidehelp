/**
 * Production DB-backed `/api/v1` social + calendar surface (legacy module name).
 *
 * Contains real implementations (not stubs) for: profile discovery, events + RSVP,
 * groups (list/detail/join), connections, notifications, DMs/conversations, reports,
 * moderation job enqueue, and related helpers. New domain routes belong in named
 * modules registered from `server.ts` - extend here only when the feature fits the
 * existing ecosystem pattern.
 */
import {
  EVENT_CATEGORIES,
  NOTIFICATION_TYPES,
  normalizeEventCategory,
  normalizeGroupCategory,
  normalizeGroupTags,
  normalizeVendorCategory,
  preprocessVendorWriteBody,
  VENDOR_CATEGORY_SELECT_MAX,
  VENDOR_TAG_MAX,
  zVendorCategoriesOptional,
  zVendorCategoryOptional,
  zVendorTagsOptional,
  zVendorTagsRequired,
  zVendorWebsiteNullable,
  zVendorWebsiteOptional,
  normalizePrivacySettings,
  mergePrivacySettings,
  groupMemberListVisibilitySchema,
  shouldEmitGroupJoinFeedActivity,
  isGroupStaffRole,
  type GroupMemberListVisibility,
  groupCategorySchema,
  groupRulesSchema,
  parseGroupRules,
  type EventCategory,
} from '@c2k/shared'
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { createNotification } from '../lib/create-notification.js'
import { isAllowedTicketEmbedUrl } from '../lib/embed-allowlist.js'
import { getModerationQueue } from '../lib/moderation-queue.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import { parseOrgFeatureFlags } from '../lib/org-features.js'
import { loadAcceptedFriendUserIds } from '../lib/accepted-friends.js'
import {
  loadBlockedPairUserIds,
  loadBlockedUserIds,
  loadUserIdsWhoBlockedUser,
} from '../lib/blocks.js'
import { filterBlockedUserIds } from '../lib/people-discovery.js'
import { assertCanInitiateDm, assertCanSendDmMessage } from '../lib/dm-privacy.js'
import { emitActivity } from '../lib/feed-activities.js'
import { emitVendorShopLiveIfEligible } from '../lib/vendor-shop-feed.js'
import { maybeEnqueueEckeVendorPublish } from './ecke-publish-entity-routes.js'
import { countCommittedGoing, promoteNextWaitlist, refreshEventRsvpCount } from '../lib/event-rsvp.js'
import { buildEventIcsCalendar } from '../lib/ics-event.js'
import { getProgramSummariesForEventIds, getProgramSummaryForEvent } from '../lib/event-program.js'
import {
  applyEventLocationRedaction,
  physicalLocationDetailVisibleEventIds,
} from '../lib/physical-location-visibility.js'
import {
  isVirtualHttpsJoinLocation,
  virtualJoinLinkVisibleEventIds,
  viewerCanPatchEvent,
} from '../lib/virtual-event-join-visibility.js'
import { loadDiscoveryProfileStats, mergeDiscoveryProfileStats } from '../lib/discovery-profile-stats.js'
import { passesGenderDiscoveryFilter, passesLocationDiscoveryFilter, redactListProfileIdentityFields, toDiscoveryProfileCard } from '../lib/profile-field-redaction.js'
import { alphaUploadDisabledResponse, isAlphaUploadDisabled } from '../lib/alpha-upload-policy.js'
import { touchGroupActivity } from '../lib/group-activity.js'
import {
  MediaUploadValidationError,
  promoteQuarantineToScopeBrandingUrl,
} from '../lib/media-pipeline.js'
import { zHttpOrRootMediaUrlNullable } from '../lib/media-url.js'
import {
  canEditGroupSettings,
  canManageGroupEvents,
  canViewGroup,
  canViewerSeeGroupEvent,
  filterGroupMembersForViewer,
  getGroupMembership,
  resolveGroupManagerRole,
  viewerIsGroupStaff,
} from '../lib/group-access.js'
import { canViewerReadIsoVisibility, conversationIncludedInFolder, isIsoInboxThreadForViewer } from '../lib/iso-access.js'
import { haversineDistanceMi, parseProfileGeoPoint } from '../lib/geo-distance.js'
import { loadPlaceLabels, mapGroupWithPlace } from '../lib/group-place.js'
import { buildGroupListItems } from '../lib/group-list-enrichment.js'
import { resolveUserParticipationDefaults } from '../lib/convention-participation.js'
import { sendEventRsvpConfirmationEmail } from '../lib/transactional-email.js'
import { isEventFeatured } from '../lib/event-featured.js'
import { viewerCanSeeActivityHistory } from '../lib/activity-history-visibility.js'
import {
  globalPublicEventDiscoveryFilter,
  isGlobalPublicEventDiscoveryQuery,
} from '../lib/event-discovery.js'
import { canViewerSeeEventDetail } from '../lib/event-access.js'
import { deliverBrandingLogoUrl, deliverCardImageUrl } from '../lib/image-delivery.js'
import { loadConnectionRsvpPreviewByEventIds } from '../lib/connection-rsvp-preview.js'
import { filterVendorVisibility, vendorVisibleForDetail } from '../lib/vendor-visibility.js'
import { toManagedVendorDetail, toPublicVendorDetail, toPublicVendorListItem, vendorProfileWriteFields } from '../lib/vendor-public-dto.js'
import { withAlphaLabel, withAlphaLabels } from '../lib/alpha-seed-labels.js'
import { ensureUserSettingsRow } from '../lib/user-settings-row.js'
import {
  buildVendorFeedbackSummary,
  loadVendorVerifiedFeedbackCounts,
} from '../lib/vendor-verified-feedback.js'
import {
  getVendorShopAccess,
  listManagedVendorShops,
  loadVendorCoOwnerUserIds,
  loadVendorCoOwners,
  loadVendorShopPeople,
  replaceVendorCoOwners,
  requireVendorOwner,
  requireVendorShopManager,
  resolveManagedVendorForMeRoutes,
} from '../lib/vendor-shop-people.js'
import { vendorShopPoliciesSchema } from '../lib/vendor-shop-policies.js'
import { loadVendorEventCredits } from '../lib/vendor-event-credits.js'

async function findExistingDmPair(userIdA: string, userIdB: string): Promise<string | null> {
  const aRows = await db
    .select()
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, userIdA))
  for (const row of aRows) {
    const parts = await db
      .select()
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, row.conversationId))
    if (parts.length === 2) {
      const ids = new Set(parts.map((p) => p.userId))
      if (ids.has(userIdB)) return row.conversationId
    }
  }
  return null
}

async function findGroupByIdOrSlug(groupKey: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupKey)
  if (isUuid) {
    const [byId] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupKey)).limit(1)
    if (byId) return byId
  }
  const [bySlug] = await db.select().from(schema.groups).where(eq(schema.groups.slug, groupKey)).limit(1)
  return bySlug ?? null
}

async function usersAreConnected(userIdA: string, userIdB: string): Promise<boolean> {
  const friends = await loadAcceptedFriendUserIds(userIdA)
  return friends.has(userIdB)
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
  return requireAuthenticatedDbUser(req, reply)
}

function sanitizeIlikeFragment(s: string): string {
  return s.replace(/[%_\\]/g, '')
}

/** Legacy `events.category` strings still in seed rows that map to canonical SG-080 values. */
const LEGACY_EVENT_CATEGORY_DB_VALUES: Partial<Record<EventCategory, string[]>> = {
  [EVENT_CATEGORIES.social]: ['Munch'],
  [EVENT_CATEGORIES.educational]: ['Workshop'],
}

function parseEventsListCategories(raw: unknown): EventCategory[] {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : []
  const out: EventCategory[] = []
  for (const item of list) {
    if (typeof item !== 'string') continue
    const normalized = normalizeEventCategory(item)
    if (normalized && !out.includes(normalized)) out.push(normalized)
  }
  return out
}

function dbCategoryValuesForFilter(categories: EventCategory[]): string[] {
  const values = new Set<string>(categories)
  for (const cat of categories) {
    for (const leg of LEGACY_EVENT_CATEGORY_DB_VALUES[cat] ?? []) values.add(leg)
  }
  return [...values]
}

function slugifyVendorSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** DB-backed handlers for E2–E9 (extend as product features harden). */
export async function registerEcosystemStubRoutes(app: FastifyInstance) {
  app.get('/api/v1/status', async () => ({
    phases: {
      e1_db_auth: 'implemented',
      e2_social: 'implemented',
      e3_groups: 'implemented',
      e3b_organizations: 'implemented',
      e4_events: 'implemented',
      e5_vendors: 'implemented',
      e6_matchmaking: 'implemented',
      e7_messaging: 'implemented',
      e8_conventions: 'implemented',
      e9_safety: 'implemented',
    },
  }))

  /* --- Discovery: public profile cards --- */
  app.get('/api/v1/profiles', { ...rateLimitRoute('search') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as { q?: string; limit?: string; gender?: string }
    const qRaw = typeof q?.q === 'string' ? q.q : ''
    const genderRaw = typeof q?.gender === 'string' ? q.gender : ''
    const genderTrim = sanitizeIlikeFragment(genderRaw.trim())
    const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? '50'), 10) || 50))
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const friendIds = viewerId ? await loadAcceptedFriendUserIds(viewerId) : new Set<string>()
    const blockedActorIds =
      viewerId ?
        new Set([
          ...(await loadBlockedUserIds(viewerId)),
          ...(await loadUserIdsWhoBlockedUser(viewerId)),
        ])
      : new Set<string>()
    const visibilityFilter = viewerId
      ? or(eq(schema.profiles.visibility, 'PUBLIC'), eq(schema.profiles.visibility, 'MEMBERS'))
      : eq(schema.profiles.visibility, 'PUBLIC')
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    // Hide long-inactive profiles from everyone except the profile owner.
    const activityVisibilityFilter = viewerId
      ? or(eq(schema.users.id, viewerId), gt(schema.profiles.updatedAt, oneYearAgo))
      : gt(schema.profiles.updatedAt, oneYearAgo)

    const trimmed = sanitizeIlikeFragment(qRaw.trim())
    const searchClause =
      trimmed.length > 0
        ? or(ilike(schema.users.username, `%${trimmed}%`), ilike(schema.profiles.displayName, `%${trimmed}%`))
        : undefined

    const whereClause = searchClause ? and(visibilityFilter, activityVisibilityFilter, searchClause) : and(visibilityFilter, activityVisibilityFilter)

    const fetchLimit = genderTrim ? Math.min(400, limit * 8) : limit

    const rows = await db
      .select({
        userId: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        bio: schema.profiles.bio,
        roles: schema.profiles.roles,
        verified: schema.profiles.verified,
        location: schema.profiles.location,
        age: schema.profiles.age,
        avatarUrl: schema.profiles.avatarUrl,
        lastActiveAt: schema.profiles.updatedAt,
        gender: schema.profiles.gender,
        sexuality: schema.profiles.sexuality,
        pronouns: schema.profiles.pronouns,
        discoverableInPeopleSearch: schema.profiles.discoverableInPeopleSearch,
        fieldVisibility: schema.profiles.fieldVisibility,
      })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(whereClause)
      .orderBy(asc(schema.users.username))
      .limit(fetchLimit)

    const filtered = filterBlockedUserIds(
      blockedActorIds,
      rows
        .filter((r) => r.discoverableInPeopleSearch || (viewerId !== null && r.userId === viewerId))
        .filter((r) => passesGenderDiscoveryFilter(r, genderTrim, viewerId, friendIds)),
    )

    const cards = filtered
      .map((r) =>
        toDiscoveryProfileCard(
          {
            userId: r.userId,
            username: r.username,
            displayName: r.displayName,
            bio: r.bio,
            roles: r.roles,
            verified: r.verified,
            location: r.location,
            age: r.age,
            avatarUrl: r.avatarUrl,
            lastActiveAt: r.lastActiveAt,
            gender: r.gender,
            sexuality: r.sexuality,
            pronouns: r.pronouns,
            discoverableInPeopleSearch: r.discoverableInPeopleSearch,
            fieldVisibility: r.fieldVisibility,
          },
          viewerId,
          friendIds
        )
      )
      .slice(0, limit)

    const statsMap = await loadDiscoveryProfileStats(cards.map((c) => c.userId), viewerId)
    const cardUserIds = cards.map((c) => c.userId)
    const vendorShopByUser = new Map<string, { slug: string; verified: boolean }>()
    if (cardUserIds.length > 0) {
      const vendorRows = await db
        .select({
          userId: schema.vendorProfiles.userId,
          slug: schema.vendorProfiles.slug,
          verified: schema.vendorProfiles.verified,
          visibility: schema.vendorProfiles.visibility,
        })
        .from(schema.vendorProfiles)
        .where(
          and(
            inArray(schema.vendorProfiles.userId, cardUserIds),
            eq(schema.vendorProfiles.visibility, 'PUBLIC'),
          ),
        )
      for (const v of vendorRows) {
        vendorShopByUser.set(v.userId, { slug: v.slug, verified: v.verified })
      }
    }

    const items = cards.map((card) => {
      const stats = mergeDiscoveryProfileStats(card, statsMap)
      const shop = vendorShopByUser.get(card.userId)
      const badges = shop ? (['vendor_verified'] as string[]) : []
      return {
        ...card,
        photoCount: stats.photoCount,
        videoCount: stats.videoCount,
        writingCount: stats.writingCount,
        groupsLedCount: stats.groupsLedCount,
        vendorShopSlug: shop?.slug ?? null,
        badges,
      }
    })

    return reply.send({ items })
  })

  /* --- E2: Social --- */
  app.get('/api/v1/connections', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.connections)
      .where(
        or(eq(schema.connections.requesterId, user.userId), eq(schema.connections.recipientId, user.userId))
      )
    const userIds = [...new Set(rows.flatMap((r) => [r.requesterId, r.recipientId]))]
    const profiles =
      userIds.length > 0 ?
        await db
          .select({
            userId: schema.users.id,
            username: schema.users.username,
            displayName: schema.profiles.displayName,
            avatarUrl: schema.profiles.avatarUrl,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
          .where(inArray(schema.users.id, userIds))
      : []
    const profileById = new Map(profiles.map((p) => [p.userId, p]))
    return reply.send({
      items: rows.map((c) => {
        const otherId = c.requesterId === user.userId ? c.recipientId : c.requesterId
        const other = profileById.get(otherId)
        return {
          ...c,
          requesterUsername: profileById.get(c.requesterId)?.username ?? null,
          recipientUsername: profileById.get(c.recipientId)?.username ?? null,
          otherPartyUsername: other?.username ?? null,
          otherPartyDisplayName: other?.displayName ?? null,
          otherPartyAvatarUrl: other?.avatarUrl ?? null,
          isOutgoing: c.requesterId === user.userId,
        }
      }),
    })
  })

  const connectionBody = z.object({ recipientUsername: z.string().min(1) })
  app.post('/api/v1/connections/request', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = connectionBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [recipient] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, parsed.data.recipientUsername))
      .limit(1)
    if (!recipient) return reply.status(404).send({ error: 'User not found' })
    if (recipient.id === user.userId) return reply.status(400).send({ error: 'Cannot connect to yourself' })
    const { isBlockedPair } = await import('../lib/blocks.js')
    if (await isBlockedPair(user.userId, recipient.id)) {
      return reply.status(403).send({ error: 'Blocked' })
    }
    const existing = await db
      .select()
      .from(schema.connections)
      .where(
        or(
          and(eq(schema.connections.requesterId, user.userId), eq(schema.connections.recipientId, recipient.id)),
          and(eq(schema.connections.requesterId, recipient.id), eq(schema.connections.recipientId, user.userId))
        )
      )
      .limit(1)
    if (existing[0]) {
      const e = existing[0]
      if (e.status === 'ACCEPTED') return reply.status(400).send({ error: 'Already connected' })
      if (e.status === 'PENDING') return reply.status(400).send({ error: 'Request already pending' })
      if (e.status === 'IGNORED' && e.recipientId === user.userId) {
        return reply.status(400).send({ error: 'Request ignored. Unignore first' })
      }
    }
    const [row] = await db
      .insert(schema.connections)
      .values({ requesterId: user.userId, recipientId: recipient.id, status: 'PENDING' })
      .returning()
    const { notifyConnectionRequest } = await import('../lib/connection-notify.js')
    try {
      const [requester] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, user.userId))
        .limit(1)
      await notifyConnectionRequest(recipient.id, requester?.username ?? '', row.id)
    } catch (err) {
      req.log.warn({ err }, 'failed to insert connection_request notification')
    }
    return reply.send({ connection: row })
  })

  app.post('/api/v1/connections/:connectionId/accept', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { connectionId } = req.params as { connectionId: string }
    const [c] = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1)
    if (!c) return reply.status(404).send({ error: 'Not found' })
    if (c.recipientId !== user.userId) return reply.status(403).send({ error: 'Only the recipient can accept' })
    if (c.status !== 'PENDING') return reply.status(400).send({ error: 'Not pending' })
    const [updated] = await db
      .update(schema.connections)
      .set({ status: 'ACCEPTED' })
      .where(eq(schema.connections.id, connectionId))
      .returning()
    const [accepter] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, user.userId))
      .limit(1)
    const [requester] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, c.requesterId))
      .limit(1)
    try {
      await createNotification(c.requesterId, NOTIFICATION_TYPES.connectionAccepted, {
        accepterUsername: accepter?.username ?? '',
        connectionId,
      })
    } catch (err) {
      req.log.warn({ err }, 'failed to insert connection_accepted notification')
    }
    emitActivity({
      actorId: user.userId,
      verb: 'connection_accepted',
      objectType: 'connection',
      objectId: connectionId,
      metadata: {
        partnerUserId: c.requesterId,
        partnerUsername: requester?.username ?? '',
      },
    })
    return reply.send({ connection: updated })
  })

  app.post('/api/v1/connections/:connectionId/decline', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { connectionId } = req.params as { connectionId: string }
    const [c] = await db.select().from(schema.connections).where(eq(schema.connections.id, connectionId)).limit(1)
    if (!c) return reply.status(404).send({ error: 'Not found' })
    if (c.recipientId !== user.userId) return reply.status(403).send({ error: 'Only the recipient can decline' })
    if (c.status !== 'PENDING') return reply.status(400).send({ error: 'Not pending' })
    const [updated] = await db
      .update(schema.connections)
      .set({ status: 'DECLINED' })
      .where(eq(schema.connections.id, connectionId))
      .returning()
    return reply.send({ connection: updated })
  })

  app.post('/api/v1/reports', { ...rateLimitRoute('reports') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const body = z
      .object({
        /** Includes org_forum_thread, org_forum_post, org_channel_message for org hub moderation. */
        targetType: z.string().min(1).max(64),
        targetId: z.string().min(1).max(256),
        category: z.string().min(1).max(64),
        body: z.string().max(8000).optional(),
        policyReason: z.string().min(1).max(64).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid body' })

    const { createReport, ReportTargetValidationError } = await import('../lib/moderation-ts-intake.js')
    const { mapLegacyReportCategoryToPolicyReason, isKnownPolicyReason } = await import('@c2k/shared')

    let policyReason = body.data.policyReason
    let requiresRetriage = false
    if (!policyReason) {
      const mapped = mapLegacyReportCategoryToPolicyReason(body.data.category)
      if (!mapped) return reply.status(400).send({ error: 'Invalid category' })
      policyReason = mapped.reason
      requiresRetriage = mapped.requiresRetriage
    }
    if (!isKnownPolicyReason(policyReason)) {
      return reply.status(400).send({ error: 'Invalid policy reason' })
    }

    try {
      const result = await createReport({
        reporterId: user.userId,
        targetType: body.data.targetType,
        targetId: body.data.targetId,
        policyReason,
        note: body.data.body ?? null,
      })

      if (body.data.targetType === 'platform_organization' || body.data.targetType === 'organization') {
        const { notifyModerationReportEscalated } = await import('../lib/moderation-notify.js')
        await notifyModerationReportEscalated(result.reportId, body.data.targetType)
      }

      return reply.send({
        id: result.reportId,
        caseId: result.caseId,
        status: result.status,
        queue: result.queue,
        duplicate: result.duplicate,
        requiresRetriage,
      })
    } catch (err) {
      if (err instanceof ReportTargetValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      throw err
    }
  })

  app.get('/api/v1/me/reports', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select({
        id: schema.reports.id,
        targetType: schema.reports.targetType,
        targetId: schema.reports.targetId,
        category: schema.reports.category,
        status: schema.reports.status,
        createdAt: schema.reports.createdAt,
      })
      .from(schema.reports)
      .where(eq(schema.reports.reporterId, user.userId))
      .orderBy(desc(schema.reports.createdAt))
      .limit(50)
    return reply.send({ reports: rows })
  })

  /* --- E3: Groups --- */
  const ORG_SUBGROUP_ROLE_RANK: Record<string, number> = {
    OWNER: 5,
    ADMIN: 4,
    MODERATOR: 3,
    STAFF: 2,
    MEMBER: 1,
  }

  app.get('/api/v1/groups', async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as { organizationId?: string; category?: string; tag?: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const orgFilter =
      q.organizationId && /^[0-9a-f-]{36}$/i.test(q.organizationId)
        ? eq(schema.groups.organizationId, q.organizationId)
        : undefined
    const pubFilter = and(isNull(schema.groups.disbandedAt), ne(schema.groups.visibility, 'owner_absent'))
    const categoryNorm = q.category ? normalizeGroupCategory(q.category) : null
    const categoryFilter = categoryNorm ? eq(schema.groups.category, categoryNorm) : undefined
    const filters = [pubFilter, orgFilter, categoryFilter].filter((f): f is NonNullable<typeof f> => f != null)
    let groups =
      filters.length <= 1 ?
        await db
          .select()
          .from(schema.groups)
          .where(filters[0] ?? pubFilter)
          .limit(100)
      : await db
          .select()
          .from(schema.groups)
          .where(and(...filters))
          .limit(100)

    const tagNorm = q.tag?.trim().toLowerCase().replace(/\s+/g, '-')
    if (tagNorm) {
      groups = groups.filter((g) => (g.tags ?? []).some((t) => t.toLowerCase() === tagNorm))
    }

    let memberGroupIds = new Set<string>()
    if (viewerId) {
      const memRows = await db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.userId, viewerId))
      memberGroupIds = new Set(memRows.map((r) => r.groupId))
    }
    groups = groups.filter((g) => g.visibility === 'public' || memberGroupIds.has(g.id))

    const items = await buildGroupListItems(groups)
    return reply.send({ items })
  })

  app.get('/api/v1/me/groups', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const memRows = await db
      .select({
        groupId: schema.groupMembers.groupId,
        role: schema.groupMembers.role,
      })
      .from(schema.groupMembers)
      .where(eq(schema.groupMembers.userId, user.userId))
    if (memRows.length === 0) return reply.send({ items: [] })
    const groupIds = memRows.map((r) => r.groupId)
    const roleByGroup = new Map(memRows.map((r) => [r.groupId, r.role]))
    const groups = await db
      .select()
      .from(schema.groups)
      .where(and(inArray(schema.groups.id, groupIds), isNull(schema.groups.disbandedAt)))
    const items = await buildGroupListItems(groups)
    return reply.send({
      items: items.map((item) => ({
        ...item,
        myRole: roleByGroup.get(item.id) ?? 'member',
      })),
    })
  })

  const nearbyQuery = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(500).optional(),
    limit: z.coerce.number().min(1).max(50).optional(),
  })

  app.get('/api/v1/groups/nearby', async (req, reply) => {
    if (!requireDb(reply)) return
    const parsed = nearbyQuery.safeParse(req.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query' })

    let lat = parsed.data.lat
    let lng = parsed.data.lng
    const radiusMi = parsed.data.radius ?? 50
    const limit = parsed.data.limit ?? 24

    if (lat === undefined || lng === undefined) {
      const viewer = resolveViewerFromRequest(req)
      const viewerId = getViewerUserId(viewer.payload)
      if (!viewerId) {
        return reply.status(400).send({ error: 'lat and lng required, or sign in with profile geo set' })
      }
      const [prof] = await db
        .select({
          geoJson: schema.profiles.geoJson,
          placeId: schema.profiles.placeId,
        })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, viewerId))
        .limit(1)
      const geo = parseProfileGeoPoint(prof?.geoJson)
      if (geo) {
        lat = geo.lat
        lng = geo.lng
      } else if (prof?.placeId) {
        const placeMap = await loadPlaceLabels([prof.placeId])
        const pl = placeMap.get(prof.placeId)
        if (pl?.lat != null && pl.lng != null) {
          lat = pl.lat
          lng = pl.lng
        }
      }
    }

    if (lat === undefined || lng === undefined) {
      return reply.status(400).send({ error: 'Could not resolve viewer location; pass lat and lng' })
    }

    const pubFilter = and(isNull(schema.groups.disbandedAt), ne(schema.groups.visibility, 'owner_absent'))
    const candidates = await db
      .select()
      .from(schema.groups)
      .where(and(pubFilter, isNotNull(schema.groups.placeId)))
    const withPlace = candidates.filter((g) => g.placeId)
    const placeMap = await loadPlaceLabels(withPlace.map((g) => g.placeId!))

    const scored: { group: (typeof candidates)[0]; distanceMi: number }[] = []

    for (const g of withPlace) {
      const pl = placeMap.get(g.placeId!)
      if (pl?.lat == null || pl.lng == null) continue
      const d = haversineDistanceMi(lat, lng, pl.lat, pl.lng)
      const maxR = g.serviceRadiusMi ?? 50
      if (d > radiusMi || d > maxR) continue
      scored.push({ group: g, distanceMi: d })
    }

    scored.sort((a, b) => a.distanceMi - b.distanceMi)
    const top = scored.slice(0, limit)
    if (top.length === 0) return reply.send({ items: [], origin: { lat, lng }, radiusMi })

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    let memberGroupIds = new Set<string>()
    if (viewerId) {
      const memRows = await db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.userId, viewerId))
      memberGroupIds = new Set(memRows.map((r) => r.groupId))
    }
    const visibleTop = top.filter(
      (t) => t.group.visibility === 'public' || memberGroupIds.has(t.group.id)
    )
    if (visibleTop.length === 0) return reply.send({ items: [], origin: { lat, lng }, radiusMi })

    const extraById = new Map(
      visibleTop.map((t) => [t.group.id, { distanceMi: Math.round(t.distanceMi * 10) / 10 }])
    )
    const items = await buildGroupListItems(
      visibleTop.map((t) => t.group),
      extraById
    )

    return reply.send({
      items,
      origin: { lat, lng },
      radiusMi,
    })
  })

  app.get('/api/v1/groups/:groupId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupId: groupKey } = req.params as { groupId: string }
    const g = await findGroupByIdOrSlug(groupKey)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
    const groupId = g.id
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!(await canViewGroup(g, viewerId))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const [rawMembership] = viewerId
      ? await db
          .select()
          .from(schema.groupMembers)
          .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, viewerId)))
          .limit(1)
      : [undefined]
    if (g.visibility === 'owner_absent' && !rawMembership) {
      return reply.status(404).send({ error: 'Not found' })
    }
    let parentOrganization: { slug: string; displayName: string } | null = null
    if (g.organizationId) {
      const [po] = await db
        .select({
          slug: schema.organizations.slug,
          displayName: schema.organizations.displayName,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, g.organizationId))
        .limit(1)
      parentOrganization = po ?? null
    }
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const membersRaw = await db
      .select({
        id: schema.groupMembers.id,
        groupId: schema.groupMembers.groupId,
        userId: schema.groupMembers.userId,
        role: schema.groupMembers.role,
        memberListVisibility: schema.groupMembers.memberListVisibility,
        showGroupOnProfile: schema.groupMembers.showGroupOnProfile,
        username: schema.users.username,
      })
      .from(schema.groupMembers)
      .innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.groupMembers.userId, schema.profiles.userId))
      .where(and(eq(schema.groupMembers.groupId, groupId), gt(schema.profiles.updatedAt, oneYearAgo)))
    const viewerMember = viewerId ? membersRaw.find((m) => m.userId === viewerId) : undefined
    const viewerMembership = viewerMember ? { role: viewerMember.role } : null
    const isGroupStaff = viewerIsGroupStaff(g, viewerMembership, viewerId)
    const members = filterGroupMembersForViewer(
      membersRaw.map((m) => ({
        ...m,
        memberListVisibility: (m.memberListVisibility ?? 'visible') as GroupMemberListVisibility,
      })),
      {
        viewerUserId: viewerId,
        groupOwnerId: g.ownerId,
        viewerMembership,
        isSiteStaff: false,
      },
    )
    const placeMap = await loadPlaceLabels(g.placeId ? [g.placeId] : [])
    return reply.send({
      group: {
        ...mapGroupWithPlace(g, placeMap),
        rules: parseGroupRules(g.rules),
      },
      parentOrganization,
      members: members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        username: m.username,
        role: m.role,
        joinedAt: '',
        ...(isGroupStaff && m.memberListVisibility === 'hidden' ?
          { memberListHidden: true as const }
        : {}),
      })),
      staffHiddenMemberCount:
        isGroupStaff ?
          membersRaw.filter((m) => m.memberListVisibility === 'hidden' && m.role === 'member').length
        : undefined,
      viewerMember: viewerMember
        ? {
            userId: viewerMember.userId,
            username: viewerMember.username,
            role: viewerMember.role,
            memberListVisibility: viewerMember.memberListVisibility,
            showGroupOnProfile: viewerMember.showGroupOnProfile,
          }
        : null,
    })
  })

  const groupPatchBody = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).nullable().optional(),
    category: groupCategorySchema.nullable().optional(),
    tags: z.array(z.string().max(64)).max(20).optional().nullable(),
    visibility: z.enum(['public', 'private', 'invite-only', 'owner_absent']).optional(),
    logoUrl: z.union([zHttpOrRootMediaUrlNullable, z.literal('')]).optional(),
    bannerUrl: z.union([zHttpOrRootMediaUrlNullable, z.literal('')]).optional(),
    shareImageUrl: z.union([zHttpOrRootMediaUrlNullable, z.literal('')]).optional(),
    placeId: z.union([z.string().uuid(), z.null()]).optional(),
    serviceRadiusMi: z.number().int().min(5).max(500).optional(),
    emailSignupEnabled: z.boolean().optional(),
  })

  app.patch('/api/v1/groups/:groupId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
    if (!(await canEditGroupSettings(g, user.userId))) {
      return reply.status(403).send({ error: 'Moderator access required' })
    }
    const parsed = groupPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.placeId) {
      const [pl] = await db
        .select({ id: schema.places.id })
        .from(schema.places)
        .where(eq(schema.places.id, parsed.data.placeId))
        .limit(1)
      if (!pl) return reply.status(400).send({ error: 'Invalid placeId' })
    }
    const nextLogo =
      parsed.data.logoUrl !== undefined ?
        parsed.data.logoUrl && parsed.data.logoUrl.length > 0 ?
          parsed.data.logoUrl
        : null
      : g.logoUrl
    const nextBanner =
      parsed.data.bannerUrl !== undefined ?
        parsed.data.bannerUrl && parsed.data.bannerUrl.length > 0 ?
          parsed.data.bannerUrl
        : null
      : g.bannerUrl
    const nextShare =
      parsed.data.shareImageUrl !== undefined ?
        parsed.data.shareImageUrl && parsed.data.shareImageUrl.length > 0 ?
          parsed.data.shareImageUrl
        : null
      : g.shareImageUrl
    const nextPlaceId = parsed.data.placeId !== undefined ? parsed.data.placeId : g.placeId
    const nextDescription =
      parsed.data.description !== undefined ?
        parsed.data.description && parsed.data.description.trim().length > 0 ?
          parsed.data.description.trim()
        : null
      : g.description
    const nextCategory = parsed.data.category !== undefined ? parsed.data.category : g.category
    const nextTags =
      parsed.data.tags !== undefined ?
        parsed.data.tags ? normalizeGroupTags(parsed.data.tags)
        : null
      : g.tags
    const [updated] = await db
      .update(schema.groups)
      .set({
        name: parsed.data.name ?? g.name,
        description: nextDescription,
        category: nextCategory,
        tags: nextTags,
        visibility: parsed.data.visibility ?? g.visibility,
        logoUrl: nextLogo,
        bannerUrl: nextBanner,
        shareImageUrl: nextShare,
        placeId: nextPlaceId,
        serviceRadiusMi: parsed.data.serviceRadiusMi ?? g.serviceRadiusMi,
        emailSignupEnabled: parsed.data.emailSignupEnabled ?? g.emailSignupEnabled,
      })
      .where(eq(schema.groups.id, groupId))
      .returning()
    const placeMap = await loadPlaceLabels(updated.placeId ? [updated.placeId] : [])
    return reply.send({ group: mapGroupWithPlace(updated, placeMap) })
  })

  const groupBrandingAttachBody = z.object({
    kind: z.enum(['banner', 'logo', 'share']),
    quarantineKey: z.string().min(1).max(2048),
  })

  app.post('/api/v1/groups/:groupId/branding/attach', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('group_branding')) {
      return alphaUploadDisabledResponse(reply, 'group_branding')
    }
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
    if (!(await canEditGroupSettings(g, user.userId))) {
      return reply.status(403).send({ error: 'Moderator access required' })
    }
    const parsed = groupBrandingAttachBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    let publicUrl: string
    try {
      publicUrl = await promoteQuarantineToScopeBrandingUrl({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        scopePath: `groups/${groupId}`,
        assetName: parsed.data.kind,
      })
    } catch (err) {
      if (err instanceof MediaUploadValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      const e = err as { message?: string }
      req.log?.error({ err }, 'group branding attach failed')
      return reply.status(502).send({ error: e.message ?? 'Could not attach branding image' })
    }
    const field =
      parsed.data.kind === 'banner' ? 'bannerUrl'
      : parsed.data.kind === 'logo' ? 'logoUrl'
      : 'shareImageUrl'
    const [updated] = await db
      .update(schema.groups)
      .set({ [field]: publicUrl })
      .where(eq(schema.groups.id, groupId))
      .returning()
    const placeMap = await loadPlaceLabels(updated.placeId ? [updated.placeId] : [])
    return reply.send({
      url: publicUrl,
      kind: parsed.data.kind,
      group: mapGroupWithPlace(updated, placeMap),
    })
  })

  const groupMemberPatchBody = z.object({
    role: z.enum(['owner', 'admin', 'moderator', 'event_host', 'member']),
  })

  app.patch('/api/v1/groups/:groupId/members/:userId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId, userId: targetUserId } = req.params as { groupId: string; userId: string }
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
    const [mem] = await db
      .select({ role: schema.groupMembers.role })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
      .limit(1)
    const role = mem?.role?.toLowerCase() ?? ''
    if (g.ownerId !== user.userId && !['owner', 'admin'].includes(role)) {
      return reply.status(403).send({ error: 'Admin access required' })
    }
    const parsed = groupMemberPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [target] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, targetUserId)))
      .limit(1)
    if (!target) return reply.status(404).send({ error: 'Member not found' })
    const nextRole = parsed.data.role
    const patch: {
      role: typeof nextRole
      memberListVisibility?: GroupMemberListVisibility
      visibilityUpdatedAt?: Date
      visibilityUpdatedByUserId?: string
    } = { role: nextRole }
    if (isGroupStaffRole(nextRole) && target.memberListVisibility === 'hidden') {
      patch.memberListVisibility = 'visible'
      patch.visibilityUpdatedAt = new Date()
      patch.visibilityUpdatedByUserId = user.userId
    }
    const [updated] = await db
      .update(schema.groupMembers)
      .set(patch)
      .where(eq(schema.groupMembers.id, target.id))
      .returning()
    return reply.send({
      member: updated,
      visibilityForcedVisible: isGroupStaffRole(nextRole) && target.memberListVisibility === 'hidden',
    })
  })

  const groupMembershipPrivacyBody = z.object({
    memberListVisibility: groupMemberListVisibilitySchema.optional(),
    showGroupOnProfile: z.boolean().optional(),
    announceGroupJoinInFeed: z.boolean().optional(),
  })

  app.patch('/api/v1/groups/:groupId/membership', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    const parsed = groupMembershipPrivacyBody.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [mem] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
      .limit(1)
    if (!mem) return reply.status(404).send({ error: 'Not a member' })

    const nextVisibility =
      parsed.data.memberListVisibility ?
        isGroupStaffRole(mem.role) ?
          'visible'
        : parsed.data.memberListVisibility
      : (mem.memberListVisibility as GroupMemberListVisibility)

    const [updated] = await db
      .update(schema.groupMembers)
      .set({
        ...(parsed.data.memberListVisibility !== undefined ?
          { memberListVisibility: nextVisibility }
        : {}),
        ...(parsed.data.showGroupOnProfile !== undefined ?
          { showGroupOnProfile: parsed.data.showGroupOnProfile }
        : {}),
        ...(parsed.data.announceGroupJoinInFeed !== undefined ?
          { announceGroupJoinInFeed: parsed.data.announceGroupJoinInFeed }
        : {}),
        visibilityUpdatedAt: new Date(),
        visibilityUpdatedByUserId: user.userId,
      })
      .where(eq(schema.groupMembers.id, mem.id))
      .returning()

    return reply.send({ member: updated })
  })

  const groupBody = z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(128),
    category: groupCategorySchema,
    tags: z.array(z.string().max(64)).max(20).optional(),
    organizationId: z.string().uuid().optional(),
    visibility: z.enum(['public', 'private', 'invite-only']).optional(),
    rules: groupRulesSchema.optional(),
  })
  app.post('/api/v1/groups', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = groupBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.organizationId) {
      const [mem] = await db
        .select({ role: schema.organizationMembers.role })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, parsed.data.organizationId),
            eq(schema.organizationMembers.userId, user.userId)
          )
        )
        .limit(1)
      const rank = mem ? ORG_SUBGROUP_ROLE_RANK[mem.role] ?? 0 : 0
      if (rank < ORG_SUBGROUP_ROLE_RANK.MODERATOR) {
        return reply.status(403).send({ error: 'Moderator role required to create org subgroups' })
      }
      const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, parsed.data.organizationId))
        .limit(1)
      if (!org || !parseOrgFeatureFlags(org.featureFlags).subgroupsEnabled) {
        return reply.status(400).send({ error: 'Organization sub-groups are disabled' })
      }
    }
    const [g] = await db
      .insert(schema.groups)
      .values({
        name: parsed.data.name,
        slug: parsed.data.slug,
        category: parsed.data.category,
        tags: parsed.data.tags?.length ? normalizeGroupTags(parsed.data.tags) : null,
        ownerId: user.userId,
        organizationId: parsed.data.organizationId,
        visibility: parsed.data.visibility ?? 'public',
        rules: parsed.data.rules ?? [],
      })
      .returning()
    if (!g) return reply.status(500).send({ error: 'Insert failed' })
    await db.insert(schema.groupMembers).values({
      groupId: g.id,
      userId: user.userId,
      role: 'owner',
    })
    return reply.send({ group: g })
  })

  const groupJoinBody = z.object({
    memberListVisibility: groupMemberListVisibilitySchema.optional(),
    showGroupOnProfile: z.boolean().optional(),
    announceGroupJoinInFeed: z.boolean().optional(),
    rememberAsDefault: z.boolean().optional(),
  })

  app.post('/api/v1/groups/:groupId/join', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    const parsedJoin = groupJoinBody.safeParse(req.body ?? {})
    const body = parsedJoin.success ? parsedJoin.data : {}
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
    const [existing] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
      .limit(1)
    if (existing) return reply.send({ member: existing, alreadyMember: true })

    const settingsRow = await ensureUserSettingsRow(user.userId)
    const privacy = normalizePrivacySettings(settingsRow.privacySettings)
    const memberListVisibility: GroupMemberListVisibility =
      body.memberListVisibility ??
      (privacy.feedActivityPrivacy.defaultGroupMemberListVisibility === 'hidden' ? 'hidden'
      : privacy.feedActivityPrivacy.defaultGroupMemberListVisibility === 'visible' ? 'visible'
      : 'visible')
    const showGroupOnProfile = body.showGroupOnProfile ?? privacy.feedActivityPrivacy.defaultShowGroupsOnProfile
    const announceGroupJoinInFeed =
      body.announceGroupJoinInFeed ?? privacy.feedActivityPrivacy.defaultAnnounceGroupJoins

    const [row] = await db
      .insert(schema.groupMembers)
      .values({
        groupId,
        userId: user.userId,
        role: 'member',
        memberListVisibility,
        showGroupOnProfile,
        announceGroupJoinInFeed,
        visibilityUpdatedAt: new Date(),
        visibilityUpdatedByUserId: user.userId,
      })
      .returning()
    await touchGroupActivity(groupId)

    if (body.rememberAsDefault) {
      const nextPrivacy = mergePrivacySettings(settingsRow.privacySettings, {
        feedActivityPrivacy: {
          ...privacy.feedActivityPrivacy,
          defaultGroupMemberListVisibility: memberListVisibility === 'hidden' ? 'hidden' : 'visible',
          defaultShowGroupsOnProfile: showGroupOnProfile,
          defaultAnnounceGroupJoins: announceGroupJoinInFeed,
        },
      })
      await db
        .update(schema.userSettings)
        .set({ privacySettings: nextPrivacy, updatedAt: new Date() })
        .where(eq(schema.userSettings.userId, user.userId))
    }

    if (
      shouldEmitGroupJoinFeedActivity(
        { memberListVisibility, announceGroupJoinInFeed },
        'member',
      )
    ) {
      emitActivity({
        actorId: user.userId,
        verb: 'group_join',
        objectType: 'group',
        objectId: groupId,
        metadata: { groupName: g.name },
      })
    }

    const confirmation =
      memberListVisibility === 'hidden' ?
        'You joined the group. Your name is hidden from the member list, except to group staff.'
      : 'You joined the group. Your name is visible in the member list.'

    return reply.send({ member: row, confirmation })
  })

  app.post('/api/v1/groups/:groupId/leave', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    const [mem] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
      .limit(1)
    if (!mem) return reply.status(400).send({ error: 'Not a member' })
    if (mem.role === 'owner' || g.ownerId === user.userId) {
      return reply.status(400).send({ error: 'Owner cannot leave via this endpoint' })
    }
    await db
      .delete(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
    return reply.send({ ok: true })
  })

  /* --- E4: Events --- */
  const ORG_EVENT_ROLE_RANK: Record<string, number> = {
    OWNER: 5,
    ADMIN: 4,
    MODERATOR: 3,
    STAFF: 2,
    MEMBER: 1,
  }

  app.get('/api/v1/events', async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as {
      organizationId?: string
      groupId?: string
      category?: string | string[]
      format?: string
      city?: string
      country?: string
      hostId?: string
    }
    const orgFilter =
      q.organizationId && /^[0-9a-f-]{36}$/i.test(q.organizationId)
        ? eq(schema.events.organizationId, q.organizationId)
        : undefined
    const groupIdParam =
      q.groupId && /^[0-9a-f-]{36}$/i.test(q.groupId) ? q.groupId : undefined
    const groupFilter = groupIdParam ? eq(schema.events.groupId, groupIdParam) : undefined

    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)

    const categoryFilters = parseEventsListCategories(q.category)
    const categoryFilter =
      categoryFilters.length > 0 ?
        inArray(schema.events.category, dbCategoryValuesForFilter(categoryFilters))
      : undefined

    const formatRaw = typeof q.format === 'string' ? q.format.trim() : ''
    const formatFilter =
      formatRaw === 'in-person' || formatRaw === 'virtual' ? eq(schema.events.eventFormat, formatRaw) : undefined

    const cityTrim = typeof q.city === 'string' ? sanitizeIlikeFragment(q.city.trim()) : ''
    const countryTrim = typeof q.country === 'string' ? sanitizeIlikeFragment(q.country.trim()) : ''
    const cityFilter =
      cityTrim.length > 0 ?
        or(
          ilike(schema.events.location, `%${cityTrim}%`),
          ilike(schema.events.publicLocationSummary, `%${cityTrim}%`)
        )
      : undefined
    const countryFilter =
      countryTrim.length > 0 ?
        or(
          ilike(schema.events.location, `%${countryTrim}%`),
          ilike(schema.events.publicLocationSummary, `%${countryTrim}%`)
        )
      : undefined

    const hostIdParam = typeof q.hostId === 'string' ? q.hostId.trim() : ''
    let hostFilter: ReturnType<typeof eq> | undefined
    if (hostIdParam === 'me') {
      if (!viewerId) return reply.status(401).send({ error: 'Unauthorized' })
      hostFilter = eq(schema.events.hostId, viewerId)
    } else if (hostIdParam && /^[0-9a-f-]{36}$/i.test(hostIdParam)) {
      hostFilter = eq(schema.events.hostId, hostIdParam)
    }

    const listFilters = [orgFilter, groupFilter, categoryFilter, formatFilter, cityFilter, countryFilter, hostFilter].filter(
      (f): f is NonNullable<typeof f> => f != null
    )

    if (isGlobalPublicEventDiscoveryQuery(q)) {
      listFilters.push(globalPublicEventDiscoveryFilter())
    }

    if (groupIdParam) {
      const [g] = await db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.id, groupIdParam))
        .limit(1)
      if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
      if (!(await canViewGroup(g, viewerId))) return reply.status(404).send({ error: 'Not found' })
    }
    let query = db
      .select({
        id: schema.events.id,
        hostId: schema.events.hostId,
        title: schema.events.title,
        description: schema.events.description,
        location: schema.events.location,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        visibility: schema.events.visibility,
        groupId: schema.events.groupId,
        organizationId: schema.events.organizationId,
        category: schema.events.category,
        tags: schema.events.tags,
        imageUrl: schema.events.imageUrl,
        eventFormat: schema.events.eventFormat,
        rsvpCount: schema.events.rsvpCount,
        priceCents: schema.events.priceCents,
        ticketPurchaseUrl: schema.events.ticketPurchaseUrl,
        ticketingProvider: schema.events.ticketingProvider,
        ticketEmbedUrl: schema.events.ticketEmbedUrl,
        dressCode: schema.events.dressCode,
        expectedCostText: schema.events.expectedCostText,
        virtualSessionStyle: schema.events.virtualSessionStyle,
        virtualAgenda: schema.events.virtualAgenda,
        materialsUrl: schema.events.materialsUrl,
        recordingPolicy: schema.events.recordingPolicy,
        eventTimezone: schema.events.eventTimezone,
        locationVisibility: schema.events.locationVisibility,
        publicLocationSummary: schema.events.publicLocationSummary,
        screeningQuestion: schema.events.screeningQuestion,
        newcomerFriendly: schema.events.newcomerFriendly,
        accessibilityNotes: schema.events.accessibilityNotes,
        capacityMax: schema.events.capacityMax,
        attendeeListVisibility: schema.events.attendeeListVisibility,
        featured: schema.events.featured,
        featuredUntil: schema.events.featuredUntil,
        rsvpOpen: schema.events.rsvpOpen,
        createdAt: schema.events.createdAt,
        hostUsername: schema.users.username,
        hostDisplayName: schema.profiles.displayName,
        hostVerified: schema.profiles.verified,
        organizationSlug: schema.organizations.slug,
      })
      .from(schema.events)
      .innerJoin(schema.users, eq(schema.events.hostId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .leftJoin(schema.organizations, eq(schema.events.organizationId, schema.organizations.id))
    if (listFilters.length === 1) query = query.where(listFilters[0]) as typeof query
    else if (listFilters.length > 1) query = query.where(and(...listFilters)) as typeof query
    let rows = await query.orderBy(desc(schema.events.startsAt)).limit(100)

    if (groupIdParam) {
      const isMember = viewerId ? Boolean(await getGroupMembership(groupIdParam, viewerId)) : false
      const visible: typeof rows = []
      for (const row of rows) {
        if (await canViewerSeeGroupEvent(viewerId, row, isMember)) visible.push(row)
      }
      rows = visible
    }

    const joinVisible = await virtualJoinLinkVisibleEventIds(
      viewerId,
      rows.map((r) => ({
        id: r.id,
        hostId: r.hostId,
        organizationId: r.organizationId,
        eventFormat: r.eventFormat,
      }))
    )
    const physicalVisible = await physicalLocationDetailVisibleEventIds(
      viewerId,
      rows.map((r) => ({
        id: r.id,
        hostId: r.hostId,
        organizationId: r.organizationId,
        eventFormat: r.eventFormat,
        locationVisibility: r.locationVisibility ?? 'public',
      }))
    )
    const eventIds = rows.map((r) => r.id)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const mutualGoingByEvent = new Map<string, number>()
    if (viewerId && eventIds.length > 0) {
      const accepted = await db
        .select({
          requesterId: schema.connections.requesterId,
          recipientId: schema.connections.recipientId,
        })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.status, 'ACCEPTED'),
            or(eq(schema.connections.requesterId, viewerId), eq(schema.connections.recipientId, viewerId))
          )
        )
      const connectedUserIds = accepted
        .map((c) => (c.requesterId === viewerId ? c.recipientId : c.requesterId))
        .filter(Boolean)
      if (connectedUserIds.length > 0) {
        const mutualRows = await db
          .select({
            eventId: schema.eventRsvps.eventId,
            cnt: count(),
          })
          .from(schema.eventRsvps)
          .innerJoin(schema.profiles, eq(schema.eventRsvps.userId, schema.profiles.userId))
          .where(
            and(
              inArray(schema.eventRsvps.eventId, eventIds),
              inArray(schema.eventRsvps.userId, connectedUserIds),
              eq(schema.eventRsvps.status, 'going'),
              or(
                eq(schema.eventRsvps.rsvpApprovalStatus, 'not_required'),
                eq(schema.eventRsvps.rsvpApprovalStatus, 'approved')
              ),
              gt(schema.profiles.updatedAt, oneYearAgo)
            )
          )
          .groupBy(schema.eventRsvps.eventId)
        for (const row of mutualRows) mutualGoingByEvent.set(row.eventId, row.cnt)
      }
    }
    const connectionRsvpPreviewByEvent = await loadConnectionRsvpPreviewByEventIds(viewerId, eventIds)
    const programMap = await getProgramSummariesForEventIds(rows.map((r) => r.id))
    const items = await withAlphaLabels(
      'event',
      rows.map((r) => {
        const p = programMap.get(r.id)
        const shaped = applyEventLocationRedaction(r, joinVisible, physicalVisible)
        return {
          ...shaped,
          imageUrl: deliverCardImageUrl(shaped.imageUrl),
          featured: r.featured,
          featuredUntil: r.featuredUntil?.toISOString?.() ?? r.featuredUntil ?? null,
          isFeatured: isEventFeatured(r),
          viewerMutualGoingCount: mutualGoingByEvent.get(r.id) ?? 0,
          connectionRsvpPreview: connectionRsvpPreviewByEvent.get(r.id) ?? [],
          hasProgram: Boolean(p),
          conventionSlug: p?.slug ?? null,
          programSlotCount: p?.slotCount ?? 0,
        }
      }),
    )
    return reply.send({ items })
  })

  app.get('/api/v1/events/:eventId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    const [row] = await db
      .select({
        id: schema.events.id,
        hostId: schema.events.hostId,
        title: schema.events.title,
        description: schema.events.description,
        location: schema.events.location,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        visibility: schema.events.visibility,
        groupId: schema.events.groupId,
        organizationId: schema.events.organizationId,
        category: schema.events.category,
        tags: schema.events.tags,
        imageUrl: schema.events.imageUrl,
        eventFormat: schema.events.eventFormat,
        rsvpCount: schema.events.rsvpCount,
        priceCents: schema.events.priceCents,
        ticketPurchaseUrl: schema.events.ticketPurchaseUrl,
        ticketingProvider: schema.events.ticketingProvider,
        ticketEmbedUrl: schema.events.ticketEmbedUrl,
        dressCode: schema.events.dressCode,
        expectedCostText: schema.events.expectedCostText,
        virtualSessionStyle: schema.events.virtualSessionStyle,
        virtualAgenda: schema.events.virtualAgenda,
        materialsUrl: schema.events.materialsUrl,
        recordingPolicy: schema.events.recordingPolicy,
        eventTimezone: schema.events.eventTimezone,
        locationVisibility: schema.events.locationVisibility,
        publicLocationSummary: schema.events.publicLocationSummary,
        screeningQuestion: schema.events.screeningQuestion,
        newcomerFriendly: schema.events.newcomerFriendly,
        accessibilityNotes: schema.events.accessibilityNotes,
        capacityMax: schema.events.capacityMax,
        attendeeListVisibility: schema.events.attendeeListVisibility,
        featured: schema.events.featured,
        featuredUntil: schema.events.featuredUntil,
        rsvpOpen: schema.events.rsvpOpen,
        venuePlaceId: schema.events.venuePlaceId,
        venuePlaceSlug: schema.communityPlaces.slug,
        venuePlaceName: schema.communityPlaces.name,
        createdAt: schema.events.createdAt,
        hostUsername: schema.users.username,
        hostDisplayName: schema.profiles.displayName,
        hostVerified: schema.profiles.verified,
        organizationSlug: schema.organizations.slug,
      })
      .from(schema.events)
      .innerJoin(schema.users, eq(schema.events.hostId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .leftJoin(schema.organizations, eq(schema.events.organizationId, schema.organizations.id))
      .leftJoin(schema.communityPlaces, eq(schema.events.venuePlaceId, schema.communityPlaces.id))
      .where(eq(schema.events.id, eventId))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    const program = await getProgramSummaryForEvent(eventId)
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!(await canViewerSeeEventDetail(viewerId, row))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const detailJoinVisible = await virtualJoinLinkVisibleEventIds(viewerId, [
      {
        id: row.id,
        hostId: row.hostId,
        organizationId: row.organizationId,
        eventFormat: row.eventFormat,
      },
    ])
    const detailPhysicalVisible = await physicalLocationDetailVisibleEventIds(viewerId, [
      {
        id: row.id,
        hostId: row.hostId,
        organizationId: row.organizationId,
        eventFormat: row.eventFormat,
        locationVisibility: row.locationVisibility ?? 'public',
      },
    ])
    const rowForClient = applyEventLocationRedaction(row, detailJoinVisible, detailPhysicalVisible)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    let viewerRsvpStatus: 'going' | 'maybe' | 'not_going' | 'waitlist' | null = null
    let viewerRsvpApprovalStatus: 'not_required' | 'pending' | 'approved' | 'rejected' | null = null
    let viewerPaidConfirmed = false
    let viewerMutualGoingCount = 0
    let pendingRsvpApprovals = 0
    if (viewerId) {
      const [rv] = await db
        .select({
          status: schema.eventRsvps.status,
          rsvpApprovalStatus: schema.eventRsvps.rsvpApprovalStatus,
          paidConfirmed: schema.eventRsvps.paidConfirmed,
        })
        .from(schema.eventRsvps)
        .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, viewerId)))
        .limit(1)
      viewerRsvpStatus = rv?.status ?? null
      viewerRsvpApprovalStatus = rv?.rsvpApprovalStatus ?? null
      viewerPaidConfirmed = Boolean(rv?.paidConfirmed)
      const accepted = await db
        .select({
          requesterId: schema.connections.requesterId,
          recipientId: schema.connections.recipientId,
        })
        .from(schema.connections)
        .where(
          and(
            eq(schema.connections.status, 'ACCEPTED'),
            or(eq(schema.connections.requesterId, viewerId), eq(schema.connections.recipientId, viewerId))
          )
        )
      const connectedUserIds = accepted
        .map((c) => (c.requesterId === viewerId ? c.recipientId : c.requesterId))
        .filter(Boolean)
      if (connectedUserIds.length > 0) {
        const [cnt] = await db
          .select({ count: count() })
          .from(schema.eventRsvps)
          .innerJoin(schema.profiles, eq(schema.eventRsvps.userId, schema.profiles.userId))
          .where(
            and(
              eq(schema.eventRsvps.eventId, eventId),
              inArray(schema.eventRsvps.userId, connectedUserIds),
              eq(schema.eventRsvps.status, 'going'),
              or(
                eq(schema.eventRsvps.rsvpApprovalStatus, 'not_required'),
                eq(schema.eventRsvps.rsvpApprovalStatus, 'approved')
              ),
              gt(schema.profiles.updatedAt, oneYearAgo)
            )
          )
        viewerMutualGoingCount = cnt?.count ?? 0
      }
      if (await viewerCanPatchEvent(viewerId, row)) {
        const [pc] = await db
          .select({ n: count() })
          .from(schema.eventRsvps)
          .where(
            and(
              eq(schema.eventRsvps.eventId, eventId),
              eq(schema.eventRsvps.status, 'going'),
              eq(schema.eventRsvps.rsvpApprovalStatus, 'pending')
            )
          )
        pendingRsvpApprovals = Number(pc?.n ?? 0)
      }
    }
    const viewerCanManage = viewerId ? await viewerCanPatchEvent(viewerId, row) : false
    const connectionRsvpPreviewMap = await loadConnectionRsvpPreviewByEventIds(viewerId, [eventId])

    let payments: {
      processor: 'stripe' | 'external' | 'manual'
      externalPaymentUrl: string | null
      stripeReady: boolean
      orgSlug: string | null
    } | null = null
    if (row.organizationId) {
      const [orgPay] = await db
        .select({
          slug: schema.organizations.slug,
          paymentProcessor: schema.organizations.paymentProcessor,
          externalPaymentUrl: schema.organizations.externalPaymentUrl,
          stripeConnectAccountId: schema.organizations.stripeConnectAccountId,
          stripeConnectChargesEnabled: schema.organizations.stripeConnectChargesEnabled,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, row.organizationId))
        .limit(1)
      if (orgPay) {
        const raw = (orgPay.paymentProcessor ?? 'stripe').toLowerCase()
        const processor =
          raw === 'external' || raw === 'manual' || raw === 'stripe' ? raw : 'stripe'
        payments = {
          processor,
          externalPaymentUrl: orgPay.externalPaymentUrl ?? null,
          stripeReady: Boolean(
            processor === 'stripe' &&
              orgPay.stripeConnectAccountId &&
              orgPay.stripeConnectChargesEnabled,
          ),
          orgSlug: orgPay.slug,
        }
      }
    }

    const event = await withAlphaLabel('event', {
      ...rowForClient,
      imageUrl: deliverCardImageUrl(rowForClient.imageUrl),
      featured: row.featured,
      featuredUntil: row.featuredUntil?.toISOString?.() ?? row.featuredUntil ?? null,
      isFeatured: isEventFeatured(row),
      viewerRsvpStatus,
      viewerRsvpApprovalStatus,
      viewerPaidConfirmed,
      viewerMutualGoingCount,
      connectionRsvpPreview: connectionRsvpPreviewMap.get(eventId) ?? [],
      pendingRsvpApprovals,
      viewerCanManage,
      hasProgram: Boolean(program),
      conventionSlug: program?.slug ?? null,
      programSlotCount: program?.slotCount ?? 0,
      payments,
    })
    return reply.send({ event, program })
  })

  app.get('/api/v1/events/:eventId/calendar.ics', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    const [ev] = await db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        description: schema.events.description,
        startsAt: schema.events.startsAt,
        endsAt: schema.events.endsAt,
        eventFormat: schema.events.eventFormat,
        hostId: schema.events.hostId,
        organizationId: schema.events.organizationId,
        location: schema.events.location,
        locationVisibility: schema.events.locationVisibility,
        publicLocationSummary: schema.events.publicLocationSummary,
      })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    const canManage = await viewerCanPatchEvent(user.userId, ev)
    const [rv] = await db
      .select({ status: schema.eventRsvps.status })
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, user.userId)))
      .limit(1)
    const okRsvp =
      rv?.status === 'going' || rv?.status === 'maybe' || rv?.status === 'waitlist'
    if (!canManage && !okRsvp) {
      return reply.status(403).send({ error: 'RSVP or host access required' })
    }
    const joinVis = await virtualJoinLinkVisibleEventIds(user.userId, [
      {
        id: ev.id,
        hostId: ev.hostId,
        organizationId: ev.organizationId,
        eventFormat: ev.eventFormat,
      },
    ])
    const physVis = await physicalLocationDetailVisibleEventIds(user.userId, [
      {
        id: ev.id,
        hostId: ev.hostId,
        organizationId: ev.organizationId,
        eventFormat: ev.eventFormat,
        locationVisibility: ev.locationVisibility ?? 'public',
      },
    ])
    const shaped = applyEventLocationRedaction(ev, joinVis, physVis)
    const base =
      (process.env.C2K_WEB_PUBLIC_URL ?? process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
    const eventPageUrl = `${base}/events/${encodeURIComponent(eventId)}`
    const extraBits = [
      shaped.publicLocationSummary?.trim() ? `Location (public): ${shaped.publicLocationSummary.trim()}` : '',
      !shaped.location && shaped.locationRedacted ? 'Full address is shared only to approved guests.' : '',
      `Event page: ${eventPageUrl}`,
    ].filter(Boolean)
    const description = [ev.description?.trim() ?? '', ...extraBits].filter(Boolean).join('\n\n') || undefined
    const ics = buildEventIcsCalendar({
      uid: `${ev.id}@c2k`,
      title: ev.title,
      description,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      eventPageUrl,
      location: shaped.location?.trim() ? shaped.location.trim() : undefined,
    })
    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="event-${eventId.slice(0, 8)}.ics"`)
      .send(ics)
  })

  const rsvpBody = z.object({
    status: z.enum(['going', 'maybe', 'not_going']),
    screeningAnswer: z.string().max(2000).optional(),
  })
  app.put('/api/v1/events/:eventId/rsvp', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    const parsed = rsvpBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })

    const [existing] = await db
      .select({
        id: schema.eventRsvps.id,
        status: schema.eventRsvps.status,
        rsvpApprovalStatus: schema.eventRsvps.rsvpApprovalStatus,
        screeningAnswer: schema.eventRsvps.screeningAnswer,
      })
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, user.userId)))
      .limit(1)

    if (!ev.rsvpOpen && parsed.data.status !== 'not_going') {
      return reply.status(403).send({ error: 'RSVPs are closed for this event' })
    }

    const isCommittedGoing = (r: typeof existing) =>
      Boolean(
        r &&
          r.status === 'going' &&
          (r.rsvpApprovalStatus === 'not_required' || r.rsvpApprovalStatus === 'approved')
      )

    if (parsed.data.status === 'not_going') {
      const wasCommitted = isCommittedGoing(existing)
      await db
        .delete(schema.eventRsvps)
        .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, user.userId)))
      if (wasCommitted) await promoteNextWaitlist(eventId)
      await refreshEventRsvpCount(eventId)
      const [cnt] = await db
        .select({ rsvpCount: schema.events.rsvpCount })
        .from(schema.events)
        .where(eq(schema.events.id, eventId))
        .limit(1)
      return reply.send({
        ok: true,
        rsvpCount: cnt?.rsvpCount ?? 0,
        status: null,
        rsvpApprovalStatus: null,
      })
    }

    const screeningQ = ev.screeningQuestion?.trim()
    if (
      screeningQ &&
      (parsed.data.status === 'going' || parsed.data.status === 'maybe') &&
      !(parsed.data.screeningAnswer?.trim() ?? existing?.screeningAnswer?.trim())
    ) {
      return reply.status(400).send({ error: 'screeningAnswer is required for this event' })
    }

    const hadGoingMaybeBefore = Boolean(
      existing && (existing.status === 'going' || existing.status === 'maybe')
    )

    let nextStatus: 'going' | 'maybe' | 'waitlist' = parsed.data.status
    let nextApproval: 'not_required' | 'pending' | 'approved' = 'not_required'
    const answer =
      parsed.data.screeningAnswer !== undefined ?
        (parsed.data.screeningAnswer.trim() || null)
      : (existing?.screeningAnswer ?? null)

    if (parsed.data.status === 'maybe') {
      nextApproval = 'not_required'
    } else if (parsed.data.status === 'going') {
      let committed = await countCommittedGoing(eventId)
      if (isCommittedGoing(existing)) committed -= 1
      const cap = ev.capacityMax
      if (cap != null && cap > 0 && committed >= cap) {
        nextStatus = 'waitlist'
        nextApproval = 'not_required'
      } else if (ev.locationVisibility === 'approved') {
        nextApproval = 'pending'
      }
    }

    const now = new Date()
    const wasCommittedBefore = isCommittedGoing(existing)

    if (existing) {
      await db
        .update(schema.eventRsvps)
        .set({
          status: nextStatus,
          rsvpApprovalStatus: nextApproval,
          screeningAnswer: answer,
          updatedAt: now,
        })
        .where(eq(schema.eventRsvps.id, existing.id))
    } else {
      await db.insert(schema.eventRsvps).values({
        eventId,
        userId: user.userId,
        status: nextStatus,
        rsvpApprovalStatus: nextApproval,
        screeningAnswer: answer,
        updatedAt: now,
      })
    }

    if (parsed.data.status === 'maybe' && wasCommittedBefore) {
      await promoteNextWaitlist(eventId)
    }

    if (
      ev.eventFormat === 'virtual' &&
      !hadGoingMaybeBefore &&
      (nextStatus === 'going' || nextStatus === 'maybe')
    ) {
      await createNotification(user.userId, 'event_rsvp_confirmed_virtual', {
        eventId,
        title: ev.title,
      })
    }

    await refreshEventRsvpCount(eventId)
    const [cnt] = await db
      .select({ rsvpCount: schema.events.rsvpCount })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)

    if (
      !hadGoingMaybeBefore &&
      (nextStatus === 'going' || nextStatus === 'maybe' || nextStatus === 'waitlist')
    ) {
      void (async () => {
        const defaults = await resolveUserParticipationDefaults(user.userId)
        if (!defaults?.email) return
        const mailStatus =
          nextStatus === 'waitlist' ? 'waitlist'
          : nextStatus === 'maybe' ? 'maybe'
          : 'going'
        await sendEventRsvpConfirmationEmail({
          to: defaults.email,
          eventTitle: ev.title,
          eventId,
          status: mailStatus,
          startsAt: ev.startsAt,
        })
      })()
    }

    const isNowCommitted = nextStatus === 'going' && nextApproval === 'not_required'
    if (isNowCommitted && !wasCommittedBefore) {
      emitActivity({
        actorId: user.userId,
        verb: 'event_rsvp',
        objectType: 'event',
        objectId: eventId,
        metadata: { title: ev.title },
      })
    }

    return reply.send({
      ok: true,
      rsvpCount: cnt?.rsvpCount ?? 0,
      status: nextStatus,
      rsvpApprovalStatus: nextApproval,
    })
  })

  app.get('/api/v1/events/:eventId/attendees', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    const [ev] = await db
      .select({
        id: schema.events.id,
        visibility: schema.events.visibility,
        hostId: schema.events.hostId,
        groupId: schema.events.groupId,
        organizationId: schema.events.organizationId,
        attendeeListVisibility: schema.events.attendeeListVisibility,
      })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    // Attendee data is at least as sensitive as the event detail itself:
    // enforce the same visibility/block gate (UUID possession is not authorization).
    if (!(await canViewerSeeEventDetail(viewerId, ev))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const isHost = Boolean(viewerId && (await viewerCanPatchEvent(viewerId, ev)))

    const goingCountRow = await db
      .select({ n: count() })
      .from(schema.eventRsvps)
      .where(
        and(
          eq(schema.eventRsvps.eventId, eventId),
          eq(schema.eventRsvps.status, 'going'),
          or(
            eq(schema.eventRsvps.rsvpApprovalStatus, 'not_required'),
            eq(schema.eventRsvps.rsvpApprovalStatus, 'approved')
          )
        )
      )
    const goingCount = Number(goingCountRow[0]?.n ?? 0)

    const goingRows = await db
      .select({
        userId: schema.eventRsvps.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.eventRsvps)
      .innerJoin(schema.users, eq(schema.users.id, schema.eventRsvps.userId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.eventRsvps.userId))
      .where(
        and(
          eq(schema.eventRsvps.eventId, eventId),
          eq(schema.eventRsvps.status, 'going'),
          or(
            eq(schema.eventRsvps.rsvpApprovalStatus, 'not_required'),
            eq(schema.eventRsvps.rsvpApprovalStatus, 'approved')
          )
        )
      )
      .orderBy(asc(schema.eventRsvps.createdAt))
      .limit(200)

    const maybeCountRow = await db
      .select({ n: count() })
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.status, 'maybe')))
    const waitCountRow = await db
      .select({ n: count() })
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.status, 'waitlist')))

    // Blocked pairs must not see each other on the roster (either direction).
    const blockedPairIds =
      viewerId ? await loadBlockedPairUserIds(viewerId) : new Set<string>()
    const visibleGoingRows = goingRows.filter((r) => !blockedPairIds.has(r.userId))

    const showNames = isHost || ev.attendeeListVisibility !== 'count_only'
    const items =
      showNames ?
        visibleGoingRows.map((r) => ({
          userId: r.userId,
          username: r.username,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
        }))
      : []

    return reply.send({
      goingCount,
      maybeCount: Number(maybeCountRow[0]?.n ?? 0),
      waitlistCount: Number(waitCountRow[0]?.n ?? 0),
      attendeeListVisibility: ev.attendeeListVisibility,
      items,
    })
  })

  app.get('/api/v1/events/:eventId/rsvps', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    const [ev] = await db
      .select({
        id: schema.events.id,
        hostId: schema.events.hostId,
        organizationId: schema.events.organizationId,
      })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (!(await viewerCanPatchEvent(user.userId, ev))) {
      return reply.status(403).send({ error: 'Host or org moderator only' })
    }
    const rows = await db
      .select({
        userId: schema.eventRsvps.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        status: schema.eventRsvps.status,
        rsvpApprovalStatus: schema.eventRsvps.rsvpApprovalStatus,
        screeningAnswer: schema.eventRsvps.screeningAnswer,
        createdAt: schema.eventRsvps.createdAt,
      })
      .from(schema.eventRsvps)
      .innerJoin(schema.users, eq(schema.users.id, schema.eventRsvps.userId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.eventRsvps.userId))
      .where(eq(schema.eventRsvps.eventId, eventId))
      .orderBy(asc(schema.eventRsvps.createdAt))
      .limit(500)
    return reply.send({ items: rows })
  })

  const rsvpApprovalPatchBody = z.object({
    userId: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
  })
  app.patch('/api/v1/events/:eventId/rsvp-approval', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    const parsed = rsvpApprovalPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (!(await viewerCanPatchEvent(user.userId, ev))) {
      return reply.status(403).send({ error: 'Host or org moderator only' })
    }
    const targetId = parsed.data.userId
    const [rsvp] = await db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, targetId)))
      .limit(1)
    if (!rsvp || rsvp.status !== 'going' || rsvp.rsvpApprovalStatus !== 'pending') {
      return reply.status(400).send({ error: 'No pending approval for this user' })
    }
    if (parsed.data.decision === 'reject') {
      await db
        .delete(schema.eventRsvps)
        .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, targetId)))
      await promoteNextWaitlist(eventId)
    } else {
      const n = await countCommittedGoing(eventId)
      if (ev.capacityMax != null && ev.capacityMax > 0 && n >= ev.capacityMax) {
        return reply
          .status(400)
          .send({ error: 'Event is at capacity; free a spot or reject another guest before approving' })
      }
      await db
        .update(schema.eventRsvps)
        .set({ rsvpApprovalStatus: 'approved', updatedAt: new Date() })
        .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, targetId)))
    }
    await refreshEventRsvpCount(eventId)
    return reply.send({ ok: true })
  })

  app.get('/api/v1/events/me/rsvps', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select({
        eventId: schema.events.id,
        title: schema.events.title,
        startsAt: schema.events.startsAt,
        status: schema.eventRsvps.status,
        rsvpApprovalStatus: schema.eventRsvps.rsvpApprovalStatus,
      })
      .from(schema.eventRsvps)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventRsvps.eventId))
      .where(
        and(
          eq(schema.eventRsvps.userId, user.userId),
          inArray(schema.eventRsvps.status, ['going', 'maybe', 'waitlist'])
        )
      )
      .orderBy(asc(schema.events.startsAt))
      .limit(50)
    return reply.send({ items: rows })
  })

  /** `?source=co_attendance` | `?source=nearby` (same U.S. state as viewer; respects regional discoverability). */
  app.get('/api/v1/connections/suggested', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!viewerId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const q = req.query as { source?: string; limit?: string }
    const limit = Math.min(30, Math.max(1, parseInt(String(q.limit ?? '12'), 10) || 12))
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const friendIds = await loadAcceptedFriendUserIds(viewerId)
    const blockedActorIds = new Set([
      ...(await loadBlockedUserIds(viewerId)),
      ...(await loadUserIdsWhoBlockedUser(viewerId)),
    ])

    if (q.source === 'nearby') {
      const [vp] = await db
        .select({ stateId: schema.profiles.stateId })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, viewerId))
        .limit(1)
      if (!vp?.stateId) {
        return reply.send({ items: [] })
      }
      const candidates = await db
        .select({
          userId: schema.users.id,
          username: schema.users.username,
          displayName: schema.profiles.displayName,
          bio: schema.profiles.bio,
          verified: schema.profiles.verified,
          location: schema.profiles.location,
          age: schema.profiles.age,
          avatarUrl: schema.profiles.avatarUrl,
          lastActiveAt: schema.profiles.updatedAt,
          fieldVisibility: schema.profiles.fieldVisibility,
          discoverableInPeopleSearch: schema.profiles.discoverableInPeopleSearch,
          privacySettings: schema.userSettings.privacySettings,
        })
        .from(schema.users)
        .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
        .leftJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
        .where(
          and(
            eq(schema.profiles.stateId, vp.stateId),
            ne(schema.users.id, viewerId),
            gt(schema.profiles.updatedAt, oneYearAgo),
            or(eq(schema.profiles.visibility, 'PUBLIC'), eq(schema.profiles.visibility, 'MEMBERS'))
          )
        )
        .orderBy(desc(schema.profiles.updatedAt))
        .limit(Math.min(80, limit * 4))
      const filtered = filterBlockedUserIds(
        blockedActorIds,
        candidates
          .filter((c) => c.discoverableInPeopleSearch)
          .filter((c) => passesLocationDiscoveryFilter(c, viewerId, friendIds))
          .filter((c) => normalizePrivacySettings(c.privacySettings ?? {}).appearInRegionalPeopleSuggestions)
          .filter(
            (c) =>
              normalizePrivacySettings(c.privacySettings ?? {}).feedActivityPrivacy.showInConnectionSuggestions,
          ),
      )
        .slice(0, limit)
        .map(({ privacySettings: _p, fieldVisibility: _fv, ...rest }) =>
          redactListProfileIdentityFields(rest, viewerId, friendIds),
        )
      return reply.send({ items: filtered })
    }

    if (q.source !== 'co_attendance') {
      return reply.status(400).send({ error: 'Use ?source=co_attendance or ?source=nearby' })
    }

    const myEvents = await db
      .select({ eventId: schema.eventRsvps.eventId })
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.userId, viewerId), eq(schema.eventRsvps.status, 'going')))
    const eventIds = [...new Set(myEvents.map((r) => r.eventId))]
    if (eventIds.length === 0) {
      return reply.send({ items: [] })
    }

    const others = await db
      .select({
        userId: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        bio: schema.profiles.bio,
        verified: schema.profiles.verified,
        location: schema.profiles.location,
        age: schema.profiles.age,
        avatarUrl: schema.profiles.avatarUrl,
        lastActiveAt: schema.profiles.updatedAt,
        fieldVisibility: schema.profiles.fieldVisibility,
        discoverableInPeopleSearch: schema.profiles.discoverableInPeopleSearch,
        privacySettings: schema.userSettings.privacySettings,
        sharedCount: count(),
      })
      .from(schema.eventRsvps)
      .innerJoin(schema.users, eq(schema.eventRsvps.userId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .leftJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
      .where(
        and(
          inArray(schema.eventRsvps.eventId, eventIds),
          eq(schema.eventRsvps.status, 'going'),
          gt(schema.profiles.updatedAt, oneYearAgo),
          or(eq(schema.profiles.visibility, 'PUBLIC'), eq(schema.profiles.visibility, 'MEMBERS'))
        )
      )
      .groupBy(
        schema.users.id,
        schema.users.username,
        schema.profiles.displayName,
        schema.profiles.bio,
        schema.profiles.verified,
        schema.profiles.location,
        schema.profiles.age,
        schema.profiles.avatarUrl,
        schema.profiles.updatedAt,
        schema.profiles.fieldVisibility,
        schema.profiles.discoverableInPeopleSearch,
        schema.userSettings.privacySettings,
      )
      .orderBy(desc(count()))
      .limit(limit + 5)

    const filtered = filterBlockedUserIds(
      blockedActorIds,
      others
        .filter((o) => o.userId !== viewerId)
        .filter((o) => o.discoverableInPeopleSearch)
        .filter(
          (o) => normalizePrivacySettings(o.privacySettings ?? {}).feedActivityPrivacy.showInConnectionSuggestions,
        ),
    )
      .slice(0, limit)
      .map(({ privacySettings: _p, fieldVisibility: _fv, discoverableInPeopleSearch: _d, ...rest }) =>
        redactListProfileIdentityFields(rest, viewerId, friendIds),
      )
    return reply.send({ items: filtered })
  })

  const recordingPolicyValues = z.enum(['not_recorded', 'live_only', 'shared_with_registrants', 'tbd'])

  const optionalEventCategoryBody = z.string().optional()
  const nullableEventCategoryBody = z.string().optional().nullable()

  function resolveEventCategoryInput(
    raw: string | null | undefined,
    reply: FastifyReply
  ): EventCategory | null | undefined | false {
    if (raw === undefined) return undefined
    if (raw === null) return null
    const trimmed = raw.trim()
    if (!trimmed) return null
    const normalized = normalizeEventCategory(trimmed)
    if (!normalized) {
      reply.status(400).send({ error: 'Invalid event category' })
      return false
    }
    return normalized
  }

  const eventBody = z.object({
    title: z.string().min(1),
    startsAt: z.string(),
    description: z.string().optional(),
    location: z.string().optional(),
    endsAt: z.string().optional(),
    category: optionalEventCategoryBody,
    tags: z.array(z.string()).optional(),
    imageUrl: z.string().optional(),
    eventFormat: z.enum(['in-person', 'virtual']).optional(),
    groupId: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
    ticketPurchaseUrl: z.string().url().optional(),
    ticketingProvider: z.string().max(64).optional(),
    ticketEmbedUrl: z.string().url().optional(),
    dressCode: z.string().max(2000).optional(),
    expectedCostText: z.string().max(256).optional(),
    virtualSessionStyle: z.enum(['social', 'education', 'mixed']).optional(),
    virtualAgenda: z.string().max(20000).optional(),
    materialsUrl: z.union([z.string().url(), z.literal('')]).optional(),
    recordingPolicy: recordingPolicyValues.optional(),
    eventTimezone: z.string().max(64).optional(),
    locationVisibility: z.enum(['public', 'rsvp', 'approved']).optional(),
    publicLocationSummary: z.string().max(512).optional(),
    screeningQuestion: z.string().max(2000).optional(),
    newcomerFriendly: z.boolean().optional(),
    accessibilityNotes: z.string().max(5000).optional(),
    capacityMax: z.number().int().min(1).max(50000).optional().nullable(),
    attendeeListVisibility: z.enum(['public', 'count_only']).optional(),
  })
  app.post('/api/v1/events', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = eventBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolvedCategory = resolveEventCategoryInput(parsed.data.category, reply)
    if (resolvedCategory === false) return
    if (parsed.data.ticketEmbedUrl && !isAllowedTicketEmbedUrl(parsed.data.ticketEmbedUrl)) {
      return reply.status(400).send({
        error:
          'ticketEmbedUrl hostname not allowlisted (set C2K_EMBED_ALLOWLIST_HOSTS or use Eventbrite/Universe https widget URL)',
      })
    }
    if (parsed.data.organizationId) {
      const [mem] = await db
        .select({ role: schema.organizationMembers.role })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, parsed.data.organizationId),
            eq(schema.organizationMembers.userId, user.userId)
          )
        )
        .limit(1)
      const rank = mem ? ORG_EVENT_ROLE_RANK[mem.role] ?? 0 : 0
      if (rank < ORG_EVENT_ROLE_RANK.MODERATOR) {
        return reply.status(403).send({ error: 'Moderator role required to post org calendar events' })
      }
      const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, parsed.data.organizationId))
        .limit(1)
      if (!org || !parseOrgFeatureFlags(org.featureFlags).calendarEnabled) {
        return reply.status(400).send({ error: 'Organization calendar is disabled' })
      }
    }

    let organizationId = parsed.data.organizationId
    if (parsed.data.groupId) {
      const [g] = await db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.id, parsed.data.groupId))
        .limit(1)
      if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Group not found' })
      const membership = await getGroupMembership(parsed.data.groupId, user.userId)
      const role = resolveGroupManagerRole(g, membership, user.userId)
      if (!canManageGroupEvents(role)) {
        return reply.status(403).send({ error: 'Group moderator access required to post group events' })
      }
      if (g.organizationId) {
        if (organizationId && organizationId !== g.organizationId) {
          return reply.status(400).send({ error: 'organizationId does not match this group' })
        }
        organizationId = g.organizationId
        const [mem] = await db
          .select({ role: schema.organizationMembers.role })
          .from(schema.organizationMembers)
          .where(
            and(
              eq(schema.organizationMembers.organizationId, organizationId),
              eq(schema.organizationMembers.userId, user.userId),
            ),
          )
          .limit(1)
        const rank = mem ? ORG_EVENT_ROLE_RANK[mem.role] ?? 0 : 0
        if (rank < ORG_EVENT_ROLE_RANK.MODERATOR) {
          return reply.status(403).send({ error: 'Moderator role required to post org calendar events' })
        }
        const [org] = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, organizationId))
          .limit(1)
        if (!org || !parseOrgFeatureFlags(org.featureFlags).calendarEnabled) {
          return reply.status(400).send({ error: 'Organization calendar is disabled' })
        }
      }
    }

    const fmt = parsed.data.eventFormat ?? 'in-person'
    const matUrl =
      parsed.data.materialsUrl === '' ? undefined : parsed.data.materialsUrl
    const virtualFields =
      fmt === 'virtual' ?
        {
          virtualSessionStyle: (parsed.data.virtualSessionStyle ?? 'social') as
            | 'social'
            | 'education'
            | 'mixed',
          virtualAgenda: parsed.data.virtualAgenda,
          materialsUrl: matUrl,
          recordingPolicy: parsed.data.recordingPolicy,
          eventTimezone: parsed.data.eventTimezone,
        }
      : {
          virtualSessionStyle: null,
          virtualAgenda: null,
          materialsUrl: null,
          recordingPolicy: null,
          eventTimezone: null,
        }
    const [e] = await db
      .insert(schema.events)
      .values({
        hostId: user.userId,
        title: parsed.data.title,
        startsAt: new Date(parsed.data.startsAt),
        description: parsed.data.description,
        location: parsed.data.location,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
        category: resolvedCategory ?? undefined,
        tags: parsed.data.tags,
        imageUrl: parsed.data.imageUrl,
        eventFormat: fmt,
        groupId: parsed.data.groupId,
        organizationId: organizationId,
        ticketPurchaseUrl: parsed.data.ticketPurchaseUrl,
        ticketingProvider: parsed.data.ticketingProvider,
        ticketEmbedUrl: parsed.data.ticketEmbedUrl,
        dressCode: parsed.data.dressCode,
        expectedCostText: parsed.data.expectedCostText,
        locationVisibility: parsed.data.locationVisibility ?? 'public',
        publicLocationSummary: parsed.data.publicLocationSummary ?? null,
        screeningQuestion: parsed.data.screeningQuestion ?? null,
        newcomerFriendly: parsed.data.newcomerFriendly ?? false,
        accessibilityNotes: parsed.data.accessibilityNotes ?? null,
        capacityMax: parsed.data.capacityMax ?? null,
        attendeeListVisibility: parsed.data.attendeeListVisibility ?? 'public',
        ...virtualFields,
      })
      .returning()
    if (e) {
      emitActivity({
        actorId: user.userId,
        verb: 'event_created',
        objectType: 'event',
        objectId: e.id,
        metadata: {
          title: e.title,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt?.toISOString() ?? null,
          location: e.location,
          publicLocationSummary: e.publicLocationSummary,
          imageUrl: e.imageUrl,
          eventFormat: e.eventFormat,
        },
      })
    }
    return reply.send({ event: e })
  })

  const patchEventBody = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    location: z.string().max(512).optional().nullable(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional().nullable(),
    category: nullableEventCategoryBody,
    tags: z.array(z.string()).optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    eventFormat: z.enum(['in-person', 'virtual']).optional(),
    dressCode: z.string().max(2000).optional().nullable(),
    expectedCostText: z.string().max(256).optional().nullable(),
    virtualSessionStyle: z.enum(['social', 'education', 'mixed']).optional().nullable(),
    virtualAgenda: z.string().max(20000).optional().nullable(),
    materialsUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
    recordingPolicy: recordingPolicyValues.optional().nullable(),
    eventTimezone: z.string().max(64).optional().nullable(),
    ticketPurchaseUrl: z.string().url().optional().nullable(),
    ticketingProvider: z.string().max(64).optional().nullable(),
    ticketEmbedUrl: z.string().url().optional().nullable(),
    priceCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
    locationVisibility: z.enum(['public', 'rsvp', 'approved']).optional(),
    publicLocationSummary: z.string().max(512).optional().nullable(),
    screeningQuestion: z.string().max(2000).optional().nullable(),
    newcomerFriendly: z.boolean().optional(),
    accessibilityNotes: z.string().max(5000).optional().nullable(),
    capacityMax: z.number().int().min(1).max(50000).optional().nullable(),
    attendeeListVisibility: z.enum(['public', 'count_only']).optional(),
    featured: z.boolean().optional(),
    featuredUntil: z.string().datetime().optional().nullable(),
    rsvpOpen: z.boolean().optional(),
    venuePlaceId: z.string().uuid().nullable().optional(),
  })

  app.patch('/api/v1/events/:eventId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    const parsed = patchEventBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const resolvedCategory = resolveEventCategoryInput(parsed.data.category, reply)
    if (resolvedCategory === false) return
    if (parsed.data.ticketEmbedUrl && !isAllowedTicketEmbedUrl(parsed.data.ticketEmbedUrl)) {
      return reply.status(400).send({
        error:
          'ticketEmbedUrl hostname not allowlisted (set C2K_EMBED_ALLOWLIST_HOSTS or use Eventbrite/Universe https widget URL)',
      })
    }
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (!(await viewerCanPatchEvent(user.userId, ev))) {
      return reply.status(403).send({ error: 'Only the host or an org moderator can update this event' })
    }
    const p = parsed.data
    const nextFormat = p.eventFormat ?? ev.eventFormat
    const clearVirtual = nextFormat === 'in-person'
    const patch: Record<string, unknown> = {}
    if (p.title !== undefined) patch.title = p.title
    if (p.description !== undefined) patch.description = p.description
    if (p.location !== undefined) patch.location = p.location
    if (p.startsAt !== undefined) patch.startsAt = new Date(p.startsAt)
    if (p.endsAt !== undefined) patch.endsAt = p.endsAt ? new Date(p.endsAt) : null
    if (p.category !== undefined) patch.category = resolvedCategory
    if (p.tags !== undefined) patch.tags = p.tags
    if (p.imageUrl !== undefined) patch.imageUrl = p.imageUrl
    if (p.eventFormat !== undefined) patch.eventFormat = p.eventFormat
    if (p.dressCode !== undefined) patch.dressCode = p.dressCode
    if (p.expectedCostText !== undefined) patch.expectedCostText = p.expectedCostText
    if (p.ticketPurchaseUrl !== undefined) patch.ticketPurchaseUrl = p.ticketPurchaseUrl
    if (p.ticketingProvider !== undefined) patch.ticketingProvider = p.ticketingProvider
    if (p.ticketEmbedUrl !== undefined) patch.ticketEmbedUrl = p.ticketEmbedUrl
    if (p.priceCents !== undefined) patch.priceCents = p.priceCents
    if (p.locationVisibility !== undefined) patch.locationVisibility = p.locationVisibility
    if (p.publicLocationSummary !== undefined) patch.publicLocationSummary = p.publicLocationSummary
    if (p.screeningQuestion !== undefined) patch.screeningQuestion = p.screeningQuestion
    if (p.newcomerFriendly !== undefined) patch.newcomerFriendly = p.newcomerFriendly
    if (p.accessibilityNotes !== undefined) patch.accessibilityNotes = p.accessibilityNotes
    if (p.capacityMax !== undefined) patch.capacityMax = p.capacityMax
    if (p.attendeeListVisibility !== undefined) patch.attendeeListVisibility = p.attendeeListVisibility
    if (p.featured !== undefined) patch.featured = p.featured
    if (p.featuredUntil !== undefined) {
      patch.featuredUntil = p.featuredUntil ? new Date(p.featuredUntil) : null
    }
    if (p.rsvpOpen !== undefined) patch.rsvpOpen = p.rsvpOpen
    if (p.venuePlaceId !== undefined) patch.venuePlaceId = p.venuePlaceId
    if (clearVirtual) {
      patch.virtualSessionStyle = null
      patch.virtualAgenda = null
      patch.materialsUrl = null
      patch.recordingPolicy = null
      patch.eventTimezone = null
    } else {
      if (p.virtualSessionStyle !== undefined) patch.virtualSessionStyle = p.virtualSessionStyle
      if (p.virtualAgenda !== undefined) patch.virtualAgenda = p.virtualAgenda
      if (p.materialsUrl !== undefined) {
        patch.materialsUrl = p.materialsUrl === '' || p.materialsUrl === null ? null : p.materialsUrl
      }
      if (p.recordingPolicy !== undefined) patch.recordingPolicy = p.recordingPolicy
      if (p.eventTimezone !== undefined) patch.eventTimezone = p.eventTimezone
    }
    if (Object.keys(patch).length === 0) {
      return reply.send({ event: ev })
    }
    const [updated] = await db
      .update(schema.events)
      .set(patch as Record<string, unknown>)
      .where(eq(schema.events.id, eventId))
      .returning()
    return reply.send({
      event: {
        ...updated,
        featuredUntil: updated.featuredUntil?.toISOString?.() ?? updated.featuredUntil ?? null,
        isFeatured: isEventFeatured(updated),
      },
    })
  })

  const eventCoverAttachBody = z.object({
    quarantineKey: z.string().min(1).max(2048),
  })

  app.post('/api/v1/events/:eventId/cover/attach', async (req, reply) => {
    if (!requireDb(reply)) return
    if (isAlphaUploadDisabled('event_cover')) {
      return alphaUploadDisabledResponse(reply, 'event_cover')
    }
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev) return reply.status(404).send({ error: 'Not found' })
    if (!(await viewerCanPatchEvent(user.userId, ev))) {
      return reply.status(403).send({ error: 'Only the host or an org moderator can update this event' })
    }
    const parsed = eventCoverAttachBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    let publicUrl: string
    try {
      publicUrl = await promoteQuarantineToScopeBrandingUrl({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        scopePath: `events/${eventId}`,
        assetName: 'cover',
      })
    } catch (err) {
      if (err instanceof MediaUploadValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      const e = err as { message?: string }
      req.log?.error({ err }, 'event cover attach failed')
      return reply.status(502).send({ error: e.message ?? 'Could not attach event cover' })
    }
    const [updated] = await db
      .update(schema.events)
      .set({ imageUrl: publicUrl })
      .where(eq(schema.events.id, eventId))
      .returning()
    return reply.send({
      url: publicUrl,
      event: {
        ...updated,
        imageUrl: deliverCardImageUrl(updated.imageUrl),
        featuredUntil: updated.featuredUntil?.toISOString?.() ?? updated.featuredUntil ?? null,
        isFeatured: isEventFeatured(updated),
      },
    })
  })

  /* --- E5: Vendors --- */
  app.get('/api/v1/vendors', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const qParams = req.query as {
      q?: string
      category?: string
      tag?: string
      shipsTo?: string
      minRating?: string
      limit?: string
    }
    const q = String(qParams.q ?? '')
      .trim()
      .toLowerCase()
    const limit = Math.min(50, Math.max(1, parseInt(String(qParams.limit ?? '100'), 10) || 100))
    const categoryNorm = qParams.category ? normalizeVendorCategory(qParams.category) : null
    const tagNorm = qParams.tag?.trim().toLowerCase().replace(/\s+/g, '-')
    const shipsToFilter =
      qParams.shipsTo === 'US' || qParams.shipsTo === 'Canada' || qParams.shipsTo === 'International' ?
        qParams.shipsTo
      : null
    const minRating = parseFloat(String(qParams.minRating ?? ''))
    const minRatingFilter = Number.isFinite(minRating) && minRating > 0 ? minRating : null

    const conditions = []
    if (categoryNorm) conditions.push(eq(schema.vendorProfiles.category, categoryNorm))
    if (shipsToFilter) conditions.push(eq(schema.vendorProfiles.shipsTo, shipsToFilter))
    if (minRatingFilter != null) conditions.push(gte(schema.vendorProfiles.rating, minRatingFilter))
    if (q.length >= 2) {
      const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`
      conditions.push(
        or(
          ilike(schema.vendorProfiles.displayName, pattern),
          ilike(schema.vendorProfiles.slug, pattern),
        )!,
      )
    }

    const rows = await db
      .select()
      .from(schema.vendorProfiles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(q.length >= 2 ? Math.min(20, limit) : limit)

    let filtered = filterVendorVisibility(rows, viewerId)
    if (tagNorm) {
      filtered = filtered.filter((row) =>
        (row.tags ?? []).some((t) => t.toLowerCase() === tagNorm),
      )
    }

    const verifiedCounts = await loadVendorVerifiedFeedbackCounts(filtered.map((row) => row.id))
    const items = await withAlphaLabels(
      'vendor_profile',
      filtered.map((row) => ({
        ...toPublicVendorListItem(row),
        verifiedFeedbackCount: verifiedCounts.get(row.id) ?? 0,
      })),
    )
    return reply.send({ items })
  })

  app.get('/api/v1/vendors/spotlight-listings', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const n = Math.min(20, Math.max(1, parseInt(String((req.query as { n?: string }).n ?? '8'), 10) || 8))
    const allVendors = await db
      .select({
        id: schema.vendorProfiles.id,
        slug: schema.vendorProfiles.slug,
        displayName: schema.vendorProfiles.displayName,
        logoUrl: schema.vendorProfiles.logoUrl,
        visibility: schema.vendorProfiles.visibility,
      })
      .from(schema.vendorProfiles)
      .limit(80)
    const vendors = filterVendorVisibility(allVendors, viewerId)
    const out: Array<{
      vendorId: string
      vendorSlug: string
      shopName: string
      logoUrl: string | null
      listingTitle: string
      primaryImageUrl: string | null
      listingPriceCents?: number
      listingCurrency?: string
    }> = []
    for (const v of vendors) {
      const [p] = await db
        .select({
          title: schema.products.title,
          primaryImageUrl: schema.products.primaryImageUrl,
          priceCents: schema.products.priceCents,
        })
        .from(schema.products)
        .where(eq(schema.products.vendorId, v.id))
        .limit(1)
      const [ex] = await db
        .select({
          title: schema.vendorExternalListings.title,
          primaryImageUrl: schema.vendorExternalListings.primaryImageUrl,
          priceCents: schema.vendorExternalListings.priceCents,
          currency: schema.vendorExternalListings.currency,
        })
        .from(schema.vendorExternalListings)
        .where(eq(schema.vendorExternalListings.vendorId, v.id))
        .limit(1)
      const listingTitle = p?.title ?? ex?.title
      if (!listingTitle) continue
      out.push({
        vendorId: v.id,
        vendorSlug: v.slug,
        shopName: v.displayName,
        logoUrl: deliverBrandingLogoUrl(v.logoUrl),
        listingTitle,
        primaryImageUrl: deliverCardImageUrl(p?.primaryImageUrl ?? ex?.primaryImageUrl ?? null),
        listingPriceCents: p?.priceCents ?? ex?.priceCents,
        listingCurrency: ex?.currency ?? (p?.priceCents != null ? 'USD' : undefined),
      })
      if (out.length >= n) break
    }
    return reply.send({ items: out })
  })

  app.get('/api/v1/vendors/in-person-upcoming', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const now = new Date()
    const rows = await db
      .select({
        vendorId: schema.vendorProfiles.id,
        slug: schema.vendorProfiles.slug,
        displayName: schema.vendorProfiles.displayName,
        logoUrl: schema.vendorProfiles.logoUrl,
        visibility: schema.vendorProfiles.visibility,
        eventId: schema.events.id,
        eventTitle: schema.events.title,
        startsAt: schema.events.startsAt,
      })
      .from(schema.eventContributors)
      .innerJoin(schema.events, eq(schema.eventContributors.eventId, schema.events.id))
      .innerJoin(schema.vendorProfiles, eq(schema.eventContributors.vendorProfileId, schema.vendorProfiles.id))
      .where(and(eq(schema.eventContributors.kind, 'vendor'), gt(schema.events.startsAt, now)))
      .orderBy(asc(schema.events.startsAt))
      .limit(24)
    return reply.send({ items: filterVendorVisibility(rows, viewerId) })
  })

  const createVendorBody = z.object({
    displayName: z.string().min(1).max(255),
    slug: z.string().min(2).max(128).optional(),
    bio: z.string().max(10000).optional(),
    makerStory: z.string().max(8000).optional(),
    website: zVendorWebsiteOptional,
    shipsTo: z.enum(['US', 'Canada', 'International']).optional(),
    category: zVendorCategoryOptional,
    tags: zVendorTagsRequired,
    categories: zVendorCategoriesOptional,
  })

  const vendorProfileBody = z.object({
    displayName: z.string().min(1).max(255),
    bio: z.string().max(10000).optional().nullable(),
    makerStory: z.string().max(8000).optional().nullable(),
    shopPolicies: vendorShopPoliciesSchema.optional().nullable(),
    website: zVendorWebsiteNullable,
    shipsTo: z.enum(['US', 'Canada', 'International']).optional(),
    category: zVendorCategoryOptional,
    tags: zVendorTagsOptional,
    categories: zVendorCategoriesOptional,
    bannerUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
    logoUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
    shopHeaderLayout: z.enum(['OVERLAY', 'BELOW']).optional(),
    visibility: z.enum(['PUBLIC', 'MEMBERS', 'HIDDEN']).optional(),
    commissionStatus: z.enum(['OPEN', 'LIMITED', 'CLOSED']).optional(),
    commissionNotes: z.string().max(4000).optional().nullable(),
    eckePublish: z.boolean().optional(),
  })

  async function loadVendorUpcoming(vendorProfileId: string) {
    const now = new Date()
    return db
      .select({
        eventId: schema.events.id,
        eventTitle: schema.events.title,
        startsAt: schema.events.startsAt,
        conventionId: schema.conventions.id,
        conventionSlug: schema.conventions.slug,
      })
      .from(schema.eventContributors)
      .innerJoin(schema.events, eq(schema.eventContributors.eventId, schema.events.id))
      .leftJoin(schema.conventions, eq(schema.conventions.anchorEventId, schema.events.id))
      .where(
        and(
          eq(schema.eventContributors.kind, 'vendor'),
          eq(schema.eventContributors.vendorProfileId, vendorProfileId),
          gte(schema.events.startsAt, now),
        ),
      )
      .orderBy(asc(schema.events.startsAt))
      .limit(12)
  }

  async function loadVendorHistory(vendorProfileId: string) {
    return db
      .select({
        eventId: schema.events.id,
        eventTitle: schema.events.title,
        startsAt: schema.events.startsAt,
      })
      .from(schema.eventContributors)
      .innerJoin(schema.events, eq(schema.eventContributors.eventId, schema.events.id))
      .where(and(eq(schema.eventContributors.kind, 'vendor'), eq(schema.eventContributors.vendorProfileId, vendorProfileId)))
      .orderBy(desc(schema.events.startsAt))
      .limit(20)
  }

  async function loadVendorFeedbackSummary(vendorProfileId: string, rating: number) {
    const verifiedCounts = await loadVendorVerifiedFeedbackCounts([vendorProfileId])
    const verifiedFeedbackCount = verifiedCounts.get(vendorProfileId) ?? 0
    return buildVendorFeedbackSummary(rating, verifiedFeedbackCount)
  }

  app.get('/api/v1/vendors/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Valid session required' })
    }
    const [row] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, userId))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'No vendor shop' })
    const coOwners = await loadVendorCoOwners(row.id)
    return reply.send({
      vendor: row,
      coOwners,
      isOwner: true,
      isRunner: false,
      canManageShop: true,
    })
  })

  app.get('/api/v1/vendors/managed', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })
    const shops = await listManagedVendorShops(userId)
    return reply.send({
      shops: shops.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        slug: s.slug,
        visibility: s.visibility,
        role: s.role,
        isOwner: s.isOwner,
        isRunner: s.isRunner,
        canManageShop: s.canManageShop,
        logoUrl: s.logoUrl,
        lastUpdated: s.lastUpdated?.toISOString() ?? null,
      })),
    })
  })

  const vendorCoOwnersBody = z.object({
    usernames: z.array(z.string().min(1).max(64)).max(5),
  })

  app.get('/api/v1/vendors/me/co-owners', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) return reply.status(401).send({ error: 'Unauthorized' })
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })
    const [row] = await db
      .select({ id: schema.vendorProfiles.id })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, userId))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'No vendor shop' })
    const coOwners = await loadVendorCoOwners(row.id)
    return reply.send({ coOwners })
  })

  app.put('/api/v1/vendors/me/co-owners', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) return reply.status(401).send({ error: 'Unauthorized' })
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })
    const parsed = vendorCoOwnersBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    const [ownedRow] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, userId))
      .limit(1)
    if (!ownedRow) {
      const [runnerLink] = await db
        .select({ id: schema.vendorCoOwners.id })
        .from(schema.vendorCoOwners)
        .where(eq(schema.vendorCoOwners.userId, userId))
        .limit(1)
      if (runnerLink) {
        return reply.status(403).send({ error: 'Only the primary owner can manage shop runners' })
      }
      return reply.status(404).send({ error: 'No vendor shop' })
    }
    const ownerGate = await requireVendorOwner(ownedRow.id, userId)
    if (!ownerGate.ok) {
      return reply.status(403).send({ error: 'Only the primary owner can manage shop runners' })
    }
    const row = ownerGate.vendor
    const previousRunnerIds = new Set(await loadVendorCoOwnerUserIds(row.id))
    const normalized = [...new Set(parsed.data.usernames.map((u) => u.trim().toLowerCase()).filter(Boolean))]
    if (normalized.length === 0) {
      await replaceVendorCoOwners(row.id, row.userId, [])
      return reply.send({ coOwners: [] })
    }
    const users = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(
        or(...normalized.map((u) => sql`lower(${schema.users.username}) = ${u}`)),
      )
    const found = new Set(users.map((u) => u.username.toLowerCase()))
    const missing = normalized.filter((u) => !found.has(u))
    if (missing.length > 0) {
      return reply.status(400).send({ error: `Unknown usernames: ${missing.join(', ')}` })
    }
    const nextRunnerIds = users.filter((u) => u.id !== row.userId).map((u) => u.id)
    await replaceVendorCoOwners(row.id, row.userId, nextRunnerIds)
    const coOwners = await loadVendorCoOwners(row.id)
    const shopName = row.displayName?.trim() || row.slug
    for (const runnerId of nextRunnerIds) {
      if (!previousRunnerIds.has(runnerId)) {
        await createNotification(runnerId, NOTIFICATION_TYPES.vendorRunnerAdded, {
          vendorProfileId: row.id,
          vendorSlug: row.slug,
          shopName,
          href: `/vendors/${encodeURIComponent(row.slug)}`,
        })
      }
    }
    return reply.send({ coOwners })
  })

  app.get('/api/v1/me/vendor-profile', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) return reply.status(401).send({ error: 'Unauthorized' })
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })
    const [row] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, userId))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'No vendor shop' })
    const history = await loadVendorHistory(row.id)
    const upcoming = await loadVendorUpcoming(row.id)
    return reply.send({ vendor: row, history, upcoming })
  })

  const patchVendorMeBody = z.object({
    displayName: z.string().min(1).max(255).optional(),
    bio: z.string().max(10000).optional(),
    website: zVendorWebsiteOptional,
    shipsTo: z.enum(['US', 'Canada', 'International']).optional(),
    category: zVendorCategoryOptional,
    tags: zVendorTagsRequired,
    categories: zVendorCategoriesOptional,
    bannerUrl: z.union([z.string().url(), z.literal('')]).optional(),
    logoUrl: z.union([z.string().url(), z.literal('')]).optional(),
    shopHeaderLayout: z.enum(['OVERLAY', 'BELOW']).optional(),
  })

  async function applyPatchVendorMe(
    row: typeof schema.vendorProfiles.$inferSelect,
    d: z.infer<typeof patchVendorMeBody>,
  ) {
    const next: Partial<typeof schema.vendorProfiles.$inferInsert> = {}
    if (d.displayName !== undefined) next.displayName = d.displayName.trim()
    if (d.bio !== undefined) next.bio = d.bio.trim() || null
    if (d.website !== undefined) next.website = d.website && d.website.length > 0 ? d.website : null
    if (d.shipsTo !== undefined) next.shipsTo = d.shipsTo
    if (d.category !== undefined || d.tags !== undefined || d.categories !== undefined) {
      Object.assign(
        next,
        vendorProfileWriteFields({
          category: d.category ?? row.category,
          tags: d.tags ?? row.tags ?? [],
          categories: d.categories ?? row.categories,
        }),
      )
    }
    if (d.bannerUrl !== undefined) next.bannerUrl = d.bannerUrl.length > 0 ? d.bannerUrl : null
    if (d.logoUrl !== undefined) next.logoUrl = d.logoUrl.length > 0 ? d.logoUrl : null
    if (d.shopHeaderLayout !== undefined) next.shopHeaderLayout = d.shopHeaderLayout
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set(next)
      .where(eq(schema.vendorProfiles.id, row.id))
      .returning()
    return updated
  }

  app.patch('/api/v1/vendors/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Valid session required' })
    }
    const parsed = patchVendorMeBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    const vendorIdHint = (req.query as { vendorId?: string }).vendorId?.trim()
    const gate = await resolveManagedVendorForMeRoutes(userId, vendorIdHint)
    if (!gate.ok) return reply.status(gate.status).send({ error: gate.error })
    const updated = await applyPatchVendorMe(gate.vendor, parsed.data)
    if (!updated) return reply.status(500).send({ error: 'Update failed' })
    return reply.send({ vendor: updated })
  })

  app.patch('/api/v1/vendors/:vendorId', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })
    const { vendorId } = req.params as { vendorId: string }
    const parsed = patchVendorMeBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    const gate = await requireVendorShopManager(vendorId, userId)
    if (!gate.ok) {
      return reply.status(gate.status).send({ error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' })
    }
    const updated = await applyPatchVendorMe(gate.vendor, parsed.data)
    if (!updated) return reply.status(500).send({ error: 'Update failed' })
    return reply.send({ vendor: updated })
  })

  app.put('/api/v1/me/vendor-profile', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) return reply.status(401).send({ error: 'Unauthorized' })
    const userId = getViewerUserId(v.payload)
    if (!userId) return reply.status(401).send({ error: 'Valid session required' })
    const parsed = vendorProfileBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    const [row] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, userId))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'No vendor shop' })
    const d = parsed.data
    const taxonomy =
      d.category !== undefined || d.tags !== undefined || d.categories !== undefined ?
        vendorProfileWriteFields({
          category: d.category ?? row.category,
          tags: d.tags ?? row.tags ?? [],
          categories: d.categories ?? row.categories,
        })
      : {}
    const [updated] = await db
      .update(schema.vendorProfiles)
      .set({
        displayName: d.displayName.trim(),
        bio: d.bio === undefined ? row.bio : (d.bio?.trim() || null),
        makerStory: d.makerStory === undefined ? row.makerStory : (d.makerStory?.trim() || null),
        shopPolicies: d.shopPolicies === undefined ? row.shopPolicies : d.shopPolicies,
        website: d.website === undefined ? row.website : (d.website ? d.website : null),
        shipsTo: d.shipsTo ?? row.shipsTo,
        categories: taxonomy.categories ?? row.categories,
        category: taxonomy.category !== undefined ? taxonomy.category : row.category,
        tags: taxonomy.tags !== undefined ? taxonomy.tags : row.tags,
        bannerUrl: d.bannerUrl === undefined ? row.bannerUrl : (d.bannerUrl ? d.bannerUrl : null),
        logoUrl: d.logoUrl === undefined ? row.logoUrl : (d.logoUrl ? d.logoUrl : null),
        shopHeaderLayout: d.shopHeaderLayout ?? row.shopHeaderLayout,
        visibility: d.visibility ?? row.visibility,
        commissionStatus: d.commissionStatus ?? row.commissionStatus,
        commissionNotes:
          d.commissionNotes === undefined ? row.commissionNotes : (d.commissionNotes?.trim() || null),
        eckePublish: d.eckePublish === undefined ? row.eckePublish : d.eckePublish,
      })
      .where(eq(schema.vendorProfiles.userId, userId))
      .returning()
    if (updated?.visibility === 'PUBLIC') {
      void emitVendorShopLiveIfEligible(updated.id)
    }
    if (updated) {
      await maybeEnqueueEckeVendorPublish(updated, userId)
    }
    return reply.send({ vendor: updated })
  })

  app.post('/api/v1/vendors', async (req, reply) => {
    if (!requireDb(reply)) return
    const v = resolveViewerFromRequest(req)
    if (!v.authenticated || !v.payload?.sub) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const userId = getViewerUserId(v.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Valid session required to create a vendor shop' })
    }
    const parsed = createVendorBody.safeParse(preprocessVendorWriteBody(req.body))
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })

    const [existing] = await db
      .select({ id: schema.vendorProfiles.id, slug: schema.vendorProfiles.slug })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, userId))
      .limit(1)
    if (existing) {
      return reply
        .status(409)
        .send({ error: 'You already have a vendor shop', vendor: { id: existing.id, slug: existing.slug } })
    }

    const baseSlug = parsed.data.slug ? slugifyVendorSlug(parsed.data.slug) : slugifyVendorSlug(parsed.data.displayName)
    if (baseSlug.length < 2) return reply.status(400).send({ error: 'Invalid slug' })
    let slug = baseSlug
    for (let i = 0; i < 50; i++) {
      const [taken] = await db
        .select({ id: schema.vendorProfiles.id })
        .from(schema.vendorProfiles)
        .where(eq(schema.vendorProfiles.slug, slug))
        .limit(1)
      if (!taken) break
      slug = `${baseSlug}-${i + 2}`
    }
    const [takenFinal] = await db
      .select({ id: schema.vendorProfiles.id })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.slug, slug))
      .limit(1)
    if (takenFinal) return reply.status(409).send({ error: 'Slug in use; try another' })

    const website =
      parsed.data.website && parsed.data.website.length > 0 ? parsed.data.website : undefined
    const shipsTo = parsed.data.shipsTo ?? 'US'
    const taxonomy = vendorProfileWriteFields({
      category: parsed.data.category,
      tags: parsed.data.tags,
      categories: parsed.data.categories,
    })

    const [created] = await db
      .insert(schema.vendorProfiles)
      .values({
        userId,
        slug,
        displayName: parsed.data.displayName.trim(),
        bio: parsed.data.bio?.trim() || undefined,
        makerStory: parsed.data.makerStory?.trim() || undefined,
        website,
        shipsTo,
        category: taxonomy.category ?? undefined,
        tags: taxonomy.tags ?? undefined,
        categories: taxonomy.categories ?? [],
      })
      .returning()
    if (!created) return reply.status(500).send({ error: 'Failed to create vendor' })
    return reply.status(201).send({ vendor: created })
  })

  app.get('/api/v1/vendors/:vendorId/listings', async (req, reply) => {
    if (!requireDb(reply)) return
    const { vendorId } = req.params as { vendorId: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const [vendor] = uuidRe.test(vendorId)
      ? await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendorId)).limit(1)
      : await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.slug, vendorId)).limit(1)
    if (!vendor) return reply.status(404).send({ error: 'Not found' })
    const access =
      viewerId != null ? await getVendorShopAccess(vendor.id, viewerId) : null
    const canManageShop = access?.canManageShop === true
    if (!vendorVisibleForDetail(vendor.visibility, viewerId, canManageShop)) {
      if ((vendor.visibility ?? 'PUBLIC') === 'MEMBERS') {
        return reply.status(403).send({ error: 'Members-only shop' })
      }
      return reply.status(404).send({ error: 'Not found' })
    }

    const externalRows = await db
      .select()
      .from(schema.vendorExternalListings)
      .where(eq(schema.vendorExternalListings.vendorId, vendor.id))
      .orderBy(asc(schema.vendorExternalListings.title))

    const nativeRows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.vendorId, vendor.id))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.title))

    const linkBase = vendor.website?.trim() || '#'
    const nativeItems = nativeRows.map((p) => ({
      id: p.id,
      provider: 'native',
      externalListingId: p.id,
      title: p.title,
      priceCents: p.priceCents,
      currency: 'USD',
      primaryImageUrl: p.primaryImageUrl ?? null,
      listingUrl: (p.listingUrl?.trim() || linkBase),
      description: p.description ?? null,
      syncedAt: (p.updatedAt ?? p.createdAt).toISOString(),
      source: 'native' as const,
    }))

    const externalItems = externalRows.map((row) => ({
      id: row.id,
      provider: row.provider,
      externalListingId: row.externalListingId,
      title: row.title,
      priceCents: row.priceCents,
      currency: row.currency,
      primaryImageUrl: row.primaryImageUrl,
      listingUrl: row.listingUrl,
      syncedAt: row.syncedAt.toISOString(),
      source: row.provider,
    }))

    const pub = vendor.externalStorePublic as { storefrontUrl?: string } | null | undefined
    const storefrontUrl =
      vendor.externalStoreType === 'link_only'
        ? (pub?.storefrontUrl ?? vendor.website)
        : vendor.etsyShopUrl ?? vendor.website

    const payRaw = (vendor.paymentProcessor ?? 'external').toLowerCase()
    const processor =
      payRaw === 'stripe' || payRaw === 'manual' || payRaw === 'external' ? payRaw : 'external'
    const stripeReady = Boolean(
      processor === 'stripe' &&
        vendor.stripeConnectAccountId &&
        vendor.stripeConnectChargesEnabled,
    )

    return reply.send({
      items: [...nativeItems, ...externalItems],
      externalStoreType: vendor.externalStoreType,
      usesEtsy: vendor.usesEtsy,
      syncedAt: (vendor.externalListingsSyncedAt ?? vendor.etsyListingsSyncedAt)?.toISOString() ?? null,
      storefrontUrl,
      etsyShopUrl: vendor.etsyShopUrl,
      payments: {
        processor,
        externalPaymentUrl: vendor.externalPaymentUrl ?? null,
        stripeReady,
      },
    })
  })

  app.get('/api/v1/vendors/:vendorId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { vendorId } = req.params as { vendorId: string }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const [row] = uuidRe.test(vendorId)
      ? await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.id, vendorId)).limit(1)
      : await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.slug, vendorId)).limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const access =
      viewerId != null ? await getVendorShopAccess(row.id, viewerId) : null
    const canManageShop = access?.canManageShop === true
    if (!vendorVisibleForDetail(row.visibility, viewerId, canManageShop)) {
      if ((row.visibility ?? 'PUBLIC') === 'MEMBERS') {
        return reply.status(403).send({ error: 'Members-only shop' })
      }
      return reply.status(404).send({ error: 'Not found' })
    }
    const canSeeHistory = await viewerCanSeeActivityHistory(row.userId, viewerId)
    const history = canSeeHistory ? await loadVendorHistory(row.id) : []
    const upcoming = canSeeHistory ? await loadVendorUpcoming(row.id) : []
    const eventCredits = canSeeHistory ? await loadVendorEventCredits(row.id) : []
    const feedbackSummary = await loadVendorFeedbackSummary(row.id, row.rating)
    const people = await loadVendorShopPeople(row.id, row.userId)
    const vendor = await withAlphaLabel(
      'vendor_profile',
      canManageShop ? toManagedVendorDetail(row) : toPublicVendorDetail(row),
    )
    return reply.send({
      vendor,
      owner: people.owner,
      coOwners: people.coOwners,
      history,
      upcoming,
      eventCredits,
      historyVisible: canSeeHistory,
      feedbackSummary,
      isOwner: access?.isOwner ?? false,
      isRunner: access?.isRunner ?? false,
      canManageShop,
    })
  })

  app.get('/api/v1/conventions/:key/vendors', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const [conv] = await db
      .select({ id: schema.conventions.id })
      .from(schema.conventions)
      .where(or(eq(schema.conventions.id, key), eq(schema.conventions.slug, key)))
      .limit(1)
    if (!conv) return reply.status(404).send({ error: 'Convention not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const rows = await db
      .select({
        vendorId: schema.vendorProfiles.id,
        slug: schema.vendorProfiles.slug,
        displayName: schema.vendorProfiles.displayName,
        visibility: schema.vendorProfiles.visibility,
        logoUrl: schema.vendorProfiles.logoUrl,
        categories: schema.vendorProfiles.categories,
        commissionStatus: schema.vendorProfiles.commissionStatus,
        eventId: schema.events.id,
        eventTitle: schema.events.title,
        startsAt: schema.events.startsAt,
      })
      .from(schema.eventContributors)
      .innerJoin(schema.events, eq(schema.eventContributors.eventId, schema.events.id))
      .innerJoin(schema.conventions, eq(schema.conventions.anchorEventId, schema.events.id))
      .innerJoin(schema.vendorProfiles, eq(schema.eventContributors.vendorProfileId, schema.vendorProfiles.id))
      .where(and(eq(schema.eventContributors.kind, 'vendor'), eq(schema.conventions.id, conv.id)))
      .orderBy(asc(schema.vendorProfiles.displayName))
    return reply.send({ items: filterVendorVisibility(rows, viewerId) })
  })

  /* --- E6: Matchmaking / geo --- */
  const geoBody = z.object({
    lat: z.number(),
    lng: z.number(),
  })
  app.patch('/api/v1/profile/me/geo', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = geoBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [prof] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.userId))
      .limit(1)
    if (!prof) return reply.status(404).send({ error: 'Profile not found' })
    const [updated] = await db
      .update(schema.profiles)
      .set({ geoJson: { type: 'Point', coordinates: [parsed.data.lng, parsed.data.lat] } })
      .where(eq(schema.profiles.id, prof.id))
      .returning()
    return reply.send({ profile: updated })
  })

  /* --- E7: Messaging --- */
  const conversationCreateBody = z
    .object({
      participantUsername: z.string().min(1).optional(),
      participantId: z.string().uuid().optional(),
      /** When `iso`, `isoSubjectUserId` must be the participant (ISO owner); validated server-side. */
      entryPoint: z.enum(['iso']).optional(),
      isoSubjectUserId: z.string().uuid().optional(),
    })
    .refine((d) => Boolean(d.participantUsername || d.participantId), { message: 'participant required' })

  app.post('/api/v1/conversations', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = conversationCreateBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    let otherId: string | undefined
    if (parsed.data.participantId) {
      otherId = parsed.data.participantId
    } else if (parsed.data.participantUsername) {
      const [u] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, parsed.data.participantUsername.trim()))
        .limit(1)
      otherId = u?.id
    }
    if (!otherId) return reply.status(404).send({ error: 'User not found' })
    if (otherId === user.userId) return reply.status(400).send({ error: 'Cannot message yourself' })
    const dmGate = await assertCanInitiateDm(user.userId, otherId)
    if (!dmGate.ok) return reply.status(dmGate.status).send({ error: dmGate.error })
    try {
      const { assertCanStartNewConversation } = await import('../lib/messaging-health.js')
      const msgGate = await assertCanStartNewConversation(user.userId)
      if (!msgGate.allowed) {
        return reply.status(429).send({
          error: msgGate.reason ?? 'messaging_restricted',
          userNotice: msgGate.userNotice,
        })
      }
    } catch {
      /* messaging health tables may be unavailable during migration */
    }
    const isIsoEntry = parsed.data.entryPoint === 'iso'
    if (isIsoEntry) {
      if (!parsed.data.isoSubjectUserId) {
        return reply.status(400).send({ error: 'isoSubjectUserId is required for ISO conversations' })
      }
      if (parsed.data.isoSubjectUserId !== otherId) {
        return reply.status(400).send({ error: 'isoSubjectUserId must match the message recipient' })
      }
      const [isoPost] = await db
        .select()
        .from(schema.userIsoPosts)
        .where(eq(schema.userIsoPosts.userId, otherId))
        .limit(1)
      if (!isoPost?.acceptDmsViaIso) {
        return reply.status(403).send({ error: 'This member is not accepting DMs through their ISO' })
      }
      // PR 3 (P7): the ISO DM entry point is only valid when the viewer can
      // actually read the ISO — a private ISO must not accept ISO-routed DMs.
      if (
        !canViewerReadIsoVisibility(isoPost.visibility as 'PUBLIC' | 'MEMBERS' | 'PRIVATE', {
          viewerId: user.userId,
          isOwner: false,
        })
      ) {
        return reply.status(403).send({ error: 'This member is not accepting DMs through their ISO' })
      }
    }
    const existing = await findExistingDmPair(user.userId, otherId)
    if (existing) return reply.send({ conversation: { id: existing }, existing: true })
    const connected = await usersAreConnected(user.userId, otherId)
    const [conv] = await db
      .insert(schema.conversations)
      .values({
        initiatorUserId: user.userId,
        dmEntryPoint: isIsoEntry ? 'iso' : null,
        isoSubjectUserId: isIsoEntry ? otherId : null,
      })
      .returning()
    if (!conv) return reply.status(500).send({ error: 'Failed to create conversation' })
    await db.insert(schema.conversationParticipants).values([
      {
        conversationId: conv.id,
        userId: user.userId,
        acceptanceStatus: 'ACCEPTED',
      },
      {
        conversationId: conv.id,
        userId: otherId,
        acceptanceStatus: connected ? 'ACCEPTED' : 'PENDING',
      },
    ])
    if (!connected) {
      try {
        const [sender] = await db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.id, user.userId))
          .limit(1)
        await createNotification(otherId, 'dm_request', {
          conversationId: conv.id,
          fromUserId: user.userId,
          senderUsername: sender?.username ?? undefined,
        })
      } catch (err) {
        req.log.warn({ err }, 'dm_request notification failed')
      }
    }
    return reply.send({ conversation: { id: conv.id }, existing: false })
  })

  app.post('/api/v1/conversations/:conversationId/accept-dm', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { conversationId } = req.params as { conversationId: string }
    const [mem] = await db
      .select()
      .from(schema.conversationParticipants)
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, conversationId),
          eq(schema.conversationParticipants.userId, user.userId)
        )
      )
      .limit(1)
    if (!mem) return reply.status(403).send({ error: 'Not a participant' })
    if (mem.acceptanceStatus !== 'PENDING') {
      return reply.send({ ok: true, alreadyAccepted: true })
    }
    await db
      .update(schema.conversationParticipants)
      .set({ acceptanceStatus: 'ACCEPTED' })
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, conversationId),
          eq(schema.conversationParticipants.userId, user.userId)
        )
      )
    return reply.send({ ok: true })
  })

  app.post('/api/v1/conversations/:conversationId/mark-read', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { conversationId } = req.params as { conversationId: string }
    const { markConversationReadForUser } = await import('../lib/conversation-mark-read.js')
    const result = await markConversationReadForUser(user.userId, conversationId)
    if (!result.ok) return reply.status(result.status).send({ error: result.error })
    return reply.send({ ok: true, readAt: result.readAt })
  })

  app.get('/api/v1/conversations', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { folder?: string; filter?: string; sort?: string; q?: string }
    const folder = q.folder === 'requests' ? 'requests' : q.folder === 'iso' ? 'iso' : 'main'
    const filterRaw = q.filter
    const filter =
      filterRaw === 'unread' ||
      filterRaw === 'friends' ||
      filterRaw === 'followers' ||
      filterRaw === 'following' ||
      filterRaw === 'favorites' ?
        filterRaw
      : 'all'
    const sort = q.sort === 'oldest' ? 'oldest' : 'newest'
    const { listConversationsForInbox } = await import('../lib/conversations-inbox.js')
    const items = await listConversationsForInbox({
      userId: user.userId,
      folder,
      filter,
      sort,
      q: typeof q.q === 'string' ? q.q : undefined,
    })
    return reply.send({ items })
  })

  app.get('/api/v1/conversations/:conversationId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { conversationId } = req.params as { conversationId: string }
    const [mem] = await db
      .select()
      .from(schema.conversationParticipants)
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, conversationId),
          eq(schema.conversationParticipants.userId, user.userId)
        )
      )
      .limit(1)
    if (!mem) return reply.status(403).send({ error: 'Not a participant' })
    const q = req.query as { limit?: string; before?: string }
    const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? '50'), 10) || 50))
    let beforeDate: Date | undefined
    if (typeof q.before === 'string' && q.before.length > 0) {
      const [bm] = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, q.before))
        .limit(1)
      beforeDate = bm?.createdAt
    }
    const conditions = [eq(schema.messages.conversationId, conversationId)]
    if (beforeDate) conditions.push(lt(schema.messages.createdAt, beforeDate))
    const rows = await db
      .select({
        id: schema.messages.id,
        conversationId: schema.messages.conversationId,
        senderId: schema.messages.senderId,
        body: schema.messages.body,
        bodyFormat: schema.messages.bodyFormat,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(and(...conditions))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
    const chronological = [...rows].reverse()
    return reply.send({ items: chronological })
  })

  const messageBody = z.object({
    conversationId: z.string().uuid(),
    body: z.string().min(1),
    bodyFormat: z.enum(['text', 'html']).optional(),
  })
  app.post('/api/v1/messages', { ...rateLimitRoute('messages') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = messageBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [mem] = await db
      .select()
      .from(schema.conversationParticipants)
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, parsed.data.conversationId),
          eq(schema.conversationParticipants.userId, user.userId)
        )
      )
      .limit(1)
    if (!mem) return reply.status(403).send({ error: 'Not a participant' })
    if (mem.acceptanceStatus === 'PENDING') {
      const [conv] = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, parsed.data.conversationId))
        .limit(1)
      if (conv?.initiatorUserId !== user.userId) {
        return reply.status(403).send({ error: 'Accept the conversation before replying' })
      }
    }
    const otherParts = await db
      .select({ userId: schema.conversationParticipants.userId })
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, parsed.data.conversationId))
    const recipientIds = otherParts.map((p) => p.userId).filter((id) => id !== user.userId)
    const sendGate = await assertCanSendDmMessage(user.userId, recipientIds)
    if (!sendGate.ok) return reply.status(sendGate.status).send({ error: sendGate.error })
    const wantsHtml = parsed.data.bodyFormat === 'html'
    let body = parsed.data.body
    let bodyFormat: 'text' | 'html' = 'text'
    if (wantsHtml) {
      const { sanitizeDmHtml } = await import('../lib/sanitize-dm-body.js')
      body = sanitizeDmHtml(body)
      bodyFormat = 'html'
    }
    const [msg] = await db
      .insert(schema.messages)
      .values({
        conversationId: parsed.data.conversationId,
        senderId: user.userId,
        body,
        bodyFormat,
      })
      .returning()
    const [sender] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, user.userId))
      .limit(1)
    const others = await db
      .select({ userId: schema.conversationParticipants.userId })
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, parsed.data.conversationId))
    const preview =
      bodyFormat === 'html' ?
        body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      : body.slice(0, 200)
    for (const o of others) {
      if (o.userId === user.userId) continue
      try {
        await createNotification(o.userId, 'new_message', {
          conversationId: parsed.data.conversationId,
          senderUsername: sender?.username ?? '',
          bodyPreview: preview,
        })
      } catch (err) {
        req.log.warn({ err }, 'failed to insert new_message notification')
      }
    }
    return reply.send({ message: msg })
  })

  app.get('/api/v1/activity/inbox', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const q = req.query as { limit?: string; filter?: string }
    const filterRaw = q.filter
    const filter =
      filterRaw === 'messages' ||
      filterRaw === 'social' ||
      filterRaw === 'notifications' ||
      filterRaw === 'requests' ?
        filterRaw
      : 'all'
    const limit = Math.min(80, Math.max(1, parseInt(String(q?.limit ?? '50'), 10) || 50))
    const { listActivityInbox } = await import('../lib/activity-inbox.js')
    const { items } = await listActivityInbox({ userId: user.userId, limit, filter })
    return reply.send({ items })
  })

  /* --- Notifications --- */
  app.get('/api/v1/notifications', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, user.userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(100)
    const { filterNotificationsForViewer } = await import('../lib/notification-privacy.js')
    const items = await filterNotificationsForViewer(user.userId, rows)
    return reply.send({ items })
  })

  app.post('/api/v1/notifications/:notificationId/read', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { notificationId } = req.params as { notificationId: string }
    const [updated] = await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.id, notificationId), eq(schema.notifications.userId, user.userId)))
      .returning()
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ notification: updated })
  })

  app.post('/api/v1/notifications/read-all', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.userId, user.userId), isNull(schema.notifications.readAt)))
    return reply.send({ ok: true })
  })

  /* --- E8: Conventions --- */
  app.get('/api/v1/conventions', async (_req, reply) => {
    if (!requireDb(reply)) return
    const rows = await db.select().from(schema.conventions).limit(100)
    const { toPublicConventionDto } = await import('../lib/convention-public-dto.js')
    return reply.send({ items: rows.map((row) => toPublicConventionDto(row)) })
  })

  /* --- E9: Moderation --- */
  app.post('/api/v1/moderation/jobs', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { isPlatformModeratorUser } = await import('../lib/platform-staff.js')
    if (!(await isPlatformModeratorUser(user.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const parsed = z
      .object({ kind: z.string(), payload: z.record(z.string(), z.unknown()) })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [job] = await db
      .insert(schema.moderationJobs)
      .values({
        kind: parsed.data.kind,
        payload: parsed.data.payload,
      })
      .returning()
    try {
      const q = getModerationQueue()
      await q.add('process', { jobId: job.id }, { removeOnComplete: 500 })
    } catch (err) {
      req.log.warn({ err }, 'moderation queue enqueue failed; job remains PENDING in DB')
    }
    return reply.send({ job })
  })
}
