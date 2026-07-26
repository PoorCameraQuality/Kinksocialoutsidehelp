import { useCallback, useEffect, useState } from 'react'

export type PaymentsVaultStatus = {
  configured: boolean
  unlocked: boolean
  unlockExpiresAt: string | null
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error || fallback
  } catch {
    return fallback
  }
}

export function useApiPaymentsVault() {
  const [status, setStatus] = useState<PaymentsVaultStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/me/payments-vault', { credentials: 'include' })
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not load payments vault status'))
      setStatus((await res.json()) as PaymentsVaultStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vault status')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setup = useCallback(
    async (input: { loginPassword: string; vaultPassword: string; confirmVaultPassword: string }) => {
      const res = await fetch('/api/v1/me/payments-vault', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not set payments password'))
      const next = (await res.json()) as PaymentsVaultStatus
      setStatus(next)
      return next
    },
    [],
  )

  const unlock = useCallback(async (vaultPassword: string) => {
    const res = await fetch('/api/v1/me/payments-vault/unlock', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultPassword }),
    })
    if (!res.ok) throw new Error(await errorMessage(res, 'Could not unlock payments'))
    const next = (await res.json()) as PaymentsVaultStatus
    setStatus(next)
    return next
  }, [])

  const lock = useCallback(async () => {
    const res = await fetch('/api/v1/me/payments-vault/lock', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) throw new Error(await errorMessage(res, 'Could not lock payments'))
    const next = (await res.json()) as PaymentsVaultStatus
    setStatus(next)
    return next
  }, [])

  return { status, loading, error, refresh, setup, unlock, lock }
}
