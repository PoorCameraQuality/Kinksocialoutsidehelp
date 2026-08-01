import { useMemo, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { dayKeysInWindow } from '@/components/dancecard/organizer/organizerTimeline'
import { fromConventionDatetimeInput } from '@/lib/dancecard/eventWindowTime'
import { formatSessionTimeRange, humanTimezone } from '@/lib/play-space-program'
import type { BookingRequest } from '@/hooks/usePlaySpaceDancecard'

function formatDayOption(dayKey: string, timezone: string): string {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10))
  const noon = fromZonedTime(new Date(y, m - 1, d, 12, 0, 0, 0), timezone)
  return formatInTimeZone(noon, timezone, 'EEE, MMMM d')
}

export default function PlaySpaceChangeSceneTimeSheet({
  booking,
  timezone,
  spaceStartsAt,
  spaceEndsAt,
  counterpartLabel,
  busy,
  onCancel,
  onSave,
}: {
  booking: BookingRequest
  timezone: string
  spaceStartsAt?: string | null
  spaceEndsAt?: string | null
  counterpartLabel: string
  busy?: boolean
  onCancel: () => void
  onSave: (payload: { startsAt: string; endsAt: string; location?: string }) => Promise<void>
}) {
  const days = useMemo(() => {
    if (!spaceStartsAt || !spaceEndsAt) return []
    return dayKeysInWindow(spaceStartsAt, spaceEndsAt, timezone).slice(0, 31)
  }, [spaceStartsAt, spaceEndsAt, timezone])

  const [day, setDay] = useState(formatInTimeZone(new Date(booking.startsAt), timezone, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(
    formatInTimeZone(new Date(booking.startsAt), timezone, 'HH:mm'),
  )
  const [endTime, setEndTime] = useState(formatInTimeZone(new Date(booking.endsAt), timezone, 'HH:mm'))
  const [location, setLocation] = useState(booking.location?.trim() || '')
  const [error, setError] = useState<string | null>(null)

  const previewStarts = fromConventionDatetimeInput(`${day}T${startTime}`, timezone)
  const previewEnds = fromConventionDatetimeInput(`${day}T${endTime}`, timezone)

  async function submit() {
    setError(null)
    if (!previewStarts || !previewEnds) {
      setError('Choose a date, start time, and end time')
      return
    }
    if (Date.parse(previewEnds) <= Date.parse(previewStarts)) {
      setError('End time must be after the start time')
      return
    }
    await onSave({
      startsAt: previewStarts,
      endsAt: previewEnds,
      location: location.trim() || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-dc-modal flex flex-col bg-dc-surface"
      role="dialog"
      aria-modal="true"
      aria-label="Change time"
    >
      <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-medium text-dc-text-muted">
          Cancel
        </button>
        <p className="text-sm font-semibold text-dc-text">Change time</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="min-h-11 rounded-full bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-10">
        <p className="text-[15px] font-medium text-dc-text">Scene with {counterpartLabel}</p>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Date</span>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          >
            {(days.length ? days : [day]).map((d) => (
              <option key={d} value={d}>
                {formatDayOption(d, timezone)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[14px] font-medium text-dc-text">Starts</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
            />
          </label>
          <label className="block">
            <span className="text-[14px] font-medium text-dc-text">Ends</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
            />
          </label>
        </div>

        <p className="text-[13px] text-dc-muted">Event time · {humanTimezone(timezone)}</p>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          />
        </label>

        <p className="text-[13px] text-dc-muted">
          Saving updates the confirmed scene for both people. {counterpartLabel} will be notified when you
          save this change.
        </p>

        {previewStarts && previewEnds && Date.parse(previewEnds) > Date.parse(previewStarts) ? (
          <p className="text-[14px] text-dc-text">
            Preview: {formatSessionTimeRange(previewStarts, previewEnds, timezone)}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--dc-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
