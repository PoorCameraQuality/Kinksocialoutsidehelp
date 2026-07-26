/**
 * Backfill ecke_publish_target_media rows for successfully published ECKE targets.
 * Used by scripts/backfill-ecke-publish-target-media.ts (dry-run by default).
 */
import { eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { hashMediaManifest } from './ecke-media-manifest-hash.js'
import {
  listPersistablePhotoAssets,
  loadPublishableTargetMediaManifest,
} from './ecke-photo-manifest.js'
import { isEckePhotosPublishEnabled } from './ecke-publish-config.js'
import { deliverProfileHeroUrl } from './image-delivery.js'
import { syncEckePublishTargetMedia } from './ecke-publish-target-store.js'

type PublishTargetRow = typeof schema.eckePublishTargets.$inferSelect

export type EckePublishTargetMediaBackfillSummary = {
  scanned: number
  updated: number
  skipped: number
  errors: number
  dryRun: boolean
}

const SUCCESSFUL_PUBLISH_STATUSES = ['published', 'stale'] as const

async function resolvePublishTargetFallbackImageUrl(target: PublishTargetRow): Promise<string | null> {
  switch (target.targetKind) {
    case 'ecke_article': {
      if (!target.educationArticleId) return null
      const [row] = await db
        .select({ heroImageUrl: schema.educationArticles.heroImageUrl })
        .from(schema.educationArticles)
        .where(eq(schema.educationArticles.id, target.educationArticleId))
        .limit(1)
      return row?.heroImageUrl ?? null
    }
    case 'ecke_vendor': {
      if (!target.vendorProfileId) return null
      const [row] = await db
        .select({ logoUrl: schema.vendorProfiles.logoUrl })
        .from(schema.vendorProfiles)
        .where(eq(schema.vendorProfiles.id, target.vendorProfileId))
        .limit(1)
      return row?.logoUrl ?? null
    }
    case 'ecke_event': {
      if (!target.eventId) return null
      const [row] = await db
        .select({ imageUrl: schema.events.imageUrl })
        .from(schema.events)
        .where(eq(schema.events.id, target.eventId))
        .limit(1)
      return row?.imageUrl ?? null
    }
    case 'ecke_listing': {
      if (target.groupId) {
        const [row] = await db
          .select({
            bannerUrl: schema.groups.bannerUrl,
            logoUrl: schema.groups.logoUrl,
          })
          .from(schema.groups)
          .where(eq(schema.groups.id, target.groupId))
          .limit(1)
        return row?.bannerUrl ?? row?.logoUrl ?? null
      }
      if (target.organizationId) {
        const [row] = await db
          .select({ logoUrl: schema.organizations.logoUrl })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, target.organizationId))
          .limit(1)
        return row?.logoUrl ?? null
      }
      if (target.conventionId) {
        const [conv] = await db
          .select({ anchorEventId: schema.conventions.anchorEventId })
          .from(schema.conventions)
          .where(eq(schema.conventions.id, target.conventionId))
          .limit(1)
        if (!conv?.anchorEventId) return null
        const [ev] = await db
          .select({ imageUrl: schema.events.imageUrl })
          .from(schema.events)
          .where(eq(schema.events.id, conv.anchorEventId))
          .limit(1)
        return ev?.imageUrl ?? null
      }
      if (target.presenterUserId) {
        const [row] = await db
          .select({ avatarUrl: schema.profiles.avatarUrl })
          .from(schema.presenterProfiles)
          .innerJoin(schema.users, eq(schema.users.id, schema.presenterProfiles.userId))
          .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.presenterProfiles.userId))
          .where(eq(schema.presenterProfiles.userId, target.presenterUserId))
          .limit(1)
        const raw = row?.avatarUrl?.trim() || null
        return deliverProfileHeroUrl(raw) ?? raw
      }
      return null
    }
    case 'dancecard_event': {
      if (!target.conventionId) return null
      const [conv] = await db
        .select({ organizationId: schema.conventions.organizationId })
        .from(schema.conventions)
        .where(eq(schema.conventions.id, target.conventionId))
        .limit(1)
      if (!conv?.organizationId) return null
      const [org] = await db
        .select({ logoUrl: schema.organizations.logoUrl })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, conv.organizationId))
        .limit(1)
      return org?.logoUrl ?? null
    }
    case 'ecke_dungeon':
      return null
    default:
      return null
  }
}

function targetNeedsMediaSync(input: {
  target: PublishTargetRow
  rebuiltHash: string | null
  mediaRowCount: number
  persistableCount: number
}): boolean {
  const { target, rebuiltHash, mediaRowCount, persistableCount } = input
  if (rebuiltHash !== target.mediaHash) return true
  if (persistableCount !== mediaRowCount) return true
  if (mediaRowCount === 0 && rebuiltHash !== null) return true
  return false
}

export async function runEckePublishTargetMediaBackfill(input: {
  apply?: boolean
}): Promise<EckePublishTargetMediaBackfillSummary> {
  const apply = input.apply === true
  const summary: EckePublishTargetMediaBackfillSummary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    dryRun: !apply,
  }

  if (!isEckePhotosPublishEnabled()) {
    console.warn(
      '[backfill-ecke-publish-target-media] ECKE_PUBLISH_PHOTOS_ENABLED is not true — manifests rebuild empty; set flag before --apply',
    )
  }

  const targets = await db
    .select()
    .from(schema.eckePublishTargets)
    .where(
      inArray(schema.eckePublishTargets.status, [...SUCCESSFUL_PUBLISH_STATUSES]),
    )

  const publishedTargets = targets.filter((t) => t.lastPublishedAt != null)
  summary.scanned = publishedTargets.length

  if (publishedTargets.length === 0) {
    return summary
  }

  const targetIds = publishedTargets.map((t) => t.id)
  const mediaCounts = await db
    .select({
      targetId: schema.eckePublishTargetMedia.targetId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.eckePublishTargetMedia)
    .where(inArray(schema.eckePublishTargetMedia.targetId, targetIds))
    .groupBy(schema.eckePublishTargetMedia.targetId)

  const countByTargetId = new Map(mediaCounts.map((row) => [row.targetId, row.count]))

  for (const target of publishedTargets) {
    try {
      const fallbackImageUrl = await resolvePublishTargetFallbackImageUrl(target)
      const manifest = await loadPublishableTargetMediaManifest({ fallbackImageUrl })
      const rebuiltHash = hashMediaManifest(manifest)
      const persistableCount = listPersistablePhotoAssets(manifest).length
      const mediaRowCount = countByTargetId.get(target.id) ?? 0

      if (!targetNeedsMediaSync({ target, rebuiltHash, mediaRowCount, persistableCount })) {
        summary.skipped++
        continue
      }

      if (apply) {
        await syncEckePublishTargetMedia(target.id, manifest)
      }

      summary.updated++
      const mode = apply ? 'updated' : 'would update'
      console.log(
        `[${mode}] ${target.targetKind} ${target.id} slug=${target.externalSlug} mediaRows=${mediaRowCount}→${persistableCount} hash=${target.mediaHash ?? 'null'}→${rebuiltHash ?? 'null'}`,
      )
    } catch (err) {
      summary.errors++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[error] ${target.targetKind} ${target.id}: ${message}`)
    }
  }

  return summary
}
