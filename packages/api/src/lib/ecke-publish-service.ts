/**
 * ECKE publish control-plane service: access checks, previews, and execute/unpublish
 * for owner-facing source kinds (education, vendors, orgs, events, dancecard, …).
 *
 * Outbound-only (kink.social → ECKE). Safety/eligibility helpers live in
 * `@c2k/shared` (`ecke-publish-safety`). HTTP entry points: `ecke-publish-routes.ts`
 * and control/entity route modules. Full god-file split by entity kind is deferred (A9).
 *
 * @see docs/ECKE_PUBLIC_PUBLISHING_CONTRACT.md
 * @see docs/DOMAIN_GLOSSARY.md
 */
import {
  APP_URL,
  isEckePublishEligible,
  sanitizeEckeExternalUrl,
  sanitizeEckeHeroImageUrl,
} from '@c2k/shared'
import { getVendorShopAccess, type VendorProfileRow } from './vendor-shop-people.js'
import { isUserIdentityBanned } from './peer-reputation.js'
import {
  buildConventionListingPreview,
  buildConventionEventAnchorPreview,
  buildDancecardEventPreview,
  buildDungeonProfilePreview,
  buildOrganizationListingPreview,
  executeConventionEventAnchorPublish,
  executeConventionEventAnchorUnpublish,
  executeConventionListingPublish,
  executeConventionListingUnpublish,
  executeDancecardEventPublish,
  executeDancecardEventUnpublish,
  executeDungeonProfilePublish,
  executeDungeonProfileUnpublish,
  executeOrganizationListingPublish,
  executeOrganizationListingUnpublish,
  FINAL_SUPPORTED_WRITE_KINDS,
  isFinalSupportedWriteKind,
} from './ecke-publish-final-kinds.js'
import {
  buildPresenterProfilePreview,
  buildVenueProfilePreview,
  executePresenterProfilePublish,
  executePresenterProfileUnpublish,
  executeVenueProfilePublish,
  executeVenueProfileUnpublish,
} from './ecke-publish-presenter-venue.js'
import { loadConventionEckeContext } from './ecke-publish-org-convention.js'
import { isEckeEventPublishBridgeConfigured } from './ecke-publish-config.js'
import { buildPhotosPreview } from './ecke-photo-manifest.js'
import { isDancecardPublishEnabled } from './ecke-publish-payload.js'
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  loadEckeIngestApiConfig,
  loadEckePublishClientConfig,
  publishListingToEcke,
  resolveEckePublicEducationUrl,
  resolveEckePublicEventUrl,
  resolveEckePublicVendorUrl,
  unpublishEventRowToEcke,
  unpublishListingToEcke,
} from './ecke-publish-client.js'
import { buildEckeVendorRow } from './ecke-directory-sync.js'
import {
  executeEckeUnpublishEducationArticleWithTargetUpdate,
  executeEckeUnpublishVendorWithTargetUpdate,
} from './ecke-publish-executor.js'
import {
  requestEckeArticlePublish,
  requestEckeStandaloneEventPublish,
  requestEckeVendorPublish,
} from './ecke-publish-queue.js'
import {
  buildGroupListingPayload,
  buildStandaloneEventListingPayload,
  hashEckePayload,
  isStandaloneEventEckeEligible,
  type EckeListingPayload,
} from './ecke-publish-payload.js'
import {
  getEducationDeferredFields,
  getEventDeferredFields,
  getEventOmittedFields,
  getEducationOmittedFields,
  getGroupOmittedFields,
  getVendorDeferredFields,
  getVendorOmittedFields,
  isGroupListingEntityEligible,
  resolvePublicLocationForEcke,
  type EckeOmittedField,
} from './ecke-redaction.js'
import {
  buildEckePublicEnvelopeAsync,
  buildEducationArticleCanonicalUrl,
  getEducationArticleIneligibilityReason,
  type EducationArticleAuthorContext,
  type EducationArticlePublishRow,
} from './ecke-public-publish.js'
import {
  loadEducationArticleAuthorContextForPublish,
  loadEducationArticleForPublish,
} from './ecke-public-publish-executor.js'
import {
  deriveTargetDisplayStatus,
  ensureEckePublishTargetRow,
  loadEckePublishTarget,
  markEckePublishSuccess,
  markEckeUnpublishSuccess,
  touchEckePublishPreview,
  type EckeTargetStatus,
} from './ecke-publish-target-store.js'
import {
  getRegistryEntry,
  isValidEckeSourceKind,
  listAllRegistryEntries,
  listRegistryForGroupDashboard,
  PASS2_DISABLED_ACTIONS,
  type EckeRegistryEntry,
  type EckeSourceKind,
} from './ecke-publish-registry.js'

export const PASS3_UNSUPPORTED_ERROR = {
  errorCode: 'unsupported_in_pass_3',
  message: 'Only group listings can be published from the unified ECKE control plane in this pass.',
} as const

export const PASS4_UNSUPPORTED_ERROR = {
  errorCode: 'unsupported_in_pass_4',
  message:
    'Only group listings and public event listings can be published from the unified ECKE control plane in this pass.',
} as const

export const PASS5_UNSUPPORTED_ERROR = {
  errorCode: 'unsupported_in_pass_5',
  message:
    'This source kind is not enabled in the unified ECKE control plane. See ECKE publish registry for supported kinds.',
} as const

const PASS5_SUPPORTED_WRITE_KINDS = FINAL_SUPPORTED_WRITE_KINDS

export type EckePublishViewer = {
  userId: string
}

export type EckePublishActions = {
  preview: boolean
  publish: boolean
  sync: boolean
  unpublish: boolean
}

export type EckePublishPlainField = {
  label: string
  value: string | null
}

export type EckePublishStatusResult = {
  sourceKind: EckeSourceKind
  sourceId: string
  supportState: EckeRegistryEntry['supportState']
  eligible: boolean
  reason?: string
  status: EckeTargetStatus
  contentHash: string | null
  publishedContentHash: string | null
  lastPublishedAt: string | null
  lastPreviewAt: string | null
  lastError: string | null
  externalSlug: string | null
  eckePublicUrl?: string | null
  eckePublicUrlKnown?: boolean
  currentTransport: EckeRegistryEntry['currentTransport']
  eckeSurfacesAffected: readonly string[]
  actions: EckePublishActions
  readOnlyPass?: boolean
  staleNotice?: string | null
}

export type EckePublishPreviewResult = EckePublishStatusResult & {
  wouldPublish: EckePublishPlainField[]
  wouldPublishDeferred?: EckeOmittedField[]
  wouldNotPublish: EckeOmittedField[]
  payload: unknown
  canonicalKinkSocialUrl: string | null
  locationVisibility?: string
  locationHiddenWarning?: string | null
  photosPreview?: {
    hero: { publicUrl: string; sourceMediaAssetId: string } | null
    galleryCount: number
    mediaHash: string | null
  }
}

export type EckeGroupOverviewCard = {
  section:
    | 'overview'
    | 'group_listing'
    | 'organization_listing'
    | 'convention_listing'
    | 'convention_event_anchor'
    | 'events'
    | 'education'
    | 'places'
    | 'venues'
    | 'vendors'
    | 'dancecard'
    | 'history'
  sourceKind?: EckeSourceKind
  sourceId?: string
  title: string
  supportState: EckeRegistryEntry['supportState'] | 'info'
  eligible?: boolean
  reason?: string
  status?: EckePublishStatusResult['status']
  summary?: string
  preview?: EckePublishPreviewResult
  plannedMessage?: string
  writeEnabled?: boolean
  publishRestrictedMessage?: string
}

export type EckeOrgOverviewResult = {
  organizationId: string
  organizationSlug: string
  organizationName: string
  bridgeConnected: boolean
  passNotice: string
  cards: EckeGroupOverviewCard[]
  history: EckeGroupOverviewResult['history']
}

export type EckeConventionOverviewResult = {
  conventionId: string
  conventionSlug: string
  conventionName: string
  bridgeConnected: boolean
  passNotice: string
  cards: EckeGroupOverviewCard[]
  history: EckeGroupOverviewResult['history']
}

export type EckeGroupOverviewResult = {
  groupId: string
  groupSlug: string
  groupName: string
  bridgeConnected: boolean
  readOnlyPass?: boolean
  passNotice: string
  cards: EckeGroupOverviewCard[]
  history: Array<{
    targetKind: string
    externalSlug: string
    status: string
    lastPublishedAt: string | null
    lastError: string | null
    lastPreviewAt: string | null
  }>
}

const ORG_ROLE_RANK: Record<string, number> = {
  MEMBER: 1,
  STAFF: 2,
  MODERATOR: 3,
  ADMIN: 4,
  OWNER: 5,
}

export function isEckeBridgeConfigured(): boolean {
  return loadEckePublishClientConfig() !== null || loadEckeIngestApiConfig() !== null
}

function pass2Actions(): EckePublishActions {
  return { ...PASS2_DISABLED_ACTIONS }
}

export function computeGroupListingActions(input: {
  eligible: boolean
  status: EckeTargetStatus
  bridgeConfigured: boolean
}): EckePublishActions {
  if (!input.eligible || !input.bridgeConfigured) {
    return { preview: true, publish: false, sync: false, unpublish: false }
  }
  const { status } = input
  return {
    preview: true,
    publish: status === 'never' || status === 'draft' || status === 'unpublished',
    sync: status === 'stale' || status === 'error' || status === 'published',
    unpublish: status === 'published' || status === 'stale' || status === 'error',
  }
}

export const computeEventListingActions = computeGroupListingActions

export const computeEducationArticleActions = computeGroupListingActions

export const computeVendorProfileActions = computeGroupListingActions

export type ArticlePublishAccess = {
  article: EducationArticlePublishRow
  author: EducationArticleAuthorContext
  /** @deprecated Use canPublish — kept for Slice 1 callers */
  canManage: boolean
  canPreview: boolean
  canPublish: boolean
}

export type EducationArticlePreviewScope = {
  organizationId?: string
  groupOrganizationId?: string
  groupModerator?: boolean
}

export type OrgPublishAccess = {
  organization: {
    id: string
    slug: string
    displayName: string
  }
  canManage: boolean
  orgRole: string | null
}

/** Pure permission check — publish writes remain author-only. */
export function canViewerPublishEducationArticleEcke(
  article: EducationArticlePublishRow,
  userId: string,
): boolean {
  return article.authorUserId === userId
}

