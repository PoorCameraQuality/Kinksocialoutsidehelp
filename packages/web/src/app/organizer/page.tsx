import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardTemplate, { DashboardCard } from '@/components/templates/DashboardTemplate'
import OrganizerAppShell from '@/components/organizer/ui/OrganizerAppShell'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import type { OrganizerScopeGroup, OrganizerScopeOrg } from '@/lib/organizer/types'

function formatScopeRole(role: string): string {
  if (!role) return role
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function ScopeCard({
  title,
  slug,
  role,
  dashboardHref,
  publicHref,
  kind,
}: {
  title: string
  slug: string
  role: string
  dashboardHref: string
  publicHref: string
  kind: 'org' | 'group'
}) {
  return (
    <article className="dc-card-polish flex flex-col gap-3 rounded-2xl border border-dc-border bg-[var(--organizer-panel-bg)] p-4 shadow-[var(--dc-shadow-soft)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
            {kind === 'org' ? 'Organization' : 'Group'}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-dc-text">{title}</h3>
          <p className="mt-0.5 text-xs text-dc-muted">/{slug}</p>
        </div>
        <span className="shrink-0 rounded-full border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">
          {formatScopeRole(role)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={dashboardHref}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:flex-none sm:px-4"
        >
          Open dashboard
        </Link>
        <Link
          to={publicHref}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-dc-border px-3 text-sm font-medium text-dc-text-muted hover:border-dc-accent-border hover:text-dc-text sm:flex-none sm:px-4"
        >
          Public page
        </Link>
      </div>
    </article>
  )
}

function QuickActionLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      to={href}
      className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
        primary ?
          'bg-dc-accent/10 text-dc-accent hover:bg-dc-accent/15'
        : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
      }`}
    >
      {label}
    </Link>
  )
}

export default function OrganizerHubPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isFallback, status } = useAuth()
  const [orgs, setOrgs] = useState<OrganizerScopeOrg[] | null>(null)
  const [groups, setGroups] = useState<OrganizerScopeGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'ready') return
    if (!isAuthenticated || isFallback) {
      navigate(buildLoginHref('/organizer'), { replace: true })
    }
  }, [status, isAuthenticated, isFallback, navigate])

  useEffect(() => {
    if (!isAuthenticated || isFallback) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/v1/organizer/scopes', { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setError(r.status === 401 ? 'Sign in to open the organizer dashboard.' : 'Could not load your organizer scopes.')
          return
        }
        const j = (await r.json()) as { orgs: OrganizerScopeOrg[]; groups: OrganizerScopeGroup[] }
        if (!cancelled) {
          setOrgs(j.orgs ?? [])
          setGroups(j.groups ?? [])
        }
      } catch {
        if (!cancelled) setError('Network error.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isFallback])

  const loading = orgs === null && groups === null && !error
  const orgCount = orgs?.length ?? 0
  const groupCount = groups?.length ?? 0
  const totalScopes = orgCount + groupCount
  const scopeSummary =
    totalScopes === 0 ? 'No communities yet'
    : `${orgCount} organization${orgCount === 1 ? '' : 's'} · ${groupCount} group${groupCount === 1 ? '' : 's'}`

  return (
    <OrganizerAppShell
      scopeKind="hub"
      eyebrow="Organizer"
      title="Manage your communities"
      subtitle={scopeSummary}
      statusBarLeft={<span>{totalScopes > 0 ? `${totalScopes} dashboard${totalScopes === 1 ? '' : 's'} available` : 'Get started below'}</span>}
      statusBarRight={<span className="hidden sm:inline">Press ⌘K to jump</span>}
      headerActions={
        <Link
          to="/events?create=event"
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Create event
        </Link>
      }
    >
      <DashboardTemplate title="" description="" className="max-w-none px-0 py-0">
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Quick actions" className="sm:col-span-2 lg:col-span-2">
            <div className="flex flex-wrap gap-2">
              <QuickActionLink href="/events?create=event" label="Create event" primary />
              <QuickActionLink href="/orgs/new" label="Create organization" />
              <QuickActionLink href="/groups/onboarding" label="Create group" />
              <QuickActionLink href="/orgs" label="Browse organizations" />
            </div>
          </DashboardCard>
          <DashboardCard title="Looking for another organization?">
            <p className="mb-2 text-xs leading-relaxed text-dc-text-muted">
              Request access from an org admin or browse public organization pages.
            </p>
            <Link to="/orgs" className="text-sm font-medium text-dc-accent hover:underline">
              Browse organizations →
            </Link>
          </DashboardCard>
        </div>

        {error ? <p className="text-dc-text-muted">{error}</p> : null}
        {loading ?
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
            ))}
          </div>
        : null}

        {orgs && orgs.length > 0 ?
          <OrganizerPanel title="Organizations" description="Manage events, members, and public hub settings.">
            <div className="grid gap-3 sm:grid-cols-2">
              {orgs.map((o) => (
                <ScopeCard
                  key={o.id}
                  kind="org"
                  title={o.displayName}
                  slug={o.slug}
                  role={o.role}
                  dashboardHref={`/organizer/orgs/${encodeURIComponent(o.slug)}`}
                  publicHref={`/orgs/${encodeURIComponent(o.slug)}`}
                />
              ))}
            </div>
          </OrganizerPanel>
        : null}

        {groups && groups.length > 0 ?
          <OrganizerPanel title="Groups" description="Subgroup and standalone group dashboards.">
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => (
                <ScopeCard
                  key={g.id}
                  kind="group"
                  title={g.name}
                  slug={g.slug || g.id.slice(0, 8)}
                  role={g.role}
                  dashboardHref={`/organizer/groups/${encodeURIComponent(g.id)}`}
                  publicHref={`/groups/${encodeURIComponent(g.id)}`}
                />
              ))}
            </div>
          </OrganizerPanel>
        : null}

        {orgs && groups && orgs.length === 0 && groups.length === 0 && !error ?
          <OrganizerPanel title="No organizer access yet">
            <p className="text-sm text-dc-text-muted">
              You need moderator role or higher on an organization or group to open a dashboard here.
            </p>
            <Link to="/orgs" className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
              Browse organizations
            </Link>
          </OrganizerPanel>
        : null}
      </DashboardTemplate>
    </OrganizerAppShell>
  )
}
