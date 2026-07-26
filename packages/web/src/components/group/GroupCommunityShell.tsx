import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import TagLink from '@/components/TagLink'
import CommunityHubShell from '@/components/ui/CommunityHubShell'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import MarkdownContent from '@/components/ui/MarkdownContent'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import { groupTarget } from '@/lib/moderation/report-targets'

export { API_GROUP_TABS, MOCK_GROUP_TABS, MOCK_ONLY_GROUP_TABS, groupCommunityTabs } from '@/lib/group-community-tabs'

function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function moderatorCapabilityLine(role: string): string | null {
  const r = role.toLowerCase()
  if (r === 'owner' || r === 'admin') return 'Can manage settings, members, and moderation.'
  if (r === 'moderator' || r === 'event_host') return 'Can moderate channels and approve content.'
  return null
}

export interface GroupCommunityShellProps {
  name: string
  groupId: string
  memberCount: number
  coverImageUrl?: string | null
  logoUrl?: string | null
  parentOrganization?: { slug: string; displayName: string } | null
  /** API home region label, e.g. "Philadelphia, Pennsylvania" */
  placeLabel?: string | null
  /** Purpose category pill */
  category?: string | null
  visibility?: 'public' | 'private' | 'invite-only' | null
  description?: string | null
  tags?: string[]
  viewerRole?: string | null
  isMember: boolean
  canModerate: boolean
  /** When false, hides the organizer console link even if canModerate (mock groups). */
  showOrganizerConsole?: boolean
  tabs: readonly string[]
  activeTab: string
  onTabChange: (tab: string) => void
  onJoin: () => void
  onLeave: () => void
  children: ReactNode
  beforeTabs?: ReactNode
  tabFooter?: ReactNode
  className?: string
}

export default function GroupCommunityShell({
  name,
  groupId,
  memberCount,
  coverImageUrl,
  logoUrl,
  parentOrganization,
  placeLabel,
  category,
  visibility,
  description,
  tags,
  viewerRole,
  isMember,
  canModerate,
  showOrganizerConsole = true,
  tabs,
  activeTab,
  onTabChange,
  onJoin,
  onLeave,
  children,
  beforeTabs,
  tabFooter,
  className = '',
}: GroupCommunityShellProps) {
  const roleLabel = viewerRole ? viewerRole.replace(/_/g, ' ') : null
  const modLine = viewerRole ? moderatorCapabilityLine(viewerRole) : null
  const coverDisplay = mediaDisplayUrl(coverImageUrl)
  const logoDisplay = mediaDisplayUrl(logoUrl)

  const header = (
    <div className="dc-card-polish c2k-community-hero mb-6 overflow-hidden rounded-2xl border border-dc-border shadow-[var(--dc-shadow-soft)]">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-dc-accent/15 via-violet-950/35 to-dc-surface-muted c2k-community-hero-cover">
        <div className="relative mx-auto aspect-[3/1] w-full min-h-[5rem] max-h-28 sm:aspect-[21/9] sm:min-h-[6.5rem] sm:max-h-36 md:max-h-44 lg:max-h-52">
          {coverDisplay ?
            <img
              src={coverDisplay}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          : <div
              className="absolute inset-0 bg-gradient-to-br from-dc-accent/25 via-indigo-950/40 to-dc-surface-muted"
              aria-hidden
            />
          }
        </div>
      </div>

      <div className="bg-dc-elevated/95 px-4 sm:px-6 pb-4 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 min-w-0">
            <div
              className="-mt-10 sm:-mt-12 shrink-0 h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-4 border-dc-border bg-dc-elevated-solid overflow-hidden shadow-[var(--dc-shadow-soft)] flex items-center justify-center"
              aria-hidden={logoDisplay ? undefined : true}
            >
              {logoDisplay ?
                <img src={logoDisplay} alt="" className="h-full w-full object-cover" />
              : <span className="text-xl sm:text-2xl font-bold text-dc-text-muted">{groupInitials(name)}</span>
              }
            </div>
            <div className="min-w-0 pt-1 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-dc-text line-clamp-2 leading-tight">{name}</h1>
                {category ?
                  <span className="shrink-0 rounded-lg bg-dc-accent/15 border border-dc-accent/30 px-2 py-0.5 text-xs font-medium text-dc-accent">
                    {category}
                  </span>
                : null}
              </div>
              <p className="text-sm text-dc-muted">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                {placeLabel ? ` · Serving ${placeLabel}` : null}
              </p>
              {description ?
                <div className="mt-2 line-clamp-3">
                  <MarkdownContent
                    markdown={description}
                    className="c2k-rich-html text-sm leading-relaxed text-dc-text-muted"
                  />
                </div>
              : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-lg border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-text-muted">
                  {isMember ?
                    'You are a member'
                  : visibility === 'private' ?
                    'Private — join to participate'
                  : visibility === 'invite-only' ?
                    'Invite only'
                  : 'Open to join'}
                </span>
                <span className="rounded-lg border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-xs text-dc-text-muted">
                  Community rules apply
                </span>
              </div>
              {roleLabel && isMember ?
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full border border-dc-border bg-dc-elevated-muted px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-dc-text-muted">
                    {roleLabel}
                  </span>
                  {modLine ?
                    <span className="text-dc-muted">{modLine}</span>
                  : null}
                </p>
              : null}
              {parentOrganization ?
                <p className="text-sm text-dc-text-muted mt-2">
                  Parent organization{' '}
                  <Link
                    to={`/orgs/${encodeURIComponent(parentOrganization.slug)}`}
                    className="text-dc-accent hover:underline font-medium"
                  >
                    {parentOrganization.displayName}
                  </Link>
                </p>
              : null}
              {tags && tags.length > 0 ?
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <TagLink key={tag} tag={tag} />
                  ))}
                </div>
              : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isMember ?
              <button
                type="button"
                onClick={onJoin}
                className="min-h-11 px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Join group
              </button>
            : null}
            {canModerate && showOrganizerConsole ?
              <Link
                to={`/organizer/groups/${encodeURIComponent(groupId)}`}
                className="min-h-11 inline-flex items-center rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted"
              >
                Organizer dashboard
              </Link>
            : null}
            <CopyLinkOverflowMenu
              path={`/groups/${encodeURIComponent(groupId)}`}
              report={
                (() => {
                  const target = groupTarget(groupId)
                  return {
                    targetType: target.targetType,
                    targetId: target.targetId,
                    targetLabel: 'group',
                  }
                })()
              }
              extraMenuItems={
                isMember ?
                  [{ label: 'Leave group', onClick: onLeave, destructive: true }]
                : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <CommunityHubShell
      tabsAriaLabel="Group sections"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      header={header}
      beforeTabs={beforeTabs}
      tabFooter={tabFooter}
      className={className}
    >
      {children}
    </CommunityHubShell>
  )
}
