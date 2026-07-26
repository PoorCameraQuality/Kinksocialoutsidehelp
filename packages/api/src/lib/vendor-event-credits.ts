import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type VendorEventCreditRow = {
  id: string
  eventId: string
  eventName: string
  eventDate: string | null
  conventionId: string | null
  conventionSlug: string | null
  verified: boolean
  createdAt: Date
}

export function formatVendorEventDate(startsAt: Date | null | undefined): string | undefined {
  if (!startsAt) return undefined
  return startsAt.toISOString().slice(0, 10)
}

export async function loadVendorEventCredits(vendorProfileId: string): Promise<VendorEventCreditRow[]> {
  const rows = await db
    .select()
    .from(schema.vendorEventCredits)
    .where(eq(schema.vendorEventCredits.vendorProfileId, vendorProfileId))
    .orderBy(desc(schema.vendorEventCredits.eventDate), desc(schema.vendorEventCredits.createdAt))
  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    eventName: r.eventName,
    eventDate: r.eventDate,
    conventionId: r.conventionId,
    conventionSlug: r.conventionSlug,
    verified: r.verified,
    createdAt: r.createdAt,
  }))
}
