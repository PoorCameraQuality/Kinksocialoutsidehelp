import type { HomeFeedPost } from '@/lib/feed-types'

export type FeedPostBadgeKind = 'education' | 'event' | 'dungeon' | 'vendor' | 'community' | 'article'

export type FeedPostBadge = {
  kind: FeedPostBadgeKind
  label: string
}

const BADGE_META: Record<
  FeedPostBadgeKind,
  { label: string; className: string }
> = {
  education: {
    label: 'Education',
    className: 'border-[#a855f7]/40 bg-[#a855f7]/15 text-[#e9d5ff]',
  },
  event: {
    label: 'Event',
    className: 'border-[#14b8a6]/40 bg-[#14b8a6]/15 text-[#99f6e4]',
  },
  dungeon: {
    label: 'Dungeon',
    className: 'border-[#c47a44]/45 bg-[#c47a44]/15 text-[#fde68a]',
  },
  vendor: {
    label: 'Vendor',
    className: 'border-[#a855f7]/40 bg-[#7c3aed]/15 text-[#ddd6fe]',
  },
  community: {
    label: 'Community',
    className: 'border-[#60a5fa]/40 bg-[#3b82f6]/15 text-[#bfdbfe]',
  },
  article: {
    label: 'Article',
    className: 'border-dc-accent-border/50 bg-dc-accent-muted text-dc-accent',
  },
}

export function feedPostBadgeMeta(kind: FeedPostBadgeKind) {
  return BADGE_META[kind]
}

/** Infer a content badge from post kind, mentions, and title heuristics. */
export function feedActivityLeadLine(badge: FeedPostBadge | null, kind: string): string | null {
  if (kind === 'repost') return 'Reposted this post'
  if (!badge) return 'Shared an update'
  switch (badge.kind) {
    case 'event':
      return 'Announced an event'
    case 'education':
      return 'Shared education'
    case 'vendor':
      return 'Vendor update'
    case 'community':
      return 'Group update'
    case 'article':
      return 'Published an article'
    default:
      return 'Posted an update'
  }
}

export function inferFeedPostBadge(post: HomeFeedPost): FeedPostBadge | null {
  if (post.kind === 'repost') return null

  const mentionTypes = new Set(post.mentions.map((m) => m.type.toLowerCase()))
  const hay = `${post.kind} ${post.title ?? ''} ${post.body}`.toLowerCase()

  if (mentionTypes.has('event') || hay.includes('#event') || post.kind.includes('event')) {
    return { kind: 'event', label: BADGE_META.event.label }
  }
  if (mentionTypes.has('vendor') || hay.includes('vendor')) {
    return { kind: 'vendor', label: BADGE_META.vendor.label }
  }
  if (mentionTypes.has('dungeon') || hay.includes('dungeon')) {
    return { kind: 'dungeon', label: BADGE_META.dungeon.label }
  }
  if (
    mentionTypes.has('education') ||
    post.kind === 'article' ||
    hay.includes('education') ||
    hay.includes('class') ||
    hay.includes('workshop')
  ) {
    return { kind: 'education', label: BADGE_META.education.label }
  }
  if (mentionTypes.has('group') || hay.includes('community') || hay.includes('munch')) {
    return { kind: 'community', label: BADGE_META.community.label }
  }
  if (post.kind === 'article') {
    return { kind: 'article', label: BADGE_META.article.label }
  }

  return null
}
