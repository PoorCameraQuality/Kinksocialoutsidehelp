import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CommunityPlacesMap from '@/components/places/CommunityPlacesMap'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { mediaDisplayUrl } from '@/lib/media-display-url'

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'dungeon_club', label: 'Dungeons & clubs' },
  { value: 'nude_beach', label: 'Nude beaches' },
  { value: 'kink_friendly_hotel', label: 'Kink-friendly hotels' },
  { value: 'web_resource', label: 'Web resources' },
  { value: 'other', label: 'Other' },
] as const

type PlaceRow = {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  logoUrl?: string | null
  city: string | null
  region: string | null
  country: string | null
  lat?: number | null
  lng?: number | null
  linkedOrganization?: { slug: string; displayName: string } | null
}

function placeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

type BrowseProps = {
  initialCategory?: string
  category?: string
  onCategoryChange?: (value: string) => void
  omitToolbar?: boolean
  omitSuggestForm?: boolean
}

export function PlacesCategoryToolbar({
  category,
  onCategoryChange,
}: {
  category: string
  onCategoryChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((c) => (
        <button
          key={c.value || 'all'}
          type="button"
          onClick={() => onCategoryChange(c.value)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            category === c.value ?
              'border-dc-accent-border/40 bg-dc-accent/15 text-dc-accent'
            : 'border-dc-border text-dc-text-muted hover:text-dc-text'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

export function PlacesLocationNotice() {
  return null
}

export function PlacesSuggestForm({ category }: { category: string }) {
  const [suggestName, setSuggestName] = useState('')
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null)

  const submitSuggestion = async () => {
    const name = suggestName.trim()
    if (!name || suggestBusy) return
    setSuggestBusy(true)
    setSuggestNotice(null)
    try {
      const r = await fetch('/api/v1/community-places/suggestions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: category || 'other',
        }),
      })
      if (r.ok) {
        setSuggestName('')
        setSuggestNotice('Thanks. Your suggestion is pending moderation.')
      } else {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setSuggestNotice(j.error ?? 'Could not submit suggestion.')
      }
    } catch {
      setSuggestNotice('Network error. Try again.')
    } finally {
      setSuggestBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dc-border p-4">
      <h3 className="text-sm font-semibold text-dc-text">Suggest a place</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={suggestName}
          onChange={(e) => setSuggestName(e.target.value)}
          placeholder="Venue name"
          className="flex-1 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={suggestBusy || !suggestName.trim()}
          onClick={() => void submitSuggestion()}
          className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground disabled:opacity-50"
        >
          {suggestBusy ? 'Sending…' : 'Submit'}
        </button>
      </div>
      {suggestNotice ? <p className="text-sm text-dc-muted">{suggestNotice}</p> : null}
    </div>
  )
}

export default function CommunityPlacesBrowse({
  initialCategory = '',
  category: controlledCategory,
  onCategoryChange,
  omitToolbar = false,
  omitSuggestForm = false,
}: BrowseProps) {
  const [internalCategory, setInternalCategory] = useState(initialCategory)
  const category = controlledCategory ?? internalCategory
  const setCategory = onCategoryChange ?? setInternalCategory

  const [items, setItems] = useState<PlaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (category) p.set('category', category)
      const r = await fetch(`/api/v1/community-places?${p.toString()}`, { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        return
      }
      const data = (await r.json()) as { items: PlaceRow[] }
      setItems(data.items ?? [])
    } catch {
      setError('Failed to load places')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (controlledCategory === undefined) setInternalCategory(initialCategory)
  }, [initialCategory, controlledCategory])

  const mapPlaces = useMemo(
    () =>
      items.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        city: p.city,
        region: p.region,
      })),
    [items],
  )

  return (
    <div className="space-y-6">
      {!omitToolbar ?
        <>
          <PlacesCategoryToolbar category={category} onCategoryChange={setCategory} />
          {!loading && mapPlaces.some((p) => p.lat != null && p.lng != null) ?
            <CommunityPlacesMap places={mapPlaces} className="h-80 w-full" />
          : null}
        </>
      : null}

      {error ? <LoadErrorBanner message={error} onRetry={() => void load()} /> : null}
      {loading ?
        <p className="text-sm text-dc-muted">Loading places…</p>
      : items.length === 0 ?
        <EmptyState inline title="No places yet" message="Be the first to suggest a venue for the community directory." />
      : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((p) => {
            const logoSrc = mediaDisplayUrl(p.logoUrl)
            return (
              <li key={p.id} className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4">
                <div className="flex items-start gap-3">
                  {logoSrc ?
                    <Link to={`/places/${encodeURIComponent(p.slug)}`} className="shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-dc-border bg-dc-elevated-solid">
                        <img
                          src={logoSrc}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </Link>
                  : <Link
                      to={`/places/${encodeURIComponent(p.slug)}`}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-solid text-xs font-semibold text-dc-muted"
                    >
                      {placeInitials(p.name)}
                    </Link>
                  }
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/places/${encodeURIComponent(p.slug)}`}
                      className="font-semibold text-dc-text hover:text-dc-accent"
                    >
                      {p.name}
                    </Link>
                    <p className="mt-1 text-xs capitalize text-dc-muted">{p.category.replace(/_/g, ' ')}</p>
                    {p.linkedOrganization ?
                      <Link
                        to={`/orgs/${encodeURIComponent(p.linkedOrganization.slug)}`}
                        className="mt-2 inline-flex text-xs font-semibold text-dc-accent hover:underline"
                      >
                        Managed organization · {p.linkedOrganization.displayName}
                      </Link>
                    : null}
                  </div>
                </div>
                {(p.city || p.region || p.country) ?
                  <p className="mt-3 text-sm text-dc-text-muted">
                    {[p.city, p.region, p.country].filter(Boolean).join(', ')}
                  </p>
                : null}
                {p.description ?
                  <p className="mt-2 line-clamp-3 text-sm text-dc-text-muted">{p.description}</p>
                : null}
              </li>
            )
          })}
        </ul>
      )}

      {!omitSuggestForm ? <PlacesSuggestForm category={category} /> : null}
    </div>
  )
}