/** @deprecated Use canViewerPublishEducationArticleEcke */
export function canViewerManageEducationArticleEckePublish(
  article: EducationArticlePublishRow,
  userId: string,
): boolean {
  return canViewerPublishEducationArticleEcke(article, userId)
}

export async function isOrgModeratorForOrganization(orgId: string, userId: string): Promise<boolean> {
  const [member] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId)),
    )
    .limit(1)
  if (!member) return false
  return (ORG_ROLE_RANK[member.role] ?? 0) >= ORG_ROLE_RANK.MODERATOR
}

async function resolveOrganizationIdByKey(orgKey: string): Promise<string | null> {
  const trimmed = orgKey.trim()
  if (!trimmed) return null
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRe.test(trimmed)) return trimmed
  const [row] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, trimmed))
    .limit(1)
  return row?.id ?? null
}

export async function resolveOrgPublishAccess(
  orgKey: string,
  userId: string,
): Promise<OrgPublishAccess | null> {
  const orgId = await resolveOrganizationIdByKey(orgKey)
  if (!orgId) return null

  const [org] = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)
  if (!org) return null

  const [member] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId)),
    )
    .limit(1)

  const orgRole = member?.role ?? null
  const canManage = orgRole !== null && (ORG_ROLE_RANK[orgRole] ?? 0) >= ORG_ROLE_RANK.MODERATOR

  return {
    organization: org,
    canManage,
    orgRole,
  }
}

export async function resolveArticleEckeAccess(
  articleId: string,
  userId: string,
  scope?: EducationArticlePreviewScope,
): Promise<ArticlePublishAccess | null> {
  const article = await loadEducationArticleForPublish(articleId)
  if (!article) return null

  const author = await loadEducationArticleAuthorContextForPublish(article)
  const isAuthor = canViewerPublishEducationArticleEcke(article, userId)

  if (scope?.organizationId && article.organizationId !== scope.organizationId) {
    return { article, author, canPreview: false, canPublish: false, canManage: false }
  }
  if (
    scope?.groupOrganizationId &&
    (!article.organizationId || article.organizationId !== scope.groupOrganizationId)
  ) {
    return { article, author, canPreview: false, canPublish: false, canManage: false }
  }

  let orgModCanPreview = false
  if (article.organizationId) {
    if (scope?.organizationId) {
      orgModCanPreview = await isOrgModeratorForOrganization(scope.organizationId, userId)
    } else if (!scope?.groupOrganizationId) {
      orgModCanPreview = await isOrgModeratorForOrganization(article.organizationId, userId)
    }
  }

  const groupModCanPreview = Boolean(
    scope?.groupModerator && scope.groupOrganizationId && article.organizationId === scope.groupOrganizationId,
  )

  const canPreview = isAuthor || orgModCanPreview || groupModCanPreview
  const canPublish = isAuthor

  return {
    article,
    author,
    canPreview,
    canPublish,
    canManage: canPublish,
  }
}

export async function resolveArticlePublishAccess(
  articleId: string,
  userId: string,
  scope?: EducationArticlePreviewScope,
): Promise<ArticlePublishAccess | null> {
  return resolveArticleEckeAccess(articleId, userId, scope)
}

async function loadOrgLinkedEducationArticleSummaries(orgId: string) {
  return db
    .select({
      id: schema.educationArticles.id,
      title: schema.educationArticles.title,
      slug: schema.educationArticles.slug,
    })
    .from(schema.educationArticles)
    .where(
      and(
        eq(schema.educationArticles.organizationId, orgId),
        ne(schema.educationArticles.publicationStatus, 'ARCHIVED'),
      ),
    )
    .orderBy(desc(schema.educationArticles.updatedAt))
}

async function loadEducationArticleEckeHistory(articleIds: string[]) {
  if (articleIds.length === 0) return []
  return db
    .select({
      targetKind: schema.eckePublishTargets.targetKind,
      externalSlug: schema.eckePublishTargets.externalSlug,
      status: schema.eckePublishTargets.status,
      lastPublishedAt: schema.eckePublishTargets.lastPublishedAt,
      lastError: schema.eckePublishTargets.lastError,
      lastPreviewAt: schema.eckePublishTargets.lastPreviewAt,
    })
    .from(schema.eckePublishTargets)
    .where(
      and(
        inArray(schema.eckePublishTargets.educationArticleId, articleIds),
        eq(schema.eckePublishTargets.targetKind, 'ecke_article'),
      ),
    )
    .orderBy(desc(schema.eckePublishTargets.lastAttemptAt))
}

export const EDUCATION_ECKE_AUTHOR_ONLY_MESSAGE =
  'Only the article author can publish, sync, or unpublish to ECKE. Open the education writer to manage this article.'

export const VENDOR_ECKE_OWNER_ONLY_MESSAGE =
  'Only the vendor owner or approved co-owner can publish this vendor profile to ECKE.'

export type VendorProfilePreviewScope = {
  organizationId?: string
}

export type VendorPublishAccess = {
  vendor: VendorProfileRow
  shopAccess: NonNullable<Awaited<ReturnType<typeof getVendorShopAccess>>>
  canPreview: boolean
  canPublish: boolean
}

/** Vendor shop website must be HTTPS for ECKE publish preview/payload. */
export function sanitizeVendorEckeWebsiteUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed || !/^https:\/\//i.test(trimmed)) return null
  return sanitizeEckeExternalUrl(trimmed)
}

export function getVendorIneligibilityReason(
  vendor: Pick<VendorProfileRow, 'eckePublish' | 'visibility'>,
  ownerBanned = false,
): string | null {
  if (ownerBanned) {
    return 'Vendor owner account is suspended.'
  }
  if (!isEckePublishEligible({ publishToEcke: vendor.eckePublish, visibility: vendor.visibility })) {
    if (!vendor.eckePublish) {
      return 'Vendor has not opted into ECKE publish.'
    }
    if (vendor.visibility !== 'PUBLIC') {
      return 'Only public vendor profiles can publish to ECKE.'
    }
    return 'Vendor is not eligible for ECKE publish.'
  }
  return null
}

export function canViewerPublishVendorProfileEcke(
  vendor: Pick<VendorProfileRow, 'userId'>,
  shopAccess: { canManageShop: boolean },
): boolean {
  return shopAccess.canManageShop
}

export function payloadExcludesPrivateVendorFields(payload: Record<string, unknown>): boolean {
  const serialized = JSON.stringify(payload).toLowerCase()
  const forbidden = [
    'email',
    'phone',
    'secrets',
    'oauth',
    'apikey',
    'api_key',
    'payout',
    'external_store_secrets',
    'etsyshopid',
    'commission_notes',
    'externalstoresecretsenc',
  ]
  return !forbidden.some((token) => serialized.includes(token))
}

export type VendorProfilePublishContext = {
  access: VendorPublishAccess
  payload: ReturnType<typeof buildEckeVendorRow>
  contentHash: string
  eligibility: { eligible: boolean; reason?: string }
  canonicalKinkSocialUrl: string
  externalSlug: string
}

export function buildVendorProfilePublishContext(access: VendorPublishAccess): VendorProfilePublishContext {
  const { vendor } = access
  const website = sanitizeVendorEckeWebsiteUrl(vendor.website)
  const payload = buildEckeVendorRow({
    id: vendor.id,
    slug: vendor.slug,
    displayName: vendor.displayName,
    bio: vendor.bio,
    makerStory: vendor.makerStory,
    website,
    categories: vendor.categories,
    visibility: vendor.visibility,
  })
  const contentHash = hashEckePayload(payload)
  const reason = getVendorIneligibilityReason(vendor)
  return {
    access,
    payload,
    contentHash,
    eligibility: reason ? { eligible: false, reason } : { eligible: true },
    canonicalKinkSocialUrl: `${APP_URL}/vendors/${encodeURIComponent(vendor.slug)}`,
    externalSlug: payload.slug,
  }
}

export function buildVendorProfilePlainFields(
  ctx: VendorProfilePublishContext,
  registry: EckeRegistryEntry,
): EckePublishPlainField[] {
  const { vendor } = ctx.access
  const { payload } = ctx
  const logoUrl = sanitizeEckeHeroImageUrl(vendor.logoUrl)
  const categorySummary = [vendor.category, ...(vendor.categories ?? []), ...(vendor.tags ?? [])]
    .filter(Boolean)
    .join(', ')
  return [
    { label: 'Vendor name', value: payload.name },
    { label: 'Slug', value: payload.slug },
    { label: 'Public description', value: payload.description ?? null },
    { label: 'Public category / tags', value: categorySummary || null },
    { label: 'Public website / shop URL', value: payload.website_url ?? null },
    { label: 'Public logo / image', value: logoUrl ?? null },
    { label: 'Ships to', value: vendor.shipsTo ?? null },
    { label: 'Online only', value: payload.online_only ? 'Yes' : 'No' },
    { label: 'Canonical kink.social vendor URL', value: ctx.canonicalKinkSocialUrl },
    { label: 'Source attribution', value: `${payload.c2k_source_type}:${payload.c2k_source_id}` },
    { label: 'Updated', value: vendor.createdAt?.toISOString?.() ?? null },
    { label: 'Affected ECKE surfaces', value: registry.eckeSurfacesAffected.join('; ') },
  ]
}

async function loadVendorProfileForPublish(vendorProfileId: string): Promise<VendorProfileRow | null> {
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorProfileId))
    .limit(1)
  return vendor ?? null
}

