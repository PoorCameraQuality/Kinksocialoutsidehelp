/**
 * Mock seed data and generation logic.
 * Produces deterministic mock data for UX preview.
 *
 * Generation strategy:
 * - People: TIER_BUCKETS distribute ~25% bronze, ~40% silver, ~35% gold by trust score.
 * - Group members: Role assignment by index (owner, admin, moderator, etc.); RopeDreamer added to g0/g1.
 * - Channels/Photos: Count derived from group.id for deterministic variety.
 */

import type { BadgeId } from './types.js'
import {
  getTrustTierFromScore,
  type TrustTier,
  type MockPerson,
  type MockEvent,
  type MockVendor,
  type MockArticle,
  type MockGroup,
  type MockGroupMember,
  type MockGroupChannel,
  type MockGroupPost,
  type MockGroupPhoto,
  type MockLocalPost,
  type MockEndorsement,
  type MockResource,
  type GroupRole,
  type MockNotification,
} from './types.js'

export const MOCK_VIEWER_USERNAME = 'RopeDreamer'
export const TAG_SEEDS = ['rope', 'shibari', 'munch', 'workshop', 'impact', 'leather', 'queer', 'newbie'] as const

const USERNAMES = [
  'RopeDreamer', 'KinkyCurious', 'LeatherLuna', 'SwitchBlade', 'ImpactTop', 'SubmissiveSage', 'RiggerRick',
  'GinaRiley', 'Shinksy71', 'kinkygalK', 'hostess', 'traveler99', 'newbie2026', 'ChambersburgGroup',
  'ErieExplorer', 'PhillyKink', 'BaltimoreBondage', 'FrederickRope', 'HarrisburgSwitch', 'YorkMunch',
  'PittsburghPlay', 'DCKinkster', 'NovaKink', 'RichmondRigger', 'CharlotteScene', 'AtlantaKink',
  'MiamiBDSM', 'TampaSwitch', 'OrlandoRope', 'AustinKink', 'DallasScene', 'HoustonPlay',
  'ChicagoKink', 'DetroitBondage', 'ColumbusSwitch', 'ClevelandRope', 'MinneapolisKink',
  'DenverScene', 'SeattlePlay', 'PortlandKink', 'SFBayRope', 'LAKinkster', 'SanDiegoSwitch',
  'BostonBDSM', 'NYCKink', 'JerseyKink', 'MarylandRope', 'VirginiaSwitch', 'CarolinaKink',
  'GeorgiaPlay', 'FloridaRope', 'TennesseeKink', 'KentuckySwitch', 'OhioScene', 'MichiganKink',
  'IndianaPlay', 'IllinoisRope', 'WisconsinKink', 'MissouriSwitch', 'ColoradoScene',
  'ArizonaKink', 'NewMexicoPlay', 'NevadaRope', 'OregonKink', 'WashingtonSwitch',
  'MaineScene', 'VermontKink', 'NewHampshirePlay', 'RhodeIslandRope', 'ConnecticutKink',
  'DelawareSwitch', 'WestVirginiaScene', 'SouthCarolinaKink', 'AlabamaPlay', 'MississippiRope',
  'LouisianaKink', 'ArkansasSwitch', 'OklahomaScene', 'KansasKink', 'NebraskaPlay',
  'IowaRope', 'MinnesotaKink', 'NorthDakotaSwitch', 'SouthDakotaScene', 'MontanaKink',
  'WyomingPlay', 'IdahoRope', 'UtahKink', 'AlaskaSwitch', 'HawaiiScene',
]

const ROLES = ['Top', 'Bottom', 'Switch', 'Rigger', 'Rope Bunny', 'Dominant', 'Submissive', 'Educator', 'Mentor', 'Organizer']
const SEXUALITIES = ['Queer', 'Bisexual', 'Pansexual', 'Lesbian', 'Gay', 'Heterosexual', 'Asexual', 'Questioning', 'Prefer not to say']
const LOCATIONS = [
  'Chambersburg, PA', 'Frederick, MD', 'Philadelphia, PA', 'Baltimore, MD', 'Harrisburg, PA',
  'York, PA', 'Pittsburgh, PA', 'Washington, DC', 'New York, NY', 'Boston, MA',
  'Chicago, IL', 'Atlanta, GA', 'Austin, TX', 'Denver, CO', 'Seattle, WA',
  'San Francisco, CA', 'Los Angeles, CA', 'Miami, FL', 'Portland, OR', 'Minneapolis, MN',
]
const DISTANCES = ['5km', '12km', '25km', '45km', '78km', '120km', '150km', '200km', '350km', '500km']

