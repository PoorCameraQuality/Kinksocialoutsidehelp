import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import {
  alphaUploadDisabledResponse,
  isAlphaUploadDisabled,
  type AlphaUploadCategory,
} from '../lib/alpha-upload-policy.js'
import {
  MediaUploadValidationError,
  promoteQuarantineToScopeBrandingUrl,
} from '../lib/media-pipeline.js'
import {
  educationArticleWriteBodySchema,
  slugifyEducationTitle,
  validateListInEducationRequirements,
} from '../lib/education-article-schema.js'
import { viewerCanReadEducationArticle } from '../lib/education-article-visibility.js'
import { estimateReadingMinutes, sanitizeEducationHtml } from '../lib/sanitize-education-body.js'
import { maybeEnqueueEckeArticlePublish } from './ecke-publish-entity-routes.js'
import { loadSeriesContextForArticle } from '../lib/education-series-context.js'
import { listEducationArticlesForHub } from '../lib/search/education/education-query.js'
import { enqueueSearchSyncJob } from '../lib/search/search-sync-queue.js'

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
  return requireAuthenticatedDbUser(req, reply)
}

type ArticleRow = typeof schema.educationArticles.$inferSelect

function shapeArticleRow(
  row: ArticleRow,
  author: { username: string; displayName: string | null },
  extras?: { saveCount?: number },
) {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyJson: row.bodyJson,
    bodyHtml: row.bodyHtml,
    heroImageUrl: row.heroImageUrl,
    categories: row.categories ?? [],
    difficulty: row.difficulty,
    contentWarnings: row.contentWarnings ?? [],
    readingMinutes: row.readingMinutes,
    linkedOfferingIds: row.linkedOfferingIds ?? [],
    visibility: row.visibility,
    listInEducation: row.listInEducation,
    publicationStatus: row.publicationStatus,
    eckePublish: row.eckePublish,
    organizationId: row.organizationId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    saveCount: extras?.saveCount,
  }
}

async function loadAuthor(userId: string) {
  const [row] = await db
    .select({
      username: schema.users.username,
      displayName: schema.profiles.displayName,
    })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId))
    .limit(1)
  return row ?? { username: '', displayName: null }
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const slug = base.slice(0, 160)
  for (let n = 0; n < 20; n++) {
    const candidate = n === 0 ? slug : `${slug.slice(0, 150)}-${n}`
    const [existing] = await db
      .select({ id: schema.educationArticles.id })
      .from(schema.educationArticles)
      .where(
        excludeId
          ? and(eq(schema.educationArticles.slug, candidate), sql`${schema.educationArticles.id} <> ${excludeId}`)
          : eq(schema.educationArticles.slug, candidate),
      )
      .limit(1)
    if (!existing) return candidate
  }
  return `${slug}-${Date.now()}`.slice(0, 160)
}

async function filterVisibleArticles<T extends ArticleRow>(
  rows: T[],
  viewerUserId: string | null,
): Promise<T[]> {
  const out: T[] = []
  for (const row of rows) {
    if (await viewerCanReadEducationArticle(row.visibility, row.authorUserId, viewerUserId)) {
      out.push(row)
    }
  }
  return out
}

export async function loadWritingPreviewForUser(authorUserId: string, limit = 3) {
  const rows = await db
    .select()
    .from(schema.educationArticles)
    .where(
      and(
        eq(schema.educationArticles.authorUserId, authorUserId),
        eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
      ),
    )
    .orderBy(desc(schema.educationArticles.publishedAt))
    .limit(limit)
  const author = await loadAuthor(authorUserId)
  return rows.map((r) => shapeArticleRow(r, author))
}

