'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function EmailNotificationPrefs() {
  const { isAuthenticated, isFallback } = useAuth()
  const [orgDigest, setOrgDigest] = useState(true)
  const [pinnedDigest, setPinnedDigest] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/v1/me/notification-preferences', { credentials: 'include' })
      if (!r.ok) return
      const d = (await r.json()) as {
        orgDigestEmailWeekly?: boolean
        pinnedDigestEmailWeekly?: boolean
      }
      setOrgDigest(d.orgDigestEmailWeekly ?? true)
      setPinnedDigest(d.pinnedDigestEmailWeekly ?? true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || isFallback) return
    void load()
  }, [isAuthenticated, isFallback, load])

  const save = async (patch: { orgDigestEmailWeekly?: boolean; pinnedDigestEmailWeekly?: boolean }) => {
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch('/api/v1/me/notification-preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) {
        setMsg('Could not save email preferences')
        return
      }
      const d = (await r.json()) as {
        orgDigestEmailWeekly?: boolean
        pinnedDigestEmailWeekly?: boolean
      }
      setOrgDigest(d.orgDigestEmailWeekly ?? true)
      setPinnedDigest(d.pinnedDigestEmailWeekly ?? true)
      setMsg('Saved')
    } finally {
      setSaving(false)
    }
  }

  if (!isAuthenticated || isFallback) return null
  if (loading) return <p className="text-sm text-dc-muted">Loading email digests…</p>

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 space-y-3">
      <h2 className="text-lg font-semibold text-dc-text">Email digests</h2>
      <label className="flex items-center gap-3 text-sm text-dc-text-muted">
        <input
          type="checkbox"
          checked={orgDigest}
          disabled={saving}
          onChange={(e) => void save({ orgDigestEmailWeekly: e.target.checked })}
          className="h-4 w-4 rounded border-dc-border-strong"
        />
        Weekly organization digest
      </label>
      <label className="flex items-center gap-3 text-sm text-dc-text-muted">
        <input
          type="checkbox"
          checked={pinnedDigest}
          disabled={saving}
          onChange={(e) => void save({ pinnedDigestEmailWeekly: e.target.checked })}
          className="h-4 w-4 rounded border-dc-border-strong"
        />
        Weekly pinned conventions digest
      </label>
      {msg ? <p className="text-xs text-dc-muted">{msg}</p> : null}
    </section>
  )
}
