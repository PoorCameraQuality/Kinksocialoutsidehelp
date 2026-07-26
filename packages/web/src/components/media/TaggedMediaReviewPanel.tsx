import { useState } from 'react'
import { Link } from 'react-router-dom'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { ProfilePhotoGridSkeleton } from '@/components/ui/skeleton/C2kSkeleton'
import { respondToPeopleTag, useApiPendingPeopleTags } from '@/hooks/useApiMedia'
import { cardSurfaceSolidClass } from '@/lib/card-surface'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  enabled?: boolean
}

/** Pending people-tag requests where the signed-in member is tagged. */
export default function TaggedMediaReviewPanel({ enabled = true }: Props) {
  const { tags, status, error, reload, setTags } = useApiPendingPeopleTags(enabled)
  const [busyId, setBusyId] = useState<string | null>(null)

  const respond = async (tagId: string, decision: 'approved' | 'declined') => {
    if (busyId) return
    setBusyId(tagId)
    try {
      const ok = await respondToPeopleTag(tagId, decision)
      if (ok) setTags((prev) => prev.filter((tag) => tag.id !== tagId))
      else void reload()
    } finally {
      setBusyId(null)
    }
  }

  if (status === 'loading') {
    return <ProfilePhotoGridSkeleton count={2} />
  }

  if (status === 'error') {
    return <LoadErrorBanner message={error ?? 'Could not load tag requests'} onRetry={() => void reload()} />
  }

  if (tags.length === 0) return null

  return (
    <section
      className={`${cardSurfaceSolidClass} space-y-3 p-4`}
      aria-label="Pending tag requests"
      data-testid="people-tag-inbox"
    >
      <header>
        <h4 className="text-sm font-semibold text-dc-text">Tag requests</h4>
        <p className="mt-1 text-xs text-dc-text-muted">
          Approve or decline when someone tags you in their media.
        </p>
      </header>

      <ul className="space-y-3">
        {tags.map((tag) => {
          const name = tag.taggedBy.displayName?.trim() || tag.taggedBy.username
          const busy = busyId === tag.id
          return (
            <li
              key={tag.id}
              className="flex flex-col gap-3 rounded-xl border border-dc-border/70 bg-dc-elevated-muted/20 p-3 sm:flex-row sm:items-center"
              data-testid="people-tag-inbox-row"
            >
              <Link
                to={`/media/item/${tag.mediaItemId}`}
                className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-dc-elevated-solid sm:w-28"
              >
                {tag.mediaPreviewUrl ?
                  tag.mediaKind === 'video' ?
                    <video
                      src={mediaDisplayUrl(tag.mediaPreviewUrl)}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  : <img
                      src={mediaDisplayUrl(tag.mediaPreviewUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                : <div className="flex h-full min-h-[72px] items-center justify-center text-xs text-dc-muted">
                    Preview unavailable
                  </div>}
              </Link>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-dc-text">
                  <Link to={`/profile/${tag.taggedBy.username}`} className="font-medium text-dc-accent hover:underline">
                    {name}
                  </Link>{' '}
                  tagged you in {tag.mediaKind === 'video' ? 'a video' : 'a photo'}.
                </p>
                {tag.label ?
                  <p className="mt-1 text-xs text-dc-text-muted">Label: {tag.label}</p>
                : null}
                <p className="mt-1 text-xs text-dc-muted">
                  {new Date(tag.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                <button
                  type="button"
                  disabled={busy}
                  data-testid="people-tag-approve"
                  onClick={() => void respond(tag.id, 'approved')}
                  className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  data-testid="people-tag-decline"
                  onClick={() => void respond(tag.id, 'declined')}
                  className="rounded-lg border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-text-muted hover:bg-dc-elevated-muted disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
