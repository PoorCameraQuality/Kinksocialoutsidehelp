import { Link } from 'react-router-dom'
import { useCallback, useState } from 'react'
import type { ReputationIntegritySignal } from '@/hooks/useApiModerationTrustSummary'

type Props = {
  signals: ReputationIntegritySignal[]
  onUpdated?: () => void
}

function statusLabel(status: string): string {
  if (status === 'OPEN') return 'Open'
  if (status === 'REVIEWED') return 'Reviewed'
  if (status === 'DISMISSED') return 'Dismissed'
  if (status === 'ESCALATED') return 'Escalated'
  return status
}

export default function ReputationIntegritySignalsPanel({ signals, onUpdated }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const patchStatus = useCallback(
    async (signalId: string, modReviewStatus: 'REVIEWED' | 'DISMISSED' | 'ESCALATED') => {
      setBusyId(signalId)
      setError(null)
      try {
        const r = await fetch(`/api/v1/moderation/trust-signals/${encodeURIComponent(signalId)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modReviewStatus }),
        })
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          setError(j.error ?? `HTTP ${r.status}`)
          return
        }
        onUpdated?.()
      } catch {
        setError('Network error')
      } finally {
        setBusyId(null)
      }
    },
    [onUpdated],
  )

  if (signals.length === 0) {
    return (
      <p className="text-xs text-dc-muted">No active reputation integrity signals for this member.</p>
    )
  }

  return (
    <div className="space-y-3">
      {error ?
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      : null}
      <ul className="space-y-2">
        {signals.map((signal) => {
          const meta = signal.metadata ?? {}
          const relatedUsername =
            typeof meta.relatedUsername === 'string' ? meta.relatedUsername : null
          return (
            <li
              key={signal.id}
              className="rounded-xl border border-dc-border bg-dc-elevated-solid/50 px-3 py-2.5 text-xs space-y-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-dc-text">{signal.label}</p>
                <span className="text-dc-muted">{statusLabel(signal.modReviewStatus)}</span>
              </div>
              <p className="text-dc-muted">
                {new Date(signal.createdAt).toLocaleString()}
                {signal.severity ? ` · ${signal.severity}` : ''}
                {signal.scopeType ? ` · ${signal.scopeType}` : ''}
              </p>
              {relatedUsername ?
                <p className="text-dc-text-muted">
                  Related: @{relatedUsername}
                </p>
              : null}
              <div className="flex flex-wrap gap-2">
                {relatedUsername ?
                  <Link
                    to={`/profile/${encodeURIComponent(relatedUsername)}`}
                    className="text-dc-accent hover:underline"
                  >
                    Open related profile
                  </Link>
                : null}
                {signal.modReviewStatus === 'OPEN' || signal.modReviewStatus === 'ESCALATED' ?
                  <>
                    <button
                      type="button"
                      disabled={busyId === signal.id}
                      onClick={() => void patchStatus(signal.id, 'REVIEWED')}
                      className="min-h-8 rounded-lg border border-dc-border px-2 text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      disabled={busyId === signal.id}
                      onClick={() => void patchStatus(signal.id, 'DISMISSED')}
                      className="min-h-8 rounded-lg border border-dc-border px-2 text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      disabled={busyId === signal.id}
                      onClick={() => void patchStatus(signal.id, 'ESCALATED')}
                      className="min-h-8 rounded-lg border border-amber-500/40 px-2 text-amber-200 hover:bg-amber-950/30 disabled:opacity-50"
                    >
                      Escalate to T&amp;S
                    </button>
                  </>
                : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
