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
  /** Owner shortcut — opens Profile Studio for photo edits. */
  managePhotosHref?: string
  viewerIsOwner?: boolean
  className?: string
}

const PREVIEW_LIMIT = 6

const TILE_CLASS = 'h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-dc-border sm:h-32 sm:w-32'

function isBlurred(photo: ProfileGalleryPhoto, viewer: MediaViewerContext): boolean {
  return shouldBlurMediaForViewer(viewer, {
    contentRating: photo.contentRating ?? null,
    visibility: photo.visibility ?? null,
    uploadStatus: photo.uploadStatus ?? null,
    isBlurredByDefault: photo.isBlurredByDefault ?? false,
  })
}

/**
 * Photo-forward gallery strip surfaced directly under the hero. A horizontal
 * row of recent photos with a trailing "View all" tile that opens the full
 * gallery. Hidden for visitors when there are no viewable photos.
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

  if (withUrl.length === 0) {
    if (!viewerIsOwner) return null
    return (
      <div className={className}>
        <Link
          to="/profile/edit"
          onClick={onViewAll ? (e) => { e.preventDefault(); onViewAll() } : undefined}
          className={cn(
            TILE_CLASS,
            'flex flex-col items-center justify-center gap-1.5 border-dashed bg-dc-surface-muted text-dc-text-muted transition hover:border-dc-accent-border hover:text-dc-text',
          )}
        >
          <IconCamera className="h-5 w-5" />
          <span className="text-xs font-medium">Add photos</span>
        </Link>
      </div>
    )
  }

  const preview = withUrl.slice(0, PREVIEW_LIMIT)
  const tileLinkClass = cn(
    TILE_CLASS,
    'group relative bg-dc-elevated-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dc-accent',
  )

  return (
    <div
      className={cn(
        'flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {preview.map((photo) => {
        const blur = isBlurred(photo, viewer)
        const tileBody = (
          <>
            <ProfilePhotoImage
              src={photo.url!}
              alt={photo.caption ?? 'Profile photo'}
              displaySettings={photo.displaySettings}
              className={cn('h-full w-full transition', blur ? 'scale-110 blur-xl' : 'group-hover:scale-[1.03]')}
            />
            {blur ?
              <span className="absolute inset-0 flex items-center justify-center bg-dc-surface-muted/55 text-[11px] font-medium text-dc-text">
                Adult content
              </span>
            : null}
          </>
        )

        if (managePhotosHref) {
          return (
            <Link
              key={photo.id}
              to={managePhotosHref}
              className={tileLinkClass}
              aria-label={blur ? 'Adult content — manage photos in Profile Studio' : 'Manage profile photos'}
            >
              {tileBody}
            </Link>
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

      {managePhotosHref ?
        <Link
          to={managePhotosHref}
          className={cn(
            TILE_CLASS,
            'flex flex-col items-center justify-center gap-1.5 border-dashed bg-dc-surface-muted text-dc-text-muted transition hover:border-dc-accent-border hover:text-dc-text focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent',
          )}
          aria-label={`Manage profile photos${totalCount > 0 ? `, ${totalCount} total` : ''}`}
        >
          <IconCamera className="h-5 w-5" />
          <span className="text-xs font-medium">
            Manage photos{totalCount > preview.length ? ` (${totalCount})` : ''}
          </span>
        </Link>
      : onViewAll ?
        <button
          type="button"
          onClick={onViewAll}
          className={cn(
            TILE_CLASS,
            'flex flex-col items-center justify-center gap-1.5 border-dashed bg-dc-surface-muted text-dc-text-muted transition hover:border-dc-accent-border hover:text-dc-text focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent',
          )}
          aria-label={`View all photos${totalCount > 0 ? `, ${totalCount} total` : ''}`}
        >
          <IconCamera className="h-5 w-5" />
          <span className="text-xs font-medium">
            View all{totalCount > preview.length ? ` (${totalCount})` : ''}
          </span>
        </button>
      : null}
    </div>
  )
}
