/**

 * Composite organization rating: blends weighted star reviews with role-weighted

 * member localReputation. Public blend favors reviews as review volume grows.

 */



import {

  ORG_BLEND_INTERNAL_HIGH,

  ORG_BLEND_INTERNAL_LOW,

  ORG_BLEND_PUBLIC_HIGH,

  ORG_BLEND_PUBLIC_LOW,

  ORG_HIGH_PUBLIC_REVIEW_COUNT,

  ORG_MIN_PUBLIC_REVIEWS_FOR_STARS,

} from '@c2k/shared'



export const WRITEUP_MIN_CHARS = 200

export const LONG_REVIEW_WEIGHT = 1.25

/** @deprecated Use tiered blend via compositeOrgRating */

export const BLEND_REVIEW = 0.55

/** @deprecated Use tiered blend via compositeOrgRating */

export const BLEND_INTERNAL = 0.45

export const LOCAL_REP_CAP = 500



const INTERNAL_ROLE_WEIGHT: Record<string, number> = {

  OWNER: 1,

  ADMIN: 0.85,

  MODERATOR: 0.65,

  STAFF: 0.5,

  MEMBER: 0.25,

}



export function normalizeLocalReputationToStars(localReputation: number): number {

  const clamped = Math.max(0, Math.min(LOCAL_REP_CAP, localReputation))

  return 1 + 4 * (clamped / LOCAL_REP_CAP)

}



export function internalScoreFromMembers(

  members: Array<{ role: string; localReputation: number }>

): { score: number; weightSum: number } {

  let num = 0

  let den = 0

  for (const m of members) {

    const w = INTERNAL_ROLE_WEIGHT[m.role] ?? 0.2

    num += w * normalizeLocalReputationToStars(m.localReputation)

    den += w

  }

  if (den === 0) return { score: 0, weightSum: 0 }

  return { score: num / den, weightSum: den }

}



export function weightedReviewAverage(

  rows: Array<{ rating: number; body: string | null }>

): { avg: number; count: number } {

  if (rows.length === 0) return { avg: 0, count: 0 }

  let wSum = 0

  let rSum = 0

  for (const r of rows) {

    const w = r.body && r.body.trim().length >= WRITEUP_MIN_CHARS ? LONG_REVIEW_WEIGHT : 1

    wSum += w

    rSum += w * r.rating

  }

  return { avg: rSum / wSum, count: rows.length }

}



function blendWeights(publicReviewCount: number): { publicW: number; internalW: number } | null {

  if (publicReviewCount < ORG_MIN_PUBLIC_REVIEWS_FOR_STARS) return null

  if (publicReviewCount < ORG_HIGH_PUBLIC_REVIEW_COUNT) {

    return { publicW: ORG_BLEND_PUBLIC_LOW, internalW: ORG_BLEND_INTERNAL_LOW }

  }

  return { publicW: ORG_BLEND_PUBLIC_HIGH, internalW: ORG_BLEND_INTERNAL_HIGH }

}



export function compositeOrgRating(

  reviewAvg: number,

  reviewN: number,

  internalAvg: number,

  internalN: number

): number {

  const weights = blendWeights(reviewN)

  if (!weights) return 0

  const hasInternal = internalN > 0

  if (!hasInternal) return reviewAvg

  return weights.publicW * reviewAvg + weights.internalW * internalAvg

}



export function orgReviewPropagatesGlobalTrust(): boolean {

  return process.env.ORG_REVIEW_PROPAGATES_GLOBAL_TRUST === 'true'

}


