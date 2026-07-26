import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultPrivacySettings } from '@c2k/shared'
import {
  privacySettingsWithAdultContentPreference,
  readAdultContentPreference,
} from './adult-content-preference.js'

describe('readAdultContentPreference', () => {
  it('defaults to BLUR when missing from stored privacy JSON', () => {
    const { adultContentPreference: _ignored, ...withoutAdult } = defaultPrivacySettings
    assert.equal(readAdultContentPreference(withoutAdult), 'BLUR')
  })

  it('returns explicit stored values', () => {
    assert.equal(readAdultContentPreference({ adultContentPreference: 'SHOW' }), 'SHOW')
    assert.equal(readAdultContentPreference({ adultContentPreference: 'HIDE' }), 'HIDE')
  })
})

describe('privacySettingsWithAdultContentPreference', () => {
  it('merges preference without dropping other privacy fields', () => {
    const next = privacySettingsWithAdultContentPreference(defaultPrivacySettings, 'HIDE')
    assert.equal(next.adultContentPreference, 'HIDE')
    assert.equal(next.whoCanMessage, defaultPrivacySettings.whoCanMessage)
    assert.equal(next.schemaVersion, defaultPrivacySettings.schemaVersion)
  })
})
