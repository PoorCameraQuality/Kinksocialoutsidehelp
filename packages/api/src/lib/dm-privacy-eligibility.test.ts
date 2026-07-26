import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveProfileMessageHint } from './dm-privacy.js'

describe('resolveProfileMessageHint', () => {
  it('returns null when connected and allowed', () => {
    assert.equal(resolveProfileMessageHint({ canMessage: true, connected: true }), null)
  })

  it('returns request_pending when allowed but not connected', () => {
    assert.equal(
      resolveProfileMessageHint({ canMessage: true, connected: false }),
      'request_pending',
    )
  })

  it('maps connection-only denials to connect_first', () => {
    assert.equal(
      resolveProfileMessageHint({
        canMessage: false,
        connected: false,
        gateError: 'This member only accepts messages from connections',
      }),
      'connect_first',
    )
  })

  it('maps blocks to unavailable without exposing block state', () => {
    assert.equal(
      resolveProfileMessageHint({ canMessage: false, connected: false, gateError: 'Blocked' }),
      'unavailable',
    )
  })

  it('maps privacy limits to limited', () => {
    assert.equal(
      resolveProfileMessageHint({
        canMessage: false,
        connected: false,
        gateError: 'This member is not accepting new messages',
      }),
      'limited',
    )
  })
})
