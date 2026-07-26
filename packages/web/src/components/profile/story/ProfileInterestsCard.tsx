import { Link } from 'react-router-dom'

import type { ProfileStoryKink } from '@/lib/profile-story/types'
import { cn } from '@/lib/cn'

import ProfileCard from './ProfileCard'
import { profileStoryBodyText, profileStoryEyebrow } from './profile-story-classes'
import { IconHeart } from './ProfileStoryIcons'

type Props = {
  kinks: ProfileStoryKink[]
  viewerIsOwner: boolean
}

/**
 * Ordered interest tiers. Labels carry the meaning (color is supplementary, per
 * the accessibility guidance to never rely on color alone). Public visitors only
 * receive `into` / `curious` from the API; owners see their full set.
 */
const TIERS = [
  { status: 'into', label: 'Into', pill: 'bg-dc-accent/[0.12] text-dc-text ring-1 ring-inset ring-dc-accent/30' },
  { status: 'curious', label: 'Curious', pill: 'bg-sky-500/[0.1] text-dc-text ring-1 ring-inset ring-sky-400/30' },
  { status: 'soft_limit', label: 'Soft boundaries', pill: 'bg-amber-500/[0.1] text-dc-text ring-1 ring-inset ring-amber-400/30' },
  { status: 'hard_limit', label: 'Hard boundaries', pill: 'bg-rose-600/[0.12] text-dc-text ring-1 ring-inset ring-rose-500/35' },
] as const

export default function ProfileInterestsCard({ kinks, viewerIsOwner }: Props) {
  const groups = TIERS.map((tier) => ({
    ...tier,
    items: kinks.filter((k) => k.interestStatus === tier.status),
  })).filter((group) => group.items.length > 0)

  if (groups.length === 0) {
    if (!viewerIsOwner) return null
    return (
      <ProfileCard title="Interests &amp; limits" icon={<IconHeart />}>
        <p className={profileStoryBodyText}>
          Add interests and mark them Into, Curious, or a Soft / Hard boundary so people understand what
          you&rsquo;re into and where your limits are.
        </p>
        <Link
          to="/profile/edit/interests"
          className="mt-3 inline-block text-sm font-medium text-dc-accent hover:underline"
        >
          Edit interests
        </Link>
      </ProfileCard>
    )
  }

  return (
    <ProfileCard title="Interests &amp; limits" icon={<IconHeart />}>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.status}>
            <p className={profileStoryEyebrow}>{group.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.items.map((kink) => (
                <span
                  key={kink.kinkTagId}
                  className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm', group.pill)}
                >
                  {kink.displayName}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ProfileCard>
  )
}
