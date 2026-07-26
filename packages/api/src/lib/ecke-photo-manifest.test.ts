import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { emptyEckePhotosManifest, ECKE_LEGACY_HERO_MEDIA_ASSET_ID } from '@c2k/shared'
import {
  buildPhotosPreview,
  listPersistablePhotoAssets,
  loadPublishableTargetMediaManifest,
} from './ecke-photo-manifest.js'
import { isEckePhotosPublishEnabled } from './ecke-publish-config.js'

describe('ecke-photo-manifest config', () => {
  test('photos publish defaults off', () => {
    const prev = process.env.ECKE_PUBLISH_PHOTOS_ENABLED
    delete process.env.ECKE_PUBLISH_PHOTOS_ENABLED
    assert.equal(isEckePhotosPublishEnabled(), false)
    if (prev !== undefined) process.env.ECKE_PUBLISH_PHOTOS_ENABLED = prev
  })

  test('buildPhotosPreview empty manifest', () => {
    const preview = buildPhotosPreview(emptyEckePhotosManifest())
    assert.equal(preview.hero, null)
    assert.equal(preview.galleryCount, 0)
    assert.equal(preview.mediaHash, null)
  })

  test('listPersistablePhotoAssets skips legacy placeholder id', () => {
    const assets = listPersistablePhotoAssets({
      manifestVersion: 1,
      hero: {
        sourceMediaAssetId: ECKE_LEGACY_HERO_MEDIA_ASSET_ID,
        role: 'hero',
        ordinal: 0,
        publicUrl: 'https://cdn.example.com/legacy.jpg',
        width: null,
        height: null,
        sha256Hash: null,
        altText: null,
      },
      gallery: [
        {
          sourceMediaAssetId: '22222222-2222-4222-8222-222222222222',
          role: 'gallery',
          ordinal: 0,
          publicUrl: 'https://cdn.example.com/g1.jpg',
          width: null,
          height: null,
          sha256Hash: null,
          altText: null,
        },
      ],
    })
    assert.equal(assets.length, 1)
    assert.equal(assets[0]?.sourceMediaAssetId, '22222222-2222-4222-8222-222222222222')
  })

  test('loadPublishableTargetMediaManifest returns empty when flag off', async () => {
    const prev = process.env.ECKE_PUBLISH_PHOTOS_ENABLED
    delete process.env.ECKE_PUBLISH_PHOTOS_ENABLED
    const manifest = await loadPublishableTargetMediaManifest({
      fallbackImageUrl: 'https://cdn.example.com/hero.jpg',
    })
    assert.deepEqual(manifest, emptyEckePhotosManifest())
    if (prev !== undefined) process.env.ECKE_PUBLISH_PHOTOS_ENABLED = prev
  })

  test('loadPublishableTargetMediaManifest accepts public external hero URL', async () => {
    const prev = process.env.ECKE_PUBLISH_PHOTOS_ENABLED
    process.env.ECKE_PUBLISH_PHOTOS_ENABLED = 'true'
    const manifest = await loadPublishableTargetMediaManifest({
      fallbackImageUrl: 'https://cdn.example.com/hero.jpg',
    })
    assert.equal(manifest.hero?.publicUrl, 'https://cdn.example.com/hero.jpg')
    assert.equal(manifest.hero?.sourceMediaAssetId, ECKE_LEGACY_HERO_MEDIA_ASSET_ID)
    if (prev !== undefined) process.env.ECKE_PUBLISH_PHOTOS_ENABLED = prev
    else delete process.env.ECKE_PUBLISH_PHOTOS_ENABLED
  })
})
