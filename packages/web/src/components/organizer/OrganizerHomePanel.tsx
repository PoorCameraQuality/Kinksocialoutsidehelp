import { Link } from 'react-router-dom'
import { DashboardCard } from '@/components/templates/DashboardTemplate'
import OrganizerSetupCard from '@/components/organizer/ui/OrganizerSetupCard'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

type ChecklistItem = {
  id: string
  label: string
  done: boolean
  href?: string
}

type Props = {
  scopeKind: 'org' | 'group'
  scopeName: string
  items: ChecklistItem[]
}

export default function OrganizerHomePanel({ scopeKind, scopeName, items }: Props) {
  const doneCount = items.filter((i) => i.done).length
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0
  const nextItem = items.find((i) => !i.done && i.href)

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DashboardCard title="Setup progress">
          <p className="text-2xl font-semibold text-dc-text">{pct}%</p>
          <p className="text-xs text-dc-muted">
            {doneCount}/{items.length} steps
          </p>
        </DashboardCard>
        {nextItem ?
          <DashboardCard title="Next step">
            <Link to={nextItem.href!} className="inline-flex min-h-touch items-center text-sm font-medium text-dc-accent hover:underline">
              {nextItem.label} →
            </Link>
          </DashboardCard>
        : (
          <DashboardCard title="Status">
            <p className="text-sm text-emerald-300/90">All suggested steps complete.</p>
          </DashboardCard>
        )}
      </div>

      <OrganizerPanel title="Setup dashboard" description={`${scopeKind === 'org' ? 'Organization' : 'Group'}: ${scopeName}`}>
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dc-accent-border/40"
            aria-label={`${pct}% complete`}
          >
            <span className="text-lg font-semibold text-dc-text">{pct}%</span>
          </div>
          <div>
            <p className="text-sm text-dc-text-muted">
              {doneCount} of {items.length} suggested steps complete
            </p>
            {nextItem ?
              <Link to={nextItem.href!} className="mt-1 inline-flex min-h-touch items-center text-sm font-medium text-dc-accent hover:underline">
                Next: {nextItem.label} →
              </Link>
            : (
              <p className="mt-1 text-sm text-emerald-300/90">All suggested steps complete.</p>
            )}
          </div>
        </div>
      </OrganizerPanel>

      <OrganizerPanel title="Checklist">
        <div className="space-y-2">
          {items.map((item) =>
            item.href ?
              <OrganizerSetupCard key={item.id} label={item.label} done={item.done} href={item.href} priority={!item.done && item.id === nextItem?.id ? 'high' : 'normal'} />
            : (
              <div key={item.id} className="rounded-lg border border-dc-border px-3 py-2.5 text-sm text-dc-text-muted">
                {item.done ? '✓ ' : ''}
                {item.label}
              </div>
            ),
          )}
        </div>
      </OrganizerPanel>

      <p className="text-xs text-dc-muted">
        <strong className="font-normal text-dc-text-muted">Kink Social</strong>. Private community (forums, chat, members).{' '}
        <strong className="font-normal text-dc-text-muted">Public directory listing</strong>. Public listings and Dancecard. Configure here; members interact on the public hub.
      </p>
    </div>
  )
}
