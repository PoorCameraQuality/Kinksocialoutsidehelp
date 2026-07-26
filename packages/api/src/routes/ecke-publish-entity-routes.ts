import { and, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { executeEckePublishArticle, executeEckePublishVendor } from '../lib/ecke-publish-executor.js'
import { loadEckeIngestApiConfig, loadEckePublishClientConfig } from '../lib/ecke-publish-client.js'
import { requestEckeArticlePublish, requestEckeVendorPublish } from '../lib/ecke-publish-queue.js'

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

async function loadArticleTarget(articleId: string, userId: string) {
  const [article] = await db
    .select({ id: schema.educationArticles.id, authorUserId: schema.educationArticles.authorUserId })
    .from(schema.educationArticles)
    .where(eq(schema.educationArticles.id, articleId))
    .limit(1)
  if (!article || article.authorUserId !== userId) return null
  const [target] = await db
    .select()
    .from(schema.eckePublishTargets)
    .where(
      and(
        eq(schema.eckePublishTargets.educationArticleId, articleId),
        eq(schema.eckePublishTargets.targetKind, 'ecke_article'),
      ),
    )
    .limit(1)
  return { article, target }
}

function serializeEckeTarget(target: (typeof schema.eckePublishTargets.$inferSelect) | undefined) {
  if (!target) return null
  return {
    status: target.status,
    externalSlug: target.externalSlug,
    lastPublishedAt: target.lastPublishedAt?.toISOString() ?? null,
    lastError: target.lastError ?? null,
  }
}

function isEducationArticleEckeBridgeConnected(): boolean {
  return loadEckeIngestApiConfig() !== null
}

export function registerEckePublishEntityRoutes(app: FastifyInstance) {
  app.get('/api/v1/me/education-articles/:id/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const loaded = await loadArticleTarget(id, user.userId)
    if (!loaded) return reply.status(404).send({ error: 'Article not found' })
    return reply.send({
      bridgeConnected: isEducationArticleEckeBridgeConnected(),
      target: serializeEckeTarget(loaded.target ?? undefined),
      targets: loaded.target ? [serializeEckeTarget(loaded.target)!] : [],
    })
  })

  app.post('/api/v1/me/education-articles/:id/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const loaded = await loadArticleTarget(id, user.userId)
    if (!loaded) return reply.status(404).send({ error: 'Article not found' })
    if (!isEducationArticleEckeBridgeConnected()) {
      return reply.status(503).send({ error: 'Publish bridge not configured on this server' })
    }
    await requestEckeArticlePublish(id, user.userId)
    return reply.send({ ok: true, queued: true })
  })

  app.post('/api/v1/me/education-articles/:id/ecke-publish/sync', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const loaded = await loadArticleTarget(id, user.userId)
    if (!loaded) return reply.status(404).send({ error: 'Article not found' })
    const result = await executeEckePublishArticle(id, user.userId)
    if (!result.ok) return reply.status(502).send({ error: result.error })
    return reply.send({ ok: true, result })
  })

  app.get('/api/v1/vendors/me/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const [vendor] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, user.userId))
      .limit(1)
    if (!vendor) return reply.status(404).send({ error: 'No vendor shop' })
    const [target] = await db
      .select()
      .from(schema.eckePublishTargets)
      .where(
        and(
          eq(schema.eckePublishTargets.vendorProfileId, vendor.id),
          eq(schema.eckePublishTargets.targetKind, 'ecke_vendor'),
        ),
      )
      .limit(1)
    return reply.send({
      bridgeConnected: loadEckePublishClientConfig() !== null,
      eckePublish: vendor.eckePublish,
      target: serializeEckeTarget(target ?? undefined),
      targets: target ? [serializeEckeTarget(target)!] : [],
    })
  })

  app.post('/api/v1/vendors/me/ecke-publish', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const [vendor] = await db
      .select({ id: schema.vendorProfiles.id })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.userId, user.userId))
      .limit(1)
    if (!vendor) return reply.status(404).send({ error: 'No vendor shop' })
    if (!loadEckePublishClientConfig()) {
      return reply.status(503).send({ error: 'Publish bridge not configured on this server' })
    }
    await requestEckeVendorPublish(vendor.id, user.userId)
    return reply.send({ ok: true, queued: true })
  })
}

/** Call after article save when auto-publish is enabled. */
export async function maybeEnqueueEckeArticlePublish(
  article: { id: string; eckePublish: boolean; publicationStatus: string },
  userId: string,
): Promise<void> {
  if (article.eckePublish && article.publicationStatus === 'PUBLISHED' && isEducationArticleEckeBridgeConnected()) {
    await requestEckeArticlePublish(article.id, userId)
  }
}

/** Call after vendor save when auto-publish is enabled. */
export async function maybeEnqueueEckeVendorPublish(
  vendor: { id: string; eckePublish: boolean; visibility: string },
  userId: string,
): Promise<void> {
  if (vendor.eckePublish && vendor.visibility === 'PUBLIC' && loadEckePublishClientConfig()) {
    await requestEckeVendorPublish(vendor.id, userId)
  }
}
