import { POLICY_REASON_LABELS, type PolicyReason } from '@c2k/shared'

export const PLATFORM_QUEUE_LABELS: Record<string, string> = {
  GENERAL_REVIEW: 'General review',
  MEDIA_REVIEW: 'Media review',
  NCII_URGENT: 'NCII urgent',
  MINOR_SAFETY_RESTRICTED: 'Minor safety (restricted)',
  SPAM_ABUSE: 'Spam & abuse',
  APPEALS: 'Appeals',
}

/** Solid-card severity accents — border emphasis, theme-backed surfaces. */
export const PLATFORM_SEVERITY_TILE_STYLES: Record<string, string> = {
  CRITICAL: 'border-l-4 border-l-red-500 text-dc-text',
  HIGH: 'border-l-4 border-l-amber-500 text-dc-text',
  MEDIUM: 'border-l-4 border-l-yellow-500 text-dc-text',
  LOW: 'text-dc-text-muted',
}

export function labelModerationQueue(queue: string): string {
  return PLATFORM_QUEUE_LABELS[queue] ?? queue.replace(/_/g, ' ').toLowerCase()
}

export function labelModerationReason(reason: string): string {
  return POLICY_REASON_LABELS[reason as PolicyReason] ?? reason.replace(/_/g, ' ').toLowerCase()
}

export function labelModerationStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase()
}

export function moderationSeverityBadgeClass(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border border-red-500/35 bg-dc-surface-muted text-red-300'
    case 'HIGH':
      return 'border border-amber-500/35 bg-dc-surface-muted text-amber-200'
    case 'MEDIUM':
      return 'border border-yellow-500/30 bg-dc-surface-muted text-yellow-100'
    default:
      return 'border border-dc-border bg-dc-surface-muted text-dc-muted'
  }
}
