import { useCallback, useEffect, useState } from 'react'
import { SCOPED_STANDINGS } from '@c2k/shared'

type StandingView = {
  userId: string
  scopeType: string
  scopeId: string
  standing: string
  activeBan: boolean
  expiresAt: string | null
  participation?: {
    linked: boolean
    model: string
    detail: string | null
  }
  recentEvents: Array<{
    standingBefore: string
    standingAfter: string
    reasonCategory: string
    createdAt: string
    expiresAt: string | null
  }>
}

type Props = {
  scope: 'organization' | 'group' | 'event' | 'convention'
  scopeKey: string
  memberUserId: string
  memberLabel?: string
  canModerate?: boolean
}

const STANDING_OPTIONS = [
  SCOPED_STANDINGS.goodStanding,
  SCOPED_STANDINGS.needsAttention,
  SCOPED_STANDINGS.limited,
  SCOPED_STANDINGS.timedOut,
  SCOPED_STANDINGS.banned,
  SCOPED_STANDINGS.escalatedToPlatform,
] as const

export default function ScopedMemberStandingPanel({
  scope,
  scopeKey,
  memberUserId,
  memberLabel,
  canModerate = true,
}: Props) {
  const [view, setView] = useState<StandingView | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [reasonCategory, setReasonCategory] = useState('community_guidelines')
  const [durationHours, setDurationHours] = useState('')
  const [pendingStanding, setPendingStanding] = useState<string>(SCOPED_STANDINGS.needsAttention)
  const [actionError, setActionError] = useState<string | null>(null)

  const basePath =
    scope === 'organization'
      ? `/api/v1/organizations/${encodeURIComponent(scopeKey)}/members/${encodeURIComponent(memberUserId)}/standing`
      : scope === 'group'
        ? `/api/v1/groups/${encodeURIComponent(scopeKey)}/members/${encodeURIComponent(memberUserId)}/standing`
        : scope === 'event'
          ? `/api/v1/events/${encodeURIComponent(scopeKey)}/members/${encodeURIComponent(memberUserId)}/standing`
          : `/api/v1/conventions/${encodeURIComponent(scopeKey)}/members/${encodeURIComponent(memberUserId)}/standing`

  const reload = useCallback(async () => {
    if (!memberUserId || !scopeKey) return
    setStatus('loading')
    try {
      const r = await fetch(basePath, { credentials: 'include' })
      if (!r.ok) throw new Error(String(r.status))
      setView((await r.json()) as StandingView)
      setStatus('ok')
    } catch {
      setView(null)
      setStatus('error')
    }
  }, [basePath, memberUserId, scopeKey])

  useEffect(() => {
    void reload()
  }, [reload])

  async function applyStanding() {
    if (!canModerate) return
    setActionError(null)
    try {
      const body: Record<string, unknown> = {
        standing: pendingStanding,
        reasonCategory,
      }
      const hours = Number(durationHours)
      if (hours > 0) body.durationHours = hours

      const r = await fetch(basePath, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setActionError(j.error ?? 'Action failed')
        return
      }
      setView((await r.json()) as StandingView)
    } catch {
      setActionError('Network error')
    }
  }

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-dc-text">
        Scoped standing{memberLabel ? ` · ${memberLabel}` : ''}
      </h3>
      {status === 'loading' ?
        <p className="text-xs text-dc-muted">Loading standing…</p>
      : status === 'error' || !view ?
        <p className="text-xs text-dc-muted">Standing unavailable (API or permissions).</p>
      : (
        <>
          <p className="text-xs text-dc-text">
            Current: <span className="font-medium capitalize">{view.standing.replace(/_/g, ' ').toLowerCase()}</span>
            {view.activeBan ? ' (active restriction)' : ''}
            {view.expiresAt ? ` · expires ${new Date(view.expiresAt).toLocaleString()}` : ''}
          </p>
          {view.participation?.detail ?
            <p className="text-xs text-amber-200/90">{view.participation.detail}</p>
          : null}
          {view.recentEvents.length > 0 ?
            <ul className="text-[11px] text-dc-muted space-y-1 max-h-32 overflow-y-auto">
              {view.recentEvents.map((e, i) => (
                <li key={`${e.createdAt}-${i}`}>
                  {e.standingBefore} → {e.standingAfter} ({e.reasonCategory})
                </li>
              ))}
            </ul>
          : null}
        </>
      )}
      {canModerate ?
        <div className="space-y-2 border-t border-dc-border pt-3">
          <label className="block text-[11px] text-dc-muted">
            Action
            <select
              value={pendingStanding}
              onChange={(e) => setPendingStanding(e.target.value)}
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            >
              {STANDING_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-dc-muted">
            Reason category
            <input
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            />
          </label>
          <label className="block text-[11px] text-dc-muted">
            Duration (hours, optional for timeout/ban)
            <input
              type="number"
              min={1}
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            />
          </label>
          <button
            type="button"
            onClick={() => void applyStanding()}
            className="rounded-lg bg-dc-accent px-3 py-2 text-xs font-medium text-dc-accent-foreground"
          >
            Apply scoped action
          </button>
          {actionError ?
            <p className="text-xs text-red-300">{actionError}</p>
          : null}
        </div>
      : null}
    </section>
  )
}
