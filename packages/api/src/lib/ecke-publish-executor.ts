import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import {
  executeEckePublishEntity,
  executeEckeUnpublishEducationArticle,
} from './ecke-public-publish-executor.js'
import {
  buildEckeEventRowFromListing,
  buildEckeEventRowFromStandaloneEvent,
  buildEckeVendorRow,
} from './ecke-directory-sync.js'
import { isEckePublishEligible } from '@c2k/shared'
import {
  publishEckeEventDualWrite,
  unpublishEckeEventDualWrite,
} from './ecke-event-ingest-publish.js'
import {
  loadEckeIngestApiConfig,
  loadEckePublishClientConfig,
  publishVendorRowToEcke,
  resolveEckePublicEventUrl,
  resolveEckePublicVendorUrl,
  unpublishVendorRowToEcke,
  type EckePublishResult,
} from './ecke-publish-client.js'
import { isEckeEventPublishBridgeConfigured } from './ecke-publish-config.js'
import {
  buildConventionListingPayload,
  buildStandaloneEventListingPayload,
  hashEckePayload,
  isStandaloneEventEckeEligible,
  resolveStandaloneEventEckeSlug,
} from './ecke-publish-payload.js'
import { syncEckePublishTargetMedia } from './ecke-publish-target-store.js'

export type EckePublishJobName =
  | 'publish-article'
  | 'publish-vendor'
  | 'publish-convention-event'
  | 'publish-standalone-event'

export async function executeEckePublishArticle(articleId: string, userId?: string): Promise<EckePublishResult> {
  const ingestCfg = loadEckeIngestApiConfig()
  if (!ingestCfg) {
    return {
      ok: false,
      targetKind: 'ecke_article',
      error:
        'ECKE ingest API not configured (set ECKE_PUBLISH_ENABLED, ECKE_PUBLISH_ENDPOINT, ECKE_PUBLISH_SECRET)',
    }
  }

  const outcome = await executeEckePublishEntity('education_article', articleId, ingestCfg, userId)
  if (!outcome.contentHash) {
    return outcome
  }

  const externalSlug = outcome.externalSlug ?? articleId
  await upsertEntityTarget({
    scopeType: 'education_article',
    educationArticleId: articleId,
    targetKind: 'ecke_article',
    externalSlug,
    contentHash: outcome.contentHash,
    userId,
  })

  await markEntityOutcome({
    educationArticleId: articleId,
    targetKind: 'ecke_article',
    contentHash: outcome.contentHash,
    externalSlug: outcome.ok ? externalSlug : undefined,
    eckePublicUrl: outcome.ok ? outcome.eckePublicUrl : undefined,
    userId,
    result: outcome,
  })

  return outcome
}

export { executeEckeUnpublishEducationArticle }

export async function executeEckePublishVendor(vendorProfileId: string, userId?: string): Promise<EckePublishResult> {
  const cfg = loadEckePublishClientConfig()
  if (!cfg) {
    return { ok: false, targetKind: 'ecke_vendor', error: 'Publish bridge not configured' }
  }

  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorProfileId))
    .limit(1)

  if (!vendor) {
    return { ok: false, targetKind: 'ecke_vendor', error: 'Vendor not found' }
  }
  if (
    !isEckePublishEligible({
      publishToEcke: vendor.eckePublish,
      visibility: vendor.visibility,
    })
  ) {
    return { ok: false, targetKind: 'ecke_vendor', error: 'Vendor not eligible for ECKE publish' }
  }

  const row = buildEckeVendorRow(vendor)
  const contentHash = hashEckePayload(row)
  await upsertEntityTarget({
    scopeType: 'vendor_profile',
    vendorProfileId: vendor.id,
    targetKind: 'ecke_vendor',
    externalSlug: row.slug,
    contentHash,
    userId,
  })

  const result = await publishVendorRowToEcke(cfg, row)
  await markEntityOutcome({
    vendorProfileId: vendor.id,
    targetKind: 'ecke_vendor',
    contentHash,
    externalSlug: row.slug,
    eckePublicUrl: result.ok ? resolveEckePublicVendorUrl(row.slug) ?? undefined : undefined,
    userId,
    result,
  })
  return result
}

