import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  loadEckePublishClientConfig,
  publishDancecardEventToEcke,
  publishDungeonRowToEcke,
  publishListingToEcke,
  resolveEckePublicConventionUrl,
  resolveEckePublicDungeonUrl,
  resolveEckePublicEventUrl,
  resolveEckePublicGroupListingUrl,
  unpublishDungeonRowToEcke,
  unpublishListingToEcke,
} from './ecke-publish-client.js'
import { buildEckeEventRowFromListing } from './ecke-directory-sync.js'
import { executeEckeUnpublishConventionEvent } from './ecke-publish-executor.js'
import { requestEckeConventionEventPublish } from './ecke-publish-queue.js'
import { isEckeEventPublishBridgeConfigured } from './ecke-publish-config.js'
import {
  getConventionDeferredFields,
  getConventionOmittedFields,
  getDancecardDeferredFields,
  getDancecardOmittedFields,
  getOrgDeferredFields,
  getOrgOmittedFields,
  getVenueOmittedFields,
} from './ecke-redaction.js'
import {
  buildConventionListingPlainFields,
  buildConventionListingPublishContext,
  buildDancecardPlainFields,
  buildDancecardPublishContext,
  buildDungeonPlainFields,
  buildOrgDungeonPublishContext,
  buildOrgListingPlainFields,
  buildOrgListingPublishContext,
  loadConventionEckeContext,
  loadOrgEckePublishRow,
  redactDancecardPayloadForPreview,
  resolveOrgEckePublishAccess,
} from './ecke-publish-org-convention.js'
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
import type {
  EckePublishActions,
  EckePublishPreviewResult,
  EckePublishViewer,
} from './ecke-publish-service.js'

export const FINAL_SUPPORTED_WRITE_KINDS = new Set<EckeSourceKind>([
  'group_listing',
  'event_listing',
  'education_article',
  'vendor_profile',
  'organization_listing',
  'dungeon_profile',
  'convention_listing',
  'dancecard_event',
  'dancecard_location',
  'dancecard_program_slot',
  'dancecard_staff_shift',
  'presenter_profile',
  'venue_profile',
  'convention_event_anchor',
])

export function isFinalSupportedWriteKind(sourceKind: EckeSourceKind): boolean {
  return FINAL_SUPPORTED_WRITE_KINDS.has(sourceKind)
}

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

async function loadOrgListingTarget(orgId: string) {
  return loadEckePublishTarget({ scopeType: 'organization', organizationId: orgId }, 'ecke_listing')
}

async function loadOrgDungeonTarget(orgId: string) {
  return loadEckePublishTarget({ scopeType: 'organization', organizationId: orgId }, 'ecke_dungeon')
}

async function loadConventionListingTarget(conventionId: string) {
  return loadEckePublishTarget({ scopeType: 'convention', conventionId: conventionId }, 'ecke_listing')
}

async function loadDancecardTarget(conventionId: string) {
  return loadEckePublishTarget({ scopeType: 'convention', conventionId: conventionId }, 'dancecard_event')
}

export async function buildOrganizationListingPreview(
  viewer: EckePublishViewer,
  organizationId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const org = await loadOrgEckePublishRow(organizationId)
  if (!org) return { ok: false, status: 404, error: 'Organization not found' }
  const access = await resolveOrgEckePublishAccess(org.id, viewer.userId)
  if (!access?.canManage) {
    return { ok: false, status: 403, error: 'Organization moderator access required to preview ECKE publish' }
  }

  const ctx = buildOrgListingPublishContext(org)
  const row = await loadOrgListingTarget(org.id)
  const status = deriveTargetDisplayStatus(ctx.contentHash, row)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'organization_listing',
      sourceId: org.id,
      supportState: entry.supportState,
      eligible: ctx.eligibility.eligible,
      reason: ctx.eligibility.reason,
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: ctx.externalSlug,
      eckePublicUrl: row?.eckePublicUrl ?? resolveEckePublicGroupListingUrl(ctx.externalSlug),
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: ctx.eligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'This organization listing has changed since it was last published to ECKE. Sync to update.'
        : null,
      wouldPublish: buildOrgListingPlainFields(ctx),
      wouldPublishDeferred: getOrgDeferredFields(),
      wouldNotPublish: getOrgOmittedFields(),
      payload: ctx.listingPayload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    },
  }
}

