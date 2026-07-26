import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  ECKE_PUBLIC_SEED_URL_BASE,
  PAF_PUBLIC_SEED_URL_BASE,
  toWebPublicSeedUrl,
} from './public-seed-paths.js'

describe('public-seed-paths', () => {
  test('canonical bases use web static paths', () => {
    assert.equal(PAF_PUBLIC_SEED_URL_BASE, '/seed/paf')
    assert.equal(ECKE_PUBLIC_SEED_URL_BASE, '/seed/ecke')
  })

  test('toWebPublicSeedUrl rewrites legacy API paths', () => {
    assert.equal(
      toWebPublicSeedUrl('/api/public-seed/ecke/dungeons/black-rose-dc.svg'),
      '/seed/ecke/dungeons/black-rose-dc.svg',
    )
    assert.equal(toWebPublicSeedUrl('/api/public-seed/paf/gallery-1.png'), '/seed/paf/gallery-1.png')
    assert.equal(toWebPublicSeedUrl('/seed/ecke/events/foo.png'), '/seed/ecke/events/foo.png')
  })
})
