import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EXPLICIT_MEDIA_BLOCKED_MESSAGE,
  MEDIA_CONTENT_RATINGS,
  MEDIA_POLICY_MODES,
  MEDIA_VISIBILITIES,
} from '@c2k/shared'
import {
  applyExplicitMediaPrivacyDefaults,
  assertMediaContentRatingAllowed,
  MediaPolicyBlockedError,
} from './media-policy.js'
import {
  explicitMediaAllowsPublicUrl,
  explicitMediaEligibleForPublicDiscovery,
} from './media-visibility.js'

describe('media-policy', () => {
  it('blocks explicit attestation when ALLOW_EXPLICIT_MEDIA is false', () => {
    const prevExplicit = process.env.C2K_ALLOW_EXPLICIT_MEDIA
    const prevMode = process.env.MEDIA_POLICY_MODE
    process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'false'
    process.env.MEDIA_POLICY_MODE = MEDIA_POLICY_MODES.attestedExplicitBeta
    try {
      assert.throws(
        () => assertMediaContentRatingAllowed(MEDIA_CONTENT_RATINGS.explicitAdult),
        (err: unknown) =>
          err instanceof MediaPolicyBlockedError && err.message === EXPLICIT_MEDIA_BLOCKED_MESSAGE
      )
      assert.doesNotThrow(() => assertMediaContentRatingAllowed(MEDIA_CONTENT_RATINGS.safePublic))
    } finally {
      if (prevExplicit === undefined) delete process.env.C2K_ALLOW_EXPLICIT_MEDIA
      else process.env.C2K_ALLOW_EXPLICIT_MEDIA = prevExplicit
      if (prevMode === undefined) delete process.env.MEDIA_POLICY_MODE
      else process.env.MEDIA_POLICY_MODE = prevMode
    }
  })

  it('blocks explicit in community_only even when flag is true', () => {
    const prevExplicit = process.env.C2K_ALLOW_EXPLICIT_MEDIA
    const prevMode = process.env.MEDIA_POLICY_MODE
    process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
    process.env.MEDIA_POLICY_MODE = MEDIA_POLICY_MODES.communityOnly
    try {
      assert.throws(() => assertMediaContentRatingAllowed(MEDIA_CONTENT_RATINGS.explicitAdult))
    } finally {
      if (prevExplicit === undefined) delete process.env.C2K_ALLOW_EXPLICIT_MEDIA
      else process.env.C2K_ALLOW_EXPLICIT_MEDIA = prevExplicit
      if (prevMode === undefined) delete process.env.MEDIA_POLICY_MODE
      else process.env.MEDIA_POLICY_MODE = prevMode
    }
  })

  it('coerces explicit public preview to logged_in visibility', () => {
    assert.equal(
      applyExplicitMediaPrivacyDefaults({
        contentRating: MEDIA_CONTENT_RATINGS.explicitAdult,
        visibility: MEDIA_VISIBILITIES.publicPreview,
      }),
      MEDIA_VISIBILITIES.loggedIn
    )
  })
})

describe('explicit privacy surfaces', () => {
  it('excludes explicit from public discovery', () => {
    assert.equal(
      explicitMediaEligibleForPublicDiscovery(
        MEDIA_CONTENT_RATINGS.explicitAdult,
        MEDIA_VISIBILITIES.loggedIn
      ),
      false
    )
    assert.equal(
      explicitMediaEligibleForPublicDiscovery(
        MEDIA_CONTENT_RATINGS.safePublic,
        MEDIA_VISIBILITIES.publicPreview
      ),
      true
    )
  })

  it('blocks public URL for explicit on public preview', () => {
    assert.equal(
      explicitMediaAllowsPublicUrl(
        MEDIA_CONTENT_RATINGS.explicitAdult,
        MEDIA_VISIBILITIES.publicPreview
      ),
      false
    )
    assert.equal(
      explicitMediaAllowsPublicUrl(
        MEDIA_CONTENT_RATINGS.explicitAdult,
        MEDIA_VISIBILITIES.loggedIn
      ),
      true
    )
  })
})
