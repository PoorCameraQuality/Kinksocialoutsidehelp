import { useCallback, useEffect, useMemo, useState } from 'react'
import AuditTimeline, { type AuditRow } from '@/components/organizer/moderation/AuditTimeline'
import BanList, { type BanRow } from '@/components/organizer/moderation/BanList'
import ReportInbox, { type ReportRow } from '@/components/organizer/moderation/ReportInbox'
import {
  MemberSpacesModerationCard,
  ModerationPageHeader,
  ModerationPrinciplesCard,
  ModerationStatusRow,
  ModerationSubTabs,
  ModerationTipBar,
  SafetyPostureCard,
  type ModStatusCard,
} from '@/components/organizer/moderation/moderation-ui'
import {
  canManageOrgModeration,
  canViewOrgModerationAudit,
  communityRulesLabel,
  countRecentAuditActions,
  responseStatusLabel,
} from '@/lib/organizer/org-moderation-utils'

type Props = {
  orgSlug: string
  forumsEnabled: boolean
  chatEnabled: boolean
  visibility: string
  showSettings: boolean
  viewerRole: string | null
}

export default function OrganizerOrgModerationPanel({
  orgSlug,
  forumsEnabled,
  chatEnabled,
  visibility,
  showSettings,
  viewerRole,
}: Props) {
  const orgKey = encodeURIComponent(orgSlug)
  const orgBase = `/organizer/orgs/${orgKey}`
  const publicHubHref = `/orgs/${orgKey}?tab=Overview`
  const forumsHref = `/orgs/${orgKey}?tab=Forums`
  const chatHref = `/orgs/${orgKey}?tab=Chat`
  const settingsContentHref = `${orgBase}?tab=settings&settingsSection=content`

  const canManage = canManageOrgModeration(viewerRole)
  const canViewAudit = canViewOrgModerationAudit(viewerRole)

  const [tab, setTab] = useState<'inbox' | 'bans' | 'audit'>('inbox')
  const [reports, setReports] = useState<ReportRow[]>([])
  const [bans, setBans] = useState<BanRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [auditForbidden, setAuditForbidden] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [bansLoading, setBansLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [moderatorCount, setModeratorCount] = useState<number | null>(null)
  const [hasCommunityContent, setHasCommunityContent] = useState(false)

  const loadReports = useCallback(
    async (statusFilter: 'OPEN' | 'ALL' = 'OPEN') => {
      setReportsLoading(true)
      try {
        const q = statusFilter === 'OPEN' ? 'OPEN' : 'ALL'
        const r = await fetch(`/api/v1/organizations/${orgKey}/reports?status=${q}`, { credentials: 'include' })
        if (r.ok) {
          const d = (await r.json()) as { items?: ReportRow[] }
          setReports(d.items ?? [])
        } else {
          setReports([])
        }
      } finally {
        setReportsLoading(false)
      }
    },
    [orgKey],
  )

  const loadBans = useCallback(async () => {
    setBansLoading(true)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/bans`, { credentials: 'include' })
      if (r.ok) {
        const d = (await r.json()) as { items?: BanRow[] }
        setBans(d.items ?? [])
      } else {
        setBans([])
      }
    } finally {
      setBansLoading(false)
    }
  }, [orgKey])

  const loadAudit = useCallback(async () => {
    if (!canViewAudit) {
      setAuditForbidden(true)
      setAudit([])
      return
    }
    setAuditLoading(true)
    setAuditForbidden(false)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/moderation/audit`, { credentials: 'include' })
      if (r.status === 403) {
        setAuditForbidden(true)
        setAudit([])
        return
      }
      if (r.ok) {
        const d = (await r.json()) as { items?: AuditRow[] }
        setAudit(d.items ?? [])
      } else {
        setAudit([])
      }
    } finally {
      setAuditLoading(false)
    }
  }, [orgKey, canViewAudit])

  const loadMeta = useCallback(async () => {
    try {
      const [orgRes, membersRes] = await Promise.all([
        fetch(`/api/v1/organizations/${orgKey}`, { credentials: 'include' }),
        fetch(`/api/v1/organizations/${orgKey}/members`, { credentials: 'include' }),
      ])
      if (orgRes.ok) {
        const j = (await orgRes.json()) as {
          organization?: { community?: { welcomeHtml?: string | null; faq?: unknown[] | null } | null }
        }
        const c = j.organization?.community
        const faqLen = Array.isArray(c?.faq) ? c.faq.length : 0
        setHasCommunityContent(Boolean(c?.welcomeHtml?.trim()) || faqLen > 0)
      }
      if (membersRes.ok) {
        const d = (await membersRes.json()) as { items?: { role: string }[] }
        const mods = (d.items ?? []).filter((m) =>
          ['MODERATOR', 'ADMIN', 'OWNER'].includes(m.role),
        ).length
        setModeratorCount(mods)
      }
    } catch {
      /* optional meta */
    }
  }, [orgKey])

  useEffect(() => {
    void loadReports('OPEN')
    void loadBans()
    void loadMeta()
    if (canViewAudit) void loadAudit()
  }, [loadReports, loadBans, loadMeta, loadAudit, canViewAudit])


  const openReportCount = useMemo(
    () => reports.filter((r) => r.status === 'OPEN').length,
    [reports],
  )

  const recentActions = useMemo(() => countRecentAuditActions(audit), [audit])

  const response = responseStatusLabel(openReportCount)
  const rules = communityRulesLabel(hasCommunityContent)

  const statusCards: ModStatusCard[] = [
    {
      label: 'Open reports',
      value: String(openReportCount),
      sub: openReportCount === 0 ? 'No reports to review' : 'Awaiting moderator action',
      urgent: openReportCount > 0,
      healthy: openReportCount === 0,
      href: `${orgBase}?tab=moderation`,
      linkLabel: openReportCount > 0 ? 'Review inbox →' : undefined,
    },
    {
      label: 'Banned members',
      value: String(bans.length),
      sub: bans.length === 0 ? 'No active bans' : 'Active org bans',
      healthy: bans.length === 0,
      urgent: bans.length > 0,
    },
    {
      label: 'Recent actions',
      value: canViewAudit ? String(recentActions) : '-',
      sub: canViewAudit ? 'Last 7 days (audit)' : 'Owners and admins only',
    },
    {
      label: 'Response status',
      value: response.label,
      sub: response.healthy ? 'Healthy community' : 'Check the inbox',
      healthy: response.healthy,
      urgent: !response.healthy,
    },
    {
      label: 'Community rules',
      value: rules.label,
      sub: rules.configured ? 'Welcome or FAQ on hub' : 'Set expectations on hub',
      healthy: rules.configured,
      href: showSettings ? settingsContentHref : undefined,
      linkLabel: showSettings && !rules.configured ? 'Set content →' : undefined,
    },
  ]

  async function triageReport(id: string, status: 'TRIAGED' | 'RESOLVED' | 'DISMISSED') {
    await fetch(`/api/v1/organizations/${orgKey}/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadReports('OPEN')
    if (canViewAudit) await loadAudit()
  }

  async function submitBan(userId: string, reason: string, escalate: boolean): Promise<string | null> {
    const r = await fetch(`/api/v1/organizations/${orgKey}/bans`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        reason: reason || undefined,
        escalateToPlatform: escalate,
      }),
    })
    if (!r.ok) return 'Could not ban member'
    await loadBans()
    if (canViewAudit) await loadAudit()
    return null
  }

  async function liftBan(userId: string) {
    await fetch(`/api/v1/organizations/${orgKey}/bans/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await loadBans()
    if (canViewAudit) await loadAudit()
  }

  return (
    <div className="space-y-5">
      <ModerationPageHeader
        publicHubHref={publicHubHref}
        showSettings={showSettings}
        settingsContentHref={settingsContentHref}
      />

      <ModerationStatusRow cards={statusCards} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <aside className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <SafetyPostureCard
            openReports={openReportCount}
            forumsEnabled={forumsEnabled}
            chatEnabled={chatEnabled}
            visibility={visibility}
            moderatorCount={moderatorCount}
          />
          <ModerationPrinciplesCard />
          <MemberSpacesModerationCard
            forumsEnabled={forumsEnabled}
            chatEnabled={chatEnabled}
            forumsHref={forumsHref}
            chatHref={chatHref}
            publicHubHref={publicHubHref}
          />
        </aside>

        <div className="order-2 min-w-0 space-y-4 xl:order-1">
          <ModerationSubTabs
            active={tab}
            onChange={setTab}
            inboxCount={openReportCount}
            bansCount={bans.length}
            auditCount={canViewAudit ? audit.length : 0}
          />

          {viewerRole === 'STAFF' ?
            <p className="rounded-xl border border-dc-border bg-dc-surface/30 px-4 py-3 text-sm text-dc-text-muted">
              Staff volunteers do not have access to organization moderation tools. Contact a moderator or admin if
              you need to review a report.
            </p>
          : null}

          {tab === 'inbox' ?
            <ReportInbox
              reports={reports}
              loading={reportsLoading}
              canManage={canManage}
              publicHubHref={publicHubHref}
              forumsHref={forumsHref}
              chatHref={chatHref}
              forumsEnabled={forumsEnabled}
              chatEnabled={chatEnabled}
              onTriage={triageReport}
              onReload={loadReports}
            />
          : null}

          {tab === 'bans' ?
            <BanList
              bans={bans}
              loading={bansLoading}
              canManage={canManage}
              onSubmitBan={submitBan}
              onLiftBan={liftBan}
            />
          : null}

          {tab === 'audit' ?
            <AuditTimeline items={audit} loading={auditLoading} forbidden={auditForbidden || !canViewAudit} />
          : null}

          <ModerationTipBar />
        </div>
      </div>
    </div>
  )
}
