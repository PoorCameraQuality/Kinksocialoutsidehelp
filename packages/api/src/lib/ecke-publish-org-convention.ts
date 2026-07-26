import { and, asc, eq } from 'drizzle-orm'
import { APP_URL } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import type { ConventionPublicSettings } from '../db/schema.js'
import { resolveConventionCommandAccess } from './convention-command-access.js'
import { filterSlotsForPublicProgram } from './convention-program-policy.js'
import {
  buildEckeDungeonRowFromOrg,
  isOrgDungeonListing,
} from './ecke-directory-sync.js'
import {
  buildConventionListingPayload,
  buildDancecardEventPayload,
  buildOrgListingPayload,
  hashEckePayload,
  isDancecardPublishEnabled,
  type EckeDancecardEventPayload,
  type EckeListingPayload,
} from './ecke-publish-payload.js'
import { parseOrgFeatureFlags } from './org-features.js'
import { resolveVenueGeoFromFlags } from './org-venue-sync.js'

export type OrgEckePublishRow = {
  id: string
  slug: string
  displayName: string
  bio: string | null
  logoUrl: string | null
  visibility: string
  featureFlags: unknown
  externalSiteUrl: string | null
}

const ORG_ROLE_RANK: Record<string, number> = {
  MEMBER: 1,
  STAFF: 2,
  MODERATOR: 3,
  ADMIN: 4,
  OWNER: 5,
}

export function isPublicOrgVisibility(visibility: string): boolean {
  return visibility.toUpperCase() === 'PUBLIC'
}

export function getOrgListingIneligibilityReason(org: Pick<OrgEckePublishRow, 'visibility'>): string | null {
  if (!isPublicOrgVisibility(org.visibility)) {
    return 'Only public organizations can publish to East Coast Kink Events.'
  }
  return null
}

export function getDungeonProfileIneligibilityReason(org: Pick<OrgEckePublishRow, 'visibility' | 'featureFlags'>): string | null {
  if (!isOrgDungeonListing(org.featureFlags)) {
    return 'This organization is not configured as a public dungeon/venue listing.'
  }
  return getOrgListingIneligibilityReason(org)
}

export function buildOrgDungeonEckeRow(org: OrgEckePublishRow) {
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

export function buildOrgListingPublishContext(org: OrgEckePublishRow) {
  const listingPayload = buildOrgListingPayload(org)
  const contentHash = hashEckePayload(listingPayload)
  const reason = getOrgListingIneligibilityReason(org)
  return {
    listingPayload,
    contentHash,
    eligibility: reason ? { eligible: false as const, reason } : { eligible: true as const },
    canonicalKinkSocialUrl: `${APP_URL}/organizations/${encodeURIComponent(org.slug)}`,
    externalSlug: listingPayload.slug,
  }
}

export function buildOrgDungeonPublishContext(org: OrgEckePublishRow) {
  // Legacy interim path: org-flagged dungeon rows via Supabase REST.
  // Phase 0+: place listings publish from community_places (venue_profile / place ingest), not org profile.
  const payload = buildOrgDungeonEckeRow(org)
  const contentHash = hashEckePayload(payload)
  const reason = getDungeonProfileIneligibilityReason(org)
  return {
    payload,
    contentHash,
    eligibility: reason ? { eligible: false as const, reason } : { eligible: true as const },
    canonicalKinkSocialUrl: `${APP_URL}/organizations/${encodeURIComponent(org.slug)}`,
    externalSlug: payload.slug,
  }
}

export async function loadOrgEckePublishRow(orgKey: string): Promise<OrgEckePublishRow | null> {
  const trimmed = orgKey.trim()
  if (!trimmed) return null
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const where = uuidRe.test(trimmed) ? eq(schema.organizations.id, trimmed) : eq(schema.organizations.slug, trimmed)
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
    })
    .from(schema.organizations)
    .where(where)
    .limit(1)
  return row ?? null
}

export async function resolveOrgEckePublishAccess(orgKey: string, userId: string) {
  const org = await loadOrgEckePublishRow(orgKey)
  if (!org) return null
  const [member] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.organizationId, org.id), eq(schema.organizationMembers.userId, userId)))
    .limit(1)
  if (!member) return { org, canManage: false, orgRole: null as string | null }
  const canManage = (ORG_ROLE_RANK[member.role] ?? 0) >= ORG_ROLE_RANK.MODERATOR
  return { org, canManage, orgRole: member.role }
}

