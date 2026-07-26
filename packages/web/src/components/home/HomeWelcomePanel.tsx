import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useApiMyRsvps } from '@/hooks/useApiMyRsvps'
import { useConversationsPreview } from '@/hooks/useConversationsPreview'
import { useApiProfileMe } from '@/hooks/useApiProfileMe'
import { useHomeWelcomePanelPrefs } from '@/hooks/useHomeWelcomePanelPrefs'
import { buildLoginHref } from '@/lib/auth-links'
import { buildProfileOnboardingHref, getProfileOnboardingGaps } from '@/lib/profile-onboarding'
import HomeUpcomingEventCard from '@/components/home/HomeUpcomingEventCard'
import WelcomeBanner from '@/components/WelcomeBanner'
import { homeQuickActionChipClass, homeWelcomeHeroClass } from '@/components/home/home-dashboard-styles'

type QuickAction = { label: string; href: string; icon?: ReactNode }

type Props = {
  className?: string
  dashboard?: boolean
  /** Completed members: ultra-compact strip, feed-first layout */
  preferCompact?: boolean
}

function useProfileGaps(enabled: boolean) {
  const profileMe = useApiProfileMe(enabled)
  return useMemo(() => {
    if (profileMe.status !== 'ready' || !profileMe.data) {
      return { loading: profileMe.status === 'loading', gaps: [] as ReturnType<typeof getProfileOnboardingGaps> }
    }
    const gaps = getProfileOnboardingGaps({
      homeZip: profileMe.data.profile.homeZip,
      birthDate: profileMe.data.profile.birthDate,
      photoCount: profileMe.data.photos.length,
    })
    return { loading: false, gaps }
  }, [profileMe])
}

function CompactDashboardCard({ className, preferCompact }: { className: string; preferCompact?: boolean }) {
  const { viewerDisplayName, viewerUsername, isAuthenticated, isFallback } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const name = viewerDisplayName ?? viewerUsername ?? 'there'
  const myRsvps = useApiMyRsvps(true)
  const { unreadCount: msgUnread } = useConversationsPreview()
  const { gaps } = useProfileGaps(signedIn)
  const profileIncomplete = gaps.length > 0
  const nextRsvp = myRsvps.status === 'ready' && myRsvps.items.length > 0 ? myRsvps.items[0] : null
  const { view, collapseToUpcoming, expandFull, dismissPromoFor7Days } = useHomeWelcomePanelPrefs(
    viewerUsername,
    preferCompact && !profileIncomplete,
  )
  const compact = view === 'upcoming-only' || preferCompact

  const quickActions: QuickAction[] = [
    { label: 'Events', href: '/events' },
    { label: 'Groups', href: '/groups' },
    ...(profileIncomplete ? [{ label: 'Finish profile', href: buildProfileOnboardingHref('/home') }] : []),
    { label: msgUnread > 0 ? `Messages (${msgUnread})` : 'Messages', href: '/messaging' },
  ]

  if (compact && !profileIncomplete) {
    return (
      <section
        className={`rounded-xl border border-white/[0.07] bg-dc-elevated/80 px-3 py-2.5 shadow-[var(--dc-shadow-soft)] ${className}`}
        aria-label="Today"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-dc-text">
            Hi, <span className="font-semibold text-dc-accent">{name}</span>
            {nextRsvp ?
              <span className="text-dc-muted"> · Next up soon</span>
            : null}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {quickActions.slice(0, 2).map((action) => (
              <Link
                key={action.href}
                to={action.href}
                className="inline-flex min-h-9 items-center rounded-lg border border-dc-border bg-dc-elevated-solid px-2.5 text-xs font-medium text-dc-text hover:border-dc-accent-border/40"
              >
                {action.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={expandFull}
              className="inline-flex min-h-9 items-center px-2 text-xs font-medium text-dc-accent hover:underline"
            >
              Today
            </button>
          </div>
        </div>
        {nextRsvp ?
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <HomeUpcomingEventCard
              compact
              embedded
              event={{
                eventId: nextRsvp.eventId,
                title: nextRsvp.title,
                startsAt: nextRsvp.startsAt,
                status: nextRsvp.status,
              }}
            />
          </div>
        : null}
      </section>
    )
  }

  return (
    <section className={`${homeWelcomeHeroClass} ${className}`} aria-label="Welcome back">
      <div className="absolute inset-0 bg-gradient-to-br from-dc-surface via-dc-surface/95 to-dc-elevated-solid" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,rgba(214,178,59,0.18),transparent_55%)]" aria-hidden />

      <div className="relative p-3 sm:p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {!profileIncomplete && !compact ?
              <WelcomeBanner username={viewerUsername} className="mb-2" />
            : null}
            <h1 className="text-base font-semibold tracking-tight text-dc-text sm:text-lg">
              Welcome back, <span className="text-dc-accent">{name}</span>
            </h1>
            {!compact ?
              <p className="mt-0.5 text-xs text-dc-text-muted sm:text-sm">Pick up where you left off.</p>
            : null}
          </div>
          {!profileIncomplete ?
            <button
              type="button"
              onClick={collapseToUpcoming}
              className="shrink-0 inline-flex min-h-9 items-center rounded-lg px-2 text-xs text-dc-muted hover:text-dc-text"
            >
              Minimize
            </button>
          : null}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto c2k-no-scrollbar pb-0.5">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href} className={`${homeQuickActionChipClass} shrink-0 !py-1.5 !text-xs`}>
              {action.label}
            </Link>
          ))}
        </div>

        {!compact && nextRsvp ?
          <div className="mt-2.5 border-t border-white/[0.08] pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">Your calendar</p>
            <HomeUpcomingEventCard
              compact
              embedded
              event={{
                eventId: nextRsvp.eventId,
                title: nextRsvp.title,
                startsAt: nextRsvp.startsAt,
                status: nextRsvp.status,
              }}
            />
          </div>
        : null}

        {!compact && !nextRsvp && !profileIncomplete ?
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to="/events"
              className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Find events
            </Link>
            <button type="button" onClick={dismissPromoFor7Days} className="text-xs text-dc-muted hover:text-dc-text">
              Hide for a week
            </button>
          </div>
        : null}
      </div>
    </section>
  )
}

