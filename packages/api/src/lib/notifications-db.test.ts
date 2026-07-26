import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, test } from 'node:test'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const runDb = process.env.CI_NOTIFICATIONS_DB === 'true'

describe('notifications persistence', { skip: !runDb }, () => {
  const userId = randomUUID()
  const username = `ci_notif_${userId.slice(0, 8)}`
  const email = `${username}@ci.c2k.test`

  after(async () => {
    await db.delete(schema.notifications).where(eq(schema.notifications.userId, userId))
    await db.delete(schema.users).where(eq(schema.users.id, userId))
  })

  test('insert, list, and mark read', async () => {
    await db.insert(schema.users).values({
      id: userId,
      username,
      email,
      passwordHash: 'ci-test-hash',
    })

    const [created] = await db
      .insert(schema.notifications)
      .values({
        userId,
        type: 'dm_request',
        payload: { fromUsername: 'RopeDreamer' },
      })
      .returning()

    assert.ok(created?.id)

    const listed = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))

    assert.equal(listed.length, 1)
    assert.equal(listed[0].type, 'dm_request')
    assert.equal((listed[0].payload as { fromUsername?: string }).fromUsername, 'RopeDreamer')
    assert.equal(listed[0].readAt, null)

    const [read] = await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(eq(schema.notifications.id, created.id))
      .returning()

    assert.ok(read?.readAt)
  })
})
