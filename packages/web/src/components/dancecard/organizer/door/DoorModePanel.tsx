'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { OrganizerApiError, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import StatusBanner from '@/components/ui/StatusBanner'
import { supportCopy } from '@/lib/dancecard/supportCopy'
import { useOrganizerTabHref } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { enqueueDoorCheckIn, listDoorQueue, removeDoorQueueItem } from '@/lib/dancecard/door/doorOfflineQueue'
import { cacheDoorRoster, registerDoorServiceWorker } from '@/lib/dancecard/door/registerDoorSw'
import DoorQrCamera from '@/components/dancecard/organizer/door/DoorQrCamera'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type Registrant = {
  id: string
  sceneDisplayName: string
  categoryName: string | null
  status: string
  checkInEligibility?: string
  checkInTiming?: string | null
  checkedInAt?: string | null
  pronouns?: string | null
}

function formatDoorError(error: unknown): string {
  if (error instanceof OrganizerApiError) {
    return error.message
  }
  const raw = error instanceof Error ? error.message : ''
  if (!raw || /^HTTP \d+$/i.test(raw)) return supportCopy.tryAgainLater
  return raw
}

function isEarlyCheckInError(error: unknown): boolean {
  if (error instanceof OrganizerApiError) {
    if (error.status === 409 && /NOT_ELIGIBLE|cannot be checked in/i.test(error.message)) return false
    if (error.status === 409) return true
    return /early/i.test(error.message)
  }
  const msg = error instanceof Error ? error.message : ''
  if (/cannot be checked in|not eligible/i.test(msg)) return false
  return /early/i.test(msg)
}

function toneClass(r: Registrant): string {
  if (r.status === 'checked_in') {
    if (r.checkInTiming === 'late') return 'border-sky-400 bg-sky-100 text-sky-900'
    if (r.checkInTiming === 'early_override') return 'border-red-400 bg-red-100 text-red-900'
    return 'border-dc-accent-border bg-dc-accent-muted text-dc-accent-hover'
  }
  if (r.status === 'waitlisted' || r.status === 'cancelled') {
    return 'border-amber-300 bg-amber-50 text-amber-900'
  }
  if (r.checkInEligibility === 'early') return 'border-red-300 bg-red-50 text-red-800'
  if (r.checkInEligibility === 'late') return 'border-sky-300 bg-sky-50 text-sky-800'
  return 'border-dc-border bg-dc-elevated-solid text-dc-text'
}

const DOOR_STATUS_LABELS: Record<string, string> = {
  imported: 'Imported',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  waitlisted: 'Waitlisted',
  checked_in: 'On-site',
}

