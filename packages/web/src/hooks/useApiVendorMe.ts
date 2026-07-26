import { useCallback, useEffect, useState } from 'react'
import type { ApiVendorRow } from '@/lib/api-vendor-mapper'

export type VendorHistoryItem = {
  eventId: string
  eventTitle: string
  startsAt: string
}

export type ApiVendorMeResult = {
  status: 'idle' | 'loading' | 'ready' | 'none' | 'error'
  vendor: ApiVendorRow | null
  history: VendorHistoryItem[]
  reload: () => void
}

export function useApiVendorMe(enabled = true): ApiVendorMeResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiVendorMeResult, 'status' | 'vendor' | 'history'>>({
    status: 'idle',
    vendor: null,
    history: [],
  })

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', vendor: null, history: [] })
      return
    }
    let cancelled = false
    void (async () => {
      setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch('/api/v1/me/vendor-profile', { credentials: 'include' })
        if (r.status === 404) {
          if (!cancelled) setState({ status: 'none', vendor: null, history: [] })
          return
        }
        if (!r.ok) {
          const me = await fetch('/api/v1/vendors/me', { credentials: 'include' })
          if (me.status === 404) {
            if (!cancelled) setState({ status: 'none', vendor: null, history: [] })
            return
          }
          if (!me.ok) {
            if (!cancelled) setState({ status: 'error', vendor: null, history: [] })
            return
          }
          const j = (await me.json()) as { vendor?: ApiVendorRow }
          if (!cancelled) setState({ status: 'ready', vendor: j.vendor ?? null, history: [] })
          return
        }
        const j = (await r.json()) as { vendor?: ApiVendorRow; history?: VendorHistoryItem[] }
        if (!cancelled) {
          setState({
            status: 'ready',
            vendor: j.vendor ?? null,
            history: j.history ?? [],
          })
        }
      } catch {
        if (!cancelled) setState({ status: 'error', vendor: null, history: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return { ...state, reload }
}
