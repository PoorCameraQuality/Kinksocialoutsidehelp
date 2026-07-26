/**
 * Seed US country, states, and Census-filtered places from data/places-seed.json.
 * Run: USE_DATABASE=true npm run db:seed:locations -w @c2k/api
 * Idempotent: skips if places table already has rows.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from './index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '../../data/places-seed.json')

type SeedFile = {
  version: number
  country: { code: string; name: string }
  states: { fips: string; name: string }[]
  places: {
    stateFips: string
    geoid: string
    name: string
    population: number
    lat: number | null
    lng: number | null
  }[]
}

const BATCH = 250

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true to seed locations.')
    process.exit(1)
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.places)
  if (count > 0) {
    console.log(`Places table already has ${count} rows; skipping location seed.`)
    process.exit(0)
  }

  const raw = readFileSync(DATA_PATH, 'utf8')
  const data = JSON.parse(raw) as SeedFile

  const [existingCountry] = await db
    .select()
    .from(schema.countries)
    .where(eq(schema.countries.code, data.country.code))
    .limit(1)

  let countryId: string
  if (existingCountry) {
    countryId = existingCountry.id
    console.log('Country already exists:', data.country.code)
  } else {
    const [c] = await db
      .insert(schema.countries)
      .values({ code: data.country.code, name: data.country.name })
      .returning()
    if (!c) throw new Error('insert country')
    countryId = c.id
    console.log('Inserted country', data.country.code)
  }

  const stateRows = await db.select().from(schema.states).where(eq(schema.states.countryId, countryId))
  const fipsToId = new Map<string, string>()
  for (const s of stateRows) {
    fipsToId.set(s.fips, s.id)
  }

  for (const st of data.states) {
    if (fipsToId.has(st.fips)) continue
    const [inserted] = await db
      .insert(schema.states)
      .values({ countryId, fips: st.fips, name: st.name })
      .returning()
    if (inserted) fipsToId.set(st.fips, inserted.id)
  }
  console.log(`Ensured ${fipsToId.size} states.`)

  for (let i = 0; i < data.places.length; i += BATCH) {
    const slice = data.places.slice(i, i + BATCH)
    const values = slice.map((p) => {
      const sid = fipsToId.get(p.stateFips)
      if (!sid) throw new Error(`Unknown state FIPS ${p.stateFips}`)
      return {
        stateId: sid,
        geoid: p.geoid,
        name: p.name,
        population: p.population,
        lat: p.lat,
        lng: p.lng,
      }
    })
    await db.insert(schema.places).values(values)
    process.stdout.write(`Inserted places ${i + slice.length}/${data.places.length}\r`)
  }
  console.log(`\nSeeded ${data.places.length} places from ${DATA_PATH}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
