import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildHomeActivationItems } from './home-activation.ts'

describe('home activation checklist', () => {
  it('does not mark items done without real signals', () => {
    const sparse = buildHomeActivationItems({
      profileBasicsDone: false,
      joinedGroup: false,
      hasEventRsvp: false,
      privacyConfigured: false,
    })
    assert.equal(sparse.filter((item) => item.done).length, 0)
    assert.ok(sparse.some((item) => item.id === 'privacy' && item.href === '/settings/privacy'))
  })

  it('marks only verified completion states', () => {
    const partial = buildHomeActivationItems({
      profileBasicsDone: true,
      joinedGroup: true,
      hasEventRsvp: false,
      privacyConfigured: true,
    })
    assert.equal(partial.filter((item) => item.done).length, 3)
  })
})
