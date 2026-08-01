import { useCallback, useEffect, useState } from 'react'

export type ChatRoomChannel = {
  id: string
  slug: string
  name: string
  kind: string
  unreadCount: number
}

export type ChatRoomScope = {
  scope: 'play-space' | 'convention'
  key: string
  title: string
  href: string
  channels: ChatRoomChannel[]
}

export type SelectedChatRoom = {
  scope: 'play-space' | 'convention'
  scopeKey: string
  scopeTitle: string
  channel: ChatRoomChannel
}

export function roomSelectionKey(sel: SelectedChatRoom): string {
  return `${sel.scope}:${sel.scopeKey}:${sel.channel.id}`
}

export function useMyChatRooms(opts: { enabled?: boolean }) {
  const enabled = opts.enabled !== false
  const [reloadToken, setReloadToken] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<ChatRoomScope[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setItems([])
      setErrorMessage(null)
      return
    }
    let cancelled = false
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
    void (async () => {
      try {
        const r = await fetch('/api/v1/me/chat-rooms', { credentials: 'include' })
        const j = (await r.json().catch(() => ({}))) as { items?: ChatRoomScope[]; error?: string }
        if (!r.ok) {
          if (!cancelled) {
            setStatus('error')
            setItems([])
            setErrorMessage(j.error ?? `Request failed (${r.status})`)
          }
          return
        }
        if (!cancelled) {
          setStatus('ready')
          setItems(j.items ?? [])
          setErrorMessage(null)
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
          setItems([])
          setErrorMessage('Could not load chat rooms.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return { status, items, errorMessage, reload }
}

export function chatRoomApiBase(scope: 'play-space' | 'convention', key: string): string {
  if (scope === 'play-space') {
    return `/api/v1/play-spaces/${encodeURIComponent(key)}/hub-channels`
  }
  return `/api/v1/conventions/${encodeURIComponent(key)}/hub-channels`
}
