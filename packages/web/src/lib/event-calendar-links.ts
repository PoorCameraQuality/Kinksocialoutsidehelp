function toGoogleCalendarUtc(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function buildGoogleCalendarUrl(opts: {
  title: string
  startsAt: string
  endsAt?: string | null
  description?: string | null
  location?: string | null
  eventPageUrl?: string | null
}): string {
  const start = toGoogleCalendarUtc(opts.startsAt)
  if (!start) return ''
  const endSource =
    opts.endsAt ?
      new Date(opts.endsAt)
    : new Date(new Date(opts.startsAt).getTime() + 60 * 60 * 1000)
  const end = toGoogleCalendarUtc(endSource.toISOString())
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${start}/${end}`,
  })
  const details = [opts.description?.trim(), opts.eventPageUrl?.trim()].filter(Boolean).join('\n\n')
  if (details) params.set('details', details)
  if (opts.location?.trim()) params.set('location', opts.location.trim())
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Apple Calendar / Outlook subscribe URL (same .ics endpoint, webcal scheme). */
export function buildWebcalSubscribeUrl(eventId: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  const httpsUrl = `${base}/api/v1/events/${encodeURIComponent(eventId)}/calendar.ics`
  return httpsUrl.replace(/^https:/i, 'webcal:')
}

export function buildEventIcsDownloadUrl(eventId: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}/api/v1/events/${encodeURIComponent(eventId)}/calendar.ics`
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/** Single-event .ics body for Apple Calendar / Outlook / Google import. */
export function buildSingleEventIcs(opts: {
  uid: string
  title: string
  startsAt: string
  endsAt: string
  description?: string | null
  location?: string | null
  url?: string | null
}): string {
  const start = toIcsUtc(opts.startsAt)
  const end = toIcsUtc(opts.endsAt) || start
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kink Social//Dancecard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
  ]
  if (opts.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(opts.description.trim())}`)
  }
  if (opts.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(opts.location.trim())}`)
  }
  if (opts.url?.trim()) {
    lines.push(`URL:${opts.url.trim()}`)
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcsFile(filename: string, icsBody: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
