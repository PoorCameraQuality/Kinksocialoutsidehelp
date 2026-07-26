import { useCallback, useEffect, useState } from 'react'

export type TicketHistoryItem = {
  id: string
  grantedAt: string
  paidConfirmed: boolean
  attendingConfirmed: boolean
  role: string
  convention: {
    id: string
    slug: string
    name: string
    startsAt: string
    endsAt: string
    organizationSlug: string | null
  }
  ticketPurchaseUrl: string | null
  ticketingProvider: string | null
  expectedCostText: string | null
}

export type UseApiTicketHistoryResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: TicketHistoryItem[]
  error: string | null
  reload: () => void
}

export function useApiTicketHistory(enabled: boolean): UseApiTicketHistoryResult {
  const [status, setStatus] = useState<UseApiTicketHistoryResult['status']>('idle')
  const [items, setItems] = useState<TicketHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setStatus('ready')
      setItems([])
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch('/api/v1/me/ticket-history', { credentials: 'include' })
      if (r.status === 401) {
        setStatus('ready')
        setItems([])
        return
      }
      if (r.status === 503) {
        setStatus('error')
        setError('Ticket history requires database mode.')
        setItems([])
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(`Could not load payment history (HTTP ${r.status}).`)
        setItems([])
        return
      }
      const data = (await r.json()) as { items?: TicketHistoryItem[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading payment history.')
      setItems([])
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, items, error, reload }
}
