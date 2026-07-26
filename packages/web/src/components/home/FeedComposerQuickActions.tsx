import { useState } from 'react'
import { Link } from 'react-router-dom'

type Action = {
  id: string
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  title?: string
}

function ActionIcon({ id }: { id: string }) {
  const cls = 'h-[18px] w-[18px]'
  switch (id) {
    case 'photo':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'video':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    case 'article':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'event':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    default:
      return null
  }
}

type Props = {
  onPhoto?: () => void
  onVideo?: () => void
  variant?: 'full' | 'home-desktop' | 'home-mobile'
}

function withComposerCallbacks(actions: Action[], onPhoto?: () => void, onVideo?: () => void): Action[] {
  return actions.map((action) => {
    if (action.id === 'photo' && onPhoto) return { ...action, href: undefined, onClick: onPhoto }
    if (action.id === 'video' && onVideo) return { ...action, href: undefined, onClick: onVideo }
    return action
  })
}

export default function FeedComposerQuickActions({ variant = 'full', onPhoto, onVideo }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)

  const fullActions: Action[] = [
    { id: 'photo', label: 'Photo', href: '/create?tab=picture' },
    { id: 'video', label: 'Video', href: '/create?tab=video' },
    { id: 'article', label: 'Article', href: '/education/write' },
    { id: 'event', label: 'Event', href: '/events?create=event' },
  ]

  const homeDesktopActions: Action[] = [
    { id: 'photo', label: 'Photo', href: '/create?tab=picture' },
    { id: 'article', label: 'Article', href: '/education/write' },
    { id: 'event', label: 'Event', href: '/events?create=event' },
  ]

  const homeMobileActions: Action[] = [
    { id: 'photo', label: 'Photo', href: '/create?tab=picture' },
    { id: 'article', label: 'Article', href: '/education/write' },
    { id: 'event', label: 'Event', href: '/events?create=event' },
  ]

  const actions = withComposerCallbacks(
    variant === 'home-mobile' ? homeMobileActions
    : variant === 'home-desktop' ? homeDesktopActions
    : fullActions,
    onPhoto,
    onVideo,
  )

  const chipClass =
    'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-dc-text-muted transition-colors hover:bg-dc-elevated-hover hover:text-dc-text disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${variant === 'full' ? 'justify-between border-t border-dc-border pt-3' : ''}`}
    >
      {actions.map((action) => {
        const inner = (
          <>
            <ActionIcon id={action.id} />
            <span>{action.label}</span>
          </>
        )

        if (action.href && !action.disabled) {
          return (
            <Link key={action.id} to={action.href} className={chipClass}>
              {inner}
            </Link>
          )
        }

        return (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            title={action.title}
            onClick={action.onClick}
            className={chipClass}
          >
            {inner}
          </button>
        )
      })}
      {variant === 'home-mobile' ?
        <div className="relative">
          <button
            type="button"
            className={chipClass}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            + More
          </button>
          {moreOpen ?
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[8rem] rounded-lg border border-dc-border bg-dc-elevated-solid py-1 shadow-[var(--dc-shadow-panel)]">
              <Link
                role="menuitem"
                to="/create?tab=video"
                onClick={() => setMoreOpen(false)}
                className="block w-full px-3 py-2 text-left text-xs text-dc-text hover:bg-dc-elevated-muted"
              >
                Video
              </Link>
            </div>
          : null}
        </div>
      : null}
    </div>
  )
}
