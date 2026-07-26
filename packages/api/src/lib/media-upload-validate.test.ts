import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { MAX_IMAGE_UPLOAD_BYTES, uploadLimitMegabytes } from '@c2k/shared'
import { validateImageUploadBuffer, validationErrorMessage } from './media-upload-validate.js'

/** Minimal valid 1x1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('media-upload-validate', () => {
  test('rejects empty buffer', async () => {
    const result = await validateImageUploadBuffer(Buffer.alloc(0), 'x.png', 'image/png')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'empty_file')
  })

  test('accepts valid PNG with matching extension', async () => {
    const result = await validateImageUploadBuffer(TINY_PNG, 'photo.png', 'image/png')
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.detectedMime, 'image/png')
  })

  test('rejects extension/MIME mismatch', async () => {
    const result = await validateImageUploadBuffer(TINY_PNG, 'photo.jpg', 'image/jpeg')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'mime_mismatch')
  })

  test('rejects fake jpg content', async () => {
    const result = await validateImageUploadBuffer(Buffer.from('not an image'), 'photo.jpg', 'image/jpeg')
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(['unsupported_type', 'mime_mismatch'].includes(result.reason))
      assert.ok(validationErrorMessage(result).length > 0)
    }
  })

  test('file_too_large message tracks MAX_IMAGE_UPLOAD_BYTES', () => {
    const msg = validationErrorMessage({ ok: false, reason: 'file_too_large' })
    assert.match(msg, new RegExp(`${uploadLimitMegabytes(MAX_IMAGE_UPLOAD_BYTES)} MB`))
  })
})
