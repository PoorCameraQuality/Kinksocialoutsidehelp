import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MockNotification } from '@/data/mock-data'
import UserAvatar from '@/components/UserAvatar'
import PersonalUtilityPageShell from '@/components/layout/PersonalUtilityPageShell'
import NotificationsEmptyPanel from '@/components/notifications/NotificationsEmptyPanel'
import { PresetEmptyState } from '@/components/ui/empty-state-presets'
import { ListRowSkeleton } from '@/components/ui/skeleton'
import NotificationsSafetyFooter from '@/components/notifications/NotificationsSafetyFooter'
import {
  kindLabel,
  localDayKeyFromIso,
  notificationActionLabel,
  notificationDayHeading,
} from '@/lib/notifications-display'
import { useNotificationsList } from '@/hooks/useNotificationsList'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { NOTIFICATIONS_PAGE_INTRO } from '@/lib/notifications-copy'

type InboxFilter = 'all' | 'unread'

function buildNotificationDayGroups(items: MockNotification[]): { heading: string; dayKey: string; items: MockNotification[] }[] {
  const withIso = items.filter((i) => i.createdAtIso)
  const without = items.filter((i) => !i.createdAtIso)
  withIso.sort((a, b) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? ''))
  const dayOrder: string[] = []
  const byDay = new Map<string, MockNotification[]>()
  for (const n of withIso) {
    const key = localDayKeyFromIso(n.createdAtIso!)
    if (!byDay.has(key)) {
      byDay.set(key, [])
      dayOrder.push(key)
    }
    byDay.get(key)!.push(n)
  }
  const groups = dayOrder.map((dayKey) => ({
    heading: notificationDayHeading(dayKey),
    dayKey,
    items: byDay.get(dayKey)!,
  }))
  if (without.length > 0) {
    groups.push({ heading: 'Earlier', dayKey: '_other', items: without })
  }
  return groups
}

function NotificationKindFallback({ kind }: { kind: MockNotification['kind'] }) {
  const label = kind === 'event' ? 'E' : kind === 'group' ? 'G' : kind === 'mention' ? 'M' : kind === 'rsvp' ? 'R' : '•'
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dc-elevated-muted text-xs font-semibold uppercase text-dc-muted"
      aria-hidden
    >
      {label}
    </span>
  )
}

