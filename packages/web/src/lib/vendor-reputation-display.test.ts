import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { VENDOR_MIN_VERIFIED_FOR_STARS } from '@c2k/shared'
import {
  buildVendorFeedbackSummaryDisplay,
  formatVendorRating,
  vendorReputationTier,
  vendorReputationTierLabel,
} from './vendor-reputation-display.ts'

const mockSeedsSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../data/mock-seeds.ts'),
  'utf8',
)

const vendorCardSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/cards/VendorCard.tsx'),
  'utf8',
)

describe('vendorReputationTier', () => {
  it('shows new vendor with no verified feedback', () => {
    assert.equal(vendorReputationTier(4.8, 0), 'newVendor')
  })

  it('shows limited feedback below threshold', () => {
    assert.equal(vendorReputationTier(5, 2), 'limitedFeedback')
    assert.equal(vendorReputationTierLabel('limitedFeedback'), 'Limited feedback')
  })

  it('shows rated at or above threshold', () => {
    assert.equal(vendorReputationTier(4.5, VENDOR_MIN_VERIFIED_FOR_STARS), 'rated')
    assert.equal(vendorReputationTierLabel('rated'), null)
  })
})

describe('formatVendorRating', () => {
  it('hides stars below verified threshold', () => {
    assert.equal(formatVendorRating(5, 2), '-')
  })

  it('uses bayesian display at threshold', () => {
    assert.equal(formatVendorRating(5, 3), '4.4')
  })
})

describe('mock vendor verified feedback', () => {
  it('mock seeds wire verifiedFeedbackCount for demo gating', () => {
    assert.match(mockSeedsSrc, /verifiedFeedbackCount:\s*mockVendorVerifiedFeedbackCount\(i\)/)
  })

  it('buildVendorFeedbackSummaryDisplay mirrors API threshold behavior', () => {
    assert.equal(buildVendorFeedbackSummaryDisplay(4.9, 0), null)
    const limited = buildVendorFeedbackSummaryDisplay(4.9, 2)
    assert.ok(limited)
    assert.equal(limited.meetsPublicRatingThreshold, false)
    assert.equal(limited.rating, 0)
    const rated = buildVendorFeedbackSummaryDisplay(4.9, 3)
    assert.ok(rated)
    assert.equal(rated.meetsPublicRatingThreshold, true)
    assert.equal(rated.rating, 4.9)
  })
})

describe('vendor card external purchase copy', () => {
  it('shows Sold externally badge', () => {
    assert.match(vendorCardSrc, /Sold externally/)
  })

  it('uses Visit shop CTA not checkout language', () => {
    assert.match(vendorCardSrc, /Visit shop/)
    assert.doesNotMatch(vendorCardSrc, /Buy now|Checkout|Add to cart/i)
  })
})
