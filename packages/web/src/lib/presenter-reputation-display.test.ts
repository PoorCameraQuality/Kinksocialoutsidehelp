import { describe, expect, it } from 'vitest'

import {

  formatPresenterRating,

  presenterProfileKindLabel,

  presenterReputationTier,

  presenterReputationTierLabel,

} from './presenter-reputation-display'



describe('presenterReputationTier', () => {

  it('returns unrated when there are no reviews', () => {

    expect(presenterReputationTier(4.8, 0)).toBe('unrated')

  })



  it('returns rated with few reviews', () => {

    expect(presenterReputationTier(4.8, 1)).toBe('rated')

  })



  it('returns trusted at threshold', () => {

    expect(presenterReputationTier(4.0, 3)).toBe('trusted')

  })



  it('returns trusted with two org-reviewed events and strong average', () => {

    expect(presenterReputationTier(4.2, 1, 2)).toBe('trusted')

  })



  it('returns highlyTrusted at threshold', () => {

    expect(presenterReputationTier(4.5, 8)).toBe('highlyTrusted')

  })

})



describe('presenterReputationTierLabel', () => {

  it('labels trusted tiers only', () => {

    expect(presenterReputationTierLabel('trusted', 3)).toBe('Trusted educator')

    expect(presenterReputationTierLabel('highlyTrusted', 8)).toBe('Highly trusted')

    expect(presenterReputationTierLabel('rated', 1)).toBeNull()

    expect(presenterReputationTierLabel('trusted', 2)).toBeNull()

  })

})



describe('formatPresenterRating', () => {

  it('formats positive ratings with bayesian smoothing', () => {

    expect(formatPresenterRating(4.567, 5)).toBe('4.3')

  })



  it('returns dash for unrated', () => {

    expect(formatPresenterRating(0, 0)).toBe('-')

  })

})



describe('presenterProfileKindLabel', () => {

  it('maps profile kinds', () => {

    expect(presenterProfileKindLabel('BOTH')).toBe('Presenter & author')

    expect(presenterProfileKindLabel('UNKNOWN')).toBeNull()

  })

})


