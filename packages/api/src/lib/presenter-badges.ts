import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export type PresenterBadgeCounts = {
  verifiedTeachingCredits: number
  scheduledCredits: number
  orgReviewCount: number
  orgReviewedEventCount: number
  attendeeReviewCount: number
  publicOfferingCount: number
  beginnerFriendlyOfferings: number
  accessibilityTaggedOfferings: number
}

export type PresenterBadgeKey =
  | 'ON_PROGRAM'
  | 'VERIFIED_TEACHING_CREDIT'
  | 'RETURNING_EDUCATOR'
  | 'ORG_REVIEWED'
  | 'ATTENDEE_REVIEWED'
  | 'BEGINNER_FRIENDLY'
  | 'ACCESSIBILITY_AWARE'
  | 'COMMUNITY_EDUCATOR'
  | 'PHOTOGRAPHER'
  | 'AUTHOR'

export function derivePresenterBadges(
  counts: PresenterBadgeCounts,
  profileKind: string
): PresenterBadgeKey[] {
  const badges: PresenterBadgeKey[] = []
  if (counts.scheduledCredits > 0 || counts.verifiedTeachingCredits > 0) {
    badges.push('ON_PROGRAM')
  }
  if (counts.verifiedTeachingCredits > 0) {
    badges.push('VERIFIED_TEACHING_CREDIT')
  }
  if (counts.verifiedTeachingCredits > 1 || counts.scheduledCredits > 1) {
    badges.push('RETURNING_EDUCATOR')
  }
  if (counts.orgReviewCount > 0) {
    badges.push('ORG_REVIEWED')
  }
  if (counts.attendeeReviewCount > 0) {
    badges.push('ATTENDEE_REVIEWED')
  }
  if (counts.beginnerFriendlyOfferings > 0) {
    badges.push('BEGINNER_FRIENDLY')
  }
  if (counts.accessibilityTaggedOfferings > 0) {
    badges.push('ACCESSIBILITY_AWARE')
  }
  if (counts.publicOfferingCount > 0 && profileKind !== 'AUTHOR' && profileKind !== 'PHOTO') {
    badges.push('COMMUNITY_EDUCATOR')
  }
  if (profileKind === 'PHOTO') badges.push('PHOTOGRAPHER')
  if (profileKind === 'AUTHOR' || profileKind === 'BOTH') badges.push('AUTHOR')
  return badges
}

export async function loadPresenterBadgeCounts(userIds: string[]): Promise<Map<string, PresenterBadgeCounts>> {
  const out = new Map<string, PresenterBadgeCounts>()
  if (userIds.length === 0) return out

  for (const id of userIds) {
    out.set(id, {
      verifiedTeachingCredits: 0,
      scheduledCredits: 0,
      orgReviewCount: 0,
      orgReviewedEventCount: 0,
      attendeeReviewCount: 0,
      publicOfferingCount: 0,
      beginnerFriendlyOfferings: 0,
      accessibilityTaggedOfferings: 0,
    })
  }

  const [credits, reviews, offerings] = await Promise.all([
    db
      .select({
        userId: schema.presenterTeachingCredits.presenterUserId,
        verified: schema.presenterTeachingCredits.verified,
        hasSlot: schema.presenterTeachingCredits.scheduleSlotId,
      })
      .from(schema.presenterTeachingCredits)
      .where(inArray(schema.presenterTeachingCredits.presenterUserId, userIds)),
    db
      .select({
        presenterUserId: schema.presenterReviews.presenterUserId,
        sourceKind: schema.presenterReviews.sourceKind,
        eventId: schema.presenterReviews.eventId,
      })
      .from(schema.presenterReviews)
      .where(inArray(schema.presenterReviews.presenterUserId, userIds)),
    db
      .select({
        userId: schema.presenterOfferings.userId,
        level: schema.presenterOfferings.level,
        tags: schema.presenterOfferings.tags,
      })
      .from(schema.presenterOfferings)
      .where(
        and(inArray(schema.presenterOfferings.userId, userIds), eq(schema.presenterOfferings.isPublic, true))
      ),
  ])

  for (const c of credits) {
    const row = out.get(c.userId)!
    if (c.verified) row.verifiedTeachingCredits += 1
    if (c.hasSlot) row.scheduledCredits += 1
  }

  const orgEventsByPresenter = new Map<string, Set<string>>()
  for (const r of reviews) {
    const row = out.get(r.presenterUserId)!
    if (r.sourceKind === 'ORGANIZATION') {
      row.orgReviewCount += 1
      if (r.eventId) {
        let set = orgEventsByPresenter.get(r.presenterUserId)
        if (!set) {
          set = new Set()
          orgEventsByPresenter.set(r.presenterUserId, set)
        }
        set.add(r.eventId)
      }
    } else {
      row.attendeeReviewCount += 1
    }
  }
  for (const [pid, events] of orgEventsByPresenter) {
    const row = out.get(pid)
    if (row) row.orgReviewedEventCount = events.size
  }

  for (const o of offerings) {
    const row = out.get(o.userId)!
    row.publicOfferingCount += 1
    const level = (o.level ?? '').toLowerCase()
    if (level.includes('beginner') || level.includes('intro') || level.includes('101')) {
      row.beginnerFriendlyOfferings += 1
    }
    const tags = (o.tags ?? []).map((t) => t.toLowerCase())
    if (tags.some((t) => t.includes('accessibility') || t.includes('a11y'))) {
      row.accessibilityTaggedOfferings += 1
    }
  }

  return out
}

export async function loadPresenterBadgeCountsOne(userId: string): Promise<PresenterBadgeCounts> {
  const map = await loadPresenterBadgeCounts([userId])
  return (
    map.get(userId) ?? {
      verifiedTeachingCredits: 0,
      scheduledCredits: 0,
      orgReviewCount: 0,
      orgReviewedEventCount: 0,
      attendeeReviewCount: 0,
      publicOfferingCount: 0,
      beginnerFriendlyOfferings: 0,
      accessibilityTaggedOfferings: 0,
    }
  )
}
