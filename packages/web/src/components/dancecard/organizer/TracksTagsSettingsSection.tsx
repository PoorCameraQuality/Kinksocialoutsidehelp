'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'

type Track = { id: string; name: string; color: string; sortOrder: number }
type Tag = { id: string; name: string; scope: string }

export function TracksTagsSettingsSection({
  eventSlug,
  canEdit,
}: {
  eventSlug: string
  canEdit: boolean
}) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [newTrack, setNewTrack] = useState('')
  const [newTag, setNewTag] = useState('')
  const { ask, dialog } = useConfirmDialog()

  const load = useCallback(async () => {
    setMsg(null)
    try {
      const [tr, tg] = await Promise.all([
        organizerDancecardFetch<{ tracks: Track[] }>(eventSlug, '/tracks'),
        organizerDancecardFetch<{ tags: Tag[] }>(eventSlug, '/tags'),
      ])
      setTracks(tr.tracks ?? [])
      setTags((tg.tags ?? []).filter((t) => t.scope === 'session'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not load tracks/tags')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function addTrack() {
    if (!canEdit || !newTrack.trim()) return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, '/tracks', {
        method: 'POST',
        body: JSON.stringify({ name: newTrack.trim() }),
      })
      setNewTrack('')
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function delTrack(id: string) {
    if (!canEdit) return
    if (
      !(await ask({
        title: 'Delete track?',
        message: 'Delete this track? Slots keep legacy track text; track_id may clear.',
        destructive: true,
      }))
    )
      return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, `/tracks/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function addTag() {
    if (!canEdit || !newTag.trim()) return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, '/tags', {
        method: 'POST',
        body: JSON.stringify({ name: newTag.trim(), scope: 'session' }),
      })
      setNewTag('')
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function delTag(id: string) {
    if (!canEdit) return
    if (
      !(await ask({
        title: 'Delete tag?',
        message: 'Delete this tag? It will be removed from all sessions.',
        destructive: true,
      }))
    )
      return
    setMsg(null)
    try {
      await organizerDancecardFetch(eventSlug, `/tags/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-4">
      {dialog}
      <h3 className="font-serif text-lg text-dc-text">Tracks and session tags</h3>
      <p className="mt-1 text-xs text-dc-muted">
        Tracks power color grouping; session tags can be bulk-applied on the program grid.
      </p>
      {msg ? <p className="mt-2 text-sm text-amber-800">{msg}</p> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-dc-muted">Tracks</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-dc-text">
            {tracks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-dc-border/50 bg-dc-elevated-muted px-2 py-1">
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </span>
                {canEdit ? (
                  <button type="button" className="shrink-0 text-xs text-red-700 hover:text-red-700" onClick={() => void delTrack(t.id)}>
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"
                placeholder="New track name"
                value={newTrack}
                onChange={(e) => setNewTrack(e.target.value)}
              />
              <button type="button" className="rounded-full bg-dc-accent px-3 py-1 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover" onClick={() => void addTrack()}>
                Add
              </button>
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-dc-muted">Session tags</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-dc-text">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-dc-border/50 bg-dc-elevated-muted px-2 py-1">
                <span className="truncate">{t.name}</span>
                {canEdit ? (
                  <button type="button" className="shrink-0 text-xs text-red-700 hover:text-red-700" onClick={() => void delTag(t.id)}>
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"
                placeholder="New tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
              />
              <button type="button" className="rounded-full bg-dc-accent px-3 py-1 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover" onClick={() => void addTag()}>
                Add
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <button type="button" className="mt-3 text-xs text-dc-accent underline" onClick={() => void load()}>
        Reload tracks/tags
      </button>
    </div>
  )
}
