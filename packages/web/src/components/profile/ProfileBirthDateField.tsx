import { useEffect, useId, useMemo, useState } from 'react'
import { profileBirthDateInputBounds, toIsoDateOnly } from '@c2k/shared'
import { premiumInputClass } from '@/lib/card-surface'
import { cn } from '@/lib/cn'

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const

function parseIsoParts(value: string): { year: string; month: string; day: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return { year: '', month: '', day: '' }
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function composeIso(year: string, month: string, day: string): string | null {
  if (!year || !month || !day) return null
  const y = Number(year)
  const mo = Number(month)
  const d = Number(day)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return toIsoDateOnly(new Date(y, mo - 1, d))
}

function isWithinBounds(iso: string, bounds: { min: string; max: string }): boolean {
  return iso >= bounds.min && iso <= bounds.max
}

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  bounds?: { min: string; max: string }
  disabled?: boolean
  className?: string
  'aria-describedby'?: string
}

const selectClass = cn(
  'min-h-11 w-full rounded-xl border border-dc-border bg-[var(--dc-input)] px-2 py-2.5 text-base text-dc-text [color-scheme:dark] sm:text-sm',
  'focus:border-dc-accent focus:outline-none focus:ring-1 focus:ring-dc-accent',
  'disabled:cursor-not-allowed disabled:opacity-60',
  premiumInputClass,
)

/**
 * Mobile-friendly birth date control (month / day / year selects).
 * Avoids native `type="date"` picker issues on touch browsers.
 */
export default function ProfileBirthDateField({
  id: idProp,
  value,
  onChange,
  bounds: boundsProp,
  disabled = false,
  className,
  'aria-describedby': ariaDescribedBy,
}: Props) {
  const generatedId = useId()
  const baseId = idProp ?? generatedId
  const bounds = useMemo(() => boundsProp ?? profileBirthDateInputBounds(), [boundsProp])
  const minYear = Number(bounds.min.slice(0, 4))
  const maxYear = Number(bounds.max.slice(0, 4))

  const parsed = parseIsoParts(value)
  const [month, setMonth] = useState(parsed.month)
  const [day, setDay] = useState(parsed.day)
  const [year, setYear] = useState(parsed.year)

  useEffect(() => {
    const next = parseIsoParts(value)
    setMonth(next.month)
    setDay(next.day)
    setYear(next.year)
  }, [value])

  const years = useMemo(() => {
    const items: string[] = []
    for (let y = maxYear; y >= minYear; y -= 1) items.push(String(y))
    return items
  }, [minYear, maxYear])

  const maxDay = useMemo(() => {
    const y = Number(year)
    const mo = Number(month)
    if (!year || !month || !Number.isFinite(y) || !Number.isFinite(mo)) return 31
    return daysInMonth(y, mo)
  }, [year, month])

  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => String(i + 1)), [maxDay])

  const emitChange = (nextYear: string, nextMonth: string, nextDay: string) => {
    const iso = composeIso(nextYear, nextMonth, nextDay)
    if (!iso) {
      onChange('')
      return
    }
    if (!isWithinBounds(iso, bounds)) {
      onChange('')
      return
    }
    onChange(iso)
  }

  const handleMonth = (nextMonth: string) => {
    setMonth(nextMonth)
    let nextDay = day
    if (day && Number(day) > maxDay) nextDay = String(maxDay)
    if (nextDay !== day) setDay(nextDay)
    emitChange(year, nextMonth, nextDay)
  }

  const handleDay = (nextDay: string) => {
    setDay(nextDay)
    emitChange(year, month, nextDay)
  }

  const handleYear = (nextYear: string) => {
    setYear(nextYear)
    let nextDay = day
    const y = Number(nextYear)
    const mo = Number(month)
    if (nextDay && Number.isFinite(y) && Number.isFinite(mo)) {
      const dim = daysInMonth(y, mo)
      if (Number(nextDay) > dim) nextDay = String(dim)
      if (nextDay !== day) setDay(nextDay)
    }
    emitChange(nextYear, month, nextDay)
  }

  return (
    <div
      id={baseId}
      role="group"
      aria-label="Date of birth"
      aria-describedby={ariaDescribedBy}
      className={cn('grid grid-cols-3 gap-2', className)}
    >
      <div>
        <label htmlFor={`${baseId}-month`} className="sr-only">
          Birth month
        </label>
        <select
          id={`${baseId}-month`}
          value={month}
          disabled={disabled}
          onChange={(e) => handleMonth(e.target.value)}
          className={selectClass}
        >
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${baseId}-day`} className="sr-only">
          Birth day
        </label>
        <select
          id={`${baseId}-day`}
          value={day}
          disabled={disabled}
          onChange={(e) => handleDay(e.target.value)}
          className={selectClass}
        >
          <option value="">Day</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${baseId}-year`} className="sr-only">
          Birth year
        </label>
        <select
          id={`${baseId}-year`}
          value={year}
          disabled={disabled}
          onChange={(e) => handleYear(e.target.value)}
          className={selectClass}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
