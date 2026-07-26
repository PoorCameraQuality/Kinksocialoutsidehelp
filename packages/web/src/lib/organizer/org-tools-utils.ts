import { buildOrgProgramRows, type OrgScheduleConvention, type OrgScheduleEvent } from '@/lib/organizer/org-schedule-programs'

export type EckePublishSummary = {
  bridgeConnected: boolean
  listingStatus: 'never' | 'draft' | 'published' | 'error' | 'stale' | null
  externalSlug: string | null
  lastPublishedAt: string | null
  lastPreviewAt: string | null
  loadError: string | null
}

export function eckeStatusLabel(summary: EckePublishSummary | null): {
  label: string
  tone: 'success' | 'warning' | 'neutral' | 'danger'
} {
  if (!summary || summary.loadError) return { label: 'Unavailable', tone: 'neutral' }
  if (!summary.bridgeConnected) return { label: 'Preview only', tone: 'warning' }
  if (summary.listingStatus === 'published') return { label: 'Published', tone: 'success' }
  if (summary.listingStatus === 'draft') return { label: 'Preview ready', tone: 'warning' }
  if (summary.listingStatus === 'stale') return { label: 'Changes pending', tone: 'warning' }
  if (summary.listingStatus === 'error') return { label: 'Publish error', tone: 'danger' }
  return { label: 'Not reviewed yet', tone: 'warning' }
}

export function canUseOrgPublishActions(viewerRole: string | null): boolean {
  return viewerRole === 'OWNER' || viewerRole === 'ADMIN'
}

/** Kink Social public program listing - org moderator+ (not STAFF volunteers). */
export function canPublishConventionProgram(viewerRole: string | null): boolean {
  if (!viewerRole || viewerRole === 'STAFF') return false
  return viewerRole === 'MODERATOR' || canUseOrgPublishActions(viewerRole)
}

/** ECKE outbound publish - org owner/admin or convention full admin (API requires isFullAdmin). */
export function canEckePublishConvention(viewerRole: string | null, isFullAdmin = false): boolean {
  return canUseOrgPublishActions(viewerRole) || isFullAdmin
}

export function canManageConventionTools(viewerRole: string | null): boolean {
  return viewerRole === 'OWNER' || viewerRole === 'ADMIN' || viewerRole === 'MODERATOR'
}

export function buildPublishingChecklist(input: {
  displayName: string
  visibility: string
  hasBranding: boolean
  hasWelcome: boolean
  hasPrograms: boolean
  eckePreviewBuilt: boolean
}): { label: string; done: boolean }[] {
  return [
    { label: 'Organization name reviewed', done: Boolean(input.displayName.trim()) },
    { label: 'Public hub visibility set', done: Boolean(input.visibility) },
    { label: 'Branding added', done: input.hasBranding },
    { label: 'Public content reviewed', done: input.hasWelcome },
    { label: 'Events or conventions created', done: input.hasPrograms },
    { label: 'Publish preview built', done: input.eckePreviewBuilt },
  ]
}

export { buildOrgProgramRows }
export type { OrgScheduleConvention, OrgScheduleEvent }