export async function buildDungeonProfilePreview(
  viewer: EckePublishViewer,
  organizationId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const org = await loadOrgEckePublishRow(organizationId)
  if (!org) return { ok: false, status: 404, error: 'Organization not found' }
  const access = await resolveOrgEckePublishAccess(org.id, viewer.userId)
  if (!access?.canManage) {
    return { ok: false, status: 403, error: 'Organization moderator access required to preview ECKE publish' }
  }

  const ctx = buildOrgDungeonPublishContext(org)
  if (!ctx.eligibility.eligible) {
    return { ok: false, status: 400, error: ctx.eligibility.reason ?? 'Organization is not a dungeon listing' }
  }

  const row = await loadOrgDungeonTarget(org.id)
  const status = deriveTargetDisplayStatus(ctx.contentHash, row)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'dungeon_profile',
      sourceId: org.id,
      supportState: entry.supportState,
      eligible: true,
      status,
      contentHash: ctx.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: ctx.externalSlug,
      eckePublicUrl: row?.eckePublicUrl ?? resolveEckePublicDungeonUrl(ctx.externalSlug),
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: true, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'This dungeon/venue listing has changed since it was last published to ECKE. Sync to update.'
        : null,
      wouldPublish: buildDungeonPlainFields(ctx),
      wouldNotPublish: getVenueOmittedFields(),
      payload: ctx.payload,
      canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    },
  }
}

export async function buildConventionListingPreview(
  viewer: EckePublishViewer,
  conventionId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx) return { ok: false, status: 404, error: 'Convention not found' }
  if (!ctx.canManage) {
    return { ok: false, status: 403, error: 'Convention full admin access required to preview ECKE publish' }
  }

  const pub = buildConventionListingPublishContext(ctx)
  const row = await loadConventionListingTarget(ctx.conv.id)
  const status = deriveTargetDisplayStatus(pub.contentHash, row)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'convention_listing',
      sourceId: ctx.conv.id,
      supportState: entry.supportState,
      eligible: pub.eligibility.eligible,
      status,
      contentHash: pub.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: pub.externalSlug,
      eckePublicUrl: row?.eckePublicUrl ?? resolveEckePublicConventionUrl(pub.externalSlug),
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: pub.eligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'This convention listing has changed since it was last published to ECKE. Sync to update.'
        : null,
      wouldPublish: buildConventionListingPlainFields(pub),
      wouldPublishDeferred: getConventionDeferredFields(),
      wouldNotPublish: getConventionOmittedFields(),
      payload: pub.listingPayload,
      canonicalKinkSocialUrl: pub.canonicalKinkSocialUrl,
    },
  }
}

export async function buildDancecardEventPreview(
  viewer: EckePublishViewer,
  conventionId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx) return { ok: false, status: 404, error: 'Convention not found' }
  if (!ctx.canManage) {
    return { ok: false, status: 403, error: 'Convention full admin access required to preview ECKE publish' }
  }

  const pub = buildDancecardPublishContext(ctx)
  if (!pub.payload || !pub.contentHash) {
    return { ok: false, status: 400, error: pub.eligibility.reason ?? 'Dancecard not eligible' }
  }

  const row = await loadDancecardTarget(ctx.conv.id)
  const status = deriveTargetDisplayStatus(pub.contentHash, row)
  const bridgeConfigured = loadEckePublishClientConfig() !== null

  return {
    ok: true,
    result: {
      sourceKind: 'dancecard_event',
      sourceId: ctx.conv.id,
      supportState: entry.supportState,
      eligible: pub.eligibility.eligible,
      status,
      contentHash: pub.contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: pub.externalSlug,
      eckePublicUrl: row?.eckePublicUrl ?? null,
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: pub.eligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'Dancecard content has changed since it was last published to ECKE. Sync to update.'
        : null,
      wouldPublish: buildDancecardPlainFields(pub),
      wouldPublishDeferred: getDancecardDeferredFields(),
      wouldNotPublish: getDancecardOmittedFields(),
      payload: redactDancecardPayloadForPreview(pub.payload),
      canonicalKinkSocialUrl: pub.canonicalKinkSocialUrl,
    },
  }
}

