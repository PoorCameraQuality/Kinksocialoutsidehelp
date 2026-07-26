/** Visible feed reaction labels (alpha UI). Backend stores one reaction per viewer per post. */

export const FEED_REACTION_IDS = ['love', 'respect', 'sympathize', 'helpful'] as const
export type FeedReactionId = (typeof FEED_REACTION_IDS)[number]

export const FEED_REACTION_LABELS: Record<FeedReactionId, string> = {
  love: 'Love',
  respect: 'Respect',
  sympathize: 'Sympathize',
  helpful: 'Helpful',
}

export const FEED_ACTION_LABELS = {
  discuss: 'Comment',
  repost: 'Repost',
  share: 'Share',
  report: 'Report',
} as const

export function emptyFeedReactionCounts(): Record<FeedReactionId, number> {
  return { love: 0, respect: 0, sympathize: 0, helpful: 0 }
}

export function isFeedReactionId(value: string): value is FeedReactionId {
  return (FEED_REACTION_IDS as readonly string[]).includes(value)
}

export function totalFeedReactionCount(counts: Record<FeedReactionId, number>): number {
  return FEED_REACTION_IDS.reduce((sum, id) => sum + (counts[id] ?? 0), 0)
}