export async function loadJournalArticlesForUser(
  authorUserId: string,
  viewerUserId: string | null,
  limit: number,
) {
  const isOwner = viewerUserId === authorUserId
  const rows = await db
    .select()
    .from(schema.educationArticles)
    .where(
      isOwner
        ? eq(schema.educationArticles.authorUserId, authorUserId)
        : and(
            eq(schema.educationArticles.authorUserId, authorUserId),
            eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
          ),
    )
    .orderBy(desc(schema.educationArticles.updatedAt))
    .limit(limit)
  const visible = isOwner ? rows : await filterVisibleArticles(rows, viewerUserId)
  const author = await loadAuthor(authorUserId)
  return visible.map((r) => shapeArticleRow(r, author))
}

export async function registerEducationArticleRoutes(app: FastifyInstance) {
  app.get('/api/v1/education/articles', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    const q = req.query as { category?: string; difficulty?: string; q?: string; limit?: string; cursor?: string }
    const limit = Math.min(50, Math.max(1, parseInt(String(q.limit ?? '24'), 10) || 24))
    const { rows, nextCursor } = await listEducationArticlesForHub({
      category: q.category,
      difficulty: q.difficulty,
      q: q.q,
      limit,
      cursor: q.cursor,
    })
    const visible = await filterVisibleArticles(rows, viewerId)
    const items = await Promise.all(
      visible.map(async (row) => shapeArticleRow(row, await loadAuthor(row.authorUserId))),
    )
    return reply.send({ items, nextCursor })
  })

  app.get('/api/v1/education/articles/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const { slug } = req.params as { slug: string }
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    const [row] = await db
      .select()
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.slug, slug))
      .limit(1)
    if (!row) return reply.status(404).send({ error: 'Not found' })
    if (row.publicationStatus !== 'PUBLISHED') {
      if (!viewerId || viewerId !== row.authorUserId) {
        return reply.status(404).send({ error: 'Not found' })
      }
    }
    if (!(await viewerCanReadEducationArticle(row.visibility, row.authorUserId, viewerId))) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const author = await loadAuthor(row.authorUserId)
    let linkedOfferings: Array<{ id: string; title: string }> = []
    if (row.linkedOfferingIds?.length) {
      linkedOfferings = await db
        .select({ id: schema.presenterOfferings.id, title: schema.presenterOfferings.title })
        .from(schema.presenterOfferings)
        .where(inArray(schema.presenterOfferings.id, row.linkedOfferingIds))
    }
    return reply.send({
      article: shapeArticleRow(row, author),
      linkedOfferings,
      seriesContext: await loadSeriesContextForArticle(row.id, viewerId),
    })
  })

  app.get('/api/v1/me/education-articles', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select()
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.authorUserId, user.userId))
      .orderBy(desc(schema.educationArticles.updatedAt))
    const author = await loadAuthor(user.userId)
    return reply.send({ items: rows.map((r) => shapeArticleRow(r, author)) })
  })

  app.get('/api/v1/me/education-articles/stats', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const rows = await db
      .select({
        publicationStatus: schema.educationArticles.publicationStatus,
        id: schema.educationArticles.id,
      })
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.authorUserId, user.userId))
    let publishedCount = 0
    let draftCount = 0
    const ids: string[] = []
    for (const r of rows) {
      ids.push(r.id)
      if (r.publicationStatus === 'PUBLISHED') publishedCount += 1
      else if (r.publicationStatus === 'DRAFT') draftCount += 1
    }
    let saveCount = 0
    if (ids.length) {
      const [b] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.userBookmarks)
        .where(
          and(
            eq(schema.userBookmarks.objectType, 'education_article'),
            inArray(schema.userBookmarks.objectId, ids),
          ),
        )
      saveCount = Number(b?.n ?? 0)
    }
    return reply.send({ publishedCount, draftCount, saveCount })
  })

  app.post('/api/v1/me/education-articles', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = educationArticleWriteBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const listErr = validateListInEducationRequirements(parsed.data)
    if (listErr) return reply.status(400).send({ error: listErr })
    const bodyHtml = sanitizeEducationHtml(parsed.data.bodyHtml ?? '')
    const slug = await ensureUniqueSlug(
      parsed.data.slug?.trim() || slugifyEducationTitle(parsed.data.title),
    )
    const now = new Date()
    const pubStatus = parsed.data.publicationStatus ?? 'DRAFT'
    const [presenter] = await db
      .select({ userId: schema.presenterProfiles.userId })
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, user.userId))
      .limit(1)
    const [row] = await db
      .insert(schema.educationArticles)
      .values({
        authorUserId: user.userId,
        presenterProfileUserId: presenter?.userId ?? null,
        slug,
        title: parsed.data.title.trim(),
        excerpt: parsed.data.excerpt?.trim() || null,
        bodyJson: parsed.data.bodyJson ?? {},
        bodyHtml,
        heroImageUrl: parsed.data.heroImageUrl?.trim() || null,
        categories: parsed.data.categories ?? [],
        difficulty: parsed.data.difficulty?.trim() || null,
        contentWarnings: parsed.data.contentWarnings ?? [],
        readingMinutes: parsed.data.readingMinutes ?? estimateReadingMinutes(bodyHtml),
        linkedOfferingIds: parsed.data.linkedOfferingIds ?? [],
        visibility: parsed.data.visibility ?? 'PUBLIC',
        listInEducation: parsed.data.listInEducation ?? false,
        publicationStatus: pubStatus,
        eckePublish: parsed.data.eckePublish ?? false,
        organizationId: parsed.data.organizationId ?? null,
        publishedAt: pubStatus === 'PUBLISHED' ? now : null,
        updatedAt: now,
      })
      .returning()
    if (!row) return reply.status(500).send({ error: 'Insert failed' })
    const author = await loadAuthor(user.userId)
    await maybeEnqueueEckeArticlePublish(row, user.userId)
    await enqueueSearchSyncJob('upsert-education-article', { articleId: row.id })
    return reply.send({ article: shapeArticleRow(row, author) })
  })

  app.put('/api/v1/me/education-articles/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const parsed = educationArticleWriteBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const [existing] = await db
      .select()
      .from(schema.educationArticles)
      .where(and(eq(schema.educationArticles.id, id), eq(schema.educationArticles.authorUserId, user.userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    const merged = {
      listInEducation: parsed.data.listInEducation ?? existing.listInEducation,
      categories: parsed.data.categories ?? existing.categories ?? [],
      contentWarnings: parsed.data.contentWarnings ?? existing.contentWarnings ?? [],
    }
    const listErr = validateListInEducationRequirements(merged)
    if (listErr) return reply.status(400).send({ error: listErr })
    const bodyHtml = sanitizeEducationHtml(
      parsed.data.bodyHtml !== undefined ? parsed.data.bodyHtml : existing.bodyHtml,
    )
    const slug =
      parsed.data.slug?.trim()
        ? await ensureUniqueSlug(parsed.data.slug.trim(), id)
        : existing.slug
    const pubStatus = parsed.data.publicationStatus ?? existing.publicationStatus
    const now = new Date()
    const publishedAt =
      pubStatus === 'PUBLISHED'
        ? existing.publishedAt ?? now
        : pubStatus === 'DRAFT'
          ? null
          : existing.publishedAt
    const [row] = await db
      .update(schema.educationArticles)
      .set({
        slug,
        title: parsed.data.title?.trim() ?? existing.title,
        excerpt: parsed.data.excerpt === undefined ? existing.excerpt : parsed.data.excerpt?.trim() || null,
        bodyJson: parsed.data.bodyJson ?? existing.bodyJson,
        bodyHtml,
        heroImageUrl:
          parsed.data.heroImageUrl === undefined ? existing.heroImageUrl : parsed.data.heroImageUrl?.trim() || null,
        categories: parsed.data.categories ?? existing.categories,
        difficulty:
          parsed.data.difficulty === undefined ? existing.difficulty : parsed.data.difficulty?.trim() || null,
        contentWarnings: parsed.data.contentWarnings ?? existing.contentWarnings,
        readingMinutes:
          parsed.data.readingMinutes ??
          (parsed.data.bodyHtml !== undefined ? estimateReadingMinutes(bodyHtml) : existing.readingMinutes),
        linkedOfferingIds: parsed.data.linkedOfferingIds ?? existing.linkedOfferingIds,
        visibility: parsed.data.visibility ?? existing.visibility,
        listInEducation: parsed.data.listInEducation ?? existing.listInEducation,
        publicationStatus: pubStatus,
        eckePublish: parsed.data.eckePublish ?? existing.eckePublish,
        organizationId: parsed.data.organizationId === undefined ? existing.organizationId : parsed.data.organizationId,
        publishedAt,
        updatedAt: now,
      })
      .where(eq(schema.educationArticles.id, id))
      .returning()
    if (!row) return reply.status(500).send({ error: 'Update failed' })
    const author = await loadAuthor(user.userId)
    await maybeEnqueueEckeArticlePublish(row, user.userId)
    await enqueueSearchSyncJob('upsert-education-article', { articleId: row.id })
    return reply.send({ article: shapeArticleRow(row, author) })
  })

  const educationImageAttachBody = z.object({
    quarantineKey: z.string().min(1).max(2048),
    variant: z.enum(['hero', 'inline']),
  })

  const educationImageAlphaCategory: Record<'hero' | 'inline', AlphaUploadCategory> = {
    hero: 'education_hero',
    inline: 'education_inline',
  }

  app.post('/api/v1/me/education-articles/image/attach', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const parsed = educationImageAttachBody.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
    const alphaCategory = educationImageAlphaCategory[parsed.data.variant]
    if (isAlphaUploadDisabled(alphaCategory)) {
      return alphaUploadDisabledResponse(reply, alphaCategory)
    }
    let publicUrl: string
    try {
      publicUrl = await promoteQuarantineToScopeBrandingUrl({
        userId: user.userId,
        quarantineKey: parsed.data.quarantineKey,
        scopePath: `education/${user.userId}`,
        assetName: parsed.data.variant,
      })
    } catch (err) {
      if (err instanceof MediaUploadValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      const e = err as { message?: string }
      req.log?.error({ err }, 'education image attach failed')
      return reply.status(502).send({ error: e.message ?? 'Could not attach education image' })
    }
    return reply.send({ url: publicUrl })
  })

  app.delete('/api/v1/me/education-articles/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }
    const [existing] = await db
      .select({ id: schema.educationArticles.id })
      .from(schema.educationArticles)
      .where(and(eq(schema.educationArticles.id, id), eq(schema.educationArticles.authorUserId, user.userId)))
      .limit(1)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    await db
      .update(schema.educationArticles)
      .set({ publicationStatus: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(schema.educationArticles.id, id))
    await enqueueSearchSyncJob('delete-education-article', { articleId: id })
    return reply.send({ ok: true })
  })

  app.get('/api/v1/presenters/:key/writing', async (req, reply) => {
    if (!requireDb(reply)) return
    const { key: presenterKey } = req.params as { key: string }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const [userRow] = uuidRe.test(presenterKey)
      ? await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, presenterKey)).limit(1)
      : await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, presenterKey)).limit(1)
    if (!userRow) return reply.status(404).send({ error: 'Not found' })
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)
    const rows = await db
      .select()
      .from(schema.educationArticles)
      .where(
        and(
          eq(schema.educationArticles.authorUserId, userRow.id),
          eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
        ),
      )
      .orderBy(desc(schema.educationArticles.publishedAt))
      .limit(24)
    const visible = await filterVisibleArticles(rows, viewerId)
    const author = await loadAuthor(userRow.id)
    return reply.send({ items: visible.map((r) => shapeArticleRow(r, author)) })
  })
}