export type ConventionEckeContext = {
  conv: {
    id: string
    slug: string
    name: string
    description: string | null
    timezone: string
    startsAt: Date
    endsAt: Date
    settings: ConventionPublicSettings | null
    organizationId: string | null
    anchorEventId: string | null
  }
  org: { slug: string; displayName: string; logoUrl: string | null } | null
  anchor: Parameters<typeof buildConventionListingPayload>[0]['anchor']
  slots: Parameters<typeof buildDancecardEventPayload>[0]['slots']
  locations: Parameters<typeof buildDancecardEventPayload>[0]['locations']
  volunteerShifts: Parameters<typeof buildDancecardEventPayload>[0]['volunteerShifts']
  canManage: boolean
}

export async function loadConventionEckeContext(conventionKey: string, userId: string): Promise<ConventionEckeContext | null> {
  const trimmed = conventionKey.trim()
  if (!trimmed) return null
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const where = uuidRe.test(trimmed) ? eq(schema.conventions.id, trimmed) : eq(schema.conventions.slug, trimmed)

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
    .where(where)
    .limit(1)
  if (!conv || !conv.organizationId) return null

  const [convRow] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, conv.id)).limit(1)
  if (!convRow) return null
  const access = await resolveConventionCommandAccess(convRow, userId)
  const canManage = access.permissions.isFullAdmin

  const [orgRow] = await db
    .select({
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
      logoUrl: schema.organizations.logoUrl,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, conv.organizationId))
    .limit(1)

  let anchor: ConventionEckeContext['anchor'] = null
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
    .orderBy(asc(schema.scheduleSlots.startsAt))

  const slots = filterSlotsForPublicProgram(slotsRaw, 'anonymous').map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    title: s.title,
    description: s.description,
    location: s.location,
    trackLabel: s.trackLabel,
    roomLabel: s.roomLabel,
    locationId: s.locationId,
    sortOrder: s.sortOrder,
  }))

  const locations = await db
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
    .orderBy(asc(schema.conventionVolunteerShifts.startsAt))

  return {
    conv,
    org: orgRow ?? null,
    anchor,
    slots,
    locations,
    volunteerShifts,
    canManage,
  }
}

export function buildConventionListingPublishContext(ctx: ConventionEckeContext) {
  const listingPayload = buildConventionListingPayload({
    conventionSlug: ctx.conv.slug,
    conventionName: ctx.conv.name,
    conventionDescription: ctx.conv.description,
    startsAt: ctx.conv.startsAt,
    endsAt: ctx.conv.endsAt,
    settings: ctx.conv.settings,
    orgSlug: ctx.org?.slug ?? null,
    orgDisplayName: ctx.org?.displayName ?? null,
    anchor: ctx.anchor,
  })
  const contentHash = hashEckePayload(listingPayload)
  return {
    listingPayload,
    contentHash,
    eligibility: { eligible: true as const },
    canonicalKinkSocialUrl: `${APP_URL}/conventions/${encodeURIComponent(ctx.conv.slug)}`,
    externalSlug: listingPayload.slug,
  }
}

export function buildDancecardPublishContext(ctx: ConventionEckeContext) {
  if (!isDancecardPublishEnabled(ctx.conv.settings)) {
    return {
      payload: null as EckeDancecardEventPayload | null,
      contentHash: null as string | null,
      eligibility: { eligible: false as const, reason: 'Dancecard publish is disabled for this convention.' },
      canonicalKinkSocialUrl: `${APP_URL}/conventions/${encodeURIComponent(ctx.conv.slug)}`,
      externalSlug: null as string | null,
      slotCount: 0,
      staffShiftCount: 0,
    }
  }
  const payload = buildDancecardEventPayload({
    conventionSlug: ctx.conv.slug,
    conventionName: ctx.conv.name,
    conventionDescription: ctx.conv.description,
    timezone: ctx.conv.timezone,
    startsAt: ctx.conv.startsAt,
    endsAt: ctx.conv.endsAt,
    settings: ctx.conv.settings,
    orgDisplayName: ctx.org?.displayName ?? null,
    orgSlug: ctx.org?.slug ?? null,
    logoUrl: ctx.org?.logoUrl ?? null,
    locations: ctx.locations,
    slots: ctx.slots,
    volunteerShifts: ctx.volunteerShifts,
  })
  const contentHash = hashEckePayload(payload)
  return {
    payload,
    contentHash,
    eligibility: { eligible: true as const },
    canonicalKinkSocialUrl: `${APP_URL}/conventions/${encodeURIComponent(ctx.conv.slug)}`,
    externalSlug: payload.slug,
    slotCount: ctx.slots.length,
    staffShiftCount: ctx.volunteerShifts?.length ?? 0,
  }
}

