'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { computeDmCoverageGaps, type DmRequirementRow, type StaffShiftForDm } from '@/lib/dancecard/dmCoverageScanner'
import { isProgramSlotScheduled, type ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'
import { VenueMapAssignPanel } from '@/components/dancecard/organizer/venue/VenueMapAssignPanel'
import {
  buildVenueAutoAssignments,
  findVenueLocationConflicts,
  formatVenueConflictMessage,
} from '@/lib/dancecard/venueSlotAssignment'

function slotIsoDate(iso: string | null): Date {
  return iso ? new Date(iso) : new Date(0)
}

type LocRow = { id: string; name: string; parentId: string | null }
type LeafColumn = { id: string; name: string; isRoom: boolean }

function isLeaf(locations: LocRow[], id: string) {
  return !locations.some((l) => l.parentId === id)
}

type CoverageBanner = { tone: 'ok' | 'warn' | 'info'; title: string; detail?: string }

function VenueAddSpaceModal({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
  busy: boolean
}) {
  const [name, setName] = useState('')
  useEffect(() => {
    if (open) setName('')
  }, [open])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-dc-modal flex items-end justify-center bg-dc-surface/70 p-4 backdrop-blur-md sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <Panel className="w-full max-w-md shadow-xl" role="dialog" aria-labelledby="add-space-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="add-space-title" className="font-serif text-lg text-dc-text">
          Create a space
        </h3>
        <p className="mt-1 text-sm text-dc-muted">
          Add a room or play space to your venue list. It will appear as a column on this grid.
        </p>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-dc-muted">
          Room name
          <input
            className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text focus:border-dc-accent-border focus:outline-none focus:ring-1 focus:ring-dc-accent/30"
            value={name}
            disabled={busy}
            placeholder="e.g. Main hall, Burrow"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) void onSubmit(name.trim())
            }}
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-dc-border px-4 py-2 text-sm text-dc-muted hover:text-dc-text"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-60"
            disabled={busy || !name.trim()}
            onClick={() => void onSubmit(name.trim())}
          >
            {busy ? 'Saving…' : 'Add room'}
          </button>
        </div>
      </Panel>
    </div>
  )
}


