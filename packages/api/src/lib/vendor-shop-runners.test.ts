import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isKnownNotificationType, NOTIFICATION_TYPES } from '@c2k/shared'
import { vendorVisibleForDetail } from './vendor-visibility.js'

describe('vendor shop runners (Phase 1)', () => {
  it('registers vendor_runner_added notification type', () => {
    assert.equal(NOTIFICATION_TYPES.vendorRunnerAdded, 'vendor_runner_added')
    assert.equal(isKnownNotificationType('vendor_runner_added'), true)
  })

  it('HIDDEN shop visible to managers (owner or runner)', () => {
    assert.equal(vendorVisibleForDetail('HIDDEN', 'user-1', true), true)
    assert.equal(vendorVisibleForDetail('HIDDEN', 'user-1', false), false)
    assert.equal(vendorVisibleForDetail('HIDDEN', null, false), false)
  })

  it('PUBLIC shop visible to strangers', () => {
    assert.equal(vendorVisibleForDetail('PUBLIC', null, false), true)
  })
})
