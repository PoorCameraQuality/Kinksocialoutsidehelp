import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PaymentsBuyerDisclaimer from '@/components/payments/PaymentsBuyerDisclaimer'
import { startVendorProductCheckout } from '@/hooks/useApiVendorStripe'
import { buildLoginHref } from '@/lib/auth-links'
import VendorExternalStorePanel from '@/components/VendorExternalStorePanel'
import VendorCatalogPanel from '@/components/vendors/VendorCatalogPanel'
import VendorShopAppearancePanel from '@/components/vendors/VendorShopAppearancePanel'
import VendorShopHeader from '@/components/vendors/VendorShopHeader'
import VendorShopBreadcrumbs from '@/components/vendors/VendorShopBreadcrumbs'
import VendorCommunityReviews from '@/components/vendors/VendorCommunityReviews'
import VendorShopSidebar from '@/components/vendors/VendorShopSidebar'
import { type VendorShopPerson } from '@/components/vendors/VendorShopPeople'
import VendorVendingSoonBanner from '@/components/vendors/VendorVendingSoonBanner'
import type { VendorShopHeaderLayout } from '@/components/vendors/VendorShopHeader'
import { useAuth } from '@/contexts/AuthContext'
import { getMockVendorById } from '@/data/mock-data'
import type { ApiVendorRow } from '@/lib/api-vendor-mapper'
import { mapApiVendorToMockVendor } from '@/lib/api-vendor-mapper'
import {
  buyCtaLabel,
  displayCategoriesFromVendor,
  displayListingSource,
  formatCommissionStatus,
  formatMoney,
  hasAnyShopPolicy,
  stripEckeImportNote,
  VENDOR_BROWSE_BUY_TAGLINE,
  VENDOR_STRIPE_PURCHASE_NOTE,
  vendorCheckoutDisclaimer,
  visitStoreLabel,
} from '@/lib/vendor-shop-display'
import { buildVendorFeedbackSummaryDisplay } from '@/lib/vendor-reputation-display'

type ListingItem = {
  id: string
  provider?: string
  source: string
  externalListingId?: string
  title: string
  priceCents: number
  currency: string
  primaryImageUrl: string | null
  listingUrl: string
  description?: string | null
}

type VendorHistoryItem = {
  eventId: string
  eventTitle: string
  startsAt: string
}

type VendorUpcomingItem = {
  eventId: string
  eventTitle: string
  startsAt: string
  conventionId: string | null
  conventionSlug: string | null
}

type VendorEventCredit = {
  id: string
  eventId: string
  eventName: string
  eventDate: string | null
  conventionId: string | null
  conventionSlug: string | null
  verified: boolean
}

type VendorFeedbackSummary = {
  rating: number
  reviewCount: number
  verifiedFeedbackCount?: number
  meetsPublicRatingThreshold?: boolean
}

function formatCreditDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso.includes('T') ? iso : `${iso}T12:00:00`).toLocaleDateString()
  } catch {
    return iso
  }
}

/** In-browser samples when the demo shop has no API listings yet (or API offline). */
function ropeDreamerFallbackListings(shopUrl: string): ListingItem[] {
  const link =
    shopUrl && shopUrl !== 'https://example.com' ? shopUrl : 'https://example.com/rope-dreamer-supply'
  return [
    {
      id: 'demo-rds-jute',
      source: 'native',
      title: '6mm jute starter hank (8 m)',
      priceCents: 4299,
      currency: 'USD',
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-jute/800/600',
      listingUrl: link,
    },
    {
      id: 'demo-rds-shears',
      source: 'native',
      title: 'Safety shears. Orange grip',
      priceCents: 1199,
      currency: 'USD',
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-shears/800/600',
      listingUrl: link,
    },
    {
      id: 'demo-rds-balm',
      source: 'native',
      title: 'Aftercare balm (travel tin)',
      priceCents: 899,
      currency: 'USD',
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-balm/800/600',
      listingUrl: link,
    },
    {
      id: 'demo-rds-blindfold',
      source: 'native',
      title: 'Bamboo-silk blindfold',
      priceCents: 2499,
      currency: 'USD',
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-blindfold/800/600',
      listingUrl: link,
    },
  ]
}