const EVENT_TITLES = [
  'I-81 Southern PA Munch', 'Frederick Geeky and Kinky', 'Naughty Great 2026', 'Dark Odyssey Spring Fling',
  'Kinky Kollege East', 'Folsom Europe', 'Lunch Amsterdam', 'Burning Man Decompression',
  'Whips & Whine by Femocracy', 'Shadows Fun Times Wednesdays', 'Central PA Play Party',
  'Baltimore Playhouse Munch', 'DC Rope Bite', 'Philly Munch', 'Pittsburgh Kink Night',
  'York Monthly Munch', 'Harrisburg Social', 'Chambersburg 81 Corridor Meetup',
  'Rope 101 Workshop', 'Impact Play Basics', 'Negotiation Skills', 'Aftercare Circle',
  'Newbie Night', 'Women\'s Munch', 'Queer Kink Social', 'Dungeon Open House',
  'Kink Positive Yoga', 'Shibari Jam', 'FemDom Tea', 'Switch Social',
]
const EVENT_CATEGORIES = ['Munch', 'Social', 'Conference/Festival', 'Conference/Festival', 'Educational', 'Educational', 'Play Party', 'Social', 'Munch', 'Munch', 'Munch', 'Munch', 'Munch', 'Munch', 'Munch', 'Munch', 'Munch', 'Workshop', 'Workshop', 'Workshop', 'Workshop', 'Munch', 'Munch', 'Social', 'Social', 'Workshop', 'Workshop', 'Social', 'Social', 'Social']

const POST_SAMPLES_NEW = [
  "New to the area and the scene. Any beginner-friendly events coming up?",
  "Just attended my first munch. Everyone was so kind. Can't wait for the next one.",
  "Still figuring things out but excited to meet people. Who's going to the munch?",
  "Looking for local rope enthusiasts to practice with. DM if interested.",
  "First time posting here - hi everyone! 👋",
  "Does anyone have tips for someone new to the community?",
  "Nervous but excited to attend my first event this weekend.",
]

const POST_SAMPLES_MID = [
  "Excited for the munch this weekend! Who else is going?",
  "Just got back from an amazing rope workshop. Highly recommend.",
  "Shoutout to the organizers of last night's event - you crushed it!",
  "The community here is so welcoming. Grateful to have found you all.",
  "Who's going to Naughty Great? Let's connect before the con!",
  "Finally got my first suspension! Thanks to everyone who made it possible.",
  "The dungeon had such a great energy last night. Already planning my next visit.",
  "Found an amazing new vendor at the last event. Their rope is *chef's kiss*",
  "Looking for a mentor in the area. Experienced in rope, curious about impact.",
]

const POST_SAMPLES_VET = [
  "Aftercare is not optional. That's the tweet.",
  "Reminder: consent is ongoing. Check in. Always.",
  "Rope care tip: store your jute in a cool, dry place. Your future self will thank you.",
  "Event etiquette reminder: respect the venue, respect the hosts, respect each other.",
  "Negotiation before play. Every. Single. Time.",
  "To all the educators out there: thank you for making the scene safer and more accessible.",
  "Solo-friendly events matter. Glad to see more of them popping up.",
  "Trust takes time to build. Don't rush it.",
  "15 years in the scene and I still learn something new at every munch.",
]

const POST_SAMPLES_ALL = [...POST_SAMPLES_NEW, ...POST_SAMPLES_MID, ...POST_SAMPLES_VET]

const TIER_BUCKETS: Array<{ min: number; max: number; tier: TrustTier }> = [
  { min: 8, max: 38, tier: 'bronze' },
  { min: 40, max: 58, tier: 'silver' },
  { min: 58, max: 72, tier: 'silver' },
  { min: 72, max: 98, tier: 'gold' },
]
const TIER_WEIGHTS = [25, 25, 15, 35]

function generatePeople(): MockPerson[] {
  const people: MockPerson[] = []
  const usedNames = new Set<string>()
  let bucketIndex = 0
  let countInBucket = 0
  const targetPerBucket = TIER_WEIGHTS.map((w) => Math.round((w / 100) * 100))

  for (let i = 0; i < 100; i++) {
    if (countInBucket >= targetPerBucket[bucketIndex]) {
      bucketIndex = Math.min(bucketIndex + 1, TIER_BUCKETS.length - 1)
      countInBucket = 0
    }
    countInBucket++

    const bucket = TIER_BUCKETS[bucketIndex]
    const range = bucket.max - bucket.min
    const trustScore = bucket.min + Math.floor((i * 7 + 13) % (range + 1))
    const tier = getTrustTierFromScore(trustScore)
    const verified = trustScore >= 50 || (tier === 'gold' && i % 2 === 0)
    const mutualCount = tier === 'bronze' ? i % 4 : tier === 'silver' ? 3 + (i % 9) : 6 + (i % 15)
    const badges: BadgeId[] = trustScore >= 70 ? ['event_verified'] : []
    if (trustScore >= 85 && i % 3 === 0) badges.push('community_contributor')
    if (trustScore >= 90) badges.push('community_trusted')

    let username = USERNAMES[i % USERNAMES.length]
    if (usedNames.has(username)) username = `${username}${i}`
    usedNames.add(username)
    const roleCount = 1 + (i % 3)
    const roles = Array.from({ length: roleCount }, (_, j) => ROLES[(i + j) % ROLES.length])

    const base = Math.round(trustScore / 5)
    const variance = (i % 3) - 1
    const trustSegments = {
      eventReliability: Math.min(100, Math.max(0, base + (i % 7) - 3)),
      consentSafety: Math.min(100, Math.max(0, base + (i % 5) - 2)),
      skill: Math.min(100, Math.max(0, base + variance * 5)),
      contribution: Math.min(100, Math.max(0, base + (i % 4) - 1)),
      vendorHost: Math.min(100, Math.max(0, (i % 10) < 3 ? base + 10 : base - 5)),
    }

    const person: MockPerson = {
      id: `u${i}`,
      username,
      roles: [...new Set(roles)],
      trustScore,
      trustTier: tier,
      trustSegments,
      sexuality: SEXUALITIES[i % SEXUALITIES.length],
      verified,
      mutualCount,
      distance: DISTANCES[i % DISTANCES.length],
      location: LOCATIONS[i % LOCATIONS.length],
      badges: badges.length > 0 ? badges : undefined,
    }
    if (username === MOCK_VIEWER_USERNAME) {
      person.bio = 'Rope enthusiast and community organizer. Always happy to connect with fellow kinksters.'
      person.profilePhotos = [
        { id: 'pp-1', caption: 'At the munch', order: 0, tags: ['rope', 'munch'] },
        { id: 'pp-2', caption: 'Workshop day', order: 1, tags: ['shibari'] },
      ]
    }
    people.push(person)
  }
  return people
}

