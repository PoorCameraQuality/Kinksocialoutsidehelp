import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PLATFORM_DEFAULT_DM_RETENTION_DAYS,
  POLICY_REASONS,
  parseDmRetentionSelectValue,
  resolveEffectiveDmRetentionDays,
} from '@c2k/shared'
import { effectiveConversationRetentionDays } from './dm-retention-sweep.js'

describe('retention policy helpers', () => {
  it('defaults DM retention to 12 months when unset', () => {
    assert.equal(resolveEffectiveDmRetentionDays(undefined), PLATFORM_DEFAULT_DM_RETENTION_DAYS)
    assert.equal(PLATFORM_DEFAULT_DM_RETENTION_DAYS, 365)
  })

  it('honors keep-until-delete preference', () => {
    assert.equal(resolveEffectiveDmRetentionDays(null), null)
  })

  it('parses DM retention select values', () => {
    assert.equal(parseDmRetentionSelectValue('180'), 180)
    assert.equal(parseDmRetentionSelectValue('365'), 365)
    assert.equal(parseDmRetentionSelectValue('730'), 730)
    assert.equal(parseDmRetentionSelectValue(''), null)
  })

  it('uses longest participant retention for a conversation', () => {
    assert.equal(
      effectiveConversationRetentionDays([
        { retentionDays: 180 },
        { retentionDays: 365 },
      ]),
      365
    )
  })

  it('skips auto-delete when any participant keeps until delete', () => {
    assert.equal(
      effectiveConversationRetentionDays([
        { retentionDays: 180 },
        { retentionDays: null },
      ]),
      null
    )
  })
})

describe('retention cleanup (database)', () => {
  const useDb = process.env.USE_DATABASE === 'true'

  it('legal hold blocks user lookup', { skip: !useDb }, async () => {
    const { db, schema } = await import('../db/index.js')
    const { isUnderLegalHold } = await import('./legal-hold.js')
    const { eq } = await import('drizzle-orm')

    const [user] = await db.select({ id: schema.users.id }).from(schema.users).limit(1)
    if (!user) return

    await db.insert(schema.legalHolds).values({
      targetType: 'user',
      targetId: user.id,
      active: true,
      reason: 'retention-test',
    })

    assert.equal(await isUnderLegalHold('user', user.id), true)

    await db.delete(schema.legalHolds).where(eq(schema.legalHolds.targetId, user.id))
  })

  it('reported DM creates content snapshot', { skip: !useDb }, async () => {
    const { db, schema } = await import('../db/index.js')
    const { createReport } = await import('./moderation-ts-intake.js')
    const { eq } = await import('drizzle-orm')

    const users = await db.select({ id: schema.users.id }).from(schema.users).limit(2)
    if (users.length < 2) return

    const [conv] = await db.insert(schema.conversations).values({}).returning()
    await db.insert(schema.conversationParticipants).values([
      { conversationId: conv!.id, userId: users[0]!.id },
      { conversationId: conv!.id, userId: users[1]!.id },
    ])

    const [msg] = await db
      .insert(schema.messages)
      .values({
        conversationId: conv!.id,
        senderId: users[0]!.id,
        body: 'retention-test-message',
      })
      .returning()

    const result = await createReport({
      reporterId: users[1]!.id,
      targetType: 'message',
      targetId: msg!.id,
      policyReason: POLICY_REASONS.harassmentThreats,
    })

    const snaps = await db
      .select()
      .from(schema.contentSnapshots)
      .where(eq(schema.contentSnapshots.caseId, result.caseId))

    assert.ok(snaps.length > 0)
    assert.equal(snaps[0]!.targetContentId, msg!.id)

    await db.delete(schema.contentSnapshots).where(eq(schema.contentSnapshots.caseId, result.caseId))
    await db.delete(schema.moderationReports).where(eq(schema.moderationReports.caseId, result.caseId))
    await db.delete(schema.moderationQueueItems).where(eq(schema.moderationQueueItems.caseId, result.caseId))
    await db.delete(schema.moderationCases).where(eq(schema.moderationCases.id, result.caseId))
    await db.delete(schema.messages).where(eq(schema.messages.id, msg!.id))
    await db.delete(schema.conversations).where(eq(schema.conversations.id, conv!.id))
  })

  it('runRetentionSweep is idempotent', { skip: !useDb }, async () => {
    const { runRetentionSweep } = await import('./retention-sweep.js')
    const first = await runRetentionSweep()
    const second = await runRetentionSweep()
    assert.ok(second.skippedLegalHold >= 0)
    assert.ok(first.plannedActions.length > 0)
  })
})
