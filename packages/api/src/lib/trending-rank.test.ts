import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { trendingMediaFromAttachments } from './trending-rank.js'

describe('trendingMediaFromAttachments', () => {
  test('reads legacy image and audio attachments', () => {
    const result = trendingMediaFromAttachments([
      { type: 'image', url: 'https://cdn.example.com/a.jpg' },
      { type: 'audio', url: 'https://cdn.example.com/a.mp3' },
    ])
    assert.equal(result.imageUrl, 'https://cdn.example.com/a.jpg')
    assert.equal(result.audioPreviewUrl, 'https://cdn.example.com/a.mp3')
  })

  test('reads media pipeline image previewUrl', () => {
    const result = trendingMediaFromAttachments([
      {
        type: 'media',
        mediaKind: 'image',
        mediaItemId: '00000000-0000-4000-8000-000000000001',
        mediaAssetId: '00000000-0000-4000-8000-000000000002',
        previewUrl: '/api/v1/media/content/asset-1',
      },
    ])
    assert.equal(result.imageUrl, '/api/v1/media/content/asset-1')
    assert.equal(result.audioPreviewUrl, null)
  })

  test('falls back to blurredPreviewUrl for media images', () => {
    const result = trendingMediaFromAttachments([
      {
        type: 'media',
        mediaKind: 'image',
        mediaItemId: '00000000-0000-4000-8000-000000000001',
        mediaAssetId: '00000000-0000-4000-8000-000000000002',
        previewUrl: null,
        blurredPreviewUrl: '/api/v1/media/content/blur-1',
      },
    ])
    assert.equal(result.imageUrl, '/api/v1/media/content/blur-1')
  })

  test('prefers first image across attachment types', () => {
    const result = trendingMediaFromAttachments([
      { type: 'media', mediaKind: 'image', previewUrl: 'https://cdn.example.com/first.jpg' },
      { type: 'image', url: 'https://cdn.example.com/legacy.jpg' },
    ])
    assert.equal(result.imageUrl, 'https://cdn.example.com/first.jpg')
  })
})
