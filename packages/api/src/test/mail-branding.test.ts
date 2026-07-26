import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  mailProductName,
  passwordChangedEmailSubject,
  passwordResetEmailSubject,
} from '../lib/mail-branding.js'
import { buildPasswordResetEmail } from '../lib/password-reset.js'

describe('mail branding', () => {
  const envKeys = [
    'C2K_MAIL_PRODUCT_NAME',
    'C2K_PASSWORD_RESET_EMAIL_SUBJECT',
    'C2K_PASSWORD_CHANGED_EMAIL_SUBJECT',
  ] as const

  afterEach(() => {
    for (const key of envKeys) {
      delete process.env[key]
    }
  })

  test('password reset subject defaults to password recovery', () => {
    assert.equal(passwordResetEmailSubject(), 'Kink.Social password recovery')
    const email = buildPasswordResetEmail('test-token')
    assert.equal(email.subject, 'Kink.Social password recovery')
    assert.match(email.text, /recover your Kink\.Social password/)
    assert.match(email.html, /Recover your password/)
  })

  test('env overrides product name and subjects', () => {
    process.env.C2K_MAIL_PRODUCT_NAME = 'kink.social'
    process.env.C2K_PASSWORD_RESET_EMAIL_SUBJECT = 'Account password recovery'
    process.env.C2K_PASSWORD_CHANGED_EMAIL_SUBJECT = 'Your password was updated'

    assert.equal(mailProductName(), 'kink.social')
    assert.equal(passwordResetEmailSubject(), 'Account password recovery')
    assert.equal(passwordChangedEmailSubject(), 'Your password was updated')

    const email = buildPasswordResetEmail('test-token')
    assert.match(email.text, /recover your kink\.social password/)
  })
})
