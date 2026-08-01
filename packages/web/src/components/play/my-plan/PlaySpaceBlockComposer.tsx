import { useEffect, useMemo, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { dayKeysInWindow } from '@/components/dancecard/organizer/organizerTimeline'
import { fromConventionDatetimeInput } from '@/lib/dancecard/eventWindowTime'
import { formatSessionTimeRange, humanTimezone } from '@/lib/play-space-program'
import type { PlanItem } from '@/lib/play-space-my-plan'

const PRESETS = ['Lunch', 'Dinner', 'Sleep', 'Rest', 'Travel', 'Custom'] as const

type Props = {
  timezone: string
  spaceStartsAt?: string | null
  spaceEndsAt?: string | null
  defaultDayKey?: string | null
  initial?: PlanItem | null
  busy?: boolean
  onCancel: () => void
  onSave: (payload: {
    title: string
    startsAt: string
    endsAt: string
    repeatDayKeys?: string[]
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

function isoToDayTime(iso: string, timezone: string): { day: string; time: string } {
  return {
    day: formatInTimeZone(new Date(iso), timezone, 'yyyy-MM-dd'),
    time: formatInTimeZone(new Date(iso), timezone, 'HH:mm'),
  }
}

export default function PlaySpaceBlockComposer({
  timezone,
  spaceStartsAt,
  spaceEndsAt,
  defaultDayKey,
  initial,
  busy,
  onCancel,
  onSave,
}: Props) {
  const days = useMemo(
    () => dayOptions(spaceStartsAt, spaceEndsAt, timezone),
    [spaceStartsAt, spaceEndsAt, timezone],
  )
  const initialParts = initial ? isoToDayTime(initial.startsAt, timezone) : null
  const initialEnd = initial ? isoToDayTime(initial.endsAt, timezone) : null

  const [preset, setPreset] = useState<string | null>(initial ? 'Custom' : null)
  const [title, setTitle] = useState(initial?.title?.trim() || '')
  const [day, setDay] = useState(initialParts?.day || defaultDayKey || days[0] || '')
  const [endDay, setEndDay] = useState(initialEnd?.day || initialParts?.day || defaultDayKey || days[0] || '')
  const [startTime, setStartTime] = useState(initialParts?.time || '12:00')
  const [endTime, setEndTime] = useState(initialEnd?.time || '13:00')
  const [repeat, setRepeat] = useState(false)
  const [repeatDays, setRepeatDays] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!day && days[0]) setDay(days[0])
    if (!endDay && days[0]) setEndDay(days[0])
  }, [day, endDay, days])

  const previewStarts = day && startTime ? fromConventionDatetimeInput(`${day}T${startTime}`, timezone) : null
  const previewEnds =
    endDay && endTime ? fromConventionDatetimeInput(`${endDay}T${endTime}`, timezone) : null

  function applyPreset(label: string) {
    setPreset(label)
    if (label !== 'Custom') setTitle(label)
    if (label === 'Lunch') {
      setStartTime('12:00')
      setEndTime('13:00')
      setEndDay(day)
    } else if (label === 'Dinner') {
      setStartTime('18:00')
      setEndTime('19:00')
      setEndDay(day)
    } else if (label === 'Sleep') {
      setStartTime('23:30')
      setEndTime('08:30')
      const idx = days.indexOf(day)
      setEndDay(days[Math.min(idx + 1, days.length - 1)] || day)
    } else if (label === 'Rest') {
      setStartTime('14:00')
      setEndTime('15:00')
      setEndDay(day)
    } else if (label === 'Travel') {
      setStartTime('10:00')
      setEndTime('11:00')
      setEndDay(day)
    }
  }

  async function submit() {
    setError(null)
    const finalTitle = title.trim() || 'Busy'
    if (!previewStarts || !previewEnds) {
      setError('Choose a date, start time, and end time')
      return
    }
    if (Date.parse(previewEnds) <= Date.parse(previewStarts)) {
      setError('End time must be after the start time')
      return
    }
    const selected = repeat ? (repeatDays.length ? repeatDays : [day]) : undefined
    if (repeat && (!selected || selected.length === 0)) {
      setError('Select at least one day to repeat')
      return
    }
    await onSave({
      title: finalTitle,
      startsAt: previewStarts,
      endsAt: previewEnds,
      repeatDayKeys: initial ? undefined : selected,
    })
  }

  const repeatCount = repeat ? (repeatDays.length || 0) : 0

  return (
    <div
      className="fixed inset-0 z-dc-modal flex flex-col bg-dc-surface"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? 'Edit block' : 'Block time'}
    >
      <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-medium text-dc-text-muted">
          Cancel
        </button>
        <p className="text-sm font-semibold text-dc-text">{initial ? 'Edit block' : 'Block time'}</p>
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
        <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">What is this time for?</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`min-h-11 rounded-full border px-3.5 text-sm font-medium ${
                preset === p
                  ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] text-dc-text'
                  : 'border-dc-border bg-dc-elevated text-dc-text-muted'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Title</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setPreset('Custom')
            }}
            placeholder="Busy"
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">Date</span>
          <select
            value={day}
            onChange={(e) => {
              setDay(e.target.value)
              if (endDay < e.target.value) setEndDay(e.target.value)
            }}
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          >
            {(days.length ? days : [day].filter(Boolean)).map((d) => (
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
              onChange={(e) => {
                setStartTime(e.target.value)
                const [h, m] = e.target.value.split(':').map(Number)
                if (Number.isFinite(h) && Number.isFinite(m) && endDay === day) {
                  setEndTime(`${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
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

        <label className="block">
          <span className="text-[14px] font-medium text-dc-text">End date</span>
          <select
            value={endDay}
            onChange={(e) => setEndDay(e.target.value)}
            className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
          >
            {(days.length ? days : [endDay].filter(Boolean)).map((d) => (
              <option key={d} value={d}>
                {formatDayOption(d, timezone)}
              </option>
            ))}
          </select>
        </label>

        <p className="text-[13px] text-dc-muted">Event time · {humanTimezone(timezone)}</p>

        {!initial ? (
          <div className="space-y-2">
            <label className="flex min-h-11 items-center gap-2 text-sm text-dc-text">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => {
                  setRepeat(e.target.checked)
                  if (e.target.checked && day) setRepeatDays([day])
                }}
                className="h-4 w-4 rounded border-dc-border"
              />
              Repeat on selected event days
            </label>
            {repeat ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {days.map((d) => {
                    const selected = repeatDays.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setRepeatDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                          )
                        }
                        className={`min-h-11 rounded-full border px-3 text-sm ${
                          selected
                            ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_12%,var(--dc-elevated))] font-semibold text-dc-text'
                            : 'border-dc-border text-dc-text-muted'
                        }`}
                      >
                        {formatDayOption(d, timezone).split(',')[0]}
                      </button>
                    )
                  })}
                </div>
                {repeatCount > 0 ? (
                  <p className="text-[13px] text-dc-muted">This will add {repeatCount} block{repeatCount === 1 ? '' : 's'}.</p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {previewStarts && previewEnds && Date.parse(previewEnds) > Date.parse(previewStarts) ? (
          <div className="rounded-2xl border border-dc-border bg-dc-elevated p-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Preview</p>
            <p className="mt-2 text-[17px] font-semibold text-dc-text">{title.trim() || 'Busy'}</p>
            <p className="mt-1 text-[14px] text-dc-muted">
              {formatSessionTimeRange(previewStarts, previewEnds, timezone)}
            </p>
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
