import { useCallback, useEffect, useMemo, useState } from 'react'
import { dayHeading } from '@/components/conventions/convention-schedule-utils'
import { useConfirm } from '@/hooks/useConfirm'

export type DancecardCalendarItem = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  kind: string
  subtitle?: string
  location?: string | null
  mutable: boolean
}

type FreeGap = { startsAt: string; endsAt: string }

type ShareRow = { id: string; token: string; label: string | null; revokedAt: string | null; createdAt: string }

type BookingRow = {
  id: string
  hostUserId: string
  guestUserId: string
  startsAt: string
  endsAt: string
  description: string
  status: string
  proposedStartsAt?: string | null
  proposedEndsAt?: string | null
  proposedByUserId?: string | null
}

type OpenVolunteerShift = {
  id: string
  title: string
  description: string | null
  role: string | null
  location: string | null
  startsAt: string
  endsAt: string
  capacityMax: number | null
  signupCount: number
  shiftStatus: string
}

type SwapRow = {
  id: string
  shiftId: string
  status: string
  note: string | null
  createdAt: string
  respondedAt?: string | null
}

type EligibleShift = {
  id: string
  title: string
  role: string | null
  startsAt: string
  endsAt: string
  shiftStatus: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

async function dancecardFetchError(r: Response, fallback: string): Promise<string> {
  if (r.status === 401) return 'Sign in to view your dancecard.'
  if (r.status === 403) return 'You do not have access to the dancecard for this convention.'
  try {
    const j = (await r.json()) as { error?: string }
    if (j.error) return j.error
  } catch {
    /* ignore */
  }
  return fallback
}

/** Value for `<input type="datetime-local" />` in the viewer's local timezone. */
function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function RescheduleProposeForm({
  bookingId,
  baseStartsAt,
  baseEndsAt,
  slugKey,
  onDone,
}: {
  bookingId: string
  baseStartsAt: string
  baseEndsAt: string
  slugKey: string
  onDone: () => void
}) {
  const [start, setStart] = useState(() => toDatetimeLocalValue(baseStartsAt))
  const [end, setEnd] = useState(() => toDatetimeLocalValue(baseEndsAt))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStart(toDatetimeLocalValue(baseStartsAt))
    setEnd(toDatetimeLocalValue(baseEndsAt))
  }, [bookingId, baseStartsAt, baseEndsAt])

  async function submit() {
    setBusy(true)
    try {
      const r = await fetch(
        `/api/v1/conventions/${slugKey}/dancecard/booking-requests/${encodeURIComponent(bookingId)}/reschedule-request`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        },
      )
      if (r.ok) onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dc-border-subtle p-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">Propose a new time</p>
      <label className="block text-[10px] text-dc-muted">
        Start
        <input
          type="datetime-local"
          className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label className="block text-[10px] text-dc-muted">
        End
        <input
          type="datetime-local"
          className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <label className="block text-[10px] text-dc-muted">
        Note (optional)
        <input
          type="text"
          className="mt-0.5 w-full rounded border border-dc-border bg-dc-surface-muted px-2 py-1 text-xs text-dc-text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        className="rounded-lg bg-dc-accent/18 px-3 py-1.5 text-xs font-medium text-dc-accent disabled:opacity-50"
        onClick={() => void submit()}
      >
        Send reschedule request
      </button>
    </div>
  )
}

