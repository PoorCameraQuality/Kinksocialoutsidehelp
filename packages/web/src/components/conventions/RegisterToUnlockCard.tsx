import { Link } from 'react-router-dom'

const TAB_COPY: Record<string, { title: string; body: string }> = {
  Documents: {
    title: 'Register to view documents',
    body: 'Sign agreements, waivers, and event materials are available after you complete registration.',
  },
  Announcements: {
    title: 'Register for announcements',
    body: 'Organizer updates and broadcast messages appear here once you are registered.',
  },
  Chat: {
    title: 'Register to join chat',
    body: 'Convention chat channels unlock when your registration is confirmed.',
  },
  ISO: {
    title: 'Register to view the ISO board',
    body: 'The attendee ISO board is visible to registered participants.',
  },
  Dancecard: {
    title: 'Register for your dancecard',
    body: 'Your personal schedule, bookings, and on-site tools live on your dancecard after registration.',
  },
  More: {
    title: 'Register to explore more',
    body: 'Venue maps, photo gallery, and extra resources unlock after registration.',
  },
}

type Props = {
  tab: string
  registerHref: string
  anchorEventId?: string | null
  isAuthenticated?: boolean
}

export default function RegisterToUnlockCard({ tab, registerHref, anchorEventId, isAuthenticated }: Props) {
  const copy = TAB_COPY[tab] ?? {
    title: 'Registration required',
    body: 'This area is for confirmed attendees and staff.',
  }
  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted space-y-4">
      <div>
        <p className="text-base font-semibold text-dc-text">{copy.title}</p>
        <p className="mt-2 leading-relaxed">{copy.body}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          to={registerHref}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-text hover:bg-dc-accent-hover"
        >
          Register
        </Link>
        {!isAuthenticated ? (
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Sign in
          </Link>
        ) : null}
      </div>
      {isAuthenticated && anchorEventId ? (
        <p>
          Already paid? Check your status on the{' '}
          <Link to={`/events/${encodeURIComponent(anchorEventId)}`} className="text-dc-accent hover:underline">
            anchor event
          </Link>
          .
        </p>
      ) : null}
    </div>
  )
}
