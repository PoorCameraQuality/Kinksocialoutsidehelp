/**
 * Play Spaces API hooks — directory, create, join, dancecard.
 */
import { useCallback, useEffect, useState } from 'react'

export type PlaySpaceListItem = {
  id: string
  slug: string
  title: string
  description?: string | null
  locationLabel?: string | null
  visibility: string
  ownerUserId: string
  startsAt: string
  endsAt: string
  timezone: string
  memberCount: number
  isMember: boolean
  myRole?: string | null
  inviteCode?: string | null
  createdAt: string
}

export type DancecardEntry = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  location?: string | null
  notes?: string | null
  userId: string
}

function errMsg(status: number, bodyError?: string): string {
  if (status === 401) return 'Sign in with kink.social to continue.'
  if (status === 403) return bodyError ?? 'You do not have access to this play space.'
  if (status === 503) {
    return bodyError ?? 'Database not enabled. Set USE_DATABASE=true and start the API with Postgres.'
  }
  return bodyError ?? `Request failed (${status}).`
}

export function useApiPlaySpaces(opts: { mine?: boolean; q?: string; enabled?: boolean }) {
  const enabled = opts.enabled !== false
  const [reloadToken, setReloadToken] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<PlaySpaceListItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setItems([])
      setErrorMessage(null)
      return
    }
    let cancelled = false
    setStatus('loading')
    setErrorMessage(null)
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (opts.mine) params.set('mine', '1')
        if (opts.q) params.set('q', opts.q)
        const r = await fetch(`/api/v1/play-spaces?${params}`, { credentials: 'include' })
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          if (!cancelled) {
            setStatus('error')
            setItems([])
            setErrorMessage(errMsg(r.status, j.error))
          }
          return
        }
        const data = (await r.json()) as { items?: PlaySpaceListItem[] }
        if (!cancelled) {
          setStatus('ready')
          setItems(data.items ?? [])
          setErrorMessage(null)
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
          setItems([])
          setErrorMessage('Could not reach the API.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, opts.mine, opts.q, reloadToken])

  return { status, items, errorMessage, reload }
}

export async function fetchPlaySpace(key: string): Promise<PlaySpaceListItem> {
  const r = await fetch(`/api/v1/play-spaces/${encodeURIComponent(key)}`, { credentials: 'include' })
  const j = (await r.json().catch(() => ({}))) as PlaySpaceListItem & { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return j
}

export async function createPlaySpace(body: {
  title: string
  description?: string
  locationLabel?: string
  visibility: 'public' | 'unlisted' | 'private'
  startsAt: string
  endsAt: string
  timezone?: string
}): Promise<PlaySpaceListItem> {
  const r = await fetch('/api/v1/play-spaces', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await r.json().catch(() => ({}))) as PlaySpaceListItem & { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return j
}

export async function joinPlaySpace(key: string, inviteCode?: string): Promise<void> {
  const r = await fetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/join`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inviteCode ? { inviteCode } : {}),
  })
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
}

export async function updatePlaySpace(
  key: string,
  body: {
    title?: string
    description?: string | null
    locationLabel?: string | null
    visibility?: 'public' | 'unlisted' | 'private'
    startsAt?: string
    endsAt?: string
    timezone?: string
  },
): Promise<PlaySpaceListItem> {
  const r = await fetch(`/api/v1/play-spaces/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await r.json().catch(() => ({}))) as PlaySpaceListItem & { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return j
}

export async function fetchPlaySpaceDancecard(
  key: string,
  peerUserId?: string,
): Promise<{ mine: DancecardEntry[]; peer: DancecardEntry[] }> {
  const params = new URLSearchParams()
  if (peerUserId) params.set('peerUserId', peerUserId)
  const qs = params.toString()
  const r = await fetch(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard${qs ? `?${qs}` : ''}`,
    { credentials: 'include' },
  )
  const j = (await r.json().catch(() => ({}))) as {
    mine?: DancecardEntry[]
    peer?: DancecardEntry[]
    error?: string
  }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return { mine: j.mine ?? [], peer: j.peer ?? [] }
}

export async function addPlaySpaceDancecardEntry(
  key: string,
  body: { title: string; startsAt: string; endsAt: string; location?: string; notes?: string },
): Promise<DancecardEntry> {
  const r = await fetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await r.json().catch(() => ({}))) as DancecardEntry & { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return j
}

export async function deletePlaySpaceDancecardEntry(key: string, entryId: string): Promise<void> {
  const r = await fetch(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/${encodeURIComponent(entryId)}`,
    { method: 'DELETE', credentials: 'include' },
  )
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
}

export type PlaySpaceMember = {
  userId: string
  role: string
  joinedAt: string
  username: string
  displayName?: string | null
}

export async function fetchPlaySpaceMembers(key: string): Promise<PlaySpaceMember[]> {
  const r = await fetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/members`, {
    credentials: 'include',
  })
  const j = (await r.json().catch(() => ({}))) as { items?: PlaySpaceMember[]; error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return j.items ?? []
}
