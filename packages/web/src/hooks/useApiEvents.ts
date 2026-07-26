/**
 * Live event catalog list from `GET /api/v1/events` (credentials included).
 *
 * Overload: `useApiEvents(groupId?, filters?)` or `useApiEvents(filters)`.
 * `status`: idle (disabled) | loading | ready | error. `items` are catalog cards
 * (`EventCatalogItem` / historical `MockEvent` shape). Call `reload()` to refetch.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EventCatalogItem } from '@/lib/api-event-mapper'
import type { ApiEventListItem } from '@/lib/api-event-mapper'
import { mapApiEventToCatalogItem } from '@/lib/api-event-mapper'

export type ApiListStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ApiEventsFilters = {
  categories?: readonly string[]
  format?: 'all' | 'in-person' | 'virtual'
  city?: string
  country?: string
  /** When `me`, returns events the signed-in viewer hosts. */
  hostId?: 'me'
  /** When false, skips the fetch (idle, empty items). Default true. */
  enabled?: boolean
}

export type ApiEventsResult = {
  status: ApiListStatus
  items: EventCatalogItem[]
  reload: () => void
}

function buildEventsListUrl(groupId?: string | null, filters?: ApiEventsFilters): string {
  const params = new URLSearchParams()
  if (groupId && /^[0-9a-f-]{36}$/i.test(groupId)) {
    params.set('groupId', groupId)
  }
  if (filters?.categories?.length) {
    for (const cat of filters.categories) {
      if (cat.trim()) params.append('category', cat.trim())
    }
  }
  if (filters?.format && filters.format !== 'all') {
    params.set('format', filters.format)
  }
  const city = filters?.city?.trim()
  if (city) params.set('city', city)
  const country = filters?.country?.trim()
  if (country) params.set('country', country)
  if (filters?.hostId === 'me') params.set('hostId', 'me')
  const qs = params.toString()
  return qs ? `/api/v1/events?${qs}` : '/api/v1/events'
}

export function useApiEvents(
  scopeGroupIdOrFilters?: string | null | ApiEventsFilters,
  maybeFilters?: ApiEventsFilters
): ApiEventsResult {
  const { groupId, filters } = useMemo(() => {
    if (typeof scopeGroupIdOrFilters === 'string' || scopeGroupIdOrFilters === null || scopeGroupIdOrFilters === undefined) {
      return { groupId: scopeGroupIdOrFilters ?? undefined, filters: maybeFilters }
    }
    return { groupId: undefined, filters: scopeGroupIdOrFilters }
  }, [scopeGroupIdOrFilters, maybeFilters])

  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiEventsResult, 'status' | 'items'>>({ status: 'loading', items: [] })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const listUrl = useMemo(() => buildEventsListUrl(groupId, filters), [groupId, filters])
  const enabled = filters?.enabled !== false

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [] })
      return
    }
    let cancelled = false
    void (async () => {
      if (!cancelled) setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(listUrl, { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setState({ status: 'error', items: [] })
          return
        }
        const data = (await r.json()) as { items: ApiEventListItem[] }
        if (cancelled) return
        setState({ status: 'ready', items: (data.items ?? []).map(mapApiEventToCatalogItem) })
      } catch {
        if (!cancelled) setState({ status: 'error', items: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadToken, listUrl, enabled])

  return { ...state, reload }
}
