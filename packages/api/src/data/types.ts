/**
 * Mock data types. Shared across mock-seeds, mock-mutations, and consumers.
 */

/** Reputation badge ids - keep in sync with BadgeDisplay labels. */
export type BadgeId =
  | 'event_verified'
  | 'mentor'
  | 'community_contributor'
  | 'education_completed'
  | 'verified_id'
  | 'vendor_verified'
  | 'community_trusted'

export type TrustRingScores = {
  eventReliability?: number
  consentSafety?: number
  skill?: number
  contribution?: number
  vendorHost?: number
}

export type TrustTier = 'bronze' | 'silver' | 'gold'

export function getTrustTierFromScore(score: number): TrustTier {
  if (score >= 70) return 'gold'
  if (score >= 40) return 'silver'
  return 'bronze'
}

export type MockProfilePhoto = {
  id: string
  url?: string
  caption?: string
  order: number
  tags?: string[]
}

export type MockPerson = {
  id: string
  username: string
  roles: string[]
  trustScore: number
  trustTier: TrustTier
  trustSegments?: TrustRingScores
  sexuality?: string
  verified: boolean
  mutualCount: number
  distance: string
  location?: string
  badges?: BadgeId[]
  bio?: string
  avatarUrl?: string
  profilePhotos?: MockProfilePhoto[]
}

export type MockEndorsement = {
  id: string
  endorsedUsername: string
  endorserUsername: string
  endorserTrustScore: number
  endorserBadges?: BadgeId[]
  note?: string
  createdAt: string
}

/** In-app notification row (mock; no push). */
export type MockNotification = {
  id: string
  kind: 'rsvp' | 'mention' | 'group' | 'event' | 'system'
  title: string
  body: string
  timeAgo: string
  href?: string
  read: boolean
}

export type MockEvent = {
  id: number
  title: string
  date: string
  location: string
  rsvpCount: number
  hostVerified: boolean
  groupId?: string
  imageUrl?: string | null
  hostName?: string
  description?: string
  rules?: string
  dressCode?: string
  consentPolicy?: string
  category?: string
  tags?: string[]
  /** In-person vs online; used for events list filter (mock). */
  eventFormat?: 'in-person' | 'virtual'
}

export type MockVendor = {
  id: number
  name: string
  categories: string[]
  rating: number
  verifiedFeedbackCount?: number
  shipsTo: string
  upcomingEvents: number
  shopUrl?: string
  description?: string
  upcomingEventList?: Array<{ id: number; title: string; date: string; location: string; rsvpCount: number; hostVerified: boolean }>
}

export type MockArticle = {
  id: number
  title: string
  category: string
  readTime: string
  credibilityScore: number
  slug: string
  tags?: string[]
  /** Plain text body with optional ## section headings (used on article detail) */
  content: string
  author: { username: string; trustScore: number }
}

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'event_host' | 'vetted' | 'member'

export type MockGroup = {
  id: string
  name: string
  members: number
  description?: string
  slug?: string
  location?: string
  visibility?: 'public' | 'private' | 'invite-only'
  createdAt?: string
  tags?: string[]
}

export type MockGroupMember = {
  groupId: string
  userId: string
  username: string
  role: GroupRole
  joinedAt: string
}

export type MockGroupChannel = {
  id: string
  groupId: string
  name: string
  isVettedOnly?: boolean
}

export type MockGroupPost = {
  id: string
  channelId: string
  authorUsername: string
  title: string
  content: string
  createdAt: string
  tags?: string[]
  isPinned?: boolean
}

export type MockGroupPhoto = {
  id: string
  groupId: string
  url?: string
  caption?: string
  authorUsername: string
  approvedAt?: string
  status: 'pending' | 'approved' | 'denied'
  submittedAt: string
  deniedReason?: string
  tags?: string[]
}

export type MockLocalPost = {
  id: string
  authorUsername: string
  authorTrustScore: number
  text: string
  timeAgo: string
  likes: number
  comments: number
  tags?: string[]
}

export type MockResource = {
  id: string
  groupId: string
  name: string
  link: string
  type: string
}

export type MockContentByTag = {
  photos: Array<MockGroupPhoto | (MockProfilePhoto & { authorUsername: string; groupId?: string })>
  events: MockEvent[]
  groups: MockGroup[]
  articles: MockArticle[]
  discussions: MockGroupPost[]
  writings: MockLocalPost[]
}
