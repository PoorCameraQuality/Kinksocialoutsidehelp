import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProfileFocus } from '@/lib/presenter-focus'
import type { PresenterBadgeKey } from '@/lib/presenter-badges-types'

export type ApiPresenterListItem = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  headline: string | null
  bioShort: string | null
  profileKind: string
  profileFocuses?: ProfileFocus[]
  primaryProfileFocus?: ProfileFocus | null
  expertiseTags: string[] | null
  ratingAvg: number
  reviewCount: number
  badges?: PresenterBadgeKey[]
  verifiedTeachingCredits?: number
  featuredOfferingTitle?: string | null
  publishedArticleCount?: number
}

export type PresenterListSort = 'popular' | 'name'

export type UseApiPresentersOptions = {
  q: string
  tag: string
  sort: PresenterListSort
}

export type ApiPresentersResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiPresenterListItem[]
  errorMessage: string | null
  hasMore: boolean
  loadingMore: boolean
  reload: () => void
  loadMore: () => void
}

const PAGE_LIMIT = 24

function presentersErrorMessage(status: number, bodyError?: string): string {
  if (status === 503) {
    return bodyError ?? 'Database not enabled. Set USE_DATABASE=true and start the API with Postgres.'
  }
  if (status === 502 || status === 504) {
    return 'API unavailable. Run npm run dev and ensure the API is listening on port 3001.'
  }
  return bodyError ?? `Could not load presenters (${status}). Check your connection and try again.`
}

export function useApiPresenters(enabled: boolean, options: UseApiPresentersOptions): ApiPresentersResult {
  const { q, tag, sort } = options
  const [debouncedQ, setDebouncedQ] = useState(q.trim())
  const [debouncedTag, setDebouncedTag] = useState(tag.trim().toLowerCase())
  const [reloadToken, setReloadToken] = useState(0)
  const [loadMoreToken, setLoadMoreToken] = useState(0)
  const [state, setState] = useState<{
    status: ApiPresentersResult['status']
    items: ApiPresenterListItem[]
    errorMessage: string | null
    hasMore: boolean
    loadingMore: boolean
  }>({
    status: 'idle',
    items: [],
    errorMessage: null,
    hasMore: false,
    loadingMore: false,
  })

  const offsetRef = useRef(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])
  const loadMore = useCallback(() => setLoadMoreToken((n) => n + 1), [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTag(tag.trim().toLowerCase()), 300)
    return () => window.clearTimeout(t)
  }, [tag])

  useEffect(() => {
    offsetRef.current = 0
  }, [debouncedQ, debouncedTag, sort, reloadToken])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], errorMessage: null, hasMore: false, loadingMore: false })
      return
    }

    const isLoadMore = loadMoreToken > 0 && offsetRef.current > 0
    let cancelled = false

    if (isLoadMore) {
      setState((s) => ({ ...s, loadingMore: true, errorMessage: null }))
    } else {
      setState((s) => ({ ...s, status: 'loading', errorMessage: null, loadingMore: false }))
    }

    void (async () => {
      try {
        const params = new URLSearchParams({
          sort,
          limit: String(PAGE_LIMIT),
          offset: String(offsetRef.current),
        })
        if (debouncedQ) params.set('q', debouncedQ)
        if (debouncedTag) params.set('tag', debouncedTag)

        const r = await fetch(`/api/v1/presenters?${params.toString()}`, { credentials: 'include' })
        const data = (await r.json()) as { items?: ApiPresenterListItem[]; error?: string }
        if (cancelled) return

        if (!r.ok) {
          setState({
            status: 'error',
            items: [],
            errorMessage: presentersErrorMessage(r.status, data.error),
            hasMore: false,
            loadingMore: false,
          })
          return
        }

        const page = data.items ?? []
        offsetRef.current += page.length
        setState((prev) => ({
          status: 'ready',
          items: isLoadMore ? [...prev.items, ...page] : page,
          errorMessage: null,
          hasMore: page.length >= PAGE_LIMIT,
          loadingMore: false,
        }))
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            items: [],
            errorMessage: 'API unavailable. Run npm run dev and ensure Docker/Postgres are up.',
            hasMore: false,
            loadingMore: false,
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, debouncedQ, debouncedTag, sort, reloadToken, loadMoreToken])

  return {
    status: state.status,
    items: state.items,
    errorMessage: state.errorMessage,
    hasMore: state.hasMore,
    loadingMore: state.loadingMore,
    reload,
    loadMore,
  }
}
