import { eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { emitActivity } from './feed-activities.js'

async function countVendorListings(vendorId: string): Promise<number> {
  const [ext] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.vendorExternalListings)
    .where(eq(schema.vendorExternalListings.vendorId, vendorId))
  const [nat] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(schema.products.vendorId, vendorId))
  return (ext?.n ?? 0) + (nat?.n ?? 0)
}

/** Emit Following feed activity when a public shop has showcase listings. */
export async function emitVendorShopLiveIfEligible(vendorProfileId: string): Promise<void> {
  const [vendor] = await db
    .select({
      id: schema.vendorProfiles.id,
      userId: schema.vendorProfiles.userId,
      slug: schema.vendorProfiles.slug,
      displayName: schema.vendorProfiles.displayName,
      visibility: schema.vendorProfiles.visibility,
    })
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorProfileId))
    .limit(1)
  if (!vendor || vendor.visibility !== 'PUBLIC') return

  const listingCount = await countVendorListings(vendor.id)
  if (listingCount < 1) return

  emitActivity({
    actorId: vendor.userId,
    verb: 'vendor_shop_live',
    objectType: 'vendor',
    objectId: vendor.id,
    metadata: {
      slug: vendor.slug,
      displayName: vendor.displayName,
      listingCount,
    },
  })
}
