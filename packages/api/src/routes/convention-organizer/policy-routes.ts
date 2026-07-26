import { and, asc, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { POLICY_KIND_VALUES } from '../../lib/convention-organizer/registration.js'
import { sanitizeFeedHtml } from '../../lib/sanitize-feed-body.js'
import {
  escapeCsvCell,
  iso,
  requireDb,
  requireOrganizer,
  requireUser,
  UUID_RE,
  type RouteRegistrar,
} from './shared.js'

function sanitizePolicyBodyHtml(html: string | null | undefined): string | null {
  if (html == null) return null
  const cleaned = sanitizeFeedHtml(html).slice(0, 200_000)
  return cleaned.length > 0 ? cleaned : null
}

const PolicyDocumentBody = z.object({
  title: z.string().min(1).max(255).optional(),
  kind: z.enum(POLICY_KIND_VALUES).optional(),
  version: z.number().int().min(1).optional(),
  bodyHtml: z.string().max(200000).nullable().optional(),
  bodyMarkdown: z.string().max(200000).nullable().optional(),
  publishedAt: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v == null || v === '' ? null : new Date(v))),
  sortOrder: z.number().int().optional(),
  requiredForRegistration: z.boolean().optional(),
})

function mapPolicy(d: typeof schema.conventionPolicyDocuments.$inferSelect) {
  return {
    id: d.id,
    title: d.title,
    kind: d.kind,
    version: d.version,
    bodyHtml: d.bodyHtml,
    bodyMarkdown: d.bodyMarkdown,
    publishedAt: d.publishedAt ? d.publishedAt.toISOString() : null,
    sortOrder: d.sortOrder,
    requiredForRegistration: d.requiredForRegistration,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  }
}

