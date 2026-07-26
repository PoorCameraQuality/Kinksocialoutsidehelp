import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'

type ActivityItem = {
  id: string
  label: string
  detail?: string
  href?: string
  when?: string
}

type Props = {
  viewerIsOwner: boolean
  ecosystem: UserEcosystemPayload | null
  extraItems?: ActivityItem[]
}

function buildActivityFromEcosystem(ecosystem: UserEcosystemPayload | null): ActivityItem[] {
  if (!ecosystem) return []
  const items: ActivityItem[] = []
  for (const e of ecosystem.upcomingEvents.slice(0, 3)) {
    items.push({
      id: `event-${e.id}`,
      label: `Upcoming: ${e.title}`,
      when: new Date(e.startsAt).toLocaleDateString(undefined, { dateStyle: 'medium' }),
      href: `/events/${encodeURIComponent(e.id)}`,
    })
  }
  for (const g of ecosystem.groups.slice(0, 2)) {
    items.push({
      id: `group-${g.id}`,
      label: `Member of ${g.name}`,
      href: `/groups/${encodeURIComponent(g.id)}`,
    })
  }
  for (const o of ecosystem.orgs.slice(0, 2)) {
    items.push({
      id: `org-${o.slug}`,
      label: `${o.role} at ${o.displayName}`,
      href: `/orgs/${encodeURIComponent(o.slug)}`,
    })
  }
  return items
}

export default function ProfileActivityTab({ viewerIsOwner, ecosystem, extraItems = [] }: Props) {
  const items = [...extraItems, ...buildActivityFromEcosystem(ecosystem)]

  if (items.length === 0) {
    return viewerIsOwner ?
        <EmptyState
          title="No recent activity yet"
          message="Attend events, join groups, and participate in the community. Activity will show here."
          ctaLabel="Browse events"
          ctaHref="/events"
          secondaryCtaLabel="Explore groups"
          secondaryCtaHref="/groups"
          inline
        />
      : <EmptyState title="No recent activity" message="This member has no visible recent activity." inline />
  }

  return (
    <Card padding="lg">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dc-muted mb-4">Recent activity</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-dc-border bg-dc-surface-muted/30 px-3 py-2.5 text-sm">
            {item.href ?
              <Link to={item.href} className="font-medium text-dc-text hover:text-dc-accent">
                {item.label}
              </Link>
            : <span className="font-medium text-dc-text">{item.label}</span>}
            {item.when ?
              <p className="text-xs text-dc-muted mt-0.5">{item.when}</p>
            : null}
            {item.detail ?
              <p className="text-xs text-dc-muted mt-0.5">{item.detail}</p>
            : null}
          </li>
        ))}
      </ul>
      {viewerIsOwner ?
        <Link to="/activity" className="mt-4 inline-block text-xs font-medium text-dc-accent hover:underline">
          View full activity
        </Link>
      : null}
    </Card>
  )
}
