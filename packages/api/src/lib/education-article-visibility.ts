import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type EducationArticleVisibility = 'PUBLIC' | 'MEMBERS' | 'CONNECTIONS'

export async function viewerCanReadEducationArticle(
  visibility: EducationArticleVisibility | string | null | undefined,
  authorUserId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  if (viewerUserId && viewerUserId === authorUserId) return true
  const v = visibility ?? 'PUBLIC'
  if (v === 'PUBLIC') return true
  if (!viewerUserId) return false
  if (v === 'MEMBERS') return true
  if (v === 'CONNECTIONS') {
    const [row] = await db
      .select({ id: schema.connections.id })
      .from(schema.connections)
      .where(
        and(
          eq(schema.connections.status, 'ACCEPTED'),
          or(
            and(eq(schema.connections.requesterId, viewerUserId), eq(schema.connections.recipientId, authorUserId)),
            and(eq(schema.connections.requesterId, authorUserId), eq(schema.connections.recipientId, viewerUserId)),
          ),
        ),
      )
      .limit(1)
    return !!row
  }
  return false
}
