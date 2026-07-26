import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildOnboardingHref, onboardingPathsExempt } from './onboarding.ts'
import { buildProfileOnboardingHref } from './profile-onboarding.ts'

describe('onboarding routes', () => {
  it('builds onboarding href with redirect', () => {
    assert.equal(buildOnboardingHref('/home'), '/onboarding?redirect=%2Fhome')
  })

  it('exempts legal and auth paths', () => {
    assert.equal(onboardingPathsExempt('/onboarding'), true)
    assert.equal(onboardingPathsExempt('/verify-email'), true)
    assert.equal(onboardingPathsExempt('/privacy'), true)
    assert.equal(onboardingPathsExempt('/home'), false)
  })

  it('profile onboarding href points to profile edit without legacy flag', () => {
    assert.equal(buildProfileOnboardingHref('/home'), '/profile/edit?redirect=%2Fhome')
  })
})
