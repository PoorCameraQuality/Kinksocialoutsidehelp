'use client'

import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  dancecardAttendeeUrl,
  dancecardHost,
  dancecardOpsSummaryEmbedUrl,
  type DancecardConventionSettings,
} from '@/lib/dancecardIntegration'

type Props = {
  c2kConventionSlug: string
  settings: DancecardConventionSettings
  embedToken?: string | null
  orgSlug?: string | null
}

export default function DancecardOpsCard({ c2kConventionSlug, settings, embedToken, orgSlug }: Props) {
  const attendeeUrl = dancecardAttendeeUrl(settings)
  const host = dancecardHost(settings)
  const slug = settings.dancecardSlug?.trim() ?? ''
  const [copied, setCopied] = useState<string | null>(null)

  const copy = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }, [])

  if (!attendeeUrl) return null

  const summaryUrl = embedToken ? dancecardOpsSummaryEmbedUrl(settings, embedToken) : null
  const organizerConsoleHref =
    orgSlug ?
      `/organizer/orgs/${encodeURIComponent(orgSlug)}?tab=schedule`
    : `/organizer/conventions/${encodeURIComponent(c2kConventionSlug)}`
  const programManageHref =
    orgSlug ?
      `/organizer/orgs/${encodeURIComponent(orgSlug)}/conventions/${encodeURIComponent(c2kConventionSlug)}`
    : `/organizer/conventions/${encodeURIComponent(c2kConventionSlug)}`

  return (
    <section className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300/90">Dancecard (attendee app)</p>
        <p className="mt-1 text-sm text-dc-text-muted">
          Attendees use Dancecard on the public events directory for weekend schedules, gate, and reservations. Edit program on Kink Social, then publish
          to the public directory from the convention organizer (Event settings tab).
        </p>
      </div>

      {summaryUrl ?
        <iframe
          title="Dancecard readiness"
          src={summaryUrl}
          className="h-[140px] w-full rounded-lg border border-dc-border bg-black/30"
        />
      : null}

      <ol className="space-y-2 text-sm text-dc-text-muted list-decimal list-inside">
        <li>
          <Link to={programManageHref} className="text-dc-accent hover:underline">
            Manage program
          </Link>{' '}
          on Kink Social (grid, staff, settings)
        </li>
        <li>
          Publish to the public directory from Event settings, then share the{' '}
          <button type="button" className="text-dc-accent hover:underline" onClick={() => void copy('attendee', attendeeUrl)}>
            attendee link
          </button>
        </li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <Link
          to={programManageHref}
          className="min-h-11 inline-flex items-center rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-dc-text hover:bg-cyan-500"
        >
          Manage program
        </Link>
        <Link
          to={organizerConsoleHref}
          className="min-h-11 inline-flex items-center rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          Organizer dashboard
        </Link>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-text hover:bg-dc-elevated-muted"
          onClick={() => void copy('attendee', attendeeUrl)}
        >
          {copied === 'attendee' ? 'Copied' : 'Copy attendee link'}
        </button>
        {slug ?
          <a
            href={attendeeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 inline-flex items-center rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-text-muted hover:text-dc-text"
          >
            Open on {host.replace(/^https?:\/\//, '')}
          </a>
        : null}
      </div>

      {copied ? <p className="text-xs text-cyan-300/80">{copied} copied to clipboard.</p> : null}
    </section>
  )
}
