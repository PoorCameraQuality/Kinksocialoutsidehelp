import { useCallback, useEffect, useState } from 'react'

import type { ApiListStatus } from '@/hooks/useApiEvents'

export type EducationSeriesContext = {
  seriesSlug: string
  seriesTitle: string
  partNumber: number
  totalParts: number
  prevSlug: string | null
  nextSlug: string | null
}

export type ApiEducationSeries = {
  id: string
  authorUserId: string
  title: string
  slug: string
  description: string | null
  listInEducation: boolean
  itemCount?: number
  partCount?: number
  modules?: Array<{ label: string; slug: string }>
  createdAt: string
  updatedAt: string
}

export type ApiEducationSeriesItem = {
  sortOrder: number
  slug: string
  title: string
  excerpt: string | null
  readingMinutes: number | null
  difficulty: string | null
}

export type ApiEducationSeriesDetail = {
  series: ApiEducationSeries & {
    authorUsername?: string
    authorDisplayName?: string | null
  }
  items: ApiEducationSeriesItem[]
}

export type ApiEducationSeriesManageItem = {
  sortOrder: number
  articleId: string
  slug: string
  title: string
  publicationStatus: string
}

export function useApiEducationHubSeries(enabled = true) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<{
    status: ApiListStatus
    items: ApiEducationSeries[]
    error: string | null
  }>({ status: 'idle', items: [], error: null })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], error: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch('/api/v1/education/series', { credentials: 'include' })
        if (r.status === 503) {
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              error: 'Learning paths require the API in database mode.',
            })
          }
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              error: `Could not load learning paths (HTTP ${r.status}).`,
            })
          }
          return
        }
        const data = (await r.json()) as { items?: ApiEducationSeries[] }
        if (!cancelled) setState({ status: 'ready', items: data.items ?? [], error: null })
      } catch {
        if (!cancelled) {
          setState({ status: 'error', items: [], error: 'Could not load learning paths.' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return { ...state, reload }
}

export function useApiEducationSeriesBySlug(slug: string | undefined) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<{
    status: ApiListStatus
    data: ApiEducationSeriesDetail | null
    error: string | null
  }>({ status: 'idle', data: null, error: null })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!slug?.trim()) {
      setState({ status: 'idle', data: null, error: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(`/api/v1/education/series/${encodeURIComponent(slug.trim())}`, {
          credentials: 'include',
        })
        if (r.status === 404) {
          if (!cancelled) setState({ status: 'ready', data: null, error: null })
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({
              status: 'error',
              data: null,
              error: `Could not load series (HTTP ${r.status}).`,
            })
          }
          return
        }
        const data = (await r.json()) as ApiEducationSeriesDetail
        if (!cancelled) setState({ status: 'ready', data, error: null })
      } catch {
        if (!cancelled) {
          setState({ status: 'error', data: null, error: 'Could not load series.' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, reloadToken])

  return { ...state, reload }
}

export function useApiEducationSeriesByAuthor(username: string | undefined) {
  const [state, setState] = useState<{
    status: ApiListStatus
    items: ApiEducationSeries[]
    error: string | null
  }>({ status: 'idle', items: [], error: null })

  useEffect(() => {
    if (!username?.trim()) {
      setState({ status: 'idle', items: [], error: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(
          `/api/v1/education/series/by-author/${encodeURIComponent(username.trim())}`,
          { credentials: 'include' },
        )
        if (r.status === 404) {
          if (!cancelled) setState({ status: 'ready', items: [], error: null })
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({ status: 'error', items: [], error: `Could not load series (HTTP ${r.status}).` })
          }
          return
        }
        const data = (await r.json()) as { items?: ApiEducationSeries[] }
        if (!cancelled) setState({ status: 'ready', items: data.items ?? [], error: null })
      } catch {
        if (!cancelled) setState({ status: 'error', items: [], error: 'Could not load series.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  return state
}

export function useApiMyEducationSeries(enabled: boolean) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<{
    status: ApiListStatus
    items: ApiEducationSeries[]
    error: string | null
  }>({ status: 'idle', items: [], error: null })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], error: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch('/api/v1/me/education-series', { credentials: 'include' })
        if (r.status === 401) {
          if (!cancelled) setState({ status: 'error', items: [], error: 'Sign in to manage series.' })
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({ status: 'error', items: [], error: `Could not load series (HTTP ${r.status}).` })
          }
          return
        }
        const data = (await r.json()) as { items?: ApiEducationSeries[] }
        if (!cancelled) setState({ status: 'ready', items: data.items ?? [], error: null })
      } catch {
        if (!cancelled) setState({ status: 'error', items: [], error: 'Could not load series.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return { ...state, reload }
}

export function useApiEducationSeriesManageDetail(id: string | undefined, enabled: boolean) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<{
    status: ApiListStatus
    series: ApiEducationSeries | null
    items: ApiEducationSeriesManageItem[]
    error: string | null
  }>({ status: 'idle', series: null, items: [], error: null })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled || !id?.trim()) {
      setState({ status: 'idle', series: null, items: [], error: null })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(`/api/v1/me/education-series/${encodeURIComponent(id.trim())}`, {
          credentials: 'include',
        })
        if (r.status === 404) {
          if (!cancelled) setState({ status: 'ready', series: null, items: [], error: null })
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setState({ status: 'error', series: null, items: [], error: `Could not load series (HTTP ${r.status}).` })
          }
          return
        }
        const data = (await r.json()) as {
          series: ApiEducationSeries
          items: ApiEducationSeriesManageItem[]
        }
        if (!cancelled) {
          setState({ status: 'ready', series: data.series, items: data.items ?? [], error: null })
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', series: null, items: [], error: 'Could not load series.' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, enabled, reloadToken])

  return { ...state, reload }
}
