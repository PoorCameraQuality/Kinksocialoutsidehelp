import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePresenterBadges, type PresenterBadgeCounts } from './presenter-badges.js'

const empty: PresenterBadgeCounts = {
  verifiedTeachingCredits: 0,
  scheduledCredits: 0,
  orgReviewCount: 0,
  orgReviewedEventCount: 0,
  attendeeReviewCount: 0,
  publicOfferingCount: 0,
  beginnerFriendlyOfferings: 0,
  accessibilityTaggedOfferings: 0,
}

test('verified teaching credit badge requires verified credits', () => {
  const badges = derivePresenterBadges(
    { ...empty, verifiedTeachingCredits: 1, scheduledCredits: 1 },
    'PRES',
  )
  assert.ok(badges.includes('VERIFIED_TEACHING_CREDIT'))
  assert.ok(badges.includes('ON_PROGRAM'))
})

test('org-reviewed badge requires organization review', () => {
  const badges = derivePresenterBadges({ ...empty, orgReviewCount: 1 }, 'PRES')
  assert.ok(badges.includes('ORG_REVIEWED'))
})

test('does not infer subjective badges without data', () => {
  const badges = derivePresenterBadges(empty, 'PRES')
  assert.equal(badges.includes('BEGINNER_FRIENDLY'), false)
  assert.equal(badges.includes('ACCESSIBILITY_AWARE'), false)
})
