import { useCallback, useEffect, useState } from 'react'

export type MyReportRow = {
  id: string
  reportId?: string
  caseId?: string
  targetType: string
  targetId: string
  category: string
  policyReason?: string
  status: string
  queue?: string
  createdAt: string
}

export type UseApiMyReportsResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  reports: MyReportRow[]
  error: string | null
  reload: () => void
}

function mapCanonicalRow(row: {
  reportId: string
  caseId: string
  targetType: string
  targetId: string
  policyReason: string
  status: string
  queue: string
  createdAt: string
}): MyReportRow {
  return {
    id: row.reportId,
    reportId: row.reportId,
    caseId: row.caseId,
    targetType: row.targetType,
    targetId: row.targetId,
    category: row.policyReason,
    policyReason: row.policyReason,
    status: row.status,
    queue: row.queue,
    createdAt: row.createdAt,
  }
}

export function useApiMyReports(enabled: boolean): UseApiMyReportsResult {
  const [status, setStatus] = useState<UseApiMyReportsResult['status']>('idle')
  const [reports, setReports] = useState<MyReportRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setStatus('ready')
      setReports([])
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const canonical = await fetch('/api/v1/me/moderation/reports', { credentials: 'include' })
      if (canonical.status === 401) {
        setStatus('ready')
        setReports([])
        return
      }
      if (canonical.ok) {
        const data = (await canonical.json()) as {
          reports?: Array<{
            reportId: string
            caseId: string
            targetType: string
            targetId: string
            policyReason: string
            status: string
            queue: string
            createdAt: string
          }>
        }
        setReports((data.reports ?? []).map(mapCanonicalRow))
        setStatus('ready')
        return
      }

      const legacy = await fetch('/api/v1/me/reports', { credentials: 'include' })
      if (legacy.status === 401) {
        setStatus('ready')
        setReports([])
        return
      }
      if (legacy.status === 503) {
        setStatus('error')
        setError('Reports require database mode.')
        setReports([])
        return
      }
      if (!legacy.ok) {
        setStatus('error')
        setError(`Could not load reports (HTTP ${legacy.status}).`)
        setReports([])
        return
      }
      const data = (await legacy.json()) as { reports?: MyReportRow[] }
      setReports(data.reports ?? [])
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading reports.')
      setReports([])
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, reports, error, reload }
}
