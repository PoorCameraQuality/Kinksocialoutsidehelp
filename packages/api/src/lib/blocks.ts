import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** True if either user has blocked the other. */
export async function isBlockedPair(userIdA: string, userIdB: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.blocks.id })
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, userIdA), eq(schema.blocks.blockedId, userIdB)),
        and(eq(schema.blocks.blockerId, userIdB), eq(schema.blocks.blockedId, userIdA))
      )
    )
    .limit(1)
  return Boolean(row)
}

export async function loadBlockedUserIds(blockerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blockedId: schema.blocks.blockedId })
    .from(schema.blocks)
    .where(eq(schema.blocks.blockerId, blockerId))
  return new Set(rows.map((r) => r.blockedId))
}

/** Users who blocked `userId` (inverse of loadBlockedUserIds). */
export async function loadUserIdsWhoBlockedUser(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blockerId: schema.blocks.blockerId })
    .from(schema.blocks)
    .where(eq(schema.blocks.blockedId, userId))
  return new Set(rows.map((r) => r.blockerId))
}

/** Either direction of a block hides the other user in social surfaces. */
export async function loadBlockedPairUserIds(userId: string): Promise<Set<string>> {
  const [blocked, blockers] = await Promise.all([
    loadBlockedUserIds(userId),
    loadUserIdsWhoBlockedUser(userId),
  ])
  return new Set([...blocked, ...blockers])
}
