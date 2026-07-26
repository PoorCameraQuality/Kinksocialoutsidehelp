import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { CommandAction } from '@/components/organizer/ui/OrganizerCommandPalette'
import OrganizerAppShell from '@/components/organizer/ui/OrganizerAppShell'
import OrganizerCommunicationsPanel from '@/components/organizer/OrganizerCommunicationsPanel'
import OrganizerGroupSettingsPanel from '@/components/organizer/OrganizerGroupSettingsPanel'
import OrganizerGroupEckePanel from '@/components/organizer/OrganizerGroupEckePanel'
import OrganizerHomePanel from '@/components/organizer/OrganizerHomePanel'
import OrganizerPeoplePanel from '@/components/organizer/OrganizerPeoplePanel'
import OrganizerSchedulePanel from '@/components/organizer/OrganizerSchedulePanel'
import OrganizerToolsPanel from '@/components/organizer/OrganizerToolsPanel'
import OrganizerGroupModerationPanel from '@/components/organizer/admin/OrganizerGroupModerationPanel'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { canAccessGroupOrganizerSettings, ORGANIZER_TAB_LABELS, parseOrganizerTab, type OrganizerTab } from '@/lib/organizer/types'

type GroupDetail = {
  id: string
  slug: string
  name: string
  visibility: string
  organizationId?: string | null
  viewerMember: { role: string } | null
  members: { id: string }[]
  parentOrganization?: { slug: string; displayName: string } | null
}

type ScheduleEventRow = {
  id: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  conventionSlug?: string | null
  organizationSlug?: string | null
}

type ScheduleConventionRow = {
  id: string
  slug: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  slotCount?: number
}

const GROUP_MOD_ROLES = new Set(['owner', 'admin', 'moderator', 'event_host'])

function hasGroupOrganizerAccess(groupRole: string, parentOrgRole: string | null): boolean {
  if (GROUP_MOD_ROLES.has(groupRole)) return true
  return parentOrgRole === 'OWNER'
}

