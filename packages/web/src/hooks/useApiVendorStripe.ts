import { useCallback, useEffect, useState } from 'react'
import type { OrgStripeStatus, PaymentProcessor } from '@/hooks/useApiOrgStripe'

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string }
    return j.error || j.message || fallback
  } catch {
    return fallback
  }
}

/** Vendor shop payments (Connect / external / manual). Requires payments vault unlock. */
export function useApiVendorStripe(enabled: boolean) {
  const [status, setStatus] = useState<OrgStripeStatus | null>(null)
  const [processor, setProcessor] = useState<PaymentProcessor>('external')
  const [externalPaymentUrl, setExternalPaymentUrl] = useState<string | null>(null)
  const [platformStripeConfigured, setPlatformStripeConfigured] = useState(true)
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/vendors/me/stripe/status', { credentials: 'include' })
      if (!res.ok) {
        throw new Error(await errorMessage(res, 'Could not load vendor payment settings'))
      }
      const st = await readJson<{
        stripe: OrgStripeStatus
        processor?: PaymentProcessor
        externalPaymentUrl?: string | null
        platformStripeConfigured?: boolean
        publishableKey: string | null
      }>(res)
      setStatus(st.stripe)
      setProcessor(st.processor ?? 'external')
      setExternalPaymentUrl(st.externalPaymentUrl ?? null)
      setPlatformStripeConfigured(st.platformStripeConfigured !== false)
      setPublishableKey(st.publishableKey)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payment settings')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updatePayments = useCallback(
    async (input: { processor?: PaymentProcessor; externalPaymentUrl?: string | null }) => {
      const res = await fetch('/api/v1/vendors/me/payments', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not update payment settings'))
      await refresh()
    },
    [refresh],
  )

  const startConnect = useCallback(async () => {
    const res = await fetch('/api/v1/vendors/me/stripe/connect', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) throw new Error(await errorMessage(res, 'Connect failed'))
    return readJson<{
      accountLinkUrl: string
      publishableKey: string | null
      stripe: OrgStripeStatus
    }>(res)
  }, [])

  return {
    status,
    processor,
    externalPaymentUrl,
    platformStripeConfigured,
    publishableKey,
    loading,
    error,
    refresh,
    updatePayments,
    startConnect,
  }
}

export async function startVendorProductCheckout(params: {
  vendorKey: string
  productId: string
}): Promise<string> {
  const res = await fetch(
    `/api/v1/vendors/${encodeURIComponent(params.vendorKey)}/products/${encodeURIComponent(params.productId)}/checkout`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  )
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error || 'Checkout failed')
  }
  const j = (await res.json()) as { url: string }
  return j.url
}
