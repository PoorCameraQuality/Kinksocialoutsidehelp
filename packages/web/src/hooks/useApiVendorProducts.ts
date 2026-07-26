import { useCallback, useEffect, useState } from 'react'
import { vendorProductsPath } from '@/lib/vendor-api-paths'

export type VendorProduct = {
  id: string
  vendorId: string
  title: string
  priceCents: number
  listingUrl: string
  primaryImageUrl: string | null
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ApiVendorProductsResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: VendorProduct[]
  max: number
  reload: () => void
}

export function useApiVendorProducts(
  enabled: boolean,
  vendorProfileId?: string | null,
): ApiVendorProductsResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<Pick<ApiVendorProductsResult, 'status' | 'items' | 'max'>>({
    status: 'idle',
    items: [],
    max: 50,
  })

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [], max: 50 })
      return
    }
    let cancelled = false
    void (async () => {
      setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const r = await fetch(vendorProductsPath(vendorProfileId), { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setState({ status: 'error', items: [], max: 50 })
          return
        }
        const j = (await r.json()) as { items?: VendorProduct[]; max?: number }
        if (!cancelled) {
          setState({
            status: 'ready',
            items: Array.isArray(j.items) ? j.items : [],
            max: typeof j.max === 'number' ? j.max : 50,
          })
        }
      } catch {
        if (!cancelled) setState({ status: 'error', items: [], max: 50 })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken, vendorProfileId])

  return { ...state, reload }
}
