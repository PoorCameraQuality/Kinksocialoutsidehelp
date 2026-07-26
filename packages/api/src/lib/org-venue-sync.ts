import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isOrgVenueListing, parseOrgFeatureFlags, type OrgFeatureFlags } from './org-features.js'

type OrgRow = typeof schema.organizations.$inferSelect

export async function syncOrgVenuePlace(org: OrgRow): Promise<void> {
  const flags = parseOrgFeatureFlags(org.featureFlags)
  if (!isOrgVenueListing(flags)) {
    await unpublishLinkedPlace(org.id)
    return
  }
  await upsertVenuePlace(org, flags)
}

async function unpublishLinkedPlace(organizationId: string): Promise<void> {
  await db
    .update(schema.communityPlaces)
    .set({ status: 'pending_moderation', updatedAt: new Date() })
    .where(eq(schema.communityPlaces.linkedOrganizationId, organizationId))
}

async function upsertVenuePlace(org: OrgRow, flags: OrgFeatureFlags): Promise<void> {
  const category = flags.venueCategory ?? 'dungeon_club'
  const [existing] = await db
    .select()
    .from(schema.communityPlaces)
    .where(eq(schema.communityPlaces.linkedOrganizationId, org.id))
    .limit(1)

  const values = {
    name: org.displayName,
    slug: org.slug,
    category,
    description: org.bio,
    logoUrl: org.logoUrl,
    linkedOrganizationId: org.id,
    lat: flags.lat,
    lng: flags.lng,
    city: flags.city,
    region: flags.region,
    country: flags.country ?? 'US',
    status: 'published' as const,
    updatedAt: new Date(),
  }

  if (existing) {
    await db.update(schema.communityPlaces).set(values).where(eq(schema.communityPlaces.id, existing.id))
    return
  }

  const [slugConflict] = await db
    .select({ id: schema.communityPlaces.id })
    .from(schema.communityPlaces)
    .where(eq(schema.communityPlaces.slug, org.slug))
    .limit(1)

  await db.insert(schema.communityPlaces).values({
    ...values,
    slug: slugConflict ? `${org.slug}-venue` : org.slug,
  })
}

export function resolveVenueGeoFromFlags(
  flags: OrgFeatureFlags,
): { city: string | null; state: string | null } {
  return {
    city: flags.city,
    state: flags.region ? flags.region.slice(0, 2).toUpperCase() : null,
  }
}

export async function loadLinkedPlaceForOrg(organizationId: string) {
  const [row] = await db
    .select()
    .from(schema.communityPlaces)
    .where(
      and(
        eq(schema.communityPlaces.linkedOrganizationId, organizationId),
        eq(schema.communityPlaces.status, 'published'),
      ),
    )
    .limit(1)
  return row ?? null
}
