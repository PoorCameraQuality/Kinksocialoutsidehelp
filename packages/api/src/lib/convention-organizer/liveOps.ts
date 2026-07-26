import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { computeDmCoverageGaps, type DmRequirementRow, type StaffShiftForDm } from './dmCoverageScanner.js'

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null
  const dt = d instanceof Date ? d : new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

export async function buildLiveOpsPayload(conventionId: string, timezone: string) {
  const now = Date.now()
  const soonMs = 30 * 60 * 1000

  const slots = await db
    .select()
    .from(schema.scheduleSlots)
    .where(
      and(
        eq(schema.scheduleSlots.conventionId, conventionId),
        isNotNull(schema.scheduleSlots.startsAt),
        isNotNull(schema.scheduleSlots.endsAt),
      ),
    )

  const locs = await db
    .select()
    .from(schema.conventionLocations)
    .where(eq(schema.conventionLocations.conventionId, conventionId))
  const locById = new Map(locs.map((l) => [l.id, l]))

  const happeningNow = slots.filter((s) => {
    const a0 = new Date(s.startsAt!).getTime()
    const a1 = new Date(s.endsAt!).getTime()
    return a0 <= now && now < a1 && s.isPublished
  })

  const byLocation: Record<
    string,
    { locationId: string | null; locationName: string; capacity: number | null; slots: unknown[] }
  > = {}
  for (const s of happeningNow) {
    const lid = s.locationId ?? '__none'
    if (!byLocation[lid]) {
      const loc = s.locationId ? locById.get(s.locationId) : null
      byLocation[lid] = {
        locationId: s.locationId ?? null,
        locationName: loc?.name ?? s.roomLabel ?? s.location ?? 'Unassigned',
        capacity: loc?.capacity ?? null,
        slots: [],
      }
    }
    byLocation[lid]!.slots.push({
      id: s.id,
      title: s.title,
      startsAt: iso(s.startsAt),
      endsAt: iso(s.endsAt),
    })
  }

  const regRows = await db
    .select({
      checkedInAt: schema.conventionRegistrants.checkedInAt,
      checkedInTiming: schema.conventionRegistrants.checkedInTiming,
    })
    .from(schema.conventionRegistrants)
    .where(eq(schema.conventionRegistrants.conventionId, conventionId))

  let onSite = 0
  const registered = regRows.length
  const checkInByTiming: Record<string, number> = {}
  for (const r of regRows) {
    if (r.checkedInAt) {
      onSite += 1
      const t = r.checkedInTiming ?? 'on_time'
      checkInByTiming[t] = (checkInByTiming[t] ?? 0) + 1
    }
  }

  const startingSoon = slots.filter((s) => {
    if (s.isPublished) return false
    const a0 = new Date(s.startsAt!).getTime()
    return a0 > now && a0 - now < soonMs
  })

  const reqRows = await db
    .select()
    .from(schema.conventionDmRequirements)
    .where(eq(schema.conventionDmRequirements.conventionId, conventionId))

  const dmReqs: DmRequirementRow[] = []
  for (const r of reqRows) {
    const s0 = new Date(r.startsAt).getTime()
    const s1 = new Date(r.endsAt).getTime()
    if (s0 <= now && now < s1) {
      dmReqs.push({
        id: r.id,
        locationId: r.locationId,
        startsAt: iso(r.startsAt)!,
        endsAt: iso(r.endsAt)!,
        minLead: r.minLead ?? 1,
        minFloat: r.minFloat ?? 0,
      })
    }
  }

  let dmGapsNow: ReturnType<typeof computeDmCoverageGaps> = []
  if (dmReqs.length) {
    const staffRows = await db
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
    const staffForDm: StaffShiftForDm[] = staffRows.map((r) => ({
      id: r.id,
      locationId: r.locationId ?? null,
      role: String(r.role ?? ''),
      startsAt: iso(r.startsAt)!,
      endsAt: iso(r.endsAt)!,
      shiftStatus: String(r.shiftStatus ?? 'assigned'),
    }))
    const locationNames: Record<string, string> = {}
    for (const l of locs) locationNames[l.id] = l.name
    dmGapsNow = computeDmCoverageGaps(dmReqs, staffForDm, { locationNames })
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone,
    happeningNow: Object.values(byLocation),
    checkIn: { onSite, registered, byTiming: checkInByTiming },
    unpublishedStartingSoon: startingSoon.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: iso(s.startsAt),
    })),
    dmGapsNow,
  }
}
