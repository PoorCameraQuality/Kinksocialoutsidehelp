/**
 * Client-side image prep before POST /api/upload.
 * Matches server sanitize intent (max edge ~2048, re-encode) so phone photos
 * in the 10–20 MB range upload quickly without hitting the wire limit.
 */

/** Longest edge after client resize — aligned with API media-sanitize. */
export const CLIENT_IMAGE_MAX_EDGE_PX = 2048

/** Skip re-encode when already small enough (bytes + dimensions). */
const SKIP_IF_UNDER_BYTES = 1.5 * 1024 * 1024

/** JPEG quality for re-encode (good enough for profile/gallery). */
const JPEG_QUALITY = 0.85

export type CompressImageForUploadResult = {
  file: File
  /** True when we resized or re-encoded. */
  compressed: boolean
  originalBytes: number
  outputBytes: number
  width?: number
  height?: number
}

function isProbablyImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)
}

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0)
      createImageBitmap(canvas).then(resolve, reject)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode image'))
    }
    img.src = url
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not encode image'))
        else resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

function outputFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'photo'
  return `${base}.jpg`
}

/**
 * Downscale and JPEG-encode large camera photos before upload.
 * Falls back to the original File if decoding fails (e.g. HEIC on some browsers).
 */
export async function compressImageForUpload(
  file: File,
  opts?: { maxEdgePx?: number; quality?: number },
): Promise<CompressImageForUploadResult> {
  const originalBytes = file.size
  if (!isProbablyImage(file)) {
    return { file, compressed: false, originalBytes, outputBytes: originalBytes }
  }

  // GIFs may be animated — do not flatten via canvas.
  if (file.type === 'image/gif' || /\.gif$/i.test(file.name)) {
    return { file, compressed: false, originalBytes, outputBytes: originalBytes }
  }

  const maxEdge = opts?.maxEdgePx ?? CLIENT_IMAGE_MAX_EDGE_PX
  const quality = opts?.quality ?? JPEG_QUALITY

  let bitmap: ImageBitmap
  try {
    bitmap = await loadImageBitmap(file)
  } catch {
    return { file, compressed: false, originalBytes, outputBytes: originalBytes }
  }

  try {
    const srcW = bitmap.width
    const srcH = bitmap.height
    if (!srcW || !srcH) {
      return { file, compressed: false, originalBytes, outputBytes: originalBytes }
    }

    const longest = Math.max(srcW, srcH)
    const alreadySmall =
      originalBytes <= SKIP_IF_UNDER_BYTES && longest <= maxEdge
    if (alreadySmall && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
      return {
        file,
        compressed: false,
        originalBytes,
        outputBytes: originalBytes,
        width: srcW,
        height: srcH,
      }
    }

    const scale = longest > maxEdge ? maxEdge / longest : 1
    const width = Math.max(1, Math.round(srcW * scale))
    const height = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      return { file, compressed: false, originalBytes, outputBytes: originalBytes }
    }
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await canvasToJpegBlob(canvas, quality)
    // Prefer original if re-encode somehow got larger (rare for phone JPEGs).
    if (blob.size >= originalBytes && longest <= maxEdge) {
      return {
        file,
        compressed: false,
        originalBytes,
        outputBytes: originalBytes,
        width: srcW,
        height: srcH,
      }
    }

    const out = new File([blob], outputFilename(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
    return {
      file: out,
      compressed: true,
      originalBytes,
      outputBytes: out.size,
      width,
      height,
    }
  } finally {
    bitmap.close()
  }
}
