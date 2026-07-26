/**
 * Rich mock data for /home tab rails and catalogues when API is off or empty.
 * Keep in sync with UX expectations in the home-feed plan (vendors, education, trending, groups).
 */
import type { HomeFeedPost } from '@/lib/feed-types'
import type { MockArticle, MockGroup, MockGroupPost } from './types'
import {
  demoMockImageUrl,
  mockArticles,
  mockEvents,
  mockGroupChannels,
  mockGroupPosts,
  mockGroups,
  mockPeople,
  mockVendors,
  MOCK_VIEWER_USERNAME,
} from './mock-seeds'

export type MockConventionHome = {
  id: string
  slug: string
  name: string
  anchorEventId: string | null
  /** ISO timestamps for multi-day display; optional for legacy mocks. */
  startsAt?: string
  endsAt?: string
  kind?: 'convention' | 'hotel_takeover'
}

export type MockHomeTrendingItem = {
  kind: string
  id: string
  title: string
  subtitle?: string
  href: string
  /** Optional thumbnail for home Trending list (HTTPS URL). */
  imageUrl?: string | null
  /** When there is no image, optional inline audio (HTTPS URL). */
  audioPreviewUrl?: string | null
}

export type MockVendorSpotlightHome = {
  vendorId: string
  vendorSlug: string
  shopName: string
  logoUrl: string | null
  listingTitle: string
  listingImageUrl?: string | null
}

export type MockVendorInPersonHome = {
  vendorId: string
  slug: string
  displayName: string
  logoUrl: string | null
  eventId: string | number
  eventTitle: string
  startsAt: string
}

export type MockCoSuggestHome = {
  userId: string
  username: string
  displayName: string | null
  trustScore: number
  verified: boolean
  sharedCount?: number
  age?: number | null
  location?: string | null
  avatarUrl?: string | null
  lastActiveAt?: string | null
}

export const mockHomeConventions: MockConventionHome[] = [
  {
    id: 'conv-mock-1',
    slug: 'mid-atlantic-rigger-con-2025',
    name: 'Mid-Atlantic Rigger Con 2025',
    anchorEventId: null,
    startsAt: '2026-09-18T14:00:00.000Z',
    endsAt: '2026-09-21T23:00:00.000Z',
    kind: 'convention',
  },
  {
    id: 'conv-mock-2',
    slug: 'dark-spring-weekend',
    name: 'Dark Spring Weekend',
    anchorEventId: null,
    startsAt: '2026-04-11T16:00:00.000Z',
    endsAt: '2026-04-13T14:00:00.000Z',
    kind: 'hotel_takeover',
  },
  {
    id: 'conv-mock-3',
    slug: 'coastal-education-summit',
    name: 'Coastal Education Summit',
    anchorEventId: null,
    startsAt: '2026-08-21T13:00:00.000Z',
    endsAt: '2026-08-24T12:00:00.000Z',
    kind: 'convention',
  },
  {
    id: 'conv-mock-4',
    slug: 'pride-rope-festival',
    name: 'Pride Rope Festival',
    anchorEventId: null,
    startsAt: '2026-07-24T15:00:00.000Z',
    endsAt: '2026-07-27T22:00:00.000Z',
    kind: 'hotel_takeover',
  },
]

const LISTING_TITLES = [
  'Deluxe jute rope set (8mm)',
  'Leather cuff set. Adjustable',
  'Signature impact flogger',
  'Safety shears + aftercare kit',
  'Custom dyed hemp starter kit',
  'Lockable day collar',
  'Suspension ring hardware pack',
  'Beginner bondage workbook',
]

