import { useCallback, useEffect, useState } from 'react'

export type MyScheduleItem = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  kind: 'dancecard_manual' | 'dancecard_slot_signup' | 'dancecard_scene_booking' | string
  subtitle?: string
  location?: string | null
  mutable: boolean
  sourceKind?: string | null
  sourceId?: string | null
  playSpaceId: string
  playSpaceSlug: string
  playSpaceTitle: string
  timezone: string
}

export type MyScheduleSpace = {
  id: string
  slug: string
  title: string
  timezone: string
}

export type ScheduleRange = 'upcoming' | 'past' | 'all'

function errMsg(status: number, bodyError?: string): string {
  if (status === 401) return 'Sign in to view your schedule.'
  return bodyError ?? `Request failed (${status}).`
}

export function scheduleExportUrl(
  format: 'ics' | 'csv',
  opts: { range: ScheduleRange; space?: string },
): string {
  const params = new URLSearchParams()
  params.set('range', opts.range)
  if (opts.space) params.set('space', opts.space)
  return `/api/v1/play-spaces/me/schedule.${format}?${params}`
}

export function useMyPlaySchedule(opts: { range: ScheduleRange; space?: string; enabled?: boolean }) {
  const enabled = opts.enabled !== false
  const [reloadToken, setReloadToken] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [items, setItems] = useState<MyScheduleItem[]>([])
  const [spaces, setSpaces] = useState<MyScheduleSpace[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setItems([])
      setSpaces([])
      setErrorMessage(null)
      return
    }
    let cancelled = false
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
    setErrorMessage(null)
    void (async () => {
      try {
        const params = new URLSearchParams()
        params.set('range', opts.range)
        if (opts.space) params.set('space', opts.space)
        const r = await fetch(`/api/v1/play-spaces/me/schedule?${params}`, { credentials: 'include' })
        const j = (await r.json().catch(() => ({}))) as {
          items?: MyScheduleItem[]
          spaces?: MyScheduleSpace[]
          error?: string
        }
        if (!r.ok) {
          if (!cancelled) {
            setStatus('error')
            setItems([])
            setErrorMessage(errMsg(r.status, j.error))
          }
          return
        }
        if (!cancelled) {
          setStatus('ready')
          setItems(j.items ?? [])
          setSpaces(j.spaces ?? [])
          setErrorMessage(null)
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
          setItems([])
          setErrorMessage('Could not reach the API.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, opts.range, opts.space, reloadToken])

  /** Pick up edits made elsewhere on the site (other tabs / after navigating back). */
  useEffect(() => {
    if (!enabled) return
    const onFocus = () => reload()
    const onVis = () => {
      if (document.visibilityState === 'visible') reload()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, 45_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(poll)
    }
  }, [enabled, reload])

  return { status, items, spaces, errorMessage, reload }
}
