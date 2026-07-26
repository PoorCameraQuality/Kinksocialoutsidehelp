/**
 * PR 3 (M4) regression: the moderation UI renders the pipeline Decision line
 * and the VALIDATED_PRIVATE alpha note from `mediaMetadata.pipeline`, which is
 * where the API now writes the pipeline decision context.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatMediaMetadataLines,
  mediaMetadataFromSnapshot,
  type MediaAssetSnapshotMetadata,
} from './useApiModerationTs.ts'

function baseMeta(overrides: Partial<MediaAssetSnapshotMetadata> = {}): MediaAssetSnapshotMetadata {
  return {
    mimeType: 'image/jpeg',
    sizeBytes: 2048,
    originalFilename: 'photo.jpg',
    uploadStatus: 'AUTO_APPROVED',
    contentRating: 'SAFE_PUBLIC',
    visibility: 'PRIVATE_PROFILE',
    depictedPeople: 'ONLY_ME',
    scanStatus: 'PASSED',
    sourceSurface: 'profile_gallery',
    ownerType: 'profile',
    ownerId: '00000000-0000-4000-8000-000000000001',
    reportable: true,
    isBlurredByDefault: false,
    attestedAt: null,
    attestationVersion: null,
    attestation: {},
    linkedProfilePhotoId: null,
    uploaderUsername: null,
    ...overrides,
  }
}

describe('formatMediaMetadataLines pipeline context (PR 3 M4)', () => {
  it('renders the Decision line from mediaMetadata.pipeline', () => {
    const lines = formatMediaMetadataLines(
      baseMeta({
        pipeline: {
          storageState: 'QUARANTINED_PRIVATE',
          moderationDecision: {
            reasonCode: 'LANE_YELLOW_PENDING_SCAN',
            reasonSummary: 'YELLOW lane: upload pending scan or human review before publish.',
          },
        },
      })
    )
    assert.ok(
      lines.some((l) =>
        l.startsWith('Decision (LANE_YELLOW_PENDING_SCAN): YELLOW lane: upload pending scan')
      ),
      `expected Decision line, got:\n${lines.join('\n')}`
    )
  })

  it('renders the VALIDATED_PRIVATE alpha note', () => {
    const lines = formatMediaMetadataLines(
      baseMeta({ pipeline: { storageState: 'VALIDATED_PRIVATE' } })
    )
    assert.ok(
      lines.some((l) => l.startsWith('Alpha note: VALIDATED_PRIVATE')),
      `expected alpha note, got:\n${lines.join('\n')}`
    )
  })

  it('falls back to the pipeline scanner-hold reason when no decision exists', () => {
    const lines = formatMediaMetadataLines(
      baseMeta({
        pipeline: { scannerSummary: { quarantineReason: 'Scanner signal requires review.' } },
      })
    )
    assert.ok(lines.includes('Scanner hold reason: Scanner signal requires review.'))
  })

  it('mediaMetadataFromSnapshot exposes pipeline written under mediaMetadata', () => {
    const meta = mediaMetadataFromSnapshot({
      targetType: 'media_asset',
      mediaMetadata: baseMeta({ pipeline: { storageState: 'VALIDATED_PRIVATE' } }),
    })
    assert.ok(meta)
    assert.equal(meta.pipeline?.storageState, 'VALIDATED_PRIVATE')
  })
})
