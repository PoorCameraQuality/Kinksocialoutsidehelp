import {
  BAYESIAN_PRIOR_RATING,
  BAYESIAN_PRIOR_WEIGHT_ORG,
  BAYESIAN_PRIOR_WEIGHT_PRESENTER_VENDOR,
} from './reputation-constants.js'

/** Smooth early star ratings so one review does not swing to 5.0. */
export function bayesianDisplayRating(
  averageRating: number,
  reviewCount: number,
  priorRating = BAYESIAN_PRIOR_RATING,
  priorWeight: number
): number {
  if (reviewCount <= 0 || !Number.isFinite(averageRating) || averageRating <= 0) return 0
  const w = Math.max(0, priorWeight)
  return (averageRating * reviewCount + priorRating * w) / (reviewCount + w)
}

export function bayesianPresenterVendorRating(averageRating: number, reviewCount: number): number {
  return bayesianDisplayRating(
    averageRating,
    reviewCount,
    BAYESIAN_PRIOR_RATING,
    BAYESIAN_PRIOR_WEIGHT_PRESENTER_VENDOR
  )
}

export function bayesianOrgRating(averageRating: number, reviewCount: number): number {
  return bayesianDisplayRating(
    averageRating,
    reviewCount,
    BAYESIAN_PRIOR_RATING,
    BAYESIAN_PRIOR_WEIGHT_ORG
  )
}
