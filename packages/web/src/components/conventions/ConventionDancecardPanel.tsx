import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  exclusiveEndOfZonedCalendarDayMs,
  formatUtcMsAsDatetimeLocalInZone,
  parseDatetimeLocalInZone,
  utcMillisAtZonedWallClock,
  zonedCalendarDateFromUtc,
} from '@/components/dancecard/time'
import { useConfirm } from '@/hooks/useConfirm'
import {
  dancecardApiBase,
  dancecardEntryIdForApi,
  dancecardSharePublicPath,
  makeDancecardApiScope,
  type DancecardApiKind,
  type DancecardApiScope,
} from '@/lib/dancecard/dancecardApiScope'
import SceneReservationCard, {
  type SceneReservationBooking,
} from '@/components/conventions/SceneReservationCard'

type LargeSlotPresetKey = 'lunch' | 'dinner' | 'sleep'

const LARGE_SLOT_PRESETS: Array<{
  key: LargeSlotPresetKey
  label: string
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
}> = [
  { key: 'lunch', label: 'Lunch', startHour: 12, startMinute: 0, endHour: 13, endMinute: 0 },
  { key: 'dinner', label: 'Dinner', startHour: 18, startMinute: 0, endHour: 19, endMinute: 0 },
  { key: 'sleep', label: 'Sleep', startHour: 23, startMinute: 0, endHour: 8, endMinute: 0 },
]

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

type ShareRow = { id: string; token: string; label: string | null; revokedAt: string | null; createdAt: string }

type BookingRow = SceneReservationBooking

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

