import { useCallback, useEffect, useState } from 'react'
import {
  loadConventionMeta,
  patchConventionOrganizerSettings,
} from '@/lib/organizer/conventionProgramApi'

type Props = {
  /** Convention slug — used to load and save listing details. */
  slug: string
}

type SavedDetails = {
  highlights: string[]
  venueName: string
  websiteUrl: string
}

const MAX_HIGHLIGHTS = 12

function parseHighlights(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_HIGHLIGHTS)
}

/**
 * Organizer-friendly editor for the marketing extras that ship to the public
 * East Coast Kink Events page: a "What to expect" highlights list, the venue
 * name, and an official website link. These fill out the published event so it
 * looks hand-curated rather than bare.
 */
export default function ConventionListingDetailsEditor({ slug }: Props) {
  const [highlightsText, setHighlightsText] = useState('')
  const [venueName, setVenueName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [saved, setSaved] = useState<SavedDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const meta = await loadConventionMeta(slug)
      const ecke = ((meta.settings ?? {}) as Record<string, unknown>).eckeListing as
        | { highlights?: string[]; venueName?: string | null; websiteUrl?: string | null }
        | undefined
      const highlights = Array.isArray(ecke?.highlights) ? ecke!.highlights.map((h) => String(h)) : []
      const venue = ecke?.venueName ?? ''
      const website = ecke?.websiteUrl ?? ''
      setHighlightsText(highlights.join('\n'))
      setVenueName(venue)
      setWebsiteUrl(website)
      setSaved({ highlights, venueName: venue, websiteUrl: website })
    } catch {
      setLoadError('Could not load listing details.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (message?.kind !== 'success') return
    const timer = window.setTimeout(() => setMessage(null), 6000)
    return () => window.clearTimeout(timer)
  }, [message])

  const highlights = parseHighlights(highlightsText)
  const trimmedVenue = venueName.trim()
  const trimmedWebsite = websiteUrl.trim()
  const websiteInvalid = trimmedWebsite.length > 0 && !/^https?:\/\/\S+\.\S+/i.test(trimmedWebsite)

  const dirty =
    !saved ||
    saved.highlights.join('\n') !== highlights.join('\n') ||
    saved.venueName.trim() !== trimmedVenue ||
    saved.websiteUrl.trim() !== trimmedWebsite

  const save = async () => {
    if (websiteInvalid) {
      setMessage({ kind: 'error', text: 'Enter a full website URL starting with https://' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await patchConventionOrganizerSettings(slug, {
        settings: {
          eckeListing: {
            highlights,
            venueName: trimmedVenue || null,
            websiteUrl: trimmedWebsite || null,
          },
        },
      })
      setSaved({ highlights, venueName: trimmedVenue, websiteUrl: trimmedWebsite })
      setMessage({ kind: 'success', text: 'Saved. Re-run the preview below to push it to your listing.' })
    } catch {
      setMessage({ kind: 'error', text: 'Could not save listing details. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-dc-text">Listing details for East Coast Kink Events</h4>
        <p className="mt-1 text-sm text-dc-text-muted">
          These make your public event page richer. Highlights show as a “What to expect” list, the venue name and
          official site appear alongside your dates. Leave blank to keep it minimal.
        </p>
      </div>

      {loading ?
        <div className="h-28 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      : loadError ?
        <div className="flex flex-col gap-3 rounded-xl border border-dc-danger-border bg-dc-danger-muted px-3 py-2 text-sm text-dc-danger sm:flex-row sm:items-center" role="alert">
          <p className="flex-1">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
          >
            Retry
          </button>
        </div>
      : <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="ecke-highlights" className="block text-xs font-semibold uppercase tracking-wide text-dc-text-muted">
              Highlights — one per line
            </label>
            <textarea
              id="ecke-highlights"
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              rows={5}
              placeholder={'100+ classes across 3 days\nDungeon open until 4am\nVendor hall & marketplace\nNew-to-kink track'}
              className="w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent-border focus:outline-none"
            />
            <p className="text-xs text-dc-muted">
              {highlights.length} of {MAX_HIGHLIGHTS} highlights{highlights.length >= MAX_HIGHLIGHTS ? ' (max reached)' : ''}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ecke-venue" className="block text-xs font-semibold uppercase tracking-wide text-dc-text-muted">
                Venue name
              </label>
              <input
                id="ecke-venue"
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Hyatt Regency Baltimore"
                maxLength={160}
                className="w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent-border focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ecke-website" className="block text-xs font-semibold uppercase tracking-wide text-dc-text-muted">
                Official website
              </label>
              <input
                id="ecke-website"
                type="url"
                inputMode="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://your-convention.com"
                className={`w-full rounded-xl border bg-dc-elevated px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted focus:outline-none ${
                  websiteInvalid ? 'border-dc-danger-border focus:border-dc-danger-border' : 'border-dc-border focus:border-dc-accent-border'
                }`}
              />
              {websiteInvalid ?
                <p className="text-xs text-dc-danger">Use a full URL, e.g. https://example.com</p>
              : <p className="text-xs text-dc-muted">Drives the “Visit official site” button. Leave blank to link back to your listing.</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || websiteInvalid || !dirty}
              className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : dirty ? 'Save listing details' : 'Saved'}
            </button>
            {message ?
              <span className={`text-sm ${message.kind === 'error' ? 'text-dc-danger' : 'text-dc-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
                {message.text}
              </span>
            : null}
          </div>
        </div>
      }
    </section>
  )
}
