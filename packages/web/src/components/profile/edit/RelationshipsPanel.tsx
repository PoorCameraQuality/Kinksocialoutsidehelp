import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PROFILE_DS_RELATIONSHIP_LABELS,
  PROFILE_RELATIONSHIP_LABELS,
} from '@c2k/shared'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import { profileStudioNestedRowClass } from '@/components/profile/studio/profile-studio-classes'
import LabelCombobox from '@/components/ui/LabelCombobox'
import { useProfileEdit, type ProfileRelationshipRow } from '@/contexts/ProfileEditContext'

type IncomingRequest = {
  id: string
  kind: 'relationship' | 'ds'
  label: string
  customText: string | null
  requesterUsername: string | null
}

type ConnectionFriend = {
  username: string
}

function formatRelationshipLine(item: ProfileRelationshipRow): string {
  const parts = [item.label]
  if (item.partnerUsername) parts.push(`@${item.partnerUsername}`)
  if (item.customText) parts.push(`, ${item.customText}`)
  return parts.join(' ')
}

function RelationshipBlock({
  title,
  kind,
  labelSuggestions,
  items,
  friends,
  viewerDisplayName,
  onReload,
}: {
  title: string
  kind: 'relationship' | 'ds'
  labelSuggestions: readonly string[]
  items: ProfileRelationshipRow[]
  friends: ConnectionFriend[]
  viewerDisplayName: string
  onReload: () => Promise<void>
}) {
  const filtered = items.filter((i) => i.kind === kind)
  const [label, setLabel] = useState(labelSuggestions[0] ?? '')
  const [partnerUsername, setPartnerUsername] = useState('')
  const [customText, setCustomText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [visibility, setVisibility] = useState<'hidden' | 'friends' | 'public'>('friends')

  const friendOptions = useMemo(
    () => friends.map((f) => f.username).sort((a, b) => a.localeCompare(b)),
    [friends]
  )

  async function add() {
    setError(null)
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      setError('Choose or type a relationship label.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/profile/me/relationships', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          label: trimmedLabel,
          partnerUsername: partnerUsername.trim() || null,
          customText: customText.trim() || null,
          visibility,
        }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(data.error ?? 'Could not add.')
        return
      }
      setPartnerUsername('')
      setCustomText('')
      await onReload()
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/profile/me/relationships/${id}`, { method: 'DELETE', credentials: 'include' })
    await onReload()
  }

  return (
    <ProfileStudioInsetCard className="space-y-4">
      <h3 className="text-sm font-semibold text-dc-text">{title}</h3>
      <ul className="space-y-2">
        {filtered.length === 0 ?
          <li className="text-sm text-dc-muted italic">None listed yet.</li>
        : filtered.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-2 text-sm ${profileStudioNestedRowClass}`}
            >
              <span className="text-dc-text-muted">
                {formatRelationshipLine(item)}
                {item.status === 'pending' ?
                  <span className="ml-2 text-xs text-amber-400/90">(pending partner approval)</span>
                : null}
              </span>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                className="text-xs text-dc-accent hover:underline"
              >
                remove
              </button>
            </li>
          ))
        }
      </ul>
      <div className="space-y-3 border-t border-dc-border pt-4">
        <LabelCombobox
          label="Relationship type"
          hint="Pick a suggestion or type your own label."
          value={label}
          onChange={setLabel}
          suggestions={labelSuggestions}
        />
        <div>
          <label htmlFor={`${kind}-partner`} className="block text-sm font-medium text-dc-text mb-1">
            Link a connection (optional)
          </label>
          <p className="text-xs text-dc-muted mb-2">
            Tagged people must approve before the link appears publicly. Only accepted connections can be linked.
          </p>
          {friendOptions.length > 0 ?
            <select
              id={`${kind}-partner`}
              value={partnerUsername}
              onChange={(e) => setPartnerUsername(e.target.value)}
              className="w-full min-h-11 px-3 py-2 rounded-lg border border-dc-border bg-dc-surface-muted text-sm text-dc-text"
            >
              <option value="">No linked profile</option>
              {friendOptions.map((u) => (
                <option key={u} value={u}>@{u}</option>
              ))}
            </select>
          : (
            <input
              id={`${kind}-partner`}
              type="text"
              placeholder="Friend username (connect first)"
              value={partnerUsername}
              onChange={(e) => setPartnerUsername(e.target.value)}
              className="w-full min-h-11 px-3 py-2 rounded-lg border border-dc-border bg-dc-surface-muted text-sm text-dc-text"
            />
          )}
        </div>
        <div>
          <label htmlFor={`${kind}-visibility`} className="block text-sm font-medium text-dc-text mb-1">
            Visibility
          </label>
          <select
            id={`${kind}-visibility`}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            className="w-full min-h-11 px-3 py-2 rounded-lg border border-dc-border bg-dc-surface-muted text-sm text-dc-text"
          >
            <option value="hidden">Only me (hidden until approved)</option>
            <option value="friends">Connections</option>
            <option value="public">Public</option>
          </select>
          <p className="text-xs text-dc-muted mt-1">
            {kind === 'ds' ?
              'D/s links are sensitive · Connections is the recommended default.'
            : 'Hidden until your partner approves, then follows this visibility.'}
          </p>
        </div>
        {partnerUsername.trim() ?
          <p className="text-xs rounded-lg border border-dc-border bg-dc-surface-muted/40 px-3 py-2 text-dc-text-muted">
            <span className="font-medium text-dc-text">Public preview: </span>
            {viewerDisplayName} is in a {label.toLowerCase()} with @{partnerUsername.trim()}
            {visibility === 'hidden' ?
              ' (hidden until approved)'
            : visibility === 'friends' ?
              ' (visible to connections)'
            : ' (public)'}
          </p>
        : null}
        <div>
          <label htmlFor={`${kind}-note`} className="block text-sm font-medium text-dc-text mb-1">
            Note (optional)
          </label>
          <input
            id={`${kind}-note`}
            type="text"
            placeholder="e.g. long distance, scene only"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full min-h-11 px-3 py-2 rounded-lg border border-dc-border bg-dc-surface-muted text-sm text-dc-text"
          />
        </div>
        {error ?
          <p className="text-xs text-red-400" role="alert">{error}</p>
        : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void add()}
          className="min-h-11 px-4 rounded-lg border border-dc-border text-sm text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
        >
          {busy ? 'Adding…' : `Add ${kind === 'ds' ? 'D/s link' : 'relationship'}`}
        </button>
      </div>
    </ProfileStudioInsetCard>
  )
}

