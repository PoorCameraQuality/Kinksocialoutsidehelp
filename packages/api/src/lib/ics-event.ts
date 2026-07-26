function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function buildEventIcsCalendar(opts: {
  uid: string
  title: string
  description?: string | null
  startsAt: Date
  endsAt?: Date | null
  eventPageUrl: string
  /** Full venue address when viewer is allowed to see it (optional). */
  location?: string | null
}): string {
  const start = opts.startsAt
  const end =
    opts.endsAt && !Number.isNaN(opts.endsAt.getTime()) ?
      opts.endsAt
    : new Date(start.getTime() + 60 * 60 * 1000)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//C2K//Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
  ]
  if (opts.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(opts.description.trim())}`)
  }
  if (opts.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(opts.location.trim())}`)
  }
  lines.push(`URL:${opts.eventPageUrl}`, 'END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export type ProgramIcsEventRow = {
  uid: string
  title: string
  description?: string | null
  startsAt: Date
  endsAt: Date
  location?: string | null
  url?: string | null
}

/** Multi-VEVENT calendar (convention program, dancecard, etc.). */
export function buildProgramIcsCalendar(events: ProgramIcsEventRow[], prodId = '-//C2K//ConventionProgram//EN'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const ev of events) {
    const end =
      ev.endsAt && !Number.isNaN(ev.endsAt.getTime()) ? ev.endsAt : new Date(ev.startsAt.getTime() + 60 * 60 * 1000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART:${toIcsUtc(ev.startsAt)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(ev.title)}`
    )
    if (ev.description?.trim()) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description.trim())}`)
    }
    if (ev.location?.trim()) {
      lines.push(`LOCATION:${escapeIcsText(ev.location.trim())}`)
    }
    if (ev.url?.trim()) {
      lines.push(`URL:${ev.url.trim()}`)
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
