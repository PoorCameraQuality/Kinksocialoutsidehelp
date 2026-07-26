import { useEffect, useRef, useState } from 'react'

export type InboxFilter = 'all' | 'unread' | 'friends' | 'followers' | 'following' | 'favorites'

type Props = {
  inboxFilter: InboxFilter
  inboxSort: 'newest' | 'oldest'
  onFilterChange: (filter: InboxFilter) => void
  onSortChange: (sort: 'newest' | 'oldest') => void
  showAdvanced: boolean
}

export default function MessagingInboxFilters({
  inboxFilter,
  inboxSort,
  onFilterChange,
  onSortChange,
  showAdvanced,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  if (!showAdvanced) return null

  const advancedActive = inboxFilter !== 'all' && inboxFilter !== 'unread'

  return (
    <div className="mt-2 space-y-2 sm:mt-3">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label="Inbox filters">
        {(['all', 'unread'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
            className={`min-h-9 rounded-xl px-2.5 text-xs font-medium sm:min-h-11 sm:px-3 sm:text-sm ${
              inboxFilter === id ?
                'bg-dc-accent-muted text-dc-accent'
              : 'bg-dc-surface-muted text-dc-text-muted hover:text-dc-text'
            }`}
          >
            {id === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`inline-flex min-h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-medium sm:min-h-11 sm:px-3 sm:text-sm ${
              advancedActive || moreOpen ?
                'border-dc-accent-border bg-dc-accent-muted/40 text-dc-accent'
              : 'border-dc-border text-dc-text-muted hover:text-dc-text'
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            More filters
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {moreOpen ?
            <div
              role="menu"
              className="absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-soft)]"
            >
              {(
                [
                  ['friends', 'Friends'],
                  ['followers', 'Followers'],
                  ['following', 'Following'],
                  ['favorites', 'Favorites'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onFilterChange(id)
                    setMoreOpen(false)
                  }}
                  className={`block w-full min-h-11 px-3 py-2 text-left text-sm ${
                    inboxFilter === id ? 'bg-dc-accent-muted text-dc-accent' : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="my-1 border-t border-dc-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSortChange(inboxSort === 'newest' ? 'oldest' : 'newest')
                  setMoreOpen(false)
                }}
                className="block w-full min-h-11 px-3 py-2 text-left text-sm text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text"
              >
                Sort: {inboxSort === 'newest' ? 'Newest' : 'Oldest'}
              </button>
            </div>
          : null}
        </div>
      </div>
    </div>
  )
}
