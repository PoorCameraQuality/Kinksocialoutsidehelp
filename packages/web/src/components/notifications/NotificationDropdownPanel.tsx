import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { MockNotification } from '@/data/types'
import { kindLabel, notificationActionLabel } from '@/lib/notifications-display'
import { cn } from '@/lib/cn'

type Props = {
  items: MockNotification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClose: () => void
  className?: string
  mobileSheet?: boolean
}

type KindVisual = {
  chipClass: string
  iconWrapClass: string
  icon: ReactNode
}

function notificationKindVisual(kind: MockNotification['kind']): KindVisual {
  switch (kind) {
    case 'event':
      return {
        chipClass: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
        iconWrapClass: 'border-sky-400/25 bg-sky-500/15 text-sky-300',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        ),
      }
    case 'group':
      return {
        chipClass: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
        iconWrapClass: 'border-violet-400/25 bg-violet-500/15 text-violet-300',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ),
      }
    case 'mention':
      return {
        chipClass: 'border-dc-accent-border/40 bg-dc-accent-muted/30 text-dc-accent',
        iconWrapClass: 'border-dc-accent-border/40 bg-dc-accent-muted/40 text-dc-accent',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        ),
      }
    case 'rsvp':
      return {
        chipClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
        iconWrapClass: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-300',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
          </svg>
        ),
      }
    default:
      return {
        chipClass: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
        iconWrapClass: 'border-amber-400/25 bg-amber-500/15 text-amber-200',
        icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        ),
      }
  }
}

function DropdownNotificationRow({
  n,
  onMarkRead,
  onClose,
}: {
  n: MockNotification
  onMarkRead: () => void
  onClose: () => void
}) {
  const visual = notificationKindVisual(n.kind)
  const actionLabel = notificationActionLabel(n)

  const row = (
    <div
      className={cn(
        'group relative flex gap-3 rounded-xl border p-2.5 transition-all',
        n.read ?
          'border-transparent bg-transparent hover:border-dc-border/60 hover:bg-dc-elevated-hover/70'
        : 'border-dc-accent-border/25 bg-dc-accent-muted/10 shadow-[inset_3px_0_0_0_var(--dc-accent)] hover:bg-dc-accent-muted/20',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
          visual.iconWrapClass,
        )}
      >
        {visual.icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-sm font-semibold text-dc-text">{n.title}</p>
          <span className="shrink-0 text-[11px] tabular-nums text-dc-muted">{n.timeAgo}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-dc-text-muted">{n.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              visual.chipClass,
            )}
          >
            {kindLabel(n.kind, n.title)}
          </span>
          {n.href && actionLabel ?
            <span className="text-[11px] font-medium text-dc-accent">{actionLabel}</span>
          : null}
        </div>
      </div>
      {!n.read ?
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-dc-accent" aria-hidden />
      : null}
    </div>
  )

  if (n.href) {
    return (
      <li>
        <Link
          to={n.href}
          className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
          onClick={() => {
            onMarkRead()
            onClose()
          }}
        >
          {row}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        className="w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
        onClick={onMarkRead}
      >
        {row}
      </button>
    </li>
  )
}

export default function NotificationDropdownPanel({
  items,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
  className,
  mobileSheet = false,
}: Props) {
  const preview = items.slice(0, 6)

  return (
    <div
      className={cn(
        'overflow-hidden border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-panel)] ring-1 ring-white/[0.04]',
        mobileSheet ?
          'rounded-t-2xl border-b-0 pb-[calc(var(--c2k-bottom-nav-total-h)+0.75rem)]'
        : 'rounded-2xl',
        className,
      )}
    >
      {mobileSheet ?
        <div className="mx-auto mb-1 mt-2 h-1 w-10 shrink-0 rounded-full bg-dc-border/80 md:hidden" aria-hidden />
      : null}

      <div className="border-b border-dc-border/70 bg-gradient-to-b from-dc-accent/[0.07] via-dc-elevated-solid to-dc-elevated-solid px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dc-accent-border/40 bg-dc-accent-muted/35 text-dc-accent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-dc-text">Notifications</h2>
              <p className="text-xs text-dc-text-muted">
                {unreadCount > 0 ?
                  `${unreadCount} unread · tap to open`
                : preview.length > 0 ?
                  "You're caught up"
                : 'Nothing new right now'}
              </p>
            </div>
          </div>
          {unreadCount > 0 ?
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-dc-accent transition-colors hover:bg-dc-accent-muted/30"
            >
              Mark all read
            </button>
          : null}
        </div>
      </div>

      {preview.length === 0 ?
        <div className="px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-dc-border bg-dc-elevated-muted/50 text-dc-muted">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-dc-text">No notifications yet</p>
          <p className="mt-1 text-xs text-dc-text-muted">RSVPs, messages, and org updates will appear here.</p>
        </div>
      : <ul className="max-h-[min(50dvh,18rem)] space-y-1 overflow-y-auto p-2 md:max-h-72">
          {preview.map((n) => (
            <DropdownNotificationRow
              key={n.id}
              n={n}
              onMarkRead={() => void onMarkRead(n.id)}
              onClose={onClose}
            />
          ))}
        </ul>
      }

      <div className="border-t border-dc-border/70 bg-dc-elevated-muted/25 px-3 py-2.5">
        <Link
          to="/notifications"
          onClick={onClose}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dc-accent-border/50 bg-dc-accent-muted/20 text-sm font-semibold text-dc-accent transition-colors hover:bg-dc-accent-muted/35"
        >
          View all notifications
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  )
}
