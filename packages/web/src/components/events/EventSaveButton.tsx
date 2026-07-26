import { BOOKMARK_OBJECT_EVENT, useApiBookmarks } from '@/hooks/useApiBookmarks'
import { useAuth } from '@/contexts/AuthContext'

type Props = {
  eventId: string | number
  className?: string
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export default function EventSaveButton({ eventId, className = '', size = 'md', showLabel = false }: Props) {
  const { isAuthenticated, isFallback } = useAuth()
  const enabled = isAuthenticated && !isFallback
  const bookmarks = useApiBookmarks(enabled)
  const id = String(eventId)
  const saved = enabled && bookmarks.isBookmarked(BOOKMARK_OBJECT_EVENT, id)
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const padClass = size === 'sm' ? 'p-1.5' : 'p-2'

  if (!enabled) return null

  return (
    <button
      type="button"
      disabled={bookmarks.bookmarkBusy}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void bookmarks.toggleBookmark(BOOKMARK_OBJECT_EVENT, id)
      }}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg text-dc-muted transition-colors hover:bg-dc-elevated-hover hover:text-dc-accent disabled:opacity-50 ${showLabel ? 'min-h-11 px-4' : padClass} ${saved ? 'text-dc-accent' : ''} ${className}`}
      aria-label={saved ? 'Remove saved event' : 'Save event'}
      aria-pressed={saved}
      title={saved ? 'Saved' : 'Save event'}
    >
      <svg className={iconClass} fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      {showLabel ?
        <span className="text-sm font-medium">{saved ? 'Saved' : 'Save'}</span>
      : null}
    </button>
  )
}
