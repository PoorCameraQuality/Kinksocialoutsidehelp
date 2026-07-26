import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import { emptyEckePhotosManifest, resolveEckePayloadHeroUrl, type EckePhotosManifest } from './ecke-photos-manifest.js'

const fixturePath = join(fileURLToPath(new URL('.', import.meta.url)), '../fixtures/ecke-photos-manifest-v1.sample.json')

describe('ecke-photos-manifest', () => {
  test('resolveEckePayloadHeroUrl prefers manifest', () => {
    assert.equal(
      resolveEckePayloadHeroUrl({
        photos: {
          manifestVersion: 1,
          hero: {
            sourceMediaAssetId: '11111111-1111-4111-8111-111111111111',
            role: 'hero',
            ordinal: 0,
            publicUrl: 'https://cdn.example/manifest.jpg',
            width: null,
            height: null,
            sha256Hash: null,
            altText: null,
          },
          gallery: [],
        },
        legacyHeroUrl: 'https://cdn.example/legacy.jpg',
      }),
      'https://cdn.example/manifest.jpg',
    )
  })

  test('empty manifest is well-formed', () => {
    assert.deepEqual(emptyEckePhotosManifest(), { manifestVersion: 1, hero: null, gallery: [] })
  })

  test('v1 sample fixture is a valid cross-repo contract', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as EckePhotosManifest
    assert.equal(fixture.manifestVersion, 1)
    assert.ok(fixture.hero?.publicUrl)
    assert.equal(fixture.gallery.length, 1)
    assert.equal(
      resolveEckePayloadHeroUrl({ photos: fixture, legacyHeroUrl: 'https://legacy.example/x.jpg' }),
      fixture.hero?.publicUrl,
    )
  })
})
