import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { OrganizerLocationDto } from '@/lib/dancecard/organizerLocationDto'

async function verifyCommandAccess(slug: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(slug)}/organizer/command-access`, {
      credentials: 'include',
    })
    if (r.status === 403) {
      return 'You do not have Event Systems access for this convention. Ask an org owner or admin for a team grant.'
    }
    if (!r.ok) return 'Could not verify command bridge access.'
    return null
  } catch {
    return 'Network error verifying access.'
  }
}

export default function OrganizerConventionPrintVenueSignsPage() {
  const { convSlug = '' } = useParams()
  const slug = convSlug.toLowerCase()
  const [title, setTitle] = useState('')
  const [locations, setLocations] = useState<OrganizerLocationDto[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setErr(null)
    const accessErr = await verifyCommandAccess(slug)
    if (accessErr) {
      setErr(accessErr)
      setLoading(false)
      return
    }
    try {
      const res = await organizerDancecardFetch<{
        locations: OrganizerLocationDto[]
        eventTitle?: string
      }>(slug, '/organizer/print-data')
      setLocations(res.locations ?? [])
      if (res.eventTitle) setTitle(res.eventTitle)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .sign-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      {err ? <p className="text-red-700">{err}</p> : null}
      {loading && !err ? (
        <div className="no-print space-y-3" aria-busy="true">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-8 grid gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg border-2 border-slate-200 bg-slate-50" />
            ))}
          </div>
          <p className="text-sm text-slate-500">Loading venue signs…</p>
        </div>
      ) : null}
      <div className="no-print mb-4 flex gap-2">
        <button type="button" className="rounded border border-slate-400 px-3 py-1 text-sm" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      <h1 className="font-serif text-2xl">{title || slug}</h1>
      <p className="text-sm text-slate-600">Venue / room signs</p>
      <div className="mt-8 grid gap-8">
        {locations.map((l) => (
          <section key={l.id} className="sign-card rounded-lg border-2 border-black p-6">
            <h2 className="text-center font-serif text-3xl">{l.name}</h2>
            {l.shortName ? <p className="mt-2 text-center text-lg text-slate-700">{l.shortName}</p> : null}
            {l.directionsPublic ? (
              <div className="mt-4 text-sm">
                <p className="font-semibold">Directions</p>
                <p className="whitespace-pre-wrap">{l.directionsPublic}</p>
              </div>
            ) : null}
            {l.accessibilityNotes ? (
              <div className="mt-4 text-sm">
                <p className="font-semibold">Accessibility</p>
                <p className="whitespace-pre-wrap">{l.accessibilityNotes}</p>
              </div>
            ) : null}
          </section>
        ))}
      </div>
      {!loading && !locations.length && !err ? <p className="mt-8 text-slate-500">No locations configured.</p> : null}
    </div>
  )
}
