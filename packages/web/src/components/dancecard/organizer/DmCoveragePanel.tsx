'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { OrganizerApiError, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import {
  findStaffShiftConflicts,
  formatStaffShiftConflictList,
  type StaffShiftConflict,
} from '@/lib/dancecard/staffShiftConflicts'
import type { OrganizerLocationDto } from '@/lib/dancecard/organizerLocationDto'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { isDmStaffRole } from '@/lib/dancecard/dmCoverageScanner'
import { DatetimeLocalField, useConfirmDialog } from '@/components/dancecard/organizer/ui'
import { TrustedRoleWorkflowCallout } from '@/components/dancecard/organizer/TrustedRoleWorkflowCallout'
import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { cn } from '@/lib/cn'
import { PeopleEmptyState } from '@/components/dancecard/organizer/people/PeopleEmptyState'

type DmReq = {
  id: string
  locationId: string
  startsAt: string
  endsAt: string
  minLead: number
  minFloat: number
}

function leafLocations(locs: OrganizerLocationDto[]): OrganizerLocationDto[] {
  const childParents = new Set(locs.map((l) => l.parentId).filter(Boolean) as string[])
  const leaves = locs.filter((l) => !childParents.has(l.id))
  return leaves.length ? leaves : locs
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

function shiftHoursMs(s: OrganizerStaffShiftDto) {
  const a0 = new Date(s.startsAt).getTime()
  const a1 = new Date(s.endsAt).getTime()
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || a1 <= a0) return 0
  return a1 - a0
}

function personKey(s: OrganizerStaffShiftDto) {
  return s.personId ?? `name:${s.personName}`
}

type GapCellPick = {
  locationId: string
  locationName: string
  t0: number
  t1: number
  assigned: number
  needLead: number
  needFloat: number
}

