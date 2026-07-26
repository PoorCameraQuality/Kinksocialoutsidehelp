import { Link } from 'react-router-dom'

import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import ProfileCard from '@/components/profile/story/ProfileCard'
import { IconUsers } from '@/components/profile/story/ProfileStoryIcons'
import type {
  ProfileConnectionsSummary,
  ProfileFollowsSummary,
  ProfileMutualConnections,
  SocialPersonPreview,
} from '@/lib/profile-social-types'

type Props = {
  username: string
  viewerIsOwner: boolean
  connections?: ProfileConnectionsSummary | null
  follows?: ProfileFollowsSummary | null
  mutualConnections?: ProfileMutualConnections | null
  onViewConnections?: () => void
}

function IconChevronRight({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function AvatarStack({ people }: { people: SocialPersonPreview[] }) {
  if (people.length === 0) return null
  return (
    <div className="flex -space-x-3">
      {people.slice(0, 3).map((person) => (
        <span
          key={person.username}
          className="h-11 w-11 overflow-hidden rounded-full bg-dc-surface-muted ring-2 ring-dc-elevated-solid"
        >
          {person.avatarUrl ?
            <img
              src={person.avatarUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          : <PlaceholderAvatar size="sm" className="h-full w-full !rounded-full" />}
        </span>
      ))}
    </div>
  )
}

/**
 * Compact network summary card — overlapping avatars, a headline count, and a
 * chevron through to the full connections view. Replaces the multi-section rail
 * on the refactored profile while keeping connections discoverable.
 */
export default function ProfileNetworkCard({
  username,
  viewerIsOwner,
  connections,
  follows,
  mutualConnections,
  onViewConnections,
}: Props) {
  const connectionCount = connections?.totalCount ?? 0
  const followerCount = follows?.followerCount ?? 0
  const followingCount = follows?.followingCount ?? 0
  const mutualCount = mutualConnections?.count ?? 0
  const listsVisible = follows?.listsVisible ?? false

  const hasAnySocial =
    connectionCount > 0 || followerCount > 0 || followingCount > 0 || mutualCount > 0

  if (!hasAnySocial && !viewerIsOwner) return null

  const useMutual = !viewerIsOwner && mutualCount > 0
  const headlineCount = useMutual ? mutualCount : connectionCount
  const headlineLabel =
    useMutual ?
      mutualCount === 1 ? 'shared connection' : 'shared connections'
    : connectionCount === 1 ? 'connection' : 'connections'

  const previewPeople =
    useMutual ? (mutualConnections?.preview ?? [])
    : connections?.listVisible ? (connections.preview ?? [])
    : []

  const secondaryParts: string[] = []
  if (listsVisible || viewerIsOwner) {
    if (followerCount > 0) {
      secondaryParts.push(`${followerCount.toLocaleString()} ${followerCount === 1 ? 'follower' : 'followers'}`)
    }
    if (followingCount > 0) secondaryParts.push(`${followingCount.toLocaleString()} following`)
  }

  const hasDestination = Boolean(viewerIsOwner || onViewConnections)

  const body = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        <AvatarStack people={previewPeople} />
        <div className="min-w-0">
          {hasAnySocial ?
            <>
              <p className="text-2xl font-bold tabular-nums leading-none tracking-tight text-dc-text">
                {headlineCount.toLocaleString()}
              </p>
              <p className="mt-1 truncate text-sm text-dc-text-muted">{headlineLabel}</p>
              {secondaryParts.length > 0 ?
                <p className="mt-0.5 truncate text-xs text-dc-muted">{secondaryParts.join(' · ')}</p>
              : null}
            </>
          : <p className="text-sm text-dc-text-muted">
              Connect and follow members to build your network.
            </p>
          }
        </div>
      </div>
      {hasDestination && hasAnySocial ?
        <IconChevronRight className="h-5 w-5 shrink-0 text-dc-muted" />
      : null}
    </div>
  )

  const inner =
    viewerIsOwner ?
      <Link
        to="/connections"
        className="block rounded-xl p-1 transition-colors hover:bg-dc-elevated-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        {body}
      </Link>
    : onViewConnections && hasAnySocial ?
      <button
        type="button"
        onClick={onViewConnections}
        className="block w-full rounded-xl p-1 text-left transition-colors hover:bg-dc-elevated-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
      >
        {body}
      </button>
    : <div className="p-1">{body}</div>

  return (
    <ProfileCard title="Network" icon={<IconUsers />}>
      {inner}
      {viewerIsOwner && !hasAnySocial ?
        <p className="mt-2 px-1 text-xs leading-relaxed text-dc-muted">
          Accepted connections appear here when you allow it in{' '}
          <Link to="/settings/privacy" className="text-dc-accent hover:underline">
            Privacy settings
          </Link>
          .
        </p>
      : null}
      {!viewerIsOwner && connectionCount > 0 && !connections?.listVisible ?
        <p className="mt-2 px-1 text-xs leading-relaxed text-dc-muted">
          @{username}&rsquo;s connections list is private.
        </p>
      : null}
    </ProfileCard>
  )
}