const EVENT_DESCRIPTIONS = [
  'Monthly munch for the community. Casual dinner and conversation. All experience levels welcome.',
  'Geeky and kinky crowd. Board games, trivia, and great conversation.',
  'Annual conference with workshops, vendors, and social events.',
  'Spring gathering with classes and play spaces.',
  'Educational weekend with experienced instructors.',
  'Respect boundaries. No play at the venue. Consent is mandatory.',
  'Casual, vanilla appropriate for the restaurant.',
  'Explicit verbal consent required for any physical contact.',
]

function generateEvents(groups: MockGroup[]): MockEvent[] {
  const events: MockEvent[] = []
  const dates = ['Wed, Feb 18 at 6:00 PM', 'Thu, Feb 19 at 7:00 PM', 'Fri, Feb 20 at 8:00 PM', 'Sat, Feb 21 at 2:00 PM', 'Sun, Feb 22 at 1:00 PM', 'Wed, Feb 25 at 6:00 PM', 'Thu, Feb 26 at 7:00 PM', 'Fri, Feb 27 at 8:00 PM', 'Sat, Feb 28 at 3:00 PM', 'Thu, Mar 5 at 7:00 PM', 'Fri, Mar 6 at 8:00 PM', 'Sat, Mar 7 at 2:00 PM', 'Thu, Mar 12 at 7:00 PM', 'Fri, Mar 13 at 8:00 PM', 'Thu, Mar 26 at 6:00 PM', 'Fri, Apr 10 at 7:00 PM', 'Sat, May 2 at 2:00 PM', 'Sep 4–7, 2026', 'Oct 10–12, 2026']
  for (let i = 0; i < 30; i++) {
    const hostName = USERNAMES[i % USERNAMES.length]
    const groupId = i % 5 < 3 && groups.length > 0 ? groups[(i * 7) % groups.length].id : undefined
    const cat = EVENT_CATEGORIES[i % EVENT_CATEGORIES.length]
    const title = EVENT_TITLES[i % EVENT_TITLES.length].toLowerCase()
    const eventTags: string[] = []
    if (title.includes('rope') || title.includes('shibari')) eventTags.push('rope', 'shibari')
    else if (cat === 'Munch') eventTags.push('munch')
    else if (cat === 'Workshop' || cat === 'Educational') eventTags.push('workshop')
    else eventTags.push(TAG_SEEDS[i % TAG_SEEDS.length])
    const eventFormat: 'in-person' | 'virtual' = i % 4 === 0 ? 'virtual' : 'in-person'
    const location =
      eventFormat === 'virtual'
        ? 'Online / Zoom'
        : LOCATIONS[i % LOCATIONS.length]
    events.push({
      id: i + 1,
      title: EVENT_TITLES[i % EVENT_TITLES.length],
      date: dates[i % dates.length],
      location,
      eventFormat,
      rsvpCount: 8 + (i * 17) % 400,
      hostVerified: i % 3 !== 0,
      groupId,
      hostName,
      description: EVENT_DESCRIPTIONS[i % EVENT_DESCRIPTIONS.length],
      rules: 'Respect boundaries. No play at the venue. Consent is mandatory.',
      dressCode: 'Casual, vanilla appropriate for the venue.',
      consentPolicy: 'Explicit verbal consent required for any physical contact.',
      category: cat,
      tags: eventTags.length > 0 ? eventTags : [TAG_SEEDS[i % TAG_SEEDS.length]],
    })
  }
  return events
}

