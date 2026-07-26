import { and, desc, eq, ilike } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { viewerCanSeeActivityHistory } from '../lib/activity-history-visibility.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireDb(reply: FastifyReply): boolean {
  if (process.env.USE_DATABASE !== 'true') {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const viewer = resolveViewerFromRequest(req)
  if (!viewer.authenticated || !viewer.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(viewer.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

async function resolveUserByKey(key: string) {
  if (UUID_RE.test(key)) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, key)).limit(1)
    return user ?? null
  }
  const [user] = await db.select().from(schema.users).where(ilike(schema.users.username, key)).limit(1)
  return user ?? null
}

async function buildStaffSummaryForUser(userId: string) {
  const organizations = await db
    .select({
      organizationId: schema.organizationMembers.organizationId,
      role: schema.organizationMembers.role,
      volunteerTags: schema.organizationMembers.volunteerTags,
      joinedAt: schema.organizationMembers.joinedAt,
      organizationSlug: schema.organizations.slug,
      organizationName: schema.organizations.displayName,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizationMembers.organizationId, schema.organizations.id))
    .where(eq(schema.organizationMembers.userId, userId))
    .orderBy(desc(schema.organizationMembers.joinedAt))

  const staffDuties = await db
    .select({
      dutyId: schema.conventionStaffDuties.id,
      conventionId: schema.conventionStaffDuties.conventionId,
      roleLabel: schema.conventionStaffDuties.roleLabel,
      station: schema.conventionStaffDuties.station,
      startsAt: schema.conventionStaffDuties.startsAt,
      endsAt: schema.conventionStaffDuties.endsAt,
      conventionSlug: schema.conventions.slug,
      conventionName: schema.conventions.name,
    })
    .from(schema.conventionStaffDuties)
    .innerJoin(schema.conventions, eq(schema.conventionStaffDuties.conventionId, schema.conventions.id))
    .where(eq(schema.conventionStaffDuties.userId, userId))
    .orderBy(desc(schema.conventionStaffDuties.startsAt))
    .limit(30)

  const slotStaff = await db
    .select({
      assignmentId: schema.scheduleSlotStaff.id,
      roleLabel: schema.scheduleSlotStaff.roleLabel,
      station: schema.scheduleSlotStaff.station,
      startsAt: schema.scheduleSlotStaff.startsAt,
      endsAt: schema.scheduleSlotStaff.endsAt,
      slotTitle: schema.scheduleSlots.title,
      conventionId: schema.conventions.id,
      conventionSlug: schema.conventions.slug,
      conventionName: schema.conventions.name,
    })
    .from(schema.scheduleSlotStaff)
    .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlotStaff.scheduleSlotId, schema.scheduleSlots.id))
    .innerJoin(schema.conventions, eq(schema.scheduleSlots.conventionId, schema.conventions.id))
    .where(eq(schema.scheduleSlotStaff.userId, userId))
    .orderBy(desc(schema.scheduleSlotStaff.startsAt))
    .limit(30)

  const volunteerShifts = await db
    .select({
      shiftId: schema.conventionVolunteerShifts.id,
      title: schema.conventionVolunteerShifts.title,
      role: schema.conventionVolunteerShifts.role,
      startsAt: schema.conventionVolunteerShifts.startsAt,
      endsAt: schema.conventionVolunteerShifts.endsAt,
      location: schema.conventionVolunteerShifts.location,
      conventionId: schema.conventions.id,
      conventionSlug: schema.conventions.slug,
      conventionName: schema.conventions.name,
    })
    .from(schema.conventionVolunteerShiftSignups)
    .innerJoin(
      schema.conventionVolunteerShifts,
      eq(schema.conventionVolunteerShiftSignups.shiftId, schema.conventionVolunteerShifts.id)
    )
    .innerJoin(schema.conventions, eq(schema.conventionVolunteerShifts.conventionId, schema.conventions.id))
    .where(eq(schema.conventionVolunteerShiftSignups.userId, userId))
    .orderBy(desc(schema.conventionVolunteerShifts.startsAt))
    .limit(30)

  const now = Date.now()
  const upcomingAssignments = [...staffDuties, ...slotStaff, ...volunteerShifts].filter((row) => {
    const startsAt = new Date(row.startsAt).getTime()
    return Number.isFinite(startsAt) && startsAt >= now
  }).length

  return {
    summary: {
      organizationCount: organizations.length,
      staffDutyCount: staffDuties.length + slotStaff.length,
      volunteerShiftCount: volunteerShifts.length,
      upcomingAssignments,
    },
    organizations,
    staffDuties,
    slotStaff,
    volunteerShifts,
  }
}

export async function registerStaffProfileRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/staff-profile', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const [user] = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, actor.userId))
      .limit(1)
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const [profile] = await db
      .select({
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    const participation = await buildStaffSummaryForUser(user.id)
    return reply.send({
      userId: user.id,
      username: user.username,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      ...participation,
    })
  })

  app.get('/api/v1/staff/:key', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const user = await resolveUserByKey(key)
    if (!user) return reply.status(404).send({ error: 'Not found' })
    const [profile] = await db
      .select({
        displayName: schema.profiles.displayName,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
    const canSeeHistory = await viewerCanSeeActivityHistory(user.id, viewerId)
    const participation = await buildStaffSummaryForUser(user.id)
    return reply.send({
      userId: user.id,
      username: user.username,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      summary: participation.summary,
      organizations: canSeeHistory ? participation.organizations : [],
      staffDuties: canSeeHistory ? participation.staffDuties : [],
      slotStaff: canSeeHistory ? participation.slotStaff : [],
      volunteerShifts: canSeeHistory ? participation.volunteerShifts : [],
      historyVisible: canSeeHistory,
    })
  })
}
