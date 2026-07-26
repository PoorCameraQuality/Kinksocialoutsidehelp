import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** Idempotent: every signed-in user should have a `profiles` row (login also creates one). */
export async function ensureProfileForUserId(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1)
  if (existing) return existing
  const [created] = await db.insert(schema.profiles).values({ userId }).returning()
  return created
}
