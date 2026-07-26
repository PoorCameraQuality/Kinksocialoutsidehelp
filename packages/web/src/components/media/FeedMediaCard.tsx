import { Link } from 'react-router-dom'
import type { FeedAttachment } from '@c2k/shared'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { cn } from '@/lib/cn'

type Props = {
  attachment: FeedAttachment
  className?: string
  maxHeightClass?: string
}

export function feedAttachmentHeroUrl(attachment: FeedAttachment): string | null {
  if (attachment.type === 'image') return attachment.url
  if (attachment.type === 'media' && attachment.mediaKind === 'image') {
    return attachment.previewUrl ?? attachment.blurredPreviewUrl ?? null
  }
  if (attachment.type === 'video') return attachment.posterUrl ?? null
  return null
}

export default function FeedMediaCard({
  attachment,
  className,
  maxHeightClass = 'max-h-64',
}: Props) {
  if (attachment.type === 'image') {
    return (
      <img
        src={attachment.url}
        alt=""
        className={cn('rounded-xl border border-dc-border object-cover', maxHeightClass, className)}
      />
    )
  }

  if (attachment.type === 'audio') {
    return <audio controls src={attachment.url} className={cn('w-full max-w-md', className)} />
  }

  if (attachment.type === 'video') {
    return (
      <video
        controls
        poster={attachment.posterUrl ?? undefined}
        src={attachment.url}
        className={cn('w-full rounded-xl border border-dc-border', maxHeightClass, className)}
      />
    )
  }

  if (attachment.type === 'media' && attachment.mediaKind === 'audio') {
    const src = mediaDisplayUrl(attachment.previewUrl)
    if (!src) {
      return (
        <div
          className={cn(
            'flex min-h-[48px] items-center rounded-xl border border-dc-border bg-dc-elevated-muted px-3 text-xs text-dc-muted',
            className,
          )}
        >
          Audio
        </div>
      )
    }
    return <audio controls src={src} className={cn('w-full max-w-md', className)} />
  }

  if (attachment.type === 'media') {
    const preview = mediaDisplayUrl(
      attachment.isBlurredByDefault && attachment.blurredPreviewUrl ?
        attachment.blurredPreviewUrl
      : attachment.previewUrl ?? attachment.blurredPreviewUrl,
    )
    const blurred = attachment.isBlurredByDefault && Boolean(attachment.blurredPreviewUrl)

    return (
      <Link
        to={`/media/item/${attachment.mediaItemId}`}
        className={cn('relative block overflow-hidden rounded-xl border border-dc-border', maxHeightClass, className)}
      >
        {preview ?
          <img
            src={preview}
            alt=""
            className={cn('h-full w-full object-cover', blurred ? 'scale-105 blur-md' : '')}
          />
        : <div className="flex min-h-[120px] items-center justify-center bg-dc-elevated-muted text-xs text-dc-muted">
            Media
          </div>}
        {attachment.mediaKind === 'video' ?
          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
            Video
          </span>
        : null}
        {blurred ?
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-xs font-medium text-white">
            Tap to view
          </span>
        : null}
      </Link>
    )
  }

  return null
}

export function renderFeedAttachments(
  attachments: FeedAttachment[],
  opts?: { maxHeightClass?: string; className?: string },
) {
  if (!attachments.length) return null
  return (
    <div className={cn('flex flex-wrap gap-2', opts?.className)}>
      {attachments.map((attachment, index) => (
        <FeedMediaCard
          key={
            attachment.type === 'media' ? attachment.mediaItemId
            : attachment.type === 'video' ? `${attachment.url}-${index}`
            : attachment.url
          }
          attachment={attachment}
          maxHeightClass={opts?.maxHeightClass}
        />
      ))}
    </div>
  )
}
