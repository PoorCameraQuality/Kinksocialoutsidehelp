import type { FastifyInstance, FastifyReply } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { CURRENT_POLICY_VERSION } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import {
  isLegalOrSiteAdmin,
  isTrustSafetyAdmin,
  recordPrivilegedStepUp,
  requiresPrivilegedStepUp,
  verifyUserPassword,
} from '../lib/legal-admin-auth.js'
import { isUnderLegalHold } from '../lib/legal-hold.js'
import { recordModerationAudit } from '../lib/moderation-audit.js'
import { requireDb, requireUser } from '../lib/moderation-route-auth.js'
import { isSiteAdmin, isSiteOwner } from '../lib/platform-staff.js'
import { getEmailFromUserRow, userEmailSelect } from '../lib/user-email.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'
import { mailboxForContactCategory, sendContactFormOutboundEmail } from '../lib/outbound-form-mail.js'
import { softDeleteUserAccount } from '../lib/deleted-account-sweep.js'

const STEP_UP_ERROR = { error: 'step_up_required', code: 'step_up_required' }

async function requireStepUp(userId: string, reply: FastifyReply): Promise<boolean> {
  if (await requiresPrivilegedStepUp(userId)) {
    reply.status(403).send(STEP_UP_ERROR)
    return false
  }
  return true
}

async function requireTrustSafetyOrSiteAdmin(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isTrustSafetyAdmin(userId))) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

async function requireLegalOrSiteAdmin(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isLegalOrSiteAdmin(userId))) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

const dmcaIntakeBody = z.object({
  claimantName: z.string().min(1).max(255),
  claimantEmail: z.string().email().max(320),
  workIdentified: z.string().min(1).max(8000),
  infringingUrl: z.string().min(1).max(2000),
  targetContentType: z.string().max(64).optional(),
  targetContentId: z.string().uuid().optional(),
})

const reasonBody = z.object({
  reason: z.string().min(1).max(8000),
})

const patchDmcaBody = z.object({
  status: z
    .enum(['RECEIVED', 'DISABLED', 'COUNTER_NOTICE_RECEIVED', 'RESTORED', 'REJECTED', 'CLOSED'])
    .optional(),
  notesPrivate: z.string().max(8000).optional(),
  repeatInfringerFlag: z.boolean().optional(),
  reason: z.string().min(1).max(8000),
})

const createLegalRequestBody = z.object({
  requestType: z.string().min(1).max(64),
  subjectUserId: z.string().uuid().optional(),
  receivedVia: z.string().max(64).optional(),
  requesterName: z.string().max(255).optional(),
  requesterAgency: z.string().max(255).optional(),
  jurisdiction: z.string().max(128).optional(),
  scopeSummary: z.string().max(8000).optional(),
  gagOrder: z.boolean().optional(),
  userNoticeAllowed: z.boolean().optional(),
  notes: z.string().max(8000).optional(),
  notesPrivate: z.string().max(8000).optional(),
  dueAt: z.string().datetime().optional(),
  reason: z.string().min(1).max(8000),
})

const patchLegalRequestBody = z.object({
  status: z.enum(['RECEIVED', 'IN_REVIEW', 'FULFILLED', 'REJECTED', 'CLOSED']).optional(),
  notes: z.string().max(8000).optional(),
  notesPrivate: z.string().max(8000).optional(),
  scopeSummary: z.string().max(8000).optional(),
  reason: z.string().min(1).max(8000),
})

const createHoldBody = z.object({
  targetType: z.string().min(1).max(32),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(8000),
})

const releaseHoldBody = z.object({
  reason: z.string().min(1).max(8000),
})

const privacyRequestBody = z.object({
  requestType: z.enum(['EXPORT_JSON', 'DEACTIVATE', 'DELETE']),
  reason: z.string().max(8000).optional(),
})

const stepUpBody = z.object({
  password: z.string().min(1),
})

const CONTACT_CATEGORIES = [
  'general',
  'privacy',
  'legal',
  'law_enforcement',
  'accessibility',
  'appeal',
  'dmca',
  'partnership',
] as const

