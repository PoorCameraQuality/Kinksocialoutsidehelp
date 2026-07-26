import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Interest tags on feed posts are stored in `mentions` with `type: 'tag'`. */
export function extractTagIdsFromMentions(mentions: unknown): string[] {
  if (!Array.isArray(mentions)) return []
  const ids: string[] = []
  for (const raw of mentions) {
    if (typeof raw !== 'object' || raw == null) continue
    const m = raw as { type?: string; id?: string }
    if (m.type === 'tag' && typeof m.id === 'string' && m.id.length > 0) {
      ids.push(m.id)
    }
  }
  return ids
}

export function postMatchesMutedTags(
  mentions: unknown,
  mutedTagIds: ReadonlySet<string>,
  inheritedTagIds?: readonly string[],
): boolean {
  if (mutedTagIds.size === 0) return false
  for (const id of extractTagIdsFromMentions(mentions)) {
    if (mutedTagIds.has(id)) return true
  }
  if (inheritedTagIds) {
    for (const id of inheritedTagIds) {
      if (mutedTagIds.has(id)) return true
    }
  }
  return false
}

export async function getMutedTagIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ targetId: schema.mutes.targetId })
    .from(schema.mutes)
    .where(and(eq(schema.mutes.userId, userId), eq(schema.mutes.targetKind, 'TAG')))
  return new Set(rows.map((r) => r.targetId))
}

/** Fill tag ids for repost sources that were not in the primary feed query batch. */
export async function hydrateRepostSourceTagIds(
  tagIdsByPostId: Map<string, string[]>,
  repostOfIds: Array<string | null | undefined>,
): Promise<void> {
  const missing = [...new Set(repostOfIds.filter((id): id is string => !!id && !tagIdsByPostId.has(id)))]
  if (missing.length === 0) return
  const rows = await db
    .select({ id: schema.feedPosts.id, mentions: schema.feedPosts.mentions })
    .from(schema.feedPosts)
    .where(inArray(schema.feedPosts.id, missing))
  for (const row of rows) {
    tagIdsByPostId.set(row.id, extractTagIdsFromMentions(row.mentions))
  }
}
