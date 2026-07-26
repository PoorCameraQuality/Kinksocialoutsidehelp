import { useCallback, useEffect, useState } from 'react'

export type ModerationReportContext = {
  targetLabel: string
  excerpt: string | null
  href: string | null
  scopeType: string
  scopeName: string | null
  scopeKey: string | null
  contentMissing: boolean
}

export type ModerationReportRow = {
  id: string
  targetType: string
  targetId: string
  category: string
  status: string
  createdAt: string
  reporterId: string
  reporterUsername: string
  context: ModerationReportContext
  body?: string | null
  meta?: Record<string, unknown> | null
}

export type ModerationSummary = {
  openReports: number
  openProfileFlags: number
}

type ListFilters = {
  status?: string
  targetType?: string
}

export function useApiModerationReports(enabled: boolean, filters: ListFilters) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<ModerationReportRow[]>([])
  const [summary, setSummary] = useState<ModerationSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setStatus('ready')
      setItems([])
      setSummary(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.targetType) params.set('targetType', filters.targetType)
      const qs = params.toString()

      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/moderation/reports${qs ? `?${qs}` : ''}`, { credentials: 'include' }),
        fetch('/api/v1/moderation/summary', { credentials: 'include' }),
      ])

      if (listRes.status === 403 || summaryRes.status === 403) {
        setStatus('error')
        setError('Forbidden. Not a platform moderator.')
        setItems([])
        return
      }
      if (!listRes.ok) {
        setStatus('error')
        setError(`Could not load reports (HTTP ${listRes.status}).`)
        setItems([])
        return
      }

      const listData = (await listRes.json()) as { items?: ModerationReportRow[] }
      setItems(listData.items ?? [])

      if (summaryRes.ok) {
        setSummary((await summaryRes.json()) as ModerationSummary)
      }

      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading moderation queue.')
      setItems([])
    }
  }, [enabled, filters.status, filters.targetType])

  useEffect(() => {
    void reload()
  }, [reload])

  const patchReport = useCallback(
    async (reportId: string, body: { status: string; note?: string }) => {
      const r = await fetch(`/api/v1/moderation/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Update failed (${r.status})`)
      }
      await reload()
    },
    [reload]
  )

  const loadDetail = useCallback(async (reportId: string): Promise<ModerationReportRow | null> => {
    const r = await fetch(`/api/v1/moderation/reports/${encodeURIComponent(reportId)}`, {
      credentials: 'include',
    })
    if (!r.ok) return null
    const data = (await r.json()) as { report?: ModerationReportRow }
    return data.report ?? null
  }, [])

  const postReportAction = useCallback(
    async (
      reportId: string,
      body: {
        action: 'delete_content' | 'suspend_subject' | 'delete_and_suspend'
        note: string
        preserveEvidence?: boolean
        hardDelete?: boolean
        suspendPermanent?: boolean
      },
    ) => {
      const r = await fetch(`/api/v1/moderation/reports/${encodeURIComponent(reportId)}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Action failed (${r.status})`)
      }
      await reload()
    },
    [reload],
  )

  return { status, items, summary, error, reload, patchReport, loadDetail, postReportAction }
}
