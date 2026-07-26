import { useCallback, useMemo, useState } from 'react'

import EmptyState from '@/components/ui/EmptyState'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import MediaLightbox, { type MediaLightboxItem } from '@/components/media/MediaLightbox'

import type { MediaContentRating, MediaUploadStatus, MediaVisibility, ProfilePhotoDisplaySettings } from '@c2k/shared'
import { formatProfilePhotoCredit } from '@c2k/shared'

import { shouldBlurMediaForViewer, type MediaViewerContext } from '@/lib/media-visibility'

export type ProfileGalleryPhoto = {
  id: string
  url?: string
  caption?: string | null
  displaySettings?: ProfilePhotoDisplaySettings
  order: number
  mediaAssetId?: string | null
  contentRating?: MediaContentRating | null
  visibility?: MediaVisibility | null
  uploadStatus?: MediaUploadStatus | null
  isBlurredByDefault?: boolean
  pendingReview?: boolean
}

type Props = {
  photos: ProfileGalleryPhoto[]
  emptyMessage?: string
  viewer?: MediaViewerContext
  onReportPhoto?: (photo: ProfileGalleryPhoto) => void
}

function photoIsBlurred(photo: ProfileGalleryPhoto, viewer: MediaViewerContext): boolean {
  return shouldBlurMediaForViewer(viewer, {
    contentRating: photo.contentRating ?? null,
    visibility: photo.visibility ?? null,
    uploadStatus: photo.uploadStatus ?? null,
    isBlurredByDefault: photo.isBlurredByDefault ?? false,
  })
}

function ProfilePhotoTile({
  photo,
  viewer,
  revealed,
  onReveal,
  onOpenLightbox,
  onReportPhoto,
}: {
  photo: ProfileGalleryPhoto
  viewer: MediaViewerContext
  revealed: boolean
  onReveal: () => void
  onOpenLightbox: () => void
  onReportPhoto?: (photo: ProfileGalleryPhoto) => void
}) {
  const blur = photoIsBlurred(photo, viewer)
  const showBlur = blur && !revealed
  const credit = formatProfilePhotoCredit(photo.caption)

  const openViewer = () => {
    if (!photo.url || showBlur) return
    onOpenLightbox()
  }

  return (
    <figure className="group relative aspect-square overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid">
      {photo.url ?
        <button
          type="button"
          onClick={openViewer}
          disabled={showBlur}
          className={`relative h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dc-accent ${
            showBlur ? 'cursor-default' : 'cursor-zoom-in'
          }`}
          aria-label={showBlur ? 'Adult content — reveal to view' : `View full photo${credit ? `: ${credit}` : ''}`}
        >
          <ProfilePhotoImage
            src={photo.url}
            alt={photo.caption ?? 'Profile photo'}
            displaySettings={photo.displaySettings}
            className={`h-full w-full transition ${showBlur ? 'scale-105 blur-xl' : 'group-hover:scale-[1.02]'}`}
          />

          {showBlur ?
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-dc-surface-muted/60 p-3">
              <p className="text-xs text-center text-dc-text">Adult content</p>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onReveal()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onReveal()
                  }
                }}
                className="min-h-9 rounded-lg bg-dc-accent px-3 text-xs font-medium text-dc-accent-foreground"
              >
                Show photo
              </span>
            </div>
          : null}

          {!showBlur ?
            <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" aria-hidden />
          : null}
        </button>
      : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid">
          <svg className="w-10 h-10 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      {photo.caption ?
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
          <p className="text-xs text-dc-text truncate">{credit}</p>
        </figcaption>
      : null}

      {onReportPhoto ?
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReportPhoto(photo)
          }}
          className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] text-dc-text opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        >
          Report
        </button>
      : null}
    </figure>
  )
}

export default function ProfilePhotoGallery({
  photos,
  emptyMessage = 'No photos shared yet.',
  viewer = { authenticated: false, adultContentPref: 'BLUR' },
  onReportPhoto,
}: Props) {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set())
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null)

  const isViewable = useCallback(
    (photo: ProfileGalleryPhoto) => {
      if (!photo.url) return false
      if (!photoIsBlurred(photo, viewer)) return true
      return revealedIds.has(photo.id)
    },
    [viewer, revealedIds],
  )

  const lightboxItems = useMemo((): MediaLightboxItem[] => {
    return photos
      .filter(isViewable)
      .map((photo) => ({
        id: photo.id,
        url: photo.url!,
        caption: formatProfilePhotoCredit(photo.caption) ?? undefined,
        alt: photo.caption ?? 'Profile photo',
      }))
  }, [photos, isViewable])

  const lightboxIndex =
    lightboxPhotoId != null ? lightboxItems.findIndex((item) => item.id === lightboxPhotoId) : -1

  const revealAndOpen = useCallback((photoId: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      next.add(photoId)
      return next
    })
    setLightboxPhotoId(photoId)
  }, [])

  const openLightbox = useCallback((photoId: string) => {
    setLightboxPhotoId(photoId)
  }, [])

  if (photos.length === 0) {
    return <EmptyState message={emptyMessage} inline compact className="text-left" />
  }

  const singlePhoto = photos.length === 1

  return (
    <>
      <div
        className={
          singlePhoto ?
            'max-w-[min(100%,14rem)] sm:max-w-none'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4'
        }
      >
        {photos.map((p) => (
          <ProfilePhotoTile
            key={p.id}
            photo={p}
            viewer={viewer}
            revealed={revealedIds.has(p.id)}
            onReveal={() => revealAndOpen(p.id)}
            onOpenLightbox={() => openLightbox(p.id)}
            onReportPhoto={onReportPhoto}
          />
        ))}
      </div>

      {lightboxIndex >= 0 && lightboxItems.length > 0 ?
        <MediaLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxPhotoId(null)}
          onIndexChange={(nextIndex) => {
            const next = lightboxItems[nextIndex]
            if (next) setLightboxPhotoId(next.id)
          }}
          ariaLabel="Profile photo gallery"
        />
      : null}
    </>
  )
}
