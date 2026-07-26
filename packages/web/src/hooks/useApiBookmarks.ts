import { useCallback, useEffect, useState } from 'react'
import type { ApiFeedPost } from '@/lib/feed-mapper'

export const BOOKMARK_OBJECT_FEED_POST = 'feed_post' as const
export const BOOKMARK_OBJECT_EDUCATION_ARTICLE = 'education_article' as const
export const BOOKMARK_OBJECT_MEDIA_SHOW = 'media_show' as const
export const BOOKMARK_OBJECT_MEDIA_EPISODE = 'media_episode' as const
export const BOOKMARK_OBJECT_EVENT = 'event' as const

export type BookmarkObjectType =
  | typeof BOOKMARK_OBJECT_FEED_POST
  | typeof BOOKMARK_OBJECT_EDUCATION_ARTICLE
  | typeof BOOKMARK_OBJECT_MEDIA_SHOW
  | typeof BOOKMARK_OBJECT_MEDIA_EPISODE
  | typeof BOOKMARK_OBJECT_EVENT

export type ApiBookmarkEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  imageUrl: string | null
  eventFormat: string | null
  location: string | null
  publicLocationSummary: string | null
  locationRedacted: boolean
  joinLinkRedacted: boolean
  rsvpCount: number
}

export type ApiBookmarkArticle = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl: string | null
  authorUsername: string
}

export type ApiBookmarkMediaShow = {
  id: string
  slug: string
  title: string
  coverImageUrl: string | null
  mediaFormat: string
}

export type ApiBookmarkMediaEpisode = {
  id: string
  slug: string
  title: string
  showSlug: string
  showTitle: string
}

export type ApiBookmarkItem = {
  objectType: string
  objectId: string
  createdAt: string
  post: ApiFeedPost | null
  article: ApiBookmarkArticle | null
  mediaShow: ApiBookmarkMediaShow | null
  mediaEpisode: ApiBookmarkMediaEpisode | null
  event: ApiBookmarkEvent | null
}

export type UseApiBookmarksResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiBookmarkItem[]
  error: string | null
  reload: () => void
  isBookmarked: (objectType: BookmarkObjectType, objectId: string) => boolean
  toggleBookmark: (objectType: BookmarkObjectType, objectId: string) => Promise<boolean>
  bookmarkBusy: boolean
}

type CacheEntry = {
  status: UseApiBookmarksResult['status']
  items: ApiBookmarkItem[]
  error: string | null
  keys: Set<string>
}

let cache: CacheEntry | null = null
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function bookmarkKey(objectType: string, objectId: string) {
  return `${objectType}:${objectId}`
}

function notify() {
  for (const fn of listeners) fn()
}

function applyCache(next: CacheEntry) {
  cache = next
  notify()
}

async function fetchBookmarks(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    applyCache({
      status: 'loading',
      items: cache?.items ?? [],
      error: null,
      keys: cache?.keys ?? new Set(),
    })
    try {
      const r = await fetch('/api/v1/me/bookmarks', { credentials: 'include' })
      if (r.status === 401) {
        applyCache({ status: 'ready', items: [], error: null, keys: new Set() })
        return
      }
      if (r.status === 503) {
        applyCache({
          status: 'error',
          items: [],
          error: 'Bookmarks require the API in database mode.',
          keys: new Set(),
        })
        return
      }
      if (!r.ok) {
        applyCache({
          status: 'error',
          items: [],
          error: `Bookmarks unavailable (HTTP ${r.status}).`,
          keys: new Set(),
        })
        return
      }
      const data = (await r.json()) as { items?: ApiBookmarkItem[] }
      const items = data.items ?? []
      const keys = new Set(items.map((i) => bookmarkKey(i.objectType, i.objectId)))
      applyCache({ status: 'ready', items, error: null, keys })
    } catch {
      applyCache({
        status: 'error',
        items: [],
        error: 'Could not load bookmarks.',
        keys: new Set(),
      })
    } finally {
      loadPromise = null
    }
  })()
  return loadPromise
}

export function useApiBookmarks(enabled: boolean): UseApiBookmarksResult {
  const [, bump] = useState(0)
  const [bookmarkBusy, setBookmarkBusy] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    cache = null
    loadPromise = null
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    const sub = () => bump((n) => n + 1)
    listeners.add(sub)
    return () => {
      listeners.delete(sub)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }
    if (!cache || cache.status === 'error') {
      void fetchBookmarks()
    } else if (reloadToken > 0) {
      void fetchBookmarks()
    }
  }, [enabled, reloadToken])

  const isBookmarked = useCallback(
    (objectType: BookmarkObjectType, objectId: string) => {
      return cache?.keys.has(bookmarkKey(objectType, objectId)) ?? false
    },
    [bump],
  )

  const toggleBookmark = useCallback(
    async (objectType: BookmarkObjectType, objectId: string) => {
      if (!enabled) return false
      const key = bookmarkKey(objectType, objectId)
      const saved = cache?.keys.has(key) ?? false
      setBookmarkBusy(true)
      try {
        const r = await fetch('/api/v1/me/bookmarks', {
          method: saved ? 'DELETE' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectType, objectId }),
        })
        if (!r.ok) return saved
        const nextKeys = new Set(cache?.keys ?? [])
        if (saved) {
          nextKeys.delete(key)
        } else {
          nextKeys.add(key)
        }
        const prevItems = cache?.items ?? []
        const items = saved ? prevItems.filter((i) => bookmarkKey(i.objectType, i.objectId) !== key) : prevItems
        applyCache({
          status: cache?.status ?? 'ready',
          items,
          error: cache?.error ?? null,
          keys: nextKeys,
        })
        if (!saved) {
          void fetchBookmarks()
        }
        return !saved
      } catch {
        return saved
      } finally {
        setBookmarkBusy(false)
      }
    },
    [enabled],
  )

  const snapshot = cache ?? { status: 'idle' as const, items: [], error: null, keys: new Set<string>() }

  return {
    status: enabled ? snapshot.status : 'idle',
    items: enabled ? snapshot.items : [],
    error: enabled ? snapshot.error : null,
    reload,
    isBookmarked,
    toggleBookmark,
    bookmarkBusy,
  }
}
