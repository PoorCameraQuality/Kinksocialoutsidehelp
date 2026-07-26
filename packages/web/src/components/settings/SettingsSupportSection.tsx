import { Link } from 'react-router-dom'
import { useApiMyReports } from '@/hooks/useApiMyReports'
import { labelReportCategory, labelReportStatus, labelReportTarget } from '@/lib/moderation/report-labels'

export default function SettingsSupportSection({ enabled }: { enabled: boolean }) {
  const { status, reports, error, reload } = useApiMyReports(enabled)

  if (!enabled) return null

  return (
    <section id="support" className="rounded-2xl border border-dc-border bg-dc-elevated/50 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Support & reports</h2>
        <p className="mt-1 text-sm text-dc-muted">
          Reports you submitted from community hubs and elsewhere.{' '}
          <Link to="/support" className="text-dc-accent hover:underline">
            Visit support
          </Link>
        </p>
      </div>

      {status === 'loading' || status === 'idle' ?
        <div className="h-16 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      : null}

      {error ?
        <div className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text hover:bg-dc-elevated-muted"
          >
            Retry
          </button>
        </div>
      : null}

      {status === 'ready' && !reports.length ?
        <p className="text-sm text-dc-muted rounded-xl border border-dashed border-dc-border px-4 py-6 text-center">
          You have not submitted any reports yet.
        </p>
      : null}

      {status === 'ready' && reports.length > 0 ?
        <ul className="space-y-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-dc-border bg-dc-surface-muted px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-dc-text">{labelReportCategory(r.category)}</span>
                <span className="text-xs text-dc-muted">{labelReportStatus(r.status)}</span>
              </div>
              <p className="mt-1 text-xs text-dc-muted">
                {labelReportTarget(r.targetType)} · {new Date(r.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      : null}
    </section>
  )
}
