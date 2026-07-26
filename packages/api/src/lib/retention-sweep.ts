import { loadRetentionPolicy } from '@c2k/shared'
import { runAbandonedAccountSweep } from './abandoned-account-sweep.js'
import { runDeletedAccountSweep } from './deleted-account-sweep.js'
import { runDmRetentionSweep } from './dm-retention-sweep.js'
import { isUnderLegalHold } from './legal-hold.js'
import { runRetentionJobs } from './retention-jobs.js'
import { runUserAutoDeleteSweep } from './user-auto-delete-sweep.js'

export type RetentionSweepResult = {
  skippedLegalHold: number
  plannedActions: string[]
  userAutoDelete?: {
    directMessagesErased: number
    hubMessagesErased: number
    activityRowsErased: number
    skippedLegalHold: number
  }
  dmRetention?: {
    messagesErased: number
    conversationsPurged: number
    skippedLegalHold: number
    skippedRetentionPreference: number
  }
  deletedAccounts?: {
    accountsPurged: number
    sessionsDeleted: number
    messagesErased: number
    mediaObjectsDeleted: number
    skippedLegalHold: number
  }
  abandonedAccounts?: {
    noticesQueued: number
    accountsQueuedForDeletion: number
    skippedLegalHold: number
  }
  jobs?: {
    passwordResetTokensDeleted: number
    registrationIpNulled: number
    quarantineObjectsDeleted: number
    quarantineRowsUpdated: number
    rejectedMediaPurged: number
    deletedMediaPurged: number
    notificationsDeleted: number
    staleSessionsDeleted: number
    skippedLegalHold: number
  }
}

/**
 * Retention job: platform-wide purges + member preferences + account lifecycle cleanup.
 */
export async function runRetentionSweep(): Promise<RetentionSweepResult> {
  const policy = loadRetentionPolicy()
  const plannedActions: string[] = []

  let skippedLegalHold = 0

  const jobs = await runRetentionJobs()
  skippedLegalHold += jobs.skippedLegalHold

  if (jobs.passwordResetTokensDeleted > 0) {
    plannedActions.push(`password_reset_tokens: deleted ${jobs.passwordResetTokensDeleted}`)
  }
  if (jobs.registrationIpNulled > 0) {
    plannedActions.push(`registration_ip_prefix: nulled ${jobs.registrationIpNulled}`)
  }
  if (jobs.quarantineObjectsDeleted > 0 || jobs.quarantineRowsUpdated > 0) {
    plannedActions.push(
      `quarantine_media: s3_deleted=${jobs.quarantineObjectsDeleted} rows=${jobs.quarantineRowsUpdated}`
    )
  }
  if (jobs.rejectedMediaPurged > 0 || jobs.deletedMediaPurged > 0) {
    plannedActions.push(
      `media_purge: rejected=${jobs.rejectedMediaPurged} deleted=${jobs.deletedMediaPurged}`
    )
  }
  if (jobs.notificationsDeleted > 0) {
    plannedActions.push(`notifications: deleted ${jobs.notificationsDeleted}`)
  }
  if (jobs.staleSessionsDeleted > 0) {
    plannedActions.push(`sessions: deleted ${jobs.staleSessionsDeleted}`)
  }

  const userAutoDelete = await runUserAutoDeleteSweep()
  skippedLegalHold += userAutoDelete.skippedLegalHold

  if (
    userAutoDelete.directMessagesErased > 0 ||
    userAutoDelete.hubMessagesErased > 0 ||
    userAutoDelete.activityRowsErased > 0
  ) {
    plannedActions.push(
      `user_auto_delete: erased dms=${userAutoDelete.directMessagesErased} hub=${userAutoDelete.hubMessagesErased} activity=${userAutoDelete.activityRowsErased}`
    )
  }

  const dmRetention = await runDmRetentionSweep()
  skippedLegalHold += dmRetention.skippedLegalHold
  if (dmRetention.messagesErased > 0 || dmRetention.conversationsPurged > 0) {
    plannedActions.push(
      `dm_retention: messages=${dmRetention.messagesErased} conversations=${dmRetention.conversationsPurged}`
    )
  }

  const deletedAccounts = await runDeletedAccountSweep()
  skippedLegalHold += deletedAccounts.skippedLegalHold
  if (deletedAccounts.accountsPurged > 0) {
    plannedActions.push(`deleted_accounts: purged ${deletedAccounts.accountsPurged}`)
  }

  const abandonedAccounts = await runAbandonedAccountSweep()
  skippedLegalHold += abandonedAccounts.skippedLegalHold
  if (abandonedAccounts.noticesQueued > 0 || abandonedAccounts.accountsQueuedForDeletion > 0) {
    plannedActions.push(
      `abandoned_accounts: notices=${abandonedAccounts.noticesQueued} queued_delete=${abandonedAccounts.accountsQueuedForDeletion}`
    )
  }

  plannedActions.push(
    `security_logs: purge older than ${policy.securityLogRetentionDays} days (hosting operator)`,
    `moderation_records: retain ${policy.moderationRecordRetentionDays} days`,
    `backups: ${policy.backupSnapshotRetentionDays} day snapshot window (see docs/DATA_INVENTORY_AND_RETENTION.md)`
  )

  console.log('[retention-sweep] policy', policy, 'planned', plannedActions.length)
  return {
    skippedLegalHold,
    plannedActions,
    userAutoDelete,
    dmRetention,
    deletedAccounts,
    abandonedAccounts,
    jobs,
  }
}
