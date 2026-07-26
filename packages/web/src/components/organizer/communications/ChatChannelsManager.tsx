import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChannelCategory, OrgChannel } from '@/components/organizer/admin/OrgChatModerationPanel'
import { CommsSection } from '@/components/organizer/communications/comms-ui'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/hooks/useConfirm'
import {
  channelCategoryName,
  channelVisibilityLabel,
  countChannelsInCategory,
  formatSlowMode,
} from '@/lib/organizer/org-comms-utils'

type Props = {
  orgSlug: string
  channelCategories: ChannelCategory[] | null
  channels: OrgChannel[] | null
  canManage: boolean
  publicChatHref: string
  onReload: () => Promise<void>
}

export default function ChatChannelsManager({
  orgSlug,
  channelCategories,
  channels,
  canManage,
  publicChatHref,
  onReload,
}: Props) {
  const { confirm, confirmDialog } = useConfirm()
  const orgKey = encodeURIComponent(orgSlug)
  const [newCatName, setNewCatName] = useState('')
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'TEXT' | 'ANNOUNCEMENTS' | 'VOICE' | 'DISCORD'>('TEXT')
  const [newEmbedUrl, setNewEmbedUrl] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [slowEditId, setSlowEditId] = useState<string | null>(null)
  const [slowDraft, setSlowDraft] = useState('')
  const [embedEditId, setEmbedEditId] = useState<string | null>(null)
  const [embedDraft, setEmbedDraft] = useState('')
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const sortedCategories = useMemo(() => {
    if (!channelCategories) return []
    return [...channelCategories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }, [channelCategories])

  const sortedChannels = useMemo(() => {
    if (!channels) return []
    return [...channels].sort((a, b) => a.name.localeCompare(b.name))
  }, [channels])

  const addCategory = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setActionMsg(null)
      if (!newCatName.trim()) return
      try {
        const r = await fetch(`/api/v1/organizations/${orgKey}/channel-categories`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCatName.trim() }),
        })
        if (!r.ok) {
          setActionMsg('Could not add channel category')
          return
        }
        setNewCatName('')
        await onReload()
      } catch {
        setActionMsg('Network error')
      }
    },
    [newCatName, orgKey, onReload],
  )

  async function saveCategoryEdit() {
    if (!editCatId || !editCatName.trim()) return
    setActionMsg(null)
    try {
      const r = await fetch(
        `/api/v1/organizations/${orgKey}/channel-categories/${encodeURIComponent(editCatId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editCatName.trim() }),
        },
      )
      if (!r.ok) {
        setActionMsg('Could not update channel category')
        return
      }
      setEditCatId(null)
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function deleteCategory(catId: string) {
    if (!(await confirm('Delete this channel category?', 'Channels will be moved to uncategorized.', { destructive: true })))
      return
    setActionMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channel-categories/${encodeURIComponent(catId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        setActionMsg('Could not delete channel category')
        return
      }
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault()
    setActionMsg(null)
    if (!newSlug.trim() || !newName.trim()) {
      setActionMsg('Slug and display name are required.')
      return
    }
    if (newKind === 'DISCORD' && !newEmbedUrl.trim()) {
      setActionMsg('Discord channels need a server ID or invite link.')
      return
    }
    try {
      const body: Record<string, unknown> = {
        slug: newSlug.trim(),
        name: newName.trim(),
        kind: newKind,
      }
      if (newCategoryId) body.categoryId = newCategoryId
      if (newKind === 'DISCORD') body.embedUrl = newEmbedUrl.trim()
      const r = await fetch(`/api/v1/organizations/${orgKey}/channels`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        setActionMsg('Could not create channel')
        return
      }
      setNewSlug('')
      setNewName('')
      setNewKind('TEXT')
      setNewEmbedUrl('')
      setNewCategoryId('')
      setShowNewChannel(false)
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function applySlowMode(channelId: string) {
    const n = parseInt(slowDraft, 10)
    const sec = Number.isFinite(n) && n >= 0 ? Math.min(3600, n) : 0
    setActionMsg(null)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channels/${encodeURIComponent(channelId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slowModeSeconds: sec === 0 ? null : sec }),
      })
      if (!r.ok) {
        setActionMsg('Could not update slow mode')
        return
      }
      setSlowEditId(null)
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function applyEmbedUrl(channelId: string) {
    setActionMsg(null)
    if (!embedDraft.trim()) {
      setActionMsg('Discord server ID or invite URL is required.')
      return
    }
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channels/${encodeURIComponent(channelId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedUrl: embedDraft.trim() }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setActionMsg(j.error ?? 'Could not update Discord link')
        return
      }
      setEmbedEditId(null)
      await onReload()
    } catch {
      setActionMsg('Network error')
    }
  }

  const canEditSlowMode = (ch: OrgChannel) => ch.kind === 'TEXT' || ch.kind === 'ANNOUNCEMENTS'

  return (
    <CommsSection id="chat-channels">
      <h3 className="text-lg font-semibold text-dc-text">Chat channels</h3>
      <p className="mt-1 text-sm text-dc-text-muted">
        Create channel categories and channels for real-time member communication. Including optional Discord embeds.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-dc-text">Channel categories</h4>
          <p className="mt-1 text-xs text-dc-muted">Group channels in the member chat sidebar.</p>

          {canManage ?
            <form onSubmit={(e) => void addCategory(e)} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name"
                className="min-w-0 flex-1 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 py-2.5 text-sm text-dc-text"
              />
              <button
                type="submit"
                disabled={!newCatName.trim()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text hover:border-dc-accent-border/40 disabled:opacity-50"
              >
                Add category
              </button>
            </form>
          : null}

          <div className="mt-3">
            {channelCategories === null ?
              <div className="h-16 animate-pulse rounded-xl bg-dc-elevated-muted" />
            : sortedCategories.length === 0 ?
              <p className="text-sm text-dc-text-muted">No channel categories yet.</p>
            : (
              <ul className="space-y-2">
                {sortedCategories.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-dc-border/80 bg-dc-surface/30 px-3 py-2 text-sm"
                  >
                    {editCatId === c.id && canManage ?
                      <>
                        <input
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-dc-text"
                        />
                        <button type="button" onClick={() => void saveCategoryEdit()} className="text-xs text-dc-accent">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditCatId(null)} className="text-xs text-dc-muted">
                          Cancel
                        </button>
                      </>
                    : (
                      <>
                        <span className="min-w-0 flex-1 font-medium text-dc-text">{c.name}</span>
                        <span className="text-xs text-dc-muted">
                          {countChannelsInCategory(c.id, sortedChannels)} channel
                          {countChannelsInCategory(c.id, sortedChannels) === 1 ? '' : 's'}
                        </span>
                        {canManage ?
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditCatId(c.id)
                                setEditCatName(c.name)
                              }}
                              className="text-xs text-dc-accent"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCategory(c.id)}
                              className="text-xs text-red-300/90"
                            >
                              Remove
                            </button>
                          </>
                        : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-dc-text">Channels</h4>
            {canManage ?
              <button
                type="button"
                onClick={() => setShowNewChannel((v) => !v)}
                className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                {showNewChannel ? 'Cancel' : '+ New channel'}
              </button>
            : null}
          </div>

          {canManage && showNewChannel ?
            <form onSubmit={(e) => void createChannel(e)} className="mt-3 space-y-2 rounded-xl border border-dc-border bg-dc-surface/30 p-4">
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="URL slug (e.g. general)"
                className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              />
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as 'TEXT' | 'ANNOUNCEMENTS' | 'VOICE' | 'DISCORD')}
                className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              >
                <option value="TEXT">Text</option>
                <option value="ANNOUNCEMENTS">Announcements</option>
                <option value="VOICE">Voice</option>
                <option value="DISCORD">Discord (embed)</option>
              </select>
              {newKind === 'DISCORD' ?
                <>
                  <input
                    value={newEmbedUrl}
                    onChange={(e) => setNewEmbedUrl(e.target.value)}
                    placeholder="Server ID or https://discord.gg/… invite"
                    className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
                  />
                  <p className="text-xs leading-relaxed text-dc-muted">
                    For an embedded widget, paste your server ID from Discord → Server Settings → Widget. Invite links
                    show a join button; enable the widget for a live embed.
                  </p>
                </>
              : null}
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
              >
                <option value="">No category</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
              >
                Create channel
              </button>
            </form>
          : null}
        </div>
      </div>

      {actionMsg ?
        <p className="mt-3 text-sm text-amber-200/90" role="status">
          {actionMsg}
        </p>
      : null}

      <div className="mt-6">
        {channels === null ?
          <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
        : sortedChannels.length === 0 ?
          <EmptyState
            inline
            title="No chat channels yet"
            message="Create channels for announcements, general chat, Discord lounges, event planning, or staff coordination."
            actionLabel={canManage ? 'Create a channel' : undefined}
            onAction={canManage ? () => setShowNewChannel(true) : undefined}
            secondaryCtaLabel="Open member chat"
            secondaryCtaHref={publicChatHref}
          />
        : (
          <ul className="space-y-2">
            {sortedChannels.map((ch) => (
              <li
                key={ch.id}
                className="rounded-xl border border-dc-border bg-dc-surface/25 px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-dc-text">
                      #{ch.name}
                      {ch.kind !== 'TEXT' ?
                        <span className="ml-2 text-[10px] font-semibold uppercase text-dc-muted">{ch.kind}</span>
                      : null}
                    </p>
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dc-text-muted">
                      <div>
                        <dt className="inline text-dc-muted">Category </dt>
                        <dd className="inline">{channelCategoryName(ch, sortedCategories)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-dc-muted">Slow mode </dt>
                        <dd className="inline">{formatSlowMode(ch.slowModeSeconds)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-dc-muted">Visibility </dt>
                        <dd className="inline">{channelVisibilityLabel(ch)}</dd>
                      </div>
                      {ch.kind === 'DISCORD' && ch.embedUrl ?
                        <div className="w-full basis-full">
                          <dt className="inline text-dc-muted">Discord </dt>
                          <dd className="inline break-all">{ch.embedUrl}</dd>
                        </div>
                      : null}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManage && ch.kind === 'DISCORD' ?
                      embedEditId === ch.id ?
                        <div className="flex min-w-[220px] flex-1 flex-col gap-2 sm:min-w-[280px]">
                          <input
                            value={embedDraft}
                            onChange={(e) => setEmbedDraft(e.target.value)}
                            placeholder="Server ID or invite URL"
                            className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void applyEmbedUrl(ch.id)}
                              className="text-xs font-medium text-dc-accent"
                            >
                              Save
                            </button>
                            <button type="button" onClick={() => setEmbedEditId(null)} className="text-xs text-dc-muted">
                              Cancel
                            </button>
                          </div>
                        </div>
                      : (
                        <button
                          type="button"
                          onClick={() => {
                            setEmbedEditId(ch.id)
                            setEmbedDraft(ch.embedUrl ?? '')
                          }}
                          className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
                        >
                          Discord link
                        </button>
                      )
                    : null}
                    {canManage && canEditSlowMode(ch) ?
                      slowEditId === ch.id ?
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            value={slowDraft}
                            onChange={(e) => setSlowDraft(e.target.value)}
                            className="w-20 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
                            aria-label="Slow mode seconds"
                          />
                          <button
                            type="button"
                            onClick={() => void applySlowMode(ch.id)}
                            className="text-xs font-medium text-dc-accent"
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setSlowEditId(null)} className="text-xs text-dc-muted">
                            Cancel
                          </button>
                        </div>
                      : (
                        <button
                          type="button"
                          onClick={() => {
                            setSlowEditId(ch.id)
                            setSlowDraft(
                              ch.slowModeSeconds != null && ch.slowModeSeconds > 0 ? String(ch.slowModeSeconds) : '',
                            )
                          }}
                          className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text-muted hover:text-dc-text"
                        >
                          Slow mode
                        </button>
                      )
                    : null}
                    <Link
                      to={publicChatHref}
                      className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-accent"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {sortedChannels.length > 0 ?
        <Link to={publicChatHref} className="mt-4 inline-block text-sm font-medium text-dc-accent hover:underline">
          View all channels on hub →
        </Link>
      : null}
      {confirmDialog}
    </CommsSection>
  )
}
