import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OrgMemberRow } from '@/components/organizer/admin/OrgMemberAdminPanel'
import OrgClaimTransferPanel from '@/components/organizer/people/OrgClaimTransferPanel'
import MemberFilters from '@/components/organizer/people/MemberFilters'
import MemberRoster from '@/components/organizer/people/MemberRoster'
import PublicPersonnelPreviewCard from '@/components/organizer/people/PublicPersonnelPreviewCard'
import { PeoplePageHeader, PeopleSection, PeopleStatsRow, RoleGuideCard, inviteMemberDisabledTitle } from '@/components/organizer/people/people-ui'
import {
  computePeopleStats,
  filterMembers,
  sortMembers,
  type MemberFilter,
} from '@/lib/organizer/org-people-utils'

const ROSTER_ID = 'member-roster'

type Props = {
  orgSlug: string
  orgVisibility?: string | null
  canManageRoles: boolean
  viewerUserId: string | null
  viewerRole?: string | null
}

function LoadErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-xl border border-dc-danger-border/30 bg-red-950/25 px-4 py-3 text-sm text-red-200"
      role="alert"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text"
      >
        Retry
      </button>
    </div>
  )
}

export default function OrganizerOrgPeoplePanel({
  orgSlug,
  orgVisibility,
  canManageRoles,
  viewerUserId,
  viewerRole,
}: Props) {
  const [members, setMembers] = useState<OrgMemberRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<MemberFilter>('all')

  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`
  const publicHubHref = `/orgs/${encodeURIComponent(orgSlug)}?tab=Overview`
  const settingsContentHref = `${orgBase}?tab=settings&settingsSection=content`

  const reload = useCallback(async () => {
    const rm = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/members`, {
      credentials: 'include',
    })
    if (rm.ok) {
      const d = (await rm.json()) as { items: OrgMemberRow[] }
      setMembers(d.items ?? [])
      setLoadError(null)
    } else {
      setLoadError('Could not load member roster.')
    }
  }, [orgSlug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const rm = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/members`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (rm.ok) {
          const d = (await rm.json()) as { items: OrgMemberRow[] }
          setMembers(d.items ?? [])
        } else {
          setLoadError('Could not load member roster.')
          setMembers([])
        }
      } catch {
        if (!cancelled) {
          setLoadError('Network error loading members.')
          setMembers([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug])

  const sorted = useMemo(() => (members ? sortMembers(members) : []), [members])
  const filtered = useMemo(
    () => filterMembers(sorted, query, roleFilter),
    [sorted, query, roleFilter],
  )
  const stats = useMemo(() => computePeopleStats(sorted), [sorted])

  const soloOwnerGuidance = members?.length === 1 && members[0]?.role === 'OWNER'
  const isOwner = viewerRole === 'OWNER'

  return (
    <div className="space-y-5">
      <PeoplePageHeader
        stats={stats}
        publicHubHref={publicHubHref}
        canManageRoles={canManageRoles}
        rosterAnchorId={ROSTER_ID}
        orgVisibility={orgVisibility}
      />

      {members ?
        <PeopleStatsRow stats={stats} />
      : (
        <div className="h-20 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      )}

      {loadError ?
        <LoadErrorBanner message={loadError} onRetry={() => void reload()} />
      : null}

      {soloOwnerGuidance ?
        <PeopleSection className="border-dc-accent/25 bg-dc-accent/5">
          <p className="text-sm leading-relaxed text-dc-text">
            You are the only member right now. When your event team grows, invite trusted organizers, add moderators,
            or assign staff volunteer tags.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={publicHubHref}
              className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              View public hub
            </Link>
            <button
              type="button"
              disabled
              title={inviteMemberDisabledTitle(orgVisibility)}
              className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border border-dc-border px-4 text-sm text-dc-muted opacity-60"
            >
              Invite member
            </button>
          </div>
        </PeopleSection>
      : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
          {members ?
            <>
              <MemberFilters
                query={query}
                onQueryChange={setQuery}
                roleFilter={roleFilter}
                onRoleFilterChange={setRoleFilter}
              />
              <MemberRoster
                orgSlug={orgSlug}
                members={filtered}
                allMembers={sorted}
                canManageRoles={canManageRoles}
                viewerUserId={viewerUserId}
                onReload={reload}
                sectionId={ROSTER_ID}
              />
            </>
          : (
            <div className="h-48 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
          )}
        </div>

        <aside className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          {isOwner ?
            <OrgClaimTransferPanel orgSlug={orgSlug} />
          : null}
          {members ?
            <PublicPersonnelPreviewCard
              members={sorted}
              publicHubHref={publicHubHref}
              settingsContentHref={settingsContentHref}
              showSettings={canManageRoles}
            />
          : null}
          <RoleGuideCard />
          <PeopleSection>
            <h3 className="text-sm font-semibold text-dc-text">Need help?</h3>
            <ul className="mt-3 space-y-2 text-sm text-dc-text-muted">
              <li>Promote moderators for day-to-day community management.</li>
              <li>Use staff tags for volunteer roles on programs and events.</li>
              <li>Members choose public directory visibility from their own account.</li>
            </ul>
            <Link to="/support" className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
              Open help center →
            </Link>
          </PeopleSection>
        </aside>
      </div>
    </div>
  )
}