export async function executeOrganizationListingPublish(viewer: EckePublishViewer, organizationId: string) {
  const preview = await buildOrganizationListingPreview(
    viewer,
    organizationId,
    getRegistryEntry('organization_listing')!,
  )
  if (!preview.ok) return preview
  if (!preview.result.eligible) {
    return { ok: false as const, status: 400, error: preview.result.reason ?? 'Not eligible' }
  }

  const cfg = loadEckePublishClientConfig()
  if (!cfg) return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }

  const org = await loadOrgEckePublishRow(organizationId)
  if (!org) return { ok: false as const, status: 404, error: 'Organization not found' }
  const ctx = buildOrgListingPublishContext(org)
  const scope = { scopeType: 'organization' as const, organizationId: org.id }

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
    sourceId: org.id,
    canonicalKinkSocialUrl: ctx.canonicalKinkSocialUrl,
    entityType: 'organization',
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

  const after = await buildOrganizationListingPreview(viewer, organizationId, getRegistryEntry('organization_listing')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'organization_listing' as const,
      sourceId: organizationId,
      status: after.ok ? after.result.status : 'published',
      message: 'Organization listing published to ECKE',
      preview: after.ok ? after.result : undefined,
    },
  }
}

export async function executeOrganizationListingUnpublish(viewer: EckePublishViewer, organizationId: string) {
  const access = await resolveOrgEckePublishAccess(organizationId, viewer.userId)
  if (!access?.canManage) return { ok: false as const, status: 403, error: 'Organization moderator access required' }

  const scope = { scopeType: 'organization' as const, organizationId: access.org.id }
  const row = await loadOrgListingTarget(access.org.id)
  if (!row || row.status === 'unpublished') {
    const preview = await buildOrganizationListingPreview(viewer, organizationId, getRegistryEntry('organization_listing')!)
    return {
      ok: true as const,
      result: {
        ok: true,
        sourceKind: 'organization_listing' as const,
        sourceId: organizationId,
        status: 'unpublished' as const,
        message: 'Organization listing is already unpublished on ECKE',
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
      sourceId: access.org.id,
      entityType: 'organization',
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

  const preview = await buildOrganizationListingPreview(viewer, organizationId, getRegistryEntry('organization_listing')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'organization_listing' as const,
      sourceId: organizationId,
      status,
      message: remoteOk ? 'Organization listing unpublished from ECKE' : 'Local unpublish recorded; remote webhook reported an error',
      error: remoteOk ? undefined : remoteError ?? undefined,
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

export async function executeDungeonProfilePublish(viewer: EckePublishViewer, organizationId: string) {
  const preview = await buildDungeonProfilePreview(viewer, organizationId, getRegistryEntry('dungeon_profile')!)
  if (!preview.ok) return preview
  if (!preview.result.eligible) {
    return { ok: false as const, status: 400, error: preview.result.reason ?? 'Not eligible' }
  }

  const cfg = loadEckePublishClientConfig()
  if (!cfg) return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }

  const org = await loadOrgEckePublishRow(organizationId)
  if (!org) return { ok: false as const, status: 404, error: 'Organization not found' }
  const ctx = buildOrgDungeonPublishContext(org)
  const scope = { scopeType: 'organization' as const, organizationId: org.id }

  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'ecke_dungeon',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
  })

  const result = await publishDungeonRowToEcke(cfg, ctx.payload)
  if (!result.ok) {
    return { ok: false as const, status: 502, error: result.error, errorCode: 'ecke_publish_failed' }
  }

  await markEckePublishSuccess({
    scope,
    targetKind: 'ecke_dungeon',
    externalSlug: ctx.externalSlug,
    contentHash: ctx.contentHash,
    userId: viewer.userId,
    result: {
      ...result,
      eckePublicUrl: resolveEckePublicDungeonUrl(ctx.externalSlug) ?? undefined,
    },
  })

  const after = await buildDungeonProfilePreview(viewer, organizationId, getRegistryEntry('dungeon_profile')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'dungeon_profile' as const,
      sourceId: organizationId,
      status: after.ok ? after.result.status : 'published',
      message: 'Dungeon/venue profile published to ECKE',
      preview: after.ok ? after.result : undefined,
    },
  }
}

export async function executeDungeonProfileUnpublish(viewer: EckePublishViewer, organizationId: string) {
  const access = await resolveOrgEckePublishAccess(organizationId, viewer.userId)
  if (!access?.canManage) return { ok: false as const, status: 403, error: 'Organization moderator access required' }

  const scope = { scopeType: 'organization' as const, organizationId: access.org.id }
  const row = await loadOrgDungeonTarget(access.org.id)
  if (!row || row.status === 'unpublished') {
    const preview = await buildDungeonProfilePreview(viewer, organizationId, getRegistryEntry('dungeon_profile')!)
    return {
      ok: true as const,
      result: {
        ok: true,
        sourceKind: 'dungeon_profile' as const,
        sourceId: organizationId,
        status: 'unpublished' as const,
        message: 'Dungeon listing is already unpublished on ECKE',
        preview: preview.ok ? preview.result : undefined,
      },
    }
  }

  const cfg = loadEckePublishClientConfig()
  let remoteOk = true
  let remoteError: string | null = null
  if (cfg && row.externalSlug) {
    const remoteResult = await unpublishDungeonRowToEcke(cfg, row.externalSlug)
    remoteOk = remoteResult.ok
    remoteError = remoteResult.ok ? null : remoteResult.error
  }

  const status = await markEckeUnpublishSuccess({
    scope,
    targetKind: 'ecke_dungeon',
    userId: viewer.userId,
    remoteOk,
    remoteError,
  })

  const preview = await buildDungeonProfilePreview(viewer, organizationId, getRegistryEntry('dungeon_profile')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'dungeon_profile' as const,
      sourceId: organizationId,
      status,
      message: remoteOk ? 'Dungeon listing unpublished from ECKE' : 'Local unpublish recorded; remote Supabase reported an error',
      error: remoteOk ? undefined : remoteError ?? undefined,
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

export async function executeConventionListingPublish(viewer: EckePublishViewer, conventionId: string) {
  const preview = await buildConventionListingPreview(viewer, conventionId, getRegistryEntry('convention_listing')!)
  if (!preview.ok) return preview

  const cfg = loadEckePublishClientConfig()
  if (!cfg) return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }

  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx?.canManage) return { ok: false as const, status: 403, error: 'Convention full admin access required' }

  const pub = buildConventionListingPublishContext(ctx)
  const scope = { scopeType: 'convention' as const, conventionId: ctx.conv.id }

  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: pub.externalSlug,
    contentHash: pub.contentHash,
  })

  const listingResult = await publishListingToEcke(cfg, pub.listingPayload, {
    sourceSystem: 'kink.social',
    sourceId: ctx.conv.id,
    canonicalKinkSocialUrl: pub.canonicalKinkSocialUrl,
    entityType: 'convention',
  })

  if (!listingResult.ok) {
    return { ok: false as const, status: 502, error: listingResult.error, errorCode: 'ecke_publish_failed' }
  }

  await markEckePublishSuccess({
    scope,
    targetKind: 'ecke_listing',
    externalSlug: pub.externalSlug,
    contentHash: pub.contentHash,
    userId: viewer.userId,
    result: listingResult,
  })

  const after = await buildConventionListingPreview(viewer, conventionId, getRegistryEntry('convention_listing')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'convention_listing' as const,
      sourceId: conventionId,
      status: after.ok ? after.result.status : 'published',
      message: 'Convention listing published to ECKE',
      preview: after.ok ? after.result : undefined,
    },
  }
}

