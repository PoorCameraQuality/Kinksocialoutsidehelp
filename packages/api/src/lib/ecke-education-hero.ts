import { sanitizeEckeHeroImageUrl } from '@c2k/shared'
import { deliverProfileHeroUrl } from './image-delivery.js'
import { getMediaAssetById } from './media-asset-service.js'
import { canExposePublicUrl, resolveMediaPublicUrl } from './media-pipeline.js'

const MEDIA_ASSET_CONTENT_RE = /\/api\/v1\/media\/assets\/([0-9a-f-]{36})\/content(?:\?|$)/i

export function parseMediaAssetIdFromHeroUrl(url: string): string | null {
  const trimmed = url.trim()
  const direct = trimmed.match(MEDIA_ASSET_CONTENT_RE)?.[1]
  if (direct) return direct

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed)
      const pathMatch = parsed.pathname.match(MEDIA_ASSET_CONTENT_RE)
      return pathMatch?.[1] ?? null
    } catch {
      return null
    }
  }

  return null
}

/** Resolve education hero images to ECKE-reachable public URLs when possible. */
export async function resolveEckeEducationHeroImageUrl(
  heroImageUrl: string | null | undefined,
): Promise<string | null> {
  const trimmed = heroImageUrl?.trim()
  if (!trimmed) return null

  const assetId = parseMediaAssetIdFromHeroUrl(trimmed)
  if (assetId) {
    try {
      const asset = await getMediaAssetById(assetId)
      if (!asset || !canExposePublicUrl(asset)) return null
      const publicUrl = resolveMediaPublicUrl(asset)
      if (!publicUrl) return null
      return sanitizeEckeHeroImageUrl(deliverProfileHeroUrl(publicUrl) ?? publicUrl)
    } catch {
      return null
    }
  }

  if (trimmed.startsWith('/api/v1/media/assets/')) {
    return null
  }

  return sanitizeEckeHeroImageUrl(trimmed)
}
