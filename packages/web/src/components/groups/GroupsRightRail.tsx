import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import { GROUP_PURPOSE_FILTERS, countGroupsByPurpose, deriveGroupAccess } from '@/lib/groups-page-utils'
import type { MockGroup } from '@/data/types'

type Props = {
  allGroups: MockGroup[]
  suggested: MockGroup[]
  onPurposeSelect?: (purpose: string) => void
  onNearYou?: () => void
}

export default function GroupsRightRail({
  allGroups,
  suggested,
  onPurposeSelect,
  onNearYou,
}: Props) {
  const counts = countGroupsByPurpose(allGroups)
  const suggestRows = (suggested.length > 0 ? suggested : allGroups).slice(0, 3)

  return (
    <aside className={railAsideClass} aria-label="Groups discovery helpers">
      <RailCard title="Suggested for you" footerHref="/groups" footerLabel="View all">
        {suggestRows.length === 0 ?
          <p className="text-xs text-dc-text-muted">More groups appear as communities join Kink Social.</p>
        : <ul className="space-y-3">
            {suggestRows.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/groups/${g.id}`}
                  className="flex items-center gap-2 rounded-lg p-1 hover:bg-dc-elevated-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
                >
                  {g.coverImageUrl ?
                    <img src={g.coverImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  : <PlaceholderAvatar size="sm" className="!h-11 !w-11 !rounded-lg" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-dc-text">{g.name}</span>
                    <span className="block truncate text-xs text-dc-muted">
                      {g.members} member{g.members === 1 ? '' : 's'}
                      {g.category ? ` · ${g.category}` : ''}
                    </span>
                    <span className="text-[11px] text-dc-text-muted">{deriveGroupAccess(g)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        }
      </RailCard>

      <RailCard title="Browse by purpose" footerHref="/groups" footerLabel="View all purposes">
        <ul className="space-y-2 text-sm">
          {GROUP_PURPOSE_FILTERS.map((purpose) => (
            <li key={purpose}>
              <button
                type="button"
                onClick={() => onPurposeSelect?.(purpose)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-dc-text-muted transition-colors hover:bg-dc-elevated-hover hover:text-dc-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
              >
                <span>{purpose}</span>
                <span className="tabular-nums text-xs text-dc-muted">{counts.get(purpose) ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="Nearby communities">
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Use <strong className="font-medium text-dc-text">Near you</strong> and set your location in profile
          settings to find groups in your region.
        </p>
        {onNearYou ?
          <button
            type="button"
            onClick={onNearYou}
            className="mt-3 rounded text-xs font-medium text-dc-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
          >
            Groups near you
          </button>
        : null}
      </RailCard>
    </aside>
  )
}
