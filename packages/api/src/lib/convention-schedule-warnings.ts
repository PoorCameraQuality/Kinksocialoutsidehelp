import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { computeStaffIntervalWarnings, type StaffInterval } from './convention-staff-overlap.js'

export type ScheduleWarning = {
  kind:
    | 'presenter_overlap'
    | 'room_overlap'
    | 'staff_overlap'
    | 'staff_presenter_overlap'
    | 'staff_volunteer_overlap'
  message: string
  slotIds: string[]
}

type SlotLite = {
  id: string
  startsAt: Date
  endsAt: Date
  roomLabel: string | null
  trackLabel: string | null
}

function overlaps(a: SlotLite, b: SlotLite): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt
}

export async function computeConventionScheduleWarnings(conventionId: string): Promise<ScheduleWarning[]> {
  const rows = await db
    .select({
      id: schema.scheduleSlots.id,
      startsAt: schema.scheduleSlots.startsAt,
      endsAt: schema.scheduleSlots.endsAt,
      roomLabel: schema.scheduleSlots.roomLabel,
      trackLabel: schema.scheduleSlots.trackLabel,
    })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))

  const slots: SlotLite[] = rows.map((r) => ({
    id: r.id,
    startsAt: new Date(r.startsAt),
    endsAt: new Date(r.endsAt),
    roomLabel: r.roomLabel ?? null,
    trackLabel: r.trackLabel ?? null,
  }))

  const slotIds = slots.map((s) => s.id)
  const presentersBySlot = new Map<string, string[]>()
  if (slotIds.length > 0) {
    const pres = await db
      .select({
        scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId,
        userId: schema.scheduleSlotPresenters.userId,
      })
      .from(schema.scheduleSlotPresenters)
      .where(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds))
    for (const p of pres) {
      const arr = presentersBySlot.get(p.scheduleSlotId) ?? []
      arr.push(p.userId)
      presentersBySlot.set(p.scheduleSlotId, arr)
    }
  }

  const warnings: ScheduleWarning[] = []
  const seen = new Set<string>()

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!
      const b = slots[j]!
      if (!overlaps(a, b)) continue
      const key = [a.id, b.id].sort().join(':')
      if (seen.has(key)) continue

      const ra = a.roomLabel?.trim()
      const rb = b.roomLabel?.trim()
      if (ra && rb && ra === rb) {
        seen.add(key)
        warnings.push({
          kind: 'room_overlap',
          message: `Room "${ra}" has overlapping sessions.`,
          slotIds: [a.id, b.id],
        })
      }

      const pa = new Set(presentersBySlot.get(a.id) ?? [])
      const pb = presentersBySlot.get(b.id) ?? []
      const overlapPresenters = pb.filter((u) => pa.has(u))
      if (overlapPresenters.length > 0) {
        seen.add(`p:${key}`)
        warnings.push({
          kind: 'presenter_overlap',
          message: 'A presenter is scheduled in two overlapping slots.',
          slotIds: [a.id, b.id],
        })
      }
    }
  }

  return warnings
}

/** Overlaps for the same person across presenting, runner staff, and volunteer shifts. */
export async function computeConventionStaffWarnings(conventionId: string): Promise<ScheduleWarning[]> {
  const slots = await db
    .select({
      id: schema.scheduleSlots.id,
      startsAt: schema.scheduleSlots.startsAt,
      endsAt: schema.scheduleSlots.endsAt,
    })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))

  const slotById = new Map(slots.map((s) => [s.id, s]))
  const slotIds = slots.map((s) => s.id)
  const _intervals: StaffInterval[] = []

  if (slotIds.length > 0) {
    const pres = await db
      .select({
        scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId,
        userId: schema.scheduleSlotPresenters.userId,
      })
      .from(schema.scheduleSlotPresenters)
      .where(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds))
    for (const p of pres) {
      const sl = slotById.get(p.scheduleSlotId)
      if (!sl) continue
      _intervals.push({
        userId: p.userId,
        startsAt: new Date(sl.startsAt),
        endsAt: new Date(sl.endsAt),
        source: 'presenting',
      })
    }

    const staffRows = await db
      .select()
      .from(schema.scheduleSlotStaff)
      .where(inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds))
    for (const r of staffRows) {
      _intervals.push({
        userId: r.userId,
        startsAt: new Date(r.startsAt),
        endsAt: new Date(r.endsAt),
        source: 'staff_slot',
        label: r.roleLabel,
      })
    }
  }

  const duties = await db
    .select()
    .from(schema.conventionStaffDuties)
    .where(eq(schema.conventionStaffDuties.conventionId, conventionId))
  for (const d of duties) {
    _intervals.push({
      userId: d.userId,
      startsAt: new Date(d.startsAt),
      endsAt: new Date(d.endsAt),
      source: 'staff_duty',
      label: d.roleLabel,
    })
  }

  const volShifts = await db
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
  const volIds = volShifts.map((v) => v.id)
  if (volIds.length > 0) {
    const signups = await db
      .select()
      .from(schema.conventionVolunteerShiftSignups)
      .where(inArray(schema.conventionVolunteerShiftSignups.shiftId, volIds))
    const shiftById = new Map(volShifts.map((v) => [v.id, v]))
    for (const su of signups) {
      const sh = shiftById.get(su.shiftId)
      if (!sh) continue
      _intervals.push({
        userId: su.userId,
        startsAt: new Date(sh.startsAt),
        endsAt: new Date(sh.endsAt),
        source: 'volunteer',
        label: sh.title,
      })
    }
  }

  return computeStaffIntervalWarnings(_intervals)
}

export async function computeAllConventionScheduleWarnings(conventionId: string): Promise<ScheduleWarning[]> {
  const [a, b] = await Promise.all([
    computeConventionScheduleWarnings(conventionId),
    computeConventionStaffWarnings(conventionId),
  ])
  return [...a, ...b]
}
