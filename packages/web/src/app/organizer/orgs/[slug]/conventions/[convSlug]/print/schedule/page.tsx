import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'

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

export default function OrganizerConventionPrintSchedulePage() {
  const { convSlug = '' } = useParams()
  const slug = convSlug.toLowerCase()
  const [timezone, setTimezone] = useState('America/New_York')
  const [title, setTitle] = useState('')
  const [slots, setSlots] = useState<ProgramSlotRow[]>([])
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
        slots: ProgramSlotRow[]
        timezone: string
        eventTitle?: string
      }>(slug, '/organizer/print-data')
      setSlots(res.slots ?? [])
      setTimezone(res.timezone ?? 'America/New_York')
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
        }
      `}</style>
      {err ? <p className="text-red-700">{err}</p> : null}
      {loading && !err ? (
        <div className="no-print space-y-3" aria-busy="true">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
          <p className="text-sm text-slate-500">Loading schedule…</p>
        </div>
      ) : null}
      <div className="no-print mb-4 flex gap-2">
        <button type="button" className="rounded border border-slate-400 px-3 py-1 text-sm" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button type="button" className="rounded border border-slate-400 px-3 py-1 text-sm" onClick={() => window.close()}>
          Close
        </button>
      </div>
      <h1 className="font-serif text-2xl">{title || slug}</h1>
      <p className="text-sm text-slate-600">Schedule export · {timezone}</p>
      <table className="mt-6 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black">
            <th className="py-2 pr-2">When</th>
            <th className="py-2 pr-2">Session</th>
            <th className="py-2 pr-2">Track</th>
            <th className="py-2 pr-2">Room / location</th>
            <th className="py-2 pr-2">Published</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.id} className="border-b border-slate-300">
              <td className="py-1.5 pr-2 align-top whitespace-nowrap text-xs">
                {s.startsAt && s.endsAt
                  ? `${formatInTimeZone(new Date(s.startsAt), timezone, 'EEE MMM d ha')} – ${formatInTimeZone(new Date(s.endsAt), timezone, 'ha')}`
                  : '-'}
              </td>
              <td className="py-1.5 pr-2 align-top font-medium">{s.title}</td>
              <td className="py-1.5 pr-2 align-top text-xs">{s.trackName ?? s.track ?? '-'}</td>
              <td className="py-1.5 pr-2 align-top text-xs">{s.locationName ?? s.room ?? '-'}</td>
              <td className="py-1.5 pr-2 align-top text-xs">{s.isPublished ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && !slots.length && !err ? <p className="mt-8 text-slate-500">No sessions.</p> : null}
    </div>
  )
}
