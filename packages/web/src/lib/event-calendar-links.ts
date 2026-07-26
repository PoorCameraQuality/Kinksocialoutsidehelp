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
