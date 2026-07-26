import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FollowingFeedItem } from '@/lib/feed-types'
import {
  formatActorList,
  groupFollowingActivities,
  highlightActionPhrase,
  type HighlightCategory,
  type HighlightGroup,
} from '@/lib/following-feed-highlights'
import { formatFeedTimeShort } from '@/lib/following-feed-present'

type Props = {
  items: Extract<FollowingFeedItem, { kind: 'activity' }>[]
}

const INITIAL_VISIBLE = 4

function CategoryIcon({ category }: { category: HighlightCategory }) {
  const cls = 'h-3.5 w-3.5'
  switch (category) {
    case 'event':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth={1.6} />
          <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      )
    case 'convention':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 3.5h12v6a6 6 0 0 1-12 0v-6Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M12 15.5v3.5M8.5 20.5h7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      )
    case 'group':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth={1.6} />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 7a3 3 0 0 1 0 6M17 14.5a5.5 5.5 0 0 1 3.5 4.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      )
    case 'connection':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth={1.6} />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      )
    case 'reaction':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      )
    case 'comment':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4v-10Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      )
    case 'vendor':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 8.5 5.5 5h13L20 8.5M4 8.5h16M4 8.5v10.5h16V8.5M9 8.5c0 1.5-1 3-2.5 3M15 8.5c0 1.5 1 3 2.5 3M9 8.5a2.5 2.5 0 0 0 3 0 2.5 2.5 0 0 0 3 0" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      )
    case 'class':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4 3 8l9 4 9-4-9-4ZM6 10.5V15c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      )
    case 'organizer':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 19V8l7-4 7 4v11M9 19v-5h6v5" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.6} />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
        </svg>
      )
  }
}

function HighlightRow({ group }: { group: HighlightGroup }) {
  const lead = group.actors[0] ?? null
  const actorText = formatActorList(group.actors, group.totalActors)
  const action = highlightActionPhrase(group)
  const time = formatFeedTimeShort(group.createdAt)

  const body = (
    <>
      <span className="dc-net-highlight__icon" aria-hidden>
        <CategoryIcon category={group.category} />
      </span>
      <span className="dc-net-highlight__text">
        {lead ?
          <Link
            to={`/profile/${encodeURIComponent(lead)}`}
            className="dc-net-highlight__actor"
            onClick={(e) => e.stopPropagation()}
          >
            {actorText}
          </Link>
        : <span className="dc-net-highlight__actor">{actorText}</span>}{' '}
        <span className="dc-net-highlight__verb">{action}</span>
        {group.objectMeta ?
          <span className="dc-net-highlight__meta"> · {group.objectMeta}</span>
        : null}
      </span>
      {time ?
        <time className="dc-net-highlight__time">{time}</time>
      : null}
    </>
  )

  if (group.deepLink) {
    return (
      <Link to={group.deepLink} className="dc-net-highlight dc-net-highlight--link">
        {body}
      </Link>
    )
  }
  return <div className="dc-net-highlight">{body}</div>
}

export default function FollowingNetworkHighlights({ items }: Props) {
  const groups = useMemo(() => groupFollowingActivities(items), [items])
  const [expanded, setExpanded] = useState(false)

  if (groups.length === 0) return null

  const visible = expanded ? groups : groups.slice(0, INITIAL_VISIBLE)
  const hiddenCount = groups.length - visible.length

  return (
    <section className="dc-net-highlights dc-panel-enter" aria-label="Network highlights">
      <header className="dc-net-highlights__head">
        <h2 className="dc-net-highlights__title">Network highlights</h2>
        <span className="dc-net-highlights__sub">From people you follow</span>
      </header>
      <div className="dc-net-highlights__list">
        {visible.map((group) => (
          <HighlightRow key={group.key} group={group} />
        ))}
      </div>
      {hiddenCount > 0 && !expanded ?
        <button type="button" className="dc-net-highlights__more" onClick={() => setExpanded(true)}>
          Show {hiddenCount} more
        </button>
      : groups.length > INITIAL_VISIBLE && expanded ?
        <button type="button" className="dc-net-highlights__more" onClick={() => setExpanded(false)}>
          Show less
        </button>
      : null}
    </section>
  )
}
