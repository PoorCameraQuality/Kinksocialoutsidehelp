import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MockEvent } from '@/data/mock-data'

type GroupEventCalendarProps = {
  events: MockEvent[]
  onEventClick?: (event: MockEvent) => void
  /** Compact mode for sidebar - smaller grid, fewer event links */
  compact?: boolean
  /** When compact, link to switch to Events tab (group page) */
  groupId?: string
  /** When false, month list rows are plain text (no `/events/:id` links). */
  linkEvents?: boolean
  /** When set, that calendar day gets a focus ring (0-based month index). */
  highlightedDay?: { year: number; monthIndex: number; day: number } | null
  /** When set, days that have events are buttons (e.g. scroll to a timeline row). */
  onDayWithEventsPress?: (d: { year: number; monthIndex: number; day: number }) => void
}

function parseEventDate(event: MockEvent): Date | null {
  if (event.startsAt) {
    const iso = new Date(event.startsAt)
    if (!Number.isNaN(iso.getTime())) return iso
  }
  const dateStr = event.date
  const m = dateStr.match(/(\w{3}), (\w{3}) (\d{1,2}) at (\d{1,2}):(\d{2}) (AM|PM)/)
  if (m) {
    const [, month, day, hour, min, ampm] = m
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    let h = parseInt(hour, 10)
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return new Date(2026, months[month] ?? 0, parseInt(day, 10), h, parseInt(min, 10))
  }
  const range = dateStr.match(/(\w{3}) (\d{1,2})–(\d{1,2}), (\d{4})/)
  if (range) {
    const [, month, startDay, year] = range
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    return new Date(parseInt(year, 10), months[month] ?? 0, parseInt(startDay, 10))
  }
  return null
}

export default function GroupEventCalendar({
  events,
  onEventClick,
  compact,
  groupId,
  linkEvents = true,
  highlightedDay,
  onDayWithEventsPress,
}: GroupEventCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  useEffect(() => {
    if (!highlightedDay) return
    if (highlightedDay.year === year && highlightedDay.monthIndex === month) return
    setViewDate(new Date(highlightedDay.year, highlightedDay.monthIndex, 1))
  }, [highlightedDay, year, month])
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const eventsByDay: Record<number, MockEvent[]> = {}
  for (const e of events) {
    const d = parseEventDate(e)
    if (d && d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push(e)
    }
  }

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const blanks = Array(firstDay).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className={`bg-dc-elevated/95 rounded-2xl border border-dc-border shadow-[var(--dc-shadow-soft)] ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        <button type="button" onClick={prevMonth} className="p-1.5 text-dc-muted hover:text-dc-text rounded-lg hover:bg-dc-elevated-muted">
          <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className={`font-semibold text-dc-text ${compact ? 'text-sm' : 'text-lg'}`}>{monthNames[month]} {year}</h3>
        <button type="button" onClick={nextMonth} className="p-1.5 text-dc-muted hover:text-dc-text rounded-lg hover:bg-dc-elevated-muted">
          <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayNames.map((d) => (
          <div key={d} className={`font-medium text-dc-muted ${compact ? 'text-[10px] py-0.5' : 'text-xs py-1'}`}>{d}</div>
        ))}
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const dayEvents = eventsByDay[day] ?? []
          const has = dayEvents.length > 0
          const isHi =
            Boolean(highlightedDay) &&
            highlightedDay!.year === year &&
            highlightedDay!.monthIndex === month &&
            highlightedDay!.day === day
          const cellClass = `aspect-square rounded flex flex-col items-center justify-center motion-safe:transition-[box-shadow,transform,background-color] motion-safe:duration-150 ${
            has ? 'bg-dc-accent/20 text-dc-accent' : 'text-dc-text-muted'
          } ${compact ? 'text-[10px]' : 'text-sm'} ${
            isHi ? 'ring-2 ring-dc-accent ring-offset-2 ring-offset-[var(--dc-surface-card)] z-[1]' : ''
          } ${has && onDayWithEventsPress ? 'hover:bg-dc-accent/28 motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100' : ''}`

          if (has && onDayWithEventsPress && !compact) {
            const label = `${monthNames[month]} ${day}, ${year}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
            return (
              <button
                key={day}
                type="button"
                className={cellClass}
                aria-label={`${label}. Show in list below.`}
                onClick={() => onDayWithEventsPress({ year, monthIndex: month, day })}
              >
                <span className="tabular-nums">{day}</span>
                <span className="text-xs tabular-nums">{dayEvents.length}</span>
              </button>
            )
          }

          return (
            <div key={day} className={cellClass}>
              <span className="tabular-nums">{day}</span>
              {has && !compact ? <span className="text-xs tabular-nums">{dayEvents.length}</span> : null}
            </div>
          )
        })}
      </div>
      {!compact && (
        <div className="mt-4 space-y-2">
          {Object.entries(eventsByDay).map(([day, evs]) =>
            evs.map((e) =>
              linkEvents ?
                <Link
                  key={e.id}
                  to={`/events/${e.id}`}
                  onClick={() => onEventClick?.(e)}
                  className="block text-sm text-dc-text-muted hover:text-dc-accent"
                >
                  {monthNames[month]} {day}: {e.title}
                </Link>
              : <p key={e.id} className="block text-sm text-dc-text-muted">
                  {monthNames[month]} {day}: {e.title}
                </p>,
            )
          )}
        </div>
      )}
      {compact && groupId && (
        <div className="mt-2">
          <Link to={`/groups/${groupId}?tab=Events`} className="text-xs text-dc-accent hover:underline">
            View events →
          </Link>
        </div>
      )}
    </div>
  )
}
