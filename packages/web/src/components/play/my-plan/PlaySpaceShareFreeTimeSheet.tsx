import { useEffect, useState } from 'react'
import { dancecardSharePublicPath, makeDancecardApiScope } from '@/lib/dancecard/dancecardApiScope'
import { shareOrCopyUrl } from '@/lib/share-or-copy'

const BUFFER_OPTIONS = [0, 15, 30, 45, 60, 90, 120]

type ShareRow = { id: string; token: string; label: string | null; revokedAt: string | null }

export default function PlaySpaceShareFreeTimeSheet({
  slug,
  bufferMinutes,
  shares,
  busy,
  onClose,
  onSetBuffer,
  onCreateShare,
  onRevoke,
  autoShareOnOpen = false,
}: {
  slug: string
  bufferMinutes: number
  shares: ShareRow[]
  busy?: boolean
  onClose: () => void
  onSetBuffer: (minutes: number) => Promise<void>
  /** Create a share if needed and return the absolute URL. */
  onCreateShare: () => Promise<string>
  onRevoke: (shareId: string) => Promise<void>
  /** Fire system share / copy once when the sheet opens (primary mobile path). */
  autoShareOnOpen?: boolean
}) {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const active = shares.filter((s) => !s.revokedAt)
  const scope = makeDancecardApiScope('play-space', slug)

  function urlFor(token: string) {
    return `${window.location.origin}${dancecardSharePublicPath(scope, token)}`
  }

  async function ensureUrl(): Promise<string> {
    if (localUrl) return localUrl
    const first = active[0]
    if (first) {
      const url = urlFor(first.token)
      setLocalUrl(url)
      return url
    }
    const url = await onCreateShare()
    setLocalUrl(url)
    return url
  }

  async function shareNow() {
    setError(null)
    setStatus(null)
    try {
      const url = await ensureUrl()
      const result = await shareOrCopyUrl({
        url,
        title: 'My free time',
        text: 'Pick a time that works — this link only shows when I am free.',
      })
      if (result === 'shared') setStatus('Opened your share sheet')
      else if (result === 'copied') setStatus('Link copied — paste it anywhere')
      else if (result === 'failed') setError('Could not share automatically. Copy the link below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a share link')
    }
  }

  useEffect(() => {
    if (!autoShareOnOpen || busy) return
    void shareNow()
    // Only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-on-open
  }, [autoShareOnOpen])

  const displayUrl = localUrl ?? (active[0] ? urlFor(active[0].token) : null)

  return (
    <div
      className="fixed inset-0 z-dc-modal flex flex-col justify-end sm:items-center sm:justify-center sm:bg-black/70 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share my free time"
    >
      <button type="button" className="min-h-0 flex-1 bg-black/70 sm:hidden" aria-label="Close" onClick={onClose} />
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-dc-border bg-dc-elevated px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl">
        <header className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-dc-text">Share my free time</p>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-dc-text-muted">
            Close
          </button>
        </header>

        <p className="mt-3 text-[15px] leading-relaxed text-dc-text">
          One link. They pick a free window. Your program and scenes stay private.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => void shareNow()}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-dc-accent text-base font-semibold text-dc-accent-foreground disabled:opacity-50"
        >
          {busy ? 'Working…' : active.length || localUrl ? 'Share link' : 'Create & share link'}
        </button>

        {status ? (
          <p className="mt-3 text-sm text-emerald-200" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-[var(--dc-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {displayUrl ? (
          <label className="mt-4 block">
            <span className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Your link</span>
            <input
              readOnly
              value={displayUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"
            />
          </label>
        ) : null}

        <p className="mt-6 text-[12px] font-medium uppercase tracking-wide text-dc-muted">Recovery time</p>
        <p className="mt-1 text-[13px] text-dc-muted">
          Buffer after scenes and blocks before you look free again.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BUFFER_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => void onSetBuffer(m)}
              className={`min-h-11 rounded-full border px-3.5 text-sm font-medium ${
                bufferMinutes === m
                  ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] font-semibold text-dc-text'
                  : 'border-dc-border text-dc-text-muted'
              }`}
            >
              {m === 0 ? 'None' : `${m} min`}
              {bufferMinutes === m ? ' ✓' : ''}
            </button>
          ))}
        </div>

        {active.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRevoke(active[0]!.id).then(() => setLocalUrl(null))}
            className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full border border-dc-border text-sm font-medium text-dc-text-muted"
          >
            Turn off link
          </button>
        ) : null}
      </div>
    </div>
  )
}
