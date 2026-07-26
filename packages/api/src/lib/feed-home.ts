import { getFollowingFeed, type FollowingFeedItem } from './feed-following.js'

export type FeedHomeCardLayout = 'full' | 'compact'

export type FeedHomeCard = {
  id: string
  cardType: 'post' | 'activity'
  layout: FeedHomeCardLayout
  cursor: string
  createdAt: string
  deepLink: string
  actor: { id: string; username: string }
  verb?: string
  post?: Record<string, unknown>
  object?: Record<string, unknown>
  reasonText?: string | null
  alphaLabel?: string | null
}

const COMPACT_ACTIVITY_VERBS = new Set([
  'connection_accepted',
  'convention_pin',
  'org_join',
  'group_join',
  'group_thread_created',
  'org_announcement',
  'presenter_assigned',
  'loved',
  'reacted',
  'post_love',
  'followed',
  'commented',
  'post_comment',
  'replied_discussion',
])

function cardId(item: FollowingFeedItem): string {
  if (item.kind === 'post' && item.post?.id) return String(item.post.id)
  return item.cursor
}

function layoutForItem(item: FollowingFeedItem): FeedHomeCardLayout {
  if (item.kind === 'post') return 'full'
  if (item.verb && COMPACT_ACTIVITY_VERBS.has(item.verb)) {
    if (item.verb === 'org_announcement') {
      const body = typeof item.object?.body === 'string' ? item.object.body.trim() : ''
      const excerpt = typeof item.object?.excerpt === 'string' ? item.object.excerpt.trim() : ''
      if (body || excerpt) return 'full'
    }
    return 'compact'
  }
  return 'full'
}

function reasonTextForItem(item: FollowingFeedItem, viewerId: string): string | null {
  if (item.actor.id === viewerId) return null
  if (item.kind === 'post') {
    if (item.post?.repostOfId) return 'From someone you follow'
    return 'From someone you follow'
  }
  switch (item.verb) {
    case 'group_join':
      return 'From a group you joined'
    case 'group_thread_created':
      return 'From a group discussion you can access'
    case 'event_rsvp':
      return 'From someone you follow'
    case 'event_created':
      return 'From someone you follow'
    default:
      return 'From someone you follow'
  }
}

export function followingItemsToFeedHomeCards(
  items: FollowingFeedItem[],
  viewerId: string,
): FeedHomeCard[] {
  return items.map((item) => ({
    id: cardId(item),
    cardType: item.kind,
    layout: layoutForItem(item),
    cursor: item.cursor,
    createdAt: item.createdAt,
    deepLink: item.deepLink,
    actor: item.actor,
    verb: item.verb,
    post: item.post,
    object: item.object,
    reasonText: reasonTextForItem(item, viewerId),
    alphaLabel: typeof item.object?.alphaLabel === 'string' ? item.object.alphaLabel : null,
  }))
}

export async function getHomeFeed(params: {
  viewerId: string
  limit: number
  cursor?: string
  filter?: string
}): Promise<{ cards: FeedHomeCard[]; nextCursor: string | null; connectionCount: number }> {
  const result = await getFollowingFeed(params)
  return {
    cards: followingItemsToFeedHomeCards(result.items, params.viewerId),
    nextCursor: result.nextCursor,
    connectionCount: result.connectionCount,
  }
}
