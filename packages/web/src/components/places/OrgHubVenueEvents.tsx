import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import VenueEventsList, { type VenueEventRow } from '@/components/places/VenueEventsList'

export default function OrgHubVenueEvents({ orgSlug }: { orgSlug: string }) {
  const [events, setEvents] = useState<VenueEventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/venue-events`, {
          credentials: 'include',
        })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { events?: VenueEventRow[] }
        if (!cancelled) setEvents(data.events ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSlug])

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
  }

  return (
    <div className="max-lg:order-2 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Venue &amp; map</h2>
        <Link
          to={`/places/${encodeURIComponent(orgSlug)}`}
          className="text-xs font-semibold text-dc-accent hover:underline"
        >
          View on Kinky Map →
        </Link>
      </div>
      <VenueEventsList events={events} title="Events at this venue" />
    </div>
  )
}

function isVenueListing(flags?: {
  listingKind?: string
  eckeDungeonListing?: boolean
}): boolean {
  return (
    flags?.listingKind === 'venue' ||
    flags?.listingKind === 'dungeon' ||
    flags?.eckeDungeonListing === true
  )
}

export { isVenueListing }
