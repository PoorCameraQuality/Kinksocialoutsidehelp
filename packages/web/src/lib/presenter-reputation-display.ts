import {

  bayesianPresenterVendorRating,

  PRESENTER_MIN_ORG_REVIEWED_EVENTS_FOR_TIER,

  PRESENTER_MIN_REVIEWS_FOR_TIER,

} from '@c2k/shared'



export type PresenterReputationTier = 'unrated' | 'rated' | 'trusted' | 'highlyTrusted'



export const PRESENTER_TRUSTED_MIN_RATING = 4.0

export const PRESENTER_TRUSTED_MIN_REVIEWS = 3

export const PRESENTER_HIGHLY_TRUSTED_MIN_RATING = 4.5

export const PRESENTER_HIGHLY_TRUSTED_MIN_REVIEWS = 8



export function presenterReputationTier(

  ratingAvg: number,

  reviewCount: number,

  orgReviewedEventCount = 0

): PresenterReputationTier {

  if (reviewCount <= 0) return 'unrated'

  const meetsFloor =

    reviewCount >= PRESENTER_MIN_REVIEWS_FOR_TIER ||

    orgReviewedEventCount >= PRESENTER_MIN_ORG_REVIEWED_EVENTS_FOR_TIER

  if (!meetsFloor) return 'rated'

  if (ratingAvg >= PRESENTER_HIGHLY_TRUSTED_MIN_RATING && reviewCount >= PRESENTER_HIGHLY_TRUSTED_MIN_REVIEWS) {

    return 'highlyTrusted'

  }

  if (
    ratingAvg >= PRESENTER_TRUSTED_MIN_RATING &&
    (reviewCount >= PRESENTER_TRUSTED_MIN_REVIEWS ||
      orgReviewedEventCount >= PRESENTER_MIN_ORG_REVIEWED_EVENTS_FOR_TIER)
  ) {
    return 'trusted'
  }

  return 'rated'

}



export function presenterReputationTierLabel(
  tier: PresenterReputationTier,
  reviewCount: number,
): string | null {
  if (reviewCount < PRESENTER_MIN_REVIEWS_FOR_TIER) return null
  if (tier === 'trusted') return 'Trusted educator'
  if (tier === 'highlyTrusted') return 'Highly trusted'
  return null
}

export function presenterFeedbackStatusLabel(reviewCount: number): string | null {
  if (reviewCount <= 0) return null
  if (reviewCount < PRESENTER_MIN_REVIEWS_FOR_TIER) return 'Limited feedback'
  return null
}



export function formatPresenterRating(ratingAvg: number, reviewCount: number): string {

  if (reviewCount <= 0 || !Number.isFinite(ratingAvg) || ratingAvg <= 0) return '-'

  return bayesianPresenterVendorRating(ratingAvg, reviewCount).toFixed(1)

}



export function presenterProfileKindLabel(profileKind: string): string | null {

  switch (profileKind) {

    case 'PRES':

      return 'Presenter'

    case 'AUTHOR':

      return 'Author'

    case 'BOTH':

      return 'Presenter & author'

    case 'PHOTO':

      return 'Photographer'

    default:

      return null

  }

}



export { presenterRoleLabel, formatProfileFocusLabels } from './presenter-focus.js'


