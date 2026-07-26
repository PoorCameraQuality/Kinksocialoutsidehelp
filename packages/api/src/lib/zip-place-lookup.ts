import { formatPlaceDisplayName, formatPlaceLocationLabel } from '@c2k/shared'
import { and, desc, eq, gte, ilike, like, lte, not } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { haversineDistanceMi } from './geo-distance.js'
import { geocodePlaceInState, persistPlaceCoordinates } from './place-geocode.js'

const GEOCODE_POOL = 16

function normalizeCountyName(name: string): string {
  return name.replace(/\s+county$/i, '').trim().toLowerCase()
}

async function fetchCountyName(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates')
    url.searchParams.set('x', String(lng))
    url.searchParams.set('y', String(lat))
    url.searchParams.set('benchmark', 'Public_AR_Current')
    url.searchParams.set('vintage', 'Current_Current')
    url.searchParams.set('format', 'json')
    const res = await fetch(url)
    if (!res.ok) return null
    const payload = (await res.json()) as {
      result?: { geographies?: { Counties?: { BASENAME?: string }[] } }
    }
    const county = payload.result?.geographies?.Counties?.[0]?.BASENAME
    return typeof county === 'string' ? county : null
  } catch {
    return null
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = []
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = items[index]
      index += 1
      const value = await fn(current)
      if (value) results.push(value)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

async function findNearestCensusPlace(
  candidates: { id: string; name: string; lat: number | null; lng: number | null }[],
  stateName: string,
  lat: number,
  lng: number
): Promise<{ id: string; name: string; distanceMi: number } | null> {
  const countyName = await fetchCountyName(lat, lng)
  const targetCounty = countyName ? normalizeCountyName(countyName) : null

  const scored = await mapWithConcurrency(candidates, GEOCODE_POOL, async (place) => {
    let coords: { lat: number; lng: number } | null =
      place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
    let admin2: string | null = null

    if (!coords) {
      const geocoded = await geocodePlaceInState(place.name, stateName)
      if (!geocoded) return null
      coords = { lat: geocoded.lat, lng: geocoded.lng }
      admin2 = geocoded.admin2
      await persistPlaceCoordinates(place.id, coords)
    } else if (targetCounty) {
      const geocoded = await geocodePlaceInState(place.name, stateName)
      admin2 = geocoded?.admin2 ?? null
    }

    const distanceMi = haversineDistanceMi(lat, lng, coords.lat, coords.lng)
    const inCounty =
      targetCounty != null &&
      admin2 != null &&
      normalizeCountyName(admin2) === targetCounty

    return { id: place.id, name: place.name, distanceMi, inCounty }
  })

  if (scored.length === 0) return null

  const countyMatches = targetCounty ? scored.filter((row) => row.inCounty) : []
  const pool = countyMatches.length > 0 ? countyMatches : scored
  pool.sort((a, b) => a.distanceMi - b.distanceMi)
  const best = pool[0]
  if (!best) return null

  return {
    id: best.id,
    name: best.name,
    distanceMi: best.distanceMi,
  }
}

type ZippopotamPlace = {
  'place name': string
  longitude: string
  latitude: string
  state: string
  'state abbreviation': string
}

type ZippopotamResponse = {
  'post code': string
  country: string
  'country abbreviation': string
  places: ZippopotamPlace[]
}

export type ZipPlaceCandidate = {
  placeId: string
  display: string
  population: number
  distanceMi: number | null
  /** Closest match to the ZIP locality name or coordinates. */
  isZipMatch: boolean
}

export type ZipPlaceResult = {
  zip: string
  placeId: string
  stateId: string
  stateName: string
  display: string
  lat: number | null
  lng: number | null
  countryName: string
  /** Exact census place name match vs nearest census place by coordinates. */
  matchType: 'exact' | 'nearest'
  /** Locality name from the ZIP lookup when matchType is nearest. */
  zipLocality?: string
  distanceMi?: number
  /** Up to three populous places near the ZIP for user confirmation. */
  candidates: ZipPlaceCandidate[]
}

const NEARBY_RADIUS_MI = 45
const MAX_ZIP_CANDIDATES = 3

async function findPopulousNearbyCandidates(params: {
  stateId: string
  stateName: string
  lat: number
  lng: number
  primaryPlaceId: string
  zipLocality?: string
}): Promise<ZipPlaceCandidate[]> {
  const { stateId, stateName, lat, lng, primaryPlaceId, zipLocality } = params
  const latDelta = 0.55
  const lngDelta = 0.7

  const rows = await db
    .select({
      id: schema.places.id,
      name: schema.places.name,
      population: schema.places.population,
      plat: schema.places.lat,
      plng: schema.places.lng,
    })
    .from(schema.places)
    .where(
      and(
        eq(schema.places.stateId, stateId),
        censusPlaceOnly,
        gte(schema.places.lat, lat - latDelta),
        lte(schema.places.lat, lat + latDelta),
        gte(schema.places.lng, lng - lngDelta),
        lte(schema.places.lng, lng + lngDelta)
      )
    )
    .orderBy(desc(schema.places.population))
    .limit(60)

  const zipLocalityNorm = zipLocality ? normalizePlaceName(zipLocality) : null

  const scored = rows
    .map((row): ZipPlaceCandidate | null => {
      if (row.plat == null || row.plng == null) return null
      const distanceMi = haversineDistanceMi(lat, lng, row.plat, row.plng)
      if (distanceMi > NEARBY_RADIUS_MI) return null
      const isZipMatch =
        row.id === primaryPlaceId ||
        (zipLocalityNorm != null && normalizePlaceName(row.name) === zipLocalityNorm)
      return {
        placeId: row.id,
        display: formatPlaceLocationLabel(row.name, stateName),
        population: row.population,
        distanceMi: Math.round(distanceMi * 10) / 10,
        isZipMatch,
      }
    })
    .filter((row): row is ZipPlaceCandidate => row !== null)

  scored.sort((a, b) => {
    if (a.isZipMatch !== b.isZipMatch) return a.isZipMatch ? -1 : 1
    if (b.population !== a.population) return b.population - a.population
    return (a.distanceMi ?? 999) - (b.distanceMi ?? 999)
  })

  const picked: ZipPlaceCandidate[] = []
  const seen = new Set<string>()
  for (const row of scored) {
    if (seen.has(row.placeId)) continue
    seen.add(row.placeId)
    picked.push(row)
    if (picked.length >= MAX_ZIP_CANDIDATES) break
  }

  if (!seen.has(primaryPlaceId)) {
    const [primary] = await db
      .select({
        id: schema.places.id,
        name: schema.places.name,
        population: schema.places.population,
        plat: schema.places.lat,
        plng: schema.places.lng,
      })
      .from(schema.places)
      .where(eq(schema.places.id, primaryPlaceId))
      .limit(1)
    if (primary) {
      const distanceMi =
        primary.plat != null && primary.plng != null
          ? Math.round(haversineDistanceMi(lat, lng, primary.plat, primary.plng) * 10) / 10
          : null
      picked.unshift({
        placeId: primary.id,
        display: formatPlaceLocationLabel(primary.name, stateName),
        population: primary.population,
        distanceMi,
        isZipMatch: true,
      })
    }
  }

  const unique: ZipPlaceCandidate[] = []
  const finalSeen = new Set<string>()
  for (const row of picked) {
    if (finalSeen.has(row.placeId)) continue
    finalSeen.add(row.placeId)
    unique.push(row)
    if (unique.length >= MAX_ZIP_CANDIDATES) break
  }

  return unique
}

function attachCandidates(
  base: Omit<ZipPlaceResult, 'candidates' | 'stateName'>,
  stateName: string
): Promise<ZipPlaceResult> {
  if (base.lat == null || base.lng == null) {
    return Promise.resolve({
      ...base,
      stateName,
      candidates: [
        {
          placeId: base.placeId,
          display: base.display,
          population: 0,
          distanceMi: base.distanceMi ?? null,
          isZipMatch: true,
        },
      ],
    })
  }
  return findPopulousNearbyCandidates({
    stateId: base.stateId,
    stateName,
    lat: base.lat,
    lng: base.lng,
    primaryPlaceId: base.placeId,
    zipLocality: base.zipLocality,
  }).then((candidates) => ({
    ...base,
    stateName,
    candidates:
      candidates.length > 0
        ? candidates
        : [
            {
              placeId: base.placeId,
              display: base.display,
              population: 0,
              distanceMi: base.distanceMi ?? null,
              isZipMatch: true,
            },
          ],
  }))
}

function normalizePlaceName(name: string): string {
  return name.trim().toLowerCase()
}

/** Census-seeded places only - never match auto-created zip:* rows. */
const censusPlaceOnly = not(like(schema.places.geoid, 'zip:%'))

export async function resolveZipPlace(zipRaw: string): Promise<ZipPlaceResult | null> {
  const zip = zipRaw.trim().replace(/\D/g, '').slice(0, 5)
  if (zip.length !== 5) return null

  const [cached] = await db
    .select({
      zip: schema.placeZips.zip,
      placeId: schema.placeZips.placeId,
      lat: schema.placeZips.lat,
      lng: schema.placeZips.lng,
      placeName: schema.places.name,
      placeGeoid: schema.places.geoid,
      stateId: schema.places.stateId,
      stateName: schema.states.name,
      countryName: schema.countries.name,
    })
    .from(schema.placeZips)
    .innerJoin(schema.places, eq(schema.placeZips.placeId, schema.places.id))
    .innerJoin(schema.states, eq(schema.places.stateId, schema.states.id))
    .innerJoin(schema.countries, eq(schema.states.countryId, schema.countries.id))
    .where(eq(schema.placeZips.zip, zip))
    .limit(1)

  if (cached && !cached.placeGeoid.startsWith('zip:')) {
    return attachCandidates(
      {
        zip: cached.zip,
        placeId: cached.placeId,
        stateId: cached.stateId,
        display: formatPlaceLocationLabel(cached.placeName, cached.stateName),
        lat: cached.lat,
        lng: cached.lng,
        countryName: cached.countryName,
        matchType: 'exact',
      },
      cached.stateName
    )
  }

  let payload: ZippopotamResponse
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) return null
    payload = (await res.json()) as ZippopotamResponse
  } catch {
    return null
  }

  const first = payload.places?.[0]
  if (!first) return null

  const stateName = first.state.trim()
  const [stateRow] = await db
    .select({ id: schema.states.id, name: schema.states.name })
    .from(schema.states)
    .innerJoin(schema.countries, eq(schema.states.countryId, schema.countries.id))
    .where(and(eq(schema.countries.code, 'US'), ilike(schema.states.name, stateName)))
    .limit(1)

  if (!stateRow) return null

  const placeName = first['place name'].trim()
  const lat = Number.parseFloat(first.latitude)
  const lng = Number.parseFloat(first.longitude)
  const latVal = Number.isFinite(lat) ? lat : null
  const lngVal = Number.isFinite(lng) ? lng : null

  const candidates = await db
    .select({
      id: schema.places.id,
      name: schema.places.name,
      lat: schema.places.lat,
      lng: schema.places.lng,
    })
    .from(schema.places)
    .where(and(eq(schema.places.stateId, stateRow.id), censusPlaceOnly))

  let placeRow: { id: string; name: string } | undefined
  let matchType: ZipPlaceResult['matchType'] = 'exact'
  let distanceMi: number | undefined

  const [exactPlace] = await db
    .select({ id: schema.places.id, name: schema.places.name })
    .from(schema.places)
    .where(and(eq(schema.places.stateId, stateRow.id), ilike(schema.places.name, placeName), censusPlaceOnly))
    .limit(1)
  placeRow = exactPlace

  if (!placeRow) {
    const target = normalizePlaceName(placeName)
    placeRow =
      candidates.find((p) => normalizePlaceName(p.name) === target) ??
      candidates.find((p) => normalizePlaceName(p.name).startsWith(target)) ??
      candidates.find((p) => target.startsWith(normalizePlaceName(p.name))) ??
      undefined
  }

  if (!placeRow) {
    if (latVal == null || lngVal == null) return null
    const nearest = await findNearestCensusPlace(candidates, stateRow.name, latVal, lngVal)
    if (!nearest) return null
    placeRow = { id: nearest.id, name: nearest.name }
    matchType = 'nearest'
    distanceMi = Math.round(nearest.distanceMi * 10) / 10
  }

  if (!placeRow) return null

  await db
    .insert(schema.placeZips)
    .values({
      zip,
      placeId: placeRow.id,
      lat: latVal,
      lng: lngVal,
    })
    .onConflictDoUpdate({
      target: schema.placeZips.zip,
      set: { placeId: placeRow.id, lat: latVal, lng: lngVal },
    })

  const [countryRow] = await db
    .select({ name: schema.countries.name })
    .from(schema.countries)
    .innerJoin(schema.states, eq(schema.states.countryId, schema.countries.id))
    .where(eq(schema.states.id, stateRow.id))
    .limit(1)

  return attachCandidates(
    {
      zip,
      placeId: placeRow.id,
      stateId: stateRow.id,
      display: formatPlaceLocationLabel(placeRow.name, stateRow.name),
      lat: latVal,
      lng: lngVal,
      countryName: countryRow?.name ?? payload.country,
      matchType,
      ...(matchType === 'nearest' ? { zipLocality: placeName, distanceMi } : { zipLocality: placeName }),
    },
    stateRow.name
  )
}
