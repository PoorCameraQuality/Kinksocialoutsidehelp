import { and, asc, eq, gte, ilike, inArray, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { db, schema } from '../db/index.js'

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

/** Public read-model: orgs, groups, vendor, presenter, upcoming events for navigation UX. */
export async function registerUserEcosystemRoutes(app: FastifyInstance) {
  app.get('/api/v1/users/:username/ecosystem', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    if (!username?.trim()) return reply.status(400).send({ error: 'Invalid username' })

    const [u] = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(ilike(schema.users.username, username.trim()))
      .limit(1)
    if (!u) return reply.status(404).send({ error: 'Not found' })

    const orgRows = await db
      .select({
        organizationId: schema.organizations.id,
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        logoUrl: schema.organizations.logoUrl,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizationMembers.organizationId, schema.organizations.id)
      )
      .where(eq(schema.organizationMembers.userId, u.id))
      .limit(24)

    const groupRows = await db
      .select({
        id: schema.groups.id,
        slug: schema.groups.slug,
        name: schema.groups.name,
        logoUrl: schema.groups.logoUrl,
        bannerUrl: schema.groups.bannerUrl,
        role: schema.groupMembers.role,
      })
      .from(schema.groupMembers)
      .innerJoin(schema.groups, eq(schema.groupMembers.groupId, schema.groups.id))
      .where(and(eq(schema.groupMembers.userId, u.id), eq(schema.groupMembers.showGroupOnProfile, true)))
      .limit(24)

    const [vendor] = await db
      .select({
        id: schema.vendorProfiles.id,
        slug: schema.vendorProfiles.slug,
        displayName: schema.vendorProfiles.displayName,
      })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, u.id))
      .limit(1)

    const [presenter] = await db
      .select({
        headline: schema.presenterProfiles.headline,
        directoryVisibility: schema.presenterProfiles.directoryVisibility,
        profileKind: schema.presenterProfiles.profileKind,
      })
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, u.id))
      .limit(1)

    const orgIds = orgRows.map((r) => r.organizationId)
    const now = new Date()
    const eventWhere =
      orgIds.length > 0 ?
        and(
          gte(schema.events.startsAt, now),
          or(eq(schema.events.hostId, u.id), inArray(schema.events.organizationId, orgIds))
        )
      : and(gte(schema.events.startsAt, now), eq(schema.events.hostId, u.id))
    const hostingEvents = await db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        startsAt: schema.events.startsAt,
        organizationId: schema.events.organizationId,
        imageUrl: schema.events.imageUrl,
        location: schema.events.location,
        publicLocationSummary: schema.events.publicLocationSummary,
      })
      .from(schema.events)
      .where(eventWhere)
      .orderBy(asc(schema.events.startsAt))
      .limit(8)

    const rsvpRows = await db
      .select({
        id: schema.events.id,
        title: schema.events.title,
        startsAt: schema.events.startsAt,
        organizationId: schema.events.organizationId,
        imageUrl: schema.events.imageUrl,
        location: schema.events.location,
        publicLocationSummary: schema.events.publicLocationSummary,
        rsvpStatus: schema.eventRsvps.status,
      })
      .from(schema.eventRsvps)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventRsvps.eventId))
      .where(
        and(
          eq(schema.eventRsvps.userId, u.id),
          gte(schema.events.startsAt, now),
          inArray(schema.eventRsvps.status, ['going', 'maybe', 'waitlist'])
        )
      )
      .orderBy(asc(schema.events.startsAt))
      .limit(8)

    const hostingIds = new Set(hostingEvents.map((e) => e.id))
    const upcomingEvents = [
      ...hostingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        organizationId: e.organizationId,
        imageUrl: e.imageUrl,
        location: e.location?.trim() || e.publicLocationSummary?.trim() || null,
        participation: 'hosting' as const,
        rsvpStatus: null,
      })),
      ...rsvpRows
        .filter((e) => !hostingIds.has(e.id))
        .map((e) => ({
          id: e.id,
          title: e.title,
          startsAt: e.startsAt,
          organizationId: e.organizationId,
          imageUrl: e.imageUrl,
          location: e.location?.trim() || e.publicLocationSummary?.trim() || null,
          participation: 'rsvp' as const,
          rsvpStatus: e.rsvpStatus as 'going' | 'maybe' | 'waitlist',
        })),
    ]
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 8)

    return reply.send({
      userId: u.id,
      username: u.username,
      orgs: orgRows.map((r) => ({
        slug: r.slug,
        displayName: r.displayName,
        logoUrl: r.logoUrl,
        role: r.role,
      })),
      groups: groupRows.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        role: g.role,
        logoUrl: g.logoUrl,
        bannerUrl: g.bannerUrl,
      })),
      vendor:
        vendor ?
          {
            id: vendor.id,
            slug: vendor.slug,
            displayName: vendor.displayName,
          }
        : null,
      presenter:
        presenter ?
          {
            headline: presenter.headline,
            directoryVisibility: presenter.directoryVisibility,
            profileKind: presenter.profileKind,
          }
        : null,
      upcomingEvents,
    })
  })
}
