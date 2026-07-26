import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type ActivityInboxKind = 'notification' | 'message' | 'connection_request' | 'feed'

export type ActivityInboxItem = {
  id: string
  kind: ActivityInboxKind
  title: string
  body: string | null
  href: string
  unread: boolean
  createdAt: string
}

export type ActivityInboxFilter = 'all' | 'messages' | 'notifications' | 'requests'

export function useApiActivityInbox(filter: ActivityInboxFilter = 'all') {
  const { isAuthenticated, isFallback } = useAuth()
  const [items, setItems] = useState<ActivityInboxItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated || isFallback) {
      setItems(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams({ limit: '50' })
      if (filter !== 'all') {
        p.set('filter', filter === 'notifications' ? 'notifications' : filter)
      }
      const r = await fetch(`/api/v1/activity/inbox?${p}`, { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `Could not load activity (HTTP ${r.status})`)
        setItems(null)
        return
      }
      const d = (await r.json()) as { items?: ActivityInboxItem[] }
      setItems(d.items ?? [])
    } catch {
      setError('Failed to load activity')
      setItems(null)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isFallback, filter])

  useEffect(() => {
    void load()
  }, [load])

  const unreadCount = (items ?? []).filter((i) => i.unread).length

  return { items, error, loading, unreadCount, reload: load }
}