/** Extra education items (videos / presentations) merged into the Education tab mock catalogue. */
export const mockEducationExtras: MockArticle[] = [
  {
    id: 901,
    title: 'Double-column tie: video walkthrough',
    category: 'Gear',
    readTime: '12 min video',
    credibilityScore: 88,
    slug: 'video-double-column-tie',
    tags: ['rope', 'tutorial'],
    content: '## Video\n\nPlaceholder for embedded video content.',
    author: { username: 'RopeEducator', trustScore: 92 },
    contentType: 'video',
    durationLabel: '12:04',
    thumbnailUrl: demoMockImageUrl('c2k-edu-extra-901', 480, 270),
  },
  {
    id: 902,
    title: 'Negotiation checklist. Workshop recording',
    category: 'Psychology',
    readTime: '45 min video',
    credibilityScore: 91,
    slug: 'video-negotiation-workshop',
    tags: ['consent', 'basics'],
    content: '## Recording\n\nFull workshop playback.',
    author: { username: 'ConsentCoach', trustScore: 95 },
    contentType: 'video',
    durationLabel: '44:18',
    thumbnailUrl: demoMockImageUrl('c2k-edu-extra-902', 480, 270),
  },
  {
    id: 903,
    title: 'Floor work sequences. Slide deck',
    category: 'Advanced',
    readTime: '24 slides',
    credibilityScore: 86,
    slug: 'presentation-floor-sequences',
    tags: ['rope', 'presentation'],
    content: '## Slides\n\nPresenter notes and diagrams.',
    author: { username: 'PresenterNova', trustScore: 89 },
    contentType: 'presentation',
    durationLabel: 'Slide deck',
    thumbnailUrl: demoMockImageUrl('c2k-edu-extra-903', 480, 270),
  },
  {
    id: 904,
    title: 'Aftercare for intense scenes. Mini-class',
    category: 'Psychology',
    readTime: '20 min video',
    credibilityScore: 90,
    slug: 'video-aftercare-mini',
    tags: ['aftercare'],
    content: '## Mini-class\n\nShort educational video.',
    author: { username: 'TherapyKink', trustScore: 87 },
    contentType: 'video',
    durationLabel: '19:42',
    thumbnailUrl: demoMockImageUrl('c2k-edu-extra-904', 480, 270),
  },
]

export function getMockEducationCatalog(): MockArticle[] {
  return [...mockArticles, ...mockEducationExtras].sort((a, b) => (b.credibilityScore ?? 0) - (a.credibilityScore ?? 0))
}

