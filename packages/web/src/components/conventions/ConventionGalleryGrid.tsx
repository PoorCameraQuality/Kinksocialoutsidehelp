'use client'

import { useCallback, useEffect, useState } from 'react'

type GalleryImage = {
  id: string
  imageUrl: string
  caption: string | null
  sortOrder: number
  moderationStatus?: string
}

type Props = {
  conventionKey: string
  canSubmit?: boolean
  canModerate?: boolean
}

export default function ConventionGalleryGrid({ conventionKey, canSubmit, canModerate }: Props) {
  const [items, setItems] = useState<GalleryImage[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null)
  const [submitUrl, setSubmitUrl] = useState('')
  const [submitCaption, setSubmitCaption] = useState('')
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/conventions/${encodeURIComponent(conventionKey)}/gallery`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setItems([])
        setPendingCount(0)
        return
      }
      const d = (await r.json()) as { items: GalleryImage[]; pendingCount?: number }
      setItems(d.items ?? [])
      setPendingCount(d.pendingCount ?? 0)
    } finally {
      setLoading(false)
    }
  }, [conventionKey])

  useEffect(() => {
    void load()
  }, [load])

  const moderate = async (imageId: string, status: 'approved' | 'rejected') => {
    const r = await fetch(
      `/api/v1/conventions/${encodeURIComponent(conventionKey)}/gallery/${encodeURIComponent(imageId)}/moderation`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    )
    if (r.ok) void load()
  }

  const uploadPhoto = async (file: File) => {
    setUploading(true)
    setSubmitMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (submitCaption.trim()) fd.append('caption', submitCaption.trim())
      const r = await fetch(
        `/api/v1/conventions/${encodeURIComponent(conventionKey)}/gallery/attendee-upload`,
        { method: 'POST', credentials: 'include', body: fd },
      )
      const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!r.ok) {
        setSubmitMsg(body.error ?? 'Upload failed')
        return
      }
      setSubmitCaption('')
      setSubmitMsg(body.message ?? 'Uploaded. Pending moderation')
      void load()
    } finally {
      setUploading(false)
    }
  }

  const submitPhoto = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = submitUrl.trim()
    if (!url) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const r = await fetch(
        `/api/v1/conventions/${encodeURIComponent(conventionKey)}/gallery/submit`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: url, caption: submitCaption.trim() || undefined }),
        },
      )
      const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!r.ok) {
        setSubmitMsg(body.error ?? 'Could not submit photo')
        return
      }
      setSubmitUrl('')
      setSubmitCaption('')
      setSubmitMsg(body.message ?? 'Submitted for review')
      void load()
    } finally {
      setSubmitting(false)
    }
  }

  const visibleItems = canModerate ? items : items.filter((i) => i.moderationStatus !== 'pending')

  return (
    <div className="space-y-4">
      {loading ?
        <p className="text-sm text-dc-muted">Loading gallery…</p>
      : null}
      {!loading && visibleItems.length === 0 ?
        <p className="rounded-xl border border-dc-border bg-black/20 p-6 text-center text-sm text-dc-muted">
          No photos yet.
          {canSubmit ? ' Be the first to share one below.' : ' Check back after the event.'}
        </p>
      : null}
      {canModerate && pendingCount > 0 ?
        <p className="text-sm text-amber-200/90">{pendingCount} photo(s) awaiting approval.</p>
      : null}

      {canSubmit ?
        <form onSubmit={submitPhoto} className="rounded-xl border border-dc-border bg-black/20 p-4 space-y-2">
          <p className="text-sm font-medium text-dc-text">Share a photo</p>
          <p className="text-xs text-dc-muted">Upload a photo or paste an image URL.</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dc-border px-3 py-2 text-xs text-dc-text hover:bg-dc-elevated-muted">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadPhoto(f)
                e.target.value = ''
              }}
            />
            {uploading ? 'Uploading…' : 'Choose image file'}
          </label>
          <input
            type="url"
            value={submitUrl}
            onChange={(e) => setSubmitUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-dc-border bg-black/40 px-3 py-2 text-sm text-dc-text"
            required
          />
          <input
            type="text"
            value={submitCaption}
            onChange={(e) => setSubmitCaption(e.target.value)}
            placeholder="Caption (optional)"
            maxLength={500}
            className="w-full rounded-lg border border-dc-border bg-black/40 px-3 py-2 text-sm text-dc-text"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          {submitMsg ? <p className="text-xs text-dc-text-muted">{submitMsg}</p> : null}
        </form>
      : null}

      {loading ?
        <p className="text-sm text-dc-muted">Loading gallery…</p>
      : visibleItems.length === 0 ?
        <p className="text-sm text-dc-muted">No gallery photos yet.</p>
      : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {visibleItems.map((img) => (
            <div key={img.id} className="relative">
              <button
                type="button"
                className="group relative aspect-square w-full overflow-hidden rounded-xl border border-dc-border bg-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
                onClick={() => setLightbox(img)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.imageUrl} alt={img.caption ?? ''} className="h-full w-full object-cover transition group-hover:scale-105" />
                {img.caption ?
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-left text-[11px] text-dc-text line-clamp-2">
                    {img.caption}
                  </span>
                : null}
                {img.moderationStatus === 'pending' ?
                  <span className="absolute left-2 top-2 rounded bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-dc-text">
                    Pending
                  </span>
                : null}
              </button>
              {canModerate && img.moderationStatus === 'pending' ?
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    className="flex-1 rounded bg-emerald-700/80 px-2 py-1 text-[10px] text-dc-text"
                    onClick={() => void moderate(img.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded bg-red-800/80 px-2 py-1 text-[10px] text-dc-text"
                    onClick={() => void moderate(img.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              : null}
            </div>
          ))}
        </div>
      )}

      {lightbox ?
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal
          aria-label="Gallery image"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute -top-10 right-0 text-sm text-dc-text/80 hover:text-dc-text"
              onClick={() => setLightbox(null)}
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.imageUrl} alt={lightbox.caption ?? ''} className="max-h-[85vh] w-auto rounded-xl" />
            {lightbox.caption ? <p className="mt-3 text-center text-sm text-dc-text/90">{lightbox.caption}</p> : null}
          </div>
        </div>
      : null}
    </div>
  )
}
