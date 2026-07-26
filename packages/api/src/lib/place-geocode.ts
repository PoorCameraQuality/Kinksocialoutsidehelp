import { formatPlaceDisplayName } from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

type OpenMeteoResult = {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  admin2?: string
}

type OpenMeteoResponse = {
  results?: OpenMeteoResult[]
}

function geocodeSearchName(placeName: string): string {
  return formatPlaceDisplayName(placeName)
}

function normalizeAdminName(name: string): string {
  return name.trim().toLowerCase()
}

export async function geocodePlaceInState(
  placeName: string,
  stateName: string
): Promise<{ lat: number; lng: number; admin2: string | null } | null> {
  const searchName = geocodeSearchName(placeName)
  if (!searchName) return null

  let payload: OpenMeteoResponse
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', searchName)
    url.searchParams.set('count', '10')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')
    const res = await fetch(url)
    if (!res.ok) return null
    payload = (await res.json()) as OpenMeteoResponse
  } catch {
    return null
  }

  const targetState = normalizeAdminName(stateName)
  const match =
    payload.results?.find((row) => normalizeAdminName(row.admin1 ?? '') === targetState) ??
    payload.results?.find((row) => normalizeAdminName(row.name) === normalizeAdminName(searchName))

  if (!match) return null
  return { lat: match.latitude, lng: match.longitude, admin2: match.admin2 ?? null }
}

export async function ensurePlaceCoordinates(
  place: { id: string; name: string; lat: number | null; lng: number | null },
  stateName: string
): Promise<{ lat: number; lng: number } | null> {
  if (place.lat != null && place.lng != null) {
    return { lat: place.lat, lng: place.lng }
  }

  const coords = await geocodePlaceInState(place.name, stateName)
  if (!coords) return null

  await persistPlaceCoordinates(place.id, { lat: coords.lat, lng: coords.lng })
  return { lat: coords.lat, lng: coords.lng }
}

export async function persistPlaceCoordinates(
  placeId: string,
  coords: { lat: number; lng: number }
): Promise<void> {
  await db
    .update(schema.places)
    .set({ lat: coords.lat, lng: coords.lng })
    .where(eq(schema.places.id, placeId))
}
