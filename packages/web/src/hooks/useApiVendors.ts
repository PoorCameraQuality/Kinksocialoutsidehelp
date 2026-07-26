import { useCallback, useEffect, useState } from 'react'

import type { MockVendor } from '@/data/mock-data'

import {
  buildVendorEnrichmentMaps,
  enrichmentForVendor,
  mapApiVendorToMockVendor,
  type ApiVendorRow,
  type VendorInPersonRow,
  type VendorSpotlightRow,
} from '@/lib/api-vendor-mapper'

import type { ShipsToFilter } from '@/lib/vendor-filters'

export type ApiVendorsFilters = {
  category?: string | null
  tag?: string | null
  q?: string
  shipsTo?: ShipsToFilter
  minRating?: number
}

export type ApiVendorsResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: MockVendor[]
  errorMessage: string | null
  reload: () => void
}

function vendorsErrorMessage(status: number, bodyError?: string): string {
  if (status === 503) {
    return bodyError ?? 'Database not enabled. Set USE_DATABASE=true and start the API with Postgres.'
  }
  if (status === 502 || status === 504) {
    return 'API unavailable. Run npm run dev and ensure the API is listening on port 3001.'
  }
  return bodyError ?? `Could not load vendors (${status}). Check your connection and try again.`
}

function buildVendorsQuery(filters?: ApiVendorsFilters): string {
  const params = new URLSearchParams()
  if (filters?.category) params.set('category', filters.category)
  if (filters?.tag) params.set('tag', filters.tag)
  if (filters?.q && filters.q.trim().length >= 2) params.set('q', filters.q.trim())
  if (filters?.shipsTo) params.set('shipsTo', filters.shipsTo)
  if (filters?.minRating != null && filters.minRating > 0) {
    params.set('minRating', String(filters.minRating))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useApiVendors(enabled: boolean, filters?: ApiVendorsFilters): ApiVendorsResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiVendorsResult, 'status' | 'items' | 'errorMessage'>>({
    status: 'idle',
    items: [],
    errorMessage: null,
  })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const category = filters?.category ?? null
  const tag = filters?.tag ?? null
  const q = filters?.q ?? ''
  const shipsTo = filters?.shipsTo ?? ''
  const minRating = filters?.minRating ?? 0

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], errorMessage: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading', errorMessage: null }))
    void (async () => {
      try {
        const qs = buildVendorsQuery({ category, tag, q, shipsTo, minRating })
        const [listRes, spotlightRes, inPersonRes] = await Promise.all([
          fetch(`/api/v1/vendors${qs}`, { credentials: 'include' }),
          fetch('/api/v1/vendors/spotlight-listings?n=50', { credentials: 'include' }),
          fetch('/api/v1/vendors/in-person-upcoming', { credentials: 'include' }),
        ])
        if (!listRes.ok) {
          const j = (await listRes.json().catch(() => ({}))) as { error?: string }
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              errorMessage: vendorsErrorMessage(listRes.status, j.error),
            })
          }
          return
        }
        const listData = (await listRes.json()) as { items?: ApiVendorRow[] }
        const spotlightData =
          spotlightRes.ok ?
            ((await spotlightRes.json()) as { items?: VendorSpotlightRow[] })
          : { items: [] }
        const inPersonData =
          inPersonRes.ok ?
            ((await inPersonRes.json()) as { items?: VendorInPersonRow[] })
          : { items: [] }
        const maps = buildVendorEnrichmentMaps(spotlightData.items ?? [], inPersonData.items ?? [])
        const items = (listData.items ?? []).map((row) =>
          mapApiVendorToMockVendor(row, enrichmentForVendor(row.id, maps)),
        )
        if (!cancelled) setState({ status: 'ready', items, errorMessage: null })
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
  }, [enabled, category, tag, q, shipsTo, minRating, reloadToken])

  return { ...state, reload }
}
