import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { orgEmailListEnabled, scopeEmailDoubleOptInEnabled } from './scope-email-list.js'
import { buildScopeEmailConfirmEmail } from './transactional-email.js'

describe('scope-email-list', () => {
  test('orgEmailListEnabled reads community flag', () => {
    assert.equal(orgEmailListEnabled({ emailListEnabled: true }), true)
    assert.equal(orgEmailListEnabled({ emailListEnabled: false }), false)
    assert.equal(orgEmailListEnabled(null), false)
  })

  test('scopeEmailDoubleOptInEnabled reads env', () => {
    process.env.C2K_SCOPE_EMAIL_DOUBLE_OPTIN = 'true'
    assert.equal(scopeEmailDoubleOptInEnabled(), true)
    delete process.env.C2K_SCOPE_EMAIL_DOUBLE_OPTIN
    assert.equal(scopeEmailDoubleOptInEnabled(), false)
  })

  test('buildScopeEmailConfirmEmail includes confirm link', () => {
    const { text } = buildScopeEmailConfirmEmail({
      scopeName: 'Demo Org',
      confirmUrl: 'https://example.test/email/confirm?token=abc',
    })
    assert.match(text, /Demo Org/)
    assert.match(text, /email\/confirm/)
  })
})
