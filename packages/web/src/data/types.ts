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
  displaySettings?: import('@c2k/shared').ProfilePhotoDisplaySettings
  tags?: string[]
}

export type MockPerson = {
  id: string
  username: string
  /** Scene / display name - safe for People cards (no gender). */
  sceneName?: string
  /** ISO 8601 - drives activity badge on People cards. */
  lastActiveAt?: string
  age?: number
  roles: string[]
  trustScore: number
  trustTier: TrustTier
  trustSegments?: TrustRingScores
  /** Kept for full profile / edit only - never show on PersonCard preview. */
  sexuality?: string
  /** Optional; used for Advanced Search gender filter when using mock people. */
  gender?: string
  verified: boolean
  mutualCount: number
  distance: string
  location?: string
  badges?: BadgeId[]
  bio?: string
  avatarUrl?: string
  profilePhotos?: MockProfilePhoto[]
  /** Co-attendance suggestions API only. */
  sharedEventsCount?: number
  mutualGroupsCount?: number
  hostedEventsCount?: number
  publishedArticlesCount?: number
  /** When set, drives Message vs Connect on People directory cards. */
  connectionStatus?: 'connected' | 'pending_outgoing' | 'pending_incoming' | null
  /** When true, allow Message without a connection (privacy / DM settings). */
  canMessageDirectly?: boolean
  /** Directory card activity counts (API or mock). */
  photoCount?: number
  videoCount?: number
  writingCount?: number
  groupsLedCount?: number
  /** Published vendor shop slug when this person has a PUBLIC vendor_profiles row. */
  vendorShopSlug?: string | null
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
  /** ISO timestamp from API rows; used for inbox day grouping when present. */
  createdAtIso?: string
  href?: string
  read: boolean
  /** Actor handle when notification involves another member. */
  actorUsername?: string
  actorAvatarUrl?: string | null
}

export type MockEvent = {
  id: number | string
  title: string
  date: string
  location: string
  rsvpCount: number
  /** Optional event capacity set by host/creator. */
  capacityLimit?: number
  /** Number of your accepted connections marked as going. */
  mutualGoingCount?: number
  /** Up to 3 connection avatars who RSVP'd going (most recent first). */
  connectionRsvpPreview?: Array<{ username: string; avatarUrl?: string | null }>
  hostVerified: boolean
  groupId?: string
  /** Hero image on event cards (direct HTTPS URL). */
  imageUrl?: string | null
  /** Optional wide banner when `imageUrl` unset (mock/CDN). */
  bannerUrl?: string | null
  hostName?: string
  description?: string
  rules?: string
  dressCode?: string
  consentPolicy?: string
  category?: string
  tags?: string[]
  /** In-person vs online; used for events list filter (mock). */
  eventFormat?: 'in-person' | 'virtual'
  /** ISO start time from API (optional); used for sorting when `date` is human-formatted. */
  startsAt?: string
  /** Organizer-curated spotlight on browse grids. */
  featured?: boolean
  featuredUntil?: string | null
  isFeatured?: boolean
  alphaLabel?: import('@c2k/shared').AlphaContentLabel
}

export type MockVendor = {
  id: number | string
  /** When set, `getMockVendorById(slug)` can resolve this row without the API. */
  slug?: string
  name: string
  /** Canonical purpose category from @c2k/shared. */
  category?: string | null
  /** Freeform specialty tags. */
  tags?: string[]
  categories: string[]
  rating: number
  verifiedFeedbackCount?: number
  shipsTo: string
  /** @deprecated Not shown in UI - no platform verification workflow yet. */
  verified?: boolean
  upcomingEvents: number
  /** Demo: vendor also tabling at a convention (banner on home cards). */
  conventionSlot?: { conventionName: string; dateLabel: string; eventCount?: number }
  /** Featured product line for carousels / spotlight. */
  featuredListingTitle?: string
  featuredListingPriceCents?: number
  featuredListingCurrency?: string
  /** Deprioritize in geographic “near you” sorts when true. */
  onlineOnly?: boolean
  shopUrl?: string
  description?: string
  logoUrl?: string | null
  bannerUrl?: string | null
  /** Matches API `vendor_profiles.shop_header_layout` (mock fallback). */
  shopHeaderLayout?: 'OVERLAY' | 'BELOW'
  /** Small product image for feature line / carousels (mock). */
  listingImageUrl?: string | null
  upcomingEventList?: Array<{
    id: number | string
    title: string
    date: string
    location: string
    rsvpCount: number
    hostVerified: boolean
  }>
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
  /** Education tab filter: video embeds, slide decks, long-form articles. */
  contentType?: 'article' | 'video' | 'presentation'
  durationLabel?: string
  /** Card / grid thumbnail (direct HTTPS URL). */
  thumbnailUrl?: string | null
}

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'event_host' | 'vetted' | 'member'

export type MockGroup = {
  /** API: "City, ST" from groups.place_id */
  placeLabel?: string | null
  distanceMi?: number
  id: string
  name: string
  members: number
  /** Discovery category pill (SG-138). */
  category?: string | null
  description?: string
  descriptionSnippet?: string | null
  slug?: string
  location?: string
  visibility?: 'public' | 'private' | 'invite-only'
  /** Mock: open join vs application / approval flow. */
  joinMode?: 'open' | 'apply'
  createdAt?: string
  tags?: string[]
  /** Up to three member avatars for browse cards. */
  memberAvatars?: Array<{
    userId: string
    avatarUrl?: string | null
    displayName?: string | null
  }>
  /** Join modal rules when API-backed (SG-096). */
  rules?: import('@c2k/shared').GroupRule[]
  /** Cover image on group cards (direct HTTPS URL). */
  coverImageUrl?: string | null
  logoUrl?: string | null
  shareImageUrl?: string | null
}

export type MockGroupMember = {
  groupId: string
  userId: string
  username: string
  role: GroupRole
  joinedAt: string
  /** Staff-only: member chose hidden list visibility. */
  memberListHidden?: boolean
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
  /** Demo: HTTPS image URLs → Local feed attachments (mock only). */
  imageUrls?: string[]
  /** Demo: HTTPS audio URLs → Local feed attachments (mock only). */
  audioUrls?: string[]
  kind?: 'status' | 'article'
  title?: string | null
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