function IncomingRequestsPanel({
  requests,
  onRespond,
}: {
  requests: IncomingRequest[]
  onRespond: () => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  if (requests.length === 0) return null

  async function respond(id: string, action: 'accept' | 'decline') {
    setBusyId(id)
    try {
      await fetch(`/api/profile/me/relationships/${id}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await onRespond()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ProfileStudioInsetCard variant="warning" className="space-y-3">
      <h3 className="text-sm font-semibold text-dc-text">Pending requests for you</h3>
      <p className="text-xs text-dc-muted">
        Someone wants to list you on their profile. Accept only if you agree.
      </p>
      <ul className="space-y-2">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-dc-border px-3 py-2 text-sm"
          >
            <span className="flex-1 text-dc-text-muted">
              @{req.requesterUsername ?? 'someone'} listed you as{' '}
              <span className="text-dc-text">{req.label}</span>
              {req.customText ? ` · ${req.customText}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={() => void respond(req.id, 'accept')}
                className="min-h-10 px-3 rounded-lg bg-dc-accent text-dc-text text-xs disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={() => void respond(req.id, 'decline')}
                className="min-h-10 px-3 rounded-lg border border-dc-border text-xs text-dc-text-muted hover:text-dc-text disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </ProfileStudioInsetCard>
  )
}

export default function RelationshipsPanel() {
  const ctx = useProfileEdit()
  const viewerDisplayName =
    ctx.displayName.trim() ||
    (ctx.profileMe.data?.profile.displayName as string | null) ||
    ctx.viewerUsername ||
    'You'
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [friends, setFriends] = useState<ConnectionFriend[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [incRes, connRes] = await Promise.all([
          fetch('/api/profile/me/relationships/incoming', { credentials: 'include' }),
          fetch('/api/v1/connections', { credentials: 'include' }),
        ])
        if (!cancelled && incRes.ok) {
          const d = (await incRes.json()) as { requests?: IncomingRequest[] }
          setIncoming(d.requests ?? [])
        }
        if (!cancelled && connRes.ok) {
          const d = (await connRes.json()) as {
            items?: {
              status: string
              requesterUsername: string | null
              recipientUsername: string | null
              isOutgoing?: boolean
            }[]
          }
          const accepted = (d.items ?? [])
            .filter((c) => c.status === 'ACCEPTED')
            .map((c) => ({
              username: (c.isOutgoing ? c.recipientUsername : c.requesterUsername) ?? '',
            }))
            .filter((f) => f.username)
          setFriends(accepted)
        }
      } catch {
        /* optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ctx.relationships])

  async function reloadAll() {
    await ctx.reloadRelationships()
    const incRes = await fetch('/api/profile/me/relationships/incoming', { credentials: 'include' })
    if (incRes.ok) {
      const d = (await incRes.json()) as { requests?: IncomingRequest[] }
      setIncoming(d.requests ?? [])
    }
  }

  return (
    <div className="space-y-6">
      <ProfileStudioInsetCard variant="accent" className="text-xs leading-relaxed text-dc-muted">
        Link a connection to show who you are in relationship or D/s with. Tagged people must approve before a
        relationship link appears publicly.{' '}
        <Link to="/connections" className="text-dc-accent hover:underline">
          Manage connections
        </Link>
      </ProfileStudioInsetCard>
      <IncomingRequestsPanel requests={incoming} onRespond={reloadAll} />
      <RelationshipBlock
        title="Relationships"
        kind="relationship"
        labelSuggestions={PROFILE_RELATIONSHIP_LABELS}
        items={ctx.relationships}
        friends={friends}
        viewerDisplayName={viewerDisplayName}
        onReload={reloadAll}
      />
      <RelationshipBlock
        title="D/s relationships"
        kind="ds"
        labelSuggestions={PROFILE_DS_RELATIONSHIP_LABELS}
        items={ctx.relationships}
        friends={friends}
        viewerDisplayName={viewerDisplayName}
        onReload={reloadAll}
      />
    </div>
  )
}
