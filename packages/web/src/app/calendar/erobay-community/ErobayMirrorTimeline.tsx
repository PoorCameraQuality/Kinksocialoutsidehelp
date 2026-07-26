import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'
import { slotsGroupedByDay } from '@/components/conventions/convention-schedule-utils'

function formatRange(startIso: string, endIso: string, timeZone: string): string {
  const a = new Date(startIso)
  const b = new Date(endIso)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const o = { hour: 'numeric' as const, minute: '2-digit' as const, timeZone }
  return `${a.toLocaleTimeString([], o)}–${b.toLocaleTimeString([], o)}`
}

function trackPillClass(label: string | null | undefined): string {
  const t = (label ?? '').toLowerCase()
  if (t.includes('play')) return 'bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/25'
  if (t.includes('class') || t.includes('education')) return 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25'
  if (t.includes('munch')) return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25'
  if (t.includes('market') || t.includes('fair')) return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/25'
  if (t.includes('social')) return 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/25'
  if (t.includes('meeting')) return 'bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/25'
  return 'bg-white/[0.06] text-dc-text-muted ring-1 ring-white/10'
}

type ErobayMirrorTimelineProps = {
  slots: ScheduleSlot[]
  timeZone: string
  sourceUrl: string
  onSelectSlot?: (slot: ScheduleSlot) => void
  activeSlotId?: string | null
}

export default function ErobayMirrorTimeline({ slots, timeZone, sourceUrl, onSelectSlot, activeSlotId }: ErobayMirrorTimelineProps) {
  const byDay = slotsGroupedByDay(slots, timeZone)

  if (byDay.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-dc-border bg-dc-elevated/95/40 px-4 py-10 text-center text-sm text-dc-muted">
        No events match your filters.
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {byDay.map(({ day, items }) => (
        <section key={day} aria-labelledby={`erobay-day-${encodeURIComponent(day)}`} className="scroll-mt-24">
          <div className="sticky top-0 z-[2] -mx-1 mb-3 border-b border-white/[0.08] bg-dc-elevated-solid/90 px-1 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-dc-elevated-solid/75">
            <h2 id={`erobay-day-${encodeURIComponent(day)}`} className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
              {day}
            </h2>
          </div>
          <ol className="space-y-2">
            {items.map((slot) => {
              const active = activeSlotId === slot.id
              const when = formatRange(slot.startsAt, slot.endsAt, timeZone)
              return (
                <li key={slot.id} id={`erobay-slot-${slot.id}`}>
                  <div
                    className={`rounded-2xl border transition-[border-color,box-shadow,background-color] motion-safe:duration-200 ${
                      active ?
                        'border-dc-accent/45 bg-dc-accent/[0.07] shadow-sm'
                      : 'border-white/[0.07] bg-dc-elevated/95 hover:border-white/[0.12] hover:bg-dc-elevated/95'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSlot?.(slot)}
                      className="flex w-full min-h-[3.25rem] flex-col gap-2 px-4 py-3 text-left sm:grid sm:min-h-0 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4 sm:py-4"
                    >
                      <div className="shrink-0">
                        <p className="text-xs font-semibold tabular-nums text-dc-accent">{when}</p>
                        <span className="sr-only">Select to highlight this day in the month view.</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {slot.trackLabel?.trim() ?
                            <span className={`inline-flex max-w-full rounded-md px-2 py-0.5 text-[11px] font-medium ${trackPillClass(slot.trackLabel)}`}>
                              {slot.trackLabel.trim()}
                            </span>
                          : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-snug text-dc-text">{slot.title}</p>
                        {slot.location?.trim() ?
                          <p className="mt-1 text-xs text-dc-text-muted">{slot.location.trim()}</p>
                        : null}
                      </div>
                    </button>
                    <div className="flex flex-col gap-2 border-t border-white/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={slot.linkUrl ?? sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-dc-accent px-3.5 text-sm font-medium text-dc-text shadow-sm transition-[background-color,transform] motion-safe:duration-150 hover:opacity-95 motion-safe:hover:-translate-y-px motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
                      >
                        Open on Erobay
                      </a>
                      {slot.description?.trim() ?
                        <p className="min-w-0 text-xs leading-relaxed text-dc-muted line-clamp-3 sm:line-clamp-none">
                          {slot.description.trim()}
                        </p>
                      : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
