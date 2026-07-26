import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DEFAULT_PROFILE_PHOTO_DISPLAY,
  formatProfilePhotoCredit,
  normalizeProfilePhotoDisplaySettings,
  profilePhotoImageStyle,
} from './profile-photo-display.js'

describe('profile-photo-display', () => {
  test('normalize defaults for invalid input', () => {
    assert.deepEqual(normalizeProfilePhotoDisplaySettings(null), DEFAULT_PROFILE_PHOTO_DISPLAY)
    assert.deepEqual(normalizeProfilePhotoDisplaySettings({ displayFit: 'nope' }), DEFAULT_PROFILE_PHOTO_DISPLAY)
  })

  test('normalize contain mode', () => {
    assert.deepEqual(normalizeProfilePhotoDisplaySettings({ displayFit: 'contain' }), {
      displayFit: 'contain',
      focalX: 0.5,
      focalY: 0.5,
    })
  })

  test('profilePhotoImageStyle uses focal point', () => {
    const style = profilePhotoImageStyle({ displayFit: 'cover', focalX: 0.25, focalY: 0.75 })
    assert.equal(style.objectFit, 'cover')
    assert.equal(style.objectPosition, '25% 75%')
  })

  test('formatProfilePhotoCredit prefixes plain names', () => {
    assert.equal(formatProfilePhotoCredit('Jane Doe Photography'), 'Photo by Jane Doe Photography')
    assert.equal(formatProfilePhotoCredit('Photo by @snapper'), 'Photo by @snapper')
    assert.equal(formatProfilePhotoCredit('  '), null)
  })
})
