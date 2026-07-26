import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { safeCheckoutReturnPath } from './stripe-checkout-return-path.js'

describe('safeCheckoutReturnPath', () => {
  const prev = process.env.C2K_PUBLIC_WEB_URL

  afterEach(() => {
    if (prev === undefined) delete process.env.C2K_PUBLIC_WEB_URL
    else process.env.C2K_PUBLIC_WEB_URL = prev
  })

  test('accepts allowlisted convention paths', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'https://kink.social'
    assert.equal(
      safeCheckoutReturnPath('/conventions/demo/register?paid=1', '/fallback'),
      '/conventions/demo/register?paid=1',
    )
  })

  test('rejects protocol-relative and absolute URLs', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'https://kink.social'
    assert.equal(safeCheckoutReturnPath('//evil.example/phish', '/fallback'), '/fallback')
    assert.equal(safeCheckoutReturnPath('https://evil.example', '/fallback'), '/fallback')
    assert.equal(safeCheckoutReturnPath('/\\evil.example', '/fallback'), '/fallback')
  })

  test('rejects paths outside allowlist', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'https://kink.social'
    assert.equal(safeCheckoutReturnPath('/admin/secret', '/fallback'), '/fallback')
  })
})
