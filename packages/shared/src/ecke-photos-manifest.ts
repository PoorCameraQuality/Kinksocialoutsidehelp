export type EckePhotoRole = 'hero' | 'gallery' | 'logo' | 'thumbnail'

/** Placeholder when hero is a legacy external URL without a media_assets row. */
export const ECKE_LEGACY_HERO_MEDIA_ASSET_ID = '00000000-0000-4000-8000-000000000001'

export type EckePhotoAsset = {
  sourceMediaAssetId: string
  role: EckePhotoRole
  ordinal: number
  publicUrl: string
  width: number | null
  height: number | null
  sha256Hash: string | null
  altText: string | null
}

export type EckePhotosManifest = {
  manifestVersion: 1
  hero: EckePhotoAsset | null
  gallery: EckePhotoAsset[]
}

export function emptyEckePhotosManifest(): EckePhotosManifest {
  return { manifestVersion: 1, hero: null, gallery: [] }
}

/** Prefer manifest hero URL, then legacy field. */
export function resolveEckePayloadHeroUrl(input: {
  photos?: EckePhotosManifest | null
  legacyHeroUrl?: string | null
}): string | null {
  const fromManifest = input.photos?.hero?.publicUrl?.trim()
  if (fromManifest) return fromManifest
  const legacy = input.legacyHeroUrl?.trim()
  return legacy || null
}
