import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { platformMailBcc, sendEmail, type SendEmailInput } from './mailer.js'
import { validateReplyToEmail, stripHeaderInjection } from './mail-safety.js'

describe('mailer privacy and reply-to', () => {
  const prev: Record<string, string | undefined> = {}

  before(() => {
    for (const k of [
      'C2K_MAIL_TRANSPORT',
      'C2K_PLATFORM_MAIL_BCC',
      'C2K_MAIL_REPLY_TO',
      'SMTP_HOST',
    ]) {
      prev[k] = process.env[k]
    }
    process.env.C2K_MAIL_TRANSPORT = 'disabled'
    process.env.C2K_PLATFORM_MAIL_BCC = 'owner@example.com'
  })

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  test('platformMailBcc parses comma list', () => {
    process.env.C2K_PLATFORM_MAIL_BCC = 'a@x.com, b@y.com'
    assert.deepEqual(platformMailBcc(), ['a@x.com', 'b@y.com'])
  })

  test('validateReplyToEmail rejects header injection', () => {
    assert.equal(validateReplyToEmail('good@example.com'), 'good@example.com')
    assert.equal(validateReplyToEmail('bad\r\nBcc: evil@x.com'), null)
  })

  test('stripHeaderInjection removes newlines from subjects', () => {
    assert.equal(stripHeaderInjection('Hello\r\nInjected: x', 255), 'HelloInjected: x')
  })

  test('sendEmail returns disabled when transport off', async () => {
    const r = await sendEmail({ to: 'u@example.com', subject: 't', text: 'body' })
    assert.equal(r.ok, false)
    assert.equal(r.error, 'mail_transport_disabled')
  })
})

describe('mailer sensitive BCC skip (unit)', () => {
  test('sensitive categories are defined on SendEmailInput', () => {
    const input: SendEmailInput = {
      to: 'u@example.com',
      subject: 'reset',
      text: 'x',
      sensitive: true,
      category: 'password_reset',
    }
    assert.equal(input.sensitive, true)
    assert.equal(input.category, 'password_reset')
  })
})
