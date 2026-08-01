import { useState } from 'react'
import {
  copyTextToClipboard,
  downloadIsoCardPng,
  isoCardPngPath,
  isoShareAbsoluteUrl,
} from '@/lib/iso-share'

type Props = {
  username: string
  /** Hide share link when ISO is private (still allow owner download of teaser/public card). */
  canSharePublicly: boolean
  className?: string
}

export default function IsoShareActions({ username, canSharePublicly, className = '' }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const flash = (msg: string) => {
    setStatus(msg)
    window.setTimeout(() => setStatus(null), 4000)
  }

  const onCopyLink = async () => {
    const url = isoShareAbsoluteUrl(username)
    const ok = await copyTextToClipboard(url)
    flash(ok ? 'Share link copied.' : 'Could not copy link.')
  }

  const onDownload = async () => {
    setBusy(true)
    const ok = await downloadIsoCardPng(username)
    setBusy(false)
    flash(
      ok
        ? 'ISO card downloaded.'
        : 'Could not export card. Try again, or set visibility to Public if you are not signed in.',
    )
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex flex-wrap gap-2">
        {canSharePublicly ?
          <button
            type="button"
            onClick={() => void onCopyLink()}
            className="rounded-full border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-accent hover:bg-dc-elevated-muted"
          >
            Copy ISO share link
          </button>
        : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDownload()}
          className="rounded-full border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
        >
          {busy ? 'Exporting…' : 'Download ISO card'}
        </button>
        {canSharePublicly ?
          <a
            href={isoCardPngPath(username)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-muted hover:bg-dc-elevated-muted"
          >
            Preview card image
          </a>
        : null}
      </div>
      <p className="text-[11px] text-dc-muted leading-relaxed">
        {canSharePublicly ?
          'Shared links show your ISO card image in Discord, iMessage, and social previews. Visibility must be Public for the full card.'
        : 'Download exports your ISO card image while signed in. Set visibility to Public to copy a share link with social preview.'}
      </p>
      {status ?
        <p className="text-xs text-emerald-200" role="status">
          {status}
        </p>
      : null}
    </div>
  )
}
