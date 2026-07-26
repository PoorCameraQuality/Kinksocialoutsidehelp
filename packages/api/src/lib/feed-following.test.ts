import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodeFollowingCursor } from './feed-following.js'
import { MAX_FOLLOWING_IDS } from './following-ids.js'

describe('decodeFollowingCursor', () => {
  it('round-trips post cursor', () => {
    const iso = '2026-05-26T12:00:00.000Z'
    const raw = Buffer.from(`${iso}|post|abc-123`, 'utf8').toString('base64url')
    const decoded = decodeFollowingCursor(raw)
    assert.deepEqual(decoded, { createdAt: iso, source: 'post', id: 'abc-123' })
  })

  it('returns null for invalid cursor', () => {
    assert.equal(decodeFollowingCursor(''), null)
    assert.equal(decodeFollowingCursor('not-base64'), null)
  })
})

describe('MAX_FOLLOWING_IDS', () => {
  it('is 2000 per guidance', () => {
    assert.equal(MAX_FOLLOWING_IDS, 2000)
  })
})
