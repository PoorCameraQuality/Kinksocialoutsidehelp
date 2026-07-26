/**
 * Organization HTTP routes (directory, membership, branding, reviews, tools).
 * Large multi-domain module — split by audience deferred (audit A12). Prefer
 * `lib/org-*` helpers over adding a parallel org stack.
 */
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zHttpOrRootMediaUrl, zHttpOrRootMediaUrlNullable } from '../lib/media-url.js'
import { deliverBrandingBannerUrl, deliverBrandingLogoUrl } from '../lib/image-delivery.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { isAllowedExternalOrgEmbedUrl } from '../lib/embed-allowlist.js'
import { getModerationQueue } from '../lib/moderation-queue.js'
import {
  compositeOrgRating,
  internalScoreFromMembers,
  orgReviewPropagatesGlobalTrust,
  weightedReviewAverage,
} from '../lib/org-reputation.js'
import { parseOrgListSort, orgListOrderBy } from '../lib/org-list-sort.js'
import { parseOrgFeatureFlags, serializeOrgFeatureFlags } from '../lib/org-features.js'
import { syncOrgVenuePlace } from '../lib/org-venue-sync.js'
import { loadEventsAtVenueOrg } from '../lib/venue-events.js'
import { zLooseHttpUrl, zLooseHttpUrlNullable } from '../lib/loose-http-url.js'
import { getProgramSummariesForEventIds } from '../lib/event-program.js'
import {
  applyEventLocationRedaction,
  physicalLocationDetailVisibleEventIds,
} from '../lib/physical-location-visibility.js'
import { virtualJoinLinkVisibleEventIds } from '../lib/virtual-event-join-visibility.js'
import { sendOrgWelcomeEmail } from '../lib/transactional-email.js'
import { getEmailFromUserRow, userEmailSelect } from '../lib/user-email.js'
import {
  communityModulesArraySchema,
  sanitizeCommunityModulesList,
} from '../lib/org-community-modules.js'
import { sanitizeFeedHtml } from '../lib/sanitize-feed-body.js'
import { normalizeDiscordChannelEmbed } from '../lib/discord-embed.js'
import { createNotification } from '../lib/create-notification.js'
import { publishToScope } from '../lib/realtime-bus.js'
import { userAttendedAnyOrgEvent, userAttendedEvent } from '../lib/attendance-gate.js'
import { viewerCanAccessOrgChannel } from '../lib/convention-channel-access.js'
import { getConventionWithAccess } from './conventions-routes.js'
import { emitActivity } from '../lib/feed-activities.js'
import { canViewOrg, canViewOrgMemberContent, isOrgMember } from '../lib/org-visibility.js'
import { isUserScopeBanned } from '../lib/org-moderation-access.js'
import { canViewerSeeGroupEvent } from '../lib/group-access.js'
import {
  alphaUploadDisabledResponse,
  isAlphaUploadDisabled,
  type AlphaUploadCategory,
} from '../lib/alpha-upload-policy.js'
import {
  MediaUploadValidationError,
  promoteQuarantineToScopeBrandingUrl,
} from '../lib/media-pipeline.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isPgUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  return code === '23505'
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

function sanitizeIlikeFragment(s: string): string {
  return s.replace(/[%_\\]/g, '')
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

const ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

async function getMembership(
  organizationId: string,
  userId: string
): Promise<{ role: string; canManagePayments: boolean } | null> {
  const [row] = await db
    .select({
      role: schema.organizationMembers.role,
      canManagePayments: schema.organizationMembers.canManagePayments,
    })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  return row ?? null
}

async function requireMinRole(
  organizationId: string,
  userId: string,
  min: keyof typeof ROLE_RANK,
  reply: FastifyReply
): Promise<boolean> {
  const [orgRow] = await db
    .select({ ownerId: schema.organizations.ownerId })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1)
  if (orgRow?.ownerId === userId && ROLE_RANK.OWNER >= ROLE_RANK[min]) {
    return true
  }
  const m = await getMembership(organizationId, userId)
  if (!m) {
    reply.status(403).send({ error: 'Not a member' })
    return false
  }
  if (ROLE_RANK[m.role] < ROLE_RANK[min]) {
    reply.status(403).send({ error: 'Insufficient role' })
    return false
  }
  return true
}

async function resolveOrganizationId(orgKey: string): Promise<string | null> {
  if (UUID_RE.test(orgKey)) return orgKey
  const [row] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, orgKey))
    .limit(1)
  return row?.id ?? null
}

function mapOrgRow(row: typeof schema.organizations.$inferSelect) {
  const flags = parseOrgFeatureFlags(row.featureFlags)
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    bio: row.bio,
    bioFormat: row.bioFormat === 'html' ? 'html' : 'text',
    galleryPublic: row.galleryPublic,
    ownerId: row.ownerId,
    logoUrl: deliverBrandingLogoUrl(row.logoUrl),
    bannerUrl: deliverBrandingBannerUrl(row.bannerUrl),
    shareImageUrl: deliverBrandingBannerUrl(row.shareImageUrl),
    visibility: row.visibility,
    theme: row.theme,
    community: row.community,
    featureFlags: flags,
    externalSiteUrl: row.externalSiteUrl,
    showExternalEmbed: row.showExternalEmbed,
    rating: row.rating,
    reviewCount: row.reviewCount,
    createdAt: row.createdAt,
  }
}

async function computeOrgReputationSnapshot(organizationId: string): Promise<{
  reviewAverage: number
  reviewCount: number
  internalReputationAverage: number
  internalMemberCount: number
  compositeRating: number
}> {
  const orgRatings = await db
    .select({ rating: schema.organizationReviews.rating, body: schema.organizationReviews.body })
    .from(schema.organizationReviews)
    .where(eq(schema.organizationReviews.organizationId, organizationId))

  const eventRatings = await db
    .select({
      rating: schema.organizationEventReviews.rating,
      body: schema.organizationEventReviews.body,
    })
    .from(schema.organizationEventReviews)
    .innerJoin(schema.events, eq(schema.organizationEventReviews.eventId, schema.events.id))
    .where(eq(schema.events.organizationId, organizationId))

  const combined = [
    ...orgRatings.map((x) => ({ rating: x.rating, body: x.body })),
    ...eventRatings.map((x) => ({ rating: x.rating, body: x.body })),
  ]
  const { avg: reviewAverage, count: reviewCount } = weightedReviewAverage(combined)

  const memberRows = await db
    .select({
      role: schema.organizationMembers.role,
      localReputation: schema.organizationMembers.localReputation,
    })
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.organizationId, organizationId))

  const { score: internalReputationAverage } = internalScoreFromMembers(memberRows)
  const compositeRating = compositeOrgRating(
    reviewAverage,
    reviewCount,
    internalReputationAverage,
    memberRows.length
  )

  return {
    reviewAverage,
    reviewCount,
    internalReputationAverage,
    internalMemberCount: memberRows.length,
    compositeRating,
  }
}

async function countCompletedOrgEvents(organizationId: string): Promise<number> {
  const now = new Date()
  const [row] = await db
    .select({ n: count() })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.organizationId, organizationId),
        or(
          and(isNotNull(schema.events.endsAt), lt(schema.events.endsAt, now)),
          and(isNull(schema.events.endsAt), lt(schema.events.startsAt, now))
        )
      )
    )
  return Number(row?.n ?? 0)
}

async function recalculateOrganizationRating(organizationId: string): Promise<void> {
  const snap = await computeOrgReputationSnapshot(organizationId)
  await db
    .update(schema.organizations)
    .set({ rating: snap.compositeRating, reviewCount: snap.reviewCount })
    .where(eq(schema.organizations.id, organizationId))
}

async function propagateTrustFromOrgReview(organizationId: string, rating: number): Promise<void> {
  if (!orgReviewPropagatesGlobalTrust()) return
  const base = Math.min(4, Math.max(-4, Math.round((rating - 3) * 2)))
  if (base === 0) return
  const members = await db
    .select()
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.organizationId, organizationId))
  for (const m of members) {
    let mult = 0
    if (m.role === 'OWNER') mult = 1
    else if (m.role === 'ADMIN') mult = 0.5
    else if (m.role === 'MODERATOR' || m.role === 'STAFF') mult = 0.25
    if (mult === 0) continue
    const d = Math.round(base * mult)
    if (d === 0) continue
    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, m.userId))
      .limit(1)
    if (!p) continue
    await db
      .update(schema.profiles)
      .set({ trustScore: Math.min(100, Math.max(0, p.trustScore + d)) })
      .where(eq(schema.profiles.userId, m.userId))
  }
}

async function propagateTrustFromEventReview(organizationId: string | null, rating: number): Promise<void> {
  if (!organizationId) return
  await propagateTrustFromOrgReview(organizationId, rating)
}

const createOrgBody = z.object({
  displayName: z.string().min(1).max(255),
  slug: z.string().min(2).max(128).optional(),
  bio: z.string().max(200_000).optional(),
  bioFormat: z.enum(['text', 'html']).optional(),
  visibility: z.enum(['PUBLIC', 'MEMBERS', 'PRIVATE']).optional(),
})

const communityPatchSchema = z.object({
  welcomeHtml: z.string().max(50_000).nullable().optional(),
  faq: z
    .array(
      z.object({
        q: z.string().max(500),
        a: z.string().max(4000),
      })
    )
    .max(30)
    .optional(),
  links: z
    .array(z.object({ label: z.string().max(200), url: zLooseHttpUrl }))
    .max(30)
    .optional(),
  spotlightGroupId: z.string().uuid().nullable().optional(),
  recapThreadId: z.string().uuid().nullable().optional(),
  lastEventRecapUrl: zLooseHttpUrlNullable,
  /** Ordered customizable sections on org Overview (sanitized HTML inside modules). */
  communityModules: communityModulesArraySchema.optional(),
  emailListEnabled: z.boolean().optional(),
  emailListHeadline: z.string().max(200).nullable().optional(),
  emailListBlurb: z.string().max(2000).nullable().optional(),
})

