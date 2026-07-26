'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'

type Row = {
  registrantId: string
  displayName: string
  categoryName: string
  expectedHours: number
  claimedHours: number
  deficitHours: number
}

export function VolunteerCompliancePanel({ eventSlug }: { eventSlug: string; embedded?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await organizerDancecardFetch<{ rows: Row[] }>(eventSlug, '/volunteer-compliance')
      setRows(d.rows ?? [])
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load compliance')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const below = rows.length
    const totalDeficit = rows.reduce((n, r) => n + r.deficitHours, 0)
    return { tracked: rows.length, below, totalDeficit }
  }, [rows])

  return (
    <div className="space-y-4 rounded-xl border border-dc-border bg-dc-elevated-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg text-dc-text">Volunteer compliance</h3>
          <p className="mt-1 text-xs text-dc-muted">
            Read-only view. Hour deficits from claimed staff shifts vs registration category expectations.
          </p>
        </div>
        <span className="rounded-full border border-dc-border bg-dc-surface-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-dc-muted">
          Read only
        </span>
      </div>
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {rows.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Below required hours</p>
            <p className="mt-0.5 font-serif text-xl text-amber-400">{stats.below}</p>
          </div>
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Total deficit hours</p>
            <p className="mt-0.5 font-serif text-xl text-amber-400">{stats.totalDeficit}h</p>
          </div>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <PeopleEmptyState title="All clear">
          Everyone meets required hours, or no registration categories define expected hours.
        </PeopleEmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dc-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-dc-border bg-dc-surface-muted text-xs uppercase text-dc-muted">
              <tr>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Expected</th>
                <th className="px-3 py-2">Claimed</th>
                <th className="px-3 py-2">Deficit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.registrantId} className="border-b border-dc-border/50">
                  <td className="px-3 py-2 font-medium text-dc-text">{r.displayName}</td>
                  <td className="px-3 py-2 text-dc-muted">{r.categoryName}</td>
                  <td className="px-3 py-2 text-dc-muted">{r.expectedHours}h</td>
                  <td className="px-3 py-2 text-dc-muted">{r.claimedHours}h</td>
                  <td className="px-3 py-2 font-medium text-amber-400">{r.deficitHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
