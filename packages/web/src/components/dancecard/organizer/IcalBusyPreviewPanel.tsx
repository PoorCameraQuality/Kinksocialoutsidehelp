'use client'

import { useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'

type BusyBlock = { start: string; end: string; summary?: string }

export function IcalBusyPreviewPanel({ eventSlug }: { eventSlug: string }) {
  const [icsText, setIcsText] = useState('')
  const [blocks, setBlocks] = useState<BusyBlock[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function preview() {
    if (icsText.trim().length < 10) {
      setErr('Paste ICS calendar text (at least 10 characters).')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ blocks: BusyBlock[]; count: number }>(
        eventSlug,
        '/ical-busy-preview',
        { method: 'POST', body: JSON.stringify({ icsText }) },
      )
      setBlocks(res.blocks ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Preview failed')
      setBlocks([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">ICS busy preview</p>
      <p className="mt-1 text-xs text-dc-muted">
        Paste exported calendar (.ics) text to see busy blocks before importing or comparing schedules.
      </p>
      <textarea
        className="mt-3 min-h-[120px] w-full rounded-xl border border-dc-border bg-[#111a2c] px-3 py-2 font-mono text-xs text-dc-text"
        value={icsText}
        onChange={(e) => setIcsText(e.target.value)}
        placeholder="BEGIN:VCALENDAR…"
      />
      <button
        type="button"
        disabled={busy}
        className="mt-2 rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
        onClick={() => void preview()}
      >
        {busy ? 'Parsing…' : 'Preview busy blocks'}
      </button>
      {err ? <p className="mt-2 text-sm text-dc-danger">{err}</p> : null}
      {blocks.length ? (
        <div className="mt-3 max-h-48 overflow-y-auto">
          <p className="text-xs text-dc-muted">{blocks.length} block(s)</p>
          <ul className="mt-2 space-y-1 text-xs text-dc-muted">
            {blocks.map((b, i) => (
              <li key={`${b.start}-${i}`} className="rounded-lg border border-dc-border/50 bg-white/[0.03] px-2 py-1.5">
                <span className="text-dc-muted">{b.start}</span>
                <span className="mx-1">→</span>
                <span className="text-dc-muted">{b.end}</span>
                {b.summary ? <span className="ml-2 text-dc-text">{b.summary}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
