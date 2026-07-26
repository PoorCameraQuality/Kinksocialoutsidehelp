import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiModerationReports, type ModerationReportRow } from '@/hooks/useApiModerationReports'
import {
  REPORT_INTAKE_SURFACES,
  labelReportCategory,
  labelReportStatus,
  labelReportTarget,
} from '@/lib/moderation/report-labels'

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'TRIAGED', label: 'In review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'ALL', label: 'All statuses' },
] as const

function ReportRowCard({
  row,
  expanded,
  onToggle,
  note,
  onNoteChange,
  onStatus,
  busy,
}: {
  row: ModerationReportRow
  expanded: boolean
  onToggle: () => void
  note: string
  onNoteChange: (v: string) => void
  onStatus: (status: string) => void
  busy: boolean
}) {
  const ctx = row.context
  const caseId = typeof row.meta?.caseId === 'string' ? row.meta.caseId : null

  return (
    <li className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-dc-text capitalize">{labelReportCategory(row.category)}</p>
          <p className="text-xs text-dc-muted">
            {labelReportTarget(row.targetType)} · reported by{' '}
            <Link to={`/profile/${encodeURIComponent(row.reporterUsername)}`} className="text-dc-accent hover:underline">
              {row.reporterUsername}
            </Link>
            {' · '}
            {new Date(row.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="text-xs font-medium rounded-lg border border-dc-border px-2 py-1 text-dc-muted">
          {labelReportStatus(row.status)}
        </span>
      </div>

      <div className="text-sm text-dc-text-muted space-y-1">
        <p>{ctx.targetLabel}</p>
        {ctx.scopeName ?
          <p className="text-xs text-dc-muted">
            Scope: {ctx.scopeType} · {ctx.scopeName}
          </p>
        : null}
        {ctx.excerpt ?
          <blockquote className="text-xs border-l-2 border-dc-border pl-3 text-dc-muted italic">{ctx.excerpt}</blockquote>
        : null}
        {ctx.contentMissing ?
          <p className="text-xs text-amber-200/90">Referenced content may have been removed.</p>
        : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {ctx.href ?
          <Link to={ctx.href} className="text-xs text-dc-accent hover:underline">
            Open in community
          </Link>
        : null}
        {caseId ?
          <Link
            to={`/moderation/cases/${encodeURIComponent(caseId)}`}
            className="text-xs text-dc-accent hover:underline"
          >
            Open T&amp;S case
          </Link>
        : null}
        <button type="button" onClick={onToggle} className="text-xs text-dc-muted hover:text-dc-text">
          {expanded ? 'Hide details' : 'Details & status'}
        </button>
      </div>

      {expanded ?
        <div className="space-y-3 pt-2 border-t border-dc-border">
          {row.body ? <p className="text-sm text-dc-text whitespace-pre-wrap">{row.body}</p> : null}
          <p className="text-xs text-dc-muted font-mono break-all">
            target: {row.targetType} / {row.targetId}
          </p>
          <p className="text-xs text-dc-muted">
            Enforcement (delete/suspend) is on the linked T&amp;S case or Pending actions tab — not from this legacy
            inbox.
          </p>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Moderator note (optional for status changes)"
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text placeholder-dc-muted"
          />
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter((s) => s.value !== 'ALL').map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={busy || row.status === opt.value}
                onClick={() => onStatus(opt.value)}
                className="px-3 py-1.5 rounded-lg border border-dc-border text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40"
              >
                Mark {opt.label.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      : null}
    </li>
  )
}

export default function CasesLegacyReportsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>('OPEN')
  const [targetFilter, setTargetFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showIntakeMap, setShowIntakeMap] = useState(false)

  const filters = useMemo(
    () => ({ status: statusFilter, targetType: targetFilter || undefined }),
    [statusFilter, targetFilter],
  )

  const { status, items, error, reload, patchReport, loadDetail } = useApiModerationReports(true, filters)
  const [detailCache, setDetailCache] = useState<Record<string, ModerationReportRow>>({})

  const rows = items.map((row) => detailCache[row.id] ?? row)

  const expandRow = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!detailCache[id]) {
      const detail = await loadDetail(id)
      if (detail) setDetailCache((m) => ({ ...m, [id]: detail }))
    }
  }

  const applyStatus = async (id: string, nextStatus: string) => {
    setBusyId(id)
    try {
      await patchReport(id, {
        status: nextStatus,
        note: notes[id]?.trim() || undefined,
      })
      setExpandedId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Legacy reports</h2>
        <p className="mt-1 text-sm text-dc-muted">
          Secondary inbox mirrored from intake. Status triage only — use Open cases for enforcement.
        </p>
      </div>

      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 text-sm text-dc-muted">
        <p>
          Filed via <Link to="/support" className="text-dc-accent hover:underline">/support</Link> and in-context{' '}
          <strong className="font-medium text-dc-text">Report</strong> actions. Prefer the linked T&amp;S case for
          hide/delete/suspend.
        </p>
        <button
          type="button"
          className="mt-2 text-xs text-dc-accent hover:underline"
          onClick={() => setShowIntakeMap((v) => !v)}
        >
          {showIntakeMap ? 'Hide' : 'Show'} report intake map
        </button>
        {showIntakeMap ?
          <ul className="mt-3 space-y-1 text-xs">
            {REPORT_INTAKE_SURFACES.map((s) => (
              <li key={`${s.targetType}-${s.surface}`}>
                <span className="font-mono text-dc-text-muted">{s.targetType}</span> · {s.label} ({s.surface})
              </li>
            ))}
          </ul>
        : null}
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-dc-muted">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-dc-muted">
          Target type
          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="mt-1 block min-h-10 min-w-[12rem] rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"
          >
            <option value="">All types</option>
            {REPORT_INTAKE_SURFACES.map((s) => (
              <option key={`${s.targetType}-${s.surface}`} value={s.targetType}>
                {s.targetType}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void reload()}
          className="min-h-10 rounded-xl border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          Refresh
        </button>
      </div>

      {status === 'loading' ? <p className="text-sm text-dc-muted">Loading reports…</p> : null}
      {error ?
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      : null}
      {status === 'ready' && !rows.length ?
        <p className="rounded-xl border border-dashed border-dc-border px-4 py-8 text-center text-sm text-dc-muted">
          No reports match this filter.
        </p>
      : null}

      {status === 'ready' && rows.length > 0 ?
        <ul className="space-y-4">
          {rows.map((row) => (
            <ReportRowCard
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggle={() => void expandRow(row.id)}
              note={notes[row.id] ?? ''}
              onNoteChange={(v) => setNotes((m) => ({ ...m, [row.id]: v }))}
              onStatus={(s) => void applyStatus(row.id, s)}
              busy={busyId === row.id}
            />
          ))}
        </ul>
      : null}
    </div>
  )
}
