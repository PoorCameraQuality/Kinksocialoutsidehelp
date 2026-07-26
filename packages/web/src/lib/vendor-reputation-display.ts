import { bayesianPresenterVendorRating, VENDOR_MIN_VERIFIED_FOR_STARS } from '@c2k/shared'



export type VendorReputationTier = 'newVendor' | 'limitedFeedback' | 'rated'



export function vendorReputationTier(_rating: number, verifiedCount: number): VendorReputationTier {

  if (verifiedCount <= 0) return 'newVendor'

  if (verifiedCount < VENDOR_MIN_VERIFIED_FOR_STARS) return 'limitedFeedback'

  return 'rated'

}



export function vendorReputationTierLabel(tier: VendorReputationTier): string | null {

  if (tier === 'newVendor') return 'New vendor'

  if (tier === 'limitedFeedback') return 'Limited feedback'

  return null

}



export type VendorFeedbackSummaryDisplay = {
  rating: number
  reviewCount: number
  verifiedFeedbackCount: number
  meetsPublicRatingThreshold: boolean
}

export function buildVendorFeedbackSummaryDisplay(
  rating: number,
  verifiedFeedbackCount: number,
): VendorFeedbackSummaryDisplay | null {
  if (verifiedFeedbackCount <= 0) return null
  const meetsPublicRatingThreshold = verifiedFeedbackCount >= VENDOR_MIN_VERIFIED_FOR_STARS
  return {
    rating: meetsPublicRatingThreshold && rating > 0 ? rating : 0,
    reviewCount: verifiedFeedbackCount,
    verifiedFeedbackCount,
    meetsPublicRatingThreshold,
  }
}

export function formatVendorRating(rating: number, verifiedCount: number): string {

  if (verifiedCount < VENDOR_MIN_VERIFIED_FOR_STARS || !Number.isFinite(rating) || rating <= 0) {

    return '-'

  }

  return bayesianPresenterVendorRating(rating, verifiedCount).toFixed(1)

}


