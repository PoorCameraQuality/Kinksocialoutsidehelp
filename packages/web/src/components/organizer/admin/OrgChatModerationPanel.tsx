import { useCallback, useEffect, useState } from 'react'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { useConfirm } from '@/hooks/useConfirm'

export type ChannelCategory = {
  id: string
  name: string
  sortOrder: number
}

export type OrgChannel = {
  id: string
  slug: string
  name: string
  kind: string
  categoryId?: string | null
  slowModeSeconds?: number | null
  embedUrl?: string | null
}

export type OrgChatModerationPanelProps = {
  orgSlug: string
  /** Initial selected channel id (optional). */
  selectedChannelId?: string | null
  onChannelsChange?: (payload: { categories: ChannelCategory[]; channels: OrgChannel[] }) => void
  onSelectedChannelChange?: (channelId: string | null) => void
}

export default function OrgChatModerationPanel({
  orgSlug,
  selectedChannelId: controlledChannelId,
  onChannelsChange,
  onSelectedChannelChange,
}: OrgChatModerationPanelProps) {
  const { confirm, confirmDialog } = useConfirm()
  const orgKey = encodeURIComponent(orgSlug)
  const [channelCategories, setChannelCategories] = useState<ChannelCategory[] | null>(null)
  const [channels, setChannels] = useState<OrgChannel[] | null>(null)
  const [internalChannelId, setInternalChannelId] = useState<string | null>(controlledChannelId ?? null)
  const [newChCatName, setNewChCatName] = useState('')
  const [editChCatId, setEditChCatId] = useState<string | null>(null)
  const [editChCatName, setEditChCatName] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChSlug, setNewChSlug] = useState('')
  const [newChName, setNewChName] = useState('')
  const [newChKind, setNewChKind] = useState<'TEXT' | 'ANNOUNCEMENTS' | 'VOICE'>('TEXT')
  const [newChCategoryId, setNewChCategoryId] = useState('')
  const [slowModeDraft, setSlowModeDraft] = useState('')
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const channelId = controlledChannelId !== undefined ? controlledChannelId : internalChannelId

  const setChannelId = useCallback(
    (id: string | null) => {
      if (controlledChannelId === undefined) setInternalChannelId(id)
      onSelectedChannelChange?.(id)
    },
    [controlledChannelId, onSelectedChannelChange]
  )

  const applyChannelData = useCallback(
    (categories: ChannelCategory[], items: OrgChannel[]) => {
      setChannelCategories(categories)
      setChannels(items)
      onChannelsChange?.({ categories, channels: items })
    },
    [onChannelsChange]
  )

  const reloadChannels = useCallback(async () => {
    const lr = await fetch(`/api/v1/organizations/${orgKey}/channels`, { credentials: 'include' })
    if (lr.ok) {
      const d = (await lr.json()) as {
        categories?: ChannelCategory[]
        items: OrgChannel[]
      }
      applyChannelData(d.categories ?? [], d.items ?? [])
    }
  }, [orgKey, applyChannelData])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const lr = await fetch(`/api/v1/organizations/${orgKey}/channels`, { credentials: 'include' })
        if (cancelled) return
        if (lr.ok) {
          const d = (await lr.json()) as {
            categories?: ChannelCategory[]
            items: OrgChannel[]
          }
          applyChannelData(d.categories ?? [], d.items ?? [])
        } else {
          setChannelCategories([])
          setChannels([])
        }
      } catch {
        if (!cancelled) {
          setChannelCategories([])
          setChannels([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgKey, applyChannelData])

  const selectedChannel = channels?.find((c) => c.id === channelId) ?? null
  const isTextChatChannel =
    selectedChannel != null && (selectedChannel.kind === 'TEXT' || selectedChannel.kind === 'ANNOUNCEMENTS')

  useEffect(() => {
    const ch = channels?.find((c) => c.id === channelId)
    setSlowModeDraft(ch?.slowModeSeconds != null && ch.slowModeSeconds > 0 ? String(ch.slowModeSeconds) : '')
  }, [channelId, channels])

  async function addChannelCategory(e: React.FormEvent) {
    e.preventDefault()
    setActionMsg(null)
    if (!newChCatName.trim()) return
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channel-categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChCatName.trim() }),
      })
      if (!r.ok) {
        setActionMsg('Could not add channel category')
        return
      }
      setNewChCatName('')
      await reloadChannels()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function submitNewChannel(e: React.FormEvent) {
    e.preventDefault()
    setActionMsg(null)
    if (!newChSlug.trim() || !newChName.trim()) {
      setActionMsg('Slug and name are required.')
      return
    }
    try {
      const body: Record<string, unknown> = {
        slug: newChSlug.trim(),
        name: newChName.trim(),
        kind: newChKind,
      }
      if (newChCategoryId) body.categoryId = newChCategoryId
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
      setNewChSlug('')
      setNewChName('')
      setNewChKind('TEXT')
      setNewChCategoryId('')
      setShowNewChannel(false)
      await reloadChannels()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function saveChannelCategoryEdit() {
    if (!editChCatId || !editChCatName.trim()) return
    setActionMsg(null)
    try {
      const r = await fetch(
        `/api/v1/organizations/${orgKey}/channel-categories/${encodeURIComponent(editChCatId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editChCatName.trim() }),
        }
      )
      if (!r.ok) {
        setActionMsg('Could not update channel category')
        return
      }
      setEditChCatId(null)
      await reloadChannels()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function deleteChannelCategory(catId: string) {
    if (!(await confirm('Delete this channel category?', 'Channels will be moved to uncategorized.', { destructive: true }))) return
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
      await reloadChannels()
    } catch {
      setActionMsg('Network error')
    }
  }

  async function applyChannelSlowMode() {
    if (!channelId) return
    const n = parseInt(slowModeDraft, 10)
    const sec = Number.isFinite(n) && n >= 0 ? Math.min(3600, n) : 0
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
      setActionMsg(null)
      await reloadChannels()
    } catch {
      setActionMsg('Network error')
    }
  }

  const sortedCategories = [...(channelCategories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <OrganizerPanel
      title="Chat moderation"
      description="Manage channel categories, create channels, and configure slow mode."
    >
      <OrganizerFormSection title="Channel categories">
        <form onSubmit={addChannelCategory} className="flex gap-2">
          <input
            aria-label="Channel category name"
            value={newChCatName}
            onChange={(e) => setNewChCatName(e.target.value)}
            placeholder="Category name"
            className="flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text"
          >
            Add
          </button>
        </form>
        {channelCategories === null ? (
          <div className="h-12 animate-pulse rounded-xl bg-dc-elevated-muted" />
        ) : sortedCategories.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {sortedCategories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-1">
                {editChCatId === c.id ? (
                  <>
                    <input
                      aria-label="Edit channel category name"
                      value={editChCatName}
                      onChange={(e) => setEditChCatName(e.target.value)}
                      className="min-w-[100px] flex-1 rounded border border-dc-border bg-dc-elevated-solid px-2 py-1 text-dc-text"
                    />
                    <button type="button" onClick={() => void saveChannelCategoryEdit()} className="shrink-0 text-dc-accent">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditChCatId(null)} className="shrink-0 text-dc-muted">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 text-dc-text-muted">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditChCatId(c.id)
                        setEditChCatName(c.name)
                      }}
                      className="shrink-0 text-dc-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteChannelCategory(c.id)}
                      className="shrink-0 text-red-400/90"
                    >
                      Del
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dc-muted">No channel categories yet.</p>
        )}
      </OrganizerFormSection>

      <OrganizerFormSection title="Channels">
        <button
          type="button"
          onClick={() => setShowNewChannel((v) => !v)}
          className="text-xs text-dc-accent hover:underline"
        >
          {showNewChannel ? 'Hide new channel form' : '+ New channel'}
        </button>
        {showNewChannel && (
          <form onSubmit={submitNewChannel} className="space-y-2 rounded-lg border border-dc-border p-3">
            <input
              aria-label="Channel URL slug"
              value={newChSlug}
              onChange={(e) => setNewChSlug(e.target.value)}
              placeholder="URL slug"
              className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            />
            <input
              aria-label="Channel display name"
              value={newChName}
              onChange={(e) => setNewChName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            />
            <select
              aria-label="Channel type"
              value={newChKind}
              onChange={(e) => setNewChKind(e.target.value as 'TEXT' | 'ANNOUNCEMENTS' | 'VOICE')}
              className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            >
              <option value="TEXT">Text</option>
              <option value="ANNOUNCEMENTS">Announcements</option>
              <option value="VOICE">Voice</option>
            </select>
            <select
              aria-label="Channel category"
              value={newChCategoryId}
              onChange={(e) => setNewChCategoryId(e.target.value)}
              className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1.5 text-sm text-dc-text"
            >
              <option value="">No category</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="min-h-9 w-full rounded-lg bg-dc-accent text-sm text-dc-text">
              Create channel
            </button>
          </form>
        )}
        {channels === null ? (
          <div className="h-12 animate-pulse rounded-xl bg-dc-elevated-muted" />
        ) : channels.length === 0 ? (
          <p className="text-sm text-dc-muted">No channels yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {channels.map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => setChannelId(ch.id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left ${
                    channelId === ch.id ? 'bg-dc-accent/20 text-dc-text' : 'text-dc-text-muted hover:bg-dc-elevated-muted'
                  }`}
                >
                  #{ch.name}
                  {ch.kind !== 'TEXT' ? (
                    <span className="ml-2 text-[10px] uppercase text-dc-muted">{ch.kind}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </OrganizerFormSection>

      {isTextChatChannel && selectedChannel && (
        <OrganizerFormSection
          title="Slow mode"
          description="Minimum seconds between messages per member. Moderators bypass. 0 = off."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={3600}
              value={slowModeDraft}
              onChange={(e) => setSlowModeDraft(e.target.value)}
              className="w-24 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-sm text-dc-text"
            />
            <button
              type="button"
              onClick={() => void applyChannelSlowMode()}
              className="rounded-lg bg-dc-elevated-muted px-3 py-1 text-xs text-dc-text hover:bg-white/15"
            >
              Apply to #{selectedChannel.name}
            </button>
          </div>
        </OrganizerFormSection>
      )}

      {actionMsg && <p className="text-sm text-dc-muted">{actionMsg}</p>}
      {confirmDialog}
    </OrganizerPanel>
  )
}
