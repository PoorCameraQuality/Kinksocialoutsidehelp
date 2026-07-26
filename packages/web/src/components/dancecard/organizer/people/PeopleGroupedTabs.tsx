'use client'

import { cn } from '@/lib/cn'
import type { PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { groupedPeopleTabs, PEOPLE_TAB_LABELS } from '@/components/dancecard/organizer/people/peopleHubConfig'

type Props = {
  allowedTabs: PeopleSubTab[]
  activeId: PeopleSubTab
  onChange: (id: PeopleSubTab) => void
}

export function PeopleGroupedTabs({ allowedTabs, activeId, onChange }: Props) {
  const groups = groupedPeopleTabs(allowedTabs)
  const activeLabel = PEOPLE_TAB_LABELS[activeId] ?? activeId

  return (
    <nav className="rounded-xl border border-dc-border bg-dc-elevated-muted/60 p-3 sm:p-4" aria-label="People hub sections">
      <label className="flex flex-col gap-1.5 md:hidden">
        <span className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Section</span>
        <span className="text-xs text-dc-muted">Current: {activeLabel}</span>
        <select
          className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid px-4 py-3 text-base font-medium text-dc-text"
          value={activeId}
          onChange={(e) => onChange(e.target.value as PeopleSubTab)}
        >
          {groups.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {g.tabs.map((t) => (
                <option key={t} value={t}>
                  {PEOPLE_TAB_LABELS[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="hidden flex-col gap-4 md:flex">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">{g.label}</p>
            <div role="tablist" className="mt-2 flex flex-wrap gap-1 border-b border-dc-border pb-0.5">
              {g.tabs.map((t) => {
                const active = activeId === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`organizer-section-${t}`}
                    id={`organizer-section-tab-${t}`}
                    className={cn(
                      'relative shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                      active ? 'text-dc-accent' : 'text-dc-muted hover:text-dc-text',
                    )}
                    onClick={() => onChange(t)}
                  >
                    {PEOPLE_TAB_LABELS[t]}
                    {active ? (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-dc-accent" aria-hidden />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