async function loadVendorProfileTarget(vendorProfileId: string) {
  const [row] = await db
    .select()
    .from(schema.eckePublishTargets)
    .where(
      and(
        eq(schema.eckePublishTargets.vendorProfileId, vendorProfileId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_vendor'),
      ),
    )
    .limit(1)
  return row
}

async function isVendorFeaturedByOrganization(orgId: string, vendorProfileId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.organizationFeaturedVendors.id })
    .from(schema.organizationFeaturedVendors)
    .where(
      and(
        eq(schema.organizationFeaturedVendors.organizationId, orgId),
        eq(schema.organizationFeaturedVendors.vendorProfileId, vendorProfileId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

export async function resolveVendorEckeAccess(
  vendorProfileId: string,
  userId: string,
  scope?: VendorProfilePreviewScope,
): Promise<VendorPublishAccess | null> {
  const vendor = await loadVendorProfileForPublish(vendorProfileId)
  if (!vendor) return null

  const shopAccess = await getVendorShopAccess(vendorProfileId, userId)
  if (!shopAccess) return null

  const ownerBanned = await isUserIdentityBanned(vendor.userId)
  const canPublish = !ownerBanned && canViewerPublishVendorProfileEcke(vendor, shopAccess)

  if (scope?.organizationId) {
    const featured = await isVendorFeaturedByOrganization(scope.organizationId, vendorProfileId)
    if (!featured && !shopAccess.canManageShop) {
      return { vendor, shopAccess, canPreview: false, canPublish: false }
    }
    const orgModCanPreview =
      featured && (await isOrgModeratorForOrganization(scope.organizationId, userId))
    const canPreview = canPublish || orgModCanPreview
    return { vendor, shopAccess, canPreview, canPublish }
  }

  const canPreview = canPublish
  return { vendor, shopAccess, canPreview, canPublish }
}

async function loadOrgFeaturedVendorSummaries(orgId: string) {
  return db
    .select({
      id: schema.vendorProfiles.id,
      displayName: schema.vendorProfiles.displayName,
      slug: schema.vendorProfiles.slug,
    })
    .from(schema.organizationFeaturedVendors)
    .innerJoin(
      schema.vendorProfiles,
      eq(schema.organizationFeaturedVendors.vendorProfileId, schema.vendorProfiles.id),
    )
    .where(eq(schema.organizationFeaturedVendors.organizationId, orgId))
    .orderBy(asc(schema.organizationFeaturedVendors.sortOrder))
}

async function loadConventionEckeHistory(conventionId: string) {
  return db
    .select({
      targetKind: schema.eckePublishTargets.targetKind,
      externalSlug: schema.eckePublishTargets.externalSlug,
      status: schema.eckePublishTargets.status,
      lastPublishedAt: schema.eckePublishTargets.lastPublishedAt,
      lastError: schema.eckePublishTargets.lastError,
      lastPreviewAt: schema.eckePublishTargets.lastPreviewAt,
    })
    .from(schema.eckePublishTargets)
    .where(eq(schema.eckePublishTargets.conventionId, conventionId))
    .orderBy(desc(schema.eckePublishTargets.lastAttemptAt))
}

async function loadVendorProfileEckeHistory(vendorProfileIds: string[]) {
  if (vendorProfileIds.length === 0) return []
  return db
    .select({
      targetKind: schema.eckePublishTargets.targetKind,
      externalSlug: schema.eckePublishTargets.externalSlug,
      status: schema.eckePublishTargets.status,
      lastPublishedAt: schema.eckePublishTargets.lastPublishedAt,
      lastError: schema.eckePublishTargets.lastError,
      lastPreviewAt: schema.eckePublishTargets.lastPreviewAt,
    })
    .from(schema.eckePublishTargets)
    .where(
      and(
        inArray(schema.eckePublishTargets.vendorProfileId, vendorProfileIds),
        eq(schema.eckePublishTargets.targetKind, 'ecke_vendor'),
      ),
    )
    .orderBy(desc(schema.eckePublishTargets.lastAttemptAt))
}

async function buildVendorProfileOverviewCard(
  viewer: EckePublishViewer,
  vendorProfileId: string,
  title: string,
  scope?: VendorProfilePreviewScope,
): Promise<EckeGroupOverviewCard | null> {
  const previewResult = await buildVendorProfilePreview(
    viewer,
    vendorProfileId,
    getRegistryEntry('vendor_profile')!,
    scope,
  )
  if (!previewResult.ok) return null

  const access = await resolveVendorEckeAccess(vendorProfileId, viewer.userId, scope)
  const writeEnabled = access?.canPublish ?? false

  return {
    section: 'vendors',
    sourceKind: 'vendor_profile',
    sourceId: vendorProfileId,
    title,
    supportState: 'active_existing',
    eligible: previewResult.result.eligible,
    reason: previewResult.result.reason,
    status: previewResult.result.status,
    preview: previewResult.result,
    writeEnabled,
    publishRestrictedMessage: writeEnabled ? undefined : VENDOR_ECKE_OWNER_ONLY_MESSAGE,
  }
}

async function buildEducationArticleOverviewCard(
  viewer: EckePublishViewer,
  articleId: string,
  title: string,
  scope?: EducationArticlePreviewScope,
): Promise<EckeGroupOverviewCard | null> {
  const previewResult = await buildEducationArticlePreview(
    viewer,
    articleId,
    getRegistryEntry('education_article')!,
    scope,
  )
  if (!previewResult.ok) return null

  const access = await resolveArticleEckeAccess(articleId, viewer.userId, scope)
  const writeEnabled = access?.canPublish ?? false

  return {
    section: 'education',
    sourceKind: 'education_article',
    sourceId: articleId,
    title,
    supportState: 'active_existing',
    eligible: previewResult.result.eligible,
    reason: previewResult.result.reason,
    status: previewResult.result.status,
    preview: previewResult.result,
    writeEnabled,
    publishRestrictedMessage: writeEnabled ? undefined : EDUCATION_ECKE_AUTHOR_ONLY_MESSAGE,
  }
}

export type EducationArticlePublishContext = {
  access: ArticlePublishAccess
  payload: Awaited<ReturnType<typeof buildEckePublicEnvelopeAsync>>['payload']
  contentHash: string
  eligibility: { eligible: boolean; reason?: string }
  canonicalKinkSocialUrl: string
  externalSlug: string
}

/** Server-side education article payload — never trusts client input. */
export async function buildEducationArticlePublishContext(
  access: ArticlePublishAccess,
): Promise<EducationArticlePublishContext> {
  const ineligibility = getEducationArticleIneligibilityReason(access.article)
  const envelope = await buildEckePublicEnvelopeAsync('education_article', access.article, access.author)
  const contentHash = hashEckePayload(envelope.payload)
  return {
    access,
    payload: envelope.payload,
    contentHash,
    eligibility:
      ineligibility ?
        { eligible: false, reason: ineligibility }
      : { eligible: true },
    canonicalKinkSocialUrl: buildEducationArticleCanonicalUrl(access.article.slug),
    externalSlug: envelope.preferredSlug || access.article.slug,
  }
}

export function buildEducationArticlePlainFields(
  ctx: EducationArticlePublishContext,
  entry: EckeRegistryEntry,
): EckePublishPlainField[] {
  const { payload, canonicalKinkSocialUrl } = ctx
  const bodyPreview =
    payload.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) ||
    payload.excerpt?.slice(0, 240) ||
    null

  return [
    { label: 'Title', value: payload.title },
    { label: 'Slug', value: payload.slug },
    { label: 'Excerpt', value: payload.excerpt ?? null },
    { label: 'Public body (ECKE article page)', value: bodyPreview },
    { label: 'Author display name', value: payload.authorDisplayName ?? null },
    { label: 'Author profile URL', value: payload.authorProfileUrl ?? null },
    { label: 'Presenter profile URL', value: payload.presenterProfileUrl ?? null },
    { label: 'Categories', value: payload.categories?.join(', ') ?? null },
    { label: 'Content warnings', value: payload.contentWarnings?.join(', ') ?? null },
    { label: 'Difficulty', value: payload.difficulty ?? null },
    { label: 'Hero image', value: payload.heroImageUrl ?? null },
    { label: 'Updated', value: payload.updatedAt ?? null },
    { label: 'Source attribution', value: `${entry.label} via kink.social` },
    { label: 'Canonical kink.social URL', value: canonicalKinkSocialUrl },
  ]
}

export function buildEducationArticlePreviewFieldSets(
  ctx: EducationArticlePublishContext,
  entry: EckeRegistryEntry,
): {
  wouldPublish: EckePublishPlainField[]
  wouldPublishDeferred: EckeOmittedField[]
} {
  const sourceHero = ctx.access.article.heroImageUrl?.trim()
  const resolvedHero = ctx.payload.heroImageUrl?.trim()
  let wouldPublish = buildEducationArticlePlainFields(ctx, entry)
  let deferred = [...getEducationDeferredFields()]

  if (sourceHero && !resolvedHero) {
    wouldPublish = wouldPublish.filter((field) => field.label !== 'Hero image')
    deferred.unshift({
      label: 'Hero image',
      reason:
        'Hero image is stored on kink.social but is not reachable on ECKE yet. Promote the upload for anonymous public access or use a public CDN URL, then sync.',
    })
  } else if (resolvedHero) {
    wouldPublish = wouldPublish.map((field) =>
      field.label === 'Hero image' ?
        { ...field, label: 'Hero image (shown atop ECKE article page)' }
      : field,
    )
  } else {
    wouldPublish = wouldPublish.filter((field) => field.label !== 'Hero image')
  }

  return { wouldPublish, wouldPublishDeferred: deferred }
}

export function payloadExcludesPrivateEducationFields(payload: Record<string, unknown>): boolean {
  if ('email' in payload || 'privateEmail' in payload || 'internalNotes' in payload) {
    return false
  }
  const serialized = JSON.stringify(payload).toLowerCase()
  const forbidden = ['moderationnotes', 'internalnotes', 'privatecontact', 'memberonlybody', 'draftbody']
  return !forbidden.some((token) => serialized.includes(token))
}

async function loadEducationArticleTarget(articleId: string) {
  const [row] = await db
    .select()
    .from(schema.eckePublishTargets)
    .where(
      and(
        eq(schema.eckePublishTargets.educationArticleId, articleId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_article'),
      ),
    )
    .limit(1)
  return row
}

export type GroupListingPublishContext = {
  access: GroupPublishAccess
  listingPayload: EckeListingPayload
  contentHash: string
  eligibility: { eligible: boolean; reason?: string }
  canonicalKinkSocialUrl: string
}

export type GroupPublishAccess = {
  group: {
    id: string
    slug: string
    name: string
    description: string | null
    visibility: string
    organizationId: string | null
    disbandedAt: Date | null
    bannerUrl: string | null
    logoUrl: string | null
  }
  org: { slug: string; displayName: string } | null
  canManage: boolean
  groupRole: string | null
}

/** Server-side group listing payload — never trusts client input. */
export function buildGroupListingPublishContext(access: GroupPublishAccess): GroupListingPublishContext {
  const listingPayload = buildGroupListingPayload({
    slug: access.group.slug,
    name: access.group.name,
    description: access.group.description,
    visibility: access.group.visibility,
    orgSlug: access.org?.slug ?? null,
    orgDisplayName: access.org?.displayName ?? null,
    imageUrl: access.group.bannerUrl ?? access.group.logoUrl ?? null,
  })
  const eligibility = isGroupListingEntityEligible({
    visibility: access.group.visibility,
    disbandedAt: access.group.disbandedAt,
  })
  return {
    access,
    listingPayload,
    contentHash: hashEckePayload(listingPayload),
    eligibility,
    canonicalKinkSocialUrl: `${APP_URL}/groups/${encodeURIComponent(access.group.id)}`,
  }
}

export function payloadExcludesPrivateGroupFields(payload: EckeListingPayload): boolean {
  const serialized = JSON.stringify(payload).toLowerCase()
  const forbidden = ['memberlist', 'rsvplist', 'privateaddress', 'moderationnotes', 'staffnotes']
  return !forbidden.some((token) => serialized.includes(token))
}

async function loadTargetRowForEvent(eventId: string) {
  return loadEckePublishTarget({ scopeType: 'event', eventId }, 'ecke_event')
}

const GROUP_ECKE_PUBLISH_ROLES = new Set(['owner', 'admin', 'moderator', 'event_host'])

/** Pure permission check for tests and UI hints. */
export function canViewerManageGroupEckePublish(groupRole: string | null, orgMod: boolean): boolean {
  if (orgMod) return true
  const normalized = groupRole?.toLowerCase() ?? ''
  return GROUP_ECKE_PUBLISH_ROLES.has(normalized)
}

export async function resolveGroupPublishAccess(
  groupId: string,
  userId: string,
): Promise<GroupPublishAccess | null> {
  const [g] = await db
    .select({
      id: schema.groups.id,
      slug: schema.groups.slug,
      name: schema.groups.name,
      description: schema.groups.description,
      visibility: schema.groups.visibility,
      organizationId: schema.groups.organizationId,
      disbandedAt: schema.groups.disbandedAt,
      bannerUrl: schema.groups.bannerUrl,
      logoUrl: schema.groups.logoUrl,
    })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1)

  if (!g || g.visibility === 'owner_absent') return null

  const [membership] = await db
    .select({ role: schema.groupMembers.role })
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
    .limit(1)

  const groupRole = membership?.role?.toLowerCase() ?? null
  const groupMod = groupRole !== null && ['owner', 'admin', 'moderator', 'event_host'].includes(groupRole)

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
    } else {
      const [po] = await db
        .select({ slug: schema.organizations.slug, displayName: schema.organizations.displayName })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, g.organizationId))
        .limit(1)
      org = po ?? null
    }
  }

  return {
    group: g,
    org,
    canManage: groupMod || orgMod,
    groupRole,
  }
}

