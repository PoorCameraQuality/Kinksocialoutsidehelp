import assert from 'node:assert/strict'

import test from 'node:test'

import {

  capSignal,

  detectIdenticalTextBurst,

  detectReciprocalReviewPairs,

  isSameSignupCohort,

  shouldHoldRatingForModReview,

} from './reputation-anti-gaming.js'



test('capSignal clamps counts', () => {

  assert.equal(capSignal(10, 3), 3)

  assert.equal(capSignal(-1, 3), 0)

})



test('isSameSignupCohort detects close signups', () => {

  const a = new Date('2026-01-01T12:00:00Z')

  const b = new Date('2026-01-02T10:00:00Z')

  assert.equal(isSameSignupCohort(a, b), true)

  assert.equal(isSameSignupCohort(a, new Date('2026-01-10T12:00:00Z')), false)

})



test('detectIdenticalTextBurst finds repeated bodies', () => {

  const text = 'this was an excellent class with great energy'

  assert.equal(detectIdenticalTextBurst([text, text, text]), true)

  assert.equal(detectIdenticalTextBurst(['short', 'other']), false)

})



test('detectReciprocalReviewPairs counts mutual reviews', () => {

  const pairs = detectReciprocalReviewPairs([

    { authorId: 'a', targetUserId: 'b' },

    { authorId: 'b', targetUserId: 'a' },

  ])

  assert.equal(pairs, 1)

})



test('shouldHoldRatingForModReview flags spike after conflict', () => {

  assert.equal(

    shouldHoldRatingForModReview({

      previousAvg: 3,

      newAvg: 5,

      reviewCount: 4,

      recentReportCount: 1,

      recentOpenCases: 0,

    }),

    true

  )

})


