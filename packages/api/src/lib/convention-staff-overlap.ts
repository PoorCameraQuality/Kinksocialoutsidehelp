import type { ScheduleWarning } from './convention-schedule-warnings.js'

export type StaffInterval = {
  userId: string
  startsAt: Date
  endsAt: Date
  /** Discriminator for warning messages */
  source: 'staff_slot' | 'staff_duty' | 'presenting' | 'volunteer'
  label?: string
}

function overlaps(a: Date, b: Date, c: Date, d: Date): boolean {
  return a < d && b > c
}

/** Per-user overlap detection across staff duties, slot-linked staff, presenting, and volunteer shifts. */
export function computeStaffIntervalWarnings(intervals: StaffInterval[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = []
  const byUser = new Map<string, StaffInterval[]>()
  for (const it of intervals) {
    const arr = byUser.get(it.userId) ?? []
    arr.push(it)
    byUser.set(it.userId, arr)
  }
  for (const [, list] of byUser) {
    const sorted = [...list].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    outer: for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!
        const b = sorted[j]!
        if (!overlaps(a.startsAt, a.endsAt, b.startsAt, b.endsAt)) continue
        const kinds = new Set([a.source, b.source])
        let kind: ScheduleWarning['kind'] = 'staff_overlap'
        let message = 'This person has overlapping scheduled commitments.'
        if (kinds.has('presenting') && (kinds.has('staff_slot') || kinds.has('staff_duty'))) {
          kind = 'staff_presenter_overlap'
          message = 'A presenter has a staff assignment that overlaps in time.'
        } else if (kinds.has('volunteer') && (kinds.has('staff_slot') || kinds.has('staff_duty'))) {
          kind = 'staff_volunteer_overlap'
          message = 'A volunteer shift overlaps a runner-assigned staff duty.'
        }
        warnings.push({
          kind,
          message,
          slotIds: [],
        })
        break outer
      }
    }
  }
  return warnings
}
