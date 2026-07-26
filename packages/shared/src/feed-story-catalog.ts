import type { FeedSettings } from './user-settings.js'

export type FeedStoryCategory = {
  id: string
  title: string
  stories: { key: string; label: string }[]
}

/** C2K activity feed story keys - maps to `hideStoryTypes`, post kinds, or connection toggles. */
export const FEED_STORY_CATALOG: FeedStoryCategory[] = [
  {
    id: 'connections',
    title: 'Connections & follows',
    stories: [
      { key: 'connection_accepted', label: 'Accepted a connection request' },
      { key: 'connection_like', label: 'Reacted to a post (likes)' },
      { key: 'repost', label: 'Shared a post' },
    ],
  },
  {
    id: 'posts',
    title: 'Posts & writings',
    stories: [
      { key: 'status', label: 'Posted a status or profile update' },
      { key: 'article', label: 'Published an article or long-form post' },
    ],
  },
  {
    id: 'events',
    title: 'Events & conventions',
    stories: [
      { key: 'event_created', label: 'Created a new event' },
      { key: 'event_rsvp', label: 'RSVP’d to an event' },
      { key: 'convention_pin', label: 'Pinned a convention to their home' },
      { key: 'presenter_assigned', label: 'Assigned as a presenter' },
    ],
  },
  {
    id: 'groups',
    title: 'Groups & organizations',
    stories: [
      { key: 'group_join', label: 'Joined a group' },
      { key: 'org_join', label: 'Joined an organization' },
      { key: 'org_announcement', label: 'Organization announcement' },
    ],
  },
  {
    id: 'ecosystem',
    title: 'Shops & discovery',
    stories: [{ key: 'vendor_shop_live', label: 'Vendor shop went live' }],
  },
]

const SPECIAL_STORY_KEYS = new Set(['connection_like', 'repost'])

export function isFeedStoryVisible(feed: FeedSettings, key: string): boolean {
  if (key === 'connection_like') return feed.showConnectionLikes
  if (key === 'repost') return feed.showConnectionShares
  return !feed.hideStoryTypes.includes(key)
}

export function setFeedStoryVisible(feed: FeedSettings, key: string, visible: boolean): FeedSettings {
  if (key === 'connection_like') {
    return { ...feed, showConnectionLikes: visible }
  }
  if (key === 'repost') {
    return { ...feed, showConnectionShares: visible }
  }
  const hidden = new Set(feed.hideStoryTypes)
  if (visible) hidden.delete(key)
  else hidden.add(key)
  return { ...feed, hideStoryTypes: [...hidden] }
}

export function setAllFeedStoriesVisible(feed: FeedSettings, visible: boolean): FeedSettings {
  let next = feed
  for (const cat of FEED_STORY_CATALOG) {
    for (const story of cat.stories) {
      next = setFeedStoryVisible(next, story.key, visible)
    }
  }
  return next
}

export function allFeedStoryKeys(): string[] {
  return FEED_STORY_CATALOG.flatMap((c) => c.stories.map((s) => s.key)).filter((k) => !SPECIAL_STORY_KEYS.has(k))
}
