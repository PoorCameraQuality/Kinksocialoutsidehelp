import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ApiListStatus } from '@/hooks/useApiEvents'
import type { EducationSeriesContext } from '@/hooks/useApiEducationSeries'
import type { ApiEducationArticle } from '@/lib/education-article-types'

export type { EducationSeriesContext }

export type { ApiEducationArticle } from '@/lib/education-article-types'

export type ApiEducationOfferingRef = {
  id: string
  title: string
}

export type ApiEducationArticlesListQuery = {
  category?: string | null
  difficulty?: string | null
  q?: string | null
  limit?: number
  cursor?: string | null
  /** When false, skips fetch - idle / empty items. Default true. */
  enabled?: boolean
}

export type ApiEducationArticlesResult = {
  status: ApiListStatus
  items: ApiEducationArticle[]
  error: string | null
  nextCursor: string | null
  reload: () => void
}

export type ApiEducationArticleDetailResult = {
  status: ApiListStatus
  article: ApiEducationArticle | null
  linkedOfferings: ApiEducationOfferingRef[]
  seriesContext: EducationSeriesContext | null
  error: string | null
  reload: () => void
}

function buildArticlesListUrl(filters?: ApiEducationArticlesListQuery): string {
  const params = new URLSearchParams()
  const limit = Math.min(50, Math.max(1, filters?.limit ?? 24))
  params.set('limit', String(limit))
  const category = filters?.category?.trim()
  if (category) params.set('category', category)
  const difficulty = filters?.difficulty?.trim()
  if (difficulty) params.set('difficulty', difficulty)
  const q = filters?.q?.trim()
  if (q) params.set('q', q)
  const cursor = filters?.cursor?.trim()
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  return `/api/v1/education/articles?${qs}`
}

export function useApiEducationArticles(filters?: ApiEducationArticlesListQuery): ApiEducationArticlesResult {
  const enabled = filters?.enabled !== false
  const limit = filters?.limit
  const category = filters?.category
  const difficulty = filters?.difficulty
  const q = filters?.q
  const cursor = filters?.cursor

  const listUrl = useMemo(
    () =>
      buildArticlesListUrl({
        limit,
        category,
        difficulty,
        q,
        cursor,
      }),
    [limit, category, difficulty, q, cursor],
  )

  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiEducationArticlesResult, 'status' | 'items' | 'error' | 'nextCursor'>>({
    status: 'idle',
    items: [],
    error: null,
    nextCursor: null,
  })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], error: null, nextCursor: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(listUrl, { credentials: 'include' })
        if (r.status === 503) {
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              error: 'Education articles require the API in database mode.',
              nextCursor: null,
            })
          }
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              error: `Could not load education articles (HTTP ${r.status}).`,
              nextCursor: null,
            })
          }
          return
        }
        const data = (await r.json()) as { items?: ApiEducationArticle[]; nextCursor?: string | null }
        if (!cancelled) {
          setState({
            status: 'ready',
            items: data.items ?? [],
            error: null,
            nextCursor: data.nextCursor ?? null,
          })
        }
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            items: [],
            error: 'Could not load education articles.',
            nextCursor: null,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, listUrl, reloadToken])

  return { ...state, reload }
}

export function useApiEducationArticleBySlug(slug: string | undefined): ApiEducationArticleDetailResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<
    Pick<ApiEducationArticleDetailResult, 'status' | 'article' | 'linkedOfferings' | 'seriesContext' | 'error'>
  >({
    status: 'idle',
    article: null,
    linkedOfferings: [],
    seriesContext: null,
    error: null,
  })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!slug?.trim()) {
      setState({ status: 'idle', article: null, linkedOfferings: [], seriesContext: null, error: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(`/api/v1/education/articles/${encodeURIComponent(slug.trim())}`, {
          credentials: 'include',
        })
        if (r.status === 503) {
          if (!cancelled) {
            setState({
              status: 'error',
              article: null,
              linkedOfferings: [],
              seriesContext: null,
              error: 'This article requires the API in database mode.',
            })
          }
          return
        }
        if (r.status === 404) {
          if (!cancelled) setState({ status: 'ready', article: null, linkedOfferings: [], seriesContext: null, error: null })
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({
              status: 'error',
              article: null,
              linkedOfferings: [],
              seriesContext: null,
              error: `Could not load this article (HTTP ${r.status}).`,
            })
          }
          return
        }
        const data = (await r.json()) as {
          article: ApiEducationArticle
          linkedOfferings?: ApiEducationOfferingRef[]
          seriesContext?: EducationSeriesContext | null
        }
        if (!cancelled) {
          setState({
            status: 'ready',
            article: data.article,
            linkedOfferings: data.linkedOfferings ?? [],
            seriesContext: data.seriesContext ?? null,
            error: null,
          })
        }
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            article: null,
            linkedOfferings: [],
            seriesContext: null,
            error: 'Could not load this article.',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, reloadToken])

  return { ...state, reload }
}
