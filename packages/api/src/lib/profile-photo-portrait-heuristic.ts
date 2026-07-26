import sharp from 'sharp'

function isSkinRgb(r: number, g: number, b: number): boolean {
  if (r > 245 && g > 245 && b > 245) return false
  if (r < 28 && g < 28 && b < 28) return false
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread < 12) return false
  if (r > 80 && g > 30 && b > 15 && r > g && r > b && r - g > 12) return true
  if (r > 110 && g > 70 && b > 45 && r >= g && g >= b) return true
  return false
}

export type ProfilePortraitHeuristicResult = {
  likelyExplicitCloseup: boolean
  confidence: number
  metrics: {
    centerSkinRatio: number
    borderSkinRatio: number
    centerLumaStd: number
  }
}

/**
 * Lightweight portrait-vs-explicit-closeup heuristic for profile gallery uploads.
 * Conservative: prefers false negatives on normal portraits over blocking faces.
 */
export async function scoreProfilePortraitLikelihood(
  buffer: Buffer,
): Promise<ProfilePortraitHeuristicResult> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(48, 48, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  let centerSkin = 0
  let centerTotal = 0
  let borderSkin = 0
  let borderTotal = 0
  const centerLumas: number[] = []

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const inCenter = x >= w * 0.22 && x < w * 0.78 && y >= h * 0.22 && y < h * 0.78
      const skin = isSkinRgb(r, g, b)
      const luma = 0.299 * r + 0.587 * g + 0.114 * b

      if (inCenter) {
        centerTotal++
        if (skin) centerSkin++
        centerLumas.push(luma)
      } else {
        borderTotal++
        if (skin) borderSkin++
      }
    }
  }

  const centerSkinRatio = centerSkin / Math.max(centerTotal, 1)
  const borderSkinRatio = borderSkin / Math.max(borderTotal, 1)
  const mean = centerLumas.reduce((a, v) => a + v, 0) / Math.max(centerLumas.length, 1)
  const centerLumaStd = Math.sqrt(
    centerLumas.reduce((s, l) => s + (l - mean) ** 2, 0) / Math.max(centerLumas.length, 1),
  )

  // Flat logos/brand marks (low luma variance) — not portrait close-ups.
  if (centerLumaStd <= 12) {
    return {
      likelyExplicitCloseup: false,
      confidence: 0.1,
      metrics: { centerSkinRatio, borderSkinRatio, centerLumaStd },
    }
  }

  const likelyExplicitCloseup =
    centerSkinRatio >= 0.85 && borderSkinRatio <= 0.28 && centerLumaStd <= 22

  const confidence = likelyExplicitCloseup
    ? Math.min(0.92, 0.45 + centerSkinRatio * 0.45)
    : 0.15

  return {
    likelyExplicitCloseup,
    confidence,
    metrics: { centerSkinRatio, borderSkinRatio, centerLumaStd },
  }
}
