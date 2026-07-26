import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

/** convention_persons.id keyed by linked C2K user_id. */
export async function loadDirectoryPersonIdByUserId(
  conventionId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      personId: schema.conventionPersons.id,
      userId: schema.conventionPersons.userId,
    })
    .from(schema.conventionPersons)
    .where(
      and(
        eq(schema.conventionPersons.conventionId, conventionId),
        isNotNull(schema.conventionPersons.userId),
      ),
    )
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.userId) map.set(r.userId, r.personId)
  }
  return map
}

/** convention_registrants.id keyed by user_id. */
export async function loadRegistrantIdByUserId(
  conventionId: string,
  userIds?: string[],
): Promise<Map<string, string>> {
  const filters = [
    eq(schema.conventionRegistrants.conventionId, conventionId),
    isNotNull(schema.conventionRegistrants.userId),
  ]
  if (userIds?.length) {
    filters.push(inArray(schema.conventionRegistrants.userId, userIds))
  }
  const rows = await db
    .select({
      registrantId: schema.conventionRegistrants.id,
      userId: schema.conventionRegistrants.userId,
    })
    .from(schema.conventionRegistrants)
    .where(and(...filters))
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.userId) map.set(r.userId, r.registrantId)
  }
  return map
}
