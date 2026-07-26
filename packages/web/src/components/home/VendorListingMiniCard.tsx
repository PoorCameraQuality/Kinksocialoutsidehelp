import { Link } from 'react-router-dom'

import VendorProductFallback from '@/components/vendors/VendorProductFallback'

export type VendorListingMiniCardProps = {
  vendorSlug: string
  shopName: string
  listingTitle: string
  listingImageUrl?: string | null
  logoUrl?: string | null
  className?: string
}

export default function VendorListingMiniCard({
  vendorSlug,
  shopName,
  listingTitle,
  listingImageUrl,
  logoUrl,
  className = '',
}: VendorListingMiniCardProps) {
  const href = `/vendors/${encodeURIComponent(vendorSlug)}`
  const previewSrc = listingImageUrl ?? logoUrl ?? null

  return (
    <Link
      to={href}
      className={`group flex min-w-0 flex-col rounded-xl border border-dc-border bg-dc-surface-muted p-2.5 text-sm shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent-border/40 ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-dc-elevated-solid">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            width={176}
            height={132}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <VendorProductFallback vendorName={shopName} compact className="h-full" />
        )}
      </div>
      <p className="mt-2 line-clamp-2 min-h-0 break-words font-medium leading-snug text-dc-text">{listingTitle}</p>
      <p className="mt-0.5 line-clamp-1 min-h-0 text-xs text-dc-muted">{shopName}</p>
      <span className="mt-2 inline-flex w-full min-h-9 items-center justify-center rounded-lg bg-dc-accent px-2 text-center text-xs font-medium text-dc-text transition-colors group-hover:bg-dc-accent-hover">
        Visit shop
      </span>
    </Link>
  )
}
