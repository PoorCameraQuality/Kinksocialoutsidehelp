import { z } from 'zod'

/** Default retention windows (days). Override via env in API worker. */
export const RETENTION_DEFAULTS = {
  securityLogRetentionDays: 30,
  rawIpRetentionDays: 30,
  deletedAccountPurgeDays: 30,
  moderationRecordRetentionDays: 365 * 3,
  backupSnapshotRetentionDays: 14,
  /** Platform default DM retention when member has not chosen "keep until I delete". */
  platformDmRetentionDays: 365,
  deletedConversationPurgeDays: 30,
  notificationRetentionDays: 90,
  rejectedMediaRetentionDays: 30,
  // About 18 months idle before abandoned-account notices start.
  abandonedAccountDormantDays: 548,
  abandonedAccountNoticeGraceDays: 60,
} as const

/** Member-selectable auto-shred windows for DMs you sent, hub chat, and feed activity. */
export const USER_AUTO_DELETE_DAY_OPTIONS = [7, 10, 30, 90, 365] as const

/** Member-selectable DM conversation retention (entire thread age). null = keep until I delete. */
export const DM_RETENTION_USER_OPTIONS = [180, 365, 730] as const

export type DmRetentionDays = (typeof DM_RETENTION_USER_OPTIONS)[number] | null

export const dmRetentionDaysSchema = z
  .union([z.literal(180), z.literal(365), z.literal(730), z.literal(null)])
  .default(365)

export const PLATFORM_DEFAULT_DM_RETENTION_DAYS = RETENTION_DEFAULTS.platformDmRetentionDays

export function resolveEffectiveDmRetentionDays(raw: DmRetentionDays | undefined): number | null {
  if (raw === null) return null
  if (raw === undefined) return PLATFORM_DEFAULT_DM_RETENTION_DAYS
  return raw
}

export const DM_RETENTION_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: '180', label: '6 months' },
  { value: '365', label: '12 months (default)' },
  { value: '730', label: '24 months' },
  { value: '', label: 'Keep until I delete them' },
]

export function parseDmRetentionSelectValue(value: string): DmRetentionDays {
  if (!value.trim()) return null
  const n = Number.parseInt(value, 10)
  return DM_RETENTION_USER_OPTIONS.includes(n as (typeof DM_RETENTION_USER_OPTIONS)[number])
    ? (n as DmRetentionDays)
    : 365
}

export function formatDmRetentionLabel(days: DmRetentionDays | undefined): string {
  if (days === null) return 'Keep until I delete them'
  if (days === undefined || days === 365) return '12 months (default)'
  if (days === 180) return '6 months'
  if (days === 730) return '24 months'
  return `${days} days`
}

export type UserAutoDeleteDays = (typeof USER_AUTO_DELETE_DAY_OPTIONS)[number]

export const userAutoDeleteDaysSchema = z
  .union([
    z.literal(null),
    z.literal(7),
    z.literal(10),
    z.literal(30),
    z.literal(90),
    z.literal(365),
  ])
  .default(null)

/** Overwrite passes applied to deletable text fields before row removal (where supported). */
export const SECURE_DELETE_PASS_COUNT = 7

export type RetentionPolicyConfig = {
  securityLogRetentionDays: number
  rawIpRetentionDays: number
  deletedAccountPurgeDays: number
  moderationRecordRetentionDays: number
  backupSnapshotRetentionDays: number
  platformDmRetentionDays: number
  deletedConversationPurgeDays: number
  notificationRetentionDays: number
  rejectedMediaRetentionDays: number
  secureDeletePassCount: number
}

export function formatUserAutoDeleteLabel(days: UserAutoDeleteDays | null): string {
  if (days === null) return 'Keep until I delete or close my account'
  if (days === 7) return '7 days'
  if (days === 10) return '10 days'
  if (days === 30) return '30 days'
  if (days === 90) return '90 days'
  return '1 year'
}

export const USER_AUTO_DELETE_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: formatUserAutoDeleteLabel(null) },
  ...USER_AUTO_DELETE_DAY_OPTIONS.map((days) => ({
    value: String(days),
    label: formatUserAutoDeleteLabel(days),
  })),
]

export function parseUserAutoDeleteSelectValue(value: string): UserAutoDeleteDays | null {
  if (!value.trim()) return null
  const n = Number.parseInt(value, 10)
  return USER_AUTO_DELETE_DAY_OPTIONS.includes(n as UserAutoDeleteDays) ? (n as UserAutoDeleteDays) : null
}
function parseDays(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function loadRetentionPolicy(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : {}
): RetentionPolicyConfig {
  return {
    securityLogRetentionDays: parseDays(
      env.SECURITY_LOG_RETENTION_DAYS,
      RETENTION_DEFAULTS.securityLogRetentionDays
    ),
    rawIpRetentionDays: parseDays(env.RAW_IP_RETENTION_DAYS, RETENTION_DEFAULTS.rawIpRetentionDays),
    deletedAccountPurgeDays: parseDays(
      env.DELETED_ACCOUNT_PURGE_DAYS,
      RETENTION_DEFAULTS.deletedAccountPurgeDays
    ),
    moderationRecordRetentionDays: parseDays(
      env.MODERATION_RECORD_RETENTION_DAYS,
      RETENTION_DEFAULTS.moderationRecordRetentionDays
    ),
    backupSnapshotRetentionDays: parseDays(
      env.BACKUP_SNAPSHOT_RETENTION_DAYS,
      RETENTION_DEFAULTS.backupSnapshotRetentionDays
    ),
    platformDmRetentionDays: parseDays(
      env.PLATFORM_DM_RETENTION_DAYS,
      RETENTION_DEFAULTS.platformDmRetentionDays
    ),
    deletedConversationPurgeDays: parseDays(
      env.DELETED_CONVERSATION_PURGE_DAYS,
      RETENTION_DEFAULTS.deletedConversationPurgeDays
    ),
    notificationRetentionDays: parseDays(
      env.NOTIFICATION_RETENTION_DAYS,
      RETENTION_DEFAULTS.notificationRetentionDays
    ),
    rejectedMediaRetentionDays: parseDays(
      env.REJECTED_MEDIA_RETENTION_DAYS,
      RETENTION_DEFAULTS.rejectedMediaRetentionDays
    ),
    secureDeletePassCount: SECURE_DELETE_PASS_COUNT,
  }
}
