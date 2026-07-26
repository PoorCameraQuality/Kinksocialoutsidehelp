import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RSVP_LABEL_INTERESTED } from '@c2k/shared'
import FeedActivityRow from '@/components/feed/FeedActivityRow'
import FeedConnectionActivityCard from '@/components/feed/FeedConnectionActivityCard'
import FeedMediaStrip from '@/components/feed/FeedMediaStrip'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import MediaSurfaceFallback from '@/components/ui/MediaSurfaceFallback'
import { useAuth } from '@/contexts/AuthContext'
import type { ApiEventListItem } from '@/lib/api-event-mapper'
import type { FollowingFeedItem } from '@/lib/feed-types'
import { cardSurfaceFeedActivityClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'
import {
  followingActivityVerbPhrase,
  followingFeedDeepLinkLabel,
  formatFeedTimeShort,
  isCompactFollowingActivity,
  resolveGroupThreadActivityDeepLink,
} from '@/lib/following-feed-present'

type Props = {
  item: Extract<FollowingFeedItem, { kind: 'activity' }>
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function eventTitleFromObject(object?: Record<string, unknown>): string | null {
  if (typeof object?.title === 'string' && object.title.trim()) return object.title.trim()
  if (typeof object?.eventTitle === 'string' && object.eventTitle.trim()) return object.eventTitle.trim()
  return null
}

function formatEventWhen(startsAt: string, endsAt?: string | null): string {
  const s = new Date(startsAt)
  if (Number.isNaN(s.getTime())) return startsAt
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  if (!endsAt) {
    return `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)}`
  }
  const e = new Date(endsAt)
  if (Number.isNaN(e.getTime())) {
    return `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)}`
  }
  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)} – ${e.toLocaleTimeString(undefined, timeOpts)}`
  }
  return `${s.toLocaleString(undefined, { ...dateOpts, ...timeOpts })} → ${e.toLocaleString(undefined, { ...dateOpts, ...timeOpts })}`
}

function formatActivityTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'Just now'
  if (h < 48) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

function formatDateBadge(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase()
}

function locationFromObject(object?: Record<string, unknown>): string | null {
  if (typeof object?.location === 'string' && object.location.trim()) return object.location.trim()
  if (typeof object?.publicLocationSummary === 'string' && object.publicLocationSummary.trim()) {
    return object.publicLocationSummary.trim()
  }
  if (typeof object?.city === 'string' && object.city.trim()) return object.city.trim()
  return null
}

function isEventStoryActivity(verb: string, object?: Record<string, unknown>): boolean {
  if (object?.type !== 'event') return false
  return verb === 'event_created' || verb === 'event_rsvp'
}

function verbLabel(verb: string, actorUsername: string, object?: Record<string, unknown>): string {
  const title = eventTitleFromObject(object)
  const slotTitle = typeof object?.slotTitle === 'string' ? object.slotTitle : null
  const orgName = typeof object?.orgName === 'string' ? object.orgName : null
  const groupName = typeof object?.groupName === 'string' ? object.groupName : null
  const conventionTitle = typeof object?.title === 'string' ? object.title : title
  switch (verb) {
    case 'connection_accepted':
      return `${actorUsername} accepted a connection`
    case 'event_created':
      return title ? `${actorUsername} posted ${title}` : `${actorUsername} posted a new event`
    case 'event_rsvp':
      return title ? `${actorUsername} is going to ${title}` : `${actorUsername} RSVP'd to an event`
    case 'presenter_assigned':
      return slotTitle ?
          `${actorUsername} is presenting ${slotTitle}`
        : `${actorUsername} was assigned to a program slot`
    case 'convention_pin':
      return conventionTitle ?
          `${actorUsername} pinned ${conventionTitle}`
        : `${actorUsername} pinned a convention`
    case 'org_join':
      return orgName ? `${actorUsername} joined ${orgName}` : `${actorUsername} joined an organization`
    case 'org_announcement':
      return orgName ?
          `${actorUsername} posted an announcement in ${orgName}`
        : `${actorUsername} posted an organization announcement`
    case 'group_join':
      return groupName ? `${actorUsername} joined ${groupName}` : `${actorUsername} joined a group`
    case 'group_thread_created': {
      const threadTitle = typeof object?.threadTitle === 'string' ? object.threadTitle.trim() : null
      if (groupName && threadTitle) {
        return `${actorUsername} started a discussion in ${groupName}: ${threadTitle}`
      }
      if (groupName) return `${actorUsername} started a discussion in ${groupName}`
      return `${actorUsername} started a group discussion`
    }
    case 'vendor_shop_live': {
      const shopName = typeof object?.displayName === 'string' ? object.displayName : null
      return shopName ? `${actorUsername} opened ${shopName}` : `${actorUsername} published their vendor shop`
    }
    default:
      return `${actorUsername} updated their activity`
  }
}