export async function executeConventionListingUnpublish(viewer: EckePublishViewer, conventionId: string) {
  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx) return { ok: false as const, status: 404, error: 'Convention not found' }
  if (!ctx.canManage) return { ok: false as const, status: 403, error: 'Convention full admin access required' }

  const scope = { scopeType: 'convention' as const, conventionId: ctx.conv.id }
  const row = await loadConventionListingTarget(ctx.conv.id)
  if (!row || row.status === 'unpublished') {
    const preview = await buildConventionListingPreview(viewer, conventionId, getRegistryEntry('convention_listing')!)
    return {
      ok: true as const,
      result: {
        ok: true,
        sourceKind: 'convention_listing' as const,
        sourceId: conventionId,
        status: 'unpublished' as const,
        message: 'Convention listing is already unpublished on ECKE',
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
      sourceId: ctx.conv.id,
      entityType: 'convention',
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

  const preview = await buildConventionListingPreview(viewer, conventionId, getRegistryEntry('convention_listing')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'convention_listing' as const,
      sourceId: conventionId,
      status,
      message: remoteOk ? 'Convention listing unpublished from ECKE' : 'Local unpublish recorded; remote webhook reported an error',
      error: remoteOk ? undefined : remoteError ?? undefined,
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

export async function executeDancecardEventPublish(viewer: EckePublishViewer, conventionId: string) {
  const preview = await buildDancecardEventPreview(viewer, conventionId, getRegistryEntry('dancecard_event')!)
  if (!preview.ok) return preview

  const cfg = loadEckePublishClientConfig()
  if (!cfg) return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }

  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx?.canManage) return { ok: false as const, status: 403, error: 'Convention full admin access required' }

  const pub = buildDancecardPublishContext(ctx)
  if (!pub.payload || !pub.contentHash) {
    return { ok: false as const, status: 400, error: pub.eligibility.reason ?? 'Dancecard not eligible' }
  }

  const scope = { scopeType: 'convention' as const, conventionId: ctx.conv.id }
  await ensureEckePublishTargetRow({
    scope,
    targetKind: 'dancecard_event',
    externalSlug: pub.externalSlug!,
    contentHash: pub.contentHash,
  })

  const result = await publishDancecardEventToEcke(cfg, pub.payload)
  if (!result.ok) {
    return { ok: false as const, status: 502, error: result.error, errorCode: 'ecke_publish_failed' }
  }

  await markEckePublishSuccess({
    scope,
    targetKind: 'dancecard_event',
    externalSlug: pub.externalSlug!,
    contentHash: pub.contentHash,
    userId: viewer.userId,
    result,
  })

  const after = await buildDancecardEventPreview(viewer, conventionId, getRegistryEntry('dancecard_event')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'dancecard_event' as const,
      sourceId: conventionId,
      status: after.ok ? after.result.status : 'published',
      message: 'Dancecard published to ECKE',
      preview: after.ok ? after.result : undefined,
    },
  }
}

export async function executeDancecardEventUnpublish(viewer: EckePublishViewer, conventionId: string) {
  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx) return { ok: false as const, status: 404, error: 'Convention not found' }
  if (!ctx.canManage) return { ok: false as const, status: 403, error: 'Convention full admin access required' }

  const pub = buildDancecardPublishContext(ctx)
  if (!pub.payload) {
    return { ok: false as const, status: 400, error: 'Dancecard not configured for this convention' }
  }

  const scope = { scopeType: 'convention' as const, conventionId: ctx.conv.id }
  const row = await loadDancecardTarget(ctx.conv.id)

  const cfg = loadEckePublishClientConfig()
  let remoteOk = true
  let remoteError: string | null = null
  if (cfg && row?.externalSlug) {
    const draftPayload = { ...pub.payload, status: 'draft' as const }
    const remoteResult = await publishDancecardEventToEcke(cfg, draftPayload)
    remoteOk = remoteResult.ok
    remoteError = remoteResult.ok ? null : remoteResult.error
  }

  const status = await markEckeUnpublishSuccess({
    scope,
    targetKind: 'dancecard_event',
    userId: viewer.userId,
    remoteOk,
    remoteError,
  })

  const preview = await buildDancecardEventPreview(viewer, conventionId, getRegistryEntry('dancecard_event')!)
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'dancecard_event' as const,
      sourceId: conventionId,
      status,
      message: remoteOk ? 'Dancecard unpublished (draft) on ECKE' : 'Local unpublish recorded; remote Supabase reported an error',
      error: remoteOk ? undefined : remoteError ?? undefined,
      preview: preview.ok ? preview.result : undefined,
    },
  }
}