export function buildGroupListingPlainFields(
  payload: EckeListingPayload,
  groupId: string,
  registry: EckeRegistryEntry,
): EckePublishPlainField[] {
  return [
    { label: 'Title', value: payload.title },
    { label: 'Slug', value: payload.slug },
    { label: 'Description', value: payload.description ?? null },
    { label: 'Public location', value: payload.location ?? null },
    {
      label: 'Organizer/group attribution',
      value: payload.orgDisplayName ?? payload.title,
    },
    { label: 'CTA back to kink.social', value: `${APP_URL}/groups/${encodeURIComponent(groupId)}` },
    { label: 'Affected ECKE surfaces', value: registry.eckeSurfacesAffected.join('; ') },
    { label: 'Visibility', value: payload.visibility },
  ]
}

export function buildEventListingPlainFields(
  payload: EckeListingPayload,
  eventId: string,
  registry: EckeRegistryEntry,
): EckePublishPlainField[] {
  return [
    { label: 'Title', value: payload.title },
    { label: 'Slug', value: payload.slug },
    { label: 'Description', value: payload.description ?? null },
    { label: 'Date/time', value: payload.startsAt ? `${payload.startsAt}${payload.endsAt ? ` – ${payload.endsAt}` : ''}` : null },
    { label: 'Public location', value: payload.location ?? null },
    {
      label: 'Organizer/group attribution',
      value: payload.orgDisplayName ?? null,
    },
    { label: 'CTA back to kink.social', value: `${APP_URL}/events/${encodeURIComponent(eventId)}` },
    { label: 'Affected ECKE surfaces', value: registry.eckeSurfacesAffected.join('; ') },
  ]
}

export function getEckePublishRegistryForViewer(
  _viewer: EckePublishViewer,
  scope?: { kind: 'group'; groupId: string },
): EckeRegistryEntry[] {
  if (scope?.kind === 'group') return listRegistryForGroupDashboard()
  return listAllRegistryEntries()
}

export async function getEckePublishStatus(
  viewer: EckePublishViewer,
  sourceKind: EckeSourceKind,
  sourceId: string,
): Promise<{ ok: true; result: EckePublishStatusResult } | { ok: false; status: number; error: string }> {
  const preview = await getEckePublishPreview(viewer, sourceKind, sourceId)
  if (!preview.ok) return preview
  const { wouldPublish: _wp, wouldNotPublish: _wn, payload: _p, canonicalKinkSocialUrl: _u, ...status } = preview.result
  return { ok: true, result: status }
}

export async function getEckePublishPreview(
  viewer: EckePublishViewer,
  sourceKind: EckeSourceKind,
  sourceId: string,
  educationScope?: EducationArticlePreviewScope,
  vendorScope?: VendorProfilePreviewScope,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const entry = getRegistryEntry(sourceKind)
  if (!entry) {
    return { ok: false, status: 400, error: 'Unknown source kind' }
  }

  if (sourceKind === 'group_listing') {
    return buildGroupListingPreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'event_listing') {
    return buildEventListingPreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'education_article') {
    return buildEducationArticlePreview(viewer, sourceId, entry, educationScope)
  }
  if (sourceKind === 'vendor_profile') {
    return buildVendorProfilePreview(viewer, sourceId, entry, vendorScope)
  }
  if (sourceKind === 'organization_listing') {
    return buildOrganizationListingPreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'dungeon_profile') {
    return buildDungeonProfilePreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'convention_listing') {
    return buildConventionListingPreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'dancecard_event') {
    return buildDancecardEventPreview(viewer, sourceId, entry)
  }
  if (
    sourceKind === 'dancecard_location' ||
    sourceKind === 'dancecard_program_slot' ||
    sourceKind === 'dancecard_staff_shift'
  ) {
    return buildDancecardEventPreview(viewer, sourceId, getRegistryEntry('dancecard_event')!)
  }
  if (sourceKind === 'presenter_profile') {
    return buildPresenterProfilePreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'venue_profile') {
    return buildVenueProfilePreview(viewer, sourceId, entry)
  }
  if (sourceKind === 'convention_event_anchor') {
    return buildConventionEventAnchorPreview(viewer, sourceId, entry)
  }

  return {
    ok: false,
    status: 501,
    error: `${sourceKind} preview is not available in Pass 2 read-only mode`,
  }
}

async function buildGroupListingPreview(
  viewer: EckePublishViewer,
  groupId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const access = await resolveGroupPublishAccess(groupId, viewer.userId)
  if (!access) {
    return { ok: false, status: 404, error: 'Group not found' }
  }
  if (!access.canManage) {
    return { ok: false, status: 403, error: 'Group moderator access required to preview ECKE publish' }
  }

  const ctx = buildGroupListingPublishContext(access)
  const row = await loadEckePublishTarget({ scopeType: 'group', groupId }, 'ecke_listing')
  const status = deriveTargetDisplayStatus(ctx.contentHash, row)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'group_listing',
      sourceId: groupId,
      supportState: entry.supportState,
      eligible: ctx.eligibility.eligible,
      reason: ctx.eligibility.reason,
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: ctx.listingPayload.slug,
      eckePublicUrl: row?.eckePublicUrl ?? null,
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: computeGroupListingActions({ eligible: ctx.eligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'This group has changed since it was last published to ECKE. Sync to update the public listing.'
        : null,
      wouldPublish: buildGroupListingPlainFields(ctx.listingPayload, groupId, entry),
      wouldNotPublish: getGroupOmittedFields(),
      payload: ctx.listingPayload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    },
  }
}

