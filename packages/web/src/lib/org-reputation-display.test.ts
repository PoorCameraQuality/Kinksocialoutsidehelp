import { describe, expect, it } from 'vitest'

import { formatOrgRating, orgReputationTier, orgReputationTierLabel } from './org-reputation-display'



describe('orgReputationTier', () => {

  it('returns newOrg when there are no reviews', () => {

    expect(orgReputationTier(4.8, 0)).toBe('newOrg')

  })



  it('returns limitedFeedback below minimum public reviews', () => {

    expect(orgReputationTier(4.8, 1)).toBe('limitedFeedback')

    expect(orgReputationTier(4.2, 2)).toBe('limitedFeedback')

  })



  it('returns trusted at threshold', () => {

    expect(orgReputationTier(4.0, 3)).toBe('trusted')

  })



  it('returns highlyTrusted at threshold', () => {

    expect(orgReputationTier(4.5, 8)).toBe('highlyTrusted')

  })

})



describe('orgReputationTierLabel', () => {

  it('labels trusted tiers and early states', () => {

    expect(orgReputationTierLabel('newOrg')).toBe('New organization')

    expect(orgReputationTierLabel('limitedFeedback')).toBe('Limited feedback')

    expect(orgReputationTierLabel('trusted')).toBe('Trusted')

    expect(orgReputationTierLabel('highlyTrusted')).toBe('Highly trusted')

    expect(orgReputationTierLabel('rated')).toBeNull()

  })

})



describe('formatOrgRating', () => {

  it('formats positive ratings with bayesian smoothing', () => {

    expect(formatOrgRating(4.567, 5)).toBe('4.2')

  })



  it('returns dash for insufficient reviews', () => {

    expect(formatOrgRating(4.567, 2)).toBe('-')

    expect(formatOrgRating(0, 0)).toBe('-')

  })

})


