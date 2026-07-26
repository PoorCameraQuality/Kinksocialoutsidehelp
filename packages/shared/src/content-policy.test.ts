import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  EXPLICIT_MEDIA_BLOCKED_MESSAGE,
  isAdultSuggestiveMediaAllowed,
  isExplicitMediaAllowed,
  isMediaContentRatingAllowed,
  isNudityMediaAllowed,
  mediaContentRatingBlockReason,
} from './content-policy.js'
import { MEDIA_CONTENT_RATINGS } from './media-types.js'

describe('content-policy flags', () => {
  test('defaults explicit and nudity to false', () => {
    const env = {}
    assert.equal(isExplicitMediaAllowed(env), false)
    assert.equal(isNudityMediaAllowed(env), false)
    assert.equal(isMediaContentRatingAllowed(MEDIA_CONTENT_RATINGS.explicitAdult, env), false)
    assert.equal(isMediaContentRatingAllowed(MEDIA_CONTENT_RATINGS.safePublic, env), true)
  })

  test('explicit block message matches v1 launch copy', () => {
    const reason = mediaContentRatingBlockReason(MEDIA_CONTENT_RATINGS.explicitAdult, {})
    assert.equal(reason, EXPLICIT_MEDIA_BLOCKED_MESSAGE)
  })

  test('ALLOW_EXPLICIT_MEDIA alias works', () => {
    assert.equal(isExplicitMediaAllowed({ ALLOW_EXPLICIT_MEDIA: 'true' }), true)
  })

  test('isAdultSuggestiveMediaAllowed matches isNudityMediaAllowed env gate', () => {
    assert.equal(isAdultSuggestiveMediaAllowed({}), false)
    assert.equal(isAdultSuggestiveMediaAllowed({ C2K_ALLOW_NUDITY: 'true' }), true)
    assert.equal(isAdultSuggestiveMediaAllowed, isNudityMediaAllowed)
  })
})
