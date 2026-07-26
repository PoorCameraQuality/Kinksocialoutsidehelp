'use client'

import { useCallback, useEffect, useState } from 'react'
import { Panel } from '@/components/dancecard/ui/Panel'
import { useAuth } from '@/contexts/AuthContext'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function SettingsPushEnableBanner() {
  const { isAuthenticated, isFallback } = useAuth()
  const [configured, setConfigured] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (typeof Notification !== 'undefined') {
      setBrowserPermission(Notification.permission)
    } else {
      setBrowserPermission('unsupported')
    }
    const r = await fetch('/api/v1/me/push/status', { credentials: 'include' })
    if (!r.ok) return
    const d = (await r.json()) as {
      configured?: boolean
      vapidPublicKey?: string | null
      pushEnabled?: boolean
      subscribed?: boolean
    }
    setConfigured(Boolean(d.configured && d.vapidPublicKey))
    setPushEnabled(Boolean(d.pushEnabled))
    setSubscribed(Boolean(d.subscribed))
  }, [])

  useEffect(() => {
    if (!isAuthenticated || isFallback) return
    void refresh()
  }, [isAuthenticated, isFallback, refresh])

  const setAccountPushPref = async (enabled: boolean) => {
    await fetch('/api/v1/me/notification-preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushEnabled: enabled }),
    })
    setPushEnabled(enabled)
  }

  const enable = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMsg('Push not supported in this browser')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await setAccountPushPref(true)
      const statusRes = await fetch('/api/v1/me/push/status', { credentials: 'include' })
      const status = (await statusRes.json()) as { vapidPublicKey?: string | null }
      if (!status.vapidPublicKey) {
        setMsg('Push not configured on server (VAPID keys required)')
        return
      }
      const perm = await Notification.requestPermission()
      setBrowserPermission(perm)
      if (perm !== 'granted') {
        setMsg('Notification permission denied — push stays off on this device')
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
      setMsg('Push enabled with generic privacy-safe alerts on this device.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await fetch('/api/v1/me/push/disable', { method: 'POST', credentials: 'include' })
      setPushEnabled(false)
      setSubscribed(false)
      setMsg('Push disabled for your account on all devices.')
    } finally {
      setBusy(false)
    }
  }

  if (!isAuthenticated || isFallback) return null

  return (
    <Panel className="scroll-mt-24 border-dc-accent/30 bg-dc-accent/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-dc-text">Browser push (optional)</h2>
          <p className="mt-1 text-sm text-dc-muted max-w-prose">
            Push is off by default. We only send generic text (no message previews or sensitive details on your
            lock screen). Browser permission alone is not enough — you must enable push here too.
          </p>
          <p className="mt-2 text-xs text-dc-muted">
            Browser permission:{' '}
            {browserPermission === 'unsupported' ? 'not supported' : browserPermission}
            {subscribed ? ' · subscription active' : ''}
          </p>
          {!configured ?
            <p className="mt-2 text-xs text-dc-muted">Server push is off until VAPID keys are configured on the API.</p>
          : null}
          {msg ? <p className="mt-2 text-xs text-dc-muted">{msg}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void enable()}
            className="rounded-xl bg-dc-accent px-5 py-2.5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {busy ? 'Working…' : pushEnabled && subscribed ? 'Re-register device' : 'Enable push'}
          </button>
          {pushEnabled || subscribed ?
            <button
              type="button"
              disabled={busy}
              onClick={() => void disable()}
              className="rounded-xl border border-dc-border px-5 py-2.5 text-sm font-medium text-dc-muted hover:text-dc-text disabled:opacity-50"
            >
              Disable push
            </button>
          : null}
        </div>
      </div>
    </Panel>
  )
}
