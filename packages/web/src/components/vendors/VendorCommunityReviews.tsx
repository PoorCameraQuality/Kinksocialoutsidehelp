import { VENDOR_FEEDBACK_HELPER } from '@c2k/shared'
import {
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from '@/lib/vendor-reputation-display'

type Props = {
  rating: number
  reviewCount: number
  verifiedFeedbackCount?: number
  className?: string
}

export default function VendorCommunityReviews({
  rating,
  reviewCount,
  verifiedFeedbackCount,
  className = '',
}: Props) {
  const verifiedCount = verifiedFeedbackCount ?? reviewCount
  if (verifiedCount <= 0) return null

  const tier = vendorReputationTier(rating, verifiedCount)
  const tierLabel = vendorReputationTierLabel(tier)
  const showStars = tier === 'rated' && rating > 0
  const displayRating = formatVendorRating(rating, verifiedCount)

  return (
    <section
      className={`rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] ${className}`.trim()}
    >
      <h3 className="text-sm font-semibold text-dc-muted uppercase mb-3">Community feedback</h3>
      {showStars ?
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 text-2xl font-semibold text-dc-text">
            <svg className="h-7 w-7 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {displayRating}
            <span className="text-base font-normal text-dc-muted">/ 5</span>
          </span>
        </div>
      : tierLabel ?
        <p className="text-sm font-medium text-dc-text mb-2">{tierLabel}</p>
      : null}
      <p className="text-sm text-dc-text">
        {verifiedCount} verified community {verifiedCount === 1 ? 'interaction' : 'interactions'}
      </p>
      <p className="text-xs text-dc-muted mt-2 leading-relaxed">{VENDOR_FEEDBACK_HELPER}</p>
      <p className="text-xs text-dc-muted mt-2 leading-relaxed">
        Buyers leave private scores after purchase. Shop owners confirm the sale with photo proof but never see
        individual ratings. Only verified scores appear here.
      </p>
    </section>
  )
}
