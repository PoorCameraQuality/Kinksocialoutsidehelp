/**
 * Debug one media asset: DB row, scanner results, moderation decision.
 *
 * Usage (local):
 *   USE_DATABASE=true tsx scripts/debug-media-asset.ts <mediaAssetId>
 *
 * Usage (prod via SSH):
 *   docker compose exec api node dist/scripts/debug-media-asset.js <id>
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import {
  buildMediaModerationDebugReport,
  deriveMediaModerationDecision,
} from '../src/lib/media-moderation-decision.js'
import { resolveEffectivePublishLane } from '../src/lib/media-publish-lane.js'
import type { MediaAttestationFields, MediaContentRating, DepictedPeople } from '@c2k/shared'

function mapAttestation(row: typeof schema.mediaAssets.$inferSelect): MediaAttestationFields {
  return {
    allDepictedAreAdults:
      row.uploaderConfirmedDepictedAdults18 && row.uploaderConfirmedNoMinors,
    iAmDepictedOrAuthorizedUploader:
      row.uploaderConfirmed18 &&
      row.uploaderConfirmedRightToUpload &&
      row.uploaderConfirmedConsent,
    noHiddenCameraOrNonConsensualCapture:
      row.uploaderConfirmedNoHiddenCamera && row.uploaderConfirmedNoNcii,
    contentRatingAccurate: Boolean(row.contentRating),
  }
}

async function main() {
  const mediaAssetId = process.argv[2]?.trim()
  if (!mediaAssetId) {
    console.error('Usage: debug-media-asset.ts <mediaAssetId>')
    process.exit(1)
  }
  if (process.env.USE_DATABASE !== 'true') {
    console.error('USE_DATABASE=true required')
    process.exit(1)
  }

  const [asset] = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.id, mediaAssetId))
    .limit(1)

  if (!asset) {
    console.error('Media asset not found:', mediaAssetId)
    process.exit(1)
  }

  const { scannerRecords, scannerSummary } = await buildMediaModerationDebugReport(mediaAssetId)

  const lane =
    asset.contentRating && asset.depictedPeople
      ? resolveEffectivePublishLane({
          contentRating: asset.contentRating as MediaContentRating,
          depictedPeople: asset.depictedPeople as DepictedPeople,
          scanStatus: asset.scanStatus as Parameters<typeof resolveEffectivePublishLane>[0]['scanStatus'],
          attestation: mapAttestation(asset),
        })
      : null

  const decision = deriveMediaModerationDecision({
    asset,
    publishLane: lane,
    scannerResults: scannerRecords,
  })

  const moderationEvents = asset.moderationCaseId
    ? await db
        .select({
          eventType: schema.moderationEvents.eventType,
          createdAt: schema.moderationEvents.createdAt,
          payload: schema.moderationEvents.payload,
        })
        .from(schema.moderationEvents)
        .where(eq(schema.moderationEvents.caseId, asset.moderationCaseId))
        .orderBy(schema.moderationEvents.createdAt)
        .limit(20)
    : []

  console.log(
    JSON.stringify(
      {
        mediaAssetId: asset.id,
        uploaderUserId: asset.uploaderUserId,
        sourceSurface: asset.sourceSurface,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        storageState: asset.storageState,
        uploadStatus: asset.uploadStatus,
        scanStatus: asset.scanStatus,
        visibility: asset.visibility,
        contentRating: asset.contentRating,
        quarantineStorageKey: asset.quarantineStorageKey,
        publicStorageKey: asset.publicStorageKey,
        moderationCaseId: asset.moderationCaseId,
        publishLane: lane,
        moderationDecision: decision,
        scannerSummary,
        scannerResults: scannerRecords,
        moderationEvents,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
