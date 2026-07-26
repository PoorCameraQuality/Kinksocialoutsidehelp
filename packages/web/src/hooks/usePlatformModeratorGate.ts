import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type PlatformModeratorGate = {
  gate: 'idle' | 'loading' | 'ok' | 'no' | 'err'
  siteAdmin: boolean
  reload: () => void
}

export function usePlatformModeratorGate(): PlatformModeratorGate {
  const { isAuthenticated, status: authStatus } = useAuth()
  const [gate, setGate] = useState<PlatformModeratorGate['gate']>('idle')
  const [siteAdmin, setSiteAdmin] = useState(false)

  const reload = useCallback(async () => {
    if (authStatus !== 'ready' || !isAuthenticated) {
      setGate('idle')
      return
    }
    setGate('loading')
    try {
      const r = await fetch('/api/v1/moderation/me', { credentials: 'include' })
      if (!r.ok) {
        setGate('err')
        return
      }
      const data = (await r.json()) as { moderator?: boolean; siteAdmin?: boolean }
      setSiteAdmin(Boolean(data.siteAdmin))
      setGate(data.moderator ? 'ok' : 'no')
    } catch {
      setGate('err')
    }
  }, [authStatus, isAuthenticated])

  useEffect(() => {
    void reload()
  }, [reload])

  return { gate, siteAdmin, reload }
}
