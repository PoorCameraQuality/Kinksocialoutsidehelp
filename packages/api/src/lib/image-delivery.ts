import {
  buildImgproxyProcessingSegment,
  buildSignedImgproxyUrl,
  isAllowedImgproxySource,
  loadImgproxyConfig,
  resolveImgproxySourceUrl,
  type ImgproxyConfig,
} from './imgproxy.js'

export const IMAGE_VARIANTS = {
  avatar_sm: { ops: ['rs:fill:64:64:0'] as const },
  avatar_md: { ops: ['rs:fill:128:128:0'] as const },
  avatar_lg: { ops: ['rs:fill:256:256:0'] as const },
  card_sm: { ops: ['w:320'] as const },
  card_md: { ops: ['w:640'] as const },
  card_lg: { ops: ['w:960'] as const },
  feed_image: { ops: ['w:1200'] as const },
  profile_hero: { ops: ['w:1440'] as const },
  gallery_thumb: { ops: ['rs:fill:320:320:0'] as const },
  media_preview: { ops: ['w:720'] as const },
  blur_preview: { ops: ['w:32', 'bl:20', 'q:50'] as const },
} as const

export type ImageVariantName = keyof typeof IMAGE_VARIANTS

export function getImageVariantProcessing(name: ImageVariantName, cfg?: ImgproxyConfig): string {
  const config = cfg ?? loadImgproxyConfig()
  return buildImgproxyProcessingSegment(IMAGE_VARIANTS[name].ops, config)
}

/**
 * Deliver a display URL for a known-safe source. When imgproxy is off or source is ineligible,
 * returns the original URL (fallback). Never transforms auth-gated media proxy paths.
 */
export function deliverImageUrl(
  sourceUrl: string | null | undefined,
  variant: ImageVariantName = 'card_md',
): string | null {
  if (!sourceUrl?.trim()) return null
  const trimmed = sourceUrl.trim()
  const cfg = loadImgproxyConfig()
  if (!cfg.operational) return trimmed

  if (!isAllowedImgproxySource(trimmed)) {
    return cfg.fallbackToOriginal ? trimmed : null
  }

  const absolute =
    trimmed.startsWith('http://') || trimmed.startsWith('https://') ?
      trimmed
    : resolveImgproxySourceUrl(trimmed)
  if (!absolute) return cfg.fallbackToOriginal ? trimmed : null

  const processing = getImageVariantProcessing(variant, cfg)
  const proxied = buildSignedImgproxyUrl(absolute, processing, cfg)
  if (proxied) return proxied
  return cfg.fallbackToOriginal ? trimmed : null
}

export function deliverAvatarUrl(
  sourceUrl: string | null | undefined,
  size: 'sm' | 'md' | 'lg' = 'md',
): string | null {
  const variant: ImageVariantName =
    size === 'sm' ? 'avatar_sm'
    : size === 'lg' ? 'avatar_lg'
    : 'avatar_md'
  return deliverImageUrl(sourceUrl, variant)
}

export function deliverCardImageUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'card_md')
}

export function deliverFeedImageUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'feed_image')
}

export function deliverProfileHeroUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'profile_hero')
}

export function deliverBrandingLogoUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'avatar_lg')
}

export function deliverBrandingBannerUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'card_lg')
}

export function deliverBlurPreviewUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'blur_preview')
}

export function deliverGalleryThumbUrl(sourceUrl: string | null | undefined): string | null {
  return deliverImageUrl(sourceUrl, 'gallery_thumb')
}

export function buildImageVariantMap(
  sourceUrl: string | null | undefined,
  variants: readonly ImageVariantName[],
): Partial<Record<ImageVariantName, string>> {
  if (!sourceUrl?.trim()) return {}
  const out: Partial<Record<ImageVariantName, string>> = {}
  for (const variant of variants) {
    const url = deliverImageUrl(sourceUrl, variant)
    if (url) out[variant] = url
  }
  return out
}
