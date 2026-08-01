import { useMemo, useState } from 'react'
import {
  formatSlotDay,
  formatSlotTimeRange,
  groupSlotsByDay,
  timezoneLabel,
  type GuestTimeSlot,
} from '@/lib/guest-dancecard-share'

type Gap = { startsAt: string; endsAt: string }

export default function GuestShareWeekend({
  open,
  gaps,
  slots,
  timezone,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean
  gaps: Gap[]
  slots: GuestTimeSlot[]
  timezone: string
  selected: GuestTimeSlot | null
  onSelect: (slot: GuestTimeSlot) => void
  onClose: () => void
}) {
  const days = useMemo(() => groupSlotsByDay(slots, timezone), [slots, timezone])
  const [dayIdx, setDayIdx] = useState(0)
  const [expandedGap, setExpandedGap] = useState<string | null>(null)

  const active = days[Math.min(dayIdx, Math.max(days.length - 1, 0))]
  const gapsForDay = useMemo(() => {
    if (!active) return [] as Gap[]
    return gaps.filter((g) => {
      const key = new Date(g.startsAt).toLocaleDateString('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return key === active.dayKey
    })
  }, [active, gaps, timezone])

  if (!open) return null

  const tz = timezoneLabel(timezone)

  return (
    <div className="fixed inset-0 z-dc-modal flex flex-col bg-dc-surface" role="dialog" aria-modal="true" aria-label="Full weekend">
      <header className="flex items-center justify-between gap-2 border-b border-dc-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-medium text-dc-text-muted">
          ‹ Back
        </button>
        <p className="text-sm font-semibold text-dc-text">Full weekend</p>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-medium text-dc-accent">
          Done
        </button>
      </header>

      {days.length === 0 ? (
        <p className="p-6 text-sm text-dc-muted">No open times for this duration.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-dc-border px-3 py-2">
            {days.map((d, i) => (
              <button
                key={d.dayKey}
                type="button"
                onClick={() => {
                  setDayIdx(i)
                  setExpandedGap(null)
                }}
                className={`min-h-11 shrink-0 rounded-full border px-3 text-sm font-medium ${
                  i === dayIdx
                    ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                    : 'border-dc-border text-dc-text-muted'
                }`}
              >
                {formatSlotDay(d.slots[0].startsAt, timezone)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
            <p className="text-[17px] font-semibold text-dc-text">{active?.label}</p>
            <p className="mt-0.5 text-[13px] text-dc-muted">{tz}</p>

            <div className="mt-4 space-y-3">
              {gapsForDay.map((g) => {
                const key = `${g.startsAt}-${g.endsAt}`
                const gapSlots = (active?.slots ?? []).filter(
                  (s) => Date.parse(s.startsAt) >= Date.parse(g.startsAt) && Date.parse(s.endsAt) <= Date.parse(g.endsAt) + 1,
                )
                const open = expandedGap === key
                return (
                  <div key={key} className="rounded-2xl border border-dc-border bg-dc-elevated p-3">
                    <p className="text-[14px] font-medium text-dc-text">
                      Open {formatSlotTimeRange(g.startsAt, g.endsAt, timezone)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpandedGap(open ? null : key)}
                      className="mt-2 min-h-11 text-sm font-medium text-dc-accent"
                    >
                      {open ? 'Hide start times' : 'View available start times ›'}
                    </button>
                    {open ? (
                      <ul className="mt-3 space-y-2">
                        {gapSlots.map((slot) => {
                          const selectedNow =
                            selected?.startsAt === slot.startsAt && selected?.endsAt === slot.endsAt
                          return (
                            <li key={slot.startsAt}>
                              <button
                                type="button"
                                aria-pressed={selectedNow}
                                onClick={() => onSelect(slot)}
                                className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-3 text-left text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dc-elevated)] ${
                                  selectedNow
                                    ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] font-semibold text-dc-text'
                                    : 'border-dc-border bg-dc-elevated-muted text-dc-text-muted'
                                }`}
                              >
                                <span>{formatSlotTimeRange(slot.startsAt, slot.endsAt, timezone)}</span>
                                {selectedNow ? <span className="text-[13px] text-dc-accent">✓ Selected</span> : null}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
