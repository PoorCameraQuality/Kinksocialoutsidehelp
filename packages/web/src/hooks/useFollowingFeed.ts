/**
 * Following / home feed from `GET /api/v1/feed/home` (credentials).
 *
 * `enabled` false → ready with empty items. `filter` maps to the API filter query
 * (default `all`). Supports cursor pagination via `loadMore` / `nextCursor`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiFeedHomeCard, FollowingFeedItem } from '@/lib/feed-types'
import { apiFeedHomeCardToFeedItem } from '@/lib/feed-mapper'

export type FollowingFeedStatus = 'loading' | 'ready' | 'error'

export type UseFollowingFeedResult = {
  status: FollowingFeedStatus
  items: FollowingFeedItem[]
  connectionCount: number
  nextCursor: string | null
  error: string | null
  reload: () => void
  loadMore: () => void
  loadingMore: boolean
}

const FEED_HOME_PATH = '/api/v1/feed/home'

export function useFollowingFeed(enabled: boolean, filter = 'all'): UseFollowingFeedResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [loadMoreToken, setLoadMoreToken] = useState(0)
  const [status, setStatus] = useState<FollowingFeedStatus>('loading')
  const [items, setItems] = useState<FollowingFeedItem[]>([])
  const [connectionCount, setConnectionCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const nextCursorRef = useRef<string | null>(null)
  nextCursorRef.current = nextCursor

  const reload = useCallback(() => {
    setLoadMoreToken(0)
    setReloadToken((n) => n + 1)
  }, [])
  const loadMore = useCallback(() => {
    if (nextCursorRef.current) setLoadMoreToken((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStatus('ready')
      setItems([])
      setConnectionCount(0)
      setNextCursor(null)
      return
    }
    let cancelled = false
    setLoadMoreToken(0)
    setItems([])
    setStatus('loading')
    setError(null)
    setNextCursor(null)
    void (async () => {
      try {
        const q = new URLSearchParams({ limit: '20' })
        if (filter && filter !== 'all') q.set('filter', filter)
        const r = await fetch(`${FEED_HOME_PATH}?${q}`, { credentials: 'include' })
        if (r.status === 503) {
          if (!cancelled) {
            setStatus('error')
            setError('Database mode is off on the server.')
          }
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setStatus('error')
            setError(
              r.status === 401
                ? 'Session expired. Sign out and sign in again (after a DB reset, use a seed account).'
                : `Following feed unavailable (HTTP ${r.status}).`,
            )
          }
          return
        }
        const data = (await r.json()) as {
          cards?: ApiFeedHomeCard[]
          nextCursor?: string | null
          connectionCount?: number
        }
        if (cancelled) return
        const mapped = (data.cards ?? [])
          .map((row) => apiFeedHomeCardToFeedItem(row))
          .filter((x): x is FollowingFeedItem => x != null)
        setItems(mapped)
        setNextCursor(data.nextCursor ?? null)
        setConnectionCount(data.connectionCount ?? 0)
        setStatus('ready')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setError('Could not load your following feed.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, filter, reloadToken])

  useEffect(() => {
    if (!enabled || loadMoreToken === 0) return
    const cursor = nextCursorRef.current
    if (!cursor) return
    let cancelled = false
    void (async () => {
      setLoadingMore(true)
      setError(null)
      try {
        const q = new URLSearchParams({ limit: '20', cursor })
        if (filter && filter !== 'all') q.set('filter', filter)
        const r = await fetch(`${FEED_HOME_PATH}?${q}`, { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) {
          setError(`Could not load more (HTTP ${r.status}).`)
          return
        }
        const data = (await r.json()) as {
          cards?: ApiFeedHomeCard[]
          nextCursor?: string | null
        }
        if (cancelled) return
        const mapped = (data.cards ?? [])
          .map((row) => apiFeedHomeCardToFeedItem(row))
          .filter((x): x is FollowingFeedItem => x != null)
        setItems((prev) => {
          const seen = new Set(
            prev.map((item) => (item.kind === 'post' ? `post:${item.post.id}` : `activity:${item.cursor}`)),
          )
          const unique = mapped.filter((item) => {
            const key = item.kind === 'post' ? `post:${item.post.id}` : `activity:${item.cursor}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          return [...prev, ...unique]
        })
        setNextCursor(data.nextCursor ?? null)
      } catch {
        if (!cancelled) setError('Could not load more feed items.')
      } finally {
        if (!cancelled) setLoadingMore(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, filter, loadMoreToken])

  return { status, items, connectionCount, nextCursor, error, reload, loadMore, loadingMore }
}
