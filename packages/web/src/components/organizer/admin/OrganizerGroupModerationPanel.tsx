import { useCallback, useEffect, useMemo, useState } from 'react'
import AuditTimeline, { type AuditRow } from '@/components/organizer/moderation/AuditTimeline'
import BanList, { type BanRow } from '@/components/organizer/moderation/BanList'
import ReportInbox, { type ReportRow } from '@/components/organizer/moderation/ReportInbox'
import {
  ModerationPageHeader,
  ModerationStatusRow,
  ModerationSubTabs,
  type ModStatusCard,
} from '@/components/organizer/moderation/moderation-ui'
import { countRecentAuditActions, responseStatusLabel } from '@/lib/organizer/org-moderation-utils'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

type Props = { groupId: string }

export default function OrganizerGroupModerationPanel({ groupId }: Props) {
  const groupKey = encodeURIComponent(groupId)
  const publicHubHref = `/groups/${groupKey}?tab=Forums`

  const [tab, setTab] = useState<'inbox' | 'bans' | 'audit'>('inbox')
  const [reports, setReports] = useState<ReportRow[]>([])
  const [bans, setBans] = useState<BanRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [bansLoading, setBansLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)

  const loadReports = useCallback(async (statusFilter: 'OPEN' | 'ALL' = 'OPEN') => {
    setReportsLoading(true)
    try {
      const q = statusFilter === 'OPEN' ? 'OPEN' : 'ALL'
      const r = await fetch(`/api/v1/groups/${groupKey}/reports?status=${q}`, { credentials: 'include' })
      if (r.ok) {
        const d = (await r.json()) as { items?: ReportRow[] }
        setReports(d.items ?? [])
      } else {
        setReports([])
      }
    } finally {
      setReportsLoading(false)
    }
  }, [groupKey])

  const loadBans = useCallback(async () => {
    setBansLoading(true)
    try {
      const r = await fetch(`/api/v1/groups/${groupKey}/bans`, { credentials: 'include' })
      if (r.ok) {
        const d = (await r.json()) as { items?: BanRow[] }
        setBans(d.items ?? [])
      } else {
        setBans([])
      }
    } finally {
      setBansLoading(false)
    }
  }, [groupKey])

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    try {
      const r = await fetch(`/api/v1/groups/${groupKey}/moderation/audit`, { credentials: 'include' })
      if (r.ok) {
        const d = (await r.json()) as { items?: AuditRow[] }
        setAudit(d.items ?? [])
      } else {
        setAudit([])
      }
    } finally {
      setAuditLoading(false)
    }
  }, [groupKey])

  useEffect(() => {
    void loadReports('OPEN')
    void loadBans()
    void loadAudit()
  }, [loadReports, loadBans, loadAudit])

  const openReportCount = useMemo(
    () => reports.filter((r) => r.status === 'OPEN').length,
    [reports],
  )
  const recentActions = useMemo(() => countRecentAuditActions(audit), [audit])
  const response = responseStatusLabel(openReportCount)

  const statusCards: ModStatusCard[] = [
    {
      label: 'Open reports',
      value: String(openReportCount),
      sub: openReportCount === 0 ? 'No reports to review' : 'Awaiting moderator action',
      urgent: openReportCount > 0,
      healthy: openReportCount === 0,
      href: publicHubHref,
    },
    {
      label: 'Banned members',
      value: String(bans.length),
      sub: bans.length === 0 ? 'No active bans' : 'Active group bans',
      healthy: bans.length === 0,
      urgent: bans.length > 0,
    },
    {
      label: 'Recent actions',
      value: String(recentActions),
      sub: 'Last 7 days (audit)',
    },
    {
      label: 'Response status',
      value: response.label,
      sub: response.healthy ? 'Healthy community' : 'Check the inbox',
      healthy: response.healthy,
      urgent: !response.healthy,
    },
  ]

  async function triageReport(id: string, status: 'TRIAGED' | 'RESOLVED' | 'DISMISSED') {
    await fetch(`/api/v1/groups/${groupKey}/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadReports('OPEN')
    await loadAudit()
  }

  async function submitBan(userId: string, reason: string): Promise<string | null> {
    const r = await fetch(`/api/v1/groups/${groupKey}/bans`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason: reason || undefined }),
    })
    if (!r.ok) return 'Could not ban member'
    await loadBans()
    await loadAudit()
    return null
  }

  async function liftBan(userId: string) {
    await fetch(`/api/v1/groups/${groupKey}/bans/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await loadBans()
    await loadAudit()
  }

  return (
    <div className="space-y-5">
      <ModerationPageHeader
        publicHubHref={publicHubHref}
        showSettings={false}
        settingsContentHref={publicHubHref}
      />

      <ModerationStatusRow cards={statusCards} />

      <ModerationSubTabs
        active={tab}
        onChange={setTab}
        inboxCount={reports.filter((r) => r.status === 'OPEN').length}
        bansCount={bans.length}
        auditCount={audit.length}
      />

      {tab === 'inbox' ?
        <ReportInbox
          reports={reports}
          loading={reportsLoading}
          canManage
          publicHubHref={publicHubHref}
          forumsHref={publicHubHref}
          chatHref={publicHubHref}
          forumsEnabled
          chatEnabled={false}
          onTriage={triageReport}
          onReload={loadReports}
        />
      : tab === 'bans' ?
        <BanList
          bans={bans}
          loading={bansLoading}
          canManage
          onSubmitBan={submitBan}
          onLiftBan={liftBan}
        />
      : (
        <OrganizerPanel title="Audit log" description="Recent moderation actions in this group.">
          <AuditTimeline items={audit} loading={auditLoading} forbidden={false} />
        </OrganizerPanel>
      )}
    </div>
  )
}
