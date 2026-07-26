import { Link } from 'react-router-dom'
import { groupsSectionNavForViewer } from '@/lib/group-detail-guards'
import { resolveGroupsSectionNavMatch } from '@/lib/groups-section-mode'

type Props = {
  pathname: string
  search: string
  invitationBadge?: number
  showRealPersonalLibrary?: boolean
}

export default function GroupsSectionNavLinks({
  pathname,
  search,
  invitationBadge = 0,
  showRealPersonalLibrary = false,
}: Props) {
  const current = resolveGroupsSectionNavMatch(pathname, search)
  const items = groupsSectionNavForViewer(showRealPersonalLibrary)
  return (
    <nav aria-label="Groups sections">
      <ul className="space-y-0.5">
      {items.map((item) => {
        const active = item.match === current
        return (
          <li key={item.href}>
            <Link
              to={item.href}
              className={`flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active ?
                  'bg-dc-accent-muted text-dc-accent'
                : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
              }`}
            >
              <span>{item.label}</span>
              {item.match === 'invitations' && invitationBadge > 0 ?
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-dc-accent px-1.5 py-0.5 text-[10px] font-bold text-dc-accent-foreground">
                  {invitationBadge > 9 ? '9+' : invitationBadge}
                </span>
              : null}
            </Link>
          </li>
        )
      })}
      </ul>
    </nav>
  )
}
