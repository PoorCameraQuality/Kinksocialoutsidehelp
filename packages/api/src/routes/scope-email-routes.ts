import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, desc, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { isSiteOwner } from '../lib/platform-staff.js'
import {
  canManageGroupEmailList,
  canManageOrgEmailList,
  listScopeSubscribers,
  orgEmailListEnabled,
  sendScopeEmailBroadcast,
  subscribeScopeEmail,
  unsubscribeScopeEmail,
  countScopeSubscribers,
  confirmScopeEmailSubscription,
  scopeEmailDoubleOptInEnabled,
} from '../lib/scope-email-list.js'
import { canViewGroup } from '../lib/group-access.js'
import { rateLimitRoute } from '../lib/rate-limit-config.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

const subscribeBody = z.object({
  email: z.string().email().max(320),
  displayName: z.string().max(255).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'consent must be true' }) }),
})

const broadcastBody = z.object({
  subject: z.string().min(1).max(500),
  text: z.string().min(1).max(50_000),
  html: z.string().max(100_000).optional(),
})

export async function registerScopeEmailRoutes(app: FastifyInstance) {
  app.post('/api/v1/organizations/:orgSlug/email-subscribe', { ...rateLimitRoute('scopeEmailSubscribe') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgSlug } = req.params as { orgSlug: string }
    const parsed = subscribeBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, orgSlug))
      .limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (org.visibility !== 'PUBLIC') return reply.status(403).send({ error: 'Organization is not public' })
    if (!orgEmailListEnabled(org.community)) {
      return reply.status(403).send({ error: 'Email signup is not enabled for this organization' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    const result = await subscribeScopeEmail({
      scopeType: 'organization',
      scopeId: org.id,
      scopeName: org.displayName,
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      userId,
    })
    if (!result.ok) return reply.status(400).send({ error: result.error })
    return reply
      .status(result.created ? 201 : 200)
      .send({ ok: true, created: result.created, pending: result.pending ?? false })
  })

  app.post('/api/v1/organizations/:orgSlug/email-unsubscribe', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgSlug } = req.params as { orgSlug: string }
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, orgSlug))
      .limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    const ok = await unsubscribeScopeEmail({
      scopeType: 'organization',
      scopeId: org.id,
      email: parsed.data.email,
      scopeName: org.displayName,
    })
    return reply.send({ ok })
  })

  app.get('/api/v1/organizations/:orgSlug/email-subscribers', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { orgSlug } = req.params as { orgSlug: string }
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, orgSlug))
      .limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canManageOrgEmailList(org.id, actor.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const items = await listScopeSubscribers('organization', org.id)
    return reply.send({ count: items.length, items })
  })

  app.post('/api/v1/organizations/:orgSlug/email-broadcast', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { orgSlug } = req.params as { orgSlug: string }
    const parsed = broadcastBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, orgSlug))
      .limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    if (!(await canManageOrgEmailList(org.id, actor.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const stats = await sendScopeEmailBroadcast({
      scopeType: 'organization',
      scopeId: org.id,
      scopePublicKey: org.slug,
      scopeName: org.displayName,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: parsed.data.html,
      sentByUserId: actor.userId,
    })
    return reply.send(stats)
  })

  app.post('/api/v1/groups/:groupId/email-subscribe', { ...rateLimitRoute('scopeEmailSubscribe') }, async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupId } = req.params as { groupId: string }
    const parsed = subscribeBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Not found' })
    if (!g.emailSignupEnabled) return reply.status(403).send({ error: 'Email signup is not enabled for this group' })
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (g.visibility !== 'public' && !(await canViewGroup(g, userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const result = await subscribeScopeEmail({
      scopeType: 'group',
      scopeId: g.id,
      scopeName: g.name,
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      userId,
    })
    if (!result.ok) return reply.status(400).send({ error: result.error })
    return reply
      .status(result.created ? 201 : 200)
      .send({ ok: true, created: result.created, pending: result.pending ?? false })
  })

  app.post('/api/v1/groups/:groupId/email-unsubscribe', async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupId } = req.params as { groupId: string }
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    await unsubscribeScopeEmail({ scopeType: 'group', scopeId: g.id, email: parsed.data.email, scopeName: g.name })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/groups/:groupId/email-subscribers', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { groupId } = req.params as { groupId: string }
    if (!(await canManageGroupEmailList(groupId, actor.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const items = await listScopeSubscribers('group', groupId)
    return reply.send({ count: items.length, items })
  })

  app.post('/api/v1/groups/:groupId/email-broadcast', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    const { groupId } = req.params as { groupId: string }
    const parsed = broadcastBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    if (!(await canManageGroupEmailList(groupId, actor.userId))) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    const stats = await sendScopeEmailBroadcast({
      scopeType: 'group',
      scopeId: g.id,
      scopePublicKey: g.id,
      scopeName: g.name,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: parsed.data.html,
      sentByUserId: actor.userId,
    })
    return reply.send(stats)
  })

  app.get('/api/v1/organizations/:orgSlug/email-list-meta', async (req, reply) => {
    if (!requireDb(reply)) return
    const { orgSlug } = req.params as { orgSlug: string }
    const [org] = await db
      .select({
        id: schema.organizations.id,
        displayName: schema.organizations.displayName,
        community: schema.organizations.community,
        visibility: schema.organizations.visibility,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, orgSlug))
      .limit(1)
    if (!org) return reply.status(404).send({ error: 'Not found' })
    const community = org.community as Record<string, unknown> | null
    const enabled = orgEmailListEnabled(org.community)
    const doubleOptIn = scopeEmailDoubleOptInEnabled()
    const count = enabled ? await countScopeSubscribers('organization', org.id) : 0
    const pendingCount =
      enabled && doubleOptIn ? await countScopeSubscribers('organization', org.id, 'pending') : 0
    return reply.send({
      enabled,
      doubleOptIn,
      subscriberCount: count,
      pendingCount,
      headline: typeof community?.emailListHeadline === 'string' ? community.emailListHeadline : null,
      blurb: typeof community?.emailListBlurb === 'string' ? community.emailListBlurb : null,
    })
  })

  app.get('/api/v1/groups/:groupId/email-list-meta', async (req, reply) => {
    if (!requireDb(reply)) return
    const { groupId } = req.params as { groupId: string }
    const [g] = await db
      .select({
        id: schema.groups.id,
        name: schema.groups.name,
        emailSignupEnabled: schema.groups.emailSignupEnabled,
      })
      .from(schema.groups)
      .where(eq(schema.groups.id, groupId))
      .limit(1)
    if (!g) return reply.status(404).send({ error: 'Not found' })
    const doubleOptIn = scopeEmailDoubleOptInEnabled()
    const count = g.emailSignupEnabled ? await countScopeSubscribers('group', g.id) : 0
    const pendingCount =
      g.emailSignupEnabled && doubleOptIn ? await countScopeSubscribers('group', g.id, 'pending') : 0
    return reply.send({
      enabled: g.emailSignupEnabled,
      doubleOptIn,
      subscriberCount: count,
      pendingCount,
    })
  })

  app.get('/api/v1/email-list/confirm', async (req, reply) => {
    if (!requireDb(reply)) return
    const token = (req.query as { token?: string }).token?.trim()
    if (!token) return reply.status(400).send({ error: 'token required' })
    const result = await confirmScopeEmailSubscription(token)
    if (!result.ok) return reply.status(400).send({ error: result.error })
    return reply.send({ ok: true, scopeName: result.scopeName })
  })

  /** Site owner: marketing archive of all org/group list signups and broadcast deliveries. */
  app.get('/api/v1/platform/email-captures', async (req, reply) => {
    if (!requireDb(reply)) return
    const actor = requireUser(req, reply)
    if (!actor) return
    if (!(await isSiteOwner(actor.userId))) {
      return reply.status(403).send({ error: 'Owner access required' })
    }
    const q = req.query as { since?: string; limit?: string; format?: string }
    const limit = Math.min(5000, Math.max(1, Number(q.limit ?? 500)))
    const since = q.since ? new Date(q.since) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const rows = await db
      .select()
      .from(schema.platformEmailCaptures)
      .where(gte(schema.platformEmailCaptures.createdAt, since))
      .orderBy(desc(schema.platformEmailCaptures.createdAt))
      .limit(limit)

    if (q.format === 'csv') {
      const header = ['email', 'event_type', 'scope_type', 'scope_id', 'scope_name', 'created_at']
      const lines = [
        header.join(','),
        ...rows.map((r) =>
          [r.email, r.eventType, r.scopeType ?? '', r.scopeId ?? '', r.scopeName ?? '', r.createdAt.toISOString()]
            .map((c) => `"${String(c).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ]
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      return reply.send(lines.join('\n'))
    }
    return reply.send({ items: rows })
  })
}
