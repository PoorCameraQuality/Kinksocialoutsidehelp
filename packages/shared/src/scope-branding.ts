/** Resolve Open Graph / social share image with consistent fallback chain. */
export function resolveShareImageUrl(opts: {
  shareImageUrl?: string | null
  bannerUrl?: string | null
  logoUrl?: string | null
  /** Anchor event hero or other wide image */
  heroImageUrl?: string | null
  siteDefault?: string | null
}): string | null {
  const pick = (u: string | null | undefined) => (typeof u === 'string' && u.trim().length > 0 ? u.trim() : null)
  return (
    pick(opts.shareImageUrl) ??
    pick(opts.heroImageUrl) ??
    pick(opts.bannerUrl) ??
    pick(opts.logoUrl) ??
    pick(opts.siteDefault) ??
    null
  )
}
