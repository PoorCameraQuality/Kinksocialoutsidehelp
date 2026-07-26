import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { formatVendorEventDate } from './vendor-event-credits.js'

const FALLBACK_EVENT_MS = 4 * 60 * 60 * 1000

export type VendorEventCreditSyncResult = {
  inserted: number
  skipped: number
}

function eventEndedClause(now: Date) {
  return or(
    and(sql`${schema.events.endsAt} IS NOT NULL`, lt(schema.events.endsAt, now)),
    and(
      isNull(schema.events.endsAt),
      lt(schema.events.startsAt, new Date(now.getTime() - FALLBACK_EVENT_MS)),
    ),
  )
}

export async function runVendorEventCreditSync(): Promise<VendorEventCreditSyncResult> {
  const now = new Date()
  const pending = await db
    .select({
      vendorProfileId: schema.eventContributors.vendorProfileId,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
      startsAt: schema.events.startsAt,
      conventionId: schema.conventions.id,
      conventionSlug: schema.conventions.slug,
    })
    .from(schema.eventContributors)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventContributors.eventId))
    .leftJoin(schema.conventions, eq(schema.conventions.anchorEventId, schema.events.id))
    .leftJoin(
      schema.vendorEventCredits,
      and(
        eq(schema.vendorEventCredits.vendorProfileId, schema.eventContributors.vendorProfileId),
        eq(schema.vendorEventCredits.eventId, schema.events.id),
      ),
    )
    .where(
      and(
        eq(schema.eventContributors.kind, 'vendor'),
        sql`${schema.eventContributors.vendorProfileId} IS NOT NULL`,
        eventEndedClause(now),
        isNull(schema.vendorEventCredits.id),
      ),
    )

  let inserted = 0
  let skipped = 0

  for (const row of pending) {
    if (!row.vendorProfileId) continue
    const rows = await db
      .insert(schema.vendorEventCredits)
      .values({
        vendorProfileId: row.vendorProfileId,
        eventId: row.eventId,
        eventName: row.eventTitle,
        eventDate: formatVendorEventDate(row.startsAt),
        conventionId: row.conventionId,
        conventionSlug: row.conventionSlug,
        verified: true,
      })
      .onConflictDoNothing({
        target: [schema.vendorEventCredits.vendorProfileId, schema.vendorEventCredits.eventId],
      })
      .returning({ id: schema.vendorEventCredits.id })
    if (rows.length > 0) inserted += 1
    else skipped += 1
  }

  return { inserted, skipped }
}