export function DmCoveragePanel({
  eventSlug,
  timezone,
  windowStartsAt,
  windowEndsAt,
  shifts,
  onRefreshShifts,
  readOnly,
  embedded = false,
}: {
  eventSlug: string
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  shifts: OrganizerStaffShiftDto[]
  onRefreshShifts: () => Promise<void>
  readOnly: boolean
  embedded?: boolean
}) {
  const staffShiftsHref = useOrganizerTabHref('people', { peopleTab: 'staff' })
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [locations, setLocations] = useState<OrganizerLocationDto[]>([])
  const [requirements, setRequirements] = useState<DmReq[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [locId, setLocId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [minLead, setMinLead] = useState('1')
  const [minFloat, setMinFloat] = useState('0')
  const [gapPick, setGapPick] = useState<GapCellPick | null>(null)
  const [assignBusyKey, setAssignBusyKey] = useState<string | null>(null)
  const [assignOk, setAssignOk] = useState<string | null>(null)
  const { ask, dialog } = useConfirmDialog()

  function inferDmRole(roles: Iterable<string>) {
    for (const r of Array.from(roles)) {
      if (isDmStaffRole(r)) return r
    }
    return 'dungeon_monitor'
  }

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [lRes, rRes] = await Promise.all([
        organizerDancecardFetch<{ locations: OrganizerLocationDto[] }>(eventSlug, '/locations'),
        organizerDancecardFetch<{ requirements: DmReq[] }>(eventSlug, '/dm-requirements'),
      ])
      setLocations(lRes.locations ?? [])
      setRequirements(rRes.requirements ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load coverage data')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!locId && locations.length > 0) {
      const leaves = leafLocations(locations)
      setLocId((leaves[0] ?? locations[0]).id)
    }
  }, [locations, locId])

  const locById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of locations) m.set(l.id, l.shortName || l.name)
    return m
  }, [locations])

  const leaves = useMemo(() => leafLocations(locations), [locations])

  const timeSlices = useMemo(() => {
    const w0 = new Date(windowStartsAt).getTime()
    const w1 = new Date(windowEndsAt).getTime()
    if (!Number.isFinite(w0) || !Number.isFinite(w1) || w0 >= w1) return []
    const step = 2 * 3600_000
    const out: { t0: number; t1: number }[] = []
    for (let t = w0; t < w1; t += step) {
      out.push({ t0: t, t1: Math.min(t + step, w1) })
    }
    return out
  }, [windowStartsAt, windowEndsAt])

  function countDmForCell(locationId: string, t0: number, t1: number) {
    let n = 0
    for (const s of shifts) {
      if (s.shiftStatus === 'draft' || s.shiftStatus === 'dropped') continue
      if ((s.locationId ?? '') !== locationId) continue
      if (!isDmStaffRole(s.role)) continue
      const a0 = new Date(s.startsAt).getTime()
      const a1 = new Date(s.endsAt).getTime()
      if (!Number.isFinite(a0) || !Number.isFinite(a1)) continue
      if (intervalsOverlap(a0, a1, t0, t1)) n += 1
    }
    return n
  }

  async function addRequirement() {
    if (readOnly) return
    if (!locId || !startsAt || !endsAt) {
      setErr('Pick location and time window')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/dm-requirements', {
        method: 'POST',
        body: JSON.stringify({
          locationId: locId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          minLead: Number(minLead) || 0,
          minFloat: Number(minFloat) || 0,
        }),
      })
      setStartsAt('')
      setEndsAt('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeRequirement(id: string) {
    if (readOnly) return
    if (
      !(await ask({
        title: 'Delete requirement?',
        message: 'Delete this coverage requirement?',
        destructive: true,
      }))
    )
      return
    try {
      await organizerDancecardFetch(eventSlug, `/dm-requirements/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const dmShifts = shifts.filter((s) => isDmStaffRole(s.role))

  const staffPeople = useMemo(() => {
    const map = new Map<
      string,
      { key: string; personName: string; personId: string | null; roles: Set<string>; totalH: number }
    >()
    for (const s of shifts) {
      if (s.shiftStatus === 'dropped' || s.shiftStatus === 'draft') continue
      const key = personKey(s)
      const cur = map.get(key) ?? {
        key,
        personName: s.personName,
        personId: s.personId,
        roles: new Set<string>(),
        totalH: 0,
      }
      cur.roles.add(s.role)
      cur.totalH += shiftHoursMs(s) / 3600000
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.totalH - b.totalH)
  }, [shifts])

  const gapCandidates = useMemo(() => {
    if (!gapPick) return []
    const { t0, t1 } = gapPick
    return staffPeople
      .map((p) => {
        let sliceH = 0
        for (const s of shifts) {
          if (s.shiftStatus === 'dropped' || s.shiftStatus === 'draft') continue
          if (personKey(s) !== p.key) continue
          const a0 = new Date(s.startsAt).getTime()
          const a1 = new Date(s.endsAt).getTime()
          if (!intervalsOverlap(a0, a1, t0, t1)) continue
          const overlapStart = Math.max(a0, t0)
          const overlapEnd = Math.min(a1, t1)
          sliceH += (overlapEnd - overlapStart) / 3600000
        }
        const dmCapable = Array.from(p.roles).some((r) => isDmStaffRole(r))
        return { ...p, sliceH, dmCapable, roles: Array.from(p.roles) }
      })
      .sort((a, b) => {
        if (a.dmCapable !== b.dmCapable) return a.dmCapable ? -1 : 1
        return a.totalH - b.totalH
      })
  }, [gapPick, staffPeople, shifts])

  async function assignCoverage(
    candidate: (typeof gapCandidates)[number],
    overrideConflicts = false,
  ) {
    if (!gapPick || readOnly) return
    setAssignOk(null)
    setAssignBusyKey(candidate.key)
    setErr(null)
    const startsAt = new Date(gapPick.t0).toISOString()
    const endsAt = new Date(gapPick.t1).toISOString()
    const role = inferDmRole(candidate.roles)

    if (!overrideConflicts) {
      const preview = findStaffShiftConflicts(shifts, {
        personId: candidate.personId,
        personName: candidate.personName,
        startsAt,
        endsAt,
      })
      if (preview.length) {
        const list = formatStaffShiftConflictList(preview, timezone)
        const ok = await ask({
          title: 'Scheduling conflict',
          message: `${candidate.personName} is already scheduled during this block:\n${list}\n\nTry someone else, or assign anyway. They will be notified to review their dancecard.`,
          confirmLabel: 'Assign anyway',
          destructive: true,
        })
        setAssignBusyKey(null)
        if (!ok) return
        return assignCoverage(candidate, true)
      }
    }

    try {
      const res = await organizerDancecardFetch<{
        shift: OrganizerStaffShiftDto
        dancecardSynced?: boolean
        notified?: boolean
        accountLinked?: boolean
      }>(eventSlug, '/staff-shifts/assign-coverage', {
        method: 'POST',
        body: JSON.stringify({
          personName: candidate.personName,
          personId: candidate.personId,
          locationId: gapPick.locationId,
          startsAt,
          endsAt,
          role,
          overrideConflicts,
        }),
      })
      await onRefreshShifts()
      setGapPick((g) => (g ? { ...g, assigned: g.assigned + 1 } : g))
      const parts = [`Assigned ${candidate.personName}.`]
      if (res.dancecardSynced) parts.push('Added to their dancecard.')
      else if (res.accountLinked) parts.push('Already on their dancecard.')
      else if (!res.accountLinked) parts.push('No matching dancecard account. They can autofill by name when they log in.')
      if (res.notified) parts.push('They were notified.')
      if (overrideConflicts) parts.push('Assigned with overlap override.')
      setAssignOk(parts.join(' '))
    } catch (e) {
      if (e instanceof OrganizerApiError && e.status === 409) {
        let conflicts: StaffShiftConflict[] = []
        try {
          const parsed = JSON.parse(e.body) as { conflicts?: StaffShiftConflict[] }
          conflicts = parsed.conflicts ?? []
        } catch {
          /* ignore */
        }
        const list = formatStaffShiftConflictList(conflicts, timezone)
        const ok = await ask({
          title: 'Scheduling conflict',
          message: `${candidate.personName} is already scheduled during this block:\n${list || 'Overlapping shift'}\n\nTry someone else, or assign anyway. They will be notified.`,
          confirmLabel: 'Assign anyway',
          destructive: true,
        })
        if (ok) await assignCoverage(candidate, true)
        return
      }
      setErr(e instanceof Error ? e.message : 'Assign failed')
    } finally {
      setAssignBusyKey(null)
    }
  }

  function openGapCell(locationId: string, locationName: string, t0: number, t1: number, assigned: number) {
    const req = requirements.find((r) => {
      if (r.locationId !== locationId) return false
      const r0 = new Date(r.startsAt).getTime()
      const r1 = new Date(r.endsAt).getTime()
      return intervalsOverlap(r0, r1, t0, t1)
    })
    setAssignOk(null)
    setGapPick({
      locationId,
      locationName,
      t0,
      t1,
      assigned,
      needLead: req?.minLead ?? 1,
      needFloat: req?.minFloat ?? 0,
    })
  }

  return (
    <div className="space-y-6 text-sm text-dc-muted">
      {dialog}
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      <TrustedRoleWorkflowCallout eventSlug={eventSlug} variant="coverage" />

      {!embedded ? (
        <details className="rounded-xl border border-dc-border bg-dc-elevated-muted/50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-dc-text">Coverage help</summary>
          <p className="mt-2 text-sm leading-relaxed text-dc-muted">
            Define coverage windows per play space, then use the heatmap to spot gaps. Red cells are uncovered. Click to
            assign staff. Shifts use coverage roles with a play-space location set on the Staff shifts tab.
          </p>
        </details>
      ) : null}

      {requirements.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2">
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Coverage windows</p>
            <p className="mt-0.5 font-serif text-xl text-dc-text">{requirements.length}</p>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <button
          type="button"
          className="min-h-10 rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-surface-muted"
          onClick={() => setAddFormOpen((v) => !v)}
        >
          {addFormOpen ? 'Hide add coverage requirement' : 'Add coverage requirement'}
        </button>
      ) : null}

      {addFormOpen && !readOnly ? (
      <div className={`rounded-xl border border-dc-border bg-dc-surface-muted p-4 ${readOnly ? 'opacity-60' : ''}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Add coverage window</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-dc-muted">
            Location
            <select
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
              value={locId}
              disabled={readOnly}
              onChange={(e) => setLocId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <DatetimeLocalField
            label="Starts"
            value={startsAt}
            disabled={readOnly}
            onChange={setStartsAt}
          />
          <DatetimeLocalField
            label="Ends"
            value={endsAt}
            disabled={readOnly}
            onChange={setEndsAt}
          />
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-dc-muted" title="Primary on-duty coverage">
              Min lead (primary)
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                value={minLead}
                disabled={readOnly}
                onChange={(e) => setMinLead(e.target.value)}
              />
            </label>
            <label className="flex-1 text-xs text-dc-muted" title="Backup or overlap coverage">
              Min backup (float)
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                value={minFloat}
                disabled={readOnly}
                onChange={(e) => setMinFloat(e.target.value)}
              />
            </label>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || readOnly}
          className="mt-3 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-dc-text hover:bg-violet-500 disabled:opacity-50"
          onClick={() => void addRequirement()}
        >
          {busy ? 'Saving…' : 'Add requirement'}
        </button>
      </div>
      ) : null}

      <div className="rounded-xl border border-dc-border bg-dc-elevated-muted">
        <div className="border-b border-dc-border px-3 py-2 text-xs font-semibold uppercase text-dc-muted">
          Coverage windows
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-dc-muted">
              <tr className="border-b border-dc-border">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Space</th>
                <th className="px-3 py-2">Min lead / backup</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {requirements.map((r) => (
                <tr key={r.id} className="border-b border-dc-border/50">
                  <td className="px-3 py-2 text-dc-muted">
                    {formatInTimeZone(new Date(r.startsAt), timezone, 'EEE MMM d ha')} –{' '}
                    {formatInTimeZone(new Date(r.endsAt), timezone, 'ha')}
                  </td>
                  <td className="px-3 py-2 text-dc-text">{locById.get(r.locationId) ?? r.locationId.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-dc-muted">
                    {r.minLead} / {r.minFloat}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {readOnly ? null : (
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:text-red-700"
                        onClick={() => void removeRequirement(r.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!requirements.length ? (
            <PeopleEmptyState title="No coverage windows yet" actions={!readOnly ? [{ label: 'Add coverage requirement', onClick: () => setAddFormOpen(true), primary: true }] : []}>
              Add one for each play space or operational area that needs staffing during the event window.
            </PeopleEmptyState>
          ) : null}
        </div>
      </div>

      {requirements.length > 0 && timeSlices.length && leaves.length ? (
        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Coverage headcount (2h slices × play spaces)
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-dc-border bg-dc-surface-muted px-2 py-2 text-left text-dc-muted">Time</th>
                  {leaves.map((l) => (
                    <th key={l.id} className="border border-dc-border bg-dc-surface-muted px-2 py-2 text-dc-muted">
                      {l.shortName || l.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlices.map((sl, i) => (
                  <tr key={i}>
                    <td className="border border-dc-border px-2 py-1.5 text-dc-muted whitespace-nowrap">
                      {formatInTimeZone(new Date(sl.t0), timezone, 'EEE ha')} –{' '}
                      {formatInTimeZone(new Date(sl.t1), timezone, 'ha')}
                    </td>
                    {leaves.map((l) => {
                      const c = countDmForCell(l.id, sl.t0, sl.t1)
                      const isGap = c === 0
                      return (
                        <td
                          key={l.id}
                          className={cn(
                            'border border-dc-border px-2 py-1.5 text-center',
                            isGap ? 'bg-dc-danger-muted text-dc-danger' : 'bg-dc-success-muted/80 text-dc-success',
                            isGap && !readOnly && 'cursor-pointer hover:ring-1 hover:ring-dc-danger-border',
                          )}
                          title={
                            isGap
                              ? 'Uncovered. Click to see available staff and scheduled hours'
                              : `${c} coverage shift${c === 1 ? '' : 's'} scheduled`
                          }
                          onClick={
                            isGap && !readOnly
                              ? () => openGapCell(l.id, l.shortName || l.name, sl.t0, sl.t1, c)
                              : undefined
                          }
                        >
                          {c}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : requirements.length === 0 ? null : (
        <p className="text-xs text-dc-muted">Configure event window and locations to see the coverage heatmap.</p>
      )}

      <div className="rounded-xl border border-dc-border bg-dc-elevated-muted">
        <div className="flex items-center justify-between border-b border-dc-border px-3 py-2">
          <p className="text-xs font-semibold uppercase text-dc-muted">Special role staff shifts</p>
          <button
            type="button"
            className="text-xs text-dc-accent hover:underline"
            onClick={() => void onRefreshShifts()}
          >
            Refresh from Staff tab
          </button>
        </div>
        <ul className="max-h-64 divide-y divide-dc-border overflow-y-auto">
          {dmShifts.map((s) => (
            <li key={s.id} className="px-3 py-2 text-xs text-dc-muted">
              <span className="text-dc-text">{s.personName}</span> ·{' '}
              {s.role.replace(/_/g, ' ').replace(/\bdm\b/gi, 'coverage')} ·{' '}
              <span className="text-dc-muted">{s.shiftStatus}</span>
              {s.locationId ? (
                <span className="text-dc-muted"> @ {locById.get(s.locationId) ?? s.locationId.slice(0, 8)}</span>
              ) : (
                <span className="text-red-700"> · missing location</span>
              )}
              <div className="text-[10px] text-dc-muted">
                {formatInTimeZone(new Date(s.startsAt), timezone, 'EEE ha')} –{' '}
                {formatInTimeZone(new Date(s.endsAt), timezone, 'ha')}
              </div>
            </li>
          ))}
        </ul>
        {!dmShifts.length ? (
          <p className="px-3 py-6 text-center text-dc-muted">
            No coverage shifts yet. Add them on the Staff shifts tab with a coverage role and play-space location.
          </p>
        ) : null}
      </div>

      {gapPick ? (
        <div
          className="fixed inset-0 z-dc-modal flex items-center justify-center bg-dc-text/40 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            setGapPick(null)
            setAssignOk(null)
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-dc-border-strong bg-dc-elevated-solid p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg text-dc-text">Assign coverage</h3>
            <p className="mt-1 text-sm text-dc-muted">
              {gapPick.locationName} ·{' '}
              {formatInTimeZone(new Date(gapPick.t0), timezone, 'EEE MMM d ha')} –{' '}
              {formatInTimeZone(new Date(gapPick.t1), timezone, 'ha')}
            </p>
            <p className="mt-2 text-xs text-dc-muted">
              Need {gapPick.needLead} on duty
              {gapPick.needFloat > 0 ? ` (+${gapPick.needFloat} backup)` : ''}; currently {gapPick.assigned} scheduled in
              this block. Click a name to assign. Conflicts will be flagged before you can override.
            </p>
            {assignOk ? (
              <p className="mt-2 rounded-lg border border-dc-success/30 bg-dc-success-muted px-3 py-2 text-sm text-dc-success">
                {assignOk}
              </p>
            ) : null}
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {gapCandidates.length === 0 ? (
                <li className="text-sm text-dc-muted">No staff shifts on file yet. Add people on Staff shifts first.</li>
              ) : (
                gapCandidates.map((p) => {
                  const busy = assignBusyKey === p.key
                  const hasBlockConflict = p.sliceH > 0
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        disabled={busy || !!assignBusyKey}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50',
                          busy
                            ? 'border-dc-accent-border bg-dc-accent-muted'
                            : hasBlockConflict
                              ? 'border-dc-warning/45 bg-dc-warning-muted hover:border-dc-warning'
                              : p.dmCapable
                                ? 'border-dc-accent-border/50 bg-dc-accent-muted/40 hover:border-dc-accent-border hover:bg-dc-accent-muted/70'
                                : 'border-dc-border bg-dc-elevated-solid hover:border-dc-accent-border/40 hover:bg-dc-surface-muted',
                        )}
                        onClick={() => void assignCoverage(p)}
                      >
                        <p className="font-medium text-dc-text">
                          {busy ? 'Assigning…' : p.personName}
                          {p.dmCapable ? (
                            <span className="ml-2 rounded-full bg-dc-accent-muted px-1.5 py-0.5 text-[10px] font-semibold text-dc-accent">
                              coverage role
                            </span>
                          ) : null}
                          {hasBlockConflict ? (
                            <span className="ml-2 rounded-full border border-dc-warning/40 bg-dc-warning-muted px-1.5 py-0.5 text-[10px] font-semibold text-dc-warning">
                              busy this block
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-dc-muted">
                          {p.totalH.toFixed(1)} h scheduled this weekend
                          {p.sliceH > 0 ? ` · ${p.sliceH.toFixed(1)} h in this block` : ' · free in this block'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-dc-muted">
                          {hasBlockConflict
                            ? 'Likely conflict. You can still assign with override if needed.'
                            : 'Click to assign and update their dancecard when an account matches.'}
                        </p>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-dc-border bg-dc-elevated-solid px-4 py-2 text-sm text-dc-text hover:bg-dc-surface-muted"
                onClick={() => {
                  setGapPick(null)
                  setAssignOk(null)
                }}
              >
                Close
              </button>
              <a
                className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground"
                href={staffShiftsHref}
              >
                Open Staff shifts
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
