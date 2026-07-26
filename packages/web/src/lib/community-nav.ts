/** Persistent community nav - home feed modes only (no duplicate directory tabs). */

import { hideCommunityNavForConventionsDiscover } from '@/lib/conventions-page-layout'
import { hideCommunityNavForOrgsDiscover } from '@/lib/orgs-page-layout'
import { hideCommunityNavForEducationDiscover } from '@/lib/education-page-layout'
import { hideCommunityNavForEventsDiscover } from '@/lib/events-page-layout'
import { hideCommunityNavForExploreDiscover } from '@/lib/explore-page-layout'
import { hideCommunityNavForGroupsDiscover } from '@/lib/groups-page-layout'
import { hideCommunityNavForFocusedPersonal } from '@/lib/focused-personal-shell'
import { hideCommunityNavForFeedShell } from '@/lib/home-feed-layout'
import { PEOPLE_DIRECTORY_PATH, EXPLORE_DASHBOARD_PATH } from '@/lib/app-routes'

export const HOME_TABS = [
  'Local',
  'Events',
  'Conventions',
  'Groups',
  'Vendors',
  'Education',
  'Media',
  'Trending',
] as const

export type HomeTab = (typeof HOME_TABS)[number]

export const HOME_TAB_LABELS: Record<HomeTab, string> = {
  Local: 'Near you',
  Events: 'Events',
  Conventions: 'Conventions',
  Groups: 'Groups',
  Vendors: 'Vendors',
  Education: 'Education',
  Media: 'Media',
  Trending: 'Trending',
}

export const BROWSE_TABS: HomeTab[] = HOME_TABS.filter((t) => t !== 'Local')

/** @deprecated Browse tabs removed from CommunityNavBar - home tabs in this set redirect to standalone routes. */
export const COMMUNITY_BROWSE_TABS: HomeTab[] = BROWSE_TABS

/** Home-only discover tabs (feed surfaces - not redirected to standalone directories). */
export const HOME_FEED_TABS: HomeTab[] = ['Local', 'Trending']

export function normalizeHomeTab(raw: string | null): HomeTab | null {
  if (!raw) return null
  if (raw.toLowerCase() === 'people') return null
  const match = HOME_TABS.find((t) => t.toLowerCase() === raw.toLowerCase())
  return match ?? null
}

export function homeDiscoverHref(tab: HomeTab): string {
  if (tab === 'Trending') return EXPLORE_DASHBOARD_PATH
  const p = new URLSearchParams({ mode: 'discover', tab })
  return `/home?${p.toString()}`
}

export function homeFollowingHref(): string {
  return '/home?mode=following'
}

export function homeNearYouHref(): string {
  return homeDiscoverHref('Local')
}

/** Standalone directory routes - deep-link targets for browse tabs (Track B2). */
const STANDALONE_BROWSE_PATHS: Partial<Record<HomeTab, string>> = {
  Events: '/events',
  Conventions: '/conventions',
  Groups: '/groups',
  Vendors: '/vendors',
  Education: '/education',
  Media: '/media',
}

/** Canonical href for a browse tab: standalone page when one exists, else home discover tab. */
export function browseHref(tab: HomeTab): string {
  return STANDALONE_BROWSE_PATHS[tab] ?? homeDiscoverHref(tab)
}

export const PEOPLE_DIRECTORY_NAV = {
  href: PEOPLE_DIRECTORY_PATH,
  label: 'People',
} as const

/** @deprecated Use PEOPLE_DIRECTORY_NAV */
export const FIND_PEOPLE_NAV = PEOPLE_DIRECTORY_NAV

/** Directory links surfaced in secondary nav - orgs use top nav only. */
export const DIRECTORY_NAV_LINKS = [
  { href: '/presenters', label: 'Presenters' },
  { href: '/places', label: 'Places' },
] as const

