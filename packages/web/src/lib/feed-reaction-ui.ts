import {
  FEED_REACTION_LABELS,
  totalFeedReactionCount,
  type FeedReactionId,
} from '@c2k/shared'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'
import type { ConnectionLikerPreview } from '@/lib/feed-types'
import {
  IconHelpful,
  IconLove,
  IconRespect,
  IconSympathize,
} from '@/components/feed/FeedInteractionIcons'

export type FeedReactionOption = {
  id: FeedReactionId
  label: string
  pastLabel: string
  title: string
  hint: string
  Icon: typeof IconLove
}

/** Picker + inline bar definitions — mature icons, no emoji. */
export const FEED_REACTION_OPTIONS: FeedReactionOption[] = [
  {
    id: 'love',
    label: FEED_REACTION_LABELS.love,
    pastLabel: 'Loved',
    title: 'Love',
    hint: 'Show you love this post',
    Icon: IconLove,
  },
  {
    id: 'respect',
    label: FEED_REACTION_LABELS.respect,
    pastLabel: 'Respected',
    title: 'Respect',
    hint: 'Acknowledge their perspective',
    Icon: IconRespect,
  },
  {
    id: 'sympathize',
    label: FEED_REACTION_LABELS.sympathize,
    pastLabel: 'Sympathized',
    title: 'Sympathize',
    hint: 'Offer empathy or support',
    Icon: IconSympathize,
  },
  {
    id: 'helpful',
    label: FEED_REACTION_LABELS.helpful,
    pastLabel: 'Helpful',
    title: 'Helpful',
    hint: 'Mark this as useful',
    Icon: IconHelpful,
  },
]

export function feedReactionPastLabel(id: FeedReactionId): string {
  return FEED_REACTION_OPTIONS.find((r) => r.id === id)?.pastLabel ?? FEED_REACTION_LABELS[id]
}

const VIEWER_SUMMARY_PHRASE: Record<FeedReactionId, string> = {
  love: 'loved this',
  respect: 'respected this',
  sympathize: 'sympathized with this',
  helpful: 'marked this helpful',
}

function lovedByNames(names: string[]): string {
  if (names.length === 1) return `Loved by ${names[0]}`
  if (names.length === 2) return `Loved by ${names[0]} and ${names[1]}`
  return `Loved by ${names[0]}, ${names[1]} and ${names[2]}`
}

function viewerReactionSummary(kind: FeedReactionId, kindCount: number): string {
  const phrase = VIEWER_SUMMARY_PHRASE[kind]
  const others = Math.max(0, kindCount - 1)
  if (others > 0) return `You and ${others} other${others === 1 ? '' : 's'} ${phrase}`
  return `You ${phrase}`
}

/** Honest engagement line — no invented counts or names. */
export function formatFeedEngagementSummary(input: {
  reactionCounts: FeedReactionCounts
  viewerReaction: FeedReactionId | null
  commentCount: number
  connectionPreview?: ConnectionLikerPreview[]
}): string | null {
  const { reactionCounts, viewerReaction, commentCount, connectionPreview = [] } = input
  const total = totalFeedReactionCount(reactionCounts)

  let reactionPart: string | null = null

  if (viewerReaction) {
    reactionPart = viewerReactionSummary(viewerReaction, reactionCounts[viewerReaction] ?? 0)
  } else if (connectionPreview.length > 0 && (reactionCounts.love ?? 0) > 0) {
    reactionPart = lovedByNames(connectionPreview.map((p) => p.username))
  } else if (total > 0) {
    reactionPart = `${total} ${total === 1 ? 'reaction' : 'reactions'}`
  }

  const commentPart =
    commentCount > 0 ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : null

  if (!reactionPart && !commentPart) return null
  if (reactionPart && commentPart) return `${reactionPart} · ${commentPart}`
  return reactionPart ?? commentPart
}
