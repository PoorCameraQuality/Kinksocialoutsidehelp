import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { ROLE_GUIDE, type PeopleStats } from '@/lib/organizer/org-people-utils'

export function PeopleSection({
  className,
  id,
  children,
}: {
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn('rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-[var(--dc-shadow-soft)] sm:p-6', className)}
    >
      {children}
    </section>
  )
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth={1.75} strokeLinecap="round" d="M16 19v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6zM20 19v-1a3 3 0 00-2-2.83M4 19v-1a3 3 0 012-2.83" />
    </svg>
  )
}

export function inviteMemberDisabledTitle(orgVisibility?: string | null): string {
  if (orgVisibility === 'PRIVATE') {
    return 'Private organizations require an admin to add members manually until invitations ship.'
  }
  return 'Invitations are not available yet. Share your public hub so members can join.'
}

export function PeoplePageHeader({
  stats,
  publicHubHref,
  canManageRoles,
  rosterAnchorId,
  orgVisibility,
}: {
  stats: PeopleStats
  publicHubHref: string
  canManageRoles: boolean
  rosterAnchorId: string
  orgVisibility?: string | null
}) {
  return (
    <PeopleSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dc-accent">Team</p>
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-dc-text sm:text-2xl">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent/15 text-dc-accent">
              <PeopleIcon className="h-5 w-5" />
            </span>
            People & roles
          </h2>
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Manage members, organizer access, volunteer tags, and public directory visibility.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled
            title={inviteMemberDisabledTitle(orgVisibility)}
            className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border border-dc-border/60 px-4 text-sm font-medium text-dc-muted opacity-60"
          >
            Invite member
          </button>
          {canManageRoles ?
            <a
              href={`#${rosterAnchorId}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
            >
              Manage roles
            </a>
          : null}
          <Link
            to={publicHubHref}
            className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:border-dc-border-strong hover:text-dc-text"
          >
            View public personnel
          </Link>
        </div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-dc-text-muted">
        <div>
          <dt className="inline text-dc-muted">Members </dt>
          <dd className="inline font-medium text-dc-text">{stats.total}</dd>
        </div>
        <div>
          <dt className="inline text-dc-muted">Owners / admins </dt>
          <dd className="inline font-medium text-dc-text">{stats.ownersAdmins}</dd>
        </div>
        <div>
          <dt className="inline text-dc-muted">Public on hub </dt>
          <dd className="inline font-medium text-dc-text">{stats.visible}</dd>
        </div>
      </dl>
    </PeopleSection>
  )
}

export function PeopleStatsRow({ stats }: { stats: PeopleStats }) {
  const cards = [
    { label: 'Members', value: stats.total, sub: 'Total roster' },
    { label: 'Owners / admins', value: stats.ownersAdmins, sub: 'Full control' },
    { label: 'Moderators', value: stats.moderators, sub: 'Community ops' },
    { label: 'Staff', value: stats.staff, sub: 'Volunteer crew' },
    { label: 'Visible on hub', value: stats.visible, sub: 'Public directory', highlight: stats.visible > 0 },
    { label: 'Hidden', value: stats.hidden, sub: 'Not on Overview' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'rounded-xl border border-dc-border bg-dc-surface/50 px-3 py-3',
            c.highlight && 'border-emerald-500/30 bg-emerald-950/15',
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">{c.label}</p>
          <p className="mt-1 text-xl font-semibold text-dc-text">{c.value}</p>
          <p className="mt-0.5 text-dc-micro text-dc-muted">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

export function RoleGuideCard() {
  return (
    <PeopleSection>
      <h3 className="text-sm font-semibold text-dc-text">Role guide</h3>
      <ul className="mt-3 space-y-3">
        {ROLE_GUIDE.map((row) => (
          <li key={row.role} className="rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2.5">
            <p className="text-sm font-medium text-dc-text">{row.role}</p>
            <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
              <span className="text-dc-muted">Console: </span>
              {row.console}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
              <span className="text-dc-muted">Public hub: </span>
              {row.public}
            </p>
          </li>
        ))}
      </ul>
      <Link to="/support" className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
        Learn more about roles →
      </Link>
    </PeopleSection>
  )
}
