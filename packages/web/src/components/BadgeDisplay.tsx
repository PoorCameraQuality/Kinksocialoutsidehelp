import type { BadgeId } from '@/data/types'

/**
 * Reputation badges – Event Verified, Mentor, Community Contributor, etc.
 * Maps to swing-club-platform reputation_badges when API exists.
 * Kink Social palette; no raw trust score exposed.
 */
const BADGE_CONFIG: Record<BadgeId, { label: string; title: string }> = {
  event_verified: { label: 'Event Verified', title: 'Attended verified events' },
  mentor: { label: 'Mentor', title: 'Community mentor' },
  community_contributor: { label: 'Contributor', title: 'Active community contributor' },
  education_completed: { label: 'Education', title: 'Completed education modules' },
  verified_id: { label: 'Verified ID', title: 'Identity verified' },
  vendor_verified: { label: 'Vendor', title: 'Verified vendor' },
  community_trusted: { label: 'Trusted', title: 'Community trusted member' },
}

export default function BadgeDisplay({
  badges = [],
  maxVisible = 4,
  size = 'sm',
  className = '',
}: {
  badges?: BadgeId[]
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const visible = badges.slice(0, maxVisible)
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  if (visible.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="list" aria-label="Reputation badges">
      {visible.map((id) => {
        const config = BADGE_CONFIG[id]
        if (!config) return null
        return (
          <span
            key={id}
            role="listitem"
            title={config.title}
            className={`inline-flex items-center rounded-md bg-dc-accent/15 text-dc-accent ${sizeClasses} font-medium`}
          >
            {config.label}
          </span>
        )
      })}
    </div>
  )
}
