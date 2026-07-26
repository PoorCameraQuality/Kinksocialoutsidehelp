import {

  PRESENTER_ATTENDEE_REVIEW_WEIGHT,

  PRESENTER_CHECKED_IN_ATTENDEE_WEIGHT,

  PRESENTER_ORG_REPEAT_DECAY_MONTHS,

  PRESENTER_ORG_REPEAT_WEIGHT_FACTOR,

  PRESENTER_ORG_REVIEW_WEIGHT,

} from '@c2k/shared'

import { and, count, eq, gte, asc } from 'drizzle-orm'

import { db, schema } from '../db/index.js'

import {

  detectIdenticalTextBurst,

  detectReciprocalReviewPairs,

  shouldHoldRatingForModReview,

} from './reputation-anti-gaming.js'



const ORG_REPEAT_MS = PRESENTER_ORG_REPEAT_DECAY_MONTHS * 30 * 24 * 60 * 60 * 1000



function reviewWeight(row: {

  sourceKind: string

  attendeeCheckedIn: boolean

  organizationId: string | null

  createdAt: Date

  orgReviewIndex: number

}): number {

  if (row.sourceKind === 'ORGANIZATION') {

    const base = PRESENTER_ORG_REVIEW_WEIGHT

    if (row.orgReviewIndex > 0) return base * PRESENTER_ORG_REPEAT_WEIGHT_FACTOR

    return base

  }

  return row.attendeeCheckedIn ? PRESENTER_CHECKED_IN_ATTENDEE_WEIGHT : PRESENTER_ATTENDEE_REVIEW_WEIGHT

}



async function hasRecentTrustSignal(userId: string, signalType: string): Promise<boolean> {
  const [row] = await db
    .select({ c: count() })
    .from(schema.trustSignalEvents)
    .where(
      and(
        eq(schema.trustSignalEvents.userId, userId),
        eq(schema.trustSignalEvents.signalType, signalType),
        eq(schema.trustSignalEvents.status, 'ACTIVE'),
        gte(schema.trustSignalEvents.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )
    )
  return Number(row?.c ?? 0) > 0
}

async function maybeFlagRatingSpike(presenterUserId: string, previousAvg: number, newAvg: number, reviewCount: number) {

  const [reports] = await db

    .select({ c: count() })

    .from(schema.moderationCases)

    .where(

      and(eq(schema.moderationCases.targetUserId, presenterUserId), gte(schema.moderationCases.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))

    )

  const recentReports = Number(reports?.c ?? 0)

  if (await hasRecentTrustSignal(presenterUserId, 'RATING_SPIKE_REVIEW_RECOMMENDED')) return

  if (

    !shouldHoldRatingForModReview({

      previousAvg,

      newAvg,

      reviewCount,

      recentReportCount: recentReports,

      recentOpenCases: recentReports,

    })

  ) {

    return

  }

  await db.insert(schema.trustSignalEvents).values({

    userId: presenterUserId,

    signalType: 'RATING_SPIKE_REVIEW_RECOMMENDED',

    sourceType: 'presenter_reviews',

    visibility: 'PLATFORM_MOD',

    metadata: { previousAvg, newAvg, reviewCount, recentReports },

  })

}



export async function recalculatePresenterRating(presenterUserId: string): Promise<void> {

  const [prof] = await db

    .select()

    .from(schema.presenterProfiles)

    .where(eq(schema.presenterProfiles.userId, presenterUserId))

    .limit(1)

  if (!prof) return



  const rows = await db

    .select()

    .from(schema.presenterReviews)

    .where(eq(schema.presenterReviews.presenterUserId, presenterUserId))

    .orderBy(asc(schema.presenterReviews.createdAt))



  const orgReviewCountByOrg = new Map<string, number>()

  let weightedSum = 0

  let weightedUnits = 0



  for (const r of rows) {

    let orgReviewIndex = 0

    if (r.sourceKind === 'ORGANIZATION' && r.organizationId) {

      const prior = rows.filter(

        (p) =>

          p.sourceKind === 'ORGANIZATION' &&

          p.organizationId === r.organizationId &&

          p.createdAt.getTime() < r.createdAt.getTime() &&

          r.createdAt.getTime() - p.createdAt.getTime() <= ORG_REPEAT_MS

      ).length

      orgReviewIndex = prior

      orgReviewCountByOrg.set(r.organizationId, (orgReviewCountByOrg.get(r.organizationId) ?? 0) + 1)

    }

    const w = reviewWeight({

      sourceKind: r.sourceKind,

      attendeeCheckedIn: r.attendeeCheckedIn,

      organizationId: r.organizationId,

      createdAt: r.createdAt,

      orgReviewIndex,

    })

    weightedSum += r.rating * w

    weightedUnits += w

  }



  const avg = weightedUnits > 0 ? weightedSum / weightedUnits : 0



  if (
    detectIdenticalTextBurst(rows.map((r) => r.body)) &&
    !(await hasRecentTrustSignal(presenterUserId, 'REVIEW_TEXT_BURST_REVIEW_RECOMMENDED'))
  ) {

    await db.insert(schema.trustSignalEvents).values({

      userId: presenterUserId,

      signalType: 'REVIEW_TEXT_BURST_REVIEW_RECOMMENDED',

      sourceType: 'presenter_reviews',

      visibility: 'PLATFORM_MOD',

      metadata: { reviewCount: rows.length },

    })

  }



  const reciprocalPairs = detectReciprocalReviewPairs(

    rows.map((r) => ({ authorId: r.authorId, targetUserId: presenterUserId }))

  )

  if (reciprocalPairs > 0 && !(await hasRecentTrustSignal(presenterUserId, 'RECIPROCAL_REVIEW_PATTERN'))) {

    await db.insert(schema.trustSignalEvents).values({

      userId: presenterUserId,

      signalType: 'RECIPROCAL_REVIEW_PATTERN',

      sourceType: 'presenter_reviews',

      visibility: 'PLATFORM_MOD',

      metadata: { pairs: reciprocalPairs },

    })

  }



  await maybeFlagRatingSpike(presenterUserId, prof.ratingAvg, avg, rows.length)



  await db

    .update(schema.presenterProfiles)

    .set({

      ratingAvg: avg,

      reviewCount: rows.length,

      updatedAt: new Date(),

    })

    .where(eq(schema.presenterProfiles.userId, presenterUserId))

}