export function isDirectoryNavActive(href: string, pathname: string): boolean {
  if (href === '/orgs') return pathname === '/orgs' || pathname.startsWith('/orgs/')
  if (href === '/presenters') return pathname === '/presenters' || pathname.startsWith('/presenters/')
  if (href === '/places') return pathname === '/places' || pathname.startsWith('/places/')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export type CommunityNavState = {
  mode: 'following' | 'discover'
  tab: HomeTab
}

export function resolveCommunityNavState(pathname: string, search: string): CommunityNavState {
  const params = new URLSearchParams(search)
  const onHome = pathname === '/home' || pathname === '/' || pathname === '/feed'

  if (onHome) {
    const modeRaw = params.get('mode')?.toLowerCase()
    if (modeRaw === 'following') return { mode: 'following', tab: 'Local' }
    const tab = normalizeHomeTab(params.get('tab')) ?? 'Local'
    return { mode: 'discover', tab }
  }

  if (pathname === '/events' || pathname.startsWith('/events/')) {
    return { mode: 'discover', tab: 'Events' }
  }
  if (pathname === '/conventions' || pathname.startsWith('/conventions/')) {
    return { mode: 'discover', tab: 'Conventions' }
  }
  if (pathname === '/connections' || pathname.startsWith('/connections')) {
    return { mode: 'discover', tab: 'Local' }
  }
  if (pathname === '/groups' || pathname.startsWith('/groups/')) {
    return { mode: 'discover', tab: 'Groups' }
  }
  if (pathname === '/vendors' || pathname.startsWith('/vendors/')) {
    return { mode: 'discover', tab: 'Vendors' }
  }
  if (pathname === '/education' || pathname.startsWith('/education/')) {
    return { mode: 'discover', tab: 'Education' }
  }
  if (pathname === '/media' || pathname.startsWith('/media/')) {
    return { mode: 'discover', tab: 'Media' }
  }
  if (pathname === PEOPLE_DIRECTORY_PATH || pathname === '/discovery' || pathname === '/explore/people') {
    return { mode: 'discover', tab: 'Local' }
  }
  if (pathname === EXPLORE_DASHBOARD_PATH) {
    return { mode: 'discover', tab: 'Trending' }
  }
  if (pathname === '/orgs' || pathname.startsWith('/orgs/')) {
    return { mode: 'discover', tab: 'Local' }
  }
  if (pathname === '/presenters' || pathname.startsWith('/presenters/')) {
    return { mode: 'discover', tab: 'Local' }
  }
  if (pathname === '/places' || pathname.startsWith('/places/') || pathname === '/dungeons') {
    return { mode: 'discover', tab: 'Local' }
  }

  return { mode: 'discover', tab: 'Local' }
}

/** Whether a browse tab should appear selected (home discover tab or matching standalone route). */
export function isBrowseTabActive(tab: HomeTab, pathname: string, search: string): boolean {
  if (tab === 'Trending' && pathname === EXPLORE_DASHBOARD_PATH) return true
  const state = resolveCommunityNavState(pathname, search)
  return state.mode === 'discover' && state.tab === tab
}

export function isPeopleDirectoryNavActive(pathname: string): boolean {
  return pathname === PEOPLE_DIRECTORY_PATH || pathname === '/discovery' || pathname === '/explore/people'
}

/** @deprecated Use isPeopleDirectoryNavActive */
export function isFindPeopleBrowseActive(pathname: string, _search: string): boolean {
  return isPeopleDirectoryNavActive(pathname)
}

/** Pages that use full-bleed organizer / auth shells without community nav. */
export function showCommunityNav(pathname: string, search = ''): boolean {
  if (hideCommunityNavForFeedShell(pathname, search)) return false
  if (hideCommunityNavOnHome(pathname)) return false
  if (hideCommunityNavForEventsDiscover(pathname, search)) return false
  if (hideCommunityNavForEducationDiscover(pathname)) return false
  if (hideCommunityNavForGroupsDiscover(pathname)) return false
  if (hideCommunityNavForExploreDiscover(pathname, search)) return false
  if (hideCommunityNavForConventionsDiscover(pathname)) return false
  if (hideCommunityNavForOrgsDiscover(pathname)) return false
  if (pathname.endsWith('/door')) return false
  if (pathname.startsWith('/organizer')) return false
  if (pathname.startsWith('/login')) return false
  if (pathname.startsWith('/signup')) return false
  if (pathname.startsWith('/register')) return false
  if (pathname.startsWith('/onboarding')) return false
  if (pathname.startsWith('/email/')) return false
  if (hideCommunityNavForFocusedPersonal(pathname)) return false
  if (pathname.startsWith('/moderation')) return false
  return true
}

/** Hide the secondary community row on home - top nav + feed left rail own navigation. */
export function hideCommunityNavOnHome(pathname: string): boolean {
  return pathname === '/home' || pathname === '/feed' || pathname === '/'
}

/** Mobile-only home feed scope tabs - uses dedicated bar, not global showCommunityNav. */
export function showHomeMobileFeedNav(pathname: string): boolean {
  return pathname === '/home' || pathname === '/feed' || pathname === '/'
}

/** Hide marketing footer on mobile for app-like routes (UI_UX_DECISIONS Q4). */
export function hideMarketingFooterOnMobile(pathname: string): boolean {
  if (pathname === '/home' || pathname === '/feed') return true
  if (pathname.startsWith('/messaging')) return true
  if (pathname.startsWith('/notifications')) return true
  if (pathname.startsWith('/connections')) return true
  if (pathname.startsWith('/saved')) return true
  if (pathname === '/activity' || pathname.startsWith('/activity/')) return true
  if (pathname.startsWith('/events') || pathname.startsWith('/groups')) return true
  if (pathname.startsWith('/conventions/') && !pathname.includes('/register')) return true
  if (
    pathname === '/orgs' ||
    pathname.startsWith('/orgs/') ||
    isPeopleDirectoryNavActive(pathname) ||
    pathname === EXPLORE_DASHBOARD_PATH
  ) {
    return true
  }
  return false
}
