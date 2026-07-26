import { useEffect, useState } from 'react'
import { POLICY_REASON_LABELS, type PolicyReason } from '@c2k/shared'

type IncidentRow = {
  id: string
  status: string
  policyReason: string | null
  linkedReportCount: number
  independentReporterCount: number
  duplicateBurst: boolean
  burstWindowDetected?: boolean
  possibleDogpile?: boolean
  sameTextCount?: number
  platformEscalated: boolean
  linkedToThisCase: boolean
}

type Props = {
  caseId: string | null | undefined
  enabled?: boolean
}

function labelReason(reason: string | null): string {
  if (!reason) return 'Unspecified'
  return POLICY_REASON_LABELS[reason as PolicyReason] ?? reason.replace(/_/g, ' ').toLowerCase()
}

export default function ModerationIncidentClusterPanel({ caseId, enabled = true }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'unavailable'>('idle')
  const [incidents, setIncidents] = useState<IncidentRow[]>([])

  useEffect(() => {
    if (!enabled || !caseId) {
      setStatus('idle')
      setIncidents([])
      return
    }
    let cancelled = false
    setStatus('loading')
    fetch(`/api/v1/moderation/cases/${encodeURIComponent(caseId)}/incidents`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 403) throw new Error('forbidden')
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<{ status: string; incidents?: IncidentRow[]; reason?: string }>
      })
      .then((json) => {
        if (cancelled) return
        if (json.status !== 'available') {
          setStatus('unavailable')
          setIncidents([])
          return
        }
        setIncidents(json.incidents ?? [])
        setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          setIncidents([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [caseId, enabled])

  if (!caseId) return null

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-dc-text">Incident clusters (moderator only)</h3>
      <p className="text-xs text-dc-muted">
        Linked reports are grouped into incidents. Enforcement follows findings. Report volume alone does not trigger
        punishment.
      </p>
      {status === 'loading' ?
        <p className="text-xs text-dc-muted">Loading incident clusters…</p>
      : status === 'error' ?
        <p className="text-xs text-red-300">Could not load incident clusters.</p>
      : status === 'unavailable' ?
        <p className="text-xs text-dc-muted">No subject user. Incident clustering unavailable.</p>
      : incidents.length === 0 ?
        <p className="text-xs text-dc-muted">No incident clusters for this subject yet.</p>
      : (
        <ul className="space-y-2">
          {incidents.map((inc) => (
            <li key={inc.id} className="rounded-xl border border-dc-border p-3 text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-dc-text capitalize">{inc.status.replace(/_/g, ' ').toLowerCase()}</span>
                {inc.linkedToThisCase ?
                  <span className="rounded bg-dc-accent/20 px-1.5 py-0.5 text-[10px] text-dc-accent">This case</span>
                : null}
              </div>
              <p className="text-dc-muted">{labelReason(inc.policyReason)}</p>
              <p className="text-dc-muted">
                {inc.linkedReportCount} linked report{inc.linkedReportCount === 1 ? '' : 's'} ·{' '}
                {inc.independentReporterCount} independent
              </p>
              {inc.duplicateBurst || inc.burstWindowDetected ?
                <p className="text-amber-200/90">Duplicate/burst reports detected. Review reporter independence.</p>
              : null}
              {inc.possibleDogpile ?
                <p className="text-amber-200/90">Possible dogpile. Multiple independent reports in a short window.</p>
              : null}
              {(inc.sameTextCount ?? 0) > 1 ?
                <p className="text-amber-200/90">Similar report text detected ({inc.sameTextCount} matches).</p>
              : null}
              {inc.platformEscalated ?
                <p className="text-amber-200/90">Platform-escalated serious safety category.</p>
              : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
