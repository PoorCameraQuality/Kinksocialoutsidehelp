import { Link, useLocation } from 'react-router-dom'
import GroupsSectionNavLinks from '@/components/groups/GroupsSectionNavLinks'
import { useAuth } from '@/contexts/AuthContext'

type Props = {
  invitationBadge?: number
}

export default function GroupsPersonalLeftRail({ invitationBadge }: Props) {
  const { pathname, search } = useLocation()
  const { isAuthenticated, isFallback } = useAuth()
  const showRealPersonalLibrary = isAuthenticated && !isFallback

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Groups personal sections">
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-dc-muted">Groups</p>
        <GroupsSectionNavLinks
          pathname={pathname}
          search={search}
          invitationBadge={invitationBadge}
          showRealPersonalLibrary={showRealPersonalLibrary}
        />
      </div>

      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <h3 className="text-sm font-semibold text-dc-text">Looking for a group?</h3>
        <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
          Discover communities near you or start your own.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            to="/groups"
            className="flex min-h-11 items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Discover groups
          </Link>
        </div>
      </div>
    </aside>
  )
}
