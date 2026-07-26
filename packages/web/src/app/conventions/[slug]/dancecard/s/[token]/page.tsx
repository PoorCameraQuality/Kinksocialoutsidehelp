import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { buildLoginHref } from '@/lib/auth-links'
import ConventionDancecardCompareGrid from '@/components/conventions/ConventionDancecardCompareGrid'
import {
  convBoundsFromShared,
  viewerExpandedBusy,
  type CalItem,
  type FreeGap,
} from '@/components/conventions/convention-dancecard-compare-utils'

type SharedSharer = {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

type SharedPayload = {
  conventionName: string
  timezone: string
  /** Present on current API; older responses fall back to spanning `freeGaps`. */
  conventionStartsAt?: string
  conventionEndsAt?: string
  freeGaps: FreeGap[]
  /** Host who created the share link; optional for older API responses. */
  sharer?: SharedSharer
}

type PreviewResult = {
  hostOk: boolean
  guestConflicts: { startsAt: string; endsAt: string }[]
}

function formatInstant(iso: string, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatRange(isoStart: string, isoEnd: string, tz: string): string {
  return `${formatInstant(isoStart, tz)} – ${new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoEnd))}`
}

export default function ConventionDancecardSharedPage() {
  const { slug, token } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  /** Local/demo: draw the guest overlay (red) without calling the calendar API - matches seeded `DEMO-2mutual` windows. */
  const demoOverlay =
    searchParams.get('demoOverlay') === '1' ||
    searchParams.get('demoOverlay') === 'true' ||
    searchParams.get('demo') === 'overlay'
  const key = encodeURIComponent(slug ?? '')
  const [data, setData] = useState<SharedPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ startsAt: Date; endsAt: Date; maxEnd: Date } | null>(null)
  const [durationMin, setDurationMin] = useState(60)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  const [conflictLines, setConflictLines] = useState<string[] | null>(null)
  const [slotPanelOpen, setSlotPanelOpen] = useState(false)
  const [panelCoords, setPanelCoords] = useState({ top: 0, left: 0, width: 300 })
  const mutualSlotAnchorRef = useRef<HTMLButtonElement | null>(null)
  const slotPanelRef = useRef<HTMLDivElement | null>(null)
  const [requestDescription, setRequestDescription] = useState('')
  const [needLogin, setNeedLogin] = useState(false)
  const [viewerCal, setViewerCal] = useState<{ items: CalItem[]; bufferMinutes: number } | null>(null)
  const [viewerCalStatus, setViewerCalStatus] = useState<'idle' | 'loading' | 'ready' | 'signed_out' | 'blocked'>('idle')
  /** Bumps when the window is focused / visible again so we re-fetch calendar after login in another tab or return from auth. */
  const [overlayRefreshKey, setOverlayRefreshKey] = useState(0)

  const loginHref = buildLoginHref(location.pathname + location.search)

  useEffect(() => {
    const bump = () => setOverlayRefreshKey((n) => n + 1)
    window.addEventListener('focus', bump)
    const onVis = () => {
      if (document.visibilityState === 'visible') bump()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    if (!slug || !token) return
    let cancelled = false
    void (async () => {
      const r = await fetch(`/api/v1/conventions/${key}/dancecard/shared/${encodeURIComponent(token)}`, {
        credentials: 'include',
      })
      if (cancelled) return
      if (!r.ok) {
        setErr('This share link is invalid or was revoked.')
        setData(null)
        return
      }
      const d = (await r.json()) as SharedPayload
      setData(d)
      setErr(null)
    })()
    return () => {
      cancelled = true
    }
  }, [slug, token, key])

  useEffect(() => {
    if (!data || !slug || demoOverlay) return
    let cancelled = false
    setViewerCalStatus('loading')
    setViewerCal(null)
    void (async () => {
      const r = await fetch(`/api/v1/conventions/${key}/dancecard/calendar`, { credentials: 'include' })
      if (cancelled) return
      if (r.status === 401) {
        setViewerCal(null)
        setViewerCalStatus('signed_out')
        return
      }
      if (!r.ok) {
        setViewerCal(null)
        setViewerCalStatus('blocked')
        return
      }
      const j = (await r.json()) as { items?: CalItem[]; bufferMinutes?: number }
      if (cancelled) return
      setViewerCal({ items: j.items ?? [], bufferMinutes: j.bufferMinutes ?? 0 })
      setViewerCalStatus('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [data, slug, key, overlayRefreshKey, demoOverlay])

  const tz = data?.timezone ?? 'UTC'

  const convBounds = useMemo(() => (data ? convBoundsFromShared(data) : null), [data])

  const syntheticDemoViewerCal = useMemo((): { items: CalItem[]; bufferMinutes: number } | null => {
    if (!demoOverlay || !convBounds) return null
    const t0 = convBounds.start.getTime()
    const tEnd = convBounds.end.getTime()
    const items: CalItem[] = [
      {
        startsAt: new Date(t0 + 12 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(t0 + 15 * 60 * 60 * 1000).toISOString(),
      },
      {
        startsAt: new Date(t0 + 49 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Math.min(tEnd, t0 + 53 * 60 * 60 * 1000)).toISOString(),
      },
    ]
    return { items, bufferMinutes: 0 }
  }, [demoOverlay, convBounds])

  const calForOverlay = syntheticDemoViewerCal ?? viewerCal
  const statusForOverlay: 'idle' | 'loading' | 'ready' | 'signed_out' | 'blocked' =
    demoOverlay && convBounds ? 'ready' : viewerCalStatus

  const viewerBusyExpanded = useMemo(() => {
    if (!convBounds || !calForOverlay || statusForOverlay !== 'ready') return [] as { s: number; e: number }[]
    return viewerExpandedBusy(
      calForOverlay.items,
      calForOverlay.bufferMinutes,
      convBounds.start.getTime(),
      convBounds.end.getTime(),
    )
  }, [convBounds, calForOverlay, statusForOverlay])

  const applyDuration = useCallback(
    (start: Date, maxEnd: Date, minutes: number) => {
      const endMs = Math.min(start.getTime() + minutes * 60 * 1000, maxEnd.getTime())
      return new Date(endMs)
    },
    [],
  )

  useEffect(() => {
    setSelection((prev) => {
      if (!prev) return prev
      const nextEnd = applyDuration(prev.startsAt, prev.maxEnd, durationMin)
      if (nextEnd.getTime() === prev.endsAt.getTime()) return prev
      return { ...prev, endsAt: nextEnd }
    })
  }, [durationMin, applyDuration])

  useEffect(() => {
    if (!slotPanelOpen) return
    setPreview(null)
    setConflictLines(null)
  }, [durationMin, slotPanelOpen])

  const pickGap = useCallback(
    (gapStart: Date, gapEnd: Date) => {
      const start = gapStart
      const endsAt = applyDuration(start, gapEnd, durationMin)
      setSelection({ startsAt: start, endsAt, maxEnd: gapEnd })
      setPreview(null)
      setConflictLines(null)
      setSubmitMsg(null)
    },
    [applyDuration, durationMin],
  )

  const pickGapFromClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>, hitS: number, hitE: number) => {
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      const ratio = r.height > 0 ? (e.clientY - r.top) / r.height : 0
      const span = hitE - hitS
      const rawMs = hitS + ratio * span
      const step = 15 * 60 * 1000
      const snapped = Math.round(rawMs / step) * step
      const minStart = hitS
      const maxStart = hitE - 5 * 60 * 1000
      const startMs = Math.min(Math.max(snapped, minStart), Math.max(minStart, maxStart))
      pickGap(new Date(startMs), new Date(hitE))
    },
    [pickGap],
  )

  const closeSlotPanel = useCallback((clearSubmitMessage = true) => {
    setSlotPanelOpen(false)
    mutualSlotAnchorRef.current = null
    setSelection(null)
    setPreview(null)
    setConflictLines(null)
    setRequestDescription('')
    setNeedLogin(false)
    if (clearSubmitMessage) setSubmitMsg(null)
  }, [])

  const dismissSlotPanel = useCallback(() => {
    closeSlotPanel(true)
  }, [closeSlotPanel])

  const handleMutualSlotClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>, hitS: number, hitE: number) => {
      mutualSlotAnchorRef.current = e.currentTarget
      pickGapFromClick(e, hitS, hitE)
      setRequestDescription('')
      setPreview(null)
      setConflictLines(null)
      setSubmitMsg(null)
      setNeedLogin(false)
      setSlotPanelOpen(true)
    },
    [pickGapFromClick],
  )

  useLayoutEffect(() => {
    if (!slotPanelOpen) return
    const el = mutualSlotAnchorRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const w = 300
      const gap = 10
      const vw = window.innerWidth
      const vh = window.innerHeight
      const maxH = 440
      let left = r.right + gap
      if (left + w > vw - 8) left = Math.max(8, r.left - w - gap)
      let top = r.top
      if (top + maxH > vh - 8) top = Math.max(8, vh - maxH - 8)
      if (top < 8) top = 8
      setPanelCoords({ top, left, width: w })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [slotPanelOpen, selection, durationMin])

  useEffect(() => {
    if (!slotPanelOpen) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') dismissSlotPanel()
    }
    function onPointerDown(ev: PointerEvent) {
      const t = ev.target as HTMLElement
      if (t.closest('[data-slot-panel]')) return
      if (t.closest('[data-mutual-slot]')) return
      dismissSlotPanel()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [slotPanelOpen, dismissSlotPanel])

  const runPreview = useCallback(async () => {
    setSubmitMsg(null)
    setConflictLines(null)
    setPreview(null)
    if (!token || !selection) return
    setPreviewLoading(true)
    setNeedLogin(false)
    try {
      const r = await fetch(`/api/v1/conventions/${key}/dancecard/booking-requests/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareToken: token,
          startsAt: selection.startsAt.toISOString(),
          endsAt: selection.endsAt.toISOString(),
          description: requestDescription.trim() || 'Scene',
        }),
      })
      if (r.status === 401) {
        setNeedLogin(true)
        return
      }
      if (!r.ok) {
        setConflictLines(['Could not check availability. Try again.'])
        return
      }
      const j = (await r.json()) as PreviewResult
      setPreview(j)
      const lines: string[] = []
      if (!j.hostOk) {
        lines.push('That window is no longer inside this host’s shared free time (they may have updated their schedule).')
      }
      if (j.guestConflicts.length > 0) {
        lines.push('Your own convention calendar overlaps this window (including your buffer after commitments):')
        for (const c of j.guestConflicts) {
          lines.push(`· ${formatRange(c.startsAt, c.endsAt, tz)}`)
        }
      }
      setConflictLines(lines.length ? lines : null)
    } finally {
      setPreviewLoading(false)
    }
  }, [token, key, selection, tz, requestDescription])

  const submitRequest = useCallback(async () => {
    setSubmitMsg(null)
    if (!token || !selection) return
    const desc = requestDescription.trim()
    if (!desc) {
      setSubmitMsg('Please add a short description.')
      return
    }
    setSubmitLoading(true)
    try {
      const r = await fetch(`/api/v1/conventions/${key}/dancecard/booking-requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareToken: token,
          startsAt: selection.startsAt.toISOString(),
          endsAt: selection.endsAt.toISOString(),
          description: desc,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        code?: string
        overlaps?: { startsAt: string; endsAt: string }[]
      }
      if (!r.ok) {
        if (j.code === 'guest_calendar_conflict' && j.overlaps?.length) {
          setSubmitMsg('Your calendar conflicts with this time.')
          setConflictLines([
            'Overlapping commitments (with buffer):',
            ...j.overlaps.map((o) => `· ${formatRange(o.startsAt, o.endsAt, tz)}`),
          ])
        } else if (j.code === 'host_unavailable') {
          setSubmitMsg('That time no longer fits the host’s free time.')
        } else {
          setSubmitMsg(typeof j.error === 'string' ? j.error : 'Could not submit request.')
        }
        return
      }
      closeSlotPanel(false)
      setSubmitMsg('Request sent. The host will need to approve it.')
      setPreview(null)
      setConflictLines(null)
    } finally {
      setSubmitLoading(false)
    }
  }, [token, key, selection, requestDescription, tz, closeSlotPanel])

  if (err) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-dc-text-muted">{err}</p>
        <Link
          to={slug ? `/conventions/${encodeURIComponent(slug)}` : '/'}
          className="mt-4 inline-block text-dc-accent hover:underline"
        >
          Back to convention
        </Link>
      </div>
    )
  }

  if (!data) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-dc-muted text-sm">Loading…</div>
  }

  if (!convBounds) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-sm text-dc-text-muted">
        <p>This share response did not include convention dates. Ask the host to re-create the link after updating the app.</p>
        <Link to={`/conventions/${encodeURIComponent(slug ?? '')}`} className="mt-4 inline-block text-dc-accent hover:underline">
          Convention home
        </Link>
      </div>
    )
  }

  const checksPassForSend =
    Boolean(preview && preview.hostOk && preview.guestConflicts.length === 0 && selection && !needLogin)

  const sendRequestBlockedReason = (() => {
    if (needLogin) return 'Sign in first, then run Check conflicts.'
    if (!preview) return 'Run Check conflicts first. Then you can send the request.'
    if (!preview.hostOk) return 'This window no longer fits the host’s shared free time.'
    if (preview.guestConflicts.length > 0) return 'Your calendar still conflicts with this window.'
    if (!requestDescription.trim()) return 'Add a short description before sending.'
    return null
  })()

  const canSubmitRequest = checksPassForSend && sendRequestBlockedReason === null

  const sharer = data.sharer
  const sharerName = sharer ? sharer.displayName?.trim() || sharer.username?.trim() || null : null
  const sharerProfileHref =
    sharer?.username?.trim() ? `/presenters/${encodeURIComponent(sharer.username.trim())}` : null

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
      {sharerName ?
        <header className="mb-6 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent px-5 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-7">
          <div className="relative shrink-0">
            <div className="h-32 w-32 overflow-hidden rounded-2xl bg-zinc-900 ring-2 ring-emerald-500/25 shadow-xl shadow-black/50 sm:h-36 sm:w-36">
              {sharer?.avatarUrl ?
                <img
                  src={sharer.avatarUrl}
                  alt=""
                  width={144}
                  height={144}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                  <PlaceholderAvatar size="lg" className="!h-20 !w-20 !rounded-2xl [&>svg]:!h-10 [&>svg]:!w-10" />
                </div>
              }
            </div>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            {sharerProfileHref ?
              <Link
                to={sharerProfileHref}
                className="group inline-block max-w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
              >
                <h2 className="text-2xl font-bold tracking-tight text-dc-text transition-colors group-hover:text-dc-accent sm:text-3xl">
                  {sharerName}
                </h2>
              </Link>
            : <h2 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">{sharerName}</h2>}
            <p className="mt-1.5 text-sm text-dc-muted sm:text-base">(Shared their dancecard with you)</p>
          </div>
        </header>
      : null}

      <h1 className="text-xl font-bold text-dc-text">{data.conventionName}</h1>
      <p className="mt-1 text-xs text-dc-muted">Times shown in {data.timezone}</p>

      {demoOverlay ?
        <div className="mt-3 rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-100">
          <strong className="text-cyan-200">Demo mode</strong>. Pretending you are logged in: red overlay uses fixed
          busy windows (same as seeded <code className="text-cyan-50/90">DEMO-2mutual</code> guest).{' '}
          <strong>Check conflicts</strong> / <strong>Send request</strong> in the panel still need a real session.
        </div>
      : null}

      <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-3 text-sm text-emerald-100/90">
        <p className="font-medium text-emerald-50">What you are seeing</p>
        <p className="mt-1 text-emerald-100/85">
          <strong className="text-emerald-300">Pale green</strong> is the <strong>host’s</strong> shared free time
          (their dancecard + buffer). When you are signed in and have access to this convention,{' '}
          <strong className="text-red-300">red</strong> overlays <strong>your</strong> commitments (again with your
          buffer) so clashes are obvious. <strong className="text-emerald-200">Bright green</strong> is where you are{' '}
          <em>both</em> free. Click a
          block and a panel opens beside it to set length, describe the scene, run <strong>Check conflicts</strong>, and
          send the request.
        </p>
        <p className="mt-2 text-emerald-100/80">
          If the host has an empty schedule, pale green fills the whole convention; red still carves out your own busy
          time so bright green shows real mutual openings.
        </p>
      </div>

      {viewerCalStatus === 'signed_out' && !demoOverlay ?
        <div className="mt-4 rounded-xl border-2 border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-50">
          <p className="font-semibold">You are not signed in. The red “your calendar” layer is hidden.</p>
          <p className="mt-1 text-red-100/90">
            Sign in with an account that has access to this convention, then use{' '}
            <strong>Reload my schedule</strong> below (or click this tab again) so we can load your dancecard and draw
            busy times in red.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={loginHref}
              className="inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-dc-text hover:bg-red-500"
            >
              Log in
            </Link>
            <button
              type="button"
              className="rounded-full border border-red-300/50 px-4 py-2 text-sm text-red-100 hover:bg-red-900/40"
              onClick={() => setOverlayRefreshKey((n) => n + 1)}
            >
              Reload my schedule
            </button>
          </div>
        </div>
      : null}
      {viewerCalStatus === 'blocked' && !demoOverlay ?
        <div className="mt-4 rounded-xl border-2 border-amber-500/50 bg-amber-950/35 px-4 py-3 text-sm text-amber-50">
          <p className="font-semibold">Your dancecard could not be loaded (HTTP forbidden).</p>
          <p className="mt-1 text-amber-100/90">
            You need attendee or staff access on this convention to overlay your schedule. Host free time still shows
            in pale green; use <strong>Check conflicts</strong> after picking a time.
          </p>
          <button
            type="button"
            className="mt-3 rounded-full border border-amber-300/50 px-4 py-2 text-sm text-amber-50 hover:bg-amber-900/40"
            onClick={() => setOverlayRefreshKey((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      : null}
      {viewerCalStatus === 'loading' && !demoOverlay ?
        <p className="mt-3 text-xs text-dc-muted">Loading your schedule overlay…</p>
      : null}

      {statusForOverlay === 'ready' ?
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-dc-muted">
          <span>
            Your overlay: <strong className="text-dc-text-muted">{calForOverlay?.items?.length ?? 0}</strong> calendar
            row(s) · <strong className="text-dc-text-muted">{viewerBusyExpanded.length}</strong> busy segment(s)
            after buffer (drawn in red).
            {demoOverlay ? <span className="text-cyan-300/90"> (demo)</span> : null}
          </span>
          <button
            type="button"
            className="rounded-full border border-dc-border px-3 py-1 text-dc-text-muted hover:bg-dc-elevated-muted"
            onClick={() => setOverlayRefreshKey((n) => n + 1)}
          >
            Reload my schedule
          </button>
        </div>
      : null}
      {statusForOverlay === 'ready' && (calForOverlay?.items?.length ?? 0) > 0 && viewerBusyExpanded.length === 0 ?
        <p className="mt-2 text-xs text-amber-200">
          Your dancecard has rows, but none overlap this convention window after clipping. Nothing to paint in red.
        </p>
      : null}

      {data.freeGaps.length > 0 ?
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-dc-text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded-sm bg-emerald-900/50 ring-1 ring-emerald-700/50" /> Host free
            (shared)
          </span>
          {statusForOverlay === 'ready' ?
            <>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-5 rounded-sm bg-red-600/50 ring-1 ring-red-400/40" /> Your calendar
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-5 rounded-sm bg-emerald-400 ring-1 ring-emerald-200/60" /> You can
                book here
              </span>
            </>
          : null}
        </div>
      : null}

      {data.freeGaps.length > 0 ?
        <>
          <p className="mt-4 text-sm text-dc-text-muted">
            Tap a <span className="text-emerald-200 font-medium">bright green</span> block (mutual free time). A panel
            opens next to it: pick how long the scene runs, add a short description, then <strong>Check conflicts</strong>
            . If you are not signed in, only the host’s free time appears. Sign in so we can overlay your calendar in red
            and show bright green mutual gaps.
          </p>
          <div className="mt-4">
            <ConventionDancecardCompareGrid
              hostFreeGaps={data.freeGaps}
              conventionStartsAt={data.conventionStartsAt}
              conventionEndsAt={data.conventionEndsAt}
              timezone={tz}
              viewerCal={calForOverlay}
              viewerCalStatus={statusForOverlay}
              onMutualSlotClick={handleMutualSlotClick}
            />
          </div>
        </>
      : null}

      {submitMsg && <p className="mt-3 text-sm text-dc-text-muted">{submitMsg}</p>}

      <p className="mt-8 text-sm">
        <Link to={`/conventions/${encodeURIComponent(slug ?? '')}`} className="text-dc-accent hover:underline">
          Convention home
        </Link>
      </p>

      {slotPanelOpen && selection ?
        <div
          ref={slotPanelRef}
          data-slot-panel
          className="fixed z-50 max-h-[min(440px,calc(100vh-16px))] overflow-y-auto rounded-xl border border-dc-border bg-dc-elevated-solid p-4 shadow-2xl shadow-black/50"
          style={{ top: panelCoords.top, left: panelCoords.left, width: panelCoords.width }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="slot-request-title"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 id="slot-request-title" className="text-base font-semibold text-dc-text">
              Request this time
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text"
              onClick={() => dismissSlotPanel()}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="mt-1 text-xs text-dc-muted leading-relaxed">
            {formatRange(selection.startsAt.toISOString(), selection.endsAt.toISOString(), tz)}
          </p>

          <p className="mt-3 text-xs font-medium text-dc-muted">Length</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[30, 60, 90].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMin(m)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  durationMin === m ? 'bg-emerald-600 text-dc-text' : 'bg-dc-elevated-muted text-dc-text-muted hover:bg-white/15'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>

          <label htmlFor="slot-request-desc" className="mt-3 block text-xs font-medium text-dc-muted">
            Short description
          </label>
          <textarea
            id="slot-request-desc"
            value={requestDescription}
            onChange={(e) => setRequestDescription(e.target.value)}
            rows={3}
            maxLength={280}
            className="mt-1 w-full resize-none rounded-lg border border-dc-border bg-dc-surface-muted px-2.5 py-2 text-sm text-dc-text placeholder:text-zinc-500"
            placeholder="What you want to do together (shown to the host)"
          />
          <p className="mt-0.5 text-[10px] text-dc-muted">{requestDescription.length}/280</p>

          {needLogin ?
            <p className="mt-2 text-xs text-amber-200">
              Sign in to check conflicts and send a request.{' '}
              <Link to={loginHref} className="font-medium text-dc-accent hover:underline">
                Log in
              </Link>
            </p>
          : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={previewLoading}
              onClick={() => void runPreview()}
              className="rounded-full border border-dc-border-strong bg-dc-elevated-muted px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {previewLoading ? 'Checking…' : 'Check conflicts'}
            </button>
            <button
              type="button"
              disabled={submitLoading || !canSubmitRequest}
              title={sendRequestBlockedReason ?? 'Send this booking request to the host'}
              onClick={() => void submitRequest()}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-dc-text shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitLoading ? 'Sending…' : 'Send request'}
            </button>
          </div>
          {!preview && !needLogin ?
            <p className="mt-2 text-[10px] leading-snug text-dc-muted">
              <strong className="text-dc-text-muted">Send request</strong> stays dimmed until{' '}
              <strong className="text-dc-text-muted">Check conflicts</strong> succeeds (no overlaps).
            </p>
          : null}

          {conflictLines && conflictLines.length > 0 ?
            <ul className="mt-3 space-y-1 rounded-lg border border-amber-900/40 bg-amber-950/25 px-2.5 py-2 text-xs text-amber-100">
              {conflictLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          : null}

          {preview && !conflictLines ?
            <p className="mt-3 text-xs text-emerald-200">No conflicts. You can send a request.</p>
          : null}
        </div>
      : null}
    </div>
  )
}