export default function ConventionDancecardPanel({
  slug,
  timezone,
  reloadKey = 0,
  focusReservations = false,
}: {
  slug: string
  timezone: string
  /** Increment when program signup adds to dancecard so this panel refetches. */
  reloadKey?: number
  /** Scroll emphasis on scene / reservation requests (hub Reservations card). */
  focusReservations?: boolean
}) {
  const key = encodeURIComponent(slug)
  const { confirm, confirmDialog } = useConfirm()
  const [items, setItems] = useState<DancecardCalendarItem[]>([])
  const [freeGaps, setFreeGaps] = useState<FreeGap[]>([])
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [incoming, setIncoming] = useState<BookingRow[]>([])
  const [outgoing, setOutgoing] = useState<BookingRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [conventionStartsAt, setConventionStartsAt] = useState<string | null>(null)
  const [conventionEndsAt, setConventionEndsAt] = useState<string | null>(null)
  const [blockTitle, setBlockTitle] = useState('')
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockBusy, setBlockBusy] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [openShifts, setOpenShifts] = useState<OpenVolunteerShift[]>([])
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null)
  const [mySwaps, setMySwaps] = useState<SwapRow[]>([])
  const [eligibleMine, setEligibleMine] = useState<EligibleShift[]>([])
  const [eligibleOpen, setEligibleOpen] = useState<EligibleShift[]>([])
  const [swapShiftId, setSwapShiftId] = useState('')
  const [swapNote, setSwapNote] = useState('')
  const [swapBusy, setSwapBusy] = useState(false)

  const reload = useCallback(async () => {
    setErr(null)
    const [c1, c2, c3, c4, c5, c6] = await Promise.all([
      fetch(`/api/v1/conventions/${key}/dancecard/calendar`, { credentials: 'include' }),
      fetch(`/api/v1/conventions/${key}/dancecard/shares`, { credentials: 'include' }),
      fetch(`/api/v1/conventions/${key}/dancecard/booking-requests`, { credentials: 'include' }),
      fetch(`/api/v1/conventions/${key}/volunteer-shifts/open`, { credentials: 'include' }),
      fetch(`/api/v1/conventions/${key}/shift-swaps/mine`, { credentials: 'include' }),
      fetch(`/api/v1/conventions/${key}/shift-swaps/eligible-shifts`, { credentials: 'include' }),
    ])
    let authErr: string | null = null
    if (c1.ok) {
      const d = (await c1.json()) as {
        items: DancecardCalendarItem[]
        freeGaps: FreeGap[]
        bufferMinutes: number
        conventionStartsAt?: string
        conventionEndsAt?: string
      }
      setItems(d.items ?? [])
      setFreeGaps(d.freeGaps ?? [])
      setBufferMinutes(d.bufferMinutes ?? 0)
      setConventionStartsAt(d.conventionStartsAt ?? null)
      setConventionEndsAt(d.conventionEndsAt ?? null)
    } else {
      setItems([])
      setFreeGaps([])
      setConventionStartsAt(null)
      setConventionEndsAt(null)
      if (c1.status === 401 || c1.status === 403) {
        authErr = await dancecardFetchError(c1, 'Could not load dancecard.')
      }
    }
    if (c2.ok) {
      const d = (await c2.json()) as { items: ShareRow[] }
      setShares(d.items ?? [])
    } else {
      setShares([])
      if (!authErr && (c2.status === 401 || c2.status === 403)) {
        authErr = await dancecardFetchError(c2, 'Could not load dancecard shares.')
      }
    }
    if (c3.ok) {
      const d = (await c3.json()) as { incoming: BookingRow[]; outgoing: BookingRow[] }
      setIncoming(d.incoming ?? [])
      setOutgoing(d.outgoing ?? [])
    } else {
      setIncoming([])
      setOutgoing([])
      if (!authErr && (c3.status === 401 || c3.status === 403)) {
        authErr = await dancecardFetchError(c3, 'Could not load scene reservations.')
      }
    }
    if (authErr) setErr(authErr)
    if (c4.ok) {
      const d = (await c4.json()) as { shifts: OpenVolunteerShift[] }
      setOpenShifts(d.shifts ?? [])
    } else {
      setOpenShifts([])
    }
    if (c5.ok) {
      const d = (await c5.json()) as { swaps: SwapRow[] }
      setMySwaps(d.swaps ?? [])
    } else {
      setMySwaps([])
    }
    if (c6.ok) {
      const d = (await c6.json()) as { myShifts: EligibleShift[]; openShifts: EligibleShift[] }
      setEligibleMine(d.myShifts ?? [])
      setEligibleOpen(d.openShifts ?? [])
    } else {
      setEligibleMine([])
      setEligibleOpen([])
    }
  }, [key])

  useEffect(() => {
    if (!swapShiftId && eligibleMine.length > 0) {
      setSwapShiftId(eligibleMine[0]!.id)
    }
  }, [eligibleMine, swapShiftId])

  useEffect(() => {
    void reload()
  }, [reload, reloadKey])

  useEffect(() => {
    if (!msg) return
    const timer = window.setTimeout(() => setMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [msg])

  useEffect(() => {
    if (!focusReservations) return
    document.getElementById('dc-reservations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusReservations, reloadKey])

  async function saveBuffer(next: number) {
    setMsg(null)
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/prefs`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bufferMinutes: next }),
    })
    if (!r.ok) {
      setErr('Could not save buffer preference.')
      return
    }
    const d = (await r.json()) as { bufferMinutes: number }
    setBufferMinutes(d.bufferMinutes)
    setMsg('Saved.')
    void reload()
  }

  async function removePersonalBlock(id: string) {
    if (!(await confirm('Remove this busy block?', 'It will no longer appear on your dancecard.', { destructive: true }))) {
      return
    }
    setErr(null)
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!r.ok) {
      setErr('Could not remove busy block.')
      return
    }
    setMsg('Busy block removed.')
    void reload()
  }

  async function addPersonalBlock() {
    if (!blockTitle.trim() || !blockStart || !blockEnd) {
      setErr('Title, start, and end are required.')
      return
    }
    setBlockBusy(true)
    setErr(null)
    try {
      const r = await fetch(`/api/v1/conventions/${key}/dancecard`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blockTitle.trim(),
          startsAt: new Date(blockStart).toISOString(),
          endsAt: new Date(blockEnd).toISOString(),
        }),
      })
      if (!r.ok) {
        setErr('Could not add personal block.')
        return
      }
      setBlockTitle('')
      setBlockStart('')
      setBlockEnd('')
      setMsg('Personal block added.')
      void reload()
    } finally {
      setBlockBusy(false)
    }
  }

  function prefillBlockForHour(hourStartIso: string, hourEndIso: string) {
    // datetime-local expects a local-time string; convert from the absolute ISO instants we computed.
    setBlockTitle('Busy time')
    setBlockStart(toDatetimeLocalValue(hourStartIso))
    setBlockEnd(toDatetimeLocalValue(hourEndIso))
    setShowBlockForm(true)
  }

  async function createShare() {
    setMsg(null)
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/share`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!r.ok) {
      setErr('Could not create share link.')
      return
    }
    const d = (await r.json()) as { url?: string }
    void reload()
    if (d.url && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(d.url)
      setMsg('Share link created and copied to clipboard.')
    } else {
      setMsg('Share link created.')
    }
  }

  async function claimVolunteerShift(shiftId: string) {
    setClaimBusyId(shiftId)
    setErr(null)
    try {
      const r = await fetch(
        `/api/v1/conventions/${key}/volunteer-shifts/${encodeURIComponent(shiftId)}/claim`,
        { method: 'POST', credentials: 'include' },
      )
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setErr(j.error ?? 'Could not claim shift.')
        return
      }
      setMsg('Shift claimed. It appears on your dancecard.')
      void reload()
    } finally {
      setClaimBusyId(null)
    }
  }

  async function submitSwapRequest() {
    if (!swapShiftId) {
      setErr('Pick a shift to swap.')
      return
    }
    setSwapBusy(true)
    setErr(null)
    try {
      const r = await fetch(`/api/v1/conventions/${key}/shift-swaps/requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: swapShiftId,
          ...(swapNote.trim() ? { note: swapNote.trim() } : {}),
        }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setErr(j.error ?? 'Could not submit swap request.')
        return
      }
      setSwapNote('')
      setMsg('Swap request submitted for organizer review.')
      void reload()
    } finally {
      setSwapBusy(false)
    }
  }

  async function cancelSwap(swapId: string) {
    const r = await fetch(`/api/v1/conventions/${key}/shift-swaps/requests/${encodeURIComponent(swapId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!r.ok) {
      setErr('Could not cancel swap request.')
      return
    }
    setMsg('Swap request cancelled.')
    void reload()
  }

  async function revokeShare(id: string) {
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/shares/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function acceptBooking(id: string) {
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/booking-requests/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function declineBooking(id: string) {
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/booking-requests/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function cancelBooking(id: string) {
    if (!(await confirm('Cancel this scene?', 'Both you and the other person will lose this reservation.', { destructive: true }))) return
    const r = await fetch(`/api/v1/conventions/${key}/dancecard/booking-requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function acceptRescheduleBooking(id: string) {
    const r = await fetch(
      `/api/v1/conventions/${key}/dancecard/booking-requests/${encodeURIComponent(id)}/reschedule-accept`,
      { method: 'POST', credentials: 'include' },
    )
    if (r.ok) void reload()
  }

  const sortedIncoming = useMemo(() => {
    const rank: Record<string, number> = { PENDING: 0, RESCHEDULE_PENDING: 1, ACCEPTED: 2 }
    return [...incoming].sort((a, b) => {
      const d = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
      if (d !== 0) return d
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    })
  }, [incoming])

  const blockedTimes = useMemo(() => {
    return items
      .filter((it) => it.kind === 'dancecard_manual' && it.mutable)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [items])

  type HourSlotRow = {
    slotStartIso: string
    slotEndIso: string
    open: boolean
    label: string
  }

  const hourSlotsByDay = useMemo(() => {
    if (!conventionStartsAt || !conventionEndsAt) return [] as Array<{ day: string; slots: HourSlotRow[] }>

    const winStart = new Date(conventionStartsAt)
    const winEnd = new Date(conventionEndsAt)

    // Normalize to hour boundaries in absolute time; day labels are rendered in the convention timezone.
    const cursor = new Date(winStart)
    cursor.setUTCMinutes(0, 0, 0)

    const freeIntervals = freeGaps
      .map((g) => ({ start: new Date(g.startsAt), end: new Date(g.endsAt) }))
      .filter((g) => g.end.getTime() > g.start.getTime())

    function inAnyFreeGap(start: Date, end: Date) {
      // "Open" means the entire hour slot is inside a free gap.
      return freeIntervals.some((g) => start.getTime() >= g.start.getTime() && end.getTime() <= g.end.getTime())
    }

    function claimedLabelForOverlap(overlaps: DancecardCalendarItem[]) {
      if (overlaps.length === 0) return 'Open'
      const best = overlaps.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]!
      const raw = `${best.subtitle ?? best.title}`.trim()
      if (!raw) return 'Busy'
      if (best.kind === 'dancecard_manual') return raw
      const rawLower = raw.toLowerCase()
      if (rawLower.startsWith('claimed by ')) return raw
      if (rawLower.startsWith('blocked:')) return raw
      return `Claimed by ${raw}`
    }

    const map = new Map<string, HourSlotRow[]>()
    for (let t = cursor.getTime(); t < winEnd.getTime(); t += 60 * 60 * 1000) {
      const slotStart = new Date(t)
      const slotEnd = new Date(t + 60 * 60 * 1000)

      const open = inAnyFreeGap(slotStart, slotEnd)

      const overlaps = items.filter((it) => new Date(it.startsAt).getTime() < slotEnd.getTime() && new Date(it.endsAt).getTime() > slotStart.getTime())

      // Only show hour rows that are either open (green) or busy/claimed.
      if (!open && overlaps.length === 0) continue

      const label = open ? 'Open' : claimedLabelForOverlap(overlaps)
      const day = dayHeading(slotStart.toISOString(), timezone)

      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push({ slotStartIso: slotStart.toISOString(), slotEndIso: slotEnd.toISOString(), open, label })
    }

    return Array.from(map.entries()).map(([day, slots]) => ({
      day,
      slots: slots.sort((a, b) => new Date(a.slotStartIso).getTime() - new Date(b.slotStartIso).getTime()),
    }))
  }, [conventionStartsAt, conventionEndsAt, freeGaps, items, timezone])

  const bufferOptions = useMemo(() => Array.from({ length: 9 }, (_, i) => i * 15), [])

  const scrollList =
    'max-h-36 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]'
  const scrollPanel =
    'max-h-[min(22rem,42vh)] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]'

  return (
    <div className="dc-availability-panel space-y-3">
      {err ?
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{err}</p>
            <button
              type="button"
              onClick={() => setErr(null)}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}
      {msg ?
        <div
          className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100"
          role="status"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{msg}</p>
            <button
              type="button"
              onClick={() => setMsg(null)}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}

      <section className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated/95/50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-dc-text">Your blocked times</h3>
            <p className="mt-0.5 text-[11px] text-dc-muted">Presets and custom blocks on your dancecard.</p>
          </div>
          <button
            type="button"
            className="min-h-10 shrink-0 rounded-xl border border-dc-border bg-dc-accent/10 px-3 text-xs font-medium text-dc-accent hover:bg-dc-accent/16"
            onClick={() => setShowBlockForm((v) => !v)}
          >
            Add busy time
          </button>
        </div>

        {blockedTimes.length === 0 ?
          <p className="text-sm text-dc-muted">
            Nothing blocked yet. Tap green hours below or use Add busy time.
          </p>
        : <ul className={`space-y-1.5 ${scrollList}`}>
            {blockedTimes.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-dc-surface-muted px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dc-text">{it.title}</p>
                  <p className="text-xs text-dc-text-muted">
                    {new Date(it.startsAt).toLocaleString([], { timeZone: timezone, hour: 'numeric', minute: '2-digit', weekday: 'short', month: 'short', day: '2-digit' })} –{' '}
                    {new Date(it.endsAt).toLocaleTimeString([], { timeZone: timezone, hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs text-red-300 hover:underline"
                  onClick={() => void removePersonalBlock(it.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        }

        {showBlockForm ?
          <div className="space-y-3 rounded-xl border border-dc-border bg-dc-elevated/95/40 p-3">
            <div className="grid gap-2">
              <input
                className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                placeholder="Title"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-dc-muted">
                Start
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                />
              </label>
              <label className="text-xs text-dc-muted">
                End
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={blockBusy}
              className="rounded-xl bg-dc-accent/18 px-4 py-2 text-sm font-medium text-dc-accent disabled:opacity-50"
              onClick={() => void addPersonalBlock()}
            >
              {blockBusy ? 'Adding…' : 'Add block'}
            </button>
          </div>
        : null}
      </section>

      <section id="dc-reservations" className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated/95/50 p-3">
        <h3 className="text-sm font-semibold text-dc-text">Scene reservations</h3>
        <p className="text-[11px] text-dc-muted">Approve requests and manage confirmed scenes.</p>
        {sortedIncoming.length === 0 ?
          <p className="text-xs text-dc-muted">Nothing here yet.</p>
        : <ul className={`space-y-2 ${scrollList}`}>
            {sortedIncoming.map((b) => {
              const guestProposedReschedule =
                b.status === 'RESCHEDULE_PENDING' && b.proposedByUserId === b.guestUserId
              const hostProposedReschedule =
                b.status === 'RESCHEDULE_PENDING' && b.proposedByUserId === b.hostUserId
              return (
                <li key={b.id} className="rounded-xl border border-dc-border bg-dc-elevated/95 p-3 text-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">{b.status}</p>
                  <p className="text-dc-text-muted">
                    {new Date(b.startsAt).toLocaleString([], { timeZone: timezone })} –{' '}
                    {new Date(b.endsAt).toLocaleTimeString([], { timeZone: timezone })}
                  </p>
                  <p className="mt-1 text-dc-text">{b.description}</p>
                  {b.status === 'RESCHEDULE_PENDING' ?
                    <p className="mt-1 text-xs text-amber-200">
                      Proposed window:{' '}
                      {b.proposedStartsAt ?
                        `${new Date(b.proposedStartsAt).toLocaleString([], { timeZone: timezone })} – ${b.proposedEndsAt ? new Date(b.proposedEndsAt).toLocaleTimeString([], { timeZone: timezone }) : ''}`
                      : ''}
                    </p>
                  : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.status === 'PENDING' ?
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-dc-accent/18 px-3 py-1.5 text-xs font-medium text-dc-accent"
                          onClick={() => void acceptBooking(b.id)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text"
                          onClick={() => void declineBooking(b.id)}
                        >
                          Decline
                        </button>
                      </>
                    : null}
                    {guestProposedReschedule ?
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-dc-accent/18 px-3 py-1.5 text-xs font-medium text-dc-accent"
                          onClick={() => void acceptRescheduleBooking(b.id)}
                        >
                          Accept new time
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text"
                          onClick={() => void declineBooking(b.id)}
                        >
                          Decline reschedule
                        </button>
                      </>
                    : null}
                    {hostProposedReschedule ?
                      <p className="text-xs text-dc-muted">Waiting for the guest to confirm your proposed time.</p>
                    : null}
                    {b.status === 'ACCEPTED' || b.status === 'RESCHEDULE_PENDING' ?
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:underline"
                        onClick={() => void cancelBooking(b.id)}
                      >
                        Cancel scene
                      </button>
                    : null}
                  </div>
                  {b.status === 'ACCEPTED' ?
                    <RescheduleProposeForm
                      bookingId={b.id}
                      baseStartsAt={b.startsAt}
                      baseEndsAt={b.endsAt}
                      slugKey={key}
                      onDone={() => void reload()}
                    />
                  : null}
                </li>
              )
            })}
          </ul>
        }

        {(!focusReservations && outgoing.length > 0) ? (
          <div className="mt-3 border-t border-dc-border pt-3">
            <p className="text-xs font-medium text-dc-muted">Scenes you requested (as guest)</p>
            <ul className={`mt-2 space-y-2 text-xs text-dc-text-muted ${scrollList}`}>
              {outgoing.map((b) => {
                const hostProposedReschedule =
                  b.status === 'RESCHEDULE_PENDING' && b.proposedByUserId === b.hostUserId
                const guestProposedReschedule =
                  b.status === 'RESCHEDULE_PENDING' && b.proposedByUserId === b.guestUserId
                return (
                  <li key={b.id} className="rounded-xl border border-dc-border bg-dc-elevated/95 p-3 text-sm text-dc-text-muted">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-dc-muted">{b.status}</p>
                    <p>
                      {new Date(b.startsAt).toLocaleString([], { timeZone: timezone })} –{' '}
                      {new Date(b.endsAt).toLocaleTimeString([], { timeZone: timezone })}
                    </p>
                    <p className="mt-1 text-dc-text">{b.description}</p>
                    {b.status === 'RESCHEDULE_PENDING' && b.proposedStartsAt ?
                      <p className="mt-1 text-xs text-amber-200">
                        Proposed window:{' '}
                        {new Date(b.proposedStartsAt).toLocaleString([], { timeZone: timezone })} –{' '}
                        {b.proposedEndsAt ?
                          new Date(b.proposedEndsAt).toLocaleTimeString([], { timeZone: timezone })
                        : ''}
                      </p>
                    : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.status === 'PENDING' ?
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:underline"
                          onClick={() => void cancelBooking(b.id)}
                        >
                          Withdraw request
                        </button>
                      : null}
                      {hostProposedReschedule ?
                        <>
                          <button
                            type="button"
                            className="rounded-lg bg-dc-accent/18 px-3 py-1.5 text-xs font-medium text-dc-accent"
                            onClick={() => void acceptRescheduleBooking(b.id)}
                          >
                            Accept new time
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text"
                            onClick={() => void declineBooking(b.id)}
                          >
                            Decline reschedule
                          </button>
                        </>
                      : null}
                      {guestProposedReschedule ?
                        <p className="text-xs text-dc-muted">Waiting for the host to confirm your proposed time.</p>
                      : null}
                      {b.status === 'ACCEPTED' || b.status === 'RESCHEDULE_PENDING' ?
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:underline"
                          onClick={() => void cancelBooking(b.id)}
                        >
                          Cancel scene
                        </button>
                      : null}
                    </div>
                    {b.status === 'ACCEPTED' ?
                      <RescheduleProposeForm
                        bookingId={b.id}
                        baseStartsAt={b.startsAt}
                        baseEndsAt={b.endsAt}
                        slugKey={key}
                        onDone={() => void reload()}
                      />
                    : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {!focusReservations ?
        <section className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated/95/50 p-3">
          <h3 className="text-sm font-semibold text-dc-text">Open volunteer shifts</h3>
          <p className="text-[11px] text-dc-muted">Claim an open staff shift. It syncs to your dancecard calendar.</p>
          {openShifts.length === 0 ?
            <p className="text-sm text-dc-muted">No open shifts right now.</p>
          : <ul className={`space-y-2 ${scrollList}`}>
              {openShifts.map((s) => (
                <li key={s.id} className="rounded-lg border border-white/[0.08] bg-dc-elevated/95/40 p-2.5">
                  <p className="text-sm font-medium text-dc-text">{s.title}</p>
                  {s.description ?
                    <p className="mt-0.5 text-xs text-dc-muted line-clamp-2">{s.description}</p>
                  : null}
                  <p className="mt-1 text-xs text-dc-text-muted">
                    {new Date(s.startsAt).toLocaleString([], { timeZone: timezone })} –{' '}
                    {new Date(s.endsAt).toLocaleTimeString([], { timeZone: timezone })}
                    {s.location ? ` · ${s.location}` : ''}
                  </p>
                  {s.capacityMax != null ?
                    <p className="text-[10px] text-dc-muted">
                      {s.signupCount}/{s.capacityMax} filled
                    </p>
                  : null}
                  <button
                    type="button"
                    disabled={claimBusyId === s.id}
                    className="mt-2 rounded-lg bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-500 disabled:opacity-50"
                    onClick={() => void claimVolunteerShift(s.id)}
                  >
                    {claimBusyId === s.id ? 'Claiming…' : 'Claim shift'}
                  </button>
                </li>
              ))}
            </ul>
          }
        </section>
      : null}

      {!focusReservations ?
        <section className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated/95/50 p-3">
          <h3 className="text-sm font-semibold text-dc-text">Shift swap requests</h3>
          <p className="text-[11px] text-dc-muted">
            Ask organizers to reassign a shift you cannot cover. Approval happens in the organizer dashboard.
          </p>
          {mySwaps.length > 0 ?
            <ul className={`space-y-1.5 ${scrollList}`}>
              {mySwaps.map((sw) => (
                <li key={sw.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs">
                  <span className="text-dc-text-muted">
                    <span className="font-medium uppercase text-dc-muted">{sw.status}</span>
                    {sw.note ? ` · ${sw.note}` : ''}
                  </span>
                  {sw.status === 'pending' ?
                    <button
                      type="button"
                      className="text-red-300 hover:underline"
                      onClick={() => void cancelSwap(sw.id)}
                    >
                      Cancel
                    </button>
                  : null}
                </li>
              ))}
            </ul>
          : <p className="text-sm text-dc-muted">No swap requests yet.</p>}
          {eligibleMine.length > 0 ?
            <div className="space-y-2 border-t border-dc-border pt-3">
              <label className="block text-xs text-dc-muted">
                Your shift
                <select
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                  value={swapShiftId}
                  onChange={(e) => setSwapShiftId(e.target.value)}
                >
                  {eligibleMine.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} -{' '}
                      {new Date(s.startsAt).toLocaleString([], {
                        timeZone: timezone,
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                      })}
                    </option>
                  ))}
                </select>
              </label>
              {eligibleOpen.length > 0 ?
                <p className="text-[10px] text-dc-muted">
                  {eligibleOpen.length} other open shift(s) on the convention. Organizers match swaps manually.
                </p>
              : null}
              <label className="block text-xs text-dc-muted">
                Note (optional)
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                  value={swapNote}
                  onChange={(e) => setSwapNote(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                type="button"
                disabled={swapBusy}
                className="rounded-lg bg-dc-accent/18 px-3 py-1.5 text-xs font-medium text-dc-accent disabled:opacity-50"
                onClick={() => void submitSwapRequest()}
              >
                {swapBusy ? 'Submitting…' : 'Request swap'}
              </button>
            </div>
          : <p className="text-xs text-dc-muted">Claim or get assigned a volunteer shift before requesting a swap.</p>}
        </section>
      : null}

      {focusReservations ?
        null
      : hourSlotsByDay.length === 0 ?
        null
      : (
          <section className="space-y-2 rounded-xl border border-dc-border bg-dc-elevated/95/50 p-3">
            <h3 className="text-sm font-semibold text-dc-text">Calendar by day</h3>
            <p className="text-[11px] text-dc-muted">
              Tap green hours to pre-fill Add busy time. Each column scrolls independently.
            </p>

            <div className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-4 ${scrollPanel}`}>
              {hourSlotsByDay.map(({ day, slots }) => {
                const openCount = slots.filter((s) => s.open).length
                const busyCount = slots.length - openCount
                const dayStart = slots[0]?.slotStartIso
                const dayEnd = slots.length > 0 ? slots[slots.length - 1]!.slotEndIso : null
                return (
                  <div
                    key={day}
                    className="flex min-h-0 flex-col rounded-lg border border-white/[0.08] bg-dc-elevated/95/40 p-2 sm:max-h-none"
                  >
                    <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-accent/90">{day}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-dc-muted">
                          {busyCount} busy · {openCount} open
                        </span>
                        {dayStart && dayEnd ?
                          <button
                            type="button"
                            className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/16"
                            onClick={() => prefillBlockForHour(dayStart, dayEnd)}
                          >
                            Block day
                          </button>
                        : null}
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5 max-h-52 sm:max-h-60 [-webkit-overflow-scrolling:touch]">
                      {slots.map((s) => (
                        <button
                          key={s.slotStartIso}
                          type="button"
                          onClick={() => {
                            if (!s.open) return
                            prefillBlockForHour(s.slotStartIso, s.slotEndIso)
                          }}
                          className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                            s.open
                              ? 'border-emerald-500/25 bg-emerald-500/10 hover:border-emerald-500/40'
                              : 'border-white/[0.10] bg-white/[0.03] hover:border-dc-border-strong'
                          }`}
                          disabled={!s.open}
                        >
                          <p className="text-xs font-medium tabular-nums text-dc-text">
                            {new Date(s.slotStartIso).toLocaleTimeString([], {
                              timeZone: timezone,
                              hour: 'numeric',
                            })}
                          </p>
                          <p className={`truncate text-[11px] leading-tight ${s.open ? 'text-emerald-200' : 'text-dc-text-muted'}`}>
                            {s.open ? 'Open' : s.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      {!focusReservations ?
        <details className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3" open={false}>
          <summary className="cursor-pointer text-sm font-semibold text-dc-text">Share &amp; buffer</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-dc-muted">
              Buffer adds trailing time after each commitment before you appear free. Share links only expose free windows.
            </p>
            <div className="flex flex-wrap gap-2">
              {bufferOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    bufferMinutes === m
                      ? 'bg-amber-600/90 text-black'
                      : 'border border-dc-border text-dc-text-muted hover:border-white/30 hover:text-dc-text'
                  }`}
                  onClick={() => void saveBuffer(m)}
                >
                  {m === 0 ? 'No buffer' : `${m}m`}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="rounded-xl bg-dc-accent/18 px-4 py-2 text-sm font-medium text-dc-accent hover:bg-dc-accent/26"
              onClick={() => void createShare()}
            >
              Create share link &amp; copy
            </button>
            {shares.filter((s) => !s.revokedAt).length > 0 ?
              <ul className="space-y-1 text-xs">
                {shares
                  .filter((s) => !s.revokedAt)
                  .map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dc-border p-2">
                      <code className="text-dc-text-muted break-all">
                        {`${window.location.origin}/conventions/${encodeURIComponent(slug)}/dancecard/s/${s.token}`}
                      </code>
                      <button type="button" className="text-red-300 hover:underline" onClick={() => void revokeShare(s.id)}>
                        Revoke
                      </button>
                    </li>
                  ))}
              </ul>
            : null}
          </div>
        </details>
      : null}
      {confirmDialog}
    </div>
  )
}
