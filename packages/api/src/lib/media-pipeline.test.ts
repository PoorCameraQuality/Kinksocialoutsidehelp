import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  MEDIA_CONTENT_RATINGS,
  MEDIA_STORAGE_STATES,
  MEDIA_VISIBILITIES,
  SCAN_STATUSES,
} from '@c2k/shared'
import {
  canExposePublicUrl,
  assertQuarantineStorageKeyOwnedByUser,
  mediaContentProxyPath,
  MediaUploadValidationError,
  processIncomingAudioUpload,
  processIncomingVideoUpload,
  resolveMediaClientUrl,
  sniffVideoContainer,
} from './media-pipeline.js'
import { sniffAudioContainer } from './media-upload-validate.js'
import type { MediaAsset } from '../db/schema.js'

function fakeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    uploaderUserId: '00000000-0000-4000-8000-000000000002',
    ownerType: 'profile',
    ownerId: '00000000-0000-4000-8000-000000000003',
    sourceSurface: 'profile_gallery',
    storageKey: 'quarantine/u/test.jpg',
    originalStorageKey: null,
    quarantineStorageKey: 'quarantine/u/test.jpg',
    publicStorageKey: null,
    storageState: MEDIA_STORAGE_STATES.quarantinedPrivate,
    storageProvider: 's3',
    storageBucket: 'c2k-uploads',
    originalFilename: null,
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    imageWidth: null,
    imageHeight: null,
    sha256Hash: 'abc',
    perceptualHash: null,
    perceptualHashAlgorithm: null,
    uploadStatus: 'PENDING_ATTESTATION',
    contentRating: null,
    visibility: null,
    depictedPeople: null,
    scanStatus: SCAN_STATUSES.notRequired,
    moderationCaseId: null,
    reportable: true,
    isBlurredByDefault: false,
    uploaderConfirmed18: false,
    uploaderConfirmedDepictedAdults18: false,
    uploaderConfirmedConsent: false,
    uploaderConfirmedRightToUpload: false,
    uploaderConfirmedNoNcii: false,
    uploaderConfirmedNoMinors: false,
    uploaderConfirmedNoHiddenCamera: false,
    uploaderConfirmedNoAiDeepfakeWithoutConsent: false,
    attestedAt: null,
    attestationVersion: null,
    promotedAt: null,
    promotedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    removedAt: null,
    removedByUserId: null,
    deletionRequestedAt: null,
    deletedAt: null,
    ...overrides,
  } as MediaAsset
}

