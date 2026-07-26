import { Link } from 'react-router-dom'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import type { EventsSectionMode } from '@/lib/events-section-mode'

function ActionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-sm font-medium text-dc-text-muted transition-colors hover:border-dc-accent-border hover:bg-dc-elevated-hover hover:text-dc-text"
    >
      {children}
    </Link>
  )
}

type Props = {
  mode: EventsSectionMode
}

export default function EventsPersonalRightRail({ mode }: Props) {
  const showCreate = mode === 'hosted'

  return (
    <aside className={railAsideClass} aria-label="Next steps">
      {showCreate ?
        <RailCard title="Create your first event">
          <p className="text-xs leading-relaxed text-dc-text-muted">
            Host a munch, class, or community gathering. Use <strong className="font-medium text-dc-text">+ Create</strong>{' '}
            in the header, or open the event wizard directly.
          </p>
          <Link
            to="/events?create=event"
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-accent-border bg-dc-accent-muted/30 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted"
          >
            Open event wizard
          </Link>
        </RailCard>
      : null}

      <RailCard title="Keep exploring">
        <ul className="space-y-2">
          <li>
            <ActionLink to="/events">Find events near you</ActionLink>
          </li>
          <li>
            <ActionLink to="/conventions">Browse conventions</ActionLink>
          </li>
          <li>
            <ActionLink to="/profile">Complete your profile</ActionLink>
          </li>
          <li>
            <ActionLink to="/messaging">Open messages</ActionLink>
          </li>
          {mode === 'hosted' ?
            <li>
              <ActionLink to="/organizer">Open organizer tools</ActionLink>
            </li>
          : null}
        </ul>
      </RailCard>

      <div className="rounded-2xl border border-dc-accent-border/60 bg-dc-accent-muted/30 p-4">
        <p className="text-lg" aria-hidden>
          👑
        </p>
        <p className="mt-1 text-sm font-semibold text-dc-accent">Get more with Kink Social+</p>
        <p className="mt-1 text-xs text-dc-text-muted">Visibility, analytics, and organizer tools.</p>
        <Link
          to="/settings"
          className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Learn more
        </Link>
      </div>
    </aside>
  )
}