function parseHm(label: string) {
  const [h, m] = label.split(':').map((x) => Number(x))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function formatHm(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildTimeRows(daySlots: ProgramSlotRow[], timezone: string, day: string) {
  const occupied = new Set<string>()
  for (const s of daySlots) {
    const d = formatInTimeZone(slotIsoDate(s.startsAt), timezone, 'yyyy-MM-dd')
    if (d !== day) continue
    occupied.add(formatInTimeZone(slotIsoDate(s.startsAt), timezone, 'HH:mm'))
  }

  if (occupied.size === 0) {
    const rows: { key: string; label: string }[] = []
    for (let h = 8; h < 22; h++) {
      for (const m of [0, 30]) {
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        rows.push({ key: `${day}-${label}`, label })
      }
    }
    return rows
  }

  let minM = 24 * 60
  let maxM = 0
  for (const label of Array.from(occupied)) {
    const m = parseHm(label)
    minM = Math.min(minM, m)
    maxM = Math.max(maxM, m)
  }
  minM = Math.max(0, minM - 30)
  maxM = Math.min(24 * 60 - 30, maxM + 60)

  const step = occupied.size > 24 ? 60 : 30
  const rows: { key: string; label: string }[] = []
  for (let t = minM; t <= maxM; t += step) {
    const label = formatHm(t)
    rows.push({ key: `${day}-${label}`, label })
  }
  return rows
}

function heatClass(count: number) {
  if (count >= 3) return 'bg-dc-danger/15 ring-1 ring-dc-danger/35'
  if (count === 2) return 'bg-dc-warning-muted ring-1 ring-dc-warning/30'
  if (count === 1) return 'bg-dc-accent/10'
  return 'bg-dc-surface-muted/40'
}

function cellMinHeight(density: number) {
  if (density >= 3) return 'min-h-[7.5rem]'
  if (density === 2) return 'min-h-[5.5rem]'
  if (density === 1) return 'min-h-[3.25rem]'
  return 'min-h-[2.25rem]'
}

export function VenueAvailabilityGrid({
  eventSlug,
  timezone,
  slots: slotsProp,
  shifts: shiftsFromShell,
  onRefresh,
  onSlotUpdated,
  readOnly,
  onGoSetup,
  mapRefreshToken = 0,
}: {
  eventSlug: string
  timezone: string
  slots: ProgramSlotRow[]
  /** When provided, coverage scan skips GET /staff-shifts. */
  shifts?: OrganizerStaffShiftDto[]
  onRefresh: () => void | Promise<void>
  onSlotUpdated?: (slot: ProgramSlotRow) => void
  readOnly: boolean
  onGoSetup?: () => void
  mapRefreshToken?: number
}) {
  const slots = useMemo(() => slotsProp.filter(isProgramSlotScheduled), [slotsProp])
  const [locations, setLocations] = useState<LocRow[]>([])
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [coverage, setCoverage] = useState<CoverageBanner | null>(null)
  const [autoMsg, setAutoMsg] = useState<string | null>(null)
  const { ask, dialog } = useConfirmDialog()

  const loadLocs = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<{ locations: LocRow[] }>(eventSlug, '/locations')
      setLocations(
        (res.locations ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          parentId: (l as { parentId?: string | null }).parentId ?? null,
        })),
      )
    } catch {
      setLocations([])
    }
  }, [eventSlug])

  useEffect(() => {
    void loadLocs()
  }, [loadLocs])

  const dayKeys = useMemo(() => {
    const set = new Set<string>()
    for (const s of slots) {
      set.add(formatInTimeZone(slotIsoDate(s.startsAt), timezone, 'yyyy-MM-dd'))
    }
    return Array.from(set).sort()
  }, [slots, timezone])

  useEffect(() => {
    if (!day && dayKeys.length) setDay(dayKeys[0] ?? '')
  }, [day, dayKeys])

  const leafColumns: LeafColumn[] = useMemo(() => {
    const locs = locations
    if (!locs.length) {
      const rooms = Array.from(new Set(slots.map((s) => (s.room ?? '').trim()).filter(Boolean))).sort()
      return rooms.map((name) => ({ id: `__room_${name}`, name, isRoom: true }))
    }
    const leaves = locs.filter((l) => isLeaf(locs, l.id))
    if (!leaves.length) return locs.map((l) => ({ id: l.id, name: l.name, isRoom: false }))
    return leaves.map((l) => ({ id: l.id, name: l.name, isRoom: false }))
  }, [locations, slots])

  const daySlots = useMemo(() => {
    if (!day) return []
    return slots.filter((s) => formatInTimeZone(slotIsoDate(s.startsAt), timezone, 'yyyy-MM-dd') === day)
  }, [slots, day, timezone])

  const unassignedSlots = useMemo(
    () => daySlots.filter((s) => !s.locationId && !(s.room ?? '').trim()),
    [daySlots],
  )

  const timeRows = useMemo(() => buildTimeRows(daySlots, timezone, day), [daySlots, timezone, day])

  const maxCellDensity = useMemo(() => {
    let max = 0
    for (const row of timeRows) {
      for (const col of leafColumns) {
        max = Math.max(max, slotsForCellHelper(daySlots, col.id, row.label, day, timezone).length)
      }
    }
    return max
  }, [timeRows, leafColumns, daySlots, day, timezone])

  const columnMinWidth = leafColumns.length > 10 ? 88 : leafColumns.length > 6 ? 100 : 120

  const locationNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const l of locations) m[l.id] = l.name
    return m
  }, [locations])

  const linkedLeafIds = useMemo(
    () => new Set(leafColumns.filter((c) => !c.isRoom).map((c) => c.id)),
    [leafColumns],
  )

  useEffect(() => {
    let cancelled = false
    async function loadCoverage() {
      if (!linkedLeafIds.size) {
        if (!cancelled) {
          setCoverage({
            tone: 'info',
            title: 'Add named rooms to track monitor coverage on this grid.',
          })
        }
        return
      }
      try {
        const reqRes = await organizerDancecardFetch<{ requirements: DmRequirementRow[] }>(
          eventSlug,
          '/dm-requirements',
        )
        let shiftList = shiftsFromShell
        if (!shiftList) {
          const shiftRes = await organizerDancecardFetch<{ shifts: OrganizerStaffShiftDto[] }>(
            eventSlug,
            '/staff-shifts',
          )
          shiftList = shiftRes.shifts ?? []
        }
        const reqs = (reqRes.requirements ?? []).filter((r) => linkedLeafIds.has(r.locationId))
        const staffForDm: StaffShiftForDm[] = shiftList.map((s) => ({
          id: s.id,
          locationId: s.locationId,
          role: s.role,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          shiftStatus: s.shiftStatus,
        }))
        const formatWindow = (startsAt: string, endsAt: string) => {
          const a = formatInTimeZone(slotIsoDate(startsAt), timezone, 'MMM d HH:mm')
          const b = formatInTimeZone(slotIsoDate(endsAt), timezone, 'HH:mm')
          return `${a} to ${b}`
        }
        const gaps = computeDmCoverageGaps(reqs, staffForDm, { locationNames, formatWindow })
        if (cancelled) return
        if (reqs.length === 0) {
          setCoverage({
            tone: 'info',
            title: 'No monitor coverage rules yet for these rooms.',
            detail: 'Open DM coverage to set how many dungeon monitors you need per play space.',
          })
        } else if (gaps.length === 0) {
          setCoverage({
            tone: 'ok',
            title: 'Staff coverage looks complete for these rooms',
          })
        } else {
          setCoverage({
            tone: 'warn',
            title: `${gaps.length} monitor coverage gap${gaps.length === 1 ? '' : 's'} for these rooms`,
            detail: gaps[0]?.detail,
          })
        }
      } catch {
        if (!cancelled) {
          setCoverage({
            tone: 'info',
            title: 'Could not check staff coverage right now.',
            detail: 'Open Staff shifts or DM coverage to review volunteer assignments.',
          })
        }
      }
    }
    void loadCoverage()
    return () => {
      cancelled = true
    }
  }, [eventSlug, linkedLeafIds, locationNames, timezone, shiftsFromShell])

  function slotsForCell(colId: string, rowLabel: string) {
    return slotsForCellHelper(daySlots, colId, rowLabel, day, timezone)
  }

  async function patchSlotLocation(slotId: string, colId: string, opts?: { refresh?: boolean }) {
    if (readOnly) return
    const shouldRefresh = opts?.refresh !== false
    if (shouldRefresh) {
      setBusy(true)
      setErr(null)
    }
    try {
      const body =
        colId.startsWith('__room_') ?
          { locationId: null, room: colId.replace('__room_', '') }
        : { locationId: colId, room: null }
      const res = await organizerDancecardFetch<{ slot: ProgramSlotRow }>(eventSlug, `/program-slots/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (res.slot) onSlotUpdated?.(res.slot)
      if (shouldRefresh && (!onSlotUpdated || !res.slot)) await onRefresh()
    } catch (e) {
      if (shouldRefresh) setErr(e instanceof Error ? e.message : 'Update failed')
      throw e
    } finally {
      if (shouldRefresh) setBusy(false)
    }
  }

  async function attemptAssignSlotLocation(slotId: string, colId: string) {
    if (readOnly) return
    const moving = slots.find((s) => s.id === slotId)
    if (!moving) return

    const conflicts = findVenueLocationConflicts(slots, slotId, colId)
    if (conflicts.length) {
      const ok = await ask({
        title: 'Room and time conflict',
        message: formatVenueConflictMessage(moving, conflicts, colId, locationNames),
        confirmLabel: 'Assign anyway',
        destructive: true,
      })
      if (!ok) return
    }

    await patchSlotLocation(slotId, colId)
  }

  const autoAssignPreview = useMemo(() => {
    const colIds = leafColumns.map((c) => c.id)
    if (!colIds.length) return []
    return buildVenueAutoAssignments(slots, colIds, { candidateSlots: daySlots })
  }, [slots, daySlots, leafColumns])

  async function runAutoAssignRooms() {
    if (readOnly || !autoAssignPreview.length) return
    const ok = await ask({
      title: 'Auto-assign rooms',
      message: `Place ${autoAssignPreview.length} unassigned class${autoAssignPreview.length === 1 ? '' : 'es'} on ${day || 'this day'} into the first open room for each time block. Classes you already placed are not moved.`,
      confirmLabel: 'Auto-assign',
    })
    if (!ok) return

    setBusy(true)
    setErr(null)
    setAutoMsg(null)
    let done = 0
    try {
      for (const row of autoAssignPreview) {
        await patchSlotLocation(row.slotId, row.colId, { refresh: false })
        done++
      }
      if (!onSlotUpdated) await onRefresh()
      const skipped = daySlots.filter(
        (s) => !s.locationId && !(s.room ?? '').trim() && !autoAssignPreview.some((p) => p.slotId === s.id),
      ).length
      setAutoMsg(
        skipped > 0
          ? `Auto-assigned ${done} class${done === 1 ? '' : 'es'}. ${skipped} still unassigned (no open room at that time).`
          : `Auto-assigned ${done} class${done === 1 ? '' : 'es'}.`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Auto-assign failed')
    } finally {
      setBusy(false)
    }
  }

  async function addRoom(name: string) {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/locations', {
        method: 'POST',
        body: JSON.stringify({ name, sortOrder: locations.length }),
      })
      await loadLocs()
      setAddModalOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add room')
    } finally {
      setBusy(false)
    }
  }

  const coveragePanelClass =
    coverage?.tone === 'ok' ? 'border-dc-success/30 bg-dc-success-muted'
    : coverage?.tone === 'warn' ? 'border-dc-warning/30 bg-dc-warning-muted'
    : 'border-dc-border bg-dc-elevated-muted'

  const coverageTextClass =
    coverage?.tone === 'ok' ? 'text-dc-success'
    : coverage?.tone === 'warn' ? 'text-dc-warning'
    : 'text-dc-muted'

  return (
    <div className="space-y-4">
      {dialog}
      <VenueAddSpaceModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSubmit={addRoom} busy={busy} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-xl text-dc-text">Rooms by time</h3>
          <p className="mt-1 max-w-2xl text-sm text-dc-muted">
            See which classes sit in each room. Drag between columns or drop onto the floor-plan pins to assign a
            location.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <>
              <button
                type="button"
                className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:opacity-90"
                onClick={() => setAddModalOpen(true)}
              >
                Add a room
              </button>
              <button
                type="button"
                className="rounded-lg border border-dc-accent-border px-4 py-2 text-sm font-medium text-dc-accent hover:bg-dc-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || autoAssignPreview.length === 0}
                title={
                  autoAssignPreview.length === 0
                    ? 'No unassigned classes on this day'
                    : `Assign ${autoAssignPreview.length} classes to open rooms`
                }
                onClick={() => void runAutoAssignRooms()}
              >
                Auto-assign rooms
                {autoAssignPreview.length > 0 ? ` (${autoAssignPreview.length})` : ''}
              </button>
            </>
          ) : null}
          {onGoSetup ? (
            <button
              type="button"
              className="rounded-lg border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted"
              onClick={onGoSetup}
            >
              Rooms & floor plan
            </button>
          ) : null}
        </div>
      </div>

      {coverage ? (
        <Panel className={coveragePanelClass}>
          <p className={`text-sm font-medium ${coverageTextClass}`}>{coverage.title}</p>
          {coverage.detail ? <p className="mt-1 text-xs text-dc-muted">{coverage.detail}</p> : null}
        </Panel>
      ) : null}

      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      {autoMsg ? <p className="text-sm text-dc-success">{autoMsg}</p> : null}

      <label className="flex flex-wrap items-center gap-2 text-sm text-dc-muted">
        Day
        <select
          className="rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-dc-text"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        >
          {dayKeys.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {busy ? <span className="text-xs text-dc-muted">Saving…</span> : null}
        {leafColumns.length > 0 ? (
          <span className="text-xs text-dc-muted">
            {leafColumns.length} room{leafColumns.length === 1 ? '' : 's'}
            {maxCellDensity > 1 ? ` · busiest slot has ${maxCellDensity} classes` : ''}
          </span>
        ) : null}
      </label>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="min-w-0 space-y-4">
      {leafColumns.length === 0 ? (
        <Panel variant="muted">
          <p className="text-sm text-dc-muted">No rooms yet. Create a space to build your venue grid.</p>
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dc-border">
          <table className="min-w-full border-collapse text-left text-dc-text" style={{ fontSize: maxCellDensity >= 3 ? '0.7rem' : '0.75rem' }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border border-dc-border bg-dc-surface px-2 py-2 text-dc-micro font-medium uppercase text-dc-muted">
                  Time
                </th>
                {leafColumns.map((c) => (
                  <th
                    key={c.id}
                    className="border border-dc-border bg-dc-elevated px-2 py-2 font-medium text-dc-text"
                    style={{ minWidth: columnMinWidth }}
                    data-drop-col={c.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const sid = e.dataTransfer.getData('text/slot-id')
                      if (!sid) return
                      void attemptAssignSlotLocation(sid, c.id)
                    }}
                  >
                    <span className={leafColumns.length > 8 ? 'block text-[10px] leading-tight' : 'text-xs'}>{c.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeRows.map((row) => (
                <tr key={row.key}>
                  <td className="sticky left-0 z-10 border border-dc-border bg-dc-surface px-2 py-1 font-mono text-dc-micro text-dc-muted">
                    {row.label}
                  </td>
                  {leafColumns.map((c) => {
                    const cellSlots = slotsForCell(c.id, row.label)
                    const density = cellSlots.length
                    return (
                      <td
                        key={`${row.key}-${c.id}`}
                        className={`align-top border border-dc-border px-1 py-1 ${heatClass(density)} ${cellMinHeight(density)}`}
                        data-drop-col={c.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const sid = e.dataTransfer.getData('text/slot-id')
                          if (!sid) return
                          void attemptAssignSlotLocation(sid, c.id)
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          {density >= 2 ? (
                            <span className="text-[10px] font-semibold text-dc-warning">{density} classes</span>
                          ) : null}
                          {cellSlots.map((s) => (
                            <div
                              key={s.id}
                              draggable={!readOnly}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/slot-id', s.id)
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              className="cursor-grab rounded border border-dc-accent/25 bg-dc-accent/10 px-1.5 py-1 text-dc-text shadow-sm active:cursor-grabbing"
                              title={s.title}
                            >
                              <span className={density >= 3 ? 'line-clamp-2' : 'line-clamp-3'}>{s.title}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <VenueMapAssignPanel
            eventSlug={eventSlug}
            locationNames={locationNames}
            readOnly={readOnly}
            unassignedSlots={unassignedSlots}
            onDropSlot={(slotId, locationId) => attemptAssignSlotLocation(slotId, locationId)}
            onGoSetup={onGoSetup}
            refreshToken={mapRefreshToken}
          />
        </aside>
      </div>
    </div>
  )
}

function slotsForCellHelper(
  daySlots: ProgramSlotRow[],
  colId: string,
  rowLabel: string,
  day: string,
  timezone: string,
) {
  if (!day) return []
  return daySlots.filter((s) => {
    const st = formatInTimeZone(slotIsoDate(s.startsAt), timezone, 'HH:mm')
    if (st !== rowLabel) return false
    if (colId.startsWith('__room_')) {
      const rn = colId.replace('__room_', '')
      return (s.room ?? '').trim() === rn && !s.locationId
    }
    return s.locationId === colId
  })
}
