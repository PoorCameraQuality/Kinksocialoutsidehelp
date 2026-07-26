import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { RETENTION_DEFAULTS } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import { isUnderLegalHold } from './legal-hold.js'
import { cutoffSql } from './retention-protection.js'
import { softDeleteUserAccount } from './deleted-account-sweep.js'

const DORMANT_DAYS = Number(process.env.ABANDONED_ACCOUNT_DORMANT_DAYS ?? RETENTION_DEFAULTS.abandonedAccountDormantDays)
const NOTICE_GRACE_DAYS = Number(
  process.env.ABANDONED_ACCOUNT_NOTICE_GRACE_DAYS ?? RETENTION_DEFAULTS.abandonedAccountNoticeGraceDays
)
const graceCutoffSql = cutoffSql(NOTICE_GRACE_DAYS)

export type AbandonedAccountSweepResult = {
  noticesQueued: number
  accountsQueuedForDeletion: number
  skippedLegalHold: number
}

/** Mark dormant accounts and queue deletion after notice grace. Does not remove organizer ownership rows. */
export async function runAbandonedAccountSweep(): Promise<AbandonedAccountSweepResult> {
  const dormantCutoff = cutoffSql(DORMANT_DAYS)

  const noticeCandidates = await db
    .select({
      id: schema.users.id,
      lastSeenAt: schema.users.lastSeenAt,
      dormantNoticeSentAt: schema.users.dormantNoticeSentAt,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(
      and(
        isNull(schema.users.deletedAt),
        or(
          lt(schema.users.lastSeenAt, dormantCutoff),
          and(isNull(schema.users.lastSeenAt), lt(schema.users.createdAt, dormantCutoff))
        )
      )
    )
    .limit(100)

  let noticesQueued = 0
  let accountsQueuedForDeletion = 0
  let skippedLegalHold = 0

  for (const user of noticeCandidates) {
    if (await isUnderLegalHold('user', user.id)) {
      skippedLegalHold += 1
      continue
    }

    if (!user.dormantNoticeSentAt) {
      await db
        .update(schema.users)
        .set({ dormantNoticeSentAt: new Date() })
        .where(eq(schema.users.id, user.id))
      noticesQueued += 1
      continue
    }
  }

  const deletionCandidates = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        isNull(schema.users.deletedAt),
        isNotNull(schema.users.dormantNoticeSentAt),
        lt(schema.users.dormantNoticeSentAt, graceCutoffSql)
      )
    )
    .limit(50)

  for (const user of deletionCandidates) {
    if (await isUnderLegalHold('user', user.id)) {
      skippedLegalHold += 1
      continue
    }
    await softDeleteUserAccount(user.id)
    accountsQueuedForDeletion += 1
  }

  return { noticesQueued, accountsQueuedForDeletion, skippedLegalHold }
}
