import { formatPlaceLocationLabel } from '@c2k/shared'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type PlaceLabel = { placeId: string; label: string; lat: number | null; lng: number | null }

/** "City, ST" labels for place ids (US places + states). */
export async function loadPlaceLabels(placeIds: string[]): Promise<Map<string, PlaceLabel>> {
  const uniq = [...new Set(placeIds.filter(Boolean))]
  const out = new Map<string, PlaceLabel>()
  if (uniq.length === 0) return out

  const rows = await db
    .select({
      placeId: schema.places.id,
      placeName: schema.places.name,
      stateName: schema.states.name,
      lat: schema.places.lat,
      lng: schema.places.lng,
    })
    .from(schema.places)
    .innerJoin(schema.states, eq(schema.places.stateId, schema.states.id))
    .where(inArray(schema.places.id, uniq))

  for (const r of rows) {
    out.set(r.placeId, {
      placeId: r.placeId,
      label: formatPlaceLocationLabel(r.placeName, r.stateName),
      lat: r.lat,
      lng: r.lng,
    })
  }
  return out
}

export function mapGroupWithPlace<T extends { placeId?: string | null; serviceRadiusMi?: number | null }>(
  g: T,
  placeMap: Map<string, PlaceLabel>
) {
  const pid = g.placeId ?? null
  const pl = pid ? placeMap.get(pid) : undefined
  return {
    ...g,
    placeLabel: pl?.label ?? null,
    placeLat: pl?.lat ?? null,
    placeLng: pl?.lng ?? null,
    serviceRadiusMi: g.serviceRadiusMi ?? 50,
  }
}
