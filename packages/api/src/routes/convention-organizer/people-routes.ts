import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { loadRegistrantIdByUserId } from '../../lib/convention-people-links.js'
import { requestConventionPeopleDirectorySync } from '../../lib/convention-people-sync-queue.js'
import {
  displayRegistrationStatus,
  inferRoleKindFromCategoryName,
  roleKindLabel,
} from '../../lib/convention-registrant-fields.js'
import {
  iso,
  mapPersonRow,
  requireDb,
  requireOrganizer,
  requireUser,
  UUID_RE,
  type RouteRegistrar,
} from './shared.js'

async function loadPersonEnrichment(conventionId: string, people: Array<{ id: string; userId: string | null }>) {
  const userIds = people.map((p) => p.userId).filter(Boolean) as string[]
  const pronounsByUserId = new Map<string, string | null>()
  const photoByUserId = new Map<string, string | null>()
  const compPackages: Record<
    string,
    {
      registrantId: string
      categoryId: string
      categoryName: string
      accessCode: string | null
      roleKind: string
      roleKindLabel: string
      expectedHours: number | null
      grantsStaffAccess: boolean
    }
  > = {}

  if (userIds.length === 0) {
    return { pronounsByUserId, photoByUserId, compPackages }
  }

  const profiles = await db
    .select({
      userId: schema.profiles.userId,
      pronouns: schema.profiles.pronouns,
      avatarUrl: schema.profiles.avatarUrl,
    })
    .from(schema.profiles)
    .where(inArray(schema.profiles.userId, userIds))

  for (const p of profiles) {
    pronounsByUserId.set(p.userId, p.pronouns)
    photoByUserId.set(p.userId, p.avatarUrl)
  }

  const registrants = await db
    .select({
      registrantId: schema.conventionRegistrants.id,
      userId: schema.conventionRegistrants.userId,
      pronouns: schema.conventionRegistrants.pronouns,
      categoryId: schema.conventionRegistrants.categoryId,
      categoryName: schema.conventionRegistrationCategories.name,
      compCode: schema.conventionRegistrationCategories.compCode,
      accessCode: schema.conventionRegistrationCategories.accessCode,
      roleKindCol: schema.conventionRegistrationCategories.roleKind,
      grantsStaffAccess: schema.conventionRegistrationCategories.grantsStaffAccess,
      expectedHours: schema.conventionRegistrationCategories.expectedHours,
    })
    .from(schema.conventionRegistrants)
    .leftJoin(
      schema.conventionRegistrationCategories,
      eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
    )
    .where(
      and(
        eq(schema.conventionRegistrants.conventionId, conventionId),
        inArray(schema.conventionRegistrants.userId, userIds),
      ),
    )

  const personIdByUserId = new Map(
    people.filter((p) => p.userId).map((p) => [p.userId!, p.id]),
  )

  for (const r of registrants) {
    if (!r.userId) continue
    if (r.pronouns) pronounsByUserId.set(r.userId, r.pronouns)
    const personId = personIdByUserId.get(r.userId)
    if (!personId || !r.categoryName) continue
    const roleKind = r.roleKindCol || inferRoleKindFromCategoryName(r.categoryName)
    compPackages[personId] = {
      registrantId: r.registrantId,
      categoryId: r.categoryId ?? '',
      categoryName: r.categoryName,
      accessCode: r.accessCode ?? r.compCode ?? null,
      roleKind,
      roleKindLabel: roleKindLabel(roleKind),
      expectedHours: r.expectedHours ?? null,
      grantsStaffAccess: r.grantsStaffAccess ?? false,
    }
  }

  return { pronounsByUserId, photoByUserId, compPackages }
}

