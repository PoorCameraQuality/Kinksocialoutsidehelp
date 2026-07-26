import { Link } from 'react-router-dom'

import VendorProductFallback from '@/components/vendors/VendorProductFallback'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import { cn } from '@/lib/cn'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import {
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from '@/lib/vendor-reputation-display'
import { vendorTarget } from '@/lib/moderation/report-targets'
import type { MockVendor } from '@/data/types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Props = {
  vendor: MockVendor
  /** Lower visual weight for cards deeper in mobile lists. */
  compact?: boolean
}

type Pill = { label: string; icon?: 'event' | 'external' | 'badge' }

/**
 * Directory-only vendor card. Frames each row as vendor DISCOVERY (not a
 * product listing): no prices, vendor name is primary, quiet signal pills,
 * and subtle/outline actions. Reserve solid rose for page-level actions.
 */
export default function VendorDirectoryCard({ vendor, compact = false }: Props) {
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
    upcomingEvents = 0,
    conventionSlot,
    logoUrl,
    listingImageUrl,
    bannerUrl,
    shopUrl,
    description,
    onlineOnly,
  } = vendor

  const verifiedCount = verifiedFeedbackCount > 0 ? verifiedFeedbackCount : 0
  const tier = vendorReputationTier(rating, verifiedCount)
  const tierLabel = vendorReputationTierLabel(tier)
  const showStars = tier === 'rated' && rating > 0
  const displayRating = formatVendorRating(rating, verifiedCount)

  const linkTarget = slug ?? (id != null ? String(id) : '')
  const vendsAtEvents = Boolean(conventionSlot) || upcomingEvents > 0
  const vendorHref =
    linkTarget ?
      vendsAtEvents ?
        `/vendors/${encodeURIComponent(linkTarget)}#vending-soon`
      : `/vendors/${encodeURIComponent(linkTarget)}`
    : '#'

  const specialty = category ?? categories[0] ?? null
  const serviceArea =
    onlineOnly ? 'Online · ships from shop'
    : shipsTo?.trim() ? `Ships to ${shipsTo.trim()}`
    : null

  const imageUrl = listingImageUrl?.trim() || bannerUrl?.trim() || null
  const hasImage = Boolean(imageUrl)
  const hasLogo = Boolean(logoUrl?.trim())

  // Quiet vendor signals — discovery context, never commerce/price emphasis.
  const pills: Pill[] = []
  if (vendsAtEvents) pills.push({ label: 'Vends at events', icon: 'event' })
  if (tierLabel) pills.push({ label: tierLabel, icon: 'badge' })
  if (shopUrl) pills.push({ label: 'External checkout', icon: 'external' })
  for (const tag of tags) {
    if (specialty && tag.toLowerCase() === specialty.toLowerCase()) continue
    pills.push({ label: tag })
  }
  const maxPills = compact ? 2 : 3
  const visiblePills = pills.slice(0, maxPills)
  const extraPillCount = Math.max(0, pills.length - visiblePills.length)

  const imageFrameClass = cn(
    'relative block w-full overflow-hidden bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid',
    compact ? 'aspect-[2/1] max-h-36' : 'aspect-[4/3] max-h-52',
  )

  const subtleActionClass =
    'inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm font-semibold text-dc-text transition-colors hover:border-dc-accent-border hover:text-dc-accent sm:px-4'

  const secondaryActionClass =
    'inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dc-border bg-transparent px-3 text-sm font-medium text-dc-text-muted transition-colors hover:border-dc-accent-border hover:text-dc-accent sm:px-4'

  return (
    <article
      className={cn(
        cardSurfaceSolidClass,
        cardSurfaceInteractiveClass,
        'flex min-w-0 flex-col overflow-hidden',
        compact && 'rounded-xl',
      )}
    >
      <Link to={vendorHref} className={imageFrameClass} aria-label={`View ${name}`}>
        {hasImage ?
          <img
            src={imageUrl!}
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
        : <VendorProductFallback vendorName={name} category={specialty} compact={compact} className="h-full" />}
      </Link>

      <div className={cn('flex flex-1 flex-col gap-2', compact ? 'gap-1.5 p-3' : 'p-4')}>
        <Link
          to={vendorHref}
          className={cn(
            'font-semibold text-dc-text leading-snug line-clamp-2 hover:text-dc-accent',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {name}
        </Link>

        {specialty ?
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-dc-text-muted">{specialty}</p>
        : null}

        {description && !compact ?
          <p className="line-clamp-2 text-xs leading-relaxed text-dc-text-muted">{description}</p>
        : null}

        {serviceArea ?
          <p className="flex items-center gap-1.5 text-xs text-dc-muted">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{serviceArea}</span>
          </p>
        : null}

        {visiblePills.length > 0 ?
          <div className="flex flex-wrap items-center gap-1">
            {visiblePills.map((pill) => (
              <span
                key={pill.label}
                className="inline-flex items-center gap-1 rounded-md bg-dc-elevated-solid px-2 py-0.5 text-[11px] font-medium text-dc-text-muted ring-1 ring-inset ring-dc-border"
              >
                {pill.icon === 'event' ?
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                : pill.icon === 'external' ?
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                : null}
                {pill.label}
              </span>
            ))}
            {extraPillCount > 0 ?
              <span className="rounded-md px-2 py-0.5 text-[11px] text-dc-muted">+{extraPillCount}</span>
            : null}
          </div>
        : null}

        {showStars ?
          <p className="flex items-center gap-1 text-xs text-dc-text-muted">
            <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {displayRating}
            <span className="text-dc-muted">· community reviewed</span>
          </p>
        : null}

        <div className="mt-auto flex items-stretch gap-2 pt-1">
          <Link to={vendorHref} className={subtleActionClass}>
            View vendor
          </Link>
          {shopUrl ?
            <a
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={secondaryActionClass}
            >
              Visit shop
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
          {typeof id === 'string' && UUID_RE.test(id) && linkTarget ?
            (() => {
              const target = vendorTarget(id)
              return (
                <CopyLinkOverflowMenu
                  path={`/vendors/${encodeURIComponent(linkTarget)}`}
                  className="shrink-0 self-center"
                  report={{
                    targetType: target.targetType,
                    targetId: target.targetId,
                    targetLabel: 'vendor',
                  }}
                />
              )
            })()
          : null}
        </div>

        {!shopUrl ?
          <p className="text-[11px] leading-snug text-dc-muted">External shop not linked yet.</p>
        : null}
      </div>
    </article>
  )
}
