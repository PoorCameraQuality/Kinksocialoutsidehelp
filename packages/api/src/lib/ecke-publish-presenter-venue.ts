import { and, eq } from 'drizzle-orm'
import { APP_URL } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import {
  loadEckePublishClientConfig,
  publishListingToEcke,
  resolveEckePublicPresenterUrl,
  resolveEckePublicVenueUrl,
  unpublishListingToEcke,
} from './ecke-publish-client.js'
import {
  buildPresenterListingPayload,
  buildVenueListingPayload,
  hashEckePayload,
} from './ecke-publish-payload.js'
import { deliverProfileHeroUrl } from './image-delivery.js'
import {
  deriveTargetDisplayStatus,
  ensureEckePublishTargetRow,
  loadEckePublishTarget,
  markEckePublishSuccess,
  markEckeUnpublishSuccess,
  touchEckePublishPreview,
  type EckeTargetStatus,
} from './ecke-publish-target-store.js'
import { getRegistryEntry, type EckeRegistryEntry, type EckeSourceKind } from './ecke-publish-registry.js'
import {
  getPresenterDeferredFields,
  getPresenterOmittedFields,
  getVenueOmittedFields,
} from './ecke-redaction.js'
import { resolveOrgEckePublishAccess } from './ecke-publish-org-convention.js'
import type { EckePublishActions, EckePublishPreviewResult, EckePublishViewer } from './ecke-publish-service.js'

