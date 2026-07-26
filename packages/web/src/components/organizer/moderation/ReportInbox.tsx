import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModSection } from '@/components/organizer/moderation/moderation-ui'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import {
  formatReportCategory,
  formatReportStatus,
  formatReportTargetType,
} from '@/lib/organizer/org-moderation-utils'

export type ReportRow = {
  id: string
  targetType: string
  targetId: string
  category: string
  status: string
  createdAt: string
  reporterUsername: string
}

type Props = {
  reports: ReportRow[]
  loading: boolean
  canManage: boolean
  publicHubHref: string
  forumsHref: string
  chatHref: string
  forumsEnabled: boolean
  chatEnabled: boolean
  onTriage: (id: string, status: 'TRIAGED' | 'RESOLVED' | 'DISMISSED') => Promise<void>
  onReload: (statusFilter: 'OPEN' | 'ALL') => Promise<void>
}

export default function ReportInbox({
  reports,
  loading,
  canManage,
  publicHubHref,
  forumsHref,
  chatHref,
  forumsEnabled,
  chatEnabled,
  onTriage,
  onReload,
}: Props) {
  const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function act(id: string, status: 'TRIAGED' | 'RESOLVED' | 'DISMISSED') {
    setBusyId(id)
    try {
      await onTriage(id, status)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ModSection>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dc-text">Report inbox</h3>
          <p className="mt-1 text-sm text-dc-text-muted">
            Reports from your organization&apos;s forums, chat, events, and community spaces appear here.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text-muted">
          <span className="shrink-0">Filters</span>
          <select
            value={filter}
            onChange={(e) => {
              const v = e.target.value as 'OPEN' | 'ALL'
              setFilter(v)
              void onReload(v)
            }}
            className="min-h-10 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          >
            <option value="OPEN">Open only</option>
            <option value="ALL">All statuses</option>
          </select>
        </label>
      </div>

      <div className="mt-5">
        {loading ?
          <div className="h-32 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
        : reports.length === 0 ?
          <div>
            <EmptyState
              inline
              title="No open reports"
              message="When members report forum posts, chat messages, events, or other organization content, they will appear here for review."
              ctaLabel="Review public hub"
              ctaHref={publicHubHref}
              secondaryCtaLabel={forumsEnabled ? 'Open member forums' : chatEnabled ? 'Open member chat' : undefined}
              secondaryCtaHref={forumsEnabled ? forumsHref : chatEnabled ? chatHref : undefined}
              nextSteps={[
                'Members file reports from the public hub and community spaces.',
                'Use In review when you are investigating; Resolve or Dismiss when finished.',
              ]}
            />
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {forumsEnabled && chatEnabled ?
                <Link
                  to={chatHref}
                  className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text"
                >
                  Open member chat
                </Link>
              : null}
              <Link to="/support" className="inline-flex min-h-10 items-center text-sm font-medium text-dc-accent hover:underline">
                View moderation guide
              </Link>
            </div>
            <p className="mt-4 text-center text-xs text-dc-muted">
              Reports are private and only visible to authorized moderators.
            </p>
          </div>
        : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-dc-border bg-dc-surface/25 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-dc-text">{formatReportCategory(r.category)}</p>
                    <p className="mt-1 text-sm text-dc-text-muted">{formatReportTargetType(r.targetType)}</p>
                  </div>
                  <Badge variant={r.status === 'OPEN' ? 'danger' : r.status === 'RESOLVED' || r.status === 'DISMISSED' ? 'success' : 'accent'}>
                    {formatReportStatus(r.status)}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-1 text-xs text-dc-text-muted sm:grid-cols-2">
                  <div>
                    <dt className="inline text-dc-muted">Reporter </dt>
                    <dd className="inline">@{r.reporterUsername}</dd>
                  </div>
                  <div>
                    <dt className="inline text-dc-muted">Filed </dt>
                    <dd className="inline">{new Date(r.createdAt).toLocaleString()}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-dc-muted">Target ID </dt>
                    <dd className="inline font-mono text-[11px]">{r.targetId}</dd>
                  </div>
                </dl>
                {canManage && (r.status === 'OPEN' || r.status === 'TRIAGED') ?
                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.status === 'OPEN' ?
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void act(r.id, 'TRIAGED')}
                        className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text hover:border-dc-accent-border/40"
                      >
                        In review
                      </button>
                    : null}
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void act(r.id, 'RESOLVED')}
                      className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text hover:border-dc-accent-border/40"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void act(r.id, 'DISMISSED')}
                      className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
                    >
                      Dismiss
                    </button>
                  </div>
                : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModSection>
  )
}
