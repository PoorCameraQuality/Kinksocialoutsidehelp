'use client'

import { useEffect, useMemo, useState } from 'react'
import { programSlotRoomLabel, type ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { formatInTimeZone } from 'date-fns-tz'

type SavedView = { name: string; track: string; publishedOnly: boolean }

function storageKey(eventSlug: string) {
  return `dc-program-list-views:${eventSlug.toLowerCase()}`
}

export function ProgramListView({
  eventSlug,
  timezone,
  slots,
  readOnly,
  draftOnly,
  onOpenSlot,
  onAddSession,
}: {
  eventSlug: string
  timezone: string
  slots: ProgramSlotRow[]
  readOnly?: boolean
  draftOnly?: boolean
  onOpenSlot: (id: string) => void
  onAddSession?: () => void
}) {
  const [track, setTrack] = useState('')
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [draftFilter, setDraftFilter] = useState(draftOnly ?? false)
  const [q, setQ] = useState('')
  const [views, setViews] = useState<SavedView[]>([])
  const [viewName, setViewName] = useState('')

  useEffect(() => {
    setDraftFilter(draftOnly ?? false)
  }, [draftOnly])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(eventSlug))
      if (raw) setViews(JSON.parse(raw) as SavedView[])
    } catch {
      /* ignore */
    }
  }, [eventSlug])

  const trackOptions = useMemo(() => {
    const s = new Set<string>()
    for (const slot of slots) {
      const t = (slot.track ?? slot.trackName ?? '').trim()
      if (t) s.add(t)
    }
    return Array.from(s).sort()
  }, [slots])

  const filtered = useMemo(() => {
    return slots
      .filter((s) => {
        if (track && (s.track ?? s.trackName ?? '') !== track) return false
        if (publishedOnly && !s.isPublished) return false
        if (draftFilter && s.isPublished) return false
        if (q) {
          const hay = `${s.title} ${programSlotRoomLabel(s)} ${s.track ?? s.trackName ?? ''}`.toLowerCase()
          if (!hay.includes(q.toLowerCase())) return false
        }
        return true
      })
      .sort((a, b) => {
        if (!a.startsAt && !b.startsAt) return a.title.localeCompare(b.title)
        if (!a.startsAt) return -1
        if (!b.startsAt) return 1
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      })
  }, [slots, track, publishedOnly, draftFilter, q])

  function saveView() {
    const name = viewName.trim()
    if (!name) return
    const entry: SavedView = { name, track, publishedOnly }
    const next = [...views.filter((v) => v.name !== name), entry]
    setViews(next)
    localStorage.setItem(storageKey(eventSlug), JSON.stringify(next))
    setViewName('')
  }

  return (
    <div className="space-y-3 rounded-xl border border-dc-border bg-dc-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-dc-micro font-semibold uppercase text-dc-muted">Program list</p>
        {!readOnly && onAddSession ? (
          <button
            type="button"
            className="rounded-lg bg-dc-accent px-3 py-1 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            onClick={onAddSession}
          >
            + Add session
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[8rem] flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm"
          placeholder="Search sessions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm"
          value={track}
          onChange={(e) => setTrack(e.target.value)}
        >
          <option value="">All tracks</option>
          {trackOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-dc-micro">
          <input type="checkbox" checked={publishedOnly} onChange={(e) => setPublishedOnly(e.target.checked)} />
          Published only
        </label>
        <label className="flex items-center gap-1 text-dc-micro">
          <input type="checkbox" checked={draftFilter} onChange={(e) => setDraftFilter(e.target.checked)} />
          Draft only
        </label>
      </div>
      <ul className="max-h-[min(560px,70vh)] divide-y divide-dc-border overflow-y-auto text-sm">
        {filtered.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-0.5 px-2 py-2.5 text-left hover:bg-dc-surface-muted"
              onClick={() => onOpenSlot(s.id)}
            >
              <span className="flex flex-wrap items-center gap-2 font-medium text-dc-text">
                {s.title}
                {!s.isPublished ? (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                    Draft
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                    Published
                  </span>
                )}
                {s.visibility !== 'public' ? (
                  <span className="text-[10px] text-dc-muted">{s.visibility.replace('_', ' ')}</span>
                ) : null}
              </span>
              <span className="text-dc-micro text-dc-muted">
                {s.startsAt
                  ? formatInTimeZone(new Date(s.startsAt), timezone, 'EEE MMM d · h:mm a')
                  : 'Unscheduled'}{' '}
                · {programSlotRoomLabel(s) || 'TBD'} · {s.trackName ?? s.track ?? '-'}
              </span>
            </button>
          </li>
        ))}
        {!filtered.length ? <li className="px-2 py-4 text-dc-muted">No sessions match.</li> : null}
      </ul>
      <details className="text-dc-micro text-dc-muted">
        <summary className="cursor-pointer">Saved views</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="rounded-lg border border-dc-border px-2 py-1"
            placeholder="Save view…"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
          <button type="button" className="rounded-lg bg-dc-accent/20 px-2 py-1" onClick={saveView}>
            Save
          </button>
          {views.map((v) => (
            <button
              key={v.name}
              type="button"
              className="rounded-lg border border-dc-border px-2 py-1"
              onClick={() => {
                setTrack(v.track)
                setPublishedOnly(v.publishedOnly)
              }}
            >
              {v.name}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