const VENDOR_NAMES = ['KinkCraft', 'LeatherWorks', 'RopeArt', 'ImpactToys', 'BondageBoutique', 'ShibariSupply', 'KinkKreations', 'RopeRevolution', 'LeatherLuxe', 'ChainReaction', 'CuffCraft', 'WhipWorks', 'RestraintRoom', 'KinkKorner', 'BDSMBoutique']
const VENDOR_CATEGORIES = [['Gear', 'Rope'], ['Clothing', 'Accessories'], ['Gear', 'Art'], ['Toys'], ['Clothing'], ['Gear'], ['Rope', 'Accessories'], ['Toys', 'Gear'], ['Clothing', 'Leather'], ['Gear', 'Toys'], ['Accessories'], ['Toys'], ['Gear'], ['Services'], ['Art', 'Gear']]
const VENDOR_DESCRIPTIONS = [
  'Handcrafted rope and gear for the kink community. Quality materials, ethical sourcing.',
  'Premium leather goods and accessories. Custom orders welcome.',
  'Artisan rope and shibari supplies. Natural and synthetic options.',
  'Impact play toys and accessories. Safety-tested and community-approved.',
  'Bondage gear and clothing. Inclusive sizing available.',
  'Shibari rope, hardware, and educational resources.',
  'Custom kink creations. Made to order.',
  'Innovative rope and restraint designs.',
  'Luxury leather and metal accessories.',
  'Chain and hardware for play and display.',
  'Cuffs, collars, and restraints. Multiple styles.',
  'Whips and impact implements. Handcrafted.',
  'Restraint systems and dungeon furniture.',
  'Community-focused gear and services.',
  'Art and functional gear for the scene.',
]

function mockVendorVerifiedFeedbackCount(i: number): number {
  const bucket = i % 5
  if (bucket === 0) return 0
  if (bucket === 1) return 1
  if (bucket === 2) return 2
  if (bucket === 3) return 3
  return 6
}

function generateVendors(events: MockEvent[]): MockVendor[] {
  return VENDOR_NAMES.map((name, i) => {
    const upcomingEventList = events.slice(i % 5, (i % 5) + 2).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      location: e.location,
      rsvpCount: e.rsvpCount,
      hostVerified: e.hostVerified,
    }))
    return {
      id: i + 1,
      name,
      categories: VENDOR_CATEGORIES[i] || ['Gear'],
      rating: 4.2 + (i * 0.05) % 0.8,
      verifiedFeedbackCount: mockVendorVerifiedFeedbackCount(i),
      shipsTo: i % 5 === 0 ? 'US, Canada' : 'US',
      upcomingEvents: upcomingEventList.length,
      shopUrl: `https://example.com/${name.toLowerCase()}`,
      description: VENDOR_DESCRIPTIONS[i] || VENDOR_DESCRIPTIONS[0],
      upcomingEventList,
    }
  })
}

const ARTICLE_TITLES = [
  'Introduction to Rope Bondage Safety', 'Aftercare: Why It Matters', 'Negotiation Basics', 'Event Etiquette 101',
  'Understanding Power Exchange', 'Rope Care and Maintenance', 'Safewords and Signals', 'Impact Play Fundamentals',
  'Finding Your Local Community', 'Consent in BDSM', 'Shibari for Beginners', 'Choosing Your First Rope',
  'Dungeon Etiquette', 'Munch Survival Guide', 'Building Trust with Partners', 'Aftercare Practices',
  'Rope Bottom Safety', 'Top Drop and Dom Drop', 'Negotiating Scenes', 'Community Resources',
]
const ARTICLE_CATEGORIES = ['Beginner', 'Safety', 'Psychology', 'Gear', 'Event Etiquette', 'Advanced']

function generateArticleContent(title: string, category: string): string {
  return `## Before You Begin

This article on "${title}" (${category}) covers essentials for community practice. Always verify consent and use appropriate safety gear.

## Circulation Check

Monitor circulation every 10–15 minutes. Ask about numbness, tingling, or coldness in extremities.

## Nerve Safety

Avoid pressure on major nerve bundles. The wrists and inner elbows require extra care.`
}

function generateArticles(): MockArticle[] {
  return ARTICLE_TITLES.map((title, i) => {
    const category = ARTICLE_CATEGORIES[i % ARTICLE_CATEGORIES.length]
    return {
      id: i + 1,
      title,
      category,
      readTime: `${3 + (i % 8)} min`,
      credibilityScore: 85 + (i % 15),
      slug: `article-${i + 1}`,
      tags: [TAG_SEEDS[i % TAG_SEEDS.length], TAG_SEEDS[(i + 2) % TAG_SEEDS.length]],
      content: generateArticleContent(title, category),
      author: {
        username: `Educator${(i % 6) + 1}`,
        trustScore: 80 + (i % 20),
      },
    }
  })
}