function NotificationRow({
  n,
  onMarkRead,
}: {
  n: MockNotification
  onMarkRead: (id: string) => void
}) {
  const actionLabel = notificationActionLabel(n)

  const inner = (
    <div
      className={`flex gap-2.5 rounded-xl border px-2.5 py-2.5 transition-colors sm:gap-3 sm:px-3 sm:py-3 ${
        n.read ?
          'border-dc-border bg-dc-elevated-solid/80'
        : 'border-dc-accent-border/30 border-l-2 border-l-dc-accent bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]'
      }`}
    >
      <div className="shrink-0 pt-0.5">
        {n.actorUsername ?
          <UserAvatar
            avatarUrl={n.actorAvatarUrl}
            alt=""
            size="sm"
            className="!h-9 !w-9 !min-h-9 !min-w-9 [&>svg]:!h-4 [&>svg]:!w-4"
          />
        : <NotificationKindFallback kind={n.kind} />}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted sm:text-[11px]">
            {kindLabel(n.kind, n.title)}
          </span>
          <span className="text-[11px] text-dc-muted">{n.timeAgo}</span>
          {!n.read ?
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-dc-accent" aria-hidden />
          : null}
        </div>
        <p className="text-sm font-medium leading-snug text-dc-text">{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-dc-text-muted sm:text-sm">{n.body}</p>
        {n.href && actionLabel ?
          <span className="mt-1.5 inline-flex min-h-9 items-center text-xs font-semibold text-dc-accent sm:text-sm">
            {actionLabel}
          </span>
        : null}
      </div>
    </div>
  )

  if (n.href) {
    return (
      <li key={n.id}>
        <Link
          to={n.href}
          onClick={() => void onMarkRead(n.id)}
          className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
        >
          {inner}
        </Link>
      </li>
    )
  }

  return (
    <li key={n.id}>
      <button
        type="button"
        onClick={() => void onMarkRead(n.id)}
        className="w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        {inner}
      </button>
    </li>
  )
}

export default function NotificationsPageClient() {
  const { isAuthenticated, isFallback } = useAuth()
  const { items, unreadCount, loadError, loading, syncUnavailable, load, dismissLoadError, markRead, markAllRead } =
    useNotificationsList()
  const [filter, setFilter] = useState<InboxFilter>('all')

  const filteredItems = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.read)
    return items
  }, [items, filter])

  const canGroupByDay = useMemo(() => filteredItems.some((n) => n.createdAtIso), [filteredItems])

  const dayGroups = useMemo(
    () => (canGroupByDay ? buildNotificationDayGroups(filteredItems) : []),
    [filteredItems, canGroupByDay],
  )

  const allCaughtUp = !loading && unreadCount === 0 && (items.length === 0 || filter === 'all')

  return (
    <PersonalUtilityPageShell>
      <div className="mx-auto w-full max-w-[52rem] pb-2">
      <header className="mb-5 sm:mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">Notifications</h1>
            <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">{NOTIFICATIONS_PAGE_INTRO}</p>
            {allCaughtUp && (isAuthenticated || isFallback) ?
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-400/90" role="status">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All caught up.
              </p>
            : unreadCount > 0 ?
              <p className="mt-2 text-sm font-medium text-dc-accent">{unreadCount} unread</p>
            : loading ?
              <p className="mt-2 text-sm text-dc-muted" role="status">
                Loading…
              </p>
            : null}
          </div>
          {unreadCount > 0 && !loading ?
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex min-h-9 shrink-0 items-center self-start rounded-lg border border-dc-border bg-dc-elevated-solid px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text sm:min-h-11 sm:rounded-xl sm:px-4 sm:text-sm"
            >
              Mark all read
            </button>
          : null}
        </div>

        {!isAuthenticated || isFallback ?
          <Link
            to={buildLoginHref('/notifications')}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Sign in for live notifications
          </Link>
        : null}
      </header>

      <div
        className="sticky z-10 -mx-4 mb-5 flex gap-1 border-b border-dc-border bg-dc-surface-muted/95 px-4 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:backdrop-blur-none"
        style={{ top: 'var(--c2k-sticky-below-header)' }}
        role="tablist"
        aria-label="Notification filter"
      >
        {(['all', 'unread'] as const).map((tab) => {
          const active = filter === tab
          const label = tab === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab)}
              className={`min-h-11 px-4 text-sm font-medium transition-colors sm:min-h-10 sm:rounded-none sm:rounded-t-lg ${
                active ?
                  'rounded-xl bg-dc-accent text-dc-accent-foreground sm:border-b-2 sm:border-dc-accent sm:bg-transparent sm:text-dc-accent'
                : 'rounded-xl bg-dc-elevated-solid text-dc-text-muted hover:text-dc-text sm:bg-transparent sm:text-dc-text-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {loadError ?
        <div
          className="mb-4 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => dismissLoadError()}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}

      {loading && items.length === 0 ?
        <ListRowSkeleton count={3} />
      : items.length === 0 ?
        syncUnavailable ?
          <div className="space-y-4">
            <NotificationsEmptyPanel
              title="Notifications unavailable"
              message="We could not load your notifications. Check your connection and try again."
            />
            <div className="text-center">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Retry
              </button>
            </div>
          </div>
        : <PresetEmptyState preset="noNotifications" variant="surface" />
      : filteredItems.length === 0 ?
        <NotificationsEmptyPanel
          title="No unread notifications"
          message="You're all caught up. Review older alerts in All."
        />
      : canGroupByDay ?
        <div className="space-y-8">
          {dayGroups.map((group) => (
            <section key={group.dayKey} aria-labelledby={`notif-day-${group.dayKey}`}>
              <h2 id={`notif-day-${group.dayKey}`} className="mb-3 text-xs font-semibold uppercase tracking-wide text-dc-muted">
                {group.heading}
              </h2>
              <ul className="space-y-2" aria-label={`Notifications · ${group.heading}`}>
                {group.items.map((n) => (
                  <NotificationRow key={n.id} n={n} onMarkRead={markRead} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      : <ul className="space-y-2" aria-label="Notification list">
          {filteredItems.map((n) => (
            <NotificationRow key={n.id} n={n} onMarkRead={markRead} />
          ))}
        </ul>
      }

      {filter === 'unread' && filteredItems.length === 0 && items.length > 0 ?
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="text-sm font-medium text-dc-accent hover:underline"
          >
            Show all notifications
          </button>
        </div>
      : null}

      <NotificationsSafetyFooter className="mt-6 sm:mt-8" />
      </div>
    </PersonalUtilityPageShell>
  )
}