async function loadConventionPublishContext(conventionId: string) {
  const [conv] = await db
    .select({
      id: schema.conventions.id,
      slug: schema.conventions.slug,
      name: schema.conventions.name,
      description: schema.conventions.description,
      startsAt: schema.conventions.startsAt,
      endsAt: schema.conventions.endsAt,
      settings: schema.conventions.settings,
      organizationId: schema.conventions.organizationId,
      anchorEventId: schema.conventions.anchorEventId,
    })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, conventionId))
    .limit(1)

  if (!conv) return null

  let org: { slug: string; displayName: string } | null = null
  if (conv.organizationId) {
    const [o] = await db
      .select({ slug: schema.organizations.slug, displayName: schema.organizations.displayName })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, conv.organizationId))
      .limit(1)
    org = o ?? null
  }

  let anchor: Parameters<typeof buildConventionListingPayload>[0]['anchor'] = null
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
    if (ev) {
      anchor = {
        title: ev.title,
        description: ev.description,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        location: ev.location,
        publicLocationSummary: ev.publicLocationSummary,
        imageUrl: ev.imageUrl,
        visibility: ev.visibility,
      }
    }
  }

  return { conv, org, anchor }
}

export async function executeEckePublishConventionEvent(
  conventionId: string,
  userId?: string,
): Promise<EckePublishResult> {
  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  const ctx = await loadConventionPublishContext(conventionId)
  if (!ctx) {
    return { ok: false, targetKind: 'ecke_event', error: 'Convention not found' }
  }
  const { conv, org, anchor } = ctx

  const listing = buildConventionListingPayload({
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

  if (listing.visibility === 'hidden') {
    return { ok: false, targetKind: 'ecke_event', error: 'Convention listing is not public' }
  }

  const row = buildEckeEventRowFromListing(listing, conv.id, 'convention')
  const contentHash = hashEckePayload(row)
  await upsertEntityTarget({
    scopeType: 'convention',
    conventionId: conv.id,
    targetKind: 'ecke_event',
    externalSlug: row.slug,
    contentHash,
    userId,
  })

  const result = await publishEckeEventDualWrite({
    row,
    canonicalKinkSocialPath: `/conventions/${encodeURIComponent(conv.slug)}`,
  })
  await markEntityOutcome({
    conventionId: conv.id,
    targetKind: 'ecke_event',
    contentHash,
    externalSlug: result.ok ? row.slug : undefined,
    eckePublicUrl: result.ok ? (result.eckePublicUrl ?? resolveEckePublicEventUrl(row.slug)) : undefined,
    userId,
    result,
  })
  return result
}

export async function executeEckeUnpublishConventionEvent(
  conventionId: string,
  userId?: string,
): Promise<EckePublishResult> {
  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  const [target] = await db
    .select({
      externalSlug: schema.eckePublishTargets.externalSlug,
      contentHash: schema.eckePublishTargets.contentHash,
    })
    .from(schema.eckePublishTargets)
    .where(
      and(
        eq(schema.eckePublishTargets.conventionId, conventionId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_event'),
      ),
    )
    .limit(1)

  if (!target?.externalSlug) {
    return { ok: false, targetKind: 'ecke_event', error: 'No published ECKE event target for this convention' }
  }

  const result = await unpublishEckeEventDualWrite({
    sourceId: conventionId,
    c2kSourceType: 'convention',
    externalSlug: target.externalSlug,
  })
  const now = new Date()
  if (result.ok) {
    await db
      .update(schema.eckePublishTargets)
      .set({
        status: 'stale',
        lastAttemptAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.eckePublishTargets.conventionId, conventionId),
          eq(schema.eckePublishTargets.targetKind, 'ecke_event'),
        ),
      )
    return result
  }

  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'error',
      lastAttemptAt: now,
      lastError: result.error,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.eckePublishTargets.conventionId, conventionId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_event'),
      ),
    )
  return result
}

async function loadStandaloneEventPublishContext(eventId: string) {
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
    .where(eq(schema.conventions.anchorEventId, eventId))
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
    .where(
      and(eq(schema.eckePublishTargets.eventId, eventId), eq(schema.eckePublishTargets.targetKind, 'ecke_event')),
    )
    .limit(1)

  return {
    ev,
    org,
    hostDisplayName: hostProfile?.displayName?.trim() || hostProfile?.username || null,
    isConventionAnchor: Boolean(anchorConv),
    priorEckeSlug: priorTarget?.externalSlug ?? null,
  }
}

