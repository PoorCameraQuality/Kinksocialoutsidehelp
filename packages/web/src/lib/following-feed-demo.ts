import type { FollowingFeedItem, HomeFeedPost } from './feed-types.ts'

function demoMockImageUrl(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`
}

const LANDING_IMAGES = {
  beach: '/landing/sonny-ravesteijn-nQeR7JIGpOk.jpg',
  portrait: '/landing/marcin-sajur-3uwcD9V0O1k.jpg',
  mood: '/landing/happy-face-emoji-xo9Ho2tuRnU.jpg',
} as const

/** Automated / CI markers — hide from member-facing feed presentation. */
export function isAutomatedFeedBody(body: string | null | undefined): boolean {
  if (!body?.trim()) return false
  const text = body.trim()
  return (
    /^e2e[\s_-]/i.test(text) ||
    /\be2e-following-feed\b/i.test(text) ||
    /\be2e-load-more-/i.test(text) ||
    /\be2e-create-group\b/i.test(text)
  )
}

export function isAutomatedFeedPost(post: HomeFeedPost): boolean {
  if (post.source !== 'api') return false
  if (isAutomatedFeedBody(post.body)) return true
  if (post.title && isAutomatedFeedBody(post.title)) return true
  return false
}

function filterAutomatedPosts(posts: HomeFeedPost[]): HomeFeedPost[] {
  return posts.filter((p) => !isAutomatedFeedPost(p))
}

function filterAutomatedFollowingItems(items: FollowingFeedItem[]): FollowingFeedItem[] {
  return items.filter((item) => item.kind === 'activity' || !isAutomatedFeedPost(item.post))
}

function mockPost(
  id: string,
  authorUsername: string,
  body: string,
  timeAgo: string,
  opts?: {
    title?: string | null
    kind?: string
    attachments?: HomeFeedPost['attachments']
    likes?: number
    comments?: number
    repostOfId?: string | null
    quotedPost?: HomeFeedPost
    bodyFormat?: 'text' | 'html'
  },
): HomeFeedPost {
  return {
    id,
    authorUsername,
    authorAvatarUrl: null,
    kind: opts?.kind ?? 'status',
    title: opts?.title ?? null,
    body,
    bodyFormat: opts?.bodyFormat ?? 'text',
    attachments: opts?.attachments ?? [],
    mentions: [],
    repostOfId: opts?.repostOfId ?? null,
    quotedPost: opts?.quotedPost,
    timeAgo,
    likes: opts?.likes ?? 0,
    comments: opts?.comments ?? 0,
    source: 'mock',
  }
}

/** Curated posts for the home Local feed column. */
export function demoHomeFeedPosts(): HomeFeedPost[] {
  const campPost = mockPost(
    'demo-camp-crucible',
    'LeatherLuna',
    'Thinking about Camp Crucible this fall — anyone else locking in tickets? The rope track looks incredible.',
    '47m ago',
    {
      attachments: [{ type: 'image', url: LANDING_IMAGES.beach }],
      likes: 18,
      comments: 6,
    },
  )

  return [
    mockPost(
      'demo-munch-tonight',
      'SwitchBlade',
      'Munch tonight at the community center was lovely. Shout-out to the new folks who introduced themselves — you made the room warmer.',
      '2h ago',
      { likes: 24, comments: 9 },
    ),
    mockPost(
      'demo-rope-class',
      'ImpactTop',
      'Floor-work class recap: we drilled single-column ties and safety shears placement. Happy to share notes if you missed it.',
      '5h ago',
      {
        attachments: [{ type: 'image', url: demoMockImageUrl('c2k-demo-rope-class', 900, 600) }],
        likes: 41,
        comments: 11,
      },
    ),
    mockPost(
      'demo-repost-camp',
      'KinkyCurious',
      '',
      '6h ago',
      {
        kind: 'repost',
        repostOfId: campPost.id,
        quotedPost: campPost,
      },
    ),
    campPost,
    mockPost(
      'demo-etiquette',
      'SubmissiveSage',
      '<p>Quick dungeon etiquette reminder: ask before joining a scene, give space to aftercare, and wipe down your station when you are done.</p>',
      '8h ago',
      { bodyFormat: 'html', likes: 52, comments: 14 },
    ),
    mockPost(
      'demo-photo-set',
      'RiggerRick',
      'Posted a new photo set from last weekend’s rope social — consent and smiles all around.',
      '11h ago',
      {
        attachments: [{ type: 'image', url: LANDING_IMAGES.portrait }],
        likes: 67,
        comments: 19,
      },
    ),
    mockPost(
      'demo-vendor-shout',
      'GinaRiley',
      'Finally restocked jute in my shop — DM if you want a specific length before the convention rush.',
      '1d ago',
      { likes: 15, comments: 4 },
    ),
  ]
}

/** Curated Following feed mix: compact activities + full posts. */
export function demoFollowingFeedItems(): FollowingFeedItem[] {
  const posts = demoHomeFeedPosts()
  const postItems: FollowingFeedItem[] = posts.slice(0, 4).map((post, i) => ({
    kind: 'post' as const,
    cursor: `demo-post-${post.id}`,
    createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    deepLink: `/share/post/${post.id}`,
    post,
  }))

  const activities: FollowingFeedItem[] = [
    {
      kind: 'activity',
      verb: 'loved',
      cursor: 'demo-act-loved-batch',
      createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
      deepLink: '/home',
      actor: { id: 'demo-snizzle', username: 'Snizzle' },
      object: {
        type: 'media',
        count: 10,
        mediaKind: 'video',
        previewUrls: [
          LANDING_IMAGES.beach,
          LANDING_IMAGES.portrait,
          LANDING_IMAGES.mood,
          demoMockImageUrl('c2k-demo-loved-1', 400, 400),
          demoMockImageUrl('c2k-demo-loved-2', 400, 400),
        ],
      },
    },
    {
      kind: 'activity',
      verb: 'loved',
      cursor: 'demo-act-loved-single',
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
      deepLink: '/home',
      actor: { id: 'demo-holly', username: 'hollylutz' },
      object: {
        type: 'media',
        count: 1,
        mediaKind: 'picture',
        targetUsername: 'L-u-c-y',
        previewUrls: [LANDING_IMAGES.portrait],
      },
    },
    {
      kind: 'activity',
      verb: 'followed',
      cursor: 'demo-act-follow-batch',
      createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
      deepLink: '/home',
      actor: { id: 'demo-danial', username: 'Danial12' },
      object: {
        type: 'profile',
        count: 3,
        usernames: ['anguskink', 'TidyWiggly', 'CaughtPrincess26'],
      },
    },
    {
      kind: 'activity',
      verb: 'replied_discussion',
      cursor: 'demo-act-discussion',
      createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
      deepLink: '/groups/g1?tab=Forums',
      actor: { id: 'demo-maren', username: 'MarenasTouch' },
      object: {
        type: 'discussion',
        title: 'We are a week away from the event',
        excerpt: 'Remember to pack layers and your badge…',
        groupName: 'Mid-Atlantic Rope Collective',
      },
    },
    {
      kind: 'activity',
      verb: 'event_rsvp',
      cursor: 'demo-act-rsvp-batch',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      deepLink: '/events/2',
      actor: { id: 'demo-batch', username: 'RopeWeekend' },
      object: {
        type: 'event',
        id: '2',
        title: 'Rope Weekend',
        count: 5,
        usernames: ['SwitchBlade', 'LeatherLuna', 'ImpactTop', 'RiggerRick'],
        location: 'Baltimore, MD',
      },
    },
    {
      kind: 'activity',
      verb: 'added_vendor_product',
      cursor: 'demo-act-vendor',
      createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      deepLink: '/vendors/gina-riley',
      actor: { id: 'demo-gina', username: 'GinaRiley' },
      object: { type: 'product', count: 3, vendorName: 'Gina Riley Rope' },
    },
    {
      kind: 'activity',
      verb: 'published_class',
      cursor: 'demo-act-class',
      createdAt: new Date(Date.now() - 7 * 3600000).toISOString(),
      deepLink: '/education',
      actor: { id: 'demo-teach', username: 'ImpactTop' },
      object: { type: 'class', title: 'Negotiation for Scene Partners' },
    },
    {
      kind: 'activity',
      verb: 'connection_accepted',
      cursor: 'demo-act-connection',
      createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
      deepLink: '/profile/PhillyKink',
      actor: { id: 'demo-philly', username: 'PhillyKink' },
      object: { type: 'connection', partnerUsername: 'RopeDreamer' },
    },
    {
      kind: 'activity',
      verb: 'group_join',
      cursor: 'demo-act-group',
      createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
      deepLink: '/groups/g1',
      actor: { id: 'demo-luna', username: 'LeatherLuna' },
      object: { type: 'group', groupName: 'Mid-Atlantic Rope Collective' },
    },
    {
      kind: 'activity',
      verb: 'event_rsvp',
      cursor: 'demo-act-rsvp',
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      deepLink: '/events/2',
      actor: { id: 'demo-blade', username: 'SwitchBlade' },
      object: {
        type: 'event',
        id: '2',
        title: 'TES Fest',
        startsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        location: 'Philadelphia, PA',
        imageUrl: demoMockImageUrl('c2k-demo-tes-fest', 1200, 600),
      },
    },
    {
      kind: 'activity',
      verb: 'convention_pin',
      cursor: 'demo-act-convention',
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      deepLink: '/conventions/camp-crucible',
      actor: { id: 'demo-rick', username: 'RiggerRick' },
      object: { type: 'convention', title: 'Camp Crucible' },
    },
  ]

  return [...activities.slice(0, 4), ...postItems, ...activities.slice(4)]
}

export type PresentFeedOptions = {
  /** When true, pad sparse/empty feeds with curated demo content (local layout QA only). */
  allowDemoPadding?: boolean
}

export function presentHomeFeedPosts(posts: HomeFeedPost[], options?: PresentFeedOptions): HomeFeedPost[] {
  const real = filterAutomatedPosts(posts)
  if (!options?.allowDemoPadding) {
    return real
  }

  const hadNoise = real.length < posts.length

  if (real.length === 0 || hadNoise) {
    return [...demoHomeFeedPosts(), ...real]
  }
  if (real.length < 5) {
    return [...demoHomeFeedPosts().slice(0, 5 - real.length), ...real]
  }
  return real
}

export function presentFollowingFeedItems(
  items: FollowingFeedItem[],
  options?: PresentFeedOptions,
): FollowingFeedItem[] {
  const real = filterAutomatedFollowingItems(items)
  if (!options?.allowDemoPadding) {
    return real
  }

  const hadNoise = real.length < items.length

  if (real.length === 0 || hadNoise) {
    return [...demoFollowingFeedItems(), ...real]
  }
  if (real.length < 6) {
    return [...demoFollowingFeedItems().slice(0, 6 - real.length), ...real]
  }
  return real
}
