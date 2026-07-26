import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filterBlockedUserIds, isUserBlockedFromViewer } from './people-discovery.js'

describe('people discovery privacy helpers', () => {
  it('detects blocked user ids', () => {
    const blocked = new Set(['u-blocked'])
    assert.equal(isUserBlockedFromViewer(blocked, 'u-blocked'), true)
    assert.equal(isUserBlockedFromViewer(blocked, 'u-safe'), false)
  })

  it('filters blocked rows from suggestion lists', () => {
    const rows = [
      { userId: 'u1', username: 'a' },
      { userId: 'u2', username: 'b' },
    ]
    const out = filterBlockedUserIds(new Set(['u2']), rows)
    assert.equal(out.length, 1)
    assert.equal(out[0]!.userId, 'u1')
  })
})