export async function executeEckePublishStandaloneEvent(
  eventId: string,
  userId?: string,
): Promise<EckePublishResult> {
  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  const ctx = await loadStandaloneEventPublishContext(eventId)
  if (!ctx) {
    return { ok: false, targetKind: 'ecke_event', error: 'Event not found' }
  }
  const { ev, org, hostDisplayName, isConventionAnchor, priorEckeSlug } = ctx

  const eligibility = isStandaloneEventEckeEligible({
    visibility: ev.visibility,
    isConventionAnchor,
  })
  if (!eligibility.eligible) {
    return { ok: false, targetKind: 'ecke_event', error: eligibility.reason ?? 'Event not eligible for ECKE publish' }
  }

  const listing = buildStandaloneEventListingPayload({
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
    hostDisplayName,
    visibility: ev.visibility,
    eckeSlug: priorEckeSlug ?? resolveStandaloneEventEckeSlug(ev.title, ev.id),
  })

  if (listing.visibility === 'hidden') {
    return { ok: false, targetKind: 'ecke_event', error: 'Event listing is not public' }
  }

  const row = buildEckeEventRowFromStandaloneEvent(listing, ev.id, {
    category: ev.category,
    tags: ev.tags,
  })
  const contentHash = hashEckePayload(row)
  await upsertEntityTarget({
    scopeType: 'event',
    eventId: ev.id,
    targetKind: 'ecke_event',
    externalSlug: row.slug,
    contentHash,
    userId,
  })

  const result = await publishEckeEventDualWrite({
    row,
    canonicalKinkSocialPath: `/events/${encodeURIComponent(ev.id)}`,
  })
  await markEntityOutcome({
    eventId: ev.id,
    targetKind: 'ecke_event',
    contentHash,
    externalSlug: result.ok ? row.slug : undefined,
    eckePublicUrl: result.ok ? (result.eckePublicUrl ?? resolveEckePublicEventUrl(row.slug)) : undefined,
    userId,
    result,
  })
  return result
}

export async function executeEckeUnpublishStandaloneEvent(
  eventId: string,
  userId?: string,
): Promise<EckePublishResult> {
  if (!isEckeEventPublishBridgeConfigured()) {
    return { ok: false, targetKind: 'ecke_event', error: 'Publish bridge not configured' }
  }

  const [target] = await db
    .select({ externalSlug: schema.eckePublishTargets.externalSlug })
    .from(schema.eckePublishTargets)
    .where(and(eq(schema.eckePublishTargets.eventId, eventId), eq(schema.eckePublishTargets.targetKind, 'ecke_event')))
    .limit(1)

  if (!target?.externalSlug) {
    return { ok: false, targetKind: 'ecke_event', error: 'No published ECKE event target for this event' }
  }

  const result = await unpublishEckeEventDualWrite({
    sourceId: eventId,
    c2kSourceType: 'event',
    externalSlug: target.externalSlug,
  })
  const now = new Date()
  if (result.ok) {
    await db
      .update(schema.eckePublishTargets)
      .set({
        status: 'stale',
        lastAttemptAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(and(eq(schema.eckePublishTargets.eventId, eventId), eq(schema.eckePublishTargets.targetKind, 'ecke_event')))
    return result
  }

  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'error',
      lastAttemptAt: now,
      lastError: result.error,
      updatedAt: now,
    })
    .where(and(eq(schema.eckePublishTargets.eventId, eventId), eq(schema.eckePublishTargets.targetKind, 'ecke_event')))
  return result
}

async function upsertEntityTarget(input: {
  scopeType: 'education_article' | 'vendor_profile' | 'convention' | 'event'
  educationArticleId?: string
  vendorProfileId?: string
  conventionId?: string
  eventId?: string
  targetKind: 'ecke_article' | 'ecke_vendor' | 'ecke_event'
  externalSlug: string
  contentHash: string
  userId?: string
}) {
  const now = new Date()
  const where =
    input.scopeType === 'education_article' ?
      and(
        eq(schema.eckePublishTargets.educationArticleId, input.educationArticleId!),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )
    : input.scopeType === 'vendor_profile' ?
      and(
        eq(schema.eckePublishTargets.vendorProfileId, input.vendorProfileId!),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )
    : input.scopeType === 'event' ?
      and(eq(schema.eckePublishTargets.eventId, input.eventId!), eq(schema.eckePublishTargets.targetKind, input.targetKind))
    : and(
        eq(schema.eckePublishTargets.conventionId, input.conventionId!),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )

  const [prev] = await db
    .select({
      id: schema.eckePublishTargets.id,
      publishedContentHash: schema.eckePublishTargets.publishedContentHash,
      lastPublishedAt: schema.eckePublishTargets.lastPublishedAt,
    })
    .from(schema.eckePublishTargets)
    .where(where)
    .limit(1)

  const status =
    prev?.publishedContentHash === input.contentHash && prev.lastPublishedAt ?
      ('published' as const)
    : prev?.lastPublishedAt ?
      ('stale' as const)
    : ('draft' as const)

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
    return
  }

  await db.insert(schema.eckePublishTargets).values({
    scopeType: input.scopeType,
    educationArticleId: input.educationArticleId ?? null,
    vendorProfileId: input.vendorProfileId ?? null,
    conventionId: input.conventionId ?? null,
    eventId: input.eventId ?? null,
    targetKind: input.targetKind,
    externalSlug: input.externalSlug,
    contentHash: input.contentHash,
    status,
    lastPreviewAt: now,
  })
}

