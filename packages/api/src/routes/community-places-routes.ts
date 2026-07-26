import { and, desc, eq, ilike } from 'drizzle-orm'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { z } from 'zod'

import { getViewerUserId } from '../auth/viewer-user-id.js'

import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'

import { db, schema } from '../db/index.js'

import { withAlphaLabels } from '../lib/alpha-seed-labels.js'

import { loadEventsAtVenuePlace } from '../lib/venue-events.js'

import { resolveOrgEckePublishAccess } from '../lib/ecke-publish-org-convention.js'



function useDatabase(): boolean {

  return process.env.USE_DATABASE === 'true'

}



function requireDb(reply: FastifyReply): boolean {

  if (!useDatabase()) {

    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })

    return false

  }

  return true

}



function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {

  const v = resolveViewerFromRequest(req)

  if (!v.authenticated || !v.payload?.sub) {

    reply.status(401).send({ error: 'Unauthorized' })

    return null

  }

  const userId = getViewerUserId(v.payload)

  if (!userId) {

    reply.status(401).send({ error: 'Invalid session' })

    return null

  }

  return { userId }

}



function slugify(name: string): string {

  return name

    .toLowerCase()

    .replace(/[^a-z0-9]+/g, '-')

    .replace(/^-+|-+$/g, '')

    .slice(0, 120)

}



function mapCommunityPlaceRow(row: {

  place: typeof schema.communityPlaces.$inferSelect

  orgSlug: string | null

  orgDisplayName: string | null

}) {

  const p = row.place

  return {

    ...p,

    linkedOrganization:

      row.orgSlug && row.orgDisplayName ?

        { slug: row.orgSlug, displayName: row.orgDisplayName }

      : null,

  }

}



