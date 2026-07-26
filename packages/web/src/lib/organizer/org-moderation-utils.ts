const MANAGE_ROLES = new Set(['OWNER', 'ADMIN', 'MODERATOR'])

export function canManageOrgModeration(orgRole: string | null): boolean {
  if (!orgRole) return false
  return MANAGE_ROLES.has(orgRole)
}

export function canViewOrgModerationAudit(orgRole: string | null): boolean {
  if (!orgRole) return false
  return orgRole === 'OWNER' || orgRole === 'ADMIN'
}

export function formatReportTargetType(targetType: string): string {
  const map: Record<string, string> = {
    forum_post: 'Forum post',
    forum_thread: 'Forum thread',
    org_channel_message: 'Chat message',
    event: 'Event',
    user_profile: 'Profile',
    review: 'Review',
    platform_organization: 'Organization (platform)',
  }
  return map[targetType] ?? targetType.replace(/_/g, ' ')
}

export function formatReportCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

export function formatReportStatus(status: string): string {
  const map: Record<string, string> = {
    OPEN: 'Open',
    TRIAGED: 'In review',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed',
  }
  return map[status] ?? status
}

export function formatAuditVerb(verb: string): string {
  return verb
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function responseStatusLabel(openReportCount: number): { label: string; healthy: boolean } {
  if (openReportCount === 0) return { label: 'All clear', healthy: true }
  if (openReportCount <= 3) return { label: 'Needs review', healthy: false }
  return { label: 'Attention needed', healthy: false }
}

export function communityRulesLabel(hasWelcomeOrFaq: boolean): { label: string; configured: boolean } {
  if (hasWelcomeOrFaq) return { label: 'Configured', configured: true }
  return { label: 'Not set', configured: false }
}

export function countRecentAuditActions(
  items: { createdAt: string }[],
  withinDays = 7,
): number {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return items.filter((i) => new Date(i.createdAt).getTime() >= cutoff).length
}

export const MODERATION_PRINCIPLES = [
  'Respond consistently and fairly',
  'Keep notes clear and factual',
  'Escalate serious safety issues',
  'Separate member conflict from platform safety issues',
  'Use bans carefully and document important decisions',
] as const
