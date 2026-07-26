import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PRESENTER_PROFILE_FOCUS_VALUES,
  savePresenterFocusFields,
  loadPresenterFocusFields,
} from './presenter-profile-focuses.js'

describe('presenter profile focuses', () => {
  it('defines nine focus values', () => {
    assert.equal(PRESENTER_PROFILE_FOCUS_VALUES.length, 9)
    assert.ok(PRESENTER_PROFILE_FOCUS_VALUES.includes('EDUCATOR'))
    assert.ok(PRESENTER_PROFILE_FOCUS_VALUES.includes('PHOTOGRAPHER'))
  })

  it('exports persistence helpers', () => {
    assert.equal(typeof savePresenterFocusFields, 'function')
    assert.equal(typeof loadPresenterFocusFields, 'function')
  })
})
