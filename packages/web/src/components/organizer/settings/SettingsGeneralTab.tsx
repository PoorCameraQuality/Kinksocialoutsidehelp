import { useEffect, useState } from 'react'
import {
  PublicHubPreviewCard,
  SettingsSection,
  SettingsSubsectionHeader,
} from '@/components/organizer/settings/settings-ui'
import { cn } from '@/lib/cn'
import { VISIBILITY_OPTIONS } from '@/lib/organizer/org-settings-utils'
import type { OrgFlags } from '@/components/org/OrgAdminDashboard'

type OrgSlice = {
  slug: string
  displayName: string
  visibility: string
  featureFlags: OrgFlags
  externalSiteUrl: string | null
  showExternalEmbed: boolean
  logoUrl: string | null
  bannerUrl: string | null
}

type Props = {
  org: OrgSlice
  publicHubHref: string
  aboutHref: string
  onPatch: (body: Record<string, unknown>, msg?: string) => Promise<boolean>
}

const LISTING_TYPE_OPTIONS = [
  {
    value: 'community' as const,
    title: 'Community org',
    description: 'Groups, clubs, and collectives. Listed on the org directory.',
  },
  {
    value: 'venue' as const,
    title: 'Permanent venue',
    description: 'Dungeon, club, or playspace. Also listed on the Kinky Map and ECKE dungeons.',
  },
]

const VENUE_CATEGORY_OPTIONS = [
  { value: 'dungeon_club', label: 'Dungeon / club' },
  { value: 'nude_beach', label: 'Nude beach' },
  { value: 'kink_friendly_hotel', label: 'Kink-friendly hotel' },
  { value: 'web_resource', label: 'Web resource' },
  { value: 'other', label: 'Other' },
]

function normalizeListingKind(flags: OrgFlags): 'community' | 'venue' {
  if (flags.listingKind === 'venue' || flags.listingKind === 'dungeon' || flags.eckeDungeonListing) {
    return 'venue'
  }
  return 'community'
}

