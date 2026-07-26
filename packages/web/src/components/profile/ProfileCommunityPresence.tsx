import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import { vendorProfilePath } from '@/lib/user-ecosystem'

type Props = {
  username: string
  ecosystem: UserEcosystemPayload | null
  eventsAttended?: number
  educationContributions?: number
  onSelectTab?: (tab: string) => void
}

export default function ProfileCommunityPresence({
  username,
  ecosystem,
  eventsAttended = 0,
  educationContributions = 0,
  onSelectTab,
}: Props) {
  const orgs = ecosystem?.orgs ?? []
  const groups = ecosystem?.groups ?? []
  const upcoming = ecosystem?.upcomingEvents ?? []
  const presenter = ecosystem?.presenter
  const vendor = ecosystem?.vendor

  const items: { key: string; label: string; detail: string; href?: string; onClick?: () => void }[] = []

  if (orgs.length > 0) {
    const primary = orgs[0]
    items.push({
      key: 'org',
      label: orgs.length === 1 ? 'Organizer' : 'Organizations',
      detail: orgs.length === 1 ? `Organizer of ${primary.displayName}` : `Member of ${orgs.length} organizations`,
      href: `/organizations/${encodeURIComponent(primary.slug)}`,
    })
  } else {
    items.push({
      key: 'org',
      label: 'Organizations',
      detail: 'No public organizations',
    })
  }

  if (groups.length === 1) {
    items.push({
      key: 'groups',
      label: 'Groups',
      detail: `Member of ${groups[0].name}`,
      href: `/groups/${encodeURIComponent(groups[0].slug)}`,
    })
  } else if (groups.length > 1) {
    items.push({
      key: 'groups',
      label: 'Groups',
      detail: `Member of ${groups.length} groups`,
      onClick: () => onSelectTab?.('Groups'),
    })
  } else {
    items.push({
      key: 'groups',
      label: 'Groups',
      detail: 'No public groups',
    })
  }

  items.push({
    key: 'upcoming',
    label: 'Upcoming events',
    detail: upcoming.length > 0 ? `Hosting ${upcoming.length} upcoming events` : 'No upcoming public events',
    onClick: upcoming.length > 0 ? () => onSelectTab?.('Events') : undefined,
  })

  items.push({
    key: 'attended',
    label: 'Events attended',
    detail: eventsAttended > 0 ? `${eventsAttended} events attended` : 'No attended events shared yet',
    onClick: eventsAttended > 0 ? () => onSelectTab?.('Events') : undefined,
  })

  if (educationContributions > 0) {
    items.push({
      key: 'education',
      label: 'Education',
      detail: `${educationContributions} education contributions`,
      onClick: () => onSelectTab?.('Media'),
    })
  }

  return (
    <Card padding="lg">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dc-muted mb-3">Community presence</h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const inner = (
            <>
              <p className="text-sm font-medium text-dc-text">{item.detail}</p>
              <p className="text-xs text-dc-muted mt-0.5">{item.label}</p>
            </>
          )
          return (
            <li key={item.key}>
              {item.href ?
                <Link
                  to={item.href}
                  className="block rounded-xl border border-dc-border bg-dc-surface-muted/30 px-3 py-2.5 hover:border-dc-accent/40 transition-colors"
                >
                  {inner}
                </Link>
              : item.onClick ?
                <button
                  type="button"
                  onClick={item.onClick}
                  className="w-full text-left rounded-xl border border-dc-border bg-dc-surface-muted/30 px-3 py-2.5 hover:border-dc-accent/40 transition-colors"
                >
                  {inner}
                </button>
              : <div className="rounded-xl border border-dc-border bg-dc-surface-muted/20 px-3 py-2.5">{inner}</div>}
            </li>
          )
        })}
      </ul>
      {(presenter || vendor) ?
        <div className="mt-4 flex flex-wrap gap-2">
          {presenter ?
            <Link
              to={`/presenters/${encodeURIComponent(username)}`}
              className="text-xs font-medium text-dc-accent hover:underline"
            >
              Presenter profile
            </Link>
          : null}
          {vendor ?
            <Link to={vendorProfilePath(vendor)} className="text-xs font-medium text-dc-accent hover:underline">
              Vendor shop
            </Link>
          : null}
        </div>
      : null}
    </Card>
  )
}
