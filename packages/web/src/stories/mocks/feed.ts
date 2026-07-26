import { emptyFeedReactionCounts, type FeedReactionId } from '@c2k/shared'
import type { HomeFeedPost } from '@/lib/feed-types'
import { demoMockImageUrl } from '@/data/mock-seeds'

const STORY_AUTHOR = 'RopeDreamer'

function basePost(overrides: Partial<HomeFeedPost>): HomeFeedPost {
  return {
    id: 'story-post-1',
    authorUsername: STORY_AUTHOR,
    authorAvatarUrl: null,
    kind: 'status',
    title: null,
    body: 'Looking forward to the regional munch this weekend. Who else is going?',
    bodyFormat: 'text',
    attachments: [],
    mentions: [],
    repostOfId: null,
    timeAgo: '2h ago',
    likes: 0,
    comments: 0,
    source: 'mock',
    ...overrides,
  }
}

export const storyFeedPostText: HomeFeedPost = basePost({})

export const storyFeedPostShort: HomeFeedPost = basePost({
  id: 'story-post-short',
  body: 'Quick hello from the community!',
})

export const storyFeedPostLong: HomeFeedPost = basePost({
  id: 'story-post-long',
  body: `I've been thinking about how we build safer spaces at mixed-experience events.

When you're newer, it helps to know who is hosting, what the door process looks like, and where to ask questions without feeling put on the spot. When you're experienced, naming expectations clearly — especially around photography, aftercare, and negotiation — makes the whole room calmer.

What practices have you seen work well at local munches or workshops?`,
})

export const storyFeedPostPhoto: HomeFeedPost = basePost({
  id: 'story-post-photo',
  body: 'Rope lab notes from tonight — still working on clean tension transitions.',
  attachments: [
    {
      type: 'image',
      url: demoMockImageUrl('story-rope-lab', 960, 640),
    },
  ],
})

export const storyFeedPostWithReaction = (kind: FeedReactionId): HomeFeedPost => {
  const counts = emptyFeedReactionCounts()
  counts[kind] = 3
  return basePost({
    id: `story-post-${kind}`,
    reactionCounts: counts,
    viewerReaction: kind,
    comments: 2,
    commentPreview: {
      id: 'c1',
      authorDisplayName: 'Alex',
      authorUsername: 'AlexScene',
      bodyPreview: 'Thanks for sharing this — super helpful.',
      createdAt: new Date().toISOString(),
    },
  })
}

export const storyFeedPostNoEngagement: HomeFeedPost = basePost({
  id: 'story-post-quiet',
  likes: 0,
  comments: 0,
  reactionCounts: emptyFeedReactionCounts(),
  viewerReaction: null,
})

export function storyReactionCounts(active: FeedReactionId | null = null) {
  const counts = emptyFeedReactionCounts()
  if (active) counts[active] = 4
  counts.respect = 2
  return counts
}
