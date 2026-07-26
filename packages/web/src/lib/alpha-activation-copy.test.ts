import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALPHA_FEEDBACK_LINK,
  HOME_ACTIVATION_TAGLINE,
  LANDING_ALPHA_FRAMING,
  LANDING_CTA_JOIN,
  ONBOARDING_COMPLETE_BODY,
  ONBOARDING_COMPLETE_HEADLINE,
  PROFILE_COMPLETION_REASSURANCE,
} from './alpha-activation-copy.ts'
import { ONBOARDING_FIRST_STEP_ACTIONS } from './onboarding-first-steps.ts'

describe('beta activation copy', () => {
  it('includes public beta landing framing', () => {
    assert.match(LANDING_ALPHA_FRAMING, /public beta/)
    assert.match(LANDING_ALPHA_FRAMING, /events/)
    assert.match(LANDING_CTA_JOIN, /Create a free account/)
  })

  it('includes onboarding completion guidance', () => {
    assert.equal(ONBOARDING_COMPLETE_HEADLINE, 'You are in')
    assert.match(ONBOARDING_COMPLETE_BODY, /finding an event/)
    assert.match(ONBOARDING_COMPLETE_BODY, /privacy settings/)
  })

  it('includes home activation and profile reassurance copy', () => {
    assert.match(HOME_ACTIVATION_TAGLINE, /Start small/)
    assert.match(HOME_ACTIVATION_TAGLINE, /You control/)
    assert.match(PROFILE_COMPLETION_REASSURANCE, /Keep sensitive details private/)
  })

  it('includes feedback link label', () => {
    assert.match(ALPHA_FEEDBACK_LINK, /feedback/)
  })

  it('lists onboarding completion actions including feedback', () => {
    const ids = ONBOARDING_FIRST_STEP_ACTIONS.map((action) => action.id)
    assert.ok(ids.includes('events'))
    assert.ok(ids.includes('people'))
    assert.ok(ids.includes('groups'))
    assert.ok(ids.includes('privacy'))
    assert.ok(ids.includes('feedback'))
  })
})
