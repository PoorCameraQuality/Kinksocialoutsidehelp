import { useCallback, useEffect, useState } from 'react'

export type ApiMyRsvpItem = {
  eventId: string
  title: string
  startsAt: string
  status: 'going' | 'maybe' | 'waitlist' | string
  rsvpApprovalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected' | null
}

export type ApiMyRsvpsResult = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApiMyRsvpItem[]
  reload: () => void
}

function formatRsvpDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = new Date()
  const today =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (today) return 'TODAY'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).toUpperCase()
}

export function formatMyRsvpLabel(item: ApiMyRsvpItem): { date: string; title: string } {
  return { date: formatRsvpDate(item.startsAt), title: item.title }
}

export function useApiMyRsvps(enabled: boolean): ApiMyRsvpsResult {
  const [state, setState] = useState<Omit<ApiMyRsvpsResult, 'reload'>>({ status: 'idle', items: [] })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', items: [] })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    void (async () => {
      try {
        const r = await fetch('/api/v1/events/me/rsvps', { credentials: 'include' })
        if (r.status === 401) {
          if (!cancelled) setState({ status: 'ready', items: [] })
          return
        }
        if (!r.ok) {
          if (!cancelled) setState({ status: 'error', items: [] })
          return
        }
        const data = (await r.json()) as { items?: ApiMyRsvpItem[] }
        if (!cancelled) setState({ status: 'ready', items: data.items ?? [] })
      } catch {
        if (!cancelled) setState({ status: 'error', items: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  return { ...state, reload }
}