async function buildEventListingPreview(
  viewer: EckePublishViewer,
  eventId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const [ev] = await db
    .select({
      id: schema.events.id,
      groupId: schema.events.groupId,
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
    })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)

  if (!ev) return { ok: false, status: 404, error: 'Event not found' }

  if (!ev.groupId) {
    return { ok: false, status: 403, error: 'Event is not group-owned' }
  }

  const access = await resolveGroupPublishAccess(ev.groupId, viewer.userId)
  if (!access?.canManage) {
    return { ok: false, status: 403, error: 'Group moderator access required to preview ECKE publish' }
  }

  const [anchorConv] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.anchorEventId, ev.id))
    .limit(1)

  let org: { slug: string; displayName: string } | null = access.org
  if (ev.organizationId && !org) {
    const [o] = await db
      .select({ slug: schema.organizations.slug, displayName: schema.organizations.displayName })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, ev.organizationId))
      .limit(1)
    org = o ?? null
  }

  const [hostProfile] = await db
    .select({ displayName: schema.profiles.displayName })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, ev.hostId))
    .limit(1)

  const priorTarget = await loadTargetRowForEvent(ev.id)

  const listingPayload = buildStandaloneEventListingPayload({
    eventId: ev.id,
    title: ev.title,
    description: ev.description,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    location: ev.location,
    publicLocationSummary: ev.publicLocationSummary,
    locationVisibility: ev.locationVisibility,
    imageUrl: ev.imageUrl,
    orgSlug: org?.slug ?? null,
    orgDisplayName: org?.displayName ?? null,
    hostDisplayName: hostProfile?.displayName ?? null,
    visibility: ev.visibility,
    eckeSlug: priorTarget?.externalSlug ?? null,
  })

  const eventEligibility = isStandaloneEventEckeEligible({
    visibility: ev.visibility,
    isConventionAnchor: Boolean(anchorConv),
  })

  const locationInfo = resolvePublicLocationForEcke({
    location: ev.location,
    publicLocationSummary: ev.publicLocationSummary,
    locationVisibility: ev.locationVisibility,
  })

  const contentHash = hashEckePayload(listingPayload)
  const row = priorTarget
  const status = deriveTargetDisplayStatus(contentHash, row)
  const bridgeConfigured = isEckeBridgeConfigured()

  const omitted = getEventOmittedFields(ev.locationVisibility)
  if (locationInfo.omittedExactLocation && ev.location?.trim()) {
    omitted.unshift({
      label: 'Exact private location',
      reason: `Full address "${ev.location.trim()}" is omitted because location visibility is ${ev.locationVisibility}.`,
    })
  }

  const locationHiddenWarning =
    ev.locationVisibility !== 'public' ?
      'Exact address is hidden from ECKE. Only the public location summary (or region) will appear.'
    : null

  const eckePublicUrl = row?.eckePublicUrl ?? resolveEckePublicEventUrl(listingPayload.slug)

  return {
    ok: true,
    result: {
      sourceKind: 'event_listing',
      sourceId: eventId,
      supportState: entry.supportState,
      eligible: eventEligibility.eligible,
      reason: eventEligibility.reason,
      status,
      contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: listingPayload.slug,
      eckePublicUrl,
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: computeEventListingActions({ eligible: eventEligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'This event has changed since it was last published to ECKE. Sync to update the public listing.'
        : null,
      wouldPublish: buildEventListingPlainFields(listingPayload, ev.id, entry),
      wouldPublishDeferred: getEventDeferredFields(),
      wouldNotPublish: omitted,
      payload: listingPayload,
      canonicalKinkSocialUrl: `${APP_URL}/events/${encodeURIComponent(ev.id)}`,
      locationVisibility: ev.locationVisibility,
      locationHiddenWarning,
    },
  }
}

async function buildEducationArticlePreview(
  viewer: EckePublishViewer,
  articleId: string,
  entry: EckeRegistryEntry,
  scope?: EducationArticlePreviewScope,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const access = await resolveArticleEckeAccess(articleId, viewer.userId, scope)
  if (!access) {
    return { ok: false, status: 404, error: 'Article not found' }
  }
  if (!access.canPreview) {
    return { ok: false, status: 403, error: 'Author or organization moderator access required to preview ECKE publish' }
  }

  if (access.article.publicationStatus === 'ARCHIVED') {
    return { ok: false, status: 400, error: 'Archived articles cannot be previewed for ECKE publish' }
  }

  let ctx: EducationArticlePublishContext
  try {
    ctx = await buildEducationArticlePublishContext(access)
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : 'Could not build ECKE publish preview',
    }
  }

  const row = await loadEducationArticleTarget(articleId)
  const status = deriveTargetDisplayStatus(ctx.contentHash, row)
  const bridgeConfigured = loadEckeIngestApiConfig() !== null
  const eckePublicUrl =
    row?.eckePublicUrl ?? resolveEckePublicEducationUrl(row?.externalSlug ?? ctx.externalSlug)

  const baseActions = computeEducationArticleActions({
    eligible: ctx.eligibility.eligible,
    status,
    bridgeConfigured,
  })
  const actions =
    access.canPublish ?
      baseActions
    : { preview: true, publish: false, sync: false, unpublish: false }

  const previewFields = buildEducationArticlePreviewFieldSets(ctx, entry)

  return {
    ok: true,
    result: {
      sourceKind: 'education_article',
      sourceId: articleId,
      supportState: entry.supportState,
      eligible: ctx.eligibility.eligible,
      reason:
        ctx.eligibility.reason ??
        (!access.canPublish ? 'Only the article author can publish to ECKE' : undefined),
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: row?.externalSlug ?? ctx.externalSlug,
      eckePublicUrl,
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions,
      staleNotice:
        status === 'stale' ?
          'This article has changed since it was last published to ECKE. Sync to update the public article.'
        : null,
      wouldPublish: previewFields.wouldPublish,
      wouldPublishDeferred: previewFields.wouldPublishDeferred,
      wouldNotPublish: getEducationOmittedFields(),
      payload: ctx.payload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
      photosPreview: buildPhotosPreview(
        (ctx.payload as { photos?: import('@c2k/shared').EckePhotosManifest }).photos,
      ),
    },
  }
}

async function buildVendorProfilePreview(
  viewer: EckePublishViewer,
  vendorProfileId: string,
  entry: EckeRegistryEntry,
  scope?: VendorProfilePreviewScope,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const access = await resolveVendorEckeAccess(vendorProfileId, viewer.userId, scope)
  if (!access) {
    return { ok: false, status: 404, error: 'Vendor not found' }
  }
  if (!access.canPreview) {
    return {
      ok: false,
      status: 403,
      error: 'Vendor owner, co-owner, or organization moderator access required to preview ECKE publish',
    }
  }

  const ownerBanned = await isUserIdentityBanned(access.vendor.userId)
  let ctx: VendorProfilePublishContext
  try {
    ctx = buildVendorProfilePublishContext(access)
    if (ownerBanned) {
      ctx = {
        ...ctx,
        eligibility: { eligible: false, reason: getVendorIneligibilityReason(access.vendor, true) ?? undefined },
      }
    }
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : 'Could not build ECKE publish preview',
    }
  }

  const row = await loadVendorProfileTarget(vendorProfileId)
  const status = deriveTargetDisplayStatus(ctx.contentHash, row)
  const bridgeConfigured = loadEckePublishClientConfig() !== null
  const eckePublicUrl = row?.eckePublicUrl ?? resolveEckePublicVendorUrl(row?.externalSlug ?? ctx.externalSlug)

  const baseActions = computeVendorProfileActions({
    eligible: ctx.eligibility.eligible,
    status,
    bridgeConfigured,
  })
  const actions =
    access.canPublish ?
      baseActions
    : { preview: true, publish: false, sync: false, unpublish: false }

  return {
    ok: true,
    result: {
      sourceKind: 'vendor_profile',
      sourceId: vendorProfileId,
      supportState: entry.supportState,
      eligible: ctx.eligibility.eligible,
      reason:
        ctx.eligibility.reason ??
        (!access.canPublish ? VENDOR_ECKE_OWNER_ONLY_MESSAGE : undefined),
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: row?.externalSlug ?? ctx.externalSlug,
      eckePublicUrl,
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions,
      staleNotice:
        status === 'stale' ?
          'This vendor profile has changed since it was last published to ECKE. Sync to update the public listing.'
        : null,
      wouldPublish: buildVendorProfilePlainFields(ctx, entry),
      wouldPublishDeferred: getVendorDeferredFields(),
      wouldNotPublish: getVendorOmittedFields(),
      payload: ctx.payload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    },
  }
}

export async function getGroupEckePublishOverview(
  viewer: EckePublishViewer,
  groupId: string,
): Promise<{ ok: true; result: EckeGroupOverviewResult } | { ok: false; status: number; error: string }> {
  const access = await resolveGroupPublishAccess(groupId, viewer.userId)
  if (!access) {
    return { ok: false, status: 404, error: 'Group not found' }
  }
  if (!access.canManage) {
    return { ok: false, status: 403, error: 'Group moderator access required' }
  }

  const cards: EckeGroupOverviewCard[] = []

  cards.push({
    section: 'overview',
    title: 'ECKE Publish overview',
    supportState: 'info',
    summary: isEckeBridgeConfigured()
      ? 'ECKE publish bridge is configured. Group listing and public group event publish, sync, and unpublish are available below.'
      : 'ECKE publish bridge is not configured on this server. Configure ECKE env vars to publish listings and events.',
  })

  const groupPreview = await buildGroupListingPreview(viewer, groupId, getRegistryEntry('group_listing')!)
  if (groupPreview.ok) {
    cards.push({
      section: 'group_listing',
      sourceKind: 'group_listing',
      sourceId: groupId,
      title: 'Group listing',
      supportState: 'active_existing',
      eligible: groupPreview.result.eligible,
      reason: groupPreview.result.reason,
      status: groupPreview.result.status,
      preview: groupPreview.result,
    })
  }

  const events = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      visibility: schema.events.visibility,
    })
    .from(schema.events)
    .where(eq(schema.events.groupId, groupId))
    .orderBy(asc(schema.events.startsAt))
    .limit(20)

  if (events.length === 0) {
    cards.push({
      section: 'events',
      title: 'Events',
      supportState: 'preview_only',
      plannedMessage: 'No group-hosted events yet. Create a public event to preview ECKE event listing.',
    })
  } else {
    for (const ev of events) {
      const evPreview = await buildEventListingPreview(viewer, ev.id, getRegistryEntry('event_listing')!)
      if (evPreview.ok) {
        cards.push({
          section: 'events',
          sourceKind: 'event_listing',
          sourceId: ev.id,
          title: ev.title,
          supportState: 'active_existing',
          eligible: evPreview.result.eligible,
          reason: evPreview.result.reason,
          status: evPreview.result.status,
          preview: evPreview.result,
        })
      }
    }
  }

  if (!access.group.organizationId) {
    cards.push({
      section: 'education',
      title: 'Education',
      supportState: 'info',
      plannedMessage:
        'This group has no parent organization. Link a group to an org to surface org-linked education articles here, or manage articles from the education writer.',
    })
  } else {
    const orgArticles = await loadOrgLinkedEducationArticleSummaries(access.group.organizationId)
    if (orgArticles.length === 0) {
      cards.push({
        section: 'education',
        title: 'No org-linked education articles',
        supportState: 'info',
        plannedMessage:
          'No education articles are linked to this group’s parent organization yet. Authors can set organization affiliation in the education writer.',
      })
    } else {
      for (const article of orgArticles) {
        const card = await buildEducationArticleOverviewCard(viewer, article.id, article.title, {
          groupOrganizationId: access.group.organizationId,
          groupModerator: access.canManage,
        })
        if (card) cards.push(card)
      }
    }
  }

  cards.push({
    section: 'venues',
    title: 'Places',
    supportState: 'info',
    plannedMessage:
      'Publish place listings from community place settings. Places appear on ECKE Places (/dungeons/{slug}) and are separate from group or org profiles.',
  })

  cards.push({
    section: 'vendors',
    title: 'Vendors / Sponsors',
    supportState: 'planned',
    plannedMessage:
      'Group-linked vendor publishing is not wired yet. User-owned vendors publish from vendor shop settings; org-featured vendors appear on the parent org ECKE tab.',
  })

  cards.push({
    section: 'dancecard',
    title: 'Dancecard',
    supportState: 'info',
    plannedMessage:
      'Dancecard program data is not synced to ECKE. When your org runs a convention with Dancecard enabled, manage the attendee app from the convention organizer dashboard.',
  })

  const historyRows = await db
    .select({
      targetKind: schema.eckePublishTargets.targetKind,
      externalSlug: schema.eckePublishTargets.externalSlug,
      status: schema.eckePublishTargets.status,
      lastPublishedAt: schema.eckePublishTargets.lastPublishedAt,
      lastError: schema.eckePublishTargets.lastError,
      lastPreviewAt: schema.eckePublishTargets.lastPreviewAt,
    })
    .from(schema.eckePublishTargets)
    .where(eq(schema.eckePublishTargets.groupId, groupId))

  return {
    ok: true,
    result: {
      groupId,
      groupSlug: access.group.slug,
      groupName: access.group.name,
      bridgeConnected: isEckeBridgeConfigured(),
      passNotice:
        'ECKE publishes four public surfaces from kink.social: Events, Places, Vendors, and Education. Group listings are low-priority thin listings only. Member lists, RSVP data, and private locations are never sent.',
      cards,
      history: historyRows.map((r) => ({
        targetKind: r.targetKind,
        externalSlug: r.externalSlug,
        status: r.status,
        lastPublishedAt: r.lastPublishedAt?.toISOString() ?? null,
        lastError: r.lastError ?? null,
        lastPreviewAt: r.lastPreviewAt?.toISOString() ?? null,
      })),
    },
  }
}

