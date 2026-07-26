import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CreateFlowTriggerButton from '@/components/create-flow/CreateFlowTriggerButton'
import type { CommandAction } from '@/components/organizer/ui/OrganizerCommandPalette'
import OrganizerOrgHomePanel from '@/components/organizer/org-console/OrganizerOrgHomePanel'
import type { QuickAction } from '@/components/organizer/org-console/QuickActionsCard'
import OrganizerAppShell from '@/components/organizer/ui/OrganizerAppShell'
import OrganizerCommunicationsPanel from '@/components/organizer/OrganizerCommunicationsPanel'
import OrganizerOrgSettingsPanel from '@/components/organizer/OrganizerOrgSettingsPanel'
import OrganizerPeoplePanel from '@/components/organizer/OrganizerPeoplePanel'
import OrganizerSchedulePanel from '@/components/organizer/OrganizerSchedulePanel'
import OrganizerToolsPanel from '@/components/organizer/OrganizerToolsPanel'
import OrganizerOrgModerationPanel from '@/components/organizer/admin/OrganizerOrgModerationPanel'
import OrganizerOrgEckePanel from '@/components/organizer/OrganizerOrgEckePanel'
import OrganizerOrgPaymentsPanel from '@/components/organizer/payments/OrganizerOrgPaymentsPanel'
import OrganizerOrgPaymentsSetupPanel from '@/components/organizer/payments/OrganizerOrgPaymentsSetupPanel'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { buildOrgChecklistWithConventions } from '@/lib/organizer/build-org-checklist'
import { openCreateFlow } from '@/lib/open-create-flow'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import {
  calendarApiFailureKind,
  mergeCalendarLoadState,
  type OrgCalendarLoadState,
} from '@/lib/org-calendar-fetch'
import { isLegacyPaymentsSettingsSection } from '@/lib/organizer/org-settings-utils'
import {
  canAccessOrganizerModeration,
  canAccessOrganizerSettings,
  ORGANIZER_TAB_LABELS,
  parseOrganizerTab,
  type OrganizerTab,
} from '@/lib/organizer/types'

type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  chatEnabled: boolean
  subgroupsEnabled?: boolean
  externalEmbedEnabled?: boolean
}

type OrgDetail = {
  id: string
  slug: string
  displayName: string
  visibility: string
  viewerRole: string | null
  viewerCanManagePayments?: boolean
  memberCount: number
  featureFlags: OrgFlags
  logoUrl?: string | null
  bannerUrl?: string | null
  community?: {
    welcomeHtml?: string | null
    faq?: { q: string; a: string }[] | null
  } | null
}

type ConventionItem = {
  id: string
  slug: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  slotCount?: number
}
type EventItem = {
  id: string
  title: string
  startsAt?: string | null
  endsAt?: string | null
  location?: string | null
  visibility?: string | null
  rsvpCount?: number | null
  conventionSlug?: string | null
}

const MOD_ROLES = new Set(['MODERATOR', 'ADMIN', 'OWNER', 'STAFF'])

