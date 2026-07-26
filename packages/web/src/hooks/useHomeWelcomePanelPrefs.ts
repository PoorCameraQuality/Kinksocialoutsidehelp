import { useCallback, useEffect, useState } from 'react'

const COLLAPSED_KEY = 'c2k-home-welcome-collapsed'
const DISMISSED_UNTIL_KEY = 'c2k-home-welcome-dismissed-until'
const DISMISS_DAYS = 7

function storageKey(base: string, username: string | null): string {
  return username ? `${base}:${username}` : base
}

function readDismissedUntil(username: string | null): number | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(storageKey(DISMISSED_UNTIL_KEY, username))
  if (!raw) return null
  const ts = Date.parse(raw)
  return Number.isNaN(ts) ? null : ts
}

function readCollapsed(username: string | null): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(storageKey(COLLAPSED_KEY, username)) === '1'
}

export type HomeWelcomeView = 'full' | 'upcoming-only'

function resolveInitialView(username: string | null): HomeWelcomeView {
  const dismissedUntil = readDismissedUntil(username)
  const dismissed = dismissedUntil != null && dismissedUntil > Date.now()
  const collapsed = readCollapsed(username)
  return dismissed || collapsed ? 'upcoming-only' : 'full'
}

export function useHomeWelcomePanelPrefs(viewerUsername: string | null, preferCompact = false) {
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<HomeWelcomeView>(() =>
    preferCompact ? 'upcoming-only' : resolveInitialView(viewerUsername),
  )

  useEffect(() => {
    setMounted(true)
    setView(preferCompact ? 'upcoming-only' : resolveInitialView(viewerUsername))
  }, [viewerUsername, preferCompact])

  const collapseToUpcoming = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey(COLLAPSED_KEY, viewerUsername), '1')
    }
    setView('upcoming-only')
  }, [viewerUsername])

  const dismissPromoFor7Days = useCallback(() => {
    if (typeof window !== 'undefined') {
      const until = new Date()
      until.setDate(until.getDate() + DISMISS_DAYS)
      localStorage.setItem(storageKey(DISMISSED_UNTIL_KEY, viewerUsername), until.toISOString())
      localStorage.setItem(storageKey(COLLAPSED_KEY, viewerUsername), '1')
    }
    setView('upcoming-only')
  }, [viewerUsername])

  const expandFull = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey(COLLAPSED_KEY, viewerUsername))
      localStorage.removeItem(storageKey(DISMISSED_UNTIL_KEY, viewerUsername))
    }
    setView('full')
  }, [viewerUsername])

  return {
    mounted,
    view: mounted ? view : 'full',
    collapseToUpcoming,
    dismissPromoFor7Days,
    expandFull,
  }
}
