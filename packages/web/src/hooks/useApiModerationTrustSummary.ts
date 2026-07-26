import { useCallback, useEffect, useState } from 'react'

export type TrustSummaryUnavailable = {
  status: 'unavailable'
  reason: string
}

export type MessagingHealthSummary = {
  status: 'available'
  state: string
  outboundMessageCount: number
  uniqueRecipientCount: number
  newConversationCount: number
  activeRestriction: boolean
}

export type IncidentClusterSummary = {
  status: 'available'
  openIncidents: number
  totalLinkedReports: number
  recentIncidents?: Array<{
    id: string
    status: string
    policyReason: string | null
    linkedReportCount: number
    platformEscalated: boolean
  }>
}

export type AppealsSummary = {
  status: 'available'
  openScopedAppeals: number
  openPlatformAppeals: number
}

export type ReputationIntegritySignal = {
  id: string
  signalType: string
  sourceType: string
  sourceId: string | null
  visibility: string
  status: string
  modReviewStatus: string
  severity: string | null
  scopeType: string | null
  scopeId: string | null
  createdAt: string
  expiresAt: string | null
  metadata: Record<string, unknown>
  label: string
}

export type TrustSignalsSummary = {
  status: 'available'
  platformMod: number
  scopedMod: number
  siteAdminOnly: number
}

export type ReputationIntegritySignalsPayload =
  | { status: 'available'; items: ReputationIntegritySignal[] }
  | TrustSummaryUnavailable

export type ModeratorTrustSummary = {
  userId: string
  username: string
  account: {
    createdAt: string
    accountAgeDays: number
    ageAffirmed: boolean
    profileComplete: boolean | null
    hasProfilePhoto: boolean
  }
  positiveSignals: {
    acceptedReferences: number
    countedReferencesForLevel: number
    conventionRegistrations: number
    staffConfirmedCheckIns: number
    verifiedPresenterCredits: number
    verifiedVendorCredits: number
    organizerRoles: number
  }
  moderationContext: {
    openCases: number
    closedNoViolationCases: number
    actionedCases: number
    profileReviewFlags: number
    scopeBansTotal: number
    activeScopeBans: number
    restrictedQueueCases: number | null
    blockedByUsersCount: number
    mutedByUsersCount: number
  }
  restrictions: {
    identityBanActive: boolean | null
  }
  communityTrust: {
    level: string
    headline: string
    badgeCount: number
  } | null
  messagingHealth: MessagingHealthSummary | TrustSummaryUnavailable
  incidentClustering: IncidentClusterSummary | TrustSummaryUnavailable
  appeals: AppealsSummary | TrustSummaryUnavailable
  trustSignals: TrustSignalsSummary | TrustSummaryUnavailable
  reputationIntegritySignals: ReputationIntegritySignalsPayload
  warnings: string[]
}

type State = 'idle' | 'loading' | 'ready' | 'error' | 'forbidden'

export function useApiModerationTrustSummary(userId: string | null | undefined, enabled: boolean) {
  const [status, setStatus] = useState<State>('idle')
  const [data, setData] = useState<ModeratorTrustSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !userId) {
      setStatus('idle')
      setData(null)
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(`/api/v1/moderation/users/${encodeURIComponent(userId)}/trust-summary`, {
        credentials: 'include',
      })
      if (r.status === 403) {
        setStatus('forbidden')
        setData(null)
        setError('Forbidden')
        return
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setData(null)
        setError(j.error ?? `HTTP ${r.status}`)
        return
      }
      setData((await r.json()) as ModeratorTrustSummary)
      setStatus('ready')
    } catch {
      setStatus('error')
      setData(null)
      setError('Network error')
    }
  }, [enabled, userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, data, error, reload }
}
