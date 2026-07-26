/**
 * Fetches US Census 2020 Decennial (P1_001N) place populations per state and writes
 * packages/api/data/places-seed.json for reproducible seeding (no runtime Census calls).
 *
 * Run: npx tsx scripts/build-places-data.ts
 * Requires network access to api.census.gov.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_POPULATION_THRESHOLD,
  MIN_PLACES_PER_STATE,
  US_STATES,
} from './us-states'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../data/places-seed.json')

type RawRow = [string, string, string, string] // NAME, P1_001N, state, place

function parsePlaceName(censusName: string): string {
  const i = censusName.indexOf(',')
  return (i === -1 ? censusName : censusName.slice(0, i)).trim()
}

function geoid(stateFips: string, placeCode: string): string {
  return stateFips + placeCode.padStart(5, '0')
}

async function fetchPlacesForState(stateFips: string): Promise<{ geoid: string; name: string; population: number }[]> {
  const url = `https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:${stateFips}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Census API ${stateFips}: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as RawRow[]
  const [, ...rows] = data
  const out: { geoid: string; name: string; population: number }[] = []
  for (const row of rows) {
    const [nameField, popStr, st, place] = row
    const population = Number.parseInt(popStr, 10)
    if (Number.isNaN(population)) continue
    out.push({
      geoid: geoid(st, place),
      name: parsePlaceName(nameField),
      population,
    })
  }
  return out
}

function selectPlacesForState(
  places: { geoid: string; name: string; population: number }[],
  threshold: number,
  minCount: number
): { geoid: string; name: string; population: number }[] {
  const byPop = [...places].sort((a, b) => b.population - a.population)
  const above = byPop.filter((p) => p.population >= threshold)
  if (above.length >= minCount) {
    return above
  }
  return byPop.slice(0, Math.min(minCount, byPop.length))
}

async function main() {
  const allPlaces: {
    stateFips: string
    geoid: string
    name: string
    population: number
    lat: number | null
    lng: number | null
  }[] = []

  for (const { fips } of US_STATES) {
    process.stderr.write(`Fetching state ${fips}...\n`)
    const raw = await fetchPlacesForState(fips)
    const picked = selectPlacesForState(raw, DEFAULT_POPULATION_THRESHOLD, MIN_PLACES_PER_STATE)
    for (const p of picked) {
      allPlaces.push({
        stateFips: fips,
        geoid: p.geoid,
        name: p.name,
        population: p.population,
        lat: null,
        lng: null,
      })
    }
    await new Promise((r) => setTimeout(r, 150))
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    defaultThreshold: DEFAULT_POPULATION_THRESHOLD,
    minPlacesPerState: MIN_PLACES_PER_STATE,
    source: 'US Census 2020 Decennial P1_001N per place; api.census.gov',
    country: { code: 'US', name: 'United States' },
    states: US_STATES,
    places: allPlaces,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(payload, null, 0), 'utf8')
  process.stderr.write(`Wrote ${allPlaces.length} places to ${OUT}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
