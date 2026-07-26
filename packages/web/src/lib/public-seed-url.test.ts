import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { resolvePublicSeedDisplayUrl } from './public-seed-url.ts'

describe('resolvePublicSeedDisplayUrl', () => {
  test('rewrites legacy API seed paths to /seed/*', () => {
    assert.equal(
      resolvePublicSeedDisplayUrl('/api/public-seed/ecke/dungeons/black-rose-dc.svg'),
      '/seed/ecke/dungeons/black-rose-dc.svg',
    )
    assert.equal(resolvePublicSeedDisplayUrl('/seed/paf/gallery-1.png'), '/seed/paf/gallery-1.png')
  })
})
