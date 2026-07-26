import type { MultipartFile } from '@fastify/multipart'
import { MediaUploadValidationError } from './media-pipeline.js'

/** Read multipart file stream with a hard byte cap (aborts early vs buffering unknown size). */
export async function readMultipartFileWithLimit(
  part: MultipartFile,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of part.file) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      throw new MediaUploadValidationError(`File exceeds maximum size (${maxBytes} bytes)`)
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}
