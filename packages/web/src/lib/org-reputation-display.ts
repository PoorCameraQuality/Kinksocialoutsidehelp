import { bayesianOrgRating, ORG_MIN_PUBLIC_REVIEWS_FOR_STARS } from '@c2k/shared'



export type OrgReputationTier = 'unrated' | 'newOrg' | 'limitedFeedback' | 'rated' | 'trusted' | 'highlyTrusted'



export const ORG_TRUSTED_MIN_RATING = 4.0

export const ORG_TRUSTED_MIN_REVIEWS = 3

export const ORG_HIGHLY_TRUSTED_MIN_RATING = 4.5

export const ORG_HIGHLY_TRUSTED_MIN_REVIEWS = 8



export function orgReputationTier(rating: number, reviewCount: number): OrgReputationTier {

  if (reviewCount <= 0) return 'newOrg'

  if (reviewCount < ORG_MIN_PUBLIC_REVIEWS_FOR_STARS) return 'limitedFeedback'

  if (rating >= ORG_HIGHLY_TRUSTED_MIN_RATING && reviewCount >= ORG_HIGHLY_TRUSTED_MIN_REVIEWS) {

    return 'highlyTrusted'

  }

  if (rating >= ORG_TRUSTED_MIN_RATING && reviewCount >= ORG_TRUSTED_MIN_REVIEWS) {

    return 'trusted'

  }

  return 'rated'

}



export function orgReputationTierLabel(tier: OrgReputationTier): string | null {

  if (tier === 'newOrg') return 'New organization'

  if (tier === 'limitedFeedback') return 'Limited feedback'

  if (tier === 'trusted') return 'Trusted'

  if (tier === 'highlyTrusted') return 'Highly trusted'

  return null

}



export function formatOrgRating(rating: number, reviewCount: number): string {

  if (reviewCount < ORG_MIN_PUBLIC_REVIEWS_FOR_STARS || !Number.isFinite(rating) || rating <= 0) {

    return '-'

  }

  return bayesianOrgRating(rating, reviewCount).toFixed(1)

}