function formatRoleBadge(role: string | null): string | null {
  if (!role) return null
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export default function OrganizerOrgClient() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseOrganizerTab(searchParams.get('tab'))
  const { isAuthenticated, isFallback, status } = useAuth()

  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [conventions, setConventions] = useState<ConventionItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [scheduleLoadState, setScheduleLoadState] = useState<OrgCalendarLoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDoorChecklist, setShowDoorChecklist] = useState(false)

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
      navigate(buildLoginHref(`/organizer/orgs/${slug}`), { replace: true })
    }
  }, [status, isAuthenticated, isFallback, navigate, slug])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const r = await fetch(`/api/v1/organizations/${encodeURIComponent(slug)}`, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setLoadError(r.status === 404 ? 'Organization not found or not visible to you.' : 'Could not load organization.')
          return
        }
        const j = (await r.json()) as { organization: OrgDetail }
        const o = j.organization
        if (!cancelled) setOrg(o)
        if (!o.viewerRole || !MOD_ROLES.has(o.viewerRole)) {
          if (!cancelled) {
            setLoadError('You need staff, moderator, or admin access to use the organizer dashboard.')
          }
          return
        }
        if (!o.featureFlags.calendarEnabled) {
          if (!cancelled) {
            setConventions([])
            setEvents([])
            setScheduleLoadState('disabled')
          }
          return
        }
        if (!cancelled) setScheduleLoadState('loading')
        const [rc, re] = await Promise.all([
          fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/conventions`, { credentials: 'include' }),
          fetch(`/api/v1/organizations/${encodeURIComponent(slug)}/events`, { credentials: 'include' }),
        ])
        if (cancelled) return
        let conventionsState: OrgCalendarLoadState = 'ready'
        let eventsState: OrgCalendarLoadState = 'ready'
        if (rc.ok) {
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
          setConventions(
            (cj.items ?? []).map((c) => ({
              id: c.id,
              slug: c.slug,
              title: c.name,
              startsAt: c.startsAt,
              endsAt: c.endsAt,
              slotCount: c.slotCount,
            })),
          )
        } else {
          conventionsState = await calendarApiFailureKind(rc)
          setConventions([])
        }
        if (re.ok) {
          const ej = (await re.json()) as {
            items?: {
              id: string
              title: string
              startsAt?: string | null
              endsAt?: string | null
              location?: string | null
              visibility?: string | null
              rsvpCount?: number | null
              conventionSlug?: string | null
            }[]
          }
          setEvents(ej.items ?? [])
        } else {
          eventsState = await calendarApiFailureKind(re)
          setEvents([])
        }
        setScheduleLoadState(mergeCalendarLoadState(eventsState, conventionsState))
      } catch {
        if (!cancelled) {
          setLoadError('Network error loading organizer scope.')
          setScheduleLoadState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const convSlug = conventions[0]?.slug
    if (!convSlug || !org) {
      setShowDoorChecklist(false)
      return
    }
    const role = org.viewerRole
    if (role === 'OWNER' || role === 'ADMIN') {
      setShowDoorChecklist(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/v1/conventions/${encodeURIComponent(convSlug)}/organizer/command-access`, {
          credentials: 'include',
        })
        if (!r.ok) {
          if (!cancelled) setShowDoorChecklist(false)
          return
        }
        const j = (await r.json()) as { permissions?: { registration?: boolean; isFullAdmin?: boolean } }
        const p = j.permissions ?? {}
        if (!cancelled) setShowDoorChecklist(Boolean(p.registration || p.isFullAdmin))
      } catch {
        if (!cancelled) setShowDoorChecklist(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conventions, org])

  const showSettings = canAccessOrganizerSettings(org?.viewerRole ?? null, null)
  const showModeration = canAccessOrganizerModeration(org?.viewerRole ?? null)
  const showPayments = Boolean(
    org?.viewerCanManagePayments || org?.viewerRole === 'OWNER',
  )

  useEffect(() => {
    if (tab !== 'settings') return
    if (!isLegacyPaymentsSettingsSection(searchParams.get('settingsSection'))) return
    const p = new URLSearchParams(searchParams)
    p.set('tab', 'payments')
    p.delete('settingsSection')
    setSearchParams(p, { replace: true })
  }, [tab, searchParams, setSearchParams])

  const handleOrgSettingsUpdated = useCallback((o: {
    displayName: string
    visibility: string
    logoUrl: string | null
    bannerUrl: string | null
    featureFlags: OrgFlags
  }) => {
    setOrg((prev) =>
      prev ?
        {
          ...prev,
          displayName: o.displayName,
          visibility: o.visibility,
          logoUrl: o.logoUrl,
          bannerUrl: o.bannerUrl,
          featureFlags: {
            calendarEnabled: o.featureFlags.calendarEnabled,
            forumsEnabled: o.featureFlags.forumsEnabled,
            chatEnabled: o.featureFlags.chatEnabled,
            subgroupsEnabled: o.featureFlags.subgroupsEnabled,
            externalEmbedEnabled: o.featureFlags.externalEmbedEnabled,
          },
        }
      : prev,
    )
  }, [])

  useEffect(() => {
    if (tab === 'settings' && !showSettings) setTab('home')
    if (tab === 'ecke' && !showSettings) setTab('home')
    if (tab === 'moderation' && !showModeration) setTab('home')
    if ((tab === 'payments' || tab === 'payments-setup') && !showPayments) setTab('home')
  }, [tab, showSettings, showModeration, showPayments, setTab])

  const commandActions = useMemo<CommandAction[]>(() => {
    if (!slug) return []
    const base = `/organizer/orgs/${encodeURIComponent(slug)}`
    const tabs: OrganizerTab[] = ['home', 'schedule', 'people', 'communications']
    if (showModeration) tabs.push('moderation')
    if (showSettings) tabs.push('ecke')
    if (showPayments) tabs.push('payments', 'payments-setup')
    tabs.push('settings', 'tools')
    return tabs
      .filter((t) => (t !== 'settings' && t !== 'ecke') || showSettings)
      .filter((t) => (t !== 'payments' && t !== 'payments-setup') || showPayments)
      .map((t) => ({
        id: `tab-${t}`,
        label: `Go to ${ORGANIZER_TAB_LABELS[t]}`,
        href: t === 'home' ? base : `${base}?tab=${t}`,
        keywords: t,
      }))
  }, [slug, showSettings, showModeration, showPayments])

  const checklist = useMemo(() => {
    if (!org) return []
    return buildOrgChecklistWithConventions({
      slug,
      visibility: org.visibility,
      featureFlags: org.featureFlags,
      conventionCount: conventions.length,
      hasBranding: Boolean(org.logoUrl || org.bannerUrl),
      showSettings,
      community: org.community,
      firstConventionSlug: conventions[0]?.slug,
      showDoorChecklist,
    })
  }, [org, slug, conventions, showSettings, showDoorChecklist])

  const upcomingEventCount = useMemo(() => {
    const now = Date.now()
    return events.filter((e) => e.startsAt && new Date(e.startsAt).getTime() >= now).length
  }, [events])

  const orgBase = `/organizer/orgs/${encodeURIComponent(slug)}`

  const shellBreadcrumbs = useMemo(() => {
    if (!org) return [{ label: 'Organizer', href: '/organizer' }]
    const crumbs = [
      { label: 'Organizer', href: '/organizer' },
      { label: org.displayName, href: tab === 'home' ? undefined : orgBase },
    ]
    if (tab !== 'home') crumbs.push({ label: ORGANIZER_TAB_LABELS[tab], href: undefined })
    return crumbs
  }, [org, tab, orgBase])

  const quickActions = useMemo<QuickAction[]>(() => {
    if (!org) return []
    const actions: QuickAction[] = [
      {
        id: 'public-hub',
        label: 'View public hub',
        description: 'See the member-facing page',
        href: `/orgs/${encodeURIComponent(slug)}`,
      },
      {
        id: 'edit-hub',
        label: 'Edit public hub',
        description: 'Overview, FAQ, and modules',
        href: `${orgBase}?tab=settings&settingsSection=content`,
      },
      {
        id: 'people',
        label: 'Manage people',
        href: `${orgBase}?tab=people`,
      },
    ]
    if (org.featureFlags.calendarEnabled) {
      actions.unshift({
        id: 'create-event',
        label: 'Create event',
        onClick: () => openCreateFlow({ type: 'event', prefillOrgId: org.id }),
      })
      if (showSettings) {
        actions.unshift({
          id: 'create-convention',
          label: 'Create convention program',
          onClick: () => openCreateFlow({ type: 'convention', prefillOrgId: org.id }),
        })
      }
    } else {
      actions.push({
        id: 'create-event',
        label: 'Create event',
        href: `${orgBase}?tab=schedule`,
        disabled: true,
        disabledReason: 'Enable the calendar in Settings → Features first.',
      })
    }
    if (showSettings) {
      actions.push(
        {
          id: 'features',
          label: 'Configure features',
          href: `${orgBase}?tab=settings&settingsSection=features`,
        },
        {
          id: 'publish',
          label: 'Publishing settings',
          description: 'Optional public directory listings',
          href: `${orgBase}?tab=settings&settingsSection=publish`,
        },
      )
    }
    return actions
  }, [org, slug, orgBase, showSettings])

  const headerActions = useMemo(() => {
    if (!org) return null
    return (
      <>
        {org.featureFlags.calendarEnabled ?
          <>
            <CreateFlowTriggerButton
              flow={{ type: 'event', prefillOrgId: org.id }}
              className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text hover:border-dc-accent-border/40"
            >
              Create event
            </CreateFlowTriggerButton>
            {showSettings ?
              <CreateFlowTriggerButton
                flow={{ type: 'convention', prefillOrgId: org.id }}
                className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text hover:border-dc-accent-border/40"
              >
                Create convention
              </CreateFlowTriggerButton>
            : null}
          </>
        : null}
      </>
    )
  }, [org, showSettings])

  const sidebarBrand = useMemo(() => {
    if (!org) return null
    const logo = mediaDisplayUrl(org.logoUrl)
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dc-border bg-dc-surface/50 p-3">
        {logo ?
          <img src={logo} alt="" className="h-10 w-10 rounded-lg object-cover" />
        : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dc-accent/15 text-sm font-semibold text-dc-accent">
            {org.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-dc-text">{org.displayName}</p>
          <p className="text-dc-micro text-dc-muted">/{org.slug}</p>
        </div>
      </div>
    )
  }, [org])

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

  if (!org) {
    return <div className="mx-auto max-w-7xl px-4 py-12 h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" aria-busy="true" />
  }

  return (
    <OrganizerAppShell
      scopeKind="org"
      eyebrow="Organizer dashboard"
      title={org.displayName}
      subtitle="Manage your public hub, events, members, communications, and publishing settings."
      roleBadge={formatRoleBadge(org.viewerRole)}
      publicHubHref={`/orgs/${encodeURIComponent(slug)}`}
      breadcrumbs={shellBreadcrumbs}
      activeTab={tab}
      onTabChange={setTab}
      showSettings={showSettings}
      showModeration={showModeration}
      showPayments={showPayments}
      commandActions={commandActions}
      headerActions={headerActions}
      sidebarBrand={sidebarBrand}
      statusBarLeft={<span>/{org.slug}</span>}
      statusBarRight={<span>{org.memberCount} members</span>}
    >
      {tab === 'home' ?
        <OrganizerOrgHomePanel
          orgId={org.id}
          slug={slug}
          displayName={org.displayName}
          visibility={org.visibility}
          memberCount={org.memberCount}
          viewerRole={org.viewerRole}
          featureFlags={org.featureFlags}
          checklist={checklist}
          events={events.map((e) => ({ ...e, startsAt: e.startsAt ?? undefined }))}
          conventions={conventions}
          showSettings={showSettings}
          quickActions={quickActions}
          upcomingEventCount={upcomingEventCount}
        />
      : null}
      {tab === 'schedule' ?
        <OrganizerSchedulePanel
          scopeKind="org"
          orgSlug={slug}
          orgId={org.id}
          conventions={conventions}
          events={events}
          calendarEnabled={org.featureFlags.calendarEnabled}
          calendarLoadState={scheduleLoadState}
          orgVisibility={org.visibility}
          memberCount={org.memberCount}
          featureFlags={org.featureFlags}
          showSettings={showSettings}
          viewerRole={org.viewerRole}
        />
      : null}
      {tab === 'people' ?
        <OrganizerPeoplePanel
          scopeKind="org"
          orgSlug={slug}
          orgId={org.id}
          orgVisibility={org.visibility}
          canManageRoles={showSettings}
        />
      : null}
      {tab === 'communications' ?
        <OrganizerCommunicationsPanel
          scopeKind="org"
          orgSlug={slug}
          forumsEnabled={org.featureFlags.forumsEnabled}
          chatEnabled={org.featureFlags.chatEnabled}
          showSettings={showSettings}
          viewerRole={org.viewerRole}
        />
      : null}
      {tab === 'ecke' && showSettings ?
        <OrganizerOrgEckePanel orgSlug={slug} />
      : null}
      {tab === 'moderation' && showModeration ?
        <OrganizerOrgModerationPanel
          orgSlug={slug}
          forumsEnabled={org.featureFlags.forumsEnabled}
          chatEnabled={org.featureFlags.chatEnabled}
          visibility={org.visibility}
          showSettings={showSettings}
          viewerRole={org.viewerRole}
        />
      : null}
      {tab === 'payments' && showPayments ?
        <OrganizerOrgPaymentsPanel orgSlug={slug} />
      : null}
      {tab === 'payments-setup' && showPayments ?
        <OrganizerOrgPaymentsSetupPanel orgSlug={slug} />
      : null}
      {tab === 'settings' && showSettings ?
        <OrganizerOrgSettingsPanel
          orgSlug={slug}
          displayName={org.displayName}
          onOrgUpdated={handleOrgSettingsUpdated}
        />
      : null}
      {tab === 'tools' ?
        <OrganizerToolsPanel
          scopeKind="org"
          orgSlug={slug}
          orgId={org.id}
          orgDisplayName={org.displayName}
          visibility={org.visibility}
          featureFlags={{ calendarEnabled: org.featureFlags.calendarEnabled }}
          conventions={conventions}
          events={events}
          showSettings={showSettings}
          viewerRole={org.viewerRole}
          hasBranding={Boolean(org.logoUrl || org.bannerUrl)}
        />
      : null}
    </OrganizerAppShell>
  )
}
