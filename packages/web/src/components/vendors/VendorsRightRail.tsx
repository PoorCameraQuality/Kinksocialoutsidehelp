import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import { mockVendorInPersonRows } from '@/data/mock-home-surface'
import type { MockVendor } from '@/data/types'
import { vendorsFeatured, vendorsVendingSoon } from '@/lib/vendor-directory-utils'
import {
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from '@/lib/vendor-reputation-display'

type Props = {
  vendors: MockVendor[]
  useDemoFallback: boolean
}

export default function VendorsRightRail({ vendors, useDemoFallback }: Props) {
  const vendingSoon = vendorsVendingSoon(vendors, 4)
  const featured = vendorsFeatured(vendors, 3)
  const inPersonDemo = useDemoFallback ? mockVendorInPersonRows().slice(0, 4) : []

  return (
    <aside className={railAsideClass} aria-label="Vendor directory info">
      <RailCard title="Vending soon">
        {vendingSoon.length === 0 && inPersonDemo.length === 0 ?
          <p className="text-xs text-dc-text-muted">No upcoming event appearances listed yet.</p>
        : <ul className="space-y-3 text-sm">
            {useDemoFallback && inPersonDemo.length > 0 ?
              inPersonDemo.map((row) => (
                <li key={row.vendorId}>
                  <Link to={`/vendors/${encodeURIComponent(row.slug)}`} className="font-medium text-dc-text hover:text-dc-accent">
                    {row.displayName}
                  </Link>
                  <p className="text-xs text-dc-muted line-clamp-2">{row.eventTitle}</p>
                </li>
              ))
            : vendingSoon.map((v) => {
                const slug = v.slug ?? String(v.id)
                const eventName = v.conventionSlot?.conventionName ?? v.upcomingEventList?.[0]?.title
                return (
                  <li key={String(v.id)}>
                    <Link to={`/vendors/${encodeURIComponent(slug)}`} className="font-medium text-dc-text hover:text-dc-accent">
                      {v.name}
                    </Link>
                    {eventName ?
                      <p className="text-xs text-dc-muted line-clamp-2">{eventName}</p>
                    : v.conventionSlot?.dateLabel ?
                      <p className="text-xs text-dc-muted">{v.conventionSlot.dateLabel}</p>
                    : null}
                  </li>
                )
              })}
          </ul>
        }
      </RailCard>

      {featured.length > 0 ?
        <RailCard title="Featured vendors">
          <ul className="space-y-3">
            {featured.map((v) => {
              const slug = v.slug ?? String(v.id)
              return (
                <li key={String(v.id)} className="flex items-center gap-2">
                  <Link to={`/vendors/${encodeURIComponent(slug)}`} className="shrink-0">
                    {v.logoUrl ?
                      <img src={v.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    : <PlaceholderAvatar size="sm" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/vendors/${encodeURIComponent(slug)}`} className="block truncate text-sm font-medium text-dc-text hover:text-dc-accent">
                      {v.name}
                    </Link>
                    {(() => {
                      const verifiedCount = v.verifiedFeedbackCount ?? 0
                      const tier = vendorReputationTier(v.rating, verifiedCount)
                      const tierLabel = vendorReputationTierLabel(tier)
                      if (tierLabel) {
                        return <p className="text-xs text-dc-muted">{tierLabel}</p>
                      }
                      if (tier === 'rated' && v.rating > 0) {
                        return (
                          <p className="text-xs text-dc-muted">
                            {formatVendorRating(v.rating, verifiedCount)} rating
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>
                </li>
              )
            })}
          </ul>
        </RailCard>
      : null}

      <RailCard title="How vendor listings work">
        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-dc-text-muted">
          <li>Vendors create a profile and link their external shop.</li>
          <li>Kink Social shows previews, categories, and community context for discovery.</li>
          <li>Purchases, shipping, refunds, and custom orders happen on the vendor&apos;s own shop.</li>
        </ol>
      </RailCard>

      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text">Vendor safety</h3>
        <p className="mt-2 text-xs leading-relaxed text-dc-text-muted">
          Check policies, shipping regions, and event appearances before buying. Kink Social does not process orders or
          payments.
        </p>
        <Link to="/support" className="mt-2 inline-block text-xs font-medium text-dc-accent hover:underline">
          Safety tips
        </Link>
      </div>

      <div className="rounded-2xl border border-dc-accent-border/60 bg-dc-accent-muted/30 p-4">
        <p className="text-sm font-semibold text-dc-accent">New to Kink Social vendors?</p>
        <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
          Add your vendor profile and link your external store.
        </p>
        <Link
          to="/vendors/onboarding"
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          List your shop
        </Link>
      </div>
    </aside>
  )
}


