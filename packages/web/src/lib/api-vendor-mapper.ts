import type { MockVendor } from '@/data/mock-data'

export type ApiVendorRow = {
  id: string
  slug: string
  displayName: string
  makerStory?: string | null
  shopPolicies?: {
    returns?: string | null
    customOrders?: string | null
    leadTime?: string | null
    shippingNotes?: string | null
  } | null
  bio?: string | null
  bannerUrl?: string | null
  logoUrl?: string | null
  website?: string | null
  category?: string | null
  tags?: string[] | null
  categories?: string[] | null
  rating?: number | null
  verifiedFeedbackCount?: number | null
  shipsTo?: string | null
  verified?: boolean | null
  externalStoreType?: string | null
  externalStorePublic?: Record<string, unknown> | null
  externalListingsSyncedAt?: string | null
  externalSyncError?: string | null
  usesEtsy?: boolean | null
  etsyShopUrl?: string | null
  etsyShopName?: string | null
  etsyListingsSyncedAt?: string | null
  etsySyncError?: string | null
  shopHeaderLayout?: 'OVERLAY' | 'BELOW' | null
  visibility?: 'PUBLIC' | 'MEMBERS' | 'HIDDEN' | null
  commissionStatus?: 'OPEN' | 'LIMITED' | 'CLOSED' | null
  commissionNotes?: string | null
  eckePublish?: boolean
  storefrontUrl?: string | null
  payments?: {
    processor: 'stripe' | 'external' | 'manual'
    externalPaymentUrl: string | null
    stripeReady: boolean
  } | null
}

export type VendorSpotlightRow = {
  vendorId: string
  vendorSlug: string
  shopName: string
  logoUrl: string | null
  listingTitle: string
  primaryImageUrl: string | null
  listingPriceCents?: number
  listingCurrency?: string
}

export type VendorInPersonRow = {
  vendorId: string
  slug: string
  displayName: string
  logoUrl: string | null
  eventId: string
  eventTitle: string
  startsAt: string
}

function storefrontUrlFromRow(row: ApiVendorRow): string | undefined {
  if (row.storefrontUrl) return row.storefrontUrl
  const t = row.externalStoreType ?? 'none'
  const pub = row.externalStorePublic as Record<string, string | undefined> | null | undefined
  if (t === 'link_only') {
    return pub?.storefrontUrl ?? row.website ?? undefined
  }
  if (t === 'shopify' && pub?.shopifyShop) {
    const host = pub.shopifyShop.replace(/^https?:\/\//, '').split('/')[0]
    return `https://${host}`
  }
  if (t === 'woocommerce' && pub?.wooSiteUrl) {
    const u = pub.wooSiteUrl.trim()
    return /^https?:\/\//i.test(u) ? u : `https://${u}`
  }
  return row.etsyShopUrl ?? row.website ?? undefined
}

export function mapApiVendorToMockVendor(
  row: ApiVendorRow,
  enrichment?: {
    listingImageUrl?: string | null
    listingTitle?: string | null
    listingPriceCents?: number
    listingCurrency?: string
    upcomingEvents?: number
    conventionSlot?: MockVendor['conventionSlot']
  },
): MockVendor {
  const category = row.category ?? null
  const tags = row.tags ?? []
  const displayCategories = category ?
    [category, ...tags.filter((t) => t.toLowerCase() !== category.toLowerCase())]
  : row.categories ?? []

  return {
    id: row.id,
    slug: row.slug,
    name: row.displayName,
    category,
    tags,
    categories: displayCategories,
    rating: row.rating ?? 0,
    verifiedFeedbackCount: row.verifiedFeedbackCount ?? 0,
    shipsTo: row.shipsTo ?? 'US',
    upcomingEvents: enrichment?.upcomingEvents ?? 0,
    shopUrl: storefrontUrlFromRow(row),
    description: (row.makerStory?.trim() || row.bio) ?? undefined,
    logoUrl: row.logoUrl ?? null,
    bannerUrl: row.bannerUrl ?? null,
    shopHeaderLayout: row.shopHeaderLayout === 'BELOW' ? 'BELOW' : 'OVERLAY',
    listingImageUrl: enrichment?.listingImageUrl ?? null,
    featuredListingTitle: enrichment?.listingTitle ?? undefined,
    featuredListingPriceCents: enrichment?.listingPriceCents,
    featuredListingCurrency: enrichment?.listingCurrency,
    conventionSlot: enrichment?.conventionSlot,
    upcomingEventList: [],
  }
}

export function buildVendorEnrichmentMaps(
  spotlight: VendorSpotlightRow[],
  inPerson: VendorInPersonRow[],
): {
  spotlightByVendorId: Map<string, VendorSpotlightRow>
  inPersonByVendorId: Map<string, VendorInPersonRow[]>
} {
  const spotlightByVendorId = new Map<string, VendorSpotlightRow>()
  for (const row of spotlight) spotlightByVendorId.set(row.vendorId, row)

  const inPersonByVendorId = new Map<string, VendorInPersonRow[]>()
  for (const row of inPerson) {
    const list = inPersonByVendorId.get(row.vendorId) ?? []
    list.push(row)
    inPersonByVendorId.set(row.vendorId, list)
  }
  return { spotlightByVendorId, inPersonByVendorId }
}

export function enrichmentForVendor(
  vendorId: string,
  maps: ReturnType<typeof buildVendorEnrichmentMaps>,
): {
  listingImageUrl?: string | null
  listingTitle?: string | null
  listingPriceCents?: number
  listingCurrency?: string
  upcomingEvents?: number
  conventionSlot?: MockVendor['conventionSlot']
} {
  const spot = maps.spotlightByVendorId.get(vendorId)
  const upcoming = maps.inPersonByVendorId.get(vendorId) ?? []
  const first = upcoming[0]
  return {
    listingImageUrl: spot?.primaryImageUrl ?? null,
    listingTitle: spot?.listingTitle ?? null,
    listingPriceCents: spot?.listingPriceCents,
    listingCurrency: spot?.listingCurrency,
    upcomingEvents: upcoming.length,
    conventionSlot:
      first ?
        {
          conventionName: first.eventTitle,
          dateLabel: new Date(first.startsAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          eventCount: upcoming.length,
        }
      : undefined,
  }
}
