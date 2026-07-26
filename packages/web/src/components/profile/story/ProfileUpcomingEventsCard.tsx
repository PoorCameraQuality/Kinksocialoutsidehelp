import { Link } from 'react-router-dom'

import type { UserEcosystemEventSnippet, UserEcosystemPayload } from '@/lib/user-ecosystem'

import { demoMockImageUrl } from '@/data/mock-data'

import { mediaDisplayUrl } from '@/lib/media-display-url'

import ProfileCard from './ProfileCard'

import { profileStoryBodyText, profileStoryEyebrow, profileStoryNestedRow } from './profile-story-classes'

import { IconCalendar } from './ProfileStoryIcons'

type Props = {
  ecosystem: UserEcosystemPayload | null
  username: string
  viewerIsOwner: boolean
}

function eventThumbUrl(event: { id: string; imageUrl?: string | null }): string {
  return mediaDisplayUrl(event.imageUrl) ?? demoMockImageUrl(`profile-evt-${event.id}`, 96, 96)
}

function eventsTabHref(username: string, viewerIsOwner: boolean): string {
  if (viewerIsOwner) return '/profile?tab=Events'
  return `/profile/${encodeURIComponent(username)}?tab=Events`
}

function participationLabel(event: UserEcosystemEventSnippet): string {
  if ((event.participation ?? 'hosting') === 'hosting') return 'Hosting'
  if (event.rsvpStatus === 'maybe') return 'Maybe'
  if (event.rsvpStatus === 'waitlist') return 'Waitlist'
  return 'Going'
}

function participationBadgeClass(event: UserEcosystemEventSnippet): string {
  if ((event.participation ?? 'hosting') === 'hosting') {
    return 'border-dc-accent/35 bg-dc-accent/10 text-dc-accent'
  }
  if (event.rsvpStatus === 'maybe') {
    return 'border-amber-500/35 bg-amber-950/30 text-amber-200'
  }
  if (event.rsvpStatus === 'waitlist') {
    return 'border-violet-500/35 bg-violet-950/35 text-violet-200'
  }
  return 'border-emerald-500/35 bg-emerald-950/30 text-emerald-200'
}

function EventRow({ event }: { event: UserEcosystemEventSnippet }) {
  return (
    <Link to={`/events/${encodeURIComponent(event.id)}`} className={profileStoryNestedRow}>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-dc-surface-muted ring-1 ring-inset ring-white/[0.06]">
        <img
          src={eventThumbUrl(event)}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-dc-text">{event.title}</span>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${participationBadgeClass(event)}`}
          >
            {participationLabel(event)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-dc-muted/85">
          {new Date(event.startsAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          {event.location ? ` · ${event.location}` : ''}
        </span>
      </span>
    </Link>
  )
}

function EventSection({
  title,
  hint,
  events,
}: {
  title: string
  hint?: string
  events: UserEcosystemEventSnippet[]
}) {
  if (events.length === 0) return null

  return (
    <div className="not-first:mt-5 not-first:border-t not-first:border-white/[0.06] not-first:pt-5">
      <p className={profileStoryEyebrow}>{title}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-dc-muted/75">{hint}</p> : null}
      <ul className="mt-3 space-y-2.5">
        {events.map((e) => (
          <li key={e.id}>
            <EventRow event={e} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ProfileUpcomingEventsCard({ ecosystem, username, viewerIsOwner }: Props) {
  const events = ecosystem?.upcomingEvents ?? []
  const hosting = events.filter((e) => (e.participation ?? 'hosting') === 'hosting')
  const rsvps = events.filter((e) => e.participation === 'rsvp')
  const viewAllHref = eventsTabHref(username, viewerIsOwner)

  if (events.length === 0) {
    return (
      <ProfileCard title="Upcoming & RSVPs" icon={<IconCalendar />}>
        <p className={profileStoryBodyText}>
          {viewerIsOwner ?
            'No upcoming events or RSVPs yet. Host something or RSVP to show where you will be.'
          : 'No upcoming public events or RSVPs right now.'}
        </p>
        {viewerIsOwner ?
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/events?create=event"
              className="inline-flex min-h-9 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Create event
            </Link>
            <Link
              to="/events"
              className="inline-flex min-h-9 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
            >
              Browse events
            </Link>
          </div>
        : null}
      </ProfileCard>
    )
  }

  return (
    <ProfileCard
      title="Upcoming & RSVPs"
      icon={<IconCalendar />}
      action={
        events.length > 3 ?
          <Link to={viewAllHref} className="text-xs font-medium text-dc-accent hover:underline">
            View all
          </Link>
        : null
      }
    >
      <EventSection title="Hosting" hint="Events they organize or host" events={hosting.slice(0, 3)} />
      <EventSection title="RSVP'd" hint="Events they plan to attend" events={rsvps.slice(0, 3)} />
    </ProfileCard>
  )
}