async function markEntityOutcome(input: {
  educationArticleId?: string
  vendorProfileId?: string
  conventionId?: string
  eventId?: string
  targetKind: 'ecke_article' | 'ecke_vendor' | 'ecke_event'
  contentHash: string
  externalSlug?: string
  eckePublicUrl?: string
  userId?: string
  result: EckePublishResult
}) {
  const now = new Date()
  const where =
    input.educationArticleId ?
      and(
        eq(schema.eckePublishTargets.educationArticleId, input.educationArticleId),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )
    : input.vendorProfileId ?
      and(
        eq(schema.eckePublishTargets.vendorProfileId, input.vendorProfileId),
        eq(schema.eckePublishTargets.targetKind, input.targetKind),
      )
    : input.eventId ?
      and(eq(schema.eckePublishTargets.eventId, input.eventId), eq(schema.eckePublishTargets.targetKind, input.targetKind))
    : and(
        eq(schema.eckePublishTargets.conventionId, input.conventionId!),
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
        publishedByUserId: input.userId ?? null,
        externalSlug: input.externalSlug ?? undefined,
        eckePublicUrl: input.eckePublicUrl ?? input.result.eckePublicUrl ?? undefined,
        eckeRecordId: input.result.eckeRecordId ?? undefined,
        updatedAt: now,
      })
      .where(where)

    const photos =
      input.result.ok && 'photosManifest' in input.result ? input.result.photosManifest : undefined
    if (photos !== undefined) {
      const [row] = await db
        .select({ id: schema.eckePublishTargets.id })
        .from(schema.eckePublishTargets)
        .where(where)
        .limit(1)
      if (row) await syncEckePublishTargetMedia(row.id, photos)
    }
    return
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
}

export async function markEducationArticleEckeUnpublished(
  articleId: string,
  userId?: string,
): Promise<void> {
  const now = new Date()
  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'unpublished',
      unpublishedAt: now,
      lastAttemptAt: now,
      lastError: null,
      publishedContentHash: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.eckePublishTargets.educationArticleId, articleId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_article'),
      ),
    )
}

export async function markVendorProfileEckeUnpublished(vendorProfileId: string, userId?: string): Promise<void> {
  const now = new Date()
  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'unpublished',
      unpublishedAt: now,
      lastAttemptAt: now,
      lastError: null,
      publishedContentHash: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.eckePublishTargets.vendorProfileId, vendorProfileId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_vendor'),
      ),
    )
}

export async function executeEckeUnpublishVendorWithTargetUpdate(
  vendorProfileId: string,
  userId?: string,
): Promise<EckePublishResult> {
  const cfg = loadEckePublishClientConfig()
  if (!cfg) {
    return { ok: false, targetKind: 'ecke_vendor', error: 'Publish bridge not configured' }
  }

  const [target] = await db
    .select({ externalSlug: schema.eckePublishTargets.externalSlug, status: schema.eckePublishTargets.status })
    .from(schema.eckePublishTargets)
    .where(
      and(
        eq(schema.eckePublishTargets.vendorProfileId, vendorProfileId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_vendor'),
      ),
    )
    .limit(1)

  if (!target?.externalSlug || target.status === 'unpublished') {
    await markVendorProfileEckeUnpublished(vendorProfileId, userId)
    return { ok: true, targetKind: 'ecke_vendor' }
  }

  const result = await unpublishVendorRowToEcke(cfg, target.externalSlug)
  const now = new Date()

  if (result.ok) {
    await markVendorProfileEckeUnpublished(vendorProfileId, userId)
    return result
  }

  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'error',
      lastAttemptAt: now,
      lastError: result.error,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.eckePublishTargets.vendorProfileId, vendorProfileId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_vendor'),
      ),
    )

  return result
}

export async function executeEckeUnpublishEducationArticleWithTargetUpdate(
  articleId: string,
  reason?: 'archived' | 'deleted' | 'opt_out' | 'ineligible' | 'visibility_change',
  userId?: string,
): Promise<EckePublishResult> {
  const result = await executeEckeUnpublishEducationArticle(articleId, reason)
  const now = new Date()

  if (result.ok) {
    await markEducationArticleEckeUnpublished(articleId, userId)
    return result
  }

  await db
    .update(schema.eckePublishTargets)
    .set({
      status: 'error',
      lastAttemptAt: now,
      lastError: result.error,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.eckePublishTargets.educationArticleId, articleId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_article'),
      ),
    )

  return result
}
