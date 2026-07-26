'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { collectDescendantIds, type LocationParentRow } from '@/lib/dancecard/locationHierarchyHelpers'
import type { OrganizerLocationDto } from '@/lib/dancecard/organizerLocationDto'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'

function depthOf(loc: OrganizerLocationDto, byId: Map<string, OrganizerLocationDto>): number {
  let d = 0
  let p: string | null = loc.parentId
  const seen = new Set<string>()
  while (p) {
    d++
    if (seen.has(p)) break
    seen.add(p)
    const next = byId.get(p)
    if (!next) break
    p = next.parentId
  }
  return d
}

function sortForDisplay(locs: OrganizerLocationDto[]): OrganizerLocationDto[] {
  const byId = new Map(locs.map((l) => [l.id, l]))
  return [...locs].sort((a, b) => {
    const da = depthOf(a, byId)
    const db = depthOf(b, byId)
    if (da !== db) return da - db
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name)
  })
}

export function LocationsSettingsSection({
  eventSlug,
  canEdit,
  embedded = false,
  variant = 'full',
  onChanged,
}: {
  eventSlug: string
  canEdit: boolean
  /** When true (e.g. setup wizard), avoid nested scroll regions and extra chrome. */
  embedded?: boolean
  /** Compact table layout for the Venues tab (no nested scroll). */
  variant?: 'full' | 'compact'
  onChanged?: () => void
}) {
  const [locations, setLocations] = useState<OrganizerLocationDto[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { ask, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    setMsg(null)
    try {
      const res = await organizerDancecardFetch<{ locations: OrganizerLocationDto[] }>(eventSlug, '/locations')
      setLocations(res.locations ?? [])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not load locations')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  const parentRows = useMemo((): LocationParentRow[] => {
    return locations.map((l) => ({ id: l.id, parentId: l.parentId }))
  }, [locations])

  const sorted = useMemo(() => sortForDisplay(locations), [locations])
  const byIdMap = useMemo(() => new Map(locations.map((x) => [x.id, x])), [locations])

  async function addLocation() {
    if (!canEdit || !newName.trim()) return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, '/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          parentId: newParentId || undefined,
        }),
      })
      setNewName('')
      setNewParentId('')
      await load()
      onChanged?.()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function patchLocation(id: string, patch: Record<string, unknown>) {
    if (!canEdit) return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, `/locations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      await load()
      onChanged?.()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function delLocation(id: string) {
    if (!canEdit) return
    if (
      !(await ask({
        title: 'Delete location?',
        message: 'Delete this location? Slots referencing it will clear location_id.',
        destructive: true,
      }))
    )
      return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, `/locations/${id}`, { method: 'DELETE' })
      await load()
      onChanged?.()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  function parentOptions(forId: string) {
    const excluded = collectDescendantIds(parentRows, forId)
    return sorted.filter((l) => !excluded.has(l.id))
  }

  const rootClass =
    variant === 'compact' ? 'space-y-4 p-4'
    : embedded ? 'space-y-4'
    : 'rounded-xl border border-dc-border bg-dc-surface-muted p-4'
  const listClass =
    variant === 'compact' ? 'mt-4 space-y-2'
    : embedded ? 'mt-4 space-y-3'
    : 'mt-4 max-h-[480px] space-y-3 overflow-y-auto pr-1'

  if (variant === 'compact') {
    return (
      <div className={rootClass}>
        {dialog}
        <div>
          <h3 className="font-serif text-lg text-dc-text">Rooms</h3>
          <p className="mt-1 text-xs text-dc-muted">
            Named rooms appear on the program grid, floor plan, and attendee map.
          </p>
        </div>
        {msg ? <p className="text-sm text-amber-800">{msg}</p> : null}

        <div className="flex flex-wrap items-end gap-2 border-b border-dc-border pb-4">
          <label className="text-xs uppercase tracking-wide text-dc-muted">
            New room
            <input
              className="mt-1 block min-w-[180px] rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
              value={newName}
              disabled={!canEdit}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Main hall"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) void addLocation()
              }}
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-dc-muted">
            Parent
            <select
              className="mt-1 block min-w-[140px] rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
              value={newParentId}
              disabled={!canEdit}
              onChange={(e) => setNewParentId(e.target.value)}
            >
              <option value="">, None -</option>
              {sorted.map((l) => (
                <option key={l.id} value={l.id}>
                  {`${', '.repeat(depthOf(l, byIdMap))}${l.name}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!canEdit || !newName.trim()}
            className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
            onClick={() => void addLocation()}
          >
            Add room
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-dc-muted">No rooms yet. Add your first room above.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-dc-border">
            <table className="min-w-full text-left text-sm text-dc-text">
              <thead className="border-b border-dc-border bg-dc-elevated-muted text-[10px] uppercase tracking-wide text-dc-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Parent</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Capacity</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((loc) => (
                  <Fragment key={loc.id}>
                    <tr className="border-b border-dc-border/60">
                      <td className="px-3 py-2">
                        <input
                          className="w-full min-w-[120px] rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm"
                          defaultValue={loc.name}
                          disabled={!canEdit}
                          key={`${loc.id}-compact-name`}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v && v !== loc.name) void patchLocation(loc.id, { name: v })
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full min-w-[120px] rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs"
                          value={loc.parentId ?? ''}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const v = e.target.value || null
                            void patchLocation(loc.id, { parentId: v })
                          }}
                        >
                          <option value="">, None -</option>
                          {parentOptions(loc.id).map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full min-w-[88px] rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs"
                          defaultValue={loc.kind ?? ''}
                          disabled={!canEdit}
                          placeholder="room"
                          key={`${loc.id}-compact-kind`}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null
                            if (v !== (loc.kind ?? null)) void patchLocation(loc.id, { kind: v })
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-20 rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs"
                          defaultValue={loc.capacity ?? ''}
                          disabled={!canEdit}
                          key={`${loc.id}-compact-cap`}
                          onBlur={(e) => {
                            const v = e.target.value === '' ? null : Number(e.target.value)
                            if (v !== loc.capacity && (v === null || Number.isFinite(v)))
                              void patchLocation(loc.id, { capacity: v })
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs text-dc-accent hover:underline"
                            onClick={() => setExpandedId((id) => (id === loc.id ? null : loc.id))}
                          >
                            {expandedId === loc.id ? 'Hide details' : 'Details'}
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            className="text-xs text-red-700 hover:underline disabled:opacity-40"
                            onClick={() => void delLocation(loc.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === loc.id ? (
                      <tr className="border-b border-dc-border/60 bg-dc-elevated-muted/40">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                              Public directions
                              <textarea
                                className="mt-1 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs"
                                rows={2}
                                defaultValue={loc.directionsPublic ?? ''}
                                disabled={!canEdit}
                                key={`${loc.id}-compact-dir`}
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || null
                                  if (v !== (loc.directionsPublic ?? null))
                                    void patchLocation(loc.id, { directionsPublic: v })
                                }}
                              />
                            </label>
                            <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                              Internal notes
                              <textarea
                                className="mt-1 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs"
                                rows={2}
                                defaultValue={loc.internalNotes ?? ''}
                                disabled={!canEdit}
                                key={`${loc.id}-compact-int`}
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || null
                                  if (v !== (loc.internalNotes ?? null))
                                    void patchLocation(loc.id, { internalNotes: v })
                                }}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={rootClass}>
      {dialog}
      {!embedded ? (
        <>
          <h3 className="font-serif text-lg text-dc-text">Locations and venues</h3>
          <p className="mt-1 text-xs text-dc-muted">
            Hierarchical rooms and areas (hotel floors, halls, outdoor). Public directions stay off internal notes on
            attendee surfaces.
          </p>
        </>
      ) : (
        <p className="text-sm text-dc-muted">
          Add rooms and areas for the schedule. You can add more detail later in Settings.
        </p>
      )}
      {msg ? <p className="mt-2 text-sm text-amber-800">{msg}</p> : null}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-b border-dc-border pb-4">
        <label className="text-xs uppercase tracking-wide text-dc-muted">
          New location name
          <input
            className="mt-1 block min-w-[200px] rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
            value={newName}
            disabled={!canEdit}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Main hall"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-dc-muted">
          Parent (optional)
          <select
            className="mt-1 block min-w-[160px] rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
            value={newParentId}
            disabled={!canEdit}
            onChange={(e) => setNewParentId(e.target.value)}
          >
            <option value="">, None -</option>
            {sorted.map((l) => (
              <option key={l.id} value={l.id}>
                {`${', '.repeat(depthOf(l, byIdMap))}${l.name}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!canEdit}
          className="rounded-full border border-dc-accent-border px-3 py-1.5 text-sm text-dc-accent-foreground hover:bg-dc-accent-muted disabled:opacity-40"
          onClick={() => void addLocation()}
        >
          Add location
        </button>
      </div>

      <ul className={listClass}>
        {sorted.map((loc) => {
          const indent = depthOf(loc, byIdMap)
          return (
            <li
              key={loc.id}
              className="rounded-lg border border-dc-border bg-dc-elevated-muted p-3"
              style={{ marginLeft: Math.min(indent, 6) * 12 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Name
                    <input
                      className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"
                      defaultValue={loc.name}
                      disabled={!canEdit}
                      key={`${loc.id}-name`}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== loc.name) void patchLocation(loc.id, { name: v })
                      }}
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                      Parent
                      <select
                        className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                        value={loc.parentId ?? ''}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const v = e.target.value || null
                          void patchLocation(loc.id, { parentId: v })
                        }}
                      >
                        <option value="">, None -</option>
                        {parentOptions(loc.id).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                      Kind
                      <input
                        className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                        defaultValue={loc.kind ?? ''}
                        disabled={!canEdit}
                        key={`${loc.id}-kind`}
                        placeholder="room, floor, outdoor…"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null
                          if (v !== (loc.kind ?? null)) void patchLocation(loc.id, { kind: v })
                        }}
                      />
                    </label>
                    <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                      Capacity
                      <input
                        type="number"
                        className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                        defaultValue={loc.capacity ?? ''}
                        disabled={!canEdit}
                        key={`${loc.id}-cap`}
                        onBlur={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value)
                          if (v !== loc.capacity && (v === null || Number.isFinite(v)))
                            void patchLocation(loc.id, { capacity: v })
                        }}
                      />
                    </label>
                    <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                      Sort order
                      <input
                        type="number"
                        className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                        defaultValue={loc.sortOrder}
                        disabled={!canEdit}
                        key={`${loc.id}-sort`}
                        onBlur={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v) && v !== loc.sortOrder) void patchLocation(loc.id, { sortOrder: v })
                        }}
                      />
                    </label>
                  </div>
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Public directions
                    <textarea
                      className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                      rows={2}
                      defaultValue={loc.directionsPublic ?? ''}
                      disabled={!canEdit}
                      key={`${loc.id}-dir`}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null
                        if (v !== (loc.directionsPublic ?? null)) void patchLocation(loc.id, { directionsPublic: v })
                      }}
                    />
                  </label>
                  {!embedded ? (
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Accessibility notes (organizer + public policy; review before exposing)
                    <textarea
                      className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                      rows={2}
                      defaultValue={loc.accessibilityNotes ?? ''}
                      disabled={!canEdit}
                      key={`${loc.id}-acc`}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null
                        if (v !== (loc.accessibilityNotes ?? null))
                          void patchLocation(loc.id, { accessibilityNotes: v })
                      }}
                    />
                  </label>
                  ) : null}
                  {!embedded ? (
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Internal notes (organizer only)
                    <textarea
                      className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                      rows={2}
                      defaultValue={loc.internalNotes ?? ''}
                      disabled={!canEdit}
                      key={`${loc.id}-int`}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null
                        if (v !== (loc.internalNotes ?? null)) void patchLocation(loc.id, { internalNotes: v })
                      }}
                    />
                  </label>
                  ) : null}
                  {!embedded ? (
                  <label className="block text-[10px] uppercase tracking-wide text-dc-muted">
                    Legacy notes
                    <textarea
                      className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
                      rows={2}
                      defaultValue={loc.notes ?? ''}
                      disabled={!canEdit}
                      key={`${loc.id}-notes`}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null
                        if (v !== (loc.notes ?? null)) void patchLocation(loc.id, { notes: v })
                      }}
                    />
                  </label>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  className="shrink-0 text-xs text-red-700 hover:underline disabled:opacity-40"
                  onClick={() => void delLocation(loc.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