function mergeOrgCommunity(
  current: unknown,
  patch: z.infer<typeof communityPatchSchema>
): Record<string, unknown> {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {}
  if (patch.welcomeHtml !== undefined) {
    base.welcomeHtml =
      patch.welcomeHtml === null ? null : sanitizeFeedHtml(patch.welcomeHtml).slice(0, 50_000)
  }
  if (patch.faq !== undefined) base.faq = patch.faq
  if (patch.links !== undefined) base.links = patch.links
  if (patch.spotlightGroupId !== undefined) base.spotlightGroupId = patch.spotlightGroupId
  if (patch.recapThreadId !== undefined) base.recapThreadId = patch.recapThreadId
  if (patch.lastEventRecapUrl !== undefined) base.lastEventRecapUrl = patch.lastEventRecapUrl
  if (patch.communityModules !== undefined) {
    base.communityModules = sanitizeCommunityModulesList(patch.communityModules)
  }
  if (patch.emailListEnabled !== undefined) base.emailListEnabled = patch.emailListEnabled
  if (patch.emailListHeadline !== undefined) base.emailListHeadline = patch.emailListHeadline
  if (patch.emailListBlurb !== undefined) base.emailListBlurb = patch.emailListBlurb
  return base
}

const patchOrgBody = z.object({
  displayName: z.string().min(1).max(255).optional(),
  bio: z.string().max(200_000).nullable().optional(),
  bioFormat: z.enum(['text', 'html']).optional(),
  galleryPublic: z.boolean().optional(),
  logoUrl: zHttpOrRootMediaUrlNullable.optional(),
  bannerUrl: zHttpOrRootMediaUrlNullable.optional(),
  shareImageUrl: zHttpOrRootMediaUrlNullable.optional(),
  visibility: z.enum(['PUBLIC', 'MEMBERS', 'PRIVATE']).optional(),
  theme: z.record(z.string(), z.any()).optional(),
  community: communityPatchSchema.optional(),
  featureFlags: z
    .object({
      calendarEnabled: z.boolean().optional(),
      forumsEnabled: z.boolean().optional(),
      subgroupsEnabled: z.boolean().optional(),
      chatEnabled: z.boolean().optional(),
      externalEmbedEnabled: z.boolean().optional(),
      listingKind: z.enum(['community', 'venue', 'dungeon']).optional(),
      eckeDungeonListing: z.boolean().optional(),
      venueCategory: z
        .enum(['dungeon_club', 'nude_beach', 'kink_friendly_hotel', 'web_resource', 'other'])
        .nullable()
        .optional(),
      city: z.string().max(128).nullable().optional(),
      region: z.string().max(128).nullable().optional(),
      country: z.string().max(128).nullable().optional(),
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
      addressVisibility: z.enum(['city_only', 'full']).optional(),
    })
    .optional(),
  externalSiteUrl: z.string().url().nullable().optional(),
  showExternalEmbed: z.boolean().optional(),
})

