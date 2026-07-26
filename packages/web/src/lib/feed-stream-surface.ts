import type { HomeFeedPost } from '@/lib/feed-types'

export type FeedStreamPostSurface = 'direct' | 'secondary'

/** Direct author posts vs reposts / relayed activity in the home feed stream. */
export function feedStreamPostSurface(
  post: HomeFeedPost,
  opts: { isRepost: boolean; streamVerb: string | null },
): FeedStreamPostSurface {
  if (opts.isRepost || post.kind === 'repost' || post.repostOfId) return 'secondary'
  if (opts.streamVerb) return 'secondary'
  return 'direct'
}

export function feedStreamPostSurfaceClass(surface: FeedStreamPostSurface): string {
  return surface === 'direct' ? 'feed-stream-post--direct' : 'feed-stream-post--secondary'
}
