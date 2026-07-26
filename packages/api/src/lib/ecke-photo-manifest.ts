import {
  ECKE_LEGACY_HERO_MEDIA_ASSET_ID,
  emptyEckePhotosManifest,
  resolveEckePayloadHeroUrl,
  sanitizeEckeHeroImageUrl,
  type EckePhotoAsset,
  type EckePhotosManifest,
} from '@c2k/shared'
import { hashMediaManifest } from './ecke-media-manifest-hash.js'
import type { EckeListingPayload } from './ecke-publish-payload.js'
import type { MediaAsset } from '../db/schema.js'
import { parseMediaAssetIdFromHeroUrl, resolveEckeEducationHeroImageUrl } from './ecke-education-hero.js'
import { deliverProfileHeroUrl } from './image-delivery.js'
import { getMediaAssetById } from './media-asset-service.js'
import { canExposePublicUrl, resolveMediaPublicUrl } from './media-pipeline.js'
import { isEckePhotosPublishEnabled } from './ecke-publish-config.js'

/** True when asset may appear in an ECKE outbound photo manifest. */
export function isEckePublishableMediaAsset(asset: MediaAsset): boolean {
  return canExposePublicUrl(asset)
}

async function photoAssetFromMediaRow(asset: MediaAsset, role: EckePhotoAsset['role'], ordinal: number): Promise<EckePhotoAsset | null> {
  if (!isEckePublishableMediaAsset(asset)) return null
  const publicUrl = resolveMediaPublicUrl(asset)
  if (!publicUrl) return null
  const delivered = sanitizeEckeHeroImageUrl(deliverProfileHeroUrl(publicUrl) ?? publicUrl)
  if (!delivered) return null
  return {
    sourceMediaAssetId: asset.id,
    role,
    ordinal,
    publicUrl: delivered,
    width: asset.imageWidth ?? null,
    height: asset.imageHeight ?? null,
    sha256Hash: asset.sha256Hash ?? null,
    altText: null,
  }
}

async function heroFromResolvedUrl(resolvedUrl: string, sourceHeroUrl?: string | null): Promise<EckePhotoAsset | null> {
  const publicUrl = sanitizeEckeHeroImageUrl(resolvedUrl)
  if (!publicUrl) return null

  const assetId = parseMediaAssetIdFromHeroUrl(sourceHeroUrl ?? resolvedUrl)
  if (assetId) {
    try {
      const asset = await getMediaAssetById(assetId)
      if (asset) {
        const fromAsset = await photoAssetFromMediaRow(asset, 'hero', 0)
        if (fromAsset) return fromAsset
      }
    } catch {
      /* fall through to legacy row */
    }
  }

  return {
    sourceMediaAssetId: ECKE_LEGACY_HERO_MEDIA_ASSET_ID,
    role: 'hero',
    ordinal: 0,
    publicUrl,
    width: null,
    height: null,
    sha256Hash: null,
    altText: null,
  }
}

/** Build publishable photo manifest for education articles. */
export async function buildEducationArticlePhotosManifest(input: {
  heroImageUrl: string | null | undefined
}): Promise<EckePhotosManifest> {
  return loadPublishableTargetMediaManifest({ fallbackImageUrl: input.heroImageUrl })
}

/** Listing / event legacy imageUrl → optional hero manifest. */
export async function buildLegacyImageUrlPhotosManifest(imageUrl: string | null | undefined): Promise<EckePhotosManifest> {
  return loadPublishableTargetMediaManifest({ fallbackImageUrl: imageUrl })
}

export type LoadPublishableTargetMediaManifestInput = {
  fallbackImageUrl?: string | null
  galleryMediaAssetIds?: string[]
}

/**
 * Build ECKE photo manifest from eligible media_assets rows and/or a legacy hero URL.
 * Prefers explicit hero asset from fallbackImageUrl, then first gallery asset, then legacy external URL.
 */
export async function loadPublishableTargetMediaManifest(
  input: LoadPublishableTargetMediaManifestInput,
): Promise<EckePhotosManifest> {
  if (!isEckePhotosPublishEnabled()) return emptyEckePhotosManifest()

  const gallery: EckePhotoAsset[] = []
  if (input.galleryMediaAssetIds?.length) {
    let ordinal = 0
    for (const assetId of input.galleryMediaAssetIds) {
      try {
        const asset = await getMediaAssetById(assetId)
        if (!asset) continue
        const photo = await photoAssetFromMediaRow(asset, 'gallery', ordinal++)
        if (photo) gallery.push(photo)
      } catch {
        /* skip ineligible asset */
      }
    }
  }

  let hero: EckePhotoAsset | null = null
  const trimmedFallback = input.fallbackImageUrl?.trim()
  if (trimmedFallback) {
    const assetId = parseMediaAssetIdFromHeroUrl(trimmedFallback)
    if (assetId) {
      try {
        const asset = await getMediaAssetById(assetId)
        if (asset) {
          hero = await photoAssetFromMediaRow(asset, 'hero', 0)
        }
      } catch {
        /* fall through */
      }
    }

    if (!hero) {
      const resolved =
        assetId ? await resolveEckeEducationHeroImageUrl(trimmedFallback) : sanitizeEckeHeroImageUrl(trimmedFallback)
      if (resolved) {
        hero = await heroFromResolvedUrl(resolved, trimmedFallback)
      }
    }
  }

  if (!hero && gallery.length > 0) {
    hero = { ...gallery[0]!, role: 'hero', ordinal: 0 }
  }

  if (!hero && gallery.length === 0) return emptyEckePhotosManifest()

  if (hero?.publicUrl.startsWith('/api/v1/media/')) {
    hero = gallery.length > 0 ? { ...gallery[0]!, role: 'hero', ordinal: 0 } : null
  }

  if (!hero && gallery.length === 0) return emptyEckePhotosManifest()

  return {
    manifestVersion: 1,
    hero,
    gallery: hero && gallery[0]?.sourceMediaAssetId === hero.sourceMediaAssetId ? gallery.slice(1) : gallery,
  }
}

export type EckePhotosPreview = {
  hero: EckePhotoAsset | null
  galleryCount: number
  mediaHash: string | null
}

export function buildPhotosPreview(manifest: EckePhotosManifest | null | undefined): EckePhotosPreview {
  const photos = manifest ?? emptyEckePhotosManifest()
  return {
    hero: photos.hero,
    galleryCount: photos.gallery.length,
    mediaHash: photos.hero || photos.gallery.length > 0 ? hashMediaManifest(photos) : null,
  }
}

/** Attach optional photos manifest to listing payloads before ECKE webhook send. */
export async function enrichEckeListingPayloadWithPhotos(payload: EckeListingPayload): Promise<EckeListingPayload> {
  const photos = await loadPublishableTargetMediaManifest({ fallbackImageUrl: payload.imageUrl })
  if (!photos.hero && photos.gallery.length === 0) return payload
  return {
    ...payload,
    photos,
    imageUrl: resolveEckePayloadHeroUrl({ photos, legacyHeroUrl: payload.imageUrl }),
  }
}

export function listPersistablePhotoAssets(manifest: EckePhotosManifest | null | undefined): EckePhotoAsset[] {
  if (!manifest) return []
  return [...(manifest.hero ? [manifest.hero] : []), ...manifest.gallery].filter(
    (asset) => asset.sourceMediaAssetId !== ECKE_LEGACY_HERO_MEDIA_ASSET_ID,
  )
}
