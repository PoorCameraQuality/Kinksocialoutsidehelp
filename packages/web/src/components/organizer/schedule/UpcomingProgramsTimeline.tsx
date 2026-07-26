import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import {
  formatProgramVisibility,
  formatProgramWhen,
  type OrgProgramRow,
} from '@/lib/organizer/org-schedule-programs'
import { ScheduleSection } from '@/components/organizer/schedule/schedule-ui'

type Props = {
  upcoming: OrgProgramRow[]
  orgSlug: string
  programsAnchorId?: string
}

function dateBlock(startsAt?: string | null) {
  if (!startsAt) {
    return (
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dc-border bg-dc-surface/60 text-dc-muted">
        <span className="text-xs font-medium">TBD</span>
      </div>
    )
  }
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) {
    return (
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dc-border bg-dc-surface/60 text-dc-muted">
        <span className="text-xs font-medium">TBD</span>
      </div>
    )
  }
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dc-accent/30 bg-dc-accent/10 text-dc-accent">
      <span className="text-[10px] font-semibold uppercase">{d.toLocaleString(undefined, { month: 'short' })}</span>
      <span className="text-lg font-bold leading-none">{d.getDate()}</span>
    </div>
  )
}

export default function UpcomingProgramsTimeline({ upcoming, orgSlug, programsAnchorId }: Props) {
  const orgBase = `/organizer/orgs/${encodeURIComponent(orgSlug)}`

  return (
    <ScheduleSection>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-dc-text">Upcoming programs</h3>
        {programsAnchorId ?
          <a href={`#${programsAnchorId}`} className="text-dc-micro text-dc-accent hover:underline">
            View all →
          </a>
        : null}
      </div>
      {upcoming.length === 0 ?
        <p className="mt-3 text-sm text-dc-text-muted">
          Upcoming programs will appear here once you create events or conventions.
        </p>
      : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((row) => {
            const manageHref =
              row.kind === 'convention' ?
                `${orgBase}/conventions/${encodeURIComponent(row.slugOrId)}?tab=program`
              : `${orgBase}/events/${encodeURIComponent(row.slugOrId)}`
            return (
              <li
                key={row.id}
                className="flex gap-3 rounded-xl border border-dc-border bg-dc-surface/30 p-3"
              >
                {dateBlock(row.startsAt)}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.kind === 'convention' ? 'accent' : 'neutral'}>
                      {row.kind === 'convention' ? 'Convention' : 'Event'}
                    </Badge>
                    <Badge variant="accent">{row.statusLabel}</Badge>
                  </div>
                  <p className="mt-1 font-medium text-dc-text">{row.title}</p>
                  <p className="text-dc-micro text-dc-text-muted">{formatProgramWhen(row.startsAt, row.endsAt)}</p>
                  {row.location ?
                    <p className="text-dc-micro text-dc-muted">{row.location}</p>
                  : null}
                  {row.kind === 'event' && row.visibility ?
                    <p className="text-dc-micro text-dc-muted">{formatProgramVisibility(row.visibility)}</p>
                  : null}
                  <Link
                    to={manageHref}
                    className="mt-2 inline-block text-sm font-medium text-dc-accent hover:underline"
                  >
                    Manage →
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </ScheduleSection>
  )
}
