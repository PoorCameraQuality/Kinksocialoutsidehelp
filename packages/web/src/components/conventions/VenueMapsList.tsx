'use client'

import { useCallback, useEffect, useState } from 'react'
import { VenueMapViewport } from '@/components/dancecard/venue/VenueMapViewport'
import { dancecardApiBase, makeDancecardApiScope, type DancecardApiKind } from '@/lib/dancecard/dancecardApiScope'

type MapRow = {
  id: string
  title: string
  imageUrl: string | null
}

type PinRow = {
  locationId: string
  x: number
  y: number
  label: string | null
}

type Props = {
  conventionKey: string
  apiKind?: DancecardApiKind
}

export default function VenueMapsList({ conventionKey, apiKind = 'convention' }: Props) {
  const [maps, setMaps] = useState<MapRow[]>([])
  const [pinsByMap, setPinsByMap] = useState<Record<string, PinRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const scope = makeDancecardApiScope(apiKind, conventionKey)
    const apiBase = dancecardApiBase(scope)
    try {
      const r = await fetch(`${apiBase}/maps`, { credentials: 'include' })
      if (!r.ok) {
        setMaps([])
        setError('Could not load venue maps.')
        return
      }
      const d = (await r.json()) as { maps?: MapRow[]; items?: Array<{ id: string; label: string; imageUrl: string }> }
      const list: MapRow[] =
        d.maps ??
        (d.items ?? []).map((m) => ({
          id: m.id,
          title: m.label,
          imageUrl: m.imageUrl,
        }))
      setMaps(list)
      const pinEntries: Record<string, PinRow[]> = {}
      if (apiKind === 'convention') {
        await Promise.all(
          list.map(async (m) => {
            const pr = await fetch(`${apiBase}/maps/${encodeURIComponent(m.id)}/pins`, {
              credentials: 'include',
            })
            if (pr.ok) {
              const pd = (await pr.json()) as { pins: PinRow[] }
              pinEntries[m.id] = pd.pins ?? []
            }
          }),
        )
      }
      setPinsByMap(pinEntries)
    } catch {
      setMaps([])
      setError('Network error loading maps.')
    } finally {
      setLoading(false)
    }
  }, [conventionKey, apiKind])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="text-sm text-dc-muted">Loading venue maps…</p>
  if (error) return <p className="text-sm text-red-300">{error}</p>
  if (maps.length === 0) return <p className="text-sm text-dc-muted">No venue maps published yet.</p>

  return (
    <div className="space-y-6">
      {maps.map((m) => (
        <section key={m.id} className="space-y-2">
          {/* Hub already titles the section “Venue map” — only label when useful */}
          {maps.length > 1 || (m.title.trim() && m.title.trim().toLowerCase() !== 'venue map') ?
            <h3 className="text-base font-semibold text-dc-text">{m.title}</h3>
          : null}
          {m.imageUrl ?
            <VenueMapViewport className="w-full">
              <div className="relative w-full">
                <img
                  src={m.imageUrl}
                  alt={m.title}
                  draggable={false}
                  className="block h-auto w-full max-w-none select-none"
                />
                {(pinsByMap[m.id] ?? []).map((pin) => (
                  <span
                    key={`${pin.locationId}-${pin.x}-${pin.y}`}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/80 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-dc-text"
                    style={{
                      left: `${pin.x * 100}%`,
                      top: `${pin.y * 100}%`,
                    }}
                  >
                    {pin.label ?? 'Room'}
                  </span>
                ))}
              </div>
            </VenueMapViewport>
          : (
            <p className="text-sm text-dc-muted">Image unavailable.</p>
          )}
        </section>
      ))}
    </div>
  )
}
