import { useCallback, useEffect, useMemo, useState } from 'react'

export type ApiBlockedMember = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  age: number | null
  gender: string | null
  genders: string[]
  roles: string[]
  location: string | null
  blockedAt: string | null
}

export type BlockedSort = 'newest' | 'oldest'

export type UseApiBlockedMembersResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiBlockedMember[]
  error: string | null
  search: string
  setSearch: (value: string) => void
  sort: BlockedSort
  setSort: (value: BlockedSort) => void
  reload: () => void
  block: (username: string) => Promise<{ ok: boolean; error?: string }>
  unblock: (username: string) => Promise<boolean>
  busy: boolean
}

export function useApiBlockedMembers(enabled: boolean): UseApiBlockedMembersResult {
  const [status, setStatus] = useState<UseApiBlockedMembersResult['status']>('idle')
  const [items, setItems] = useState<ApiBlockedMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState<BlockedSort>('newest')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(handle)
  }, [search])

  const reload = useCallback(async () => {
    if (!enabled) {
      setStatus('ready')
      setItems([])
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const q = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''
      const r = await fetch(`/api/v1/me/blocks${q}`, { credentials: 'include' })
      if (r.status === 401) {
        setStatus('ready')
        setItems([])
        return
      }
      if (r.status === 503) {
        setStatus('error')
        setError('Blocked members require database mode.')
        setItems([])
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(`Could not load blocked members (HTTP ${r.status}).`)
        setItems([])
        return
      }
      const data = (await r.json()) as { items?: ApiBlockedMember[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setStatus('error')
      setError('Network error loading blocked members.')
      setItems([])
    }
  }, [debouncedSearch, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const sortedItems = useMemo(() => {
    const copy = [...items]
    copy.sort((a, b) => {
      const aTime = a.blockedAt ? Date.parse(a.blockedAt) : 0
      const bTime = b.blockedAt ? Date.parse(b.blockedAt) : 0
      return sort === 'newest' ? bTime - aTime : aTime - bTime
    })
    return copy
  }, [items, sort])

  const block = useCallback(
    async (username: string) => {
      if (!enabled) return { ok: false, error: 'Not signed in.' }
      const u = username.trim().replace(/^@/, '')
      if (!u) return { ok: false, error: 'Enter a username.' }
      setBusy(true)
      try {
        const r = await fetch('/api/v1/me/blocks', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u }),
        })
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: j.error ?? 'Could not block.' }
        }
        await reload()
        return { ok: true }
      } catch {
        return { ok: false, error: 'Network error.' }
      } finally {
        setBusy(false)
      }
    },
    [enabled, reload],
  )

  const unblock = useCallback(
    async (username: string) => {
      if (!enabled || busy) return false
      setBusy(true)
      try {
        const r = await fetch(`/api/v1/me/blocks/${encodeURIComponent(username)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!r.ok) return false
        setItems((prev) => prev.filter((item) => item.username !== username))
        return true
      } catch {
        return false
      } finally {
        setBusy(false)
      }
    },
    [busy, enabled],
  )

  return {
    status,
    items: sortedItems,
    error,
    search,
    setSearch,
    sort,
    setSort,
    reload,
    block,
    unblock,
    busy,
  }
}
