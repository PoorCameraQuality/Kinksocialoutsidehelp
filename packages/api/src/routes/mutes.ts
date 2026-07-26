import { and, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { db, schema } from '../db/index.js'

const muteKindQuery = z.enum(['USER', 'GROUP', 'TAG']).optional()

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

const postBody = z.object({
  targetKind: z.enum(['USER', 'GROUP', 'TAG']),
  targetId: z.string().uuid(),
})

export async function registerMutesRoutes(app: FastifyInstance) {
  app.get('/api/mutes/me', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Mutes API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const kindParsed = muteKindQuery.safeParse((req.query as { kind?: string }).kind)
    if ((req.query as { kind?: string }).kind && !kindParsed.success) {
      return reply.status(400).send({ error: 'Invalid kind' })
    }
    const kindFilter = kindParsed.data
    const rows = await db
      .select()
      .from(schema.mutes)
      .where(
        kindFilter ?
          and(eq(schema.mutes.userId, userId), eq(schema.mutes.targetKind, kindFilter))
        : eq(schema.mutes.userId, userId)
      )

    const tagIds = rows.filter((r) => r.targetKind === 'TAG').map((r) => r.targetId)
    const userIds = rows.filter((r) => r.targetKind === 'USER').map((r) => r.targetId)
    const groupIds = rows.filter((r) => r.targetKind === 'GROUP').map((r) => r.targetId)

    const [tagRows, userRows, groupRows] = await Promise.all([
      tagIds.length ?
        db
          .select({
            id: schema.kinkTags.id,
            slug: schema.kinkTags.slug,
            displayName: schema.kinkTags.displayName,
          })
          .from(schema.kinkTags)
          .where(inArray(schema.kinkTags.id, tagIds))
      : Promise.resolve([]),
      userIds.length ?
        db
          .select({
            id: schema.users.id,
            username: schema.users.username,
            displayName: schema.profiles.displayName,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
          .where(inArray(schema.users.id, userIds))
      : Promise.resolve([]),
      groupIds.length ?
        db
          .select({
            id: schema.groups.id,
            slug: schema.groups.slug,
            name: schema.groups.name,
          })
          .from(schema.groups)
          .where(inArray(schema.groups.id, groupIds))
      : Promise.resolve([]),
    ])

    const tagById = new Map(tagRows.map((t) => [t.id, t]))
    const userById = new Map(userRows.map((u) => [u.id, u]))
    const groupById = new Map(groupRows.map((g) => [g.id, g]))

    return reply.send({
      mutes: rows.map((row) => {
        if (row.targetKind === 'TAG') {
          return { ...row, tag: tagById.get(row.targetId) ?? null }
        }
        if (row.targetKind === 'USER') {
          return { ...row, user: userById.get(row.targetId) ?? null }
        }
        if (row.targetKind === 'GROUP') {
          return { ...row, group: groupById.get(row.targetId) ?? null }
        }
        return row
      }),
    })
  })

  app.post('/api/mutes/me', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Mutes API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const parsed = postBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const { targetKind, targetId } = parsed.data
    if (targetKind === 'USER' && targetId === userId) {
      return reply.status(400).send({ error: 'Cannot mute yourself' })
    }

    if (targetKind === 'USER') {
      const [u] = await db.select().from(schema.users).where(eq(schema.users.id, targetId)).limit(1)
      if (!u) return reply.status(400).send({ error: 'User not found' })
    } else if (targetKind === 'GROUP') {
      const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, targetId)).limit(1)
      if (!g) return reply.status(400).send({ error: 'Group not found' })
    } else {
      const [t] = await db.select().from(schema.kinkTags).where(eq(schema.kinkTags.id, targetId)).limit(1)
      if (!t) return reply.status(400).send({ error: 'Tag not found' })
    }

    const [dup] = await db
      .select()
      .from(schema.mutes)
      .where(
        and(
          eq(schema.mutes.userId, userId),
          eq(schema.mutes.targetKind, targetKind),
          eq(schema.mutes.targetId, targetId)
        )
      )
      .limit(1)
    if (dup) {
      return reply.send({ mute: dup })
    }
    const [row] = await db
      .insert(schema.mutes)
      .values({ userId, targetKind, targetId })
      .returning()
    if (!row) {
      return reply.status(500).send({ error: 'Insert failed' })
    }
    return reply.send({ mute: row })
  })

  app.delete('/api/mutes/me/:id', async (req, reply) => {
    if (!useDatabase()) {
      return reply.status(503).send({ error: 'Mutes API requires USE_DATABASE=true' })
    }
    const viewer = resolveViewerFromRequest(req)
    const userId = getViewerUserId(viewer.payload)
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const { id } = req.params as { id: string }
    if (!z.string().uuid().safeParse(id).success) {
      return reply.status(400).send({ error: 'Invalid id' })
    }
    const deleted = await db
      .delete(schema.mutes)
      .where(and(eq(schema.mutes.id, id), eq(schema.mutes.userId, userId)))
      .returning()
    if (!deleted.length) {
      return reply.status(404).send({ error: 'Not found' })
    }
    return reply.send({ ok: true })
  })
}
