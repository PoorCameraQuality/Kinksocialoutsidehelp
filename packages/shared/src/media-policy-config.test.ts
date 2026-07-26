import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  MEDIA_POLICY_MODES,
  explicitUploadAllowedInPolicyMode,
  resolveMediaPolicyMode,
} from './media-policy-config.js'

describe('media-policy-config', () => {
  const savedMode = process.env.MEDIA_POLICY_MODE
  const savedEnv = process.env.C2K_ENV
  const savedNode = process.env.NODE_ENV
  const savedExplicit = process.env.C2K_ALLOW_EXPLICIT_MEDIA

  afterEach(() => {
    if (savedMode === undefined) delete process.env.MEDIA_POLICY_MODE
    else process.env.MEDIA_POLICY_MODE = savedMode
    if (savedEnv === undefined) delete process.env.C2K_ENV
    else process.env.C2K_ENV = savedEnv
    if (savedNode === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = savedNode
    if (savedExplicit === undefined) delete process.env.C2K_ALLOW_EXPLICIT_MEDIA
    else process.env.C2K_ALLOW_EXPLICIT_MEDIA = savedExplicit
  })

  test('production defaults community_only', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.MEDIA_POLICY_MODE
    delete process.env.C2K_ALLOW_EXPLICIT_MEDIA
    assert.equal(resolveMediaPolicyMode(), MEDIA_POLICY_MODES.communityOnly)
    assert.equal(explicitUploadAllowedInPolicyMode(), false)
  })

  test('staging defaults attested_explicit_beta', () => {
    process.env.C2K_ENV = 'staging'
    delete process.env.MEDIA_POLICY_MODE
    process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
    assert.equal(resolveMediaPolicyMode(), MEDIA_POLICY_MODES.attestedExplicitBeta)
    assert.equal(explicitUploadAllowedInPolicyMode(), true)
  })

  test('explicit_enabled allows explicit uploads when flag is on', () => {
    process.env.MEDIA_POLICY_MODE = 'explicit_enabled'
    process.env.C2K_ALLOW_EXPLICIT_MEDIA = 'true'
    assert.equal(explicitUploadAllowedInPolicyMode(), true)
  })
})
