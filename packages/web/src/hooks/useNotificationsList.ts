import { useCallback, useEffect, useMemo, useState } from 'react'
import { mockNotifications } from '@/data/mock-data'
import {
  loadReadIdsFromStorage,
  mapApiToDisplay,
  saveReadIdsToStorage,
  type ApiNotificationRow,
} from '@/lib/notifications-display'
import { CONVERSATION_READ_EVENT } from '@/lib/mark-conversation-read'
import { useAuth } from '@/contexts/AuthContext'

export function useNotificationsList() {
  const { isAuthenticated, isFallback, status } = useAuth()
  const [apiItems, setApiItems] = useState<ReturnType<typeof mapApiToDisplay>[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mockReadIds, setMockReadIds] = useState<Set<string>>(() => new Set())
  const [storageReady, setStorageReady] = useState(false)

  const useApi = isAuthenticated && !isFallback

  useEffect(() => {
    setMockReadIds(loadReadIdsFromStorage())
    setStorageReady(true)
  }, [])

  const load = useCallback(async () => {
    if (!useApi) {
      setApiItems(null)
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch('/api/v1/notifications', { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLoadError(j.error ?? `Could not load notifications (HTTP ${r.status})`)
        setApiItems(null)
        return
      }
      const data = (await r.json()) as { items: ApiNotificationRow[] }
      setApiItems((data.items ?? []).map(mapApiToDisplay))
    } catch {
      setLoadError('Failed to load notifications')
      setApiItems(null)
    } finally {
      setLoading(false)
    }
  }, [useApi])

  useEffect(() => {
    if (status !== 'ready') return
    void load()
  }, [status, load])

  useEffect(() => {
    const onConversationRead = () => {
      void load()
    }
    window.addEventListener(CONVERSATION_READ_EVENT, onConversationRead)
    return () => window.removeEventListener(CONVERSATION_READ_EVENT, onConversationRead)
  }, [load])

  const items = useMemo(() => {
    if (useApi) return apiItems ?? []
    return mockNotifications.map((n) => ({ ...n, read: n.read || mockReadIds.has(n.id) }))
  }, [useApi, apiItems, mockReadIds])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])

  const markRead = useCallback(
    async (id: string) => {
      if (useApi && apiItems !== null) {
        setApiItems((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, read: true } : n)) : prev))
        try {
          await fetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
            method: 'POST',
            credentials: 'include',
          })
          await load()
        } catch {
          await load()
        }
        return
      }
      setMockReadIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        saveReadIdsToStorage(next)
        return next
      })
    },
    [useApi, apiItems, load],
  )

  const markAllRead = useCallback(async () => {
    if (useApi && apiItems !== null) {
      setApiItems((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev))
      try {
        await fetch('/api/v1/notifications/read-all', { method: 'POST', credentials: 'include' })
        await load()
      } catch {
        await load()
      }
      return
    }
    const all = new Set(mockNotifications.map((n) => n.id))
    setMockReadIds(all)
    saveReadIdsToStorage(all)
  }, [useApi, apiItems, load])

  const dismissLoadError = useCallback(() => setLoadError(null), [])

  const syncUnavailable = useApi && apiItems === null && !loading

  return {
    items,
    unreadCount,
    loadError,
    loading,
    storageReady,
    apiBacked: useApi && apiItems !== null && !loadError,
    syncUnavailable,
    useApi,
    load,
    dismissLoadError,
    markRead,
    markAllRead,
  }
}
