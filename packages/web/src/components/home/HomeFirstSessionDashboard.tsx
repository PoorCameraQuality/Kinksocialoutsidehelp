import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { shouldShowStartHere } from '@c2k/shared'
import { useAuth } from '@/contexts/AuthContext'
import { useApiProfileMe } from '@/hooks/useApiProfileMe'
import { useApiMyRsvps } from '@/hooks/useApiMyRsvps'
import { useConversationsPreview } from '@/hooks/useConversationsPreview'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import HomeActivationCard from '@/components/home/HomeActivationCard'
import { buildHomeActivationItems } from '@/lib/home-activation'
import { AlphaNotice, ProfileCompletionCard, StartHereCard } from '@/components/ui/primitives'
import { ALPHA_FEEDBACK_LINK, EVENTS_ENTRY_HELPER, GROUPS_ENTRY_HELPER, PEOPLE_ENTRY_HELPER } from '@/lib/alpha-activation-copy'
import { PresetEmptyState } from '@/components/ui/empty-state-presets'
import { buildProfileOnboardingHref, getProfileOnboardingGaps } from '@/lib/profile-onboarding'
import HomeUpcomingEventCard from '@/components/home/HomeUpcomingEventCard'
import { homeQuickActionChipClass } from '@/components/home/home-dashboard-styles'

type Props = {
  events?: Array<{ id: string; title: string; startsAt?: string | null; locationLabel?: string | null }>
  groups?: Array<{ id: string; name: string; slug?: string }>
  className?: string
}

export default function HomeFirstSessionDashboard({ events = [], groups = [], className = '' }: Props) {
  const { isAuthenticated, isFallback, viewerDisplayName, viewerUsername } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const profileMe = useApiProfileMe(signedIn)
  const myRsvps = useApiMyRsvps(signedIn)
  const { unreadCount: msgUnread } = useConversationsPreview()
  const { feed, save } = useOnboardingState(signedIn)

  const dismissStartHere = useCallback(async () => {
    await save({ feed: { startHereDismissedAt: new Date().toISOString() } })
  }, [save])

  const profileGaps = useMemo(() => {
    if (profileMe.status !== 'ready' || !profileMe.data) return []
    return getProfileOnboardingGaps({
      homeZip: profileMe.data.profile.homeZip,
      birthDate: profileMe.data.profile.birthDate,
      photoCount: profileMe.data.photos.length,
    })
  }, [profileMe])

  if (!signedIn) return null

  const name = viewerDisplayName ?? viewerUsername ?? 'there'
  const profile = profileMe.status === 'ready' ? profileMe.data?.profile : null
  const photos = profileMe.status === 'ready' ? profileMe.data?.photos.length ?? 0 : 0
  const showStartHere = shouldShowStartHere(feed)
  const profileIncomplete = profileGaps.length > 0
  const nextRsvp = myRsvps.status === 'ready' && myRsvps.items.length > 0 ? myRsvps.items[0] : null

  const profileBasicsDone = (profile?.displayName ?? '').trim().length > 0 && ((profile?.bio ?? '').trim().length > 0 || photos > 0)
  const privacyConfigured = !!feed.onboardingCompletedAt || (feed.onboardingStep ?? 0) >= 5
  const hasEventRsvp = myRsvps.status === 'ready' && myRsvps.items.length > 0
  const activationItems = buildHomeActivationItems({
    profileBasicsDone,
    joinedGroup: groups.length > 0,
    hasEventRsvp,
    privacyConfigured,
  })

  const quickActions = [
    { label: 'Find people', href: '/people' },
    { label: 'Browse events', href: '/events' },
    { label: 'Explore groups', href: '/groups' },
    ...(profileIncomplete ? [{ label: 'Complete profile', href: buildProfileOnboardingHref('/home') }] : []),
    { label: msgUnread > 0 ? `Messages (${msgUnread})` : 'Open messages', href: '/messaging' },
  ]

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid/90 p-5 shadow-[var(--dc-shadow-soft)]">
        <h2 className="text-lg font-semibold text-dc-text">
          Welcome, <span className="text-dc-accent">{name}</span>
        </h2>
        <p className="mt-1 text-sm text-dc-text-muted">
          Home is your community center — follow people, connect with friends, join groups, and RSVP to events.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-dc-muted">{PEOPLE_ENTRY_HELPER}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href} className={homeQuickActionChipClass}>
              {action.label}
            </Link>
          ))}
        </div>
        <AlphaNotice className="mt-4" />
        {nextRsvp ?
          <div className="mt-4 border-t border-dc-border pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent">Your calendar</p>
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

      <HomeActivationCard items={activationItems} />

      <ProfileCompletionCard
        displayName={profile?.displayName}
        bio={profile?.bio}
        photoCount={photos}
        privacyConfigured={!!feed.onboardingCompletedAt || (feed.onboardingStep ?? 0) >= 5}
        joinedOrFollowed={groups.length > 0}
      />

      <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid/90 p-5">
        <h3 className="text-base font-semibold text-dc-text">Groups to start finding your people</h3>
        <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{GROUPS_ENTRY_HELPER}</p>
        {groups.length > 0 ?
          <ul className="mt-3 space-y-2">
            {groups.slice(0, 3).map((g) => (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`} className="text-sm text-dc-accent hover:underline">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        : <PresetEmptyState preset="noGroupsJoined" inline />
        }
      </section>

      <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid/90 p-5">
        <h3 className="text-base font-semibold text-dc-text">Upcoming events</h3>
        <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{EVENTS_ENTRY_HELPER}</p>
        {events.length > 0 ?
          <ul className="mt-3 space-y-2">
            {events.slice(0, 3).map((ev) => (
              <li key={ev.id}>
                <Link to={`/events/${ev.id}`} className="text-sm text-dc-accent hover:underline">
                  {ev.title}
                </Link>
              </li>
            ))}
          </ul>
        : <PresetEmptyState preset="noEventsNearby" inline />
        }
      </section>

      {showStartHere ?
        <StartHereCard onDismiss={() => void dismissStartHere()} />
      : null}

      <p className="text-xs text-dc-text-muted">
        You control your visibility and can report concerns at any time.{' '}
        <Link to="/support" className="text-dc-accent hover:underline">
          {ALPHA_FEEDBACK_LINK}
        </Link>
        {' · '}
        <Link to="/settings/privacy" className="text-dc-accent hover:underline">
          Privacy settings
        </Link>
      </p>
    </div>
  )
}
