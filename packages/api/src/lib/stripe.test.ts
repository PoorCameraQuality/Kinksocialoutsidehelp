import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  getStripe,
  getStripeSecretKey,
  isStripeConfigured,
  resetStripeClientForTests,
  stripeBusinessProfileUrl,
} from './stripe.js'

describe('stripe client config', () => {
  const prev = process.env.STRIPE_SECRET_KEY
  const prevWeb = process.env.C2K_PUBLIC_WEB_URL
  const prevVite = process.env.VITE_SITE_URL

  afterEach(() => {
    if (prev === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prev
    if (prevWeb === undefined) delete process.env.C2K_PUBLIC_WEB_URL
    else process.env.C2K_PUBLIC_WEB_URL = prevWeb
    if (prevVite === undefined) delete process.env.VITE_SITE_URL
    else process.env.VITE_SITE_URL = prevVite
    resetStripeClientForTests()
  })

  test('isStripeConfigured is false without secret', () => {
    delete process.env.STRIPE_SECRET_KEY
    resetStripeClientForTests()
    assert.equal(isStripeConfigured(), false)
    assert.equal(getStripeSecretKey(), null)
    assert.equal(getStripe(), null)
  })

  test('getStripe returns client when secret is set (no key logged)', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_fixture_not_real'
    resetStripeClientForTests()
    assert.equal(isStripeConfigured(), true)
    const stripe = getStripe()
    assert.ok(stripe)
  })

  test('stripeBusinessProfileUrl avoids localhost for Stripe business_profile', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'http://localhost:5173'
    delete process.env.VITE_SITE_URL
    assert.equal(
      stripeBusinessProfileUrl('demo-east-collective'),
      'https://kink.social/orgs/demo-east-collective',
    )
    process.env.C2K_PUBLIC_WEB_URL = 'https://kink.social'
    assert.equal(
      stripeBusinessProfileUrl('demo-east-collective'),
      'https://kink.social/orgs/demo-east-collective',
    )
    assert.equal(
      stripeBusinessProfileUrl('rope-dreamer', 'vendor'),
      'https://kink.social/vendors/rope-dreamer',
    )
  })
})