const GROUP_NAMES = [
  'Central Pennsylvania Polyamorous', 'Chambersburg 81 Corridor Group', 'Baltimore Playhouse', 'DC Kink Collective',
  'Philly Rope Society', 'Pittsburgh Kink Community', 'Frederick Geeky and Kinky', 'York Munch Regulars',
  'Harrisburg Kinksters', 'Nova Kink Network', 'Richmond Rope', 'Charlotte Scene', 'Atlanta Kink Alliance',
  'Austin Kink Community', 'Denver Kink Collective', 'Seattle Rope Bite', 'SF Bay Area Kink',
  'LA Kink Society', 'Chicago Kink Network', 'Minneapolis Kinksters', 'Boston Kink Community',
  'NYC Rope Collective', 'Queer Kink Philly', 'Women in Kink', 'Newbie Friendly Network',
]

const GROUP_DESCRIPTIONS = [
  'A welcoming community for polyamorous kinksters in central PA.',
  'Monthly munches and events along the I-81 corridor. All experience levels welcome.',
  'Baltimore\'s premier dungeon and play space. Munches, workshops, and play parties.',
  'DC-area collective for education, community, and connection.',
  'Rope enthusiasts in the Philadelphia area. Shibari, kinbaku, and more.',
  'Pittsburgh kink community. Socials, munches, and educational events.',
  'Geeky and kinky - board games, trivia, and great conversation.',
  'York area munch regulars. Casual and friendly.',
  'Harrisburg-area kinksters. Munches and play parties.',
  'Northern Virginia kink network. Events across the region.',
  'Richmond rope community. Workshops and jams.',
  'Charlotte scene - munches, workshops, and socials.',
  'Atlanta kink alliance. One of the largest communities in the Southeast.',
  'Austin kink community. Keep Austin kinky.',
  'Denver kink collective. Mountain high, kink higher.',
  'Seattle rope bite. Pacific Northwest rope community.',
  'SF Bay Area kink. Workshops, munches, and play spaces.',
  'LA kink society. Southern California community.',
  'Chicago kink network. Midwest hub.',
  'Minneapolis kinksters. Twin Cities community.',
  'Boston kink community. New England hub.',
  'NYC rope collective. Five boroughs, one community.',
  'Queer kink in Philadelphia. LGBTQ+ focused.',
  'Women in kink. Supportive space for women-identified folks.',
  'Newbie friendly. Beginner-focused events and mentorship.',
]

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const GROUP_CREATED_DATES = ['Jan 2023', 'Mar 2023', 'Jun 2023', 'Sep 2023', 'Dec 2023', 'Feb 2024', 'May 2024', 'Aug 2024', 'Nov 2024', 'Jan 2025', 'Feb 2025']

function generateGroups(): MockGroup[] {
  return GROUP_NAMES.map((name, i) => ({
    id: `g${i}`,
    name,
    members: 25 + (i * 31) % 200,
    description: GROUP_DESCRIPTIONS[i] ?? GROUP_DESCRIPTIONS[0],
    slug: slugify(name),
    location: LOCATIONS[i % LOCATIONS.length],
    visibility: (i % 5 === 0 ? 'invite-only' : i % 3 === 0 ? 'private' : 'public') as 'public' | 'private' | 'invite-only',
    createdAt: GROUP_CREATED_DATES[i % GROUP_CREATED_DATES.length],
    tags: [TAG_SEEDS[i % TAG_SEEDS.length], TAG_SEEDS[(i + 1) % TAG_SEEDS.length]],
  }))
}

const JOINED_DATES = ['Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024', 'Jul 2024', 'Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024', 'Jan 2025', 'Feb 2025']

function generateGroupMembers(groups: MockGroup[], people: MockPerson[]): MockGroupMember[] {
  const members: MockGroupMember[] = []
  const ropeDreamer = people.find((person) => person.username === MOCK_VIEWER_USERNAME)
  for (const group of groups) {
    const memberCount = group.members
    const shuffled = [...people].sort((personA) => (group.id.charCodeAt(1) + personA.id.charCodeAt(1)) % 2)
    let ropeDreamerAdded = false
    for (let i = 0; i < Math.min(memberCount, people.length); i++) {
      const person = shuffled[i]
      if (!person) continue
      if (person.username === MOCK_VIEWER_USERNAME) ropeDreamerAdded = true
      let role: GroupRole = 'member'
      if (i === 0) role = 'owner'
      else if (i <= 2) role = 'admin'
      else if (i <= 5) role = 'moderator'
      else if (i <= 7) role = 'event_host'
      else if (i <= 12) role = 'vetted'
      members.push({
        groupId: group.id,
        userId: person.id,
        username: person.username,
        role,
        joinedAt: JOINED_DATES[i % JOINED_DATES.length],
      })
    }
    if (!ropeDreamerAdded && ropeDreamer && (group.id === 'g0' || group.id === 'g1')) {
      members.push({
        groupId: group.id,
        userId: ropeDreamer.id,
        username: ropeDreamer.username,
        role: 'moderator',
        joinedAt: 'Jan 2025',
      })
    }
  }
  return members
}

