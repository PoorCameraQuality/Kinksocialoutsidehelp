import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export async function loadFollowingUserIds(followerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ followingId: schema.userFollows.followingId })
    .from(schema.userFollows)
    .where(eq(schema.userFollows.followerId, followerId))
  return new Set(rows.map((r) => r.followingId))
}

export async function loadFollowerUserIds(followingId: string): Promise<Set<string>> {
  const rows = await db
    .select({ followerId: schema.userFollows.followerId })
    .from(schema.userFollows)
    .where(eq(schema.userFollows.followingId, followingId))
  return new Set(rows.map((r) => r.followerId))
}