/** Public-safe dancecard payload for preview — access codes redacted. */
export function redactDancecardPayloadForPreview(payload: EckeDancecardEventPayload): EckeDancecardEventPayload {
  return {
    ...payload,
    staffAccessCode: payload.staffAccessCode ? '[configured]' : null,
    registrationAccessCode: payload.registrationAccessCode ? '[configured]' : null,
  }
}

export function buildOrgListingPlainFields(
  ctx: ReturnType<typeof buildOrgListingPublishContext>,
): Array<{ label: string; value: string | null }> {
  const p = ctx.listingPayload
  return [
    { label: 'Organization name', value: p.title },
    { label: 'Slug', value: p.slug },
    { label: 'Public description', value: p.description ?? null },
    { label: 'Public location summary', value: p.location ?? null },
    { label: 'Public logo', value: p.imageUrl ?? null },
    { label: 'Canonical kink.social org URL', value: ctx.canonicalKinkSocialUrl },
    { label: 'Visibility', value: p.visibility },
  ]
}

export function buildDungeonPlainFields(
  ctx: ReturnType<typeof buildOrgDungeonPublishContext>,
): Array<{ label: string; value: string | null }> {
  const p = ctx.payload
  return [
    { label: 'Venue name', value: p.name ?? null },
    { label: 'Slug', value: p.slug },
    { label: 'Public description', value: p.description ?? null },
    { label: 'City', value: p.city ?? null },
    { label: 'State', value: p.state ?? null },
    { label: 'Public website', value: p.website_url ?? null },
    { label: 'Exact address published', value: p.private_address === false ? 'No — region summary only unless explicitly public' : 'No' },
    { label: 'Canonical kink.social org URL', value: ctx.canonicalKinkSocialUrl },
  ]
}

export function buildConventionListingPlainFields(
  ctx: ReturnType<typeof buildConventionListingPublishContext>,
): Array<{ label: string; value: string | null }> {
  const p = ctx.listingPayload
  return [
    { label: 'Convention title', value: p.title },
    { label: 'Slug', value: p.slug },
    { label: 'Public description', value: p.description ?? null },
    { label: 'Dates', value: p.startsAt ? `${p.startsAt}${p.endsAt ? ` – ${p.endsAt}` : ''}` : null },
    { label: 'Public location summary', value: p.location ?? null },
    { label: 'Organizer attribution', value: p.orgDisplayName ?? null },
    { label: 'Registration CTA', value: p.memberActionUrl ?? null },
    { label: 'Canonical kink.social convention URL', value: ctx.canonicalKinkSocialUrl },
  ]
}

export function buildDancecardPlainFields(
  ctx: ReturnType<typeof buildDancecardPublishContext>,
): Array<{ label: string; value: string | null }> {
  if (!ctx.payload) return [{ label: 'Status', value: ctx.eligibility.reason ?? 'Not eligible' }]
  const p = redactDancecardPayloadForPreview(ctx.payload)
  return [
    { label: 'Dancecard title', value: p.eventTitle },
    { label: 'Slug', value: p.slug },
    { label: 'Timezone', value: p.timezone },
    { label: 'Window', value: `${p.windowStartsAt} – ${p.windowEndsAt}` },
    { label: 'Public locations', value: String(p.locations.length) },
    { label: 'Public program slots', value: String(p.slots.length) },
    { label: 'Public staff shifts', value: String(p.staffShifts.length) },
    { label: 'Staff access code', value: p.staffAccessCode ?? null },
    { label: 'Registration access code', value: p.registrationAccessCode ?? null },
    { label: 'Canonical kink.social convention URL', value: ctx.canonicalKinkSocialUrl },
  ]
}
