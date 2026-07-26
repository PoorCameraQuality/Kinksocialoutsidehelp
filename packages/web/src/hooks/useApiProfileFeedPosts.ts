import { useCallback, useEffect, useState } from 'react'
import type { ApiFeedPost } from '@/lib/feed-mapper'

export function useApiProfileFeedPosts(username: string | null, enabled: boolean, limit = 10) {
  const [items, setItems] = useState<ApiFeedPost[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !username) {
      setItems([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(
        `/api/v1/users/${encodeURIComponent(username)}/feed-posts?limit=${limit}`,
        { credentials: 'include' },
      )
      if (r.status === 404) {
        setItems([])
        setStatus('ready')
        return
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { items?: ApiFeedPost[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setError('Could not load recent posts')
      setItems([])
      setStatus('error')
    }
  }, [enabled, username, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, status, error, reload }
}

export function useApiMyProfileFeedPosts(enabled: boolean, limit = 10) {
  const [items, setItems] = useState<ApiFeedPost[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch(`/api/v1/me/feed-posts?limit=${limit}`, { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { items?: ApiFeedPost[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setError('Could not load recent posts')
      setItems([])
      setStatus('error')
    }
  }, [enabled, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, status, error, reload }
}
