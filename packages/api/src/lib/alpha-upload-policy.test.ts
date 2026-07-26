import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAlphaUploadDisabled } from './alpha-upload-policy.js'

test('isAlphaUploadDisabled respects env flags', () => {
  const prev = process.env.C2K_ALPHA_DISABLE_CONVENTION_GALLERY_UPLOADS
  process.env.C2K_ALPHA_DISABLE_CONVENTION_GALLERY_UPLOADS = 'true'
  assert.equal(isAlphaUploadDisabled('convention_gallery'), true)
  process.env.C2K_ALPHA_DISABLE_CONVENTION_GALLERY_UPLOADS = 'false'
  assert.equal(isAlphaUploadDisabled('convention_gallery'), false)
  if (prev === undefined) delete process.env.C2K_ALPHA_DISABLE_CONVENTION_GALLERY_UPLOADS
  else process.env.C2K_ALPHA_DISABLE_CONVENTION_GALLERY_UPLOADS = prev
})

test('profile_photo uploads enabled unless explicitly disabled', () => {
  const prev = process.env.C2K_ALPHA_DISABLE_PROFILE_PHOTO_UPLOADS
  delete process.env.C2K_ALPHA_DISABLE_PROFILE_PHOTO_UPLOADS
  assert.equal(isAlphaUploadDisabled('profile_photo'), false)
  process.env.C2K_ALPHA_DISABLE_PROFILE_PHOTO_UPLOADS = 'true'
  assert.equal(isAlphaUploadDisabled('profile_photo'), true)
  if (prev === undefined) delete process.env.C2K_ALPHA_DISABLE_PROFILE_PHOTO_UPLOADS
  else process.env.C2K_ALPHA_DISABLE_PROFILE_PHOTO_UPLOADS = prev
})

test('event_cover uploads enabled unless explicitly disabled', () => {
  const prev = process.env.C2K_ALPHA_DISABLE_EVENT_COVER_UPLOADS
  delete process.env.C2K_ALPHA_DISABLE_EVENT_COVER_UPLOADS
  assert.equal(isAlphaUploadDisabled('event_cover'), false)
  process.env.C2K_ALPHA_DISABLE_EVENT_COVER_UPLOADS = 'true'
  assert.equal(isAlphaUploadDisabled('event_cover'), true)
  if (prev === undefined) delete process.env.C2K_ALPHA_DISABLE_EVENT_COVER_UPLOADS
  else process.env.C2K_ALPHA_DISABLE_EVENT_COVER_UPLOADS = prev
})

test('feed image kill switch also disables feed_video and feed_audio (shared env)', () => {
  const prev = process.env.C2K_ALPHA_DISABLE_FEED_IMAGE_UPLOADS
  process.env.C2K_ALPHA_DISABLE_FEED_IMAGE_UPLOADS = 'true'
  assert.equal(isAlphaUploadDisabled('feed_image'), true)
  assert.equal(isAlphaUploadDisabled('feed_video'), true)
  assert.equal(isAlphaUploadDisabled('feed_audio'), true)
  delete process.env.C2K_ALPHA_DISABLE_FEED_IMAGE_UPLOADS
  assert.equal(isAlphaUploadDisabled('feed_video'), false)
  if (prev === undefined) delete process.env.C2K_ALPHA_DISABLE_FEED_IMAGE_UPLOADS
  else process.env.C2K_ALPHA_DISABLE_FEED_IMAGE_UPLOADS = prev
})
