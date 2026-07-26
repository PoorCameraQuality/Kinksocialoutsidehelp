import type { FollowingFeedItem } from '@/lib/feed-types'

/** Plain-language reason this row appears in Following (viewer follows the actor). */
export function followingFeedItemReason(item: FollowingFeedItem): string | null {
  if (item.kind === 'post') {
    return item.post.repostOfId ? 'reposted' : null
  }
  switch (item.verb) {
    case 'connection_accepted':
      return 'accepted a new connection'
    case 'event_created':
      return 'announced an event'
    case 'event_rsvp':
      return 'RSVP activity you may want to join'
    case 'presenter_assigned':
      return 'was assigned to teach a session'
    case 'convention_pin':
      return 'pinned a convention to their profile'
    case 'org_join':
      return 'joined an organization'
    case 'org_announcement':
      return 'posted organizer news'
    case 'group_join':
      return 'joined a group'
    case 'group_thread_created':
      return 'started a group discussion'
    case 'vendor_shop_live':
      return 'published a vendor shop'
    default:
      return 'shared activity with your connections'
  }
}

export function followingFeedActorUsername(item: FollowingFeedItem): string {
  return item.kind === 'post' ? item.post.authorUsername : item.actor.username
}

/** Compact row instead of full story card. */
export function isCompactFollowingActivity(verb: string, object?: Record<string, unknown>): boolean {
  if (
    verb === 'connection_accepted' ||
    verb === 'convention_pin' ||
    verb === 'org_join' ||
    verb === 'group_join' ||
    verb === 'group_thread_created' ||
    verb === 'loved' ||
    verb === 'reacted' ||
    verb === 'post_love' ||
    verb === 'followed' ||
    verb === 'commented' ||
    verb === 'post_comment' ||
    verb === 'replied_discussion' ||
    verb === 'created_discussion' ||
    verb === 'added_vendor_product'
  ) {
    return true
  }
  if (verb === 'org_announcement') {
    const body = typeof object?.body === 'string' ? object.body.trim() : ''
    const excerpt = typeof object?.excerpt === 'string' ? object.excerpt.trim() : ''
    return !body && !excerpt
  }
  if (verb === 'presenter_assigned') return true
  return false
}

export function followingFeedDeepLinkLabel(verb: string): string {
  switch (verb) {
    case 'convention_pin':
      return 'View convention'
    case 'event_created':
    case 'event_rsvp':
      return 'View event'
    case 'org_join':
    case 'org_announcement':
      return 'View organization'
    case 'group_join':
      return 'View group'
    case 'group_thread_created':
      return 'Read discussion'
    case 'vendor_shop_live':
      return 'View shop'
    case 'connection_accepted':
      return 'View profile'
    case 'presenter_assigned':
      return 'View program'
    case 'loved':
    case 'reacted':
    case 'post_love':
    case 'commented':
    case 'post_comment':
      return 'View post'
    default:
      return 'View details'
  }
}

export function followingActivityHeadline(
  verb: string,
  actorUsername: string,
  object?: Record<string, unknown>,
): string {
  const title =
    typeof object?.title === 'string' && object.title.trim() ?
      object.title.trim()
    : typeof object?.slotTitle === 'string' && object.slotTitle.trim() ?
      object.slotTitle.trim()
    : typeof object?.orgName === 'string' && object.orgName.trim() ?
      object.orgName.trim()
    : typeof object?.groupName === 'string' && object.groupName.trim() ?
      object.groupName.trim()
    : null

  switch (verb) {
    case 'convention_pin':
      return title ? `@${actorUsername} pinned something for ${title}` : `@${actorUsername} pinned a convention`
    case 'org_join':
      return title ? `@${actorUsername} joined ${title}` : `@${actorUsername} joined an organization`
    case 'org_announcement':
      return title ? `@${actorUsername} posted news in ${title}` : `@${actorUsername} posted organizer news`
    case 'group_join':
      return title ? `@${actorUsername} joined ${title}` : `@${actorUsername} joined a group`
    case 'group_thread_created': {
      const threadTitle =
        typeof object?.threadTitle === 'string' && object.threadTitle.trim() ?
          object.threadTitle.trim()
        : null
      if (title && threadTitle) return `@${actorUsername} started a discussion in ${title}: ${threadTitle}`
      if (title) return `@${actorUsername} started a discussion in ${title}`
      return `@${actorUsername} started a group discussion`
    }
    case 'connection_accepted': {
      const partner =
        typeof object?.partnerUsername === 'string' && object.partnerUsername.trim() ?
          object.partnerUsername.trim()
        : null
      return partner ?
          `@${actorUsername} accepted a connection from @${partner}`
        : `@${actorUsername} accepted a connection`
    }
    case 'presenter_assigned': {
      const conventionLabel =
        typeof object?.conventionSlug === 'string' && object.conventionSlug.trim() ?
          object.conventionSlug.trim()
        : typeof object?.conventionKey === 'string' && object.conventionKey.trim() ?
          object.conventionKey.trim()
        : null
      if (conventionLabel) return `@${actorUsername} was added to the program for ${conventionLabel}`
      return `@${actorUsername} was added to the program`
    }
    default:
      return `@${actorUsername} shared an update`
  }
}

