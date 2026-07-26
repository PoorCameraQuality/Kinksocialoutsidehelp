import { Link } from 'react-router-dom'

import FindPeopleFiltersPanel, { type FindPeopleFilterDraft } from '@/components/find-people/FindPeopleFiltersPanel'

import type { CommunityRoleFilterId } from '@/lib/people-search-constants'
import { FOLLOW_VS_CONNECT_LONG } from '@/lib/social-graph-copy'



const NAV = [

  { href: '/people', label: 'People' },

  { href: '/connections', label: 'Connections' },

  { href: '/connections?tab=requests', label: 'Requests' },

  { href: '/profile', label: 'My profile' },

] as const



type Props = {
  draft: FindPeopleFilterDraft
  onDraftChange: (patch: Partial<FindPeopleFilterDraft>) => void
  onToggleCommunityRole: (id: CommunityRoleFilterId) => void
  onToggleInterestRole: (role: string) => void
  onResetAll: () => void
  onApply: () => void
  memberCount: number
  streamTab?: string
  peopleApiBacked?: boolean
}

export default function FindPeopleLeftRail(props: Props) {
  const {
    draft,
    onDraftChange,
    onToggleCommunityRole,
    onToggleInterestRole,
    onResetAll,
    onApply,
    memberCount,
    streamTab,
    peopleApiBacked,
  } = props

  return (

    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="People directory filters">

      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">

        <nav aria-label="People sections" className="border-b border-dc-border pb-4">

          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Connection</p>

          <ul className="space-y-0.5">

            {NAV.map((item, i) => (

              <li key={item.href}>

                <Link

                  to={item.href}

                  aria-current={i === 0 ? 'page' : undefined}

                  className={`flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface ${

                    i === 0 ?

                      'bg-dc-accent-muted text-dc-accent'

                    : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'

                  }`}

                >

                  {item.label}

                </Link>

              </li>

            ))}

          </ul>

        </nav>

        <div className="mt-4 rounded-xl border border-dc-border bg-dc-elevated-muted/40 p-3">
          <p className="text-xs font-semibold text-dc-text">Follow vs Connect</p>
          <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">{FOLLOW_VS_CONNECT_LONG}</p>
        </div>

        <div className="mt-5 border-t border-dc-border pt-5">

          <FindPeopleFiltersPanel
            idPrefix="fp-rail"
            draft={draft}
            onDraftChange={onDraftChange}
            onToggleCommunityRole={onToggleCommunityRole}
            onToggleInterestRole={onToggleInterestRole}
            onResetAll={onResetAll}
            onApply={onApply}
            memberCount={memberCount}
            streamTab={streamTab}
            peopleApiBacked={peopleApiBacked}
          />

        </div>

      </div>
    </aside>

  )

}