export function payloadExcludesPrivateOrgFields(payload: Record<string, unknown>): boolean {
  const serialized = JSON.stringify(payload).toLowerCase()
  const forbidden = ['memberlist', 'moderationnotes', 'internalnotes', 'privatecontact', 'applicationanswers']
  return !forbidden.some((token) => serialized.includes(token))
}

export function payloadExcludesPrivateDancecardFields(payload: Record<string, unknown>): boolean {
  const serialized = JSON.stringify(payload).toLowerCase()
  const forbidden = ['userid', 'privatecontact', 'attendee']
  const raw = JSON.stringify(payload)
  if (/staffAccessCode":\s*"[^[\]]/.test(raw) && !raw.includes('[configured]')) return false
  if (/registrationAccessCode":\s*"[^[\]]/.test(raw) && !raw.includes('[configured]')) return false
  return !forbidden.some((token) => serialized.includes(token))
}

async function loadConventionEventAnchorTarget(conventionId: string) {
  return loadEckePublishTarget({ scopeType: 'convention', conventionId }, 'ecke_event')
}

export async function buildConventionEventAnchorPreview(
  viewer: EckePublishViewer,
  conventionId: string,
  entry: EckeRegistryEntry,
): Promise<{ ok: true; result: EckePublishPreviewResult } | { ok: false; status: number; error: string }> {
  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx) return { ok: false, status: 404, error: 'Convention not found' }
  if (!ctx.canManage) {
    return { ok: false, status: 403, error: 'Convention full admin access required to preview ECKE publish' }
  }

  const pub = buildConventionListingPublishContext(ctx)
  const eventRow = buildEckeEventRowFromListing(pub.listingPayload, ctx.conv.id, 'convention')
  const contentHash = pub.contentHash
  const row = await loadConventionEventAnchorTarget(ctx.conv.id)
  const status = deriveTargetDisplayStatus(contentHash, row)
  const bridgeConfigured = isEckeEventPublishBridgeConfigured()

  return {
    ok: true,
    result: {
      sourceKind: 'convention_event_anchor',
      sourceId: ctx.conv.id,
      supportState: entry.supportState,
      eligible: pub.eligibility.eligible,
      status,
      contentHash,
      publishedContentHash: row?.publishedContentHash ?? null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastPreviewAt: row?.lastPreviewAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      externalSlug: eventRow.slug,
      eckePublicUrl: row?.eckePublicUrl ?? resolveEckePublicEventUrl(eventRow.slug),
      eckePublicUrlKnown: Boolean(row?.eckePublicUrl),
      currentTransport: entry.currentTransport,
      eckeSurfacesAffected: entry.eckeSurfacesAffected,
      actions: listingActions({ eligible: pub.eligibility.eligible, status, bridgeConfigured }),
      staleNotice:
        status === 'stale' ?
          'Convention event directory row changed since last publish. Sync to update ECKE events.'
        : null,
      wouldPublish: buildConventionListingPlainFields(pub),
      wouldPublishDeferred: getConventionDeferredFields(),
      wouldNotPublish: getConventionOmittedFields(),
      payload: eventRow,
      canonicalKinkSocialUrl: pub.canonicalKinkSocialUrl,
    },
  }
}

