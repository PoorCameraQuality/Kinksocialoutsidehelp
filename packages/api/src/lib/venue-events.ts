import { and, desc, eq, gte, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { db, schema } from '../db/index.js'
import { withAlphaLabels } from '../lib/alpha-seed-labels.js'

export async function loadEventsAtVenuePlace(placeId: string, organizationId: string | null, limit = 12) {
  const now = new Date()
  const venueConditions = [eq(schema.events.venuePlaceId, placeId)]
  if (organizationId) {
    venueConditions.push(eq(schema.events.organizationId, organizationId))
  }
  const rows = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      startsAt: schema.events.startsAt,
      endsAt: schema.events.endsAt,
      location: schema.events.location,
      publicLocationSummary: schema.events.publicLocationSummary,
      imageUrl: schema.events.imageUrl,
      organizationId: schema.events.organizationId,
      orgSlug: schema.organizations.slug,
      orgDisplayName: schema.organizations.displayName,
    })
    .from(schema.events)
    .leftJoin(schema.organizations, eq(schema.events.organizationId, schema.organizations.id))
    .where(
      and(
        eq(schema.events.visibility, 'public'),
        gte(schema.events.startsAt, now),
        or(...venueConditions),
      ),
    )
    .orderBy(schema.events.startsAt)
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    location: r.location,
    publicLocationSummary: r.publicLocationSummary,
    imageUrl: r.imageUrl,
    hostOrganization:
      r.orgSlug && r.orgDisplayName ?
        { slug: r.orgSlug, displayName: r.orgDisplayName }
      : null,
  }))
}

export async function loadEventsAtVenueOrg(organizationId: string, limit = 12) {
  const [place] = await db
    .select({ id: schema.communityPlaces.id })
    .from(schema.communityPlaces)
    .where(eq(schema.communityPlaces.linkedOrganizationId, organizationId))
    .limit(1)
  if (place) return loadEventsAtVenuePlace(place.id, organizationId, limit)

  const now = new Date()
  const rows = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      startsAt: schema.events.startsAt,
      endsAt: schema.events.endsAt,
      location: schema.events.location,
      publicLocationSummary: schema.events.publicLocationSummary,
      imageUrl: schema.events.imageUrl,
    })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.organizationId, organizationId),
        eq(schema.events.visibility, 'public'),
        gte(schema.events.startsAt, now),
      ),
    )
    .orderBy(schema.events.startsAt)
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    location: r.location,
    publicLocationSummary: r.publicLocationSummary,
    imageUrl: r.imageUrl,
    hostOrganization: null,
  }))
}
