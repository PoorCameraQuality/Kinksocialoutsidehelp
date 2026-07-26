import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MEDIA_VISIBILITIES } from '@c2k/shared'
import {
  albumVisibleToViewer,
  isLikelyPublicStaticAssetUrl,
  parseMediaAssetIdFromProxyUrl,
  previewUrlsFromFeedAttachments,
} from './feed-media-attachments.js'

describe('parseMediaAssetIdFromProxyUrl', () => {
  it('extracts asset id from media content proxy path', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    assert.equal(parseMediaAssetIdFromProxyUrl(`/api/v1/media/assets/${id}/content`), id)
    assert.equal(parseMediaAssetIdFromProxyUrl(`/api/v1/media/assets/${id}/content?thumb=1`), id)
  })

  it('returns null for external URLs', () => {
    assert.equal(parseMediaAssetIdFromProxyUrl('https://cdn.example.com/photo.jpg'), null)
  })
})

describe('albumVisibleToViewer', () => {
  it('allows owner regardless of album visibility', () => {
    assert.equal(
      albumVisibleToViewer(MEDIA_VISIBILITIES.privateProfile, 'owner-1', 'owner-1'),
      true,
    )
  })

  it('hides private_profile albums from other viewers', () => {
    assert.equal(
      albumVisibleToViewer(MEDIA_VISIBILITIES.privateProfile, 'owner-1', 'viewer-1'),
      false,
    )
    assert.equal(albumVisibleToViewer(MEDIA_VISIBILITIES.privateProfile, 'owner-1', null), false)
  })

  it('allows public_preview albums for strangers', () => {
    assert.equal(
      albumVisibleToViewer(MEDIA_VISIBILITIES.publicPreview, 'owner-1', null),
      true,
    )
  })

  it('requires sign-in for member-only albums', () => {
    assert.equal(
      albumVisibleToViewer(MEDIA_VISIBILITIES.loggedIn, 'owner-1', 'viewer-1'),
      true,
    )
    assert.equal(albumVisibleToViewer(MEDIA_VISIBILITIES.loggedIn, 'owner-1', null), false)
  })
})

describe('isLikelyPublicStaticAssetUrl', () => {
  it('allows landing and seed paths', () => {
    assert.equal(isLikelyPublicStaticAssetUrl('/landing/hero.jpg'), true)
    assert.equal(isLikelyPublicStaticAssetUrl('/seed/paf/banner.jpg'), true)
  })

  it('rejects unknown external URLs', () => {
    assert.equal(isLikelyPublicStaticAssetUrl('https://cdn.example.com/user-upload.jpg'), false)
  })
})

describe('previewUrlsFromFeedAttachments', () => {
  it('extracts media preview URLs', () => {
    const urls = previewUrlsFromFeedAttachments([
      {
        type: 'media',
        mediaKind: 'image',
        mediaItemId: '00000000-0000-4000-8000-000000000001',
        previewUrl: '/api/v1/media/assets/00000000-0000-4000-8000-000000000002/content',
      },
    ])
    assert.deepEqual(urls, ['/api/v1/media/assets/00000000-0000-4000-8000-000000000002/content'])
  })

  it('returns empty for no attachments', () => {
    assert.deepEqual(previewUrlsFromFeedAttachments([]), [])
  })
})
