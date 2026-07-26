/**
 * Registration domain organizer routes:
 *  - GET/POST/PATCH/DELETE /registration-categories
 *  - GET/PUT/PATCH /registration-form (PUT replaces full form; PATCH for partial)
 *  - GET/POST/PATCH/DELETE /trusted-roles
 *
 * Kit-shape input/output via shared Zod schemas in
 * `lib/convention-organizer/registration.ts`. Accepts both kit field names
 * (`accessCode`, `roleKind`, `applySlug`, `introText`) and the legacy C2K
 * field names that older clients still send (`compCode`, `slug`,
 * `description`) so we never reject an Invalid body for a known intent.
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import {
  mapRegistrationCategory,
  mapRegistrationForm,
  mapRegistrationQuestion,
  mapTrustedRole,
  mapTrustedRoleQuestion,
  questionOptionsFromBody,
  questionTypeFromBody,
  RegistrationCategoryBody,
  RegistrationFormBody,
  TrustedRoleBody,
  trustedRoleApplySlug,
} from '../../lib/convention-organizer/registration.js'
import { sanitizeFeedHtml } from '../../lib/sanitize-feed-body.js'
import {
  requireDb,
  requireOrganizer,
  requireUser,
  UUID_RE,
  type RouteRegistrar,
} from './shared.js'

function sanitizeIntroHtml(html: string | null | undefined): string | null {
  if (html == null) return null
  const cleaned = sanitizeFeedHtml(html).slice(0, 50_000)
  return cleaned.length > 0 ? cleaned : null
}

async function loadFormForConvention(conventionId: string) {
  const [form] = await db
    .select()
    .from(schema.conventionRegistrationForms)
    .where(eq(schema.conventionRegistrationForms.conventionId, conventionId))
    .limit(1)
  return form ?? null
}

async function loadFormQuestions(formId: string) {
  return db
    .select()
    .from(schema.conventionRegistrationQuestions)
    .where(eq(schema.conventionRegistrationQuestions.formId, formId))
    .orderBy(asc(schema.conventionRegistrationQuestions.sortOrder))
}

async function loadTrustedRoleQuestions(roleIds: string[]) {
  if (!roleIds.length) return new Map<string, ReturnType<typeof mapTrustedRoleQuestion>[]>()
  const rows = await db
    .select()
    .from(schema.conventionTrustedRoleQuestions)
    .where(inArray(schema.conventionTrustedRoleQuestions.roleId, roleIds))
    .orderBy(asc(schema.conventionTrustedRoleQuestions.sortOrder))
  const byRole = new Map<string, ReturnType<typeof mapTrustedRoleQuestion>[]>()
  for (const r of rows) {
    const list = byRole.get(r.roleId) ?? []
    list.push(mapTrustedRoleQuestion(r))
    byRole.set(r.roleId, list)
  }
  return byRole
}

async function syncTrustedRoleQuestions(
  roleId: string,
  questions: Array<{
    id?: string
    type?: string
    fieldType?: string
    label: string
    required?: boolean
    sortOrder?: number
    optionsJson?: unknown
    options?: unknown
    visibilityRulesJson?: Record<string, unknown>
  }>,
) {
  const existing = await db
    .select({ id: schema.conventionTrustedRoleQuestions.id })
    .from(schema.conventionTrustedRoleQuestions)
    .where(eq(schema.conventionTrustedRoleQuestions.roleId, roleId))
  const existingIds = new Set(existing.map((x) => x.id))
  const incomingIds = new Set(questions.map((q) => q.id).filter(Boolean) as string[])
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
  if (toDelete.length) {
    await db
      .delete(schema.conventionTrustedRoleQuestions)
      .where(inArray(schema.conventionTrustedRoleQuestions.id, toDelete))
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!
    const type = questionTypeFromBody(q as never)
    const optionsJson = questionOptionsFromBody(q as never)
    const visibility = q.visibilityRulesJson ?? {}
    if (q.id && existingIds.has(q.id)) {
      await db
        .update(schema.conventionTrustedRoleQuestions)
        .set({
          type,
          label: q.label,
          required: q.required ?? false,
          sortOrder: q.sortOrder ?? i,
          optionsJson: optionsJson as never,
          visibilityRulesJson: visibility as never,
          updatedAt: new Date(),
        })
        .where(eq(schema.conventionTrustedRoleQuestions.id, q.id))
    } else {
      await db.insert(schema.conventionTrustedRoleQuestions).values({
        roleId,
        type,
        label: q.label,
        required: q.required ?? false,
        sortOrder: q.sortOrder ?? i,
        optionsJson: optionsJson as never,
        visibilityRulesJson: visibility as never,
      })
    }
  }
}

export function registerRegistrationRoutes(reg: RouteRegistrar) {
  /* ---------- Registration categories ---------- */

  reg('GET', '/api/v1/conventions/:key/registration-categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionRegistrationCategories)
      .where(eq(schema.conventionRegistrationCategories.conventionId, ctx.conv.id))
      .orderBy(
        asc(schema.conventionRegistrationCategories.sortOrder),
        asc(schema.conventionRegistrationCategories.name),
      )
    return reply.send({ categories: rows.map(mapRegistrationCategory) })
  })

  reg('POST', '/api/v1/conventions/:key/registration-categories', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = RegistrationCategoryBody.extend({ name: z.string().min(1).max(255) }).safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const compCode = data.compCode ?? data.accessCode ?? null
    const accessCode = data.accessCode ?? data.compCode ?? null
    const [row] = await db
      .insert(schema.conventionRegistrationCategories)
      .values({
        conventionId: ctx.conv.id,
        name: data.name!.trim(),
        description: data.description ?? null,
        sortOrder: data.sortOrder ?? 0,
        capacityMax: data.capacityMax ?? data.capacity ?? null,
        priceCents: data.priceCents ?? null,
        compCode: compCode,
        accessCode: accessCode,
        grantsStaffAccess: data.grantsStaffAccess ?? false,
        roleKind: data.roleKind ?? 'attendee',
        isPublic: data.isPublic ?? true,
        expectedHours: data.expectedHours ?? null,
        checkInValidFrom: data.checkInValidFrom ?? null,
        checkInValidThrough: data.checkInValidThrough ?? null,
        externalSourceRef: data.externalSourceRef ?? null,
        importedPaymentStatus: data.importedPaymentStatus ?? null,
      })
      .returning()
    return reply.status(201).send({ category: mapRegistrationCategory(row!) })
  })

  reg('PATCH', '/api/v1/conventions/:key/registration-categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, categoryId } = req.params as { key: string; categoryId: string }
    if (!UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = RegistrationCategoryBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const patch: Partial<typeof schema.conventionRegistrationCategories.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.description !== undefined) patch.description = data.description
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder
    if (data.capacityMax !== undefined) patch.capacityMax = data.capacityMax
    else if (data.capacity !== undefined) patch.capacityMax = data.capacity
    if (data.priceCents !== undefined) patch.priceCents = data.priceCents
    if (data.compCode !== undefined) {
      patch.compCode = data.compCode
      if (data.accessCode === undefined) patch.accessCode = data.compCode
    }
    if (data.accessCode !== undefined) {
      patch.accessCode = data.accessCode
      if (data.compCode === undefined) patch.compCode = data.accessCode
    }
    if (data.grantsStaffAccess !== undefined) patch.grantsStaffAccess = data.grantsStaffAccess
    if (data.roleKind !== undefined) patch.roleKind = data.roleKind
    if (data.isPublic !== undefined) patch.isPublic = data.isPublic
    if (data.expectedHours !== undefined) patch.expectedHours = data.expectedHours
    if (data.checkInValidFrom !== undefined) patch.checkInValidFrom = data.checkInValidFrom
    if (data.checkInValidThrough !== undefined) patch.checkInValidThrough = data.checkInValidThrough
    if (data.externalSourceRef !== undefined) patch.externalSourceRef = data.externalSourceRef
    if (data.importedPaymentStatus !== undefined) patch.importedPaymentStatus = data.importedPaymentStatus
    const [row] = await db
      .update(schema.conventionRegistrationCategories)
      .set(patch)
      .where(
        and(
          eq(schema.conventionRegistrationCategories.conventionId, ctx.conv.id),
          eq(schema.conventionRegistrationCategories.id, categoryId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ category: mapRegistrationCategory(row) })
  })

  reg('DELETE', '/api/v1/conventions/:key/registration-categories/:categoryId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, categoryId } = req.params as { key: string; categoryId: string }
    if (!UUID_RE.test(categoryId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionRegistrationCategories)
      .where(
        and(
          eq(schema.conventionRegistrationCategories.conventionId, ctx.conv.id),
          eq(schema.conventionRegistrationCategories.id, categoryId),
        ),
      )
      .returning({ id: schema.conventionRegistrationCategories.id })
    if (!del.length) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  /* ---------- Registration form ---------- */

  async function buildFormResponse(conventionId: string) {
    const form = await loadFormForConvention(conventionId)
    if (!form) return { form: null, questions: [] as ReturnType<typeof mapRegistrationQuestion>[] }
    const questions = await loadFormQuestions(form.id)
    const mappedForm = mapRegistrationForm(form)
    return {
      form: mappedForm ? { ...mappedForm, questions: questions.map(mapRegistrationQuestion) } : null,
      questions: questions.map(mapRegistrationQuestion),
    }
  }

  reg('GET', '/api/v1/conventions/:key/registration-form', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    return reply.send(await buildFormResponse(ctx.conv.id))
  })

  async function applyFormPatch(conventionId: string, body: z.infer<typeof RegistrationFormBody>) {
    let form = await loadFormForConvention(conventionId)
    if (!form) {
      const [inserted] = await db
        .insert(schema.conventionRegistrationForms)
        .values({
          conventionId,
          status: body.status ?? 'draft',
          introHtml: sanitizeIntroHtml(body.introHtml),
          introText: body.introText ?? '',
          confirmationText: body.confirmationText ?? '',
        })
        .returning()
      form = inserted!
    } else {
      const patch: Partial<typeof schema.conventionRegistrationForms.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (body.status !== undefined) patch.status = body.status
      if (body.introHtml !== undefined) patch.introHtml = sanitizeIntroHtml(body.introHtml)
      if (body.introText !== undefined) patch.introText = body.introText
      if (body.confirmationText !== undefined) patch.confirmationText = body.confirmationText
      const [updated] = await db
        .update(schema.conventionRegistrationForms)
        .set(patch)
        .where(eq(schema.conventionRegistrationForms.id, form.id))
        .returning()
      form = updated!
    }

    if (body.questions !== undefined) {
      const existing = await db
        .select({ id: schema.conventionRegistrationQuestions.id })
        .from(schema.conventionRegistrationQuestions)
        .where(eq(schema.conventionRegistrationQuestions.formId, form.id))
      const existingIds = new Set(existing.map((x) => x.id))
      const incomingIds = new Set(body.questions.map((q) => q.id).filter(Boolean) as string[])
      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
      if (toDelete.length) {
        await db
          .delete(schema.conventionRegistrationQuestions)
          .where(inArray(schema.conventionRegistrationQuestions.id, toDelete))
      }
      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i]!
        const type = questionTypeFromBody(q)
        const opts = questionOptionsFromBody(q)
        const visibility = q.visibilityRulesJson ?? {}
        const requiredFor = q.requiredForCategoryIds ?? []
        if (q.id && existingIds.has(q.id)) {
          await db
            .update(schema.conventionRegistrationQuestions)
            .set({
              label: q.label,
              fieldType: type,
              required: q.required ?? false,
              options: opts as never,
              optionsJson: opts as never,
              visibilityRulesJson: visibility as never,
              requiredForCategoryIds: requiredFor as never,
              sortOrder: q.sortOrder ?? i,
              updatedAt: new Date(),
            })
            .where(eq(schema.conventionRegistrationQuestions.id, q.id))
        } else {
          await db.insert(schema.conventionRegistrationQuestions).values({
            formId: form.id,
            label: q.label,
            fieldType: type,
            required: q.required ?? false,
            options: opts as never,
            optionsJson: opts as never,
            visibilityRulesJson: visibility as never,
            requiredForCategoryIds: requiredFor as never,
            sortOrder: q.sortOrder ?? i,
          })
        }
      }
    }

    return buildFormResponse(conventionId)
  }

  for (const method of ['PUT', 'PATCH'] as const) {
    reg(method, '/api/v1/conventions/:key/registration-form', async (req, reply) => {
      if (!requireDb(reply)) return
      const actor = requireUser(req, reply)
      if (!actor) return
      const { key } = req.params as { key: string }
      const parsed = RegistrationFormBody.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      }
      const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
      if (!ctx) return
      return reply.send(await applyFormPatch(ctx.conv.id, parsed.data))
    })
  }

  /* ---------- Trusted roles ---------- */

  reg('GET', '/api/v1/conventions/:key/trusted-roles', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionTrustedRoles)
      .where(eq(schema.conventionTrustedRoles.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionTrustedRoles.sortOrder), asc(schema.conventionTrustedRoles.title))
    const questionsByRole = await loadTrustedRoleQuestions(rows.map((r) => r.id))
    return reply.send({
      needsMigration: false,
      roles: rows.map((r) => mapTrustedRole(r, questionsByRole.get(r.id) ?? [])),
    })
  })

  reg('POST', '/api/v1/conventions/:key/trusted-roles', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = TrustedRoleBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const data = parsed.data
    const name = data.name?.trim()
    if (!name) return reply.status(400).send({ error: 'Invalid body', details: 'name required' })
    const applySlug = trustedRoleApplySlug(data) ?? 'role'
    try {
      const [row] = await db
        .insert(schema.conventionTrustedRoles)
        .values({
          conventionId: ctx.conv.id,
          slug: applySlug,
          applySlug,
          title: name,
          description: data.description ?? null,
          status: data.status ?? 'draft',
          roleKind: data.roleKind ?? 'custom',
          introText: data.introText ?? '',
          confirmationText: data.confirmationText ?? '',
          questions: [],
          applyOpensAt: data.applyOpensAt ?? null,
          applyClosesAt: data.applyClosesAt ?? null,
          sortOrder: data.sortOrder ?? 0,
        })
        .returning()
      if (data.questions?.length) {
        await syncTrustedRoleQuestions(row!.id, data.questions)
      }
      const questions = await db
        .select()
        .from(schema.conventionTrustedRoleQuestions)
        .where(eq(schema.conventionTrustedRoleQuestions.roleId, row!.id))
        .orderBy(asc(schema.conventionTrustedRoleQuestions.sortOrder))
      return reply.status(201).send({
        role: mapTrustedRole(row!, questions.map(mapTrustedRoleQuestion)),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/unique|duplicate/i.test(msg)) {
        return reply.status(409).send({ error: 'Apply link slug already in use for this event.' })
      }
      throw e
    }
  })

  reg('PATCH', '/api/v1/conventions/:key/trusted-roles/:roleId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, roleId } = req.params as { key: string; roleId: string }
    if (!UUID_RE.test(roleId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = TrustedRoleBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const data = parsed.data
    const patch: Partial<typeof schema.conventionTrustedRoles.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (data.name !== undefined) patch.title = data.name.trim()
    if (data.description !== undefined) patch.description = data.description
    if (data.status !== undefined) patch.status = data.status
    if (data.roleKind !== undefined) patch.roleKind = data.roleKind
    if (data.introText !== undefined) patch.introText = data.introText
    if (data.confirmationText !== undefined) patch.confirmationText = data.confirmationText
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder
    if (data.applyOpensAt !== undefined) patch.applyOpensAt = data.applyOpensAt
    if (data.applyClosesAt !== undefined) patch.applyClosesAt = data.applyClosesAt
    const newSlug = trustedRoleApplySlug(data)
    if (newSlug) {
      patch.applySlug = newSlug
      patch.slug = newSlug
    }
    const [row] = await db
      .update(schema.conventionTrustedRoles)
      .set(patch)
      .where(
        and(
          eq(schema.conventionTrustedRoles.conventionId, ctx.conv.id),
          eq(schema.conventionTrustedRoles.id, roleId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (data.questions !== undefined) {
      await syncTrustedRoleQuestions(row.id, data.questions)
    }
    const questions = await db
      .select()
      .from(schema.conventionTrustedRoleQuestions)
      .where(eq(schema.conventionTrustedRoleQuestions.roleId, row.id))
      .orderBy(asc(schema.conventionTrustedRoleQuestions.sortOrder))
    return reply.send({
      role: mapTrustedRole(row, questions.map(mapTrustedRoleQuestion)),
    })
  })

  reg('DELETE', '/api/v1/conventions/:key/trusted-roles/:roleId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, roleId } = req.params as { key: string; roleId: string }
    if (!UUID_RE.test(roleId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionTrustedRoles)
      .where(
        and(
          eq(schema.conventionTrustedRoles.conventionId, ctx.conv.id),
          eq(schema.conventionTrustedRoles.id, roleId),
        ),
      )
      .returning({ id: schema.conventionTrustedRoles.id })
    if (!del.length) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  /* ---------- Audit log helper for the application queue ---------- */

  reg('GET', '/api/v1/conventions/:key/trusted-roles/:roleId/applications', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, roleId } = req.params as { key: string; roleId: string }
    if (!UUID_RE.test(roleId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'registration')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionVettingApplications)
      .where(
        and(
          eq(schema.conventionVettingApplications.conventionId, ctx.conv.id),
          eq(schema.conventionVettingApplications.trustedRoleId, roleId),
        ),
      )
      .orderBy(desc(schema.conventionVettingApplications.createdAt))
    return reply.send({ applications: rows })
  })
}