function listingActions(input: {
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

async function loadPresenterRow(userId: string) {
  const [row] = await db
    .select({
      userId: schema.presenterProfiles.userId,
      headline: schema.presenterProfiles.headline,
      bioShort: schema.presenterProfiles.bioShort,
      directoryVisibility: schema.presenterProfiles.directoryVisibility,
      eckePublish: schema.presenterProfiles.eckePublish,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.presenterProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.presenterProfiles.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.presenterProfiles.userId))
    .where(eq(schema.presenterProfiles.userId, userId))
    .limit(1)
  return row ?? null
}

async function loadVenueRow(placeId: string) {
  const [row] = await db
    .select({
      id: schema.communityPlaces.id,
      slug: schema.communityPlaces.slug,
      name: schema.communityPlaces.name,
      description: schema.communityPlaces.description,
      city: schema.communityPlaces.city,
      region: schema.communityPlaces.region,
      status: schema.communityPlaces.status,
      eckePublish: schema.communityPlaces.eckePublish,
      linkedOrganizationId: schema.communityPlaces.linkedOrganizationId,
      submittedByUserId: schema.communityPlaces.submittedByUserId,
    })
    .from(schema.communityPlaces)
    .where(eq(schema.communityPlaces.id, placeId))
    .limit(1)
  return row ?? null
}

function presenterEligibility(row: NonNullable<Awaited<ReturnType<typeof loadPresenterRow>>>) {
  if (row.directoryVisibility !== 'PUBLIC') {
    return { eligible: false, reason: 'Presenter directory visibility must be PUBLIC to publish to ECKE.' }
  }
  if (!row.eckePublish) {
    return { eligible: false, reason: 'Enable ECKE publish on your presenter profile first.' }
  }
  if (!row.username?.trim()) {
    return { eligible: false, reason: 'Presenter username is required for ECKE slug.' }
  }
  return { eligible: true as const }
}

function venueEligibility(row: NonNullable<Awaited<ReturnType<typeof loadVenueRow>>>) {
  if (row.status !== 'published') {
    return { eligible: false, reason: 'Only published community places can sync to ECKE.' }
  }
  if (!row.eckePublish) {
    return { eligible: false, reason: 'Enable ECKE publish for this place first.' }
  }
  return { eligible: true as const }
}

function buildPresenterContext(row: NonNullable<Awaited<ReturnType<typeof loadPresenterRow>>>) {
  const displayName = row.displayName?.trim() || row.headline?.trim() || row.username
  const avatarUrl =
    deliverProfileHeroUrl(row.avatarUrl?.trim() || null) ?? (row.avatarUrl?.trim() || null)
  const listingPayload = buildPresenterListingPayload({
    username: row.username,
    displayName,
    bioShort: row.bioShort,
    directoryVisibility: row.directoryVisibility,
    eckePublish: row.eckePublish,
    imageUrl: avatarUrl,
  })
  const contentHash = hashEckePayload(listingPayload)
  const canonicalKinkSocialUrl = `${APP_URL}/presenters/${encodeURIComponent(row.username)}`
  return { listingPayload, contentHash, externalSlug: listingPayload.slug, canonicalKinkSocialUrl, displayName }
}

function buildVenueContext(row: NonNullable<Awaited<ReturnType<typeof loadVenueRow>>>) {
  const listingPayload = buildVenueListingPayload({
    slug: row.slug,
    name: row.name,
    description: row.description,
    city: row.city,
    region: row.region,
    status: row.status,
    eckePublish: row.eckePublish,
  })
  const contentHash = hashEckePayload(listingPayload)
  const canonicalKinkSocialUrl = `${APP_URL}/places/${encodeURIComponent(row.slug)}`
  return { listingPayload, contentHash, externalSlug: listingPayload.slug, canonicalKinkSocialUrl }
}

async function canManageVenue(row: NonNullable<Awaited<ReturnType<typeof loadVenueRow>>>, viewerId: string) {
  if (row.submittedByUserId === viewerId) return true
  if (row.linkedOrganizationId) {
    const access = await resolveOrgEckePublishAccess(row.linkedOrganizationId, viewerId)
    return Boolean(access?.canManage)
  }
  return false
}

export async function buildPresenterProfilePreview(
  viewer: EckePublishViewer,
  presenterUserId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  if (viewer.userId !== presenterUserId) {
    return { ok: false, status: 403, error: 'Only the presenter profile owner can manage ECKE publish' }
  }
  const row = await loadPresenterRow(presenterUserId)
  if (!row) return { ok: false, status: 404, error: 'Presenter profile not found' }

  const eligibility = presenterEligibility(row)
  const ctx = buildPresenterContext(row)
  const targetRow = await loadEckePublishTarget(
    { scopeType: 'presenter_profile', presenterUserId },
    'ecke_listing',
  )
  const status = deriveTargetDisplayStatus(ctx.contentHash, targetRow)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'presenter_profile',
      sourceId: presenterUserId,
      supportState: entry.supportState,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: targetRow?.publishedContentHash ?? null,
      lastPublishedAt: targetRow?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: targetRow?.lastPreviewAt?.toISOString() ?? null,
      lastError: targetRow?.lastError ?? null,
      externalSlug: ctx.externalSlug,
      eckePublicUrl: targetRow?.eckePublicUrl ?? resolveEckePublicPresenterUrl(ctx.externalSlug),
      eckePublicUrlKnown: Boolean(targetRow?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: eligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ? 'Presenter profile changed since last ECKE publish. Sync to update.' : null,
      wouldPublish: [
        { label: 'Display name', value: ctx.displayName },
        { label: 'Slug', value: ctx.externalSlug },
        { label: 'Public bio', value: ctx.listingPayload.description ?? null },
        { label: 'Canonical kink.social URL', value: ctx.canonicalKinkSocialUrl },
      ],
      wouldPublishDeferred: getPresenterDeferredFields(),
      wouldNotPublish: getPresenterOmittedFields(),
      payload: ctx.listingPayload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    },
  }
}

export async function buildVenueProfilePreview(
  viewer: EckePublishViewer,
  placeId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const row = await loadVenueRow(placeId)
  if (!row) return { ok: false, status: 404, error: 'Community place not found' }
  if (!(await canManageVenue(row, viewer.userId))) {
    return { ok: false, status: 403, error: 'Venue owner or org moderator access required' }
  }

  const eligibility = venueEligibility(row)
  const ctx = buildVenueContext(row)
  const targetRow = await loadEckePublishTarget({ scopeType: 'venue_profile', communityPlaceId: placeId }, 'ecke_listing')
  const status = deriveTargetDisplayStatus(ctx.contentHash, targetRow)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'venue_profile',
      sourceId: placeId,
      supportState: entry.supportState,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: targetRow?.publishedContentHash ?? null,
      lastPublishedAt: targetRow?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: targetRow?.lastPreviewAt?.toISOString() ?? null,
      lastError: targetRow?.lastError ?? null,
      externalSlug: ctx.externalSlug,
      eckePublicUrl: targetRow?.eckePublicUrl ?? resolveEckePublicVenueUrl(ctx.externalSlug),
      eckePublicUrlKnown: Boolean(targetRow?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: eligibility.eligible, status, bridgeConfigured }),
      staleNotice: status === 'stale' ? 'Venue listing changed since last ECKE publish. Sync to update.' : null,
      wouldPublish: [
        { label: 'Venue name', value: row.name },
        { label: 'Slug', value: ctx.externalSlug },
        { label: 'Public description', value: ctx.listingPayload.description ?? null },
        { label: 'Region summary', value: ctx.listingPayload.location ?? null },
        { label: 'Canonical kink.social URL', value: ctx.canonicalKinkSocialUrl },
      ],
      wouldPublishDeferred: [],
      wouldNotPublish: getVenueOmittedFields(),
      payload: ctx.listingPayload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    },
  }
}

