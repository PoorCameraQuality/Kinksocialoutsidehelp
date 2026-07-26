import { useCallback, useEffect, useState } from 'react'
import type { ApiGroupListItem } from '@/hooks/useApiGroups'

export type MyGroupListItem = ApiGroupListItem & {
  myRole: string
}

export function useApiMyGroups(enabled: boolean) {
  const [items, setItems] = useState<MyGroupListItem[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const r = await fetch('/api/v1/me/groups', { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { items?: MyGroupListItem[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setError('Could not load your groups')
      setItems([])
      setStatus('error')
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, status, error, reload }
}
