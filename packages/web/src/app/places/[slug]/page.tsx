import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CommunityPlacesMap from '@/components/places/CommunityPlacesMap'
import VenueEventsList, { type VenueEventRow } from '@/components/places/VenueEventsList'
import VenueEckePanel from '@/components/ecke/VenueEckePanel'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type PlaceDetail = {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  logoUrl?: string | null
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  eckePublish?: boolean
  linkedOrganization?: { slug: string; displayName: string } | null
}

type Props = {
  slug?: string
}

export default function PlaceDetailPage({ slug: slugProp }: Props) {
  const params = useParams()
  const slug = slugProp ?? params.slug ?? ''
  const [place, setPlace] = useState<PlaceDetail | null>(null)
  const [linkedOrg, setLinkedOrg] = useState<{
    slug: string
    displayName: string
    logoUrl?: string | null
    bio?: string | null
    externalSiteUrl?: string | null
  } | null>(null)
  const [events, setEvents] = useState<VenueEventRow[]>([])
  const [viewerCanManageEcke, setViewerCanManageEcke] = useState(false)
  const [eckePublish, setEckePublish] = useState(false)
  const [eckeSaving, setEckeSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/v1/community-places/${encodeURIComponent(slug)}`, {
          credentials: 'include',
        })
        if (!r.ok) {
          if (!cancelled) {
            setError(r.status === 404 ? 'Place not found.' : `Could not load place (${r.status}).`)
            setPlace(null)
          }
          return
        }
        const data = (await r.json()) as {
          place: PlaceDetail
          linkedOrganization: typeof linkedOrg
          upcomingEvents: VenueEventRow[]
          viewerCanManageEcke?: boolean
        }
        if (cancelled) return
        setPlace(data.place)
        setLinkedOrg(data.linkedOrganization)
        setEvents(data.upcomingEvents ?? [])
        setViewerCanManageEcke(Boolean(data.viewerCanManageEcke))
        setEckePublish(Boolean(data.place.eckePublish))
      } catch {
        if (!cancelled) {
          setError('Network error loading place.')
          setPlace(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!slug) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <p className="text-sm text-dc-text-muted">Missing place slug.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-dc-elevated-muted p-12" aria-busy="true" />
  }

  if (error || !place) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <LoadErrorBanner message={error ?? 'Place not found.'} onRetry={() => window.location.reload()} />
        <Link to="/places" className="mt-4 inline-flex text-sm font-semibold text-dc-accent hover:underline">
          ← Back to places
        </Link>
      </div>
    )
  }

  const logoSrc = mediaDisplayUrl(place.logoUrl ?? linkedOrg?.logoUrl)
  const org = linkedOrg ?? place.linkedOrganization

  async function saveEckePublish(next: boolean) {
    if (!place) return
    setEckeSaving(true)
    try {
      const r = await fetch(`/api/v1/community-places/${encodeURIComponent(place.id)}/ecke-publish`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eckePublish: next }),
      })
      if (r.ok) setEckePublish(next)
    } finally {
      setEckeSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <Link to="/places" className="inline-flex text-sm font-semibold text-dc-accent hover:underline">
        ← All places
      </Link>

      <header className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <div className="flex flex-wrap items-start gap-4">
          {logoSrc ?
            <img src={logoSrc} alt="" className="h-16 w-16 rounded-xl border border-dc-border object-contain" />
          : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-dc-muted">{place.category.replace(/_/g, ' ')}</p>
            <h1 className="mt-1 text-2xl font-bold text-dc-text">{place.name}</h1>
            {(place.city || place.region || place.country) ?
              <p className="mt-2 text-sm text-dc-text-muted">
                {[place.city, place.region, place.country].filter(Boolean).join(', ')}
              </p>
            : null}
            {org ?
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to={`/orgs/${encodeURIComponent(org.slug)}`}
                  className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Organization hub
                </Link>
                {linkedOrg?.externalSiteUrl ?
                  <a
                    href={linkedOrg.externalSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-xl border border-dc-border px-4 text-sm font-semibold text-dc-text hover:border-dc-border-strong"
                  >
                    Website
                  </a>
                : null}
              </div>
            : null}
          </div>
        </div>
        {(place.description || linkedOrg?.bio) ?
          <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-dc-text-muted">
            {place.description ?? linkedOrg?.bio}
          </p>
        : null}
      </header>

      {viewerCanManageEcke ?
        <section className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-dc-text">ECKE publish</h2>
          <label className="flex items-start gap-2 text-sm text-dc-text cursor-pointer">
            <input
              type="checkbox"
              checked={eckePublish}
              disabled={eckeSaving}
              onChange={(e) => void saveEckePublish(e.target.checked)}
              className="mt-1"
            />
            <span>
              Allow this published place to sync to East Coast Kink Events. Exact addresses and member-only access
              details never publish.
            </span>
          </label>
          {eckePublish ?
            <VenueEckePanel placeId={place.id} />
          : null}
        </section>
      : null}

      <CommunityPlacesMap
        places={[{ id: place.id, slug: place.slug, name: place.name, lat: place.lat, lng: place.lng, city: place.city, region: place.region }]}
        className="h-80 w-full"
      />

      <VenueEventsList events={events} />
    </div>
  )
}
