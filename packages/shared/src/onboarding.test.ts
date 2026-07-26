import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clampOnboardingStep,
  isOnboardingComplete,
  onboardingStepNumber,
  ONBOARDING_STEP_COUNT,
  profileCompletionPercent,
} from './onboarding.js'
import { normalizeFeedSettings } from './user-settings.js'

describe('onboarding helpers', () => {
  it('treats missing completion as incomplete for new defaults', () => {
    assert.equal(isOnboardingComplete({ onboardingCompletedAt: null }), false)
  })

  it('grandfathers existing feed settings without onboarding fields', () => {
    const feed = normalizeFeedSettings({ schemaVersion: 4, hideStoryTypes: [] })
    assert.equal(isOnboardingComplete(feed), true)
  })

  it('reads onboarding step with fallback', () => {
    assert.equal(onboardingStepNumber({ onboardingStep: 3 }), 3)
    assert.equal(onboardingStepNumber({}), 1)
  })

  it('clamps stale saved steps into the current range', () => {
    assert.equal(ONBOARDING_STEP_COUNT, 11)
    assert.equal(clampOnboardingStep(11), 11)
    assert.equal(clampOnboardingStep(99), ONBOARDING_STEP_COUNT)
    assert.equal(clampOnboardingStep(0), 1)
    assert.equal(clampOnboardingStep(null), 1)
    assert.equal(clampOnboardingStep(undefined), 1)
    assert.equal(onboardingStepNumber({ onboardingStep: 20 }), ONBOARDING_STEP_COUNT)
  })

  it('remaps legacy 6-step feed settings into hybrid flow', () => {
    const feed = normalizeFeedSettings({
      schemaVersion: 5,
      onboardingStep: 3,
      onboardingFlowVersion: 1,
      onboardingCompletedAt: null,
    })
    assert.equal(feed.onboardingFlowVersion, 2)
    assert.equal(feed.onboardingStep, 5)
  })

  it('computes profile completion percent', () => {
    assert.equal(
      profileCompletionPercent({
        displayName: 'Alex',
        bio: 'Hello',
        photoCount: 1,
        privacyConfigured: true,
        joinedOrFollowed: false,
      }),
      85
    )
  })
})
