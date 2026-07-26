import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  username: string
  verb: string
  timeLabel: string
  href?: string
  linkLabel?: string
  partnerUsername?: string | null
  children?: ReactNode
}

/** Compact connection / follow / graph activity row. */
export default function FeedConnectionActivityCard({
  username,
  verb,
  timeLabel,
  href,
  linkLabel,
  partnerUsername,
  children,
}: Props) {
  return (
    <article className="feed-activity-row feed-activity-row--connection">
      <div className="feed-activity-row__avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dc-accent/20 text-sm font-semibold uppercase text-dc-accent">
        {username.charAt(0)}
      </div>
      <div className="feed-activity-row__main">
        <p className="feed-activity-row__head">
          <Link to={`/profile/${encodeURIComponent(username)}`} className="feed-activity-row__user">
            @{username}
          </Link>
          <span className="feed-activity-row__verb">{verb}</span>
          {partnerUsername ?
            <Link
              to={`/profile/${encodeURIComponent(partnerUsername)}`}
              className="feed-activity-row__user"
            >
              @{partnerUsername}
            </Link>
          : null}
          {timeLabel ?
            <time className="feed-activity-row__time">{timeLabel}</time>
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
