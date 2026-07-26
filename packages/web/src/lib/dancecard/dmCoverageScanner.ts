/**
 * Pure DM / play-space coverage checks (Phase 4 P4.2). No I/O.
 */

import type { DancecardConflict } from '@/lib/dancecard/conflictScanner'

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

export type DmRequirementRow = {
  id: string
  locationId: string
  startsAt: string
  endsAt: string
  minLead: number
  minFloat: number
}

export type StaffShiftForDm = {
  id: string
  locationId: string | null
  role: string
  startsAt: string
  endsAt: string
  shiftStatus: string
}

export function isDmStaffRole(role: string): boolean {
  const r = role.trim().toLowerCase()
  return r === 'dm' || r.startsWith('dm_') || r.includes('dungeon monitor')
}

function countDmInWindow(
  shifts: StaffShiftForDm[],
  locationId: string,
  w0: number,
  w1: number,
): { leadish: number; floatish: number } {
  let leadish = 0
  let floatish = 0
  for (const s of shifts) {
    if (s.shiftStatus === 'dropped' || s.shiftStatus === 'draft') continue
    if ((s.locationId ?? '') !== locationId) continue
    const t0 = new Date(s.startsAt).getTime()
    const t1 = new Date(s.endsAt).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) continue
    if (!intervalsOverlap(t0, t1, w0, w1)) continue
    if (!isDmStaffRole(s.role)) continue
    const rl = s.role.trim().toLowerCase()
    if (rl.includes('float')) floatish += 1
    else leadish += 1
  }
  return { leadish, floatish }
}

export type DmCoverageFormatContext = {
  locationNames?: Record<string, string>
  formatWindow?: (startsAt: string, endsAt: string) => string
}

function describeDmShortfall(needLead: number, needFloat: number, leadish: number, floatish: number): string {
  const parts: string[] = []
  if (needLead > 0 && leadish < needLead) {
    const missing = needLead - leadish
    parts.push(
      missing === 1 && needLead === 1
        ? 'need at least 1 lead dungeon monitor on duty'
        : `need ${needLead} lead monitor(s) on duty (have ${leadish})`,
    )
  }
  if (needFloat > 0 && floatish < needFloat) {
    const missing = needFloat - floatish
    parts.push(
      missing === 1 && needFloat === 1
        ? 'need at least 1 backup (float) monitor on duty'
        : `need ${needFloat} backup monitor(s) on duty (have ${floatish})`,
    )
  }
  if (parts.length === 0) {
    return `scheduled ${leadish + floatish} monitor shift(s) but staffing rules are not met yet`
  }
  return parts.join('; ')
}

export function computeDmCoverageGaps(
  requirements: DmRequirementRow[],
  shifts: StaffShiftForDm[],
  ctx?: DmCoverageFormatContext,
): DancecardConflict[] {
  const out: DancecardConflict[] = []
  for (const req of requirements) {
    const w0 = new Date(req.startsAt).getTime()
    const w1 = new Date(req.endsAt).getTime()
    if (!Number.isFinite(w0) || !Number.isFinite(w1) || w0 >= w1) continue
    const { leadish, floatish } = countDmInWindow(shifts, req.locationId, w0, w1)
    const needLead = Math.max(0, req.minLead)
    const needFloat = Math.max(0, req.minFloat)
    if (leadish < needLead || floatish < needFloat) {
      const place =
        ctx?.locationNames?.[req.locationId]?.trim() ||
        'a play space (room name missing in settings)'
      const when = ctx?.formatWindow?.(req.startsAt, req.endsAt) ?? 'during a scheduled block'
      out.push({
        id: `dm-coverage-gap-${req.id}`,
        severity: 'warning',
        title: `Dungeon monitors needed in ${place}`,
        detail: `For ${when}, you ${describeDmShortfall(needLead, needFloat, leadish, floatish)}.`,
        relatedSlotIds: [],
      })
    }
  }
  return out
}