export async function getOrgEckePublishOverview(
  viewer: EckePublishViewer,
  orgKey: string,
): Promise<{ ok: true; result: EckeOrgOverviewResult } | { ok: false; status: number; error: string }> {
  const access = await resolveOrgPublishAccess(orgKey, viewer.userId)
  if (!access) {
    return { ok: false, status: 404, error: 'Organization not found' }
  }
  if (!access.canManage) {
    return { ok: false, status: 403, error: 'Organization moderator access required' }
  }

  const cards: EckeGroupOverviewCard[] = []

  cards.push({
    section: 'overview',
    title: 'Publish to East Coast Kink Events',
    supportState: 'info',
    summary: isEckeBridgeConfigured()
      ? 'Organizations publish public outcomes to ECKE — not org profile pages. Use Events, Places, Vendors, and Education from their respective editors. Publish events and conventions to ECKE Events; publish place listings when this org manages a public venue.'
      : 'ECKE publish bridge is not configured on this server.',
  })

  cards.push({
    section: 'events',
    title: 'Events & conventions',
    supportState: 'info',
    plannedMessage:
      'Publish standalone events from the event host tools. Publish conventions from the convention ECKE panel — they appear on ECKE under Events (/events/{slug}) with a Convention badge.',
  })

  cards.push({
    section: 'places',
    title: 'Places',
    supportState: 'info',
    plannedMessage:
      'Publish a place listing when this organization manages a public venue. Place listings are separate from the organization profile and appear on ECKE Places (/dungeons/{slug}). Manage places from community place settings when linked to this org.',
  })

  const orgArticles = await loadOrgLinkedEducationArticleSummaries(access.organization.id)
  if (orgArticles.length === 0) {
    cards.push({
      section: 'education',
      title: 'No org-linked education articles',
      supportState: 'info',
      plannedMessage:
        'No education articles are linked to this organization yet. Authors can set organization affiliation when writing an article.',
    })
  } else {
    for (const article of orgArticles) {
      const card = await buildEducationArticleOverviewCard(viewer, article.id, article.title, {
        organizationId: access.organization.id,
      })
      if (card) cards.push(card)
    }
  }

  const featuredVendors = await loadOrgFeaturedVendorSummaries(access.organization.id)
  if (featuredVendors.length === 0) {
    cards.push({
      section: 'vendors',
      title: 'No featured vendors',
      supportState: 'info',
      plannedMessage:
        'No vendors are featured on this organization yet. Add featured vendors in org settings to preview ECKE vendor publish status here.',
    })
  } else {
    for (const vendor of featuredVendors) {
      const card = await buildVendorProfileOverviewCard(viewer, vendor.id, vendor.displayName, {
        organizationId: access.organization.id,
      })
      if (card) cards.push(card)
    }
  }

  const articleIds = orgArticles.map((a) => a.id)
  const vendorIds = featuredVendors.map((v) => v.id)
  const historyRows = [
    ...(await loadEducationArticleEckeHistory(articleIds)),
    ...(await loadVendorProfileEckeHistory(vendorIds)),
  ].sort((a, b) => {
    const aTime = a.lastPublishedAt?.getTime() ?? 0
    const bTime = b.lastPublishedAt?.getTime() ?? 0
    return bTime - aTime
  })

  return {
    ok: true,
    result: {
      organizationId: access.organization.id,
      organizationSlug: access.organization.slug,
      organizationName: access.organization.displayName,
      bridgeConnected: isEckeBridgeConfigured(),
      passNotice:
        'ECKE publishes public outcomes from this organization — events, place listings, vendor profiles, and education. Organization profile pages are not published to ECKE.',
      cards,
      history: historyRows.map((r) => ({
        targetKind: r.targetKind,
        externalSlug: r.externalSlug,
        status: r.status,
        lastPublishedAt: r.lastPublishedAt?.toISOString() ?? null,
        lastError: r.lastError ?? null,
        lastPreviewAt: r.lastPreviewAt?.toISOString() ?? null,
      })),
    },
  }
}

export async function getConventionEckePublishOverview(
  viewer: EckePublishViewer,
  conventionKey: string,
): Promise<{ ok: true; result: EckeConventionOverviewResult } | { ok: false; status: number; error: string }> {
  const ctx = await loadConventionEckeContext(conventionKey, viewer.userId)
  if (!ctx) {
    return { ok: false, status: 404, error: 'Convention not found' }
  }
  if (!ctx.canManage) {
    return { ok: false, status: 403, error: 'Convention full admin access required' }
  }

  const cards: EckeGroupOverviewCard[] = []

  cards.push({
    section: 'overview',
    title: 'Publish to East Coast Kink Events',
    supportState: 'info',
    summary: isEckeBridgeConfigured()
      ? 'Publish this convention to ECKE Events. Your convention appears at /events/{slug} with a Convention badge. Dancecard program data stays on kink.social — ECKE event pages may link to Dancecard when enabled.'
      : 'ECKE publish bridge is not configured on this server.',
  })

  const anchorPreview = await buildConventionEventAnchorPreview(
    viewer,
    ctx.conv.id,
    getRegistryEntry('convention_event_anchor')!,
  )
  if (anchorPreview.ok) {
    cards.push({
      section: 'events',
      sourceKind: 'convention_event_anchor',
      sourceId: ctx.conv.id,
      title: `Publish event to ECKE — ${ctx.conv.name}`,
      supportState: 'active_existing',
      eligible: anchorPreview.result.eligible,
      reason: anchorPreview.result.reason,
      status: anchorPreview.result.status,
      preview: anchorPreview.result,
      writeEnabled: true,
      summary:
        'Your convention appears on ECKE under Events (/events/{slug}) with Convention metadata. Legacy listing webhook may still run in the background during migration.',
    })
  }

  const dancecardEnabled = isDancecardPublishEnabled(ctx.conv.settings)
  cards.push({
    section: 'dancecard',
    title: 'Dancecard',
    supportState: 'info',
    plannedMessage: dancecardEnabled
      ? 'Dancecard program data is not synced to ECKE. When this convention is published to ECKE Events, public ECKE pages may link to your Dancecard at /dancecard/{slug} on kink.social.'
      : 'Enable Dancecard in convention settings if attendees should use the kink.social Dancecard app. Program data is not synced to ECKE.',
  })

  const historyRows = await loadConventionEckeHistory(ctx.conv.id)

  return {
    ok: true,
    result: {
      conventionId: ctx.conv.id,
      conventionSlug: ctx.conv.slug,
      conventionName: ctx.conv.name,
      bridgeConnected: isEckeBridgeConfigured(),
      passNotice:
        'Publish this convention to ECKE Events. Dancecard program slots, locations, and staff are not synced to ECKE — public ECKE pages may link to Dancecard when enabled.',
      cards,
      history: historyRows.map((r) => ({
        targetKind: r.targetKind,
        externalSlug: r.externalSlug,
        status: r.status,
        lastPublishedAt: r.lastPublishedAt?.toISOString() ?? null,
        lastError: r.lastError ?? null,
        lastPreviewAt: r.lastPreviewAt?.toISOString() ?? null,
      })),
    },
  }
}

export type EckePublishActionResult = {
  ok: boolean
  sourceKind: EckeSourceKind
  sourceId: string
  status?: EckeTargetStatus
  errorCode?: string
  message?: string
  error?: string
  preview?: EckePublishPreviewResult
}

async function executeGroupListingPublish(
  viewer: EckePublishViewer,
  groupId: string,
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  const access = await resolveGroupPublishAccess(groupId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Group not found' }
  if (!access.canManage) {
    return { ok: false, status: 403, error: 'Group moderator access required to publish ECKE listing' }
  }

  const ctx = buildGroupListingPublishContext(access)
  if (!ctx.eligibility.eligible) {
    return { ok: false, status: 400, error: ctx.eligibility.reason ?? 'Group is not eligible for ECKE publish' }
  }
  if (!payloadExcludesPrivateGroupFields(ctx.listingPayload)) {
    return { ok: false, status: 400, error: 'Payload contains restricted private fields' }
  }

  const cfg = loadEckePublishClientConfig()
  if (!cfg) {
    return { ok: false, status: 503, error: 'ECKE publish bridge is not configured' }
  }

  const scope = { scopeType: 'group' as const, groupId }
  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.listingPayload.slug,
    contentHash: ctx.contentHash,
  })
  await touchEckePublishPreview({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.listingPayload.slug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
  })

  const listingResult = await publishListingToEcke(cfg, ctx.listingPayload, {
    sourceSystem: 'kink.social',
    sourceId: groupId,
    canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    entityType: 'group',
  })

  const status = await markEckePublishSuccess({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.listingPayload.slug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
    result: listingResult,
  })

  const preview = await buildGroupListingPreview(viewer, groupId, getRegistryEntry('group_listing')!)

  if (!listingResult.ok) {
    return {
      ok: false,
      status: 502,
      error: listingResult.error,
      errorCode: 'ecke_publish_failed',
    }
  }

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'group_listing',
      sourceId: groupId,
      status,
      message: 'Group listing published to ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

