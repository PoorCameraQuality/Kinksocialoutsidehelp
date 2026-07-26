import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export type ProfileIsoPayload = {
  body: string
  visibility: string
  acceptDmsViaIso: boolean
  updatedAt: string
  images: { sortOrder: number; url: string }[]
}

export default function ProfileIsoView({
  iso,
  targetUsername,
  targetUserId,
  viewerIsSelf,
  isAuthenticated,
}: {
  iso: ProfileIsoPayload
  targetUsername: string
  targetUserId: string
  viewerIsSelf: boolean
  isAuthenticated: boolean
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [msgErr, setMsgErr] = useState<string | null>(null)
  const [msgBusy, setMsgBusy] = useState(false)
  const navigate = useNavigate()

  const startIsoDm = async () => {
    if (!iso.acceptDmsViaIso) return
    setMsgErr(null)
    setMsgBusy(true)
    try {
      const r = await fetch('/api/v1/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantUsername: targetUsername,
          entryPoint: 'iso',
          isoSubjectUserId: targetUserId,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { conversation?: { id: string }; error?: string }
      if (!r.ok) {
        setMsgErr(typeof j.error === 'string' ? j.error : 'Could not start conversation')
        return
      }
      const id = j.conversation?.id
      if (id) navigate(`/messaging?c=${encodeURIComponent(id)}`)
      else navigate('/messaging')
    } catch {
      setMsgErr('Network error')
    } finally {
      setMsgBusy(false)
    }
  }

  const sortedImages = [...iso.images].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-dc-text">ISO</h2>
          <p className="mt-1 text-xs text-dc-muted">
            Updated {new Date(iso.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        {viewerIsSelf ?
          <Link
            to="/profile?tab=ISO"
            className="shrink-0 rounded-full border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-accent hover:bg-dc-elevated-muted"
          >
            Edit ISO
          </Link>
        : isAuthenticated && iso.acceptDmsViaIso ?
          <button
            type="button"
            disabled={msgBusy}
            onClick={() => void startIsoDm()}
            className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-dc-text hover:bg-emerald-500 disabled:opacity-50"
          >
            {msgBusy ? 'Opening…' : 'Message from ISO'}
          </button>
        : null}
      </div>
      {!viewerIsSelf && !iso.acceptDmsViaIso ?
        <p className="mt-2 text-xs text-dc-muted">This member is not accepting DMs through their ISO.</p>
      : null}
      {msgErr ?
        <div
          className="mt-2 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-xs text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{msgErr}</p>
            <button
              type="button"
              onClick={() => setMsgErr(null)}
              className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      : null}

      <div className="mt-4 whitespace-pre-wrap text-sm text-dc-text-muted">{iso.body || '-'}</div>

      {sortedImages.length > 0 ?
        <div className="mt-4 flex gap-0.5">
          {sortedImages.map((im) => (
            <button
              key={im.sortOrder}
              type="button"
              onClick={() => setLightbox(im.url)}
              className="relative min-h-24 flex-1 overflow-hidden rounded-md border border-dc-border bg-zinc-900"
            >
              <img src={im.url} alt="" className="h-24 w-full object-cover" />
            </button>
          ))}
        </div>
      : null}

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