const contactIntakeBody = z.object({
  category: z.enum(CONTACT_CATEGORIES),
  subject: z.string().min(1).max(255),
  senderName: z.string().min(1).max(255),
  senderEmail: z.string().email().max(320),
  message: z.string().min(1).max(8000),
})

const patchContactInquiryBody = z.object({
  status: z.enum(['RECEIVED', 'IN_REVIEW', 'REPLIED', 'CLOSED']).optional(),
  notesPrivate: z.string().max(8000).optional(),
  reason: z.string().min(1).max(8000),
})

/** Optional authenticated DB user — never returns a non-UUID mock `sub`. */
function optionalUserId(req: { headers: Record<string, unknown> }): string | null {
  const v = resolveViewerFromRequest(req as Parameters<typeof resolveViewerFromRequest>[0])
  if (!v.authenticated || !v.payload?.sub) return null
  return getViewerUserId(v.payload)
}

async function requireContactInboxAdmin(userId: string, reply: FastifyReply): Promise<boolean> {
  if (!(await isTrustSafetyAdmin(userId)) && !(await isLegalOrSiteAdmin(userId))) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

async function applyDmcaContentAction(
  targetContentType: string | null | undefined,
  targetContentId: string | null | undefined,
  action: 'disable' | 'restore',
  actorUserId: string
): Promise<void> {
  if (!targetContentType || !targetContentId) return
  const now = new Date()
  const type = targetContentType.toLowerCase()

  if (type === 'media' || type === 'media_asset') {
    await db
      .update(schema.mediaAssets)
      .set(
        action === 'disable'
          ? { removedAt: now, removedByUserId: actorUserId, updatedAt: now }
          : { removedAt: null, removedByUserId: null, updatedAt: now }
      )
      .where(eq(schema.mediaAssets.id, targetContentId))
    return
  }

  if (type === 'forum_post') {
    await db
      .update(schema.forumPosts)
      .set(
        action === 'disable'
          ? { hiddenAt: now, hiddenByUserId: actorUserId }
          : { hiddenAt: null, hiddenByUserId: null }
      )
      .where(eq(schema.forumPosts.id, targetContentId))
  }
}

async function buildUserExportPayload(userId: string): Promise<Record<string, unknown>> {
  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      ...userEmailSelect,
      createdAt: schema.users.createdAt,
      ageAffirmedAt: schema.users.ageAffirmedAt,
      termsAcceptedAt: schema.users.termsAcceptedAt,
      policyVersionAccepted: schema.users.policyVersionAccepted,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1)

  const userExport = user
    ? {
        id: user.id,
        username: user.username,
        email: getEmailFromUserRow(user),
        createdAt: user.createdAt,
        ageAffirmedAt: user.ageAffirmedAt,
        termsAcceptedAt: user.termsAcceptedAt,
        policyVersionAccepted: user.policyVersionAccepted,
      }
    : null

  return {
    version: 'v1',
    exportedAt: new Date().toISOString(),
    user: userExport,
    profile: profile ?? null,
  }
}

