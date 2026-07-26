/**
 * Kink Social – site-wide configuration.
 * Change branding and labels here; never hardcode in components.
 */
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TAGLINE,
  APP_URL,
} from '@c2k/shared'
import { dedupeNavByHref, type NavSecondaryLink } from '@/lib/site-nav'

const navPrimary = [
  { href: '/home', label: 'Home' },
  { href: '/people', label: 'People' },
  { href: '/events', label: 'Events' },
  { href: '/groups', label: 'Groups' },
  { href: '/orgs', label: 'Organizations' },
  { href: '/places', label: 'Places' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/presenters', label: 'Presenters' },
  { href: '/messaging', label: 'Messaging' },
] as const

/** Source list for More - filtered against `navPrimary` at export (G3). */
const navMoreSource = [
  { href: '/places', label: 'Kinky Map' },
  { href: '/places?category=dungeon_club', label: 'Dungeons & clubs' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const

/**
 * Secondary quick links (logged-in); surfaced from profile / overflow where wired.
 * Optional `badge` keys are wired in Header from live API counts (G2) - never hardcode counts here.
 */
const navSecondarySource = [
  { href: '/home', label: 'My Home' },
  { href: '/create', label: 'Share upload' },
  { href: '/messaging', label: 'Mailbox', badge: 'messaging' },
  { href: '/notifications', label: 'Notifications', badge: 'notifications' },
  { href: '/connections', label: 'Connections' },
  { href: '/events?mine=registrations', label: 'My RSVPs & registrations', badge: 'events' },
  { href: '/people', label: "Who's Online" },
] as const satisfies readonly NavSecondaryLink[]

export const siteConfig = {
  name: APP_NAME,
  /** Nav / header wordmark */
  brandWordmark: 'Kink.Social',
  tagline: APP_TAGLINE,
  description: APP_DESCRIPTION,
  baseUrl: import.meta.env.VITE_SITE_URL ?? APP_URL,

  /** Public (logged-out) nav – Fetish.com style */
  navPublic: [
    { href: '/community', label: 'BDSM Community' },
    { href: '/places', label: 'Kinky Map' },
  ] as const,

  /** Marketing landing header / mobile drawer */
  navLanding: [
    { href: '/events', label: 'Events' },
    { href: '/groups', label: 'Groups' },
    { href: '/education', label: 'Education' },
    { href: '/organizer', label: 'For Organizers' },
  ] as const,

  navPrimary,

  /** More dropdown (logged-in) - excludes any href already in navPrimary */
  navMore: dedupeNavByHref(navPrimary, navMoreSource),

  navSecondary: navSecondarySource,

  /**
   * Mobile bottom bar (fixed 5 slots). Icons mapped in BottomNav.
   * Create moved to FAB + sheet (Mobile UI Foundation Pass 1).
   */
  bottomNav: [
    { href: '/home', label: 'Home', iconKey: 'home' as const },
    { href: '/explore', label: 'Explore', iconKey: 'explore' as const },
    { href: '/events', label: 'Events', iconKey: 'events' as const },
    { href: '/messaging', label: 'Messages', iconKey: 'messages' as const },
    { href: '/profile', label: 'Me', iconKey: 'me' as const },
  ] as const,

  /** Logged-in desktop main nav (home dashboard shell). */
  appHomeMainNav: [
    { href: '/home?mode=discover&tab=Local', label: 'Home' },
    { href: '/explore', label: 'Explore' },
    { href: '/events', label: 'Events' },
    { href: '/conventions', label: 'Conventions' },
    { href: '/groups', label: 'Groups' },
    { href: '/education', label: 'Education' },
    { href: '/vendors', label: 'Vendors' },
    { href: '/people', label: 'People' },
    { href: '/orgs', label: 'Organizations' },
  ] as const,

  /** Compact header links (md, non-home routes) - search and profile live in Header chrome. */
  appTopNav: [
    { href: '/explore', label: 'Explore' },
    { href: '/events', label: 'Events' },
    { href: '/groups', label: 'Groups' },
    { href: '/education', label: 'Education' },
  ] as const,

  appSearchPlaceholder: 'Search people by name, location, or role…',

  footer: {
    directory: [
      { href: '/people', label: 'People' },
      { href: '/events', label: 'Events' },
      { href: '/orgs', label: 'Organizations' },
      { href: '/places', label: 'Kinky Map' },
      { href: '/places?category=dungeon_club', label: 'Dungeons & clubs' },
      { href: '/education', label: 'Education' },
      { href: '/media', label: 'Media' },
      { href: '/vendors', label: 'Vendors' },
      { href: '/presenters', label: 'Presenters' },
    ],
    /** Shown after `navPublic` in the footer Community column. */
    community: [
      { href: '/contact', label: 'Contact' },
      { href: '/about', label: 'About' },
      { href: '/support', label: 'Support' },
    ] as const,
    legal: [
      { href: '/policies', label: 'Policies' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/guidelines', label: 'Guidelines' },
      { href: '/adult-content-consent', label: 'Adult content' },
      { href: '/dmca', label: 'DMCA' },
      { href: '/ncii', label: 'NCII' },
      { href: '/law-enforcement', label: 'Law enforcement' },
      { href: '/security', label: 'Security disclosure' },
      { href: '/minor-safety', label: 'Minor safety' },
      { href: '/vendor-organizer-terms', label: 'Vendor & organizer' },
    ],
  },
} as const

export type SiteConfig = typeof siteConfig
