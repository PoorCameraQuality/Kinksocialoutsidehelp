import { useMemo } from 'react'
import EventsListRow from '@/components/events/EventsListRow'
import { groupEventsByPeriod } from '@/components/events/events-agenda'
import type { MockEvent } from '@/data/types'

type Props = {
  events: MockEvent[]
  /** When true, render date-period headers (agenda); otherwise a flat list. */
  grouped?: boolean
}

/**
 * Agenda-style list of events. Groups by date period (Today / This week /
 * Next week / Later this month / Later) when `grouped` is set, otherwise a
 * flat list. Always uses the compact, date-first {@link EventsListRow}.
 */
export default function EventsAgendaList({ events, grouped = false }: Props) {
  const groups = useMemo(() => (grouped ? groupEventsByPeriod(events) : []), [events, grouped])

  if (!grouped || groups.length <= 1) {
    return (
      <div className="space-y-3">
        {events.map((event) => (
          <EventsListRow key={String(event.id)} event={event} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-dc-text-muted">{group.label}</h3>
            <span className="text-[11px] tabular-nums text-dc-muted">{group.events.length}</span>
            <span className="h-px flex-1 bg-dc-border/60" aria-hidden />
          </div>
          <div className="space-y-3">
            {group.events.map((event) => (
              <EventsListRow key={String(event.id)} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