function doorStatusLabel(status: string): string {
  return DOOR_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

function canDoorCheckIn(r: Registrant): boolean {
  return r.status !== 'checked_in' && r.status !== 'waitlisted' && r.status !== 'cancelled'
}

function doorIneligibleMessage(r: Registrant): string | null {
  if (r.status === 'checked_in') return 'Already on-site'
  if (r.status === 'waitlisted') return 'Waitlisted. Resolve in Signups before check-in'
  if (r.status === 'cancelled') return 'Registration cancelled. Cannot check in'
  return null
}

export function DoorModePanel({
  eventSlug,
  readOnly,
  exitHref: exitHrefProp,
}: {
  eventSlug: string
  readOnly: boolean
  /** When door mode is outside the organizer workspace shell, pass an explicit exit URL. */
  exitHref?: string
}) {
  const fallbackExitHref = useOrganizerTabHref('people', { peopleTab: 'signups' })
  const exitHref = exitHrefProp ?? fallbackExitHref
  const [eventTitle, setEventTitle] = useState('')
  const [query, setQuery] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [results, setResults] = useState<Registrant[]>([])
  const [selected, setSelected] = useState<Registrant | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [earlyCheckInConfirm, setEarlyCheckInConfirm] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [doorMode, setDoorMode] = useState<'scan' | 'manual'>('scan')
  const [recentCheckIns, setRecentCheckIns] = useState<Registrant[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const qrRef = useRef<HTMLInputElement>(null)

  const refreshQueue = useCallback(async () => {
    const q = await listDoorQueue()
    setQueueCount(q.length)
  }, [])

  const loadRoster = useCallback(async () => {
    try {
      const data = await organizerDancecardFetch<{ eventTitle: string; roster: Registrant[] }>(
        eventSlug,
        '/door/roster',
      )
      setEventTitle(data.eventTitle)
      cacheDoorRoster(eventSlug, data)
    } catch {
      /* offline roster may be cached by SW */
    }
  }, [eventSlug])

  const syncQueue = useCallback(async () => {
    const items = await listDoorQueue()
    for (const item of items) {
      try {
        await organizerDancecardFetch(eventSlug, '/registrants/check-in', {
          method: 'POST',
          body: JSON.stringify({
            registrantId: item.registrantId,
            earlyCheckInOverride: item.earlyCheckInOverride,
          }),
        })
        await removeDoorQueueItem(item.id)
      } catch {
        break
      }
    }
    await refreshQueue()
  }, [eventSlug, refreshQueue])

  useEffect(() => {
    registerDoorServiceWorker()
    void loadRoster()
    void refreshQueue()
    const onOnline = () => {
      setOffline(false)
      void syncQueue()
    }
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadRoster, refreshQueue, syncQueue])

  const lookup = useCallback(
    async (params: { q?: string; qr?: string }) => {
      setErr(null)
      const sp = new URLSearchParams()
      if (params.q) sp.set('q', params.q)
      if (params.qr) sp.set('qr', params.qr)
      const data = await organizerDancecardFetch<{ registrants: Registrant[] }>(
        eventSlug,
        `/registrants/lookup?${sp.toString()}`,
      )
      setResults(data.registrants)
      if (data.registrants.length === 1) setSelected(data.registrants[0]!)
      return data.registrants
    },
    [eventSlug],
  )

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = window.setTimeout(() => {
      void lookup({ q: query.trim() }).catch((e) => setErr(formatDoorError(e)))
    }, 250)
    return () => window.clearTimeout(t)
  }, [query, lookup])

  async function performCheckIn(registrantId: string, earlyOverride = false) {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    setMessage(null)
    try {
      if (!navigator.onLine) {
        await enqueueDoorCheckIn({
          registrantId,
          earlyCheckInOverride: earlyOverride,
          clientTimestamp: new Date().toISOString(),
        })
        setMessage('Queued for sync when online')
        await refreshQueue()
        return
      }
      const data = await organizerDancecardFetch<{ registrant: Registrant }>(eventSlug, '/registrants/check-in', {
        method: 'POST',
        body: JSON.stringify({ registrantId, earlyCheckInOverride: earlyOverride }),
      })
      setSelected(data.registrant)
      setRecentCheckIns((prev) => [data.registrant, ...prev.filter((r) => r.id !== data.registrant.id)].slice(0, 8))
      setMessage(`Checked in: ${data.registrant.sceneDisplayName}`)
      setQuery('')
      setResults([])
      void loadRoster()
    } catch (e: unknown) {
      if (!earlyOverride && isEarlyCheckInError(e)) {
        setEarlyCheckInConfirm(registrantId)
        return
      }
      setErr(formatDoorError(e))
    } finally {
      setBusy(false)
    }
  }

  async function onQrSubmit(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    setQrInput('')
    try {
      const found = await lookup({ qr: trimmed })
      if (found.length === 1 && canDoorCheckIn(found[0]!)) {
        await performCheckIn(found[0]!.id)
      }
    } catch (e) {
      setErr(formatDoorError(e))
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-dc-surface px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-dc-border pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-dc-accent">Door mode</p>
          <h1 className="truncate font-serif text-xl font-semibold text-dc-text">{eventTitle || eventSlug}</h1>
          <p className="mt-1 text-xs text-dc-text-muted">
            {cameraOn ? 'Camera ready — point at a badge QR' : 'Ready to check in attendees'}
          </p>
        </div>
        <Link
          href={exitHref}
          className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-dc-border px-3 text-xs font-medium text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
        >
          Exit
        </Link>
      </header>

      {offline ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
          Offline — check-ins queue locally ({queueCount} pending)
        </p>
      ) : null}
      {queueCount > 0 && !offline ? (
        <button
          type="button"
          className="mb-3 inline-flex min-h-10 items-center text-xs font-medium text-dc-accent hover:underline"
          onClick={() => void syncQueue()}
        >
          Sync {queueCount} queued check-in{queueCount === 1 ? '' : 's'}
        </button>
      ) : null}
      {err ?
        <StatusBanner tone="error" className="mb-3">
          {err}
        </StatusBanner>
      : null}
      {message ? <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">{message}</p> : null}

      <ConfirmDialog
        open={Boolean(earlyCheckInConfirm)}
        title="Early check-in"
        description="This attendee is not in the check-in window yet. Allow an early check-in override?"
        confirmLabel="Allow early check-in"
        busy={busy}
        onCancel={() => setEarlyCheckInConfirm(null)}
        onConfirm={() => {
          const id = earlyCheckInConfirm
          setEarlyCheckInConfirm(null)
          if (id) void performCheckIn(id, true)
        }}
      />

      <div className="mb-4 flex gap-1 rounded-xl border border-dc-border bg-dc-elevated-solid p-1" role="tablist" aria-label="Check-in mode">
        <button
          type="button"
          role="tab"
          aria-selected={doorMode === 'scan'}
          onClick={() => setDoorMode('scan')}
          className={`min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${
            doorMode === 'scan' ? 'bg-dc-accent text-dc-accent-foreground' : 'text-dc-text-muted hover:text-dc-text'
          }`}
        >
          Scan QR
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={doorMode === 'manual'}
          onClick={() => setDoorMode('manual')}
          className={`min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${
            doorMode === 'manual' ? 'bg-dc-accent text-dc-accent-foreground' : 'text-dc-text-muted hover:text-dc-text'
          }`}
        >
          Manual lookup
        </button>
      </div>

      {doorMode === 'scan' ?
        <section className="mb-4 space-y-3" aria-labelledby="door-scan-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="door-scan-heading" className="text-sm font-semibold text-dc-text">
              Scan QR code
            </h2>
            <button
              type="button"
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors ${
                cameraOn ?
                  'border border-dc-border text-dc-text-muted hover:text-dc-text'
                : 'bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover'
              }`}
              onClick={() => setCameraOn((v) => !v)}
            >
              {cameraOn ? 'Hide camera' : 'Use camera'}
            </button>
          </div>
          <DoorQrCamera active={cameraOn} onDecode={(text) => void onQrSubmit(text)} onError={(m) => setErr(m)} />
          <input
            id="door-qr-input"
            ref={qrRef}
            type="text"
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onQrSubmit(qrInput)
            }}
            placeholder="Or paste QR payload…"
            className="min-h-12 w-full touch-manipulation rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-base"
            autoComplete="off"
          />
        </section>
      : <section className="mb-4 space-y-2" aria-labelledby="door-manual-heading">
          <h2 id="door-manual-heading" className="text-sm font-semibold text-dc-text">
            Search attendee
          </h2>
          <p className="text-xs text-dc-text-muted">Search by name or email (2+ characters).</p>
          <input
            id="door-search"
            ref={searchRef}
            type="search"
            data-testid="door-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or email…"
            className="min-h-12 w-full touch-manipulation rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-base"
          />
          {results.length > 0 ?
            <ul className="max-h-52 space-y-1.5 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm ${toneClass(r)}`}
                  >
                    <span className="font-semibold">{r.sceneDisplayName}</span>
                    <span className="text-xs opacity-80">{r.categoryName ?? doorStatusLabel(r.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          : query.trim().length >= 2 && !busy ?
            <p className="rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-3 text-sm text-dc-muted">
              No match for &ldquo;{query.trim()}&rdquo;. Try email or add them in Signups first.
            </p>
          : null}
        </section>
      }

      {selected ?
        <div className={`mb-4 rounded-2xl border-2 p-4 ${toneClass(selected)}`}>
          <p className="text-2xl font-bold">{selected.sceneDisplayName}</p>
          {selected.pronouns ? <p className="text-sm opacity-80">{selected.pronouns}</p> : null}
          <p className="mt-1 text-sm">{selected.categoryName ?? '-'}</p>
          <p className="text-xs uppercase tracking-wide opacity-70">{doorStatusLabel(selected.status)}</p>
          {!readOnly && canDoorCheckIn(selected) ?
            <button
              type="button"
              data-testid="door-check-in-submit"
              disabled={busy}
              onClick={() => void performCheckIn(selected.id)}
              className="dc-gold-btn mt-4 w-full min-h-14 touch-manipulation rounded-xl text-lg font-semibold"
            >
              {busy ? 'Checking in…' : 'Check in'}
            </button>
          : null}
          {!readOnly && !canDoorCheckIn(selected) ?
            <p className="mt-3 text-center text-sm font-medium">{doorIneligibleMessage(selected)}</p>
          : null}
        </div>
      : null}

      <section className="mt-auto border-t border-dc-border pt-4" aria-labelledby="door-recent-heading">
        <h2 id="door-recent-heading" className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
          Recent check-ins
        </h2>
        {recentCheckIns.length > 0 ?
          <ul className="mt-2 space-y-1.5">
            {recentCheckIns.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm"
              >
                <span className="font-medium text-dc-text">{r.sceneDisplayName}</span>
                <span className="text-xs text-dc-muted">{doorStatusLabel(r.status)}</span>
              </li>
            ))}
          </ul>
        : <div className="c2k-empty-state-compact mt-2 rounded-xl border border-dashed border-dc-border bg-dc-elevated-muted/40 px-4 py-5 text-center">
            <p className="text-sm font-medium text-dc-text">No check-ins yet</p>
            <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
              Scan a QR code or search by name to check someone in.
            </p>
          </div>
        }
      </section>
    </div>
  )
}