export function registerPolicyRoutes(reg: RouteRegistrar) {
  reg('GET', '/api/v1/conventions/:key/policy-documents', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select()
      .from(schema.conventionPolicyDocuments)
      .where(eq(schema.conventionPolicyDocuments.conventionId, ctx.conv.id))
      .orderBy(asc(schema.conventionPolicyDocuments.sortOrder))
    return reply.send({ documents: rows.map(mapPolicy) })
  })

  reg('POST', '/api/v1/conventions/:key/policy-documents', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const parsed = PolicyDocumentBody.extend({ title: z.string().min(1).max(255) }).safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const [row] = await db
      .insert(schema.conventionPolicyDocuments)
      .values({
        conventionId: ctx.conv.id,
        title: data.title!.trim(),
        kind: data.kind ?? 'other',
        version: data.version ?? 1,
        bodyHtml: sanitizePolicyBodyHtml(data.bodyHtml),
        bodyMarkdown: data.bodyMarkdown ?? null,
        publishedAt: data.publishedAt ?? null,
        sortOrder: data.sortOrder ?? 0,
        requiredForRegistration: data.requiredForRegistration ?? false,
      })
      .returning()
    return reply.status(201).send({ document: mapPolicy(row!) })
  })

  reg('PATCH', '/api/v1/conventions/:key/policy-documents/:docId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, docId } = req.params as { key: string; docId: string }
    if (!UUID_RE.test(docId)) return reply.status(400).send({ error: 'Invalid id' })
    const parsed = PolicyDocumentBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const data = parsed.data
    const patch: Partial<typeof schema.conventionPolicyDocuments.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (data.title !== undefined) patch.title = data.title.trim()
    if (data.kind !== undefined) patch.kind = data.kind
    if (data.version !== undefined) patch.version = data.version
    if (data.bodyHtml !== undefined) patch.bodyHtml = sanitizePolicyBodyHtml(data.bodyHtml)
    if (data.bodyMarkdown !== undefined) patch.bodyMarkdown = data.bodyMarkdown
    if (data.publishedAt !== undefined) patch.publishedAt = data.publishedAt
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder
    if (data.requiredForRegistration !== undefined) {
      patch.requiredForRegistration = data.requiredForRegistration
    }
    const [row] = await db
      .update(schema.conventionPolicyDocuments)
      .set(patch)
      .where(
        and(
          eq(schema.conventionPolicyDocuments.conventionId, ctx.conv.id),
          eq(schema.conventionPolicyDocuments.id, docId),
        ),
      )
      .returning()
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ document: mapPolicy(row) })
  })

  reg('DELETE', '/api/v1/conventions/:key/policy-documents/:docId', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key, docId } = req.params as { key: string; docId: string }
    if (!UUID_RE.test(docId)) return reply.status(400).send({ error: 'Invalid id' })
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const del = await db
      .delete(schema.conventionPolicyDocuments)
      .where(
        and(
          eq(schema.conventionPolicyDocuments.conventionId, ctx.conv.id),
          eq(schema.conventionPolicyDocuments.id, docId),
        ),
      )
      .returning({ id: schema.conventionPolicyDocuments.id })
    if (!del.length) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ok: true })
  })

  reg('GET', '/api/v1/conventions/:key/policy-acceptances/stats', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const [totalRegs] = await db
      .select({ n: count() })
      .from(schema.conventionRegistrants)
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))
    const [accepted] = await db
      .select({ n: count() })
      .from(schema.conventionRegistrantPolicyAcceptances)
      .innerJoin(
        schema.conventionRegistrants,
        eq(schema.conventionRegistrants.id, schema.conventionRegistrantPolicyAcceptances.registrantId),
      )
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))
    const docs = await db
      .select({ id: schema.conventionPolicyDocuments.id, title: schema.conventionPolicyDocuments.title })
      .from(schema.conventionPolicyDocuments)
      .where(eq(schema.conventionPolicyDocuments.conventionId, ctx.conv.id))
    return reply.send({
      registrantCount: Number(totalRegs?.n ?? 0),
      acceptanceCount: Number(accepted?.n ?? 0),
      documents: docs,
    })
  })

  reg('GET', '/api/v1/conventions/:key/policy-acceptances/export', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { key } = req.params as { key: string }
    const format = (req.query as { format?: string }).format ?? 'csv'
    const ctx = await requireOrganizer(key, actor.userId, reply, 'admin')
    if (!ctx) return
    const rows = await db
      .select({
        registrantName: schema.conventionRegistrants.displayName,
        docTitle: schema.conventionPolicyDocuments.title,
        docKind: schema.conventionPolicyDocuments.kind,
        docVersion: schema.conventionPolicyDocuments.version,
        acceptedAt: schema.conventionRegistrantPolicyAcceptances.acceptedAt,
        signerName: schema.conventionRegistrantPolicyAcceptances.signerName,
        signerEmail: schema.conventionRegistrantPolicyAcceptances.signerEmail,
        signatureMethod: schema.conventionRegistrantPolicyAcceptances.signatureMethod,
      })
      .from(schema.conventionRegistrantPolicyAcceptances)
      .innerJoin(
        schema.conventionRegistrants,
        eq(schema.conventionRegistrants.id, schema.conventionRegistrantPolicyAcceptances.registrantId),
      )
      .innerJoin(
        schema.conventionPolicyDocuments,
        eq(schema.conventionPolicyDocuments.id, schema.conventionRegistrantPolicyAcceptances.policyId),
      )
      .where(eq(schema.conventionRegistrants.conventionId, ctx.conv.id))
    if (format === 'json') {
      return reply.send({ acceptances: rows })
    }
    const lines = [
      'Registrant,Policy,Kind,Version,Accepted at,Signer name,Signer email,Method',
      ...rows.map((r) =>
        [
          escapeCsvCell(r.registrantName),
          escapeCsvCell(r.docTitle),
          escapeCsvCell(r.docKind),
          escapeCsvCell(r.docVersion),
          escapeCsvCell(iso(r.acceptedAt)),
          escapeCsvCell(r.signerName),
          escapeCsvCell(r.signerEmail),
          escapeCsvCell(r.signatureMethod),
        ].join(','),
      ),
    ]
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="policy-acceptances-${ctx.conv.slug}.csv"`)
      .send(lines.join('\n'))
  })
}
