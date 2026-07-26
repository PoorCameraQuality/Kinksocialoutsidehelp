import { useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  MODERATION_CASE_STATUS_VALUES,
  MODERATION_QUEUE_VALUES,
  POLICY_REASON_LABELS,
  POLICY_SEVERITY_VALUES,
  type PolicyReason,
} from '@c2k/shared'
import { useApiModerationTsCases } from '@/hooks/useApiModerationTs'
import {
  defaultModerationOutletContext,
  type ModerationOutletContext,
} from '@/lib/moderation/moderation-outlet-context'

const QUEUE_LABELS: Record<string, string> = {
  GENERAL_REVIEW: 'General review',
  MEDIA_REVIEW: 'Media review',
  NCII_URGENT: 'NCII urgent',
  MINOR_SAFETY_RESTRICTED: 'Minor safety (restricted)',
  SPAM_ABUSE: 'Spam & abuse',
  APPEALS: 'Appeals',
}

function labelQueue(queue: string): string {
  return QUEUE_LABELS[queue] ?? queue.replace(/_/g, ' ').toLowerCase()
}

function labelReason(reason: string): string {
  return POLICY_REASON_LABELS[reason as PolicyReason] ?? reason.replace(/_/g, ' ').toLowerCase()
}

function labelStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase()
}

export default function CasesOpenPanel() {
  const [searchParams] = useSearchParams()
  const { moderationRefreshKey } =
    useOutletContext<ModerationOutletContext>() ?? defaultModerationOutletContext
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'OPEN')
  const [queueFilter, setQueueFilter] = useState(searchParams.get('queue') ?? '')
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') ?? '')

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      queue: queueFilter || undefined,
      severity: severityFilter || undefined,
    }),
    [statusFilter, queueFilter, severityFilter],
  )

  const { status, items, error, reload } = useApiModerationTsCases(true, filters, moderationRefreshKey)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Open cases</h2>
        <p className="text-sm text-dc-muted mt-1">
          Canonical T&amp;S cases from member reports. Open a case for snapshots, notes, and enforcement.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-dc-muted">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text min-w-[12rem]"
          >
            <option value="">All statuses</option>
            {MODERATION_CASE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {labelStatus(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-dc-muted">
          Queue
          <select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            className="mt-1 block min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text min-w-[12rem]"
          >
            <option value="">All queues</option>
            {MODERATION_QUEUE_VALUES.map((q) => (
              <option key={q} value={q}>
                {labelQueue(q)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-dc-muted">
          Severity
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="mt-1 block min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"
          >
            <option value="">All severities</option>
            {POLICY_SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void reload()}
          className="min-h-10 px-4 rounded-xl border border-dc-border text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          Refresh
        </button>
      </div>

      {status === 'loading' ? <p className="text-sm text-dc-muted">Loading cases…</p> : null}
      {error ?
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 space-y-2" role="alert">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="text-sm font-medium text-dc-accent hover:underline"
          >
            Retry
          </button>
        </div>
      : null}
      {status === 'ready' && !items.length ?
        <p className="text-sm text-dc-muted rounded-xl border border-dashed border-dc-border px-4 py-8 text-center">
          No cases match this filter.
        </p>
      : null}

      {status === 'ready' && items.length > 0 ?
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <Link
                    to={`/moderation/cases/${encodeURIComponent(row.id)}`}
                    className="text-sm font-semibold text-dc-accent hover:underline"
                  >
                    {labelReason(row.policyReason)}
                  </Link>
                  <p className="text-xs text-dc-muted">
                    {row.targetContentType} · {row.targetContentId.slice(0, 12)}
                    {row.targetContentId.length > 12 ? '…' : ''}
                    {' · '}
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-medium rounded-lg border border-dc-border px-2 py-1 text-dc-muted">
                    {labelStatus(row.status)}
                  </span>
                  <span className="text-xs font-medium rounded-lg bg-dc-accent/10 px-2 py-1 text-dc-accent">
                    {row.severity}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-dc-muted">
                Queue: {labelQueue(row.queue)}
                {typeof row.reportCount === 'number' ? ` · ${row.reportCount} report(s)` : ''}
                {row.assignedToUsername ? ` · ${row.assignedToUsername}` : ' · Unassigned'}
              </p>
            </li>
          ))}
        </ul>
      : null}
    </div>
  )
}
