import { useCallback, useEffect, useState } from 'react'

export type MyFeedPost = {
  id: string
  kind: string
  title: string | null
  body: string
  bodyFormat: string
  createdAt: string
  updatedAt: string
  likeCount: number
}

export function useApiMyFeedPosts(enabled: boolean) {
  const [items, setItems] = useState<MyFeedPost[]>([])
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
      const r = await fetch('/api/v1/me/feed-posts?limit=80', { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as {
        items?: Array<{
          id: string
          kind: string
          title: string | null
          body: string
          bodyFormat: string
          createdAt: string
          updatedAt?: string
          likeCount?: number
        }>
      }
      setItems(
        (data.items ?? []).map((p) => ({
          id: p.id,
          kind: p.kind,
          title: p.title,
          body: p.body,
          bodyFormat: p.bodyFormat,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt ?? p.createdAt,
          likeCount: p.likeCount ?? 0,
        })),
      )
      setStatus('ready')
    } catch {
      setError('Could not load your posts')
      setItems([])
      setStatus('error')
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, status, error, reload }
}
