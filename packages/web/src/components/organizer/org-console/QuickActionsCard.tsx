import { Link } from 'react-router-dom'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

export type QuickAction = {
  id: string
  label: string
  description?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
}

type Props = {
  actions: QuickAction[]
}

export default function QuickActionsCard({ actions }: Props) {
  if (actions.length === 0) return null

  return (
    <OrganizerPanel title="Quick actions" description="Common tasks for this organization.">
      <ul className="space-y-1">
        {actions.map((action) => (
          <li key={action.id}>
            {action.disabled ?
              <div className="rounded-lg border border-dc-border/60 bg-dc-surface/30 px-3 py-2.5 opacity-70">
                <p className="text-sm text-dc-text-muted">{action.label}</p>
                {action.disabledReason ?
                  <p className="mt-0.5 text-dc-micro text-dc-muted">{action.disabledReason}</p>
                : null}
              </div>
            : action.onClick ?
              <button
                type="button"
                onClick={action.onClick}
                className="flex w-full flex-col rounded-lg border border-dc-border px-3 py-2.5 text-left transition-colors hover:border-dc-accent-border/40 hover:bg-dc-accent/5"
              >
                <span className="text-sm font-medium text-dc-text">{action.label}</span>
                {action.description ?
                  <span className="mt-0.5 text-dc-micro text-dc-text-muted">{action.description}</span>
                : null}
              </button>
            : action.href ?
              <Link
                to={action.href}
                className="flex flex-col rounded-lg border border-dc-border px-3 py-2.5 transition-colors hover:border-dc-accent-border/40 hover:bg-dc-accent/5"
              >
                <span className="text-sm font-medium text-dc-text">{action.label}</span>
                {action.description ?
                  <span className="mt-0.5 text-dc-micro text-dc-text-muted">{action.description}</span>
                : null}
              </Link>
            : null}
          </li>
        ))}
      </ul>
    </OrganizerPanel>
  )
}
