'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { VenueMapCanvas, type VenueMapPin } from '@/components/dancecard/organizer/venue/VenueMapCanvas'
import { Panel } from '@/components/dancecard/ui/Panel'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { supportCopy } from '@/lib/dancecard/supportCopy'

type MapRow = { id: string; title: string; imageUrl: string | null }

export function VenueMapAssignPanel({
  eventSlug,
  locationNames,
  readOnly,
  unassignedSlots,
  onDropSlot,
  onGoSetup,
  refreshToken = 0,
}: {
  eventSlug: string
  locationNames: Record<string, string>
  readOnly: boolean
  unassignedSlots: ProgramSlotRow[]
  onDropSlot: (slotId: string, locationId: string) => void | Promise<void>
  onGoSetup?: () => void
  refreshToken?: number
}) {
  const [maps, setMaps] = useState<MapRow[]>([])
  const [pins, setPins] = useState<VenueMapPin[]>([])
  const [activeMapId, setActiveMapId] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)

  const load = useCallback(async () => {
    setLoadErr(null)
    try {
      const mRes = await organizerDancecardFetch<{ maps: MapRow[]; needsMigration?: boolean }>(eventSlug, '/maps')
      if (mRes.needsMigration) {
        setNeedsMigration(true)
        setMaps([])
        return
      }
      const list = mRes.maps ?? []
      setMaps(list)
      const mapId = list[0]?.id ?? null
      setActiveMapId((prev) => (prev && list.some((m) => m.id === prev) ? prev : mapId))
      if (mapId) {
        const pRes = await organizerDancecardFetch<{ pins: VenueMapPin[] }>(eventSlug, `/maps/${mapId}/pins`)
        setPins(pRes.pins ?? [])
      } else {
        setPins([])
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load map')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  useEffect(() => {
    if (!activeMapId) {
      setPins([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const pRes = await organizerDancecardFetch<{ pins: VenueMapPin[] }>(eventSlug, `/maps/${activeMapId}/pins`)
        if (!cancelled) setPins(pRes.pins ?? [])
      } catch {
        if (!cancelled) setPins([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeMapId, eventSlug, refreshToken])

  const activeMap = useMemo(() => maps.find((m) => m.id === activeMapId) ?? maps[0], [maps, activeMapId])

  const pinsWithCoords = useMemo(
    () => pins.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [pins],
  )

  if (needsMigration) {
    return (
      <Panel variant="muted" className="text-sm text-dc-muted">
        {supportCopy.floorPlansNotReady}
      </Panel>
    )
  }

  if (!maps.length) {
    return (
      <Panel variant="muted" className="space-y-2 text-sm text-dc-muted">
        <p>No floor plan uploaded yet.</p>
        {onGoSetup ? (
          <button type="button" className="text-dc-accent hover:underline" onClick={onGoSetup}>
            Upload a map and place room pins
          </button>
        ) : (
          <a className="text-dc-accent hover:underline" href="?tab=venues&venuesPanel=setup">
            Upload a map and place room pins
          </a>
        )}
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg text-dc-text">Floor plan</h3>
        <p className="mt-1 text-xs text-dc-muted">
          Drag classes onto a room pin, or use the time grid. Edit pins under Rooms & floor plan.
        </p>
      </div>

      {loadErr ? <p className="text-sm text-dc-danger">{loadErr}</p> : null}

      {maps.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {maps.map((m) => (
            <button
              key={m.id}
              type="button"
              className={
                activeMap?.id === m.id
                  ? 'rounded-full border border-dc-accent-border bg-dc-accent-muted px-3 py-1 text-xs font-medium text-dc-accent'
                  : 'rounded-full border border-dc-border px-3 py-1 text-xs text-dc-muted hover:border-dc-accent-border/50'
              }
              onClick={() => setActiveMapId(m.id)}
            >
              {m.title}
            </button>
          ))}
        </div>
      ) : null}

      {unassignedSlots.length > 0 ? (
        <Panel className="border-dc-warning/30 bg-dc-warning-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-warning">No room yet</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unassignedSlots.map((s) => (
              <li key={s.id}>
                <div
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/slot-id', s.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="cursor-grab rounded-lg border border-dc-border bg-dc-elevated px-2 py-1 text-xs text-dc-text active:cursor-grabbing"
                  title={s.title}
                >
                  {s.title}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {activeMap?.imageUrl ? (
        pinsWithCoords.length > 0 ? (
          <VenueMapCanvas
            imageUrl={activeMap.imageUrl}
            alt={activeMap.title}
            pins={pinsWithCoords}
            locationNames={locationNames}
            readOnly={readOnly}
            mode="drop"
            onDropOnLocation={(locationId, slotId) => void onDropSlot(slotId, locationId)}
          />
        ) : (
          <Panel variant="muted" className="text-sm text-dc-muted">
            <p>This map has no room pins yet.</p>
            {onGoSetup ? (
              <button type="button" className="mt-2 text-dc-accent hover:underline" onClick={onGoSetup}>
                Place pins on the floor plan
              </button>
            ) : null}
          </Panel>
        )
      ) : (
        <Panel variant="muted" className="text-sm text-dc-muted">
          Map image unavailable. Re-upload the floor plan.
        </Panel>
      )}
    </div>
  )
}
