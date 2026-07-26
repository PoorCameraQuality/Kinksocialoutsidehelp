import { useCallback, useEffect, useState } from 'react'
import PhotoUpload from '@/components/PhotoUpload'

type MeIsoResponse = {
  post: { body: string; visibility: string; acceptDmsViaIso: boolean; updatedAt: string } | null
  images: { sortOrder: number; url: string }[]
  pinnedConventionIds?: string[]
}

const VIS_OPTIONS = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'MEMBERS', label: 'Signed-in members' },
  { value: 'PRIVATE', label: 'Private (hidden from others)' },
] as const

async function uploadIsoImageFile(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('purpose', 'profile_media')
  fd.append('file', file)
  const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
  if (!r.ok) return null
  const j = (await r.json()) as { url?: string }
  return typeof j.url === 'string' ? j.url : null
}

export default function ProfileIsoEditor() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<string>('MEMBERS')
  const [acceptDmsViaIso, setAcceptDmsViaIso] = useState(false)
  const [images, setImages] = useState<string[]>(['', '', ''])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [uploadSlot, setUploadSlot] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/v1/me/iso', { credentials: 'include' })
      if (r.status === 401) {
        setErr('Sign in to edit your ISO.')
        setLoading(false)
        return
      }
      if (!r.ok) {
        setErr('Could not load ISO.')
        setLoading(false)
        return
      }
      const data = (await r.json()) as MeIsoResponse
      if (data.post) {
        setBody(data.post.body)
        setVisibility(data.post.visibility)
        setAcceptDmsViaIso(data.post.acceptDmsViaIso)
      } else {
        setBody('')
        setVisibility('MEMBERS')
        setAcceptDmsViaIso(false)
      }
      const urls = ['', '', '']
      for (const im of data.images ?? []) {
        if (im.sortOrder >= 0 && im.sortOrder < 3) urls[im.sortOrder] = im.url
      }
      setImages(urls)
    } catch {
      setErr('Network error loading ISO.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!ok) return
    const timer = window.setTimeout(() => setOk(null), 5000)
    return () => window.clearTimeout(timer)
  }, [ok])

  const save = async () => {
    setSaving(true)
    setErr(null)
    setOk(null)
    const cleaned = images.map((u) => u.trim()).filter((u) => u.length > 0)
    if (cleaned.length > 3) {
      setErr('At most three images.')
      setSaving(false)
      return
    }
    try {
      const r = await fetch('/api/v1/me/iso', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          visibility,
          acceptDmsViaIso,
          images: cleaned,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(typeof j.error === 'string' ? j.error : 'Save failed')
        return
      }
      setOk('Saved.')
      await load()
    } catch {
      setErr('Network error while saving.')
    } finally {
      setSaving(false)
    }
  }

  const onPhotoPick = async (slot: number, file: File) => {
    const url = await uploadIsoImageFile(file)
    setUploadSlot(null)
    if (!url) {
      setErr('Image upload failed (check S3 configuration) or paste an image URL instead.')
      return
    }
    setImages((prev) => {
      const next = [...prev]
      next[slot] = url
      return next
    })
  }

  if (loading) {
    return <p className="text-sm text-dc-muted">Loading your ISO…</p>
  }

  return (
    <div className="space-y-5">
      {err ?
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{err}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setErr(null)}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}
      {ok ?
        <p className="text-sm rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-emerald-100" role="status">
          {ok}
        </p>
      : null}

      <div>
        <label className="block text-xs font-medium text-dc-muted mb-1">What you are seeking (wishlist)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          maxLength={12000}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder:text-zinc-500"
          placeholder="Scenes you want, limits, how to approach you, scheduling notes…"
        />
        <p className="mt-1 text-[10px] text-dc-muted">{body.length} / 12000</p>
      </div>

      <div>
        <span className="block text-xs font-medium text-dc-muted mb-1">Visibility</span>
        <div className="flex flex-wrap gap-2">
          {VIS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setVisibility(o.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                visibility === o.value ? 'bg-emerald-600 text-dc-text' : 'bg-dc-elevated-muted text-dc-text-muted hover:bg-white/15'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptDmsViaIso}
          onChange={(e) => setAcceptDmsViaIso(e.target.checked)}
          className="rounded border-dc-border-strong"
        />
        <span className="text-sm text-dc-text-muted">Accept DMs through my ISO</span>
      </label>
      <p className="mt-1 text-xs text-dc-muted leading-relaxed pl-6">
        ISO replies go to your ISO inbox. You can ignore, block, or report messages anytime.
      </p>

      <div>
        <span className="block text-xs font-medium text-dc-muted mb-2">Up to three images (tight row on profile)</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((slot) => (
            <div key={slot} className="flex-1 min-w-0 space-y-1">
              {images[slot] ?
                <button
                  type="button"
                  onClick={() => setLightbox(images[slot])}
                  className="relative block w-full aspect-square overflow-hidden rounded-lg border border-dc-border bg-zinc-900"
                >
                  <img src={images[slot]} alt="" className="h-full w-full object-cover" />
                </button>
              :
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-dc-border bg-dc-surface-muted text-[10px] text-dc-muted">
                  Empty
                </div>
              }
              <input
                type="url"
                value={images[slot]}
                onChange={(e) =>
                  setImages((prev) => {
                    const n = [...prev]
                    n[slot] = e.target.value
                    return n
                  })
                }
                placeholder="Image URL"
                className="w-full rounded border border-dc-border bg-dc-surface-muted px-1 py-1 text-[10px] text-dc-text"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setUploadSlot(uploadSlot === slot ? null : slot)}
                  className="flex-1 rounded bg-dc-elevated-muted px-1 py-0.5 text-[10px] text-dc-text-muted hover:bg-white/15"
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImages((prev) => {
                      const n = [...prev]
                      n[slot] = ''
                      return n
                    })
                  }
                  className="rounded bg-dc-elevated-muted px-1 py-0.5 text-[10px] text-rose-300 hover:bg-dc-elevated-muted"
                >
                  Clear
                </button>
              </div>
              {uploadSlot === slot ?
                <div className="rounded border border-dc-border bg-dc-elevated-solid p-2">
                  <PhotoUpload
                    onSelect={(res) => {
                      void onPhotoPick(slot, res.file)
                    }}
                    guidelines={[{ text: 'ISO images: same rules as profile photos.' }]}
                  />
                </div>
              : null}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-dc-text hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save ISO'}
      </button>

      {lightbox ?
        <button
          type="button"
          className="fixed inset-0 z-dc-modal flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      : null}
    </div>
  )
}