export function getPublicGroupDiscussionPeek(limit = 5): { gp: MockGroupPost; groupName: string }[] {
  const publicGroupIds = new Set(mockGroups.filter((g) => g.visibility === 'public').map((g) => g.id))
  return [...mockGroupPosts]
    .filter((p) => {
      const ch = mockGroupChannels.find((c) => c.id === p.channelId)
      return ch && publicGroupIds.has(ch.groupId)
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((gp) => {
      const ch = mockGroupChannels.find((c) => c.id === gp.channelId)
      const g = ch ? mockGroups.find((x) => x.id === ch.groupId) : undefined
      return { gp, groupName: g?.name ?? 'Group' }
    })
}

export function mockCoAttendanceSuggestions(): MockCoSuggestHome[] {
  const avoid = new Set([MOCK_VIEWER_USERNAME])
  return mockPeople
    .filter((p) => !avoid.has(p.username))
    .slice(0, 8)
    .map((p, i) => ({
      userId: p.id,
      username: p.username,
      displayName: p.sceneName ?? null,
      trustScore: p.trustScore,
      verified: p.verified,
      sharedCount: 1 + (i % 4),
      age: p.age,
      location: p.location ?? null,
      avatarUrl: p.avatarUrl ?? null,
      lastActiveAt: p.lastActiveAt ?? null,
    }))
}

export function mockNearbyPeopleSuggestions(): MockCoSuggestHome[] {
  return mockPeople
    .filter((p) => p.username !== MOCK_VIEWER_USERNAME)
    .slice(8, 32)
    .map((p) => ({
      userId: p.id,
      username: p.username,
      displayName: p.sceneName ?? null,
      trustScore: p.trustScore,
      verified: p.verified,
      age: p.age,
      location: p.location ?? null,
      avatarUrl: p.avatarUrl ?? null,
      lastActiveAt: p.lastActiveAt ?? null,
    }))
}

function pickListingTitle(i: number): string {
  return LISTING_TITLES[i % LISTING_TITLES.length]
}

export function mockVendorSpotlightListings(): MockVendorSpotlightHome[] {
  return mockVendors.slice(0, 10).map((v, i) => ({
    vendorId: String(v.id),
    vendorSlug: String(v.id),
    shopName: v.name,
    logoUrl: v.logoUrl ?? null,
    listingTitle: v.featuredListingTitle ?? pickListingTitle(i),
    listingImageUrl: v.listingImageUrl ?? null,
  }))
}

export function mockVendorInPersonRows(): MockVendorInPersonHome[] {
  const events = mockEvents.filter((e) => e.eventFormat !== 'virtual').slice(0, 8)
  return mockVendors.slice(0, events.length).map((v, i) => {
    const ev = events[i] ?? mockEvents[i % mockEvents.length]
    return {
      vendorId: String(v.id),
      slug: String(v.id),
      displayName: v.name,
      logoUrl: v.logoUrl ?? null,
      eventId: ev.id,
      eventTitle: ev.title,
      startsAt: ev.startsAt ?? ev.date,
    }
  })
}

/** Randomized carousel of one listing per shop for the Vendors rail ("suggested picks"). */
export function mockVendorListingCarousel(seed = 0): MockVendorSpotlightHome[] {
  const shuffled = [...mockVendors].sort((a, b) => {
    const ha = (a.id.toString().charCodeAt(0) + seed) % 7
    const hb = (b.id.toString().charCodeAt(0) + seed) % 7
    return ha - hb
  })
  return shuffled.slice(0, 8).map((v, i) => ({
    vendorId: String(v.id),
    vendorSlug: String(v.id),
    shopName: v.name,
    logoUrl: v.logoUrl ?? null,
    listingTitle: v.featuredListingTitle ?? pickListingTitle(i + seed),
    listingImageUrl: v.listingImageUrl ?? null,
  }))
}

export function mockTrendingMixedFeed(): MockHomeTrendingItem[] {
  /** Demo-only mix - mirrors API kinds (feed, event, education, group, vendor). */
  const items: MockHomeTrendingItem[] = []
  mockEvents.slice(0, 3).forEach((e) => {
    items.push({
      kind: 'event',
      id: String(e.id),
      title: e.title,
      subtitle: e.location,
      href: `/events/${e.id}`,
      imageUrl: e.imageUrl ?? e.bannerUrl ?? null,
    })
  })
  mockArticles.slice(0, 2).forEach((a) => {
    items.push({
      kind: 'education_article',
      id: String(a.id),
      title: a.title,
      subtitle: `@${a.author.username}`,
      href: `/education/${a.slug}`,
      imageUrl: a.thumbnailUrl ?? null,
    })
  })
  mockEducationExtras.slice(0, 2).forEach((a) => {
    items.push({
      kind: `education_${a.contentType ?? 'article'}`,
      id: String(a.id),
      title: a.title,
      subtitle: a.contentType === 'video' ? 'Video' : a.contentType === 'presentation' ? 'Presentation' : 'Read',
      href: `/education/${a.slug}`,
      imageUrl: a.thumbnailUrl ?? null,
    })
  })
  mockGroups
    .filter((g) => g.visibility === 'public')
    .slice(0, 2)
    .forEach((g) => {
      items.push({
        kind: 'group',
        id: g.id,
        title: g.name,
        subtitle: `${g.members} members`,
        href: `/groups/${g.id}`,
        imageUrl: g.coverImageUrl ?? null,
      })
    })
  mockVendors.slice(0, 2).forEach((v) => {
    items.push({
      kind: 'vendor',
      id: String(v.id),
      title: v.name,
      subtitle: (v.categories ?? []).slice(0, 2).join(' · '),
      href: `/vendors/${v.id}`,
      imageUrl: v.listingImageUrl ?? v.logoUrl ?? null,
    })
  })
  items.push({
    kind: 'feed_status',
    id: 'p-demo-hot',
    title: 'Weekend munch. Who’s heading to Shippensburg?',
    subtitle: '@RopeDreamer',
    href: '/home?tab=Local',
    imageUrl: demoMockImageUrl('trending-feed-hot', 640, 400),
  })
  items.push({
    kind: 'feed_status',
    id: 'p-trending-short',
    title: 'See you at the munch.',
    subtitle: '@RopeDreamer',
    href: '/home?tab=Local',
  })
  items.push({
    kind: 'feed_status',
    id: 'p-trending-audio',
    title: 'Quick note on aftercare. Short listen.',
    subtitle: '@PacificSwitch',
    href: '/home?tab=Local',
    audioPreviewUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
  })
  // Shuffle-ish stable order by kind for visual variety
  return items.sort((a, b) => (a.kind + a.id).localeCompare(b.kind + b.id))
}

export type MockUpcomingClassHome = {
  id: string
  title: string
  formatLabel: string
  href: string
}

export function mockUpcomingClassesRail(): MockUpcomingClassHome[] {
  return [
    {
      id: 'class-1',
      title: 'Rope 101. Convention track',
      formatLabel: 'In person · MA Rigger Con',
      href: '/conventions/mid-atlantic-rigger-con-2025',
    },
    {
      id: 'class-2',
      title: 'Consent frameworks. Online',
      formatLabel: 'Online · Sat 2pm ET',
      href: '/education/video-negotiation-workshop',
    },
    {
      id: 'class-3',
      title: 'Munch hosts roundtable',
      formatLabel: 'Hybrid · Zoom + Philly',
      href: '/events/1',
    },
  ]
}

/** Groups promoted in “Join a group” with join semantics for mock UI. */
export function mockGroupsForHomeJoin(): MockGroup[] {
  return mockGroups.filter((g) => g.visibility === 'public').slice(0, 6)
}

/** Rich HTML posts prepended to the Local feed in demo mode (no API). */
export function mockRichLocalFeedPosts(): HomeFeedPost[] {
  const p = mockPeople[0]
  const q = mockPeople[3]
  return [
    {
      id: 'mock-rich-1',
      authorUsername: p?.username ?? 'RopeMaven',
      authorAvatarUrl: p?.avatarUrl ?? null,
      authorTrustScore: p?.trustScore ?? 88,
      kind: 'status',
      title: null,
      body: '<p>Anyone tried the new <strong>floor-harness</strong> class at the community center? Worth it?</p>',
      bodyFormat: 'html',
      attachments: [{ type: 'image', url: demoMockImageUrl('c2k-rich-feed-workshop', 900, 600) }],
      mentions: [],
      repostOfId: null,
      timeAgo: '20m ago',
      likes: 14,
      comments: 5,
      source: 'mock',
    },
    {
      id: 'mock-rich-2',
      authorUsername: q?.username ?? 'LeatherCraft',
      authorAvatarUrl: q?.avatarUrl ?? null,
      authorTrustScore: q?.trustScore ?? 76,
      kind: 'article',
      title: 'Pop-up dungeon etiquette (short read)',
      body: '<p>Quick reminders: <em>watch</em>, don’t interrupt, and sanitize stations when you’re done.</p><ul><li>Ask before joining a scene</li><li>Keep volume reasonable</li></ul>',
      bodyFormat: 'html',
      attachments: [{ type: 'image', url: demoMockImageUrl('c2k-rich-feed-etiquette', 900, 550) }],
      mentions: [],
      repostOfId: null,
      timeAgo: '2h ago',
      likes: 31,
      comments: 8,
      source: 'mock',
    },
  ]
}
