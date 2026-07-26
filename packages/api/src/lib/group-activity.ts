import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export async function touchGroupActivity(groupId: string): Promise<void> {
  await db
    .update(schema.groups)
    .set({ lastActivityAt: new Date() })
    .where(eq(schema.groups.id, groupId))
}
