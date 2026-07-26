import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type OrganizerOrgScope = {
  slug: string
  role: string
}

export function useOrganizerOrgScopes(): {
  bySlug: Map<string, string>
  loading: boolean
  hasAnyScope: boolean
} {
  const { isAuthenticated, isFallback, status } = useAuth()
  const [bySlug, setBySlug] = useState<Map<string, string>>(new Map())
  const [scopeCount, setScopeCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated || isFallback) {
      setBySlug(new Map())
      setScopeCount(0)
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/v1/organizer/scopes', { credentials: 'include' })
      if (!r.ok) {
        setBySlug(new Map())
        setScopeCount(0)
        return
      }
      const j = (await r.json()) as {
        orgs?: Array<{ slug: string; role: string }>
        groups?: unknown[]
      }
      const map = new Map<string, string>()
      for (const o of j.orgs ?? []) {
        map.set(o.slug, o.role)
      }
      setBySlug(map)
      setScopeCount((j.orgs?.length ?? 0) + (j.groups?.length ?? 0))
    } catch {
      setBySlug(new Map())
      setScopeCount(0)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isFallback])

  useEffect(() => {
    if (status !== 'ready') return
    void load()
  }, [status, load])

  return { bySlug, loading, hasAnyScope: scopeCount > 0 }
}

export function viewerCanManageOrg(bySlug: Map<string, string>, slug: string): boolean {
  return bySlug.has(slug)
}
