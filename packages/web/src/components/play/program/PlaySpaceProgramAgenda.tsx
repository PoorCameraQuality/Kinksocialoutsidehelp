import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PlaySpaceProgramDayNav from './PlaySpaceProgramDayNav'
import PlaySpaceProgramSessionCard from './PlaySpaceProgramSessionCard'
import {
  buildProgramDays,
  defaultProgramDayKey,
  formatProgramTime,
  groupByStartTime,
  humanTimezone,
  partitionDaySessions,
  type ProgramSession,
} from '@/lib/play-space-program'

function AgendaBody({
  parts,
  timezone,
  dayLabel,
  showEarlier,
  setShowEarlier,
  busySlotId,
  onAdd,
  onRemove,
}: {
  parts: ReturnType<typeof partitionDaySessions>
  timezone: string
  dayLabel: string
  showEarlier: boolean
  setShowEarlier: (v: boolean | ((p: boolean) => boolean)) => void
  busySlotId?: string | null
  onAdd: (slotId: string) => void
  onRemove: (slotId: string) => void
}) {
  return (
    <div className="space-y-6">
      <p className="text-[17px] font-semibold text-dc-text">{dayLabel}</p>

      {parts.earlier.length > 0 ? (
        <div>
          <button
            type="button"
            aria-expanded={showEarlier}
            onClick={() => setShowEarlier((v) => !v)}
            className="min-h-11 text-sm font-medium text-dc-muted"
          >
            Earlier today · {parts.earlier.length} session{parts.earlier.length === 1 ? '' : 's'}
          </button>
          {showEarlier ? (
            <div className="mt-2 space-y-4 opacity-70">
              {groupByStartTime(parts.earlier).map((g) => (
                <div key={g.startIso}>
                  <p className="mb-1.5 text-[13px] font-medium text-dc-muted">
                    {formatProgramTime(g.startIso, timezone)}
                  </p>
                  <div className="space-y-2">
                    {g.sessions.map((s) => (
                      <PlaySpaceProgramSessionCard
                        key={s.id}
                        session={s}
                        timezone={timezone}
                        hideTime
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {parts.happeningNow.length > 0 ? (
        <section>
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Happening now</p>
          <div className="mt-2 space-y-2">
            {parts.happeningNow.map((s) => (
              <PlaySpaceProgramSessionCard
                key={s.id}
                session={s}
                timezone={timezone}
                variant="now"
                busy={busySlotId === s.id}
                onAdd={() => onAdd(s.id)}
                onRemove={() => onRemove(s.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {parts.upNext.length > 0 ? (
        <section>
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Up next</p>
          <div className="mt-2 space-y-4">
            {groupByStartTime(parts.upNext).map((g) => (
              <div key={g.startIso}>
                <p className="mb-1.5 text-[14px] font-medium text-dc-text">
                  {formatProgramTime(g.startIso, timezone)}
                </p>
                <div className="space-y-2">
                  {g.sessions.map((s) => (
                    <PlaySpaceProgramSessionCard
                      key={s.id}
                      session={s}
                      timezone={timezone}
                      hideTime
                      busy={busySlotId === s.id}
                      onAdd={() => onAdd(s.id)}
                      onRemove={() => onRemove(s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : parts.happeningNow.length > 0 && parts.later.length === 0 ? (
        <p className="text-[14px] text-dc-muted">Nothing else scheduled today.</p>
      ) : null}

      {parts.later.length > 0 ? (
        <section>
          <p className="text-[12px] font-medium uppercase tracking-wide text-dc-muted">Later today</p>
          <div className="mt-2 space-y-4">
            {groupByStartTime(parts.later).map((g) => (
              <div key={g.startIso}>
                <p className="mb-1.5 text-[14px] font-medium text-dc-text">
                  {formatProgramTime(g.startIso, timezone)}
                </p>
                <div className="space-y-2">
                  {g.sessions.map((s) => (
                    <PlaySpaceProgramSessionCard
                      key={s.id}
                      session={s}
                      timezone={timezone}
                      hideTime
                      busy={busySlotId === s.id}
                      onAdd={() => onAdd(s.id)}
                      onRemove={() => onRemove(s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {parts.happeningNow.length === 0 &&
      parts.upNext.length === 0 &&
      parts.later.length === 0 &&
      parts.earlier.length > 0 ? (
        <p className="text-[14px] text-dc-muted">Nothing else scheduled today.</p>
      ) : null}

      <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-[13px] text-dc-muted">
        End of {dayLabel.split(',')[0]}’s program
      </p>
    </div>
  )
}

export default function PlaySpaceProgramAgenda({
  sessions,
  timezone,
  canEdit,
  manageHref,
  busySlotId,
  onAdd,
  onRemove,
  liveTickMs = 60_000,
}: {
  sessions: ProgramSession[]
  timezone: string
  canEdit?: boolean
  manageHref?: string
  busySlotId?: string | null
  onAdd: (slotId: string) => void
  onRemove: (slotId: string) => void
  liveTickMs?: number
}) {
  const [now, setNow] = useState(() => new Date())
  const [showEarlier, setShowEarlier] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), liveTickMs)
    return () => window.clearInterval(id)
  }, [liveTickMs])

  const days = useMemo(() => buildProgramDays(sessions, timezone, now), [sessions, timezone, now])

  useEffect(() => {
    if (selectedDay && days.some((d) => d.dayKey === selectedDay)) return
    setSelectedDay(defaultProgramDayKey(days, timezone, now))
  }, [days, timezone, now, selectedDay])

  const active = days.find((d) => d.dayKey === selectedDay) ?? days[0]
  const parts = useMemo(
    () => (active ? partitionDaySessions(active.sessions, now) : null),
    [active, now],
  )
  const tzLabel = humanTimezone(timezone)

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[20px] font-semibold text-dc-text">Program</h2>
        <p className="mt-0.5 text-[14px] text-dc-muted">Official schedule for this Play Space</p>
      </div>
      {canEdit && manageHref ? (
        <Link
          to={manageHref}
          className="inline-flex min-h-11 items-center rounded-full border border-dc-border px-4 text-sm font-medium text-dc-accent"
        >
          Manage
        </Link>
      ) : null}
    </header>
  )

  if (sessions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[760px]">
        {header}
        <div className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated px-4 py-6">
          {canEdit ? (
            <>
              <p className="text-[17px] font-semibold text-dc-text">Build your event program</p>
              <p className="mt-1 text-[14px] text-dc-text-muted">
                Add classes, meals, dungeon hours, gatherings, and other official activities.
              </p>
              {manageHref ? (
                <Link
                  to={manageHref}
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground"
                >
                  Add the first session
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold text-dc-text">The program is not posted yet</p>
              <p className="mt-1 text-[14px] text-dc-text-muted">
                The host has not published the official schedule. Check back closer to the event.
              </p>
              <p className="mt-3 text-[13px] text-dc-muted">
                Your availability and reservations still work while the program is being prepared.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[980px] min-w-0">
      {header}

      <div className="mt-4 lg:flex lg:gap-8">
        <PlaySpaceProgramDayNav
          days={days}
          selectedKey={selectedDay}
          onSelect={setSelectedDay}
          variant="rail"
        />

        <div className="min-w-0 flex-1 lg:max-w-[760px]">
          <PlaySpaceProgramDayNav days={days} selectedKey={selectedDay} onSelect={setSelectedDay} />

          <p className="mt-1 text-[13px] text-dc-muted">Times shown in event time · {tzLabel}</p>
          <p className="mt-0.5 text-[12px] text-dc-muted">The host may continue updating this program.</p>

          {active && parts ? (
            <div className="mt-5">
              <AgendaBody
                parts={parts}
                timezone={timezone}
                dayLabel={active.label}
                showEarlier={showEarlier}
                setShowEarlier={setShowEarlier}
                busySlotId={busySlotId}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
