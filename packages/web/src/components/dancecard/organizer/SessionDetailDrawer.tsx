'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import type { ScheduleChangeImpactReport } from '@/lib/dancecard/scheduleChangeImpact'

type LocationRow = { id: string; name: string }

type PersonOption = { id: string; sceneName: string }

type SlotAssignment = {
  id?: string
  personId: string
  sceneName: string
  role: string
  sortOrder: number
  isPublicOnSchedule: boolean
}

const SLOT_ROLE_OPTIONS = [
  'lead_presenter',
  'co_presenter',
  'moderator',
  'photographer',
  'dm',
  'volunteer',
  'staff',
] as const

type TabKey = 'overview' | 'edit' | 'location' | 'people' | 'registrants' | 'privacy' | 'notes'

type ChangeLogEntry = {
  id: string
  summary: unknown
  status: string
  createdAt: string
}

export function SessionDetailDrawer({
  eventSlug,
  timezone,
  slot,
  onClose,
  onSaved,
  readOnly,
  onCopySessionLink,
  onScheduleImpact,
  initialTab = 'overview',
}: {
  eventSlug: string
  timezone: string
  slot: ProgramSlotRow
  onClose: () => void
  onSaved: () => Promise<void>
  readOnly: boolean
  onCopySessionLink?: () => void
  onScheduleImpact?: (impact: ScheduleChangeImpactReport) => void
  initialTab?: TabKey
}) {
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [locationsLoadErr, setLocationsLoadErr] = useState<string | null>(null)
  const [peopleLoadErr, setPeopleLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [peopleList, setPeopleList] = useState<PersonOption[]>([])
  const [assignments, setAssignments] = useState<SlotAssignment[]>([])
  const [peopleBusy, setPeopleBusy] = useState(false)

  const [title, setTitle] = useState(slot.title)
  const [track, setTrack] = useState(slot.track ?? '')
  const [room, setRoom] = useState(slot.room ?? '')
  const [description, setDescription] = useState(slot.description ?? '')
  const [locationId, setLocationId] = useState(slot.locationId ?? '')
  const [isPublished, setIsPublished] = useState(slot.isPublished)
  const [visibility, setVisibility] = useState(slot.visibility)
  const [isFrozen, setIsFrozen] = useState(slot.isFrozen)
  const [photoPolicy, setPhotoPolicy] = useState<ProgramSlotRow['photoPolicy']>(slot.photoPolicy)
  const [organizerNotes, setOrganizerNotes] = useState(slot.organizerNotesInternal ?? '')
  const [notesBusy, setNotesBusy] = useState(false)
  const [notesErr, setNotesErr] = useState<string | null>(null)
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([])
  const [notesMigration, setNotesMigration] = useState(false)

  useEffect(() => {
    setTab(initialTab)
  }, [slot.id, initialTab])

  useEffect(() => {
    setTitle(slot.title)
    setTrack(slot.track ?? '')
    setRoom(slot.room ?? '')
    setDescription(slot.description ?? '')
    setLocationId(slot.locationId ?? '')
    setIsPublished(slot.isPublished)
    setVisibility(slot.visibility)
    setIsFrozen(slot.isFrozen)
    setPhotoPolicy(slot.photoPolicy)
    setOrganizerNotes(slot.organizerNotesInternal ?? '')
  }, [slot])

  const loadChangeLog = useCallback(async () => {
    try {
      const [notifyRes, auditRes] = await Promise.all([
        organizerDancecardFetch<{ entries: ChangeLogEntry[] }>(
          eventSlug,
          `/program-slots/${slot.id}/change-log`,
        ),
        organizerDancecardFetch<{
          entries: Array<{ id: string; action: string; createdAt: string }>
        }>(eventSlug, `/program-slots/${slot.id}/audit`).catch(() => ({ entries: [] })),
      ])
      const merged: ChangeLogEntry[] = [
        ...(notifyRes.entries ?? []),
        ...(auditRes.entries ?? []).map((e) => ({
          id: e.id,
          createdAt: e.createdAt,
          summary: `Organizer ${e.action}`,
          status: 'audit',
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setChangeLog(merged)
      setNotesMigration(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('organizer_notes') || msg.includes('column')) setNotesMigration(true)
      setChangeLog([])
    }
  }, [eventSlug, slot.id])

  useEffect(() => {
    if (tab === 'notes') void loadChangeLog()
  }, [tab, loadChangeLog])

  async function saveNotes() {
    if (readOnly) return
    setNotesBusy(true)
    setNotesErr(null)
    try {
      await organizerDancecardFetch(eventSlug, `/program-slots/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ organizerNotesInternal: organizerNotes.trim() || null }),
      })
      await onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save notes'
      setNotesErr(msg.includes('organizer_notes') ? 'Database update required for activity notes.' : msg)
    } finally {
      setNotesBusy(false)
    }
  }

  const loadLocations = useCallback(async () => {
    setLocationsLoadErr(null)
    try {
      const res = await organizerDancecardFetch<{ locations: { id: string; name: string }[] }>(
        eventSlug,
        '/locations',
      )
      setLocations(res.locations ?? [])
    } catch (e) {
      setLocationsLoadErr(e instanceof Error ? e.message : 'Could not load locations')
      setLocations([])
    }
  }, [eventSlug])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  const loadPeopleForTab = useCallback(async () => {
    setPeopleLoadErr(null)
    try {
      const res = await organizerDancecardFetch<{ people: { id: string; sceneName: string }[] }>(
        eventSlug,
        '/people',
      )
      setPeopleList((res.people ?? []).map((p) => ({ id: p.id, sceneName: p.sceneName })))
    } catch (e) {
      setPeopleLoadErr(e instanceof Error ? e.message : 'Could not load people roster')
      setPeopleList([])
    }
  }, [eventSlug])

  const loadSlotAssignments = useCallback(async () => {
    try {
      const res = await organizerDancecardFetch<{
        assignments: {
          id: string
          personId: string
          sceneName: string
          role: string
          sortOrder: number
          isPublicOnSchedule: boolean
        }[]
      }>(eventSlug, `/program-slots/${slot.id}/people`)
      setAssignments(
        (res.assignments ?? []).map((a) => ({
          id: a.id,
          personId: a.personId,
          sceneName: a.sceneName,
          role: a.role,
          sortOrder: a.sortOrder,
          isPublicOnSchedule: a.isPublicOnSchedule,
        })),
      )
    } catch {
      setAssignments([])
    }
  }, [eventSlug, slot.id])

  useEffect(() => {
    if (tab !== 'people') return
    void loadPeopleForTab()
    void loadSlotAssignments()
  }, [tab, loadPeopleForTab, loadSlotAssignments])

  const saveAssignments = async () => {
    if (readOnly) return
    setPeopleBusy(true)
    setErr(null)
    try {
      const cleaned = assignments.filter((a) => a.personId)
      await organizerDancecardFetch(eventSlug, `/program-slots/${slot.id}/people`, {
        method: 'PUT',
        body: JSON.stringify({
          assignments: cleaned.map((a, i) => ({
            personId: a.personId,
            role: a.role,
            sortOrder: a.sortOrder ?? i,
            isPublicOnSchedule: a.isPublicOnSchedule,
          })),
        }),
      })
      await onSaved()
      await loadSlotAssignments()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save assignments')
    } finally {
      setPeopleBusy(false)
    }
  }

  const save = async () => {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{
        slot: ProgramSlotRow
        scheduleImpact?: ScheduleChangeImpactReport
      }>(eventSlug, `/program-slots/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(),
          track: track.trim() || null,
          room: room.trim() || null,
          description: description.trim() || null,
          locationId: locationId || null,
          isPublished,
          visibility,
          isFrozen,
          photoPolicy,
        }),
      })
      await onSaved()
      if (res.scheduleImpact?.scheduleChanged && onScheduleImpact) {
        onScheduleImpact(res.scheduleImpact)
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'edit', label: 'Edit' },
    { key: 'privacy', label: 'Visibility' },
    { key: 'location', label: 'Location' },
    { key: 'people', label: 'People' },
    { key: 'registrants', label: 'Registrants' },
    { key: 'notes', label: 'Notes / audit' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex justify-end p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-dc-surface/80"
        aria-label="Close activity panel"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-full w-full max-w-lg flex-col rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="dc-session-drawer-title"
      >
        <div className="flex items-start justify-between gap-2 border-b border-dc-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-dc-muted">Activity</p>
            <h2 id="dc-session-drawer-title" className="truncate font-serif text-lg text-dc-text">
              {slot.title}
            </h2>
            <p className="mt-1 text-xs text-dc-muted">
              {slot.startsAt && slot.endsAt
                ? `${formatInTimeZone(new Date(slot.startsAt), timezone, 'EEE MMM d · h:mm a')} – ${formatInTimeZone(new Date(slot.endsAt), timezone, 'h:mm a')}`
                : 'Unscheduled. Drag onto the program grid to set a time'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {onCopySessionLink ? (
              <button
                type="button"
                className="rounded-full border border-dc-accent-border px-3 py-1 text-xs text-dc-accent-foreground hover:bg-dc-accent-muted"
                onClick={onCopySessionLink}
              >
                Copy link
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-muted hover:bg-white/5"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-dc-border px-2 py-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? 'shrink-0 rounded-full bg-dc-accent-muted px-3 py-1.5 text-xs font-medium text-dc-accent-foreground ring-1 ring-dc-accent-border'
                  : 'shrink-0 rounded-full border border-transparent px-3 py-1.5 text-xs text-dc-muted hover:bg-white/5'
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm text-dc-text">
          {tab === 'overview' ? (
            <div className="space-y-3">
              <p>
                <span className="text-dc-muted">Track: </span>
                {slot.trackName ?? slot.track ?? '-'}
              </p>
              <p>
                <span className="text-dc-muted">Room: </span>
                {slot.locationName ?? slot.room ?? '-'}
              </p>
              <p>
                <span className="text-dc-muted">Published: </span>
                {slot.isPublished ? 'yes' : 'no'}
              </p>
              <p>
                <span className="text-dc-muted">Visibility: </span>
                {slot.visibility}
              </p>
              <p>
                <span className="text-dc-muted">Photo policy: </span>
                {slot.photoPolicy}
              </p>
              <p>
                <span className="text-dc-muted">Frozen for attendees: </span>
                {slot.isFrozen ? 'yes' : 'no'}
              </p>
              {slot.tagNames.length ? (
                <div>
                  <span className="text-dc-muted">Tags: </span>
                  {slot.tagNames.join(', ')}
                </div>
              ) : null}
              {slot.description ? (
                <div className="rounded-lg border border-dc-border bg-dc-surface-muted p-3 text-dc-muted">{slot.description}</div>
              ) : (
                <p className="text-dc-muted">No description.</p>
              )}
            </div>
          ) : null}

          {tab === 'privacy' ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-muted">
                Attendees see:{' '}
                <span className="font-semibold text-dc-text">
                  {visibility === 'public' && isPublished ? `Public · ${photoPolicy}` : visibility}
                </span>
              </p>
              <label className="block text-xs uppercase text-dc-muted">
                Photo policy
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={photoPolicy}
                  disabled={readOnly}
                  onChange={(e) => setPhotoPolicy(e.target.value as ProgramSlotRow['photoPolicy'])}
                >
                  <option value="allowed">allowed</option>
                  <option value="restricted">restricted</option>
                  <option value="none">none</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-dc-muted">
                <input type="checkbox" checked={isPublished} disabled={readOnly} onChange={(e) => setIsPublished(e.target.checked)} />
                Published
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Visibility
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={visibility}
                  disabled={readOnly}
                  onChange={(e) => setVisibility(e.target.value as ProgramSlotRow['visibility'])}
                >
                  <option value="public">public</option>
                  <option value="staff_only">staff_only</option>
                  <option value="secret">secret</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-dc-muted">
                <input type="checkbox" checked={isFrozen} disabled={readOnly} onChange={(e) => setIsFrozen(e.target.checked)} />
                Frozen on dancecards
              </label>
            </div>
          ) : null}

          {tab === 'edit' ? (
            <div className="space-y-3">
              <label className="block text-xs uppercase text-dc-muted">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={title}
                  disabled={readOnly}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Track (legacy text)
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={track}
                  disabled={readOnly}
                  onChange={(e) => setTrack(e.target.value)}
                />
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Description
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={description}
                  disabled={readOnly}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          {tab === 'location' ? (
            <div className="space-y-3">
              {locationsLoadErr ? <p className="text-sm text-red-700">{locationsLoadErr}</p> : null}
              <label className="block text-xs uppercase text-dc-muted">
                Linked location
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={locationId}
                  disabled={readOnly}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">None</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs uppercase text-dc-muted">
                Room label (free text)
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-dc-text"
                  value={room}
                  disabled={readOnly}
                  onChange={(e) => setRoom(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          {tab === 'people' ? (
            <div className="space-y-3">
              {peopleLoadErr ? <p className="text-sm text-red-700">{peopleLoadErr}</p> : null}
              <p className="text-xs text-dc-muted">
                Assign people to this activity. Only assignments marked public appear on the attendee schedule (when the
                slot is published and visible).
              </p>
              {readOnly ? (
                <p className="text-sm text-amber-900/90">Read-only: viewer role cannot change assignments.</p>
              ) : null}
              {assignments.map((row, idx) => (
                <div key={`${row.personId}-${idx}`} className="rounded-lg border border-dc-border bg-dc-elevated-muted p-3 space-y-2">
                  <label className="block text-[10px] uppercase text-dc-muted">
                    Person
                    <select
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                      disabled={readOnly}
                      value={row.personId}
                      onChange={(e) => {
                        const pid = e.target.value
                        const name = peopleList.find((p) => p.id === pid)?.sceneName ?? ''
                        setAssignments((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, personId: pid, sceneName: name } : r)),
                        )
                      }}
                    >
                      <option value="">Select one</option>
                      {peopleList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sceneName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[10px] uppercase text-dc-muted">
                    Role
                    <select
                      className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                      disabled={readOnly}
                      value={row.role}
                      onChange={(e) =>
                        setAssignments((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, role: e.target.value } : r)),
                        )
                      }
                    >
                      {SLOT_ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-dc-muted">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={row.isPublicOnSchedule}
                      onChange={(e) =>
                        setAssignments((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, isPublicOnSchedule: e.target.checked } : r)),
                        )
                      }
                    />
                    Show on public schedule
                  </label>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      onClick={() => setAssignments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove row
                    </button>
                  ) : null}
                </div>
              ))}
              {!readOnly ? (
                <button
                  type="button"
                  className="w-full rounded-lg border border-dashed border-dc-border py-2 text-xs text-dc-muted hover:bg-white/5"
                  onClick={() =>
                    setAssignments((prev) => [
                      ...prev,
                      {
                        personId: '',
                        sceneName: '',
                        role: 'lead_presenter',
                        sortOrder: prev.length,
                        isPublicOnSchedule: true,
                      },
                    ])
                  }
                >
                  + Add assignment
                </button>
              ) : null}
            </div>
          ) : null}

          {tab === 'registrants' ? (
            <p className="text-dc-muted text-sm">
              Event-level registrant roster lives under the organizer <strong>Registrants</strong> tab. Per-activity
              registrant views can extend here later.
            </p>
          ) : null}

          {tab === 'notes' ? (
            <div className="space-y-4 text-dc-muted">
              <p className="text-xs text-dc-muted">
                Last updated:{' '}
                {slot.updatedAt ? formatInTimeZone(new Date(slot.updatedAt), timezone, 'yyyy-MM-dd HH:mm') : '-'}
              </p>
              {notesMigration ? (
                <p className="text-xs text-amber-800">
                  Session notes are not available until your event setup is finished. Contact your platform
                  administrator, then refresh.
                </p>
              ) : null}
              <label className="block text-xs uppercase tracking-wide text-dc-muted">
                Organizer notes (staff-only)
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={organizerNotes}
                  disabled={readOnly}
                  onChange={(e) => setOrganizerNotes(e.target.value)}
                />
              </label>
              {notesErr ? <p className="text-xs text-red-700">{notesErr}</p> : null}
              {!readOnly ? (
                <button
                  type="button"
                  disabled={notesBusy}
                  className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
                  onClick={() => void saveNotes()}
                >
                  {notesBusy ? 'Saving…' : 'Save notes'}
                </button>
              ) : null}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Schedule change log</p>
                {changeLog.length ? (
                  <ul className="mt-2 space-y-2 text-xs">
                    {changeLog.map((e) => (
                      <li key={e.id} className="rounded-lg border border-dc-border bg-dc-elevated-muted px-2 py-1.5">
                        <span className="text-dc-muted">
                          {formatInTimeZone(new Date(e.createdAt), timezone, 'MMM d HH:mm')}
                        </span>
                        <span className="ml-2 text-dc-text">{String(e.summary ?? e.status)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-dc-muted">No attendee notifications tied to this activity yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {tab === 'edit' || tab === 'location' || tab === 'privacy' ? (
          <div className="border-t border-dc-border px-4 py-3">
            {err ? <p className="mb-2 text-xs text-red-700">{err}</p> : null}
            <button
              type="button"
              disabled={readOnly || busy}
              className="w-full rounded-full bg-dc-accent py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null}
        {tab === 'people' && !readOnly ? (
          <div className="border-t border-dc-border px-4 py-3">
            {err ? <p className="mb-2 text-xs text-red-700">{err}</p> : null}
            <button
              type="button"
              disabled={peopleBusy}
              className="w-full rounded-full bg-dc-accent py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
              onClick={() => void saveAssignments()}
            >
              {peopleBusy ? 'Saving…' : 'Save assignments'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
