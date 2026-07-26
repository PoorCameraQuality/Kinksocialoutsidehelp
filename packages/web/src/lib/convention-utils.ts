/** True when the span crosses a calendar day boundary or runs at least 48 hours. */
export function isMultiDayConventionSpan(startsAt: string | null | undefined, endsAt: string | null | undefined): boolean {
  if (!startsAt || !endsAt) return false
  const a = new Date(startsAt)
  const b = new Date(endsAt)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false
  if (b.getTime() - a.getTime() >= 48 * 60 * 60 * 1000) return true
  return a.toDateString() !== b.toDateString()
}

export type ConventionKind = 'convention' | 'hotel_takeover'

export function formatConventionDateRange(startsAt: string | null | undefined, endsAt: string | null | undefined): string {
  if (!startsAt || !endsAt) return ''
  const a = new Date(startsAt)
  const b = new Date(endsAt)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`
}
