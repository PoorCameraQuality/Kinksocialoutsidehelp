import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import {
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from '@/lib/vendor-reputation-display'
import { vendorTarget } from '@/lib/moderation/report-targets'

export type VendorShopHeaderLayout = 'OVERLAY' | 'BELOW'

type Props = {
  layout: VendorShopHeaderLayout
  name: string
  rating: number
  verifiedFeedbackCount?: number
  shipsTo: string
  categories: string[]
  bannerUrl?: string | null
  logoUrl?: string | null
  /** Canonical vendor profile id — enables Report when present (API-backed shops). */
  vendorProfileId?: string | null
  /** Path for copy-link overflow, e.g. `/vendors/slug`. */
  shopPath?: string | null
  showReport?: boolean
}

function LogoBlock({
  logoUrl,
  className,
  glass,
}: {
  logoUrl?: string | null
  className?: string
  /** Lighter frosted backing so a parent glass card stays cohesive over the banner. */
  glass?: boolean
}) {
  return (
    <div
      className={`shrink-0 rounded-2xl flex items-center justify-center overflow-hidden border border-dc-border ${
        glass ? 'bg-black/20 backdrop-blur-md' : 'bg-dc-elevated-solid'
      } ${className ?? ''}`}
    >
      {logoUrl ?
        <img src={logoUrl} alt="" className="w-full h-full object-cover" />
      : <svg className="w-10 h-10 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      }
    </div>
  )
}

function MetaBlock({
  name,
  rating,
  verifiedFeedbackCount = 0,
  shipsTo,
  categories,
  onDark,
}: {
  name: string
  rating: number
  verifiedFeedbackCount?: number
  shipsTo: string
  categories: string[]
  onDark: boolean
}) {
  const tier = vendorReputationTier(rating, verifiedFeedbackCount)
  const tierLabel = vendorReputationTierLabel(tier)
  const showStars = tier === 'rated' && rating > 0
  const displayRating = formatVendorRating(rating, verifiedFeedbackCount)

  return (
    <div className="min-w-0">
      <h1
        className={
          onDark ? 'text-2xl font-bold text-dc-text drop-shadow-md' : 'text-2xl font-bold text-dc-text'
        }
      >
        {name}
      </h1>
      <div className={`flex flex-wrap items-center gap-2 mt-2 ${onDark ? 'text-dc-text/95' : ''}`}>
        {showStars ?
          <span className="flex items-center gap-1 text-amber-400">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {displayRating}
          </span>
        : tierLabel ?
          <span className={`text-sm ${onDark ? 'text-dc-text/90' : 'text-dc-muted'}`}>{tierLabel}</span>
        : null}
        <span className={`text-sm ${onDark ? 'text-dc-text/80' : 'text-dc-muted'}`}>
          Ships to {shipsTo}
        </span>
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {categories.slice(0, 4).map((cat, i) => (
            <span
              key={cat}
              className={
                i === 0 ?
                  onDark ?
                    'px-2 py-0.5 text-xs font-medium bg-dc-accent/25 text-dc-accent rounded-md backdrop-blur-sm border border-dc-accent/30'
                  : 'px-2 py-0.5 text-xs font-medium bg-dc-accent/15 text-dc-accent rounded-md'
                : onDark ?
                  'px-2 py-0.5 text-xs bg-black/35 text-dc-text/95 rounded-md backdrop-blur-sm border border-dc-border'
                : 'px-2 py-0.5 text-xs bg-dc-elevated-solid text-dc-text-muted rounded-md'
              }
            >
              {cat}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Full-bleed shop hero: banner strip + OVERLAY (text on image) or BELOW (card row for logo + title). */
export default function VendorShopHeader({
  layout,
  name,
  rating,
  verifiedFeedbackCount = 0,
  shipsTo,
  categories,
  bannerUrl,
  logoUrl,
  vendorProfileId,
  shopPath,
  showReport = false,
}: Props) {
  const fullBleed = 'relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2'
  const reportTarget =
    showReport && vendorProfileId ? vendorTarget(vendorProfileId) : null
  const overflow =
    shopPath ?
      <CopyLinkOverflowMenu
        path={shopPath}
        className="shrink-0"
        report={
          reportTarget ?
            {
              targetType: reportTarget.targetType,
              targetId: reportTarget.targetId,
              targetLabel: 'vendor',
            }
          : undefined
        }
      />
    : null

  if (layout === 'BELOW') {
    return (
      <>
        <div className={`${fullBleed}`}>
          <div className="h-44 sm:h-52 md:h-60 bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid relative overflow-hidden">
            {bannerUrl ?
              <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            : null}
            <div
              className="absolute inset-0 bg-gradient-to-t from-dc-surface/90 via-transparent to-transparent pointer-events-none"
              aria-hidden
            />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-10 mb-6">
          <div className="rounded-2xl border border-dc-border-strong bg-black/10 backdrop-blur-2xl backdrop-saturate-150 p-5 flex flex-col sm:flex-row gap-5 sm:items-center">
            <LogoBlock glass logoUrl={logoUrl} className="w-20 h-20 sm:w-24 sm:h-24 border-dc-border-strong" />
            <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
              <MetaBlock
                name={name}
                rating={rating}
                verifiedFeedbackCount={verifiedFeedbackCount}
                shipsTo={shipsTo}
                categories={categories}
                onDark
              />
              {overflow}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={`${fullBleed} mb-6`}>
      <div className="relative min-h-[13rem] sm:min-h-[15rem] overflow-hidden bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid">
        {bannerUrl ?
          <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : null}
        <div className="absolute inset-0 bg-gradient-to-t from-dc-surface via-dc-surface/75 to-dc-surface/20 pointer-events-none" />
        <div className="relative flex flex-col justify-end min-h-[13rem] sm:min-h-[15rem] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {logoUrl ?
              <LogoBlock logoUrl={logoUrl} className="w-20 h-20 sm:w-24 sm:h-24 border-white/25" />
            : null}
            <div className="min-w-0 flex-1 flex items-end justify-between gap-3">
              <MetaBlock
                name={name}
                rating={rating}
                verifiedFeedbackCount={verifiedFeedbackCount}
                shipsTo={shipsTo}
                categories={categories}
                onDark
              />
              {overflow}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
