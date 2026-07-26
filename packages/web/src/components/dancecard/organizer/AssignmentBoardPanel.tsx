'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { Panel } from '@/components/dancecard/ui/Panel'
import { Button } from '@/components/dancecard/ui/Button'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import type { OrganizerTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'

type Person = { id: string; sceneName: string }

type Assignment = {
  personId: string
  sceneName: string
  role: string
  sortOrder: number
  isPublicOnSchedule: boolean
}

const ROLE_OPTIONS = [
  { value: 'lead_presenter', label: 'Lead instructor' },
  { value: 'co_presenter', label: 'Co-instructor' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'photographer', label: 'Photographer' },
] as const

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((o) => [o.value, o.label]),
)

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ')
}

function slotStartDate(iso: string | null): Date {
  return iso ? new Date(iso) : new Date(0)
}

export function AssignmentBoardPanel({
  eventSlug,
  timezone,
  slots,
  onRefresh,
  readOnly,
  onNavigateTab,
}: {
  eventSlug: string
  timezone: string
  slots: ProgramSlotRow[]
  onRefresh: () => void | Promise<void>
  readOnly: boolean
  onNavigateTab?: (tab: OrganizerTab) => void
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [assignmentsBySlot, setAssignmentsBySlot] = useState<Record<string, Assignment[]>>({})
  const [pendingDrop, setPendingDrop] = useState<{ slotId: string; personId: string } | null>(null)
  const [pickRole, setPickRole] = useState<string>('lead_presenter')
  const [personSearch, setPersonSearch] = useState('')
  const [roomFilter, setRoomFilter] = useState('')

  const dayKeys = Array.from(
    new Set(slots.map((s) => formatInTimeZone(slotStartDate(s.startsAt), timezone, 'yyyy-MM-dd'))),
  ).sort()

  useEffect(() => {
    if (!day && dayKeys.length) setDay(dayKeys[0] ?? '')
  }, [day, dayKeys])

  const loadPeople = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<{ people: { id: string; sceneName: string }[] }>(eventSlug, '/people')
      setPeople((res.people ?? []).map((p) => ({ id: p.id, sceneName: p.sceneName })))
    } catch {
      setPeople([])
    }
  }, [eventSlug])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  const daySlots = useMemo(
    () => slots.filter((s) => day && formatInTimeZone(slotStartDate(s.startsAt), timezone, 'yyyy-MM-dd') === day),
    [slots, day, timezone],
  )

  const loadAssignmentsForDay = useCallback(async () => {
    if (!daySlots.length) {
      setAssignmentsBySlot({})
      return
    }
    try {
      const pairs = await Promise.all(
        daySlots.map(async (s) => {
          const res = await organizerDancecardFetch<{ assignments: Assignment[] }>(
            eventSlug,
            `/program-slots/${s.id}/people`,
          )
          return [s.id, res.assignments ?? []] as const
        }),
      )
      setAssignmentsBySlot(Object.fromEntries(pairs))
    } catch {
      setAssignmentsBySlot({})
    }
  }, [daySlots, eventSlug])

  useEffect(() => {
    void loadAssignmentsForDay()
  }, [loadAssignmentsForDay])

  const gaps = useMemo(() => {
    return daySlots.filter((s) => {
      const a = assignmentsBySlot[s.id] ?? []
      return !a.some((x) => x.role === 'lead_presenter' || x.role === 'co_presenter')
    })
  }, [daySlots, assignmentsBySlot])

  const roomOptions = useMemo(() => {
    const labels = new Set<string>()
    for (const s of gaps) {
      const label = (s.locationName ?? s.room ?? '').trim()
      if (label) labels.add(label)
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b))
  }, [gaps])

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => p.sceneName.toLowerCase().includes(q))
  }, [people, personSearch])

  const filteredGaps = useMemo(() => {
    const room = roomFilter.trim().toLowerCase()
    if (!room) return gaps
    return gaps.filter((s) => {
      const label = (s.locationName ?? s.room ?? '').trim().toLowerCase()
      return label.includes(room)
    })
  }, [gaps, roomFilter])

  const filteredDaySlots = useMemo(() => {
    if (!roomFilter.trim()) return daySlots
    const room = roomFilter.trim().toLowerCase()
    return daySlots.filter((s) => {
      const label = (s.locationName ?? s.room ?? '').trim().toLowerCase()
      return label.includes(room)
    })
  }, [daySlots, roomFilter])

  async function assignWithRole(slotId: string, personId: string, role: string) {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      const cur = await organizerDancecardFetch<{ assignments: Assignment[] }>(
        eventSlug,
        `/program-slots/${slotId}/people`,
      )
      const existing = cur.assignments ?? []
      if (existing.some((a) => a.personId === personId)) {
        setErr('That person is already on this class.')
        setBusy(false)
        return
      }
      const next = [
        ...existing.map((a, i) => ({
          personId: a.personId,
          role: a.role,
          sortOrder: a.sortOrder ?? i,
          isPublicOnSchedule: a.isPublicOnSchedule ?? true,
        })),
        {
          personId,
          role,
          sortOrder: existing.length,
          isPublicOnSchedule: true,
        },
      ]
      await organizerDancecardFetch(eventSlug, `/program-slots/${slotId}/people`, {
        method: 'PUT',
        body: JSON.stringify({ assignments: next }),
      })
      await onRefresh()
      await loadAssignmentsForDay()
      setPendingDrop(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign person')
    } finally {
      setBusy(false)
    }
  }

  function openDropDialog(slotId: string, personId: string) {
    const existing = assignmentsBySlot[slotId] ?? []
    const hasLead = existing.some((a) => a.role === 'lead_presenter')
    setPickRole(hasLead ? 'co_presenter' : 'lead_presenter')
    setPendingDrop({ slotId, personId })
  }

  const pendingSlot = pendingDrop ? slots.find((s) => s.id === pendingDrop.slotId) : null
  const pendingPerson = pendingDrop ? people.find((p) => p.id === pendingDrop.personId) : null

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-2xl text-dc-text">Schedule credits</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dc-muted">
          Review who appears on the public schedule for each class. Set the main instructor when you create a class on
          the Program tab. Use this board to spot missing credits, add co-instructors, or fix mistakes for one day at a
          time.
        </p>
        {onNavigateTab ? (
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-dc-accent hover:underline"
            onClick={() => onNavigateTab('program')}
          >
            Open program to edit classes →
          </button>
        ) : null}
      </header>

      {filteredGaps.length > 0 ? (
        <Panel className="border-dc-warning/30 bg-dc-warning-muted/40">
          <p className="text-sm font-medium text-dc-warning">
            {filteredGaps.length} class{filteredGaps.length === 1 ? '' : 'es'} on this day ha
            {filteredGaps.length === 1 ? 's' : 've'} no instructor listed
            {roomFilter.trim() ? ' (filtered)' : ''}
          </p>
          <p className="mt-1 text-xs text-dc-muted">
            Attendees may see empty teacher lines on the public dancecard until you add someone.
          </p>
        </Panel>
      ) : daySlots.length > 0 ? (
        <Panel className="border-dc-success/25 bg-dc-success-muted/30">
          <p className="text-sm text-dc-success">Every class on this day has at least one instructor credit.</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel variant="muted">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dc-muted">Roster</h3>
          <p className="mt-1 text-sm text-dc-muted">Drag onto a class, then choose their credit (lead, co-instructor, etc.).</p>
          <label className="mt-3 block text-xs uppercase text-dc-muted">
            Search roster
            <input
              className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
              placeholder="Filter by name…"
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
            />
          </label>
          {err ? <p className="mt-2 text-sm text-dc-danger">{err}</p> : null}
          <ul className="mt-4 flex flex-wrap gap-2">
            {filteredPeople.map((p) => (
              <li
                key={p.id}
                draggable={!readOnly}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/person-id', p.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className="cursor-grab rounded-full border border-dc-accent/30 bg-dc-accent/10 px-3 py-1 text-sm text-dc-accent-foreground active:cursor-grabbing"
              >
                {p.sceneName}
              </li>
            ))}
            {!filteredPeople.length ? (
              <li className="text-sm text-dc-muted">
                {people.length ? 'No names match your search.' : 'No people in the directory yet.'}
              </li>
            ) : null}
          </ul>
        </Panel>

        <Panel>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dc-muted">Classes on this day</h3>
          <div className="mt-2 flex flex-wrap items-end gap-3">
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
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs uppercase text-dc-muted">
              Room / location (unassigned)
              <select
                className="rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm normal-case text-dc-text"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
              >
                <option value="">All rooms</option>
                {roomOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {busy ? <span className="pb-1 text-xs text-dc-muted">Saving…</span> : null}
          </div>
          {roomFilter.trim() && !filteredGaps.length ? (
            <p className="mt-2 text-xs text-dc-muted">No unassigned classes in this room.</p>
          ) : null}
          <ul className="mt-3 max-h-[min(520px,60vh)] space-y-2 overflow-y-auto">
            {filteredDaySlots.map((s) => {
              const assigned = assignmentsBySlot[s.id] ?? []
              const missingLead = !assigned.some((a) => a.role === 'lead_presenter' || a.role === 'co_presenter')
              return (
                <li
                  key={s.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    missingLead ? 'border-dc-warning/40 bg-dc-warning-muted/20' : 'border-dc-border bg-dc-surface-muted/50'
                  } text-dc-text`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const pid = e.dataTransfer.getData('text/person-id')
                    if (!pid) return
                    openDropDialog(s.id, pid)
                  }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-medium text-dc-text">{s.title}</span>
                    <span className="text-xs text-dc-muted">
                      {formatInTimeZone(slotStartDate(s.startsAt), timezone, 'HH:mm')}
                      {' · '}
                      {s.locationName ?? s.room ?? 'Room TBD'}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    {assigned.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {assigned.map((a) => (
                          <li
                            key={`${a.personId}-${a.role}`}
                            className="rounded-md border border-dc-border bg-dc-elevated px-2 py-0.5 text-xs text-dc-text"
                          >
                            <span className="font-medium">{a.sceneName}</span>
                            <span className="text-dc-muted"> · {roleLabel(a.role)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-dc-muted">No credits yet. Drop a name to assign.</p>
                    )}
                  </div>
                </li>
              )
            })}
            {!filteredDaySlots.length ? (
              <li className="text-sm text-dc-muted">
                {daySlots.length ? 'No classes match this room filter.' : 'No classes on this day.'}
              </li>
            ) : null}
          </ul>
        </Panel>
      </div>

      {pendingDrop && pendingSlot && pendingPerson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dc-surface/80 p-4">
          <Panel className="max-w-md w-full">
            <h3 className="font-serif text-lg text-dc-text">Add schedule credit</h3>
            <p className="mt-2 text-sm text-dc-muted">
              Add <span className="font-medium text-dc-text">{pendingPerson.sceneName}</span> to{' '}
              <span className="font-medium text-dc-text">{pendingSlot.title}</span> as:
            </p>
            <div className="mt-4 space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-dc-text">
                  <input
                    type="radio"
                    name="assign-role"
                    checked={pickRole === opt.value}
                    onChange={() => setPickRole(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void assignWithRole(pendingDrop.slotId, pendingDrop.personId, pickRole)}>
                Save credit
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPendingDrop(null)}>
                Cancel
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
