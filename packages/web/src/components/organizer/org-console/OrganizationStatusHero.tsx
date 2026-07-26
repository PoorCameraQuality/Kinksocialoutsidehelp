import { checklistProgress, publicHubStatusLabel, visibilityLabel, type OrgChecklistItem } from '@/lib/organizer/build-org-checklist'

type Props = {
  setupItems: OrgChecklistItem[]
  visibility: string
  memberCount: number
  upcomingEventCount: number
  conventionCount: number
  communityFeatures: string[]
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative h-20 w-20 shrink-0" aria-label={`${pct}% setup complete`}>
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-dc-border" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-dc-accent transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-dc-text">{pct}%</span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-dc-border bg-dc-surface/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-dc-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-dc-text">{value}</p>
    </div>
  )
}

export default function OrganizationStatusHero({
  setupItems,
  visibility,
  memberCount,
  upcomingEventCount,
  conventionCount,
  communityFeatures,
}: Props) {
  const { pct, doneCount, total } = checklistProgress(setupItems)

  return (
    <section className="organizer-panel rounded-2xl border border-dc-border-strong/80 bg-[var(--organizer-panel-bg)] p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProgressRing pct={pct} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-dc-text">Organization setup</p>
          <p className="text-dc-micro text-dc-text-muted">
            {doneCount} of {total} recommended steps complete
            {pct >= 100 ? '. You are ready to grow the hub.' : ''}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Public hub" value={publicHubStatusLabel(visibility)} />
        <Stat label="Visibility" value={visibilityLabel(visibility)} />
        <Stat label="Members" value={String(memberCount)} />
        <Stat label="Upcoming events" value={String(upcomingEventCount)} />
        <Stat label="Programs" value={String(conventionCount)} />
        <Stat label="Community" value={communityFeatures.length > 0 ? communityFeatures.join(', ') : 'None yet'} />
      </div>
    </section>
  )
}
