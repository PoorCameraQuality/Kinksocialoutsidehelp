import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeGroupReviewDimensions } from './group-review-dimensions.js'

test('group dimension averages require minimum threshold', () => {
  const rows = [
    {
      cultureRating: 5,
      newMemberFriendlinessRating: 4,
      moderationQualityRating: null,
      safetyResponsivenessRating: null,
      eventUsefulnessRating: null,
      communicationClarityRating: null,
    },
    {
      cultureRating: 4,
      newMemberFriendlinessRating: 5,
      moderationQualityRating: null,
      safetyResponsivenessRating: null,
      eventUsefulnessRating: null,
      communicationClarityRating: null,
    },
  ]
  const summary = summarizeGroupReviewDimensions(rows, 3)
  assert.equal(summary.hasEnoughFeedback, false)
  assert.equal(summary.dimensions.find((d) => d.key === 'culture')?.average, null)
})

test('group dimension averages appear at threshold', () => {
  const rows = [
    {
      cultureRating: 5,
      newMemberFriendlinessRating: 4,
      moderationQualityRating: 3,
      safetyResponsivenessRating: null,
      eventUsefulnessRating: null,
      communicationClarityRating: null,
    },
    {
      cultureRating: 3,
      newMemberFriendlinessRating: 5,
      moderationQualityRating: 4,
      safetyResponsivenessRating: null,
      eventUsefulnessRating: null,
      communicationClarityRating: null,
    },
    {
      cultureRating: 4,
      newMemberFriendlinessRating: 4,
      moderationQualityRating: 5,
      safetyResponsivenessRating: null,
      eventUsefulnessRating: null,
      communicationClarityRating: null,
    },
  ]
  const summary = summarizeGroupReviewDimensions(rows, 3)
  assert.equal(summary.hasEnoughFeedback, true)
  const culture = summary.dimensions.find((d) => d.key === 'culture')
  assert.ok(culture?.average != null)
  assert.equal(culture.average, 4)
})