export default function OrganizerGroupClient() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseOrganizerTab(searchParams.get('tab'))
  const { isAuthenticated, isFallback, status } = useAuth()

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [parentOrgRole, setParentOrgRole] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventRow[]>([])
  const [scheduleConventions, setScheduleConventions] = useState<ScheduleConventionRow[]>([])
  const [parentCalendarEnabled, setParentCalendarEnabled] = useState(true)

  const setTab = useCallback(
    (next: OrganizerTab) => {
      const p = new URLSearchParams(searchParams)
      if (next === 'home') p.delete('tab')
      else p.set('tab', next)
      setSearchParams(p, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    if (status !== 'ready') return
    if (!isAuthenticated || isFallback) {
      navigate(buildLoginHref(`/organizer/groups/${id}`), { replace: true })
    }
  }, [status, isAuthenticated, isFallback, navigate, id])

  useEffect(() => {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      setLoadError('Group organizer requires a database-backed group (UUID id).')
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const r = await fetch(`/api/v1/groups/${encodeURIComponent(id)}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setLoadError('Group not found or not visible to you.')
          return
        }
        const j = (await r.json()) as {
          group: GroupDetail & { organizationId?: string | null }
          viewerMember: GroupDetail['viewerMember']
          members: GroupDetail['members']
          parentOrganization?: GroupDetail['parentOrganization']
        }
        const g = {
          ...j.group,
          viewerMember: j.viewerMember,
          members: j.members,
          parentOrganization: j.parentOrganization,
          organizationId: j.group.organizationId ?? null,
        }
        if (!cancelled) setGroup(g)
        const role = j.viewerMember?.role?.toLowerCase() ?? ''
        let resolvedParentOrgRole: string | null = null
        if (j.parentOrganization?.slug) {
          const orgR = await fetch(`/api/v1/organizations/${encodeURIComponent(j.parentOrganization.slug)}`, {
            credentials: 'include',
          })
          if (orgR.ok) {
            const orgJ = (await orgR.json()) as {
              organization?: { viewerRole?: string | null; featureFlags?: { calendarEnabled?: boolean } }
            }
            resolvedParentOrgRole = orgJ.organization?.viewerRole ?? null
            if (!cancelled) {
              setParentOrgRole(resolvedParentOrgRole)
              setParentCalendarEnabled(orgJ.organization?.featureFlags?.calendarEnabled ?? true)
            }
          }
        }
        if (!hasGroupOrganizerAccess(role, resolvedParentOrgRole)) {
          if (!cancelled) setLoadError('You need moderator access or higher to use the organizer console.')
        }
        const ev = await fetch(`/api/v1/events?groupId=${encodeURIComponent(id)}`, { credentials: 'include' })
        if (!cancelled && ev.ok) {
          const ej = (await ev.json()) as {
            items?: {
              id: string
              title: string
              startsAt?: string | null
              endsAt?: string | null
              conventionSlug?: string | null
              organizationSlug?: string | null
            }[]
          }
          const items = ej.items ?? []
          setScheduleEvents(items)
          const linkedSlugs = new Set(items.map((e) => e.conventionSlug).filter(Boolean) as string[])
          if (linkedSlugs.size > 0 && j.parentOrganization?.slug) {
            const rc = await fetch(
              `/api/v1/organizations/${encodeURIComponent(j.parentOrganization.slug)}/conventions`,
              { credentials: 'include' },
            )
            if (!cancelled && rc.ok) {
              const cj = (await rc.json()) as {
                items?: {
                  id: string
                  slug: string
                  name: string
                  startsAt?: string | null
                  endsAt?: string | null
                  slotCount?: number
                }[]
              }
              setScheduleConventions(
                (cj.items ?? [])
                  .filter((c) => linkedSlugs.has(c.slug))
                  .map((c) => ({
                    id: c.id,
                    slug: c.slug,
                    title: c.name,
                    startsAt: c.startsAt,
                    endsAt: c.endsAt,
                    slotCount: c.slotCount,
                  })),
              )
            }
          }
        }
      } catch {
        if (!cancelled) setLoadError('Network error loading group.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const viewerRole = group?.viewerMember?.role ?? null
  const showSettings = canAccessGroupOrganizerSettings(parentOrgRole, viewerRole)
  const showParentOrgFeatureSettings = parentOrgRole === 'OWNER' || parentOrgRole === 'ADMIN'

  useEffect(() => {
    if (tab === 'settings' && !showSettings) setTab('home')
    if (tab === 'ecke' && !showSettings) setTab('home')
  }, [tab, showSettings, setTab])

  const commandActions = useMemo<CommandAction[]>(() => {
    if (!id) return []
    const base = `/organizer/groups/${encodeURIComponent(id)}`
    return (['home', 'schedule', 'people', 'communications', 'ecke', 'settings', 'tools'] as OrganizerTab[])
      .filter((t) => (t !== 'settings' && t !== 'ecke') || showSettings)
      .map((t) => ({
        id: `tab-${t}`,
        label: `Go to ${ORGANIZER_TAB_LABELS[t]}`,
        href: t === 'home' ? base : `${base}?tab=${t}`,
        keywords: t,
      }))
  }, [id, showSettings])

  const checklist = useMemo(() => {
    if (!group) return []
    return [
      {
        id: 'forums',
        label: 'Set up group forums for in-house discussion',
        done: false,
        href: `/groups/${encodeURIComponent(id)}`,
      },
      {
        id: 'listing',
        label: 'Preview ECKE public listing',
        done: false,
        href: `/organizer/groups/${encodeURIComponent(id)}?tab=ecke`,
      },
    ]
  }, [group, id])

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-dc-text-muted">{loadError}</p>
        <Link to="/organizer" className="mt-4 inline-block text-dc-accent hover:underline">
          Back to organizer hub
        </Link>
      </div>
    )
  }

  if (!group) {
    return <div className="mx-auto max-w-7xl px-4 py-12 h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
  }

  return (
    <OrganizerAppShell
      scopeKind="group"
      eyebrow="Group command bridge"
      title={group.name}
      subtitle={
        group.parentOrganization ?
          `Subgroup of ${group.parentOrganization.displayName}. Members interact on the public group page.`
        : 'Configure group settings and ECKE listing. Members interact on the public group page.'
      }
      roleBadge={viewerRole}
      publicHubHref={`/groups/${encodeURIComponent(id)}`}
      breadcrumbs={[
        { label: 'Organizer', href: '/organizer' },
        { label: group.name },
      ]}
      activeTab={tab}
      onTabChange={setTab}
      showSettings={showSettings}
      commandActions={commandActions}
      statusBarLeft={<span>/{group.slug || id.slice(0, 8)}</span>}
      statusBarRight={<span>{group.members?.length ?? 0} members</span>}
    >
      {tab === 'home' ?
        <OrganizerHomePanel scopeKind="group" scopeName={group.name} items={checklist} />
      : null}
      {tab === 'schedule' ?
        <OrganizerSchedulePanel
          scopeKind="group"
          groupId={id}
          orgId={group.organizationId ?? undefined}
          groupOrgSlug={group.parentOrganization?.slug}
          calendarEnabled={parentCalendarEnabled}
          showSettings={showParentOrgFeatureSettings}
          conventions={scheduleConventions}
          events={scheduleEvents}
        />
      : null}
      {tab === 'people' ?
        <OrganizerPeoplePanel
          scopeKind="group"
          groupId={id}
          canManageRoles={showSettings}
          viewerRole={viewerRole}
        />
      : null}
      {tab === 'communications' ?
        <OrganizerCommunicationsPanel scopeKind="group" groupId={id} viewerRole={viewerRole} />
      : null}
      {tab === 'moderation' ?
        <OrganizerGroupModerationPanel groupId={id} />
      : null}
      {tab === 'ecke' && showSettings ?
        <OrganizerGroupEckePanel groupId={id} />
      : null}
      {tab === 'settings' && showSettings ?
        <OrganizerGroupSettingsPanel
          groupId={id}
          groupName={group.name}
          onGroupChange={(patch) => setGroup((g) => (g ? { ...g, ...patch } : g))}
        />
      : null}
      {tab === 'tools' ? <OrganizerToolsPanel groupId={id} /> : null}
    </OrganizerAppShell>
  )
}
