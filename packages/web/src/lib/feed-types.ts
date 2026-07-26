import type { FeedReactionId, AlphaContentLabel, FeedAttachment } from '@c2k/shared'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'

export type { FeedAttachment }
export type FeedMention = { type: string; id?: string; slug?: string; label: string }

export type ConnectionLikerPreview = { username: string; avatarUrl?: string | null }

export type FeedPostCommentPreview = {
  id: string
  authorDisplayName: string
  authorUsername?: string
  authorAvatarUrl?: string | null
  bodyPreview: string
  createdAt: string
}

/** Unified post for home Local feed, trending, share page, and profile journal. */
export type HomeFeedPost = {
  id: string
  authorUsername: string
  authorAvatarUrl?: string | null
  /** @deprecated Phase 0 - not returned by API; mock-only */
  authorTrustScore?: number
  kind: string
  title: string | null
  body: string
  bodyFormat: 'text' | 'html'
  attachments: FeedAttachment[]
  mentions: FeedMention[]
  repostOfId: string | null
  quotedPost?: HomeFeedPost
  createdAt?: string
  timeAgo: string
  likes: number
  likedByViewer?: boolean
  reactionCounts?: FeedReactionCounts
  viewerReaction?: FeedReactionId | null
  connectionLikerPreview?: ConnectionLikerPreview[]
  comments: number
  commentPreview?: FeedPostCommentPreview | null
  source: 'api' | 'mock'
  alphaLabel?: AlphaContentLabel
}

export type FollowingFeedActor = {
  id: string
  username: string
  /** @deprecated Phase 0 - not returned by API */
  trustScore?: number
}

export type ApiFollowingFeedItem = {
  kind: 'post' | 'activity'
  verb?: string
  cursor: string
  createdAt: string
  deepLink: string
  actor: FollowingFeedActor
  object?: Record<string, unknown>
  post?: Record<string, unknown>
}

export type ApiFeedHomeCard = {
  id: string
  cardType: 'post' | 'activity'
  layout: 'full' | 'compact'
  cursor: string
  createdAt: string
  deepLink: string
  actor: FollowingFeedActor
  verb?: string
  post?: Record<string, unknown>
  object?: Record<string, unknown>
  reasonText?: string | null
  alphaLabel?: AlphaContentLabel | null
}

export type FollowingFeedItem =
  | { kind: 'post'; cursor: string; createdAt: string; deepLink: string; post: HomeFeedPost }
  | {
      kind: 'activity'
      verb: string
      cursor: string
      createdAt: string
      deepLink: string
      actor: FollowingFeedActor
      object?: Record<string, unknown>
    }
