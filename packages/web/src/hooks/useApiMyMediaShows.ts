import { useCallback, useEffect, useState } from 'react'
import type { ApiListStatus } from '@/hooks/useApiEvents'
import type { ApiMediaShow } from '@/hooks/useApiMediaShows'

export function useApiMyMediaShows(enabled: boolean) {
  const [status, setStatus] = useState<ApiListStatus>('idle')
  const [items, setItems] = useState<ApiMediaShow[]>([])
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
      const r = await fetch('/api/v1/me/media/shows', { credentials: 'include' })
      if (r.status === 503) {
        setError('Media submissions require database mode.')
        setItems([])
        setStatus('error')
        return
      }
      if (!r.ok) {
        setError(`Could not load your channels (HTTP ${r.status}).`)
        setItems([])
        setStatus('error')
        return
      }
      const data = (await r.json()) as { items?: ApiMediaShow[] }
      setItems(data.items ?? [])
      setStatus('ready')
    } catch {
      setError('Network error loading your channels.')
      setItems([])
      setStatus('error')
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, items, error, reload }
}
