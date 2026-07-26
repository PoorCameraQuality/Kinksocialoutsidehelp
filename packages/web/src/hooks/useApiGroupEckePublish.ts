/**
 * Group organizer ECKE publish control plane (overview / preview / write).
 *
 * Paths (credentials, group moderator):
 * - `GET /api/v1/groups/:groupId/ecke-publish`
 * - `GET …/ecke-publish/preview?sourceKind&sourceId`
 * - `POST …/ecke-publish/{publish|sync|unpublish}`
 */
import { useCallback, useEffect, useState } from 'react'
import type { EckePreviewData } from '@/components/ecke/EckePublishPreviewDrawer'

export type GroupEckeOverviewCard = {
  section: string
  sourceKind?: string
  sourceId?: string
  title: string
  supportState: string
  eligible?: boolean
  reason?: string
  status?: EckePreviewData['status']
  summary?: string
  plannedMessage?: string
  preview?: EckePreviewData
  writeEnabled?: boolean
  publishRestrictedMessage?: string
}

export type GroupEckeOverviewResponse = {
  groupId: string
  groupSlug: string
  groupName: string
  bridgeConnected: boolean
  readOnlyPass: boolean
  passNotice: string
  cards: GroupEckeOverviewCard[]
  history: Array<{
    targetKind: string
    externalSlug: string
    status: string
    lastPublishedAt: string | null
    lastError: string | null
    lastPreviewAt: string | null
  }>
}

export type UseApiGroupEckePublishResult = {
  data: GroupEckeOverviewResponse | null
  loading: boolean
  loadError: string | null
  reloadOverview: () => Promise<void>
  loadPreview: (sourceKind: string, sourceId: string) => Promise<EckePreviewData | null>
  runWriteAction: (
    action: 'publish' | 'sync' | 'unpublish',
    sourceKind: string,
    sourceId: string,
  ) => Promise<boolean>
}

export function useApiGroupEckePublish(groupId: string): UseApiGroupEckePublishResult {
  const [data, setData] = useState<GroupEckeOverviewResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reloadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}/ecke-publish`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setLoadError(
          r.status === 403
            ? 'You need moderator access to view ECKE publish.'
            : 'Could not load ECKE publish overview.',
        )
        setData(null)
        return
      }
      setData((await r.json()) as GroupEckeOverviewResponse)
    } catch {
      setLoadError('Network error loading ECKE publish overview.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void reloadOverview()
  }, [reloadOverview])

  const loadPreview = useCallback(
    async (sourceKind: string, sourceId: string): Promise<EckePreviewData | null> => {
      const params = new URLSearchParams({ sourceKind, sourceId })
      const r = await fetch(
        `/api/v1/groups/${encodeURIComponent(groupId)}/ecke-publish/preview?${params.toString()}`,
        { credentials: 'include' },
      )
      if (!r.ok) return null
      return (await r.json()) as EckePreviewData
    },
    [groupId],
  )

  const runWriteAction = useCallback(
    async (
      action: 'publish' | 'sync' | 'unpublish',
      sourceKind: string,
      sourceId: string,
    ): Promise<boolean> => {
      const r = await fetch(
        `/api/v1/groups/${encodeURIComponent(groupId)}/ecke-publish/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceKind, sourceId }),
        },
      )
      return r.ok
    },
    [groupId],
  )

  return { data, loading, loadError, reloadOverview, loadPreview, runWriteAction }
}
