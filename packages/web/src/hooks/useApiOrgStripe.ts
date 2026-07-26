import { useCallback, useEffect, useState } from 'react'

export type OrgStripeStatus = {
  configured: boolean
  accountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  readyForCheckout: boolean
  dashboardUrl: string | null
}

export type PaymentProcessor = 'stripe' | 'external' | 'manual'

export type PaymentManager = {
  userId: string
  role: string
  username: string | null
  displayName: string | null
}

export type MembershipPlan = {
  priceId: string
  productId?: string
  name: string
  interval: 'month' | 'year' | string
  amountCents: number
  currency: string
  active?: boolean
}

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

export function useApiOrgStripe(orgKey: string | null) {
  const [status, setStatus] = useState<OrgStripeStatus | null>(null)
  const [processor, setProcessor] = useState<PaymentProcessor>('stripe')
  const [externalPaymentUrl, setExternalPaymentUrl] = useState<string | null>(null)
  const [platformStripeConfigured, setPlatformStripeConfigured] = useState(true)
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [managers, setManagers] = useState<PaymentManager[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!orgKey) return
    setLoading(true)
    setError(null)
    try {
      const [stRes, plansRes] = await Promise.all([
        fetch(`/api/v1/organizations/${encodeURIComponent(orgKey)}/stripe/status`, {
          credentials: 'include',
        }),
        fetch(`/api/v1/organizations/${encodeURIComponent(orgKey)}/stripe/membership-plans`, {
          credentials: 'include',
        }),
      ])
      if (!stRes.ok) {
        throw new Error(await errorMessage(stRes, 'Could not load payment settings'))
      }
      const st = await readJson<{
        stripe: OrgStripeStatus
        processor?: PaymentProcessor
        externalPaymentUrl?: string | null
        platformStripeConfigured?: boolean
        publishableKey: string | null
        canManage?: boolean
        isOwner?: boolean
        managers?: PaymentManager[]
      }>(stRes)
      setStatus(st.stripe)
      setProcessor(st.processor ?? 'stripe')
      setExternalPaymentUrl(st.externalPaymentUrl ?? null)
      setPlatformStripeConfigured(st.platformStripeConfigured !== false)
      setPublishableKey(st.publishableKey)
      setCanManage(Boolean(st.canManage))
      setIsOwner(Boolean(st.isOwner))
      setManagers(Array.isArray(st.managers) ? st.managers : [])
      if (plansRes.ok) {
        const p = await readJson<{ plans: MembershipPlan[] }>(plansRes)
        setPlans(Array.isArray(p.plans) ? p.plans : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payment settings')
    } finally {
      setLoading(false)
    }
  }, [orgKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updatePayments = useCallback(
    async (input: { processor?: PaymentProcessor; externalPaymentUrl?: string | null }) => {
      if (!orgKey) throw new Error('Missing org')
      const res = await fetch(`/api/v1/organizations/${encodeURIComponent(orgKey)}/payments`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not update payment settings'))
      await refresh()
    },
    [orgKey, refresh],
  )

  const setManager = useCallback(
    async (userId: string, canManagePayments: boolean) => {
      if (!orgKey) throw new Error('Missing org')
      const res = await fetch(
        `/api/v1/organizations/${encodeURIComponent(orgKey)}/payments/managers/${encodeURIComponent(userId)}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canManage: canManagePayments }),
        },
      )
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not update payment manager'))
      const j = await readJson<{ managers: PaymentManager[] }>(res)
      setManagers(Array.isArray(j.managers) ? j.managers : [])
    },
    [orgKey],
  )

  const startConnect = useCallback(async () => {
    if (!orgKey) throw new Error('Missing org')
    const res = await fetch(`/api/v1/organizations/${encodeURIComponent(orgKey)}/stripe/connect`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) throw new Error(await errorMessage(res, 'Connect failed'))
    return readJson<{
      accountLinkUrl: string
      accountSessionClientSecret: string | null
      publishableKey: string | null
      stripe: OrgStripeStatus
    }>(res)
  }, [orgKey])

  const openDashboard = useCallback(async () => {
    if (!orgKey) throw new Error('Missing org')
    const res = await fetch(
      `/api/v1/organizations/${encodeURIComponent(orgKey)}/stripe/dashboard-link`,
      { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    if (!res.ok) throw new Error(await errorMessage(res, 'Could not open Stripe Dashboard'))
    const j = await readJson<{ url: string }>(res)
    return j.url
  }, [orgKey])

  const createMembershipPlan = useCallback(
    async (input: { name: string; amountCents: number; interval: 'month' | 'year' }) => {
      if (!orgKey) throw new Error('Missing org')
      const res = await fetch(
        `/api/v1/organizations/${encodeURIComponent(orgKey)}/stripe/membership-plans`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      )
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not create plan'))
      const j = await readJson<{ plans: MembershipPlan[] }>(res)
      setPlans(j.plans)
      return j
    },
    [orgKey],
  )

  return {
    status,
    processor,
    externalPaymentUrl,
    platformStripeConfigured,
    publishableKey,
    plans,
    managers,
    isOwner,
    canManage,
    loading,
    error,
    refresh,
    updatePayments,
    setManager,
    startConnect,
    openDashboard,
    createMembershipPlan,
  }
}

export async function startConventionCheckout(params: {
  conventionKey: string
  categoryId: string
}): Promise<string> {
  const res = await fetch(`/api/v1/conventions/${encodeURIComponent(params.conventionKey)}/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: params.categoryId }),
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
    throw new Error(j.error || 'Checkout failed')
  }
  const j = (await res.json()) as { url: string }
  return j.url
}

export async function startMembershipCheckout(orgKey: string, priceId: string): Promise<string> {
  const res = await fetch(`/api/v1/organizations/${encodeURIComponent(orgKey)}/membership/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error || 'Membership checkout failed')
  }
  const j = (await res.json()) as { url: string }
  return j.url
}

/** Org-owned event ticket Checkout (same Connect account as conventions). */
export async function startEventCheckout(eventId: string): Promise<string> {
  const res = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error || 'Checkout failed')
  }
  const j = (await res.json()) as { url: string }
  return j.url
}
