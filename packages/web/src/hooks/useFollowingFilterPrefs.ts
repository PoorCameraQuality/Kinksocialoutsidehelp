import { useCallback, useEffect, useState } from 'react'
import type { FeedSettings } from '@c2k/shared'

export type FollowingFilterId = NonNullable<FeedSettings['followingFilter']>

export type FollowingFeedCounts = {
  all: number
  posts: number
  photos: number
  video: number
  articles: number
  reactions?: number
  events?: number
  groups?: number
}

/** Filters that show a coming-soon panel instead of fetching feed rows. */
export const FOLLOWING_FILTER_COMING_SOON = new Set<FollowingFilterId>(['video'])

export function isFollowingFilterComingSoon(filter: FollowingFilterId): boolean {
  return FOLLOWING_FILTER_COMING_SOON.has(filter)
}

/** SG-121 partial: content-type tabs on Following feed. */
export const FOLLOWING_FILTERS: { id: FollowingFilterId; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'posts', label: 'Posts only' },
  { id: 'photos', label: 'Photos' },
  { id: 'video', label: 'Video' },
  { id: 'articles', label: 'Articles' },
]

const VALID_FILTERS = new Set<string>([
  'all',
  'posts',
  'photos',
  'video',
  'articles',
  'reactions',
  'events',
  'groups',
])

/** Activity-bucket filters from F4 - hidden in SG-121 partial UI. */
const LEGACY_ACTIVITY_FILTERS = new Set(['reactions', 'events', 'groups'])

function normalizeStoredFilter(raw: string | undefined): FollowingFilterId {
  if (!raw || !VALID_FILTERS.has(raw)) return 'all'
  if (LEGACY_ACTIVITY_FILTERS.has(raw)) return 'all'
  return raw as FollowingFilterId
}

export function useFollowingFilterPrefs(enabled: boolean) {
  const [filter, setFilterState] = useState<FollowingFilterId>('all')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setLoaded(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/settings/me', { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setLoaded(true)
          return
        }
        const data = (await r.json()) as { feed?: { followingFilter?: string } }
        const raw = data.feed?.followingFilter
        if (!cancelled) setFilterState(normalizeStoredFilter(raw))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  const setFilter = useCallback((next: FollowingFilterId) => {
    setFilterState(next)
    void fetch('/api/settings/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed: { followingFilter: next } }),
    })
  }, [])

  return { filter, setFilter, loaded }
}

export function useFollowingFeedCounts(enabled: boolean, reloadToken = 0) {
  const [counts, setCounts] = useState<FollowingFeedCounts | null>(null)

  useEffect(() => {
    if (!enabled) {
      setCounts(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/v1/feed/following/counts', { credentials: 'include' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as FollowingFeedCounts
        if (!cancelled) setCounts(data)
      } catch {
        if (!cancelled) setCounts(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return counts
}
