import { useCallback, useEffect, useState } from 'react'

import EckePublishPanel from '@/components/ecke/EckePublishPanel'
import type { EckePreviewData } from '@/components/ecke/EckePublishPreviewDrawer'

type Props = {
  articleId: string
}

type StatusResponse = {
  eligible: boolean
  reason?: string
  status: EckePreviewData['status']
  eckePublicUrl?: string | null
  eckePublicUrlKnown?: boolean
  staleNotice?: string | null
}

export default function EducationArticleEckePanel({ articleId }: Props) {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null)

  const loadStatus = useCallback(async () => {
    const params = new URLSearchParams({
      sourceKind: 'education_article',
      sourceId: articleId,
    })
    const r = await fetch(`/api/v1/ecke-publish/status?${params.toString()}`, { credentials: 'include' })
    if (!r.ok) {
      setStatusData(null)
      return
    }
    setStatusData((await r.json()) as StatusResponse)
  }, [articleId])

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

  return (
    <EckePublishPanel
      title="East Coast Kink Events"
      sourceKind="education_article"
      sourceId={articleId}
      supportState="active_existing"
      eligible={statusData?.eligible}
      reason={statusData?.reason}
      status={statusData?.status ?? 'never'}
      staleNotice={statusData?.staleNotice}
      eckePublicUrl={statusData?.eckePublicUrl}
      eckePublicUrlKnown={statusData?.eckePublicUrlKnown}
      writeEnabled
      writeKind="education_article"
      onLoadPreview={loadPreview}
      onPublish={(sourceKind, sourceId) => runWriteAction('publish', sourceKind, sourceId)}
      onSync={(sourceKind, sourceId) => runWriteAction('sync', sourceKind, sourceId)}
      onUnpublish={(sourceKind, sourceId) => runWriteAction('unpublish', sourceKind, sourceId)}
      onActionComplete={() => void loadStatus()}
    />
  )
}
