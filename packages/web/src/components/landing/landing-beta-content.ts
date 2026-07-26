/** Public beta landing copy — SEO-rich, single indexable page at /. */

export const LANDING_SEO_TITLE = 'Kink Social | Kink Events, Groups, Education and Community'

export const LANDING_SEO_DESCRIPTION =
  'Find kink and BDSM events, local groups, educators, presenters, vendors, organizations, and community tools. Kink Social is free to join and is not a dating site.'

export const LANDING_OG_TITLE = 'Find your people. Find your place. | Kink Social'

export const LANDING_OG_DESCRIPTION =
  'Discover kink events, communities, education, presenters, vendors, and organizer tools on a platform built for connection and belonging.'

export const LANDING_SEO_KEYWORDS =
  'kink social media, BDSM events, fetish community, kink groups, munch finder, kink education, presenters, vendors, organizer tools, not a dating site'

export const LANDING_HERO_EYEBROW = '18+ community platform · public beta'

export const LANDING_HERO_HEADLINE = 'Find your people.'
export const LANDING_HERO_HEADLINE_ACCENT = 'Find your place.'

export const LANDING_HERO_LEDE =
  'Discover kink events, local groups, educators, presenters, vendors, and communities on a platform built for connection, learning, and belonging.'

export const LANDING_CTA_PRIMARY = 'Create a free account'
export const LANDING_CTA_SECONDARY = 'Explore upcoming events'

export const LANDING_TRUST_LINE = ['Free to join', 'Not a dating site', 'Built for real communities'] as const

export const LANDING_PATHWAYS = {
  kicker: 'One community, many ways in',
  title: 'Start with what brought you here.',
  body: 'Whether you are looking for your first munch, your next workshop, a local group, or better tools for the community you already run, Kink Social gives you a clear place to begin.',
  items: [
    {
      id: 'events',
      icon: '◈',
      title: 'Find events',
      body: 'Discover munches, workshops, parties, conventions, and community gatherings.',
      href: '/events',
      halo: 'rgba(229, 99, 141, 0.16)',
    },
    {
      id: 'groups',
      icon: '◎',
      title: 'Join communities',
      body: 'Find local groups and organizations built around shared interests and real connection.',
      href: '/groups',
      halo: 'rgba(155, 120, 223, 0.16)',
    },
    {
      id: 'education',
      icon: '◇',
      title: 'Learn and grow',
      body: 'Explore education from presenters and experienced members of the community.',
      href: '/education',
      halo: 'rgba(131, 199, 171, 0.14)',
    },
    {
      id: 'organize',
      icon: '✦',
      title: 'Build something',
      body: 'Create events, manage organizations, coordinate vendors, and support your people.',
      href: '/organizer',
      halo: 'rgba(216, 180, 116, 0.16)',
    },
  ],
} as const

export const LANDING_NOT_DATING = {
  kicker: 'There is more to kink than dating',
  title: 'A social platform for community, not swiping.',
  body: 'Kink Social is designed around shared interests, local events, education, friendship, organizing, and belonging. People can meet here, but dating is not the product.',
  bullets: [
    'Find local kink and BDSM events',
    'Join groups and organizations',
    'Learn from educators and presenters',
    'Discover vendors and community spaces',
  ],
} as const

export const LANDING_SHOWCASE = {
  kicker: 'See the platform in action',
  title: 'Everything that makes a community feel alive.',
  body: 'A single account connects discovery, discussion, education, events, and the people doing the work behind the scenes.',
  tabs: ['Events', 'Groups', 'Education', 'Presenters', 'Vendors', 'Conventions'] as const,
  feature: {
    tag: 'Featured nearby',
    title: 'Events worth leaving the house for.',
    body: 'Browse schedules, details, organizers, presenters, and community expectations before you arrive.',
  },
  cards: [
    { tag: 'Group', title: 'Find a circle that fits', body: 'Local, interest-based, educational, and event-centered communities.' },
    { tag: 'Education', title: 'Learn from people who teach', body: 'Articles, series, presenters, and practical resources in one place.' },
    { tag: 'Community directory', title: 'Support the ecosystem', body: 'Organizations, venues, vendors, presenters, and the people behind them.' },
  ],
} as const

export const LANDING_ORGANIZER_BETA = {
  kicker: 'Built with organizers in mind',
  title: 'Run the community, not a pile of disconnected tools.',
  body: 'Publish events, manage organizations and groups, coordinate applications, presenters, vendors, schedules, staff roles, door check-in, and attendee communication from one shared platform.',
  cta: 'Explore organizer tools',
  tools: [
    { title: 'Events and schedules', body: 'Create detailed programs, sessions, and attendee-facing information.' },
    { title: 'Applications', body: 'Coordinate presenters, vendors, trusted roles, and offers.' },
    { title: 'Operations', body: 'Door tools, staff roles, rosters, exports, and printable materials.' },
    { title: 'Community continuity', body: 'Keep the group connected before, during, and after the event.' },
  ],
} as const

export const LANDING_SAFETY_BETA = {
  kicker: 'Designed for adult community spaces',
  title: 'Control what you share and who can reach you.',
  body: 'Kink Social includes practical controls for adult content, profile visibility, reporting, blocking, moderation, and community expectations. Safety is a system, not a slogan.',
  cards: [
    { title: 'Granular visibility', body: 'Choose how profiles, posts, photos, events, and community activity are shared.' },
    { title: 'Blocking and reporting', body: 'Clear tools for limiting contact and bringing concerning behavior to moderation.' },
    { title: 'Adult content choices', body: '18+ participation with content controls and consent-aware expectations.' },
    { title: 'Community standards', body: 'Published rules for members, events, groups, organizers, and moderators.' },
  ],
} as const

export const LANDING_FAQ_ITEMS = [
  {
    question: 'Is Kink Social a dating site?',
    answer:
      'No. Kink Social is a community and organizing platform for events, groups, education, friendship, local discovery, vendors, presenters, and community building.',
  },
  {
    question: 'Can I use Kink Social to find BDSM and fetish events near me?',
    answer:
      'Kink Social helps adults discover public events, conventions, groups, organizations, presenters, vendors, venues, and educational opportunities shared through the platform. Availability depends on what communities have published in each area.',
  },
  {
    question: 'How is Kink Social different from FetLife, Fetish.com, or Kasidie?',
    answer:
      'Each platform has its own purpose. Kink Social is organized around community discovery, education, event infrastructure, public directories, and tools for organizers. It is not positioned as a dating service.',
  },
  {
    question: 'Is Kink Social free?',
    answer:
      'Kink Social is free to join. It is currently in public beta, so features will continue to improve as the community grows.',
  },
  {
    question: 'Who is Kink Social for?',
    answer:
      'Kink Social is for adults looking for kink community, friendship, events, education, groups, presenters, vendors, organizations, venues, or tools to organize and support those spaces.',
  },
] as const

export const LANDING_JOIN = {
  kicker: 'Your community is more than a feed',
  title: 'Find your way in.',
  body: 'Create a free account and start discovering events, groups, education, organizers, vendors, presenters, and people who care about building better community.',
  cta: 'Create a free account',
} as const
