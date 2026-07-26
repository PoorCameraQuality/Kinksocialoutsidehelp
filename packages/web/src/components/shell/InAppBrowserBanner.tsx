import { useMemo, useState } from 'react'
import {
  detectBrowserEnvironment,
  inAppBrowserLabel,
  IN_APP_BROWSER_BANNER_DISMISS_KEY,
} from '@/lib/browser-environment'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(IN_APP_BROWSER_BANNER_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Subtle nudge when opened inside Messenger / Facebook / etc. */
export default function InAppBrowserBanner() {
  const env = useMemo(() => detectBrowserEnvironment(), [])
  const [dismissed, setDismissed] = useState(readDismissed)

  if (!env.isEmbeddedWebView || dismissed) return null

  const label = inAppBrowserLabel(env.inApp)
  const copy = label
    ? `Opened inside ${label}. Some forms, photos, and messaging work best in Safari or Chrome.`
    : 'Opened inside an in-app browser. For the most reliable experience, open in Safari or Chrome.'

  function dismiss() {
    try {
      sessionStorage.setItem(IN_APP_BROWSER_BANNER_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  function openExternal() {
    const url = window.location.href
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="c2k-in-app-banner fixed inset-x-0 top-0 z-[600] border-b border-amber-500/30 bg-amber-950/95 px-3 py-2 text-amber-50 safe-area-pt lg:hidden"
      role="status"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-2">
        <p className="flex-1 text-xs leading-snug sm:text-sm">{copy}</p>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <button
            type="button"
            onClick={openExternal}
            className="c2k-touch-target min-h-9 rounded-lg bg-amber-500/20 px-2.5 text-xs font-medium text-amber-50 hover:bg-amber-500/30"
          >
            Open in browser
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="c2k-touch-target min-h-9 rounded-lg px-2.5 text-xs text-amber-100/90 hover:bg-amber-500/10"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
