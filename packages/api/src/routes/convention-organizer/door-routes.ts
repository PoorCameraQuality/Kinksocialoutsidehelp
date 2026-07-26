import { and, asc, eq, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { mapRegistrantFull, resolveCheckInUpdate } from '../../lib/convention-organizer/registration.js'
import {
  conventionSettings,
  ensureCheckInToken,
  escapeCsvCell,
  registrantWithMeta,
  requireDb,
  requireOrganizer,
  requireUser,
  UUID_RE,
  type RouteRegistrar,
} from './shared.js'

export function registerDoorRoutes(reg: RouteRegistrar) {
  reg('GET', '/api/v1/conventions/:key/door/roster', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const rows = await db
      .select({
        reg: schema.conventionRegistrants,
        categoryName: schema.conventionRegistrationCategories.name,
        categoryRow: schema.conventionRegistrationCategories,
        profileDisplayName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .leftJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionRegistrants.displayName))
    const es = conventionSettings(ctx.conv).eventSystems ?? {}
    const eventTitle = es.eventTitle ?? ctx.conv.name
    const toDoorShape = (mapped: ReturnType<typeof mapRegistrantFull>) => ({
      id: mapped.id,
      sceneDisplayName: mapped.sceneDisplayName,
      categoryName: mapped.categoryName,
      status: mapped.status,
      checkInEligibility: mapped.checkInEligibility,
      checkInTiming: mapped.checkInTiming,
      checkedInAt: mapped.checkedInAt,
      pronouns: mapped.pronouns,
    })
    return reply.send({
      eventTitle,
      roster: rows.map((r) =>
        toDoorShape(
          mapRegistrantFull(r.reg, {
            categoryName: r.categoryName,
            profileDisplayName: r.profileDisplayName,
            categoryRow: r.categoryRow,
          }),
        ),
      ),
    })
  })

  reg('POST', '/api/v1/conventions/:key/registrants/check-in', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        registrantId: z.string().uuid(),
        earlyCheckInOverride: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const meta = await registrantWithMeta(ctx.conv.id, parsed.data.registrantId)
    if (!meta) return reply.status(404).send({ error: 'Not found' })
    const [categoryRow] = meta.reg.categoryId
      ? await db
          .select()
          .from(schema.conventionRegistrationCategories)
          .where(eq(schema.conventionRegistrationCategories.id, meta.reg.categoryId))
          .limit(1)
      : [undefined]
    const resolved = resolveCheckInUpdate(categoryRow ?? null, {
      earlyCheckInOverride: parsed.data.earlyCheckInOverride,
      registrationStatus: meta.reg.registrationStatus,
    })
    if (!resolved.ok) return reply.status(resolved.status).send(resolved.body)
    const [row] = await db
      .update(schema.conventionRegistrants)
      .set(resolved.patch)
      .where(eq(schema.conventionRegistrants.id, parsed.data.registrantId))
      .returning()
    const mapped = mapRegistrantFull(row!, {
      categoryName: meta.categoryName,
      profileDisplayName: meta.profileDisplayName,
      categoryRow: categoryRow ?? null,
    })
    return reply.send({ registrant: mapped })
  })

  reg('GET', '/api/v1/conventions/:key/registrants/lookup', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const query = req.query as { token?: string; qr?: string; q?: string }
    const token = query.token?.trim() || query.qr?.trim()
    const search = query.q?.trim()
    if (!token && !search) return reply.status(400).send({ error: 'token or q required' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return

    const toDoorRegistrant = (
      row: typeof schema.conventionRegistrants.$inferSelect,
      categoryName: string | null,
      profileDisplayName: string | null,
      categoryRow: typeof schema.conventionRegistrationCategories.$inferSelect | null,
    ) => {
      const mapped = mapRegistrantFull(row, { categoryName, profileDisplayName, categoryRow })
      return {
        id: mapped.id,
        sceneDisplayName: mapped.sceneDisplayName,
        categoryName: mapped.categoryName,
        status: mapped.status,
        checkInEligibility: mapped.checkInEligibility,
        checkInTiming: mapped.checkInTiming,
        checkedInAt: mapped.checkedInAt,
        pronouns: mapped.pronouns,
      }
    }

    if (token) {
      const [row] = await db
        .select()
        .from(schema.conventionRegistrants)
        .where(
          and(
            eq(schema.conventionRegistrants.conventionId, ctx.conv.id),
            eq(schema.conventionRegistrants.checkInToken, token),
          ),
        )
        .limit(1)
      if (!row) return reply.status(404).send({ error: 'Not found' })
      const [categoryRow] = row.categoryId
        ? await db
            .select()
            .from(schema.conventionRegistrationCategories)
            .where(eq(schema.conventionRegistrationCategories.id, row.categoryId))
            .limit(1)
        : [undefined]
      const meta = await registrantWithMeta(ctx.conv.id, row.id)
      const door = toDoorRegistrant(
        row,
        meta?.categoryName ?? null,
        meta?.profileDisplayName ?? null,
        categoryRow ?? null,
      )
      return reply.send({ registrant: door, registrants: [door] })
    }

    const pattern = `%${search!.replace(/[%_\\]/g, '\\$&')}%`
    const rows = await db
      .select({
        reg: schema.conventionRegistrants,
        categoryName: schema.conventionRegistrationCategories.name,
        categoryRow: schema.conventionRegistrationCategories,
        profileDisplayName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .leftJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(
        and(
          eq(schema.conventionRegistrants.conventionId, ctx.conv.id),
          or(
            ilike(schema.conventionRegistrants.displayName, pattern),
            ilike(schema.conventionRegistrants.email, pattern),
            ilike(schema.profiles.displayName, pattern),
          )!,
        ),
      )
      .orderBy(asc(schema.conventionRegistrants.displayName))
      .limit(20)

    return reply.send({
      registrants: rows.map((r) =>
        toDoorRegistrant(r.reg, r.categoryName, r.profileDisplayName, r.categoryRow),
      ),
    })
  })

  reg('GET', '/api/v1/conventions/:key/registrants/:registrantId/qr', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, registrantId } = req.params as { key: string; registrantId: string }
    if (!UUID_RE.test(registrantId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const meta = await registrantWithMeta(ctx.conv.id, registrantId)
    if (!meta) return reply.status(404).send({ error: 'Not found' })
    const token = await ensureCheckInToken(registrantId)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/><text x="50" y="55" text-anchor="middle" font-size="8">${token.slice(0, 12)}</text></svg>`
    return reply.header('Content-Type', 'image/svg+xml').send(svg)
  })

  reg('GET', '/api/v1/conventions/:key/registrants/export', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const rows = await db
      .select({
        reg: schema.conventionRegistrants,
        categoryName: schema.conventionRegistrationCategories.name,
        categoryRow: schema.conventionRegistrationCategories,
        profileDisplayName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .leftJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionRegistrants.displayName))
    const header = ['Name', 'Email', 'Category', 'Status', 'Checked in at']
    const lines = [
      header.join(','),
      ...rows.map((r) => {
        const m = mapRegistrantFull(r.reg, {
          categoryName: r.categoryName,
          profileDisplayName: r.profileDisplayName,
          categoryRow: r.categoryRow,
        })
        return [
          escapeCsvCell(m.sceneDisplayName),
          escapeCsvCell(m.email),
          escapeCsvCell(m.categoryName),
          escapeCsvCell(m.status),
          escapeCsvCell(m.checkedInAt),
        ].join(',')
      }),
    ]
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="registrants-${ctx.conv.slug}.csv"`)
      .send(lines.join('\n'))
  })
}
