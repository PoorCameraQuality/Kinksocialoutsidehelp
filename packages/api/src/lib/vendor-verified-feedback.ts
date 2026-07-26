import { and, count, eq, inArray } from 'drizzle-orm'
import { VENDOR_MIN_VERIFIED_FOR_STARS } from '@c2k/shared'
import { db, schema } from '../db/index.js'

export type VendorFeedbackSummary = {
  rating: number
  reviewCount: number
  verifiedFeedbackCount: number
  meetsPublicRatingThreshold: boolean
}

export async function countVerifiedVendorFeedback(vendorProfileId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.vendorBlindFeedback)
    .where(
      and(
        eq(schema.vendorBlindFeedback.vendorProfileId, vendorProfileId),
        eq(schema.vendorBlindFeedback.status, 'VERIFIED'),
      ),
    )
  return Number(row?.n ?? 0)
}

export async function loadVendorVerifiedFeedbackCounts(
  vendorProfileIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (vendorProfileIds.length === 0) return out
  for (const id of vendorProfileIds) out.set(id, 0)

  const rows = await db
    .select({
      vendorProfileId: schema.vendorBlindFeedback.vendorProfileId,
      n: count(),
    })
    .from(schema.vendorBlindFeedback)
    .where(
      and(
        inArray(schema.vendorBlindFeedback.vendorProfileId, vendorProfileIds),
        eq(schema.vendorBlindFeedback.status, 'VERIFIED'),
      ),
    )
    .groupBy(schema.vendorBlindFeedback.vendorProfileId)

  for (const row of rows) {
    out.set(row.vendorProfileId, Number(row.n ?? 0))
  }
  return out
}

export function buildVendorFeedbackSummary(
  rating: number,
  verifiedFeedbackCount: number,
): VendorFeedbackSummary | null {
  if (verifiedFeedbackCount <= 0) return null
  const meetsPublicRatingThreshold = verifiedFeedbackCount >= VENDOR_MIN_VERIFIED_FOR_STARS
  return {
    rating: meetsPublicRatingThreshold && rating > 0 ? rating : 0,
    reviewCount: verifiedFeedbackCount,
    verifiedFeedbackCount,
    meetsPublicRatingThreshold,
  }
}
