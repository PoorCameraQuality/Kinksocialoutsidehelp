'use client'

import { useCallback, useState } from 'react'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from '@/components/dancecard/organizer/settings/eventSettingsConfig'

type InviteRow = {
  id: string
  token: string
  expiresAt: string
  redeemedAt: string | null
}

type Props = {
  conventionKey: string
}

export function StaffInviteLinksPanel({ conventionKey }: Props) {
  const [expiresHours, setExpiresHours] = useState(72)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<InviteRow | null>(null)
  const [copied, setCopied] = useState(false)

  const createInvite = useCallback(async () => {
    setBusy(true)
    setErr(null)
    setCopied(false)
    try {
      const r = await fetch(
        `/api/v1/conventions/${encodeURIComponent(conventionKey)}/staff-invite-tokens`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresInHours: expiresHours }),
        },
      )
      const j = (await r.json().catch(() => ({}))) as { error?: string; invite?: InviteRow }
      if (!r.ok) {
        setErr(j.error ?? `Could not create invite (HTTP ${r.status})`)
        return
      }
      if (j.invite) setLastInvite(j.invite)
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }, [conventionKey, expiresHours])

  async function copyToken() {
    if (!lastInvite?.token) return
    try {
      await navigator.clipboard.writeText(lastInvite.token)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Could not copy to clipboard')
    }
  }

  return (
    <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-dc-text">Staff pre-access invite</h3>
        <p className="mt-1 text-xs text-dc-muted max-w-2xl">
          Convention access only. Event team grants are assigned separately in Settings → Event team.
          Generate a one-time token and share it with the volunteer; they redeem while signed in via{' '}
          <code className="text-[10px]">POST .../staff-invite-tokens/redeem</code> (no public convention URL yet).
        </p>
      </div>
      <label htmlFor="staff-invite-expires-hours" className={SETTINGS_LABEL_CLASS}>
        Expires in (hours)
      </label>
      <input
        id="staff-invite-expires-hours"
        type="number"
        min={1}
        max={720}
        className={SETTINGS_FIELD_CLASS}
        value={expiresHours}
        onChange={(e) => setExpiresHours(Math.max(1, Math.min(720, Number(e.target.value) || 72)))}
      />
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void createInvite()}
        className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-fg disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Generate invite token'}
      </button>
      {lastInvite ?
        <div className="rounded-lg border border-dc-border bg-dc-elevated-solid p-3 space-y-2 text-sm">
          <p className="text-xs text-dc-muted">
            Expires {new Date(lastInvite.expiresAt).toLocaleString()}
            {lastInvite.redeemedAt ? ` · Redeemed ${new Date(lastInvite.redeemedAt).toLocaleString()}` : ''}
          </p>
          <p className="font-mono text-xs break-all text-dc-text">{lastInvite.token}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyToken()}
              className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text hover:bg-dc-elevated-muted"
            >
              {copied ? 'Copied' : 'Copy token'}
            </button>
          </div>
        </div>
      : null}
    </div>
  )
}
