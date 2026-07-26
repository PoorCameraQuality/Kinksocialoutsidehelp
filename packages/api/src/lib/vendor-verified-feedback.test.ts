import assert from 'node:assert/strict'
import test from 'node:test'
import { VENDOR_MIN_VERIFIED_FOR_STARS } from '@c2k/shared'
import { buildVendorFeedbackSummary } from './vendor-verified-feedback.js'

test('vendor with no verified feedback returns null summary', () => {
  assert.equal(buildVendorFeedbackSummary(4.5, 0), null)
})

test('vendor below threshold keeps rating hidden publicly', () => {
  const summary = buildVendorFeedbackSummary(5, VENDOR_MIN_VERIFIED_FOR_STARS - 1)
  assert.ok(summary)
  assert.equal(summary.meetsPublicRatingThreshold, false)
  assert.equal(summary.rating, 0)
  assert.equal(summary.verifiedFeedbackCount, VENDOR_MIN_VERIFIED_FOR_STARS - 1)
})

test('vendor at threshold exposes raw rating for display layer', () => {
  const summary = buildVendorFeedbackSummary(4.8, VENDOR_MIN_VERIFIED_FOR_STARS)
  assert.ok(summary)
  assert.equal(summary.meetsPublicRatingThreshold, true)
  assert.equal(summary.rating, 4.8)
})
