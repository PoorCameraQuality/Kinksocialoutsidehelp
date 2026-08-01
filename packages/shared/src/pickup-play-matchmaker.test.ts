import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  emptyPickupPlayAnswers,
  normalizePickupPlayAnswers,
  PICKUP_PLAY_CATALOG,
  playWithAcceptsIdentity,
  scorePickupPlayAnswers,
  type PickupPlayAnswers,
} from './pickup-play-matchmaker.js'

function base(over: Partial<PickupPlayAnswers> = {}): PickupPlayAnswers {
  return {
    ...emptyPickupPlayAnswers(),
    roleTonight: 'switch',
    moods: ['playful', 'erotic'],
    seeking: ['rope_floor', 'spanking_hand'],
    offering: ['rope_floor', 'floggers'],
    intent: 'open_to_sexual',
    likert: {
      intensity: 5,
      lead: 6,
      follow: 2,
      switchy: 4,
      negotiation_depth: 6,
      public_ok: 5,
      aftercare_need: 5,
      short_scene: 4,
      risk_aware: 7,
      meet_effort: 6,
    },
    ...over,
  }
}

describe('pickup play catalog', () => {
  it('has a wide negotiation menu', () => {
    assert.ok(PICKUP_PLAY_CATALOG.length >= 300, `catalog size ${PICKUP_PLAY_CATALOG.length}`)
    const cats = new Set(PICKUP_PLAY_CATALOG.map((i) => i.category))
    assert.ok(cats.has('fetish'), 'expected fetish category')
    assert.ok(cats.has('bondage') && cats.has('impact') && cats.has('edge'))
  })
})

describe('scorePickupPlayAnswers', () => {
  it('scores complementary seeking/offering highly', () => {
    const a = base({ seeking: ['floggers'], offering: ['rope_floor'], roleTonight: 'bottom' })
    const b = base({ seeking: ['rope_floor'], offering: ['floggers'], roleTonight: 'top' })
    const score = scorePickupPlayAnswers(a, b)
    assert.ok(score > 0.55, `expected strong menu fit, got ${score}`)
  })

  it('hard-penalizes hard-no collisions', () => {
    const a = base({ hardNos: ['floggers'] })
    const b = base({ seeking: ['floggers'], offering: ['spanking_hand'] })
    assert.ok(scorePickupPlayAnswers(a, b) < 0.15)
  })

  it('hard-penalizes non-sexual vs sexual_focus', () => {
    const a = base({ intent: 'non_sexual' })
    const b = base({ intent: 'sexual_focus' })
    assert.equal(scorePickupPlayAnswers(a, b), 0.05)
  })

  it('migrates v1 flavors into seeking/offering', () => {
    const n = normalizePickupPlayAnswers({
      version: 'pickup_play_v1',
      moods: ['playful'],
      intent: 'open_to_sexual',
      flavors: ['rope', 'impact'],
      stiPref: 'optional',
      experience: 'some',
      likert: {},
    })
    assert.ok(n)
    assert.deepEqual(n!.seeking, ['rope', 'impact'])
    assert.deepEqual(n!.stiRisk, ['discuss_before'])
    assert.equal(n!.version, 'pickup_play_v2')
  })

  it('filters play-with vs identity tags', () => {
    assert.equal(playWithAcceptsIdentity(['anyone'], ['woman']), true)
    assert.equal(playWithAcceptsIdentity(['women'], ['woman', 'afab']), true)
    assert.equal(playWithAcceptsIdentity(['women'], ['man']), false)
    assert.equal(playWithAcceptsIdentity(['trans_fem'], ['trans_woman']), true)
    assert.equal(playWithAcceptsIdentity(['amab'], ['amab']), true)
    assert.equal(playWithAcceptsIdentity(['men'], ['prefer_not']), false)
  })

  it('hard-penalizes mutual gender mismatch', () => {
    const a = base({ playWith: ['women'], iAm: ['man'] })
    const b = base({ playWith: ['men'], iAm: ['man'] })
    assert.ok(scorePickupPlayAnswers(a, b) < 0.1)
  })
})
