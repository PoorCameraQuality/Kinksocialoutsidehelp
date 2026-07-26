export type CrewGridBucket = { start: string; end: string }

export type CrewGridRow = {
  userId: string
  username: string
  displayName: string | null
  cells: (string | null)[]
}

export type CrewGridDay = {
  dayKey: string
  dayLabel: string
  buckets: CrewGridBucket[]
  rows: CrewGridRow[]
}

type Assignment = {
  userId: string
  username: string
  displayName: string | null
  startsAt: Date
  endsAt: Date
  label: string
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDaysUtc(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta, 12, 0, 0))
  return utcDayKey(dt)
}

function enumerateDayKeys(from: Date, to: Date): string[] {
  const keys: string[] = []
  let k = utcDayKey(from)
  const endK = utcDayKey(to)
  for (let guard = 0; guard < 400 && k <= endK; guard++) {
    keys.push(k)
    k = addDaysUtc(k, 1)
  }
  return keys
}

function dayBoundsUtc(dayKey: string): { start: Date; end: Date } {
  const [y, m, d] = dayKey.split('-').map(Number)
  const start = new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y!, m! - 1, d! + 1, 0, 0, 0, 0))
  return { start, end }
}

function overlapsRange(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart
}

function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0, 0))
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const HALF_H = 30 * 60 * 1000

/** Half-hour buckets + per-user labels for ops crew view (read-only grid). */
export function buildCrewGridFromAssignments(
  convStartsAt: Date,
  convEndsAt: Date,
  assignments: Assignment[]
): CrewGridDay[] {
  const dayKeys = enumerateDayKeys(convStartsAt, convEndsAt)
  const days: CrewGridDay[] = []

  for (const dayKey of dayKeys) {
    const { start: dayStart, end: dayEnd } = dayBoundsUtc(dayKey)
    const dayAssignments = assignments.filter((a) => overlapsRange(a.startsAt, a.endsAt, dayStart, dayEnd))
    if (dayAssignments.length === 0) continue

    let minT = dayEnd.getTime()
    let maxT = dayStart.getTime()
    for (const a of dayAssignments) {
      const s = Math.max(a.startsAt.getTime(), dayStart.getTime())
      const e = Math.min(a.endsAt.getTime(), dayEnd.getTime())
      if (e > s) {
        minT = Math.min(minT, s)
        maxT = Math.max(maxT, e)
      }
    }
    if (minT >= maxT) continue

    const bucketStart = Math.floor(minT / HALF_H) * HALF_H
    const bucketEnd = Math.ceil(maxT / HALF_H) * HALF_H
    const buckets: CrewGridBucket[] = []
    for (let t = bucketStart; t < bucketEnd; t += HALF_H) {
      buckets.push({
        start: new Date(t).toISOString(),
        end: new Date(t + HALF_H).toISOString(),
      })
    }

    const userIds = [...new Set(dayAssignments.map((a) => a.userId))]
    const rows: CrewGridRow[] = userIds.map((uid) => {
      const first = dayAssignments.find((a) => a.userId === uid)!
      const cells = buckets.map((b) => {
        const bs = new Date(b.start).getTime()
        const be = new Date(b.end).getTime()
        const hits = dayAssignments.filter(
          (a) => a.userId === uid && overlapsRange(a.startsAt, a.endsAt, new Date(bs), new Date(be))
        )
        if (hits.length === 0) return null
        return hits.map((h) => h.label).join(' · ')
      })
      return {
        userId: uid,
        username: first.username,
        displayName: first.displayName,
        cells,
      }
    })

    days.push({
      dayKey,
      dayLabel: formatDayLabel(dayKey),
      buckets,
      rows,
    })
  }

  return days
}
