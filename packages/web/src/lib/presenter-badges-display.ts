import type { PresenterBadgeKey } from '@/lib/presenter-badges-types'

export const PRESENTER_BADGE_LABELS: Record<PresenterBadgeKey, string> = {
  ON_PROGRAM: 'On program',
  VERIFIED_TEACHING_CREDIT: 'Verified teaching credit',
  RETURNING_EDUCATOR: 'Returning educator',
  ORG_REVIEWED: 'Org-reviewed',
  ATTENDEE_REVIEWED: 'Attendee-reviewed',
  BEGINNER_FRIENDLY: 'Beginner-friendly',
  ACCESSIBILITY_AWARE: 'Accessibility-aware',
  COMMUNITY_EDUCATOR: 'Community educator',
  PHOTOGRAPHER: 'Photographer',
  AUTHOR: 'Author',
}

export function presenterBadgeLabel(key: PresenterBadgeKey): string {
  return PRESENTER_BADGE_LABELS[key] ?? key
}
