import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyFeedReactionCounts, isFeedReactionId, totalFeedReactionCount } from '@c2k/shared'

describe('feed-reactions shared helpers', () => {
  it('isFeedReactionId accepts v1 kinds', () => {
    assert.equal(isFeedReactionId('love'), true)
    assert.equal(isFeedReactionId('respect'), true)
    assert.equal(isFeedReactionId('collar'), false)
  })

  it('totalFeedReactionCount sums all kinds', () => {
    const counts = emptyFeedReactionCounts()
    counts.love = 2
    counts.helpful = 1
    assert.equal(totalFeedReactionCount(counts), 3)
  })
})
