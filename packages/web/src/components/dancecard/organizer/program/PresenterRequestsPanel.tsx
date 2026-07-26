'use client'

import { useCallback, useEffect, useState } from 'react'
import { ParticipationOfferComposer } from '@/components/dancecard/organizer/ParticipationOfferComposer'

type PresenterRequestRow = {
  id: string
  presenterUserId: string
  title: string
  roomNeeds: string | null
  materialNeeds: string | null
  status: string
  reviewNotes: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_FILTER = ['all', 'PENDING', 'OFFERED', 'OFFER_ACCEPTED', 'REJECTED'] as const

function toIsoFromLocal(local: string): string | null {
  if (!local.trim()) return null
  const d = new Date(local)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

type Props = {
  conventionKey: string
  timezone: string
  readOnly: boolean
  onPromoted: () => Promise<void>
  /** When true, render the full panel inline (no collapse, no empty-state hiding). */
  embedded?: boolean
}

export function PresenterRequestsPanel({ conventionKey, timezone, readOnly, onPromoted, embedded = false }: Props) {
  const [open, setOpen] = useState(embedded)
  const [items, setItems] = useState<PresenterRequestRow[]>([])
  const [filter, setFilter] = useState<(typeof STATUS_FILTER)[number]>('PENDING')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [startsAtLocal, setStartsAtLocal] = useState('')
  const [endsAtLocal, setEndsAtLocal] = useState('')
  const [roomLabel, setRoomLabel] = useState('')
  const [trackLabel, setTrackLabel] = useState('')
  const [location, setLocation] = useState('')
  const [offerForId, setOfferForId] = useState<string | null>(null)

  const base = `/api/v1/conventions/${encodeURIComponent(conventionKey)}/presenter-requests`

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await fetch(base, { credentials: 'include' })
      const j = (await r.json().catch(() => ({}))) as { items?: PresenterRequestRow[]; error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not load presenter requests.')
        setItems([])
        return
      }
      setItems(j.items ?? [])
    } catch {
      setErr('Network error loading presenter requests.')
      setItems([])
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const pendingCount = items.filter((i) => i.status === 'PENDING').length

  if (!embedded && pendingCount === 0 && items.length === 0) {
    return null
  }

  if (!embedded && pendingCount > 0 && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2">
        <p className="text-sm text-amber-100">
          <span className="font-semibold">{pendingCount} presenter request{pendingCount === 1 ? '' : 's'}</span> need
          review
        </p>
        <button
          type="button"
          className="rounded-lg bg-dc-accent px-3 py-1 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          onClick={() => setOpen(true)}
        >
          Review requests ({pendingCount})
        </button>
      </div>
    )
  }

  const selected = items.find((i) => i.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) {
      setReviewNotes('')
      return
    }
    setReviewNotes(selected.reviewNotes ?? '')
  }, [selected])

  const filtered =
    filter === 'all' ? items : items.filter((i) => i.status === filter)

  async function patchStatus(status: 'REJECTED' | 'APPROVED') {
    if (!selected || readOnly) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`${base}/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes: reviewNotes.trim() || undefined }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Update failed.')
        return
      }
      await load()
    } catch {
      setErr('Network error.')
    } finally {
      setBusy(false)
    }
  }

  async function promote() {
    if (!selected || readOnly) return
    if (selected.status !== 'APPROVED' && selected.status !== 'OFFER_ACCEPTED') return
    const startsAt = toIsoFromLocal(startsAtLocal)
    const endsAt = toIsoFromLocal(endsAtLocal)
    if (!startsAt || !endsAt) {
      setErr('Start and end times are required to promote to a program slot.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`${base}/${encodeURIComponent(selected.id)}/promote-to-slot`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt,
          endsAt,
          roomLabel: roomLabel.trim() || undefined,
          trackLabel: trackLabel.trim() || undefined,
          location: location.trim() || undefined,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Promote failed.')
        return
      }
      await load()
      await onPromoted()
      setStartsAtLocal('')
      setEndsAtLocal('')
    } catch {
      setErr('Network error promoting request.')
    } finally {
      setBusy(false)
    }
  }

  const pendingBadge =
    pendingCount > 0 ? (
      <span className="ml-2 rounded-full bg-dc-warning-muted px-2 py-0.5 text-xs text-dc-warning">
        {pendingCount} pending
      </span>
    ) : null

  const body = (
      <div className="space-y-4">
        <p className="text-xs text-dc-muted">
          Review presenter applications, send offer letters with comp terms, then promote accepted classes into program slots (
          {timezone}).
        </p>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER.map((s) => (
            <button
              key={s}
              type="button"
              className={
                filter === s
                  ? 'rounded-lg bg-dc-accent/20 px-3 py-1 text-xs text-dc-accent'
                  : 'rounded-lg border border-dc-border px-3 py-1 text-xs text-dc-muted'
              }
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : s === 'PENDING' ? 'Pending' : s === 'OFFERED' ? 'Offered' : s === 'OFFER_ACCEPTED' ? 'Accepted' : s === 'REJECTED' ? 'Rejected' : s}
            </button>
          ))}
        </div>

        {err ? <p className="text-xs text-dc-danger" role="alert">{err}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {filtered.length === 0 ?
              <li className="text-sm text-dc-muted py-4 text-center">No requests in this filter.</li>
            : filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={
                      selectedId === row.id
                        ? 'w-full rounded-xl border border-dc-accent-border bg-dc-accent-muted px-3 py-2 text-left text-sm'
                        : 'w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-left text-sm hover:bg-dc-elevated-muted'
                    }
                    onClick={() => setSelectedId(row.id)}
                  >
                    <p className="font-medium text-dc-text">{row.title}</p>
                    <p className="text-[11px] text-dc-muted mt-0.5">
                      {row.status} · {new Date(row.updatedAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))
            }
          </ul>

          <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-3 text-sm">
            {!selected ?
              <p className="text-dc-muted py-6 text-center text-xs">Select a request to review.</p>
            : <>
                <h4 className="font-semibold text-dc-text">{selected.title}</h4>
                <p className="text-[11px] text-dc-muted mt-1">Presenter: {selected.presenterUserId.slice(0, 8)}…</p>
                {selected.roomNeeds ?
                  <p className="mt-2 text-xs text-dc-muted">
                    <span className="font-medium text-dc-text">Room:</span> {selected.roomNeeds}
                  </p>
                : null}
                {selected.materialNeeds ?
                  <p className="mt-1 text-xs text-dc-muted">
                    <span className="font-medium text-dc-text">Materials:</span> {selected.materialNeeds}
                  </p>
                : null}
                {!readOnly ?
                  <>
                    <label className="mt-3 block text-xs text-dc-muted">
                      Review notes
                      <textarea
                        className="mt-1 w-full rounded-lg border border-dc-border bg-dc-elevated px-2 py-1.5 text-sm"
                        rows={3}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || selected.status !== 'PENDING'}
                        className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground disabled:opacity-50"
                        onClick={() => setOfferForId(selected.id)}
                      >
                        Send offer
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg border border-dc-border px-3 py-1.5 text-xs disabled:opacity-50"
                        onClick={() => void patchStatus('REJECTED')}
                      >
                        Reject
                      </button>
                    </div>
                    {selected.status === 'APPROVED' || selected.status === 'OFFER_ACCEPTED' ?
                      <div className="mt-4 space-y-2 border-t border-dc-border pt-3">
                        <p className="text-xs font-semibold text-dc-text">Promote to program slot</p>
                        <label className="block text-xs text-dc-muted">
                          Starts
                          <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-lg border border-dc-border px-2 py-1.5"
                            value={startsAtLocal}
                            onChange={(e) => setStartsAtLocal(e.target.value)}
                          />
                        </label>
                        <label className="block text-xs text-dc-muted">
                          Ends
                          <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-lg border border-dc-border px-2 py-1.5"
                            value={endsAtLocal}
                            onChange={(e) => setEndsAtLocal(e.target.value)}
                          />
                        </label>
                        <input
                          placeholder="Room label"
                          className="w-full rounded-lg border border-dc-border px-2 py-1.5 text-xs"
                          value={roomLabel}
                          onChange={(e) => setRoomLabel(e.target.value)}
                        />
                        <input
                          placeholder="Track label"
                          className="w-full rounded-lg border border-dc-border px-2 py-1.5 text-xs"
                          value={trackLabel}
                          onChange={(e) => setTrackLabel(e.target.value)}
                        />
                        <input
                          placeholder="Location"
                          className="w-full rounded-lg border border-dc-border px-2 py-1.5 text-xs"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-accent-foreground disabled:opacity-50"
                          onClick={() => void promote()}
                        >
                          Promote to slot
                        </button>
                      </div>
                    : null}
                  </>
                : (
                  <p className="mt-3 text-xs text-dc-muted">Read-only for your role.</p>
                )}
              </>
            }
          </div>
        </div>
        {offerForId ?
          <ParticipationOfferComposer
            conventionKey={conventionKey}
            sourceType="presenter_request"
            sourceId={offerForId}
            defaultLetter={`We would like to offer you a presenter slot for "${selected?.title ?? 'your class'}" at this event. Please review the terms below and accept to confirm.`}
            onSent={() => {
              setOfferForId(null)
              void load()
            }}
            onCancel={() => setOfferForId(null)}
          />
        : null}
      </div>
  )

  if (embedded) {
    return (
      <section className="rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dc-text">Presenter requests{pendingBadge}</h3>
        </div>
        {body}
      </section>
    )
  }

  return (
    <details
      className="rounded-xl border border-dc-border bg-dc-elevated-muted"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-dc-text">
        Presenter requests{pendingBadge}
      </summary>
      <div className="border-t border-dc-border px-4 pb-4 pt-4">{body}</div>
    </details>
  )
}
