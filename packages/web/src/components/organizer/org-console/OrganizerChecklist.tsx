import { Link } from 'react-router-dom'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import OrganizerSetupCard from '@/components/organizer/ui/OrganizerSetupCard'
import { checklistProgress, type OrgChecklistItem } from '@/lib/organizer/build-org-checklist'

type Props = {
  items: OrgChecklistItem[]
}

export default function OrganizerChecklist({ items }: Props) {
  const { nextItem } = checklistProgress(items)

  return (
    <OrganizerPanel
      title="Setup checklist"
      description="Recommended steps to get your organization ready. Optional items are marked and do not affect progress."
    >
      <div className="space-y-2">
        {items.map((item) =>
          item.href ?
            <OrganizerSetupCard
              key={item.id}
              label={item.label}
              done={item.done}
              href={item.href}
              optional={item.optional}
              hint={item.hint}
              priority={!item.done && !item.optional && item.id === nextItem?.id ? 'high' : 'normal'}
            />
          : (
            <div
              key={item.id}
              className="rounded-lg border border-dc-border bg-dc-surface/40 px-3 py-2.5 text-sm text-dc-text-muted"
            >
              {item.done ? '✓ ' : ''}
              {item.label}
              {item.optional ?
                <span className="ml-2 text-dc-micro uppercase tracking-wide text-dc-muted">Optional</span>
              : null}
            </div>
          ),
        )}
      </div>
      {nextItem ?
        <Link to={nextItem.href!} className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline">
          Continue setup: {nextItem.label} →
        </Link>
      : null}
    </OrganizerPanel>
  )
}
