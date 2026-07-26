import sharp from 'sharp'
import type { AllowedImageMime } from './media-upload-validate.js'

export type SanitizedImageResult = {
  buffer: Buffer
  mimeType: AllowedImageMime
  width: number
  height: number
  exifStripped: boolean
}

/** Max longest edge after sanitize — keeps VPS uploads/scans under a few seconds. */
const MAX_SANITIZE_EDGE_PX = 2048
const MAX_INPUT_PIXELS = 16_777_216 // 4096×4096 decompression guard

function basePipeline(buffer: Buffer) {
  return sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .resize(MAX_SANITIZE_EDGE_PX, MAX_SANITIZE_EDGE_PX, {
      fit: 'inside',
      withoutEnlargement: true,
    })
}

/** Strip EXIF/GPS, downscale large camera photos, and re-encode before quarantine storage. */
export async function sanitizeImageBuffer(
  buffer: Buffer,
  detectedMime: AllowedImageMime,
): Promise<SanitizedImageResult> {
  const meta = await basePipeline(buffer).metadata()

  if (!meta.width || !meta.height) {
    throw new Error('malformed_image')
  }

  let output: Buffer
  let mimeType: AllowedImageMime = detectedMime

  switch (detectedMime) {
    case 'image/jpeg':
      // Plain libjpeg — mozjpeg can stall for minutes on small VPS CPUs.
      output = await basePipeline(buffer).jpeg({ quality: 85, mozjpeg: false }).toBuffer()
      mimeType = 'image/jpeg'
      break
    case 'image/png':
      output = await basePipeline(buffer).png().toBuffer()
      mimeType = 'image/png'
      break
    case 'image/webp':
      output = await basePipeline(buffer).webp().toBuffer()
      mimeType = 'image/webp'
      break
    case 'image/gif':
      output = await basePipeline(buffer).gif().toBuffer()
      mimeType = 'image/gif'
      break
    default:
      throw new Error('unsupported_type')
  }

  const outMeta = await sharp(output).metadata()
  if (!outMeta.width || !outMeta.height) {
    throw new Error('malformed_image')
  }

  const hadExif = Boolean(meta.exif || meta.icc)

  return {
    buffer: output,
    mimeType,
    width: outMeta.width,
    height: outMeta.height,
    exifStripped: hadExif,
  }
}

/** Test helper - detect GPS/EXIF tags in a buffer (should be absent after sanitize). */
export async function bufferHasExif(buffer: Buffer): Promise<boolean> {
  const meta = await sharp(buffer).metadata()
  return Boolean(meta.exif || (meta as { gps?: unknown }).gps)
}
