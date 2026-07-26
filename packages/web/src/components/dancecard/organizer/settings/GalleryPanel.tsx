'use client'

import { useCallback, useEffect, useState } from 'react'
import { SETTINGS_FIELD_CLASS, SETTINGS_LABEL_CLASS } from './eventSettingsConfig'

type GalleryImage = {
  id: string
  imageUrl: string
  caption: string | null
  sortOrder: number
}

type Props = {
  eventSlug: string
  canEdit: boolean
}

export function GalleryPanel({ eventSlug, canEdit }: Props) {
  const [items, setItems] = useState<GalleryImage[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery`, {
      credentials: 'include',
    })
    if (!r.ok) {
      setItems([])
      return
    }
    const d = (await r.json()) as { items: GalleryImage[] }
    setItems(d.items ?? [])
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  const upload = async (file: File) => {
    if (!canEdit) return
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      if (!up.ok) {
        setMsg('Upload failed')
        return
      }
      const { url } = (await up.json()) as { url: string }
      const cr = await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url, sortOrder: items.length }),
      })
      if (!cr.ok) {
        setMsg('Could not save gallery row')
        return
      }
      await load()
      setMsg('Photo added')
    } finally {
      setBusy(false)
    }
  }

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id)
    const swap = idx + dir
    if (idx < 0 || swap < 0 || swap >= items.length) return
    const a = items[idx]!
    const b = items[swap]!
    setBusy(true)
    await Promise.all([
      fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery/${a.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery/${b.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ])
    setBusy(false)
    await load()
  }

  return (
    <div className="space-y-4 text-sm text-dc-text">
      <p className="text-dc-muted">
        Curate photos attendees see under the convention&apos;s <strong>More</strong> tab. Drag order via move buttons.
      </p>
      {msg ? <p className="text-dc-accent">{msg}</p> : null}
      {canEdit ?
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dc-border px-3 py-2 hover:border-dc-accent-border">
          <span className="font-medium">{busy ? 'Working…' : 'Upload photo'}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
        </label>
      : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((img, idx) => (
          <div key={img.id} className="rounded-xl border border-dc-border bg-dc-surface-muted p-2 space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <label className={SETTINGS_LABEL_CLASS}>
              Caption
              <input
                className={SETTINGS_FIELD_CLASS}
                defaultValue={img.caption ?? ''}
                disabled={!canEdit || busy}
                onBlur={async (e) => {
                  if (!canEdit) return
                  await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery/${img.id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caption: e.target.value.trim() || null }),
                  })
                }}
              />
            </label>
            {canEdit ?
              <div className="flex flex-wrap gap-1">
                <button type="button" disabled={idx === 0 || busy} className="rounded border border-dc-border px-2 py-1 text-xs" onClick={() => void move(img.id, -1)}>
                  ↑
                </button>
                <button type="button" disabled={idx >= items.length - 1 || busy} className="rounded border border-dc-border px-2 py-1 text-xs" onClick={() => void move(img.id, 1)}>
                  ↓
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300"
                  onClick={async () => {
                    if (!confirm('Remove this photo?')) return
                    await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/gallery/${img.id}`, {
                      method: 'DELETE',
                      credentials: 'include',
                    })
                    await load()
                  }}
                >
                  Remove
                </button>
              </div>
            : null}
          </div>
        ))}
      </div>
      {items.length === 0 ? <p className="text-dc-muted">No gallery images yet.</p> : null}
    </div>
  )
}