/** Inline verb phrase for compact stream rows (username shown separately). */
export function followingActivityVerbPhrase(verb: string, object?: Record<string, unknown>): string {
  const title =
    typeof object?.title === 'string' && object.title.trim() ?
      object.title.trim()
    : typeof object?.slotTitle === 'string' && object.slotTitle.trim() ?
      object.slotTitle.trim()
    : typeof object?.orgName === 'string' && object.orgName.trim() ?
      object.orgName.trim()
    : typeof object?.groupName === 'string' && object.groupName.trim() ?
      object.groupName.trim()
    : null

  switch (verb) {
    case 'connection_accepted': {
      const partner =
        typeof object?.partnerUsername === 'string' && object.partnerUsername.trim() ?
          object.partnerUsername.trim()
        : null
      return partner ? `accepted a connection from ${partner}` : 'accepted a connection'
    }
    case 'convention_pin':
      return title ? `pinned something for ${title}` : 'pinned a convention'
    case 'org_join':
      return title ? `joined ${title}` : 'joined an organization'
    case 'org_announcement':
      return title ? `posted news in ${title}` : 'posted organizer news'
    case 'group_join':
      return title ? `joined ${title}` : 'joined a group'
    case 'group_thread_created': {
      const threadTitle =
        typeof object?.threadTitle === 'string' && object.threadTitle.trim() ?
          object.threadTitle.trim()
        : null
      if (title && threadTitle) return `started a discussion in ${title}: ${threadTitle}`
      if (title) return `started a discussion in ${title}`
      return 'started a group discussion'
    }
    case 'event_created':
      return title ? `announced ${title}` : 'announced a new event'
    case 'event_rsvp':
      if (typeof object?.count === 'number' && object.count > 1) {
        return `RSVP'd interested in ${title ?? 'an event'}`
      }
      return title ? `is going to ${title}` : "RSVP'd to an event"
    case 'loved':
    case 'reacted':
    case 'post_love': {
      const count = typeof object?.count === 'number' ? object.count : 1
      const mediaKind = typeof object?.mediaKind === 'string' ? object.mediaKind : 'picture'
      const targetUser =
        typeof object?.targetUsername === 'string' && object.targetUsername.trim() ?
          object.targetUsername.trim()
        : typeof object?.postAuthorUsername === 'string' && object.postAuthorUsername.trim() ?
          object.postAuthorUsername.trim()
        : null
      if (targetUser && count === 1) return `loved ${targetUser}'s ${mediaKind}`
      return `loved ${count} ${mediaKind}${count === 1 ? '' : 's'}`
    }
    case 'commented':
    case 'post_comment': {
      const postAuthor =
        typeof object?.postAuthorUsername === 'string' && object.postAuthorUsername.trim() ?
          object.postAuthorUsername.trim()
        : null
      if (postAuthor) return `commented on ${postAuthor}'s status update`
      return 'commented on a status update'
    }
    case 'followed': {
      const count = typeof object?.count === 'number' ? object.count : 1
      return count === 1 ? 'followed someone' : `followed ${count} people`
    }
    case 'replied_discussion':
    case 'created_discussion': {
      const count = typeof object?.count === 'number' ? object.count : 1
      const title = typeof object?.title === 'string' ? object.title.trim() : null
      if (title && count === 1) return `commented on ${title}`
      return count === 1 ? 'commented on a discussion' : `${count} discussion replies`
    }
    case 'presenter_assigned': {
      const conventionLabel =
        typeof object?.conventionSlug === 'string' && object.conventionSlug.trim() ?
          object.conventionSlug.trim()
        : typeof object?.conventionKey === 'string' && object.conventionKey.trim() ?
          object.conventionKey.trim()
        : null
      if (conventionLabel) return `was added to the program for ${conventionLabel}`
      return 'was added to the program'
    }
    case 'published_class':
      return title ? `posted a new class: ${title}` : 'posted a new class'
    case 'added_vendor_product':
    case 'vendor_shop_live':
      return typeof object?.count === 'number' && object.count > 1 ?
          `added ${object.count} new products`
        : 'added a new product'
    default:
      return 'shared an update'
  }
}

/** Short timestamp for stream headers (`7m`, `5h`, `now`). */
export function formatFeedTimeShort(value: string | undefined | null): string {
  if (!value?.trim()) return ''
  const trimmed = value.trim()
  const agoMatch = trimmed.match(/^(\d+[mhdw])\s+ago$/i)
  if (agoMatch) return agoMatch[1]
  if (/^just now$/i.test(trimmed)) return 'now'

  const ms = Date.now() - new Date(trimmed).getTime()
  if (!Number.isNaN(ms) && ms >= 0) {
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(ms / 3600000)
    if (hours < 48) return `${hours}h`
    const days = Math.floor(ms / 86400000)
    if (days < 14) return `${days}d`
  }

  return trimmed.replace(/\s+ago$/i, '')
}

const THREAD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Resolve thread deep link for group_thread_created; falls back to Forums tab without thread. */
export function resolveGroupThreadActivityDeepLink(
  deepLink: string | undefined,
  object?: Record<string, unknown>,
): string | null {
  const fallback = deepLink && deepLink !== '/home' ? deepLink : null
  if (fallback?.includes('thread=')) return fallback

  const threadId = typeof object?.id === 'string' ? object.id : null
  const groupSlug = typeof object?.groupSlug === 'string' ? object.groupSlug.trim() : ''
  const groupId = typeof object?.groupId === 'string' ? object.groupId.trim() : ''
  const key = groupSlug || groupId
  if (threadId && key && THREAD_UUID_RE.test(threadId)) {
    return `/groups/${encodeURIComponent(key)}?tab=Forums&thread=${encodeURIComponent(threadId)}`
  }
  return fallback
}