describe('media-pipeline visibility helpers', () => {
  test('quarantined asset does not expose public URL', () => {
    assert.equal(canExposePublicUrl(fakeAsset()), false)
  })

  test('approved public asset with public key can expose URL when env configured', () => {
    const asset = fakeAsset({
      storageState: MEDIA_STORAGE_STATES.approvedPublic,
      publicStorageKey: 'media/u/photo.jpg',
      uploadStatus: 'AUTO_APPROVED',
      storageKey: 'media/u/photo.jpg',
      contentRating: MEDIA_CONTENT_RATINGS.safePublic,
      visibility: MEDIA_VISIBILITIES.publicPreview,
    })
    assert.equal(canExposePublicUrl(asset), true)
  })

  test('LOGGED_IN visibility does not expose direct public URL even when promoted', () => {
    const asset = fakeAsset({
      storageState: MEDIA_STORAGE_STATES.approvedPublic,
      publicStorageKey: 'media/u/photo.jpg',
      uploadStatus: 'AUTO_APPROVED',
      storageKey: 'media/u/photo.jpg',
      contentRating: MEDIA_CONTENT_RATINGS.safePublic,
      visibility: MEDIA_VISIBILITIES.loggedIn,
    })
    assert.equal(canExposePublicUrl(asset), false)
    assert.equal(resolveMediaClientUrl(asset), mediaContentProxyPath(asset.id))
  })

  test('PUBLIC_PREVIEW visibility may expose direct public URL when promoted', () => {
    const prev = process.env.S3_PUBLIC_BASE_URL
    process.env.S3_PUBLIC_BASE_URL = 'https://example.test/c2k-uploads'
    try {
      const asset = fakeAsset({
        storageState: MEDIA_STORAGE_STATES.approvedPublic,
        publicStorageKey: 'media/u/photo.jpg',
        uploadStatus: 'AUTO_APPROVED',
        storageKey: 'media/u/photo.jpg',
        contentRating: MEDIA_CONTENT_RATINGS.safePublic,
        visibility: MEDIA_VISIBILITIES.publicPreview,
      })
      assert.equal(canExposePublicUrl(asset), true)
      assert.match(resolveMediaClientUrl(asset), /^https:\/\/example\.test\/c2k-uploads\//)
    } finally {
      if (prev === undefined) delete process.env.S3_PUBLIC_BASE_URL
      else process.env.S3_PUBLIC_BASE_URL = prev
    }
  })

  test('explicit on LOGGED_IN does not expose direct public URL', () => {
    const asset = fakeAsset({
      storageState: MEDIA_STORAGE_STATES.approvedPublic,
      publicStorageKey: 'media/u/photo.jpg',
      uploadStatus: 'AUTO_APPROVED',
      storageKey: 'media/u/photo.jpg',
      contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
      visibility: MEDIA_VISIBILITIES.loggedIn,
    })
    assert.equal(canExposePublicUrl(asset), false)
    assert.equal(resolveMediaClientUrl(asset), mediaContentProxyPath(asset.id))
  })
})

describe('assertQuarantineStorageKeyOwnedByUser', () => {
  const userId = '00000000-0000-4000-8000-0000000000aa'

  test('accepts key under uploader quarantine prefix', () => {
    assert.doesNotThrow(() =>
      assertQuarantineStorageKeyOwnedByUser(userId, `quarantine/${userId}/photo.jpg`),
    )
  })

  test('rejects another users quarantine prefix', () => {
    assert.throws(
      () =>
        assertQuarantineStorageKeyOwnedByUser(
          userId,
          'quarantine/00000000-0000-4000-8000-0000000000bb/photo.jpg',
        ),
      MediaUploadValidationError,
    )
  })

  test('rejects legacy uploads prefix', () => {
    assert.throws(
      () => assertQuarantineStorageKeyOwnedByUser(userId, `uploads/${userId}/photo.jpg`),
      MediaUploadValidationError,
    )
  })
})

describe('video upload content sniffing (PR 3 M5)', () => {
  const userId = '00000000-0000-4000-8000-0000000000cc'

  function mp4Bytes(): Buffer {
    // 4-byte box size + 'ftyp' + brand 'isom'
    return Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypisom', 'latin1'),
      Buffer.alloc(64),
    ])
  }

  function webmBytes(): Buffer {
    return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)])
  }

  test('sniffVideoContainer detects MP4 and WebM magic', () => {
    assert.equal(sniffVideoContainer(mp4Bytes()), 'video/mp4')
    assert.equal(sniffVideoContainer(webmBytes()), 'video/webm')
    assert.equal(sniffVideoContainer(Buffer.from('not a video at all, just text')), null)
    assert.equal(sniffVideoContainer(Buffer.alloc(0)), null)
  })

  async function withNoS3<T>(fn: () => Promise<T>): Promise<T> {
    const prev = process.env.MEDIA_PIPELINE_ALLOW_NO_S3
    process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = '1'
    try {
      return await fn()
    } finally {
      if (prev === undefined) delete process.env.MEDIA_PIPELINE_ALLOW_NO_S3
      else process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = prev
    }
  }

  test('rejects non-video bytes declared as video/mp4', async () => {
    await withNoS3(() =>
      assert.rejects(
        () =>
          processIncomingVideoUpload({
            userId,
            buffer: Buffer.from('<script>alert(1)</script> definitely not a video'),
            filename: 'movie.mp4',
            declaredMime: 'video/mp4',
          }),
        MediaUploadValidationError,
      ),
    )
  })

  test('rejects declared/detected container mismatch', async () => {
    await withNoS3(() =>
      assert.rejects(
        () =>
          processIncomingVideoUpload({
            userId,
            buffer: webmBytes(),
            filename: 'movie.mp4',
            declaredMime: 'video/mp4',
          }),
        MediaUploadValidationError,
      ),
    )
  })

  test('accepts matching MP4 bytes', async () => {
    await withNoS3(async () => {
      const result = await processIncomingVideoUpload({
        userId,
        buffer: mp4Bytes(),
        filename: 'movie.mp4',
        declaredMime: 'video/mp4',
      })
      assert.equal(result.mimeType, 'video/mp4')
      assert.ok(result.quarantineKey.startsWith(`quarantine/${userId}/`))
    })
  })
})

describe('media-pipeline audio upload (PR feed audio)', () => {
  const userId = '00000000-0000-4000-8000-000000000099'

  function id3Mp3Bytes(): Buffer {
    // Minimal ID3v2 header — enough for sniffAudioContainer
    return Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00AAAAAAAA', 'binary')
  }

  function wavBytes(): Buffer {
    const buf = Buffer.alloc(44)
    buf.write('RIFF', 0)
    buf.writeUInt32LE(36, 4)
    buf.write('WAVE', 8)
    buf.write('fmt ', 12)
    return buf
  }

  async function withNoS3<T>(fn: () => Promise<T>): Promise<T> {
    const prev = process.env.MEDIA_PIPELINE_ALLOW_NO_S3
    process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = '1'
    try {
      return await fn()
    } finally {
      if (prev === undefined) delete process.env.MEDIA_PIPELINE_ALLOW_NO_S3
      else process.env.MEDIA_PIPELINE_ALLOW_NO_S3 = prev
    }
  }

  test('sniffAudioContainer detects MP3 and WAV magic', () => {
    assert.equal(sniffAudioContainer(id3Mp3Bytes()), 'audio/mpeg')
    assert.equal(sniffAudioContainer(wavBytes()), 'audio/wav')
    assert.equal(sniffAudioContainer(Buffer.from('not audio')), null)
  })

  test('rejects non-audio bytes for feed audio', async () => {
    await withNoS3(() =>
      assert.rejects(
        () =>
          processIncomingAudioUpload({
            userId,
            buffer: Buffer.from('<script>not audio</script>'),
            filename: 'clip.mp3',
            declaredMime: 'audio/mpeg',
          }),
        MediaUploadValidationError,
      ),
    )
  })

  test('accepts sniffed MP3 bytes', async () => {
    await withNoS3(async () => {
      const result = await processIncomingAudioUpload({
        userId,
        buffer: id3Mp3Bytes(),
        filename: 'clip.mp3',
        declaredMime: 'audio/mpeg',
      })
      assert.equal(result.mimeType, 'audio/mpeg')
      assert.ok(result.quarantineKey.startsWith(`quarantine/${userId}/`))
      assert.ok(result.quarantineKey.endsWith('.mp3'))
    })
  })
})
