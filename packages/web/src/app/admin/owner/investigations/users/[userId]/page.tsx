import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'

type Summary = {
  user: {
    id: string
    username: string
    displayName: string | null
    createdAt: string
    accountStatus: string
    platformRoles: string[]
    legalHoldActive: boolean
  }
  counts: { feedPosts: number; dmConversations: number; mediaAssets: number }
}

function ReasonGate({
  label,
  onLoad,
  busy,
}: {
  label: string
  onLoad: (reason: string) => void
  busy: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="flex flex-wrap items-end gap-2 mt-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-dc-muted">Reason (required, min 10 chars)</span>
        <input
          className="rounded border border-dc-border bg-dc-surface px-2 py-1 min-w-[280px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`Why you need ${label}`}
        />
      </label>
      <button
        type="button"
        disabled={busy || reason.trim().length < 10}
        className="rounded bg-dc-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
        onClick={() => onLoad(reason.trim())}
      >
        {busy ? 'Loading…' : `Load ${label}`}
      </button>
    </div>
  )
}

export default function OwnerInvestigationUserPage() {
  const { userId = '' } = useParams()
  const { staff, status } = useApiPlatformStaff(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sensitive, setSensitive] = useState<unknown>(null)
  const [activity, setActivity] = useState<unknown>(null)
  const [dms, setDms] = useState<unknown>(null)
  const [dmMessages, setDmMessages] = useState<unknown>(null)
  const [moderation, setModeration] = useState<unknown>(null)
  const [media, setMedia] = useState<unknown>(null)
  const [selectedConv, setSelectedConv] = useState('')

  const fetchSummary = useCallback(async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/v1/admin/owner/investigations/users/${encodeURIComponent(userId)}`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setError(`Summary failed (${r.status})`)
        return
      }
      setSummary((await r.json()) as Summary)
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }, [userId])

  useEffect(() => {
    if (staff?.siteOwner && userId) void fetchSummary()
  }, [staff?.siteOwner, userId, fetchSummary])

  async function fetchSection(path: string, reason: string, setter: (v: unknown) => void) {
    setBusy(true)
    setError(null)
    try {
      const url = `/api/v1/admin/owner/investigations/users/${encodeURIComponent(userId)}/${path}`
      const r = await fetch(url, {
        credentials: 'include',
        headers: { 'X-C2K-Investigation-Reason': reason },
      })
      if (!r.ok) {
        setError(`Request failed (${r.status})`)
        return
      }
      setter(await r.json())
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') {
    return <p className="p-6 text-sm text-dc-muted">Checking access…</p>
  }

  if (!staff?.siteOwner) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm text-dc-muted">Owner-only investigation console. Access denied.</p>
        <Link to="/" className="text-dc-accent text-sm hover:underline">
          Home
        </Link>
      </div>
    )
  }

  if (!userId) return <Navigate to="/admin/owner/investigations" replace />

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-dc-muted">Owner investigation (read-only)</p>
        <h1 className="text-xl font-semibold text-dc-text">User {userId}</h1>
        <p className="text-sm text-dc-muted">
          Read-only. Does not notify the user, mark DMs read, or modify account data.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </header>

      <section className="rounded border border-dc-border p-4 space-y-2">
        <h2 className="font-medium">Account basics</h2>
        {summary ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-dc-muted">Username</dt>
              <dd>{summary.user.username}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Display name</dt>
              <dd>{summary.user.displayName ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Created</dt>
              <dd>{new Date(summary.user.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Status</dt>
              <dd>{summary.user.accountStatus}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Roles</dt>
              <dd>{summary.user.platformRoles.join(', ') || 'none'}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Legal hold</dt>
              <dd>{summary.user.legalHoldActive ? 'active' : 'none'}</dd>
            </div>
            <div>
              <dt className="text-dc-muted">Posts / DMs / Media</dt>
              <dd>
                {summary.counts.feedPosts} / {summary.counts.dmConversations} / {summary.counts.mediaAssets}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-dc-muted">{busy ? 'Loading…' : 'No data'}</p>
        )}
      </section>

      <section className="rounded border border-dc-border p-4">
        <h2 className="font-medium">Sensitive account data</h2>
        <ReasonGate label="sensitive data" onLoad={(r) => fetchSection('sensitive', r, setSensitive)} busy={busy} />
        {sensitive !== null && (
          <pre className="mt-3 overflow-auto rounded bg-dc-surface p-3 text-xs">{JSON.stringify(sensitive, null, 2)}</pre>
        )}
      </section>

      <section className="rounded border border-dc-border p-4">
        <h2 className="font-medium">Activity timeline</h2>
        <ReasonGate label="activity" onLoad={(r) => fetchSection('activity', r, setActivity)} busy={busy} />
        {activity !== null && (
          <pre className="mt-3 overflow-auto rounded bg-dc-surface p-3 text-xs max-h-64">{JSON.stringify(activity, null, 2)}</pre>
        )}
      </section>

      <section className="rounded border border-dc-border p-4 space-y-3">
        <h2 className="font-medium">Direct messages</h2>
        <ReasonGate label="DM list" onLoad={(r) => fetchSection('dms', r, setDms)} busy={busy} />
        {dms !== null && (
          <pre className="overflow-auto rounded bg-dc-surface p-3 text-xs max-h-48">{JSON.stringify(dms, null, 2)}</pre>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm flex flex-col gap-1">
            <span className="text-dc-muted">Conversation ID</span>
            <input
              className="rounded border border-dc-border bg-dc-surface px-2 py-1 min-w-[280px]"
              value={selectedConv}
              onChange={(e) => setSelectedConv(e.target.value)}
            />
          </label>
          <ReasonGate
            label="DM messages"
            busy={busy}
            onLoad={(reason) => {
              if (!selectedConv.trim()) {
                setError('Enter a conversation ID')
                return
              }
              void fetchSection(
                `dms/${encodeURIComponent(selectedConv.trim())}/messages`,
                reason,
                setDmMessages,
              )
            }}
          />
        </div>
        {dmMessages !== null && (
          <pre className="overflow-auto rounded bg-dc-surface p-3 text-xs max-h-96">{JSON.stringify(dmMessages, null, 2)}</pre>
        )}
      </section>

      <section className="rounded border border-dc-border p-4">
        <h2 className="font-medium">Reports & moderation</h2>
        <ReasonGate label="moderation" onLoad={(r) => fetchSection('moderation', r, setModeration)} busy={busy} />
        {moderation !== null && (
          <pre className="mt-3 overflow-auto rounded bg-dc-surface p-3 text-xs max-h-64">{JSON.stringify(moderation, null, 2)}</pre>
        )}
      </section>

      <section className="rounded border border-dc-border p-4">
        <h2 className="font-medium">Media uploads</h2>
        <ReasonGate label="media" onLoad={(r) => fetchSection('media', r, setMedia)} busy={busy} />
        {media !== null && (
          <pre className="mt-3 overflow-auto rounded bg-dc-surface p-3 text-xs max-h-64">{JSON.stringify(media, null, 2)}</pre>
        )}
      </section>
    </div>
  )
}
