import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '@/components/UserAvatar'

type Props = {
  username: string
  avatarUrl?: string | null
  verb: string
  timeLabel: string
  href?: string
  children?: ReactNode
  linkLabel?: string
}

export default function FeedActivityRow({
  username,
  avatarUrl,
  verb,
  timeLabel,
  href,
  children,
  linkLabel,
}: Props) {
  return (
    <article className="feed-activity-row">
      <Link
        to={`/profile/${encodeURIComponent(username)}`}
        className="feed-activity-row__avatar"
        aria-hidden
        tabIndex={-1}
      >
        <UserAvatar avatarUrl={avatarUrl} alt="" size="sm" className="!h-full !w-full !min-h-0 !min-w-0" />
      </Link>
      <div className="feed-activity-row__main">
        <p className="feed-activity-row__head">
          <Link to={`/profile/${encodeURIComponent(username)}`} className="feed-activity-row__user">
            @{username}
          </Link>
          <span className="feed-activity-row__verb">{verb}</span>
          {timeLabel ?
            <time className="feed-activity-row__time" dateTime={timeLabel}>
              {timeLabel}
            </time>
          : null}
        </p>
        {children ? <div className="feed-activity-row__body">{children}</div> : null}
        {href && linkLabel ?
          <Link to={href} className="feed-activity-row__link">
            {linkLabel} →
          </Link>
        : null}
      </div>
    </article>
  )
}
