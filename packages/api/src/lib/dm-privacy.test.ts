import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultPrivacySettings } from '@c2k/shared'

test('default privacy whoCanMessage is connections_only', () => {
  assert.equal(defaultPrivacySettings.whoCanMessage, 'connections_only')
})
