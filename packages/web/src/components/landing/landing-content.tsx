import type { ReactNode } from 'react'

export const LANDING_BASIC_SLOGAN =
  'Kink social media for friends, events, conventions, education, vendors, and more'

export const LANDING_BASIC_TRUST = [
  '18+ kink & BDSM community',
  'Consent focused',
  'Privacy-first profiles',
] as const

export const LANDING_SIDE_HERO_FEATURES = [
  {
    href: '/people',
    label: 'Friends',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    href: '/events',
    label: 'Events',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    href: '/events',
    label: 'Conventions',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    href: '/education',
    label: 'Education',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824 2.998 12.078 12.078 0 01.665-6.479L12 14z"
        />
      </svg>
    ),
  },
  {
    href: '/vendors',
    label: 'Vendors',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
        />
      </svg>
    ),
  },
  {
    href: '/groups',
    label: 'Groups',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
] as const

export const LANDING_HERO_EYEBROW = 'Kink social media · Connect · Learn · Belong'

export const LANDING_HERO_HEADLINE = {
  lead: 'Your kink community.',
  accent: 'Your social network.',
} as const

export const LANDING_SUPPORTING_COPY =
  'A consent-first social network for the BDSM and fetish lifestyle — find munches and events, join groups, meet people, learn from educators, and build real-world community.'

export const LANDING_FEATURE_HEADLINE = 'Everything your community needs in one place.'

export const LANDING_FEATURE_SUBLINE =
  'Events, groups, education, vendors, and organizer tools built for real-world connection.'

export const LANDING_ORGANIZER_HEADLINE = 'Built for the people who make community happen.'

export const LANDING_ORGANIZER_BODY =
  'Plan events, manage rosters, coordinate teams, publish schedules, and keep your community organized without duct-taping five tools together.'

export const LANDING_SAFETY_HEADLINE = 'Designed for trust, privacy, and consent.'

export const LANDING_SAFETY_BODY =
  'Control what you share, who can reach you, and how you participate. Reporting, blocking, privacy, and community guidelines are part of the product, not an afterthought.'

export const LANDING_FINAL_CTA_HEADLINE = 'Your people are here.'

export const SIGNUP_REASSURANCE = [
  '18+ community only',
  'Privacy-first profiles',
  'Free to join',
] as const

export const TRUST_PILLS = [
  {
    title: '18+ community',
    subtitle: 'Adults only',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  {
    title: 'Privacy-first profiles',
    subtitle: 'You are in control',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    title: 'Consent-centered culture',
    subtitle: 'Respect is everything',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Organizer tools',
    subtitle: 'Built for events',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
] as const

export const LANDING_SHORTCUTS = [
  {
    href: '/events',
    label: 'Discover events',
    description: 'Munches, classes, parties, and conventions near you.',
  },
  {
    href: '/groups',
    label: 'Join groups',
    description: 'Local communities with scoped forums and real participation.',
  },
  {
    href: '/people',
    label: 'Meet people',
    description: 'Profiles, references, and discovery built for adults.',
  },
  {
    href: '/education',
    label: 'Learn from educators',
    description: 'Workshops, articles, and trusted presenters.',
  },
  {
    href: '/vendors',
    label: 'Browse vendors',
    description: 'Gear, services, and creators in the community.',
  },
  {
    href: '/organizer',
    label: 'Organizer tools',
    description: 'Rosters, check-in, schedules, and team workflows.',
  },
] as const

export const FEATURE_PILLARS: {
  title: string
  description: string
  mobileDescription: string
  href: string
  linkLabel: string
  featureRgb: string
  accentColor: string
  icon: ReactNode
}[] = [
  {
    title: 'Events',
    description:
      'Munches, classes, play parties, conventions, and more. Find what is happening near you.',
    mobileDescription: 'Munches, classes, play parties, and more.',
    href: '/events',
    linkLabel: 'Browse events →',
    featureRgb: '143, 38, 38',
    accentColor: 'var(--pub-red)',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    title: 'Groups',
    description: 'Join local communities and interest-based groups where people actually show up.',
    mobileDescription: 'Join local communities and groups.',
    href: '/groups',
    linkLabel: 'Find groups →',
    featureRgb: '91, 58, 142',
    accentColor: 'var(--pub-purple)',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Education',
    description: 'Learn from trusted presenters, educators, and articles you can rely on.',
    mobileDescription: 'Learn from trusted presenters.',
    href: '/education',
    linkLabel: 'Explore education →',
    featureRgb: '216, 173, 54',
    accentColor: 'var(--pub-gold-bright)',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824 2.998 12.078 12.078 0 01.665-6.479L12 14z"
        />
      </svg>
    ),
  },
  {
    title: 'Reputation & Trust',
    description: 'References and participation history. Credibility earned in the real world.',
    mobileDescription: 'References and participation history.',
    href: '/people',
    linkLabel: 'Learn more →',
    featureRgb: '36, 92, 145',
    accentColor: 'var(--pub-blue)',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
]

export const ORGANIZER_FEATURES = [
  'Event roster',
  'Check-in',
  'Schedule',
  'Attendance',
  'Team roles',
] as const

export const LANDING_PRODUCT_PREVIEW_ITEMS = [
  {
    id: 'events',
    title: 'Events & conventions',
    description: 'Discover, RSVP, and follow schedules for nights you actually attend.',
    href: '/events',
    label: 'Browse events',
  },
  {
    id: 'groups',
    title: 'Groups & forums',
    description: 'Scoped discussions for local communities — not a public free-for-all.',
    href: '/groups',
    label: 'Explore groups',
  },
  {
    id: 'education',
    title: 'Education & presenters',
    description: 'Workshops, articles, and learning paths from trusted educators.',
    href: '/education',
    label: 'Start learning',
  },
  {
    id: 'organizers',
    title: 'Organizer operations',
    description: 'Rosters, door check-in, program grids, and team coordination in one place.',
    href: '/organizer',
    label: 'Organizer tools',
  },
] as const
