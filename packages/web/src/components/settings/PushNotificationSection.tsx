'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function PushNotificationSection() {
  const { isAuthenticated, isFallback } = useAuth()
  const [configured, setConfigured] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pushAnnouncements, setPushAnnouncements] = useState(true)
  const [pushChat, setPushChat] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/v1/me/push/status', { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as { configured?: boolean; vapidPublicKey?: string | null }
    setConfigured(Boolean(d.configured && d.vapidPublicKey))
  }, [])

  const loadPrefs = useCallback(async () => {
    setPrefsLoading(true)
    try {
      const r = await fetch('/api/v1/me/notification-preferences', { credentials: 'include' })
      if (!r.ok) return
      const d = (await r.json()) as {
        pushHubAnnouncements?: boolean
        pushHubChat?: boolean
      }
      setPushAnnouncements(d.pushHubAnnouncements ?? true)
      setPushChat(d.pushHubChat ?? true)
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || isFallback) return
    void refresh()
    void loadPrefs()
  }, [isAuthenticated, isFallback, refresh, loadPrefs])

  const savePrefs = async (patch: { pushHubAnnouncements?: boolean; pushHubChat?: boolean }) => {
    setPrefsSaving(true)
    setMsg(null)
    try {
      const r = await fetch('/api/v1/me/notification-preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) {
        setMsg('Could not save push preferences')
        return
      }
      const d = (await r.json()) as {
        pushHubAnnouncements?: boolean
        pushHubChat?: boolean
      }
      setPushAnnouncements(d.pushHubAnnouncements ?? true)
      setPushChat(d.pushHubChat ?? true)
      setMsg('Saved')
    } finally {
      setPrefsSaving(false)
    }
  }

  const enable = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMsg('Push not supported in this browser')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const statusRes = await fetch('/api/v1/me/push/status', { credentials: 'include' })
      const status = (await statusRes.json()) as { vapidPublicKey?: string | null }
      if (!status.vapidPublicKey) {
        setMsg('Push not configured on server (set VAPID keys)')
        return
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setMsg('Notification permission denied')
        return
      }
      await navigator.serviceWorker.register('/sw-push.js')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(status.vapidPublicKey),
      })
      const json = sub.toJSON()
      const r = await fetch('/api/v1/me/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })
      if (!r.ok) {
        setMsg('Could not save subscription')
        return
      }
      setSubscribed(true)
      setMsg('Push enabled for pinned conventions')
    } finally {
      setBusy(false)
    }
  }

  if (!isAuthenticated || isFallback) return null

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 space-y-3">
      <h2 className="text-lg font-semibold text-dc-text">Browser push</h2>
      <p className="text-sm text-dc-text-muted">
        Notifications for conventions you pin. Choose which hub channels send push (requires VAPID keys on the API).
      </p>
      <button
        type="button"
        disabled={busy || !configured}
        onClick={() => void enable()}
        className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
      >
        {busy ? 'Enabling…' : subscribed ? 'Re-enable push' : 'Enable push notifications'}
      </button>
      {!configured ?
        <p className="text-xs text-dc-muted">
          Server push is disabled until VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set.
        </p>
      : null}
      {!prefsLoading ?
        <div className="space-y-2 border-t border-dc-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-dc-muted">Pinned convention channels</p>
          <label className="flex items-center gap-3 text-sm text-dc-text-muted">
            <input
              type="checkbox"
              checked={pushAnnouncements}
              disabled={prefsSaving || !configured}
              onChange={(e) => void savePrefs({ pushHubAnnouncements: e.target.checked })}
              className="h-4 w-4 rounded border-dc-border-strong"
            />
            Announcements
          </label>
          <label className="flex items-center gap-3 text-sm text-dc-text-muted">
            <input
              type="checkbox"
              checked={pushChat}
              disabled={prefsSaving || !configured}
              onChange={(e) => void savePrefs({ pushHubChat: e.target.checked })}
              className="h-4 w-4 rounded border-dc-border-strong"
            />
            Chat (general and other CHAT channels)
          </label>
        </div>
      : (
        <p className="text-xs text-dc-muted">Loading channel preferences…</p>
      )}
      {msg ? <p className="text-xs text-dc-muted">{msg}</p> : null}
    </section>
  )
}
