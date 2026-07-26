'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  conventionSlug: string
  channels: Array<{ id: string; slug?: string; name: string; kind: string; sortOrder?: number }>
  onCreated: () => void
  readOnly?: boolean
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export default function ConventionHubChannelsAdmin({
  conventionSlug,
  channels,
  onCreated,
  readOnly = false,
}: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [kind, setKind] = useState<'CHAT' | 'ANNOUNCEMENTS'>('CHAT')
  const [sortOrder, setSortOrder] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function createChannel(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    setErr(null)
    setMsg(null)
    const channelSlug = (slug.trim() || slugifyName(name)).toLowerCase()
    if (!channelSlug || !name.trim()) {
      setErr('Name and slug are required.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(
        `/api/v1/conventions/${encodeURIComponent(conventionSlug)}/hub-channels`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: channelSlug,
            name: name.trim(),
            kind,
            sortOrder,
          }),
        },
      )
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error ?? 'Could not create channel.')
        return
      }
      setName('')
      setSlug('')
      setSortOrder(0)
      setMsg('Channel created.')
      onCreated()
    } catch {
      setErr('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 border-t border-dc-border pt-6">
      <div>
        <h3 className="text-base font-semibold text-dc-text">Convention chat channels</h3>
        <p className="text-xs text-dc-muted mt-1">
          Attendees see these on the Chat tab. Create at least one channel to enable convention hub chat.
        </p>
      </div>

      {channels.length > 0 ?
        <ul className="space-y-1 text-sm">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-dc-text-muted">
              <span className="font-medium text-dc-text">{c.name}</span>
              {c.slug ? <code className="text-[11px] font-mono">{c.slug}</code> : null}
              <span className="text-[11px] uppercase">{c.kind}</span>
            </li>
          ))}
        </ul>
      : (
        <p className="text-sm text-dc-muted rounded-lg border border-dashed border-dc-border px-3 py-4">
          No channels yet. Add one below.
        </p>
      )}

      <Link
        to={`/conventions/${encodeURIComponent(conventionSlug)}?tab=Chat`}
        className="inline-flex text-xs font-medium text-dc-accent hover:underline"
      >
        Open Chat tab
      </Link>

      {!readOnly ?
        <form onSubmit={(e) => void createChannel(e)} className="space-y-3 rounded-xl border border-dc-border bg-dc-elevated/80 p-4">
          <div>
            <label className="block text-xs text-dc-muted mb-1">Channel name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slug.trim()) setSlug(slugifyName(e.target.value))
              }}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              placeholder="General chat"
            />
          </div>
          <div>
            <label className="block text-xs text-dc-muted mb-1">URL slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm font-mono"
              placeholder="general"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-dc-muted mb-1">Kind</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'CHAT' | 'ANNOUNCEMENTS')}
                className="px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              >
                <option value="CHAT">Chat</option>
                <option value="ANNOUNCEMENTS">Announcements</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-dc-muted mb-1">Sort order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="w-24 px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
              />
            </div>
          </div>
          {err ? <p className="text-xs text-red-200" role="alert">{err}</p> : null}
          {msg ? <p className="text-xs text-emerald-200" role="status">{msg}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create channel'}
          </button>
        </form>
      : null}
    </section>
  )
}
