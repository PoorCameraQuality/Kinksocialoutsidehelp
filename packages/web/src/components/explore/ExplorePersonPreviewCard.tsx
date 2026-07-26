import { Link } from 'react-router-dom'
import PersonAvatar from '@/components/PersonAvatar'
import { getPersonCommunityBadges, getPersonHeadlineRole } from '@/lib/people-directory-utils'
import type { MockPerson } from '@/data/types'

type Props = {
  person: MockPerson
}

const BADGE_TONE_CLASS: Record<string, string> = {
  gold: 'border-dc-accent/50 bg-dc-accent-muted/40 text-dc-accent',
  green: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  blue: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  purple: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  orange: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
}

/**
 * Explore people preview — discovery-first: the whole card opens the profile so
 * "View profile" is the primary action. Connecting/following stays on the profile
 * and the full People directory, never a loud default here. Only public directory
 * fields are shown (no hidden/blocked/opted-out data).
 */
export default function ExplorePersonPreviewCard({ person }: Props) {
  const { username, sceneName, location, verified, avatarUrl, distance } = person
  const displayName = sceneName?.trim() || username
  const headlineRole = getPersonHeadlineRole(person)
  const badges = getPersonCommunityBadges(person).slice(0, 2)
  const metaLine = [headlineRole, location?.trim(), distance?.trim()].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/profile/${encodeURIComponent(username)}`}
      className="xpl-row-card items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
    >
      <PersonAvatar
        username={username}
        sceneName={sceneName}
        avatarUrl={avatarUrl}
        verified={verified}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-dc-text">{displayName}</p>
        <p className="text-xs text-dc-muted">@{username}</p>
        {metaLine ?
          <p className="mt-0.5 line-clamp-1 text-xs text-dc-text-muted">{metaLine}</p>
        : null}
        {badges.length > 0 ?
          <div className="mt-1.5 flex flex-wrap gap-1">
            {badges.map((badge) => (
              <span
                key={badge.id}
                className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  BADGE_TONE_CLASS[badge.tone] ?? BADGE_TONE_CLASS.gold
                }`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        : null}
        <span className="mt-1.5 inline-flex text-xs font-semibold text-dc-accent">View profile →</span>
      </div>
    </Link>
  )
}
