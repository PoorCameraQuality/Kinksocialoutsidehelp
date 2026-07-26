import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { emptyEckePhotosManifest } from '@c2k/shared'
import { hashMediaManifest } from './ecke-media-manifest-hash.js'

describe('ecke-media-manifest-hash', () => {
  test('hashMediaManifest is stable for gallery order', () => {
    const a = {
      manifestVersion: 1 as const,
      hero: {
        sourceMediaAssetId: '11111111-1111-4111-8111-111111111111',
        role: 'hero' as const,
        ordinal: 0,
        publicUrl: 'https://cdn.example/a.jpg',
        width: 100,
        height: 50,
        sha256Hash: 'abc',
        altText: null,
      },
      gallery: [
        {
          sourceMediaAssetId: '22222222-2222-4222-8222-222222222222',
          role: 'gallery' as const,
          ordinal: 1,
          publicUrl: 'https://cdn.example/b.jpg',
          width: null,
          height: null,
          sha256Hash: null,
          altText: null,
        },
      ],
    }
    const b = { ...a, gallery: [...a.gallery] }
    assert.equal(hashMediaManifest(a), hashMediaManifest(b))
  })

  test('empty manifest hashes consistently', () => {
    assert.ok(hashMediaManifest(emptyEckePhotosManifest()))
  })
})
