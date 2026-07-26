import { useCallback, useEffect, useState } from 'react'

import EckePublishPanel from '@/components/ecke/EckePublishPanel'
import type { EckePreviewData } from '@/components/ecke/EckePublishPreviewDrawer'
import { ECKE_PANEL_ACCESS_MESSAGES, ECKE_PUBLISH_RESTRICTED_MESSAGES } from '@/components/ecke/ecke-publish-copy'

type Props = {
  vendorProfileId: string
}

type StatusResponse = {
  eligible: boolean
  reason?: string
  status: EckePreviewData['status']
  eckePublicUrl?: string | null
  eckePublicUrlKnown?: boolean
  staleNotice?: string | null
  actions?: EckePreviewData['actions']
}

export default function VendorEckePanel({ vendorProfileId }: Props) {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setAccessError(null)
    const params = new URLSearchParams({
      sourceKind: 'vendor_profile',
      sourceId: vendorProfileId,
    })
    const r = await fetch(`/api/v1/ecke-publish/status?${params.toString()}`, { credentials: 'include' })
    if (r.status === 403) {
      setStatusData(null)
      setAccessError(
        ECKE_PANEL_ACCESS_MESSAGES.vendor_profile ??
          'Only the vendor owner or co-owner can publish this vendor profile to ECKE.',
      )
      return
    }
    if (!r.ok) {
      setStatusData(null)
      setAccessError('Could not load ECKE publish status.')
      return
    }
    setStatusData((await r.json()) as StatusResponse)
  }, [vendorProfileId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const loadPreview = useCallback(
    async (sourceKind: string, sourceId: string): Promise<EckePreviewData | null> => {
      const params = new URLSearchParams({ sourceKind, sourceId })
      const r = await fetch(`/api/v1/ecke-publish/preview?${params.toString()}`, { credentials: 'include' })
      if (!r.ok) return null
      return (await r.json()) as EckePreviewData
    },
    [],
  )

  const runWriteAction = useCallback(
    async (action: 'publish' | 'sync' | 'unpublish', sourceKind: string, sourceId: string): Promise<boolean> => {
      const r = await fetch(`/api/v1/ecke-publish/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKind, sourceId }),
      })
      return r.ok
    },
    [],
  )

  if (accessError) {
    return (
      <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-6 text-center">
        <p className="text-dc-text-muted">{accessError}</p>
      </div>
    )
  }

  const canPublish = statusData?.actions?.publish ?? false

  return (
    <EckePublishPanel
      title="East Coast Kink Events"
      sourceKind="vendor_profile"
      sourceId={vendorProfileId}
      supportState="active_existing"
      eligible={statusData?.eligible}
      reason={statusData?.reason}
      status={statusData?.status ?? 'never'}
      staleNotice={statusData?.staleNotice}
      eckePublicUrl={statusData?.eckePublicUrl}
      eckePublicUrlKnown={statusData?.eckePublicUrlKnown}
      writeEnabled={canPublish}
      publishRestrictedMessage={
        !canPublish ?
          (statusData?.reason ?? ECKE_PUBLISH_RESTRICTED_MESSAGES.vendor_profile)
        : undefined
      }
      writeKind="vendor_profile"
      onLoadPreview={loadPreview}
      onPublish={(sourceKind, sourceId) => runWriteAction('publish', sourceKind, sourceId)}
      onSync={(sourceKind, sourceId) => runWriteAction('sync', sourceKind, sourceId)}
      onUnpublish={(sourceKind, sourceId) => runWriteAction('unpublish', sourceKind, sourceId)}
      onActionComplete={() => void loadStatus()}
    />
  )
}
