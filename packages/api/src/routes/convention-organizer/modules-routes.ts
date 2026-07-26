import { randomBytes } from 'node:crypto'
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { parseSpreadsheetImport, type ImportKind } from '@c2k/shared'
import {
  exchangeGoogleOAuthCode,
  fetchGoogleSheetValuesResolved,
  googleOAuthConfigured,
  googleOAuthStartUrl,
  sheetNameFromRange,
} from '../../lib/google-sheets-oauth.js'
import {
  applyRoomMatchesToParsedRows,
  insertImportBatchFromParsed,
} from '../../lib/convention-organizer/organizerImportBatch.js'
import {
  hashSecret,
  iso,
  newToken,
  requireDb,
  requireOrganizer,
  requireUser,
  UUID_RE,
  type RouteRegistrar,
} from './shared.js'

const DEFAULT_GOOGLE_SHEET_RANGE = 'Sheet1!A1:Z500'

function organizerImportUrl(convSlug: string, params: Record<string, string> = {}) {
  const site = process.env.VITE_SITE_URL ?? 'http://127.0.0.1:5173'
  const qs = new URLSearchParams({ tab: 'import', ...params })
  return `${site}/organizer/conventions/${encodeURIComponent(convSlug)}?${qs.toString()}`
}

function sheetTitleFromRange(range: string | null | undefined): string | null {
  if (!range) return null
  const name = sheetNameFromRange(range)
  return name || null
}

function mapGoogleImportBatch(row: typeof schema.conventionImportBatches.$inferSelect) {
  const summary = (row.summary ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    sourceFilename: row.sourceFilename,
    summary: { total: summary.total ?? 0, ...summary },
    createdAt: iso(row.createdAt),
    publishedAt: iso(row.publishedAt),
  }
}

function mapGoogleImportRow(row: typeof schema.conventionImportRows.$inferSelect) {
  return {
    id: row.id,
    batchId: row.batchId,
    rowKey: row.rowKey,
    kind: row.kind,
    action: row.action,
    draftStatus: row.draftStatus,
    title: row.title,
    personName: row.personName,
    role: row.role,
    track: row.track,
    room: row.room,
    locationId: row.locationId,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    description: row.description,
    sortOrder: row.sortOrder,
    validationErrors: row.validationErrors,
  }
}

async function loadGoogleConnection(conventionId: string) {
  const [row] = await db
    .select()
    .from(schema.conventionGoogleSheetConnections)
    .where(eq(schema.conventionGoogleSheetConnections.conventionId, conventionId))
    .limit(1)
  return row ?? null
}

async function upsertGoogleConnection(
  conventionId: string,
  patch: Partial<{
    refreshToken: string
    spreadsheetId: string
    sheetName: string
  }>,
) {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.refreshToken !== undefined) set.refreshToken = patch.refreshToken
  if (patch.spreadsheetId !== undefined) set.spreadsheetId = patch.spreadsheetId
  if (patch.sheetName !== undefined) set.sheetName = patch.sheetName
  const existing = await loadGoogleConnection(conventionId)
  if (existing) {
    const [row] = await db
      .update(schema.conventionGoogleSheetConnections)
      .set(set)
      .where(eq(schema.conventionGoogleSheetConnections.id, existing.id))
      .returning()
    return row!
  }
  const [row] = await db
    .insert(schema.conventionGoogleSheetConnections)
    .values({ conventionId, ...patch })
    .returning()
  return row!
}

