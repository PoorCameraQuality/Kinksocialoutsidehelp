import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import type {
  ProfileConnectionsSummary,
  ProfileFollowsSummary,
  ProfileMutualConnections,
  SocialPersonPreview,
} from '@/lib/profile-social-types'
import type { PublicProfileTab, CommunitySection } from '@/lib/public-profile-tabs'
import SocialAvatarGrid from './SocialAvatarGrid'

type Props = {
  username: string
  viewerIsOwner: boolean
  isAuthenticated: boolean
  connections: ProfileConnectionsSummary | null | undefined
  follows: ProfileFollowsSummary | null | undefined
  mutualConnections: ProfileMutualConnections | null | undefined
  onSelectTab?: (tab: PublicProfileTab, section?: CommunitySection) => void
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

type SectionProps = {
  title: string
  count: number
  people: SocialPersonPreview[]
  viewAllHref?: string
  viewAllLabel?: string
  onViewAll?: () => void
  privateHint?: string
}

function SocialRailSection({
  title,
  count,
  people,
  viewAllHref,
  viewAllLabel = 'View all',
  onViewAll,
  privateHint,
}: SectionProps) {
  if (count === 0) return null

  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-dc-text">
        <span className="text-dc-accent">{formatCount(count)}</span>{' '}
        <span className="font-medium text-dc-text-muted">{title}</span>
      </h3>
    </div>
  )

  const viewAll =
    viewAllHref ?
      <Link to={viewAllHref} className="text-xs font-medium text-dc-accent hover:underline">
        {viewAllLabel} →
      </Link>
    : onViewAll ?
      <button
        type="button"
        onClick={onViewAll}
        className="text-xs font-medium text-dc-accent hover:underline"
      >
        {viewAllLabel} →
      </button>
    : null

  return (
    <section className="space-y-2.5">
      {header}
      {people.length > 0 ?
        <SocialAvatarGrid people={people} />
      : privateHint ?
        <p className="text-xs leading-relaxed text-dc-muted">{privateHint}</p>
      : null}
      {viewAll ?
        <div className="pt-0.5">{viewAll}</div>
      : null}
    </section>
  )
}

export default function ProfileSocialRail({
  username,
  viewerIsOwner,
  isAuthenticated,
  connections,
  follows,
  mutualConnections,
  onSelectTab,
}: Props) {
  const connectionCount = connections?.totalCount ?? 0
  const followerCount = follows?.followerCount ?? 0
  const followingCount = follows?.followingCount ?? 0
  const mutualCount = mutualConnections?.count ?? 0
  const hasAnySocial =
    connectionCount > 0 || followerCount > 0 || followingCount > 0 || mutualCount > 0

  if (!hasAnySocial && !viewerIsOwner) return null

  const connectionsPreview =
    connections?.listVisible ? (connections.preview ?? []) : []
  const connectionsPrivate =
    connectionCount > 0 && !connections?.listVisible ?
      viewerIsOwner ?
        'Your connections list is hidden from others. Change this in Privacy settings.'
      : 'Connections list is private.'
    : undefined

  const followsPrivate =
    !follows?.listsVisible && (followerCount > 0 || followingCount > 0) ?
      'Sign in to see follower and following previews.'
    : undefined

  const ownerConnectionsHref = '/connections'
  const ownerFollowsHref = (tab: 'followers' | 'following') =>
    `/connections?tab=${tab}`

  return (
    <Card padding="md" className="space-y-5">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc-muted/75">
          Network
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-dc-text-muted">
          {viewerIsOwner ?
            'How others discover your circle on Kink Social.'
          : `People connected to @${username}.`}
        </p>
      </div>

      {mutualCount > 0 ?
        <SocialRailSection
          title={mutualCount === 1 ? 'Mutual connection' : 'Mutual connections'}
          count={mutualCount}
          people={mutualConnections?.preview ?? []}
          onViewAll={
            onSelectTab && connections?.listVisible ?
              () => onSelectTab('Community', 'connections')
            : undefined
          }
          viewAllLabel="See connections"
        />
      : null}

      <SocialRailSection
        title={connectionCount === 1 ? 'Connection' : 'Connections'}
        count={connectionCount}
        people={connectionsPreview}
        privateHint={connectionsPrivate}
        viewAllHref={viewerIsOwner ? ownerConnectionsHref : undefined}
        onViewAll={
          !viewerIsOwner && onSelectTab && connections?.listVisible ?
            () => onSelectTab('Community', 'connections')
          : undefined
        }
      />

      {followsPrivate ?
        <p className="text-xs leading-relaxed text-dc-muted">{followsPrivate}</p>
      : null}

      {follows?.listsVisible || viewerIsOwner ?
        <>
          <SocialRailSection
            title={followerCount === 1 ? 'Follower' : 'Followers'}
            count={followerCount}
            people={follows?.followersPreview ?? []}
            viewAllHref={viewerIsOwner ? ownerFollowsHref('followers') : undefined}
          />

          <SocialRailSection
            title="Following"
            count={followingCount}
            people={follows?.followingPreview ?? []}
            viewAllHref={viewerIsOwner ? ownerFollowsHref('following') : undefined}
          />
        </>
      : isAuthenticated === false && (followerCount > 0 || followingCount > 0) ?
        <>
          {followerCount > 0 ?
            <SocialRailSection
              title={followerCount === 1 ? 'Follower' : 'Followers'}
              count={followerCount}
              people={[]}
              privateHint="Sign in to see who follows this member."
            />
          : null}
          {followingCount > 0 ?
            <SocialRailSection
              title="Following"
              count={followingCount}
              people={[]}
              privateHint="Sign in to see who they follow."
            />
          : null}
        </>
      : null}

      {viewerIsOwner && connectionCount === 0 && followerCount === 0 && followingCount === 0 ?
        <p className="text-xs leading-relaxed text-dc-muted">
          Connect and follow members to build your network. Accepted connections can appear here when
          you allow it in{' '}
          <Link to="/settings/privacy" className="text-dc-accent hover:underline">
            Privacy settings
          </Link>
          .
        </p>
      : null}
    </Card>
  )
}