async function publishPresenterListing(viewer: EckePublishViewer, presenterUserId: string) {
  const preview = await buildPresenterProfilePreview(viewer, presenterUserId, getRegistryEntry('presenter_profile')!)
  if (!preview.ok) return preview
  if (!preview.result.eligible) {
    return { ok: false as const, status: 400, error: preview.result.reason ?? 'Not eligible' }
  }
  const cfg = loadEckePublishClientConfig()
  if (!cfg) return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }

  const row = await loadPresenterRow(presenterUserId)
  if (!row) return { ok: false as const, status: 404, error: 'Presenter profile not found' }
  const ctx = buildPresenterContext(row)
  const scope = { scopeType: 'presenter_profile' as const, presenterUserId }

  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
  })
  await touchEckePublishPreview({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
  })

  const listingResult = await publishListingToEcke(cfg, ctx.listingPayload, {
    sourceSystem: 'kink.social',
    sourceId: presenterUserId,
    canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    entityType: 'presenter',
  })
  if (!listingResult.ok) {
    return { ok: false as const, status: 502, error: listingResult.error, errorCode: 'ecke_publish_failed' }
  }

  await markEckePublishSuccess({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
    result: listingResult,
  })

  const after = await buildPresenterProfilePreview(viewer, presenterUserId, getRegistryEntry('presenter_profile')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'presenter_profile' as const,
      sourceId: presenterUserId,
      status: after.ok ? after.result.status : 'published',
      message: 'Presenter profile published to ECKE',
      preview: after.ok ? after.result : undefined,
    },
  }
}

async function publishVenueListing(viewer: EckePublishViewer, placeId: string) {
  const preview = await buildVenueProfilePreview(viewer, placeId, getRegistryEntry('venue_profile')!)
  if (!preview.ok) return preview
  if (!preview.result.eligible) {
    return { ok: false as const, status: 400, error: preview.result.reason ?? 'Not eligible' }
  }
  const cfg = loadEckePublishClientConfig()
  if (!cfg) return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }

  const row = await loadVenueRow(placeId)
  if (!row) return { ok: false as const, status: 404, error: 'Community place not found' }
  const ctx = buildVenueContext(row)
  const scope = { scopeType: 'venue_profile' as const, communityPlaceId: placeId }

  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
  })
  await touchEckePublishPreview({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
  })

  const listingResult = await publishListingToEcke(cfg, ctx.listingPayload, {
    sourceSystem: 'kink.social',
    sourceId: placeId,
    canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    entityType: 'venue',
  })
  if (!listingResult.ok) {
    return { ok: false as const, status: 502, error: listingResult.error, errorCode: 'ecke_publish_failed' }
  }

  await markEckePublishSuccess({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
    result: listingResult,
  })

  const after = await buildVenueProfilePreview(viewer, placeId, getRegistryEntry('venue_profile')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'venue_profile' as const,
      sourceId: placeId,
      status: after.ok ? after.result.status : 'published',
      message: 'Venue listing published to ECKE',
      preview: after.ok ? after.result : undefined,
    },
  }
}

