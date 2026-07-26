import assert from 'node:assert/strict'
import test from 'node:test'
import { NOTIFICATION_TYPES, isKnownNotificationType } from '@c2k/shared'

test('notification-types. Connection_accepted', () => {
  assert.equal(NOTIFICATION_TYPES.connectionAccepted, 'connection_accepted')
  assert.equal(isKnownNotificationType('connection_accepted'), true)
})

test('notification-types. Rejects unknown', () => {
  assert.equal(isKnownNotificationType('not_a_real_type'), false)
})
