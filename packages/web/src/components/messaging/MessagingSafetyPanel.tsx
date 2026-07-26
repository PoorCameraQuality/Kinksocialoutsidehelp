import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cardSurfaceSolidClass } from '@/lib/card-surface'

const DISMISS_KEY = 'c2k:messaging-safety-dismissed'

type Props = {
  variant?: 'sidebar' | 'inline' | 'banner'
  defaultOpen?: boolean
}

export default function MessagingSafetyPanel({ variant = 'sidebar', defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? variant === 'sidebar')
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  useEffect(() => {
    try {
      setDismissed(Boolean(localStorage.getItem(DISMISS_KEY)))
    } catch {
      setDismissed(true)
    }
  }, [])

  const dismissBanner = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
    setExpanded(false)
  }

  const body = (
    <>
      <p className="text-sm leading-relaxed text-dc-text-muted">
        Only share what you&apos;re comfortable with. You can report abuse or block someone anytime. Meeting IRL? Use a
        public place first and tell a friend your plans.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <Link to="/support" className="inline-flex min-h-9 items-center font-medium text-dc-accent hover:underline">
            Help &amp; support
          </Link>
        </li>
        <li>
          <Link to="/support?report=1" className="inline-flex min-h-9 items-center font-medium text-dc-accent hover:underline">
            Report a problem
          </Link>
        </li>
      </ul>
    </>
  )

  if (variant === 'banner') {
    return (
      <div className="mb-1.5 rounded-xl border border-dc-accent-border/30 bg-dc-accent-muted/15 px-3 py-1.5 sm:mb-2 sm:py-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="min-w-0 flex-1 text-left text-xs text-dc-text-muted"
            aria-expanded={expanded}
          >
            <span className="font-medium text-dc-text">Messaging safety</span>
            {!expanded ?
              <span className="text-dc-muted"> · Tap for tips</span>
            : null}
          </button>
          {!dismissed ?
            <button
              type="button"
              onClick={dismissBanner}
              className="shrink-0 inline-flex min-h-9 items-center px-2 text-xs text-dc-muted hover:text-dc-text"
            >
              Dismiss
            </button>
          : (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="shrink-0 inline-flex min-h-9 items-center px-2 text-xs text-dc-accent"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
        {expanded ? <div className="mt-2 border-t border-white/[0.06] pt-2">{body}</div> : null}
      </div>
    )
  }

  if (variant === 'inline') {
    if (dismissed) return null
    return (
      <div className="mb-3 rounded-xl border border-dc-accent-border/30 bg-dc-accent-muted/15 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-dc-text">Messaging safety</p>
          <button
            type="button"
            onClick={dismissBanner}
            className="inline-flex min-h-9 min-w-9 items-center justify-center px-1 text-xs text-dc-muted hover:text-dc-text"
          >
            Dismiss
          </button>
        </div>
        <div className="mt-1">{body}</div>
      </div>
    )
  }

  return (
    <div className={`${cardSurfaceSolidClass} p-4`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-touch items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-dc-text">Messaging safety</span>
        <span className="text-dc-muted" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="mt-3">{body}</div> : null}
    </div>
  )
}
