import { Link } from 'react-router-dom'

import VendorProductFallback from '@/components/vendors/VendorProductFallback'
import { cn } from '@/lib/cn'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import { formatMoney } from '@/lib/vendor-shop-display'
import {
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from '@/lib/vendor-reputation-display'
import { VENDOR_FEEDBACK_HELPER } from '@c2k/shared'

export type VendorCardProps = {
  vendor: {
    id?: number | string
    slug?: string
    name: string
    category?: string | null
    tags?: string[]
    categories?: string[]
    rating?: number
    verifiedFeedbackCount?: number
    reviewCount?: number
    shipsTo?: string
    upcomingEvents?: number
    logoUrl?: string | null
    listingImageUrl?: string | null
    bannerUrl?: string | null
    featuredListingTitle?: string
    featuredListingPriceCents?: number
    featuredListingCurrency?: string
    conventionSlot?: { conventionName: string; dateLabel: string; eventCount?: number }
    onlineOnly?: boolean
  }
  /** Lower visual weight for cards deeper in mobile lists */
  compact?: boolean
}

export default function VendorCard({ vendor, compact = false }: VendorCardProps) {
  const {
    id,
    slug,
    name,
    category,
    tags = [],
    categories = [],
    rating = 0,
    verifiedFeedbackCount = 0,
    shipsTo,
    logoUrl,
    listingImageUrl,
    bannerUrl,
    featuredListingTitle,
    featuredListingPriceCents,
    featuredListingCurrency,
    conventionSlot,
    onlineOnly,
  } = vendor

  const verifiedCount = verifiedFeedbackCount > 0 ? verifiedFeedbackCount : 0
  const tier = vendorReputationTier(rating, verifiedCount)
  const tierLabel = vendorReputationTierLabel(tier)
  const showStars = tier === 'rated' && rating > 0
  const displayRating = formatVendorRating(rating, verifiedCount)

  const linkTarget = slug ?? (id != null ? String(id) : '')
  const shopHref =
    linkTarget ?
      conventionSlot ?
        `/vendors/${encodeURIComponent(linkTarget)}#vending-soon`
      : `/vendors/${encodeURIComponent(linkTarget)}`
    : '#'
  const chipCategory = category ?? categories[0]
  const productTitle = featuredListingTitle?.trim() || name
  const priceLabel =
    featuredListingPriceCents != null ?
      formatMoney(featuredListingPriceCents, featuredListingCurrency ?? 'USD')
    : null
  const vendingLabel =
    conventionSlot ?
      conventionSlot.conventionName ?
        `Vending at ${conventionSlot.conventionName}`
      : conventionSlot.eventCount && conventionSlot.eventCount > 1 ?
        `Vending · ${conventionSlot.dateLabel} +${conventionSlot.eventCount - 1}`
      : `Vending · ${conventionSlot.dateLabel}`
    : null

  const heroImageUrl = listingImageUrl?.trim() || bannerUrl?.trim() || null
  const hasListingImage = Boolean(heroImageUrl)
  const hasLogo = Boolean(logoUrl?.trim())

  const chipItems: string[] = []
  if (chipCategory) chipItems.push(chipCategory)
  if (shipsTo) chipItems.push(`Ships to ${shipsTo}`)
  for (const tag of tags) {
    if (tag === chipCategory) continue
    chipItems.push(tag)
  }
  const visibleChips = chipItems.slice(0, 2)
  const extraChipCount = Math.max(0, chipItems.length - visibleChips.length)

  const imageFrameClass = cn(
    'relative block w-full overflow-hidden bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid',
    compact ? 'aspect-[2/1] max-h-36' : 'aspect-[4/3] max-h-52',
  )

  return (
    <article
      className={cn(
        cardSurfaceSolidClass,
        cardSurfaceInteractiveClass,
        'flex min-w-0 flex-col overflow-hidden',
        compact && 'rounded-xl',
      )}
    >
      <Link to={shopHref} className={imageFrameClass} aria-label={`View ${name}`}>
        {!compact ?
          <span className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-dc-border/60 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {name}
          </span>
        : null}
        {vendingLabel && !compact ?
          <span className="absolute top-3 right-3 z-10 flex max-w-[55%] items-center gap-1 rounded-full bg-dc-accent px-2 py-1 text-[10px] font-semibold text-dc-accent-foreground shadow-md">
            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="truncate">{vendingLabel}</span>
          </span>
        : null}
        {hasListingImage ?
          <img
            src={heroImageUrl!}
            alt=""
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        : hasLogo ?
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={logoUrl!}
              alt=""
              width={160}
              height={160}
              loading="lazy"
              decoding="async"
              className="max-h-[85%] max-w-[85%] object-contain"
            />
          </div>
        : <VendorProductFallback vendorName={name} category={chipCategory} compact={compact} className="h-full" />}
      </Link>

      <div className={cn('flex flex-1 flex-col gap-2', compact ? 'gap-1.5 p-3' : 'p-4')}>
        <Link
          to={shopHref}
          className={cn(
            'font-medium text-dc-text leading-snug line-clamp-2 hover:text-dc-accent',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {productTitle}
        </Link>
        <p className="text-xs text-dc-text-muted truncate">{name}</p>
        {priceLabel ?
          <p className={cn('font-semibold text-dc-accent', compact ? 'text-sm' : 'text-base')}>{priceLabel}</p>
        : null}
        {visibleChips.length > 0 ?
          <div className="flex flex-wrap items-center gap-1">
            {visibleChips.map((chip, i) => (
              <span
                key={chip}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  i === 0 && chip === chipCategory ?
                    'bg-dc-accent/15 text-dc-accent'
                  : 'bg-dc-elevated-solid text-dc-text-muted',
                )}
              >
                {chip}
              </span>
            ))}
            {extraChipCount > 0 ?
              <span className="rounded-md bg-dc-elevated-solid px-2 py-0.5 text-xs text-dc-muted">
                +{extraChipCount} more
              </span>
            : null}
          </div>
        : null}
        {!compact ?
          <div className="flex flex-wrap items-center gap-3 text-xs text-dc-muted">
            {onlineOnly ? <span>Online shop</span> : null}
            {tierLabel ?
              <span className="text-dc-text-muted">{tierLabel}</span>
            : showStars ?
              <span className="flex items-center gap-1">
                <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {displayRating}
              </span>
            : null}
          </div>
        : null}

        <p
          className="flex items-center gap-1 text-[10px] text-dc-muted"
          title="Purchases happen on the vendor's external store"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Sold externally
        </p>

        {verifiedCount > 0 && !showStars && !compact ?
          <p className="text-[10px] text-dc-muted leading-snug">{VENDOR_FEEDBACK_HELPER}</p>
        : null}

        <Link
          to={shopHref}
          className={cn(
            'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold',
            compact ?
              'border border-dc-border bg-dc-elevated-solid text-dc-text hover:border-dc-accent-border hover:text-dc-accent'
            : 'bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover',
          )}
        >
          Visit shop
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </Link>
      </div>
    </article>
  )
}
