import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export async function loadFeaturedOfferingTitles(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const rows = await db
    .select({
      userId: schema.presenterOfferings.userId,
      title: schema.presenterOfferings.title,
    })
    .from(schema.presenterOfferings)
    .where(and(inArray(schema.presenterOfferings.userId, userIds), eq(schema.presenterOfferings.isPublic, true)))
    .orderBy(asc(schema.presenterOfferings.sortOrder), desc(schema.presenterOfferings.createdAt))

  const out = new Map<string, string>()
  for (const row of rows) {
    if (!out.has(row.userId)) out.set(row.userId, row.title)
  }
  return out
}

export async function loadPublishedArticleCounts(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const rows = await db
    .select({
      authorUserId: schema.educationArticles.authorUserId,
      n: count(schema.educationArticles.id).as('n'),
    })
    .from(schema.educationArticles)
    .where(
      and(
        inArray(schema.educationArticles.authorUserId, userIds),
        eq(schema.educationArticles.publicationStatus, 'PUBLISHED'),
        eq(schema.educationArticles.visibility, 'PUBLIC'),
        eq(schema.educationArticles.listInEducation, true),
      ),
    )
    .groupBy(schema.educationArticles.authorUserId)

  return new Map(rows.map((r) => [r.authorUserId, Number(r.n)]))
}
