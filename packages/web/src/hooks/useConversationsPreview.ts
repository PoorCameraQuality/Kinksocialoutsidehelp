import { useCallback, useEffect, useMemo, useState } from 'react'
import { mockConversations } from '@/data/mock-data'
import { shortTime } from '@/lib/format-time'
import { useAuth } from '@/contexts/AuthContext'
import { CONVERSATION_READ_EVENT } from '@/lib/mark-conversation-read'

export type ConversationPreviewRow = {
  id: string
  title: string
  lastMessageBody: string
  lastMessageAtLabel: string
  unread: boolean
}

export function useConversationsPreview() {
  const { isAuthenticated, status } = useAuth()
  const [apiItems, setApiItems] = useState<ConversationPreviewRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const mockRows = useMemo<ConversationPreviewRow[]>(
    () =>
      mockConversations.map((c) => ({
        id: c.id,
        title: c.name,
        lastMessageBody: c.lastMessage,
        lastMessageAtLabel: c.date,
        unread: !!c.unread,
      })),
    []
  )

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setApiItems(null)
      return
    }
    setLoadError(null)
    try {
      const r = await fetch('/api/v1/conversations?folder=main', { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLoadError(j.error ?? `HTTP ${r.status}`)
        setApiItems(null)
        return
      }
      const data = (await r.json()) as {
        items: Array<{
          id: string
          title: string
          lastMessageBody: string | null
          lastMessageAt: string | null
          unreadCount: number
        }>
      }
      setApiItems(
        (data.items ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          lastMessageBody: item.lastMessageBody ?? 'No messages yet',
          lastMessageAtLabel: item.lastMessageAt ? shortTime(item.lastMessageAt) : '',
          unread: (item.unreadCount ?? 0) > 0,
        }))
      )
    } catch {
      setLoadError('Failed to load conversations')
      setApiItems(null)
    }
  }, [isAuthenticated])

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
    if (isAuthenticated && apiItems !== null) return apiItems
    return mockRows
  }, [isAuthenticated, apiItems, mockRows])

  const unreadCount = useMemo(() => items.filter((c) => c.unread).length, [items])

  return { items, unreadCount, loadError, load }
}
