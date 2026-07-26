import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { sanitizeImageBuffer, bufferHasExif } from './media-sanitize.js'

/** 1x1 PNG with no EXIF */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('media-sanitize', () => {
  test('sanitize returns dimensions and strips metadata path', async () => {
    const out = await sanitizeImageBuffer(TINY_PNG, 'image/png')
    assert.equal(out.width, 1)
    assert.equal(out.height, 1)
    assert.ok(out.buffer.length > 0)
    assert.equal(await bufferHasExif(out.buffer), false)
  })
})
