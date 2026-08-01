import { Link } from 'react-router-dom'

import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import type { ProfileGalleryPhoto } from '@/components/profile/ProfilePhotoGallery'
import { IconCamera } from '@/components/profile/story/ProfileStoryIcons'
import { shouldBlurMediaForViewer, type MediaViewerContext } from '@/lib/media-visibility'
import { cn } from '@/lib/cn'

type Props = {
  photos: ProfileGalleryPhoto[]
  viewer: MediaViewerContext
  totalCount: number
  onViewAll?: () => void
  /** Owner shortcut — opens Photos Studio. */
  managePhotosHref?: string
  viewerIsOwner?: boolean
  className?: string
}

const PREVIEW_LIMIT = 5

const TILE_CLASS =
  'h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-dc-border-subtle sm:h-28 sm:w-28'

function isBlurred(photo: ProfileGalleryPhoto, viewer: MediaViewerContext): boolean {
  return shouldBlurMediaForViewer(viewer, {
    contentRating: photo.contentRating ?? null,
    visibility: photo.visibility ?? null,
    uploadStatus: photo.uploadStatus ?? null,
    isBlurredByDefault: photo.isBlurredByDefault ?? false,
  })
}

/**
 * Gallery preview directly under the hero with a section header.
 */
export default function ProfileGalleryStrip({
  photos,
  viewer,
  totalCount,
  onViewAll,
  managePhotosHref,
  viewerIsOwner = false,
  className,
}: Props) {
  const withUrl = photos.filter((p) => p.url)
  const manageHref = managePhotosHref ?? '/profile/edit/photos'

  if (withUrl.length === 0) {
    if (!viewerIsOwner) return null
    return (
      <section className={className}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-dc-text">Photos</h2>
          <Link
            to={manageHref}
            className="text-sm font-medium text-dc-accent hover:underline"
          >
            Manage photos
          </Link>
        </div>
        <Link
          to={manageHref}
          className={cn(
            TILE_CLASS,
            'flex flex-col items-center justify-center gap-1.5 border-dashed bg-dc-surface-muted text-dc-text-muted transition hover:border-dc-accent-border hover:text-dc-text',
          )}
        >
          <IconCamera className="h-5 w-5" />
          <span className="text-xs font-medium">Add photo</span>
        </Link>
      </section>
    )
  }

  const preview = withUrl.slice(0, PREVIEW_LIMIT)
  const overflow = Math.max(0, totalCount - preview.length)
  const tileLinkClass = cn(
    TILE_CLASS,
    'group relative bg-dc-elevated-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dc-accent',
  )

  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-dc-text">
          Photos
          {totalCount > 0 ? <span className="ml-1.5 font-normal text-dc-text-muted">{totalCount}</span> : null}
        </h2>
        {viewerIsOwner && managePhotosHref ?
          <Link to={managePhotosHref} className="text-sm font-medium text-dc-text-muted hover:text-dc-accent hover:underline">
            Manage photos
          </Link>
        : onViewAll ?
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-medium text-dc-text-muted hover:text-dc-accent hover:underline"
          >
            View all{totalCount > 0 ? ` ${totalCount}` : ''}
          </button>
        : null}
      </div>

      <div
        className={cn(
          'flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3',
        )}
      >
        {preview.map((photo, index) => {
          const blur = isBlurred(photo, viewer)
          const isPrimary = index === 0 || photo.order === 0
          const tileBody = (
            <>
              <ProfilePhotoImage
                src={photo.url!}
                alt={photo.caption ?? 'Profile photo'}
                displaySettings={photo.displaySettings}
                className={cn(
                  'h-full w-full transition',
                  blur ? 'scale-110 blur-xl' : 'group-hover:scale-[1.03]',
                )}
              />
              {isPrimary ?
                <span className="absolute left-1.5 top-1.5 rounded bg-dc-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-dc-accent-foreground">
                  Profile photo
                </span>
              : null}
              {blur ?
                <span className="absolute inset-0 flex items-center justify-center bg-dc-surface-muted/55 text-[11px] font-medium text-dc-text">
                  Adult content
                </span>
              : null}
            </>
          )

          if (viewerIsOwner && managePhotosHref) {
            return (
              <button
                key={photo.id}
                type="button"
                onClick={onViewAll}
                className={tileLinkClass}
                aria-label={blur ? 'Adult content — open gallery' : 'Open photo'}
              >
                {tileBody}
              </button>
            )
          }

          return (
            <button
              key={photo.id}
              type="button"
              onClick={onViewAll}
              className={tileLinkClass}
              aria-label={blur ? 'Adult content — open gallery to view' : 'Open photo gallery'}
            >
              {tileBody}
            </button>
          )
        })}

        {viewerIsOwner && managePhotosHref ?
          <Link
            to={managePhotosHref}
            className={cn(
              TILE_CLASS,
              'flex flex-col items-center justify-center gap-1.5 border-dashed bg-dc-surface-muted text-dc-text-muted transition hover:border-dc-accent-border hover:text-dc-text focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent',
            )}
            aria-label="Add profile photo"
          >
            <IconCamera className="h-5 w-5" />
            <span className="text-xs font-medium">Add photo</span>
          </Link>
        : overflow > 0 && onViewAll ?
          <button
            type="button"
            onClick={onViewAll}
            className={cn(
              TILE_CLASS,
              'flex flex-col items-center justify-center gap-1 border-dashed bg-dc-surface-muted text-dc-text-muted transition hover:border-dc-accent-border hover:text-dc-text',
            )}
            aria-label={`View ${overflow} more photos`}
          >
            <span className="text-lg font-semibold text-dc-text">+{overflow}</span>
            <span className="text-[11px]">more</span>
          </button>
        : null}
      </div>
    </section>
  )
}
