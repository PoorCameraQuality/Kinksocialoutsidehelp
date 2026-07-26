import type { FollowingFeedItem } from '@/lib/feed-types'

type ActivityItem = Extract<FollowingFeedItem, { kind: 'activity' }>

export type HighlightCategory =
  | 'event'
  | 'convention'
  | 'group'
  | 'connection'
  | 'reaction'
  | 'comment'
  | 'vendor'
  | 'class'
  | 'organizer'
  | 'generic'

export type HighlightGroup = {
  key: string
  verb: string
  category: HighlightCategory
  /** Distinct actor usernames, most recent first. */
  actors: string[]
  totalActors: number
  /** Number of activity events folded into this group. */
  itemCount: number
  /** Object label for single-item groups (event/convention/group name). */
  objectLabel: string | null
  /** Secondary object meta for single-item groups (date or location). */
  objectMeta: string | null
  /** Deep link — only set when the group is object-specific enough to navigate. */
  deepLink: string | null
  /** Newest createdAt in the group (ISO). */
  createdAt: string
}

function verbCategory(verb: string): HighlightCategory {
  switch (verb) {
    case 'event_created':
    case 'event_rsvp':
      return 'event'
    case 'convention_pin':
      return 'convention'
    case 'group_join':
    case 'group_thread_created':
      return 'group'
    case 'connection_accepted':
    case 'followed':
      return 'connection'
    case 'loved':
    case 'reacted':
    case 'post_love':
      return 'reaction'
    case 'commented':
    case 'post_comment':
    case 'replied_discussion':
    case 'created_discussion':
      return 'comment'
    case 'vendor_shop_live':
    case 'added_vendor_product':
      return 'vendor'
    case 'published_class':
    case 'presenter_assigned':
      return 'class'
    case 'org_join':
    case 'org_announcement':
      return 'organizer'
    default:
      return 'generic'
  }
}

function objectLabel(object?: Record<string, unknown>): string | null {
  const candidates = [
    object?.title,
    object?.eventTitle,
    object?.threadTitle,
    object?.slotTitle,
    object?.groupName,
    object?.orgName,
    object?.vendorName,
    object?.displayName,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

function objectMeta(object?: Record<string, unknown>): string | null {
  const startsAt = typeof object?.startsAt === 'string' ? object.startsAt : null
  if (startsAt) {
    const d = new Date(startsAt)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
  }
  const location = typeof object?.location === 'string' && object.location.trim() ? object.location.trim() : null
  if (location) return location
  return null
}

/** "Brax", "Brax and Luna", "Brax, Luna and 2 others". */
export function formatActorList(actors: string[], total: number): string {
  if (actors.length === 0 || total === 0) return 'Someone'
  if (total === 1) return actors[0]
  if (total === 2) return `${actors[0]} and ${actors[1]}`
  const others = total - 2
  return `${actors[0]}, ${actors[1]} and ${others} other${others === 1 ? '' : 's'}`
}

/** Group-level action phrase, count- and plurality-aware (username shown separately). */
export function highlightActionPhrase(group: HighlightGroup): string {
  const { verb, itemCount: n, objectLabel: label, totalActors } = group
  const plural = totalActors > 1
  const single = n === 1
  switch (verb) {
    case 'convention_pin':
      return single && label ? `pinned ${label}` : `pinned ${n} conventions`
    case 'event_created':
      return single && label ? `announced ${label}` : `announced ${n} events`
    case 'event_rsvp':
      return single && label ? `${plural ? 'are' : 'is'} going to ${label}` : `RSVP'd to ${n} events`
    case 'group_join':
      return single && label ? `joined ${label}` : `joined ${n} groups`
    case 'group_thread_created':
      return single && label ? `started a discussion in ${label}` : `started ${n} discussions`
    case 'org_join':
      return single && label ? `joined ${label}` : `joined ${n} organizations`
    case 'org_announcement':
      return single ? 'posted organizer news' : `posted ${n} organizer updates`
    case 'connection_accepted':
      return single ? 'made a new connection' : `made ${n} new connections`
    case 'followed':
      return single ? 'followed someone new' : 'followed new people'
    case 'loved':
    case 'reacted':
    case 'post_love':
      return single ? 'loved a post' : `loved ${n} posts`
    case 'commented':
    case 'post_comment':
      return single ? 'commented on a post' : `commented on ${n} posts`
    case 'replied_discussion':
    case 'created_discussion':
      return single ? 'joined a discussion' : `joined ${n} discussions`
    case 'presenter_assigned':
      return single && label ? `${plural ? 'are' : 'is'} teaching ${label}` : `${plural ? 'are' : 'is'} teaching upcoming sessions`
    case 'published_class':
      return single && label ? `posted a new class: ${label}` : `posted ${n} new classes`
    case 'vendor_shop_live':
      return single && label ? `opened ${label}` : 'published a vendor shop'
    case 'added_vendor_product':
      return single ? 'added a new product' : `added ${n} new products`
    default:
      return single ? 'shared an update' : `shared ${n} updates`
  }
}

/**
 * Collapse a flat list of Following activity items into compact, de-duplicated
 * highlight groups. Groups by verb; folds repeated activity from multiple people
 * into a single object-aware row. Sorted newest first.
 */
export function groupFollowingActivities(items: ActivityItem[]): HighlightGroup[] {
  const byVerb = new Map<string, ActivityItem[]>()
  for (const item of items) {
    const bucket = byVerb.get(item.verb)
    if (bucket) bucket.push(item)
    else byVerb.set(item.verb, [item])
  }

  const groups: HighlightGroup[] = []
  for (const [verb, bucket] of byVerb) {
    const sorted = [...bucket].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    const actors: string[] = []
    const seen = new Set<string>()
    for (const item of sorted) {
      const name = item.actor.username
      if (!seen.has(name)) {
        seen.add(name)
        actors.push(name)
      }
    }
    const newest = sorted[0]
    const single = sorted.length === 1
    const deepLink =
      single && newest.deepLink && newest.deepLink !== '/home' ? newest.deepLink : null
    groups.push({
      key: verb,
      verb,
      category: verbCategory(verb),
      actors: actors.slice(0, 2),
      totalActors: actors.length,
      itemCount: sorted.length,
      objectLabel: single ? objectLabel(newest.object) : null,
      objectMeta: single ? objectMeta(newest.object) : null,
      deepLink,
      createdAt: newest.createdAt,
    })
  }

  return groups.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