export default function VendorDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const [apiVendor, setApiVendor] = useState<ReturnType<typeof mapApiVendorToMockVendor> | null>(null)
  const [apiVendorRow, setApiVendorRow] = useState<ApiVendorRow | null>(null)
  const [listings, setListings] = useState<ListingItem[]>([])
  const [listingsExternalType, setListingsExternalType] = useState<string>('none')
  const [listingsSyncedAt, setListingsSyncedAt] = useState<string | null>(null)
  const [listingsPayments, setListingsPayments] = useState<ApiVendorRow['payments']>(null)
  const [checkoutBusyId, setCheckoutBusyId] = useState<string | null>(null)
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null)
  const [apiFetched, setApiFetched] = useState(false)
  const [blindRating, setBlindRating] = useState(8)
  const [blindNote, setBlindNote] = useState('')
  const [blindMsg, setBlindMsg] = useState<string | null>(null)
  const [blindProofKey, setBlindProofKey] = useState<string | null>(null)
  const [blindProofPreview, setBlindProofPreview] = useState<string | null>(null)
  const [blindProofUploading, setBlindProofUploading] = useState(false)
  const [pendingBlind, setPendingBlind] = useState<
    Array<{ id: string; createdAt: string; hasPurchaseProof: boolean }>
  >([])
  const [vendorHistory, setVendorHistory] = useState<VendorHistoryItem[]>([])
  const [vendorUpcoming, setVendorUpcoming] = useState<VendorUpcomingItem[]>([])
  const [vendorEventCredits, setVendorEventCredits] = useState<VendorEventCredit[]>([])
  const [feedbackSummary, setFeedbackSummary] = useState<VendorFeedbackSummary | null>(null)
  const [shopOwner, setShopOwner] = useState<VendorShopPerson | null>(null)
  const [shopCoOwners, setShopCoOwners] = useState<VendorShopPerson[]>([])
  const [canManageShop, setCanManageShop] = useState(false)
  const [isShopOwner, setIsShopOwner] = useState(false)

  const reloadVendorAndListings = useCallback(async () => {
    if (!id) return
    try {
      const [vr, lr] = await Promise.all([
        fetch(`/api/v1/vendors/${encodeURIComponent(id)}`, { credentials: 'include' }),
        fetch(`/api/v1/vendors/${encodeURIComponent(id)}/listings`, { credentials: 'include' }),
      ])
      if (vr.ok) {
        const data = (await vr.json()) as {
          vendor: ApiVendorRow
          owner?: VendorShopPerson | null
          coOwners?: VendorShopPerson[]
          history?: VendorHistoryItem[]
          upcoming?: VendorUpcomingItem[]
          eventCredits?: VendorEventCredit[]
          feedbackSummary?: VendorFeedbackSummary | null
          isOwner?: boolean
          isRunner?: boolean
          canManageShop?: boolean
        }
        if (data.vendor) {
          setApiVendorRow(data.vendor)
          setApiVendor(mapApiVendorToMockVendor(data.vendor))
          setShopOwner(data.owner ?? null)
          setShopCoOwners(Array.isArray(data.coOwners) ? data.coOwners : [])
          setIsShopOwner(Boolean(data.isOwner))
          setCanManageShop(Boolean(data.canManageShop))
          setVendorHistory(Array.isArray(data.history) ? data.history : [])
          setVendorUpcoming(Array.isArray(data.upcoming) ? data.upcoming : [])
          setVendorEventCredits(Array.isArray(data.eventCredits) ? data.eventCredits : [])
          setFeedbackSummary(data.feedbackSummary ?? null)
        }
      }
      if (lr.ok) {
        const ld = (await lr.json()) as {
          items: ListingItem[]
          externalStoreType?: string
          syncedAt?: string | null
          payments?: ApiVendorRow['payments']
        }
        setListings(Array.isArray(ld.items) ? ld.items : [])
        setListingsExternalType(ld.externalStoreType ?? 'none')
        setListingsSyncedAt(ld.syncedAt ?? null)
        setListingsPayments(ld.payments ?? null)
      }
    } catch {
      /* keep prior state */
    }
  }, [id])

  useEffect(() => {
    const paid = searchParams.get('paid')
    if (paid === '1') setCheckoutMsg('Payment received. The vendor’s Stripe account processes this sale.')
    else if (paid === 'cancel') setCheckoutMsg('Checkout canceled.')
  }, [searchParams])

  useEffect(() => {
    if (!id) {
      setApiFetched(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [vr, lr] = await Promise.all([
          fetch(`/api/v1/vendors/${encodeURIComponent(id)}`, { credentials: 'include' }),
          fetch(`/api/v1/vendors/${encodeURIComponent(id)}/listings`, { credentials: 'include' }),
        ])
        if (!cancelled && vr.ok) {
          const data = (await vr.json()) as {
            vendor: ApiVendorRow
            owner?: VendorShopPerson | null
            coOwners?: VendorShopPerson[]
            history?: VendorHistoryItem[]
            upcoming?: VendorUpcomingItem[]
            eventCredits?: VendorEventCredit[]
            feedbackSummary?: VendorFeedbackSummary | null
          }
          if (data.vendor) {
            setApiVendorRow(data.vendor)
            setApiVendor(mapApiVendorToMockVendor(data.vendor))
            setShopOwner(data.owner ?? null)
            setShopCoOwners(Array.isArray(data.coOwners) ? data.coOwners : [])
            setVendorHistory(Array.isArray(data.history) ? data.history : [])
            setVendorUpcoming(Array.isArray(data.upcoming) ? data.upcoming : [])
            setVendorEventCredits(Array.isArray(data.eventCredits) ? data.eventCredits : [])
            setFeedbackSummary(data.feedbackSummary ?? null)
          }
        }
        if (!cancelled && lr.ok) {
          const ld = (await lr.json()) as {
            items: ListingItem[]
            externalStoreType?: string
            syncedAt?: string | null
            payments?: ApiVendorRow['payments']
          }
          setListings(Array.isArray(ld.items) ? ld.items : [])
          setListingsExternalType(ld.externalStoreType ?? 'none')
          setListingsSyncedAt(ld.syncedAt ?? null)
          setListingsPayments(ld.payments ?? null)
        }
      } catch {
        /* fall back to mock */
      } finally {
        if (!cancelled) setApiFetched(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const mockVendor = id ? getMockVendorById(id) : undefined
  const source = apiVendor ?? mockVendor
  const mockFeedbackSummary =
    mockVendor && !feedbackSummary ?
      buildVendorFeedbackSummaryDisplay(mockVendor.rating, mockVendor.verifiedFeedbackCount ?? 0)
    : null
  const effectiveFeedbackSummary = feedbackSummary ?? mockFeedbackSummary

  const headerLayout: VendorShopHeaderLayout =
    apiVendorRow?.shopHeaderLayout === 'BELOW' ||
    (source && 'shopHeaderLayout' in source && source.shopHeaderLayout === 'BELOW') ?
      'BELOW'
    : 'OVERLAY'

  const vendor = source
    ? {
        id: source.id,
        name: source.name,
        categories: source.categories,
        rating: source.rating,
        shipsTo: source.shipsTo,
        shopUrl: source.shopUrl ?? 'https://example.com',
        description: source.description ?? 'Vendor details coming soon.',
        upcomingEvents: source.upcomingEventList ?? [],
        bannerUrl: source.bannerUrl,
        logoUrl: source.logoUrl,
      }
    : {
        id: 0,
        name: 'Vendor Not Found',
        categories: [] as string[],
        rating: 0,
        shipsTo: '',
        shopUrl: 'https://example.com',
        description: 'This vendor could not be found.',
        upcomingEvents: [] as Array<{
          id: number
          title: string
          date: string
          location: string
          rsvpCount: number
          hostVerified: boolean
        }>,
        bannerUrl: null as string | null | undefined,
        logoUrl: null as string | null | undefined,
      }

  const isRopeDemoShop =
    apiVendorRow?.slug === 'rope-dreamer-supply' || (typeof id === 'string' && id === 'rope-dreamer-supply')

  const displayListings: ListingItem[] =
    listings.length > 0 ? listings : isRopeDemoShop ? ropeDreamerFallbackListings(vendor.shopUrl) : listings

  const showingDemoListings = listings.length === 0 && isRopeDemoShop && displayListings.length > 0

  const manageVendorProfileId =
    canManageShop && !isShopOwner && apiVendorRow?.id ? apiVendorRow.id : null

  const loadPendingBlind = useCallback(async () => {
    if (!canManageShop || !id) return
    try {
      const r = await fetch(`/api/v1/vendors/${encodeURIComponent(id)}/blind-feedback/pending`, {
        credentials: 'include',
      })
      if (r.ok) {
        const d = (await r.json()) as {
          items: Array<{ id: string; createdAt: string; hasPurchaseProof: boolean }>
        }
        setPendingBlind(d.items ?? [])
      }
    } catch {
      /* ignore */
    }
  }, [canManageShop, id])

  useEffect(() => {
    void loadPendingBlind()
  }, [loadPendingBlind])

  const hasThirdPartyListings = displayListings.some((i) =>
    ['etsy', 'shopify', 'woocommerce'].includes(i.source)
  )
  const visitLabel = visitStoreLabel(apiVendorRow?.externalStoreType ?? listingsExternalType)
  const syncableConnected = ['etsy', 'shopify', 'woocommerce'].includes(listingsExternalType)
  const wooPub = apiVendorRow?.externalStorePublic as { wooSiteUrl?: string; shopifyShop?: string } | undefined

  const creditEventIds = useMemo(() => new Set(vendorEventCredits.map((c) => c.eventId)), [vendorEventCredits])
  const fallbackPastHistory = useMemo(() => {
    const nowMs = Date.now()
    return vendorHistory.filter(
      (h) => new Date(h.startsAt).getTime() < nowMs && !creditEventIds.has(h.eventId),
    )
  }, [vendorHistory, creditEventIds])
  const showCommunityAppearances =
    vendorEventCredits.length > 0 || fallbackPastHistory.length > 0

  useEffect(() => {
    if (window.location.hash !== '#vending-soon' || vendorUpcoming.length === 0) return
    const el = document.getElementById('vending-soon')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [vendorUpcoming.length, apiFetched])

  if (!apiFetched && id) {
    return (
      <div className="pb-6" aria-busy="true">
        <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 h-52 bg-dc-elevated-muted animate-pulse" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          <div className="h-28 animate-pulse rounded-2xl bg-dc-elevated-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <VendorShopHeader
        layout={headerLayout}
        name={vendor.name}
        rating={vendor.rating > 0 ? vendor.rating : 0}
        verifiedFeedbackCount={
          effectiveFeedbackSummary?.verifiedFeedbackCount ??
          effectiveFeedbackSummary?.reviewCount ??
          mockVendor?.verifiedFeedbackCount ??
          0
        }
        shipsTo={vendor.shipsTo}
        categories={displayCategoriesFromVendor(apiVendorRow, vendor.categories)}
        bannerUrl={vendor.bannerUrl}
        logoUrl={vendor.logoUrl}
        vendorProfileId={apiVendorRow?.id ?? null}
        shopPath={
          id ? `/vendors/${encodeURIComponent(apiVendorRow?.slug ?? id)}` : null
        }
        showReport={Boolean(apiVendorRow?.id)}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <VendorShopBreadcrumbs
          shopName={vendor.name}
          primaryCategory={apiVendorRow?.category ?? vendor.categories[0] ?? null}
        />

        {canManageShop && apiVendorRow ?
          <VendorShopAppearancePanel
            vendorSlug={apiVendorRow.slug}
            initialBannerUrl={apiVendorRow.bannerUrl ?? null}
            initialLogoUrl={apiVendorRow.logoUrl ?? null}
            initialLayout={apiVendorRow.shopHeaderLayout === 'BELOW' ? 'BELOW' : 'OVERLAY'}
            vendorProfileId={manageVendorProfileId}
            onSaved={() => void reloadVendorAndListings()}
          />
        : null}

        <div className="flex flex-col lg:flex-row gap-8">
          <VendorShopSidebar
            className="lg:hidden"
            shopName={vendor.name}
            logoUrl={vendor.logoUrl}
            storeUrl={vendor.shopUrl}
            visitLabel={visitLabel}
            owner={shopOwner}
            coOwners={shopCoOwners}
            shipsTo={vendor.shipsTo}
            commissionStatus={apiVendorRow?.commissionStatus ?? null}
            commissionNotes={apiVendorRow?.commissionNotes ?? null}
            shopPolicies={apiVendorRow?.shopPolicies ?? null}
            feedbackSummary={effectiveFeedbackSummary}
            listingsSyncedAt={listingsSyncedAt}
            hasThirdPartyListings={hasThirdPartyListings}
            externalStoreType={listingsExternalType}
          />

          <main className="flex-1 min-w-0">
          <VendorVendingSoonBanner
            className="mb-6"
            items={vendorUpcoming.map((item) => ({
              eventId: item.eventId,
              eventTitle: item.eventTitle,
              startsAt: item.startsAt,
              conventionSlug: item.conventionSlug,
            }))}
          />

          {canManageShop && apiVendorRow ? (
            <>
              <VendorCatalogPanel
                enabled
                vendorProfileId={manageVendorProfileId}
                onCatalogChange={() => void reloadVendorAndListings()}
              />
              <VendorExternalStorePanel
                externalStoreType={apiVendorRow.externalStoreType ?? 'none'}
                etsyShopUrl={apiVendorRow.etsyShopUrl ?? ''}
                wooSiteUrl={wooPub?.wooSiteUrl}
                shopifyShop={wooPub?.shopifyShop}
                syncedAt={apiVendorRow.externalListingsSyncedAt ?? apiVendorRow.etsyListingsSyncedAt ?? null}
                syncError={apiVendorRow.externalSyncError ?? apiVendorRow.etsySyncError ?? null}
                vendorProfileId={manageVendorProfileId}
                onUpdated={() => void reloadVendorAndListings()}
                variant="advanced"
              />
            </>
          ) : null}

          <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-6">
            <h3 className="text-sm font-semibold text-dc-muted uppercase mb-1">Products</h3>
            <p className="text-sm text-dc-text-muted mb-4">
              {(listingsPayments ?? apiVendorRow?.payments)?.stripeReady
                ? 'Browse on kink.social. Pay the seller via their Stripe account or their external store.'
                : VENDOR_BROWSE_BUY_TAGLINE}
            </p>
            {checkoutMsg ?
              <p className="text-xs text-dc-muted mb-3" role="status">
                {checkoutMsg}
              </p>
            : null}
            {(listingsPayments ?? apiVendorRow?.payments)?.stripeReady ||
            (listingsPayments ?? apiVendorRow?.payments)?.processor === 'external' ?
              <div className="mb-4">
                <PaymentsBuyerDisclaimer variant="short" />
              </div>
            : null}
            {showingDemoListings ?
              <p className="text-xs text-amber-200/85 mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                Showing sample products for this demo shop. After seed or real inventory loads, these placeholders disappear.
              </p>
            : null}
            {displayListings.length === 0 ? (
              <p className="text-dc-text-muted text-sm text-center py-8">
                {canManageShop ?
                  'No products yet. Add curated listings with a photo, description, and buy link above — or connect advanced store sync.'
                : syncableConnected ?
                  'No listings to show yet.'
                : 'No product listings to show yet.'}
              </p>
            ) : (
              <>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayListings.map((item) => {
                    const pay = listingsPayments ?? apiVendorRow?.payments
                    const canStripeBuy =
                      item.source === 'native' &&
                      !item.id.startsWith('demo-') &&
                      Boolean(pay?.stripeReady) &&
                      item.priceCents > 0
                    const hasRealListingUrl =
                      item.listingUrl &&
                      item.listingUrl !== '#' &&
                      /^https?:\/\//i.test(item.listingUrl)
                    return (
                    <li
                      key={`${item.source}-${item.id}`}
                      className="rounded-xl border border-dc-border bg-dc-elevated-solid overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-black/20 flex items-center justify-center overflow-hidden">
                        {item.primaryImageUrl ? (
                          <img src={item.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-dc-muted px-2 text-center">No image</span>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1 gap-2">
                        {displayListingSource(item.source) ?
                          <p className="text-xs uppercase tracking-wide text-dc-muted">
                            {displayListingSource(item.source)}
                          </p>
                        : null}
                        <p className="text-sm font-medium text-dc-text line-clamp-2">{item.title}</p>
                        {item.description?.trim() ?
                          <p className="text-xs text-dc-text-muted line-clamp-3">{item.description.trim()}</p>
                        : null}
                        <p className="text-sm text-dc-accent">{formatMoney(item.priceCents, item.currency)}</p>
                        {canStripeBuy ?
                          isAuthenticated ?
                            <button
                              type="button"
                              disabled={checkoutBusyId === item.id}
                              onClick={() => {
                                void (async () => {
                                  setCheckoutBusyId(item.id)
                                  setCheckoutMsg(null)
                                  try {
                                    const url = await startVendorProductCheckout({
                                      vendorKey: apiVendorRow?.slug ?? id,
                                      productId: item.id,
                                    })
                                    window.location.href = url
                                  } catch (e) {
                                    setCheckoutMsg(e instanceof Error ? e.message : 'Checkout failed')
                                  } finally {
                                    setCheckoutBusyId(null)
                                  }
                                })()
                              }}
                              className="mt-auto inline-flex justify-center items-center min-h-10 rounded-lg bg-dc-accent/90 hover:bg-dc-accent text-dc-text text-sm font-medium disabled:opacity-50"
                            >
                              {checkoutBusyId === item.id ? 'Starting…' : 'Buy with Stripe'}
                            </button>
                          : (
                            <Link
                              to={buildLoginHref(`/vendors/${encodeURIComponent(id)}`)}
                              className="mt-auto inline-flex justify-center items-center min-h-10 rounded-lg bg-dc-accent/90 hover:bg-dc-accent text-dc-text text-sm font-medium"
                            >
                              Sign in to buy
                            </Link>
                          )
                        : hasRealListingUrl ?
                          <a
                            href={item.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto inline-flex justify-center items-center min-h-10 rounded-lg bg-dc-accent/90 hover:bg-dc-accent text-dc-text text-sm font-medium"
                          >
                            {buyCtaLabel(item.source)}
                          </a>
                        : (
                          <p className="mt-auto text-xs text-dc-muted text-center">Contact the seller to purchase.</p>
                        )}
                        {canStripeBuy ?
                          <p className="text-xs text-dc-muted text-center">{VENDOR_STRIPE_PURCHASE_NOTE}</p>
                        : item.source !== 'native' ?
                          <p className="text-xs text-dc-muted text-center">
                            {vendorCheckoutDisclaimer(item.source === 'woocommerce' ? 'woocommerce' : item.source)}
                          </p>
                        : null}
                      </div>
                    </li>
                    )
                  })}
                </ul>
                {hasThirdPartyListings ? (
                  <p className="text-xs text-dc-muted mt-4 pt-4 border-t border-dc-border">
                    {VENDOR_BROWSE_BUY_TAGLINE} {vendorCheckoutDisclaimer(listingsExternalType)} Prices and
                    availability may change on the seller&apos;s store. This platform is not affiliated with Etsy,
                    Shopify, or WooCommerce.
                  </p>
                ) : null}
              </>
            )}
          </div>

          {effectiveFeedbackSummary && effectiveFeedbackSummary.reviewCount > 0 ?
            <VendorCommunityReviews
              className="mb-6"
              rating={effectiveFeedbackSummary.rating}
              reviewCount={effectiveFeedbackSummary.reviewCount}
              verifiedFeedbackCount={
                effectiveFeedbackSummary.verifiedFeedbackCount ?? effectiveFeedbackSummary.reviewCount
              }
            />
          : null}

          <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-6">
            <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">About</h3>
            {apiVendorRow?.makerStory?.trim() ?
              <p className="text-dc-text text-sm leading-relaxed mb-3">{apiVendorRow.makerStory.trim()}</p>
            : null}
            <p className="text-dc-text-muted whitespace-pre-wrap leading-relaxed">
              {stripEckeImportNote(vendor.description)}
            </p>
            {apiVendorRow?.commissionStatus ? (
              <p className="text-xs text-dc-muted mt-3">
                {formatCommissionStatus(apiVendorRow.commissionStatus)}
                {apiVendorRow.commissionNotes ? ` · ${apiVendorRow.commissionNotes}` : ''}
              </p>
            ) : null}
          </div>

          {apiVendorRow?.shopPolicies && hasAnyShopPolicy(apiVendorRow.shopPolicies) ? (
            <details className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-6 group">
              <summary className="text-sm font-semibold text-dc-muted uppercase cursor-pointer list-none flex items-center justify-between">
                Policies
                <span className="text-dc-muted group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="mt-4 space-y-4 text-sm text-dc-text-muted">
                {apiVendorRow.shopPolicies.returns?.trim() ? (
                  <div>
                    <p className="text-xs font-semibold text-dc-text uppercase mb-1">Returns</p>
                    <p className="whitespace-pre-wrap">{apiVendorRow.shopPolicies.returns}</p>
                  </div>
                ) : null}
                {apiVendorRow.shopPolicies.customOrders?.trim() ? (
                  <div>
                    <p className="text-xs font-semibold text-dc-text uppercase mb-1">Custom orders</p>
                    <p className="whitespace-pre-wrap">{apiVendorRow.shopPolicies.customOrders}</p>
                  </div>
                ) : null}
                {apiVendorRow.shopPolicies.leadTime?.trim() ? (
                  <div>
                    <p className="text-xs font-semibold text-dc-text uppercase mb-1">Lead time</p>
                    <p className="whitespace-pre-wrap">{apiVendorRow.shopPolicies.leadTime}</p>
                  </div>
                ) : null}
                {apiVendorRow.shopPolicies.shippingNotes?.trim() ? (
                  <div>
                    <p className="text-xs font-semibold text-dc-text uppercase mb-1">Shipping</p>
                    <p className="whitespace-pre-wrap">{apiVendorRow.shopPolicies.shippingNotes}</p>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}

          {showCommunityAppearances ? (
            <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-6">
              <h3 className="text-sm font-semibold text-dc-muted uppercase mb-2">Community appearances</h3>
              <p className="text-xs text-dc-muted mb-4">
                Listed from organizer event data after the event ended; not a platform endorsement of this vendor or
                event.
              </p>
              {vendorEventCredits.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-dc-text-muted uppercase mb-2">Vended at</p>
                  <ul className="space-y-2">
                    {vendorEventCredits.map((c) => (
                      <li key={c.id} className="text-sm text-dc-text-muted">
                        <span className="text-dc-text font-medium">{c.eventName}</span>
                        {c.eventDate ? ` · ${formatCreditDate(c.eventDate)}` : ''}
                        {c.conventionSlug ? (
                          <>
                            {' · '}
                            <Link
                              to={`/conventions/${encodeURIComponent(c.conventionSlug)}`}
                              className="text-dc-accent hover:underline"
                            >
                              View convention
                            </Link>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {fallbackPastHistory.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-dc-text-muted uppercase mb-2">Recent events</p>
                  <ul className="space-y-2">
                    {fallbackPastHistory.map((item) => (
                      <li key={`past-${item.eventId}-${item.startsAt}`} className="text-sm text-dc-text-muted">
                        {item.eventTitle} · {new Date(item.startsAt).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <details className="mb-6 group">
            <summary className="cursor-pointer text-lg font-semibold text-dc-text list-none flex items-center justify-between rounded-2xl border border-dc-border bg-dc-elevated/80 px-5 py-4">
              Blind feedback
              <span className="text-dc-muted text-sm group-open:rotate-180 transition-transform" aria-hidden>
                ▾
              </span>
            </summary>
            <div className="pt-4">
            {!canManageShop && !isAuthenticated ?
              <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-5 shadow-[var(--dc-shadow-soft)] mb-4">
                <p className="text-sm text-dc-text-muted">
                  Log in to leave private purchase feedback. Upload a receipt or product photo so the shop owner can confirm you bought from them. They never see your score.
                </p>
              </div>
            : null}
            {canManageShop && apiVendorRow ? (
              <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-4">
                <p className="text-sm text-dc-text-muted mb-3">
                  Purchasers submit a private 1–10 score plus a purchase photo (receipt or item). Review the photo to confirm they bought from you. You never see their rating.{' '}
                  <strong className="text-amber-200">Verification cannot be undone.</strong>
                </p>
                {pendingBlind.length === 0 ? (
                  <p className="text-sm text-dc-muted">No pending verifications.</p>
                ) : (
                  <ul className="space-y-4">
                    {pendingBlind.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4"
                      >
                        <p className="text-xs text-dc-muted mb-3">
                          Submitted {new Date(p.createdAt).toLocaleString()}
                        </p>
                        {p.hasPurchaseProof ?
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-dc-text-muted uppercase mb-2">
                              Purchase proof
                            </p>
                            <a
                              href={`/api/v1/vendors/${encodeURIComponent(id)}/blind-feedback/${encodeURIComponent(p.id)}/proof`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block max-w-xs overflow-hidden rounded-lg border border-dc-border bg-black/20"
                            >
                              <img
                                src={`/api/v1/vendors/${encodeURIComponent(id)}/blind-feedback/${encodeURIComponent(p.id)}/proof`}
                                alt="Purchase proof submitted by buyer"
                                className="max-h-48 w-full object-contain"
                              />
                            </a>
                            <p className="text-xs text-dc-muted mt-1">Click to open full size in a new tab.</p>
                          </div>
                        : (
                          <p className="text-sm text-amber-200/90 mb-3">No purchase photo attached. Cannot verify.</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!p.hasPurchaseProof}
                            onClick={() => {
                              if (
                                !confirm(
                                  'Verify this purchase? You reviewed the photo and confirm this person bought from you. You will not see their rating. This cannot be undone.'
                                )
                              )
                                return
                              void (async () => {
                                const r = await fetch(
                                  `/api/v1/vendors/${encodeURIComponent(id)}/blind-feedback/${encodeURIComponent(p.id)}/verify`,
                                  { method: 'POST', credentials: 'include' }
                                )
                                if (r.ok) {
                                  await loadPendingBlind()
                                  await reloadVendorAndListings()
                                }
                              })()
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-dc-accent text-dc-text disabled:opacity-40"
                          >
                            Verify purchase
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !confirm(
                                  'Dismiss this submission? The buyer can submit again later with new proof.'
                                )
                              )
                                return
                              void (async () => {
                                const r = await fetch(
                                  `/api/v1/vendors/${encodeURIComponent(id)}/blind-feedback/${encodeURIComponent(p.id)}/dismiss`,
                                  { method: 'POST', credentials: 'include' }
                                )
                                if (r.ok) await loadPendingBlind()
                              })()
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg border border-dc-border text-dc-text-muted hover:text-dc-text"
                          >
                            Not a real purchase
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {!canManageShop && isAuthenticated ?
              <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-6 shadow-[var(--dc-shadow-soft)] mb-4">
                <p className="text-sm text-dc-text-muted mb-3">
                  Leave private 1–10 feedback. Upload a receipt or photo of what you bought. The shop owner reviews that photo to confirm the purchase but never sees your score.
                </p>
                <label className="block text-sm font-medium text-dc-text mb-1">
                  Purchase proof <span className="text-dc-accent">(required)</span>
                </label>
                <p className="text-xs text-dc-muted mb-2">Receipt, order confirmation, or a photo of the item itself.</p>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full max-w-md text-sm text-dc-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-dc-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-dc-text"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (blindProofPreview) URL.revokeObjectURL(blindProofPreview)
                    setBlindProofPreview(URL.createObjectURL(file))
                    setBlindProofKey(null)
                    setBlindMsg(null)
                    setBlindProofUploading(true)
                    void (async () => {
                      try {
                        const fd = new FormData()
                        fd.append('purpose', 'vendor_branding')
                        fd.append('file', file)
                        const up = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
                        const data = (await up.json().catch(() => ({}))) as { key?: string; error?: string }
                        if (!up.ok || !data.key) {
                          setBlindMsg(data.error ?? 'Could not upload purchase proof')
                          setBlindProofKey(null)
                          return
                        }
                        setBlindProofKey(data.key)
                      } catch {
                        setBlindMsg('Could not upload purchase proof')
                        setBlindProofKey(null)
                      } finally {
                        setBlindProofUploading(false)
                      }
                    })()
                  }}
                />
                {blindProofUploading ?
                  <p className="text-xs text-dc-muted mt-2">Uploading…</p>
                : null}
                {blindProofPreview && blindProofKey ?
                  <img
                    src={blindProofPreview}
                    alt="Purchase proof preview"
                    className="mt-3 max-h-40 rounded-lg border border-dc-border object-contain"
                  />
                : null}
                <label className="block text-sm text-dc-muted mb-1 mt-4">Rating (1–10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={blindRating}
                  onChange={(e) => setBlindRating(Number(e.target.value))}
                  className="w-full max-w-sm"
                />
                <p className="text-sm text-dc-text mb-3">{blindRating}</p>
                <label className="block text-sm text-dc-muted mb-1">Optional note (only you / moderators may see per policy)</label>
                <textarea
                  value={blindNote}
                  onChange={(e) => setBlindNote(e.target.value.slice(0, 2000))}
                  rows={3}
                  className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                />
                <button
                  type="button"
                  disabled={blindProofUploading || !blindProofKey}
                  onClick={() => {
                    if (!blindProofKey) {
                      setBlindMsg('Upload a purchase proof photo before submitting.')
                      return
                    }
                    void (async () => {
                      setBlindMsg(null)
                      const r = await fetch(`/api/v1/vendors/${encodeURIComponent(id)}/blind-feedback`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rating: blindRating,
                          body: blindNote.trim() || undefined,
                          purchaseProofKey: blindProofKey,
                        }),
                      })
                      const j = (await r.json().catch(() => ({}))) as { error?: string }
                      if (r.ok) {
                        setBlindMsg('Thanks. Your feedback was recorded. The shop owner will review your purchase photo.')
                        setBlindNote('')
                        setBlindProofKey(null)
                        if (blindProofPreview) URL.revokeObjectURL(blindProofPreview)
                        setBlindProofPreview(null)
                      } else {
                        setBlindMsg(j.error ?? 'Could not submit')
                      }
                    })()
                  }}
                  className="mt-3 px-4 py-2 rounded-xl bg-dc-accent text-dc-text text-sm font-medium disabled:opacity-40"
                >
                  Submit blind feedback
                </button>
                {blindMsg ? <p className="mt-2 text-sm text-dc-text-muted">{blindMsg}</p> : null}
              </div>
            : null}
            {!isAuthenticated ? (
              <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-12 text-center shadow-[var(--dc-shadow-soft)]">
                <p className="text-dc-text-muted">Log in to leave blind feedback.</p>
              </div>
            ) : null}
            </div>
          </details>
        </main>

          <div className="hidden lg:block lg:w-80 shrink-0">
            <VendorShopSidebar
              className="lg:sticky lg:top-24"
              shopName={vendor.name}
              logoUrl={vendor.logoUrl}
              storeUrl={vendor.shopUrl}
              visitLabel={visitLabel}
              owner={shopOwner}
              coOwners={shopCoOwners}
              shipsTo={vendor.shipsTo}
              commissionStatus={apiVendorRow?.commissionStatus ?? null}
              commissionNotes={apiVendorRow?.commissionNotes ?? null}
              shopPolicies={apiVendorRow?.shopPolicies ?? null}
              feedbackSummary={effectiveFeedbackSummary}
              listingsSyncedAt={listingsSyncedAt}
              hasThirdPartyListings={hasThirdPartyListings}
              externalStoreType={listingsExternalType}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