export default function SettingsGeneralTab({ org, publicHubHref, aboutHref, onPatch }: Props) {
  const [displayName, setDisplayName] = useState(org.displayName)
  const [visibility, setVisibility] = useState(org.visibility)
  const [externalUrl, setExternalUrl] = useState(org.externalSiteUrl ?? '')
  const [embedOn, setEmbedOn] = useState(org.showExternalEmbed)
  const [listingKind, setListingKind] = useState<'community' | 'venue'>(() =>
    normalizeListingKind(org.featureFlags),
  )
  const [venueCategory, setVenueCategory] = useState(
    org.featureFlags.venueCategory ?? 'dungeon_club',
  )
  const [city, setCity] = useState(org.featureFlags.city ?? '')
  const [region, setRegion] = useState(org.featureFlags.region ?? '')
  const [country, setCountry] = useState(org.featureFlags.country ?? 'US')
  const [lat, setLat] = useState(org.featureFlags.lat != null ? String(org.featureFlags.lat) : '')
  const [lng, setLng] = useState(org.featureFlags.lng != null ? String(org.featureFlags.lng) : '')
  const [addressVisibility, setAddressVisibility] = useState<'city_only' | 'full'>(
    org.featureFlags.addressVisibility ?? 'city_only',
  )
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingExternal, setSavingExternal] = useState(false)
  const [savingListing, setSavingListing] = useState(false)

  const profileDirty =
    displayName.trim() !== org.displayName || visibility !== org.visibility
  const externalDirty =
    externalUrl.trim() !== (org.externalSiteUrl ?? '').trim() || embedOn !== org.showExternalEmbed

  const savedListingKind = normalizeListingKind(org.featureFlags)
  const listingDirty =
    listingKind !== savedListingKind ||
    (listingKind === 'venue' &&
      (venueCategory !== (org.featureFlags.venueCategory ?? 'dungeon_club') ||
        city.trim() !== (org.featureFlags.city ?? '').trim() ||
        region.trim() !== (org.featureFlags.region ?? '').trim() ||
        country.trim() !== (org.featureFlags.country ?? 'US').trim() ||
        lat.trim() !==
          (org.featureFlags.lat != null ? String(org.featureFlags.lat) : '').trim() ||
        lng.trim() !==
          (org.featureFlags.lng != null ? String(org.featureFlags.lng) : '').trim() ||
        addressVisibility !== (org.featureFlags.addressVisibility ?? 'city_only')))

  useEffect(() => {
    if (profileDirty || externalDirty || listingDirty) return
    setDisplayName(org.displayName)
    setVisibility(org.visibility)
    setExternalUrl(org.externalSiteUrl ?? '')
    setEmbedOn(org.showExternalEmbed)
    setListingKind(normalizeListingKind(org.featureFlags))
    setVenueCategory(org.featureFlags.venueCategory ?? 'dungeon_club')
    setCity(org.featureFlags.city ?? '')
    setRegion(org.featureFlags.region ?? '')
    setCountry(org.featureFlags.country ?? 'US')
    setLat(org.featureFlags.lat != null ? String(org.featureFlags.lat) : '')
    setLng(org.featureFlags.lng != null ? String(org.featureFlags.lng) : '')
    setAddressVisibility(org.featureFlags.addressVisibility ?? 'city_only')
  }, [org, profileDirty, externalDirty, listingDirty])

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await onPatch(
        { displayName: displayName.trim(), visibility },
        'Public profile saved.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveExternal() {
    setSavingExternal(true)
    try {
      const trimmed = externalUrl.trim()
      await onPatch(
        {
          externalSiteUrl: trimmed.length > 0 ? trimmed : null,
          showExternalEmbed: embedOn,
        },
        'External site settings saved.',
      )
    } finally {
      setSavingExternal(false)
    }
  }

  async function saveListing() {
    setSavingListing(true)
    try {
      const parsedLat = lat.trim() ? parseFloat(lat) : null
      const parsedLng = lng.trim() ? parseFloat(lng) : null
      const featureFlags: Record<string, unknown> = {
        listingKind,
        eckeDungeonListing: listingKind === 'venue',
      }
      if (listingKind === 'venue') {
        featureFlags.venueCategory = venueCategory
        featureFlags.city = city.trim() || null
        featureFlags.region = region.trim() || null
        featureFlags.country = country.trim() || null
        featureFlags.lat = parsedLat != null && Number.isFinite(parsedLat) ? parsedLat : null
        featureFlags.lng = parsedLng != null && Number.isFinite(parsedLng) ? parsedLng : null
        featureFlags.addressVisibility = addressVisibility
      }
      await onPatch({ featureFlags }, 'Listing type saved.')
    } finally {
      setSavingListing(false)
    }
  }

  const embedFeatureOff = !org.featureFlags.externalEmbedEnabled

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
      <div className="space-y-5">
        <SettingsSection>
          <SettingsSubsectionHeader
            title="Public profile"
            subtitle="How your organization appears in discovery and on the hub header."
          />
          <label className="block text-sm font-medium text-dc-text" htmlFor="org-display-name">
            Display name
          </label>
          <input
            id="org-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={255}
            className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
          />

          <p className="mt-5 text-sm font-medium text-dc-text">Visibility</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {VISIBILITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value)}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left transition-colors',
                  visibility === opt.value ?
                    'border-dc-accent bg-dc-accent/10'
                  : 'border-dc-border bg-dc-surface/30 hover:border-dc-border-strong',
                )}
              >
                <p className="text-sm font-semibold text-dc-text">{opt.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{opt.description}</p>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={savingProfile || !displayName.trim() || !profileDirty}
            onClick={() => void saveProfile()}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </SettingsSection>

        <SettingsSection>
          <SettingsSubsectionHeader
            title="Listing type"
            subtitle="Choose whether this org is a community hub or a permanent venue on the Kinky Map."
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {LISTING_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setListingKind(opt.value)}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left transition-colors',
                  listingKind === opt.value ?
                    'border-dc-accent bg-dc-accent/10'
                  : 'border-dc-border bg-dc-surface/30 hover:border-dc-border-strong',
                )}
              >
                <p className="text-sm font-semibold text-dc-text">{opt.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{opt.description}</p>
              </button>
            ))}
          </div>

          {listingKind === 'venue' ?
            <div className="mt-5 space-y-4 rounded-xl border border-dc-border/80 bg-dc-surface/20 p-4">
              <label className="block text-sm font-medium text-dc-text" htmlFor="venue-category">
                Venue category
              </label>
              <select
                id="venue-category"
                value={venueCategory}
                onChange={(e) =>
                  setVenueCategory(
                    e.target.value as 'dungeon_club' | 'nude_beach' | 'kink_friendly_hotel' | 'web_resource' | 'other',
                  )
                }
                className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
              >
                {VENUE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-dc-text" htmlFor="venue-city">
                    City
                  </label>
                  <input
                    id="venue-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={128}
                    className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dc-text" htmlFor="venue-region">
                    State / region
                  </label>
                  <input
                    id="venue-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    maxLength={128}
                    placeholder="MD"
                    className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-dc-text" htmlFor="venue-country">
                    Country
                  </label>
                  <input
                    id="venue-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    maxLength={128}
                    className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dc-text" htmlFor="venue-lat">
                    Latitude (optional)
                  </label>
                  <input
                    id="venue-lat"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dc-text" htmlFor="venue-lng">
                    Longitude (optional)
                  </label>
                  <input
                    id="venue-lng"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-dc-text">Address visibility</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">
                    <input
                      type="radio"
                      name="address-visibility"
                      checked={addressVisibility === 'city_only'}
                      onChange={() => setAddressVisibility('city_only')}
                    />
                    City only on public listings
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">
                    <input
                      type="radio"
                      name="address-visibility"
                      checked={addressVisibility === 'full'}
                      onChange={() => setAddressVisibility('full')}
                    />
                    Full address when published
                  </label>
                </div>
              </div>

              <p className="text-xs text-dc-muted">
                Saving creates or updates your map pin at{' '}
                <span className="font-medium text-dc-text">/places/{org.slug}</span>.
                Publish from the Publishing tab to sync to East Coast Kink Events.
              </p>
            </div>
          : null}

          <button
            type="button"
            disabled={savingListing || !listingDirty}
            onClick={() => void saveListing()}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {savingListing ? 'Saving…' : 'Save listing type'}
          </button>
        </SettingsSection>

        <SettingsSection>
          <SettingsSubsectionHeader
            title="External site embed"
            subtitle="Show an approved external website on the About tab of your public hub."
          />
          {embedFeatureOff ?
            <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
              External site embeds are currently disabled.{' '}
              <span className="text-dc-text-muted">Enable them in </span>
              <span className="font-medium text-dc-accent">Features</span> first.
            </p>
          : null}

          <label className="block text-sm font-medium text-dc-text" htmlFor="external-site-url">
            Site URL
          </label>
          <input
            id="external-site-url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://your-organization-site.com"
            disabled={embedFeatureOff}
            className="mt-2 w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-dc-muted">
            The URL must be approved by the server allowlist before it can be embedded on About.
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-dc-text-muted">
            <input
              type="checkbox"
              checked={embedOn}
              disabled={embedFeatureOff}
              onChange={(e) => setEmbedOn(e.target.checked)}
              className="mt-1"
            />
            <span>Allow embedded site on About (when URL is approved)</span>
          </label>

          <button
            type="button"
            disabled={savingExternal || embedFeatureOff || !externalDirty}
            onClick={() => void saveExternal()}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {savingExternal ? 'Saving…' : 'Save external site'}
          </button>
        </SettingsSection>
      </div>

      <aside>
        <PublicHubPreviewCard
          displayName={displayName.trim() || org.displayName}
          visibility={visibility}
          logoUrl={org.logoUrl}
          bannerUrl={org.bannerUrl}
          publicHubHref={publicHubHref}
          aboutHref={aboutHref}
          externalEnabled={org.featureFlags.externalEmbedEnabled}
          externalUrl={externalUrl.trim() || null}
          embedOn={embedOn}
        />
      </aside>
    </div>
  )
}
