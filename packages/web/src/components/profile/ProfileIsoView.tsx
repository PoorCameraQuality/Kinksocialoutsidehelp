import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ISO_APPROACH,
  ISO_CAPACITY,
  ISO_MENU_TAGS,
  ISO_PLAY_INTENT,
  ISO_ROLE_TAGS,
  ISO_SEEKING_WHO,
  ISO_SOCIAL_OFFERS,
  ISO_VENUES,
  isoStructuredHasContent,
  normalizeIsoStructured,
} from '@c2k/shared'
import IsoShareActions from '@/components/profile/IsoShareActions'
import ScenePitchCard from '@/components/profile/iso/ScenePitchCard'
import { isDancecardHost } from '@/lib/dancecard-host'

export type ProfileIsoPayload = {
  body: string
  visibility: string
  acceptDmsViaIso: boolean
  updatedAt: string
  images: { sortOrder: number; url: string }[]
  structured?: unknown
}

function labelOf(id: string, opts: readonly { id: string; label: string }[]) {
  return opts.find((o) => o.id === id)?.label ?? id
}

function TagLine({ ids, max = 8 }: { ids: string[]; max?: number }) {
  if (!ids.length) return null
  return (
    <p className="text-[15px] leading-relaxed text-dc-text-muted">
      {ids
        .slice(0, max)
        .map((id) => labelOf(id, ISO_MENU_TAGS))
        .join(' · ')}
    </p>
  )
}

