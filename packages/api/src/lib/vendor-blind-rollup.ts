import { VENDOR_MIN_VERIFIED_FOR_STARS } from '@c2k/shared'

import { and, eq } from 'drizzle-orm'

import { db, schema } from '../db/index.js'



/** Map verified 1–10 scores to 0–5 display rating on `vendor_profiles.rating`. */

export async function recalculateVendorBlindRating(vendorProfileId: string): Promise<void> {

  const verified = await db

    .select({ rating: schema.vendorBlindFeedback.rating })

    .from(schema.vendorBlindFeedback)

    .where(

      and(

        eq(schema.vendorBlindFeedback.vendorProfileId, vendorProfileId),

        eq(schema.vendorBlindFeedback.status, 'VERIFIED')

      )

    )

  const ratings = verified.map((r) => r.rating).filter((n) => n >= 1 && n <= 10)

  if (ratings.length < VENDOR_MIN_VERIFIED_FOR_STARS) {

    await db

      .update(schema.vendorProfiles)

      .set({ rating: 0 })

      .where(eq(schema.vendorProfiles.id, vendorProfileId))

    return

  }

  const avg10 = ratings.reduce((a, b) => a + b, 0) / ratings.length

  const rating5 = ((avg10 - 1) / 9) * 5

  await db

    .update(schema.vendorProfiles)

    .set({ rating: Math.round(rating5 * 100) / 100 })

    .where(eq(schema.vendorProfiles.id, vendorProfileId))

}