const CHANNEL_NAMES = ['general', 'introductions', 'events', 'resources', 'vetted-only']
const POST_TITLES = ['The Introductions Thread', 'Group Rules - Please Read', 'Munch is Tonight!!', 'House party etiquette', 'New member welcome', 'Upcoming workshop', 'Safety reminders']
const POST_CONTENTS = ['Welcome! Introduce yourself here.', 'Please read before posting.', 'See you there!', 'Let\'s discuss.', 'Great to have you!', 'Sign up in the events tab.', 'Consent is key.']
const POST_DATES = ['Jan 1', 'Jan 23', '8 hours ago', '2 days ago', '1 week ago', '3 days ago']

function generateGroupChannels(groups: MockGroup[]): MockGroupChannel[] {
  const channels: MockGroupChannel[] = []
  for (const group of groups) {
    const count = 2 + (group.id.charCodeAt(1) % 2)
    for (let i = 0; i < count; i++) {
      const name = CHANNEL_NAMES[i % CHANNEL_NAMES.length]
      channels.push({
        id: `ch-${group.id}-${i}`,
        groupId: group.id,
        name,
        isVettedOnly: name === 'vetted-only',
      })
    }
  }
  return channels
}

function generateGroupPosts(channels: MockGroupChannel[], people: MockPerson[]): MockGroupPost[] {
  const posts: MockGroupPost[] = []
  let idx = 0
  for (const channel of channels) {
    const count = 3 + (channel.id.length % 3)
    for (let i = 0; i < count; i++) {
      const author = people[(idx * 7 + i * 11) % people.length]
      posts.push({
        id: `gp-${channel.id}-${i}`,
        channelId: channel.id,
        authorUsername: author?.username ?? USERNAMES[idx % USERNAMES.length],
        title: POST_TITLES[(idx + i) % POST_TITLES.length],
        content: POST_CONTENTS[(idx + i) % POST_CONTENTS.length],
        createdAt: POST_DATES[(idx + i) % POST_DATES.length],
        tags: [TAG_SEEDS[idx % TAG_SEEDS.length]],
        isPinned: i < 2,
      })
      idx++
    }
  }
  return posts
}

const PHOTO_CAPTIONS = ['Munch at Jim\'s Pub', 'Workshop setup', 'Community gathering', 'Annual meetup', 'New members welcome night', 'Rope demo', 'Social hour']

function generateGroupPhotos(groups: MockGroup[], people: MockPerson[]): MockGroupPhoto[] {
  const photos: MockGroupPhoto[] = []
  for (const group of groups) {
    const count = 4 + (group.id.charCodeAt(1) % 5)
    for (let i = 0; i < count; i++) {
      const author = people[(group.id.charCodeAt(1) * 7 + i * 11) % people.length]
      const isPending = (i === count - 1 && group.id === 'g1') || (i === count - 2 && group.id === 'g0')
      const status: 'pending' | 'approved' | 'denied' = isPending ? 'pending' : 'approved'
      photos.push({
        id: `gph-${group.id}-${i}`,
        groupId: group.id,
        caption: PHOTO_CAPTIONS[i % PHOTO_CAPTIONS.length],
        authorUsername: author?.username ?? USERNAMES[i % USERNAMES.length],
        status,
        submittedAt: ['Jan 14', 'Jan 31', '2 weeks ago', '1 week ago'][i % 4],
        approvedAt: status === 'approved' ? ['Jan 15', 'Feb 1', '2 weeks ago', '1 week ago'][i % 4] : undefined,
        tags: [PHOTO_CAPTIONS[i % PHOTO_CAPTIONS.length].toLowerCase().includes('rope') ? 'rope' : TAG_SEEDS[i % TAG_SEEDS.length]],
      })
    }
  }
  return photos
}

function generateLocalPosts(people: MockPerson[]): MockLocalPost[] {
  const times = ['2m ago', '15m ago', '32m ago', '1h ago', '2h ago', '5h ago', 'Yesterday', '2 days ago']
  const bronze = people.filter((person) => person.trustTier === 'bronze')
  const silver = people.filter((person) => person.trustTier === 'silver')
  const gold = people.filter((person) => person.trustTier === 'gold')

  const pickPost = (tier: TrustTier, i: number): string => {
    if (tier === 'bronze') return POST_SAMPLES_NEW[i % POST_SAMPLES_NEW.length]
    if (tier === 'gold') return POST_SAMPLES_VET[i % POST_SAMPLES_VET.length]
    return POST_SAMPLES_MID[i % POST_SAMPLES_MID.length]
  }

  const posts: MockLocalPost[] = []
  let postIdx = 0
  const order: TrustTier[] = ['gold', 'silver', 'bronze', 'silver', 'gold', 'bronze', 'silver', 'gold', 'bronze', 'silver']
  const pools: Record<TrustTier, MockPerson[]> = { bronze, silver, gold }

  for (let i = 0; i < 40; i++) {
    const tier = order[i % order.length]
    const pool = pools[tier]
    const author = pool[Math.floor((i * 11 + 3) % pool.length)] ?? people[i % people.length]
    const engagementBoost = tier === 'gold' ? 1.8 : tier === 'silver' ? 1.2 : 0.8
    const baseLikes = Math.floor((i * 7) % 47 * engagementBoost)
    const baseComments = Math.floor((i * 3) % 23 * engagementBoost)

    posts.push({
      id: `p${postIdx}`,
      authorUsername: author.username,
      authorTrustScore: author.trustScore,
      text: pickPost(tier, i),
      timeAgo: times[i % times.length],
      likes: Math.min(99, Math.max(0, baseLikes)),
      comments: Math.min(42, Math.max(0, baseComments)),
      tags: [TAG_SEEDS[i % TAG_SEEDS.length]],
    })
    postIdx++
  }
  const ropeDreamer = people.find((p) => p.username === MOCK_VIEWER_USERNAME)
  if (ropeDreamer) {
    posts.push({
      id: `p${postIdx}`,
      authorUsername: ropeDreamer.username,
      authorTrustScore: ropeDreamer.trustScore,
      text: 'Excited for the munch this weekend! Who else is going?',
      timeAgo: '1h ago',
      likes: 12,
      comments: 3,
      tags: ['munch'],
    })
  }
  return posts
}

