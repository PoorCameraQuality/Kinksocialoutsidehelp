import { and, asc, count, desc, eq, inArray, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { requireAuthenticatedDbUser } from '../auth/require-authenticated-db-user.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import {
  educationSeriesItemsBodySchema,
  educationSeriesWriteBodySchema,
  slugifyEducationTitle,
} from '../lib/education-series-schema.js'
import { loadVisibleSeriesItems } from '../lib/education-series-context.js'

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

type SeriesRow = typeof schema.educationArticleSeries.$inferSelect

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

async function ensureUniqueSeriesSlug(base: string, excludeId?: string): Promise<string> {
  const slug = base.slice(0, 160)
  for (let n = 0; n < 20; n++) {
    const candidate = n === 0 ? slug : `${slug.slice(0, 150)}-${n}`
    const [existing] = await db
      .select({ id: schema.educationArticleSeries.id })
      .from(schema.educationArticleSeries)
      .where(
        excludeId
          ? and(eq(schema.educationArticleSeries.slug, candidate), ne(schema.educationArticleSeries.id, excludeId))
          : eq(schema.educationArticleSeries.slug, candidate),
      )
      .limit(1)
    if (!existing) return candidate
  }
  return `${slug}-${Date.now()}`.slice(0, 160)
}

function shapeSeriesRow(row: SeriesRow, extras?: { itemCount?: number }) {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    listInEducation: row.listInEducation,
    itemCount: extras?.itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function requireOwnedSeries(id: string, userId: string, reply: FastifyReply): Promise<SeriesRow | null> {
  const [row] = await db
    .select()
    .from(schema.educationArticleSeries)
    .where(and(eq(schema.educationArticleSeries.id, id), eq(schema.educationArticleSeries.authorUserId, userId)))
    .limit(1)
  if (!row) {
    reply.status(404).send({ error: 'Not found' })
    return null
  }
  return row
}

export async function registerEducationArticleSeriesRoutes(app: FastifyInstance) {
  app.get('/api/v1/education/series', async (req, reply) => {
    if (!requireDb(reply)) return
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)

    const seriesRows = await db
      .select()
      .from(schema.educationArticleSeries)
      .where(eq(schema.educationArticleSeries.listInEducation, true))
      .orderBy(desc(schema.educationArticleSeries.updatedAt))

    const items: Array<
      ReturnType<typeof shapeSeriesRow> & {
        partCount: number
        modules: Array<{ label: string; slug: string }>
      }
    > = []

    for (const row of seriesRows) {
      const visible = await loadVisibleSeriesItems(row.id, viewerId)
      if (visible.length === 0) continue
      items.push({
        ...shapeSeriesRow(row),
        partCount: visible.length,
        modules: visible.map((item) => ({ label: item.title, slug: item.slug })),
      })
    }

    return reply.send({ items })
  })

  app.get('/api/v1/education/series/by-author/:username', async (req, reply) => {
    if (!requireDb(reply)) return
    const { username } = req.params as { username: string }
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)

    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1)
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const seriesRows = await db
      .select()
      .from(schema.educationArticleSeries)
      .where(eq(schema.educationArticleSeries.authorUserId, user.id))
      .orderBy(desc(schema.educationArticleSeries.updatedAt))

    const items: Array<ReturnType<typeof shapeSeriesRow> & { partCount: number }> = []
    for (const row of seriesRows) {
      const visible = await loadVisibleSeriesItems(row.id, viewerId)
      if (visible.length === 0) continue
      items.push({ ...shapeSeriesRow(row), partCount: visible.length })
    }

    return reply.send({ items })
  })

  app.get('/api/v1/education/series/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const { slug } = req.params as { slug: string }
    const viewerId = getViewerUserId(resolveViewerFromRequest(req).payload)

    const [series] = await db
      .select()
      .from(schema.educationArticleSeries)
      .where(eq(schema.educationArticleSeries.slug, slug))
      .limit(1)
    if (!series) return reply.status(404).send({ error: 'Not found' })

    const items = await loadVisibleSeriesItems(series.id, viewerId)
    if (items.length === 0) return reply.status(404).send({ error: 'Not found' })

    const author = await loadAuthor(series.authorUserId)
    return reply.send({
      series: {
        ...shapeSeriesRow(series),
        authorUsername: author.username,
        authorDisplayName: author.displayName,
      },
      items,
    })
  })

  app.get('/api/v1/me/education-series', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const rows = await db
      .select({
        series: schema.educationArticleSeries,
        itemCount: count(schema.educationArticleSeriesItems.id),
      })
      .from(schema.educationArticleSeries)
      .leftJoin(
        schema.educationArticleSeriesItems,
        eq(schema.educationArticleSeriesItems.seriesId, schema.educationArticleSeries.id),
      )
      .where(eq(schema.educationArticleSeries.authorUserId, user.userId))
      .groupBy(schema.educationArticleSeries.id)
      .orderBy(desc(schema.educationArticleSeries.updatedAt))

    return reply.send({
      items: rows.map((r) => shapeSeriesRow(r.series, { itemCount: Number(r.itemCount ?? 0) })),
    })
  })

  app.get('/api/v1/me/education-series/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }

    const series = await requireOwnedSeries(id, user.userId, reply)
    if (!series) return

    const joined = await db
      .select({
        sortOrder: schema.educationArticleSeriesItems.sortOrder,
        articleId: schema.educationArticles.id,
        slug: schema.educationArticles.slug,
        title: schema.educationArticles.title,
        publicationStatus: schema.educationArticles.publicationStatus,
      })
      .from(schema.educationArticleSeriesItems)
      .innerJoin(
        schema.educationArticles,
        eq(schema.educationArticleSeriesItems.articleId, schema.educationArticles.id),
      )
      .where(eq(schema.educationArticleSeriesItems.seriesId, series.id))
      .orderBy(asc(schema.educationArticleSeriesItems.sortOrder))

    return reply.send({
      series: shapeSeriesRow(series),
      items: joined.map((j) => ({
        sortOrder: j.sortOrder,
        articleId: j.articleId,
        slug: j.slug,
        title: j.title,
        publicationStatus: j.publicationStatus,
      })),
    })
  })

  app.post('/api/v1/me/education-series', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const parsed = educationSeriesWriteBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const baseSlug = parsed.data.slug?.trim() || slugifyEducationTitle(parsed.data.title)
    const slug = await ensureUniqueSeriesSlug(baseSlug)
    const now = new Date()

    const [row] = await db
      .insert(schema.educationArticleSeries)
      .values({
        authorUserId: user.userId,
        title: parsed.data.title.trim(),
        slug,
        description: parsed.data.description?.trim() || null,
        updatedAt: now,
      })
      .returning()

    return reply.status(201).send({ series: shapeSeriesRow(row!) })
  })

  app.put('/api/v1/me/education-series/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }

    const existing = await requireOwnedSeries(id, user.userId, reply)
    if (!existing) return

    const parsed = educationSeriesWriteBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    let slug = existing.slug
    if (parsed.data.slug?.trim()) {
      slug = await ensureUniqueSeriesSlug(parsed.data.slug.trim(), id)
    } else if (parsed.data.title.trim() !== existing.title) {
      slug = await ensureUniqueSeriesSlug(slugifyEducationTitle(parsed.data.title), id)
    }

    const [row] = await db
      .update(schema.educationArticleSeries)
      .set({
        title: parsed.data.title.trim(),
        slug,
        description: parsed.data.description?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.educationArticleSeries.id, id))
      .returning()

    return reply.send({ series: shapeSeriesRow(row!) })
  })

  app.delete('/api/v1/me/education-series/:id', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }

    const existing = await requireOwnedSeries(id, user.userId, reply)
    if (!existing) return

    await db.delete(schema.educationArticleSeries).where(eq(schema.educationArticleSeries.id, id))
    return reply.send({ ok: true })
  })

  app.put('/api/v1/me/education-series/:id/items', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { id } = req.params as { id: string }

    const series = await requireOwnedSeries(id, user.userId, reply)
    if (!series) return

    const parsed = educationSeriesItemsBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const articleIds = parsed.data.articleIds
    if (articleIds.length > 0) {
      const articles = await db
        .select({ id: schema.educationArticles.id })
        .from(schema.educationArticles)
        .where(
          and(
            eq(schema.educationArticles.authorUserId, user.userId),
            inArray(schema.educationArticles.id, articleIds),
          ),
        )
      if (articles.length !== articleIds.length) {
        return reply.status(400).send({ error: 'All articles must be owned by you' })
      }

      for (const articleId of articleIds) {
        const [conflict] = await db
          .select({ seriesId: schema.educationArticleSeriesItems.seriesId })
          .from(schema.educationArticleSeriesItems)
          .where(
            and(
              eq(schema.educationArticleSeriesItems.articleId, articleId),
              ne(schema.educationArticleSeriesItems.seriesId, id),
            ),
          )
          .limit(1)
        if (conflict) {
          return reply.status(400).send({ error: 'An article is already in another series' })
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.educationArticleSeriesItems)
        .where(eq(schema.educationArticleSeriesItems.seriesId, id))

      if (articleIds.length > 0) {
        await tx.insert(schema.educationArticleSeriesItems).values(
          articleIds.map((articleId, i) => ({
            seriesId: id,
            articleId,
            sortOrder: i + 1,
          })),
        )
      }

      await tx
        .update(schema.educationArticleSeries)
        .set({ updatedAt: new Date() })
        .where(eq(schema.educationArticleSeries.id, id))
    })

    const joined = await db
      .select({
        sortOrder: schema.educationArticleSeriesItems.sortOrder,
        articleId: schema.educationArticles.id,
        slug: schema.educationArticles.slug,
        title: schema.educationArticles.title,
        publicationStatus: schema.educationArticles.publicationStatus,
      })
      .from(schema.educationArticleSeriesItems)
      .innerJoin(
        schema.educationArticles,
        eq(schema.educationArticleSeriesItems.articleId, schema.educationArticles.id),
      )
      .where(eq(schema.educationArticleSeriesItems.seriesId, id))
      .orderBy(asc(schema.educationArticleSeriesItems.sortOrder))

    return reply.send({
      items: joined.map((j) => ({
        sortOrder: j.sortOrder,
        articleId: j.articleId,
        slug: j.slug,
        title: j.title,
        publicationStatus: j.publicationStatus,
      })),
    })
  })
}
