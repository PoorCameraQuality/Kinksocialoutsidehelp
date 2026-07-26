import { demoMockImageUrl } from '@/data/mock-seeds'
import type { MockPerson } from '@/data/types'

export const storyPerson = {
  username: 'AlexScene',
  sceneName: 'Alex',
  age: 32,
  location: 'Philadelphia, PA',
  verified: true,
  mutualCount: 4,
  sharedEventsCount: 2,
  distance: '12 mi',
  avatarUrl: demoMockImageUrl('story-person-alex', 400, 560),
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
}

export const storyPersonNoImage = {
  username: 'JordanK',
  sceneName: 'Jordan',
  age: 28,
  location: 'Wilmington, DE',
  verified: false,
  mutualCount: 0,
  avatarUrl: undefined,
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
}

/** Full `/people` directory card (FindPeopleProfileCard). */
export const storyFindPeoplePerson = {
  id: 'story-find-person-1',
  username: 'AlexScene',
  sceneName: 'Alex',
  roles: ['member'],
  trustScore: 72,
  trustTier: 'silver',
  verified: true,
  mutualCount: 4,
  distance: '12 mi',
  location: 'Philadelphia, PA',
  bio: 'Rigger and educator in the Mid-Atlantic rope scene.',
  avatarUrl: demoMockImageUrl('story-find-person-alex', 400, 560),
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  sharedEventsCount: 2,
} satisfies MockPerson

export const storyFindPeoplePersonNoImage = {
  id: 'story-find-person-2',
  username: 'JordanK',
  sceneName: 'Jordan',
  roles: ['member'],
  trustScore: 48,
  trustTier: 'bronze',
  verified: false,
  mutualCount: 0,
  distance: '28 mi',
  location: 'Wilmington, DE',
  bio: 'New to the community — happy to connect at munches.',
  avatarUrl: undefined,
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
} satisfies MockPerson

export const storyGroupPublic = {
  id: 'story-group-public',
  name: 'Mid-Atlantic Rope Society',
  members: 842,
  category: 'Rope',
  descriptionSnippet: 'Regional rope education, lab nights, and peer practice.',
  location: 'Philadelphia, PA',
  distanceMi: 18,
  tags: ['rope', 'education'],
  joinMode: 'open' as const,
  coverImageUrl: demoMockImageUrl('story-group-rope', 640, 320),
}

export const storyGroupApproval = {
  id: 'story-group-apply',
  name: 'Private Care Circle',
  members: 56,
  category: 'Support',
  descriptionSnippet: 'Peer support with moderated membership and clear confidentiality norms.',
  location: 'Online',
  joinMode: 'apply' as const,
  coverImageUrl: null,
}

export const storyEvent = {
  id: 'story-event-1',
  title: 'Community Munch · Old City',
  date: 'Fri, Jun 12 · 7:00 PM',
  location: 'Philadelphia, PA',
  rsvpCount: 48,
  capacityLimit: 80,
  mutualGoingCount: 3,
  imageUrl: demoMockImageUrl('story-event-munch', 640, 320),
  tags: ['social', 'munch'],
  eventFormat: 'in-person' as const,
}

export const storyEventNoImage = {
  id: 'story-event-2',
  title: 'Negotiation Mini-Lab',
  date: 'Mon, Jun 29 · 6:30 PM',
  location: 'Online',
  rsvpCount: 22,
  eventFormat: 'virtual' as const,
  tags: ['education'],
}

export const storyVendor = {
  id: 'story-vendor-1',
  slug: 'atelier-north',
  name: 'Atelier North',
  category: 'Leather goods',
  tags: ['leather', 'handmade'],
  rating: 4.8,
  verifiedFeedbackCount: 12,
  shipsTo: 'US',
  listingImageUrl: demoMockImageUrl('story-vendor-leather', 640, 480),
  onlineOnly: true,
}

export const storyOrg = {
  id: '00000000-0000-4000-8000-000000000010',
  slug: 'demo-east-collective',
  displayName: 'East Coast Collective',
  bio: 'Organizer-led events, education partnerships, and regional community programs.',
  bioFormat: 'text' as const,
  logoUrl: demoMockImageUrl('story-org-logo', 128, 128),
  visibility: 'public',
  rating: 4.7,
  reviewCount: 24,
  memberCount: 1280,
}

export const storyArticle = {
  slug: 'negotiation-basics',
  title: 'Negotiation basics for community events',
  excerpt: 'A practical checklist for clearer scenes, safer spaces, and better aftercare conversations.',
  heroImageUrl: demoMockImageUrl('story-education-hero', 640, 360),
  categories: ['Education'],
  readingMinutes: 8,
  difficulty: 'Beginner',
}

export const storyProfileHero = {
  displayName: 'Rope Dreamer',
  username: 'RopeDreamer',
  ageLabel: '34',
  pronouns: 'they/them',
  genders: ['Non-binary'],
  sexualOrientations: ['Queer'],
  location: 'Philadelphia, PA',
  roles: ['Rigger', 'Educator', 'Organizer'],
  photoUrl: demoMockImageUrl('story-profile-hero', 640, 800),
  photoCount: 6,
}