const galleryPostBody = z.object({
  imageUrl: zHttpOrRootMediaUrl,
  caption: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const featuredVendorBody = z.object({
  items: z.array(
    z.object({
      vendorProfileId: z.string().uuid(),
      sortOrder: z.number().int().optional(),
      label: z.string().max(128).optional(),
    })
  ),
})

const featuredArticleBody = z.object({
  items: z.array(
    z.object({
      educationArticleId: z.string().uuid(),
      sortOrder: z.number().int().optional(),
      label: z.string().max(128).optional(),
    })
  ),
})

export async function registerOrganizationRoutes(app: FastifyInstance) {
  app.get('/api/v1/organizations', async (req, reply) => {
    if (!requireDb(reply)) return
    const q = req.query as { q?: string; limit?: string; sort?: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? '50'), 10) || 50))
    const sort = parseOrgListSort(q?.sort)
    const trimmed = sanitizeIlikeFragment((q?.q ?? '').trim())
    const searchClause =
      trimmed.length > 0
        ? or(
            ilike(schema.organizations.displayName, `%${trimmed}%`),
            ilike(schema.organizations.slug, `%${trimmed}%`)
          )
        : undefined

    const publicOnly = eq(schema.organizations.visibility, 'PUBLIC')
    let whereClause = searchClause ? and(publicOnly, searchClause) : publicOnly

    if (viewerId) {
      const memberOrgIds = await db
        .select({ id: schema.organizationMembers.organizationId })
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, viewerId))
      const ids = memberOrgIds.map((r) => r.id)
      const memberClause =
        ids.length > 0 ? inArray(schema.organizations.id, ids) : sql`false`
      const visClause = or(publicOnly, memberClause)
      whereClause = searchClause ? and(visClause, searchClause) : visClause
    }

    const rows = await db
      .select()
      .from(schema.organizations)
      .where(whereClause)
      .orderBy(...orgListOrderBy(sort))
      .limit(limit)
    if (rows.length === 0) return reply.send({ items: [] })
    const ids = rows.map((o) => o.id)
    const countRows = await db
      .select({
        organizationId: schema.organizationMembers.organizationId,
        n: count(schema.organizationMembers.id).as('n'),
      })
      .from(schema.organizationMembers)
      .where(inArray(schema.organizationMembers.organizationId, ids))
      .groupBy(schema.organizationMembers.organizationId)
    const countMap = new Map(countRows.map((r) => [r.organizationId, Number(r.n)]))
    return reply.send({
      items: rows.map((o) => ({ ...mapOrgRow(o), memberCount: countMap.get(o.id) ?? 0 })),
    })
  })

  /** Orgs where the viewer can publish calendar events (moderator+ and calendar enabled). */
  app.get('/api/v1/organizations/me/event-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select({
        id: schema.organizations.id,
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        role: schema.organizationMembers.role,
        featureFlags: schema.organizations.featureFlags,
      })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.organizationMembers.organizationId)
      )
      .where(eq(schema.organizationMembers.userId, user.userId))
    const items = rows
      .filter(
        (r) =>
          ROLE_RANK[r.role] >= ROLE_RANK.MODERATOR &&
          parseOrgFeatureFlags(r.featureFlags).calendarEnabled
      )
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        displayName: r.displayName,
        canCreateConventionShell: ROLE_RANK[r.role] >= ROLE_RANK.ADMIN,
      }))
    return reply.send({ items })
  })

  app.get('/api/v1/organizations/:orgIdOrSlug', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgIdOrSlug } = req.params as { orgIdOrSlug: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const orgId = UUID_RE.test(orgIdOrSlug)
      ? orgIdOrSlug
      : (
          await db
            .select()
            .from(schema.organizations)
            .where(eq(schema.organizations.slug, orgIdOrSlug))
            .limit(1)
        )[0]?.id
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrg(org, viewerId))) return reply.status(404).send({ error: 'Not found' })

    let memberCount = 0
    const [cnt] = await db
      .select({ n: count() })
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.organizationId, org.id))
    memberCount = Number(cnt?.n ?? 0)

    const [repSnap, completedEventCount] = await Promise.all([
      computeOrgReputationSnapshot(org.id),
      countCompletedOrgEvents(org.id),
    ])

    const flags = parseOrgFeatureFlags(org.featureFlags)
    const embedOk =
      flags.externalEmbedEnabled &&
      org.showExternalEmbed &&
      org.externalSiteUrl &&
      isAllowedExternalOrgEmbedUrl(org.externalSiteUrl)

    const viewerMembership = viewerId ? await getMembership(org.id, viewerId) : null
    const isOwner = Boolean(viewerId && org.ownerId === viewerId)
    const viewerScopeBanned =
      viewerId ? await isUserScopeBanned('organization', org.id, viewerId) : false
    const viewerCanManagePayments =
      isOwner || Boolean(viewerMembership?.canManagePayments)

    return reply.send({
      organization: {
        ...mapOrgRow(org),
        rating: repSnap.compositeRating,
        reviewCount: repSnap.reviewCount,
        reviewAverage: repSnap.reviewAverage,
        completedEventCount,
        memberCount,
        externalEmbedAllowed: embedOk,
        viewerRole: viewerMembership?.role ?? (isOwner ? 'OWNER' : null),
        isMember: Boolean(viewerMembership) || isOwner,
        viewerScopeBanned,
        viewerCanManagePayments,
      },
    })
  })

  app.get('/api/v1/organizations/:orgKey/venue-events', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!(await canViewOrg(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const events = await loadEventsAtVenueOrg(org.id)
    return reply.send({ events })
  })

  app.post('/api/v1/organizations', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = createOrgBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const baseSlug = parsed.data.slug ?? slugify(parsed.data.displayName)
    if (baseSlug.length < 2) return reply.status(400).send({ error: 'Invalid slug' })
    let slug = baseSlug
    for (let i = 0; i < 20; i++) {
      const [exists] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.slug, slug))
        .limit(1)
      if (!exists) break
      slug = `${baseSlug}-${i + 2}`
    }
    const bioFmt = parsed.data.bioFormat ?? 'text'
    const bioRaw = parsed.data.bio
    const bioStored =
      bioRaw === undefined
        ? undefined
        : bioFmt === 'html'
          ? sanitizeFeedHtml(bioRaw)
          : bioRaw.replace(/\0/g, '').slice(0, 200_000)
    const [org] = await db
      .insert(schema.organizations)
      .values({
        slug,
        displayName: parsed.data.displayName,
        bio: bioStored,
        bioFormat: bioFmt,
        ownerId: user.userId,
        visibility: parsed.data.visibility ?? 'PUBLIC',
      })
      .returning()
    if (!org) return reply.status(500).send({ error: 'Failed to create organization' })
    await db.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: user.userId,
      role: 'OWNER',
    })
    return reply.send({ organization: mapOrgRow(org) })
  })

  app.patch('/api/v1/organizations/:orgKey', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'ADMIN', reply))) return
    const parsed = patchOrgBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const data = parsed.data
    const [current] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!current) return reply.status(404).send({ error: 'Not found' })

    let externalSiteUrl = current.externalSiteUrl
    let showExternalEmbed = current.showExternalEmbed
    if (data.externalSiteUrl !== undefined) externalSiteUrl = data.externalSiteUrl
    if (data.showExternalEmbed !== undefined) showExternalEmbed = data.showExternalEmbed
    const flags = data.featureFlags
      ? parseOrgFeatureFlags({
          ...(typeof current.featureFlags === 'object' && current.featureFlags ?
            (current.featureFlags as Record<string, unknown>)
          : {}),
          ...data.featureFlags,
        })
      : parseOrgFeatureFlags(current.featureFlags)
    if (
      showExternalEmbed &&
      externalSiteUrl &&
      !isAllowedExternalOrgEmbedUrl(externalSiteUrl)
    ) {
      return reply.status(400).send({
        error:
          'External embed URL hostname not allowlisted. Set C2K_EXTERNAL_SITE_EMBED_HOSTS or use an allowed https URL.',
      })
    }

    const nextBioFormat = data.bioFormat ?? current.bioFormat
    let nextBio: string | null = current.bio
    if (data.bio !== undefined) {
      if (data.bio === null) {
        nextBio = null
      } else if (nextBioFormat === 'html') {
        nextBio = sanitizeFeedHtml(data.bio)
      } else {
        nextBio = data.bio.replace(/\0/g, '').slice(0, 200_000)
      }
    }

    if (data.community) {
      if (data.community.spotlightGroupId) {
        const [g] = await db
          .select({ id: schema.groups.id })
          .from(schema.groups)
          .where(
            and(eq(schema.groups.id, data.community.spotlightGroupId), eq(schema.groups.organizationId, orgId))
          )
          .limit(1)
        if (!g)
          return reply.status(400).send({ error: 'Spotlight group not linked to this organization' })
      }
      if (data.community.recapThreadId) {
        const [th] = await db
          .select({ id: schema.forumThreads.id })
          .from(schema.forumThreads)
          .where(
            and(eq(schema.forumThreads.id, data.community.recapThreadId), eq(schema.forumThreads.organizationId, orgId))
          )
          .limit(1)
        if (!th) return reply.status(400).send({ error: 'Recap thread not in this organization' })
      }
    }

    const nextCommunity =
      data.community !== undefined
        ? mergeOrgCommunity(current.community, data.community)
        : current.community

    const [updated] = await db
      .update(schema.organizations)
      .set({
        displayName: data.displayName ?? current.displayName,
        bio: nextBio,
        bioFormat: nextBioFormat,
        galleryPublic: data.galleryPublic !== undefined ? data.galleryPublic : current.galleryPublic,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : current.logoUrl,
        bannerUrl: data.bannerUrl !== undefined ? data.bannerUrl : current.bannerUrl,
        shareImageUrl: data.shareImageUrl !== undefined ? data.shareImageUrl : current.shareImageUrl,
        visibility: data.visibility ?? current.visibility,
        theme: data.theme !== undefined ? (data.theme as Record<string, unknown>) : current.theme,
        community: nextCommunity as Record<string, unknown>,
        featureFlags: flags,
        externalSiteUrl,
        showExternalEmbed,
      })
      .where(eq(schema.organizations.id, orgId))
      .returning()
    await syncOrgVenuePlace(updated!)
    return reply.send({ organization: mapOrgRow(updated!) })
  })

  const orgBrandingAttachBody = z.object({
    kind: z.enum(['banner', 'logo', 'share']),
    quarantineKey: z.string().min(1).max(2048),
  })

  const orgBrandingAlphaCategory: Record<'banner' | 'logo' | 'share', AlphaUploadCategory> = {
    banner: 'org_banner',
    logo: 'org_logo',
    share: 'org_share',
  }

  app.post('/api/v1/organizations/:orgKey/branding/attach', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'ADMIN', reply))) return
    const parsed = orgBrandingAttachBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const alphaCategory = orgBrandingAlphaCategory[parsed.data.kind]
    if (isAlphaUploadDisabled(alphaCategory)) {
      return alphaUploadDisabledResponse(reply, alphaCategory)
    }
    let publicUrl: string
    try {
      publicUrl = await promoteQuarantineToScopeBrandingUrl({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        scopePath: `organizations/${orgId}`,
        assetName: parsed.data.kind,
      })
    } catch (err) {
      if (err instanceof MediaUploadValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      const e = err as { message?: string }
      req.log?.error({ err }, 'org branding attach failed')
      return reply.status(502).send({ error: e.message ?? 'Could not attach branding image' })
    }
    const field =
      parsed.data.kind === 'banner' ? 'bannerUrl'
      : parsed.data.kind === 'logo' ? 'logoUrl'
      : 'shareImageUrl'
    const [updated] = await db
      .update(schema.organizations)
      .set({ [field]: publicUrl })
      .where(eq(schema.organizations.id, orgId))
      .returning()
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send({
      url: publicUrl,
      kind: parsed.data.kind,
      organization: mapOrgRow(updated),
    })
  })

  app.post('/api/v1/organizations/:orgKey/join', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (org.visibility === 'PRIVATE') return reply.status(403).send({ error: 'Invite required' })
    const existing = await getMembership(orgId, user.userId)
    if (existing) return reply.send({ ok: true, alreadyMember: true })
    await db.insert(schema.organizationMembers).values({
      organizationId: orgId,
      userId: user.userId,
      role: 'MEMBER',
    })
    await recalculateOrganizationRating(orgId)
    emitActivity({
      actorId: user.userId,
      verb: 'org_join',
      objectType: 'organization',
      objectId: orgId,
      metadata: { orgName: org.displayName, orgSlug: org.slug },
    })
    void (async () => {
      const [u] = await db
        .select(userEmailSelect)
        .from(schema.users)
        .where(eq(schema.users.id, user.userId))
        .limit(1)
      const recipient = getEmailFromUserRow(u)
      if (!recipient) return
      await sendOrgWelcomeEmail({
        to: recipient,
        orgName: org.displayName,
        orgSlug: org.slug,
      })
    })()
    return reply.send({ ok: true, alreadyMember: false })
  })

  app.post('/api/v1/organizations/:orgKey/leave', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const m = await getMembership(orgId, user.userId)
    if (!m) return reply.status(400).send({ error: 'Not a member' })
    if (m.role === 'OWNER') return reply.status(400).send({ error: 'Owner cannot leave; transfer ownership first' })
    await db
      .delete(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, user.userId)
        )
      )
    await recalculateOrganizationRating(orgId)
    return reply.send({ ok: true })
  })

  app.get('/api/v1/organizations/:orgKey/members', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select({
        userId: schema.organizationMembers.userId,
        role: schema.organizationMembers.role,
        localReputation: schema.organizationMembers.localReputation,
        listedInOrgDirectory: schema.organizationMembers.listedInOrgDirectory,
        volunteerTags: schema.organizationMembers.volunteerTags,
        canManagePayments: schema.organizationMembers.canManagePayments,
        joinedAt: schema.organizationMembers.joinedAt,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
      })
      .from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.organizationMembers.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.organizationMembers.organizationId, orgId))
      .orderBy(asc(schema.organizationMembers.joinedAt))
    return reply.send({ items: rows })
  })

  const memberMeDirectoryBody = z.object({ listedInOrgDirectory: z.boolean() })
  app.patch('/api/v1/organizations/:orgKey/members/me', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const parsed = memberMeDirectoryBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const m = await getMembership(orgId, user.userId)
    if (!m) return reply.status(403).send({ error: 'Not a member' })
    await db
      .update(schema.organizationMembers)
      .set({ listedInOrgDirectory: parsed.data.listedInOrgDirectory })
      .where(
        and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, user.userId))
      )
    return reply.send({ ok: true })
  })

  const rolePatchBody = z
    .object({
      role: z.enum(['ADMIN', 'MODERATOR', 'STAFF', 'MEMBER']).optional(),
      volunteerTags: z.array(z.string().max(32).trim()).max(12).optional(),
      canManagePayments: z.boolean().optional(),
    })
    .refine(
      (d) =>
        d.role !== undefined || d.volunteerTags !== undefined || d.canManagePayments !== undefined,
      { message: 'No changes' },
    )
  app.patch('/api/v1/organizations/:orgKey/members/:userId', async (req, reply) => {
    if (!requireDb(reply)) return
    const admin = requireUser(req, reply)
    if (!admin) return
    const { orgKey, userId: targetUserId } = req.params as { orgKey: string; userId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!UUID_RE.test(targetUserId)) return reply.status(400).send({ error: 'Invalid user id' })
    if (!(await requireMinRole(orgId, admin.userId, 'ADMIN', reply))) return
    const parsed = rolePatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    if (parsed.data.canManagePayments !== undefined) {
      const [orgRow] = await db
        .select({ ownerId: schema.organizations.ownerId })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, orgId))
        .limit(1)
      if (!orgRow || orgRow.ownerId !== admin.userId) {
        return reply.status(403).send({
          error: 'Only the organization owner can grant payment management',
          code: 'owner_required',
        })
      }
    }
    const [target] = await db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, targetUserId)
        )
      )
      .limit(1)
    if (!target) return reply.status(404).send({ error: 'Member not found' })
    if (parsed.data.role !== undefined && target.role === 'OWNER') {
      return reply.status(400).send({ error: 'Cannot change owner role here' })
    }
    if (parsed.data.canManagePayments !== undefined && target.role === 'OWNER') {
      return reply.status(400).send({ error: 'Owner already manages payments' })
    }
    await db
      .update(schema.organizationMembers)
      .set({
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.volunteerTags !== undefined ? { volunteerTags: parsed.data.volunteerTags } : {}),
        ...(parsed.data.canManagePayments !== undefined
          ? { canManagePayments: parsed.data.canManagePayments }
          : {}),
      })
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, targetUserId)
        )
      )
    return reply.send({ ok: true })
  })

  const reputationDeltaBody = z.object({
    delta: z.number().int().min(-100).max(100),
  })
  app.patch('/api/v1/organizations/:orgKey/members/:userId/reputation', async (req, reply) => {
    if (!requireDb(reply)) return
    const admin = requireUser(req, reply)
    if (!admin) return
    const { orgKey, userId: targetUserId } = req.params as { orgKey: string; userId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!UUID_RE.test(targetUserId)) return reply.status(400).send({ error: 'Invalid user id' })
    if (!(await requireMinRole(orgId, admin.userId, 'MODERATOR', reply))) return
    const parsed = reputationDeltaBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [target] = await db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, targetUserId)
        )
      )
      .limit(1)
    if (!target) return reply.status(404).send({ error: 'Member not found' })
    const next = Math.max(0, Math.min(10_000, target.localReputation + parsed.data.delta))
    await db
      .update(schema.organizationMembers)
      .set({ localReputation: next })
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, targetUserId)
        )
      )
    await recalculateOrganizationRating(orgId)
    return reply.send({ ok: true, localReputation: next })
  })

  /* --- Featured vendors --- */
  app.get('/api/v1/organizations/:orgKey/featured-vendors', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select({
        vendorProfileId: schema.organizationFeaturedVendors.vendorProfileId,
        sortOrder: schema.organizationFeaturedVendors.sortOrder,
        label: schema.organizationFeaturedVendors.label,
        slug: schema.vendorProfiles.slug,
        displayName: schema.vendorProfiles.displayName,
        logoUrl: schema.vendorProfiles.logoUrl,
      })
      .from(schema.organizationFeaturedVendors)
      .innerJoin(
        schema.vendorProfiles,
        eq(schema.organizationFeaturedVendors.vendorProfileId, schema.vendorProfiles.id)
      )
      .where(eq(schema.organizationFeaturedVendors.organizationId, orgId))
      .orderBy(asc(schema.organizationFeaturedVendors.sortOrder))
    return reply.send({ items: rows })
  })

  app.put('/api/v1/organizations/:orgKey/featured-vendors', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'ADMIN', reply))) return
    const parsed = featuredVendorBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .delete(schema.organizationFeaturedVendors)
      .where(eq(schema.organizationFeaturedVendors.organizationId, orgId))
    for (let i = 0; i < parsed.data.items.length; i++) {
      const it = parsed.data.items[i]!
      const [v] = await db
        .select({ id: schema.vendorProfiles.id })
        .from(schema.vendorProfiles)
        .where(eq(schema.vendorProfiles.id, it.vendorProfileId))
        .limit(1)
      if (!v) return reply.status(400).send({ error: `Unknown vendor ${it.vendorProfileId}` })
      await db.insert(schema.organizationFeaturedVendors).values({
        organizationId: orgId,
        vendorProfileId: it.vendorProfileId,
        sortOrder: it.sortOrder ?? i,
        label: it.label,
      })
    }
    return reply.send({ ok: true })
  })

  app.get('/api/v1/organizations/:orgKey/featured-articles', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select({
        educationArticleId: schema.organizationFeaturedArticles.educationArticleId,
        sortOrder: schema.organizationFeaturedArticles.sortOrder,
        label: schema.organizationFeaturedArticles.label,
        slug: schema.educationArticles.slug,
        title: schema.educationArticles.title,
        excerpt: schema.educationArticles.excerpt,
        heroImageUrl: schema.educationArticles.heroImageUrl,
        authorUsername: schema.users.username,
      })
      .from(schema.organizationFeaturedArticles)
      .innerJoin(
        schema.educationArticles,
        eq(schema.organizationFeaturedArticles.educationArticleId, schema.educationArticles.id),
      )
      .innerJoin(schema.users, eq(schema.educationArticles.authorUserId, schema.users.id))
      .where(eq(schema.organizationFeaturedArticles.organizationId, orgId))
      .orderBy(asc(schema.organizationFeaturedArticles.sortOrder))
    return reply.send({ items: rows })
  })

  app.put('/api/v1/organizations/:orgKey/featured-articles', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'ADMIN', reply))) return
    const parsed = featuredArticleBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    await db
      .delete(schema.organizationFeaturedArticles)
      .where(eq(schema.organizationFeaturedArticles.organizationId, orgId))
    for (let i = 0; i < parsed.data.items.length; i++) {
      const it = parsed.data.items[i]!
      const [a] = await db
        .select({ id: schema.educationArticles.id })
        .from(schema.educationArticles)
        .where(eq(schema.educationArticles.id, it.educationArticleId))
        .limit(1)
      if (!a) return reply.status(400).send({ error: `Unknown article ${it.educationArticleId}` })
      await db.insert(schema.organizationFeaturedArticles).values({
        organizationId: orgId,
        educationArticleId: it.educationArticleId,
        sortOrder: it.sortOrder ?? i,
        label: it.label,
      })
    }
    return reply.send({ ok: true })
  })

  /* --- Forums --- */
  app.get('/api/v1/organizations/:orgKey/forum/categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).forumsEnabled) return reply.status(404).send({ error: 'Forums disabled' })
    const rows = await db
      .select()
      .from(schema.forumCategories)
      .where(eq(schema.forumCategories.organizationId, orgId))
      .orderBy(asc(schema.forumCategories.sortOrder), asc(schema.forumCategories.name))
    return reply.send({ items: rows })
  })

  const forumCategoryBody = z.object({
    name: z.string().min(1).max(255),
    sortOrder: z.number().int().optional(),
  })
  app.post('/api/v1/organizations/:orgKey/forum/categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).forumsEnabled)
      return reply.status(400).send({ error: 'Forums disabled' })
    const parsed = forumCategoryBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.forumCategories)
      .values({
        organizationId: orgId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ category: row })
  })

  const forumCategoryPatchBody = z.object({
    name: z.string().min(1).max(255).optional(),
    sortOrder: z.number().int().optional(),
  })
  app.patch('/api/v1/organizations/:orgKey/forum/categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, categoryId } = req.params as { orgKey: string; categoryId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).forumsEnabled)
      return reply.status(400).send({ error: 'Forums disabled' })
    const parsed = forumCategoryPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [cat] = await db
      .select()
      .from(schema.forumCategories)
      .where(and(eq(schema.forumCategories.id, categoryId), eq(schema.forumCategories.organizationId, orgId)))
      .limit(1)
    if (!cat) return reply.status(404).send({ error: 'Not found' })
    const [updated] = await db
      .update(schema.forumCategories)
      .set({
        name: parsed.data.name ?? cat.name,
        sortOrder: parsed.data.sortOrder ?? cat.sortOrder,
      })
      .where(eq(schema.forumCategories.id, categoryId))
      .returning()
    return reply.send({ category: updated })
  })

  app.delete('/api/v1/organizations/:orgKey/forum/categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, categoryId } = req.params as { orgKey: string; categoryId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).forumsEnabled)
      return reply.status(400).send({ error: 'Forums disabled' })
    const [cat] = await db
      .select()
      .from(schema.forumCategories)
      .where(and(eq(schema.forumCategories.id, categoryId), eq(schema.forumCategories.organizationId, orgId)))
      .limit(1)
    if (!cat) return reply.status(404).send({ error: 'Not found' })
    await db
      .update(schema.forumThreads)
      .set({ categoryId: null })
      .where(eq(schema.forumThreads.categoryId, categoryId))
    await db.delete(schema.forumCategories).where(eq(schema.forumCategories.id, categoryId))
    return reply.send({ ok: true })
  })

  app.get('/api/v1/organizations/:orgKey/forum/threads', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const q = req.query as { categoryId?: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).forumsEnabled) return reply.status(404).send({ error: 'Forums disabled' })
    let whereClause: SQL = eq(schema.forumThreads.organizationId, orgId)
    if (q.categoryId && UUID_RE.test(q.categoryId)) {
      whereClause = and(whereClause, eq(schema.forumThreads.categoryId, q.categoryId))!
    }
    const rows = await db
      .select({
        id: schema.forumThreads.id,
        title: schema.forumThreads.title,
        categoryId: schema.forumThreads.categoryId,
        authorId: schema.forumThreads.authorId,
        createdAt: schema.forumThreads.createdAt,
        updatedAt: schema.forumThreads.updatedAt,
        username: schema.users.username,
      })
      .from(schema.forumThreads)
      .innerJoin(schema.users, eq(schema.forumThreads.authorId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.forumThreads.updatedAt))
      .limit(100)
    return reply.send({ items: rows })
  })

  const forumThreadBody = z.object({
    title: z.string().min(1).max(512),
    categoryId: z.string().uuid().optional(),
    body: z.string().min(1).max(20000),
  })
  app.post('/api/v1/organizations/:orgKey/forum/threads', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await getMembership(orgId, user.userId))) return reply.status(403).send({ error: 'Members only' })
    if (await isUserScopeBanned('organization', orgId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).forumsEnabled)
      return reply.status(400).send({ error: 'Forums disabled' })
    const parsed = forumThreadBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [thread] = await db
      .insert(schema.forumThreads)
      .values({
        organizationId: orgId,
        categoryId: parsed.data.categoryId,
        title: parsed.data.title,
        authorId: user.userId,
      })
      .returning()
    if (!thread) return reply.status(500).send({ error: 'Failed' })
    const [post] = await db
      .insert(schema.forumPosts)
      .values({
        threadId: thread.id,
        authorId: user.userId,
        body: parsed.data.body,
      })
      .returning()
    try {
      await getModerationQueue().add('org_forum_post', {
        postId: post!.id,
        threadId: thread.id,
        organizationId: orgId,
      })
    } catch {
      /* queue optional */
    }
    return reply.send({ thread, post })
  })

  app.get('/api/v1/organizations/:orgKey/forum/threads/:threadId', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey, threadId } = req.params as { orgKey: string; threadId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(threadId)) return reply.status(400).send({ error: 'Invalid id' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).forumsEnabled) return reply.status(404).send({ error: 'Forums disabled' })
    const [thread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, threadId), eq(schema.forumThreads.organizationId, orgId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const mem = viewerId ? await getMembership(orgId, viewerId) : null
    const canSeeHidden = Boolean(mem && ROLE_RANK[mem.role] >= ROLE_RANK.MODERATOR)
    const postWhere = canSeeHidden
      ? eq(schema.forumPosts.threadId, threadId)
      : and(eq(schema.forumPosts.threadId, threadId), isNull(schema.forumPosts.hiddenAt))
    const posts = await db
      .select({
        id: schema.forumPosts.id,
        body: schema.forumPosts.body,
        authorId: schema.forumPosts.authorId,
        createdAt: schema.forumPosts.createdAt,
        hiddenAt: schema.forumPosts.hiddenAt,
        username: schema.users.username,
      })
      .from(schema.forumPosts)
      .innerJoin(schema.users, eq(schema.forumPosts.authorId, schema.users.id))
      .where(postWhere)
      .orderBy(asc(schema.forumPosts.createdAt))
    const postIds = posts.map((p) => p.id)
    const thanksCount = new Map<string, number>()
    const helpfulCount = new Map<string, number>()
    const viewerReactions = new Map<string, Set<'thanks' | 'helpful'>>()
    if (postIds.length > 0) {
      const rrows = await db
        .select({
          postId: schema.forumPostReactions.postId,
          kind: schema.forumPostReactions.kind,
          n: count(),
        })
        .from(schema.forumPostReactions)
        .where(inArray(schema.forumPostReactions.postId, postIds))
        .groupBy(schema.forumPostReactions.postId, schema.forumPostReactions.kind)
      for (const r of rrows) {
        if (r.kind === 'thanks') thanksCount.set(r.postId, Number(r.n))
        if (r.kind === 'helpful') helpfulCount.set(r.postId, Number(r.n))
      }
      if (viewerId) {
        const mine = await db
          .select({
            postId: schema.forumPostReactions.postId,
            kind: schema.forumPostReactions.kind,
          })
          .from(schema.forumPostReactions)
          .where(
            and(eq(schema.forumPostReactions.userId, viewerId), inArray(schema.forumPostReactions.postId, postIds))
          )
        for (const m of mine) {
          if (!viewerReactions.has(m.postId)) viewerReactions.set(m.postId, new Set())
          viewerReactions.get(m.postId)!.add(m.kind as 'thanks' | 'helpful')
        }
      }
    }
    const postsOut = posts.map((p) => ({
      ...p,
      thanksCount: thanksCount.get(p.id) ?? 0,
      helpfulCount: helpfulCount.get(p.id) ?? 0,
      viewerHasThanks: viewerReactions.get(p.id)?.has('thanks') ?? false,
      viewerHasHelpful: viewerReactions.get(p.id)?.has('helpful') ?? false,
    }))
    return reply.send({ thread, posts: postsOut })
  })

  const forumPostReactionBody = z.object({ kind: z.enum(['thanks', 'helpful']) })
  app.post('/api/v1/organizations/:orgKey/forum/posts/:postId/reactions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, postId } = req.params as { orgKey: string; postId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(postId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await getMembership(orgId, user.userId))) return reply.status(403).send({ error: 'Members only' })
    if (await isUserScopeBanned('organization', orgId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).forumsEnabled)
      return reply.status(400).send({ error: 'Forums disabled' })
    const parsed = forumPostReactionBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [post] = await db
      .select({ threadId: schema.forumPosts.threadId })
      .from(schema.forumPosts)
      .where(eq(schema.forumPosts.id, postId))
      .limit(1)
    if (!post) return reply.status(404).send({ error: 'Not found' })
    const [thread] = await db
      .select({ id: schema.forumThreads.id })
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, post.threadId), eq(schema.forumThreads.organizationId, orgId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const [existing] = await db
      .select({ id: schema.forumPostReactions.id })
      .from(schema.forumPostReactions)
      .where(
        and(
          eq(schema.forumPostReactions.postId, postId),
          eq(schema.forumPostReactions.userId, user.userId),
          eq(schema.forumPostReactions.kind, parsed.data.kind)
        )
      )
      .limit(1)
    if (existing) {
      await db.delete(schema.forumPostReactions).where(eq(schema.forumPostReactions.id, existing.id))
      return reply.send({ ok: true, active: false })
    }
    await db.insert(schema.forumPostReactions).values({
      postId,
      userId: user.userId,
      kind: parsed.data.kind,
    })
    return reply.send({ ok: true, active: true })
  })

  const forumPostBody = z.object({ body: z.string().min(1).max(20000) })
  app.post('/api/v1/organizations/:orgKey/forum/threads/:threadId/posts', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, threadId } = req.params as { orgKey: string; threadId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(threadId)) return reply.status(400).send({ error: 'Invalid id' })
    const mem = await getMembership(orgId, user.userId)
    if (!mem) return reply.status(403).send({ error: 'Members only' })
    if (await isUserScopeBanned('organization', orgId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }
    const [thread] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.id, threadId), eq(schema.forumThreads.organizationId, orgId)))
      .limit(1)
    if (!thread) return reply.status(404).send({ error: 'Not found' })
    const modBypass = ROLE_RANK[mem.role] >= ROLE_RANK.MODERATOR
    if (thread.lockedAt && !modBypass) {
      return reply.status(403).send({ error: 'Thread is locked' })
    }
    const parsed = forumPostBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [post] = await db
      .insert(schema.forumPosts)
      .values({
        threadId,
        authorId: user.userId,
        body: parsed.data.body,
      })
      .returning()
    await db
      .update(schema.forumThreads)
      .set({ updatedAt: new Date() })
      .where(eq(schema.forumThreads.id, threadId))
    try {
      await getModerationQueue().add('org_forum_post', {
        postId: post!.id,
        threadId,
        organizationId: orgId,
      })
    } catch {
      /* optional */
    }
    return reply.send({ post })
  })

  /* --- Org channel categories (grouping in sidebar) --- */
  const orgChannelCategoryBody = z.object({
    name: z.string().min(1).max(255),
    sortOrder: z.number().int().optional(),
  })
  app.get('/api/v1/organizations/:orgKey/channel-categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).chatEnabled) return reply.status(404).send({ error: 'Chat disabled' })
    const rows = await db
      .select()
      .from(schema.orgChannelCategories)
      .where(eq(schema.orgChannelCategories.organizationId, orgId))
      .orderBy(asc(schema.orgChannelCategories.sortOrder), asc(schema.orgChannelCategories.name))
    return reply.send({ items: rows })
  })

  app.post('/api/v1/organizations/:orgKey/channel-categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled)
      return reply.status(400).send({ error: 'Chat disabled' })
    const parsed = orgChannelCategoryBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.orgChannelCategories)
      .values({
        organizationId: orgId,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ category: row })
  })

  const orgChannelCategoryPatchBody = z.object({
    name: z.string().min(1).max(255).optional(),
    sortOrder: z.number().int().optional(),
  })
  app.patch('/api/v1/organizations/:orgKey/channel-categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, categoryId } = req.params as { orgKey: string; categoryId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled)
      return reply.status(400).send({ error: 'Chat disabled' })
    const parsed = orgChannelCategoryPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [cat] = await db
      .select()
      .from(schema.orgChannelCategories)
      .where(
        and(eq(schema.orgChannelCategories.id, categoryId), eq(schema.orgChannelCategories.organizationId, orgId))
      )
      .limit(1)
    if (!cat) return reply.status(404).send({ error: 'Not found' })
    const [updated] = await db
      .update(schema.orgChannelCategories)
      .set({
        name: parsed.data.name ?? cat.name,
        sortOrder: parsed.data.sortOrder ?? cat.sortOrder,
      })
      .where(eq(schema.orgChannelCategories.id, categoryId))
      .returning()
    return reply.send({ category: updated })
  })

  app.delete('/api/v1/organizations/:orgKey/channel-categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, categoryId } = req.params as { orgKey: string; categoryId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled)
      return reply.status(400).send({ error: 'Chat disabled' })
    const [cat] = await db
      .select()
      .from(schema.orgChannelCategories)
      .where(
        and(eq(schema.orgChannelCategories.id, categoryId), eq(schema.orgChannelCategories.organizationId, orgId))
      )
      .limit(1)
    if (!cat) return reply.status(404).send({ error: 'Not found' })
    await db
      .update(schema.orgChannels)
      .set({ categoryId: null })
      .where(eq(schema.orgChannels.categoryId, categoryId))
    await db.delete(schema.orgChannelCategories).where(eq(schema.orgChannelCategories.id, categoryId))
    return reply.send({ ok: true })
  })

  /* --- Org chat channels --- */
  app.get('/api/v1/organizations/:orgKey/channels', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const q = req.query as { forConventionId?: string }
    const forConventionId = q.forConventionId?.trim()
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    let conventionHubOk = false
    if (forConventionId && UUID_RE.test(forConventionId)) {
      const access = await getConventionWithAccess(forConventionId, viewerId)
      if (!('notFound' in access) && !('forbidden' in access) && access.conv.organizationId === orgId && access.canView) {
        conventionHubOk = true
      }
    }
    if (!conventionHubOk && !(await canViewOrg(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).chatEnabled) return reply.status(404).send({ error: 'Chat disabled' })
    const categories = await db
      .select()
      .from(schema.orgChannelCategories)
      .where(eq(schema.orgChannelCategories.organizationId, orgId))
      .orderBy(asc(schema.orgChannelCategories.sortOrder), asc(schema.orgChannelCategories.name))
    let rows = await db
      .select()
      .from(schema.orgChannels)
      .where(eq(schema.orgChannels.organizationId, orgId))
      .orderBy(asc(schema.orgChannels.name))
    if (forConventionId && conventionHubOk) {
      const mem = viewerId ? await getMembership(orgId, viewerId) : null
      rows = rows.filter((ch) => {
        if (ch.requiresConventionId === forConventionId) return true
        if (ch.requiresConventionId === null && mem) return true
        return false
      })
    }
    const visible: typeof rows = []
    for (const ch of rows) {
      if (await viewerCanAccessOrgChannel(ch, viewerId, org)) visible.push(ch)
    }
    return reply.send({ categories, items: visible })
  })

  const channelBody = z.object({
    slug: z.string().min(1).max(64),
    name: z.string().min(1).max(255),
    categoryId: z.string().uuid().nullable().optional(),
    kind: z.enum(['TEXT', 'ANNOUNCEMENTS', 'VOICE', 'VIDEO', 'LIVE_STREAM', 'DISCORD']).optional(),
    embedUrl: z.string().min(1).max(512).optional(),
  })
  app.post('/api/v1/organizations/:orgKey/channels', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled)
      return reply.status(400).send({ error: 'Chat disabled' })
    const parsed = channelBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const slug = slugify(parsed.data.slug)
    if (slug.length < 1) return reply.status(400).send({ error: 'Invalid slug' })
    if (parsed.data.categoryId) {
      const [c] = await db
        .select()
        .from(schema.orgChannelCategories)
        .where(
          and(
            eq(schema.orgChannelCategories.id, parsed.data.categoryId),
            eq(schema.orgChannelCategories.organizationId, orgId)
          )
        )
        .limit(1)
      if (!c) return reply.status(400).send({ error: 'Unknown channel category' })
    }
    const kind = parsed.data.kind ?? 'TEXT'
    let embedUrl: string | null = null
    if (kind === 'DISCORD') {
      const raw = parsed.data.embedUrl?.trim()
      if (!raw) return reply.status(400).send({ error: 'Discord channels require a server ID or invite URL' })
      const norm = normalizeDiscordChannelEmbed(raw)
      if ('error' in norm) return reply.status(400).send({ error: norm.error })
      embedUrl = norm.embedUrl
    } else if (parsed.data.embedUrl?.trim()) {
      return reply.status(400).send({ error: 'embedUrl is only for Discord channels' })
    }
    try {
      const [ch] = await db
        .insert(schema.orgChannels)
        .values({
          organizationId: orgId,
          categoryId: parsed.data.categoryId ?? null,
          slug,
          name: parsed.data.name,
          kind,
          embedUrl,
        })
        .returning()
      return reply.send({ channel: ch })
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        return reply.status(409).send({ error: 'Slug already exists' })
      }
      throw err
    }
  })

  const channelPatchBody = z.object({
    slowModeSeconds: z.number().int().min(0).max(3600).nullable().optional(),
    requiresConventionId: z.string().uuid().nullable().optional(),
    embedUrl: z.string().min(1).max(512).optional(),
  })
  app.patch('/api/v1/organizations/:orgKey/channels/:channelId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, channelId } = req.params as { orgKey: string; channelId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) return
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled)
      return reply.status(400).send({ error: 'Chat disabled' })
    const parsed = channelPatchBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [ch] = await db
      .select()
      .from(schema.orgChannels)
      .where(and(eq(schema.orgChannels.id, channelId), eq(schema.orgChannels.organizationId, orgId)))
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Not found' })
    let nextEmbedUrl = ch.embedUrl
    if (parsed.data.embedUrl !== undefined) {
      if (ch.kind !== 'DISCORD') return reply.status(400).send({ error: 'embedUrl is only for Discord channels' })
      const norm = normalizeDiscordChannelEmbed(parsed.data.embedUrl)
      if ('error' in norm) return reply.status(400).send({ error: norm.error })
      nextEmbedUrl = norm.embedUrl
    }
    const nextSlow =
      parsed.data.slowModeSeconds === undefined ? ch.slowModeSeconds : parsed.data.slowModeSeconds
    let nextRequires = ch.requiresConventionId
    if (parsed.data.requiresConventionId !== undefined) {
      if (parsed.data.requiresConventionId) {
        const [conv] = await db
          .select({ id: schema.conventions.id, organizationId: schema.conventions.organizationId })
          .from(schema.conventions)
          .where(eq(schema.conventions.id, parsed.data.requiresConventionId))
          .limit(1)
        if (!conv || conv.organizationId !== orgId) {
          return reply.status(400).send({ error: 'Convention must belong to this organization' })
        }
        nextRequires = conv.id
      } else {
        nextRequires = null
      }
    }
    const [updated] = await db
      .update(schema.orgChannels)
      .set({
        slowModeSeconds: nextSlow === null || nextSlow === 0 ? null : nextSlow,
        requiresConventionId: nextRequires,
        embedUrl: nextEmbedUrl,
      })
      .where(eq(schema.orgChannels.id, channelId))
      .returning()
    return reply.send({ channel: updated })
  })

  async function assertChannelAccess(
    ch: typeof schema.orgChannels.$inferSelect,
    org: typeof schema.organizations.$inferSelect,
    viewerId: string | null,
    reply: FastifyReply,
    forConventionId?: string | null,
  ): Promise<boolean> {
    if (!(await viewerCanAccessOrgChannel(ch, viewerId, org))) {
      reply.status(403).send({ error: 'Forbidden' })
      return false
    }
    if (forConventionId && ch.requiresConventionId && ch.requiresConventionId !== forConventionId) {
      reply.status(403).send({ error: 'Forbidden' })
      return false
    }
    if (ch.requiresConventionId) {
      const access = await getConventionWithAccess(ch.requiresConventionId, viewerId)
      if ('notFound' in access || 'forbidden' in access || !access.canView) {
        reply.status(403).send({ error: 'Convention registration required' })
        return false
      }
      return true
    }
    if (!(await canViewOrgMemberContent(org, viewerId))) {
      reply.status(404).send({ error: 'Not found' })
      return false
    }
    return true
  }

  app.get('/api/v1/organizations/:orgKey/channels/:channelId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey, channelId } = req.params as { orgKey: string; channelId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const q = req.query as { forConventionId?: string }
    const forConventionId = q.forConventionId?.trim() || null
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).chatEnabled) return reply.status(404).send({ error: 'Chat disabled' })
    const [ch] = await db
      .select()
      .from(schema.orgChannels)
      .where(and(eq(schema.orgChannels.id, channelId), eq(schema.orgChannels.organizationId, orgId)))
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Not found' })
    if (!(await assertChannelAccess(ch, org, viewerId, reply, forConventionId))) return
    if (ch.kind === 'VOICE' || ch.kind === 'VIDEO' || ch.kind === 'LIVE_STREAM' || ch.kind === 'DISCORD') {
      return reply.send({ items: [] })
    }
    const mem = viewerId ? await getMembership(orgId, viewerId) : null
    const canSeeHidden = Boolean(mem && ROLE_RANK[mem.role] >= ROLE_RANK.MODERATOR)
    const messageWhere = canSeeHidden
      ? eq(schema.orgChannelMessages.orgChannelId, channelId)
      : and(eq(schema.orgChannelMessages.orgChannelId, channelId), isNull(schema.orgChannelMessages.hiddenAt))
    const rows = await db
      .select({
        id: schema.orgChannelMessages.id,
        body: schema.orgChannelMessages.body,
        senderId: schema.orgChannelMessages.senderId,
        createdAt: schema.orgChannelMessages.createdAt,
        username: schema.users.username,
      })
      .from(schema.orgChannelMessages)
      .innerJoin(schema.users, eq(schema.orgChannelMessages.senderId, schema.users.id))
      .where(messageWhere)
      .orderBy(desc(schema.orgChannelMessages.createdAt))
      .limit(100)
    const messageIds = rows.map((r) => r.id)
    const repliesByMessage = new Map<string, Array<{ id: string; body: string; senderId: string; username: string | null; createdAt: Date }>>()
    const reactionsByMessage = new Map<string, Record<string, number>>()
    if (messageIds.length > 0) {
      const replyRows = await db
        .select({
          id: schema.orgChannelMessageReplies.id,
          orgChannelMessageId: schema.orgChannelMessageReplies.orgChannelMessageId,
          body: schema.orgChannelMessageReplies.body,
          senderId: schema.orgChannelMessageReplies.senderId,
          createdAt: schema.orgChannelMessageReplies.createdAt,
          username: schema.users.username,
        })
        .from(schema.orgChannelMessageReplies)
        .innerJoin(schema.users, eq(schema.orgChannelMessageReplies.senderId, schema.users.id))
        .where(inArray(schema.orgChannelMessageReplies.orgChannelMessageId, messageIds))
        .orderBy(asc(schema.orgChannelMessageReplies.createdAt))
      for (const row of replyRows) {
        const bucket = repliesByMessage.get(row.orgChannelMessageId) ?? []
        bucket.push(row)
        repliesByMessage.set(row.orgChannelMessageId, bucket)
      }
      const reactionRows = await db
        .select({
          orgChannelMessageId: schema.orgChannelMessageReactions.orgChannelMessageId,
          kind: schema.orgChannelMessageReactions.kind,
          n: count(schema.orgChannelMessageReactions.id),
        })
        .from(schema.orgChannelMessageReactions)
        .where(inArray(schema.orgChannelMessageReactions.orgChannelMessageId, messageIds))
        .groupBy(schema.orgChannelMessageReactions.orgChannelMessageId, schema.orgChannelMessageReactions.kind)
      for (const row of reactionRows) {
        const bucket = reactionsByMessage.get(row.orgChannelMessageId) ?? {}
        bucket[row.kind] = Number(row.n)
        reactionsByMessage.set(row.orgChannelMessageId, bucket)
      }
    }
    return reply.send({
      items: rows.reverse().map((row) => ({
        ...row,
        replies: repliesByMessage.get(row.id) ?? [],
        reactions: reactionsByMessage.get(row.id) ?? {},
      })),
    })
  })

  const channelMessageBody = z.object({ body: z.string().min(1).max(10000) })
  app.post('/api/v1/organizations/:orgKey/channels/:channelId/messages', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, channelId } = req.params as { orgKey: string; channelId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(channelId)) return reply.status(400).send({ error: 'Invalid id' })
    if (await isUserScopeBanned('organization', orgId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org || !parseOrgFeatureFlags(org.featureFlags).chatEnabled)
      return reply.status(400).send({ error: 'Chat disabled' })
    const [ch] = await db
      .select()
      .from(schema.orgChannels)
      .where(and(eq(schema.orgChannels.id, channelId), eq(schema.orgChannels.organizationId, orgId)))
      .limit(1)
    if (!ch) return reply.status(404).send({ error: 'Not found' })
    if (!(await viewerCanAccessOrgChannel(ch, user.userId, org))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const mem = await getMembership(orgId, user.userId)
    if (!ch.requiresConventionId && !mem) return reply.status(403).send({ error: 'Members only' })
    if (ch.requiresConventionId) {
      const access = await getConventionWithAccess(ch.requiresConventionId, user.userId)
      if ('notFound' in access || 'forbidden' in access || !access.canView) {
        return reply.status(403).send({ error: 'Convention registration required' })
      }
    }
    if (ch.kind === 'VOICE' || ch.kind === 'VIDEO' || ch.kind === 'LIVE_STREAM' || ch.kind === 'DISCORD') {
      return reply.status(400).send({ error: 'This channel does not support text messages' })
    }
    if (ch.kind === 'ANNOUNCEMENTS' && !(await requireMinRole(orgId, user.userId, 'MODERATOR', reply))) {
      return
    }
    const modBypass = Boolean(mem && ROLE_RANK[mem.role] >= ROLE_RANK.MODERATOR)
    const slow = ch.slowModeSeconds
    if (slow != null && slow > 0 && !modBypass) {
      const [lastMsg] = await db
        .select({ createdAt: schema.orgChannelMessages.createdAt })
        .from(schema.orgChannelMessages)
        .where(
          and(
            eq(schema.orgChannelMessages.orgChannelId, channelId),
            eq(schema.orgChannelMessages.senderId, user.userId)
          )
        )
        .orderBy(desc(schema.orgChannelMessages.createdAt))
        .limit(1)
      if (lastMsg?.createdAt) {
        const elapsed = Date.now() - new Date(lastMsg.createdAt).getTime()
        if (elapsed < slow * 1000) {
          return reply.status(429).send({ error: `Slow mode: wait ${slow}s between messages` })
        }
      }
    }
    const parsed = channelMessageBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [msg] = await db
      .insert(schema.orgChannelMessages)
      .values({
        orgChannelId: channelId,
        senderId: user.userId,
        body: parsed.data.body,
      })
      .returning()
    publishToScope(`org:${orgId}:channel:${channelId}`, 'org_channel_message_created', {
      message: msg,
      orgId,
      channelId,
      kind: ch.kind,
    })
    if (ch.kind === 'ANNOUNCEMENTS') {
      emitActivity({
        actorId: user.userId,
        verb: 'org_announcement',
        objectType: 'organization',
        objectId: orgId,
        metadata: {
          orgName: org.displayName,
          orgSlug: org.slug,
          preview: parsed.data.body.slice(0, 160),
          channelId,
          messageId: msg?.id,
        },
      })
      const members = await db
        .select({ userId: schema.organizationMembers.userId })
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, orgId))
      for (const member of members) {
        if (member.userId === user.userId) continue
        await createNotification(member.userId, 'org_announcement', {
          orgId,
          channelId,
          messageId: msg?.id,
          preview: parsed.data.body.slice(0, 160),
        })
      }
      publishToScope(`org:${orgId}:announcements`, 'org_announcement_created', {
        channelId,
        messageId: msg?.id,
      })
    }
    return reply.send({ message: msg })
  })

  app.post('/api/v1/organizations/:orgKey/channels/:channelId/messages/:messageId/replies', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, channelId, messageId } = req.params as {
      orgKey: string
      channelId: string
      messageId: string
    }
    if (!UUID_RE.test(channelId) || !UUID_RE.test(messageId)) return reply.status(400).send({ error: 'Invalid id' })
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (await isUserScopeBanned('organization', orgId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }
    const [msg] = await db
      .select({ id: schema.orgChannelMessages.id })
      .from(schema.orgChannelMessages)
      .innerJoin(schema.orgChannels, eq(schema.orgChannelMessages.orgChannelId, schema.orgChannels.id))
      .where(
        and(eq(schema.orgChannelMessages.id, messageId), eq(schema.orgChannels.id, channelId), eq(schema.orgChannels.organizationId, orgId))
      )
      .limit(1)
    if (!msg) return reply.status(404).send({ error: 'Message not found' })
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    const [chRow] = await db
      .select()
      .from(schema.orgChannels)
      .where(eq(schema.orgChannels.id, channelId))
      .limit(1)
    if (!chRow || !org || !(await viewerCanAccessOrgChannel(chRow, user.userId, org))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (!chRow.requiresConventionId && !(await getMembership(orgId, user.userId))) {
      return reply.status(403).send({ error: 'Members only' })
    }
    const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [inserted] = await db
      .insert(schema.orgChannelMessageReplies)
      .values({
        orgChannelMessageId: messageId,
        senderId: user.userId,
        body: parsed.data.body,
      })
      .returning()
    publishToScope(`org:${orgId}:channel:${channelId}`, 'org_channel_message_reply_created', {
      messageId,
      reply: inserted,
    })
    return reply.send({ reply: inserted })
  })

  app.post('/api/v1/organizations/:orgKey/channels/:channelId/messages/:messageId/reactions', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, channelId, messageId } = req.params as {
      orgKey: string
      channelId: string
      messageId: string
    }
    if (!UUID_RE.test(channelId) || !UUID_RE.test(messageId)) return reply.status(400).send({ error: 'Invalid id' })
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (await isUserScopeBanned('organization', orgId, user.userId)) {
      return reply.status(403).send({ error: 'You are banned from participating in this organization' })
    }
    const parsed = z
      .object({ kind: z.enum(['like', 'fire', 'heart', 'mind_blown']) })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [msg] = await db
      .select({ id: schema.orgChannelMessages.id })
      .from(schema.orgChannelMessages)
      .innerJoin(schema.orgChannels, eq(schema.orgChannelMessages.orgChannelId, schema.orgChannels.id))
      .where(
        and(eq(schema.orgChannelMessages.id, messageId), eq(schema.orgChannels.id, channelId), eq(schema.orgChannels.organizationId, orgId))
      )
      .limit(1)
    if (!msg) return reply.status(404).send({ error: 'Message not found' })
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    const [chRow] = await db
      .select()
      .from(schema.orgChannels)
      .where(eq(schema.orgChannels.id, channelId))
      .limit(1)
    if (!chRow || !org || !(await viewerCanAccessOrgChannel(chRow, user.userId, org))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    if (!chRow.requiresConventionId && !(await getMembership(orgId, user.userId))) {
      return reply.status(403).send({ error: 'Members only' })
    }
    const [existing] = await db
      .select({ id: schema.orgChannelMessageReactions.id })
      .from(schema.orgChannelMessageReactions)
      .where(
        and(
          eq(schema.orgChannelMessageReactions.orgChannelMessageId, messageId),
          eq(schema.orgChannelMessageReactions.userId, user.userId),
          eq(schema.orgChannelMessageReactions.kind, parsed.data.kind)
        )
      )
      .limit(1)
    if (existing) {
      await db.delete(schema.orgChannelMessageReactions).where(eq(schema.orgChannelMessageReactions.id, existing.id))
      publishToScope(`org:${orgId}:channel:${channelId}`, 'org_channel_message_reaction_removed', {
        messageId,
        userId: user.userId,
        kind: parsed.data.kind,
      })
      return reply.send({ ok: true, active: false })
    }
    const [reaction] = await db
      .insert(schema.orgChannelMessageReactions)
      .values({
        orgChannelMessageId: messageId,
        userId: user.userId,
        kind: parsed.data.kind,
      })
      .returning()
    publishToScope(`org:${orgId}:channel:${channelId}`, 'org_channel_message_reaction_added', {
      messageId,
      reaction,
    })
    return reply.send({ ok: true, active: true })
  })

  /* --- Gallery --- */
  app.get('/api/v1/organizations/:orgKey/gallery', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const member = viewerId ? await getMembership(orgId, viewerId) : null
    if (!org.galleryPublic && !member) {
      return reply.status(403).send({ error: 'Gallery is visible to members only' })
    }
    const rows = await db
      .select()
      .from(schema.organizationGalleryImages)
      .where(eq(schema.organizationGalleryImages.organizationId, orgId))
      .orderBy(asc(schema.organizationGalleryImages.sortOrder), asc(schema.organizationGalleryImages.createdAt))
    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        imageUrl: r.imageUrl,
        caption: r.caption,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt,
      })),
    })
  })

  app.post('/api/v1/organizations/:orgKey/gallery', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    if (!(await requireMinRole(orgId, user.userId, 'ADMIN', reply))) return
    const parsed = galleryPostBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [row] = await db
      .insert(schema.organizationGalleryImages)
      .values({
        organizationId: orgId,
        imageUrl: parsed.data.imageUrl,
        caption: parsed.data.caption ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.send({ image: row })
  })

  app.delete('/api/v1/organizations/:orgKey/gallery/:imageId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey, imageId } = req.params as { orgKey: string; imageId: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId || !UUID_RE.test(imageId)) return reply.status(400).send({ error: 'Invalid id' })
    if (!(await requireMinRole(orgId, user.userId, 'ADMIN', reply))) return
    const [del] = await db
      .delete(schema.organizationGalleryImages)
      .where(
        and(
          eq(schema.organizationGalleryImages.id, imageId),
          eq(schema.organizationGalleryImages.organizationId, orgId)
        )
      )
      .returning()
    if (!del) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  /* --- Activity (forum + chat, merged) --- */
  app.get('/api/v1/organizations/:orgKey/activity', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const q = req.query as { limit?: string }
    const limit = Math.min(50, Math.max(1, parseInt(String(q?.limit ?? '30'), 10) || 30))

    const flags = parseOrgFeatureFlags(org.featureFlags)
    const out: {
      type: 'forum_thread' | 'chat_message'
      at: string
      threadId?: string
      title?: string
      messageId?: string
      channelId?: string
      channelName?: string
      bodyPreview?: string
      username?: string
    }[] = []

    if (flags.forumsEnabled) {
      const threadRows = await db
        .select({
          id: schema.forumThreads.id,
          title: schema.forumThreads.title,
          updatedAt: schema.forumThreads.updatedAt,
        })
        .from(schema.forumThreads)
        .where(eq(schema.forumThreads.organizationId, orgId))
        .orderBy(desc(schema.forumThreads.updatedAt))
        .limit(20)
      for (const t of threadRows) {
        out.push({
          type: 'forum_thread',
          at: t.updatedAt.toISOString(),
          threadId: t.id,
          title: t.title,
        })
      }
    }

    if (flags.chatEnabled) {
      const mem = viewerId ? await getMembership(orgId, viewerId) : null
      const canSeeHidden = Boolean(mem && ROLE_RANK[mem.role] >= ROLE_RANK.MODERATOR)
      const chatWhere = canSeeHidden
        ? eq(schema.orgChannels.organizationId, orgId)
        : and(eq(schema.orgChannels.organizationId, orgId), isNull(schema.orgChannelMessages.hiddenAt))
      const chatRows = await db
        .select({
          id: schema.orgChannelMessages.id,
          body: schema.orgChannelMessages.body,
          createdAt: schema.orgChannelMessages.createdAt,
          channelId: schema.orgChannels.id,
          channelName: schema.orgChannels.name,
          requiresConventionId: schema.orgChannels.requiresConventionId,
          username: schema.users.username,
        })
        .from(schema.orgChannelMessages)
        .innerJoin(schema.orgChannels, eq(schema.orgChannelMessages.orgChannelId, schema.orgChannels.id))
        .innerJoin(schema.users, eq(schema.orgChannelMessages.senderId, schema.users.id))
        .where(chatWhere)
        .orderBy(desc(schema.orgChannelMessages.createdAt))
        .limit(20)
      const conventionAccess = new Map<string, boolean>()
      for (const m of chatRows) {
        if (m.requiresConventionId) {
          let allowed = conventionAccess.get(m.requiresConventionId)
          if (allowed === undefined) {
            if (!viewerId) {
              allowed = false
            } else {
              const access = await getConventionWithAccess(m.requiresConventionId, viewerId)
              allowed = !('notFound' in access) && !('forbidden' in access) && access.canView
            }
            conventionAccess.set(m.requiresConventionId, allowed)
          }
          if (!allowed) continue
        }
        out.push({
          type: 'chat_message',
          at: m.createdAt.toISOString(),
          messageId: m.id,
          channelId: m.channelId,
          channelName: m.channelName,
          bodyPreview: m.body.length > 200 ? `${m.body.slice(0, 200)}…` : m.body,
          username: m.username ?? undefined,
        })
      }
    }

    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return reply.send({ items: out.slice(0, limit) })
  })

  /* --- Reviews --- */
  app.get('/api/v1/organizations/:orgKey/reviews', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    const rows = await db
      .select({
        id: schema.organizationReviews.id,
        rating: schema.organizationReviews.rating,
        body: schema.organizationReviews.body,
        createdAt: schema.organizationReviews.createdAt,
        authorId: schema.organizationReviews.authorId,
        username: schema.users.username,
      })
      .from(schema.organizationReviews)
      .innerJoin(schema.users, eq(schema.organizationReviews.authorId, schema.users.id))
      .where(eq(schema.organizationReviews.organizationId, orgId))
      .orderBy(desc(schema.organizationReviews.createdAt))
      .limit(50)
    return reply.send({ items: rows })
  })

  const reviewBody = z.object({
    rating: z.number().int().min(1).max(5),
    body: z.string().max(4000).optional(),
  })
  app.post('/api/v1/organizations/:orgKey/reviews', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    const staff = await getMembership(orgId, user.userId)
    if (staff && ROLE_RANK[staff.role] >= ROLE_RANK.STAFF) {
      return reply.status(400).send({ error: 'Staff cannot review their own organization' })
    }
    if (!(await userAttendedAnyOrgEvent(user.userId, orgId))) {
      return reply.status(403).send({ error: 'Attend an organization event before leaving a review' })
    }
    const parsed = reviewBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    try {
      await db.insert(schema.organizationReviews).values({
        organizationId: orgId,
        authorId: user.userId,
        rating: parsed.data.rating,
        body: parsed.data.body,
      })
    } catch {
      return reply.status(409).send({ error: 'You already reviewed this organization' })
    }
    await recalculateOrganizationRating(orgId)
    await propagateTrustFromOrgReview(orgId, parsed.data.rating)
    return reply.send({ ok: true })
  })

  app.get('/api/v1/organizations/:orgKey/events', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrg(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).calendarEnabled) return reply.status(404).send({ error: 'Calendar disabled' })
    const rows = await db
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
        createdAt: schema.events.createdAt,
        hostUsername: schema.users.username,
        hostDisplayName: schema.profiles.displayName,
        hostVerified: schema.profiles.verified,
      })
      .from(schema.events)
      .innerJoin(schema.users, eq(schema.events.hostId, schema.users.id))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(eq(schema.events.organizationId, orgId))
      .orderBy(desc(schema.events.startsAt))
      .limit(100)
    const orgMember = await isOrgMember(org, viewerId)
    const visibleRows = []
    for (const row of rows) {
      if (await canViewerSeeGroupEvent(viewerId, row, orgMember)) visibleRows.push(row)
    }
    const joinVisible = await virtualJoinLinkVisibleEventIds(
      viewerId,
      visibleRows.map((r) => ({
        id: r.id,
        hostId: r.hostId,
        organizationId: r.organizationId,
        eventFormat: r.eventFormat,
      }))
    )
    const physicalVisible = await physicalLocationDetailVisibleEventIds(
      viewerId,
      visibleRows.map((r) => ({
        id: r.id,
        hostId: r.hostId,
        organizationId: r.organizationId,
        eventFormat: r.eventFormat,
        locationVisibility: r.locationVisibility ?? 'public',
      }))
    )
    const programMap = await getProgramSummariesForEventIds(visibleRows.map((r) => r.id))
    const rsvpMap = new Map<string, 'going' | 'maybe' | 'waitlist'>()
    if (viewerId && visibleRows.length > 0) {
      const eids = visibleRows.map((r) => r.id)
      const rsvpRows = await db
        .select({
          eventId: schema.eventRsvps.eventId,
          status: schema.eventRsvps.status,
        })
        .from(schema.eventRsvps)
        .where(and(eq(schema.eventRsvps.userId, viewerId), inArray(schema.eventRsvps.eventId, eids)))
      for (const rr of rsvpRows) {
        if (rr.status === 'going' || rr.status === 'maybe' || rr.status === 'waitlist') {
          rsvpMap.set(rr.eventId, rr.status)
        }
      }
    }
    return reply.send({
      items: visibleRows.map((r) => {
        const p = programMap.get(r.id)
        const shaped = applyEventLocationRedaction(r, joinVisible, physicalVisible)
        return {
          ...shaped,
          hasProgram: Boolean(p),
          conventionSlug: p?.slug ?? null,
          programSlotCount: p?.slotCount ?? 0,
          viewerRsvpStatus: rsvpMap.get(r.id) ?? null,
        }
      }),
    })
  })

  app.get('/api/v1/organizations/:orgKey/conventions', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgKey } = req.params as { orgKey: string }
    const orgId = await resolveOrganizationId(orgKey)
    if (!orgId) return reply.status(404).send({ error: 'Not found' })
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canViewOrgMemberContent(org, viewerId))) return reply.status(404).send({ error: 'Not found' })
    if (!parseOrgFeatureFlags(org.featureFlags).calendarEnabled) return reply.status(404).send({ error: 'Calendar disabled' })
    const rows = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.organizationId, orgId))
      .orderBy(desc(schema.conventions.startsAt))
      .limit(50)
    const ids = rows.map((r) => r.id)
    const countMap = new Map<string, number>()
    if (ids.length > 0) {
      const countRows = await db
        .select({
          conventionId: schema.scheduleSlots.conventionId,
          cnt: sql<number>`cast(count(*) as int)`,
        })
        .from(schema.scheduleSlots)
        .where(inArray(schema.scheduleSlots.conventionId, ids))
        .groupBy(schema.scheduleSlots.conventionId)
      for (const cr of countRows) {
        countMap.set(cr.conventionId, cr.cnt)
      }
    }
    return reply.send({
      items: rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        anchorEventId: c.anchorEventId,
        timezone: c.timezone,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        slotCount: countMap.get(c.id) ?? 0,
        settings: c.settings ?? {},
      })),
    })
  })

  app.get('/api/v1/events/:eventId/reviews', async (req, reply) => {
    if (!requireDb(reply)) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const rows = await db
      .select({
        id: schema.organizationEventReviews.id,
        rating: schema.organizationEventReviews.rating,
        body: schema.organizationEventReviews.body,
        createdAt: schema.organizationEventReviews.createdAt,
        authorId: schema.organizationEventReviews.authorId,
        username: schema.users.username,
      })
      .from(schema.organizationEventReviews)
      .innerJoin(schema.users, eq(schema.organizationEventReviews.authorId, schema.users.id))
      .where(eq(schema.organizationEventReviews.eventId, eventId))
      .orderBy(desc(schema.organizationEventReviews.createdAt))
      .limit(50)
    return reply.send({ items: rows })
  })

  app.post('/api/v1/events/:eventId/reviews', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { eventId } = req.params as { eventId: string }
    if (!UUID_RE.test(eventId)) return reply.status(400).send({ error: 'Invalid event id' })
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    if (!ev?.organizationId) return reply.status(400).send({ error: 'Event has no organization' })
    const parsed = reviewBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const staff = await getMembership(ev.organizationId, user.userId)
    if (staff && ROLE_RANK[staff.role] >= ROLE_RANK.STAFF) {
      return reply.status(400).send({ error: 'Staff cannot review org events for their organization' })
    }
    if (!(await userAttendedEvent(user.userId, eventId))) {
      return reply.status(403).send({ error: 'Attend this event before leaving a review' })
    }
    try {
      await db.insert(schema.organizationEventReviews).values({
        eventId,
        authorId: user.userId,
        rating: parsed.data.rating,
        body: parsed.data.body,
      })
    } catch {
      return reply.status(409).send({ error: 'You already reviewed this event' })
    }
    await recalculateOrganizationRating(ev.organizationId)
    await propagateTrustFromEventReview(ev.organizationId, parsed.data.rating)
    return reply.send({ ok: true })
  })
}