/** Large, high-contrast expand/collapse chevron for mobile accordions. */
function AccordionChevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dc-border bg-dc-surface-muted text-dc-text md:hidden"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  )
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
  apiBase,
  onDone,
}: {
  bookingId: string
  baseStartsAt: string
  baseEndsAt: string
  apiBase: string
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
        `${apiBase}/dancecard/booking-requests/${encodeURIComponent(bookingId)}/reschedule-request`,
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
  apiKind = 'convention',
}: {
  slug: string
  timezone: string
  /** Increment when program signup adds to dancecard so this panel refetches. */
  reloadKey?: number
  /** Scroll emphasis on scene / reservation requests (hub Reservations card). */
  focusReservations?: boolean
  apiKind?: DancecardApiKind
}) {
  const scope: DancecardApiScope = useMemo(() => makeDancecardApiScope(apiKind, slug), [apiKind, slug])
  const apiBase = dancecardApiBase(scope)
  const { confirm, confirmDialog } = useConfirm()
  const [items, setItems] = useState<DancecardCalendarItem[]>([])
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
  const [applyToAllDays, setApplyToAllDays] = useState(false)
  const [selectedLargePreset, setSelectedLargePreset] = useState<LargeSlotPresetKey | null>(null)
  const [openShifts, setOpenShifts] = useState<OpenVolunteerShift[]>([])
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null)
  const [mySwaps, setMySwaps] = useState<SwapRow[]>([])
  const [eligibleMine, setEligibleMine] = useState<EligibleShift[]>([])
  const [eligibleOpen, setEligibleOpen] = useState<EligibleShift[]>([])
  const [swapShiftId, setSwapShiftId] = useState('')
  const [swapNote, setSwapNote] = useState('')
  const [swapBusy, setSwapBusy] = useState(false)
  /** Mobile accordion: one availability drawer open at a time. Desktop keeps all open. */
  const [availDrawer, setAvailDrawer] = useState<'share' | 'block' | 'blocked'>('share')
  const [isMdUp, setIsMdUp] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setIsMdUp(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const reload = useCallback(async () => {
    setErr(null)
    const volunteerFetches = scope.showVolunteerTools
      ? [
          fetch(`${apiBase}/volunteer-shifts/open`, { credentials: 'include' }),
          fetch(`${apiBase}/shift-swaps/mine`, { credentials: 'include' }),
          fetch(`${apiBase}/shift-swaps/eligible-shifts`, { credentials: 'include' }),
        ]
      : ([null, null, null] as const)
    const [c1, c2, c3, c4, c5, c6] = await Promise.all([
      fetch(`${apiBase}/dancecard/calendar`, { credentials: 'include' }),
      fetch(`${apiBase}/dancecard/shares`, { credentials: 'include' }),
      fetch(`${apiBase}/dancecard/booking-requests`, { credentials: 'include' }),
      ...volunteerFetches,
    ])
    let authErr: string | null = null
    if (c1.ok) {
      const d = (await c1.json()) as {
        items: DancecardCalendarItem[]
        bufferMinutes: number
        conventionStartsAt?: string
        conventionEndsAt?: string
        playSpaceStartsAt?: string
        playSpaceEndsAt?: string
      }
      setItems(d.items ?? [])
      setBufferMinutes(d.bufferMinutes ?? 0)
      setConventionStartsAt(d.conventionStartsAt ?? d.playSpaceStartsAt ?? null)
      setConventionEndsAt(d.conventionEndsAt ?? d.playSpaceEndsAt ?? null)
    } else {
      setItems([])
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
    if (c4?.ok) {
      const d = (await c4.json()) as { shifts: OpenVolunteerShift[] }
      setOpenShifts(d.shifts ?? [])
    } else {
      setOpenShifts([])
    }
    if (c5?.ok) {
      const d = (await c5.json()) as { swaps: SwapRow[] }
      setMySwaps(d.swaps ?? [])
    } else {
      setMySwaps([])
    }
    if (c6?.ok) {
      const d = (await c6.json()) as { myShifts: EligibleShift[]; openShifts: EligibleShift[] }
      setEligibleMine(d.myShifts ?? [])
      setEligibleOpen(d.openShifts ?? [])
    } else {
      setEligibleMine([])
      setEligibleOpen([])
    }
  }, [apiBase, scope.showVolunteerTools])

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
    const r = await fetch(`${apiBase}/dancecard/prefs`, {
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
    const entryId = dancecardEntryIdForApi(id)
    const r = await fetch(`${apiBase}/dancecard/entries/${encodeURIComponent(entryId)}`, {
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

  async function postBusyBlock(title: string, startsAtIso: string, endsAtIso: string) {
    const r = await fetch(`${apiBase}/dancecard`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startsAt: startsAtIso, endsAt: endsAtIso }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'Could not add personal block.')
    }
  }

  function presetWindowForDay(
    preset: (typeof LARGE_SLOT_PRESETS)[number],
    dayYmd: string,
  ): { startsAt: string; endsAt: string } | null {
    const startMs = utcMillisAtZonedWallClock(timezone, dayYmd, preset.startHour, preset.startMinute)
    if (startMs == null) return null
    const wrapsNextDay =
      preset.endHour < preset.startHour ||
      (preset.endHour === preset.startHour && preset.endMinute <= preset.startMinute)
    const endYmd = wrapsNextDay
      ? zonedCalendarDateFromUtc(exclusiveEndOfZonedCalendarDayMs(timezone, dayYmd), timezone)
      : dayYmd
    const endMs = utcMillisAtZonedWallClock(timezone, endYmd, preset.endHour, preset.endMinute)
    if (endMs == null || endMs <= startMs) return null
    const rangeStart = conventionStartsAt ? Date.parse(conventionStartsAt) : null
    const rangeEnd = conventionEndsAt ? Date.parse(conventionEndsAt) : null
    let clippedStart = startMs
    let clippedEnd = endMs
    if (rangeStart != null && Number.isFinite(rangeStart)) clippedStart = Math.max(clippedStart, rangeStart)
    if (rangeEnd != null && Number.isFinite(rangeEnd)) clippedEnd = Math.min(clippedEnd, rangeEnd)
    if (clippedEnd <= clippedStart) return null
    return { startsAt: new Date(clippedStart).toISOString(), endsAt: new Date(clippedEnd).toISOString() }
  }

  function selectLargePreset(key: LargeSlotPresetKey) {
    const preset = LARGE_SLOT_PRESETS.find((p) => p.key === key)
    if (!preset) return
    setSelectedLargePreset(key)
    const day = conventionStartsAt
      ? zonedCalendarDateFromUtc(Date.parse(conventionStartsAt), timezone)
      : null
    if (!day) {
      setBlockTitle(preset.label)
      setErr('Event dates are not loaded yet.')
      return
    }
    const win = presetWindowForDay(preset, day)
    if (!win) {
      setErr(`Could not place ${preset.label} on that day.`)
      return
    }
    setBlockTitle(preset.label)
    setBlockStart(formatUtcMsAsDatetimeLocalInZone(Date.parse(win.startsAt), timezone))
    setBlockEnd(formatUtcMsAsDatetimeLocalInZone(Date.parse(win.endsAt), timezone))
    setErr(null)
  }

  async function addPersonalBlock() {
    if (!blockStart || !blockEnd) {
      setErr('Start and end are required.')
      return
    }
    const title =
      blockTitle.trim() ||
      (selectedLargePreset ?
        LARGE_SLOT_PRESETS.find((p) => p.key === selectedLargePreset)?.label
      : null) ||
      'Busy'
    if (!blockTitle.trim()) setBlockTitle(title)
    setBlockBusy(true)
    setErr(null)
    try {
      if (applyToAllDays && conventionStartsAt && conventionEndsAt) {
        const preset = selectedLargePreset
          ? LARGE_SLOT_PRESETS.find((p) => p.key === selectedLargePreset)
          : null
        const rangeStartMs = Date.parse(conventionStartsAt)
        const rangeEndMs = Date.parse(conventionEndsAt)
        let dayYmd = zonedCalendarDateFromUtc(rangeStartMs, timezone)
        const lastYmd = zonedCalendarDateFromUtc(rangeEndMs - 1, timezone)
        let added = 0
        while (dayYmd.localeCompare(lastYmd) <= 0) {
          let startsAt: string | null = null
          let endsAt: string | null = null
          if (preset) {
            const win = presetWindowForDay(preset, dayYmd)
            if (win) {
              startsAt = win.startsAt
              endsAt = win.endsAt
            }
          } else {
            const startParts = parseDatetimeLocalInZone(blockStart, timezone)
            const endParts = parseDatetimeLocalInZone(blockEnd, timezone)
            if (startParts != null && endParts != null) {
              const startWall = formatUtcMsAsDatetimeLocalInZone(startParts, timezone).slice(11)
              const endWall = formatUtcMsAsDatetimeLocalInZone(endParts, timezone).slice(11)
              const [sh, sm] = startWall.split(':').map(Number)
              const [eh, em] = endWall.split(':').map(Number)
              const wraps =
                eh < sh || (eh === sh && em <= sm)
              const startMs = utcMillisAtZonedWallClock(timezone, dayYmd, sh, sm)
              const endYmd = wraps
                ? zonedCalendarDateFromUtc(exclusiveEndOfZonedCalendarDayMs(timezone, dayYmd), timezone)
                : dayYmd
              const endMs = utcMillisAtZonedWallClock(timezone, endYmd, eh, em)
              if (startMs != null && endMs != null && endMs > startMs) {
                const clippedStart = Math.max(startMs, rangeStartMs)
                const clippedEnd = Math.min(endMs, rangeEndMs)
                if (clippedEnd > clippedStart) {
                  startsAt = new Date(clippedStart).toISOString()
                  endsAt = new Date(clippedEnd).toISOString()
                }
              }
            }
          }
          if (startsAt && endsAt) {
            await postBusyBlock(title, startsAt, endsAt)
            added += 1
          }
          dayYmd = zonedCalendarDateFromUtc(exclusiveEndOfZonedCalendarDayMs(timezone, dayYmd), timezone)
        }
        if (added === 0) {
          setErr('No blocks could be placed in the event window.')
          return
        }
        setMsg(`${title} blocked on ${added} day(s).`)
      } else {
        const startMs = parseDatetimeLocalInZone(blockStart, timezone) ?? Date.parse(blockStart)
        const endMs = parseDatetimeLocalInZone(blockEnd, timezone) ?? Date.parse(blockEnd)
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
          setErr('Start and end must be a valid window.')
          return
        }
        await postBusyBlock(title, new Date(startMs).toISOString(), new Date(endMs).toISOString())
        setMsg('Personal block added.')
      }
      setBlockTitle('')
      setBlockStart('')
      setBlockEnd('')
      setSelectedLargePreset(null)
      void reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add personal block.')
    } finally {
      setBlockBusy(false)
    }
  }

  async function createShare() {
    setMsg(null)
    const r = await fetch(`${apiBase}/dancecard/share`, {
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
        `${apiBase}/volunteer-shifts/${encodeURIComponent(shiftId)}/claim`,
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
      const r = await fetch(`${apiBase}/shift-swaps/requests`, {
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
    const r = await fetch(`${apiBase}/shift-swaps/requests/${encodeURIComponent(swapId)}`, {
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
    const r = await fetch(`${apiBase}/dancecard/shares/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function acceptBooking(id: string) {
    const r = await fetch(`${apiBase}/dancecard/booking-requests/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function declineBooking(id: string) {
    const r = await fetch(`${apiBase}/dancecard/booking-requests/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function cancelBooking(id: string) {
    if (!(await confirm('Cancel this scene?', 'Both you and the other person will lose this reservation.', { destructive: true }))) return
    const r = await fetch(`${apiBase}/dancecard/booking-requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) void reload()
  }

  async function acceptRescheduleBooking(id: string) {
    const r = await fetch(
      `${apiBase}/dancecard/booking-requests/${encodeURIComponent(id)}/reschedule-accept`,
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

  const bufferOptions = useMemo(() => Array.from({ length: 9 }, (_, i) => i * 15), [])

  const scrollList = focusReservations
    ? 'max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]'
    : 'max-h-36 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]'

  const isPlaySpace = scope.kind === 'play-space'

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

      {!focusReservations ?
        <section className="rounded-xl border border-amber-500/20 bg-amber-950/10">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-3 text-left md:min-h-11 md:cursor-default md:py-2.5"
            onClick={() => {
              if (!isMdUp) setAvailDrawer((d) => (d === 'share' ? 'block' : 'share'))
            }}
          >
            <h3 className="text-base font-semibold text-dc-text">Share &amp; buffer</h3>
            <AccordionChevron open={availDrawer === 'share' || isMdUp} />
          </button>
          {(isMdUp || availDrawer === 'share') ?
            <div className="space-y-3 border-t border-amber-500/15 px-3 pb-3 pt-2">
              <p className="hidden text-xs text-dc-muted md:block">
                Buffer adds trailing time after commitments. Share links only expose free windows.
              </p>
              <div className="flex flex-wrap gap-2">
                {bufferOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`min-h-11 rounded-full px-3.5 py-2 text-xs font-medium transition ${
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
                className="min-h-11 w-full rounded-xl bg-dc-accent px-4 py-2.5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:w-auto"
                onClick={() => void createShare()}
              >
                Copy share link
              </button>
              {shares.filter((s) => !s.revokedAt).length > 0 ?
                <details className="rounded-lg border border-dc-border/80 bg-dc-surface/40">
                  <summary className="min-h-11 cursor-pointer list-none px-3 py-2 text-xs font-medium text-dc-muted [&::-webkit-details-marker]:hidden">
                    {shares.filter((s) => !s.revokedAt).length} active link
                    {shares.filter((s) => !s.revokedAt).length === 1 ? '' : 's'} · tap to manage
                  </summary>
                  <ul className="space-y-1 border-t border-dc-border px-2 py-2 text-xs">
                    {shares
                      .filter((s) => !s.revokedAt)
                      .map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-2">
                          <code className="max-w-[14rem] truncate text-dc-text-muted sm:max-w-none sm:break-all">
                            {`${window.location.origin}${dancecardSharePublicPath(scope, s.token)}`}
                          </code>
                          <button
                            type="button"
                            className="min-h-11 min-w-11 rounded-lg px-2 text-red-300 hover:bg-red-500/10"
                            onClick={() => void revokeShare(s.id)}
                          >
                            Revoke
                          </button>
                        </li>
                      ))}
                  </ul>
                </details>
              : null}
            </div>
          : null}
        </section>
      : null}

      {!focusReservations ?
        <section className="rounded-xl border border-dc-border bg-dc-elevated/95/40">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-3 text-left md:min-h-11 md:cursor-default md:py-2.5"
            onClick={() => {
              if (!isMdUp) setAvailDrawer((d) => (d === 'block' ? 'share' : 'block'))
            }}
          >
            <h3 className="text-base font-semibold text-dc-text">Block time</h3>
            <AccordionChevron open={availDrawer === 'block' || isMdUp} />
          </button>
          {(isMdUp || availDrawer === 'block') ?
            <div className="space-y-3 border-t border-dc-border px-3 pb-3 pt-2">
              <div className="flex flex-wrap gap-2">
                {LARGE_SLOT_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedLargePreset === preset.key
                        ? 'bg-dc-accent text-dc-accent-foreground'
                        : 'border border-dc-border bg-dc-surface-muted text-dc-text hover:border-dc-accent/50'
                    }`}
                    onClick={() => selectLargePreset(preset.key)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-dc-muted">
                Pick Lunch, Dinner, or Sleep — or enter a custom title and times below.
              </p>
              <input
                className="min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                placeholder="Title (defaults to Busy)"
                value={blockTitle}
                onChange={(e) => {
                  setBlockTitle(e.target.value)
                  setSelectedLargePreset(null)
                }}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-dc-muted">
                  Start
                  <input
                    type="datetime-local"
                    className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                    value={blockStart}
                    onChange={(e) => {
                      setBlockStart(e.target.value)
                      setSelectedLargePreset(null)
                      if (!blockTitle.trim()) setBlockTitle('Busy')
                    }}
                  />
                </label>
                <label className="text-xs text-dc-muted">
                  End
                  <input
                    type="datetime-local"
                    className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                    value={blockEnd}
                    onChange={(e) => {
                      setBlockEnd(e.target.value)
                      setSelectedLargePreset(null)
                      if (!blockTitle.trim()) setBlockTitle('Busy')
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  disabled={blockBusy || !blockStart || !blockEnd}
                  className="min-h-11 w-full rounded-xl bg-dc-accent px-4 py-2.5 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50 sm:w-auto"
                  onClick={() => void addPersonalBlock()}
                >
                  {blockBusy ? 'Adding…' : 'Add block'}
                </button>
                <label className="inline-flex min-h-11 items-center gap-2 text-xs text-dc-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-dc-border"
                    checked={applyToAllDays}
                    onChange={(e) => setApplyToAllDays(e.target.checked)}
                  />
                  Apply to all event days
                </label>
              </div>
            </div>
          : null}
        </section>
      : null}

      {!focusReservations ?
        <section className="rounded-xl border border-dc-border bg-dc-elevated/95/50">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-3 text-left md:min-h-11 md:py-2.5"
            onClick={() => {
              if (!isMdUp) setAvailDrawer((d) => (d === 'blocked' ? 'share' : 'blocked'))
            }}
          >
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-dc-text">Your blocked times</h3>
              <p className="mt-0.5 text-xs text-dc-muted">
                {blockedTimes.length === 0
                  ? 'None yet'
                  : `${blockedTimes.length} block${blockedTimes.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <AccordionChevron open={availDrawer === 'blocked' || isMdUp} />
          </button>
          {(isMdUp || availDrawer === 'blocked') ?
            <div className="space-y-2 border-t border-dc-border px-3 pb-3 pt-2">
              {blockedTimes.length === 0 ?
                <p className="text-sm text-dc-muted">Nothing blocked yet.</p>
              : <ul className={`space-y-1.5 ${scrollList}`}>
                  {blockedTimes.map((it) => (
                    <li
                      key={it.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-dc-surface-muted px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-dc-text">{it.title}</p>
                        <p className="text-xs text-dc-text-muted">
                          {new Date(it.startsAt).toLocaleString([], {
                            timeZone: timezone,
                            hour: 'numeric',
                            minute: '2-digit',
                            weekday: 'short',
                            month: 'short',
                            day: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(it.endsAt).toLocaleTimeString([], {
                            timeZone: timezone,
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-red-300 hover:bg-red-500/10"
                        onClick={() => void removePersonalBlock(it.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              }
            </div>
          : null}
        </section>
      : null}

      <section
        id="dc-reservations"
        className={
          focusReservations ?
            'space-y-3'
          : 'space-y-2 rounded-xl border border-dc-border bg-dc-surface-muted/40 p-3'
        }
      >
        {!focusReservations ?
          <>
            <h3 className="text-sm font-semibold text-dc-text">Scene reservations</h3>
            <p className="hidden text-[11px] text-dc-muted md:block">
              Approve requests and manage confirmed scenes.
            </p>
          </>
        : null}
        {sortedIncoming.length === 0 && outgoing.length === 0 ?
          <p className="text-xs text-dc-muted">Nothing here yet.</p>
        : null}
        {sortedIncoming.length > 0 ?
          <ul className={`space-y-3 ${scrollList}`}>
            {sortedIncoming.map((b) => (
              <SceneReservationCard
                key={b.id}
                booking={b}
                role="host"
                timezone={timezone}
                apiBase={apiBase}
                allowDirectReschedule={isPlaySpace}
                allowNotesEdit={isPlaySpace}
                proposeRescheduleSlot={
                  b.status === 'ACCEPTED' && scope.showReschedule ?
                    <RescheduleProposeForm
                      bookingId={b.id}
                      baseStartsAt={b.startsAt}
                      baseEndsAt={b.endsAt}
                      apiBase={apiBase}
                      onDone={() => void reload()}
                    />
                  : null
                }
                onAccept={() => void acceptBooking(b.id)}
                onDecline={() => void declineBooking(b.id)}
                onCancel={() => void cancelBooking(b.id)}
                onAcceptReschedule={() => void acceptRescheduleBooking(b.id)}
                onDeclineReschedule={() => void declineBooking(b.id)}
                onDone={() => void reload()}
              />
            ))}
          </ul>
        : null}

        {outgoing.length > 0 ?
          <div className={sortedIncoming.length > 0 ? 'mt-3 border-t border-dc-border pt-3' : undefined}>
            <p className="text-xs font-medium text-dc-muted">Scenes you requested</p>
            <ul className={`mt-2 space-y-3 ${scrollList}`}>
              {outgoing.map((b) => (
                <SceneReservationCard
                  key={b.id}
                  booking={b}
                  role="guest"
                  timezone={timezone}
                  apiBase={apiBase}
                  allowDirectReschedule={isPlaySpace}
                  allowNotesEdit={isPlaySpace}
                  proposeRescheduleSlot={
                    b.status === 'ACCEPTED' && scope.showReschedule ?
                      <RescheduleProposeForm
                        bookingId={b.id}
                        baseStartsAt={b.startsAt}
                        baseEndsAt={b.endsAt}
                        apiBase={apiBase}
                        onDone={() => void reload()}
                      />
                    : null
                  }
                  onCancel={() => void cancelBooking(b.id)}
                  onAcceptReschedule={() => void acceptRescheduleBooking(b.id)}
                  onDeclineReschedule={() => void declineBooking(b.id)}
                  onDone={() => void reload()}
                />
              ))}
            </ul>
          </div>
        : null}
      </section>

      {!focusReservations && scope.showVolunteerTools ?
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

      {!focusReservations && scope.showVolunteerTools ?
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

      {confirmDialog}
    </div>
  )
}
