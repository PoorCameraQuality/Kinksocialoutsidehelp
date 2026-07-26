import { Link } from 'react-router-dom'

import type { VendorShopPerson } from '@/components/vendors/VendorShopPeople'
import {
  formatRelativeCatalogSync,
  isCatalogStale,
  isPlaceholderStoreUrl,
  vendorCheckoutDisclaimer,
  vendorTrustBullets,
} from '@/lib/vendor-shop-display'
import {
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from '@/lib/vendor-reputation-display'
import { VENDOR_FEEDBACK_HELPER } from '@c2k/shared'

type ShopPolicies = {
  returns?: string | null
  customOrders?: string | null
  leadTime?: string | null
  shippingNotes?: string | null
}

type FeedbackSummary = {
  rating: number
  reviewCount: number
  verifiedFeedbackCount?: number
}

type Props = {
  shopName: string
  logoUrl?: string | null
  storeUrl?: string | null
  visitLabel: string
  owner: VendorShopPerson | null
  coOwners?: VendorShopPerson[]
  shipsTo?: string | null
  commissionStatus?: string | null
  commissionNotes?: string | null
  shopPolicies?: ShopPolicies | null
  feedbackSummary?: FeedbackSummary | null
  listingsSyncedAt?: string | null
  hasThirdPartyListings?: boolean
  externalStoreType?: string | null
  className?: string
}

function personLabel(person: VendorShopPerson): string {
  return person.displayName?.trim() || person.username
}

export default function VendorShopSidebar({
  shopName,
  logoUrl,
  storeUrl,
  visitLabel,
  owner,
  coOwners = [],
  shipsTo,
  commissionStatus,
  commissionNotes,
  shopPolicies,
  feedbackSummary,
  listingsSyncedAt,
  hasThirdPartyListings = false,
  externalStoreType,
  className = '',
}: Props) {
  const hasStore = !isPlaceholderStoreUrl(storeUrl)
  const trustBullets = vendorTrustBullets({
    shipsTo,
    commissionStatus,
    commissionNotes,
    shopPolicies,
  })

  return (
    <aside
      className={`rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 shadow-[var(--dc-shadow-soft)] ${className}`.trim()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted mb-3">Sold by</p>

      <div className="flex items-start gap-3 mb-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid flex items-center justify-center">
          {logoUrl ?
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          : <span className="text-lg font-semibold text-dc-muted">{shopName.charAt(0)}</span>}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-dc-text leading-snug">{shopName}</p>
          {owner ?
            <p className="text-sm text-dc-text-muted mt-1">
              <Link
                to={`/profile/${encodeURIComponent(owner.username)}`}
                className="text-dc-accent hover:underline font-medium"
              >
                {personLabel(owner)}
              </Link>
            </p>
          : null}
          {coOwners.length > 0 ?
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted mt-2 mb-0.5">
              People behind this shop
            </p>
          : null}
          {coOwners.map((co) => (
            <p key={co.username} className="text-xs text-dc-muted mt-0.5">
              <Link
                to={`/profile/${encodeURIComponent(co.username)}`}
                className="text-dc-accent hover:underline"
              >
                {personLabel(co)}
              </Link>
            </p>
          ))}
        </div>
      </div>

      {hasStore ?
        <a
          href={storeUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-text hover:bg-dc-accent-hover"
        >
          {visitLabel}
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      : null}

      {owner ?
        <Link
          to={`/messaging?user=${encodeURIComponent(owner.username)}`}
          className="mb-4 flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40"
        >
          Message on Kink Social
        </Link>
      : null}

      {trustBullets.length > 0 ?
        <ul className="mb-4 space-y-1.5 text-sm text-dc-text-muted">
          {trustBullets.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-dc-accent shrink-0" aria-hidden>
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      : null}

      {feedbackSummary && feedbackSummary.reviewCount > 0 ?
        (() => {
          const verifiedCount = feedbackSummary.verifiedFeedbackCount ?? feedbackSummary.reviewCount
          const tier = vendorReputationTier(feedbackSummary.rating, verifiedCount)
          const tierLabel = vendorReputationTierLabel(tier)
          const showStars = tier === 'rated' && feedbackSummary.rating > 0
          return (
            <div className="mb-4 space-y-1 text-sm">
              {showStars ?
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {formatVendorRating(feedbackSummary.rating, verifiedCount)}
                  </span>
                  <span className="text-dc-text-muted">
                    · {verifiedCount} verified {verifiedCount === 1 ? 'interaction' : 'interactions'}
                  </span>
                </div>
              : tierLabel ?
                <p className="text-dc-text-muted">{tierLabel}</p>
              : null}
              <p className="text-xs text-dc-muted">{VENDOR_FEEDBACK_HELPER}</p>
            </div>
          )
        })()
      : null}

      <p className="text-xs text-dc-muted leading-relaxed border-t border-dc-border pt-3">
        {vendorCheckoutDisclaimer(externalStoreType)}
      </p>

      {hasThirdPartyListings ?
        listingsSyncedAt ?
          <p
            className={`text-xs mt-2 ${isCatalogStale(listingsSyncedAt) ? 'text-amber-200/90' : 'text-dc-muted'}`}
          >
            Catalog updated {formatRelativeCatalogSync(listingsSyncedAt)}
            {isCatalogStale(listingsSyncedAt) ?
              '. Prices and stock are confirmed on the vendor store.'
            : null}
          </p>
        : <p className="text-xs mt-2 text-amber-200/90">
            Catalog not synced yet. Prices and stock are confirmed on the vendor store.
          </p>
      : null}
    </aside>
  )
}