export async function registerCommunityPlacesRoutes(app: FastifyInstance) {

  app.get('/api/v1/community-places', async (req, reply) => {

    if (!requireDb(reply)) return

    const q = req.query as {

      category?: string

      q?: string

      lat?: string

      lng?: string

      radius?: string

      limit?: string

    }

    const limit = Math.min(100, Math.max(1, parseInt(String(q.limit ?? '50'), 10) || 50))

    const conditions = [eq(schema.communityPlaces.status, 'published')]

    const categoryValues = ['dungeon_club', 'nude_beach', 'kink_friendly_hotel', 'web_resource', 'other'] as const

    if (q.category && (categoryValues as readonly string[]).includes(q.category)) {

      conditions.push(eq(schema.communityPlaces.category, q.category as (typeof categoryValues)[number]))

    }

    const needle = typeof q.q === 'string' ? q.q.trim() : ''

    if (needle) {

      conditions.push(ilike(schema.communityPlaces.name, `%${needle}%`))

    }

    const lat = parseFloat(String(q.lat ?? ''))

    const lng = parseFloat(String(q.lng ?? ''))

    const radiusMi = parseFloat(String(q.radius ?? ''))

    let rows = await db

      .select({

        place: schema.communityPlaces,

        orgSlug: schema.organizations.slug,

        orgDisplayName: schema.organizations.displayName,

      })

      .from(schema.communityPlaces)

      .leftJoin(

        schema.organizations,

        eq(schema.communityPlaces.linkedOrganizationId, schema.organizations.id),

      )

      .where(and(...conditions))

      .orderBy(desc(schema.communityPlaces.updatedAt))

      .limit(limit * 3)



    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusMi) && radiusMi > 0) {

      const radiusKm = radiusMi * 1.60934

      rows = rows

        .filter((p) => p.place.lat != null && p.place.lng != null)

        .map((p) => {

          const dLat = ((p.place.lat! - lat) * Math.PI) / 180

          const dLng = ((p.place.lng! - lng) * Math.PI) / 180

          const a =

            Math.sin(dLat / 2) ** 2 +

            Math.cos((lat * Math.PI) / 180) *

              Math.cos((p.place.lat! * Math.PI) / 180) *

              Math.sin(dLng / 2) ** 2

          const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

          return { row: p, distKm }

        })

        .filter((x) => x.distKm <= radiusKm)

        .sort((a, b) => a.distKm - b.distKm)

        .slice(0, limit)

        .map((x) => x.row)

    } else {

      rows = rows.slice(0, limit)

    }



    const items = rows.map(mapCommunityPlaceRow)

    return reply.send({ items: await withAlphaLabels('community_place', items) })

  })



  app.get('/api/v1/community-places/:slug', async (req, reply) => {

    if (!requireDb(reply)) return

    const { slug } = req.params as { slug: string }

    const [row] = await db

      .select({

        place: schema.communityPlaces,

        orgSlug: schema.organizations.slug,

        orgDisplayName: schema.organizations.displayName,

        orgLogoUrl: schema.organizations.logoUrl,

        orgBio: schema.organizations.bio,

        orgExternalSiteUrl: schema.organizations.externalSiteUrl,

      })

      .from(schema.communityPlaces)

      .leftJoin(

        schema.organizations,

        eq(schema.communityPlaces.linkedOrganizationId, schema.organizations.id),

      )

      .where(

        and(eq(schema.communityPlaces.slug, slug), eq(schema.communityPlaces.status, 'published')),

      )

      .limit(1)



    if (!row) return reply.status(404).send({ error: 'Not found' })



    const mapped = mapCommunityPlaceRow(row)

    const upcomingEvents = await loadEventsAtVenuePlace(

      row.place.id,

      row.place.linkedOrganizationId,

    )

    const [labeledPlace] = await withAlphaLabels('community_place', [mapped])

    const viewer = resolveViewerFromRequest(req)
    const viewerUserId = viewer.authenticated && viewer.payload?.sub ? getViewerUserId(viewer.payload) : null
    let viewerCanManageEcke = false
    if (viewerUserId) {
      if (row.place.submittedByUserId === viewerUserId) {
        viewerCanManageEcke = true
      } else if (row.place.linkedOrganizationId) {
        const access = await resolveOrgEckePublishAccess(row.place.linkedOrganizationId, viewerUserId)
        viewerCanManageEcke = Boolean(access?.canManage)
      }
    }

    return reply.send({

      place: labeledPlace ?? mapped,

      viewerCanManageEcke,

      linkedOrganization:

        row.orgSlug && row.orgDisplayName ?

          {

            slug: row.orgSlug,

            displayName: row.orgDisplayName,

            logoUrl: row.orgLogoUrl,

            bio: row.orgBio,

            externalSiteUrl: row.orgExternalSiteUrl,

          }

        : mapped.linkedOrganization,

      upcomingEvents,

    })

  })



  const suggestBody = z.object({

    name: z.string().min(1).max(255),

    category: z.enum(['dungeon_club', 'nude_beach', 'kink_friendly_hotel', 'web_resource', 'other']),

    description: z.string().max(8000).optional(),

    city: z.string().max(128).optional(),

    region: z.string().max(128).optional(),

    country: z.string().max(128).optional(),

    lat: z.number().optional(),

    lng: z.number().optional(),

  })



  app.post('/api/v1/community-places/suggestions', async (req, reply) => {

    if (!requireDb(reply)) return

    const user = requireUser(req, reply)

    if (!user) return

    const parsed = suggestBody.safeParse(req.body)

    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const base = slugify(parsed.data.name) || 'place'

    const slug = `${base}-${Date.now().toString(36)}`

    const [row] = await db

      .insert(schema.communityPlaces)

      .values({

        name: parsed.data.name,

        slug,

        category: parsed.data.category,

        description: parsed.data.description,

        city: parsed.data.city,

        region: parsed.data.region,

        country: parsed.data.country,

        lat: parsed.data.lat,

        lng: parsed.data.lng,

        status: 'pending_moderation',

        submittedByUserId: user.userId,

      })

      .returning()

    return reply.send({ place: { ...row, linkedOrganization: null } })

  })

  app.patch('/api/v1/community-places/:placeId/ecke-publish', async (req, reply) => {

    if (!requireDb(reply)) return

    const user = requireUser(req, reply)

    if (!user) return

    const { placeId } = req.params as { placeId: string }

    const parsed = z.object({ eckePublish: z.boolean() }).safeParse(req.body)

    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const [existing] = await db

      .select()

      .from(schema.communityPlaces)

      .where(eq(schema.communityPlaces.id, placeId))

      .limit(1)

    if (!existing) return reply.status(404).send({ error: 'Place not found' })

    let canManage = existing.submittedByUserId === user.userId

    if (!canManage && existing.linkedOrganizationId) {

      const access = await resolveOrgEckePublishAccess(existing.linkedOrganizationId, user.userId)

      canManage = Boolean(access?.canManage)

    }

    if (!canManage) {

      return reply.status(403).send({ error: 'Venue owner or org moderator access required' })

    }

    const [row] = await db

      .update(schema.communityPlaces)

      .set({ eckePublish: parsed.data.eckePublish, updatedAt: new Date() })

      .where(eq(schema.communityPlaces.id, placeId))

      .returning()

    return reply.send({ place: row })

  })

}


