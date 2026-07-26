import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractTagIdsFromMentions, postMatchesMutedTags } from './muted-tags.js'

describe('extractTagIdsFromMentions', () => {
  it('returns tag ids from mention rows', () => {
    assert.deepEqual(
      extractTagIdsFromMentions([
        { type: 'user', id: 'u1', label: '@alice' },
        { type: 'tag', id: 't1', slug: 'rope', label: 'Rope' },
      ]),
      ['t1'],
    )
  })

  it('ignores invalid mention shapes', () => {
    assert.deepEqual(extractTagIdsFromMentions(null), [])
    assert.deepEqual(extractTagIdsFromMentions([{ type: 'tag' }]), [])
  })
})

describe('postMatchesMutedTags', () => {
  const muted = new Set(['t-muted'])

  it('matches direct tag on post', () => {
    assert.equal(postMatchesMutedTags([{ type: 'tag', id: 't-muted' }], muted), true)
    assert.equal(postMatchesMutedTags([{ type: 'tag', id: 't-other' }], muted), false)
  })

  it('matches inherited tags from repost source', () => {
    assert.equal(postMatchesMutedTags([], muted, ['t-muted']), true)
    assert.equal(postMatchesMutedTags([], muted, ['t-other']), false)
  })
})
