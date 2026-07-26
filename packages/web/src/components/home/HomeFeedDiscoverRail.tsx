import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import HomeFeedSuggestedPerson from '@/components/home/HomeFeedSuggestedPerson'
import RailCard from '@/components/ui/RailCard'
import { AlphaNotice } from '@/components/ui/primitives'
import { fetchAlphaMode, isAlphaInviteMode } from '@/lib/alpha-mode'

type Suggestion = {
  userId?: string | number
  username: string
  displayName?: string | null
  subtitle?: string | null
  avatarUrl?: string | null
}

type UpcomingItem = { id: string; title: string; href: string; meta?: string }

type MyGroupItem = { id: string; name: string; href: string; unreadCount?: number }

type Props = {
  suggestions: Suggestion[]
  upcomingNearYou?: UpcomingItem[]
  myGroups?: MyGroupItem[]
  trendingEvents?: { id: string; title: string; href: string; mentions?: string }[]
  spotlight?: { username: string; bio: string; href: string; role?: string }
  /** desktop = full right rail; mobile-supplement = one block below feed on small viewports */
  variant?: 'desktop' | 'mobile-supplement'
  className?: string
}

function EmptyHint({ message }: { message: string }) {
  return <p className="text-xs leading-relaxed text-dc-muted">{message}</p>
}

export default function HomeFeedDiscoverRail({
  suggestions,
  upcomingNearYou = [],
  myGroups = [],
  trendingEvents = [],
  spotlight,
  variant = 'desktop',
  className = '',
}: Props) {
  const peopleList = suggestions.slice(0, 4)
  const mobileSupplement = variant === 'mobile-supplement'
  const [alphaMode, setAlphaMode] = useState(false)

  useEffect(() => {
    void fetchAlphaMode().then((m) => setAlphaMode(isAlphaInviteMode(m)))
  }, [])

  if (mobileSupplement) {
    return (
      <aside className={className} aria-label="Suggested next steps">
        <section className="space-y-3" aria-label="Upcoming events">
          <RailCard title="Upcoming near you" footerHref="/events" footerLabel="Browse events →">
            {upcomingNearYou.length > 0 ?
              <ul className="space-y-2.5">
                {upcomingNearYou.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <Link to={e.href} className="block rounded-lg p-1 hover:bg-dc-elevated-hover">
                      <span className="block text-sm font-medium text-dc-text hover:text-dc-accent">{e.title}</span>
                      {e.meta ? <span className="mt-0.5 block text-xs text-dc-muted">{e.meta}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            : <EmptyHint message="No events near you yet. Browse events to RSVP." />}
          </RailCard>
        </section>
      </aside>
    )
  }

  return (
    <aside
      className={`dc-rail-aside sticky top-[7.5rem] space-y-6 ${className}`.trim()}
      aria-label="Discovery"
    >
      <section className="space-y-3" aria-label="Upcoming events">
        <RailCard title="Upcoming near you" footerHref="/events" footerLabel="Browse events →">
          {upcomingNearYou.length > 0 ?
            <ul className="space-y-2.5">
              {upcomingNearYou.slice(0, 4).map((e) => (
                <li key={e.id}>
                  <Link to={e.href} className="block rounded-lg p-1 hover:bg-dc-elevated-hover">
                    <span className="block text-sm font-medium text-dc-text hover:text-dc-accent">{e.title}</span>
                    {e.meta ? <span className="mt-0.5 block text-xs text-dc-muted">{e.meta}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          : <EmptyHint message="No events near you yet. Browse events to RSVP." />}
        </RailCard>
      </section>

      <section className="space-y-3" aria-label="People suggestions">
        <div className="space-y-4">
          <RailCard title="People you may know" footerHref="/people" footerLabel="Find people →">
          <p className="mb-2.5 text-xs leading-relaxed text-dc-muted">
            Suggested from shared communities and geography — dismiss anyone you are not interested in.
          </p>
          {peopleList.length > 0 ?
            <div className="space-y-2">
              {peopleList.map((p) => (
                <HomeFeedSuggestedPerson
                  key={p.username}
                  userId={p.userId}
                  username={p.username}
                  displayName={p.displayName}
                  subtitle={p.subtitle}
                  avatarUrl={p.avatarUrl}
                />
              ))}
            </div>
          : <EmptyHint message="No suggestions yet. Complete your profile or explore people." />}
        </RailCard>

        {spotlight ?
          <RailCard title="Community spotlight">
            <p className="mb-2 text-xs leading-relaxed text-dc-muted">
              A member profile highlighted for community contribution — not an ad.
            </p>
            <p className="text-sm font-semibold text-dc-text">@{spotlight.username}</p>
            {spotlight.role ?
              <p className="mt-0.5 text-xs font-medium text-dc-accent">{spotlight.role}</p>
            : null}
            <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{spotlight.bio}</p>
            <Link
              to={spotlight.href}
              className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-dc-accent-border px-3 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted"
            >
              View profile
            </Link>
          </RailCard>
        : null}
        </div>
      </section>

      {myGroups.length > 0 ?
        <section className="space-y-3" aria-label="Your groups">
          <RailCard title="Groups you are in" footerHref="/groups" footerLabel="Explore groups →">
            <ul className="space-y-2">
              {myGroups.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <Link to={g.href} className="flex items-center justify-between gap-2 rounded-lg p-1 hover:bg-dc-elevated-hover">
                    <span className="truncate text-sm font-medium text-dc-text hover:text-dc-accent">{g.name}</span>
                    {g.unreadCount && g.unreadCount > 0 ?
                      <span className="shrink-0 rounded-full bg-dc-accent-muted px-2 py-0.5 text-[10px] font-semibold text-dc-accent">
                        {g.unreadCount}
                      </span>
                    : null}
                  </Link>
                </li>
              ))}
            </ul>
          </RailCard>
        </section>
      : null}

      <section className="space-y-3" aria-label="Trending in the community">
        <RailCard title="Trending in the community" footerHref="/explore" footerLabel="Browse trending →">
          <p className="mb-2.5 text-xs leading-relaxed text-dc-muted">
            Open the Trending tab for the full list.
          </p>
          {trendingEvents.length > 0 ?
            <ul className="space-y-2.5">
              {trendingEvents.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="mt-0.5 text-dc-muted" aria-hidden>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" d="M4 18l4-6 4 3 4-9 4 12" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <Link to={e.href} className="block text-sm font-medium text-dc-text hover:text-dc-accent">
                      {e.title}
                    </Link>
                    {e.mentions ? <span className="text-xs text-dc-muted">{e.mentions}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          : <EmptyHint message="No trending activity yet." />}
        </RailCard>
      </section>
      {alphaMode ?
        <AlphaNotice />
      : null}
    </aside>
  )
}
