import { useEffect, useMemo, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { dayKeysInWindow } from '@/components/dancecard/organizer/organizerTimeline'
import { fromConventionDatetimeInput } from '@/lib/dancecard/eventWindowTime'
import { formatSessionTimeRange, humanTimezone } from '@/lib/play-space-program'

type Props = {
  timezone: string
  spaceStartsAt?: string | null
  spaceEndsAt?: string | null
  defaultDayKey?: string | null
  busy?: boolean
  onCancel: () => void
  onSave: (payload: {
    title: string
    startsAt: string
    endsAt: string
    location?: string
    description?: string
  }) => Promise<void>
}

function dayOptions(spaceStartsAt?: string | null, spaceEndsAt?: string | null, timezone?: string): string[] {
  if (!spaceStartsAt || !spaceEndsAt || !timezone) return []
  return dayKeysInWindow(spaceStartsAt, spaceEndsAt, timezone).slice(0, 31)
}

function formatDayOption(dayKey: string, timezone: string): string {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10))
  const noon = fromZonedTime(new Date(y, m - 1, d, 12, 0, 0, 0), timezone)
  return formatInTimeZone(noon, timezone, 'EEE, MMMM d')
}

export default function PlaySpaceProgramComposer({
  timezone,
  spaceStartsAt,
  spaceEndsAt,
  defaultDayKey,
  busy,
  onCancel,
  onSave,
}: Props) {
  const days = useMemo(
    () => dayOptions(spaceStartsAt, spaceEndsAt, timezone),
    [spaceStartsAt, spaceEndsAt, timezone],
  )
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(defaultDayKey || days[0] || '')
  const [startTime, setStartTime] = useState('14:00')
  const [endTime, setEndTime] = useState('15:00')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!day && days[0]) setDay(days[0])
  }, [day, days])

  const previewStarts = day && startTime ? fromConventionDatetimeInput(`${day}T${startTime}`, timezone) : null
  const previewEnds = day && endTime ? fromConventionDatetimeInput(`${day}T${endTime}`, timezone) : null

  async function submit() {
    setError(null)
    if (!title.trim()) {
      setError('Add a session title')
      return
    }
    if (!previewStarts || !previewEnds) {
      setError('Choose a date, start time, and end time')
      return
    }
    if (Date.parse(previewEnds) <= Date.parse(previewStarts)) {
      setError('End time must be after the start time')
      return
    }
    await onSave({
      title: title.trim(),
      startsAt: previewStarts,
      endsAt: previewEnds,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-dc-modal flex flex-col bg-dc-surface" role="dialog" aria-modal="true" aria-label="New session">
      <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-medium text-dc-text-muted">
          Cancel
        </button>
        <p className="text-sm font-semibold text-dc-text">New session</p>
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
        <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Session</p>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
            required
          />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Date</span>
          {days.length > 0 ? (
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDayOption(d, timezone)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
            />
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[14px] font-medium text-dc-text">Starts</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value)
                // Preserve 1h duration when start moves
                const [h, m] = e.target.value.split(':').map(Number)
                if (Number.isFinite(h) && Number.isFinite(m)) {
                  const endH = (h + 1) % 24
                  setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                }
              }}
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

        <p className="text-[13px] text-dc-muted">
          Times use {humanTimezone(timezone)}, the event’s timezone.
        </p>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Workshop Tent"
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-[15px] text-dc-text"
          />
        </label>

        {previewStarts && previewEnds && Date.parse(previewEnds) > Date.parse(previewStarts) ? (
          <div className="rounded-2xl border border-dc-border bg-dc-elevated p-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Preview</p>
            <p className="mt-2 text-[14px] text-dc-muted">
              {formatSessionTimeRange(previewStarts, previewEnds, timezone)}
            </p>
            <p className="mt-1 text-[17px] font-semibold text-dc-text">{title.trim() || 'Untitled session'}</p>
            {location.trim() ? <p className="mt-1 text-[14px] text-dc-text-muted">{location.trim()}</p> : null}
          </div>
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
