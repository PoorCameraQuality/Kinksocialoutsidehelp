import { useState } from 'react'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'
import { Link } from 'react-router-dom'

export default function ModerationAdminPage() {
  const { staff } = useApiPlatformStaff(true)
  const [orgSlug, setOrgSlug] = useState('demo-east-collective')
  const [userId, setUserId] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!staff?.siteAdmin) {
    return (
      <p className="text-sm text-dc-muted">
        Site admin access required. See{' '}
        <Link to="/moderation/reports" className="text-dc-accent hover:underline">
          reports
        </Link>
        .
      </p>
    )
  }

  async function freezeOrg() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/v1/moderation/admin/organizations/${encodeURIComponent(orgSlug)}/freeze`, {
        method: 'POST',
        credentials: 'include',
      })
      setMsg(r.ok ? 'Organization frozen (hub + command bridge).' : `Failed (${r.status})`)
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function identityBan() {
    if (!userId.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/v1/moderation/admin/identity-bans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), reason: 'site_admin_action' }),
      })
      setMsg(r.ok ? 'Identity ban recorded.' : `Failed (${r.status})`)
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Site admin tools</h2>
        <p className="text-sm text-dc-muted mt-1">
          Emergency and break-glass actions are always logged. Overrides on the Actions tab also appear in the audit log.
        </p>
      </div>

      <section className="rounded-2xl border border-dc-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-dc-text">Freeze organization</h3>
        <input
          value={orgSlug}
          onChange={(e) => setOrgSlug(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          placeholder="org slug"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void freezeOrg()}
          className="px-4 py-2 rounded-xl border border-dc-border text-sm"
        >
          Freeze org hub
        </button>
      </section>

      <section className="rounded-2xl border border-dc-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-dc-text">Identity ban (emergency)</h3>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm font-mono"
          placeholder="user UUID"
        />
        <button
          type="button"
          disabled={busy || !userId.trim()}
          onClick={() => void identityBan()}
          className="px-4 py-2 rounded-xl bg-red-900/40 border border-red-500/40 text-sm text-red-100"
        >
          Apply identity ban
        </button>
      </section>

      {msg ? <p className="text-sm text-dc-muted">{msg}</p> : null}
    </div>
  )
}