export default function ProfileIsoView({
  iso,
  targetUsername,
  targetUserId,
  viewerIsSelf,
  isAuthenticated,
  /** When set, replaces the default Edit ISO → /profile?tab=ISO link (Dancecard-safe). */
  onEditIso,
  /** Hide owner Edit / share chrome (parent sheet supplies actions). */
  hideOwnerChrome = false,
}: {
  iso: ProfileIsoPayload
  targetUsername: string
  targetUserId: string
  viewerIsSelf: boolean
  isAuthenticated: boolean
  onEditIso?: () => void
  hideOwnerChrome?: boolean
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [msgErr, setMsgErr] = useState<string | null>(null)
  const [msgBusy, setMsgBusy] = useState(false)
  const navigate = useNavigate()
  const s = normalizeIsoStructured(iso.structured)
  const hasStructured = isoStructuredHasContent(s)
  const sortedImages = [...iso.images].sort((a, b) => a.sortOrder - b.sortOrder)

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

  return (
    <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-5 sm:p-6 shadow-[var(--dc-shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold text-dc-text">ISO</h2>
          <p className="mt-1 text-[13px] text-dc-muted">
            Updated {new Date(iso.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        {viewerIsSelf && !hideOwnerChrome ? (
          onEditIso || isDancecardHost() ? (
            <button
              type="button"
              onClick={() => onEditIso?.()}
              className="shrink-0 rounded-full border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-accent hover:bg-dc-elevated-muted"
            >
              Edit ISO
            </button>
          ) : (
            <Link
              to="/profile?tab=ISO"
              className="shrink-0 rounded-full border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-accent hover:bg-dc-elevated-muted"
            >
              Edit ISO
            </Link>
          )
        ) : null}
      </div>

      {hasStructured ? (
        <div className="mt-5 space-y-6">
          <div>
            <div className="flex flex-wrap gap-1.5">
              {s.roles.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-1 text-[13px] font-medium text-dc-text-muted"
                >
                  {labelOf(id, ISO_ROLE_TAGS)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[15px] text-dc-text-muted">
              {labelOf(s.playIntent, ISO_PLAY_INTENT)}
              {s.capacity !== 'selective' ? ` · ${labelOf(s.capacity, ISO_CAPACITY)}` : ''}
            </p>
          </div>

          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">How to approach</p>
            <p className="mt-1 text-[15px] leading-relaxed text-dc-text-muted">
              {s.approach === 'visual_signal' && s.visualSignal.trim()
                ? `${labelOf(s.approach, ISO_APPROACH)}. Look for: ${s.visualSignal.trim()}`
                : labelOf(s.approach, ISO_APPROACH)}
            </p>
          </div>

          {s.discordHandle.trim() ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Discord</p>
              <p className="mt-1 text-[15px] leading-relaxed text-dc-text-muted">{s.discordHandle.trim()}</p>
            </div>
          ) : null}

          {s.seekingWho.length ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Looking for</p>
              <p className="mt-1 text-[15px] leading-relaxed text-dc-text-muted">
                {s.seekingWho.map((id) => labelOf(id, ISO_SEEKING_WHO)).join(', ')}
              </p>
            </div>
          ) : null}

          {s.pitches.length ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted mb-1">Scene menu</p>
              {s.pitches.map((p, i) => (
                <ScenePitchCard key={p.id} pitch={p} index={i} mode="public" />
              ))}
            </div>
          ) : null}

          {s.into.length ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Into</p>
              <div className="mt-1">
                <TagLine ids={s.into} />
              </div>
            </div>
          ) : null}

          {s.curious.length ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Curious about</p>
              <div className="mt-1">
                <TagLine ids={s.curious} />
              </div>
            </div>
          ) : null}

          {s.hardNos.length ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Boundaries</p>
              <p className="mt-1 text-[15px] text-dc-text-muted">
                Hard nos:{' '}
                {s.hardNos.map((id) => labelOf(id, ISO_MENU_TAGS)).join(' · ')}
              </p>
            </div>
          ) : null}

          {(s.venues.length || s.gearBringing.trim() || s.riskNotes.trim()) ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Logistics</p>
              {s.venues.length ? (
                <p className="mt-1 text-[15px] text-dc-text-muted">
                  {s.venues.map((id) => labelOf(id, ISO_VENUES)).join(' · ')}
                </p>
              ) : null}
              {s.gearBringing.trim() ? (
                <p className="mt-1 whitespace-pre-wrap text-[15px] text-dc-text-muted">{s.gearBringing}</p>
              ) : null}
              {s.riskNotes.trim() ? (
                <p className="mt-1 whitespace-pre-wrap text-[15px] text-dc-text-muted">{s.riskNotes}</p>
              ) : null}
            </div>
          ) : null}

          {s.socialOffers.length ? (
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Also happy to</p>
              <p className="mt-1 text-[15px] text-dc-text-muted">
                {s.socialOffers.map((id) => labelOf(id, ISO_SOCIAL_OFFERS)).join(' · ')}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {iso.body.trim() ? (
        <div className={hasStructured ? 'mt-6' : 'mt-4'}>
          {hasStructured ? (
            <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">In their words</p>
          ) : null}
          <div className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-dc-text-muted">{iso.body}</div>
        </div>
      ) : !hasStructured ? (
        <div className="mt-4 text-sm text-dc-muted">-</div>
      ) : null}

      {!viewerIsSelf && !iso.acceptDmsViaIso ? (
        <p className="mt-4 text-xs text-dc-muted">This member is not accepting DMs through their ISO.</p>
      ) : null}
      {msgErr ? (
        <p className="mt-2 text-xs text-red-200" role="alert">
          {msgErr}
        </p>
      ) : null}

      {!viewerIsSelf && isAuthenticated && iso.acceptDmsViaIso ? (
        <button
          type="button"
          disabled={msgBusy}
          onClick={() => void startIsoDm()}
          className="mt-6 min-h-11 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {msgBusy ? 'Opening…' : 'Message about a scene'}
        </button>
      ) : null}

      {viewerIsSelf && !hideOwnerChrome ? (
        <div className="mt-6 border-t border-dc-border pt-4">
          <IsoShareActions username={targetUsername} canSharePublicly={iso.visibility === 'PUBLIC'} />
        </div>
      ) : null}

      {sortedImages.length > 0 ? (
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
      ) : null}

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-dc-modal flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      ) : null}
    </div>
  )
}
