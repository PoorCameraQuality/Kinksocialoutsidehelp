'use client'

import type { OrganizerTab, PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'
import type { ResolvedSetupTask } from '@/lib/dancecard/resolveSetupTasks'
import { cn } from '@/lib/cn'

function statusTag(status: ResolvedSetupTask['status']) {
  if (status === 'complete') {
    return (
      <span className="rounded-full border border-dc-accent-border bg-dc-accent-muted px-2 py-0.5 text-dc-micro font-semibold uppercase tracking-wide text-dc-accent">
        Done
      </span>
    )
  }
  if (status === 'cannot_start') {
    return (
      <span className="rounded-full bg-dc-surface-muted px-2 py-0.5 text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">
        Locked
      </span>
    )
  }
  return (
    <span className="rounded-full bg-dc-warning-muted px-2 py-0.5 text-dc-micro font-semibold uppercase tracking-wide text-dc-warning">
      To do
    </span>
  )
}

function TaskRow({
  task,
  readOnly,
  onNavigate,
}: {
  task: ResolvedSetupTask
  readOnly?: boolean
  onNavigate: (
    tab: OrganizerTab,
    opts?: { peopleTab?: PeopleSubTab; settingsPanel?: string; publishFilter?: 'draft' },
  ) => void
}) {
  const disabled = readOnly || task.status === 'cannot_start' || task.status === 'complete'

  const go = () => {
    if (disabled) return
    onNavigate(task.href.tab, {
      peopleTab: task.href.peopleTab,
      settingsPanel: task.href.settingsPanel,
      publishFilter: task.href.publishFilter,
    })
  }

  return (
    <li className="border-b border-dc-border last:border-b-0">
      <button
        type="button"
        disabled={disabled}
        onClick={go}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition',
          disabled ? 'cursor-default opacity-70' : 'hover:bg-dc-surface-muted',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-dc-text">{task.label}</p>
          <p className="mt-0.5 text-sm text-dc-muted">{task.description}</p>
        </div>
        {statusTag(task.status)}
      </button>
    </li>
  )
}

export function SetupTaskList({
  tasks,
  readOnly,
  compact,
  showCompleted,
  onNavigate,
}: {
  tasks: ResolvedSetupTask[]
  readOnly?: boolean
  compact?: boolean
  showCompleted?: boolean
  onNavigate: (
    tab: OrganizerTab,
    opts?: { peopleTab?: PeopleSubTab; settingsPanel?: string; publishFilter?: 'draft' },
  ) => void
}) {
  const essential = tasks.filter((t) => t.group === 'essential')
  const optional = tasks.filter((t) => t.group === 'optional')
  const completed = tasks.filter((t) => t.status === 'complete')
  const incompleteEssential = essential.filter((t) => t.status !== 'complete').length

  if (compact) {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-muted/50 px-4 py-3">
        <p className="text-sm text-dc-text">
          {incompleteEssential === 0
            ? 'Essential setup complete.'
            : `${incompleteEssential} essential item${incompleteEssential === 1 ? '' : 's'} need attention.`}
        </p>
        {incompleteEssential > 0 && !readOnly ? (
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-dc-accent hover:underline"
            onClick={() => {
              const next = essential.find((t) => t.status === 'incomplete')
              if (next) onNavigate(next.href.tab, next.href)
            }}
          >
            Continue setup →
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated">
        <div className="border-b border-dc-border px-4 py-3">
          <h2 className="text-sm font-semibold text-dc-text">Before go-live</h2>
          <p className="mt-0.5 text-xs text-dc-muted">Complete these so attendees see a coherent dancecard.</p>
        </div>
        <ul>
          {essential.filter((t) => t.status !== 'complete').map((task) => (
            <TaskRow key={task.id} task={task} readOnly={readOnly} onNavigate={onNavigate} />
          ))}
        </ul>
      </section>

      {optional.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated">
          <div className="border-b border-dc-border px-4 py-3">
            <h2 className="text-sm font-semibold text-dc-text">Optional</h2>
            <p className="mt-0.5 text-xs text-dc-muted">Helpful, not required for a minimal launch.</p>
          </div>
          <ul>
            {optional.filter((t) => t.status !== 'complete').map((task) => (
              <TaskRow key={task.id} task={task} readOnly={readOnly} onNavigate={onNavigate} />
            ))}
          </ul>
        </section>
      ) : null}

      {showCompleted && completed.length > 0 ? (
        <details className="group overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-muted/40">
          <summary className="cursor-pointer list-none border-b border-dc-border px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold text-dc-text">Completed</span>
            <span className="mt-0.5 block text-xs text-dc-muted">
              {completed.length} setup item{completed.length === 1 ? '' : 's'} done.
              <span className="ml-2 text-dc-accent group-open:hidden">Show</span>
              <span className="ml-2 hidden text-dc-accent group-open:inline">Hide</span>
            </span>
          </summary>
          <ul>
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} readOnly={readOnly} onNavigate={onNavigate} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
