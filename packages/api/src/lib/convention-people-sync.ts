import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'

export type PeopleRoleBucket = 'presenter' | 'staff' | 'photographer' | 'registered' | 'attendee'

export function roleLabelToBucket(label: string, hint?: 'presenter' | 'staff' | 'photo'): PeopleRoleBucket {
  if (hint === 'presenter') return 'presenter'
  const n = label.toLowerCase()
  if (hint === 'photo' || /photo|photographer|camera/.test(n)) return 'photographer'
  if (
    hint === 'staff' ||
    /staff|volunteer|producer|door|greeter|desk|monitor|dm|floater|crew|registration|teardown|check-in/.test(n)
  ) {
    return 'staff'
  }
  if (/presenter|instructor|facilitator|teacher/.test(n)) return 'presenter'
  return 'staff'
}

type PersonSeed = {
  userId: string
  displayName: string
  email: string | null
  buckets: Set<PeopleRoleBucket>
}

function addPerson(
  people: Map<string, PersonSeed>,
  userId: string,
  displayName: string,
  email: string | null,
  bucket: PeopleRoleBucket,
) {
  const existing = people.get(userId)
  if (existing) {
    existing.buckets.add(bucket)
    if (displayName && (!existing.displayName || existing.displayName === 'Unknown')) {
      existing.displayName = displayName
    }
    if (email && !existing.email) existing.email = email
    return
  }
  people.set(userId, { userId, displayName: displayName || 'Unknown', email, buckets: new Set([bucket]) })
}

/** Build convention_persons + role bucket assignments from signups, grants, program, and shifts. */
export async function syncConventionPeopleDirectory(conventionId: string): Promise<void> {
  const people = new Map<string, PersonSeed>()

  const registrants = await db
    .select({
      userId: schema.conventionRegistrants.userId,
      displayName: schema.conventionRegistrants.displayName,
      email: schema.conventionRegistrants.email,
      profileName: schema.profiles.displayName,
    })
    .from(schema.conventionRegistrants)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
    .where(eq(schema.conventionRegistrants.conventionId, conventionId))

  for (const r of registrants) {
    if (!r.userId) continue
    addPerson(people, r.userId, r.profileName ?? r.displayName, r.email, 'registered')
  }

  const grants = await db
    .select({
      userId: schema.conventionAccessGrants.userId,
      role: schema.conventionAccessGrants.role,
      displayName: schema.profiles.displayName,
      username: schema.users.username,
      email: schema.users.email,
    })
    .from(schema.conventionAccessGrants)
    .innerJoin(schema.users, eq(schema.users.id, schema.conventionAccessGrants.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionAccessGrants.userId))
    .where(eq(schema.conventionAccessGrants.conventionId, conventionId))

  for (const g of grants) {
    const name = g.displayName ?? g.username
    if (g.role === 'STAFF' || g.role === 'MODERATOR') {
      addPerson(people, g.userId, name, g.email, 'staff')
    } else {
      addPerson(people, g.userId, name, g.email, 'attendee')
    }
  }

  const duties = await db
    .select({
      userId: schema.conventionStaffDuties.userId,
      roleLabel: schema.conventionStaffDuties.roleLabel,
      displayName: schema.profiles.displayName,
      username: schema.users.username,
      email: schema.users.email,
    })
    .from(schema.conventionStaffDuties)
    .innerJoin(schema.users, eq(schema.users.id, schema.conventionStaffDuties.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionStaffDuties.userId))
    .where(eq(schema.conventionStaffDuties.conventionId, conventionId))

  for (const d of duties) {
    addPerson(
      people,
      d.userId,
      d.displayName ?? d.username,
      d.email,
      roleLabelToBucket(d.roleLabel ?? 'staff', 'staff'),
    )
  }

  const slots = await db
    .select({ id: schema.scheduleSlots.id })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))
  const slotIds = slots.map((s) => s.id)

  if (slotIds.length > 0) {
    const presenters = await db
      .select({
        userId: schema.scheduleSlotPresenters.userId,
        displayName: schema.profiles.displayName,
        username: schema.users.username,
        email: schema.users.email,
      })
      .from(schema.scheduleSlotPresenters)
      .innerJoin(schema.users, eq(schema.users.id, schema.scheduleSlotPresenters.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.scheduleSlotPresenters.userId))
      .where(inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds))

    for (const p of presenters) {
      addPerson(people, p.userId, p.displayName ?? p.username, p.email, 'presenter')
    }

    const slotStaff = await db
      .select({
        userId: schema.scheduleSlotStaff.userId,
        roleLabel: schema.scheduleSlotStaff.roleLabel,
        displayName: schema.profiles.displayName,
        username: schema.users.username,
        email: schema.users.email,
      })
      .from(schema.scheduleSlotStaff)
      .innerJoin(schema.users, eq(schema.users.id, schema.scheduleSlotStaff.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.scheduleSlotStaff.userId))
      .where(inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds))

    for (const s of slotStaff) {
      const hint = /photo/i.test(s.roleLabel) ? 'photo' : 'staff'
      addPerson(people, s.userId, s.displayName ?? s.username, s.email, roleLabelToBucket(s.roleLabel, hint))
    }
  }

  const signups = await db
    .select({
      userId: schema.conventionVolunteerShiftSignups.userId,
      displayName: schema.profiles.displayName,
      username: schema.users.username,
      email: schema.users.email,
    })
    .from(schema.conventionVolunteerShiftSignups)
    .innerJoin(
      schema.conventionVolunteerShifts,
      eq(schema.conventionVolunteerShifts.id, schema.conventionVolunteerShiftSignups.shiftId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.conventionVolunteerShiftSignups.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionVolunteerShiftSignups.userId))
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))

  for (const su of signups) {
    addPerson(people, su.userId, su.displayName ?? su.username, su.email, 'staff')
  }

  const assignedShifts = await db
    .select({
      personId: schema.conventionVolunteerShifts.personId,
      role: schema.conventionVolunteerShifts.role,
      personName: schema.conventionVolunteerShifts.personName,
    })
    .from(schema.conventionVolunteerShifts)
    .where(
      and(eq(schema.conventionVolunteerShifts.conventionId, conventionId), isNotNull(schema.conventionVolunteerShifts.personId)),
    )

  for (const sh of assignedShifts) {
    if (!sh.personId) continue
    addPerson(
      people,
      sh.personId,
      sh.personName ?? 'Staff',
      null,
      roleLabelToBucket(sh.role ?? 'staff', 'staff'),
    )
  }

  for (const [, seed] of people) {
    const [existing] = await db
      .select()
      .from(schema.conventionPersons)
      .where(and(eq(schema.conventionPersons.conventionId, conventionId), eq(schema.conventionPersons.userId, seed.userId)))
      .limit(1)

    let personId: string
    if (existing) {
      personId = existing.id
      await db
        .update(schema.conventionPersons)
        .set({
          displayName: seed.displayName || existing.displayName,
          email: seed.email ?? existing.email,
          updatedAt: new Date(),
        })
        .where(eq(schema.conventionPersons.id, personId))
    } else {
      const [ins] = await db
        .insert(schema.conventionPersons)
        .values({
          conventionId,
          userId: seed.userId,
          displayName: seed.displayName,
          email: seed.email,
        })
        .returning()
      personId = ins!.id
    }

    await db
      .delete(schema.conventionPersonRoleAssignments)
      .where(eq(schema.conventionPersonRoleAssignments.personId, personId))
    for (const bucket of seed.buckets) {
      await db.insert(schema.conventionPersonRoleAssignments).values({ personId, roleLabel: bucket })
    }
  }
}
