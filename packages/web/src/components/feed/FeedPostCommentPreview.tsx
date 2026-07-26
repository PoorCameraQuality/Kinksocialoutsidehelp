import { Link } from 'react-router-dom'
import UserAvatar from '@/components/UserAvatar'
import { shortTime } from '@/lib/format-time'
import { formatFeedCommentPreviewLinkLabel } from '@/lib/feed-comment-label'
import type { FeedPostCommentPreview } from '@/lib/feed-types'

type Props = {
  preview?: FeedPostCommentPreview | null
  commentCount: number
  discussHref?: string
}

export default function FeedPostCommentPreview({ preview, commentCount, discussHref }: Props) {
  if (commentCount <= 0) return null

  const linkLabel = formatFeedCommentPreviewLinkLabel(commentCount)

  if (!preview) {
    if (!discussHref || !linkLabel) return null
    return (
      <Link to={discussHref} className="feed-comment-preview feed-comment-preview--count-only">
        {linkLabel}
      </Link>
    )
  }

  const authorLabel = preview.authorUsername ? `@${preview.authorUsername}` : preview.authorDisplayName
  const timeLabel = preview.createdAt ? shortTime(preview.createdAt) : null

  const inner = (
    <>
      <div className="feed-comment-preview__row">
        <UserAvatar
          avatarUrl={preview.authorAvatarUrl}
          alt=""
          size="sm"
          className="feed-comment-preview__avatar !h-5 !w-5 !min-h-5 !min-w-5 [&>svg]:!h-2.5 [&>svg]:!w-2.5"
        />
        <div className="feed-comment-preview__content min-w-0">
          <p className="feed-comment-preview__meta">
            <span className="font-medium text-dc-text">{authorLabel}</span>
            {timeLabel ?
              <span className="text-dc-muted"> · {timeLabel}</span>
            : null}
          </p>
          <p className="feed-comment-preview__body">{preview.bodyPreview}</p>
        </div>
      </div>
      {discussHref && linkLabel && commentCount > 1 ?
        <span className="feed-comment-preview__more">{linkLabel}</span>
      : null}
    </>
  )

  if (discussHref) {
    return (
      <Link to={discussHref} className="feed-comment-preview">
        {inner}
      </Link>
    )
  }

  return <div className="feed-comment-preview">{inner}</div>
}