export async function executePresenterProfilePublish(viewer: EckePublishViewer, presenterUserId: string) {
  return publishPresenterListing(viewer, presenterUserId)
}

export async function executePresenterProfileUnpublish(viewer: EckePublishViewer, presenterUserId: string) {
  if (viewer.userId !== presenterUserId) {
    return { ok: false as const, status: 403, error: 'Only the presenter profile owner can unpublish' }
  }
  const scope = { scopeType: 'presenter_profile' as const, presenterUserId }
  const row = await loadEckePublishTarget(scope, 'ecke_listing')
  if (!row || row.status === 'unpublished') {
    return { ok: true as const, result: { ok: true, sourceKind: 'presenter_profile' as EckeSourceKind, sourceId: presenterUserId, status: 'unpublished' as const, message: 'Already unpublished' } }
  }
  const cfg = loadEckePublishClientConfig()
  let remoteOk = true
  let remoteError: string | null = null
  if (cfg) {
    const remoteResult = await unpublishListingToEcke(cfg, {
      slug: row.externalSlug,
      sourceId: presenterUserId,
      entityType: 'presenter',
    })
    remoteOk = remoteResult.ok
    remoteError = remoteResult.ok ? null : remoteResult.error ?? null
  }
  await markEckeUnpublishSuccess({ scope, targetKind: 'ecke_listing', userId: viewer.userId, remoteOk, remoteError })
  const preview = await buildPresenterProfilePreview(viewer, presenterUserId, getRegistryEntry('presenter_profile')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'presenter_profile' as const,
      sourceId: presenterUserId,
      status: preview.ok ? preview.result.status : 'unpublished',
      message: 'Presenter profile unpublished from ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

export async function executeVenueProfilePublish(viewer: EckePublishViewer, placeId: string) {
  return publishVenueListing(viewer, placeId)
}

export async function executeVenueProfileUnpublish(viewer: EckePublishViewer, placeId: string) {
  const place = await loadVenueRow(placeId)
  if (!place) return { ok: false as const, status: 404, error: 'Community place not found' }
  if (!(await canManageVenue(place, viewer.userId))) {
    return { ok: false as const, status: 403, error: 'Venue owner or org moderator access required' }
  }
  const scope = { scopeType: 'venue_profile' as const, communityPlaceId: placeId }
  const row = await loadEckePublishTarget(scope, 'ecke_listing')
  if (!row || row.status === 'unpublished') {
    return { ok: true as const, result: { ok: true, sourceKind: 'venue_profile' as const, sourceId: placeId, status: 'unpublished' as const, message: 'Already unpublished' } }
  }
  const cfg = loadEckePublishClientConfig()
  let remoteOk = true
  let remoteError: string | null = null
  if (cfg) {
    const remoteResult = await unpublishListingToEcke(cfg, {
      slug: row.externalSlug,
      sourceId: placeId,
      entityType: 'venue',
    })
    remoteOk = remoteResult.ok
    remoteError = remoteResult.ok ? null : remoteResult.error ?? null
  }
  await markEckeUnpublishSuccess({ scope, targetKind: 'ecke_listing', userId: viewer.userId, remoteOk, remoteError })
  const preview = await buildVenueProfilePreview(viewer, placeId, getRegistryEntry('venue_profile')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'venue_profile' as const,
      sourceId: placeId,
      status: preview.ok ? preview.result.status : 'unpublished',
      message: 'Venue listing unpublished from ECKE',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}
