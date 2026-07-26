'use client'

import { useCallback, useEffect, useState } from 'react'
import { VenueMapViewport } from '@/components/dancecard/venue/VenueMapViewport'

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
}

export default function VenueMapsList({ conventionKey }: Props) {
  const [maps, setMaps] = useState<MapRow[]>([])
  const [pinsByMap, setPinsByMap] = useState<Record<string, PinRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/conventions/${encodeURIComponent(conventionKey)}/maps`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setMaps([])
        setError('Could not load venue maps.')
        return
      }
      const d = (await r.json()) as { maps: MapRow[] }
      const list = d.maps ?? []
      setMaps(list)
      const pinEntries: Record<string, PinRow[]> = {}
      await Promise.all(
        list.map(async (m) => {
          const pr = await fetch(
            `/api/v1/conventions/${encodeURIComponent(conventionKey)}/maps/${encodeURIComponent(m.id)}/pins`,
            { credentials: 'include' },
          )
          if (pr.ok) {
            const pd = (await pr.json()) as { pins: PinRow[] }
            pinEntries[m.id] = pd.pins ?? []
          }
        }),
      )
      setPinsByMap(pinEntries)
    } catch {
      setMaps([])
      setError('Network error loading maps.')
    } finally {
      setLoading(false)
    }
  }, [conventionKey])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="text-sm text-dc-muted">Loading venue maps…</p>
  if (error) return <p className="text-sm text-red-300">{error}</p>
  if (maps.length === 0) return <p className="text-sm text-dc-muted">No venue maps published yet.</p>

  return (
    <div className="space-y-8">
      {maps.map((m) => (
        <section key={m.id} className="space-y-2">
          <h3 className="text-base font-semibold text-dc-text">{m.title}</h3>
          {m.imageUrl ?
            <VenueMapViewport>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.imageUrl} alt={m.title} className="block w-full h-auto" />
                {(pinsByMap[m.id] ?? []).map((pin) => (
                  <span
                    key={`${pin.locationId}-${pin.x}-${pin.y}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/80 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-dc-text pointer-events-none"
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
