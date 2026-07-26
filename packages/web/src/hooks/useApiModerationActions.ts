import { useCallback, useEffect, useState } from 'react'

export type ModerationActionRow = {
  id: string
  actionType: string
  targetType: string
  targetId: string
  status: string
  proposedByUserId: string
  proposerUsername: string
  requiredApprovals: number
  overrideByUserId: string | null
  overrideReason: string | null
  createdAt: string
  approvalCount: number
}

export function useApiModerationActions(enabled: boolean, statusFilter = 'PENDING_APPROVAL') {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<ModerationActionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setStatus('ready')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(
        `/api/v1/moderation/actions?status=${encodeURIComponent(statusFilter)}`,
        { credentials: 'include' }
      )
      if (!r.ok) {
        setError(`Could not load actions (${r.status})`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { items?: ModerationActionRow[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setError('Network error')
      setItems([])
      setStatus('error')
    }
  }, [enabled, statusFilter])

  useEffect(() => {
    void reload()
  }, [reload])

  const approve = useCallback(async (actionId: string) => {
    const r = await fetch(`/api/v1/moderation/actions/${encodeURIComponent(actionId)}/approve`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'Approve failed')
    }
    await reload()
  }, [reload])

  const reject = useCallback(
    async (actionId: string, note?: string) => {
      const r = await fetch(`/api/v1/moderation/actions/${encodeURIComponent(actionId)}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (!r.ok) throw new Error('Reject failed')
      await reload()
    },
    [reload]
  )

  const executeNow = useCallback(
    async (actionId: string, reason: string) => {
      const r = await fetch(`/api/v1/moderation/actions/${encodeURIComponent(actionId)}/execute-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'Override failed')
      }
      await reload()
    },
    [reload]
  )

  return { status, items, error, reload, approve, reject, executeNow }
}
