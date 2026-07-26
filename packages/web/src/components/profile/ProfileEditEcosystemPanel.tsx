import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'
import { vendorProfilePath } from '@/lib/user-ecosystem'

type LinkRow = {
  title: string
  description: string
  publicWhere: string
  href: string
  status?: 'done' | 'available' | 'setup'
}

function statusLabel(status: LinkRow['status']) {
  if (status === 'done') return 'On your profile'
  if (status === 'setup') return 'Set up'
  return 'Optional'
}

function statusClass(status: LinkRow['status']) {
  if (status === 'done') return 'text-emerald-400/90'
  if (status === 'setup') return 'text-dc-accent'
  return 'text-dc-muted'
}

export default function ProfileEditEcosystemPanel({
  username,
  ecosystem,
}: {
  username: string | null
  ecosystem: UserEcosystemPayload | null
}) {
  const publicHref = username ? `/profile/${encodeURIComponent(username)}` : null

  const rows: LinkRow[] = [
    {
      title: 'ISO (in search of)',
      description: 'Wishlist visible on your public ISO tab; can accept DMs from ISO.',
      publicWhere: 'Public · ISO tab',
      href: '/profile?tab=ISO',
      status: 'available',
    },
    {
      title: 'Photo gallery',
      description: 'Additional photos beyond your main avatar.',
      publicWhere: 'Public · Photos tab',
      href: '/profile?tab=Media',
      status: 'available',
    },
    {
      title: 'Professional profile',
      description: 'Headline, offerings, teaching history, writing, photography, and convention program credits.',
      publicWhere: 'Also on Kink Social · Directory',
      href:
        ecosystem?.presenter && username ?
          `/presenters/${encodeURIComponent(username)}`
        : '/presenters/onboarding',
      status: ecosystem?.presenter ? 'done' : 'setup',
    },
    {
      title: 'Vendor shop',
      description: 'Product listings and shop page linked from your profile.',
      publicWhere: 'Also on Kink Social · Shop',
      href:
        ecosystem?.vendor ? vendorProfilePath(ecosystem.vendor) : '/vendors/onboarding',
      status: ecosystem?.vendor ? 'done' : 'setup',
    },
    {
      title: 'Articles & journal',
      description: 'Published writing appears on your profile Journal and Articles tabs.',
      publicWhere: 'Your dashboard · Journal',
      href: '/education/write',
      status: 'available',
    },
    {
      title: 'People search & privacy',
      description: 'Control discoverability, field visibility, and who can message you.',
      publicWhere: 'Discovery · not on public page',
      href: '/settings',
      status: 'available',
    },
    {
      title: 'Connections',
      description: 'Accepted connections affect trust weighting and social graph.',
      publicWhere: 'Stats on public profile',
      href: '/connections',
      status: 'available',
    },
    {
      title: 'References',
      description: 'Community vouches others leave on your public References tab.',
      publicWhere: 'Public · References tab',
      href: publicHref ? `${publicHref}?tab=References` : '/profile',
      status: 'available',
    },
  ]

  return (
    <div id="more" className="scroll-mt-28">
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-dc-text">More on your public profile</h2>
      <p className="text-sm text-dc-muted mt-1 max-w-prose">
        Your core story, photo, and interests are edited in the sections above. Everything else links out to
        specialized tools but still shapes how people experience you on Kink Social.
      </p>

      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li key={row.title}>
            <Link
              to={row.href}
              className="group flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-dc-border bg-dc-elevated-solid/60 px-4 py-3 hover:border-dc-accent-border/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dc-text group-hover:text-dc-accent">{row.title}</p>
                <p className="text-xs text-dc-muted mt-0.5">{row.description}</p>
                <p className="text-[10px] uppercase tracking-wide text-dc-muted mt-1">{row.publicWhere}</p>
              </div>
              <span className={`text-xs font-medium shrink-0 ${statusClass(row.status)}`}>
                {statusLabel(row.status)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {ecosystem && (ecosystem.orgs.length > 0 || ecosystem.groups.length > 0) && (
        <div className="mt-6 pt-6 border-t border-dc-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">Also on Kink Social strip</p>
          <p className="text-xs text-dc-muted mb-2">
            Orgs and groups you belong to appear as chips under your public header (managed in each org/group, not here).
          </p>
          <div className="flex flex-wrap gap-2">
            {ecosystem.orgs.map((o) => (
              <Link
                key={o.slug}
                to={`/orgs/${encodeURIComponent(o.slug)}`}
                className="text-xs px-2.5 py-1 rounded-lg border border-dc-border text-dc-text-muted hover:text-dc-text"
              >
                {o.displayName}
              </Link>
            ))}
            {ecosystem.groups.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${encodeURIComponent(g.id)}`}
                className="text-xs px-2.5 py-1 rounded-lg border border-dc-border text-dc-text-muted hover:text-dc-text"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
    </div>
  )
}