const ENDORSEMENT_NOTES = [
  'Attended multiple munches together. Always respectful and communicative.',
  'Great rope bottom - clear communication, knows their limits.',
  'Organized our local munch for 2 years. Trustworthy and inclusive.',
  'Met at Dark Odyssey. Solid person, would vouch anytime.',
  'Mentored me when I was new. Patient and knowledgeable.',
  'Regular at our play space. Good scene partner.',
  'Hosted events I attended. Professional and consent-focused.',
  '', '', '',
]

function generateEndorsements(people: MockPerson[]): MockEndorsement[] {
  const endorsements: MockEndorsement[] = []
  const dates = ['1 week ago', '2 weeks ago', '3 weeks ago', '1 month ago', '2 months ago', '3 months ago']
  let idx = 0
  for (const person of people) {
    const count = Math.floor((person.trustScore / 20) + (idx % 5))
    const numEndorsements = Math.min(8, Math.max(0, count))
    const otherPeople = people.filter((p) => p.id !== person.id)
    const shuffled = [...otherPeople].sort(() => (idx % 2 === 0 ? 1 : -1))
    for (let e = 0; e < numEndorsements; e++) {
      const endorser = shuffled[(idx * 7 + e * 11) % otherPeople.length]
      if (!endorser) continue
      const noteIndex = (idx + e) % ENDORSEMENT_NOTES.length
      endorsements.push({
        id: `end${idx}-${e}`,
        endorsedUsername: person.username,
        endorserUsername: endorser.username,
        endorserTrustScore: endorser.trustScore,
        endorserBadges: endorser.badges,
        note: ENDORSEMENT_NOTES[noteIndex] || undefined,
        createdAt: dates[(idx + e) % dates.length],
      })
    }
    idx++
  }
  return endorsements
}

function generateConversations(people: MockPerson[]) {
  return people.slice(0, 20).map((p, i) => ({
    id: `c${i}`,
    name: p.username,
    lastMessage: POST_SAMPLES_ALL[i % POST_SAMPLES_ALL.length].slice(0, 50) + '...',
    date: ['1 min ago', '2h ago', 'Yesterday', '3 days ago'][i % 4],
    unread: i % 4 === 0,
    trustScore: p.trustScore,
  }))
}

function generateResources(groups: MockGroup[]): MockResource[] {
  const types = ['Document', 'PDF', 'Link']
  const names = ['Consent Guidelines', 'Event Safety Checklist', 'Community Rules', 'Vetting Process', 'Code of Conduct']
  const resources: MockResource[] = []
  for (const group of groups) {
    const count = 2 + (group.id.charCodeAt(1) % 2)
    for (let i = 0; i < count; i++) {
      resources.push({
        id: `res-${group.id}-${i}`,
        groupId: group.id,
        name: names[(group.id.charCodeAt(1) + i) % names.length],
        link: '#',
        type: types[i % types.length],
      })
    }
  }
  return resources
}

// --- Generate and export ---
const _people = generatePeople()
const _groups = generateGroups()
const _events = generateEvents(_groups)
const _vendors = generateVendors(_events)
const _articles = generateArticles()
const _groupMembers = generateGroupMembers(_groups, _people)
const _groupChannels = generateGroupChannels(_groups)
const _groupPostsBase = generateGroupPosts(_groupChannels, _people)
const _groupPhotosBase = generateGroupPhotos(_groups, _people)
const _localPosts = generateLocalPosts(_people)
const _endorsements = generateEndorsements(_people)

