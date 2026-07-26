import { useEffect, useState } from 'react'
import type { CommunityTrustLevel } from '@c2k/shared'

export type CommunityTrustBadge = {
  key: string
  label: string
  description: string
  count: number | null
}

export type CommunityTrustData = {
  userId: string
  username: string
  level: CommunityTrustLevel
  headline: string
  badges: CommunityTrustBadge[]
  references?: {
    visible: number
    countedForLevel: number
  }
  sharedContext: {
    sharedOrganizations: number
    sharedGroups: number
    sharedEvents: number
  } | null
}

export function useApiCommunityTrust(userId: string | null | undefined, enabled = true) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [data, setData] = useState<CommunityTrustData | null>(null)

  useEffect(() => {
    if (!enabled || !userId) {
      setStatus('idle')
      setData(null)
      return
    }
    let cancelled = false
    setStatus('loading')
    fetch(`/api/v1/users/${encodeURIComponent(userId)}/community-trust`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<CommunityTrustData>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setStatus('ok')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId, enabled])

  return { status, data }
}

export function useApiCommunityTrustByUsername(username: string | null | undefined, enabled = true) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [data, setData] = useState<CommunityTrustData | null>(null)

  useEffect(() => {
    if (!enabled || !username?.trim()) {
      setStatus('idle')
      setData(null)
      return
    }
    let cancelled = false
    setStatus('loading')
    fetch(`/api/v1/profile/${encodeURIComponent(username)}/community-trust`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<CommunityTrustData>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setStatus('ok')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [username, enabled])

  return { status, data }
}
