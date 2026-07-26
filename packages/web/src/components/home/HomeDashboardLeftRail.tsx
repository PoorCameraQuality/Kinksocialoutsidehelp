import { useMemo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'
import { isHomeLeftRailHomeActive, isHomeLeftRailLinkActive } from '@/lib/home-left-rail-nav'
import { useAuth } from '@/contexts/AuthContext'
import { useHomeTrustRailPrefs } from '@/hooks/useHomeTrustRailPrefs'
import { useConversationsPreview } from '@/hooks/useConversationsPreview'
import { useNotificationsList } from '@/hooks/useNotificationsList'
import { useApiProfileMe } from '@/hooks/useApiProfileMe'
import {
  buildProfileOnboardingHref,
  formatProfileOnboardingGaps,
  getProfileOnboardingGaps,
  type ProfileOnboardingGap,
} from '@/lib/profile-onboarding'
import { railNavShellClass } from '@/lib/card-surface'
import {
  NavIconConnections,
  NavIconEvents,
  NavIconExplore,
  NavIconFeed,
  NavIconMessages,
  NavIconPosts,
  NavIconSaved,
} from '@/components/home/homeFeedNavIcons'

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number }

const PROFILE_ESSENTIALS: { gap: ProfileOnboardingGap; label: string }[] = [
  { gap: 'photo', label: 'Profile photo' },
  { gap: 'zip', label: 'ZIP code' },
  { gap: 'birthDate', label: 'Date of birth' },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        to={item.href}
        className={`flex min-h-9 items-center gap-2 rounded-lg py-1.5 pl-2 pr-2 text-sm font-medium transition-colors ${
          active ?
            'border-l-2 border-l-dc-accent bg-white/[0.04] text-dc-accent'
          : 'text-dc-text-muted hover:bg-white/[0.03] hover:text-dc-text'
        }`}
      >
        <span className={active ? 'text-dc-accent' : 'text-dc-muted'}>{item.icon}</span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge != null ?
          <span className="rounded-full bg-dc-accent px-1.5 py-0.5 text-[10px] font-bold text-dc-accent-foreground">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        : null}
      </Link>
    </li>
  )
}

function ChecklistIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
    </svg>
  )
}

export default function HomeDashboardLeftRail({ omitHomeLink = false }: { omitHomeLink?: boolean }) {
  const { pathname, search } = useLocation()
  const { isAuthenticated, isFallback, viewerUsername } = useAuth()
  const { unreadCount: msgUnread } = useConversationsPreview()
  const { unreadCount: notifUnread } = useNotificationsList()
  const signedIn = isAuthenticated && !isFallback
  const trustRail = useHomeTrustRailPrefs(signedIn ? viewerUsername : null)
  const profileMe = useApiProfileMe(signedIn)

  const profileState = useMemo(() => {
    if (!signedIn) {
      return { loading: false, gaps: [] as ProfileOnboardingGap[], completion: 0 }
    }
    if (profileMe.status === 'loading' || profileMe.status === 'idle') {
      return { loading: true, gaps: [] as ProfileOnboardingGap[], completion: 0 }
    }
    if (profileMe.status !== 'ready' || !profileMe.data) {
      return {
        loading: false,
        gaps: ['zip', 'birthDate', 'photo'] as ProfileOnboardingGap[],
        completion: 0,
      }
    }
    const gaps = getProfileOnboardingGaps({
      homeZip: profileMe.data.profile.homeZip,
      birthDate: profileMe.data.profile.birthDate,
      photoCount: profileMe.data.photos.length,
    })
    const completion = Math.round(((PROFILE_ESSENTIALS.length - gaps.length) / PROFILE_ESSENTIALS.length) * 100)
    return { loading: false, gaps, completion }
  }, [signedIn, profileMe])

  const { loading, gaps, completion } = profileState
  const profileComplete = signedIn && !loading && gaps.length === 0
  const finishHref = buildProfileOnboardingHref('/home')
  const missingLabel = formatProfileOnboardingGaps(gaps)

  const myC2k: NavItem[] = [
    { href: '/home?mode=discover&tab=Local', label: 'Home', icon: <NavIconFeed /> },
    { href: '/events?mine=registrations', label: 'My RSVPs & registrations', icon: <NavIconEvents /> },
    {
      href: '/messaging',
      label: 'Messages',
      icon: <NavIconMessages />,
      badge: signedIn && msgUnread > 0 ? msgUnread : undefined,
    },
    {
      href: '/notifications',
      label: 'Notifications',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
      badge: signedIn && notifUnread > 0 ? notifUnread : undefined,
    },
    { href: '/connections', label: 'Connections', icon: <NavIconConnections /> },
    { href: '/saved', label: 'Saved', icon: <NavIconSaved /> },
    { href: '/my-posts', label: 'My Posts', icon: <NavIconPosts /> },
    { href: PEOPLE_DIRECTORY_PATH, label: 'Find people', icon: <NavIconExplore /> },
  ]

  const navItems = omitHomeLink ? myC2k.filter((item) => item.label !== 'Home') : myC2k

  return (
    <nav className="sticky top-[7.5rem] space-y-1" aria-label="Home shortcuts">
      <div className={railNavShellClass}>
        <p className="mb-1 text-sm font-semibold text-dc-text">Shortcuts</p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={
                item.label === 'Home' ?
                  isHomeLeftRailHomeActive(pathname, search)
                : isHomeLeftRailLinkActive(item.href, pathname, search)
              }
            />
          ))}
        </ul>

        {signedIn && profileComplete ?
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Support</p>
            <p className="mt-1.5 text-sm font-semibold text-dc-text">Support kink.social</p>
            <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
              Help keep the community platform running for organizers, educators, and members.
            </p>
            <button
              type="button"
              disabled
              title="Payment options coming soon"
              className="mt-3 inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground opacity-60"
            >
              Support kink.social
            </button>
          </div>
        : signedIn && trustRail.visible ?
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Trust</p>
              <button
                type="button"
                onClick={trustRail.dismiss}
                className="shrink-0 text-xs font-medium text-dc-muted transition-colors hover:text-dc-text"
              >
                Hide
              </button>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-dc-text">Help people recognize you</p>
            <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
              {loading ?
                'Checking your profile essentials…'
              : `Add your ${missingLabel} so people can find and trust you.`}
            </p>

            {!loading ?
              <ul className="mt-2.5 space-y-1" aria-label="Profile essentials">
                {PROFILE_ESSENTIALS.map(({ gap, label }) => {
                  const done = !gaps.includes(gap)
                  return (
                    <li key={gap} className="flex items-center gap-2 text-[11px]">
                      <ChecklistIcon done={done} />
                      <span className={done ? 'text-dc-text-muted line-through' : 'text-dc-text'}>{label}</span>
                    </li>
                  )
                })}
              </ul>
            : null}

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-dc-elevated-muted">
              <div
                className="h-full rounded-full bg-dc-accent transition-[width]"
                style={{ width: loading ? '0%' : `${completion}%` }}
                role="progressbar"
                aria-valuenow={loading ? 0 : completion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile essentials completion"
                aria-busy={loading}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-dc-muted">
              {loading ? 'Loading…' : `${completion}% essentials complete`}
            </p>

            <Link
              to={finishHref}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Complete profile
            </Link>
          </div>
        : null}
      </div>
    </nav>
  )
}
