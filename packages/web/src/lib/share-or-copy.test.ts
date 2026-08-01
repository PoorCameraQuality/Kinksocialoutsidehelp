import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shareOrCopyUrl } from './share-or-copy'

describe('shareOrCopyUrl', () => {
  it('returns failed for empty url', async () => {
    assert.equal(await shareOrCopyUrl({ url: '   ' }), 'failed')
  })
})
