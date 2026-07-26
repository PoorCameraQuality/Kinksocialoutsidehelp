import { useCallback, useEffect, useState } from 'react'

export type PlatformStaffMe = {
  moderator: boolean
  siteOwner?: boolean
  siteAdmin: boolean
  trustSafetyAdmin?: boolean
  legalAdmin?: boolean
  role: 'OWNER_ADMIN' | 'SITE_ADMIN' | 'MODERATOR' | 'TRUST_SAFETY_ADMIN' | 'LEGAL_ADMIN' | null
}

export function useApiPlatformStaff(enabled: boolean) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [staff, setStaff] = useState<PlatformStaffMe | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setStaff(null)
      setStatus('ready')
      return
    }
    setStatus('loading')
    try {
      const r = await fetch('/api/v1/moderation/me', { credentials: 'include' })
      if (!r.ok) {
        setStatus('error')
        setStaff(null)
        return
      }
      setStaff((await r.json()) as PlatformStaffMe)
      setStatus('ready')
    } catch {
      setStatus('error')
      setStaff(null)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, staff, reload }
}
