import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildPersonalPhotoQuota,
  MAX_PERSONAL_PHOTOS,
  personalPhotoQuotaStatusMessage,
} from './personal-photo-quota.js'

describe('personal-photo-quota', () => {
  test('buildPersonalPhotoQuota at limit', () => {
    const q = buildPersonalPhotoQuota(100)
    assert.equal(q.atLimit, true)
    assert.equal(q.remaining, 0)
    assert.equal(q.nearLimit, false)
  })

  test('buildPersonalPhotoQuota near limit', () => {
    const q = buildPersonalPhotoQuota(MAX_PERSONAL_PHOTOS - 5)
    assert.equal(q.nearLimit, true)
    assert.equal(q.remaining, 5)
  })

  test('status message at limit', () => {
    const msg = personalPhotoQuotaStatusMessage(buildPersonalPhotoQuota(100))
    assert.match(msg ?? '', /100-photo limit/)
  })
})
