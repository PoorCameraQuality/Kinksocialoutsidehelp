/**
 * Organization directory list from `GET /api/v1/organizations` (credentials).
 *
 * Debounces `q`; maps UI sort to API sort. `enabled` false → idle/empty.
 */
import { useCallback, useEffect, useState } from 'react'

export type ApiOrgListItem = {
  id: string
  slug: string
  displayName: string
  bio?: string | null
  bioFormat?: 'text' | 'html'
  logoUrl?: string | null
  bannerUrl?: string | null
  shareImageUrl?: string | null
  visibility: string
  rating: number
  reviewCount: number
  memberCount?: number
  createdAt?: string
  featureFlags?: Record<string, boolean>
  ownerId?: string
}

export type OrgListSort = 'popular' | 'name' | 'recent' | 'events'

export type ApiOrganizationsResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiOrgListItem[]
  errorMessage: string | null
  reload: () => void
}

function orgsErrorMessage(status: number, bodyError?: string): string {
  if (status === 503) {
    return bodyError ?? 'Database not enabled. Set USE_DATABASE=true and start the API with Postgres.'
  }
  if (status === 502 || status === 504) {
    return 'API unavailable. Run npm run dev and ensure the API is listening on port 3001.'
  }
  return bodyError ?? `Could not load organizations (${status}). Check your connection and try again.`
}

export function useApiOrganizations(
  enabled: boolean,
  options: { q: string; sort: OrgListSort },
): ApiOrganizationsResult {
  const { q, sort } = options
  const apiSort = sort === 'name' ? 'name' : 'popular'
  const [debouncedQ, setDebouncedQ] = useState(q.trim())
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiOrganizationsResult, 'status' | 'items' | 'errorMessage'>>({
    status: 'idle',
    items: [],
    errorMessage: null,
  })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], errorMessage: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading', errorMessage: null }))
    void (async () => {
      try {
        const params = new URLSearchParams({ sort: apiSort })
        if (debouncedQ) params.set('q', debouncedQ)
        const r = await fetch(`/api/v1/organizations?${params.toString()}`, { credentials: 'include' })
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              errorMessage: orgsErrorMessage(r.status, j.error),
            })
          }
          return
        }
        const data = (await r.json()) as { items?: ApiOrgListItem[] }
        if (!cancelled) setState({ status: 'ready', items: data.items ?? [], errorMessage: null })
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            items: [],
            errorMessage: 'API unavailable. Run npm run dev and ensure Docker/Postgres are up.',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, debouncedQ, apiSort, reloadToken])

  return { ...state, reload }
}