export default function HomeWelcomePanel({ className = '', dashboard = false, preferCompact = false }: Props) {
  const { viewerDisplayName, viewerUsername, isAuthenticated, isFallback } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const name = viewerDisplayName ?? viewerUsername ?? 'there'
  const { gaps } = useProfileGaps(signedIn)
  const profileIncomplete = gaps.length > 0

  if (!signedIn) {
    return (
      <section
        className={`rounded-2xl border border-dc-border bg-dc-elevated-solid/90 p-4 shadow-[var(--dc-shadow-soft)] sm:p-5 ${className}`}
        aria-label="Welcome"
      >
        <h1 className="text-lg font-semibold text-dc-text sm:text-xl">Your community command center</h1>
        <p className="mt-1 max-w-xl text-sm text-dc-text-muted">
          Sign in to see upcoming events, community activity, and personalized discovery.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={buildLoginHref('/home')}
            className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Sign in
          </Link>
          <Link
            to="/events"
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
          >
            Explore events
          </Link>
        </div>
      </section>
    )
  }

  if (dashboard) {
    return <CompactDashboardCard className={className} preferCompact={preferCompact} />
  }

  return (
    <section className={`${homeWelcomeHeroClass} ${className}`} aria-label="Welcome back">
      <div className="relative p-4 sm:p-5">
        {!profileIncomplete ?
          <WelcomeBanner username={viewerUsername} className="mb-4" />
        : null}
        <h1 className="text-xl font-semibold tracking-tight text-dc-text sm:text-2xl">
          Welcome back, <span className="text-dc-accent">{name}</span>
        </h1>
        <p className="mt-1 max-w-lg text-sm text-dc-text-muted">
          Pick up where you left off with events, groups, and community updates tied to real-world participation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profileIncomplete ?
            <Link
              to={buildProfileOnboardingHref('/home')}
              className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Complete your profile
            </Link>
          : null}
          <Link
            to="/events"
            className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${
              profileIncomplete ?
                'border border-dc-border text-dc-text-muted hover:text-dc-text'
              : 'bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover'
            }`}
          >
            Find events near you
          </Link>
        </div>
      </div>
    </section>
  )
}
