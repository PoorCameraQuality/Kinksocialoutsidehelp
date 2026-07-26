import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { describe, test } from 'node:test'
import { readMultipartFileWithLimit } from './multipart-read-limit.js'
import { MediaUploadValidationError } from './media-pipeline.js'

function mockFile(chunks: Buffer[]) {
  return {
    file: Readable.from(chunks),
  } as never
}

describe('readMultipartFileWithLimit', () => {
  test('returns concatenated buffer under limit', async () => {
    const buf = await readMultipartFileWithLimit(mockFile([Buffer.from('ab'), Buffer.from('cd')]), 10)
    assert.equal(buf.toString(), 'abcd')
  })

  test('throws when total exceeds maxBytes', async () => {
    await assert.rejects(
      () => readMultipartFileWithLimit(mockFile([Buffer.alloc(5), Buffer.alloc(5)]), 8),
      (err: unknown) => {
        assert.ok(err instanceof MediaUploadValidationError)
        assert.match((err as MediaUploadValidationError).message, /exceeds maximum size/)
        return true
      },
    )
  })
})