export async function executeConventionEventAnchorPublish(viewer: EckePublishViewer, conventionId: string) {
  const preview = await buildConventionEventAnchorPreview(
    viewer,
    conventionId,
    getRegistryEntry('convention_event_anchor')!,
  )
  if (!preview.ok) return preview
  if (!preview.result.eligible) {
    return { ok: false as const, status: 400, error: preview.result.reason ?? 'Not eligible' }
  }

  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false as const, status: 503, error: 'ECKE publish bridge is not configured' }
  }

  await requestEckeConventionEventPublish(conventionId, viewer.userId)

  const after = await buildConventionEventAnchorPreview(
    viewer,
    conventionId,
    getRegistryEntry('convention_event_anchor')!,
  )
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'convention_event_anchor' as const,
      sourceId: conventionId,
      status: after.ok ? after.result.status : 'draft',
      message: 'Convention ECKE publish queued',
      preview: after.ok ? after.result : undefined,
    },
  }
}

export async function executeConventionEventAnchorUnpublish(viewer: EckePublishViewer, conventionId: string) {
  const ctx = await loadConventionEckeContext(conventionId, viewer.userId)
  if (!ctx?.canManage) {
    return { ok: false as const, status: 403, error: 'Convention full admin access required' }
  }

  const result = await executeEckeUnpublishConventionEvent(conventionId, viewer.userId)
  if (!result.ok) {
    return { ok: false as const, status: 502, error: result.error ?? 'ECKE event unpublish failed', errorCode: 'ecke_publish_failed' }
  }

  const preview = await buildConventionEventAnchorPreview(
    viewer,
    conventionId,
    getRegistryEntry('convention_event_anchor')!,
  )
  return {
    ok: true as const,
    result: {
      ok: true,
      sourceKind: 'convention_event_anchor' as const,
      sourceId: conventionId,
      status: preview.ok ? preview.result.status : 'unpublished',
      message: 'Convention removed from ECKE Events',
      preview: preview.ok ? preview.result : undefined,
    },
  }
}
