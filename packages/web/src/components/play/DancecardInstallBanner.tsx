import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isDancecardHost } from '@/lib/dancecard-host'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'c2k-dancecard-install-dismissed'

/**
 * “Add to Home Screen” prompt for Dancecard (PWA standalone).
 * Shows on dancecard.* host or any /play route when the browser fires beforeinstallprompt.
 */
export default function DancecardInstallBanner() {
  const { pathname } = useLocation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  const onPlaySurface = pathname === '/play' || pathname.startsWith('/play/')
  const relevant = isDancecardHost() || onPlaySurface

  useEffect(() => {
    if (!relevant) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* ignore */
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    if (standalone) return

    const ua = navigator.userAgent || ''
    const isIos = /iPhone|iPad|iPod/i.test(ua)
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
    if (isIos && isSafari) {
      setIosHint(true)
      setHidden(false)
      return
    }

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [relevant])

  if (!relevant || hidden) return null
  if (!deferred && !iosHint) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
    setDeferred(null)
    setIosHint(false)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setHidden(true)
  }

  return (
    <div className="fixed bottom-[calc(var(--c2k-bottom-nav-total-h,4rem)+0.75rem)] left-3 right-3 z-40 mx-auto max-w-lg rounded-2xl border border-[rgba(211,87,123,0.45)] bg-[#16030C]/95 p-3 shadow-[0_0_24px_rgba(211,87,123,0.22)] backdrop-blur-md md:left-auto md:right-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#F6F2F0]">Install Dancecard</p>
          <p className="mt-0.5 text-xs text-[#8E8587]">
            {iosHint ?
              'Tap Share, then Add to Home Screen for a full-screen app icon.'
            : 'Add to your home screen for a standalone Dancecard app.'}
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl px-2 text-xs text-dc-muted hover:text-dc-text"
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
      {deferred ?
        <button
          type="button"
          className="mt-2 min-h-11 w-full rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          onClick={() => void install()}
        >
          Install
        </button>
      : null}
    </div>
  )
}
