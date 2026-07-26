import { useCallback, useEffect, useState } from 'react'
import { buildPersonalPhotoQuota, type PersonalPhotoQuota } from '@c2k/shared'

export function usePersonalPhotoQuota(enabled = true) {
  const [quota, setQuota] = useState<PersonalPhotoQuota | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const reload = useCallback(async () => {
    if (!enabled) {
      setQuota(null)
      setStatus('idle')
      return
    }
    setStatus('loading')
    try {
      const r = await fetch('/api/v1/me/personal-photo-quota', { credentials: 'include' })
      if (r.status === 503) {
        setQuota(null)
        setStatus('error')
        return
      }
      if (!r.ok) {
        setQuota(null)
        setStatus('error')
        return
      }
      const data = (await r.json()) as { quota?: PersonalPhotoQuota }
      setQuota(data.quota ?? null)
      setStatus('ready')
    } catch {
      setQuota(null)
      setStatus('error')
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { quota, status, reload, setQuota }
}

export function mergePersonalPhotoQuota(
  current: PersonalPhotoQuota | null,
  next: PersonalPhotoQuota | undefined,
): PersonalPhotoQuota | null {
  if (next) return next
  return current
}

export function bumpPersonalPhotoQuotaUsed(quota: PersonalPhotoQuota, delta = 1): PersonalPhotoQuota {
  return buildPersonalPhotoQuota(quota.used + delta, quota.limit)
}