async function executeGroupListingUnpublish(
  viewer: EckePublishViewer,
  groupId: string,
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  const access = await resolveGroupPublishAccess(groupId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Group not found' }
  if (!access.canManage) {
    return { ok: false, status: 403, error: 'Group moderator access required to unpublish ECKE listing' }
  }

  const scope = { scopeType: 'group' as const, groupId }
  const row = await loadEckePublishTarget(scope, 'ecke_listing')
  if (!row || row.status === 'unpublished') {
    const preview = await buildGroupListingPreview(viewer, groupId, getRegistryEntry('group_listing')!)
    return {
      ok: true,
      result: {
        ok: true,
        sourceKind: 'group_listing',
        sourceId: groupId,
        status: 'unpublished',
        message: 'Group listing is already unpublished on ECKE',
        preview: preview.ok ? preview.result : undefined,
      },
    }
  }

  const cfg = loadEckePublishClientConfig()
  let remoteOk = true
  let remoteError: string | null = null
  if (cfg) {
    const remoteResult = await unpublishListingToEcke(cfg, {
      slug: row.externalSlug,
      sourceId: groupId,
      entityType: 'group',
    })
    remoteOk = remoteResult.ok
    remoteError = remoteResult.ok ? null : remoteResult.error
  }

  const status = await markEckeUnpublishSuccess({
    scope,
    targetKind: 'ecke_listing',
    userId: viewer.userId,
    remoteOk,
    remoteError,
  })

  const preview = await buildGroupListingPreview(viewer, groupId, getRegistryEntry('group_listing')!)

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'group_listing',
      sourceId: groupId,
      status,
      message: remoteOk ?
        'Group listing unpublished from ECKE'
      : 'Local unpublish recorded; remote webhook reported an error',
      error: remoteOk ? undefined : remoteError ?? undefined,
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

async function requireGroupOwnedEvent(
  eventId: string,
  viewer: EckePublishViewer,
  expectedGroupId?: string,
): Promise<
  | { ok: true; groupId: string }
  | { ok: false; status: number; error: string }
> {
  const [ev] = await db
    .select({
      id: schema.events.id,
      groupId: schema.events.groupId,
      visibility: schema.events.visibility,
    })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)

  if (!ev) return { ok: false, status: 404, error: 'Event not found' }
  if (!ev.groupId) {
    return { ok: false, status: 403, error: 'Event is not group-owned; use organizer event ECKE routes for host-owned events' }
  }
  if (expectedGroupId && ev.groupId !== expectedGroupId) {
    return { ok: false, status: 403, error: 'Event does not belong to this group' }
  }

  const access = await resolveGroupPublishAccess(ev.groupId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Group not found' }
  if (!access.canManage) {
    return { ok: false, status: 403, error: 'Group moderator access required to publish ECKE event listing' }
  }

  return { ok: true, groupId: ev.groupId }
}

async function executeEventListingPublish(
  viewer: EckePublishViewer,
  eventId: string,
  expectedGroupId?: string,
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  const gate = await requireGroupOwnedEvent(eventId, viewer, expectedGroupId)
  if (!gate.ok) return gate

  const previewResult = await buildEventListingPreview(viewer, eventId, getRegistryEntry('event_listing')!)
  if (!previewResult.ok) return previewResult
  if (!previewResult.result.eligible) {
    return { ok: false, status: 400, error: previewResult.result.reason ?? 'Event is not eligible for ECKE publish' }
  }

  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, status: 503, error: 'ECKE publish bridge is not configured' }
  }

  const scope = { scopeType: 'event' as const, eventId }
  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'ecke_event',
    externalSlug: previewResult.result.externalSlug ?? eventId,
    contentHash: previewResult.result.contentHash ?? '',
  })

  await requestEckeStandaloneEventPublish(eventId, viewer.userId)
  const row = await loadEckePublishTarget(scope, 'ecke_event')
  const status = deriveTargetDisplayStatus(previewResult.result.contentHash ?? '', row)

  const preview = await buildEventListingPreview(viewer, eventId, getRegistryEntry('event_listing')!)

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'event_listing',
      sourceId: eventId,
      status: preview.ok ? preview.result.status : status,
      message: 'Event publish queued for ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

