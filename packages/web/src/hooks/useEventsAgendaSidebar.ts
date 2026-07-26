import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApiEvents } from '@/hooks/useApiEvents'
import { useApiMyRsvps } from '@/hooks/useApiMyRsvps'

export type EventsAgendaRow = {
  eventId: string
  title: string
  startsAt: string
  status: string
  organizing: boolean
}

type Options = {
  /** When false, skips RSVP/host fetches (e.g. unsigned demo). Default true. */
  enabled?: boolean
}

export function useEventsAgendaSidebar(options: Options = {}) {
  const { enabled = true } = options
  const { isAuthenticated, isFallback } = useAuth()
  const homeDemoFallbackEnv = import.meta.env.VITE_HOME_DEMO_FALLBACK === 'true'
  const useDemoFallback = homeDemoFallbackEnv && !isAuthenticated

  const showApiAgenda = enabled && isAuthenticated && !isFallback && !useDemoFallback
  const organizingEvents = useApiEvents({ hostId: 'me', enabled: showApiAgenda })
  const myRsvps = useApiMyRsvps(showApiAgenda)

  const upcomingAgenda = useMemo(() => {
    const now = Date.now()
    const byId = new Map<string, EventsAgendaRow>()
    for (const r of myRsvps.items) {
      byId.set(r.eventId, {
        eventId: r.eventId,
        title: r.title,
        startsAt: r.startsAt,
        status: r.status,
        organizing: false,
      })
    }
    if (organizingEvents.status === 'ready') {
      for (const ev of organizingEvents.items) {
        const id = String(ev.id)
        const startsAt = ev.startsAt ?? ''
        const existing = byId.get(id)
        if (existing) byId.set(id, { ...existing, organizing: true })
        else {
          byId.set(id, {
            eventId: id,
            title: ev.title,
            startsAt,
            status: 'organizing',
            organizing: true,
          })
        }
      }
    }
    return [...byId.values()]
      .filter((row) => {
        const t = new Date(row.startsAt).getTime()
        return !Number.isNaN(t) && t >= now
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [myRsvps.items, organizingEvents.items, organizingEvents.status])

  const pastRsvpCount = useMemo(() => {
    const now = Date.now()
    return myRsvps.items.filter((r) => {
      const t = new Date(r.startsAt).getTime()
      return !Number.isNaN(t) && t < now
    }).length
  }, [myRsvps.items])

  const agendaLoading =
    showApiAgenda &&
    (myRsvps.status === 'loading' || organizingEvents.status === 'loading')
  const agendaError = myRsvps.status === 'error' || organizingEvents.status === 'error'

  return {
    showAgenda: isAuthenticated && !isFallback && !useDemoFallback,
    showMockAgenda: useDemoFallback,
    agendaLoading,
    agendaError,
    onAgendaRetry: () => {
      myRsvps.reload()
      organizingEvents.reload()
    },
    upcomingAgenda,
    pastRsvpCount,
  }
}
