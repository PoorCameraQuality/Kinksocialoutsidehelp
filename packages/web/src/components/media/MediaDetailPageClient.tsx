import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ADULT_CONTENT_PREFERENCES,
  type MediaContentRating,
} from '@c2k/shared'
import MediaCommentThread from '@/components/media/MediaCommentThread'
import MediaReactionBar from '@/components/media/MediaReactionBar'
import ReportAction from '@/components/moderation/ReportAction'
import UserAvatar from '@/components/UserAvatar'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import StatusBanner from '@/components/ui/StatusBanner'
import { DetailPageSkeleton } from '@/components/ui/skeleton/C2kSkeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useApiMediaItemDetail, setMediaItemAsAvatar } from '@/hooks/useApiMedia'
import { useAdultContentPreference } from '@/hooks/useAdultContentPreference'
import { cardSurfaceSolidClass } from '@/lib/card-surface'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { shouldBlurMediaForViewer } from '@/lib/media-visibility'

type Props = {
  mediaItemId: string
}

export default function MediaDetailPageClient({ mediaItemId }: Props) {
  const { isAuthenticated, isFallback } = useAuth()
  const adultPref = useAdultContentPreference(isAuthenticated && !isFallback)
  const { detail, status, error } = useApiMediaItemDetail(mediaItemId)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <DetailPageSkeleton />
      </div>
    )
  }

  if (status === 'error' || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <LoadErrorBanner message={error ?? 'Media not found'} />
      </div>
    )
  }

  const { item, owner, tags } = detail
  const blurred = shouldBlurMediaForViewer(
    {
      authenticated: isAuthenticated && !isFallback,
      adultContentPref: adultPref.preference ?? ADULT_CONTENT_PREFERENCES.blur,
    },
    {
      contentRating: (item.contentRating as MediaContentRating | null) ?? null,
      visibility: item.visibility,
      uploadStatus: null,
      isBlurredByDefault: item.isBlurredByDefault,
    },
  )
  const preview = mediaDisplayUrl(
    blurred && item.blurredPreviewUrl ? item.blurredPreviewUrl : item.previewUrl ?? item.blurredPreviewUrl,
  )

  const useAsAvatar = async () => {
    setAvatarBusy(true)
    setBanner(null)
    try {
      const ok = await setMediaItemAsAvatar(item.id)
      setBanner(ok ? 'Profile photo updated.' : 'Could not set profile photo.')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <Link to={`/profile/${encodeURIComponent(owner.username)}`} className="flex items-center gap-2">
          {owner.avatarUrl ?
            <img src={owner.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          : <UserAvatar size="sm" />}
          <span className="text-sm font-medium text-dc-text">
            {owner.displayName ?? owner.username}
          </span>
        </Link>
        <span className="text-xs text-dc-muted">
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </header>

      {banner ?
        <StatusBanner tone="success">{banner}</StatusBanner>
      : null}

      <div className={`${cardSurfaceSolidClass} overflow-hidden`}>
        <div className="relative bg-dc-elevated-solid">
          {item.mediaKind === 'video' && preview && !blurred ?
            <video src={preview} controls className="max-h-[70vh] w-full object-contain" />
          : preview ?
            <img
              src={preview}
              alt={item.caption ?? ''}
              className={`max-h-[70vh] w-full object-contain ${blurred ? 'blur-lg scale-105' : ''}`}
            />
          : <div className="flex min-h-[240px] items-center justify-center text-sm text-dc-muted">No preview</div>}
          {blurred ?
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-medium text-white">
              Adult content — adjust your privacy settings to show
            </div>
          : null}
        </div>
        <div className="space-y-4 p-5">
          {item.caption ?
            <p className="text-base text-dc-text whitespace-pre-wrap">{item.caption}</p>
          : null}
          {tags.length > 0 ?
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-md bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-accent">
                  #{tag}
                </span>
              ))}
            </div>
          : null}
          <MediaReactionBar
            mediaItemId={item.id}
            reactionCounts={detail.reactionCounts}
            viewerReaction={detail.viewerReaction}
          />
          <div className="flex flex-wrap gap-2">
            {detail.canUseAsAvatar ?
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => void useAsAvatar()}
                className="rounded-lg border border-dc-border px-3 py-2 text-sm text-dc-text-muted hover:border-dc-accent-border disabled:opacity-50"
              >
                {avatarBusy ? 'Updating…' : 'Use as profile photo'}
              </button>
            : null}
            {detail.canReport ?
              <ReportAction
                targetType="media_asset"
                targetId={item.id}
                targetLabel={`media by @${owner.username}`}
              />
            : null}
          </div>
        </div>
      </div>

      <div className={`${cardSurfaceSolidClass} p-5`}>
        <MediaCommentThread
          mediaItemId={item.id}
          canComment={detail.canComment}
          initialCount={detail.commentCount}
        />
      </div>
    </article>
  )
}
