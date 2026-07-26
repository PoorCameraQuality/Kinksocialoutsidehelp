'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { formatTimeLabel } from '@/components/dancecard/organizer/organizerTimeline'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'

type SwapRow = {
  id: string
  from_shift_id: string
  to_shift_id: string
  requester_account_id: string
  status: string
  note: string | null
  created_at: string
}

const SWAP_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for your decision',
  approved: 'Approved',
  rejected: 'Declined',
}

function humanizeRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\bdm\b/gi, 'coverage')
}

export function ShiftSwapsPanel({
  eventSlug,
  timezone,
  readOnly = false,
  embedded = false,
}: {
  eventSlug: string
  timezone: string
  readOnly?: boolean
  embedded?: boolean
}) {
  const [swaps, setSwaps] = useState<SwapRow[]>([])
  const [shifts, setShifts] = useState<OrganizerStaffShiftDto[]>([])
  const [needsMigration, setNeedsMigration] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts])

  const shiftLabel = useMemo(() => {
    return (id: string) => {
      const s = shiftById.get(id)
      if (!s) return `Shift ${id.slice(0, 8)}`
      const start = formatTimeLabel(s.startsAt, timezone)
      const end = formatTimeLabel(s.endsAt, timezone)
      const who = s.personName.trim() || 'Open shift'
      return `${who} · ${humanizeRole(s.role)} · ${start}–${end}`
    }
  }, [shiftById, timezone])

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [swapRes, shiftRes] = await Promise.all([
        organizerDancecardFetch<{ swaps: SwapRow[]; needsMigration?: boolean }>(eventSlug, '/shift-swaps'),
        organizerDancecardFetch<{ shifts: OrganizerStaffShiftDto[] }>(eventSlug, '/staff-shifts'),
      ])
      setSwaps(swapRes.swaps ?? [])
      setNeedsMigration(Boolean(swapRes.needsMigration))
      setShifts(shiftRes.shifts ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load swap requests')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(swapId: string, status: 'approved' | 'rejected') {
    if (readOnly) return
    setBusy(swapId)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, `/shift-swaps/${encodeURIComponent(swapId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  if (needsMigration) {
    return (
      <div className="rounded-xl border border-dc-warning/30 bg-dc-warning-muted px-4 py-5 text-sm text-dc-warning">
        <p className="font-medium">Shift trades are not enabled yet</p>
        <p className="mt-2 text-dc-warning/80">
          Shift swaps are not set up for this event yet. Contact your platform administrator, then refresh this page.
        </p>
      </div>
    )
  }

  const pendingCount = swaps.filter((s) => s.status === 'pending').length
  const approvedCount = swaps.filter((s) => s.status === 'approved').length
  const declinedCount = swaps.filter((s) => s.status === 'rejected').length

  return (
    <div className="space-y-4 text-sm text-dc-text">
      {!embedded ? (
        <p className="text-sm text-dc-muted">Approve or decline volunteer shift trade requests.</p>
      ) : null}
      {swaps.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: 'Pending', value: pendingCount, tone: pendingCount ? 'text-amber-400' : undefined },
            { label: 'Approved', value: approvedCount, tone: 'text-emerald-400' },
            { label: 'Declined', value: declinedCount },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
              <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">{s.label}</p>
              <p className={`mt-0.5 font-serif text-xl tabular-nums ${s.tone ?? 'text-dc-text'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {err ? <p className="text-dc-danger">{err}</p> : null}
      {!swaps.length ? (
        <PeopleEmptyState title="No trade requests yet">
          When volunteers request shift swaps, they will appear here for approval.
        </PeopleEmptyState>
      ) : (
        <ul className="space-y-3">
          {swaps.map((s) => (
            <li key={s.id} className="rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Trade request</p>
                  <p className="mt-1 font-medium text-dc-text">
                    Giving up: {shiftLabel(s.from_shift_id)}
                  </p>
                  <p className="mt-1 text-dc-muted">Taking: {shiftLabel(s.to_shift_id)}</p>
                  <p className="mt-2 text-xs text-dc-muted">
                    {SWAP_STATUS_LABELS[s.status] ?? s.status} · submitted{' '}
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                  {s.note ? (
                    <p className="mt-2 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-xs text-dc-muted">
                      Note from volunteer: {s.note}
                    </p>
                  ) : null}
                </div>
                {s.status === 'pending' && !readOnly ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === s.id}
                      className="rounded-full bg-emerald-600/80 px-3 py-1 text-xs font-semibold text-dc-text disabled:opacity-40"
                      onClick={() => void decide(s.id, 'approved')}
                    >
                      Approve trade
                    </button>
                    <button
                      type="button"
                      disabled={busy === s.id}
                      className="rounded-full border border-dc-danger/40 px-3 py-1 text-xs text-dc-danger hover:bg-dc-danger-muted disabled:opacity-40"
                      onClick={() => void decide(s.id, 'rejected')}
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
