/**
 * Maps live `/api/v1/events` rows into the event catalog UI shape.
 *
 * That shape is historically typed as `MockEvent` (shared with demo seeds) — it is
 * **not** mock-only data when populated from the API.
 */
import type { MockEvent } from '@/data/mock-data'
import type { AlphaContentLabel } from '@c2k/shared'
import { isEventFeatured } from '@/lib/event-featured'
import { mediaDisplayUrl } from '@/lib/media-display-url'

/** Catalog / list-card view model (same fields as demo `MockEvent`). */
export type EventCatalogItem = MockEvent

export type ApiEventListItem = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startsAt: string
  endsAt?: string | null
  category?: string | null
  tags?: string[] | null
  imageUrl?: string | null
  eventFormat?: string | null
  rsvpCount?: number | null
  hostVerified?: boolean | null
  hostUsername?: string | null
  hostDisplayName?: string | null
  groupId?: string | null
  organizationId?: string | null
  ticketPurchaseUrl?: string | null
  ticketingProvider?: string | null
  ticketEmbedUrl?: string | null
  /** Optional ticket fee (cents) for org Stripe Checkout on standalone events. */
  priceCents?: number | null
  organizationSlug?: string | null
  dressCode?: string | null
  expectedCostText?: string | null
  viewerPaidConfirmed?: boolean | null
  payments?: {
    processor: 'stripe' | 'external' | 'manual'
    externalPaymentUrl: string | null
    stripeReady: boolean
    orgSlug: string | null
  } | null
  virtualSessionStyle?: 'social' | 'education' | 'mixed' | null
  virtualAgenda?: string | null
  materialsUrl?: string | null
  recordingPolicy?: 'not_recorded' | 'live_only' | 'shared_with_registrants' | 'tbd' | null
  eventTimezone?: string | null
  hasVirtualJoinLink?: boolean
  joinLinkRedacted?: boolean
  locationRedacted?: boolean
  locationVisibility?: string | null
  publicLocationSummary?: string | null
  screeningQuestion?: string | null
  newcomerFriendly?: boolean | null
  accessibilityNotes?: string | null
  capacityMax?: number | null
  attendeeListVisibility?: string | null
  viewerRsvpApprovalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected' | null
  pendingRsvpApprovals?: number | null
  hasProgram?: boolean
  conventionSlug?: string | null
  programSlotCount?: number
  viewerRsvpStatus?: 'going' | 'maybe' | 'not_going' | 'waitlist' | null
  viewerMutualGoingCount?: number | null
  connectionRsvpPreview?: Array<{ username: string; avatarUrl?: string | null }> | null
  viewerCanManage?: boolean
  featured?: boolean | null
  featuredUntil?: string | null
  isFeatured?: boolean
  rsvpOpen?: boolean | null
  venuePlaceId?: string | null
  venuePlaceSlug?: string | null
  venuePlaceName?: string | null
  alphaLabel?: AlphaContentLabel
}

function formatEventDisplayDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase()
}

/** Prefer this name — maps API list rows to the catalog card view model. */
export function mapApiEventToCatalogItem(row: ApiEventListItem): EventCatalogItem {
  const fmt = row.eventFormat === 'virtual' ? 'virtual' : 'in-person'
  const loc =
    row.location?.trim() ?
      row.location.trim()
    : row.publicLocationSummary?.trim() ?
      row.publicLocationSummary.trim()
    : row.locationRedacted || row.joinLinkRedacted ?
      'Location shared after RSVP'
    : 'TBA'
  return {
    id: row.id,
    title: row.title,
    date: formatEventDisplayDate(row.startsAt),
    startsAt: row.startsAt,
    location: loc,
    rsvpCount: row.rsvpCount ?? 0,
    mutualGoingCount: row.viewerMutualGoingCount ?? undefined,
    connectionRsvpPreview: row.connectionRsvpPreview ?? undefined,
    hostVerified: !!row.hostVerified,
    imageUrl: mediaDisplayUrl(row.imageUrl ?? undefined),
    tags: row.tags ?? undefined,
    category: row.category ?? undefined,
    eventFormat: fmt,
    description: row.description ?? undefined,
    hostName: row.hostDisplayName ?? row.hostUsername ?? undefined,
    featured: !!row.featured,
    featuredUntil: row.featuredUntil ?? null,
    isFeatured: row.isFeatured ?? isEventFeatured(row),
    alphaLabel: row.alphaLabel,
  }
}

/** @deprecated Use `mapApiEventToCatalogItem` — “Mock” names the shared UI shape, not demo data. */
export const mapApiEventToMockEvent = mapApiEventToCatalogItem
