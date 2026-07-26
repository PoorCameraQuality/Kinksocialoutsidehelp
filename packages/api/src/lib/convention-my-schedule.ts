import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type MyScheduleItem = {
  kind: 'presenting' | 'staff_slot' | 'staff_duty' | 'volunteer'
  startsAt: string
  endsAt: string
  title: string
  detail?: string
  location?: string | null
  slotId?: string | null
  dutyId?: string | null
  staffAssignmentId?: string | null
}

export async function buildMyConventionScheduleItems(
  conventionId: string,
  userId: string
): Promise<MyScheduleItem[]> {
  const items: MyScheduleItem[] = []

  const slots = await db
    .select()
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))
  const slotIds = slots.map((s) => s.id)
  const slotById = new Map(slots.map((s) => [s.id, s]))

  if (slotIds.length > 0) {
    const presRows = await db
      .select({ scheduleSlotId: schema.scheduleSlotPresenters.scheduleSlotId })
      .from(schema.scheduleSlotPresenters)
      .where(and(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds), eq(schema.scheduleSlotPresenters.userId, userId)))
    for (const p of presRows) {
      const sl = slotById.get(p.scheduleSlotId)
      if (!sl) continue
      items.push({
        kind: 'presenting',
        startsAt: new Date(sl.startsAt).toISOString(),
        endsAt: new Date(sl.endsAt).toISOString(),
        title: sl.title,
        detail: 'Presenter',
        location: sl.location,
        slotId: sl.id,
      })
    }

    const staffSlot = await db
      .select()
      .from(schema.scheduleSlotStaff)
      .where(and(inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds), eq(schema.scheduleSlotStaff.userId, userId)))
    for (const st of staffSlot) {
      const sl = slotById.get(st.scheduleSlotId)
      const loc = st.station ?? sl?.location ?? sl?.roomLabel ?? null
      items.push({
        kind: 'staff_slot',
        startsAt: new Date(st.startsAt).toISOString(),
        endsAt: new Date(st.endsAt).toISOString(),
        title: `${st.roleLabel}${sl ? ` · ${sl.title}` : ''}`,
        detail: [st.station ? `Station: ${st.station}` : null, st.notes?.trim() ? st.notes : null].filter(Boolean).join('\n') || undefined,
        location: loc,
        slotId: st.scheduleSlotId,
        staffAssignmentId: st.id,
      })
    }
  }

  const duties = await db
    .select()
    .from(schema.conventionStaffDuties)
    .where(and(eq(schema.conventionStaffDuties.conventionId, conventionId), eq(schema.conventionStaffDuties.userId, userId)))
  for (const d of duties) {
    items.push({
      kind: 'staff_duty',
      startsAt: new Date(d.startsAt).toISOString(),
      endsAt: new Date(d.endsAt).toISOString(),
      title: d.roleLabel,
      detail: [d.station ? `Station: ${d.station}` : null, d.notes?.trim() ? d.notes : null].filter(Boolean).join('\n') || undefined,
      location: d.location,
      dutyId: d.id,
    })
  }

  const volShifts = await db
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
  const volIds = volShifts.map((v) => v.id)
  if (volIds.length > 0) {
    const mine = await db
      .select()
      .from(schema.conventionVolunteerShiftSignups)
      .where(and(inArray(schema.conventionVolunteerShiftSignups.shiftId, volIds), eq(schema.conventionVolunteerShiftSignups.userId, userId)))
    const shiftById = new Map(volShifts.map((v) => [v.id, v]))
    for (const su of mine) {
      const sh = shiftById.get(su.shiftId)
      if (!sh) continue
      items.push({
        kind: 'volunteer',
        startsAt: new Date(sh.startsAt).toISOString(),
        endsAt: new Date(sh.endsAt).toISOString(),
        title: sh.title,
        detail: 'Volunteer shift',
        location: sh.location,
      })
    }
  }

  items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  return items
}
