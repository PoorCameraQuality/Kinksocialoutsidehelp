import { useCallback, useEffect, useState } from 'react'

export type MuteKind = 'TAG' | 'USER' | 'GROUP'

export type ApiMuteTag = {
  id: string
  slug: string
  displayName: string
}

export type ApiMuteUser = {
  id: string
  username: string
  displayName: string | null
}

export type ApiMuteGroup = {
  id: string
  slug: string
  name: string
}

export type ApiMuteRow = {
  id: string
  targetId: string
  targetKind: MuteKind
  createdAt: string
  tag: ApiMuteTag | null
  user: ApiMuteUser | null
  group: ApiMuteGroup | null
}

export type UseApiMutesResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiMuteRow[]
  error: string | null
  reload: () => void
  mute: (targetId: string) => Promise<boolean>
  unmute: (muteId: string) => Promise<boolean>
  muteBusy: boolean
  unmuteBusy: boolean
}

const kindLabel: Record<MuteKind, string> = {
  TAG: 'tags',
  USER: 'members',
  GROUP: 'groups',
}

export function useApiMutes(enabled: boolean, kind: MuteKind): UseApiMutesResult {
  const [status, setStatus] = useState<UseApiMutesResult['status']>('idle')
  const [items, setItems] = useState<ApiMuteRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [muteBusy, setMuteBusy] = useState(false)
  const [unmuteBusy, setUnmuteBusy] = useState(false)

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
      const r = await fetch(`/api/mutes/me?kind=${kind}`, { credentials: 'include' })
      if (r.status === 401) {
        setStatus('ready')
        setItems([])
        return
      }
      if (r.status === 503) {
        setStatus('error')
        setError(`Muted ${kindLabel[kind]} require database mode.`)
        setItems([])
        return
      }
      if (!r.ok) {
        setStatus('error')
        setError(`Could not load muted ${kindLabel[kind]} (HTTP ${r.status}).`)
        setItems([])
        return
      }
      const data = (await r.json()) as {
        mutes?: Array<{
          id: string
          targetId: string
          targetKind: MuteKind
          createdAt: string
          tag?: ApiMuteTag | null
          user?: ApiMuteUser | null
          group?: ApiMuteGroup | null
        }>
      }
      setItems(
        (data.mutes ?? []).map((m) => ({
          id: m.id,
          targetId: m.targetId,
          targetKind: m.targetKind,
          createdAt: m.createdAt,
          tag: m.tag ?? null,
          user: m.user ?? null,
          group: m.group ?? null,
        })),
      )
      setStatus('ready')
    } catch {
      setStatus('error')
      setError(`Network error loading muted ${kindLabel[kind]}.`)
      setItems([])
    }
  }, [enabled, kind])

  useEffect(() => {
    void reload()
  }, [reload])

  const mute = useCallback(
    async (targetId: string) => {
      if (!enabled) return false
      setMuteBusy(true)
      try {
        const r = await fetch('/api/mutes/me', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetKind: kind, targetId }),
        })
        if (!r.ok) return false
        await reload()
        return true
      } catch {
        return false
      } finally {
        setMuteBusy(false)
      }
    },
    [enabled, kind, reload],
  )

  const unmute = useCallback(
    async (muteId: string) => {
      if (!enabled) return false
      setUnmuteBusy(true)
      try {
        const r = await fetch(`/api/mutes/me/${encodeURIComponent(muteId)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!r.ok) return false
        setItems((prev) => prev.filter((m) => m.id !== muteId))
        return true
      } catch {
        return false
      } finally {
        setUnmuteBusy(false)
      }
    },
    [enabled],
  )

  return { status, items, error, reload, mute, unmute, muteBusy, unmuteBusy }
}