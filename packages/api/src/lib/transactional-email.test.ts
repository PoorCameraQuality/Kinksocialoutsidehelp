import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAccountWelcomeEmail,
  buildEventRsvpConfirmationEmail,
  buildOrgWelcomeEmail,
  emailStatusPayload,
} from './transactional-email.js'

describe('transactional-email', () => {
  test('buildEventRsvpConfirmationEmail includes event link', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'https://example.test'
    const { subject, text, html } = buildEventRsvpConfirmationEmail({
      to: 'a@b.c',
      eventTitle: 'Rope 101',
      eventId: 'evt-1',
      status: 'going',
      startsAt: '2026-06-01T18:00:00.000Z',
    })
    assert.match(subject, /Rope 101/)
    assert.match(text, /https:\/\/example\.test\/events\/evt-1/)
    assert.match(html, /href="https:\/\/example\.test\/events\/evt-1"/)
  })

  test('buildOrgWelcomeEmail includes org link', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'https://example.test'
    const { subject, text } = buildOrgWelcomeEmail({
      to: 'a@b.c',
      orgName: 'Demo Collective',
      orgSlug: 'demo-collective',
    })
    assert.match(subject, /Demo Collective/)
    assert.match(text, /https:\/\/example\.test\/orgs\/demo-collective/)
  })

  test('buildAccountWelcomeEmail includes home and policy links', () => {
    process.env.C2K_PUBLIC_WEB_URL = 'https://example.test'
    const { subject, text, html } = buildAccountWelcomeEmail({
      to: 'a@b.c',
      username: 'river',
    })
    assert.match(subject, /river/)
    assert.match(text, /https:\/\/example\.test\/home/)
    assert.match(text, /https:\/\/example\.test\/guidelines/)
    assert.match(html, /href="https:\/\/example\.test\/home"/)
  })

  test('emailStatusPayload reflects env flags', () => {
    process.env.C2K_EVENT_RSVP_EMAIL = 'true'
    process.env.C2K_ORG_JOIN_EMAIL = 'true'
    process.env.C2K_ACCOUNT_WELCOME_EMAIL = 'true'
    process.env.C2K_MAIL_TRANSPORT = 'smtp'
    const s = emailStatusPayload()
    assert.equal(s.rsvpConfirmEnabled, true)
    assert.equal(s.orgJoinEmailEnabled, true)
    assert.equal(s.accountWelcomeEmailEnabled, true)
    assert.equal(s.transport, 'smtp')
  })
})
