import { feedAttachmentSchema } from '@c2k/shared'
import type { FeedReactionId, AlphaContentLabel } from '@c2k/shared'
import { emptyFeedReactionCounts } from '@c2k/shared'
import type { MockLocalPost } from '@/data/types'
import { getMockPersonByUsername } from '@/data/mock-seeds'
import type { ApiFeedHomeCard, ApiFollowingFeedItem, FeedAttachment, FeedMention, FeedPostCommentPreview, FollowingFeedItem, HomeFeedPost } from './feed-types'
import type { FeedReactionCounts } from '@/hooks/useFeedPostReactions'
function timeAgoFromIso(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  if (Number.isNaN(ms)) return ''
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'Just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`
  return d.toLocaleDateString()
}

export type ApiFeedPost = {
  id: string
  authorUsername: string
  authorAvatarUrl?: string | null
  authorTrustScore?: number
  kind: string
  title: string | null
  body: string
  bodyFormat: string
  attachments: unknown
  mentions: unknown
  repostOfId: string | null
  quotedPost?: ApiFeedPost | null
  createdAt: string
  likeCount?: number
  likedByViewer?: boolean
  reactionCounts?: FeedReactionCounts
  viewerReaction?: FeedReactionId | null
  commentCount?: number
  commentPreview?: FeedPostCommentPreview | null
  connectionLikerPreview?: Array<{ username: string; avatarUrl?: string | null }>
  alphaLabel?: AlphaContentLabel
}

function parseAttachments(raw: unknown): FeedAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: FeedAttachment[] = []
  for (const entry of raw) {
    const parsed = feedAttachmentSchema.safeParse(entry)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}
function parseMentions(raw: unknown): FeedMention[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is FeedMention =>
      !!x && typeof x === 'object' && typeof (x as FeedMention).label === 'string' && typeof (x as FeedMention).type === 'string'
  )
}

export function apiPostToHomeFeedPost(p: ApiFeedPost): HomeFeedPost {
  return {
    id: p.id,
    authorUsername: p.authorUsername,
    authorAvatarUrl: p.authorAvatarUrl ?? null,
    authorTrustScore: p.authorTrustScore ?? 0,
    kind: p.kind,
    title: p.title,
    body: p.body,
    bodyFormat: p.bodyFormat === 'html' ? 'html' : 'text',
    attachments: parseAttachments(p.attachments),
    mentions: parseMentions(p.mentions),
    repostOfId: p.repostOfId,
    quotedPost: p.quotedPost ? apiPostToHomeFeedPost(p.quotedPost) : undefined,
    createdAt: p.createdAt,
    timeAgo: timeAgoFromIso(p.createdAt),
    likes: p.likeCount ?? 0,
    likedByViewer: p.likedByViewer ?? false,
    reactionCounts: p.reactionCounts ?? emptyFeedReactionCounts(),
    viewerReaction: p.viewerReaction ?? null,
    connectionLikerPreview: p.connectionLikerPreview ?? [],
    alphaLabel: p.alphaLabel,
    comments: p.commentCount ?? 0,
    commentPreview: p.commentPreview ?? null,
    source: 'api',
  }
}

export function apiFeedHomeCardToFeedItem(card: ApiFeedHomeCard): FollowingFeedItem | null {
  if (card.cardType === 'post' && card.post) {
    const raw = card.post as ApiFeedPost
    return {
      kind: 'post',
      cursor: card.cursor,
      createdAt: card.createdAt,
      deepLink: card.deepLink,
      post: apiPostToHomeFeedPost({
        ...raw,
        createdAt: raw.createdAt ?? card.createdAt,
        alphaLabel: card.alphaLabel ?? raw.alphaLabel,
      }),
    }
  }
  if (card.cardType === 'activity' && card.verb) {
    return {
      kind: 'activity',
      verb: card.verb,
      cursor: card.cursor,
      createdAt: card.createdAt,
      deepLink: card.deepLink,
      actor: card.actor,
      object: {
        ...(card.object ?? {}),
        ...(card.reasonText ? { feedStreamReason: card.reasonText } : {}),
        ...(card.alphaLabel ? { alphaLabel: card.alphaLabel } : {}),
      },
    }
  }
  return null
}

export function apiFollowingItemToFeedItem(row: ApiFollowingFeedItem): FollowingFeedItem | null {
  if (row.kind === 'post' && row.post) {
    return {
      kind: 'post',
      cursor: row.cursor,
      createdAt: row.createdAt,
      deepLink: row.deepLink,
      post: apiPostToHomeFeedPost(row.post as ApiFeedPost),
    }
  }
  if (row.kind === 'activity' && row.verb) {
    return {
      kind: 'activity',
      verb: row.verb,
      cursor: row.cursor,
      createdAt: row.createdAt,
      deepLink: row.deepLink,
      actor: row.actor,
      object: row.object,
    }
  }
  return null
}
export function mockLocalPostToHome(p: MockLocalPost): HomeFeedPost {
  const attachments: FeedAttachment[] = [
    ...(p.imageUrls ?? []).map((url) => ({ type: 'image' as const, url })),
    ...(p.audioUrls ?? []).map((url) => ({ type: 'audio' as const, url })),
  ]
  return {
    id: p.id,
    authorUsername: p.authorUsername,
    authorAvatarUrl: getMockPersonByUsername(p.authorUsername)?.avatarUrl ?? null,
    authorTrustScore: p.authorTrustScore ?? 0,
    kind: p.kind ?? 'status',
    title: p.title ?? null,
    body: p.text,
    bodyFormat: 'text',
    attachments,
    mentions: [],
    repostOfId: null,
    timeAgo: p.timeAgo,
    likes: p.likes,
    comments: p.comments,
    source: 'mock',
  }
}
