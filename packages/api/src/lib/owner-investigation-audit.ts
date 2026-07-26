import type { FastifyRequest } from 'fastify'
import { clientIpLabel } from './client-ip.js'
import { recordModerationAudit } from './moderation-audit.js'

export type OwnerInvestigationSection =
  | 'account_overview'
  | 'sensitive_account'
  | 'activity_timeline'
  | 'dm_list'
  | 'dm_messages'
  | 'moderation'
  | 'media'

export async function recordOwnerInvestigationAccess(params: {
  actorUserId: string
  targetUserId: string
  section: OwnerInvestigationSection
  reason: string
  req: FastifyRequest
  success: boolean
  recordsViewed?: number
  dmContentsOpened?: boolean
  exportOccurred?: boolean
  targetUsername?: string | null
}): Promise<void> {
  const userAgent =
    typeof params.req.headers['user-agent'] === 'string' ? params.req.headers['user-agent'].slice(0, 512) : null

  await recordModerationAudit({
    actorUserId: params.actorUserId,
    scopeType: 'platform',
    scopeId: null,
    verb: 'owner_investigation.access',
    targetType: 'user',
    targetId: params.targetUserId,
    payload: {
      section: params.section,
      reason: params.reason,
      targetUsername: params.targetUsername ?? null,
      requestIp: clientIpLabel(params.req).slice(0, 64),
      userAgent,
      success: params.success,
      recordsViewed: params.recordsViewed ?? 0,
      dmContentsOpened: params.dmContentsOpened ?? false,
      exportOccurred: params.exportOccurred ?? false,
    },
  })
}