/** Sample notifications for /notifications (mock; in-memory). */
const _notifications: MockNotification[] = [
  {
    id: 'ntf-1',
    kind: 'event',
    title: 'Event reminder',
    body: "Your RSVP'd workshop starts in 24 hours.",
    timeAgo: '2h',
    href: '/events/1',
    read: false,
  },
  {
    id: 'ntf-2',
    kind: 'group',
    title: 'New activity in Pixel & Rope Society',
    body: 'A moderator pinned a discussion in #general.',
    timeAgo: '5h',
    href: '/groups/g1',
    read: false,
  },
  {
    id: 'ntf-3',
    kind: 'mention',
    title: 'You were mentioned',
    body: 'In a discussion: "Thanks @RopeDreamer for the tie tips!"',
    timeAgo: '1d',
    href: '/groups/g1',
    read: true,
  },
  {
    id: 'ntf-4',
    kind: 'system',
    title: 'Trust visibility',
    body: 'Complete your profile verification to boost discovery (mock).',
    timeAgo: '2d',
    href: '/profile/edit',
    read: true,
  },
  {
    id: 'ntf-5',
    kind: 'rsvp',
    title: 'RSVP update',
    body: 'Someone joined the waitlist for an event you host (mock).',
    timeAgo: '3d',
    href: '/events/2',
    read: true,
  },
]

const _conversations = generateConversations(_people)
const _resources = generateResources(_groups)

export const mockPeople = _people
export const mockEvents = _events
export const mockVendors = _vendors
export const mockArticles = _articles

/** Resolve education article by URL slug; used on /education/[slug]. */
export function getMockArticleBySlug(slug: string): MockArticle | undefined {
  return _articles.find((a) => a.slug === slug)
}

export const mockGroups = _groups
export const mockGroupMembers = _groupMembers
export const mockGroupChannels = _groupChannels

export const mockGroupPosts = [
  ..._groupPostsBase,
  {
    id: 'gp-viewer-test',
    channelId: _groupChannels.find((c) => c.groupId === 'g1')?.id ?? _groupChannels[0].id,
    authorUsername: MOCK_VIEWER_USERNAME,
    title: 'My discussion post - test',
    content: 'Testing edit and delete from the Channels tab.',
    createdAt: '2 hours ago',
    tags: ['munch'],
    isPinned: false,
  },
]

export const mockGroupPhotos = [
  ..._groupPhotosBase,
  {
    id: 'gph-g1-pending-viewer',
    groupId: 'g1',
    caption: 'My first munch photo - awaiting approval',
    authorUsername: MOCK_VIEWER_USERNAME,
    status: 'pending' as const,
    submittedAt: '1 hour ago',
    tags: ['munch'],
  },
]

export const mockLocalPosts = _localPosts
export const mockEndorsements = _endorsements
export const mockNotifications = _notifications
export const mockConversations = _conversations
export const mockResources = _resources

// --- Read helpers ---
export function getMockPersonByUsername(username: string): MockPerson | undefined {
  return mockPeople.find((p) => p.username === username)
}

export function getMockEventById(id: number | string): MockEvent | undefined {
  return mockEvents.find((e) => e.id === Number(id))
}

export function getMockVendorById(id: number | string): MockVendor | undefined {
  return mockVendors.find((v) => v.id === Number(id))
}

export function getMockEndorsementsForUser(username: string): MockEndorsement[] {
  return mockEndorsements.filter((e) => e.endorsedUsername === username)
}

export function getMockGroupById(id: string): MockGroup | undefined {
  return mockGroups.find((g) => g.id === id)
}

export function getMockGroupBySlug(slug: string): MockGroup | undefined {
  return mockGroups.find((g) => g.slug === slug)
}

export function getMockEventsForGroup(groupId: string): MockEvent[] {
  return mockEvents.filter((e) => e.groupId === groupId)
}

export function getMockGroupMembers(groupId: string): MockGroupMember[] {
  return mockGroupMembers.filter((m) => m.groupId === groupId)
}

export function getMockUserGroupRole(groupId: string, userId: string): GroupRole | undefined {
  return mockGroupMembers.find((m) => m.groupId === groupId && m.userId === userId)?.role
}

export function getMockChannelsForGroup(groupId: string): MockGroupChannel[] {
  return mockGroupChannels.filter((c) => c.groupId === groupId)
}

export function getMockChannelById(channelId: string): MockGroupChannel | undefined {
  return mockGroupChannels.find((c) => c.id === channelId)
}

export function getMockPhotosForGroup(groupId: string): MockGroupPhoto[] {
  return mockGroupPhotos.filter((p) => p.groupId === groupId && p.status === 'approved')
}

export function getMockPendingPhotosForGroup(groupId: string): MockGroupPhoto[] {
  return mockGroupPhotos.filter((p) => p.groupId === groupId && p.status === 'pending')
}

export function getMockPendingPhotosByAuthor(groupId: string, authorUsername: string): MockGroupPhoto[] {
  return mockGroupPhotos.filter((p) => p.groupId === groupId && p.status === 'pending' && p.authorUsername === authorUsername)
}

export function getMockResourcesForGroup(groupId: string): MockResource[] {
  return mockResources.filter((r) => r.groupId === groupId)
}
