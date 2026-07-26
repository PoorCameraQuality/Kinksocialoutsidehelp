import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALPHA_SOCIAL_FORCE_PROD_ENV,
  ALPHA_SOCIAL_SEED_ENV,
  evaluateAlphaSocialSeedAllowed,
} from './alpha-social-seed-guard.js'

describe('alpha-social-seed-guard', () => {
  it('refuses without ALLOW_ALPHA_SOCIAL_SEED', () => {
    const result = evaluateAlphaSocialSeedAllowed({
      USE_DATABASE: 'true',
      NODE_ENV: 'development',
    })
    assert.equal(result.allowed, false)
    assert.match(result.reason ?? '', /ALLOW_ALPHA_SOCIAL_SEED/)
  })

  it('refuses without USE_DATABASE', () => {
    const result = evaluateAlphaSocialSeedAllowed({
      [ALPHA_SOCIAL_SEED_ENV]: 'true',
      NODE_ENV: 'development',
    })
    assert.equal(result.allowed, false)
    assert.match(result.reason ?? '', /USE_DATABASE/)
  })

  it('refuses production runtime without force flag', () => {
    const result = evaluateAlphaSocialSeedAllowed({
      [ALPHA_SOCIAL_SEED_ENV]: 'true',
      USE_DATABASE: 'true',
      NODE_ENV: 'production',
    })
    assert.equal(result.allowed, false)
    assert.match(result.reason ?? '', /FORCE_ALPHA_SOCIAL_SEED_ON_PROD/)
  })

  it('allows local dev when explicitly opted in', () => {
    const result = evaluateAlphaSocialSeedAllowed({
      [ALPHA_SOCIAL_SEED_ENV]: 'true',
      USE_DATABASE: 'true',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://c2k:c2k@localhost:5432/c2k',
    })
    assert.equal(result.allowed, true)
  })

  it('allows production only with force flag', () => {
    const result = evaluateAlphaSocialSeedAllowed({
      [ALPHA_SOCIAL_SEED_ENV]: 'true',
      USE_DATABASE: 'true',
      NODE_ENV: 'production',
      [ALPHA_SOCIAL_FORCE_PROD_ENV]: 'true',
    })
    assert.equal(result.allowed, true)
  })
})
