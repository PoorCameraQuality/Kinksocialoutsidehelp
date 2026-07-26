import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type OrganizerPersonRow = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  orgRole: string | null
  volunteerTags: string[]
  listedInOrgDirectory: boolean
  presenterHeadline: string | null
  directoryVisibility: string | null
  slotCount: number
  staffDutyCount: number
  eckePublishable: boolean
}

export async function loadOrganizerPeopleForOrg(orgId: string): Promise<OrganizerPersonRow[]> {
  const members = await db
    .select({
      userId: schema.organizationMembers.userId,
      role: schema.organizationMembers.role,
      volunteerTags: schema.organizationMembers.volunteerTags,
      listedInOrgDirectory: schema.organizationMembers.listedInOrgDirectory,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
      avatarUrl: schema.profiles.avatarUrl,
      headline: schema.presenterProfiles.headline,
      directoryVisibility: schema.presenterProfiles.directoryVisibility,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.organizationMembers.userId))
    .leftJoin(schema.presenterProfiles, eq(schema.presenterProfiles.userId, schema.organizationMembers.userId))
    .where(eq(schema.organizationMembers.organizationId, orgId))
    .orderBy(asc(schema.organizationMembers.role), asc(schema.users.username))

  const convRows = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.organizationId, orgId))

  const convIds = convRows.map((c) => c.id)
  const slotCounts = new Map<string, number>()
  const staffCounts = new Map<string, number>()

  if (convIds.length > 0) {
    const presenterCounts = await db
      .select({
        userId: schema.scheduleSlotPresenters.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.scheduleSlotPresenters)
      .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlots.id, schema.scheduleSlotPresenters.scheduleSlotId))
      .where(inArray(schema.scheduleSlots.conventionId, convIds))
      .groupBy(schema.scheduleSlotPresenters.userId)

    for (const row of presenterCounts) slotCounts.set(row.userId, row.count)

    const staffSlotCounts = await db
      .select({
        userId: schema.scheduleSlotStaff.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.scheduleSlotStaff)
      .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlots.id, schema.scheduleSlotStaff.scheduleSlotId))
      .where(inArray(schema.scheduleSlots.conventionId, convIds))
      .groupBy(schema.scheduleSlotStaff.userId)

    for (const row of staffSlotCounts) {
      staffCounts.set(row.userId, (staffCounts.get(row.userId) ?? 0) + row.count)
    }

    const dutyCounts = await db
      .select({
        userId: schema.conventionStaffDuties.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.conventionStaffDuties)
      .where(inArray(schema.conventionStaffDuties.conventionId, convIds))
      .groupBy(schema.conventionStaffDuties.userId)

    for (const row of dutyCounts) {
      staffCounts.set(row.userId, (staffCounts.get(row.userId) ?? 0) + row.count)
    }
  }

  return members.map((m) => {
    const directoryVisibility = m.directoryVisibility ?? null
    return {
      userId: m.userId,
      username: m.username,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      orgRole: m.role,
      volunteerTags: m.volunteerTags ?? [],
      listedInOrgDirectory: m.listedInOrgDirectory,
      presenterHeadline: m.headline,
      directoryVisibility,
      slotCount: slotCounts.get(m.userId) ?? 0,
      staffDutyCount: staffCounts.get(m.userId) ?? 0,
      eckePublishable: directoryVisibility === 'PUBLIC' && !!m.headline,
    }
  })
}

export async function loadOrganizerPeopleForConvention(conventionId: string): Promise<OrganizerPersonRow[]> {
  const [conv] = await db
    .select({ organizationId: schema.conventions.organizationId })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, conventionId))
    .limit(1)

  if (!conv?.organizationId) return []

  const all = await loadOrganizerPeopleForOrg(conv.organizationId)
  return all.filter((p) => p.slotCount > 0 || p.staffDutyCount > 0 || p.presenterHeadline)
}
