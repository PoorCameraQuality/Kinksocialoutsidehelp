/**
 * Last-online indicator for mini People cards.
 *
 * Public text labels (no identity inference like gender/pronouns).
 *
 * Timing model (approx):
 * - Recently: last online within the past week
 * - Sometime ago: more than a month ago (we use >7d for the catch-all window)
 * - Six months +: at/after ~6 months
 * - Inactive: at/after ~12 months, just before they get hidden from public
 * - Hidden: at/after 1 year (handled server-side by filtering public people)
 */

export type LastOnlineLabel = 'Recently' | 'Sometime ago' | 'Six months +' | 'Inactive'

export type LastOnlineResult = { label: LastOnlineLabel | null; hidden: boolean }

const MS_DAY = 24 * 60 * 60 * 1000
const ONE_YEAR_MS = 365 * MS_DAY
const SIX_MONTHS_MS = 180 * MS_DAY
const MONTH_MS = 30 * MS_DAY
const WEEK_MS = 7 * MS_DAY

export function activityIndicatorFromISO(iso: string | null | undefined): LastOnlineResult {
  if (!iso) return { label: null, hidden: false }
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return { label: null, hidden: false }

  const diff = Date.now() - t

  // Public hiding happens server-side, but we keep UI logic consistent.
  if (diff >= ONE_YEAR_MS) return { label: null, hidden: true }

  if (diff <= WEEK_MS) return { label: 'Recently', hidden: false }

  if (diff >= SIX_MONTHS_MS) {
    // month 12 before hidden: Inactive (we treat the last ~month prior to hide)
    const inactiveWindowStart = 360 * MS_DAY
    if (diff >= inactiveWindowStart) return { label: 'Inactive', hidden: false }
    return { label: 'Six months +', hidden: false }
  }

  // > week and < six months: the spec says "Sometime ago for more than a month"
  // For the (week..month) gap, we still show Sometime ago to keep the UI simple.
  if (diff > MONTH_MS) return { label: 'Sometime ago', hidden: false }
  return { label: 'Sometime ago', hidden: false }
}

