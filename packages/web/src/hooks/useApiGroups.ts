/**
 * Group directory list from `GET /api/v1/groups` (credentials).
 *
 * Optional `category` query; `enabled` false → idle/empty. Call `reload()` to refetch.
 */
import { useCallback, useEffect, useState } from 'react'

export type GroupMemberAvatar = {
  userId: string
  avatarUrl?: string | null
  displayName?: string | null
}

export type ApiGroupListItem = {
  id: string
  slug: string
  name: string
  descriptionSnippet?: string | null
  category?: string | null
  tags?: string[] | null
  visibility?: string
  memberCount?: number
  memberAvatars?: GroupMemberAvatar[]
  coverImageUrl?: string | null
  placeLabel?: string | null
  distanceMi?: number
  createdAt?: string
}

export type ApiGroupsResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiGroupListItem[]
  errorMessage: string | null
  reload: () => void
}

function groupsErrorMessage(status: number, bodyError?: string): string {
  if (status === 503) {
    return bodyError ?? 'Database not enabled. Set USE_DATABASE=true and start the API with Postgres.'
  }
  if (status === 502 || status === 504) {
    return 'API unavailable. Run npm run dev and ensure the API is listening on port 3001.'
  }
  return bodyError ?? `Could not load groups (${status}). Check your connection and try again.`
}

export function useApiGroups(enabled: boolean, category?: string | null): ApiGroupsResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiGroupsResult, 'status' | 'items' | 'errorMessage'>>({
    status: 'idle',
    items: [],
    errorMessage: null,
  })
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], errorMessage: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading', errorMessage: null }))
    void (async () => {
      try {
        const qs = category ? `?category=${encodeURIComponent(category)}` : ''
        const r = await fetch(`/api/v1/groups${qs}`, { credentials: 'include' })
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          if (!cancelled) {
            setState({
              status: 'error',
              items: [],
              errorMessage: groupsErrorMessage(r.status, j.error),
            })
          }
          return
        }
        const data = (await r.json()) as { items?: ApiGroupListItem[] }
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
  }, [enabled, reloadToken, category])

  return { ...state, reload }
}
