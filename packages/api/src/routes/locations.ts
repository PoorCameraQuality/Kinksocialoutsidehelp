import { formatPlaceDisplayName, formatPlaceLocationLabel } from '@c2k/shared'
import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { resolveZipPlace } from '../lib/zip-place-lookup.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

const countryIdQuery = z.object({
  country_id: z.string().uuid(),
})

const stateIdQuery = z.object({
  state_id: z.string().uuid(),
})

const zipQuery = z.object({
  zip: z.string().min(5).max(10),
})

export async function registerLocationRoutes(app: FastifyInstance) {
  app.get('/api/locations/countries', async (_req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Locations API requires USE_DATABASE=true' })
    }
    const rows = await db
      .select({ id: schema.countries.id, code: schema.countries.code, name: schema.countries.name })
      .from(schema.countries)
      .orderBy(asc(schema.countries.name))
    return reply.send({ countries: rows })
  })

  app.get('/api/locations/states', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Locations API requires USE_DATABASE=true' })
    }
    const parsed = countryIdQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Query country_id (uuid) is required' })
    }
    const rows = await db
      .select({ id: schema.states.id, fips: schema.states.fips, name: schema.states.name })
      .from(schema.states)
      .where(eq(schema.states.countryId, parsed.data.country_id))
      .orderBy(asc(schema.states.name))
    return reply.send({ states: rows })
  })

  app.get('/api/locations/places', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Locations API requires USE_DATABASE=true' })
    }
    const parsed = stateIdQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Query state_id (uuid) is required' })
    }
    const rows = await db
      .select({
        id: schema.places.id,
        name: schema.places.name,
        population: schema.places.population,
      })
      .from(schema.places)
      .where(eq(schema.places.stateId, parsed.data.state_id))
      .orderBy(asc(schema.places.name))
    return reply.send({
      places: rows.map((row) => ({
        ...row,
        name: formatPlaceDisplayName(row.name),
      })),
    })
  })

  app.get('/api/locations/by-zip', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Locations API requires USE_DATABASE=true' })
    }
    const parsed = zipQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Query zip is required' })
    }
    const result = await resolveZipPlace(parsed.data.zip)
    if (!result) {
      return reply.status(404).send({ error: 'Zip not found or could not be matched to a place' })
    }
    return reply.send(result)
  })
}
