import { Link } from 'react-router-dom'
import { useApiStaffProfile, type StaffProfileDuty } from '@/hooks/useApiStaffProfile'

type TimelineEntry = StaffProfileDuty & { kind: 'duty' | 'slot' | 'volunteer' }

function buildTimeline(profile: NonNullable<ReturnType<typeof useApiStaffProfile>['profile']>): TimelineEntry[] {
  const rows: TimelineEntry[] = [
    ...profile.staffDuties.map((r) => ({ ...r, kind: 'duty' as const })),
    ...profile.slotStaff.map((r) => ({ ...r, kind: 'slot' as const })),
    ...profile.volunteerShifts.map((r) => ({ ...r, kind: 'volunteer' as const })),
  ]
  return rows.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
}

function entryLabel(row: TimelineEntry): string {
  if (row.kind === 'volunteer') return row.title ?? row.role ?? 'Volunteer shift'
  if (row.kind === 'slot') return row.slotTitle ?? row.roleLabel ?? 'Program staff'
  return row.roleLabel ?? 'Staff duty'
}

export default function SettingsStaffSection({ enabled }: { enabled: boolean }) {
  const { status, profile, error, reload } = useApiStaffProfile(enabled)

  if (!enabled) return null

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/50 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Your event participation</h2>
        <p className="mt-1 text-sm text-dc-muted">
          Organizations, staff duties, program assignments, and volunteer shifts tied to your account.
        </p>
      </div>

      {status === 'loading' || status === 'idle' ?
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" aria-busy="true" />
      : null}

      {error ?
        <div className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text hover:bg-dc-elevated-muted"
          >
            Retry
          </button>
        </div>
      : null}

      {status === 'ready' && profile ?
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-1 text-dc-muted">
              {profile.summary.organizationCount} org{profile.summary.organizationCount === 1 ? '' : 's'}
            </span>
            <span className="rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-1 text-dc-muted">
              {profile.summary.staffDutyCount} staff assignment
              {profile.summary.staffDutyCount === 1 ? '' : 's'}
            </span>
            <span className="rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-1 text-dc-muted">
              {profile.summary.volunteerShiftCount} volunteer shift
              {profile.summary.volunteerShiftCount === 1 ? '' : 's'}
            </span>
            {profile.summary.upcomingAssignments > 0 ?
              <span className="rounded-full border border-dc-accent-border/40 bg-dc-accent-muted px-2.5 py-1 text-dc-accent">
                {profile.summary.upcomingAssignments} upcoming
              </span>
            : null}
          </div>

          {profile.organizations.length > 0 ?
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Organizations</h3>
              <ul className="mt-2 space-y-2">
                {profile.organizations.map((o) => (
                  <li key={o.organizationId}>
                    <Link
                      to={`/orgs/${encodeURIComponent(o.organizationSlug)}`}
                      className="text-sm font-medium text-dc-accent hover:underline"
                    >
                      {o.organizationName}
                    </Link>
                    <span className="ml-2 text-xs text-dc-muted">{o.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          : null}

          {(() => {
            const timeline = buildTimeline(profile)
            if (!timeline.length) {
              return (
                <p className="text-sm text-dc-muted rounded-xl border border-dashed border-dc-border px-4 py-6 text-center">
                  No staff or volunteer assignments yet. When you join a crew or sign up for shifts, they appear here.
                </p>
              )
            }
            return (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Timeline</h3>
                <ul className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                  {timeline.map((row, i) => (
                    <li
                      key={`${row.kind}-${row.conventionId}-${row.startsAt}-${i}`}
                      className="rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2"
                    >
                      <p className="text-sm font-medium text-dc-text">{entryLabel(row)}</p>
                      <p className="text-xs text-dc-muted mt-0.5">
                        <Link
                          to={`/conventions/${encodeURIComponent(row.conventionSlug)}`}
                          className="text-dc-accent hover:underline"
                        >
                          {row.conventionName}
                        </Link>
                        {' · '}
                        {new Date(row.startsAt).toLocaleString()} – {new Date(row.endsAt).toLocaleString()}
                      </p>
                      {row.station ? <p className="text-[11px] text-dc-muted mt-0.5">Station: {row.station}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {profile.username ?
            <Link
              to={`/staff/${encodeURIComponent(profile.username)}`}
              className="inline-flex text-sm font-medium text-dc-accent hover:underline"
            >
              View public staff timeline
            </Link>
          : null}
        </>
      : null}
    </section>
  )
}