export function registerPeopleRoutes(reg: RouteRegistrar) {
  reg('GET', '/api/v1/conventions/:key/people', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    await requestConventionPeopleDirectorySync(ctx.conv.id)
    const q = (req.query as { q?: string }).q?.trim()
    let query = db
      .select()
      .from(schema.conventionPersons)
      .where(eq(schema.conventionPersons.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionPersons.displayName))
    const rows = q
      ? await query.then((all) =>
          all.filter(
            (r) =>
              r.displayName.toLowerCase().includes(q.toLowerCase()) ||
              (r.email ?? '').toLowerCase().includes(q.toLowerCase()),
          ),
        )
      : await query
    const enrichment = await loadPersonEnrichment(
      ctx.conv.id,
      rows.map((r) => ({ id: r.id, userId: r.userId })),
    )
    const registrantByUser = await loadRegistrantIdByUserId(ctx.conv.id)
    const people = rows.map((r) =>
      mapPersonRow(r, {
        pronouns: r.userId ? enrichment.pronounsByUserId.get(r.userId) ?? null : null,
        photoUrl: r.userId ? enrichment.photoByUserId.get(r.userId) ?? null : null,
        participation: r.userId
          ? {
              registrantId: registrantByUser.get(r.userId) ?? null,
              registered: registrantByUser.has(r.userId),
            }
          : { registrantId: null, registered: false },
      }),
    )
    const roleBuckets: Record<string, string[]> = {}
    const assignments = await db
      .select({
        personId: schema.conventionPersonRoleAssignments.personId,
        roleLabel: schema.conventionPersonRoleAssignments.roleLabel,
      })
      .from(schema.conventionPersonRoleAssignments)
      .innerJoin(schema.conventionPersons, eq(schema.conventionPersons.id, schema.conventionPersonRoleAssignments.personId))
      .where(eq(schema.conventionPersons.conventionId, ctx.conv.id))
    for (const a of assignments) {
      const list = roleBuckets[a.personId] ?? []
      list.push(a.roleLabel)
      roleBuckets[a.personId] = list
    }
    return reply.send({ people, roleBuckets, compPackages: enrichment.compPackages })
  })

  reg('GET', '/api/v1/conventions/:key/people/:personId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, personId } = req.params as { key: string; personId: string }
    if (!UUID_RE.test(personId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [personRow] = await db
      .select()
      .from(schema.conventionPersons)
      .where(and(eq(schema.conventionPersons.conventionId, ctx.conv.id), eq(schema.conventionPersons.id, personId)))
      .limit(1)
    if (!personRow) return reply.status(404).send({ error: 'Not found' })

    const programSlots: {
      id: string
      title: string
      startsAt: string | null
      endsAt: string | null
      role: string
      locationName: string | null
      trackDisplay: string | null
    }[] = []

    if (personRow.userId) {
      const slotIds = (
        await db
          .select({ id: schema.scheduleSlots.id })
          .from(schema.scheduleSlots)
          .where(eq(schema.scheduleSlots.conventionId, ctx.conv.id))
      ).map((s) => s.id)

      if (slotIds.length > 0) {
        const presenterSlots = await db
          .select({
            id: schema.scheduleSlots.id,
            title: schema.scheduleSlots.title,
            startsAt: schema.scheduleSlots.startsAt,
            endsAt: schema.scheduleSlots.endsAt,
            trackLabel: schema.scheduleSlots.trackLabel,
            locationName: schema.conventionLocations.name,
          })
          .from(schema.scheduleSlotPresenters)
          .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlots.id, schema.scheduleSlotPresenters.scheduleSlotId))
          .leftJoin(schema.conventionLocations, eq(schema.conventionLocations.id, schema.scheduleSlots.locationId))
          .where(
            and(
              eq(schema.scheduleSlotPresenters.userId, personRow.userId),
              inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds),
            ),
          )

        for (const s of presenterSlots) {
          programSlots.push({
            id: s.id,
            title: s.title,
            startsAt: iso(s.startsAt),
            endsAt: iso(s.endsAt),
            role: 'presenter',
            locationName: s.locationName ?? null,
            trackDisplay: s.trackLabel ?? null,
          })
        }

        const staffSlots = await db
          .select({
            id: schema.scheduleSlots.id,
            title: schema.scheduleSlots.title,
            startsAt: schema.scheduleSlotStaff.startsAt,
            endsAt: schema.scheduleSlotStaff.endsAt,
            trackLabel: schema.scheduleSlots.trackLabel,
            locationName: schema.conventionLocations.name,
            roleLabel: schema.scheduleSlotStaff.roleLabel,
          })
          .from(schema.scheduleSlotStaff)
          .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlots.id, schema.scheduleSlotStaff.scheduleSlotId))
          .leftJoin(schema.conventionLocations, eq(schema.conventionLocations.id, schema.scheduleSlots.locationId))
          .where(
            and(eq(schema.scheduleSlotStaff.userId, personRow.userId), inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds)),
          )

        for (const s of staffSlots) {
          programSlots.push({
            id: s.id,
            title: s.title,
            startsAt: iso(s.startsAt),
            endsAt: iso(s.endsAt),
            role: s.roleLabel,
            locationName: s.locationName ?? null,
            trackDisplay: s.trackLabel ?? null,
          })
        }
      }
    }

    let registrant: {
      id: string
      sceneDisplayName: string
      status: string
      categoryId: string | null
      categoryName: string | null
    } | null = null

    if (personRow.userId) {
      const [reg] = await db
        .select({
          reg: schema.conventionRegistrants,
          categoryName: schema.conventionRegistrationCategories.name,
        })
        .from(schema.conventionRegistrants)
        .leftJoin(
          schema.conventionRegistrationCategories,
          eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
        )
        .where(
          and(
            eq(schema.conventionRegistrants.conventionId, ctx.conv.id),
            eq(schema.conventionRegistrants.userId, personRow.userId),
          ),
        )
        .limit(1)
      if (reg) {
        registrant = {
          id: reg.reg.id,
          sceneDisplayName: reg.reg.displayName,
          status: displayRegistrationStatus(reg.reg.registrationStatus, reg.reg.checkedInAt),
          categoryId: reg.reg.categoryId ?? null,
          categoryName: reg.categoryName ?? null,
        }
      }
    }

    const enrichment = await loadPersonEnrichment(ctx.conv.id, [
      { id: personRow.id, userId: personRow.userId },
    ])

    return reply.send({
      person: mapPersonRow(personRow, {
        pronouns: personRow.userId ? enrichment.pronounsByUserId.get(personRow.userId) ?? null : null,
        photoUrl: personRow.userId ? enrichment.photoByUserId.get(personRow.userId) ?? null : null,
      }),
      programSlots: programSlots.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))),
      registrant,
      compPackage: enrichment.compPackages[personRow.id] ?? null,
    })
  })

  reg('POST', '/api/v1/conventions/:key/people', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        sceneName: z.string().min(1).max(255),
        email: z.string().email().optional().nullable(),
        publicBio: z.string().max(5000).optional().nullable(),
        internalNotes: z.string().max(5000).optional().nullable(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [row] = await db
      .insert(schema.conventionPersons)
      .values({
        conventionId: ctx.conv.id,
        displayName: parsed.data.sceneName.trim(),
        email: parsed.data.email ?? null,
        bio: parsed.data.publicBio ?? null,
      })
      .returning()
    return reply.status(201).send({ person: mapPersonRow(row!) })
  })

  reg('PATCH', '/api/v1/conventions/:key/people/:personId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, personId } = req.params as { key: string; personId: string }
    if (!UUID_RE.test(personId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z
      .object({
        sceneName: z.string().min(1).max(255).optional(),
        email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
        publicBio: z.string().max(5000).optional().nullable(),
        internalNotes: z.string().max(5000).optional().nullable(),
        pronouns: z.string().max(64).nullable().optional(),
        photoUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [existing] = await db
      .select()
      .from(schema.conventionPersons)
      .where(and(eq(schema.conventionPersons.conventionId, ctx.conv.id), eq(schema.conventionPersons.id, personId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const patch: Partial<typeof schema.conventionPersons.$inferInsert> = { updatedAt: new Date() }
    if (parsed.data.sceneName !== undefined) patch.displayName = parsed.data.sceneName.trim()
    if (parsed.data.email !== undefined) patch.email = parsed.data.email === '' ? null : parsed.data.email
    if (parsed.data.publicBio !== undefined) patch.bio = parsed.data.publicBio
    const [row] = await db
      .update(schema.conventionPersons)
      .set(patch)
      .where(and(eq(schema.conventionPersons.conventionId, ctx.conv.id), eq(schema.conventionPersons.id, personId)))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })

    if (existing.userId) {
      if (parsed.data.pronouns !== undefined) {
        await db
          .update(schema.profiles)
          .set({ pronouns: parsed.data.pronouns })
          .where(eq(schema.profiles.userId, existing.userId))
        await db
          .update(schema.conventionRegistrants)
          .set({ pronouns: parsed.data.pronouns ?? undefined, updatedAt: new Date() })
          .where(
            and(
              eq(schema.conventionRegistrants.conventionId, ctx.conv.id),
              eq(schema.conventionRegistrants.userId, existing.userId),
            ),
          )
      }
      if (parsed.data.photoUrl !== undefined) {
        const avatarUrl = parsed.data.photoUrl === '' ? null : parsed.data.photoUrl
        await db.update(schema.profiles).set({ avatarUrl }).where(eq(schema.profiles.userId, existing.userId))
      }
      if (parsed.data.internalNotes !== undefined) {
        await db
          .update(schema.conventionRegistrants)
          .set({ notes: parsed.data.internalNotes ?? undefined, updatedAt: new Date() })
          .where(
            and(
              eq(schema.conventionRegistrants.conventionId, ctx.conv.id),
              eq(schema.conventionRegistrants.userId, existing.userId),
            ),
          )
      }
    }

    const enrichment = await loadPersonEnrichment(ctx.conv.id, [{ id: row.id, userId: row.userId }])
    return reply.send({
      person: mapPersonRow(row, {
        pronouns: row.userId ? enrichment.pronounsByUserId.get(row.userId) ?? null : null,
        photoUrl: row.userId ? enrichment.photoByUserId.get(row.userId) ?? null : null,
      }),
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/people/:personId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, personId } = req.params as { key: string; personId: string }
    if (!UUID_RE.test(personId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionPersons)
      .where(and(eq(schema.conventionPersons.conventionId, ctx.conv.id), eq(schema.conventionPersons.id, personId)))
      .returning({ id: schema.conventionPersons.id })
    if (!del.length) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })
}
