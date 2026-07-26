import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  formatPresenterRating,
  presenterFeedbackStatusLabel,
  presenterReputationTier,
  presenterReputationTierLabel,
} from './presenter-reputation-display.ts'

const presenterCardSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/cards/PresenterCard.tsx'),
  'utf8',
)

describe('presenter P3 reputation display', () => {
  it('shows limited feedback below review threshold', () => {
    assert.equal(presenterFeedbackStatusLabel(2), 'Limited feedback')
    assert.equal(presenterReputationTierLabel('trusted', 2), null)
  })

  it('shows bayesian rating at threshold', () => {
    assert.equal(formatPresenterRating(4.567, 5), '4.3')
    assert.equal(presenterReputationTier(4.0, 3), 'trusted')
    assert.equal(presenterReputationTierLabel('trusted', 3), 'Trusted educator')
  })

  it('presenter card emphasizes badges and trust chip over prominent star row', () => {
    assert.match(presenterCardSrc, /PresenterBadges/)
    assert.match(presenterCardSrc, /CommunityTrustChip/)
    assert.doesNotMatch(presenterCardSrc, /Highly trusted/)
  })
})
