/** Guest Dancecard share route helpers + slot generation from free gaps. */

export const GUEST_SHARE_DURATIONS = [30, 60, 90, 120] as const
export const GUEST_SHARE_INTERVAL_MIN = 30
export const GUEST_SHARE_SUGGESTED_COUNT = 5

export function isGuestDancecardSharePath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'play' && parts[2] === 's' && parts.length >= 4) return true
  if (parts[0] === 'conventions' && parts[2] === 'dancecard' && parts[3] === 's' && parts.length >= 5) {
    return true
  }
  return false
}

export type GuestTimeSlot = {
  startsAt: string
  endsAt: string
}

function ceilToInterval(ms: number, intervalMs: number): number {
  return Math.ceil(ms / intervalMs) * intervalMs
}

/**
 * Turn broad free gaps into exact requestable windows for a chosen duration.
 * Starts snap forward to the interval grid so labels stay clean (no 5:01 PM).
 */
export function slotsFromFreeGaps(
  gaps: { startsAt: string; endsAt: string }[],
  durationMin: number,
  intervalMin: number = GUEST_SHARE_INTERVAL_MIN,
): GuestTimeSlot[] {
  const durationMs = durationMin * 60_000
  const intervalMs = intervalMin * 60_000
  if (durationMs < 15 * 60_000 || intervalMs < 5 * 60_000) return []

  const out: GuestTimeSlot[] = []
  const seen = new Set<string>()

  for (const gap of gaps) {
    const gapStart = Date.parse(gap.startsAt)
    const gapEnd = Date.parse(gap.endsAt)
    if (!Number.isFinite(gapStart) || !Number.isFinite(gapEnd) || gapEnd <= gapStart) continue

    let cursor = gapStart
    // If already on the grid, keep it; otherwise snap forward.
    if (cursor % intervalMs !== 0) {
      cursor = ceilToInterval(cursor, intervalMs)
    }

    while (cursor + durationMs <= gapEnd + 1) {
      // +1ms tolerance for exclusive-end ISO edges
      const startsAt = new Date(cursor).toISOString()
      const endsAt = new Date(cursor + durationMs).toISOString()
      const key = `${startsAt}|${endsAt}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ startsAt, endsAt })
      }
      cursor += intervalMs
    }
  }

  return out.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
}

export function slotStillValid(
  slot: GuestTimeSlot,
  gaps: { startsAt: string; endsAt: string }[],
  durationMin: number,
): boolean {
  const generated = slotsFromFreeGaps(gaps, durationMin)
  return generated.some((s) => s.startsAt === slot.startsAt && s.endsAt === slot.endsAt)
}

export function formatSlotDay(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatSlotTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt).toLocaleTimeString(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
  const end = new Date(endsAt).toLocaleTimeString(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${start}–${end}`
}

export function formatSlotShortContinue(startsAt: string, timeZone: string): string {
  const day = new Date(startsAt).toLocaleDateString(undefined, { timeZone, weekday: 'short' })
  const time = new Date(startsAt).toLocaleTimeString(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day} at ${time}`
}

export function groupSlotsByDay(slots: GuestTimeSlot[], timeZone: string): { dayKey: string; label: string; slots: GuestTimeSlot[] }[] {
  const map = new Map<string, { label: string; slots: GuestTimeSlot[] }>()
  for (const slot of slots) {
    const dayKey = new Date(slot.startsAt).toLocaleDateString('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const label = new Date(slot.startsAt).toLocaleDateString(undefined, {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    const row = map.get(dayKey) ?? { label, slots: [] }
    row.slots.push(slot)
    map.set(dayKey, row)
  }
  return [...map.entries()].map(([dayKey, v]) => ({ dayKey, label: v.label, slots: v.slots }))
}

export function timezoneLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: 'long',
    }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  } catch {
    return timeZone
  }
}
