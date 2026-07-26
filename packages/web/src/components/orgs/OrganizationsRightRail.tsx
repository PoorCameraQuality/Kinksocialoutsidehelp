import { Link } from 'react-router-dom'
import { useOrganizerOrgScopes } from '@/hooks/useOrganizerOrgScopes'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'

const CAPABILITY_ITEMS = [
  'Create events and conventions',
  'Manage staff and volunteers',
  'Run groups and announcements',
  'Coordinate vendors and presenters',
  'Build reputation over time',
] as const

export default function OrganizationsRightRail() {
  const { hasAnyScope, loading: scopesLoading } = useOrganizerOrgScopes()
  const showDashboard = !scopesLoading && hasAnyScope

  return (
    <aside className={railAsideClass} aria-label="About organizations on Kink Social">
      <RailCard title={showDashboard ? 'Manage your community' : 'Start a community'} emphasize>
        <p className="text-xs leading-relaxed text-dc-text-muted">
          {showDashboard ?
            'Jump back into your organizer tools — events, schedules, staff, and attendee workflows in one place.'
          : 'Bring your events, schedules, staff, and attendee workflows into one organizer workspace.'}
        </p>
        {showDashboard ?
          <>
            <Link
              to="/organizer"
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Open organizer dashboard
            </Link>
            <Link
              to="/orgs/new"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-dc-accent hover:underline"
            >
              Create another organization
              <span aria-hidden>→</span>
            </Link>
          </>
        : <Link
            to="/orgs/new"
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Create organization
          </Link>
        }
      </RailCard>

      <RailCard title="What organizations can do">
        <ul className="space-y-2">
          {CAPABILITY_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-dc-text-muted">
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dc-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard
        title="Already helping run a community?"
        footerHref="/guidelines"
        footerLabel="Learn about roles"
      >
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Ask an organization owner to add you as staff so you can help manage events, groups, or convention
          tools.
        </p>
      </RailCard>

      <RailCard
        title="Why reputation matters"
        footerHref="/guidelines"
        footerLabel="How reputation works"
      >
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Reviews and consistent real-world participation help communities trust organizers. Higher standing
          improves visibility across events and discovery.
        </p>
      </RailCard>
    </aside>
  )
}
