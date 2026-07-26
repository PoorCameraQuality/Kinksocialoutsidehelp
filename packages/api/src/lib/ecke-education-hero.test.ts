import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseMediaAssetIdFromHeroUrl } from './ecke-education-hero.js'

describe('parseMediaAssetIdFromHeroUrl', () => {
  it('parses relative media proxy paths', () => {
    assert.equal(
      parseMediaAssetIdFromHeroUrl('/api/v1/media/assets/11111111-1111-4111-8111-111111111111/content'),
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('parses absolute kink.social media proxy URLs', () => {
    assert.equal(
      parseMediaAssetIdFromHeroUrl(
        'https://kink.social/api/v1/media/assets/22222222-2222-4222-8222-222222222222/content',
      ),
      '22222222-2222-4222-8222-222222222222',
    )
  })

  it('returns null for external CDN URLs', () => {
    assert.equal(parseMediaAssetIdFromHeroUrl('https://cdn.example/hero.jpg'), null)
  })
})