function verbBadgeLabel(verb: string): string {
  switch (verb) {
    case 'connection_accepted':
      return 'Connection'
    case 'event_created':
      return 'Event'
    case 'event_rsvp':
      return 'RSVP'
    case 'presenter_assigned':
      return 'Education'
    case 'convention_pin':
      return 'Convention'
    case 'org_join':
      return 'Organizer'
    case 'org_announcement':
      return 'Organizer announcement'
    case 'group_join':
      return 'Group discussion'
    case 'group_thread_created':
      return 'Group discussion'
    case 'vendor_shop_live':
      return 'Vendor'
    default:
      return 'Activity'
  }
}

function EventFeedStoryCard({ item }: Props) {
  const { isAuthenticated } = useAuth()
  const object = item.object
  const eventId = typeof object?.id === 'string' ? object.id : ''
  const metaTitle = eventTitleFromObject(object)
  const metaStartsAt = typeof object?.startsAt === 'string' ? object.startsAt : null
  const metaEndsAt = typeof object?.endsAt === 'string' ? object.endsAt : null
  const metaLocation = locationFromObject(object)
  const metaImageUrl = typeof object?.imageUrl === 'string' ? object.imageUrl : null
  const metaFormat = object?.eventFormat === 'virtual' ? 'virtual' : 'in-person'

  const [event, setEvent] = useState<ApiEventListItem | null>(null)
  const [rsvpKind, setRsvpKind] = useState<'going' | 'maybe' | 'waitlist' | null>(null)
  const [rsvpBusy, setRsvpBusy] = useState(false)
  const [rsvpMsg, setRsvpMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!UUID_RE.test(eventId)) {
      setEvent(null)
      setRsvpKind(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, { credentials: 'include' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { event?: ApiEventListItem }
        if (cancelled || !data.event) return
        setEvent(data.event)
        const vs = data.event.viewerRsvpStatus
        setRsvpKind(vs === 'going' || vs === 'maybe' || vs === 'waitlist' ? vs : null)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventId])

  const title = event?.title ?? metaTitle ?? 'Event'
  const startsAt = event?.startsAt ?? metaStartsAt
  const endsAt = event?.endsAt ?? metaEndsAt
  const isVirtual = (event?.eventFormat ?? metaFormat) === 'virtual'
  const location = useMemo(() => {
    if (isVirtual) return 'Online'
    if (event?.location?.trim()) return event.location.trim()
    if (event?.publicLocationSummary?.trim()) return event.publicLocationSummary.trim()
    if (event?.locationRedacted) return 'Location shared after RSVP'
    return metaLocation ?? 'TBA'
  }, [event, isVirtual, metaLocation])
  const whenLine = startsAt ? formatEventWhen(startsAt, endsAt) : null
  const dateBadge = startsAt ? formatDateBadge(startsAt) : null
  const heroSrc = event?.imageUrl ?? metaImageUrl ?? null
  const rsvpCount = event?.rsvpCount ?? 0
  const rsvpClosed = event?.rsvpOpen === false
  const copyPath = item.deepLink && item.deepLink !== '/home' ? item.deepLink : null
  const storyLine = verbLabel(item.verb, item.actor.username, object)

  const putRsvp = useCallback(
    async (status: 'going' | 'maybe' | 'not_going') => {
      if (!UUID_RE.test(eventId) || !isAuthenticated) return
      if (rsvpClosed && status !== 'not_going') {
        setRsvpMsg('RSVPs are closed for this event.')
        return
      }
      setRsvpBusy(true)
      setRsvpMsg(null)
      try {
        const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/rsvp`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const d = (await r.json()) as {
          error?: string
          rsvpCount?: number
          status?: string | null
        }
        if (!r.ok) {
          setRsvpMsg(d.error ?? 'Could not update RSVP')
          return
        }
        const st = d.status === 'going' || d.status === 'maybe' || d.status === 'waitlist' ? d.status : null
        setRsvpKind(st)
        setEvent((prev) =>
          prev ?
            {
              ...prev,
              rsvpCount: typeof d.rsvpCount === 'number' ? d.rsvpCount : prev.rsvpCount,
              viewerRsvpStatus: (d.status as ApiEventListItem['viewerRsvpStatus']) ?? null,
            }
          : prev,
        )
      } finally {
        setRsvpBusy(false)
      }
    },
    [eventId, isAuthenticated, rsvpClosed],
  )

  const isOrganizerVerb = item.verb === 'org_join' || item.verb === 'org_announcement' || item.verb === 'event_created'
  const activityLead =
    item.verb === 'event_created' ? 'Announced a new event'
    : item.verb === 'event_rsvp' ? 'is going to'
    : storyLine

  return (
    <Card padding="none" className={`relative overflow-hidden transition-colors hover:border-dc-accent/25 feed-stream-activity-card ${cardSurfaceFeedActivityClass}`}>
      {copyPath ?
        <CopyLinkOverflowMenu path={copyPath} className="absolute right-3 top-3 z-20" />
      : null}
      <article>
        <div className="border-b border-dc-border px-4 py-3">
          <div className="flex items-start gap-3">
            <Link
              to={`/profile/${item.actor.username}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dc-accent/25 text-sm font-semibold uppercase text-dc-accent"
              aria-hidden
            >
              {item.actor.username.charAt(0)}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/profile/${item.actor.username}`}
                  className="font-semibold text-dc-text hover:text-dc-accent focus:outline-none focus-visible:underline"
                >
                  {item.actor.username}
                </Link>
                {isOrganizerVerb ?
                  <span className="rounded-full bg-dc-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
                    Organizer
                  </span>
                : null}
                {item.createdAt ?
                  <span className="text-xs text-dc-muted">· {formatActivityTimeAgo(item.createdAt)}</span>
                : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{verbBadgeLabel(item.verb)}</Badge>
                <span className="text-sm text-dc-text-muted">{activityLead}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative hidden aspect-[2/1] bg-dc-elevated-solid md:block">
          <Link
            to={`/events/${encodeURIComponent(eventId)}`}
            className="absolute inset-0 z-0 block"
            aria-label={`View event: ${title}`}
          >
            {heroSrc ?
              <img src={heroSrc} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            : <MediaSurfaceFallback variant="event" className="absolute inset-0" />}
          </Link>
          {dateBadge ?
            <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-dc-elevated/95 px-2 py-1 text-xs font-medium text-dc-text backdrop-blur-sm">
              {dateBadge}
            </span>
          : null}
          {isVirtual ?
            <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-sky-400/35 bg-sky-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
              Virtual
            </span>
          : null}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex gap-3 md:block">
            <div className="min-w-0 flex-1">
            <Link
              to={`/events/${encodeURIComponent(eventId)}`}
              className="font-semibold text-dc-text line-clamp-2 hover:text-dc-accent focus:outline-none focus-visible:underline"
            >
              {title}
            </Link>
            {whenLine ?
              <p className="mt-1 text-sm text-dc-text-muted">{whenLine}</p>
            : null}
            <p className="mt-1 flex items-center gap-1 text-sm text-dc-text-muted">
              {isVirtual ?
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              : <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                </svg>
              }
              <span className="truncate">{location}</span>
            </p>
            {rsvpCount > 0 ?
              <p className="mt-2 text-xs text-dc-muted">{rsvpCount} going</p>
            : null}
            </div>
            {heroSrc ?
              <Link
                to={`/events/${encodeURIComponent(eventId)}`}
                className="block shrink-0 md:hidden"
                aria-hidden
                tabIndex={-1}
              >
                <img
                  src={heroSrc}
                  alt=""
                  className="h-24 w-24 rounded-xl border border-dc-border object-cover"
                  loading="lazy"
                />
              </Link>
            : null}
          </div>

          {rsvpMsg ?
            <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200" role="alert">
              {rsvpMsg}
            </p>
          : null}

          {UUID_RE.test(eventId) ?
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={rsvpBusy || !isAuthenticated || rsvpClosed}
                onClick={() => void putRsvp('going')}
                className={cn(
                  'min-h-10 rounded-xl border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50',
                  rsvpKind === 'waitlist' ?
                    'border-violet-400/35 bg-violet-500/15 text-violet-100'
                  : rsvpKind === 'going' ?
                    'border-dc-success/40 bg-dc-success/20 text-dc-success'
                  : 'border-transparent bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover',
                )}
              >
                {rsvpKind === 'waitlist' ? 'On waitlist' : 'Going'}
              </button>
              <button
                type="button"
                disabled={rsvpBusy || !isAuthenticated || rsvpClosed}
                onClick={() => void putRsvp('maybe')}
                className={cn(
                  'min-h-10 rounded-xl border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50',
                  rsvpKind === 'maybe' ?
                    'border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border-dc-border bg-dc-elevated-solid text-dc-text-muted hover:text-dc-text',
                )}
              >
                {RSVP_LABEL_INTERESTED}
              </button>
              {!isAuthenticated ?
                <span className="text-xs text-dc-muted">Sign in to RSVP</span>
              : rsvpClosed ?
                <span className="text-xs text-amber-200/90">RSVPs closed</span>
              : null}
            </div>
          : copyPath ?
            <Link
              to={copyPath}
              className={cn(
                'inline-flex min-h-touch items-center text-sm font-medium text-dc-accent',
                'rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface-card',
              )}
            >
              View event
            </Link>
          : null}
        </div>
      </article>
    </Card>
  )
}

function isVendorShopActivity(verb: string, object?: Record<string, unknown>): boolean {
  return verb === 'vendor_shop_live' && object?.type === 'vendor'
}

function VendorShopFeedCard({ item }: Props) {
  const object = item.object
  const shopName = typeof object?.displayName === 'string' ? object.displayName : 'Vendor shop'
  const listingCount = typeof object?.listingCount === 'number' ? object.listingCount : null
  const slug = typeof object?.slug === 'string' ? object.slug : null
  const shopPath = slug ? `/vendors/${encodeURIComponent(slug)}` : item.deepLink

  return (
    <Card padding="md" className={`relative transition-colors hover:border-dc-accent/25 feed-stream-activity-card ${cardSurfaceFeedActivityClass}`}>
      {shopPath && shopPath !== '/home' ?
        <CopyLinkOverflowMenu path={shopPath} className="absolute right-3 top-3" />
      : null}
      <article>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{verbBadgeLabel(item.verb)}</Badge>
          <p className="text-sm text-dc-muted">
            <Link
              to={`/profile/${item.actor.username}`}
              className="font-medium text-dc-text hover:text-dc-accent focus:outline-none focus-visible:underline"
            >
              @{item.actor.username}
            </Link>
          </p>
        </div>
        <p className="text-base text-dc-text">
          {verbLabel(item.verb, item.actor.username, object)}
        </p>
        <p className="text-sm text-dc-text-muted mt-1">
          Browse synced listings on Kink Social. Checkout on their external store.
          {listingCount != null ? ` · ${listingCount} listing${listingCount === 1 ? '' : 's'}` : ''}
        </p>
        {shopPath && shopPath !== '/home' ?
          <Link
            to={shopPath}
            className={cn(
              'mt-3 inline-flex min-h-touch items-center text-sm font-medium text-dc-accent',
              'hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface-card rounded',
            )}
          >
            Visit {shopName}
          </Link>
        : null}
      </article>
    </Card>
  )
}

function CompactActivityFeedCard({ item }: Props) {
  const object = item.object
  const copyPath =
    item.verb === 'group_thread_created' ?
      resolveGroupThreadActivityDeepLink(item.deepLink, object)
    : item.deepLink && item.deepLink !== '/home' ? item.deepLink
    : null
  const linkLabel = followingFeedDeepLinkLabel(item.verb)
  const partnerUsername =
    typeof object?.partnerUsername === 'string' && object.partnerUsername.trim() ?
      object.partnerUsername.trim()
    : null
  const targetName =
    typeof object?.groupName === 'string' && object.groupName.trim() ? object.groupName.trim()
    : typeof object?.orgName === 'string' && object.orgName.trim() ? object.orgName.trim()
    : typeof object?.title === 'string' && object.title.trim() ? object.title.trim()
    : null

  if (item.verb === 'connection_accepted') {
    return (
      <FeedConnectionActivityCard
        username={item.actor.username}
        verb={partnerUsername ? 'accepted a connection from' : 'accepted a connection'}
        partnerUsername={partnerUsername}
        timeLabel={item.createdAt ? formatFeedTimeShort(item.createdAt) : ''}
        href={copyPath ?? undefined}
        linkLabel={copyPath ? linkLabel : undefined}
      />
    )
  }

  const previewUrls = Array.isArray(object?.previewUrls) ?
    object.previewUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
  : []
  const followedUsernames = Array.isArray(object?.usernames) ?
    object.usernames.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
  : []

  if (item.verb === 'followed' && followedUsernames.length > 0) {
    return (
      <FeedConnectionActivityCard
        username={item.actor.username}
        verb={followingActivityVerbPhrase(item.verb, object)}
        timeLabel={item.createdAt ? formatFeedTimeShort(item.createdAt) : ''}
      >
        <div className="feed-connection-mini-list">
          {followedUsernames.slice(0, 3).map((name) => (
            <Link key={name} to={`/profile/${encodeURIComponent(name)}`} className="feed-connection-mini-list__chip">
              <span className="feed-connection-mini-list__avatar">{name.charAt(0)}</span>
              @{name}
            </Link>
          ))}
        </div>
      </FeedConnectionActivityCard>
    )
  }

  if (item.verb === 'event_rsvp' && followedUsernames.length > 0) {
    return (
      <FeedConnectionActivityCard
        username={item.actor.username}
        verb={followingActivityVerbPhrase(item.verb, object)}
        timeLabel={item.createdAt ? formatFeedTimeShort(item.createdAt) : ''}
        href={copyPath ?? undefined}
        linkLabel={copyPath ? linkLabel : undefined}
      >
        <div className="feed-connection-mini-list">
          {followedUsernames.slice(0, 4).map((name) => (
            <Link key={name} to={`/profile/${encodeURIComponent(name)}`} className="feed-connection-mini-list__chip">
              <span className="feed-connection-mini-list__avatar">{name.charAt(0)}</span>
              @{name}
            </Link>
          ))}
        </div>
      </FeedConnectionActivityCard>
    )
  }

  const discussionExcerpt = typeof object?.excerpt === 'string' ? object.excerpt.trim() : ''

  return (
    <FeedActivityRow
      username={item.actor.username}
      verb={followingActivityVerbPhrase(item.verb, object)}
      timeLabel={item.createdAt ? formatFeedTimeShort(item.createdAt) : ''}
      href={copyPath ?? undefined}
      linkLabel={copyPath ? linkLabel : undefined}
    >
      {discussionExcerpt &&
      (item.verb === 'replied_discussion' ||
        item.verb === 'created_discussion' ||
        item.verb === 'post_comment' ||
        item.verb === 'commented') ?
        <p className="feed-activity-row__excerpt">{discussionExcerpt}</p>
      : null}
      {previewUrls.length > 0 ?
        <FeedMediaStrip items={previewUrls.map((url) => ({ url }))} href={copyPath ?? undefined} />
      : targetName && copyPath ?
        <Link to={copyPath} className="feed-activity-row__target">
          <span className="feed-activity-row__target-avatar flex items-center justify-center text-xs font-semibold uppercase text-dc-accent">
            {targetName.charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="feed-activity-row__target-name block truncate">{targetName}</span>
          </span>
        </Link>
      : null}
    </FeedActivityRow>
  )
}

export default function ActivityFeedCard({ item }: Props) {
  if (isCompactFollowingActivity(item.verb, item.object)) {
    return <CompactActivityFeedCard item={item} />
  }

  if (isEventStoryActivity(item.verb, item.object)) {
    return <EventFeedStoryCard item={item} />
  }

  if (isVendorShopActivity(item.verb, item.object)) {
    return <VendorShopFeedCard item={item} />
  }

  const label = verbLabel(item.verb, item.actor.username, item.object)
  const copyPath = item.deepLink && item.deepLink !== '/home' ? item.deepLink : null
  return (
    <Card
      padding="md"
      className={`relative transition-colors hover:border-dc-accent/25 feed-stream-activity-card ${cardSurfaceFeedActivityClass}`}
    >
      {copyPath ?
        <CopyLinkOverflowMenu path={copyPath} className="absolute right-3 top-3" />
      : null}
      <article>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{verbBadgeLabel(item.verb)}</Badge>
          <p className="text-sm text-dc-muted">
            <Link
              to={`/profile/${item.actor.username}`}
              className="font-medium text-dc-text hover:text-dc-accent focus:outline-none focus-visible:underline"
            >
              @{item.actor.username}
            </Link>
          </p>
        </div>
        <p className="text-base text-dc-text">{label}</p>
        {item.deepLink && item.deepLink !== '/home' ?
          <Link
            to={item.deepLink}
            className={cn(
              'mt-3 inline-flex min-h-touch items-center text-sm font-medium text-dc-accent',
              'hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecke-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface-card rounded',
            )}
          >
            View
          </Link>
        : null}
      </article>
    </Card>
  )
}