export async function registerLegalAlphaRoutes(app: FastifyInstance) {
  app.get('/api/v1/legal/policy-version', async (_req, reply) => {
    return reply.send({ version: CURRENT_POLICY_VERSION })
  })

  app.post('/api/v1/dmca/intake', async (req, reply) => {
    if (!requireDb(reply)) return
    const parsed = dmcaIntakeBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const body = parsed.data
    const [row] = await db
      .insert(schema.dmcaCases)
      .values({
        claimantName: body.claimantName,
        claimantEmail: body.claimantEmail,
        workIdentified: body.workIdentified,
        infringingUrl: body.infringingUrl,
        targetContentType: body.targetContentType ?? null,
        targetContentId: body.targetContentId ?? null,
        status: 'RECEIVED',
      })
      .returning()
    return reply.status(201).send({ case: row })
  })

  app.post('/api/v1/contact/intake', { ...rateLimitRoute('reports') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const parsed = contactIntakeBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const body = parsed.data
    const userId = optionalUserId(req)
    const [row] = await db
      .insert(schema.contactInquiries)
      .values({
        category: body.category,
        subject: body.subject,
        senderName: body.senderName,
        senderEmail: body.senderEmail,
        message: body.message,
        userId,
        status: 'RECEIVED',
      })
      .returning()

    const mailboxKey = mailboxForContactCategory(body.category)
    void sendContactFormOutboundEmail({
      mailboxKey,
      subject: body.subject,
      senderName: body.senderName,
      senderEmail: body.senderEmail,
      message: body.message,
      category: body.category,
    }).then((sent) => {
      if (!sent.ok) {
        req.log.warn({ err: sent.error, inquiryId: row.id }, 'contact form outbound email failed')
      }
    })

    return reply.status(201).send({ inquiry: row })
  })

  app.get('/api/v1/admin/contact/inquiries', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireContactInboxAdmin(user.userId, reply))) return

    const q = req.query as { status?: string; category?: string; limit?: string; offset?: string }
    const limit = Math.min(Number(q.limit) || 50, 100)
    const offset = Number(q.offset) || 0
    const conditions = []
    if (q.status) {
      conditions.push(eq(schema.contactInquiries.status, q.status as typeof schema.contactInquiries.$inferSelect.status))
    }
    if (q.category) {
      conditions.push(eq(schema.contactInquiries.category, q.category))
    }
    const rows = await db
      .select()
      .from(schema.contactInquiries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.contactInquiries.receivedAt))
      .limit(limit)
      .offset(offset)
    return reply.send({ inquiries: rows })
  })

  app.get('/api/v1/admin/contact/inquiries/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireContactInboxAdmin(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const [row] = await db.select().from(schema.contactInquiries).where(eq(schema.contactInquiries.id, id)).limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ inquiry: row })
  })

  app.patch('/api/v1/admin/contact/inquiries/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireContactInboxAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = patchContactInquiryBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const body = parsed.data

    const [existing] = await db.select().from(schema.contactInquiries).where(eq(schema.contactInquiries.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const [row] = await db
      .update(schema.contactInquiries)
      .set({
        status: body.status ?? existing.status,
        notesPrivate: body.notesPrivate ?? existing.notesPrivate,
        updatedAt: new Date(),
      })
      .where(eq(schema.contactInquiries.id, id))
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'contact_inquiry_update',
      targetType: 'contact_inquiry',
      targetId: id,
      payload: { reason: body.reason, status: body.status },
    })
    return reply.send({ inquiry: row })
  })

  app.get('/api/v1/admin/dmca/cases', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyOrSiteAdmin(user.userId, reply))) return

    const q = req.query as { status?: string; limit?: string; offset?: string }
    const limit = Math.min(Number(q.limit) || 50, 100)
    const offset = Number(q.offset) || 0
    const rows = await db
      .select()
      .from(schema.dmcaCases)
      .where(q.status ? eq(schema.dmcaCases.status, q.status as typeof schema.dmcaCases.$inferSelect.status) : undefined)
      .orderBy(desc(schema.dmcaCases.receivedAt))
      .limit(limit)
      .offset(offset)
    return reply.send({ cases: rows })
  })

  app.get('/api/v1/admin/dmca/cases/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyOrSiteAdmin(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const [row] = await db.select().from(schema.dmcaCases).where(eq(schema.dmcaCases.id, id)).limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ case: row })
  })

  app.post('/api/v1/admin/dmca/cases', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const parsed = dmcaIntakeBody.extend({ reason: z.string().min(1).max(8000) }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const body = parsed.data

    const [row] = await db
      .insert(schema.dmcaCases)
      .values({
        claimantName: body.claimantName,
        claimantEmail: body.claimantEmail,
        workIdentified: body.workIdentified,
        infringingUrl: body.infringingUrl,
        targetContentType: body.targetContentType ?? null,
        targetContentId: body.targetContentId ?? null,
        createdByAdminId: user.userId,
        status: 'RECEIVED',
      })
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'dmca_case_create',
      targetType: 'dmca_case',
      targetId: row!.id,
      payload: { reason: body.reason },
    })
    return reply.status(201).send({ case: row })
  })

  app.patch('/api/v1/admin/dmca/cases/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = patchDmcaBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const body = parsed.data

    const [existing] = await db.select().from(schema.dmcaCases).where(eq(schema.dmcaCases.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const now = new Date()
    const nextStatus = body.status ?? existing.status
    const [row] = await db
      .update(schema.dmcaCases)
      .set({
        status: nextStatus,
        notesPrivate: body.notesPrivate ?? existing.notesPrivate,
        repeatInfringerFlag: body.repeatInfringerFlag ?? existing.repeatInfringerFlag,
        resolvedAt: ['RESTORED', 'REJECTED', 'CLOSED'].includes(nextStatus) ? now : existing.resolvedAt,
        updatedAt: now,
      })
      .where(eq(schema.dmcaCases.id, id))
      .returning()

    if (nextStatus === 'DISABLED') {
      await applyDmcaContentAction(existing.targetContentType, existing.targetContentId, 'disable', user.userId)
    } else if (nextStatus === 'RESTORED') {
      await applyDmcaContentAction(existing.targetContentType, existing.targetContentId, 'restore', user.userId)
    }

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'dmca_case_update',
      targetType: 'dmca_case',
      targetId: id,
      payload: { reason: body.reason, status: nextStatus },
    })
    return reply.send({ case: row })
  })

  app.post('/api/v1/admin/dmca/cases/:id/disable', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = reasonBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const [existing] = await db.select().from(schema.dmcaCases).where(eq(schema.dmcaCases.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const now = new Date()
    const [row] = await db
      .update(schema.dmcaCases)
      .set({ status: 'DISABLED', updatedAt: now })
      .where(eq(schema.dmcaCases.id, id))
      .returning()

    await applyDmcaContentAction(existing.targetContentType, existing.targetContentId, 'disable', user.userId)
    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'dmca_content_disable',
      targetType: 'dmca_case',
      targetId: id,
      payload: {
        reason: parsed.data.reason,
        targetContentType: existing.targetContentType,
        targetContentId: existing.targetContentId,
      },
    })
    return reply.send({ case: row })
  })

  app.post('/api/v1/admin/dmca/cases/:id/restore', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireTrustSafetyOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = reasonBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const [existing] = await db.select().from(schema.dmcaCases).where(eq(schema.dmcaCases.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const now = new Date()
    const [row] = await db
      .update(schema.dmcaCases)
      .set({ status: 'RESTORED', resolvedAt: now, updatedAt: now })
      .where(eq(schema.dmcaCases.id, id))
      .returning()

    await applyDmcaContentAction(existing.targetContentType, existing.targetContentId, 'restore', user.userId)
    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'dmca_content_restore',
      targetType: 'dmca_case',
      targetId: id,
      payload: {
        reason: parsed.data.reason,
        targetContentType: existing.targetContentType,
        targetContentId: existing.targetContentId,
      },
    })
    return reply.send({ case: row })
  })

  app.get('/api/v1/admin/legal/requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireLegalOrSiteAdmin(user.userId, reply))) return

    const q = req.query as { status?: string; limit?: string; offset?: string }
    const limit = Math.min(Number(q.limit) || 50, 100)
    const offset = Number(q.offset) || 0
    const rows = await db
      .select()
      .from(schema.legalRequests)
      .where(
        q.status
          ? eq(schema.legalRequests.status, q.status as typeof schema.legalRequests.$inferSelect.status)
          : undefined
      )
      .orderBy(desc(schema.legalRequests.receivedAt))
      .limit(limit)
      .offset(offset)
    return reply.send({ requests: rows })
  })

  app.get('/api/v1/admin/legal/requests/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireLegalOrSiteAdmin(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const [row] = await db.select().from(schema.legalRequests).where(eq(schema.legalRequests.id, id)).limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })

    const holds = await db
      .select()
      .from(schema.legalHolds)
      .where(eq(schema.legalHolds.legalRequestId, id))
    return reply.send({ request: row, holds })
  })

  app.post('/api/v1/admin/legal/requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireLegalOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const parsed = createLegalRequestBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const body = parsed.data

    const [row] = await db
      .insert(schema.legalRequests)
      .values({
        requestType: body.requestType,
        subjectUserId: body.subjectUserId ?? null,
        receivedVia: body.receivedVia ?? null,
        requesterName: body.requesterName ?? null,
        requesterAgency: body.requesterAgency ?? null,
        jurisdiction: body.jurisdiction ?? null,
        scopeSummary: body.scopeSummary ?? null,
        gagOrder: body.gagOrder ?? false,
        userNoticeAllowed: body.userNoticeAllowed ?? true,
        notes: body.notes ?? null,
        notesPrivate: body.notesPrivate ?? null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        createdByUserId: user.userId,
      })
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'legal_request_create',
      targetType: 'legal_request',
      targetId: row!.id,
      payload: { reason: body.reason },
    })
    return reply.status(201).send({ request: row })
  })

  app.patch('/api/v1/admin/legal/requests/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireLegalOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = patchLegalRequestBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const body = parsed.data

    const [existing] = await db.select().from(schema.legalRequests).where(eq(schema.legalRequests.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const [row] = await db
      .update(schema.legalRequests)
      .set({
        status: body.status ?? existing.status,
        notes: body.notes ?? existing.notes,
        notesPrivate: body.notesPrivate ?? existing.notesPrivate,
        scopeSummary: body.scopeSummary ?? existing.scopeSummary,
        updatedAt: new Date(),
      })
      .where(eq(schema.legalRequests.id, id))
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'legal_request_update',
      targetType: 'legal_request',
      targetId: id,
      payload: { reason: body.reason, status: body.status },
    })
    return reply.send({ request: row })
  })

  app.post('/api/v1/admin/legal/requests/:id/holds', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireLegalOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = createHoldBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const [legalReq] = await db.select().from(schema.legalRequests).where(eq(schema.legalRequests.id, id)).limit(1)
    if (!legalReq) return reply.status(404).send({ error: 'Legal request not found' })

    const [hold] = await db
      .insert(schema.legalHolds)
      .values({
        legalRequestId: id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reason: parsed.data.reason,
        createdByAdminId: user.userId,
        active: true,
      })
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'legal_hold_create',
      targetType: 'legal_hold',
      targetId: hold!.id,
      payload: { reason: parsed.data.reason, legalRequestId: id },
    })
    return reply.status(201).send({ hold })
  })

  app.post('/api/v1/admin/legal/holds/:id/release', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    if (!(await requireLegalOrSiteAdmin(user.userId, reply))) return
    if (!(await requireStepUp(user.userId, reply))) return

    const { id } = req.params as { id: string }
    const parsed = releaseHoldBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const [existing] = await db.select().from(schema.legalHolds).where(eq(schema.legalHolds.id, id)).limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const now = new Date()
    const [hold] = await db
      .update(schema.legalHolds)
      .set({ active: false, releasedAt: now })
      .where(eq(schema.legalHolds.id, id))
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'legal_hold_release',
      targetType: 'legal_hold',
      targetId: id,
      payload: { reason: parsed.data.reason },
    })
    return reply.send({ hold })
  })

  app.post('/api/v1/admin/security/step-up', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    // PR 3 (Z2): site owner included — owner PII/DM routes now require step-up.
    const owner = await isSiteOwner(user.userId)
    const siteAdmin = await isSiteAdmin(user.userId)
    const tsAdmin = await isTrustSafetyAdmin(user.userId)
    const legalAdmin = await isLegalOrSiteAdmin(user.userId)
    if (!owner && !siteAdmin && !tsAdmin && !legalAdmin) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const parsed = stepUpBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    try {
      const ok = await verifyUserPassword(user.userId, parsed.data.password)
      if (!ok) return reply.status(401).send({ error: 'Invalid password' })

      await recordPrivilegedStepUp(user.userId)
      await recordModerationAudit({
        actorUserId: user.userId,
        scopeType: 'platform',
        verb: 'admin_step_up',
        targetType: 'user',
        targetId: user.userId,
        payload: {},
      })
      return reply.send({ ok: true })
    } catch (err) {
      req.log.error({ err }, 'admin step-up failed')
      return reply.status(500).send({ error: 'Step-up failed. Try again or check server logs.' })
    }
  })

  app.get('/api/v1/me/privacy/requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const rows = await db
      .select({
        id: schema.userPrivacyRequests.id,
        requestType: schema.userPrivacyRequests.requestType,
        status: schema.userPrivacyRequests.status,
        requestedAt: schema.userPrivacyRequests.requestedAt,
        completedAt: schema.userPrivacyRequests.completedAt,
        createdAt: schema.userPrivacyRequests.createdAt,
        updatedAt: schema.userPrivacyRequests.updatedAt,
      })
      .from(schema.userPrivacyRequests)
      .where(eq(schema.userPrivacyRequests.userId, user.userId))
      .orderBy(desc(schema.userPrivacyRequests.requestedAt))
    return reply.send({ requests: rows })
  })

  app.post('/api/v1/me/privacy/requests', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const parsed = privacyRequestBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const body = parsed.data

    if (body.requestType === 'DELETE' && (await isUnderLegalHold('user', user.userId))) {
      const [blocked] = await db
        .insert(schema.userPrivacyRequests)
        .values({
          userId: user.userId,
          requestType: 'DELETE',
          status: 'BLOCKED_LEGAL_HOLD',
          reason: body.reason ?? null,
          completedAt: new Date(),
        })
        .returning()
      await recordModerationAudit({
        actorUserId: user.userId,
        scopeType: 'platform',
        verb: 'privacy_request_blocked_legal_hold',
        targetType: 'user_privacy_request',
        targetId: blocked!.id,
        payload: { requestType: 'DELETE' },
      })
      return reply.status(409).send({ error: 'Deletion blocked by active legal hold', request: blocked })
    }

    const now = new Date()
    let status: typeof schema.userPrivacyRequests.$inferInsert.status = 'PENDING'
    let exportPayload: Record<string, unknown> | null = null
    let completedAt: Date | null = null

    if (body.requestType === 'EXPORT_JSON') {
      exportPayload = await buildUserExportPayload(user.userId)
      status = 'READY'
      completedAt = now
    } else if (body.requestType === 'DEACTIVATE') {
      status = 'PROCESSING'
    } else if (body.requestType === 'DELETE') {
      status = 'PROCESSING'
    }

    const [row] = await db
      .insert(schema.userPrivacyRequests)
      .values({
        userId: user.userId,
        requestType: body.requestType,
        status,
        exportPayload,
        reason: body.reason ?? null,
        completedAt,
      })
      .returning()

    await recordModerationAudit({
      actorUserId: user.userId,
      scopeType: 'platform',
      verb: 'privacy_request_create',
      targetType: 'user_privacy_request',
      targetId: row!.id,
      payload: { requestType: body.requestType },
    })

    if (body.requestType === 'DELETE') {
      await softDeleteUserAccount(user.userId)
    }

    return reply.status(201).send({ request: row })
  })

  app.get('/api/v1/me/privacy/export/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const { id } = req.params as { id: string }
    const [row] = await db
      .select()
      .from(schema.userPrivacyRequests)
      .where(
        and(
          eq(schema.userPrivacyRequests.id, id),
          eq(schema.userPrivacyRequests.userId, user.userId),
          eq(schema.userPrivacyRequests.requestType, 'EXPORT_JSON')
        )
      )
      .limit(1)

    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (row.status !== 'READY') {
      return reply.status(409).send({ error: 'Export not ready', status: row.status })
    }
    return reply.send({ export: row.exportPayload ?? {}, requestId: row.id })
  })
}

export { applyDmcaContentAction, buildUserExportPayload }
