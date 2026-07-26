import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  generateEmailVerificationCode,
  hashEmailVerificationSecret,
  maskEmail,
} from './email-verification.js'

describe('email verification helpers', () => {
  const prevAuth = process.env.AUTH_SECRET

  afterEach(() => {
    if (prevAuth === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = prevAuth
  })

  test('maskEmail hides local part for any provider', () => {
    assert.equal(maskEmail('sh.kinney@hotmail.com'), 'sh***@hotmail.com')
    assert.equal(maskEmail('a@proton.me'), 'a***@proton.me')
    assert.equal(maskEmail('user@gmail.com'), 'us***@gmail.com')
  })

  test('code is six digits', () => {
    const code = generateEmailVerificationCode()
    assert.match(code, /^\d{6}$/)
  })

  test('hash is stable HMAC hex and depends on AUTH_SECRET', () => {
    process.env.AUTH_SECRET = 'test-pepper-a'
    const a = hashEmailVerificationSecret('123456')
    const b = hashEmailVerificationSecret('123456')
    assert.equal(a, b)
    assert.equal(a.length, 64)

    process.env.AUTH_SECRET = 'test-pepper-b'
    const c = hashEmailVerificationSecret('123456')
    assert.notEqual(a, c)
  })
})