export function registerModuleRoutes(reg: RouteRegistrar) {
  // --- ISO moderation (kit shim) ---
  reg('GET', '/api/v1/conventions/:key/iso', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionKitIsoPosts)
      .where(eq(schema.conventionKitIsoPosts.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionKitIsoPosts.createdAt))
    return reply.send({
      posts: rows.map((p) => ({
        id: p.id,
        authorLabel: p.authorLabel,
        body: p.body,
        hidden: p.hidden,
        createdAt: iso(p.createdAt),
      })),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/iso', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({ postId: z.string().uuid(), hidden: z.boolean() })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const [row] = await db
      .update(schema.conventionKitIsoPosts)
      .set({ hidden: parsed.data.hidden })
      .where(
        and(
          eq(schema.conventionKitIsoPosts.conventionId, ctx.conv.id),
          eq(schema.conventionKitIsoPosts.id, parsed.data.postId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ post: row })
  })

  reg('GET', '/api/v1/conventions/:key/iso/comments', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const posts = await db
      .select({ id: schema.conventionKitIsoPosts.id })
      .from(schema.conventionKitIsoPosts)
      .where(eq(schema.conventionKitIsoPosts.conventionId, ctx.conv.id))
    const postIds = posts.map((p) => p.id)
    const rows =
      postIds.length > 0
        ? await db
            .select()
            .from(schema.conventionIsoComments)
            .where(inArray(schema.conventionIsoComments.postId, postIds))
            .orderBy(asc(schema.conventionIsoComments.createdAt))
        : []
    return reply.send({
      comments: rows.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorLabel: c.authorLabel,
        body: c.body,
        hidden: c.hidden,
        createdAt: iso(c.createdAt),
      })),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/iso/comments/:commentId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, commentId } = req.params as { key: string; commentId: string }
    if (!UUID_RE.test(commentId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = z.object({ hidden: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const [row] = await db
      .update(schema.conventionIsoComments)
      .set({ hidden: parsed.data.hidden })
      .where(eq(schema.conventionIsoComments.id, commentId))
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ comment: row })
  })

  // --- Attendee groups (organizer moderation; attendee discover uses convention-attendee-routes) ---
  reg('GET', '/api/v1/conventions/:key/attendee-groups/moderation', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const groups = await db
      .select()
      .from(schema.conventionAttendeeGroups)
      .where(eq(schema.conventionAttendeeGroups.conventionId, ctx.conv.id))
    const groupIds = groups.map((g) => g.id)
    const reports = groupIds.length
      ? await db
          .select()
          .from(schema.conventionAttendeeGroupReports)
          .where(inArray(schema.conventionAttendeeGroupReports.groupId, groupIds))
      : []
    return reply.send({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        visibility: g.visibility,
        status: g.status,
        capacity: g.capacity,
        hidden: g.hidden,
        createdAt: iso(g.createdAt),
        updatedAt: iso(g.updatedAt),
      })),
      reports: reports.map((r) => ({
        id: r.id,
        groupId: r.groupId,
        reason: r.reason,
        status: r.status,
        createdAt: iso(r.createdAt),
      })),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/attendee-groups/moderation', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        groupId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(10000).nullable().optional(),
        visibility: z.enum(['public', 'private', 'invite_only']).optional(),
        status: z.enum(['open', 'closed', 'archived']).optional(),
        capacity: z.number().int().nullable().optional(),
        hidden: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const patch: Partial<typeof schema.conventionAttendeeGroups.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim()
    if (parsed.data.description !== undefined) patch.description = parsed.data.description
    if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility
    if (parsed.data.status !== undefined) patch.status = parsed.data.status
    if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity
    if (parsed.data.hidden !== undefined) patch.hidden = parsed.data.hidden
    const [row] = await db
      .update(schema.conventionAttendeeGroups)
      .set(patch)
      .where(
        and(
          eq(schema.conventionAttendeeGroups.conventionId, ctx.conv.id),
          eq(schema.conventionAttendeeGroups.id, parsed.data.groupId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ group: row })
  })

  // --- Exhibitors ---
  reg('GET', '/api/v1/conventions/:key/exhibitors', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionExhibitors)
      .where(eq(schema.conventionExhibitors.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionExhibitors.sortOrder))
    return reply.send({
      exhibitors: rows.map((e) => ({
        id: e.id,
        name: e.name,
        boothLabel: e.boothLabel,
        booth_label: e.boothLabel,
        url: e.url,
        description: e.description,
        hours: e.hours,
        logoPath: e.logoPath,
        logo_path: e.logoPath,
        tags: e.tags ?? [],
        specials: e.specials,
        viewCount: e.viewCount,
        view_count: e.viewCount,
        isPublished: e.isPublished,
        is_published: e.isPublished,
        applicationStatus: e.applicationStatus,
        application_status: e.applicationStatus,
        applicantUserId: e.applicantUserId,
        sortOrder: e.sortOrder,
        createdAt: iso(e.createdAt),
        updatedAt: iso(e.updatedAt),
      })),
    })
  })

  const ExhibitorBody = z.object({
    name: z.string().min(1).max(255).optional(),
    boothLabel: z.string().max(128).nullable().optional(),
    url: z.union([z.string().url(), z.literal('')]).nullable().optional(),
    description: z.string().max(20000).nullable().optional(),
    hours: z.string().max(2000).nullable().optional(),
    logoPath: z.string().max(2000).nullable().optional(),
    tags: z.array(z.string().max(64)).optional(),
    specials: z.string().max(10000).nullable().optional(),
    viewCount: z.number().int().optional(),
    isPublished: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })

  reg('POST', '/api/v1/conventions/:key/exhibitors', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = ExhibitorBody.extend({ name: z.string().min(1).max(255) }).safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const [row] = await db
      .insert(schema.conventionExhibitors)
      .values({
        conventionId: ctx.conv.id,
        name: data.name!.trim(),
        boothLabel: data.boothLabel ?? null,
        url: data.url === '' ? null : data.url ?? null,
        description: data.description ?? null,
        hours: data.hours ?? null,
        logoPath: data.logoPath ?? null,
        tags: (data.tags ?? []) as never,
        specials: data.specials ?? null,
        viewCount: data.viewCount ?? 0,
        isPublished: data.isPublished ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send({ exhibitor: row })
  })

  reg('PATCH', '/api/v1/conventions/:key/exhibitors/:exhibitorId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, exhibitorId } = req.params as { key: string; exhibitorId: string }
    if (!UUID_RE.test(exhibitorId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = ExhibitorBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const patch: Partial<typeof schema.conventionExhibitors.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.boothLabel !== undefined) patch.boothLabel = data.boothLabel
    if (data.url !== undefined) patch.url = data.url === '' ? null : data.url
    if (data.description !== undefined) patch.description = data.description
    if (data.hours !== undefined) patch.hours = data.hours
    if (data.logoPath !== undefined) patch.logoPath = data.logoPath
    if (data.tags !== undefined) patch.tags = data.tags as never
    if (data.specials !== undefined) patch.specials = data.specials
    if (data.viewCount !== undefined) patch.viewCount = data.viewCount
    if (data.isPublished !== undefined) patch.isPublished = data.isPublished
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder
    const [row] = await db
      .update(schema.conventionExhibitors)
      .set(patch)
      .where(
        and(
          eq(schema.conventionExhibitors.conventionId, ctx.conv.id),
          eq(schema.conventionExhibitors.id, exhibitorId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ exhibitor: row })
  })

  reg('DELETE', '/api/v1/conventions/:key/exhibitors/:exhibitorId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, exhibitorId } = req.params as { key: string; exhibitorId: string }
    if (!UUID_RE.test(exhibitorId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionExhibitors)
      .where(
        and(
          eq(schema.conventionExhibitors.conventionId, ctx.conv.id),
          eq(schema.conventionExhibitors.id, exhibitorId),
        ),
      )
      .returning({ id: schema.conventionExhibitors.id })
    if (!del.length) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- Meals ---
  reg('GET', '/api/v1/conventions/:key/meal-periods', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionMealPeriods)
      .where(eq(schema.conventionMealPeriods.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionMealPeriods.startsAt))
    return reply.send({
      periods: rows.map((p) => ({
        id: p.id,
        name: p.name,
        startsAt: iso(p.startsAt),
        endsAt: iso(p.endsAt),
        capacityMax: p.capacityMax,
        sortOrder: p.sortOrder,
      })),
    })
  })

  // kit-shape body: accepts `label` alias for `name` and ISO datetimes.
  const MealPeriodBody = z.object({
    name: z.string().min(1).max(255).optional(),
    label: z.string().min(1).max(255).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    capacityMax: z.number().int().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })

  reg('POST', '/api/v1/conventions/:key/meal-periods', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = MealPeriodBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const name = (data.name ?? data.label ?? '').trim()
    if (!name) return reply.status(400).send({ error: 'Invalid body', details: 'name required' })
    if (!data.startsAt || !data.endsAt) {
      return reply.status(400).send({ error: 'Invalid body', details: 'startsAt/endsAt required' })
    }
    const [row] = await db
      .insert(schema.conventionMealPeriods)
      .values({
        conventionId: ctx.conv.id,
        name,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        capacityMax: data.capacityMax ?? null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send({
      period: {
        id: row!.id,
        name: row!.name,
        label: row!.name,
        startsAt: iso(row!.startsAt),
        endsAt: iso(row!.endsAt),
        capacityMax: row!.capacityMax,
        sortOrder: row!.sortOrder,
      },
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/meal-periods/:periodId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, periodId } = req.params as { key: string; periodId: string }
    if (!UUID_RE.test(periodId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = MealPeriodBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const patch: Partial<typeof schema.conventionMealPeriods.$inferInsert> = {}
    const name = data.name ?? data.label
    if (name !== undefined) patch.name = name.trim()
    if (data.startsAt !== undefined) patch.startsAt = new Date(data.startsAt)
    if (data.endsAt !== undefined) patch.endsAt = new Date(data.endsAt)
    if (data.capacityMax !== undefined) patch.capacityMax = data.capacityMax
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder
    const [row] = await db
      .update(schema.conventionMealPeriods)
      .set(patch)
      .where(
        and(
          eq(schema.conventionMealPeriods.conventionId, ctx.conv.id),
          eq(schema.conventionMealPeriods.id, periodId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ period: row })
  })

  reg('GET', '/api/v1/conventions/:key/meal-signups', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const periods = await db
      .select({ id: schema.conventionMealPeriods.id, name: schema.conventionMealPeriods.name })
      .from(schema.conventionMealPeriods)
      .where(eq(schema.conventionMealPeriods.conventionId, ctx.conv.id))
    const rollup: { periodId: string; periodName: string; count: number }[] = []
    for (const p of periods) {
      const [c] = await db
        .select({ n: count() })
        .from(schema.conventionMealSignups)
        .where(eq(schema.conventionMealSignups.periodId, p.id))
      rollup.push({ periodId: p.id, periodName: p.name, count: Number(c?.n ?? 0) })
    }
    return reply.send({ rollup })
  })

  // --- Session feedback ---
  reg('GET', '/api/v1/conventions/:key/session-feedback', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const [row] = await db
      .select()
      .from(schema.conventionSessionFeedback)
      .where(eq(schema.conventionSessionFeedback.conventionId, ctx.conv.id))
      .limit(1)
    return reply.send({
      enabled: row?.enabled ?? false,
      prompt: row?.prompt ?? '',
      config: row?.config ?? {},
    })
  })

  const patchSessionFeedback: import('fastify').RouteHandlerMethod = async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const SessionFeedbackBody = z.object({
      enabled: z.boolean().optional(),
      prompt: z.string().max(2000).nullable().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      feedbackConfig: z.record(z.string(), z.unknown()).optional(),
    })
    const raw = SessionFeedbackBody.safeParse(req.body)
    if (!raw.success) {
      return reply.status(400).send({ error: 'Invalid body', details: raw.error.flatten() })
    }
    const merged = {
      enabled: raw.data.enabled,
      prompt: raw.data.prompt,
      config: raw.data.config ?? raw.data.feedbackConfig,
    }
    const parsed = { success: true as const, data: merged }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const [existing] = await db
      .select()
      .from(schema.conventionSessionFeedback)
      .where(eq(schema.conventionSessionFeedback.conventionId, ctx.conv.id))
      .limit(1)
    if (!existing) {
      const [row] = await db
        .insert(schema.conventionSessionFeedback)
        .values({
          conventionId: ctx.conv.id,
          enabled: parsed.data.enabled ?? false,
          prompt: parsed.data.prompt ?? null,
          config: parsed.data.config ?? {},
        })
        .returning()
      return reply.send(row)
    }
    const [row] = await db
      .update(schema.conventionSessionFeedback)
      .set({
        enabled: parsed.data.enabled ?? existing.enabled,
        prompt: parsed.data.prompt !== undefined ? parsed.data.prompt : existing.prompt,
        config: parsed.data.config ?? existing.config,
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionSessionFeedback.conventionId, ctx.conv.id))
      .returning()
    return reply.send(row)
  }

  reg('PATCH', '/api/v1/conventions/:key/session-feedback', patchSessionFeedback)
  reg('PATCH', '/api/v1/conventions/:key/session-feedback/config', patchSessionFeedback)

  // --- Volunteer compliance ---
  reg('GET', '/api/v1/conventions/:key/volunteer-compliance', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const categories = await db
      .select()
      .from(schema.conventionRegistrationCategories)
      .where(eq(schema.conventionRegistrationCategories.conventionId, ctx.conv.id))
    const categoriesWithHours = categories.filter((c) => c.expectedHours != null && c.expectedHours > 0)
    if (!categoriesWithHours.length) {
      return reply.send({ rows: [] })
    }
    const registrants = await db
      .select({
        id: schema.conventionRegistrants.id,
        userId: schema.conventionRegistrants.userId,
        displayName: schema.conventionRegistrants.displayName,
        categoryId: schema.conventionRegistrants.categoryId,
        categoryName: schema.conventionRegistrationCategories.name,
        expectedHours: schema.conventionRegistrationCategories.expectedHours,
        profileName: schema.profiles.displayName,
      })
      .from(schema.conventionRegistrants)
      .innerJoin(
        schema.conventionRegistrationCategories,
        eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
      )
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))

    const shifts = await db
      .select()
      .from(schema.conventionVolunteerShifts)
      .where(eq(schema.conventionVolunteerShifts.conventionId, ctx.conv.id))

    const signups = await db
      .select({
        userId: schema.conventionVolunteerShiftSignups.userId,
        startsAt: schema.conventionVolunteerShifts.startsAt,
        endsAt: schema.conventionVolunteerShifts.endsAt,
      })
      .from(schema.conventionVolunteerShiftSignups)
      .innerJoin(
        schema.conventionVolunteerShifts,
        eq(schema.conventionVolunteerShifts.id, schema.conventionVolunteerShiftSignups.shiftId),
      )
      .where(eq(schema.conventionVolunteerShifts.conventionId, ctx.conv.id))

    function hoursForUser(userId: string | null): number {
      if (!userId) return 0
      let total = 0
      for (const s of shifts) {
        if (s.personId === userId) {
          total += (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600000
        }
      }
      for (const su of signups) {
        if (su.userId === userId) {
          total += (new Date(su.endsAt).getTime() - new Date(su.startsAt).getTime()) / 3600000
        }
      }
      return Math.round(total * 10) / 10
    }

    const rows = registrants
      .filter((r) => r.expectedHours != null && r.expectedHours > 0)
      .map((r) => {
        const expectedHours = r.expectedHours ?? 0
        const claimedHours = hoursForUser(r.userId)
        const deficitHours = Math.max(0, Math.round((expectedHours - claimedHours) * 10) / 10)
        return {
          registrantId: r.id,
          displayName: r.profileName ?? r.displayName,
          categoryName: r.categoryName,
          expectedHours,
          claimedHours,
          deficitHours,
        }
      })
      .filter((r) => r.deficitHours > 0)

    return reply.send({ rows })
  })

  // --- Calendar feeds ---
  reg('GET', '/api/v1/conventions/:key/calendar-feeds', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionCalendarFeedTokens)
      .where(eq(schema.conventionCalendarFeedTokens.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionCalendarFeedTokens.createdAt))
    return reply.send({
      tokens: rows.map((t) => ({
        id: t.id,
        label: t.label,
        scope: t.scope,
        filterTrackId: t.filterTrackId,
        filterLocationId: t.filterLocationId,
        filterPersonId: t.filterPersonId,
        createdAt: iso(t.createdAt),
        revokedAt: iso(t.revokedAt),
      })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/calendar-feeds', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        label: z.string().max(128).optional(),
        scope: z.enum(['full', 'track', 'location', 'person']).optional(),
        filterTrackId: z.string().uuid().nullable().optional(),
        filterLocationId: z.string().uuid().nullable().optional(),
        filterPersonId: z.string().uuid().nullable().optional(),
      })
      .safeParse(req.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const token = newToken()
    const tokenHash = hashSecret(token)
    const [row] = await db
      .insert(schema.conventionCalendarFeedTokens)
      .values({
        conventionId: ctx.conv.id,
        tokenHash,
        label: parsed.data.label ?? 'Calendar feed',
        scope: parsed.data.scope ?? 'full',
        filterTrackId: parsed.data.filterTrackId ?? null,
        filterLocationId: parsed.data.filterLocationId ?? null,
        filterPersonId: parsed.data.filterPersonId ?? null,
      })
      .returning()
    const base = (process.env.C2K_WEB_PUBLIC_URL ?? process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    )
    return reply.send({
      token: row,
      subscribeUrl: `${base}/api/v1/conventions/${encodeURIComponent(ctx.conv.slug)}/calendar-feed/${token}.ics`,
    })
  })

  reg('POST', '/api/v1/conventions/:key/calendar-feeds/:tokenId/revoke', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, tokenId } = req.params as { key: string; tokenId: string }
    if (!UUID_RE.test(tokenId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'staff_ops')
    if (!ctx) return
    const [row] = await db
      .update(schema.conventionCalendarFeedTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.conventionCalendarFeedTokens.conventionId, ctx.conv.id),
          eq(schema.conventionCalendarFeedTokens.id, tokenId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  // --- Google Sheets ---
  reg('GET', '/api/v1/conventions/:key/google-sheets/connection', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const row = await loadGoogleConnection(ctx.conv.id)
    const range = row?.sheetName ?? DEFAULT_GOOGLE_SHEET_RANGE
    return reply.send({
      connected: Boolean(row?.refreshToken),
      oauthConfigured: googleOAuthConfigured(),
      publicPullAvailable: true,
      spreadsheetId: row?.spreadsheetId ?? null,
      sheetTitle: sheetTitleFromRange(range),
      range,
      updatedAt: iso(row?.updatedAt ?? null),
    })
  })

  reg('PATCH', '/api/v1/conventions/:key/google-sheets/connection', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        spreadsheetId: z.string().min(10).max(128),
        range: z.string().min(3).max(255).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const conn = await loadGoogleConnection(ctx.conv.id)
    const row = await upsertGoogleConnection(ctx.conv.id, {
      spreadsheetId: parsed.data.spreadsheetId,
      sheetName: parsed.data.range?.trim() || conn?.sheetName || DEFAULT_GOOGLE_SHEET_RANGE,
    })
    const range = row.sheetName ?? DEFAULT_GOOGLE_SHEET_RANGE
    return reply.send({
      connected: Boolean(row.refreshToken),
      oauthConfigured: googleOAuthConfigured(),
      publicPullAvailable: true,
      spreadsheetId: row.spreadsheetId ?? null,
      sheetTitle: sheetTitleFromRange(range),
      range,
      updatedAt: iso(row.updatedAt),
    })
  })

  reg('GET', '/api/v1/conventions/:key/google-sheets/oauth/start', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    if (!googleOAuthConfigured()) {
      return reply.redirect(
        organizerImportUrl(key, { google: 'error', reason: 'not_configured' }),
      )
    }
    const returnTo = (req.query as { returnTo?: string }).returnTo ?? 'import'
    return reply.redirect(googleOAuthStartUrl(key, returnTo))
  })

  reg('GET', '/api/v1/conventions/:key/google-sheets/oauth/callback', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key } = req.params as { key: string }
    const query = req.query as { code?: string; state?: string; error?: string }
    if (query.error || !query.code) {
      return reply.redirect(
        organizerImportUrl(key, {
          google: 'error',
          reason: query.error ?? 'missing_code',
        }),
      )
    }
    const actor = requireUser(req, reply)
    if (!actor) return
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    if (!googleOAuthConfigured()) {
      return reply.redirect(
        organizerImportUrl(key, { google: 'error', reason: 'not_configured' }),
      )
    }
    try {
      const { refreshToken } = await exchangeGoogleOAuthCode(query.code, key)
      await upsertGoogleConnection(ctx.conv.id, { refreshToken })
      return reply.redirect(organizerImportUrl(key, { google: 'connected' }))
    } catch {
      return reply.redirect(
        organizerImportUrl(key, { google: 'error', reason: 'token_exchange_failed' }),
      )
    }
  })

  reg('POST', '/api/v1/conventions/:key/google-sheets/preview', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        spreadsheetId: z.string().min(10).max(128),
        range: z.string().min(3).max(255).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const conn = await loadGoogleConnection(ctx.conv.id)
    const range = parsed.data.range?.trim() || conn?.sheetName || DEFAULT_GOOGLE_SHEET_RANGE
    try {
      const values = await fetchGoogleSheetValuesResolved(
        conn?.refreshToken,
        parsed.data.spreadsheetId,
        range,
      )
      const preview = values.slice(0, 12)
      return reply.send({ preview, rowCount: values.length, range })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Google Sheets preview failed'
      return reply.status(502).send({ error: message })
    }
  })

  reg('POST', '/api/v1/conventions/:key/google-sheets/fetch-rows', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        spreadsheetId: z.string().min(10).max(128),
        range: z.string().min(3).max(255).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const conn = await loadGoogleConnection(ctx.conv.id)
    const range = parsed.data.range?.trim() || conn?.sheetName || DEFAULT_GOOGLE_SHEET_RANGE
    try {
      const rows = await fetchGoogleSheetValuesResolved(
        conn?.refreshToken,
        parsed.data.spreadsheetId,
        range,
      )
      await upsertGoogleConnection(ctx.conv.id, {
        spreadsheetId: parsed.data.spreadsheetId,
        sheetName: range,
      })
      return reply.send({
        rows,
        rowCount: rows.length,
        range,
        sheetName: sheetNameFromRange(range),
        spreadsheetId: parsed.data.spreadsheetId,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Google Sheets fetch failed'
      return reply.status(502).send({ error: message })
    }
  })

  reg('POST', '/api/v1/conventions/:key/google-sheets/create-import-batch', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z
      .object({
        spreadsheetId: z.string().min(10).max(128),
        range: z.string().min(3).max(255).optional(),
        kind: z.enum(['program', 'staff']),
      })
      .safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'scheduler')
    if (!ctx) return
    const conn = await loadGoogleConnection(ctx.conv.id)
    const range = parsed.data.range?.trim() || conn?.sheetName || DEFAULT_GOOGLE_SHEET_RANGE
    let values: string[][]
    try {
      values = await fetchGoogleSheetValuesResolved(conn?.refreshToken, parsed.data.spreadsheetId, range)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Google Sheets fetch failed'
      return reply.status(502).send({ error: message })
    }
    const kind = parsed.data.kind as ImportKind
    const sheetTitle = sheetNameFromRange(range)
    const parseResult = parseSpreadsheetImport(values, {
      kind,
      timezone: ctx.conv.timezone ?? 'America/New_York',
      windowStartsAt: ctx.conv.startsAt?.toISOString(),
      windowEndsAt: ctx.conv.endsAt?.toISOString(),
      sourceId: `sheet:${sheetTitle ?? parsed.data.spreadsheetId}`,
      sheetName: sheetTitle ?? undefined,
    })
    const locationRows = await db
      .select({
        id: schema.conventionLocations.id,
        name: schema.conventionLocations.name,
        shortName: schema.conventionLocations.shortName,
      })
      .from(schema.conventionLocations)
      .where(eq(schema.conventionLocations.conventionId, ctx.conv.id))
    const withRooms = applyRoomMatchesToParsedRows(parseResult.rows, locationRows)
    const { batch, rows: importRows } = await insertImportBatchFromParsed({
      conventionId: ctx.conv.id,
      organizerUserId: actor.userId,
      kind,
      sourceFilename: `google-sheets:${parsed.data.spreadsheetId}`,
      sheetName: sheetTitle,
      columnMapping: parseResult.columnMapping,
      importFormat: parseResult.importFormat,
      headerRowIndex: parseResult.headerRowIndex,
      rows: withRooms,
    })
    await upsertGoogleConnection(ctx.conv.id, {
      spreadsheetId: parsed.data.spreadsheetId,
      sheetName: range,
    })
    return reply.send({
      batch: mapGoogleImportBatch(batch),
      rows: importRows.map(mapGoogleImportRow),
    })
  })

  // --- Inbound registrant secret ---
  reg('GET', '/api/v1/conventions/:key/registrant-inbound-secret', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select({ id: schema.conventionRegistrantInboundSecrets.id, label: schema.conventionRegistrantInboundSecrets.label, createdAt: schema.conventionRegistrantInboundSecrets.createdAt })
      .from(schema.conventionRegistrantInboundSecrets)
      .where(eq(schema.conventionRegistrantInboundSecrets.conventionId, ctx.conv.id))
    return reply.send({
      configured: rows.length > 0,
      secrets: rows.map((r) => ({ id: r.id, label: r.label, created_at: iso(r.createdAt) })),
    })
  })

  reg('POST', '/api/v1/conventions/:key/registrant-inbound-secret', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = z.object({ label: z.string().max(128).optional() }).safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const raw = randomBytes(24).toString('hex')
    const [row] = await db
      .insert(schema.conventionRegistrantInboundSecrets)
      .values({
        conventionId: ctx.conv.id,
        secretHash: hashSecret(raw),
        label: parsed.data.label ?? 'default',
      })
      .returning()
    return reply.send({ secret: raw, id: row!.id })
  })

  reg('POST', '/api/v1/conventions/:key/message-templates/test-send', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, ['staff_ops', 'scheduler'])
    if (!ctx) return
    const parsed = z
      .object({
        toUsername: z.string().min(1).max(64).optional(),
        toUserId: z.string().uuid().optional(),
        subject: z.string().max(200).optional(),
        body: z.string().max(50000).optional(),
        bodyText: z.string().max(50000).optional(),
        bodyHtml: z.string().max(50000).optional(),
      })
      .safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    let recipientUserId = parsed.data.toUserId
    if (!recipientUserId && parsed.data.toUsername) {
      const [u] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, parsed.data.toUsername.trim().replace(/^@/, '')))
        .limit(1)
      recipientUserId = u?.id
    }
    if (!recipientUserId) {
      return reply.status(400).send({
        error: 'Provide toUsername (kink.social username) to receive a test message in Messaging',
      })
    }
    if (recipientUserId === actor.userId) {
      return reply.status(400).send({
        error: 'Pick another account for the test (you cannot DM yourself). A teammate username works.',
      })
    }

    const subject = parsed.data.subject ?? `[${ctx.conv.name}] Test message`
    const rawBody =
      parsed.data.bodyHtml ??
      parsed.data.body ??
      parsed.data.bodyText ??
      'This is a test message from your convention organizer tools.'
    const looksHtml = /<[a-z][\s\S]*>/i.test(rawBody)
    const bodyHtml = looksHtml ? rawBody : `<p>${rawBody.replace(/\n/g, '<br/>')}</p>`
    const {
      buildOrganizerCampaignMessageHtml,
      deliverOrganizerCampaignDm,
    } = await import('../../lib/organizer-inbox-campaign.js')
    const { stripToPlainText } = await import('../../lib/marketing-email-html.js')
    const html = buildOrganizerCampaignMessageHtml({
      subject,
      bodyHtml,
      eventName: ctx.conv.name,
    })
    const result = await deliverOrganizerCampaignDm({
      organizerUserId: actor.userId,
      recipientUserId,
      htmlBody: html,
      bodyPreview: stripToPlainText(html),
    })
    if (!result.ok) return reply.status(502).send({ error: result.error ?? 'Send failed' })
    return reply.send({
      ok: true,
      channel: 'inbox',
      conversationId: result.conversationId,
      messageId: result.messageId,
    })
  })
}