async function executeEventListingUnpublish(
  viewer: EckePublishViewer,
  eventId: string,
  expectedGroupId?: string,
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  const gate = await requireGroupOwnedEvent(eventId, viewer, expectedGroupId)
  if (!gate.ok) return gate

  const scope = { scopeType: 'event' as const, eventId }
  const row = await loadEckePublishTarget(scope, 'ecke_event')
  if (!row || row.status === 'unpublished') {
    const preview = await buildEventListingPreview(viewer, eventId, getRegistryEntry('event_listing')!)
    return {
      ok: true,
      result: {
        ok: true,
        sourceKind: 'event_listing',
        sourceId: eventId,
        status: 'unpublished',
        message: 'Event listing is already unpublished on ECKE',
        preview: preview.ok ? preview.result : undefined,
      },
    }
  }

  const cfg = loadEckePublishClientConfig()
  let remoteOk = true
  let remoteError: string | null = null
  if (cfg) {
    const remoteResult = await unpublishEventRowToEcke(cfg, row.externalSlug)
    remoteOk = remoteResult.ok
    remoteError = remoteResult.ok ? null : remoteResult.error
  }

  const status = await markEckeUnpublishSuccess({
    scope,
    targetKind: 'ecke_event',
    userId: viewer.userId,
    remoteOk,
    remoteError,
  })

  const preview = await buildEventListingPreview(viewer, eventId, getRegistryEntry('event_listing')!)

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'event_listing',
      sourceId: eventId,
      status,
      message: remoteOk ? 'Event listing unpublished from ECKE' : 'Local unpublish recorded; remote Supabase reported an error',
      error: remoteOk ? undefined : remoteError ?? undefined,
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

function isPass5WriteKind(sourceKind: EckeSourceKind): boolean {
  return isFinalSupportedWriteKind(sourceKind)
}

async function executeEducationArticlePublish(
  viewer: EckePublishViewer,
  articleId: string,
  scope?: { expectedGroupId?: string; expectedOrgKey?: string },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (scope?.expectedGroupId) {
    const groupAccess = await resolveGroupPublishAccess(scope.expectedGroupId, viewer.userId)
    if (!groupAccess?.canManage) {
      return { ok: false, status: 403, error: 'Group moderator access required' }
    }
    const scopedArticle = await loadEducationArticleForPublish(articleId)
    if (
      !scopedArticle?.organizationId ||
      scopedArticle.organizationId !== groupAccess.group.organizationId
    ) {
      return { ok: false, status: 403, error: 'Article is not linked to this group’s parent organization' }
    }
  }

  if (scope?.expectedOrgKey) {
    const orgAccess = await resolveOrgPublishAccess(scope.expectedOrgKey, viewer.userId)
    if (!orgAccess?.canManage) {
      return { ok: false, status: 403, error: 'Organization moderator access required' }
    }
    const scopedArticle = await loadEducationArticleForPublish(articleId)
    if (!scopedArticle?.organizationId || scopedArticle.organizationId !== orgAccess.organization.id) {
      return { ok: false, status: 403, error: 'Article is not linked to this organization' }
    }
  }

  const access = await resolveArticleEckeAccess(articleId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Article not found' }
  if (!access.canPublish) {
    return { ok: false, status: 403, error: 'Author access required to publish ECKE article' }
  }

  const previewResult = await buildEducationArticlePreview(
    viewer,
    articleId,
    getRegistryEntry('education_article')!,
  )
  if (!previewResult.ok) return previewResult
  if (!previewResult.result.eligible) {
    return {
      ok: false,
      status: 400,
      error: previewResult.result.reason ?? 'Article is not eligible for ECKE publish',
    }
  }
  if (!payloadExcludesPrivateEducationFields(previewResult.result.payload as Record<string, unknown>)) {
    return { ok: false, status: 400, error: 'Payload contains restricted private fields' }
  }
  if (!loadEckeIngestApiConfig()) {
    return { ok: false, status: 503, error: 'ECKE ingest API is not configured' }
  }

  await requestEckeArticlePublish(articleId, viewer.userId)
  const preview = await buildEducationArticlePreview(viewer, articleId, getRegistryEntry('education_article')!)

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'education_article',
      sourceId: articleId,
      status: preview.ok ? preview.result.status : 'draft',
      message: 'Education article publish queued for ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

async function executeEducationArticleUnpublish(
  viewer: EckePublishViewer,
  articleId: string,
  scope?: { expectedGroupId?: string; expectedOrgKey?: string },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (scope?.expectedGroupId) {
    const groupAccess = await resolveGroupPublishAccess(scope.expectedGroupId, viewer.userId)
    if (!groupAccess?.canManage) {
      return { ok: false, status: 403, error: 'Group moderator access required' }
    }
    const scopedArticle = await loadEducationArticleForPublish(articleId)
    if (
      !scopedArticle?.organizationId ||
      scopedArticle.organizationId !== groupAccess.group.organizationId
    ) {
      return { ok: false, status: 403, error: 'Article is not linked to this group’s parent organization' }
    }
  }

  if (scope?.expectedOrgKey) {
    const orgAccess = await resolveOrgPublishAccess(scope.expectedOrgKey, viewer.userId)
    if (!orgAccess?.canManage) {
      return { ok: false, status: 403, error: 'Organization moderator access required' }
    }
    const scopedArticle = await loadEducationArticleForPublish(articleId)
    if (!scopedArticle?.organizationId || scopedArticle.organizationId !== orgAccess.organization.id) {
      return { ok: false, status: 403, error: 'Article is not linked to this organization' }
    }
  }

  const access = await resolveArticleEckeAccess(articleId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Article not found' }
  if (!access.canPublish) {
    return { ok: false, status: 403, error: 'Author access required to unpublish ECKE article' }
  }

  const row = await loadEducationArticleTarget(articleId)
  if (!row || row.status === 'unpublished') {
    const preview = await buildEducationArticlePreview(viewer, articleId, getRegistryEntry('education_article')!)
    return {
      ok: true,
      result: {
        ok: true,
        sourceKind: 'education_article',
        sourceId: articleId,
        status: 'unpublished',
        message: 'Education article is already unpublished on ECKE',
        preview: preview.ok ? preview.result : undefined,
      },
    }
  }

  const unpublishResult = await executeEckeUnpublishEducationArticleWithTargetUpdate(
    articleId,
    'opt_out',
    viewer.userId,
  )
  const preview = await buildEducationArticlePreview(viewer, articleId, getRegistryEntry('education_article')!)

  if (!unpublishResult.ok) {
    return {
      ok: false,
      status: 502,
      error: unpublishResult.error,
      errorCode: 'ecke_unpublish_failed',
    }
  }

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'education_article',
      sourceId: articleId,
      status: preview.ok ? preview.result.status : 'unpublished',
      message: 'Education article unpublished from ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

async function executeVendorProfilePublish(
  viewer: EckePublishViewer,
  vendorProfileId: string,
  scope?: { expectedOrgKey?: string },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (scope?.expectedOrgKey) {
    const orgAccess = await resolveOrgPublishAccess(scope.expectedOrgKey, viewer.userId)
    if (!orgAccess?.canManage) {
      return { ok: false, status: 403, error: 'Organization moderator access required' }
    }
    const featured = await isVendorFeaturedByOrganization(orgAccess.organization.id, vendorProfileId)
    if (!featured) {
      return { ok: false, status: 403, error: 'Vendor is not featured on this organization' }
    }
  }

  const access = await resolveVendorEckeAccess(vendorProfileId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Vendor not found' }
  if (!access.canPublish) {
    return { ok: false, status: 403, error: 'Vendor owner or co-owner access required to publish ECKE vendor profile' }
  }

  const previewResult = await buildVendorProfilePreview(
    viewer,
    vendorProfileId,
    getRegistryEntry('vendor_profile')!,
  )
  if (!previewResult.ok) return previewResult
  if (!previewResult.result.eligible) {
    return {
      ok: false,
      status: 400,
      error: previewResult.result.reason ?? 'Vendor is not eligible for ECKE publish',
    }
  }
  if (!payloadExcludesPrivateVendorFields(previewResult.result.payload as Record<string, unknown>)) {
    return { ok: false, status: 400, error: 'Payload contains restricted private fields' }
  }
  if (!loadEckePublishClientConfig()) {
    return { ok: false, status: 503, error: 'ECKE publish bridge is not configured' }
  }

  await requestEckeVendorPublish(vendorProfileId, viewer.userId)
  const preview = await buildVendorProfilePreview(viewer, vendorProfileId, getRegistryEntry('vendor_profile')!)

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'vendor_profile',
      sourceId: vendorProfileId,
      status: preview.ok ? preview.result.status : 'draft',
      message: 'Vendor profile publish queued for ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

async function executeVendorProfileUnpublish(
  viewer: EckePublishViewer,
  vendorProfileId: string,
  scope?: { expectedOrgKey?: string },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (scope?.expectedOrgKey) {
    const orgAccess = await resolveOrgPublishAccess(scope.expectedOrgKey, viewer.userId)
    if (!orgAccess?.canManage) {
      return { ok: false, status: 403, error: 'Organization moderator access required' }
    }
    const featured = await isVendorFeaturedByOrganization(orgAccess.organization.id, vendorProfileId)
    if (!featured) {
      return { ok: false, status: 403, error: 'Vendor is not featured on this organization' }
    }
  }

  const access = await resolveVendorEckeAccess(vendorProfileId, viewer.userId)
  if (!access) return { ok: false, status: 404, error: 'Vendor not found' }
  if (!access.canPublish) {
    return { ok: false, status: 403, error: 'Vendor owner or co-owner access required to unpublish ECKE vendor profile' }
  }

  const row = await loadVendorProfileTarget(vendorProfileId)
  if (!row || row.status === 'unpublished') {
    const preview = await buildVendorProfilePreview(viewer, vendorProfileId, getRegistryEntry('vendor_profile')!)
    return {
      ok: true,
      result: {
        ok: true,
        sourceKind: 'vendor_profile',
        sourceId: vendorProfileId,
        status: 'unpublished',
        message: 'Vendor profile is already unpublished on ECKE',
        preview: preview.ok ? preview.result : undefined,
      },
    }
  }

  const unpublishResult = await executeEckeUnpublishVendorWithTargetUpdate(vendorProfileId, viewer.userId)
  const preview = await buildVendorProfilePreview(viewer, vendorProfileId, getRegistryEntry('vendor_profile')!)

  if (!unpublishResult.ok) {
    return {
      ok: false,
      status: 502,
      error: unpublishResult.error,
      errorCode: 'ecke_unpublish_failed',
    }
  }

  return {
    ok: true,
    result: {
      ok: true,
      sourceKind: 'vendor_profile',
      sourceId: vendorProfileId,
      status: preview.ok ? preview.result.status : 'unpublished',
      message: 'Vendor profile unpublished from ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

export async function publishEckeSource(
  viewer: EckePublishViewer,
  input: {
    sourceKind: EckeSourceKind
    sourceId: string
    expectedGroupId?: string
    expectedOrgKey?: string
  },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (!isPass5WriteKind(input.sourceKind)) {
    return {
      ok: false,
      status: 501,
      error: PASS5_UNSUPPORTED_ERROR.message,
      errorCode: PASS5_UNSUPPORTED_ERROR.errorCode,
    }
  }
  if (input.sourceKind === 'group_listing') {
    return executeGroupListingPublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'education_article') {
    return executeEducationArticlePublish(viewer, input.sourceId, {
      expectedGroupId: input.expectedGroupId,
      expectedOrgKey: input.expectedOrgKey,
    })
  }
  if (input.sourceKind === 'vendor_profile') {
    return executeVendorProfilePublish(viewer, input.sourceId, {
      expectedOrgKey: input.expectedOrgKey,
    })
  }
  if (input.sourceKind === 'organization_listing') {
    return executeOrganizationListingPublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'dungeon_profile') {
    return executeDungeonProfilePublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'convention_listing') {
    return executeConventionListingPublish(viewer, input.sourceId)
  }
  if (
    input.sourceKind === 'dancecard_event' ||
    input.sourceKind === 'dancecard_location' ||
    input.sourceKind === 'dancecard_program_slot' ||
    input.sourceKind === 'dancecard_staff_shift'
  ) {
    return executeDancecardEventPublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'presenter_profile') {
    return executePresenterProfilePublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'venue_profile') {
    return executeVenueProfilePublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'convention_event_anchor') {
    return executeConventionEventAnchorPublish(viewer, input.sourceId)
  }
  return executeEventListingPublish(viewer, input.sourceId, input.expectedGroupId)
}

export async function syncEckeSource(
  viewer: EckePublishViewer,
  input: {
    sourceKind: EckeSourceKind
    sourceId: string
    expectedGroupId?: string
    expectedOrgKey?: string
  },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (!isPass5WriteKind(input.sourceKind)) {
    return {
      ok: false,
      status: 501,
      error: PASS5_UNSUPPORTED_ERROR.message,
      errorCode: PASS5_UNSUPPORTED_ERROR.errorCode,
    }
  }
  if (input.sourceKind === 'group_listing') {
    return executeGroupListingPublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'education_article') {
    return executeEducationArticlePublish(viewer, input.sourceId, {
      expectedGroupId: input.expectedGroupId,
      expectedOrgKey: input.expectedOrgKey,
    })
  }
  if (input.sourceKind === 'vendor_profile') {
    return executeVendorProfilePublish(viewer, input.sourceId, {
      expectedOrgKey: input.expectedOrgKey,
    })
  }
  if (input.sourceKind === 'organization_listing') {
    return executeOrganizationListingPublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'dungeon_profile') {
    return executeDungeonProfilePublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'convention_listing') {
    return executeConventionListingPublish(viewer, input.sourceId)
  }
  if (
    input.sourceKind === 'dancecard_event' ||
    input.sourceKind === 'dancecard_location' ||
    input.sourceKind === 'dancecard_program_slot' ||
    input.sourceKind === 'dancecard_staff_shift'
  ) {
    return executeDancecardEventPublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'presenter_profile') {
    return executePresenterProfilePublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'venue_profile') {
    return executeVenueProfilePublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'convention_event_anchor') {
    return executeConventionEventAnchorPublish(viewer, input.sourceId)
  }
  return executeEventListingPublish(viewer, input.sourceId, input.expectedGroupId)
}

export async function unpublishEckeSource(
  viewer: EckePublishViewer,
  input: {
    sourceKind: EckeSourceKind
    sourceId: string
    expectedGroupId?: string
    expectedOrgKey?: string
  },
): Promise<
  | { ok: true; result: EckePublishActionResult }
  | { ok: false; status: number; error: string; errorCode?: string }
> {
  if (!isPass5WriteKind(input.sourceKind)) {
    return {
      ok: false,
      status: 501,
      error: PASS5_UNSUPPORTED_ERROR.message,
      errorCode: PASS5_UNSUPPORTED_ERROR.errorCode,
    }
  }
  if (input.sourceKind === 'group_listing') {
    return executeGroupListingUnpublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'education_article') {
    return executeEducationArticleUnpublish(viewer, input.sourceId, {
      expectedGroupId: input.expectedGroupId,
      expectedOrgKey: input.expectedOrgKey,
    })
  }
  if (input.sourceKind === 'vendor_profile') {
    return executeVendorProfileUnpublish(viewer, input.sourceId, {
      expectedOrgKey: input.expectedOrgKey,
    })
  }
  if (input.sourceKind === 'organization_listing') {
    return executeOrganizationListingUnpublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'dungeon_profile') {
    return executeDungeonProfileUnpublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'convention_listing') {
    return executeConventionListingUnpublish(viewer, input.sourceId)
  }
  if (
    input.sourceKind === 'dancecard_event' ||
    input.sourceKind === 'dancecard_location' ||
    input.sourceKind === 'dancecard_program_slot' ||
    input.sourceKind === 'dancecard_staff_shift'
  ) {
    return executeDancecardEventUnpublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'presenter_profile') {
    return executePresenterProfileUnpublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'venue_profile') {
    return executeVenueProfileUnpublish(viewer, input.sourceId)
  }
  if (input.sourceKind === 'convention_event_anchor') {
    return executeConventionEventAnchorUnpublish(viewer, input.sourceId)
  }
  return executeEventListingUnpublish(viewer, input.sourceId, input.expectedGroupId)
}

export { isValidEckeSourceKind }
